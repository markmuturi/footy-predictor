from services.narrative import generate_match_narrative
import numpy as np
from scipy.stats import poisson
from scipy.optimize import minimize
from sqlalchemy.orm import Session
from sqlalchemy import or_
import models


# ─── Rating Computation ───────────────────────────────────────────────────────

def compute_team_ratings(db: Session, season: int = 2024):
    """
    Compute attack and defence ratings for all teams using
    Dixon-Coles style Poisson regression over the full season.
    Returns dict: { team_id: { 'attack': float, 'defence': float, 'home_advantage': float } }
    """
    matches = (
        db.query(models.Match)
        .filter(
            models.Match.season == season,
            models.Match.status == "finished",
            models.Match.home_goals.isnot(None),
            models.Match.away_goals.isnot(None),
        )
        .all()
    )

    if not matches:
        return {}

    teams = db.query(models.Team).filter(models.Team.season == season).all()
    team_ids = [t.id for t in teams]
    team_index = {tid: i for i, tid in enumerate(team_ids)}
    n = len(team_ids)

    if n == 0:
        return {}

    # Initial parameters: attack[0..n-1], defence[n..2n-1], home_adv[2n]
    # Constrain: mean attack = 1.0 (log scale, so mean = 0)
    x0 = np.zeros(2 * n + 1)
    x0[2 * n] = 0.1  # small home advantage to start

    home_ids = [team_index[m.home_team_id] for m in matches if m.home_team_id in team_index and m.away_team_id in team_index]
    away_ids = [team_index[m.away_team_id] for m in matches if m.home_team_id in team_index and m.away_team_id in team_index]
    home_goals = [m.home_goals for m in matches if m.home_team_id in team_index and m.away_team_id in team_index]
    away_goals = [m.away_goals for m in matches if m.home_team_id in team_index and m.away_team_id in team_index]

    home_ids = np.array(home_ids)
    away_ids = np.array(away_ids)
    home_goals = np.array(home_goals)
    away_goals = np.array(away_goals)

    def neg_log_likelihood(params):
        attack = params[:n]
        defence = params[n:2*n]
        home_adv = params[2*n]

        # Expected goals
        mu_home = np.exp(attack[home_ids] - defence[away_ids] + home_adv)
        mu_away = np.exp(attack[away_ids] - defence[home_ids])

        # Dixon-Coles correction for low scores
        rho = -0.1
        dc_correction = np.ones(len(home_goals))
        mask_00 = (home_goals == 0) & (away_goals == 0)
        mask_10 = (home_goals == 1) & (away_goals == 0)
        mask_01 = (home_goals == 0) & (away_goals == 1)
        mask_11 = (home_goals == 1) & (away_goals == 1)

        dc_correction[mask_00] = 1 - mu_home[mask_00] * mu_away[mask_00] * rho
        dc_correction[mask_10] = 1 + mu_away[mask_10] * rho
        dc_correction[mask_01] = 1 + mu_home[mask_01] * rho
        dc_correction[mask_11] = 1 - rho

        dc_correction = np.clip(dc_correction, 1e-10, None)

        ll_home = poisson.logpmf(home_goals, mu_home)
        ll_away = poisson.logpmf(away_goals, mu_away)
        ll = ll_home + ll_away + np.log(dc_correction)

        # Constraint: sum of attack params = 0 (identification)
        penalty = 1000 * (np.sum(attack) ** 2)

        return -np.sum(ll) + penalty

    result = minimize(neg_log_likelihood, x0, method="L-BFGS-B", options={"maxiter": 500})
    params = result.x

    attack_params = params[:n]
    defence_params = params[n:2*n]
    home_adv = params[2*n]

    ratings = {}
    for tid, idx in team_index.items():
        ratings[tid] = {
            "attack": float(attack_params[idx]),
            "defence": float(defence_params[idx]),
            "home_advantage": float(home_adv),
        }

    return ratings


def get_recent_form_adjustment(db: Session, team_id: int, last_n: int = 6):
    """
    Compute a form multiplier based on last N matches.
    Above-average recent scoring -> multiplier > 1, below -> < 1.
    Returns (attack_multiplier, defence_multiplier)
    """
    matches = (
        db.query(models.Match)
        .filter(
            or_(models.Match.home_team_id == team_id, models.Match.away_team_id == team_id),
            models.Match.status == "finished",
            models.Match.home_goals.isnot(None),
        )
        .order_by(models.Match.match_date.desc())
        .limit(last_n)
        .all()
    )

    if not matches:
        return 1.0, 1.0

    goals_for = []
    goals_against = []
    for m in matches:
        if m.home_team_id == team_id:
            goals_for.append(m.home_goals or 0)
            goals_against.append(m.away_goals or 0)
        else:
            goals_for.append(m.away_goals or 0)
            goals_against.append(m.home_goals or 0)

    avg_scored = np.mean(goals_for)
    avg_conceded = np.mean(goals_against)

    # League average is ~1.5 goals per team per game in EPL
    league_avg = 1.5
    attack_mult = np.clip(avg_scored / league_avg, 0.6, 1.6)
    defence_mult = np.clip(league_avg / (avg_conceded + 0.3), 0.6, 1.6)

    return float(attack_mult), float(defence_mult)


def get_h2h_adjustment(db: Session, home_team_id: int, away_team_id: int):
    """
    Returns a small home/away goal adjustment based on H2H record.
    Max ±0.15 goals influence to avoid over-weighting.
    """
    record = db.query(models.H2HRecord).filter(
        or_(
            (models.H2HRecord.team_a_id == home_team_id) & (models.H2HRecord.team_b_id == away_team_id),
            (models.H2HRecord.team_a_id == away_team_id) & (models.H2HRecord.team_b_id == home_team_id),
        )
    ).first()

    if not record or record.matches_played == 0:
        return 0.0, 0.0

    total = record.matches_played
    if record.team_a_id == home_team_id:
        home_wins = record.team_a_wins
        away_wins = record.team_b_wins
        home_goals = record.team_a_goals
        away_goals = record.team_b_goals
    else:
        home_wins = record.team_b_wins
        away_wins = record.team_a_wins
        home_goals = record.team_b_goals
        away_goals = record.team_a_goals

    win_rate_diff = (home_wins - away_wins) / total
    avg_home_goals = home_goals / total
    avg_away_goals = away_goals / total

    home_adj = np.clip(win_rate_diff * 0.15 + (avg_home_goals - 1.5) * 0.05, -0.15, 0.15)
    away_adj = np.clip(-win_rate_diff * 0.15 + (avg_away_goals - 1.2) * 0.05, -0.15, 0.15)

    return float(home_adj), float(away_adj)


def score_probability_matrix(mu_home: float, mu_away: float, max_goals: int = 7):
    """
    Returns a (max_goals x max_goals) matrix of score probabilities
    with Dixon-Coles correction applied to low-score cells.
    """
    rho = -0.1
    matrix = np.zeros((max_goals, max_goals))

    for i in range(max_goals):
        for j in range(max_goals):
            p = poisson.pmf(i, mu_home) * poisson.pmf(j, mu_away)
            if i == 0 and j == 0:
                p *= (1 - mu_home * mu_away * rho)
            elif i == 1 and j == 0:
                p *= (1 + mu_away * rho)
            elif i == 0 and j == 1:
                p *= (1 + mu_home * rho)
            elif i == 1 and j == 1:
                p *= (1 - rho)
            matrix[i][j] = max(p, 0)

    return matrix / matrix.sum()  # renormalize


def compute_confidence(home_win_prob: float, draw_prob: float, away_win_prob: float,
                       mu_home: float, mu_away: float) -> float:
    """
    Confidence score 1-10. Higher when one outcome dominates
    and expected goals are in a realistic range.
    """
    max_prob = max(home_win_prob, draw_prob, away_win_prob)
    entropy = -sum(p * np.log(p + 1e-9) for p in [home_win_prob, draw_prob, away_win_prob])
    max_entropy = np.log(3)
    normalized_entropy = entropy / max_entropy

    # Goals realism: penalize extreme predictions
    goals_penalty = 0
    if mu_home > 3.5 or mu_away > 3.5:
        goals_penalty = 1.5
    elif mu_home < 0.5 or mu_away < 0.5:
        goals_penalty = 1.0

    raw = (max_prob * 8) + ((1 - normalized_entropy) * 4) - goals_penalty
    return float(np.clip(round(raw, 1), 1.0, 10.0))


# ─── Player Performance ───────────────────────────────────────────────────────

def predict_player_performance(db: Session, team_id: int, opponent_team_id: int):
    """
    For top players in a team, predict goals and assists based on
    rolling per-90 average adjusted for opponent defensive strength.
    """
    players = db.query(models.Player).filter(models.Player.team_id == team_id).all()
    results = []

    # Get opponent defensive stats: avg goals conceded per game
    opp_matches = (
        db.query(models.Match)
        .filter(
            or_(
                models.Match.home_team_id == opponent_team_id,
                models.Match.away_team_id == opponent_team_id,
            ),
            models.Match.status == "finished",
        )
        .order_by(models.Match.match_date.desc())
        .limit(10)
        .all()
    )

    opp_goals_conceded = []
    for m in opp_matches:
        if m.home_team_id == opponent_team_id:
            opp_goals_conceded.append(m.away_goals or 0)
        else:
            opp_goals_conceded.append(m.home_goals or 0)

    opp_def_strength = np.mean(opp_goals_conceded) if opp_goals_conceded else 1.2
    league_avg_conceded = 1.35
    def_factor = np.clip(opp_def_strength / league_avg_conceded, 0.5, 1.8)

    for player in players:
        stats = (
            db.query(models.PlayerMatchStat)
            .filter(models.PlayerMatchStat.player_id == player.id)
            .order_by(models.PlayerMatchStat.match_id.desc())
            .limit(8)
            .all()
        )

        if not stats:
            continue

        total_goals = sum(s.goals or 0 for s in stats)
        total_assists = sum(s.assists or 0 for s in stats)
        total_minutes = sum(s.minutes_played or 0 for s in stats)

        if total_minutes < 90:
            continue

        per90_goals = (total_goals / total_minutes) * 90 * def_factor
        per90_assists = (total_assists / total_minutes) * 90 * def_factor

        results.append({
            "player_id": player.id,
            "player_name": player.name,
            "position": player.position,
            "predicted_goals": round(per90_goals, 3),
            "predicted_assists": round(per90_assists, 3),
            "form_appearances": len(stats),
        })

    results.sort(key=lambda x: x["predicted_goals"] + x["predicted_assists"], reverse=True)
    return results[:5]


# ─── Main Prediction Runner ───────────────────────────────────────────────────

def run_prediction(match_id: int, db: Session):
    match = db.query(models.Match).filter(models.Match.id == match_id).first()
    if not match:
        return {"error": "Match not found"}

    ratings = compute_team_ratings(db, season=match.season or 2024)

    if not ratings:
        return {"error": "Insufficient data to compute ratings"}

    home_id = match.home_team_id
    away_id = match.away_team_id

    if home_id not in ratings or away_id not in ratings:
        return {"error": "One or both teams not in ratings"}

    hr = ratings[home_id]
    ar = ratings[away_id]

    # Base expected goals from Dixon-Coles ratings
    mu_home = np.exp(hr["attack"] - ar["defence"] + hr["home_advantage"])
    mu_away = np.exp(ar["attack"] - hr["defence"])

    # Form adjustment (last 6 matches)
    home_att_mult, home_def_mult = get_recent_form_adjustment(db, home_id, last_n=6)
    away_att_mult, away_def_mult = get_recent_form_adjustment(db, away_id, last_n=6)

    mu_home *= home_att_mult * away_def_mult
    mu_away *= away_att_mult * home_def_mult

    # H2H adjustment
    h2h_home_adj, h2h_away_adj = get_h2h_adjustment(db, home_id, away_id)
    mu_home = max(0.3, mu_home + h2h_home_adj)
    mu_away = max(0.3, mu_away + h2h_away_adj)

    # Score probability matrix
    matrix = score_probability_matrix(mu_home, mu_away)

    home_win_prob = float(np.sum(np.tril(matrix, -1)))
    away_win_prob = float(np.sum(np.triu(matrix, 1)))
    draw_prob = float(np.sum(np.diag(matrix)))
    over_25_prob = float(1 - np.sum(matrix[:3, :3]))

    # Most likely scoreline
    best_i, best_j = np.unravel_index(np.argmax(matrix), matrix.shape)
    predicted_scoreline = f"{best_i}-{best_j}"

    confidence = compute_confidence(home_win_prob, draw_prob, away_win_prob, mu_home, mu_away)

    # Player predictions
    home_players = predict_player_performance(db, home_id, away_id)
    away_players = predict_player_performance(db, away_id, home_id)

    # Build prediction factors
    home_team = db.query(models.Team).filter(models.Team.id == home_id).first()
    away_team = db.query(models.Team).filter(models.Team.id == away_id).first()

    factors = [
        {"factor_name": "home_attack_rating", "factor_value": round(hr["attack"], 4), "weight": 0.25},
        {"factor_name": "home_defence_rating", "factor_value": round(hr["defence"], 4), "weight": 0.20},
        {"factor_name": "away_attack_rating", "factor_value": round(ar["attack"], 4), "weight": 0.25},
        {"factor_name": "away_defence_rating", "factor_value": round(ar["defence"], 4), "weight": 0.20},
        {"factor_name": "home_form_attack_mult", "factor_value": round(home_att_mult, 4), "weight": 0.05},
        {"factor_name": "away_form_attack_mult", "factor_value": round(away_att_mult, 4), "weight": 0.05},
        {"factor_name": "h2h_home_adjustment", "factor_value": round(h2h_home_adj, 4), "weight": 0.05},
        {"factor_name": "h2h_away_adjustment", "factor_value": round(h2h_away_adj, 4), "weight": 0.05},
    ]

    # Upsert prediction
    existing = db.query(models.Prediction).filter(models.Prediction.match_id == match_id).first()
    if existing:
        db.query(models.PredictionFactor).filter(
            models.PredictionFactor.prediction_id == existing.id
        ).delete()
        pred = existing
    else:
        pred = models.Prediction(match_id=match_id)
        db.add(pred)
        db.flush()

    pred.predicted_home_goals = round(float(mu_home), 3)
    pred.predicted_away_goals = round(float(mu_away), 3)
    pred.home_win_prob = round(home_win_prob, 4)
    pred.draw_prob = round(draw_prob, 4)
    pred.away_win_prob = round(away_win_prob, 4)
    pred.over_25_prob = round(over_25_prob, 4)
    pred.predicted_scoreline = predicted_scoreline
    pred.confidence_score = confidence
    pred.model_version = "poisson_dc_v1"

    db.flush()

    for f in factors:
        db.add(models.PredictionFactor(
            prediction_id=pred.id,
            factor_name=f["factor_name"],
            factor_value=f["factor_value"],
            weight=f["weight"],
        ))

    db.commit()
    db.refresh(pred)

    # Build form strings for narrative context
    def form_string(team_id):
        recent = (
            db.query(models.Match)
            .filter(
                or_(models.Match.home_team_id == team_id, models.Match.away_team_id == team_id),
                models.Match.status == "finished",
            )
            .order_by(models.Match.match_date.desc())
            .limit(5)
            .all()
        )
        results = []
        for m in recent:
            hg = m.home_goals or 0
            ag = m.away_goals or 0
            if m.home_team_id == team_id:
                results.append("W" if hg > ag else ("D" if hg == ag else "L"))
            else:
                results.append("W" if ag > hg else ("D" if ag == hg else "L"))
        return " ".join(results) if results else None

    h2h_record = db.query(models.H2HRecord).filter(
        or_(
            (models.H2HRecord.team_a_id == home_id) & (models.H2HRecord.team_b_id == away_id),
            (models.H2HRecord.team_a_id == away_id) & (models.H2HRecord.team_b_id == home_id),
        )
    ).first()

    h2h_summary_str = None
    if h2h_record:
        if h2h_record.team_a_id == home_id:
            hw, aw = h2h_record.team_a_wins, h2h_record.team_b_wins
        else:
            hw, aw = h2h_record.team_b_wins, h2h_record.team_a_wins
        h2h_summary_str = (
            f"{home_team.name} {hw}W {h2h_record.draws}D {aw}W in last "
            f"{h2h_record.matches_played} meetings, "
            f"{h2h_record.avg_goals_per_game} avg goals/game"
        )

    narrative = generate_match_narrative(
        home_team=home_team.name,
        away_team=away_team.name,
        predicted_scoreline=pred.predicted_scoreline,
        predicted_home_goals=pred.predicted_home_goals,
        predicted_away_goals=pred.predicted_away_goals,
        home_win_prob=pred.home_win_prob,
        draw_prob=pred.draw_prob,
        away_win_prob=pred.away_win_prob,
        confidence_score=pred.confidence_score,
        factors=factors,
        home_form=form_string(home_id),
        away_form=form_string(away_id),
        h2h_summary=h2h_summary_str,
    )

    if narrative:
        pred.narrative = narrative
        db.commit()

    return {
        "match_id": match_id,
        "home_team": home_team.name if home_team else home_id,
        "away_team": away_team.name if away_team else away_id,
        "predicted_home_goals": pred.predicted_home_goals,
        "predicted_away_goals": pred.predicted_away_goals,
        "predicted_scoreline": pred.predicted_scoreline,
        "home_win_prob": pred.home_win_prob,
        "draw_prob": pred.draw_prob,
        "away_win_prob": pred.away_win_prob,
        "over_25_prob": pred.over_25_prob,
        "confidence_score": pred.confidence_score,
        "narrative": pred.narrative,
        "factors": factors,
        "home_player_predictions": home_players,
        "away_player_predictions": away_players,
    }