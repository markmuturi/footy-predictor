import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { getTeam, getTeamForm } from '../api'

const resultColors = {
  W: 'bg-emerald-500 text-white',
  D: 'bg-yellow-500 text-white',
  L: 'bg-red-500 text-white',
  U: 'bg-slate-600 text-slate-300',
}

export default function TeamForm() {
  const { id } = useParams()
  const teamId = parseInt(id)
  const navigate = useNavigate()

  const { data: team } = useQuery({ queryKey: ['team', teamId], queryFn: () => getTeam(teamId) })
  const { data: formData, isLoading } = useQuery({ queryKey: ['teamForm', teamId], queryFn: () => getTeamForm(teamId) })

  if (isLoading) return (
    <div className="max-w-2xl mx-auto space-y-4 pt-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-14 bg-slate-800 rounded-xl animate-pulse border border-slate-700" />
      ))}
    </div>
  )

  const form = formData?.form ?? []
  const wins = form.filter(f => f.result === 'W').length
  const draws = form.filter(f => f.result === 'D').length
  const losses = form.filter(f => f.result === 'L').length
  const goalsFor = form.reduce((s, f) => s + (f.goals_for ?? 0), 0)
  const goalsAgainst = form.reduce((s, f) => s + (f.goals_against ?? 0), 0)
  const gd = goalsFor - goalsAgainst

  return (
    <div className="space-y-6 max-w-2xl mx-auto">

      <button onClick={() => navigate(-1)} className="text-slate-500 text-sm hover:text-slate-300 transition-colors">
        ← Back
      </button>

      {/* Team header */}
      <div className="flex items-center gap-4 bg-slate-800 rounded-xl border border-slate-700 p-5">
        {team?.logo_url && (
          <img src={team.logo_url} alt={team.name} className="w-16 h-16 object-contain flex-shrink-0" />
        )}
        <div>
          <h1 className="text-2xl font-bold text-white">{team?.name ?? `Team ${teamId}`}</h1>
          <p className="text-slate-400 text-sm mt-0.5">EPL 2024/25 · Last 10 matches</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Wins', value: wins, color: 'text-emerald-400' },
          { label: 'Draws', value: draws, color: 'text-yellow-400' },
          { label: 'Losses', value: losses, color: 'text-red-400' },
          { label: 'GD', value: `${gd > 0 ? '+' : ''}${gd}`, color: gd > 0 ? 'text-emerald-400' : gd < 0 ? 'text-red-400' : 'text-white' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-slate-800 rounded-xl p-4 border border-slate-700 text-center">
            <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
            <p className="text-slate-500 text-xs mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Form strip */}
      {form.length > 0 && (
        <div className="flex gap-2 items-center">
          <span className="text-slate-500 text-xs mr-1">Form</span>
          {form.slice().reverse().map((f, i) => (
            <div
              key={i}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${resultColors[f.result]}`}
              title={`vs ${f.opponent}: ${f.goals_for}-${f.goals_against}`}
            >
              {f.result}
            </div>
          ))}
        </div>
      )}

      {/* Match list */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 divide-y divide-slate-700">
        {form.length === 0 && (
          <p className="text-slate-500 text-sm p-5">No form data available.</p>
        )}
        {form.map((f, i) => (
          <Link
            key={i}
            to={`/match/${f.match_id}`}
            className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-700 transition-colors group"
          >
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${resultColors[f.result]}`}>
              {f.result}
            </div>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${f.is_home ? 'bg-slate-600 text-slate-300' : 'bg-slate-700 text-slate-400'}`}>
              {f.is_home ? 'H' : 'A'}
            </span>
            <span className="text-white text-sm flex-1 group-hover:text-emerald-400 transition-colors">{f.opponent}</span>
            <span className="text-white font-semibold text-sm tabular-nums">
              {f.goals_for} - {f.goals_against}
            </span>
            <span className="text-slate-500 text-xs ml-2 hidden sm:block">
              {new Date(f.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </span>
            <span className="text-emerald-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity">→</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
