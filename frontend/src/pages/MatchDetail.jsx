import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { getMatch, getPrediction, generatePrediction } from '../api'

function ProbBar({ label, prob, color }) {
  const pct = Math.round((prob ?? 0) * 100)
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-slate-400">{label}</span>
        <span className="text-white font-semibold">{pct}%</span>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function ConfidenceDial({ score }) {
  const color = score >= 7 ? 'text-emerald-400' : score >= 4 ? 'text-yellow-400' : 'text-red-400'
  const label = score >= 7 ? 'High confidence' : score >= 4 ? 'Moderate' : 'Low confidence'
  return (
    <div className="flex flex-col items-center">
      <span className={`text-5xl font-bold ${color}`}>{score}</span>
      <span className="text-slate-500 text-xs mt-1">/ 10 · {label}</span>
    </div>
  )
}

function PredictionCorrectBadge({ match, prediction }) {
  if (!prediction || match.status !== 'finished') return null
  const ah = match.home_goals
  const aa = match.away_goals
  if (ah === null || aa === null) return null

  const actual = ah > aa ? 'home' : aa > ah ? 'away' : 'draw'
  const predicted =
    prediction.home_win_prob > prediction.away_win_prob && prediction.home_win_prob > prediction.draw_prob
      ? 'home'
      : prediction.away_win_prob > prediction.home_win_prob && prediction.away_win_prob > prediction.draw_prob
      ? 'away'
      : 'draw'

  const correct = actual === predicted
  return (
    <span className={`text-xs px-2 py-1 rounded-full font-medium ${correct ? 'bg-emerald-900 text-emerald-300' : 'bg-red-900/50 text-red-300'}`}>
      {correct ? '✓ Prediction correct' : '✗ Prediction incorrect'}
    </span>
  )
}

function ShareButton({ matchId, homeTeam, awayTeam }) {
  const [copied, setCopied] = useState(false)
  const url = `${window.location.origin}/match/${matchId}`

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `${homeTeam} vs ${awayTeam} — FootyPredictor`,
        text: `Check out the prediction for ${homeTeam} vs ${awayTeam}`,
        url,
      })
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    }
  }

  return (
    <button
      onClick={handleShare}
      className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
    >
      {copied ? '✓ Copied!' : '⎘ Share'}
    </button>
  )
}

export default function MatchDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const matchId = parseInt(id)
  const queryClient = useQueryClient()
  const [localPrediction, setLocalPrediction] = useState(null)

  const { data: match, isLoading: matchLoading } = useQuery({
    queryKey: ['match', matchId],
    queryFn: () => getMatch(matchId),
  })

  const { data: existingPrediction, isLoading: predLoading } = useQuery({
    queryKey: ['prediction', matchId],
    queryFn: () => getPrediction(matchId),
  })

  const { mutate: generate, isPending } = useMutation({
    mutationFn: () => generatePrediction(matchId),
    onSuccess: (data) => {
      setLocalPrediction(data)
      queryClient.invalidateQueries({ queryKey: ['prediction', matchId] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  if (matchLoading) return (
    <div className="max-w-3xl mx-auto space-y-4 pt-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-32 bg-slate-800 rounded-xl animate-pulse border border-slate-700" />
      ))}
    </div>
  )

  if (!match || match.error) return (
    <div className="text-center py-20 space-y-4">
      <p className="text-red-400">Match not found.</p>
      <button onClick={() => navigate(-1)} className="text-slate-400 text-sm hover:text-white">← Go back</button>
    </div>
  )

  const prediction = localPrediction || (existingPrediction?.error ? null : existingPrediction)
  const hasPrediction = !!prediction

  return (
    <div className="space-y-5 max-w-3xl mx-auto">

      {/* Back */}
      <button onClick={() => navigate(-1)} className="text-slate-500 text-sm hover:text-slate-300 transition-colors">
        ← Back to fixtures
      </button>

      {/* Match header */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-slate-500 text-xs">GW{match.matchweek} · {match.venue}</span>
          <div className="flex items-center gap-2">
            <PredictionCorrectBadge match={match} prediction={prediction} />
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
              match.status === 'finished' ? 'bg-slate-700 text-slate-300' : 'bg-emerald-900 text-emerald-300'
            }`}>
              {match.status}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between mt-4">
          <Link
            to={`/team/${match.home_team?.id}`}
            className="text-xl font-bold text-white hover:text-emerald-400 transition-colors max-w-[35%]"
          >
            {match.home_team?.name}
          </Link>
          <div className="text-center">
            {match.status === 'finished' ? (
              <span className="text-3xl font-bold text-white tabular-nums">
                {match.home_goals} - {match.away_goals}
              </span>
            ) : (
              <span className="text-slate-400 text-lg">vs</span>
            )}
            <p className="text-slate-500 text-xs mt-1">
              {new Date(match.match_date).toLocaleDateString('en-GB', {
                weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
              })}
            </p>
          </div>
          <Link
            to={`/team/${match.away_team?.id}`}
            className="text-xl font-bold text-white hover:text-emerald-400 transition-colors text-right max-w-[35%]"
          >
            {match.away_team?.name}
          </Link>
        </div>
      </div>

      {/* Match stats */}
      {match.team_stats?.length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <h2 className="text-slate-300 font-semibold mb-4">Match Stats</h2>
          <div className="space-y-3">
            {[
              { label: 'Shots', key: 'shots' },
              { label: 'Shots on Target', key: 'shots_on_target' },
              { label: 'Possession %', key: 'possession' },
              { label: 'Corners', key: 'corners' },
              { label: 'Yellow Cards', key: 'yellow_cards' },
            ].map(({ label, key }) => {
              const home = match.team_stats.find(s => s.is_home)?.[key] ?? 0
              const away = match.team_stats.find(s => !s.is_home)?.[key] ?? 0
              const total = home + away || 1
              return (
                <div key={key} className="flex items-center gap-3 text-sm">
                  <span className="text-white font-semibold w-8 text-right tabular-nums">{home}</span>
                  <div className="flex-1 flex gap-0.5 h-2">
                    <div className="bg-emerald-500 rounded-l-full h-full transition-all" style={{ width: `${(home / total) * 100}%` }} />
                    <div className="bg-slate-600 rounded-r-full h-full flex-1" />
                  </div>
                  <span className="text-slate-400 text-xs w-28 text-center">{label}</span>
                  <div className="flex-1 flex gap-0.5 h-2">
                    <div className="bg-slate-600 rounded-l-full h-full flex-1" />
                    <div className="bg-blue-500 rounded-r-full h-full transition-all" style={{ width: `${(away / total) * 100}%` }} />
                  </div>
                  <span className="text-white font-semibold w-8 tabular-nums">{away}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Prediction panel */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-slate-300 font-semibold">Model Prediction</h2>
          <div className="flex items-center gap-2">
            {hasPrediction && (
              <ShareButton matchId={matchId} homeTeam={match.home_team?.name} awayTeam={match.away_team?.name} />
            )}
            <button
              onClick={() => generate()}
              disabled={isPending}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm rounded-lg font-medium transition-colors"
            >
              {isPending ? 'Running model...' : hasPrediction ? 'Regenerate' : 'Generate Prediction'}
            </button>
          </div>
        </div>

        {isPending && (
          <div className="flex items-center gap-3 py-6">
            <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <p className="text-slate-400 text-sm">Computing ratings, running Poisson model...</p>
          </div>
        )}

        {!isPending && predLoading && (
          <div className="h-8 bg-slate-700 rounded animate-pulse" />
        )}

        {!isPending && !predLoading && !hasPrediction && (
          <div className="text-center py-8 space-y-2">
            <p className="text-slate-400 text-sm">No prediction generated yet.</p>
            <p className="text-slate-600 text-xs">Click Generate to run the statistical model on this match.</p>
          </div>
        )}

        {!isPending && hasPrediction && (
          <div className="space-y-6">
            {/* Score + confidence */}
            <div className="flex items-center justify-between bg-slate-700/50 rounded-xl p-4">
              <div className="text-center">
                <p className="text-slate-400 text-xs mb-1">Predicted Score</p>
                <p className="text-4xl font-bold text-white tabular-nums">{prediction.predicted_scoreline}</p>
                <p className="text-slate-500 text-xs mt-1">
                  xG {prediction.predicted_home_goals} – {prediction.predicted_away_goals}
                </p>
              </div>
              <ConfidenceDial score={prediction.confidence_score} />
            </div>

            {/* Probability bars */}
            <div className="space-y-3">
              <ProbBar label={`${match.home_team?.name} Win`} prob={prediction.home_win_prob} color="bg-emerald-500" />
              <ProbBar label="Draw" prob={prediction.draw_prob} color="bg-yellow-500" />
              <ProbBar label={`${match.away_team?.name} Win`} prob={prediction.away_win_prob} color="bg-blue-500" />
              <ProbBar label="Over 2.5 Goals" prob={prediction.over_25_prob} color="bg-purple-500" />
            </div>

            {/* Narrative */}
            {prediction.narrative && (
              <div className="bg-slate-700 rounded-xl p-4 border-l-4 border-emerald-500">
                <p className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-2">Analysis</p>
                <p className="text-slate-200 text-sm leading-relaxed">{prediction.narrative}</p>
              </div>
            )}

            {/* Key factors */}
            {prediction.factors?.length > 0 && (
              <div>
                <p className="text-slate-400 text-xs font-medium mb-3 uppercase tracking-wide">Key Factors</p>
                <div className="grid grid-cols-2 gap-2">
                  {prediction.factors.map(f => (
                    <div key={f.name || f.factor_name} className="bg-slate-700 rounded-lg px-3 py-2">
                      <p className="text-slate-400 text-xs capitalize">{(f.name || f.factor_name).replace(/_/g, ' ')}</p>
                      <p className="text-white text-sm font-semibold tabular-nums">{f.value ?? f.factor_value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Player predictions */}
            {(prediction.home_player_predictions?.length > 0 || prediction.away_player_predictions?.length > 0) && (
              <div>
                <p className="text-slate-400 text-xs font-medium mb-3 uppercase tracking-wide">Player Predictions</p>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: match.home_team?.name, players: prediction.home_player_predictions },
                    { label: match.away_team?.name, players: prediction.away_player_predictions },
                  ].map(({ label, players }) => (
                    <div key={label}>
                      <p className="text-slate-300 text-sm font-medium mb-2">{label}</p>
                      {players?.map(p => (
                        <div key={p.player_id} className="flex justify-between text-xs py-1.5 border-b border-slate-700 last:border-0">
                          <span className="text-slate-300 truncate mr-2">{p.player_name}</span>
                          <span className="text-emerald-400 font-medium flex-shrink-0">{p.predicted_goals}G {p.predicted_assists}A</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom links */}
      <div className="grid grid-cols-3 gap-3">
        <Link
          to={`/h2h/${match.home_team?.id}/${match.away_team?.id}`}
          className="text-center py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-sm font-medium text-slate-300 transition-colors"
        >
          H2H Record
        </Link>
        <Link
          to={`/team/${match.home_team?.id}`}
          className="text-center py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-sm font-medium text-slate-300 transition-colors truncate px-2"
        >
          {match.home_team?.name} Form
        </Link>
        <Link
          to={`/team/${match.away_team?.id}`}
          className="text-center py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-sm font-medium text-slate-300 transition-colors truncate px-2"
        >
          {match.away_team?.name} Form
        </Link>
      </div>

    </div>
  )
}
