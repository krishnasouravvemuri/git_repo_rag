import { useCallback, useEffect, useState } from 'react'
import Auth from './Auth'
import IngestForm from './IngestForm'
import RepoList from './RepoList'
import Ask from './Ask'
import History from './History'
import { clearSession, getEmail, getToken, listRepos } from './api'

const NAV = [
  { id: 'add', label: 'Add Repo', ico: '➕' },
  { id: 'repos', label: 'Repositories', ico: '📚' },
]

function historyKey(email) {
  return `rag_history_${email}`
}

export default function App() {
  const [email, setEmail] = useState(getToken() ? getEmail() : null)
  const [repos, setRepos] = useState([])
  const [openId, setOpenId] = useState(null) // repo whose detail is open
  const [reposError, setReposError] = useState('')
  const [screen, setScreen] = useState('add') // 'add' | 'repos' | 'detail'
  const [detailTab, setDetailTab] = useState('ask') // 'ask' | 'history'
  const [history, setHistory] = useState([])

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
    if (!email) return
    refreshRepos()
    try {
      setHistory(JSON.parse(localStorage.getItem(historyKey(email)) || '[]'))
    } catch {
      setHistory([])
    }
  }, [email, refreshRepos])

  function addHistory(entry) {
    setHistory((prev) => {
      const next = [entry, ...prev].slice(0, 200)
      localStorage.setItem(historyKey(email), JSON.stringify(next))
      return next
    })
  }

  function clearHistory(repoId) {
    setHistory((prev) => {
      const next = prev.filter((h) => h.repoId !== repoId)
      localStorage.setItem(historyKey(email), JSON.stringify(next))
      return next
    })
  }

  function deleteHistory(ts) {
    setHistory((prev) => {
      const next = prev.filter((h) => h.ts !== ts)
      localStorage.setItem(historyKey(email), JSON.stringify(next))
      return next
    })
  }

  function editHistory(ts, question) {
    setHistory((prev) => {
      const next = prev.map((h) => (h.ts === ts ? { ...h, question } : h))
      localStorage.setItem(historyKey(email), JSON.stringify(next))
      return next
    })
  }

  function handleLogout() {
    clearSession()
    setEmail(null)
    setRepos([])
    setOpenId(null)
    setHistory([])
    setScreen('add')
  }

  function openRepo(id) {
    setOpenId(id)
    setDetailTab('ask')
    setScreen('detail')
  }

  if (!email) {
    return <Auth onAuth={setEmail} />
  }

  const openRepoObj = repos.find((r) => r.repo_id === openId)
  const repoHistory = history.filter((h) => h.repoId === openId)

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="logo">⎇</span>
          <h1>Repo RAG</h1>
        </div>

        {NAV.map((item) => (
          <button
            key={item.id}
            className={`nav-item${
              screen === item.id || (item.id === 'repos' && screen === 'detail') ? ' active' : ''
            }`}
            onClick={() => setScreen(item.id)}
          >
            <span className="ico">{item.ico}</span>
            {item.label}
            {item.id === 'repos' && repos.length > 0 && (
              <span className="nav-badge">{repos.length}</span>
            )}
          </button>
        ))}

        <div className="sidebar-foot">
          <span className="email">{email}</span>
          <button className="ghost" onClick={handleLogout}>Log out</button>
        </div>
      </aside>

      <main className="main">
        {screen === 'add' && (
          <>
            <div className="page-head">
              <h2>Add a Repository</h2>
              <p>Ingest a Git repo so you can ask questions about its code.</p>
            </div>
            <IngestForm
              onIngested={() => {
                refreshRepos()
                setScreen('repos')
              }}
            />
          </>
        )}

        {screen === 'repos' && (
          <>
            <div className="page-head">
              <h2>Repositories</h2>
              <p>Click a repo to ask questions and view its history.</p>
            </div>
            {reposError && <p className="error">{reposError}</p>}
            <RepoList repos={repos} onOpen={openRepo} />
          </>
        )}

        {screen === 'detail' && openRepoObj && (
          <>
            <div className="detail-head">
              <button className="link" onClick={() => setScreen('repos')}>← Back to repositories</button>
              <h2>{openRepoObj.title || openRepoObj.repo_owner}</h2>
              <p className="muted">{openRepoObj.repo_url}</p>
            </div>
            <div className="tabs">
              <button
                className={`tab${detailTab === 'ask' ? ' active' : ''}`}
                onClick={() => setDetailTab('ask')}
              >
                💬 Ask
              </button>
              <button
                className={`tab${detailTab === 'history' ? ' active' : ''}`}
                onClick={() => setDetailTab('history')}
              >
                🗂️ History{repoHistory.length > 0 ? ` (${repoHistory.length})` : ''}
              </button>
            </div>

            {detailTab === 'ask' ? (
              <Ask
                repos={repos}
                selectedId={openId}
                onAnswered={(e) => addHistory({ ...e, repoId: openId })}
              />
            ) : (
              <History
                items={repoHistory}
                onClear={() => clearHistory(openId)}
                onDelete={deleteHistory}
                onEdit={editHistory}
              />
            )}
          </>
        )}
      </main>
    </div>
  )
}
