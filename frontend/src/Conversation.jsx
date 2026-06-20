import { useEffect, useRef, useState } from 'react'
import {
  getConversation,
  sendConversationTurn,
  speak,
  startConversation,
  transcribeAudio,
} from './api'

// Press-to-talk voice conversation. Each turn: record → transcribe → send →
// answer is shown and read aloud. Repeats until the user ends the conversation.
export default function Conversation({ repos, selectedId, conversationId, onExit, onChanged }) {
  const [convId, setConvId] = useState(conversationId || null)
  const [messages, setMessages] = useState([])
  const [listening, setListening] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [level, setLevel] = useState(0)
  const [error, setError] = useState('')

  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const audioCtxRef = useRef(null)
  const rafRef = useRef(null)
  const lastSoundRef = useRef(0)
  const audioElRef = useRef(null)
  const bottomRef = useRef(null)

  const selected = repos.find((r) => r.repo_id === selectedId)
  const busy = transcribing || thinking

  // load existing messages when continuing a conversation
  useEffect(() => {
    let alive = true
    if (conversationId) {
      getConversation(conversationId)
        .then((data) => { if (alive) setMessages(data.messages || []) })
        .catch((err) => { if (alive) setError(err.message) })
    }
    return () => { alive = false }
  }, [conversationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking])

  useEffect(() => () => { stopListening(); stopPlayback() }, []) // cleanup

  // ---- live volume meter + 2s-silence auto-stop (same approach as Ask) ----
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
        setLevel(Math.min(1, rms * 3.2))
        const now = performance.now()
        if (rms > 0.02) lastSoundRef.current = now
        else if (now - lastSoundRef.current > 2000) { stopListening(); return }
        rafRef.current = requestAnimationFrame(tick)
      }
      tick()
    } catch { /* meter optional */ }
  }

  function stopMeter() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    setLevel(0)
  }

  async function startListening() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Voice input not supported in this browser.')
      return
    }
    setError('')
    stopPlayback()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      const rec = new MediaRecorder(stream)
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        if (blob.size === 0) return
        await handleUtterance(blob)
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
    if (listening) stopListening()
    else startListening()
  }

  // record → transcribe → send turn → play reply
  async function handleUtterance(blob) {
    let text = ''
    setTranscribing(true)
    try {
      text = (await transcribeAudio(blob))?.trim()
    } catch (err) {
      setError(err.message)
      setTranscribing(false)
      return
    }
    setTranscribing(false)
    if (!text) return
    await sendTurn(text)
  }

  async function sendTurn(text) {
    setError('')
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setThinking(true)
    try {
      let id = convId
      if (!id) {
        const conv = await startConversation(selectedId, text.slice(0, 60))
        id = conv.conversation_id
        setConvId(id)
      }
      const data = await sendConversationTurn(id, text)
      setMessages((prev) => [...prev, { role: 'assistant', content: data.answer }])
      onChanged?.()
      playReply(data.answer)
    } catch (err) {
      setError(err.message)
    } finally {
      setThinking(false)
    }
  }

  async function playReply(text) {
    setSpeaking(true)
    try {
      // preferred: backend (Groq) TTS audio
      const blob = await speak(text)
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioElRef.current = audio
      audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url) }
      audio.onerror = () => { setSpeaking(false); URL.revokeObjectURL(url); speakBrowser(text) }
      await audio.play()
    } catch {
      // backend TTS unavailable (model gated/decommissioned) → browser voice
      speakBrowser(text)
    }
  }

  // fallback: built-in Web Speech API, no backend/key needed
  function speakBrowser(text) {
    try {
      const synth = window.speechSynthesis
      if (!synth) { setSpeaking(false); return }
      synth.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'en-US'
      u.onend = () => setSpeaking(false)
      u.onerror = () => setSpeaking(false)
      setSpeaking(true)
      synth.speak(u)
    } catch {
      setSpeaking(false)
    }
  }

  function stopPlayback() {
    const a = audioElRef.current
    if (a) { a.pause(); audioElRef.current = null }
    try { window.speechSynthesis?.cancel() } catch { /* unsupported */ }
    setSpeaking(false)
  }

  const micStyle = listening
    ? {
        transform: `scale(${1 + level * 0.35})`,
        boxShadow: `0 0 0 ${4 + level * 14}px rgba(68,147,248,${0.05 + level * 0.18})`,
      }
    : undefined

  return (
    <section className="card conversation">
      <div className="conv-head">
        <h3>🗣️ Conversation{selected ? ` · ${selected.title || selected.repo_owner}` : ''}</h3>
        <div className="conv-head-actions">
          <button
            type="button"
            className={`mic${listening ? ' listening' : ''}`}
            style={micStyle}
            onClick={toggleListening}
            disabled={busy}
            title={listening ? 'Stop and send' : 'Tap to speak'}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
                 stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10v1a7 7 0 0 0 14 0v-1" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          </button>
          <button type="button" className="ghost" onClick={() => { stopListening(); stopPlayback(); onExit?.() }}>
            End conversation
          </button>
        </div>
      </div>

      <div className="chat">
        {messages.length === 0 && !thinking && (
          <p className="muted">Tap the mic and ask your first question.</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`bubble-row ${m.role === 'user' ? 'left' : 'right'}`}>
            <div className={`bubble ${m.role}`}>{m.content}</div>
          </div>
        ))}
        {thinking && (
          <div className="bubble-row right">
            <div className="bubble assistant pending">…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="error">{error}</p>}

      <div className="conv-controls">
        <span className="muted conv-status">
          {listening ? '● Listening… pause to send'
            : transcribing ? 'Transcribing…'
            : thinking ? 'Thinking…'
            : speaking ? '🔊 Speaking… (tap mic to interrupt)'
            : 'Tap mic to talk'}
        </span>
      </div>
    </section>
  )
}
