import { useState, useEffect } from 'react'
import axios from 'axios'

export default function WakeUpBanner() {
  const [status, setStatus] = useState('checking') // checking | slow | ready

  useEffect(() => {
    const start = Date.now()
    const timer = setTimeout(() => setStatus('slow'), 3000)

    axios.get((import.meta.env.VITE_API_URL || '/api') + '/dashboard/summary', { timeout: 60000 })
      .then(() => {
        clearTimeout(timer)
        setStatus('ready')
      })
      .catch(() => {
        clearTimeout(timer)
        setStatus('ready') // hide banner even on error, app will show its own error state
      })

    return () => clearTimeout(timer)
  }, [])

  if (status === 'checking' || status === 'ready') return null

  return (
    <div className="bg-amber-900/40 border-b border-amber-700/50 px-6 py-2.5 flex items-center justify-center gap-3">
      <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
      <p className="text-amber-300 text-sm">
        Server is waking up — this takes ~30 seconds on the free tier. Hang tight.
      </p>
    </div>
  )
}
