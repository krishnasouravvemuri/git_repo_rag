import { useEffect, useState } from 'react'
import { getConversation } from './api'

export default function History({
  questions,
  conversations,
  onDeleteQuestion,
  onDeleteConversation,
  onContinueConversation,
}) {
  const [section, setSection] = useState('questions') // 'questions' | 'conversations'
  const [openIdx, setOpenIdx] = useState(null)
  const [copied, setCopied] = useState(null)
  const [openConv, setOpenConv] = useState(null) // conversation_id whose detail is open
  const [convDetail, setConvDetail] = useState(null)
  const [convError, setConvError] = useState('')

  useEffect(() => {
    if (openConv == null) { setConvDetail(null); return }
    let alive = true
    setConvError('')
    setConvDetail(null)
    getConversation(openConv)
      .then((d) => { if (alive) setConvDetail(d) })
      .catch((err) => { if (alive) setConvError(err.message) })
    return () => { alive = false }
  }, [openConv])

  async function copyQA(e, id, item) {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(`Q: ${item.question}\n\nA: ${item.answer}`)
      setCopied(id)
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500)
    } catch { /* clipboard unavailable */ }
  }

  function removeQuestion(e, id) {
    e.stopPropagation()
    if (window.confirm('Delete this question from history?')) onDeleteQuestion(id)
  }

  // ---- conversation detail view (left/right chat + continue) ----
  if (openConv != null) {
    return (
      <section>
        <div className="history-top">
          <button className="link" onClick={() => setOpenConv(null)}>← Back to history</button>
        </div>
        {convError && <p className="error">{convError}</p>}
        {!convDetail && !convError && <p className="muted">Loading…</p>}
        {convDetail && (
          <>
            <h3>{convDetail.title}</h3>
            <div className="transcript">
              <div className="chat">
                {convDetail.messages.map((m) => (
                  <div key={m.id} className={`bubble-row ${m.role === 'user' ? 'left' : 'right'}`}>
                    <div className={`bubble ${m.role}`}>{m.content}</div>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={() => onContinueConversation(convDetail.conversation_id, convDetail.repo_id)}>
              Continue conversation
            </button>
          </>
        )}
      </section>
    )
  }

  return (
    <section>
      <div className="subtabs">
        <button
          className={`subtab${section === 'questions' ? ' active' : ''}`}
          onClick={() => setSection('questions')}
        >
          Questions{questions.length ? ` (${questions.length})` : ''}
        </button>
        <button
          className={`subtab${section === 'conversations' ? ' active' : ''}`}
          onClick={() => setSection('conversations')}
        >
          Conversations{conversations.length ? ` (${conversations.length})` : ''}
        </button>
      </div>

      {section === 'questions' && (
        questions.length === 0 ? (
          <div className="empty">
            <span className="ico">❓</span>
            No questions yet. Use the <strong>Ask</strong> tab — answers show up here.
          </div>
        ) : (
          questions.map((it, i) => {
            const expanded = openIdx === i
            const firstLine = it.answer.split('\n').find((l) => l.trim()) || it.answer
            return (
              <article
                className={`qa${expanded ? ' open' : ''}`}
                key={it.id}
                onClick={() => setOpenIdx(expanded ? null : i)}
              >
                <div className="qa-row">
                  <p className="q">{it.question}</p>
                  <button className="icon-btn" title="Copy Q&A" onClick={(e) => copyQA(e, it.id, it)}>
                    {copied === it.id ? '✓' : '⧉'}
                  </button>
                  <button className="icon-btn danger" title="Delete" onClick={(e) => removeQuestion(e, it.id)}>🗑</button>
                  <span className="chevron">{expanded ? '▴' : '▾'}</span>
                </div>
                {expanded ? (
                  <>
                    <p className="a">{it.answer}</p>
                    <div className="meta"><span>{new Date(it.created_at).toLocaleString()}</span></div>
                  </>
                ) : (
                  <p className="a preview">{firstLine}</p>
                )}
              </article>
            )
          })
        )
      )}

      {section === 'conversations' && (
        conversations.length === 0 ? (
          <div className="empty">
            <span className="ico">🗣️</span>
            No conversations yet. Tap the mic in <strong>Ask</strong> and pick <strong>Conversation</strong>.
          </div>
        ) : (
          conversations.map((c) => (
            <article className="qa" key={c.conversation_id} onClick={() => setOpenConv(c.conversation_id)}>
              <div className="qa-row">
                <p className="q">{c.title}</p>
                <span className="nav-badge">{c.message_count}</span>
                <button
                  className="icon-btn danger"
                  title="Delete conversation"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (window.confirm('Delete this conversation?')) onDeleteConversation(c.conversation_id)
                  }}
                >🗑</button>
                <span className="chevron">›</span>
              </div>
              <p className="a preview">{new Date(c.created_at).toLocaleString()}</p>
            </article>
          ))
        )
      )}
    </section>
  )
}
