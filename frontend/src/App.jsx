import { Routes, Route, NavLink, Link } from 'react-router-dom'
import Landing from './pages/Landing'
import Fixtures from './pages/Fixtures'
import MatchDetail from './pages/MatchDetail'
import TeamForm from './pages/TeamForm'
import H2H from './pages/H2H'
import PlayerStats from './pages/PlayerStats'
import Accuracy from './pages/Accuracy'
import WakeUpBanner from './components/WakeUpBanner'

function NavItem({ to, label, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-emerald-500 text-white'
            : 'text-slate-400 hover:text-white hover:bg-slate-700'
        }`
      }
    >
      {label}
    </NavLink>
  )
}

export default function App() {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <WakeUpBanner />
      <nav className="bg-slate-800 border-b border-slate-700 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/" className="text-emerald-400 font-bold text-lg mr-4 hover:text-emerald-300 transition-colors">
            ⚽ FootyPredictor
          </Link>
          <NavItem to="/fixtures" label="Fixtures" />
        </div>
        <div className="flex items-center gap-2">
          <NavItem to="/accuracy" label="Model Accuracy" />
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-6 py-8">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/fixtures" element={<Fixtures />} />
          <Route path="/match/:id" element={<MatchDetail />} />
          <Route path="/team/:id" element={<TeamForm />} />
          <Route path="/h2h/:teamAId/:teamBId" element={<H2H />} />
          <Route path="/player/:id" element={<PlayerStats />} />
          <Route path="/accuracy" element={<Accuracy />} />
        </Routes>
      </main>
      <footer className="border-t border-slate-800 mt-16 py-6 text-center text-slate-600 text-xs">
        FootyPredictor · EPL 2024/25 · Poisson DC Model · Data via API-Football
      </footer>
    </div>
  )
}
