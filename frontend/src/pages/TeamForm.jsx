import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
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

  const { data: team } = useQuery({ queryKey: ['team', teamId], queryFn: () => getTeam(teamId) })
  const { data: formData, isLoading } = useQuery({ queryKey: ['teamForm', teamId], queryFn: () => getTeamForm(teamId) })

  if (isLoading) return <div className="text-slate-400 py-20 text-center">Loading...</div>

  const form = formData?.form ?? []
  const wins = form.filter(f => f.result === 'W').length
  const draws = form.filter(f => f.result === 'D').length
  const losses = form.filter(f => f.result === 'L').length
  const goalsFor = form.reduce((s, f) => s + (f.goals_for ?? 0), 0)
  const goalsAgainst = form.reduce((s, f) => s + (f.goals_against ?? 0), 0)

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        {team?.logo_url && <img src={team.logo_url} alt={team.name} className="w-12 h-12 object-contain" />}
        <h1 className="text-2xl font-bold text-white">{team?.name ?? `Team ${teamId}`}</h1>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Wins', value: wins, color: 'text-emerald-400' },
          { label: 'Draws', value: draws, color: 'text-yellow-400' },
          { label: 'Losses', value: losses, color: 'text-red-400' },
          { label: 'GD', value: `${goalsFor > goalsAgainst ? '+' : ''}${goalsFor - goalsAgainst}`, color: 'text-white' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-slate-800 rounded-xl p-4 border border-slate-700 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-slate-500 text-xs mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        {form.map((f, i) => (
          <div
            key={i}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${resultColors[f.result]}`}
            title={`vs ${f.opponent}: ${f.goals_for}-${f.goals_against}`}
          >
            {f.result}
          </div>
        ))}
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 divide-y divide-slate-700">
        {form.map((f, i) => (
          <Link
            key={i}
            to={`/match/${f.match_id}`}
            className="flex items-center justify-between px-5 py-3 hover:bg-slate-700 transition-colors"
          >
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${resultColors[f.result]}`}>
              {f.result}
            </div>
            <span className="text-slate-400 text-xs w-8 text-center">{f.is_home ? 'H' : 'A'}</span>
            <span className="text-white text-sm flex-1">{f.opponent}</span>
            <span className="text-white font-semibold text-sm">
              {f.goals_for} - {f.goals_against}
            </span>
            <span className="text-slate-500 text-xs ml-4">
              {new Date(f.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </span>
          </Link>
        ))}
        {form.length === 0 && (
          <p className="text-slate-500 text-sm p-5">No form data available.</p>
        )}
      </div>
    </div>
  )
}