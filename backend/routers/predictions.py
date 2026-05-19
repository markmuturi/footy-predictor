from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
import models

router = APIRouter()

@router.post("/generate/{match_id}")
def generate_prediction(match_id: int, db: Session = Depends(get_db)):
    from services.prediction_engine import run_prediction
    result = run_prediction(match_id, db)
    return result

@router.get("/{match_id}")
def get_prediction(match_id: int, db: Session = Depends(get_db)):
    p = db.query(models.Prediction).filter(models.Prediction.match_id == match_id).first()
    if not p:
        return {"error": "No prediction found for this match"}
    return {
        "match_id": p.match_id,
        "predicted_home_goals": p.predicted_home_goals,
        "predicted_away_goals": p.predicted_away_goals,
        "home_win_prob": p.home_win_prob,
        "draw_prob": p.draw_prob,
        "away_win_prob": p.away_win_prob,
        "over_25_prob": p.over_25_prob,
        "predicted_scoreline": p.predicted_scoreline,
        "confidence_score": p.confidence_score,
        "narrative": p.narrative,
        "factors": [
            {"name": f.factor_name, "value": f.factor_value, "weight": f.weight}
            for f in p.factors
        ],
    }

