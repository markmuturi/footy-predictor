import { useQuery } from '@tanstack/react-query'
import { getAccuracy } from '../api'

function AccuracyCard({ label, value, sub, color }) {
  return (
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 text-center">
      <p className="text-slate-400 text-sm mb-1">{label}</p>
      <p className={`text-4xl font-bold ${color}`}>{value ?? '—'}</p>
      {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
    </div>
  )
}

export default function Accuracy() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['accuracy'],
    queryFn: getAccuracy,
  })

  if (isLoading) return <div className="text-slate-400 py-20 text-center">Computing accuracy...</div>
  if (error) return <div className="text-red-400 py-20 text-center">Failed to load accuracy data.</div>

  const hasData = data.total_evaluated > 0

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white">Model Accuracy</h1>

      {!hasData && (
        <p className="text-slate-400">No evaluated predictions yet. Generate predictions for finished matches first.</p>
      )}

      {hasData && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <AccuracyCard
              label="Outcome Accuracy"
              value={data.outcome_accuracy ? `${data.outcome_accuracy}%` : null}
              sub={`W/D/L correct · ${data.total_evaluated} predictions`}
              color="text-emerald-400"
            />
            <AccuracyCard
              label="Exact Score"
              value={data.exact_score_accuracy ? `${data.exact_score_accuracy}%` : null}
              sub="Predicted scoreline correct"
              color="text-blue-400"
            />
            <AccuracyCard
              label="Within 1 Goal"
              value={data.within_one_goal_accuracy ? `${data.within_one_goal_accuracy}%` : null}
              sub="Both teams ±1 goal"
              color="text-yellow-400"
            />
          </div>

          <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
            <h2 className="text-slate-300 font-semibold mb-4">Accuracy by Matchweek</h2>
            <div className="space-y-2">
              {data.by_matchweek.map(w => (
                <div key={w.matchweek} className="flex items-center gap-4">
                  <span className="text-slate-500 text-xs w-12">GW{w.matchweek}</span>
                  <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${w.accuracy}%` }}
                    />
                  </div>
                  <span className="text-white text-sm font-medium w-12 text-right">{w.accuracy}%</span>
                  <span className="text-slate-500 text-xs w-16">{w.correct}/{w.total}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}