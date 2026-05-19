import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getPlayer, getPlayerStats } from '../api'

export default function PlayerStats() {
  const { id } = useParams()
  const playerId = parseInt(id)

  const { data: player } = useQuery({ queryKey: ['player', playerId], queryFn: () => getPlayer(playerId) })
  const { data: statsData, isLoading } = useQuery({ queryKey: ['playerStats', playerId], queryFn: () => getPlayerStats(playerId) })

  if (isLoading) return <div className="text-slate-400 py-20 text-center">Loading...</div>

  const stats = statsData?.recent_stats ?? []
  const totalGoals = stats.reduce((s, r) => s + (r.goals ?? 0), 0)
  const totalAssists = stats.reduce((s, r) => s + (r.assists ?? 0), 0)
  const avgRating = stats.length > 0
    ? (stats.reduce((s, r) => s + (r.rating ?? 0), 0) / stats.length).toFixed(2)
    : '—'

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        {player?.photo_url && <img src={player.photo_url} alt={player.name} className="w-14 h-14 rounded-full object-cover" />}
        <div>
          <h1 className="text-2xl font-bold text-white">{player?.name ?? `Player ${playerId}`}</h1>
          <p className="text-slate-400 text-sm">{player?.position} · Age {player?.age} · {player?.nationality}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Goals (last 10)', value: totalGoals, color: 'text-emerald-400' },
          { label: 'Assists (last 10)', value: totalAssists, color: 'text-blue-400' },
          { label: 'Avg Rating', value: avgRating, color: 'text-yellow-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-slate-800 rounded-xl p-4 border border-slate-700 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-slate-500 text-xs mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 divide-y divide-slate-700">
        {stats.length === 0 && <p className="text-slate-500 text-sm p-5">No match stats available.</p>}
        {stats.map((s, i) => (
          <div key={i} className="flex items-center justify-between px-5 py-3 text-sm">
            <span className="text-slate-400 text-xs w-24">Match {s.match_id}</span>
            <span className="text-emerald-400 font-medium">{s.goals}G</span>
            <span className="text-blue-400 font-medium">{s.assists}A</span>
            <span className="text-slate-300">{s.minutes_played} min</span>
            <span className="text-yellow-400">{s.rating ?? '—'}</span>
            <span className="text-slate-500">{s.pass_accuracy ? `${s.pass_accuracy}% pass` : '—'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}