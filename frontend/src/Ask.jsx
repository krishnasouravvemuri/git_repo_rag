import { useState } from 'react'
import { askQuestion } from './api'

export default function Ask({ repos, selectedId }) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const selected = repos.find((r) => r.repo_id === selectedId)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setAnswer('')
    setLoading(true)
    try {
      const data = await askQuestion(question.trim(), selectedId)
      setAnswer(data.answer)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="card">
      <h2>Ask a Question</h2>
      <p className="muted">
        {selected
          ? `Asking against: ${selected.title || selected.repo_owner}`
          : 'No repo selected — searching across all your repos.'}
      </p>
      <form onSubmit={handleSubmit}>
        <label>
          Question
          <textarea
            required
            rows={3}
            placeholder="What does this repo do?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Thinking…' : 'Ask'}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      {answer && (
        <div className="answer">
          <h3>Answer</h3>
          <p>{answer}</p>
        </div>
      )}
    </section>
  )
}
