import { Routes, Route, NavLink } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import MatchDetail from './pages/MatchDetail'
import TeamForm from './pages/TeamForm'
import H2H from './pages/H2H'
import PlayerStats from './pages/PlayerStats'
import Fixtures from './pages/Fixtures'
import Accuracy from './pages/Accuracy'

function NavItem({ to, label }) {
  return (
    <NavLink
      to={to}
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
      <nav className="bg-slate-800 border-b border-slate-700 px-6 py-3 flex items-center gap-2">
        <span className="text-emerald-400 font-bold text-lg mr-6">⚽ FootyPredictor</span>
        <NavItem to="/" label="Dashboard" />
        <NavItem to="/fixtures" label="Fixtures" />
        <NavItem to="/accuracy" label="Accuracy" />
      </nav>
      <main className="max-w-7xl mx-auto px-6 py-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/fixtures" element={<Fixtures />} />
          <Route path="/match/:id" element={<MatchDetail />} />
          <Route path="/team/:id" element={<TeamForm />} />
          <Route path="/h2h/:teamAId/:teamBId" element={<H2H />} />
          <Route path="/player/:id" element={<PlayerStats />} />
          <Route path="/accuracy" element={<Accuracy />} />
        </Routes>
      </main>
    </div>
  )
}