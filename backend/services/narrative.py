import httpx
import json

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "llama3.2"


def generate_match_narrative(
    home_team: str,
    away_team: str,
    predicted_scoreline: str,
    predicted_home_goals: float,
    predicted_away_goals: float,
    home_win_prob: float,
    draw_prob: float,
    away_win_prob: float,
    confidence_score: float,
    factors: list,
    home_form: str = None,
    away_form: str = None,
    h2h_summary: str = None,
) -> str:
    factor_lines = "\n".join(
        f"- {f['factor_name'].replace('_', ' ')}: {f['factor_value']}"
        for f in (factors or [])
    )

    prompt = f"""You are a football analyst. Based on the statistical data below, write a concise 3-sentence match preview explaining the key factors behind this prediction. Be specific, objective, and analytical. Do not mention probabilities or model names. Focus on what the data suggests about each team's strengths and weaknesses going into this match.

Match: {home_team} vs {away_team}
Predicted score: {predicted_scoreline} (xG: {predicted_home_goals} - {predicted_away_goals})
{home_team} win probability: {round(home_win_prob * 100)}%
Draw probability: {round(draw_prob * 100)}%
{away_team} win probability: {round(away_win_prob * 100)}%
Model confidence: {confidence_score}/10
{f"Recent form - {home_team}: {home_form}" if home_form else ""}
{f"Recent form - {away_team}: {away_form}" if away_form else ""}
{f"Head-to-head context: {h2h_summary}" if h2h_summary else ""}

Key statistical factors:
{factor_lines}

Write exactly 3 sentences. No bullet points. No headers."""

    try:
        response = httpx.post(
            OLLAMA_URL,
            json={"model": MODEL, "prompt": prompt, "stream": False},
            timeout=60,
        )
        response.raise_for_status()
        result = response.json()
        return result.get("response", "").strip()
    except httpx.ConnectError:
        return None
    except Exception:
        return None