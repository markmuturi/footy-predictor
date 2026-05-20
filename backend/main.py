from fastapi.middleware.cors import CORSMiddleware
import os
from fastapi import FastAPI
from database import engine
import models

from routers import matches, teams, players, predictions, h2h, dashboard

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Footy Predictor API", version="1.0.0")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(matches.router, prefix="/api/matches", tags=["Matches"])
app.include_router(teams.router, prefix="/api/teams", tags=["Teams"])
app.include_router(players.router, prefix="/api/players", tags=["Players"])
app.include_router(predictions.router, prefix="/api/predictions", tags=["Predictions"])
app.include_router(h2h.router, prefix="/api/h2h", tags=["H2H"])

@app.get("/")
def root():
    return {"status": "Footy Predictor API running"}