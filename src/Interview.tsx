import { useEffect, useRef, useState } from "react"
import { api, type Health, type Stats } from "./api"

type Feedback = {
  relevance: number
  clarity: number
  depth: number
  rating: number
  strengths: string[]
  improvements: string[]
  model_answer_outline: string
}
type Summary = {
  overall_summary: string
  top_strengths: string[]
  practice_areas: string[]
  recommended_topics: string[]
  average_rating: number
  answered: number
  total_questions: number
}
type Detail = {
  session_id: number
  role: string
  topic: string
  difficulty: string
  status: string
  created_at: string
  questions: string[]
  answers: {
    question_index: number
    answer: string
    feedback: Feedback
  }[]
  summary: Summary | null
}
type Row = {
  id: number
  role: string
  topic: string
  difficulty: string
  status: string
  created_at: string
  answered: number
  avg_rating: number | null
}
type StartResp = {
  session_id: number
  questions: string[]
}

const ROLES = [
  "AI/ML Engineer (Fresher)",
  "Full-Stack AI Developer",
  "Data Scientist",
  "NLP & LLM Engineer",
  "Computer Vision Engineer",
  "Python Machine Learning Specialist",
]

interface BarProps {
  label: string
  value: number
}

function Bar({ label, value }: BarProps) {
  return (
    <div className="iv-bar">
      <span>{label}</span>
      <i>
        <b style={{ width: `${(value / 5) * 100}%` }} />
      </i>
      <em>{value}/5</em>
    </div>
  )
}

interface ListProps {
  title: string
  items: string[]
}

function List({ title, items }: ListProps) {
  if (!items.length) return null
  return (
    <div className="iv-list">
      <strong>{title}</strong>
      <ul>
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  )
}

function FeedbackCard({ fb }: { fb: Feedback }) {
  return (
    <div className="iv-fb card">
      <p className="eyebrow">AI FEEDBACK • CALIBRATED RATING {fb.rating}/5</p>
      <div className="iv-bars">
        <Bar label="Relevance" value={fb.relevance} />
        <Bar label="Clarity" value={fb.clarity} />
        <Bar label="Technical Depth" value={fb.depth} />
      </div>
      <List title="What went well" items={fb.strengths} />
      <List title="Key areas to improve" items={fb.improvements} />
      {fb.model_answer_outline && (
        <div className="iv-list">
          <strong>Benchmark Model Answer Outline</strong>
          <p>{fb.model_answer_outline}</p>
        </div>
      )}
    </div>
  )
}

function Report({ d }: { d: Detail }) {
  const s = d.summary
  return (
    <div className="iv-report">
      {s ? (
        <div className="card iv-summary">
          <p className="eyebrow">INTERVIEW SUMMARY REPORT</p>
          <h2>
            {d.role}
            {d.topic ? ` • ${d.topic}` : ""}
          </h2>
          <div className="iv-score">
            {s.average_rating}
            <span>/5 composite rating</span>
          </div>
          <p>{s.overall_summary}</p>
          <p className="iv-note">
            {s.answered} of {s.total_questions} questions answered
          </p>
          <List title="Key Strengths" items={s.top_strengths} />
          <List title="Target Improvement Areas" items={s.practice_areas} />
          <List
            title="Recommended Concepts to Study"
            items={s.recommended_topics}
          />
        </div>
      ) : (
        <div className="card iv-summary">
          <p>This interview was not finished, so there is no summary yet.</p>
        </div>
      )}
      <h3 className="iv-h3">Question by question evaluation</h3>
      {d.answers.map((a) => (
        <details key={a.question_index} className="card iv-detail">
          <summary>
            Q{a.question_index + 1}. {d.questions[a.question_index]}{" "}
            <b>{a.feedback.rating}/5</b>
          </summary>
          <p className="iv-ans">
            <strong>Candidate Answer:</strong> {a.answer}
          </p>
          <FeedbackCard fb={a.feedback} />
        </details>
      ))}
    </div>
  )
}

export default function Interview({
  onChange,
  addHistory,
}: {
  onChange?: () => void
  addHistory?: (h: {
    type: string
    title: string
    detail: string
    time: string
  }) => void
}) {
  const [tab, setTab] = useState<"practice" | "progress">("practice")
  const [phase, setPhase] = useState<"setup" | "session" | "done">("setup")
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const [role, setRole] = useState("AI/ML Engineer (Fresher)")
  const [topic, setTopic] = useState("AI / Machine Learning fundamentals")
  const [difficulty, setDifficulty] = useState("intermediate")
  const [count, setCount] = useState(5)

  const [sid, setSid] = useState<number | null>(null)
  const [questions, setQuestions] = useState<string[]>([])
  const [idx, setIdx] = useState(0)
  const [answer, setAnswer] = useState("")
  const [feedback, setFeedback] = useState<Record<number, Feedback>>({})
  const [result, setResult] = useState<Detail | null>(null)

  // Voice recording & timer
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const recognitionRef = useRef<any>(null)

  const [stats, setStats] = useState<Stats | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [opened, setOpened] = useState<Detail | null>(null)

  useEffect(() => {
    api<Health>("/api/health")
      .then(setHealth)
      .catch(() => setHealth({ ok: false, aiConfigured: false, model: null }))
  }, [])

  useEffect(() => {
    if (tab !== "progress") return
    setOpened(null)
    Promise.all([
      api<Stats>("/api/stats"),
      api<{ items: Row[] }>("/api/interview/sessions"),
    ])
      .then(([s, r]) => {
        setStats(s)
        setRows(r.items)
      })
      .catch((e: Error) => setError(e.message))
  }, [tab])

  // Question timer
  useEffect(() => {
    if (phase !== "session" || feedback[idx]) return
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [phase, feedback, idx])

  const toggleRecording = () => {
    if (recording) {
      try {
        recognitionRef.current?.stop()
      } catch {}
      setRecording(false)
      return
    }

    const SpeechRec =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    if (!SpeechRec) {
      window.alert(
        "Speech recognition is not supported in this browser. Please type your answer or use Google Chrome/Edge.",
      )
      return
    }

    try {
      const rec = new SpeechRec()
      rec.continuous = true
      rec.interimResults = true
      rec.lang = "en-US"
      rec.onresult = (e: any) => {
        let text = ""
        for (let i = 0; i < e.results.length; i++) {
          text += e.results[i][0].transcript + " "
        }
        setAnswer(text.trim())
      }
      rec.onerror = () => setRecording(false)
      rec.onend = () => setRecording(false)
      rec.start()
      recognitionRef.current = rec
      setRecording(true)
    } catch {
      setRecording(false)
    }
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError("")
    try {
      await fn()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const start = () =>
    run(async () => {
      const r = await api<StartResp>("/api/interview/start", {
        method: "POST",
        body: { role, topic, difficulty, num_questions: count },
      })
      setSid(r.session_id)
      setQuestions(r.questions)
      setIdx(0)
      setAnswer("")
      setSeconds(0)
      setFeedback({})
      setResult(null)
      setPhase("session")
      addHistory?.({
        type: "Interview",
        title: `Mock Interview: ${role}`,
        detail: `Topic: ${topic || "General"} • Difficulty: ${difficulty}`,
        time: "Just now",
      })
    })

  const submit = () =>
    run(async () => {
      if (recording) {
        try {
          recognitionRef.current?.stop()
        } catch {}
        setRecording(false)
      }
      const r = await api<{ feedback: Feedback }>(
        `/api/interview/${sid}/answer`,
        {
          method: "POST",
          body: { question_index: idx, answer },
        },
      )
      setFeedback((f) => ({ ...f, [idx]: r.feedback }))
    })

  const finish = () =>
    run(async () => {
      if (recording) {
        try {
          recognitionRef.current?.stop()
        } catch {}
        setRecording(false)
      }
      const d = await api<Detail>(`/api/interview/${sid}/finish`, {
        method: "POST",
      })
      setResult(d)
      setPhase("done")
      onChange?.()
      addHistory?.({
        type: "Interview",
        title: `Completed Interview: ${role}`,
        detail: `Topic: ${topic || "General"} • Status: ${d.status || "Completed"}`,
        time: "Just now",
      })
    })

  const next = () => {
    if (idx < questions.length - 1) {
      setIdx(idx + 1)
      setAnswer("")
      setSeconds(0)
      setError("")
    } else {
      void finish()
    }
  }

  const open = (id: number) =>
    run(async () => setOpened(await api<Detail>(`/api/interview/${id}`)))

  const answered = Object.keys(feedback).length
  const fb = feedback[idx]
  const reset = () => {
    setPhase("setup")
    setResult(null)
    setError("")
    setSeconds(0)
  }

  const formatTimer = (s: number) => {
    const mins = Math.floor(s / 60)
    const secs = s % 60
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }

  return (
    <div className="page iv-wrap">
      <div className="page-heading">
        <div>
          <p className="eyebrow">REALISTIC AI MOCK INTERVIEW</p>
          <h1>Practice technical interviews with calibrated feedback</h1>
          <p>
            Choose a target engineering role, answer AI-generated questions via
            voice or text, and receive actionable 4-axis scoring.
          </p>
        </div>
      </div>

      {health && !health.aiConfigured && (
        <div className="iv-banner warn">
          Demo mode: Add GEMINI_API_KEY or OPENAI_API_KEY in environment
          variables for live AI reasoning.
        </div>
      )}
      {error && (
        <div className="iv-banner err" role="alert">
          {error}
        </div>
      )}

      <div className="iv-tabs">
        <button
          className={tab === "practice" ? "active" : ""}
          onClick={() => setTab("practice")}
        >
          Practice Session
        </button>
        <button
          className={tab === "progress" ? "active" : ""}
          onClick={() => setTab("progress")}
        >
          Interview History & Analytics
        </button>
      </div>

      {tab === "practice" && phase === "setup" && (
        <div className="card iv-form">
          <label className="iv-field">
            <span>Target Role</span>
            <input
              value={role}
              maxLength={80}
              onChange={(e) => setRole(e.target.value)}
            />
            <div className="iv-chips">
              {ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`iv-chip ${role === r ? "active" : ""}`}
                  onClick={() => setRole(r)}
                >
                  {r}
                </button>
              ))}
            </div>
          </label>
          <label className="iv-field">
            <span>Focus Domain / System (Optional)</span>
            <input
              value={topic}
              maxLength={120}
              placeholder="e.g. Transformers, System Design, Data Pipelines, PyTorch"
              onChange={(e) => setTopic(e.target.value)}
            />
          </label>
          <div className="iv-grid2">
            <label className="iv-field">
              <span>Difficulty Level</span>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                <option value="beginner">Entry Level / Junior</option>
                <option value="intermediate">Mid-Level Engineer</option>
                <option value="advanced">Senior / Staff Specialist</option>
              </select>
            </label>
            <label className="iv-field">
              <span>Number of Questions</span>
              <select
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              >
                {[1, 3, 5, 7].map((n) => (
                  <option key={n} value={n}>
                    {n} questions
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            className="btn primary"
            disabled={busy || role.trim().length < 2}
            onClick={start}
          >
            {busy ? "Generating realistic questions…" : "Start Mock Interview"}
          </button>
        </div>
      )}

      {tab === "practice" && phase === "session" && (
        <div>
          <div className="card iv-question">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <p className="eyebrow" style={{ margin: 0 }}>
                QUESTION {idx + 1} OF {questions.length}
              </p>
              {!fb && (
                <span
                  style={{
                    fontSize: "0.85rem",
                    color: "var(--accent, #818cf8)",
                    fontWeight: 600,
                  }}
                >
                  ⏱ Time: {formatTimer(seconds)}
                </span>
              )}
            </div>
            <h2>{questions[idx]}</h2>
            <textarea
              rows={7}
              maxLength={4000}
              disabled={busy || !!fb}
              value={answer}
              placeholder="Type your answer or click Speak Answer below to practice verbal communication…"
              onChange={(e) => setAnswer(e.target.value)}
            />
            <div className="iv-actions">
              <div
                style={{ display: "flex", gap: "8px", alignItems: "center" }}
              >
                {!fb && (
                  <button
                    type="button"
                    className={`btn ${recording ? "primary" : "secondary"}`}
                    onClick={toggleRecording}
                    style={{
                      background: recording ? "#ef4444" : undefined,
                      borderColor: recording ? "#ef4444" : undefined,
                    }}
                  >
                    {recording ? "🔴 Stop Recording" : "🎤 Speak Answer"}
                  </button>
                )}
                <span className="iv-note">{answer.length}/4000</span>
              </div>
              {!fb && (
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    className="btn secondary"
                    disabled={busy}
                    onClick={next}
                  >
                    Skip
                  </button>
                  <button
                    className="btn primary"
                    disabled={busy || !answer.trim()}
                    onClick={submit}
                  >
                    {busy ? "Evaluating Answer…" : "Submit Answer"}
                  </button>
                </div>
              )}
              {fb && (
                <button className="btn primary" disabled={busy} onClick={next}>
                  {idx < questions.length - 1
                    ? "Next Question →"
                    : "Finish & See Comprehensive Report"}
                </button>
              )}
            </div>
          </div>
          {fb && <FeedbackCard fb={fb} />}
          {answered > 0 && idx < questions.length - 1 && (
            <button
              className="btn ghost iv-early"
              disabled={busy}
              onClick={finish}
            >
              Finish Early & Generate Report ({answered} answered)
            </button>
          )}
          <p className="iv-note">
            Ratings are AI-assisted calibrated coaching evaluations following
            industry rubrics.
          </p>
        </div>
      )}

      {tab === "practice" && phase === "done" && result && (
        <div>
          <Report d={result} />
          <div className="iv-actions">
            <button className="btn primary" onClick={reset}>
              Start Another Interview
            </button>
          </div>
        </div>
      )}

      {tab === "progress" && !opened && (
        <div>
          {stats && (
            <div className="iv-stats">
              <div className="card">
                <b>{stats.questions_asked}</b>
                <span>Learning questions asked</span>
              </div>
              <div className="card">
                <b>{stats.interviews_finished}</b>
                <span>Interviews completed</span>
              </div>
              <div className="card">
                <b>{stats.answers_reviewed}</b>
                <span>Answers reviewed</span>
              </div>
              <div className="card">
                <b>
                  {stats.average_rating != null
                    ? `${stats.average_rating}/5`
                    : "–"}
                </b>
                <span>Average composite score</span>
              </div>
            </div>
          )}
          {stats && stats.focus_areas && stats.focus_areas.length > 0 && (
            <div className="card iv-summary">
              <List
                title="Recommended Focus Areas from Recent Interviews"
                items={stats.focus_areas}
              />
            </div>
          )}
          <h3 className="iv-h3">Interview History</h3>
          {rows.length === 0 && (
            <div className="card iv-summary">
              <p>
                No interviews completed yet. Start your first session from the
                Practice Session tab.
              </p>
            </div>
          )}
          {rows.map((r) => (
            <button
              key={r.id}
              className="card iv-row"
              onClick={() => open(r.id)}
            >
              <div>
                <strong>
                  {r.role}
                  {r.topic ? ` • ${r.topic}` : ""}
                </strong>
                <small>
                  {r.difficulty} • {r.answered} answered •{" "}
                  {r.status === "finished" ? "Completed" : "In Progress"} •{" "}
                  {r.created_at}
                </small>
              </div>
              <b>{r.avg_rating != null ? `${r.avg_rating}/5` : "–"}</b>
            </button>
          ))}
        </div>
      )}

      {tab === "progress" && opened && (
        <div>
          <button
            className="btn secondary iv-early"
            onClick={() => setOpened(null)}
          >
            ← Back to Interview History
          </button>
          <Report d={opened} />
        </div>
      )}
    </div>
  )
}
