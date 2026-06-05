import { useCallback, useEffect, useState } from 'react'
import Auth from './Auth'
import IngestForm from './IngestForm'
import RepoList from './RepoList'
import Ask from './Ask'
import { clearSession, getEmail, getToken, listRepos } from './api'

export default function App() {
  const [email, setEmail] = useState(getToken() ? getEmail() : null)
  const [repos, setRepos] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [reposError, setReposError] = useState('')

  const refreshRepos = useCallback(async () => {
    setReposError('')
    try {
      const data = await listRepos()
      setRepos(data.repos)
    } catch (err) {
      setReposError(err.message)
      if (err.message.includes('Session expired')) setEmail(null)
    }
  }, [])

  useEffect(() => {
    if (email) refreshRepos()
  }, [email, refreshRepos])

  function handleLogout() {
    clearSession()
    setEmail(null)
    setRepos([])
    setSelectedId(null)
  }

  if (!email) {
    return <Auth onAuth={setEmail} />
  }

  return (
    <div className="container">
      <header className="topbar">
        <h1>Git Repo RAG</h1>
        <div className="user">
          <span>{email}</span>
          <button type="button" className="link" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      <IngestForm onIngested={refreshRepos} />
      {reposError && <p className="error">{reposError}</p>}
      <RepoList repos={repos} selectedId={selectedId} onSelect={setSelectedId} />
      <Ask repos={repos} selectedId={selectedId} />
    </div>
  )
}
