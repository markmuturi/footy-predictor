import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getH2H, getTeam } from '../api'

export default function H2H() {
  const { teamAId, teamBId } = useParams()

  const { data: h2h, isLoading } = useQuery({
    queryKey: ['h2h', teamAId, teamBId],
    queryFn: () => getH2H(teamAId, teamBId),
  })
  const { data: teamA } = useQuery({ queryKey: ['team', teamAId], queryFn: () => getTeam(teamAId) })
  const { data: teamB } = useQuery({ queryKey: ['team', teamBId], queryFn: () => getTeam(teamBId) })

  if (isLoading) return <div className="text-slate-400 py-20 text-center">Loading H2H...</div>

  if (!h2h || h2h.error) return (
    <div className="text-slate-400 py-20 text-center">
      No head-to-head data found for this matchup.
    </div>
  )

  const isTeamA = h2h.team_a_id === parseInt(teamAId)
  const homeWins = isTeamA ? h2h.team_a_wins : h2h.team_b_wins
  const awayWins = isTeamA ? h2h.team_b_wins : h2h.team_a_wins
  const homeGoals = isTeamA ? h2h.team_a_goals : h2h.team_b_goals
  const awayGoals = isTeamA ? h2h.team_b_goals : h2h.team_a_goals
  const total = h2h.matches_played

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-white">Head to Head</h1>

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="text-center">
            {teamA?.logo_url && <img src={teamA.logo_url} alt={teamA.name} className="w-12 h-12 object-contain mx-auto mb-2" />}
            <p className="text-white font-semibold">{teamA?.name}</p>
          </div>
          <div className="text-center">
            <p className="text-slate-400 text-sm">{total} meetings</p>
            <p className="text-slate-500 text-xs">{h2h.avg_goals_per_game} goals/game avg</p>
          </div>
          <div className="text-center">
            {teamB?.logo_url && <img src={teamB.logo_url} alt={teamB.name} className="w-12 h-12 object-contain mx-auto mb-2" />}
            <p className="text-white font-semibold">{teamB?.name}</p>
          </div>
        </div>

        <div className="space-y-4">
          {[
            { label: 'Wins', a: homeWins, b: awayWins },
            { label: 'Goals', a: homeGoals, b: awayGoals },
            { label: 'Draws', a: h2h.draws, b: h2h.draws, center: true },
          ].map(({ label, a, b, center }) => (
            <div key={label}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-emerald-400 font-bold">{a}</span>
                <span className="text-slate-400 text-xs">{label}</span>
                <span className="text-blue-400 font-bold">{b}</span>
              </div>
              {!center && total > 0 && (
                <div className="flex h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full" style={{ width: `${(a / (a + b || 1)) * 100}%` }} />
                  <div className="bg-blue-500 h-full flex-1" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}