from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
import models
from datetime import datetime, timezone

router = APIRouter()

@router.get("/summary")
def get_dashboard_summary(db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)

    upcoming = (
        db.query(models.Match)
        .filter(models.Match.status == "scheduled", models.Match.match_date >= now)
        .order_by(models.Match.match_date)
        .limit(5)
        .all()
    )

    recent = (
        db.query(models.Match)
        .filter(models.Match.status == "finished")
        .order_by(models.Match.match_date.desc())
        .limit(5)
        .all()
    )

    total_predictions = db.query(func.count(models.Prediction.id)).scalar()

    correct = 0
    total_evaluated = 0
    evaluated_predictions = (
        db.query(models.Prediction)
        .join(models.Match)
        .filter(models.Match.status == "finished")
        .all()
    )
    for pred in evaluated_predictions:
        m = pred.match
        if m.home_goals is None or m.away_goals is None:
            continue
        total_evaluated += 1
        actual_outcome = "home" if m.home_goals > m.away_goals else ("away" if m.away_goals > m.home_goals else "draw")
        predicted_outcome = (
            "home" if pred.home_win_prob > pred.away_win_prob and pred.home_win_prob > pred.draw_prob
            else "away" if pred.away_win_prob > pred.home_win_prob and pred.away_win_prob > pred.draw_prob
            else "draw"
        )
        if actual_outcome == predicted_outcome:
            correct += 1

    accuracy = round((correct / total_evaluated) * 100, 1) if total_evaluated > 0 else None

    def serialize_match(m):
        return {
            "id": m.id,
            "home_team": m.home_team.name if m.home_team else None,
            "away_team": m.away_team.name if m.away_team else None,
            "match_date": m.match_date,
            "status": m.status,
            "home_goals": m.home_goals,
            "away_goals": m.away_goals,
        }

    return {
        "upcoming_fixtures": [serialize_match(m) for m in upcoming],
        "recent_results": [serialize_match(m) for m in recent],
        "total_predictions": total_predictions,
        "accuracy": accuracy,
        "evaluated_predictions": total_evaluated,
    }
    
@router.get("/accuracy")
def get_accuracy_breakdown(db: Session = Depends(get_db)):
    evaluated = (
        db.query(models.Prediction)
        .join(models.Match)
        .filter(models.Match.status == "finished")
        .all()
    )

    total = 0
    correct_outcome = 0
    exact_score = 0
    within_one = 0
    by_matchweek = {}

    for pred in evaluated:
        m = pred.match
        if m.home_goals is None or m.away_goals is None:
            continue

        total += 1
        ah, aa = m.home_goals, m.away_goals
        ph = round(pred.predicted_home_goals or 0)
        pa = round(pred.predicted_away_goals or 0)

        actual_outcome = "home" if ah > aa else ("away" if aa > ah else "draw")
        pred_outcome = (
            "home" if pred.home_win_prob > pred.away_win_prob and pred.home_win_prob > pred.draw_prob
            else "away" if pred.away_win_prob > pred.home_win_prob and pred.away_win_prob > pred.draw_prob
            else "draw"
        )

        if actual_outcome == pred_outcome:
            correct_outcome += 1

        if ph == ah and pa == aa:
            exact_score += 1

        if abs(ph - ah) <= 1 and abs(pa - aa) <= 1:
            within_one += 1

        week = m.matchweek or 0
        if week not in by_matchweek:
            by_matchweek[week] = {"total": 0, "correct": 0}
        by_matchweek[week]["total"] += 1
        if actual_outcome == pred_outcome:
            by_matchweek[week]["correct"] += 1

    weekly = sorted([
        {
            "matchweek": w,
            "total": v["total"],
            "correct": v["correct"],
            "accuracy": round((v["correct"] / v["total"]) * 100, 1) if v["total"] > 0 else 0,
        }
        for w, v in by_matchweek.items()
    ], key=lambda x: x["matchweek"])

    return {
        "total_evaluated": total,
        "outcome_accuracy": round((correct_outcome / total) * 100, 1) if total > 0 else None,
        "exact_score_accuracy": round((exact_score / total) * 100, 1) if total > 0 else None,
        "within_one_goal_accuracy": round((within_one / total) * 100, 1) if total > 0 else None,
        "by_matchweek": weekly,
    }