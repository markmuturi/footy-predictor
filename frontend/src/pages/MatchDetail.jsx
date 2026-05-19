import { useParams, Link } from 'react-router-dom'
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
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function ConfidenceDial({ score }) {
  const color = score >= 7 ? 'text-emerald-400' : score >= 4 ? 'text-yellow-400' : 'text-red-400'
  return (
    <div className="flex flex-col items-center">
      <span className={`text-5xl font-bold ${color}`}>{score}</span>
      <span className="text-slate-500 text-xs mt-1">/ 10 confidence</span>
    </div>
  )
}

export default function MatchDetail() {
  const { id } = useParams()
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
      queryClient.invalidateQueries({ queryKey: ['accuracy'] })
    },
  })

  if (matchLoading) return <div className="text-slate-400 py-20 text-center">Loading match...</div>
  if (!match || match.error) return <div className="text-red-400 py-20 text-center">Match not found.</div>

  // Use local prediction (just generated) or fall back to stored prediction
  const prediction = localPrediction || (existingPrediction?.error ? null : existingPrediction)
  const hasPrediction = !!prediction

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-slate-500 text-xs">GW{match.matchweek} · {match.venue}</span>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
            match.status === 'finished' ? 'bg-slate-700 text-slate-300' : 'bg-emerald-900 text-emerald-300'
          }`}>
            {match.status}
          </span>
        </div>

        <div className="flex items-center justify-between mt-4">
          <Link
            to={`/team/${match.home_team?.id}`}
            className="text-xl font-bold text-white hover:text-emerald-400 transition-colors"
          >
            {match.home_team?.name}
          </Link>
          <div className="text-center">
            {match.status === 'finished' ? (
              <span className="text-3xl font-bold text-white">
                {match.home_goals} - {match.away_goals}
              </span>
            ) : (
              <span className="text-slate-400 text-lg">vs</span>
            )}
            <p className="text-slate-500 text-xs mt-1">
              {new Date(match.match_date).toLocaleDateString('en-GB', {
                weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
              })}
            </p>
          </div>
          <Link
            to={`/team/${match.away_team?.id}`}
            className="text-xl font-bold text-white hover:text-emerald-400 transition-colors text-right"
          >
            {match.away_team?.name}
          </Link>
        </div>
      </div>

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
                  <span className="text-white font-semibold w-8 text-right">{home}</span>
                  <div className="flex-1 flex gap-1 h-2">
                    <div
                      className="bg-emerald-500 rounded-l-full h-full"
                      style={{ width: `${(home / total) * 100}%` }}
                    />
                    <div className="bg-slate-600 rounded-r-full h-full flex-1" />
                  </div>
                  <span className="text-slate-400 text-xs w-28 text-center">{label}</span>
                  <div className="flex-1 flex gap-1 h-2">
                    <div className="bg-slate-600 rounded-l-full h-full flex-1" />
                    <div
                      className="bg-blue-500 rounded-r-full h-full"
                      style={{ width: `${(away / total) * 100}%` }}
                    />
                  </div>
                  <span className="text-white font-semibold w-8">{away}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-slate-300 font-semibold">Prediction</h2>
          <button
            onClick={() => generate()}
            disabled={isPending}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm rounded-lg font-medium transition-colors"
          >
            {isPending ? 'Generating...' : hasPrediction ? 'Regenerate' : 'Generate Prediction'}
          </button>
        </div>

        {isPending && (
          <div className="flex items-center gap-3 py-4">
            <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Running model and generating analysis...</p>
          </div>
        )}

        {!isPending && predLoading && (
          <p className="text-slate-400 text-sm">Loading prediction...</p>
        )}

        {!isPending && !predLoading && !hasPrediction && (
          <p className="text-slate-500 text-sm">
            No prediction yet. Click Generate to run the model.
          </p>
        )}

        {!isPending && hasPrediction && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="text-center">
                <p className="text-slate-400 text-xs mb-1">Predicted Score</p>
                <p className="text-4xl font-bold text-white">{prediction.predicted_scoreline}</p>
                <p className="text-slate-500 text-xs mt-1">
                  xG {prediction.predicted_home_goals} – {prediction.predicted_away_goals}
                </p>
              </div>
              <ConfidenceDial score={prediction.confidence_score} />
            </div>

            <div className="space-y-3">
              <ProbBar
                label={`${match.home_team?.name} Win`}
                prob={prediction.home_win_prob}
                color="bg-emerald-500"
              />
              <ProbBar label="Draw" prob={prediction.draw_prob} color="bg-yellow-500" />
              <ProbBar
                label={`${match.away_team?.name} Win`}
                prob={prediction.away_win_prob}
                color="bg-blue-500"
              />
              <ProbBar label="Over 2.5 Goals" prob={prediction.over_25_prob} color="bg-purple-500" />
            </div>

            {prediction.narrative && (
              <div className="bg-slate-700 rounded-lg p-4">
                <p className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-2">
                  Analysis
                </p>
                <p className="text-slate-200 text-sm leading-relaxed">{prediction.narrative}</p>
              </div>
            )}

            {prediction.factors?.length > 0 && (
              <div>
                <p className="text-slate-400 text-xs font-medium mb-2 uppercase tracking-wide">
                  Key Factors
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {prediction.factors.map(f => (
                    <div key={f.name || f.factor_name} className="bg-slate-700 rounded-lg px-3 py-2">
                      <p className="text-slate-400 text-xs">
                        {(f.name || f.factor_name).replace(/_/g, ' ')}
                      </p>
                      <p className="text-white text-sm font-semibold">{f.value ?? f.factor_value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(prediction.home_player_predictions?.length > 0 ||
              prediction.away_player_predictions?.length > 0) && (
              <div>
                <p className="text-slate-400 text-xs font-medium mb-2 uppercase tracking-wide">
                  Player Predictions
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    {
                      label: match.home_team?.name,
                      players: prediction.home_player_predictions,
                    },
                    {
                      label: match.away_team?.name,
                      players: prediction.away_player_predictions,
                    },
                  ].map(({ label, players }) => (
                    <div key={label}>
                      <p className="text-slate-300 text-sm font-medium mb-2">{label}</p>
                      {players?.map(p => (
                        <div
                          key={p.player_id}
                          className="flex justify-between text-xs py-1 border-b border-slate-700"
                        >
                          <span className="text-slate-300">{p.player_name}</span>
                          <span className="text-emerald-400">
                            {p.predicted_goals}G {p.predicted_assists}A
                          </span>
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

      <div className="flex gap-3">
        <Link
          to={`/h2h/${match.home_team?.id}/${match.away_team?.id}`}
          className="flex-1 text-center py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-medium text-slate-300 transition-colors"
        >
          Head to Head
        </Link>
        <Link
          to={`/team/${match.home_team?.id}`}
          className="flex-1 text-center py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-medium text-slate-300 transition-colors"
        >
          {match.home_team?.name} Form
        </Link>
        <Link
          to={`/team/${match.away_team?.id}`}
          className="flex-1 text-center py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-medium text-slate-300 transition-colors"
        >
          {match.away_team?.name} Form
        </Link>
      </div>
    </div>
  )
}