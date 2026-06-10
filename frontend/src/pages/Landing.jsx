import { Link } from 'react-router-dom'

const SAMPLE_PREDICTION = {
  home: 'Arsenal',
  away: 'Chelsea',
  scoreline: '2-1',
  homeWin: 54,
  draw: 24,
  awayWin: 22,
  confidence: 7.4,
  narrative:
    "Arsenal's strong home attack rating and Chelsea's defensive vulnerabilities away from Stamford Bridge make the Gunners clear favourites here. The Dixon-Coles model weights Arsenal's last six home wins heavily, while Chelsea have conceded in each of their last five away fixtures. H2H history slightly favours Arsenal at the Emirates, reinforcing a narrow home win as the most likely outcome.",
}

function MiniProbBar({ label, pct, color }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="text-white font-semibold">{pct}%</span>
      </div>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function Landing() {
  return (
    <div className="space-y-20">

      {/* Hero */}
      <div className="text-center space-y-6 pt-8">
        <div className="inline-flex items-center gap-2 bg-emerald-900/40 border border-emerald-700 rounded-full px-4 py-1.5 text-emerald-400 text-sm font-medium">
          ⚽ EPL 2024/25 Season · Poisson Model
        </div>
        <h1 className="text-5xl font-bold text-white leading-tight">
          Football predictions<br />
          <span className="text-emerald-400">backed by statistics</span>
        </h1>
        <p className="text-slate-400 text-lg max-w-xl mx-auto">
          Every Premier League match analysed using Dixon-Coles Poisson regression.
          See win probabilities, expected goals, and AI-generated match analysis — not just a scoreline.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            to="/fixtures"
            className="px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-xl transition-colors text-lg"
          >
            Browse Fixtures
          </Link>
          <a
            href="#how-it-works"
            className="px-8 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium rounded-xl transition-colors text-lg"
          >
            How it works
          </a>
        </div>
      </div>

      {/* Sample prediction card */}
      <div className="max-w-lg mx-auto">
        <p className="text-slate-500 text-xs text-center uppercase tracking-widest mb-4">Sample prediction</p>
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-5 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-white font-bold text-lg">{SAMPLE_PREDICTION.home}</span>
            <div className="text-center">
              <span className="text-3xl font-bold text-emerald-400">{SAMPLE_PREDICTION.scoreline}</span>
              <p className="text-slate-500 text-xs mt-0.5">predicted</p>
            </div>
            <span className="text-white font-bold text-lg">{SAMPLE_PREDICTION.away}</span>
          </div>

          <div className="space-y-2">
            <MiniProbBar label={`${SAMPLE_PREDICTION.home} Win`} pct={SAMPLE_PREDICTION.homeWin} color="bg-emerald-500" />
            <MiniProbBar label="Draw" pct={SAMPLE_PREDICTION.draw} color="bg-yellow-500" />
            <MiniProbBar label={`${SAMPLE_PREDICTION.away} Win`} pct={SAMPLE_PREDICTION.awayWin} color="bg-blue-500" />
          </div>

          <div className="flex items-center justify-between border-t border-slate-700 pt-4">
            <div>
              <p className="text-slate-400 text-xs">Confidence</p>
              <p className="text-emerald-400 font-bold text-xl">{SAMPLE_PREDICTION.confidence}<span className="text-slate-500 text-sm">/10</span></p>
            </div>
            <div className="bg-slate-700 rounded-lg p-3 max-w-xs">
              <p className="text-slate-300 text-xs leading-relaxed line-clamp-3">{SAMPLE_PREDICTION.narrative}</p>
            </div>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div id="how-it-works" className="space-y-8">
        <h2 className="text-2xl font-bold text-white text-center">How it works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: '📊',
              title: 'Statistical model',
              body: 'Dixon-Coles Poisson regression trained on every EPL match. Attack and defence ratings computed per team, adjusted for home advantage.',
            },
            {
              icon: '📈',
              title: 'Form + H2H context',
              body: 'Recent form over the last 6 matches adjusts base ratings up or down. Head-to-head history adds a final calibration layer.',
            },
            {
              icon: '🤖',
              title: 'AI match analysis',
              body: 'Once probabilities are computed, a local language model writes a 3-sentence analyst summary explaining the key factors.',
            },
          ].map(({ icon, title, body }) => (
            <div key={title} className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-3">
              <span className="text-3xl">{icon}</span>
              <h3 className="text-white font-semibold">{title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="text-center pb-12 space-y-4">
        <h2 className="text-2xl font-bold text-white">Ready to explore?</h2>
        <p className="text-slate-400">Browse all 380 EPL fixtures with predictions for every match.</p>
        <Link
          to="/fixtures"
          className="inline-block px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-xl transition-colors"
        >
          View All Fixtures
        </Link>
      </div>

    </div>
  )
}
