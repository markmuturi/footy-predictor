import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
import models
import httpx
import time
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("API_FOOTBALL_KEY")
BASE_URL = os.getenv("API_FOOTBALL_BASE")
LEAGUE_ID = int(os.getenv("EPL_LEAGUE_ID", 39))

HEADERS = {"x-apisports-key": API_KEY}
REQUEST_BUDGET = 80


def fetch(endpoint, params={}):
    url = f"{BASE_URL}/{endpoint}"
    response = httpx.get(url, headers=HEADERS, params=params, timeout=30)
    if response.status_code == 429:
        print("  Rate limited. Waiting 65 seconds...")
        time.sleep(65)
        response = httpx.get(url, headers=HEADERS, params=params, timeout=30)
    response.raise_for_status()
    time.sleep(7)
    return response.json().get("response", [])


def ingest_teams(db, season):
    print(f"Ingesting teams for {season}...")
    data = fetch("teams", {"league": LEAGUE_ID, "season": season})
    for item in data:
        t = item["team"]
        existing = db.query(models.Team).filter(models.Team.id == t["id"]).first()
        if not existing:
            db.add(models.Team(
                id=t["id"],
                name=t["name"],
                short_name=t.get("code"),
                logo_url=t.get("logo"),
                league="EPL",
                season=season,
            ))
    db.commit()
    print(f"  Done: {len(data)} teams")
    return 1


def ingest_fixtures(db, season):
    print(f"Ingesting fixtures for {season}...")
    data = fetch("fixtures", {"league": LEAGUE_ID, "season": season})
    count = 0
    for item in data:
        fixture = item["fixture"]
        teams = item["teams"]
        goals = item["goals"]
        league_info = item.get("league", {})

        status_map = {
            "FT": "finished", "AET": "finished", "PEN": "finished",
            "1H": "live", "2H": "live", "HT": "live",
            "NS": "scheduled", "TBD": "scheduled", "PST": "scheduled",
            "CANC": "cancelled", "ABD": "cancelled",
        }
        raw_status = fixture.get("status", {}).get("short", "NS")
        status = status_map.get(raw_status, "scheduled")

        from datetime import datetime, timezone
        match_date = datetime.fromtimestamp(fixture["timestamp"], tz=timezone.utc)

        round_str = league_info.get("round", "")
        matchweek = None
        if round_str and "Regular Season - " in round_str:
            try:
                matchweek = int(round_str.replace("Regular Season - ", ""))
            except ValueError:
                pass

        existing = db.query(models.Match).filter(models.Match.id == fixture["id"]).first()
        if existing:
            existing.status = status
            existing.home_goals = goals.get("home")
            existing.away_goals = goals.get("away")
        else:
            db.add(models.Match(
                id=fixture["id"],
                home_team_id=teams["home"]["id"],
                away_team_id=teams["away"]["id"],
                match_date=match_date,
                league="EPL",
                season=season,
                matchweek=matchweek,
                status=status,
                home_goals=goals.get("home"),
                away_goals=goals.get("away"),
                venue=fixture.get("venue", {}).get("name"),
            ))
        count += 1
    db.commit()
    print(f"  Done: {count} fixtures")
    return 1


def ingest_fixture_stats(db, fixture_id, season):
    data = fetch("fixtures/statistics", {"fixture": fixture_id})
    for team_data in data:
        team_id = team_data["team"]["id"]
        stats_list = team_data.get("statistics", [])

        def get_stat(name):
            for s in stats_list:
                if s["type"] == name:
                    val = s["value"]
                    if val is None:
                        return 0
                    if isinstance(val, str) and val.endswith("%"):
                        return float(val.replace("%", ""))
                    return float(val) if val else 0
            return 0

        match = db.query(models.Match).filter(models.Match.id == fixture_id).first()
        if not match:
            continue

        existing = db.query(models.TeamMatchStat).filter(
            models.TeamMatchStat.match_id == fixture_id,
            models.TeamMatchStat.team_id == team_id,
        ).first()

        if not existing:
            db.add(models.TeamMatchStat(
                match_id=fixture_id,
                team_id=team_id,
                is_home=(match.home_team_id == team_id),
                shots=int(get_stat("Total Shots")),
                shots_on_target=int(get_stat("Shots on Goal")),
                possession=get_stat("Ball Possession"),
                corners=int(get_stat("Corner Kicks")),
                fouls=int(get_stat("Fouls")),
                yellow_cards=int(get_stat("Yellow Cards")),
                red_cards=int(get_stat("Red Cards")),
                passes=int(get_stat("Total passes")),
                pass_accuracy=get_stat("Passes accurate"),
            ))
    db.commit()


def ingest_players(db, season, max_pages=5):
    print(f"Ingesting players for {season} (up to {max_pages} pages)...")
    total = 0
    for page in range(1, max_pages + 1):
        url = f"{BASE_URL}/players"
        r = httpx.get(url, headers=HEADERS, params={"league": LEAGUE_ID, "season": season, "page": page}, timeout=30)
        if r.status_code == 429:
            print("  Rate limited. Waiting 65 seconds...")
            time.sleep(65)
            r = httpx.get(url, headers=HEADERS, params={"league": LEAGUE_ID, "season": season, "page": page}, timeout=30)
        time.sleep(7)
        data = r.json().get("response", [])
        if not data:
            break
        for item in data:
            p = item["player"]
            stats = item.get("statistics", [{}])[0]
            team_info = stats.get("team", {})
            if not db.query(models.Player).filter(models.Player.id == p["id"]).first():
                db.add(models.Player(
                    id=p["id"],
                    name=p["name"],
                    team_id=team_info.get("id"),
                    position=stats.get("games", {}).get("position"),
                    nationality=p.get("nationality"),
                    age=p.get("age"),
                    photo_url=p.get("photo"),
                ))
            total += 1
        db.commit()
        print(f"  Page {page} done ({total} players)")
    return max_pages


def ingest_h2h(db, team_a_id, team_b_id):
    data = fetch("fixtures/headtohead", {"h2h": f"{team_a_id}-{team_b_id}", "last": 20})
    if not data:
        return

    a_wins = b_wins = draws = a_goals = b_goals = 0
    for item in data:
        teams = item["teams"]
        goals = item["goals"]
        home_id = teams["home"]["id"]
        hg = goals.get("home") or 0
        ag = goals.get("away") or 0
        if home_id == team_a_id:
            a_goals += hg; b_goals += ag
            if hg > ag: a_wins += 1
            elif ag > hg: b_wins += 1
            else: draws += 1
        else:
            a_goals += ag; b_goals += hg
            if ag > hg: a_wins += 1
            elif hg > ag: b_wins += 1
            else: draws += 1

    total = len(data)
    existing = db.query(models.H2HRecord).filter(
        models.H2HRecord.team_a_id == team_a_id,
        models.H2HRecord.team_b_id == team_b_id,
    ).first()

    if existing:
        existing.matches_played = total
        existing.team_a_wins = a_wins
        existing.team_b_wins = b_wins
        existing.draws = draws
        existing.team_a_goals = a_goals
        existing.team_b_goals = b_goals
        existing.avg_goals_per_game = round((a_goals + b_goals) / total, 2) if total > 0 else 0
    else:
        db.add(models.H2HRecord(
            team_a_id=team_a_id, team_b_id=team_b_id,
            matches_played=total, team_a_wins=a_wins,
            team_b_wins=b_wins, draws=draws,
            team_a_goals=a_goals, team_b_goals=b_goals,
            avg_goals_per_game=round((a_goals + b_goals) / total, 2) if total > 0 else 0,
        ))
    db.commit()


def run(season: int, stats_limit: int = 30, player_pages: int = 3):
    db = SessionLocal()
    requests_used = 0

    try:
        print(f"\n=== Seeding season {season} ===")

        requests_used += ingest_teams(db, season)
        print(f"[{requests_used} req used]")

        requests_used += ingest_fixtures(db, season)
        print(f"[{requests_used} req used]")

        player_req = ingest_players(db, season, max_pages=player_pages)
        requests_used += player_req
        print(f"[{requests_used} req used]")

        finished = (
            db.query(models.Match)
            .filter(models.Match.status == "finished", models.Match.season == season)
            .order_by(models.Match.match_date.desc())
            .limit(stats_limit)
            .all()
        )
        print(f"Ingesting stats for {len(finished)} matches...")
        for i, match in enumerate(finished):
            ingest_fixture_stats(db, match.id, season)
            requests_used += 1
            print(f"  [{requests_used} req] {match.id} ({i+1}/{len(finished)})")
            if requests_used >= REQUEST_BUDGET:
                print("Budget reached.")
                break

        remaining = REQUEST_BUDGET - requests_used
        if remaining > 5:
            recent = (
                db.query(models.Match)
                .filter(models.Match.status == "finished", models.Match.season == season)
                .order_by(models.Match.match_date.desc())
                .limit(20)
                .all()
            )
            pairs = set()
            for m in recent:
                pairs.add((min(m.home_team_id, m.away_team_id), max(m.home_team_id, m.away_team_id)))

            for i, (a, b) in enumerate(list(pairs)[:remaining]):
                ingest_h2h(db, a, b)
                requests_used += 1
                print(f"  [{requests_used} req] H2H {a} vs {b}")
                if requests_used >= REQUEST_BUDGET:
                    break

        print(f"=== Season {season} complete. {requests_used} requests used. ===\n")

    finally:
        db.close()


if __name__ == "__main__":
    season = int(sys.argv[1]) if len(sys.argv) > 1 else 2024
    run(season)