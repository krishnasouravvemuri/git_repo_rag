const BASE = '/api/v2/core'

const TOKEN_KEY = 'rag_access_token'
const EMAIL_KEY = 'rag_email'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}
export function getEmail() {
  return localStorage.getItem(EMAIL_KEY)
}
export function setSession(token, email) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(EMAIL_KEY, email)
}
export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(EMAIL_KEY)
}

async function request(method, path, body, auth = true) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(`${BASE}/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401 && auth) {
    clearSession()
    throw new Error('Session expired. Please log in again.')
  }

  let json
  try {
    json = await res.json()
  } catch {
    throw new Error(`Bad response (${res.status})`)
  }

  const message = json?.meta?.message
  if (!res.ok || json?.data?.error) {
    throw new Error(json?.data?.error || message || `Request failed (${res.status})`)
  }
  return json.data
}

export function register(email, password) {
  return request('POST', 'register', { email, password }, false)
}
export function login(email, password) {
  return request('POST', 'login', { email, password }, false)
}
export function ingestRepo({ title, repo_url, branch }) {
  return request('POST', 'ingest', { title, repo_url, branch: branch || null })
}
export function listRepos() {
  return request('GET', 'repos')
}
export function askQuestion(question, repo_id) {
  return request('POST', 'ask', { question, repo_id: repo_id || null })
}
