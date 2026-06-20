import { useCallback, useEffect, useState } from 'react'
import Auth from './Auth'
import IngestForm from './IngestForm'
import RepoList from './RepoList'
import Ask from './Ask'
import Conversation from './Conversation'
import History from './History'
import {
  clearSession,
  deleteConversation,
  deleteQuestion,
  getEmail,
  getToken,
  listConversations,
  listQuestions,
  listRepos,
} from './api'

const NAV = [
  { id: 'add', label: 'Add Repo', ico: '➕' },
  { id: 'repos', label: 'Repositories', ico: '📚' },
]

export default function App() {
  const [email, setEmail] = useState(getToken() ? getEmail() : null)
  const [repos, setRepos] = useState([])
  const [openId, setOpenId] = useState(null) // repo whose detail is open
  const [reposError, setReposError] = useState('')
  const [screen, setScreen] = useState('add') // 'add' | 'repos' | 'detail'
  const [detailTab, setDetailTab] = useState('ask') // 'ask' | 'history' | 'conversation'
  const [convId, setConvId] = useState(null) // active conversation when in 'conversation' tab
  const [questions, setQuestions] = useState([])
  const [conversations, setConversations] = useState([])

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

  const refreshHistory = useCallback(async () => {
    try {
      const [q, c] = await Promise.all([listQuestions(), listConversations()])
      setQuestions(q.questions || [])
      setConversations(c.conversations || [])
    } catch (err) {
      if (err.message.includes('Session expired')) setEmail(null)
    }
  }, [])

  useEffect(() => {
    if (!email) return
    refreshRepos()
    refreshHistory()
  }, [email, refreshRepos, refreshHistory])

  function handleLogout() {
    clearSession()
    setEmail(null)
    setRepos([])
    setOpenId(null)
    setQuestions([])
    setConversations([])
    setScreen('add')
  }

  function openRepo(id) {
    setOpenId(id)
    setDetailTab('ask')
    setConvId(null)
    setScreen('detail')
  }

  function startConversation(conversationId = null) {
    setConvId(conversationId)
    setDetailTab('conversation')
  }

  function continueConversation(conversationId, repoId) {
    if (repoId && repoId !== openId) setOpenId(repoId)
    startConversation(conversationId)
  }

  async function handleDeleteQuestion(id) {
    try {
      await deleteQuestion(id)
      setQuestions((prev) => prev.filter((q) => q.id !== id))
    } catch { /* ignore */ }
  }

  async function handleDeleteConversation(id) {
    try {
      await deleteConversation(id)
      setConversations((prev) => prev.filter((c) => c.conversation_id !== id))
    } catch { /* ignore */ }
  }

  if (!email) {
    return <Auth onAuth={setEmail} />
  }

  const openRepoObj = repos.find((r) => r.repo_id === openId)
  const repoQuestions = questions.filter((q) => q.repo_id === openId)
  const repoConversations = conversations.filter((c) => c.repo_id === openId)

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
                className={`tab${detailTab === 'conversation' ? ' active' : ''}`}
                onClick={() => startConversation(null)}
              >
                🗣️ Conversation
              </button>
              <button
                className={`tab${detailTab === 'history' ? ' active' : ''}`}
                onClick={() => { setDetailTab('history'); refreshHistory() }}
              >
                🗂️ History
              </button>
            </div>

            {detailTab === 'ask' && (
              <Ask
                repos={repos}
                selectedId={openId}
                onAnswered={refreshHistory}
                onStartConversation={() => startConversation(null)}
              />
            )}

            {detailTab === 'conversation' && (
              <Conversation
                repos={repos}
                selectedId={openId}
                conversationId={convId}
                onChanged={refreshHistory}
                onExit={() => { setDetailTab('history'); refreshHistory() }}
              />
            )}

            {detailTab === 'history' && (
              <History
                questions={repoQuestions}
                conversations={repoConversations}
                onDeleteQuestion={handleDeleteQuestion}
                onDeleteConversation={handleDeleteConversation}
                onContinueConversation={continueConversation}
              />
            )}
          </>
        )}
      </main>
    </div>
  )
}
