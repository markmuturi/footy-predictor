from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
import models

router = APIRouter()

@router.get("/")
def get_teams(db: Session = Depends(get_db)):
    teams = db.query(models.Team).all()
    return [{"id": t.id, "name": t.name, "logo_url": t.logo_url} for t in teams]

@router.get("/{team_id}")
def get_team(team_id: int, db: Session = Depends(get_db)):
    t = db.query(models.Team).filter(models.Team.id == team_id).first()
    if not t:
        return {"error": "Team not found"}
    return {"id": t.id, "name": t.name, "logo_url": t.logo_url}

@router.get("/{team_id}/form")
def get_team_form(team_id: int, db: Session = Depends(get_db)):
    matches = (
        db.query(models.Match)
        .filter(
            (models.Match.home_team_id == team_id) | (models.Match.away_team_id == team_id),
            models.Match.status == "finished"
        )
        .order_by(models.Match.match_date.desc())
        .limit(10)
        .all()
    )
    form = []
    for m in matches:
        is_home = m.home_team_id == team_id
        team_goals = m.home_goals if is_home else m.away_goals
        opp_goals = m.away_goals if is_home else m.home_goals
        if team_goals is None or opp_goals is None:
            result = "U"
        elif team_goals > opp_goals:
            result = "W"
        elif team_goals < opp_goals:
            result = "L"
        else:
            result = "D"
        opponent_id = m.away_team_id if is_home else m.home_team_id
        opponent = db.query(models.Team).filter(models.Team.id == opponent_id).first()
        form.append({
            "match_id": m.id,
            "date": m.match_date,
            "opponent": opponent.name if opponent else None,
            "is_home": is_home,
            "goals_for": team_goals,
            "goals_against": opp_goals,
            "result": result,
        })
    return {"team_id": team_id, "form": form}