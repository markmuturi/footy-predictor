import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' })

export const getDashboard = () => api.get('/dashboard/summary').then(r => r.data)
export const getMatches = (params) => api.get('/matches/', { params }).then(r => r.data)
export const getMatch = (id) => api.get(`/matches/${id}`).then(r => r.data)
export const getPrediction = (matchId) => api.get(`/predictions/${matchId}`).then(r => r.data)
export const generatePrediction = (matchId) => api.post(`/predictions/generate/${matchId}`).then(r => r.data)
export const getTeam = (id) => api.get(`/teams/${id}`).then(r => r.data)
export const getTeamForm = (id) => api.get(`/teams/${id}/form`).then(r => r.data)
export const getTeams = () => api.get('/teams/').then(r => r.data)
export const getPlayer = (id) => api.get(`/players/${id}`).then(r => r.data)
export const getPlayerStats = (id) => api.get(`/players/${id}/stats`).then(r => r.data)
export const getH2H = (teamAId, teamBId) => api.get(`/h2h/${teamAId}/${teamBId}`).then(r => r.data)
export const getAccuracy = () => api.get('/dashboard/accuracy').then(r => r.data)