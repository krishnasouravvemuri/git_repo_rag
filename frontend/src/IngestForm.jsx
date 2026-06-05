import { useEffect, useRef, useState } from 'react'
import { ingestRepo } from './api'

const STAGES = [
  'Loading weights…',
  'Cloning repository…',
  'Reading the repo…',
  'Chunking documents…',
  'Generating embeddings…',
  'Storing vectors…',
  'Almost there…',
]

export default function IngestForm({ onIngested }) {
  const [title, setTitle] = useState('')
  const [repoUrl, setRepoUrl] = useState('')
  const [branch, setBranch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [stageIdx, setStageIdx] = useState(0)
  const timerRef = useRef(null)

  // cycle stage messages while loading
  useEffect(() => {
    if (!loading) {
      clearInterval(timerRef.current)
      return
    }
    setStageIdx(0)
    timerRef.current = setInterval(() => {
      // hold on last stage instead of looping back
      setStageIdx((i) => Math.min(i + 1, STAGES.length - 1))
    }, 2500)
    return () => clearInterval(timerRef.current)
  }, [loading])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await ingestRepo({
        title: title.trim(),
        repo_url: repoUrl.trim(),
        branch: branch.trim(),
      })
      setTitle('')
      setRepoUrl('')
      setBranch('')
      onIngested()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="card">
      <h2>Ingest a Repository</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Title
          <input
            type="text"
            required
            placeholder="My project"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={loading}
          />
        </label>
        <label>
          Repo URL
          <input
            type="url"
            required
            placeholder="https://github.com/owner/repo"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            disabled={loading}
          />
        </label>
        <label>
          Branch (optional)
          <input
            type="text"
            placeholder="main"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            disabled={loading}
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Ingesting…' : 'Ingest'}
        </button>
      </form>

      {loading && (
        <div className="progress">
          <span className="spinner" />
          <span className="stage">{STAGES[stageIdx]}</span>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  )
}
