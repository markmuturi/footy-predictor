from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime,
    ForeignKey, Text, UniqueConstraint, Date
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True)  # API-Football team ID
    name = Column(String(100), nullable=False)
    short_name = Column(String(10))
    logo_url = Column(String(255))
    league = Column(String(50), default="EPL")
    season = Column(Integer)
    created_at = Column(DateTime, server_default=func.now())

    home_matches = relationship("Match", foreign_keys="Match.home_team_id", back_populates="home_team")
    away_matches = relationship("Match", foreign_keys="Match.away_team_id", back_populates="away_team")
    players = relationship("Player", back_populates="team")
    match_stats = relationship("TeamMatchStat", back_populates="team")


class Player(Base):
    __tablename__ = "players"

    id = Column(Integer, primary_key=True)  # API-Football player ID
    name = Column(String(100), nullable=False)
    team_id = Column(Integer, ForeignKey("teams.id"))
    position = Column(String(30))
    nationality = Column(String(50))
    age = Column(Integer)
    photo_url = Column(String(255))
    created_at = Column(DateTime, server_default=func.now())

    team = relationship("Team", back_populates="players")
    match_stats = relationship("PlayerMatchStat", back_populates="player")


class Match(Base):
    __tablename__ = "matches"

    id = Column(Integer, primary_key=True)  # API-Football fixture ID
    home_team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    away_team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    match_date = Column(DateTime, nullable=False)
    league = Column(String(50), default="EPL")
    season = Column(Integer)
    matchweek = Column(Integer)
    status = Column(String(20), default="scheduled")  # scheduled, live, finished
    home_goals = Column(Integer)
    away_goals = Column(Integer)
    venue = Column(String(100))
    created_at = Column(DateTime, server_default=func.now())

    home_team = relationship("Team", foreign_keys=[home_team_id], back_populates="home_matches")
    away_team = relationship("Team", foreign_keys=[away_team_id], back_populates="away_matches")
    team_stats = relationship("TeamMatchStat", back_populates="match")
    player_stats = relationship("PlayerMatchStat", back_populates="match")
    prediction = relationship("Prediction", back_populates="match", uselist=False)


class TeamMatchStat(Base):
    __tablename__ = "team_match_stats"

    id = Column(Integer, primary_key=True, autoincrement=True)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    is_home = Column(Boolean, nullable=False)
    shots = Column(Integer, default=0)
    shots_on_target = Column(Integer, default=0)
    possession = Column(Float, default=0)
    xg = Column(Float, default=0)
    corners = Column(Integer, default=0)
    fouls = Column(Integer, default=0)
    yellow_cards = Column(Integer, default=0)
    red_cards = Column(Integer, default=0)
    passes = Column(Integer, default=0)
    pass_accuracy = Column(Float, default=0)

    __table_args__ = (UniqueConstraint("match_id", "team_id"),)

    match = relationship("Match", back_populates="team_stats")
    team = relationship("Team", back_populates="match_stats")


class PlayerMatchStat(Base):
    __tablename__ = "player_match_stats"

    id = Column(Integer, primary_key=True, autoincrement=True)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    goals = Column(Integer, default=0)
    assists = Column(Integer, default=0)
    minutes_played = Column(Integer, default=0)
    rating = Column(Float)
    shots = Column(Integer, default=0)
    shots_on_target = Column(Integer, default=0)
    passes = Column(Integer, default=0)
    pass_accuracy = Column(Float, default=0)
    tackles = Column(Integer, default=0)
    interceptions = Column(Integer, default=0)
    yellow_cards = Column(Integer, default=0)
    red_cards = Column(Integer, default=0)

    __table_args__ = (UniqueConstraint("match_id", "player_id"),)

    match = relationship("Match", back_populates="player_stats")
    player = relationship("Player", back_populates="match_stats")


class H2HRecord(Base):
    __tablename__ = "h2h_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    team_a_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    team_b_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    matches_played = Column(Integer, default=0)
    team_a_wins = Column(Integer, default=0)
    team_b_wins = Column(Integer, default=0)
    draws = Column(Integer, default=0)
    team_a_goals = Column(Integer, default=0)
    team_b_goals = Column(Integer, default=0)
    avg_goals_per_game = Column(Float, default=0)
    last_updated = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (UniqueConstraint("team_a_id", "team_b_id"),)


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False, unique=True)
    predicted_home_goals = Column(Float)
    predicted_away_goals = Column(Float)
    home_win_prob = Column(Float)
    draw_prob = Column(Float)
    away_win_prob = Column(Float)
    over_25_prob = Column(Float)
    predicted_scoreline = Column(String(10))
    confidence_score = Column(Float)
    narrative = Column(Text)
    model_version = Column(String(20), default="poisson_v1")
    created_at = Column(DateTime, server_default=func.now())

    match = relationship("Match", back_populates="prediction")
    factors = relationship("PredictionFactor", back_populates="prediction")


class PredictionFactor(Base):
    __tablename__ = "prediction_factors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    prediction_id = Column(Integer, ForeignKey("predictions.id"), nullable=False)
    factor_name = Column(String(100))
    factor_value = Column(Float)
    weight = Column(Float)

    prediction = relationship("Prediction", back_populates="factors")