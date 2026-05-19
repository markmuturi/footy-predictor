from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
import models

router = APIRouter()

@router.get("/{player_id}")
def get_player(player_id: int, db: Session = Depends(get_db)):
    p = db.query(models.Player).filter(models.Player.id == player_id).first()
    if not p:
        return {"error": "Player not found"}
    return {
        "id": p.id, "name": p.name, "position": p.position,
        "team_id": p.team_id, "nationality": p.nationality, "age": p.age,
        "photo_url": p.photo_url,
    }

@router.get("/{player_id}/stats")
def get_player_stats(player_id: int, db: Session = Depends(get_db)):
    stats = (
        db.query(models.PlayerMatchStat)
        .filter(models.PlayerMatchStat.player_id == player_id)
        .order_by(models.PlayerMatchStat.match_id.desc())
        .limit(10)
        .all()
    )
    return {
        "player_id": player_id,
        "recent_stats": [
            {
                "match_id": s.match_id,
                "goals": s.goals,
                "assists": s.assists,
                "minutes_played": s.minutes_played,
                "rating": s.rating,
                "pass_accuracy": s.pass_accuracy,
            }
            for s in stats
        ]
    }