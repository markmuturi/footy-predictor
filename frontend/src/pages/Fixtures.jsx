import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getMatches } from '../api'

const SEASONS = [
  { value: 2024, label: '2024/25' },
  { value: 2023, label: '2023/24' },
  { value: 2022, label: '2022/23' },
]

const MATCHWEEKS = Array.from({ length: 38 }, (_, i) => i + 1)

function ResultBadge({ home, away }) {
  if (home > away) return <span className="text-emerald-400 text-xs font-bold">H</span>
  if (away > home) return <span className="text-red-400 text-xs font-bold">A</span>
  return <span className="text-yellow-400 text-xs font-bold">D</span>
}

export default function Fixtures() {
  const [selectedSeason, setSelectedSeason] = useState(2024)
  const [selectedWeek, setSelectedWeek] = useState(1)

  const { data: matches, isLoading } = useQuery({
    queryKey: ['matches', 'finished', selectedSeason],
    queryFn: () => getMatches({ status: 'finished', season: selectedSeason }),
  })

  const filtered = matches?.filter(m => m.matchweek === selectedWeek) ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Fixtures</h1>
        <div className="flex gap-2">
          {SEASONS.map(s => (
            <button
              key={s.value}
              onClick={() => { setSelectedSeason(s.value); setSelectedWeek(1) }}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                selectedSeason === s.value
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {MATCHWEEKS.map(w => (
          <button
            key={w}
            onClick={() => setSelectedWeek(w)}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
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
        <div className="text-slate-400">Loading fixtures...</div>
      ) : (
        <div className="space-y-2">
          {filtered.length === 0 && (
            <p className="text-slate-500 text-sm">
              No matches found for GW{selectedWeek} in the {SEASONS.find(s => s.value === selectedSeason)?.label} season.
              {selectedSeason !== 2024 && " This season's data hasn't been seeded yet."}
            </p>
          )}
          {filtered.map(m => (
            <Link
              key={m.id}
              to={`/match/${m.id}`}
              className="flex items-center justify-between bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl px-5 py-4 transition-colors"
            >
              <div className="w-44">
                <span className="text-white font-medium text-sm">{m.home_team}</span>
              </div>
              <div className="flex items-center gap-3">
                {m.status === 'finished' ? (
                  <>
                    <ResultBadge home={m.home_goals} away={m.away_goals} />
                    <span className="text-white font-bold text-lg">
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
                <span className="text-white font-medium text-sm">{m.away_team}</span>
              </div>
              <span className="text-slate-500 text-xs ml-6 hidden sm:block">
                {new Date(m.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}