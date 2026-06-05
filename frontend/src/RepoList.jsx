export default function RepoList({ repos, selectedId, onSelect }) {
  if (!repos.length) {
    return (
      <section className="card">
        <h2>My Repositories</h2>
        <p className="muted">No repos yet. Ingest one above.</p>
      </section>
    )
  }

  return (
    <section className="card">
      <h2>My Repositories</h2>
      <ul className="repo-list">
        {repos.map((r) => (
          <li
            key={r.repo_id}
            className={r.repo_id === selectedId ? 'repo selected' : 'repo'}
            onClick={() => onSelect(r.repo_id)}
          >
            <div className="repo-title">{r.title || r.repo_owner}</div>
            <div className="repo-url">{r.repo_url}</div>
            <div className="repo-meta">
              {r.branch ? `branch: ${r.branch} · ` : ''}
              {new Date(r.created_at).toLocaleString()}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
