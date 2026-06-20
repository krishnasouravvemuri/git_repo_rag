import { useEffect, useRef, useState } from 'react'
import { askQuestion, transcribeAudio } from './api'

export default function Ask({ repos, selectedId, onAnswered, onStartConversation }) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [listening, setListening] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [level, setLevel] = useState(0) // 0..1 live mic volume
  const [copied, setCopied] = useState(false)
  const [choosing, setChoosing] = useState(false) // mic mode chooser open

  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const audioCtxRef = useRef(null)
  const rafRef = useRef(null)
  const lastSoundRef = useRef(0)

  const selected = repos.find((r) => r.repo_id === selectedId)

  useEffect(() => () => stopListening(), []) // cleanup on unmount

  async function copyAnswer() {
    try {
      await navigator.clipboard.writeText(answer)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (listening) stopListening()
    setError('')
    setAnswer('')
    setLoading(true)
    const q = question.trim()
    try {
      const data = await askQuestion(q, selectedId)
      setAnswer(data.answer)
      onAnswered?.({
        question: q,
        answer: data.answer,
        repo: selected ? (selected.title || selected.repo_owner) : null,
        ts: Date.now(),
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ---- live volume meter (drives mic jiggle); shares recorder's stream ----
  function startMeter(stream) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      audioCtxRef.current = ctx
      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      src.connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)
      lastSoundRef.current = performance.now()

      const tick = () => {
        analyser.getByteTimeDomainData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128
          sum += v * v
        }
        const rms = Math.sqrt(sum / data.length)
        setLevel(Math.min(1, rms * 3.2)) // amplify for visible jiggle

        const now = performance.now()
        if (rms > 0.02) lastSoundRef.current = now
        else if (now - lastSoundRef.current > 2000) {
          stopListening() // 2s silence → auto stop & transcribe
          return
        }
        rafRef.current = requestAnimationFrame(tick)
      }
      tick()
    } catch {
      /* meter optional — ignore if AudioContext unavailable */
    }
  }

  function stopMeter() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    setLevel(0)
  }

  // ---- record audio → backend Whisper (Groq) transcription ----
  async function startListening() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Voice input not supported in this browser.')
      return
    }
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []

      const rec = new MediaRecorder(stream)
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      rec.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        if (blob.size === 0) return
        setTranscribing(true)
        try {
          const text = await transcribeAudio(blob)
          if (text) setQuestion((q) => (q.trim() ? q.trim() + ' ' : '') + text)
        } catch (err) {
          setError(err.message)
        } finally {
          setTranscribing(false)
        }
      }

      recorderRef.current = rec
      rec.start()
      setListening(true)
      startMeter(stream)
    } catch {
      setError('Microphone access denied.')
    }
  }

  function stopListening() {
    stopMeter()
    setListening(false)
    const rec = recorderRef.current
    recorderRef.current = null
    if (rec && rec.state !== 'inactive') rec.stop()
    else streamRef.current?.getTracks().forEach((t) => t.stop())
  }

  function toggleListening() {
    if (listening) {
      stopListening()
      return
    }
    // mic tapped while idle → ask what kind of voice interaction
    setChoosing(true)
  }

  function chooseQuestion() {
    setChoosing(false)
    startListening()
  }

  function chooseConversation() {
    setChoosing(false)
    onStartConversation?.()
  }

  // jiggle intensity from live level
  const micStyle = listening
    ? {
        transform: `scale(${1 + level * 0.35})`,
        boxShadow: `0 0 0 ${4 + level * 14}px rgba(68,147,248,${0.05 + level * 0.18})`,
      }
    : undefined

  return (
    <section className="card">
      {choosing && (
        <div className="modal-backdrop" onClick={() => setChoosing(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Voice input</h3>
            <p className="muted">How do you want to use the mic?</p>
            <div className="choice-row">
              <button type="button" className="choice" onClick={chooseQuestion}>
                <span className="choice-ico">❓</span>
                <strong>Question</strong>
                <span className="muted">Dictate one question into the box.</span>
              </button>
              <button type="button" className="choice" onClick={chooseConversation}>
                <span className="choice-ico">🗣️</span>
                <strong>Conversation</strong>
                <span className="muted">Talk back and forth; answers read aloud.</span>
              </button>
            </div>
            <button type="button" className="link" onClick={() => setChoosing(false)}>Cancel</button>
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <label>
          Question
          <div className="input-with-mic">
            <textarea
              required
              rows={3}
              placeholder="What does this repo do?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
            <button
              type="button"
              className={`mic${listening ? ' listening' : ''}`}
              style={micStyle}
              onClick={toggleListening}
              disabled={transcribing}
              title={listening ? 'Stop' : 'Speak your question'}
              aria-label={listening ? 'Stop listening' : 'Start voice input'}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
                   stroke="currentColor" strokeWidth="2"
                   strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="2" width="6" height="12" rx="3" />
                <path d="M5 10v1a7 7 0 0 0 14 0v-1" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
            </button>
          </div>
        </label>
        {listening && <p className="muted listening-hint">● Recording… speak now</p>}
        {transcribing && <p className="muted listening-hint">Transcribing…</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Thinking…' : 'Ask'}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      {answer && (
        <div className="answer">
          <div className="answer-head">
            <h3>Answer</h3>
            <button type="button" className="copy-btn" onClick={copyAnswer}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <p>{answer}</p>
        </div>
      )}
    </section>
  )
}
