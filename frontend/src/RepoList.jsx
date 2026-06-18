import { useState } from 'react'

export default function RepoList({ repos, onOpen }) {
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState(null)

  async function copyId(e, id) {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(id)
      setCopied(id)
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  if (!repos.length) {
    return (
      <div className="empty">
        <span className="ico">📭</span>
        No repositories yet. Head to <strong>Add Repo</strong> to ingest one.
      </div>
    )
  }

  const q = query.trim().toLowerCase()
  const filtered = !q
    ? repos
    : repos.filter((r) =>
        [r.repo_id, r.title, r.repo_owner, r.repo_url, r.branch]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      )

  return (
    <>
      <div className="searchbar">
        <span className="s-ico">🔍</span>
        <input
          type="text"
          placeholder="Search by id, name or repo URL…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <span className="ico">🔎</span>
          No matches for “{query}”.
        </div>
      ) : (
        <div className="repo-grid">
          {filtered.map((r) => (
            <div
              key={r.repo_id}
              className="repo"
              onClick={() => onOpen(r.repo_id)}
            >
              <div className="repo-title">
                {r.title || r.repo_owner}
                <span className="pill">open →</span>
              </div>
              <div className="repo-url">{r.repo_url}</div>
              <div className="repo-meta">
                {r.branch ? `branch: ${r.branch} · ` : ''}
                {new Date(r.created_at).toLocaleString()}
              </div>
              <div className="repo-id-row">
                <code title={r.repo_id}>{r.repo_id}</code>
                <button className="copy-btn" onClick={(e) => copyId(e, r.repo_id)}>
                  {copied === r.repo_id ? '✓ Copied' : 'Copy ID'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
