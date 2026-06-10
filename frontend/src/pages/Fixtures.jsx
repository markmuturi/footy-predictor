import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getMatches } from '../api'

const MATCHWEEKS = Array.from({ length: 38 }, (_, i) => i + 1)

function ResultBadge({ home, away }) {
  if (home > away) return <span className="text-emerald-400 text-xs font-bold">H</span>
  if (away > home) return <span className="text-red-400 text-xs font-bold">A</span>
  return <span className="text-yellow-400 text-xs font-bold">D</span>
}

export default function Fixtures() {
  const [selectedWeek, setSelectedWeek] = useState(1)
  const [search, setSearch] = useState('')

  const { data: matches, isLoading } = useQuery({
    queryKey: ['matches', 'finished', 2024],
    queryFn: () => getMatches({ status: 'finished', season: 2024 }),
  })

  const filtered = useMemo(() => {
    if (!matches) return []
    const byWeek = matches.filter(m => m.matchweek === selectedWeek)
    if (!search.trim()) return byWeek
    const q = search.toLowerCase()
    return byWeek.filter(
      m =>
        m.home_team?.toLowerCase().includes(q) ||
        m.away_team?.toLowerCase().includes(q)
    )
  }, [matches, selectedWeek, search])

  // Find the latest matchweek that has data for "jump to latest" button
  const latestWeek = useMemo(() => {
    if (!matches) return 1
    return Math.max(...matches.map(m => m.matchweek ?? 1))
  }, [matches])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Fixtures</h1>
          <p className="text-slate-400 text-sm mt-1">EPL 2024/25 · Click any match to see the prediction</p>
        </div>
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search team..."
            className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 w-40"
          />
          <button
            onClick={() => setSelectedWeek(latestWeek)}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors whitespace-nowrap"
          >
            Latest GW
          </button>
        </div>
      </div>

      {/* Matchweek selector */}
      <div className="flex flex-wrap gap-1.5">
        {MATCHWEEKS.map(w => (
          <button
            key={w}
            onClick={() => setSelectedWeek(w)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              selectedWeek === w
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            GW{w}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-14 bg-slate-800 rounded-xl animate-pulse border border-slate-700" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="text-center py-12">
              <p className="text-slate-500 text-sm">
                {search ? `No matches found for "${search}" in GW${selectedWeek}` : `No matches found for GW${selectedWeek}`}
              </p>
            </div>
          )}
          {filtered.map(m => (
            <Link
              key={m.id}
              to={`/match/${m.id}`}
              className="flex items-center justify-between bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-emerald-700 rounded-xl px-5 py-4 transition-all group"
            >
              <div className="w-44">
                <span className="text-white font-medium text-sm group-hover:text-emerald-400 transition-colors">{m.home_team}</span>
              </div>
              <div className="flex items-center gap-3">
                {m.status === 'finished' ? (
                  <>
                    <ResultBadge home={m.home_goals} away={m.away_goals} />
                    <span className="text-white font-bold text-lg tabular-nums">
                      {m.home_goals} - {m.away_goals}
                    </span>
                  </>
                ) : (
                  <span className="text-slate-400 text-sm">
                    {new Date(m.match_date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              <div className="w-44 text-right">
                <span className="text-white font-medium text-sm group-hover:text-emerald-400 transition-colors">{m.away_team}</span>
              </div>
              <div className="ml-6 hidden sm:flex items-center gap-3">
                <span className="text-slate-500 text-xs">
                  {new Date(m.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
                <span className="text-emerald-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity">View →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
