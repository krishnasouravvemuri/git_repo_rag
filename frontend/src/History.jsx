import { useState } from 'react'

export default function History({ items, onClear, onDelete, onEdit }) {
  const [openIdx, setOpenIdx] = useState(null)
  const [copied, setCopied] = useState(null)
  const [editing, setEditing] = useState(null) // ts being edited
  const [draft, setDraft] = useState('')

  async function copyQA(e, idx, item) {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(`Q: ${item.question}\n\nA: ${item.answer}`)
      setCopied(idx)
      setTimeout(() => setCopied((c) => (c === idx ? null : c)), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  function startEdit(e, item) {
    e.stopPropagation()
    setEditing(item.ts)
    setDraft(item.question)
  }

  function saveEdit(e, ts) {
    e.stopPropagation()
    const q = draft.trim()
    if (q) onEdit(ts, q)
    setEditing(null)
  }

  function remove(e, ts) {
    e.stopPropagation()
    if (window.confirm('Delete this question from history?')) onDelete(ts)
  }

  if (!items.length) {
    return (
      <div className="empty">
        <span className="ico">🗂️</span>
        No questions yet. Use the <strong>Ask</strong> tab — answers show up here.
      </div>
    )
  }

  return (
    <section>
      <div className="history-top">
        <button className="link" onClick={onClear}>Clear history</button>
      </div>
      {items.map((it, i) => {
        const expanded = openIdx === i
        const isEditing = editing === it.ts
        const firstLine = it.answer.split('\n').find((l) => l.trim()) || it.answer
        return (
          <article
            className={`qa${expanded ? ' open' : ''}`}
            key={it.ts}
            onClick={() => !isEditing && setOpenIdx(expanded ? null : i)}
          >
            <div className="qa-row">
              {isEditing ? (
                <input
                  className="edit-input"
                  value={draft}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveEdit(e, it.ts)}
                />
              ) : (
                <p className="q">{it.question}</p>
              )}

              {isEditing ? (
                <>
                  <button className="icon-btn" title="Save" onClick={(e) => saveEdit(e, it.ts)}>✓</button>
                  <button className="icon-btn" title="Cancel" onClick={(e) => { e.stopPropagation(); setEditing(null) }}>✕</button>
                </>
              ) : (
                <>
                  <button className="icon-btn" title="Copy Q&A" onClick={(e) => copyQA(e, i, it)}>
                    {copied === i ? '✓' : '⧉'}
                  </button>
                  <button className="icon-btn" title="Edit question" onClick={(e) => startEdit(e, it)}>✎</button>
                  <button className="icon-btn danger" title="Delete" onClick={(e) => remove(e, it.ts)}>🗑</button>
                  <span className="chevron">{expanded ? '▴' : '▾'}</span>
                </>
              )}
            </div>
            {expanded ? (
              <>
                <p className="a">{it.answer}</p>
                <div className="meta">
                  <span>{new Date(it.ts).toLocaleString()}</span>
                </div>
              </>
            ) : (
              <p className="a preview">{firstLine}</p>
            )}
          </article>
        )
      })}
    </section>
  )
}
