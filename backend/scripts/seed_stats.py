# scripts/seed_stats.py
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from services.ingestion import ingest_fixture_stats, HEADERS, BASE_URL
import models
import httpx
import time

def run(season: int = 2024, batch_size: int = 80):
    db = SessionLocal()
    requests_used = 0

    try:
        # Only fetch stats for matches that don't have them yet
        finished = (
            db.query(models.Match)
            .outerjoin(
                models.TeamMatchStat,
                models.TeamMatchStat.match_id == models.Match.id
            )
            .filter(
                models.Match.status == "finished",
                models.Match.season == season,
                models.TeamMatchStat.id.is_(None),  # no stats yet
            )
            .order_by(models.Match.match_date.asc())
            .limit(batch_size)
            .all()
        )

        print(f"Found {len(finished)} matches without stats for season {season}")

        for i, match in enumerate(finished):
            ingest_fixture_stats(db, match.id, season)
            requests_used += 1
            print(f"  [{requests_used} req] Match {match.id} GW{match.matchweek} ({i+1}/{len(finished)})")
            if requests_used >= batch_size:
                print("Batch limit reached. Run again tomorrow.")
                break

        print(f"Done. {requests_used} requests used.")

    finally:
        db.close()

if __name__ == "__main__":
    season = int(sys.argv[1]) if len(sys.argv) > 1 else 2024
    run(season)