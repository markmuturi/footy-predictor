from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from database import get_db
import models

router = APIRouter()

@router.get("/")
def get_matches(
    status: str = Query(None),
    season: int = Query(2024),
    db: Session = Depends(get_db)
):
    query = db.query(models.Match).filter(models.Match.season == season)
    if status:
        query = query.filter(models.Match.status == status)
    matches = query.order_by(models.Match.match_date).limit(50).all()
    return [
        {
            "id": m.id,
            "home_team": m.home_team.name if m.home_team else None,
            "away_team": m.away_team.name if m.away_team else None,
            "match_date": m.match_date,
            "status": m.status,
            "home_goals": m.home_goals,
            "away_goals": m.away_goals,
            "matchweek": m.matchweek,
            "venue": m.venue,
        }
        for m in matches
    ]

@router.get("/{match_id}")
def get_match(match_id: int, db: Session = Depends(get_db)):
    m = db.query(models.Match).filter(models.Match.id == match_id).first()
    if not m:
        return {"error": "Match not found"}
    return {
        "id": m.id,
        "home_team": {"id": m.home_team_id, "name": m.home_team.name},
        "away_team": {"id": m.away_team_id, "name": m.away_team.name},
        "match_date": m.match_date,
        "status": m.status,
        "home_goals": m.home_goals,
        "away_goals": m.away_goals,
        "matchweek": m.matchweek,
        "venue": m.venue,
        "team_stats": [
            {
                "team_id": s.team_id,
                "is_home": s.is_home,
                "shots": s.shots,
                "shots_on_target": s.shots_on_target,
                "possession": s.possession,
                "xg": s.xg,
                "corners": s.corners,
                "yellow_cards": s.yellow_cards,
                "red_cards": s.red_cards,
            }
            for s in m.team_stats
        ],
    }