from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
import models

router = APIRouter()

@router.get("/{team_a_id}/{team_b_id}")
def get_h2h(team_a_id: int, team_b_id: int, db: Session = Depends(get_db)):
    record = db.query(models.H2HRecord).filter(
        ((models.H2HRecord.team_a_id == team_a_id) & (models.H2HRecord.team_b_id == team_b_id)) |
        ((models.H2HRecord.team_a_id == team_b_id) & (models.H2HRecord.team_b_id == team_a_id))
    ).first()
    if not record:
        return {"error": "No H2H record found"}
    return {
        "team_a_id": record.team_a_id,
        "team_b_id": record.team_b_id,
        "matches_played": record.matches_played,
        "team_a_wins": record.team_a_wins,
        "team_b_wins": record.team_b_wins,
        "draws": record.draws,
        "team_a_goals": record.team_a_goals,
        "team_b_goals": record.team_b_goals,
        "avg_goals_per_game": record.avg_goals_per_game,
    }