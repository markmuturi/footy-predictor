import httpx
import os
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from database import SessionLocal
import models
import time

load_dotenv()

API_KEY = os.getenv("API_FOOTBALL_KEY")
BASE_URL = os.getenv("API_FOOTBALL_BASE")
LEAGUE_ID = int(os.getenv("EPL_LEAGUE_ID", 39))
SEASON = int(os.getenv("CURRENT_SEASON", 2024))

HEADERS = {
    "x-apisports-key": API_KEY
}


def fetch(endpoint: str, params: dict = {}):
    url = f"{BASE_URL}/{endpoint}"
    response = httpx.get(url, headers=HEADERS, params=params, timeout=30)
    if response.status_code == 429:
        print("  Rate limited. Waiting 65 seconds...")
        time.sleep(65)
        response = httpx.get(url, headers=HEADERS, params=params, timeout=30)
    response.raise_for_status()
    time.sleep(7)  # 7 second gap = ~8 requests/min, safely under the 10/min limit
    return response.json().get("response", [])


def ingest_teams(db: Session):
    print("Ingesting teams...")
    data = fetch("teams", {"league": LEAGUE_ID, "season": SEASON})
    for item in data:
        team_data = item["team"]
        existing = db.query(models.Team).filter(models.Team.id == team_data["id"]).first()
        if not existing:
            team = models.Team(
                id=team_data["id"],
                name=team_data["name"],
                short_name=team_data.get("code"),
                logo_url=team_data.get("logo"),
                league="EPL",
                season=SEASON,
            )
            db.add(team)
    db.commit()
    print(f"Teams ingested: {len(data)}")


def ingest_fixtures(db: Session):
    print("Ingesting fixtures...")
    data = fetch("fixtures", {"league": LEAGUE_ID, "season": SEASON})
    count = 0
    for item in data:
        fixture = item["fixture"]
        teams = item["teams"]
        goals = item["goals"]
        league_info = item.get("league", {})

        existing = db.query(models.Match).filter(models.Match.id == fixture["id"]).first()

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

        if existing:
            existing.status = status
            existing.home_goals = goals.get("home")
            existing.away_goals = goals.get("away")
        else:
            match = models.Match(
                id=fixture["id"],
                home_team_id=teams["home"]["id"],
                away_team_id=teams["away"]["id"],
                match_date=match_date,
                league="EPL",
                season=SEASON,
                matchweek=int(r.replace("Regular Season - ", "")) if (r := league_info.get("round", "")) and "Regular Season - " in r else None,
                status=status,
                home_goals=goals.get("home"),
                away_goals=goals.get("away"),
                venue=fixture.get("venue", {}).get("name"),
            )
            db.add(match)
        count += 1

    db.commit()
    print(f"Fixtures processed: {count}")


def ingest_fixture_stats(db: Session, fixture_id: int):
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

        is_home = match.home_team_id == team_id

        existing = db.query(models.TeamMatchStat).filter(
            models.TeamMatchStat.match_id == fixture_id,
            models.TeamMatchStat.team_id == team_id,
        ).first()

        if not existing:
            stat = models.TeamMatchStat(
                match_id=fixture_id,
                team_id=team_id,
                is_home=is_home,
                shots=int(get_stat("Total Shots")),
                shots_on_target=int(get_stat("Shots on Goal")),
                possession=get_stat("Ball Possession"),
                corners=int(get_stat("Corner Kicks")),
                fouls=int(get_stat("Fouls")),
                yellow_cards=int(get_stat("Yellow Cards")),
                red_cards=int(get_stat("Red Cards")),
                passes=int(get_stat("Total passes")),
                pass_accuracy=get_stat("Passes accurate"),
            )
            db.add(stat)
    db.commit()


def ingest_players(db: Session):
    print("Ingesting players (page by page)...")
    page = 1
    total = 0
    while True:
        data = fetch("players", {"league": LEAGUE_ID, "season": SEASON, "page": page})
        if not data:
            break
        for item in data:
            player_data = item["player"]
            stats = item.get("statistics", [{}])[0]
            team_info = stats.get("team", {})

            existing = db.query(models.Player).filter(models.Player.id == player_data["id"]).first()
            if not existing:
                player = models.Player(
                    id=player_data["id"],
                    name=player_data["name"],
                    team_id=team_info.get("id"),
                    position=stats.get("games", {}).get("position"),
                    nationality=player_data.get("nationality"),
                    age=player_data.get("age"),
                    photo_url=player_data.get("photo"),
                )
                db.add(player)
            total += 1
        db.commit()
        print(f"  Page {page} done ({total} players so far)")
        page += 1
    print(f"Players ingested: {total}")


def ingest_h2h(db: Session, team_a_id: int, team_b_id: int):
    data = fetch("fixtures/headtohead", {"h2h": f"{team_a_id}-{team_b_id}", "last": 20})
    if not data:
        return

    a_wins = b_wins = draws = a_goals = b_goals = 0
    for item in data:
        teams = item["teams"]
        goals = item["goals"]
        home_id = teams["home"]["id"]
        away_id = teams["away"]["id"]
        hg = goals.get("home") or 0
        ag = goals.get("away") or 0

        if home_id == team_a_id:
            a_goals += hg
            b_goals += ag
            if hg > ag:
                a_wins += 1
            elif ag > hg:
                b_wins += 1
            else:
                draws += 1
        else:
            a_goals += ag
            b_goals += hg
            if ag > hg:
                a_wins += 1
            elif hg > ag:
                b_wins += 1
            else:
                draws += 1

    total = len(data)
    avg_goals = round((a_goals + b_goals) / total, 2) if total > 0 else 0

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
        existing.avg_goals_per_game = avg_goals
    else:
        record = models.H2HRecord(
            team_a_id=team_a_id,
            team_b_id=team_b_id,
            matches_played=total,
            team_a_wins=a_wins,
            team_b_wins=b_wins,
            draws=draws,
            team_a_goals=a_goals,
            team_b_goals=b_goals,
            avg_goals_per_game=avg_goals,
        )
        db.add(record)
    db.commit()