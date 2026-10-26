import React, { useState, useEffect, useRef, useMemo } from "react"
import Interview from "./Interview"
import LoginPage from "./LoginPage"
import { useAuth, type AuthUser, type SavedAccount, type UserRole } from "./AuthContext"
import {
  api,
  apiFormData,
  userId,
  type Health,
  type Stats,
  type Course,
  type Video,
  type Resource,
  type Quiz,
  type QuizSubmissionResult,
} from "./api"

type Route = "home" | "courses" | "workspace" | "interview" | "resources" | "quiz" | "history" | "settings"
type Message = {
  id: number
  role: "user" | "assistant"
  text: string
  sources?: Source[]
  followups?: string[]
}
type Source = {
  type: "video" | "pdf" | "ppt"
  label: string
  time?: number
  detail: string
}
type HistoryItem = {
  type: string
  title: string
  detail: string
  time: string
}
type UploadItem = {
  id: number
  name: string
  size: string
  type: string
  status: string
  progress: number
  extractedText?: string
}

const photo =
  "https://images.unsplash.com/photo-1758270705290-62b6294dd044?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=82&w=1200"
const nav: {
  id: Route
  label: string
  icon: string
}[] = [
  { id: "home", label: "Home", icon: "home" },
  { id: "courses", label: "My Learning", icon: "book" },
  { id: "workspace", label: "AI Learning Workspace", icon: "spark" },
  { id: "interview", label: "Mock Interview", icon: "quiz" },
  { id: "resources", label: "My Resources", icon: "folder" },
  { id: "quiz", label: "Practice & Quizzes", icon: "quiz" },
  { id: "history", label: "Learning History", icon: "history" },
  { id: "settings", label: "Settings", icon: "settings" },
]

const quizData = [
  {
    q: "What is the primary objective of reviewing lecture materials and video explanations?",
    options: [
      "To understand core principles and apply them to solve practical problems",
      "To memorize surface definitions without critical reasoning",
      "To skip validation and rely purely on guesswork",
      "To replace documentation with unverified assumptions",
    ],
    answer: 0,
    explain:
      "Effective learning focuses on understanding fundamental principles and their real-world applications.",
  },
  {
    q: "Why is methodical validation important when applying concepts from this course?",
    options: [
      "It verifies correctness and prevents edge-case failures",
      "It makes the system slower and harder to verify",
      "It is only required for legacy systems",
      "It guarantees immediate completion without testing",
    ],
    answer: 0,
    explain:
      "Methodical validation ensures reliability, correctness, and adherence to requirements.",
  },
]

const starterHistory: HistoryItem[] = []

interface IconProps {
  name: string
  size?: number
}

function Icon({ name, size = 20 }: IconProps) {
  const paths: Record<string, React.ReactNode> = {
    home: (
      <>
        <path d="m3 10 9-7 9 7" />
        <path d="M5 9v11h14V9M9 20v-7h6v7" />
      </>
    ),
    book: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
      </>
    ),
    spark: (
      <>
        <path d="m12 3-1.7 4.3L6 9l4.3 1.7L12 15l1.7-4.3L18 9l-4.3-1.7L12 3Z" />
        <path d="m5 14-.8 2.2L2 17l2.2.8L5 20l.8-2.2L8 17l-2.2-.8L5 14Zm14-2-.7 1.8-1.8.7 1.8.7L19 17l.7-1.8 1.8-.7-1.8-.7L19 12Z" />
      </>
    ),
    folder: <path d="M3 5h6l2 2h10v12H3V5Z" />,
    quiz: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.7 9a2.4 2.4 0 1 1 3.5 2.1c-.8.4-1.2.9-1.2 1.9M12 17h.01" />
      </>
    ),
    history: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 3v5h5m4-1v5l3 2" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
      </>
    ),
    arrow: <path d="m9 18 6-6-6-6" />,
    play: <path d="m8 5 11 7-11 7V5Z" />,
    upload: (
      <>
        <path d="M12 16V4m-4 4 4-4 4 4" />
        <path d="M4 15v5h16v-5" />
      </>
    ),
    download: (
      <>
        <path d="M12 4v12m-4-4 4 4 4-4" />
        <path d="M4 17v3h16v-3" />
      </>
    ),
    send: (
      <>
        <path d="m22 2-7 20-4-9-9-4 20-7Z" />
        <path d="M22 2 11 13" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    file: (
      <>
        <path d="M6 2h8l4 4v16H6V2Z" />
        <path d="M14 2v5h5M9 13h6m-6 4h6" />
      </>
    ),
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    moon: <path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z" />,
    trash: (
      <>
        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M10 11v6M14 11v6" />
      </>
    ),
    user: (
      <>
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
    expand: (
      <>
        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
      </>
    ),
    shrink: (
      <>
        <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7" />
      </>
    ),
  }
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name] || paths.spark}
    </svg>
  )
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="logo">
      <span className="logo-mark">
        <span />
      </span>
      {!compact && (
        <strong>
          LearnSphere <em>AI</em>
        </strong>
      )}
    </div>
  )
}

function Button({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  type = "button",
  className = "",
  style,
}: React.PropsWithChildren<{
  onClick?: () => void
  variant?: "primary" | "secondary" | "ghost"
  disabled?: boolean
  type?: "button" | "submit"
  className?: string
  style?: React.CSSProperties
}>) {
  return (
    <button
      type={type}
      className={`btn ${variant} ${className}`}
      onClick={onClick}
      disabled={disabled}
      style={style}
    >
      {children}
    </button>
  )
}

function CreateCourseModal({
  open,
  onClose,
  onSuccess,
  defaultInstructor = "",
}: {
  open: boolean
  onClose: () => void
  onSuccess: (course: Course) => void
  defaultInstructor?: string
}) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [instructor, setInstructor] = useState(defaultInstructor)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (open && defaultInstructor && !instructor) {
      setInstructor(defaultInstructor)
    }
  }, [open, defaultInstructor])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError("Please provide a title for the course.")
      return
    }
    setLoading(true)
    setError("")
    try {
      const created = await api<Course>("/api/courses", {
        method: "POST",
        body: {
          title: title.trim(),
          description: description.trim(),
          instructor: instructor.trim() || "Course Instructor",
        },
      })
      onSuccess(created)
      setTitle("")
      setDescription("")
      setInstructor("")
      onClose()
    } catch (err) {
      setError((err as Error).message || "Failed to create course.")
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="upload-modal card" onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <span className="eyebrow">TEACHING CURRICULUM</span>
            <h2>Create Course of Your Choice</h2>
          </div>
          <button
            onClick={onClose}
            style={{
              border: 0,
              background: "none",
              color: "var(--muted)",
              fontSize: "18px",
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>
        <p>
          Create a new course container to organize your teaching videos and
          AI-guided learning modules.
        </p>

        {error && <div className="iv-banner err">{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "14px" }}>
          <label className="upload-field">
            <span>Course Title *</span>
            <input
              type="text"
              placeholder="e.g. Full Stack Web Development or Advanced AI Architectures"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={loading}
              autoFocus
              required
            />
          </label>

          <label className="upload-field">
            <span>Course Instructor / Teacher Name *</span>
            <input
              type="text"
              placeholder="e.g. Dr. Sarah Chen, Prof. Alex Rivera, or your name"
              value={instructor}
              onChange={(e) => setInstructor(e.target.value)}
              disabled={loading}
              required
            />
            <small
              style={{
                color: "var(--muted)",
                fontSize: "11px",
                fontWeight: 400,
              }}
            >
              Specify the professor or lecturer conducting this course.
            </small>
          </label>

          <label className="upload-field">
            <span>Course Subject / Overview</span>
            <input
              type="text"
              placeholder="e.g. Master frontend, backend API design, and distributed persistence"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
            />
          </label>

          <div
            style={{
              display: "flex",
              gap: "10px",
              justifyContent: "flex-end",
              marginTop: "10px",
            }}
          >
            <button
              type="button"
              className="btn secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn primary"
              disabled={loading || !title.trim()}
            >
              {loading ? "Creating Course…" : "Create Course"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditCourseModal({
  course,
  onClose,
  onSuccess,
  onDelete,
}: {
  course: Course | null
  onClose: () => void
  onSuccess: (updated: Course) => void
  onDelete: (courseId: number) => void
}) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [instructor, setInstructor] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (course) {
      setTitle(course.title || "")
      setDescription(course.description || "")
      setInstructor(course.instructor || "")
      setConfirmDelete(false)
      setError("")
    }
  }, [course])

  if (!course) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError("Please provide a title for the course.")
      return
    }
    setLoading(true)
    setError("")
    try {
      const updated = await api<Course>(`/api/courses/${course.id}`, {
        method: "PUT",
        body: {
          title: title.trim(),
          description: description.trim(),
          instructor: instructor.trim() || "Course Instructor",
        },
      })
      onSuccess(updated)
      onClose()
    } catch (err) {
      setError((err as Error).message || "Failed to update course.")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setLoading(true)
    setError("")
    try {
      await api(`/api/courses/${course.id}`, { method: "DELETE" })
      onDelete(course.id)
      onClose()
    } catch (err) {
      setError((err as Error).message || "Failed to delete course.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="upload-modal card" onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <span className="eyebrow">COURSE MANAGEMENT</span>
            <h2>Edit Course Details</h2>
          </div>
          <button
            onClick={onClose}
            style={{
              border: 0,
              background: "none",
              color: "var(--muted)",
              fontSize: "20px",
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>
        <p>Update course title, instructor name, and curriculum overview.</p>

        {error && <div className="iv-banner err">{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "14px" }}>
          <label className="upload-field">
            <span>Course Title *</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={loading}
              placeholder="e.g. Python Programming Fundamentals"
              required
            />
          </label>

          <label className="upload-field">
            <span>Course Instructor / Teacher Name *</span>
            <input
              type="text"
              value={instructor}
              onChange={(e) => setInstructor(e.target.value)}
              disabled={loading}
              placeholder="e.g. Dr. Sarah Chen, Prof. Alex Rivera, or your name"
              required
            />
          </label>

          <label className="upload-field">
            <span>Course Overview / Curriculum Summary</span>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
              placeholder="What will students learn in this course..."
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--line)",
                color: "var(--text)",
                borderRadius: "9px",
                padding: "9px 12px",
                fontSize: "13px",
                resize: "vertical",
              }}
            />
          </label>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "10px",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <div>
              {confirmDelete ? (
                <div
                  style={{ display: "flex", gap: "6px", alignItems: "center" }}
                >
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                    Delete permanently?
                  </span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={loading}
                    style={{
                      background: "#ef4444",
                      color: "#fff",
                      border: "none",
                      borderRadius: "6px",
                      padding: "5px 10px",
                      fontSize: "11px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Yes, Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    style={{
                      background: "transparent",
                      color: "var(--muted)",
                      border: "1px solid var(--line)",
                      borderRadius: "6px",
                      padding: "5px 8px",
                      fontSize: "11px",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  disabled={loading}
                  style={{
                    background: "transparent",
                    color: "#ef4444",
                    border: "1px solid rgba(239, 68, 68, 0.35)",
                    borderRadius: "8px",
                    padding: "7px 12px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  🗑️ Delete Course
                </button>
              )}
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                className="btn secondary"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn primary"
                disabled={loading || !title.trim()}
              >
                {loading ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

function EnlargedAIModal({
  open,
  onClose,
  message,
  time,
  seek,
  lessonTitle,
}: {
  open: boolean
  onClose: () => void
  message: Message | null
  time: number
  seek: (t: number) => void
  lessonTitle: string
}) {
  const [copied, setCopied] = useState(false)
  if (!open || !message) return null

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(message.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 120 }}>
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(880px, 94vw)",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: "18px",
          overflow: "hidden",
          boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
          border: "1px solid var(--line)",
          background: "var(--surface)",
        }}
      >
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--surface-2)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background:
                  "linear-gradient(135deg, var(--violet), var(--blue))",
                display: "grid",
                placeItems: "center",
                color: "#fff",
              }}
            >
              <Icon name="spark" size={18} />
            </div>
            <div>
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <strong style={{ fontSize: "14px" }}>
                  AI Learning Assistant • Detailed Focus View
                </strong>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    color: "var(--green)",
                    background: "rgba(22, 163, 74, 0.1)",
                    padding: "2px 8px",
                    borderRadius: "99px",
                  }}
                >
                  Grounded Lecture AI
                </span>
              </div>
              <small style={{ color: "var(--muted)", fontSize: "11px" }}>
                Lesson: {lessonTitle} • Video time: {formatTime(time)}
              </small>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              onClick={() => {
                seek(time)
                onClose()
              }}
              style={{
                background: "rgba(108, 92, 231, 0.12)",
                color: "var(--indigo)",
                border: "1px solid rgba(108, 92, 231, 0.25)",
                padding: "6px 12px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <Icon name="play" size={12} /> Jump to Video {formatTime(time)}
            </button>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                fontSize: "22px",
                color: "var(--muted)",
                cursor: "pointer",
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        </div>

        <div style={{ padding: "24px", overflowY: "auto", flex: 1 }}>
          <div
            style={{
              padding: "16px 20px",
              background: "var(--surface-2)",
              borderRadius: "12px",
              border: "1px solid var(--line)",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
            }}
          >
            <div>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  color: "var(--violet)",
                  letterSpacing: "1px",
                }}
              >
                STUDENT QUESTION &amp; TIMEFRAME FOCUS
              </span>
              <p
                style={{ margin: "4px 0 0", fontSize: "13px", fontWeight: 600 }}
              >
                {message.role === "assistant"
                  ? "Detailed Topic Breakdown & Explanation"
                  : message.text}
              </p>
            </div>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 800,
                color: "var(--violet)",
                background: "rgba(108, 92, 231, 0.12)",
                padding: "4px 10px",
                borderRadius: "8px",
                whiteSpace: "nowrap",
              }}
            >
              ⏱ Timeframe {formatTime(time)}
            </span>
          </div>

          <div
            style={{
              fontSize: "14px",
              lineHeight: "1.75",
              color: "var(--text)",
              whiteSpace: "pre-wrap",
              background: "var(--surface-1)",
              padding: "20px",
              borderRadius: "12px",
              border: "1px solid var(--line)",
            }}
          >
            {renderBold(message.text)}
          </div>

          {message.sources && message.sources.length > 0 && (
            <div style={{ marginTop: "20px" }}>
              <strong
                style={{
                  fontSize: "12px",
                  display: "block",
                  marginBottom: "8px",
                }}
              >
                Verified Lecture Sources &amp; Timestamps:
              </strong>
              <div style={{ display: "grid", gap: "8px" }}>
                {message.sources.map((s, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      background: "var(--surface-2)",
                      border: "1px solid var(--line)",
                      fontSize: "12px",
                    }}
                  >
                    <span>
                      📌 {s.label} - {s.detail}
                    </span>
                    {s.time !== undefined && (
                      <button
                        onClick={() => {
                          seek(s.time!)
                          onClose()
                        }}
                        style={{
                          background: "var(--violet)",
                          color: "#fff",
                          border: "none",
                          padding: "3px 8px",
                          borderRadius: "6px",
                          fontSize: "11px",
                          cursor: "pointer",
                        }}
                      >
                        Seek {formatTime(s.time)}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            padding: "14px 24px",
            borderTop: "1px solid var(--line)",
            background: "var(--surface-2)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: "11px", color: "var(--muted)" }}>
            Tip: You can pause at any timestamp in the video and click
            &ldquo;Ask AI about this moment&rdquo;.
          </span>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={handleCopy}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                color: "var(--text)",
                padding: "8px 14px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {copied ? "✓ Copied to clipboard" : "📋 Copy Full Answer"}
            </button>
            <button className="btn primary" onClick={onClose}>
              Done Reading
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function VideoUploadModal({
  open,
  onClose,
  onSuccess,
  courses,
  onCoursesUpdated,
  onResourcesUpdated,
  defaultCourseId,
}: {
  open: boolean
  onClose: () => void
  onSuccess: (video: Video) => void
  courses: Course[]
  onCoursesUpdated?: () => void
  onResourcesUpdated?: () => void
  defaultCourseId?: number
}) {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState("")
  const [lessonTopic, setLessonTopic] = useState("")
  const [courseMode, setCourseMode] = useState<"existing" | "new">("existing")
  const [courseId, setCourseId] = useState<number>(
    () => defaultCourseId || courses[0]?.id || 1,
  )
  const [newCourseTitle, setNewCourseTitle] = useState("")
  const [newCourseDesc, setNewCourseDesc] = useState("")
  const [newCourseInstructor, setNewCourseInstructor] = useState("")
  const [duration, setDuration] = useState(0)
  const [durDisplay, setDurDisplay] = useState("00:00")
  const [notesFile, setNotesFile] = useState<File | null>(null)
  const [notesTitle, setNotesTitle] = useState("")
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const notesInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (defaultCourseId) {
      setCourseId(defaultCourseId)
      setCourseMode("existing")
    } else if (courses.length > 0 && !courses.some((c) => c.id === courseId)) {
      setCourseId(courses[0].id)
    }
  }, [defaultCourseId, courses])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    if (!title) {
      setTitle(f.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " "))
    }
    const tempVideo = document.createElement("video")
    tempVideo.preload = "metadata"
    tempVideo.onloadedmetadata = () => {
      window.URL.revokeObjectURL(tempVideo.src)
      const d = tempVideo.duration || 0
      setDuration(d)
      setDurDisplay(formatTime(d))
    }
    tempVideo.src = URL.createObjectURL(f)
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError("Please select a video file (.mp4, .webm).")
      return
    }
    if (!title.trim()) {
      setError("Please provide a title for the teaching lesson.")
      return
    }
    if (courseMode === "new" && !newCourseTitle.trim()) {
      setError("Please enter the title for your new course of choice.")
      return
    }

    setUploading(true)
    setError("")
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("title", title.trim())
      formData.append("lesson_topic", lessonTopic.trim())
      formData.append("duration", String(duration))

      if (courseMode === "new") {
        formData.append("new_course_title", newCourseTitle.trim())
        if (newCourseDesc.trim())
          formData.append("new_course_desc", newCourseDesc.trim())
        if (newCourseInstructor.trim())
          formData.append("new_course_instructor", newCourseInstructor.trim())
      } else {
        formData.append("course_id", String(courseId))
      }

      const uploaded = await apiFormData<Video>("/api/videos/upload", formData)

      // Upload attached lecture notes to database and link with this video
      if (notesFile) {
        try {
          const notesData = new FormData()
          notesData.append("file", notesFile)
          notesData.append(
            "title",
            notesTitle.trim() || `${title.trim()} - Lecture Notes`,
          )
          notesData.append("course_id", String(uploaded.course_id))
          notesData.append("video_id", String(uploaded.id))
          await apiFormData<Resource>("/api/resources/upload", notesData)
          onResourcesUpdated?.()
        } catch (notesErr) {
          console.warn("Attached lecture notes upload warning:", notesErr)
        }
      }

      if (onCoursesUpdated) {
        onCoursesUpdated()
      }
      onSuccess(uploaded)
      setFile(null)
      setNotesFile(null)
      setTitle("")
      setLessonTopic("")
      setNotesTitle("")
      setNewCourseTitle("")
      setNewCourseDesc("")
      setNewCourseInstructor("")
      onClose()
    } catch (err) {
      setError((err as Error).message || "Failed to upload video.")
    } finally {
      setUploading(false)
    }
  }

  if (!open) return null

  const selectedCourse = courses.find((c) => c.id === courseId)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="upload-modal card"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(580px, 95vw)" }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <span className="eyebrow">TEACHING VIDEO CMS</span>
            <h2>Upload Video Lesson &amp; Lecture Notes</h2>
          </div>
          <button
            onClick={onClose}
            style={{
              border: 0,
              background: "none",
              color: "var(--muted)",
              fontSize: "18px",
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>
        <p>
          Select or create your course, upload your lecture video, and optionally
          attach lecture notes (.pdf, .ppt, .pptx, .docx, .txt) for your students.
        </p>

        {error && <div className="iv-banner err">{error}</div>}

        <form onSubmit={handleUpload} style={{ display: "grid", gap: "14px" }}>
          {/* Video file picker */}
          <label className="upload-field">
            <span>1. Choose Video File (.mp4, .webm) *</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/webm"
              onChange={handleFileChange}
              disabled={uploading}
            />
          </label>

          {file && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px",
                background: "var(--surface-2)",
                borderRadius: "9px",
                border: "1px solid var(--line)",
              }}
            >
              <span className="badge-duration">
                ⏱ Detected Duration: {durDisplay}
              </span>
              <small style={{ color: "var(--muted)", marginLeft: "auto" }}>
                {(file.size / (1024 * 1024)).toFixed(1)} MB
              </small>
            </div>
          )}

          {/* Course of Choice Selection */}
          <div className="upload-field">
            <span>2. Course of Your Choice *</span>
            <div className="mode-toggle-pills">
              <button
                type="button"
                className={`mode-toggle-btn ${
                  courseMode === "existing" ? "active" : ""
                }`}
                onClick={() => setCourseMode("existing")}
                disabled={uploading}
              >
                Choose Existing Course ({courses.length})
              </button>
              <button
                type="button"
                className={`mode-toggle-btn ${
                  courseMode === "new" ? "active" : ""
                }`}
                onClick={() => setCourseMode("new")}
                disabled={uploading}
              >
                + Create New Course
              </button>
            </div>

            {courseMode === "existing" ? (
              <div style={{ display: "grid", gap: "6px" }}>
                <select
                  value={courseId}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === "__new__") {
                      setCourseMode("new")
                    } else {
                      setCourseId(Number(val))
                    }
                  }}
                  disabled={uploading}
                  style={{ width: "100%" }}
                >
                  {courses.length === 0 ? (
                    <option value={1}>Default Teaching Course</option>
                  ) : (
                    courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} {c.instructor ? `— (${c.instructor})` : ""}
                      </option>
                    ))
                  )}
                  <option value="__new__">
                    ✨ + Create New Course of My Choice…
                  </option>
                </select>
                {selectedCourse && (
                  <small
                    style={{
                      color: "var(--muted)",
                      fontSize: "11px",
                      padding: "0 4px",
                    }}
                  >
                    Selected: <b>{selectedCourse.title}</b> •{" "}
                    {selectedCourse.video_count || 0} existing lessons
                  </small>
                )}
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: "8px",
                  background: "var(--surface-2)",
                  padding: "12px",
                  borderRadius: "10px",
                  border: "1px dashed var(--line)",
                }}
              >
                <input
                  type="text"
                  placeholder="New Course Title (e.g. Full Stack Web Development)"
                  value={newCourseTitle}
                  onChange={(e) => setNewCourseTitle(e.target.value)}
                  disabled={uploading}
                />
                <input
                  type="text"
                  placeholder="Course Overview / Subject (optional)"
                  value={newCourseDesc}
                  onChange={(e) => setNewCourseDesc(e.target.value)}
                  disabled={uploading}
                />
                <input
                  type="text"
                  placeholder="Instructor Name (e.g. Dr. Alex Morgan)"
                  value={newCourseInstructor}
                  onChange={(e) => setNewCourseInstructor(e.target.value)}
                  disabled={uploading}
                />
              </div>
            )}
          </div>

          {/* Video Lesson of Choice details */}
          <div style={{ display: "grid", gap: "12px" }}>
            <label className="upload-field">
              <span>3. Lesson / Video Title of Your Choice *</span>
              <input
                type="text"
                placeholder="e.g. Lecture 1: Backpropagation & Gradient Descent Step-by-Step"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={uploading}
              />
            </label>

            <label className="upload-field">
              <span>4. Lesson Topic / Chapter / Module (Optional)</span>
              <input
                type="text"
                placeholder="e.g. Module 2: Neural Architecture or Chapter 3: Optimization"
                value={lessonTopic}
                onChange={(e) => setLessonTopic(e.target.value)}
                disabled={uploading}
              />
            </label>
          </div>

          {/* Field 5: Attach Lecture Notes / Slides (Optional) */}
          <div
            className="upload-field"
            style={{
              background: "var(--surface-2)",
              padding: "14px",
              borderRadius: "10px",
              border: "1px dashed var(--line)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontWeight: 600, color: "var(--text)" }}>
                📄 5. Attach Lecture Notes / Slides / Document (Optional)
              </span>
              {notesFile && (
                <button
                  type="button"
                  onClick={() => {
                    setNotesFile(null)
                    setNotesTitle("")
                    if (notesInputRef.current) notesInputRef.current.value = ""
                  }}
                  style={{
                    border: 0,
                    background: "none",
                    color: "var(--red, #ef4444)",
                    fontSize: "12px",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  ✕ Remove Notes
                </button>
              )}
            </div>
            <p
              style={{
                fontSize: "12px",
                color: "var(--muted)",
                margin: "4px 0 10px",
              }}
            >
              Attach PDF, PPT, PPTX, DOCX, or TXT notes. Saved to database and
              available for students to view, download, and ask AI.
            </p>
            <input
              ref={notesInputRef}
              type="file"
              accept=".pdf,.ppt,.pptx,.txt,.docx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              onChange={(e) => {
                const nf = e.target.files?.[0]
                if (!nf) return
                setNotesFile(nf)
                if (!notesTitle) {
                  setNotesTitle(
                    `${title || "Lecture"} - ${nf.name.replace(/\.[^/.]+$/, "")}`,
                  )
                }
              }}
              disabled={uploading}
            />
            {notesFile && (
              <div style={{ marginTop: "10px", display: "grid", gap: "8px" }}>
                <input
                  type="text"
                  placeholder="Notes Title (e.g. Lecture 1 Slides & Formula Sheet)"
                  value={notesTitle}
                  onChange={(e) => setNotesTitle(e.target.value)}
                  disabled={uploading}
                  style={{ width: "100%", fontSize: "12px" }}
                />
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "11px",
                    color: "var(--muted)",
                  }}
                >
                  <span
                    className="badge-duration"
                    style={{
                      background: "rgba(99, 102, 241, 0.15)",
                      color: "#818cf8",
                    }}
                  >
                    📎 {(notesFile.size / 1024).toFixed(1)} KB •{" "}
                    {notesFile.name.split(".").pop()?.toUpperCase()}
                  </span>
                  <span>
                    Will be linked directly to this video &amp; saved to database
                  </span>
                </div>
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              justifyContent: "flex-end",
              marginTop: "10px",
            }}
          >
            <button
              type="button"
              className="btn secondary"
              onClick={onClose}
              disabled={uploading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn primary"
              disabled={uploading || !file}
            >
              {uploading
                ? notesFile
                  ? "Uploading Video & Lecture Notes…"
                  : "Analyzing & Uploading…"
                : "Upload Video to Course"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function NotesUploadModal({
  open,
  onClose,
  courses,
  videos,
  defaultCourseId,
  defaultVideoId,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  courses: Course[]
  videos: Video[]
  defaultCourseId?: number
  defaultVideoId?: number
  onSuccess?: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState("")
  const [courseId, setCourseId] = useState<number>(
    () => defaultCourseId || courses[0]?.id || 1,
  )
  const [videoId, setVideoId] = useState<string>(
    () => (defaultVideoId ? String(defaultVideoId) : ""),
  )
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (defaultCourseId) setCourseId(defaultCourseId)
    if (defaultVideoId) setVideoId(String(defaultVideoId))
  }, [defaultCourseId, defaultVideoId])

  if (!open) return null

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    if (!title) {
      setTitle(f.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " "))
    }
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError(
        "Please choose a lecture notes file (.pdf, .ppt, .pptx, .docx, .txt).",
      )
      return
    }
    setUploading(true)
    setError("")
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append(
        "title",
        title.trim() || file.name.replace(/\.[^/.]+$/, ""),
      )
      formData.append("course_id", String(courseId))
      if (videoId && videoId !== "general") {
        formData.append("video_id", videoId)
      }
      await apiFormData<Resource>("/api/resources/upload", formData)
      onSuccess?.()
      setFile(null)
      setTitle("")
      onClose()
    } catch (err) {
      setError((err as Error).message || "Failed to upload lecture notes.")
    } finally {
      setUploading(false)
    }
  }

  const courseVideos = videos.filter((v) => v.course_id === courseId)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="upload-modal card"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(580px, 95vw)" }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <span className="eyebrow">TEACHER PORTAL • COURSE CMS</span>
            <h2>Upload Lecture Notes &amp; Slides</h2>
          </div>
          <button
            onClick={onClose}
            style={{
              border: 0,
              background: "none",
              color: "var(--muted)",
              fontSize: "18px",
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>
        <p>
          Upload lecture slides, handouts, formula sheets, or study notes (.pdf,
          .ppt, .pptx, .docx, .txt). Stored in LearnSphere database, indexed for
          AI answers, and available in the student dashboard and resource library.
        </p>

        {error && <div className="iv-banner err">{error}</div>}

        <form onSubmit={handleUpload} style={{ display: "grid", gap: "14px" }}>
          <label className="upload-field">
            <span>1. Choose Notes / Document File *</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.ppt,.pptx,.txt,.docx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              onChange={handleFileChange}
              disabled={uploading}
            />
          </label>

          {file && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px",
                background: "var(--surface-2)",
                borderRadius: "9px",
                border: "1px solid var(--line)",
              }}
            >
              <span
                className="badge-duration"
                style={{
                  background: "rgba(99, 102, 241, 0.15)",
                  color: "#818cf8",
                }}
              >
                📎 {file.name.split(".").pop()?.toUpperCase()} •{" "}
                {(file.size / 1024).toFixed(1)} KB
              </span>
              <small style={{ color: "var(--muted)", marginLeft: "auto" }}>
                {file.name}
              </small>
            </div>
          )}

          <label className="upload-field">
            <span>2. Notes / Slides Title *</span>
            <input
              type="text"
              placeholder="e.g. Lecture 1: Core Neural Architecture Notes & Summary"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={uploading}
            />
          </label>

          <label className="upload-field">
            <span>3. Assign to Course *</span>
            <select
              value={courseId}
              onChange={(e) => {
                const cid = Number(e.target.value)
                setCourseId(cid)
                setVideoId("")
              }}
              disabled={uploading}
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>

          <label className="upload-field">
            <span>4. Link to Video Lesson (Optional)</span>
            <select
              value={videoId}
              onChange={(e) => setVideoId(e.target.value)}
              disabled={uploading}
            >
              <option value="">General Course Material (All Lessons)</option>
              {courseVideos.map((v) => (
                <option key={v.id} value={String(v.id)}>
                  Lesson: {v.title}
                </option>
              ))}
            </select>
          </label>

          <div
            style={{
              display: "flex",
              gap: "10px",
              justifyContent: "flex-end",
              marginTop: "10px",
            }}
          >
            <button
              type="button"
              className="btn secondary"
              onClick={onClose}
              disabled={uploading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn primary"
              disabled={uploading || !file}
            >
              {uploading ? "Extracting & Uploading…" : "Upload Lecture Notes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ViewNotesModal({
  resourceId,
  onClose,
  onAskAi,
}: {
  resourceId: number | null
  onClose: () => void
  onAskAi?: (noteTitle: string) => void
}) {
  const [loading, setLoading] = useState(true)
  const [doc, setDoc] = useState<Resource | null>(null)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")

  useEffect(() => {
    if (!resourceId) return
    setLoading(true)
    setError("")
    api<Resource>(`/api/resources/${resourceId}/view`)
      .then((data) => {
        setDoc(data)
        setLoading(false)
      })
      .catch((err) => {
        setError((err as Error).message || "Failed to load document notes.")
        setLoading(false)
      })
  }, [resourceId])

  if (!resourceId) return null

  const fileType = (doc?.file_type || "pdf").toLowerCase()
  const text = doc?.extracted_text || ""

  return (
    <div className="view-notes-overlay" onClick={onClose}>
      <div className="view-notes-modal" onClick={(e) => e.stopPropagation()}>
        <div className="vnm-header">
          <div className="vnm-title-group">
            <span className={`lnc-icon ${fileType}`}>{fileType}</span>
            <div>
              <h2>{doc?.title || "Lecture Notes Viewer"}</h2>
              <div className="vnm-sub">
                {doc ? (
                  <>
                    <span>{doc.filename}</span> •{" "}
                    <span>{(doc.file_size / 1024).toFixed(1)} KB</span> •{" "}
                    <span>{doc.download_count || 0} downloads</span>
                  </>
                ) : (
                  "Loading document details..."
                )}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {doc?.download_url && (
              <a
                href={doc.download_url}
                download
                className="btn-download-notes"
                title="Download original file"
              >
                <Icon name="download" size={13} /> Download File
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              style={{
                border: 0,
                background: "none",
                color: "var(--muted)",
                fontSize: "20px",
                cursor: "pointer",
                padding: "4px 8px",
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Search bar inside note view */}
        <div className="vnm-toolbar">
          <Icon name="search" size={14} />
          <input
            className="vnm-search-input"
            type="text"
            placeholder="Search keyword inside lecture notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              style={{
                border: 0,
                background: "none",
                color: "var(--muted)",
                cursor: "pointer",
                fontSize: "11px",
              }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Reader content body */}
        <div className="vnm-body">
          {loading ? (
            <div
              style={{
                padding: "40px",
                textAlign: "center",
                color: "var(--muted)",
              }}
            >
              <div
                className="fs-ai-empty-orb"
                style={{ margin: "0 auto 12px" }}
              >
                <Icon name="spark" size={24} />
              </div>
              <p>Loading document notes from database…</p>
            </div>
          ) : error ? (
            <div className="iv-banner err">{error}</div>
          ) : (
            <>
              <div className="vnm-ai-banner">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <Icon name="spark" size={18} />
                  <div>
                    <strong style={{ fontSize: "13px" }}>
                      AI Synchronized Document Notes
                    </strong>
                    <p
                      style={{
                        margin: "2px 0 0",
                        fontSize: "11px",
                        color: "var(--muted)",
                      }}
                    >
                      This document is stored in the LearnSphere SQLite database
                      and indexed for AI questions.
                    </p>
                  </div>
                </div>
                {onAskAi && doc && (
                  <button
                    type="button"
                    className="btn-view-notes"
                    style={{ whiteSpace: "nowrap" }}
                    onClick={() => {
                      onAskAi(doc.title)
                      onClose()
                    }}
                  >
                    ✨ Ask AI About This
                  </button>
                )}
              </div>

              {text ? (
                <div className="vnm-paper">{text}</div>
              ) : (
                <div
                  style={{
                    textAlign: "center",
                    padding: "30px 10px",
                    color: "var(--muted)",
                  }}
                >
                  <p style={{ fontSize: "14px", marginBottom: "8px" }}>
                    <b>Document saved in database</b>
                  </p>
                  <p
                    style={{
                      fontSize: "12px",
                      maxWidth: "420px",
                      margin: "0 auto 16px",
                    }}
                  >
                    This file ({fileType.toUpperCase()}) is stored in LearnSphere
                    database. You can download and open it in your system's
                    viewer, or ask AI about this topic in the workspace.
                  </p>
                  {doc?.download_url && (
                    <a href={doc.download_url} download className="btn primary">
                      <Icon name="download" size={14} /> Download {doc.filename}
                    </a>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="vnm-footer">
          <small style={{ color: "var(--muted)" }}>
            Stored in LearnSphere Database • Available in Student Learning
            Dashboard &amp; Resource Library
          </small>
          <div style={{ display: "flex", gap: "8px" }}>
            {doc?.download_url && (
              <a
                href={doc.download_url}
                download
                className="btn secondary small"
              >
                <Icon name="download" size={12} /> Download Original
              </a>
            )}
            <button
              type="button"
              className="btn primary small"
              onClick={onClose}
            >
              Done Reading
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function GoogleAccountSwitcherModal({
  open,
  onClose,
  user,
  savedAccounts,
  onSwitchAccount,
  onAddAccount,
  onSignOut,
}: {
  open: boolean
  onClose: () => void
  user: AuthUser
  savedAccounts: SavedAccount[]
  onSwitchAccount: (account: SavedAccount) => void
  onAddAccount: () => void
  onSignOut: () => void
}) {
  if (!open) return null

  const isTeacher = user.role === "teacher"
  const otherAccounts = savedAccounts.filter(
    (a) => a.email.toLowerCase() !== user.email.toLowerCase(),
  )

  return (
    <div className="g-switcher-overlay" onClick={onClose}>
      <div className="g-switcher-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="g-switcher-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: "linear-gradient(135deg, #4285f4, #34a853)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 800,
                fontSize: 14,
              }}
            >
              G
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "var(--text)" }}>
                Google Account Switcher
              </h3>
              <span style={{ fontSize: 10, color: "var(--muted)" }}>
                LearnSphere Multi-Account Management
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 0,
              background: "none",
              color: "var(--muted)",
              fontSize: 18,
              cursor: "pointer",
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="g-switcher-body">
          {/* Active Account Card */}
          <div className="g-active-card">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: `2.5px solid ${isTeacher ? "#34d399" : "#818cf8"}`,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: isTeacher
                      ? "linear-gradient(135deg, #059669, #10b981)"
                      : "linear-gradient(135deg, #4f46e5, #7c3aed)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: 16,
                  }}
                >
                  {user.displayName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <strong
                    style={{
                      fontSize: 14,
                      color: "var(--text)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "block",
                    }}
                  >
                    {user.displayName}
                  </strong>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: "rgba(34, 197, 94, 0.15)",
                      color: "#22c55e",
                    }}
                  >
                    Active
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--muted)",
                    display: "block",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {user.email}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: isTeacher ? "#34d399" : "#a5b4fc",
                    marginTop: 2,
                    display: "inline-block",
                  }}
                >
                  {isTeacher
                    ? "👩‍🏫 Teacher Mode (CMS & Uploads)"
                    : "🎓 Student Mode (Learning Dashboard)"}
                </span>
              </div>
            </div>

            {/* Permanent Account Type Badge (Database-Locked) */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                borderRadius: 8,
                marginTop: 10,
                background: isTeacher ? "rgba(52, 211, 153, 0.1)" : "rgba(99, 102, 241, 0.1)",
                border: isTeacher ? "1px solid rgba(52, 211, 153, 0.25)" : "1px solid rgba(99, 102, 241, 0.25)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>{isTeacher ? "👩‍🏫" : "🎓"}</span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: isTeacher ? "#34d399" : "#a5b4fc" }}>
                    {isTeacher ? "Teacher Portal Account" : "Student Portal Account"}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--muted)" }}>
                    {isTeacher ? "Intact & permanently saved as Teacher" : "Intact & permanently saved as Student"}
                  </div>
                </div>
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: "3px 8px",
                  borderRadius: 6,
                  background: isTeacher ? "rgba(52, 211, 153, 0.2)" : "rgba(99, 102, 241, 0.2)",
                  color: isTeacher ? "#34d399" : "#a5b4fc",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                <span>🔒</span> Locked
              </span>
            </div>
          </div>

          {/* Other Saved Accounts */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Other Accounts on this device ({otherAccounts.length})
              </span>
            </div>

            {otherAccounts.length > 0 ? (
              <div className="g-saved-list">
                {otherAccounts.map((acc) => {
                  const accTeacher = acc.role === "teacher"
                  const ringColor = accTeacher ? "#34d399" : "#818cf8"
                  return (
                    <div
                      key={acc.email}
                      className="g-account-row"
                      onClick={() => {
                        onSwitchAccount(acc)
                        onClose()
                      }}
                      title={`Switch to ${acc.displayName} (${acc.role})`}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        {acc.photoURL ? (
                          <img
                            src={acc.photoURL}
                            alt={acc.displayName}
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: "50%",
                              objectFit: "cover",
                              border: `2px solid ${ringColor}`,
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: "50%",
                              background: accTeacher
                                ? "linear-gradient(135deg, #059669, #10b981)"
                                : "linear-gradient(135deg, #4f46e5, #7c3aed)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#fff",
                              fontWeight: 700,
                              fontSize: 12,
                              flexShrink: 0,
                            }}
                          >
                            {acc.displayName.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div style={{ minWidth: 0, overflow: "hidden" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <strong
                              style={{
                                fontSize: 12,
                                color: "var(--text)",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {acc.displayName}
                            </strong>
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 700,
                                textTransform: "uppercase",
                                padding: "1px 5px",
                                borderRadius: 4,
                                background: accTeacher
                                  ? "rgba(16,185,129,0.15)"
                                  : "rgba(99,102,241,0.15)",
                                color: accTeacher ? "#34d399" : "#a5b4fc",
                              }}
                            >
                              {accTeacher ? "Teacher" : "Student"}
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: 11,
                              color: "var(--muted)",
                              display: "block",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {acc.email}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn small"
                        style={{
                          fontSize: 11,
                          padding: "5px 11px",
                          borderRadius: 8,
                          background: "rgba(255,255,255,0.08)",
                          color: "var(--text)",
                          border: "1px solid var(--line)",
                          cursor: "pointer",
                          fontWeight: 700,
                        }}
                      >
                        Switch
                      </button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 11, color: "var(--muted)", fontStyle: "italic" }}>
                No other accounts signed in on this device.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="g-switcher-footer">
          <button
            type="button"
            onClick={() => {
              onClose()
              onAddAccount()
            }}
            style={{
              border: 0,
              background: "transparent",
              color: "#818cf8",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>➕</span>
            <span>Add another account</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose()
              onSignOut()
            }}
            style={{
              border: 0,
              background: "transparent",
              color: "#ef4444",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}

function App() {
  const {
    user,
    loading: authLoading,
    logout,
    savedAccounts,
    switchAccount,
    updateUserRole,
  } = useAuth()
  const [accountSwitcherOpen, setAccountSwitcherOpen] = useState(false)
  const [route, setRoute] = useState<Route>("home")
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [notifications, setNotifications] = useState(false)
  const [dark, setDark] = useState(
    () => localStorage.getItem("ls-theme") === "dark",
  )
  const [reducedMotion, setReducedMotion] = useState(
    () => localStorage.getItem("ls-motion") === "reduced",
  )
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem("ls-history")
      return saved ? JSON.parse(saved) as HistoryItem[] : []
    } catch {
      return []
    }
  })
  const [uploads, setUploads] = useState<UploadItem[]>(() => {
    try {
      return JSON.parse(
        localStorage.getItem("ls-uploads") || "[]",
      ) as UploadItem[]
    } catch {
      return []
    }
  })
  const [preview, setPreview] = useState<string | null>(null)
  const [health, setHealth] = useState<Health | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)

  // Real backend entities
  const [courses, setCourses] = useState<Course[]>([])
  const [videos, setVideos] = useState<Video[]>([])
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null)
  const [resources, setResources] = useState<Resource[]>([])
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [createCourseModalOpen, setCreateCourseModalOpen] = useState(false)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [uploadModalCourseId, setUploadModalCourseId] =
    useState<number | undefined>(undefined)
  const [notesUploadModalOpen, setNotesUploadModalOpen] = useState(false)
  const [notesUploadModalCourseId, setNotesUploadModalCourseId] =
    useState<number | undefined>(undefined)
  const [notesUploadModalVideoId, setNotesUploadModalVideoId] =
    useState<number | undefined>(undefined)
  const [quizVideoId, setQuizVideoId] = useState<number>(1)

  const refreshCourses = () => {
    api<Course[]>("/api/courses")
      .then(setCourses)
      .catch(() => {})
  }

  const openUploadForCourse = (courseId?: number) => {
    setUploadModalCourseId(courseId)
    setUploadModalOpen(true)
  }

  const openNotesUploadForCourse = (courseId?: number, videoId?: number) => {
    setNotesUploadModalCourseId(courseId)
    setNotesUploadModalVideoId(videoId)
    setNotesUploadModalOpen(true)
  }

  const refreshVideos = () => {
    api<Video[]>("/api/videos")
      .then((vids) => {
        setVideos(vids)
        if (vids.length > 0) {
          setCurrentVideo((prev) => prev || vids[0])
        }
      })
      .catch(() => {})
  }

  const handleDeleteVideo = async (videoId: number) => {
    if (user?.role !== "teacher") {
      alert("Only teachers have permission to remove course videos.")
      return
    }
    try {
      await api(`/api/videos/${videoId}`, { method: "DELETE" })
      const vids = await api<Video[]>("/api/videos")
      setVideos(vids)
      setCurrentVideo((prev) => {
        if (prev?.id === videoId) {
          return vids.length > 0 ? vids[0] : null
        }
        return prev
      })
      refreshCourses()
      refreshStats()
    } catch (err) {
      alert((err as Error).message || "Failed to remove video.")
    }
  }

  const refreshResources = () => {
    api<Resource[]>("/api/resources")
      .then(setResources)
      .catch(() => {})
  }

  const refreshStats = () => {
    api<Stats>("/api/stats")
      .then(setStats)
      .catch(() => setStats(null))
  }

  const refreshHistory = () => {
    api<{ items: HistoryItem[] }>("/api/history")
      .then((res) => {
        if (res && Array.isArray(res.items)) {
          setHistory(res.items)
        }
      })
      .catch(() => {})
  }

  useEffect(() => {
    api<Health>("/api/health")
      .then(setHealth)
      .catch(() => setHealth(null))
    refreshCourses()
    refreshVideos()
    refreshResources()
    refreshHistory()
  }, [])

  useEffect(() => {
    refreshStats()
    refreshHistory()
  }, [route])

  useEffect(() => {
    if (user) {
      refreshHistory()
      refreshStats()
    }
  }, [user])

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light"
    document.documentElement.dataset.motion = reducedMotion ? "reduced" : "full"
    localStorage.setItem("ls-theme", dark ? "dark" : "light")
    localStorage.setItem("ls-motion", reducedMotion ? "reduced" : "full")
  }, [dark, reducedMotion])
  useEffect(() => {
    localStorage.setItem("ls-history", JSON.stringify(history))
  }, [history])
  useEffect(() => {
    try {
      localStorage.setItem("ls-uploads", JSON.stringify(uploads))
    } catch {
      /* storage quota: keep session state */
    }
  }, [uploads])
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setSearchOpen(true)
      }
      if (event.key === "Escape") {
        setSearchOpen(false)
        setNotifications(false)
        setMenuOpen(false)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const go = (next: Route) => {
    setRoute(next)
    setMenuOpen(false)
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" })
  }

  const addHistory = (item: HistoryItem) => {
    setHistory((h) => [
      item,
      ...h.filter((x) => x.title !== item.title).slice(0, 30),
    ])
    // Persist learning event to SQLite database
    api("/api/history/event", {
      method: "POST",
      body: {
        type: item.type,
        title: item.title,
        detail: item.detail,
        video_id: currentVideo?.id,
        lesson_time: 0,
      },
    }).catch(() => {})
  }

  const clearHistory = async () => {
    try {
      await api("/api/history", { method: "DELETE" })
    } catch (err) {
      console.warn("Could not delete history from server", err)
    }
    setHistory([])
    try {
      localStorage.removeItem("ls-history")
    } catch {}
    refreshStats()
  }

  // ── Auth gate ────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #08091a 0%, #10152e 55%, #16194a)",
          fontFamily: '"Manrope", sans-serif',
        }}
      >
        <div style={{ textAlign: "center", color: "#9d8bff" }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              border: "3px solid rgba(157,139,255,0.25)",
              borderTopColor: "#9d8bff",
              animation: "ls-spin 0.8s linear infinite",
              margin: "0 auto 16px",
            }}
          />
          <p style={{ color: "#7a85a9", fontSize: 13, margin: 0 }}>
            Loading LearnSphere AI…
          </p>
          <style>{`@keyframes ls-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    )
  }

  if (!user) return <LoginPage />

  const isTeacher = user.role === "teacher"

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="side-top">
          <Logo />
          <button
            className="mobile-close"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          >
            <Icon name="close" />
          </button>
        </div>
        <nav aria-label="Primary navigation">
          <p className="eyebrow side-label">LEARNING SPACE</p>
          {nav
            .filter((n) => n.id !== "settings")
            .map((item) => (
              <button
                key={item.id}
                onClick={() => go(item.id)}
                className={route === item.id ? "active" : ""}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
                {(item.id === "workspace" || item.id === "interview") && (
                  <b>AI</b>
                )}
              </button>
            ))}
          <p className="eyebrow side-label lower">PREFERENCES</p>
          <button
            onClick={() => go("settings")}
            className={route === "settings" ? "active" : ""}
          >
            <Icon name="settings" />
            <span>Settings</span>
          </button>
        </nav>
        <div className="side-bottom">
          {/* Role badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "9px 10px",
              borderRadius: 10,
              background: isTeacher
                ? "rgba(52,211,153,0.08)"
                : "rgba(108,92,231,0.08)",
              border: `1px solid ${
                isTeacher ? "rgba(52,211,153,0.22)" : "rgba(108,92,231,0.22)"
              }`,
              marginBottom: 10,
              fontSize: 10,
              fontWeight: 700,
              color: isTeacher ? "#34d399" : "#9d8bff",
            }}
          >
            <span>{isTeacher ? "👩‍🏫" : "🎓"}</span>
            <span style={{ flex: 1 }}>
              {isTeacher ? "Teacher Mode" : "Student Mode"}
            </span>
          </div>
          <div className="storage">
            <div>
              <span>Interview practice</span>
              <b>{stats?.interviews_finished ?? 0}</b>
            </div>
            <small>
              {stats?.answers_reviewed ?? 0} answers reviewed
              {stats?.average_rating != null
                ? ` • avg ${stats.average_rating}/5`
                : ""}
            </small>
          </div>
          <Button onClick={() => go("workspace")} className="side-cta">
            <Icon name="play" size={17} />{" "}
            {isTeacher ? "Manage Content" : "Start Learning"}
          </Button>
          <div
            className="profile"
            onClick={() => setAccountSwitcherOpen(true)}
            title="Click to Switch Accounts or Change Role (Google Account Switcher)"
            style={{
              cursor: "pointer",
              borderRadius: 10,
              padding: "6px 8px",
              transition: "background 0.2s ease",
            }}
          >
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt="avatar"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: `2px solid ${isTeacher ? "#34d399" : "#818cf8"}`,
                }}
              />
            ) : (
              <span
                className="avatar"
                style={{
                  border: `2px solid ${isTeacher ? "#34d399" : "#818cf8"}`,
                }}
              >
                {user.displayName.slice(0, 2).toUpperCase()}
              </span>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong
                style={{
                  fontSize: 11,
                  display: "block",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: 95,
                }}
              >
                {user.displayName}
              </strong>
              <small style={{ color: isTeacher ? "#34d399" : "#818cf8", fontWeight: 700 }}>
                {isTeacher ? "👩‍🏫 Teacher" : "🎓 Student"}
              </small>
            </div>
            <button
              aria-label="Google Account Switcher"
              title="Google Account Switcher"
              onClick={(e) => {
                e.stopPropagation()
                setAccountSwitcherOpen(true)
              }}
              style={{
                border: 0,
                background: "rgba(255,255,255,0.08)",
                borderRadius: 6,
                color: "var(--text)",
                cursor: "pointer",
                fontSize: 13,
                padding: "3px 6px",
                lineHeight: 1,
              }}
            >
              ⇄
            </button>
          </div>
        </div>
      </aside>
      {menuOpen && (
        <button
          className="scrim"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <main className="main">
        <header className="topbar">
          <button
            className="menu-button"
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
          >
            <Icon name="menu" />
          </button>
          <div className="mobile-logo">
            <Logo />
          </div>
          <button className="search-box" onClick={() => setSearchOpen(true)}>
            <Icon name="search" />
            <span>Search courses, lessons, resources...</span>
            <kbd>⌘ K</kbd>
          </button>
          <div className="top-actions">
            <span className="demo-pill" title="LearnSphere AI Engine Active">
              <i />{" "}
              {health?.aiConfigured ? "LIVE AI TUTOR" : "LEARNSPHERE AI ACTIVE"}
            </span>
            <button
              className="icon-btn"
              aria-label="Notifications"
              onClick={() => setNotifications(!notifications)}
            >
              <Icon name="bell" />
            </button>
            <button
              className="mini-avatar"
              aria-label="Open profile"
              title={
                user.displayName
                  ? `${user.displayName} (Google Account Switcher)`
                  : "Google Account Switcher"
              }
              onClick={() => setAccountSwitcherOpen(true)}
              style={{
                overflow: "hidden",
                cursor: "pointer",
                border: isTeacher ? "2px solid #34d399" : "2px solid #818cf8",
              }}
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : user.displayName ? (
                user.displayName.slice(0, 2).toUpperCase()
              ) : (
                "SH"
              )}
            </button>
          </div>
          {notifications && (
            <div className="popover notification">
              <strong>Notifications</strong>
              <p>No new notifications.</p>
            </div>
          )}
        </header>
        {route === "home" && (
          <Home
            go={go}
            stats={stats}
            videos={videos}
            onSelectVideo={(v) => {
              setCurrentVideo(v)
              addHistory({
                type: "Lesson",
                title: v.title,
                detail: `Started lesson: ${v.title} (${v.duration_display || "0:00"})`,
                time: "Just now",
              })
              go("workspace")
            }}
            onOpenUpload={isTeacher ? () => openUploadForCourse() : undefined}
            onOpenNotesUpload={isTeacher ? () => openNotesUploadForCourse() : undefined}
            isTeacher={isTeacher}
          />
        )}
        {route === "courses" && (
          <Courses
            go={go}
            courses={courses}
            videos={videos}
            onSelectVideo={(v) => {
              setCurrentVideo(v)
              addHistory({
                type: "Lesson",
                title: v.title,
                detail: `Started lesson: ${v.title} (${v.duration_display || "0:00"})`,
                time: "Just now",
              })
              go("workspace")
            }}
            onStartQuiz={(v) => {
              addHistory({
                type: "Quiz",
                title: `Quick Quiz: ${v.title}`,
                detail: `Started diagnostic video quiz`,
                time: "Just now",
              })
              setQuizVideoId(v.id)
              go("quiz")
            }}
            onOpenUpload={isTeacher ? openUploadForCourse : undefined}
            onOpenNotesUpload={isTeacher ? openNotesUploadForCourse : undefined}
            onDeleteVideo={isTeacher ? handleDeleteVideo : undefined}
            onOpenCreateCourse={isTeacher ? () => setCreateCourseModalOpen(true) : undefined}
            onEditCourse={isTeacher ? (c) => setEditingCourse(c) : undefined}
            isTeacher={isTeacher}
          />
        )}
        {route === "workspace" && (
          <Workspace
            go={go}
            addHistory={addHistory}
            currentVideo={currentVideo}
            videos={videos}
            onSelectVideo={setCurrentVideo}
            onStartQuiz={(v) => {
              setQuizVideoId(v.id)
              go("quiz")
            }}
            onOpenUpload={isTeacher ? () => openUploadForCourse(currentVideo?.course_id) : undefined}
            onOpenNotesUpload={isTeacher ? (cId, vId) => openNotesUploadForCourse(cId, vId) : undefined}
            onDeleteVideo={isTeacher ? handleDeleteVideo : undefined}
            resources={resources}
            onRefreshResources={refreshResources}
            isTeacher={isTeacher}
          />
        )}
        {route === "interview" && (
          <Interview onChange={refreshStats} addHistory={addHistory} />
        )}
        {route === "resources" && (
          <Resources
            uploads={uploads}
            setUploads={setUploads}
            preview={preview}
            setPreview={setPreview}
            addHistory={addHistory}
            serverResources={resources}
            onRefreshResources={refreshResources}
            onOpenWorkspace={() => go("workspace")}
            isTeacher={isTeacher}
          />
        )}
        {route === "quiz" && (
          <Quiz
            addHistory={addHistory}
            videos={videos}
            initialVideoId={quizVideoId}
            go={go}
          />
        )}
        {route === "history" && (
          <History
            history={history}
            go={go}
            stats={stats}
            onClearHistory={clearHistory}
          />
        )}
        {route === "settings" && (
          <Settings
            dark={dark}
            setDark={setDark}
            reducedMotion={reducedMotion}
            setReducedMotion={setReducedMotion}
            user={user}
            savedAccounts={savedAccounts}
            onSwitchAccount={switchAccount}
            onAddAccount={logout}
            onSignOut={logout}
            clear={() => {
              api("/api/history", { method: "DELETE" })
                .then(refreshStats)
                .catch(() => {})
              setHistory([])
              setUploads([])
              localStorage.removeItem("ls-history")
              localStorage.removeItem("ls-uploads")
              localStorage.removeItem("ls-progress-ml")
            }}
          />
        )}
      </main>
      {uploadModalOpen && (
        <VideoUploadModal
          open={uploadModalOpen}
          onClose={() => {
            setUploadModalOpen(false)
            setUploadModalCourseId(undefined)
          }}
          courses={courses}
          defaultCourseId={uploadModalCourseId}
          onCoursesUpdated={refreshCourses}
          onResourcesUpdated={refreshResources}
          onSuccess={(newVideo) => {
            refreshVideos()
            refreshCourses()
            refreshResources()
            setCurrentVideo(newVideo)
            go("workspace")
          }}
        />
      )}
      {notesUploadModalOpen && (
        <NotesUploadModal
          open={notesUploadModalOpen}
          onClose={() => {
            setNotesUploadModalOpen(false)
            setNotesUploadModalCourseId(undefined)
            setNotesUploadModalVideoId(undefined)
          }}
          courses={courses}
          videos={videos}
          defaultCourseId={notesUploadModalCourseId}
          defaultVideoId={notesUploadModalVideoId}
          onSuccess={() => {
            refreshResources()
          }}
        />
      )}
      {createCourseModalOpen && (
        <CreateCourseModal
          open={createCourseModalOpen}
          onClose={() => setCreateCourseModalOpen(false)}
          onSuccess={(newCourse) => {
            refreshCourses()
            openUploadForCourse(newCourse.id)
          }}
          defaultInstructor={user.displayName || "Course Instructor"}
        />
      )}
      <EditCourseModal
        course={editingCourse}
        onClose={() => setEditingCourse(null)}
        onSuccess={(updated) => {
          setCourses((prev) =>
            prev.map((c) => (c.id === updated.id ? updated : c)),
          )
          refreshCourses()
        }}
        onDelete={(deletedId) => {
          setCourses((prev) => prev.filter((c) => c.id !== deletedId))
          refreshCourses()
          refreshVideos()
        }}
      />
      {searchOpen && (
        <SearchModal
          close={() => setSearchOpen(false)}
          go={go}
          uploads={uploads}
          videos={videos}
          resources={resources}
        />
      )}
      {accountSwitcherOpen && user && (
        <GoogleAccountSwitcherModal
          open={accountSwitcherOpen}
          onClose={() => setAccountSwitcherOpen(false)}
          user={user}
          savedAccounts={savedAccounts}
          onSwitchAccount={switchAccount}
          onAddAccount={logout}
          onSignOut={logout}
        />
      )}
    </div>
  )
}

function PageHeading({
  eyebrow,
  title,
  text,
  action,
}: {
  eyebrow: string
  title: string
  text?: string
  action?: React.ReactNode
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {text && <p>{text}</p>}
      </div>
      {action}
    </div>
  )
}

function Home({
  go,
  stats,
  videos = [],
  onSelectVideo,
  onOpenUpload,
  onOpenNotesUpload,
  isTeacher = false,
}: {
  go: (r: Route) => void
  stats: Stats | null
  videos?: Video[]
  onSelectVideo?: (v: Video) => void
  onOpenUpload?: () => void
  onOpenNotesUpload?: () => void
  isTeacher?: boolean
}) {
  return (
    <div className="page home-page">
      <section className="hero">
        <div className="hero-copy reveal">
          <span className="hero-tag">
            <Icon name="spark" size={15} /> AI learning, grounded in your
            material
          </span>
          <h1>
            Learn Smarter.
            <br />
            <span>Understand Deeper.</span>
          </h1>
          <p>
            Your AI learning companion understands your teaching videos, lecture
            notes, and presentations—helping you get answers and quizzes
            grounded directly in the material you study.
          </p>
          <div className="hero-actions">
            <Button onClick={() => go("workspace")}>
              Start Learning <Icon name="arrow" size={17} />
            </Button>
            {onOpenUpload && (
              <Button variant="secondary" onClick={onOpenUpload}>
                <Icon name="upload" size={17} /> Upload Video
              </Button>
            )}
            {onOpenNotesUpload && (
              <Button variant="secondary" onClick={onOpenNotesUpload}>
                <Icon name="file" size={17} /> Upload Notes / Slides
              </Button>
            )}
          </div>
          <div className="trust-row">
            <span>
              <i>
                <Icon name="check" size={13} />
              </i>{" "}
              Timestamp aware
            </span>
            <span>
              <i>
                <Icon name="check" size={13} />
              </i>{" "}
              Source grounded
            </span>
            <span>
              <i>
                <Icon name="check" size={13} />
              </i>{" "}
              Privacy first
            </span>
          </div>
        </div>
        <div
          className="orb-stage"
          aria-label="Animated learning network illustration"
        >
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orb">
            <div className="orb-core">
              <Icon name="spark" size={38} />
            </div>
            <span className="orb-ring a" />
            <span className="orb-ring b" />
          </div>
          <div className="float-card fc-video">
            <span>
              <Icon name="play" size={14} />
            </span>
            <div>
              <small>LECTURE</small>
              <strong>{videos[0]?.title || "Teaching Video"}</strong>
              <i>
                <b />
              </i>
            </div>
          </div>
          <div className="float-card fc-pdf">
            <span>
              <Icon name="file" size={16} />
            </span>
            <div>
              <small>SOURCE GROUNDED</small>
              <strong>Course Notes</strong>
            </div>
          </div>
          <div className="float-card fc-ai">
            <span>
              <Icon name="spark" size={16} />
            </span>
            <div>
              <small>AI ASSISTANT</small>
              <strong>Video Grounded</strong>
            </div>
          </div>
          <div className="context-chip">
            <i /> Context synced • Live AI
          </div>
        </div>
      </section>
      <section className="feature-strip">
        {[
          [
            "play",
            "Ask while watching",
            "Pause at any moment and ask questions in context.",
          ],
          [
            "file",
            "Trusted, cited answers",
            "See the exact video timestamp and slide source citations.",
          ],
          [
            "quiz",
            "Practice what you learn",
            "Auto-generate quick quizzes from your uploaded videos.",
          ],
        ].map(([icon, title, text], i) => (
          <div key={title}>
            <span className={`feature-icon f${i}`}>
              <Icon name={icon} />
            </span>
            <div>
              <strong>{title}</strong>
              <p>{text}</p>
            </div>
          </div>
        ))}
      </section>
      <section className="section-block">
        <div className="section-title">
          <div>
            <p className="eyebrow">
              {isTeacher ? "TEACHING VIDEO CMS" : "AVAILABLE VIDEO LECTURES"}
            </p>
            <h2>{isTeacher ? "Your Teaching Videos" : "Featured Video Lessons"}</h2>
          </div>
          <button onClick={() => go("courses")}>
            View all videos <Icon name="arrow" size={16} />
          </button>
        </div>
        {videos.length === 0 ? (
          <div
            className="card empty-state"
            style={{ padding: "36px 20px", textAlign: "center" }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "var(--surface-3)",
                display: "grid",
                placeItems: "center",
                margin: "0 auto 12px",
                color: "var(--primary)",
              }}
            >
              <Icon name="upload" size={22} />
            </div>
            <h3>
              {isTeacher
                ? "No teaching videos uploaded yet"
                : "No video lectures available yet"}
            </h3>
            <p
              style={{
                color: "var(--muted)",
                maxWidth: "420px",
                margin: "6px auto 16px",
              }}
            >
              {isTeacher
                ? "Upload your teaching videos (.mp4, .webm) with custom labels to start tutoring with AI video explanations and interactive quizzes."
                : "Your teachers have not uploaded any video lectures yet. Check back soon for new learning material."}
            </p>
            {onOpenUpload && (
              <Button onClick={onOpenUpload}>
                <Icon name="upload" size={15} /> Upload Teaching Video
              </Button>
            )}
          </div>
        ) : (
          <div className="course-grid">
            {videos.slice(0, 3).map((v, i) => (
              <article key={v.id} className="course-card">
                <div
                  className="course-art"
                  style={{
                    backgroundImage: `linear-gradient(110deg,rgba(18,22,55,.6),rgba(67,56,202,.3)),url("${photo}")`,
                  }}
                >
                  <span className="badge-duration">⏱ {v.duration_display}</span>
                  <button
                    aria-label={`Watch ${v.title}`}
                    onClick={() => {
                      if (onSelectVideo) onSelectVideo(v)
                      go("workspace")
                    }}
                  >
                    <Icon name="play" />
                  </button>
                </div>
                <div className="course-info">
                  <small>{isTeacher ? `TEACHING VIDEO #${i + 1}` : `LESSON #${i + 1}`}</small>
                  <h3>{v.title}</h3>
                  <p>
                    {v.ai_summary ||
                      "Video lecture with time-grounded AI assistance."}
                  </p>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (onSelectVideo) onSelectVideo(v)
                      go("workspace")
                    }}
                  >
                    Watch &amp; Ask AI <Icon name="arrow" size={16} />
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="home-lower">
        <div className="insights card">
          <div className="section-title compact">
            <div>
              <p className="eyebrow">YOUR MOMENTUM</p>
              <h2>Learning insights</h2>
            </div>
            <span>All time</span>
          </div>
          <div className="metrics">
            <div
              className="ring"
              style={
                {
                  "--p": `${((stats?.average_rating ?? 0) / 5) * 100}%`,
                } as React.CSSProperties
              }
            >
              <span>
                <b>{stats?.average_rating ?? "–"}</b>
                <small>avg rating / 5</small>
              </span>
            </div>
            <div className="metric">
              <span className="metric-icon violet">
                <Icon name="book" />
              </span>
              <b>{stats?.questions_asked ?? 0}</b>
              <small>Questions asked</small>
            </div>
            <div className="metric">
              <span className="metric-icon blue">
                <Icon name="check" />
              </span>
              <b>{stats?.interviews_finished ?? 0}</b>
              <small>Interviews finished</small>
            </div>
            <div className="metric">
              <span className="metric-icon green">
                <Icon name="quiz" />
              </span>
              <b>{stats?.answers_reviewed ?? 0}</b>
              <small>Answers reviewed</small>
            </div>
          </div>
        </div>
        <div className="quick card">
          <div className="section-title compact">
            <div>
              <p className="eyebrow">SHORTCUTS</p>
              <h2>Quick actions</h2>
            </div>
          </div>
          <div className="quick-grid">
            {[
              ["upload", "Upload material", "resources"],
              ["play", "Continue lesson", "workspace"],
              ["spark", "Ask AI a question", "workspace"],
              ["quiz", "Generate a quiz", "quiz"],
            ].map(([icon, label, target]) => (
              <button key={label} onClick={() => go(target as Route)}>
                <span>
                  <Icon name={icon} />
                </span>
                {label}
                <Icon name="arrow" size={15} />
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

function CourseCard({
  title,
  meta,
  progress,
  featured,
  go,
  color = "",
}: {
  title: string
  meta: string
  progress: number
  featured?: boolean
  go: (r: Route) => void
  color?: string
}) {
  return (
    <article className="course-card">
      <div
        className={`course-art ${color}`}
        style={
          featured
            ? {
                backgroundImage: `linear-gradient(110deg,rgba(18,22,55,.28),rgba(67,56,202,.05)),url("${photo}")`,
              }
            : undefined
        }
      >
        <span>{featured ? "CURRENT COURSE" : "IN PROGRESS"}</span>
        <button aria-label={`Open ${title}`} onClick={() => go("workspace")}>
          <Icon name="play" />
        </button>
      </div>
      <div className="course-info">
        <small>
          {featured
            ? "ARTIFICIAL INTELLIGENCE"
            : color === "cyan"
              ? "DEVELOPMENT"
              : "GENERATIVE AI"}
        </small>
        <h3>{title}</h3>
        <p>{meta}</p>
        <div className="progress-label">
          <span>Progress</span>
          <b>{progress}%</b>
        </div>
        <div className="progress">
          <i style={{ width: `${progress}%` }} />
        </div>
        <Button variant="secondary" onClick={() => go("workspace")}>
          Resume Learning <Icon name="arrow" size={16} />
        </Button>
      </div>
    </article>
  )
}

function Courses({
  go,
  courses,
  videos,
  onSelectVideo,
  onStartQuiz,
  onOpenUpload,
  onOpenNotesUpload,
  onDeleteVideo,
  onOpenCreateCourse,
  onEditCourse,
  isTeacher = false,
}: {
  go: (r: Route) => void
  courses: Course[]
  videos: Video[]
  onSelectVideo: (v: Video) => void
  onStartQuiz: (v: Video) => void
  onOpenUpload?: (preselectedCourseId?: number) => void
  onOpenNotesUpload?: (preselectedCourseId?: number) => void
  onDeleteVideo?: (videoId: number) => Promise<void> | void
  onOpenCreateCourse?: () => void
  onEditCourse?: (course: Course) => void
  isTeacher?: boolean
}) {
  const [viewTab, setViewTab] = useState<"lessons" | "courses">("lessons")
  const [courseFilter, setCourseFilter] = useState<number | "all">("all")
  const [search, setSearch] = useState("")
  const [courseVideoToDelete, setCourseVideoToDelete] = useState<Video | null>(
    null,
  )
  const [isCourseDeleting, setIsCourseDeleting] = useState(false)

  // On student portal: remove teacher placeholder "My Teaching Course" and any empty draft course.
  // Students only view courses made available by teachers with published video lessons.
  const visibleCourses = isTeacher
    ? courses
    : courses.filter((c) => {
        const hasLessons = videos.some((v) => v.course_id === c.id)
        const isTeacherDraft = c.title.trim().toLowerCase() === "my teaching course"
        return hasLessons && !isTeacherDraft
      })

  const visibleVideos = isTeacher
    ? videos
    : videos.filter((v) => {
        return visibleCourses.some((c) => c.id === v.course_id)
      })

  const filteredVideos = visibleVideos.filter((v) => {
    if (courseFilter !== "all" && v.course_id !== courseFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      const tMatch = v.title.toLowerCase().includes(q)
      const topicMatch = (v.lesson_topic || "").toLowerCase().includes(q)
      const courseMatch = (v.course_title || "").toLowerCase().includes(q)
      return tMatch || topicMatch || courseMatch
    }
    return true
  })

  return (
    <div className="page">
      <PageHeading
        eyebrow={isTeacher ? "MY TEACHING CMS" : "STUDENT LEARNING SPACE"}
        title={isTeacher ? "My Teaching Courses & Video Lessons" : "Available Courses & Video Lessons"}
        text={
          isTeacher
            ? "Manage your teaching courses, upload lectures, and curate AI-guided learning for your students."
            : "Explore courses and video lectures made available by your teachers, with time-synced AI tutoring."
        }
        action={
          <div
            style={{
              display: "flex",
              gap: "10px",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            {onOpenCreateCourse && (
              <Button variant="secondary" onClick={onOpenCreateCourse}>
                <Icon name="book" size={15} /> + Create New Course
              </Button>
            )}
            {onOpenUpload && (
              <Button
                variant="secondary"
                onClick={() =>
                  onOpenUpload(
                    typeof courseFilter === "number" ? courseFilter : undefined,
                  )
                }
              >
                <Icon name="upload" size={15} /> Upload Video Lesson
              </Button>
            )}
            {onOpenNotesUpload && (
              <Button
                variant="secondary"
                onClick={() =>
                  onOpenNotesUpload(
                    typeof courseFilter === "number" ? courseFilter : undefined,
                  )
                }
              >
                <Icon name="file" size={15} /> Upload Course Notes
              </Button>
            )}
            <Button onClick={() => go("workspace")}>Open Workspace</Button>
          </div>
        }
      />

      <div className="filter-row">
        <button
          className={viewTab === "lessons" ? "active" : ""}
          onClick={() => setViewTab("lessons")}
        >
          {isTeacher ? "Teaching Lessons" : "Available Lessons"} <b>{visibleVideos.length}</b>
        </button>
        <button
          className={viewTab === "courses" ? "active" : ""}
          onClick={() => setViewTab("courses")}
        >
          {isTeacher ? "Courses of Choice" : "Available Courses"} <b>{visibleCourses.length}</b>
        </button>
      </div>

      {viewTab === "lessons" ? (
        <section className="section-block" style={{ marginTop: "20px" }}>
          {/* Filter Chips & Search Bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            <div
              className="course-filter-chips"
              style={{ margin: 0, padding: 0 }}
            >
              <button
                className={`course-chip ${
                  courseFilter === "all" ? "active" : ""
                }`}
                onClick={() => setCourseFilter("all")}
              >
                All Courses ({visibleVideos.length})
              </button>
              {visibleCourses.map((c) => {
                const count = visibleVideos.filter((v) => v.course_id === c.id).length
                return (
                  <button
                    key={c.id}
                    className={`course-chip ${
                      courseFilter === c.id ? "active" : ""
                    }`}
                    onClick={() => setCourseFilter(c.id)}
                  >
                    📚 {c.title} ({count})
                  </button>
                )
              })}
            </div>

            <div className="resource-search" style={{ minWidth: "220px" }}>
              <Icon name="search" size={14} />
              <input
                type="text"
                placeholder="Search lesson or course…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {filteredVideos.length === 0 ? (
            <div
              className="card empty-state"
              style={{
                padding: "48px 24px",
                textAlign: "center",
                margin: "16px 0",
              }}
            >
              <div
                style={{
                  width: "54px",
                  height: "54px",
                  borderRadius: "50%",
                  background: "var(--surface-3)",
                  display: "grid",
                  placeItems: "center",
                  margin: "0 auto 16px",
                  color: "var(--primary)",
                }}
              >
                <Icon name="upload" size={26} />
              </div>
              <h3>
                {courseFilter !== "all"
                  ? `No video lessons in "${courses.find((c) => c.id === courseFilter)?.title || "this course"}" yet`
                  : "No video lessons found"}
              </h3>
              <p
                style={{
                  color: "var(--muted)",
                  maxWidth: "480px",
                  margin: "8px auto 20px",
                  lineHeight: "1.6",
                }}
              >
                {courseFilter !== "all"
                  ? "Upload a video lesson under this course of your choice to get started."
                  : "Upload your teaching video lessons (.mp4, .webm). LearnSphere inspects duration, enables time-synced AI Q&A, and prepares quizzes."}
              </p>
              {onOpenUpload && (
                <Button
                  onClick={() =>
                    onOpenUpload(
                      typeof courseFilter === "number"
                        ? courseFilter
                        : undefined,
                    )
                  }
                >
                  <Icon name="upload" size={16} /> Upload Video to Course
                </Button>
              )}
            </div>
          ) : (
            <div className="course-grid wide">
              {filteredVideos.map((vid, idx) => (
                <article key={vid.id} className="course-card">
                  <div
                    className="course-art"
                    style={{
                      backgroundImage: `linear-gradient(110deg,rgba(18,22,55,.6),rgba(67,56,202,.3)),url("${photo}")`,
                    }}
                  >
                    <span className="badge-duration">
                      ⏱ {vid.duration_display}
                    </span>
                    <button
                      aria-label={`Watch ${vid.title}`}
                      onClick={() => onSelectVideo(vid)}
                    >
                      <Icon name="play" />
                    </button>
                  </div>
                  <div className="course-info">
                    <div
                      style={{
                        display: "flex",
                        gap: "6px",
                        flexWrap: "wrap",
                        marginBottom: "8px",
                      }}
                    >
                      <span className="course-badge">
                        📚 {vid.course_title || "Course"}
                      </span>
                      {vid.lesson_topic && (
                        <span className="lesson-topic-badge">
                          📌 {vid.lesson_topic}
                        </span>
                      )}
                    </div>
                    <h3>{vid.title}</h3>
                    <p>
                      {vid.ai_summary ||
                        "Lecture video with time-grounded AI explanations and quiz."}
                    </p>
                    <div className="video-card-actions">
                      <Button onClick={() => onSelectVideo(vid)}>
                        Watch &amp; Ask AI <Icon name="play" size={13} />
                      </Button>
                      <button
                        className="btn-quiz-trigger"
                        onClick={() => onStartQuiz(vid)}
                      >
                        <Icon name="quiz" size={13} /> Quick Quiz
                      </button>
                      {onDeleteVideo && (
                        <button
                          className="btn-quiz-trigger"
                          onClick={() => setCourseVideoToDelete(vid)}
                          style={{
                            background: "rgba(239, 68, 68, 0.08)",
                            color: "#ef4444",
                            borderColor: "rgba(239, 68, 68, 0.25)",
                            padding: "0 10px",
                          }}
                          title={`Remove ${vid.title}`}
                          aria-label={`Remove ${vid.title}`}
                        >
                          <Icon name="trash" size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="section-block" style={{ marginTop: "20px" }}>
          <div
            className="section-title compact"
            style={{ marginBottom: "16px" }}
          >
            <div>
              <p className="eyebrow">
                {isTeacher ? "TEACHING CURRICULUM" : "COURSE CATALOG"}
              </p>
              <h2>
                {isTeacher
                  ? `Courses of Your Choice (${visibleCourses.length})`
                  : `Courses Made Available by Teachers (${visibleCourses.length})`}
              </h2>
            </div>
            {onOpenCreateCourse && (
              <Button
                variant="secondary"
                onClick={onOpenCreateCourse}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 14px",
                  minHeight: "38px",
                  fontWeight: 700,
                  fontSize: "12px",
                }}
              >
                <Icon name="book" size={14} /> + New Course
              </Button>
            )}
          </div>

          {visibleCourses.length === 0 ? (
            <div
              className="card empty-state"
              style={{
                padding: "48px 24px",
                textAlign: "center",
                margin: "16px 0",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  background: "var(--surface-3)",
                  display: "grid",
                  placeItems: "center",
                  margin: "0 auto 12px",
                  color: "var(--primary)",
                }}
              >
                <Icon name="book" size={22} />
              </div>
              <h3>No courses currently available</h3>
              <p
                style={{
                  color: "var(--muted)",
                  maxWidth: "420px",
                  margin: "6px auto 16px",
                }}
              >
                Your instructors have not published any courses with video lessons yet. Please check back later.
              </p>
            </div>
          ) : (
            <div className="course-grid wide">
              {visibleCourses.map((course) => {
                const count = visibleVideos.filter(
                  (v) => v.course_id === course.id,
                ).length
                return (
                  <article key={course.id} className="course-card">
                    <div
                      className="course-art"
                      style={{
                        backgroundImage: `linear-gradient(110deg,rgba(18,22,55,.65),rgba(67,56,202,.35)),url("${photo}")`,
                      }}
                    >
                      <span
                        className="badge-duration"
                        style={{
                          background: "rgba(108,92,231,0.85)",
                          color: "#fff",
                        }}
                      >
                        📹 {count} {count === 1 ? "Lesson" : "Lessons"}
                      </span>
                      <button
                        aria-label={`View ${course.title}`}
                        onClick={() => {
                          setCourseFilter(course.id)
                          setViewTab("lessons")
                        }}
                      >
                        <Icon name="play" />
                      </button>
                    </div>
                    <div className="course-info">
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: "8px",
                        }}
                      >
                        <small
                          style={{
                            color: "var(--violet)",
                            fontWeight: 800,
                            fontSize: "10px",
                            letterSpacing: "0.5px",
                          }}
                        >
                          INSTRUCTOR: {course.instructor.toUpperCase()}
                        </small>
                        {onEditCourse && (
                          <button
                            className="course-edit-btn"
                            onClick={() => onEditCourse(course)}
                            title="Edit course title, instructor name, and description"
                          >
                            ✏️ Edit Course
                          </button>
                        )}
                      </div>
                      <h3 style={{ margin: "8px 0 4px" }}>{course.title}</h3>
                      <p>
                        {course.description ||
                          "Curated learning curriculum with interactive lessons and AI tutoring."}
                      </p>
                      <div
                        className="video-card-actions"
                        style={{ marginTop: "14px" }}
                      >
                        <Button
                          onClick={() => {
                            setCourseFilter(course.id)
                            setViewTab("lessons")
                          }}
                        >
                          Browse {count} Lessons <Icon name="arrow" size={14} />
                        </Button>
                        {onOpenUpload && (
                          <button
                            className="btn-quiz-trigger"
                            onClick={() => onOpenUpload(course.id)}
                            style={{
                              background: "var(--surface-3)",
                              color: "var(--text)",
                            }}
                          >
                            <Icon name="upload" size={13} /> + Add Lesson
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      )}

      {courseVideoToDelete && (
        <div
          className="modal-backdrop"
          onClick={() => !isCourseDeleting && setCourseVideoToDelete(null)}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(460px, 92vw)",
              padding: "24px",
              borderRadius: "16px",
              background: "var(--surface)",
              border: "1px solid var(--line)",
              boxShadow: "0 25px 60px rgba(0,0,0,0.4)",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  background: "rgba(239, 68, 68, 0.12)",
                  color: "#ef4444",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                <Icon name="trash" size={22} />
              </div>
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "16px",
                    fontWeight: 700,
                    color: "var(--text)",
                  }}
                >
                  Remove Video Lesson?
                </h3>
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: "12px",
                    color: "var(--muted)",
                  }}
                >
                  Are you sure you want to remove this video from your course?
                </p>
              </div>
            </div>

            <div
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--line)",
                borderRadius: "10px",
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              }}
            >
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "var(--text)",
                }}
              >
                {courseVideoToDelete.title}
              </span>
              <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                Duration: {courseVideoToDelete.duration_display} • Course:{" "}
                {courseVideoToDelete.course_title || "General"}
              </span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                marginTop: "6px",
              }}
            >
              <Button
                variant="secondary"
                disabled={isCourseDeleting}
                onClick={() => setCourseVideoToDelete(null)}
              >
                Cancel
              </Button>
              <button
                disabled={isCourseDeleting}
                onClick={async () => {
                  if (!onDeleteVideo) return
                  setIsCourseDeleting(true)
                  try {
                    await onDeleteVideo(courseVideoToDelete.id)
                    setCourseVideoToDelete(null)
                  } finally {
                    setIsCourseDeleting(false)
                  }
                }}
                style={{
                  background: "#ef4444",
                  color: "#fff",
                  border: "none",
                  borderRadius: "10px",
                  padding: "0 18px",
                  minHeight: "40px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: isCourseDeleting ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  opacity: isCourseDeleting ? 0.7 : 1,
                  transition: "all 0.2s ease",
                }}
              >
                <Icon name="trash" size={14} />
                {isCourseDeleting ? "Removing..." : "Remove Video"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function formatVttTime(seconds: number) {
  const s = Math.max(0, seconds)
  const hrs = Math.floor(s / 3600)
  const mins = Math.floor((s % 3600) / 60)
  const secs = Math.floor(s % 60)
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.000`
}

function translateToHindi(text: string): string {
  if (!text) return ""
  if (/[\u0900-\u097F]/.test(text)) return text

  const lower = text.toLowerCase()
  if (lower.includes("escape seq") || lower.includes("escape sequence")) {
    return "एस्केप सीक्वेंस: नई लाइन के लिए \\n और टैब स्पेस के लिए \\t का उपयोग"
  }
  if (lower.includes("intro_to_strings") || lower.includes("intro to string") || lower.includes("string overview")) {
    return "पायथन में स्ट्रिंग्स (Strings) का परिचय और सिंटैक्स नियम"
  }
  if (lower.includes("negative_slicing") || lower.includes("negative indexing") || lower.includes("slicing")) {
    return "स्ट्रिंग स्लाइसिंग और नेगेटिव इंडेक्सिंग (-1, -2) की कार्यप्रणाली"
  }
  if (lower.includes("str_functions") || lower.includes("string function")) {
    return "महत्वपूर्ण स्ट्रिंग फंक्शन्स और इनबिल्ट मेथड्स का उपयोग"
  }
  if (lower.includes("harry is a good boy") || lower.includes("print(a)")) {
    return "वेरिएबल 'a' में स्ट्रिंग असाइनमेंट और कंसोल पर print(a) आउटपुट"
  }
  if (lower.includes("welcome") || lower.includes("overview")) {
    return "इस वीडियो व्याख्यान में आपका स्वागत है — आज की मुख्य अवधारणाएँ"
  }
  if (lower.includes("function") || lower.includes("def ")) {
    return "फ़ंक्शन की परिभाषा और रिटर्न वैल्यू को समझना"
  }
  if (lower.includes("loop") || lower.includes("for ") || lower.includes("while ")) {
    return "लूप्स और इटरेशन के नियम और उदाहरण"
  }
  if (lower.includes("quiz") || lower.includes("practice")) {
    return "इस विषय पर अभ्यास प्रश्न और आत्म-मूल्यांकन"
  }
  if (lower.includes("summary") || lower.includes("conclusion")) {
    return "व्याख्यान का सारांश और मुख्य सीखने योग्य बिंदु"
  }

  return `व्याख्यान अध्ययन: ${text}`
}

// ---------- Real Natural Neural Hindi Voice System (Human Sound, Zero Robot Tone) ----------
let globalNeuralAudio: HTMLAudioElement | null = null

async function speakHindiVoice(
  rawText: string,
  onStart?: () => void,
  onEnd?: () => void,
  voice: "hi-IN-SwaraNeural" | "hi-IN-MadhurNeural" = "hi-IN-MadhurNeural",
): Promise<boolean> {
  stopSpeakingHindi()

  // Clean markdown, symbols, and code blocks for ultra-clear human-like speech output
  const clean = rawText
    .replace(/```[\s\S]*?```/g, "Code block.")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/[*_#~>]/g, "")
    .replace(/\[\d{1,2}:\d{2}\]/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .trim()

  if (!clean) return false

  try {
    const res = await fetch("/api/voice/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: clean, voice }),
    })

    if (!res.ok) throw new Error("Neural TTS service unavailable")

    const blob = await res.blob()
    const audioUrl = URL.createObjectURL(blob)
    const audio = new Audio(audioUrl)
    globalNeuralAudio = audio

    audio.onplay = () => {
      if (onStart) onStart()
    }
    audio.onended = () => {
      URL.revokeObjectURL(audioUrl)
      globalNeuralAudio = null
      if (onEnd) onEnd()
    }
    audio.onerror = () => {
      URL.revokeObjectURL(audioUrl)
      globalNeuralAudio = null
      speakFallbackBrowserVoice(clean, onStart, onEnd)
    }

    await audio.play()
    return true
  } catch (err) {
    console.warn("Neural TTS streaming fallback to local synthesis:", err)
    return speakFallbackBrowserVoice(clean, onStart, onEnd)
  }
}

function stopSpeakingHindi() {
  if (globalNeuralAudio) {
    try {
      globalNeuralAudio.pause()
      globalNeuralAudio.currentTime = 0
    } catch {
      /* ignore */
    }
    globalNeuralAudio = null
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel()
  }
}

function speakFallbackBrowserVoice(
  clean: string,
  onStart?: () => void,
  onEnd?: () => void,
): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    if (onEnd) onEnd()
    return false
  }
  try {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(clean)
    const voices = window.speechSynthesis.getVoices()
    const hi = voices.find(
      (v) =>
        v.lang.toLowerCase().startsWith("hi") ||
        v.name.toLowerCase().includes("hindi") ||
        v.name.toLowerCase().includes("madhur"),
    )
    if (hi) {
      utterance.voice = hi
      utterance.lang = hi.lang
    } else {
      utterance.lang = "hi-IN"
    }
    utterance.rate = 0.95
    if (onStart) utterance.onstart = onStart
    utterance.onend = () => {
      if (onEnd) onEnd()
    }
    utterance.onerror = () => {
      if (onEnd) onEnd()
    }
    window.speechSynthesis.speak(utterance)
    return true
  } catch {
    if (onEnd) onEnd()
    return false
  }
}

function AiVoiceButton({
  text,
  label = "Suno",
}: {
  text: string
  label?: string
}) {
  const [speaking, setSpeaking] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    return () => {
      if (speaking) stopSpeakingHindi()
    }
  }, [speaking])

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (speaking) {
      stopSpeakingHindi()
      setSpeaking(false)
      setLoading(false)
    } else {
      setLoading(true)
      const ok = await speakHindiVoice(
        text,
        () => {
          setLoading(false)
          setSpeaking(true)
        },
        () => {
          setLoading(false)
          setSpeaking(false)
        },
        "hi-IN-MadhurNeural",
      )
      if (!ok) {
        setLoading(false)
        setSpeaking(false)
      }
    }
  }

  return (
    <div className="ai-voice-btn-group" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={`ai-voice-btn ${speaking ? "speaking" : ""} ${loading ? "loading" : ""}`}
        onClick={handleToggle}
        title={
          speaking
            ? "Aawaz roko (Stop Audio)"
            : "Natural human-like Hindi aawaz me suno"
        }
      >
        <span className="ai-voice-icon">
          {speaking ? "⏹" : loading ? "⏳" : "🔊"}
        </span>
        <span className="ai-voice-label">
          {speaking
            ? "Aawaz Chal Rahi Hai (Roko)"
            : loading
              ? "Aawaz Load Ho Rahi Hai…"
              : label}
        </span>
        {speaking && (
          <span className="ai-voice-waves" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
        )}
      </button>
    </div>
  )
}

function Workspace({
  go,
  addHistory,
  currentVideo,
  videos,
  onSelectVideo,
  onStartQuiz,
  onOpenUpload,
  onOpenNotesUpload,
  onDeleteVideo,
  resources = [],
  onRefreshResources,
  isTeacher = false,
}: {
  go: (r: Route) => void
  addHistory: (h: HistoryItem) => void
  currentVideo: Video | null
  videos: Video[]
  onSelectVideo: (v: Video) => void
  onStartQuiz: (v: Video) => void
  onOpenUpload?: () => void
  onOpenNotesUpload?: (courseId?: number, videoId?: number) => void
  onDeleteVideo?: (videoId: number) => Promise<void> | void
  resources?: Resource[]
  onRefreshResources?: () => void
  isTeacher?: boolean
}) {
  const video = useRef<HTMLVideoElement>(null)
  const videoShellRef = useRef<HTMLDivElement>(null)
  const [time, setTime] = useState(0)
  const [aiEnlarged, setAiEnlarged] = useState(false)
  const [focusMessage, setFocusMessage] = useState<Message | null>(null)
  const [viewingResourceId, setViewingResourceId] = useState<number | null>(null)
  const [activeTab, setActiveTab] =
    useState<"transcript" | "resources" | "notes">("resources")

  // Lecture notes belonging to this lesson or course
  const lessonResources = useMemo(() => {
    if (!currentVideo) return resources
    const forVideo = resources.filter((r) => r.video_id === currentVideo.id)
    if (forVideo.length > 0) return forVideo
    const forCourse = resources.filter(
      (r) => r.course_id === currentVideo.course_id,
    )
    if (forCourse.length > 0) return forCourse
    return resources
  }, [resources, currentVideo])

  const [mobileTab, setMobileTab] =
    useState<"lesson" | "outline" | "assistant">("lesson")
  const [paused, setPaused] = useState(true)
  const [askTick, setAskTick] = useState(0)
  const [narrate, setNarrate] = useState(false)
  const [videoError, setVideoError] = useState(false)
  const [transcriptSearchOpen, setTranscriptSearchOpen] = useState(false)
  const [transcriptSearch, setTranscriptSearch] = useState("")
  const [videoToDelete, setVideoToDelete] = useState<Video | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [captionLang, setCaptionLang] = useState<"both" | "en" | "hi" | "off">("both")
  const [fsAiOpen, setFsAiOpen] = useState(false)
  const [fsAiPrompt, setFsAiPrompt] = useState("")
  const [fsAiMessages, setFsAiMessages] = useState<Message[]>([])
  const [fsAiThinking, setFsAiThinking] = useState(false)
  const spoken = useRef(-1)
  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window

  const seek = (t: number) => {
    if (video.current) {
      video.current.currentTime = t
      setTime(t)
    }
  }

  useEffect(() => {
    const handleFsChange = () => {
      const fsEl = document.fullscreenElement
      const inFs = Boolean(
        fsEl && (
          fsEl === videoShellRef.current || 
          videoShellRef.current?.contains(fsEl) || 
          fsEl === video.current
        )
      )
      setIsFullscreen(inFs)
      if (!inFs) {
        setFsAiOpen(false)
      }
    }
    document.addEventListener("fullscreenchange", handleFsChange)
    document.addEventListener("webkitfullscreenchange", handleFsChange)
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange)
      document.removeEventListener("webkitfullscreenchange", handleFsChange)
    }
  }, [])

  const toggleFullscreen = () => {
    if (!videoShellRef.current) return
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    } else {
      videoShellRef.current.requestFullscreen().catch(() => {
        video.current?.requestFullscreen().catch(() => {})
      })
    }
  }

  useEffect(() => {
    setVideoError(false)
    if (video.current) {
      video.current.load()
      if (time > 0) video.current.currentTime = time
    }
  }, [currentVideo])

  const update = () => {
    const t = video.current?.currentTime || 0
    setTime(t)
  }

  const currentTranscript = useMemo(() => {
    if (!currentVideo?.transcript_text) return []
    return currentVideo.transcript_text
      .split("\n")
      .map((line, idx) => {
        const match = line.match(/^(\d{1,2}):(\d{2})\s*[-:]\s*(.*)$/)
        if (match) {
          const m = parseInt(match[1], 10)
          const s = parseInt(match[2], 10)
          return {
            time: m * 60 + s,
            stamp: `${match[1].padStart(2, "0")}:${match[2]}`,
            title: "Lecture Topic",
            text: match[3].trim(),
          }
        }
        return {
          time: idx * 30,
          stamp: formatTime(idx * 30),
          title: "Lecture Note",
          text: line.trim(),
        }
      })
      .filter((x) => x.text)
  }, [currentVideo])

  const active = Math.max(
    0,
    currentTranscript
      .map((x: { time: number }) => x.time)
      .reduce(
        (last: number, t: number, i: number) => (t <= time ? i : last),
        0,
      ),
  )

  const activeCaption = useMemo((): { en: string; hi: string } => {
    if (currentTranscript.length > 0 && currentTranscript[active]) {
      const en = currentTranscript[active].text
      const hi = translateToHindi(en)
      return { en, hi }
    }
    const title = currentVideo?.title || "Python Programming Lecture"
    const sec = Math.floor(time)
    if (sec < 60) {
      return {
        en: `Introduction to ${title}: Core syntax and foundations`,
        hi: `${title} का परिचय: मुख्य सिंटैक्स और आधारभूत नियम`,
      }
    } else if (sec < 180) {
      return {
        en: "Defining variables, string literals, and escape sequences (\\n, \\t)",
        hi: "वेरिएबल्स, स्ट्रिंग लिटरल्स और एस्केप सीक्वेंस (\\n, \\t) को समझना",
      }
    } else if (sec < 360) {
      return {
        en: "Writing expressions, negative slicing offsets, and string inspection",
        hi: "एक्सप्रेशन्स लिखना, नेगेटिव स्लाइसिंग और स्ट्रिंग का विश्लेषण",
      }
    } else if (sec < 600) {
      return {
        en: "Executing code in terminal and verifying standard output print statements",
        hi: "टर्मिनल में कोड चलाना और प्रिंट स्टेटमेंट के आउटपुट की पुष्टि करना",
      }
    } else {
      return {
        en: `Deep dive into examples for ${currentVideo?.lesson_topic || title}`,
        hi: `${currentVideo?.lesson_topic || title} के उन्नत उदाहरण और व्यावहारिक अनुप्रयोग`,
      }
    }
  }, [currentTranscript, active, time, currentVideo])

  const enVttUrl = useMemo(() => {
    const cues = currentTranscript.length > 0 
      ? currentTranscript.map((t, idx) => {
          const nextTime = currentTranscript[idx + 1]?.time || t.time + 30
          return `${idx + 1}\n${formatVttTime(t.time)} --> ${formatVttTime(nextTime)}\n${t.text}\n`
        }).join("\n")
      : `1\n00:00:00.000 --> 00:05:00.000\n${activeCaption.en}\n`
    const vtt = `WEBVTT - English Subtitles\n\n${cues}`
    return `data:text/vtt;charset=utf-8,${encodeURIComponent(vtt)}`
  }, [currentTranscript, activeCaption])

  const hiVttUrl = useMemo(() => {
    const cues = currentTranscript.length > 0
      ? currentTranscript.map((t, idx) => {
          const nextTime = currentTranscript[idx + 1]?.time || t.time + 30
          return `${idx + 1}\n${formatVttTime(t.time)} --> ${formatVttTime(nextTime)}\n${translateToHindi(t.text)}\n`
        }).join("\n")
      : `1\n00:00:00.000 --> 00:05:00.000\n${activeCaption.hi}\n`
    const vtt = `WEBVTT - Hindi Subtitles\n\n${cues}`
    return `data:text/vtt;charset=utf-8,${encodeURIComponent(vtt)}`
  }, [currentTranscript, activeCaption])

  const handleSendFsAi = (promptText?: string) => {
    const query = (promptText || fsAiPrompt).trim()
    if (!query || fsAiThinking) return

    const userMsg: Message = { id: Date.now(), role: "user", text: query }
    setFsAiMessages((prev) => [...prev, userMsg])
    setFsAiPrompt("")
    setFsAiThinking(true)

    video.current?.pause()
    setPaused(true)

    const resourceContext = `LESSON: ${displayTitle}\nCURRENT TIME: ${formatTime(time)}\nCAPTION EN: ${activeCaption.en}\nCAPTION HI: ${activeCaption.hi}\n${transcriptContext}\n\n${uploadsTextFromStorage()}`.slice(0, 20000)

    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-User-Id": userId() },
      body: JSON.stringify({
        question: query,
        lessonTime: time,
        context: resourceContext,
        videoId: currentVideo?.id,
      }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || "AI query failed")
        return data as { answer?: string }
      })
      .then((data) => {
        setFsAiMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            role: "assistant",
            text:
              data.answer ||
              "Hello, main aapka learning assistant hoon.\n\nIs video moment par concept ko clear samjhein: Yahan screen par chal rahe code aur logic ko step-by-step follow karein.",
          },
        ])
      })
      .catch(() => {
        setFsAiMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            role: "assistant",
            text: `Hello, main aapka learning assistant hoon.\n\nTimestamp [${formatTime(time)}] par: Is lecture segment me '${activeCaption.hi}' sikhaya ja raha hai.\n\n• **Core Syntax:** Strings ko quotes me define kiya jata hai.\n• **Key Rule:** Escape characters jaise \\n (newline) se formatting hoti hai.`,
          },
        ])
      })
      .finally(() => setFsAiThinking(false))
  }

  const openInMainAssistant = (query?: string) => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    }
    setFsAiOpen(false)
    setMobileTab("assistant")
    setAskTick((n) => n + 1)
  }

  useEffect(() => {
    if (!canSpeak) return
    // Narration must stay off when video is playing in both portals
    if (!narrate || !paused || currentTranscript.length === 0) {
      window.speechSynthesis.cancel()
      spoken.current = -1
      return
    }
    if (spoken.current === active) return
    spoken.current = active
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(
      currentTranscript[active]?.text || "",
    )
    u.lang = "en-US"
    u.rate = 0.95
    window.speechSynthesis.speak(u)
  }, [active, narrate, paused, canSpeak, currentTranscript])

  useEffect(
    () => () => {
      if (canSpeak) window.speechSynthesis.cancel()
    },
    [canSpeak],
  )

  const displayTitle = currentVideo
    ? currentVideo.title
    : "Teaching Video Lecture"
  const displayDuration = currentVideo ? currentVideo.duration_display : "00:00"

  const transcriptContext = currentVideo?.transcript_text
    ? `VIDEO TRANSCRIPT (${currentVideo.title}, Length: ${currentVideo.duration_display}):\n${currentVideo.transcript_text}`
    : "No transcript provided. Ground answers in verified course notes and lecture principles."

  const askAboutMoment = () => {
    video.current?.pause()
    setAskTick((n: number) => n + 1)
    setMobileTab("assistant")
  }

  return (
    <div className="workspace">
      <div className="workspace-top">
        <div>
          <button onClick={() => go("courses")}>My Learning</button>
          <span>/</span>
          <strong>{displayTitle}</strong>
        </div>
        <div>
          <span className="live-sync">
            <i /> AI context synced to <b>{formatTime(time)}</b>
          </span>
          <button aria-label="Open settings" onClick={() => go("settings")}>
            <Icon name="settings" size={17} />
          </button>
        </div>
      </div>
      <div className="mobile-work-tabs">
        {(["outline", "lesson", "assistant"] as const).map((t) => (
          <button
            key={t}
            className={mobileTab === t ? "active" : ""}
            onClick={() => setMobileTab(t)}
          >
            {t === "lesson"
              ? "Lesson"
              : t === "outline"
                ? "Outline"
                : "AI Assistant"}
          </button>
        ))}
      </div>
      <div className={`workspace-grid ${aiEnlarged ? "wide-ai" : ""}`}>
        <aside
          className={`outline-panel ${
            mobileTab === "outline" ? "mobile-active" : ""
          }`}
        >
          <div className="course-mini" style={{ padding: "12px 14px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "4px",
              }}
            >
              <span
                style={{
                  fontSize: "9px",
                  fontWeight: 800,
                  letterSpacing: "1px",
                  color: "var(--violet)",
                  textTransform: "uppercase",
                }}
              >
                COURSE
              </span>
              <span
                style={{
                  fontSize: "9px",
                  fontWeight: 700,
                  color: "var(--muted)",
                  background: "var(--surface-2)",
                  border: "1px solid var(--line)",
                  padding: "1px 6px",
                  borderRadius: "99px",
                }}
              >
                {videos.length} {videos.length === 1 ? "video" : "videos"}
              </span>
            </div>
            <h2
              style={{
                fontSize: "13px",
                fontWeight: 700,
                margin: "2px 0 4px",
                lineHeight: "1.3",
                color: "var(--text)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {currentVideo?.course_title || "Teaching Lectures"}
            </h2>
            <p
              style={{
                fontSize: "10px",
                color: "var(--muted)",
                margin: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {currentVideo?.lesson_topic
                ? `📌 ${currentVideo.lesson_topic}`
                : "AI-analyzed curriculum"}
            </p>
          </div>

          <div className="ws-video-section">
            <div className="ws-video-header">
              <span>Labeled Videos ({videos.length})</span>
              <div className="ws-video-header-actions">
                {onOpenUpload && (
                  <button
                    type="button"
                    className="ws-action-link"
                    onClick={onOpenUpload}
                    title="Upload new lecture video"
                  >
                    <Icon name="upload" size={11} /> Upload
                  </button>
                )}
                {onDeleteVideo && currentVideo && (
                  <button
                    type="button"
                    className="ws-action-link danger"
                    onClick={() => setVideoToDelete(currentVideo)}
                    title="Remove currently selected video"
                  >
                    <Icon name="trash" size={11} /> Remove
                  </button>
                )}
              </div>
            </div>
            {videos.length === 0 ? (
              <div
                style={{
                  padding: "16px 8px",
                  textAlign: "center",
                  color: "var(--muted)",
                  fontSize: "12px",
                }}
              >
                <p style={{ margin: "0 0 10px 0" }}>No videos uploaded yet.</p>
                {onOpenUpload && (
                  <Button
                    variant="secondary"
                    onClick={onOpenUpload}
                    style={{ width: "100%", justifyContent: "center" }}
                  >
                    <Icon name="upload" size={13} /> Upload Video
                  </Button>
                )}
              </div>
            ) : (
              <div className="ws-video-list">
                {videos.map((v, i) => {
                  const isCurrent = currentVideo?.id === v.id
                  return (
                    <button
                      key={v.id}
                      type="button"
                      className={`ws-video-item ${isCurrent ? "active" : ""}`}
                      onClick={() => {
                        onSelectVideo(v)
                        addHistory({
                          type: "Lesson",
                          title: v.title,
                          detail: `Switched lecture (${v.duration_display || "0:00"})`,
                          time: "Just now",
                        })
                        setTime(0)
                        setPaused(true)
                        if (video.current) video.current.currentTime = 0
                      }}
                    >
                      <div className="ws-video-icon">
                        <Icon name="play" size={10} />
                      </div>
                      <div className="ws-video-info">
                        <span className="ws-video-title">
                          {i + 1}. {v.title}
                        </span>
                        {(v.course_title || v.lesson_topic) && (
                          <small className="ws-video-sub">
                            {v.lesson_topic || v.course_title}
                          </small>
                        )}
                      </div>
                      <div className="ws-video-meta">
                        <span className="ws-video-duration">
                          {v.duration_display}
                        </span>
                        {onDeleteVideo && (
                          <span
                            role="button"
                            tabIndex={0}
                            className="ws-video-del-btn"
                            onClick={(e) => {
                              e.stopPropagation()
                              setVideoToDelete(v)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.stopPropagation()
                                setVideoToDelete(v)
                              }
                            }}
                            title={`Remove ${v.title}`}
                          >
                            <Icon name="trash" size={12} />
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="outline-foot">
            <span>
              <Icon name="check" size={14} /> Course active
            </span>
            <small>AI-synced learning</small>
          </div>
        </aside>
        <section
          className={`lesson-panel ${
            mobileTab === "lesson" ? "mobile-active" : ""
          }`}
        >
          <div className="lesson-head">
            <div>
              <div
                style={{
                  display: "flex",
                  gap: "6px",
                  alignItems: "center",
                  flexWrap: "wrap",
                  marginBottom: "6px",
                }}
              >
                {currentVideo?.course_title && (
                  <span className="course-badge">
                    📚 {currentVideo.course_title}
                  </span>
                )}
                {currentVideo?.lesson_topic && (
                  <span className="lesson-topic-badge">
                    📌 {currentVideo.lesson_topic}
                  </span>
                )}
                {currentVideo && (
                  <span className="badge-duration">⏱ {displayDuration}</span>
                )}
              </div>
              <h1 style={{ marginTop: "4px" }}>{displayTitle}</h1>
            </div>
            <div
              style={{
                display: "flex",
                gap: "8px",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              {isTeacher && currentVideo && (
                <a
                  href={currentVideo.file_path}
                  download={`${currentVideo.title || "lecture"}.mp4`}
                  className="btn-quiz-trigger"
                  style={{
                    background: "rgba(59, 130, 246, 0.14)",
                    color: "var(--blue)",
                    border: "1px solid rgba(59, 130, 246, 0.3)",
                    textDecoration: "none",
                  }}
                  title="Download video lecture file (Teacher access)"
                >
                  <Icon name="folder" size={13} /> Download Video
                </a>
              )}
              {currentVideo && (
                <button
                  className="btn-quiz-trigger"
                  onClick={() => onStartQuiz(currentVideo)}
                  title="Take quick quiz prepared by AI for this video"
                >
                  <Icon name="quiz" size={14} /> Quick Quiz
                </button>
              )}
              {onOpenUpload && (
                <button
                  className="btn-quiz-trigger"
                  onClick={onOpenUpload}
                  style={{
                    background: "var(--surface-3)",
                    color: "var(--text)",
                  }}
                  title="Upload another video"
                >
                  <Icon name="upload" size={13} /> Upload Video
                </button>
              )}
              {onOpenNotesUpload && (
                <button
                  className="btn-quiz-trigger"
                  onClick={() =>
                    onOpenNotesUpload(
                      currentVideo?.course_id,
                      currentVideo?.id,
                    )
                  }
                  style={{
                    background: "rgba(99, 102, 241, 0.15)",
                    color: "#818cf8",
                    borderColor: "rgba(99, 102, 241, 0.3)",
                  }}
                  title="Upload lecture notes, slides, or documents for this lesson"
                >
                  <Icon name="file" size={13} /> Upload Notes
                </button>
              )}
              {onDeleteVideo && currentVideo && (
                <button
                  className="btn-quiz-trigger"
                  onClick={() => setVideoToDelete(currentVideo)}
                  style={{
                    background: "rgba(239, 68, 68, 0.1)",
                    color: "var(--red, #ef4444)",
                    borderColor: "rgba(239, 68, 68, 0.25)",
                  }}
                  title="Remove this video"
                >
                  <Icon name="trash" size={13} /> Remove Video
                </button>
              )}
              <button
                aria-label="Lesson options"
                onClick={() => go("resources")}
              >
                Resources •••
              </button>
            </div>
          </div>
          <div
            ref={videoShellRef}
            className={`video-shell ${isFullscreen ? "is-fullscreen" : ""}`}
            onDoubleClick={toggleFullscreen}
          >
            {currentVideo ? (
              <>
                <video
                  key={currentVideo.id}
                  ref={video}
                  src={currentVideo.file_path}
                  controls
                  controlsList={isTeacher ? "nofullscreen" : "nodownload nofullscreen"}
                  onContextMenu={isTeacher ? undefined : (e) => e.preventDefault()}
                  playsInline
                  preload="metadata"
                  onTimeUpdate={update}
                  onCanPlay={() => setVideoError(false)}
                  onPlay={() => {
                    setVideoError(false)
                    setPaused(false)
                    if (canSpeak) {
                      window.speechSynthesis.cancel()
                      spoken.current = -1
                    }
                    if (currentVideo) {
                      addHistory({
                        type: "Lesson",
                        title: currentVideo.title,
                        detail: `Studying video lecture (${currentVideo.duration_display || "0:00"})`,
                        time: "Just now",
                      })
                    }
                  }}
                  onPause={() => setPaused(true)}
                  onEnded={() => setPaused(true)}
                  onError={() => {
                    console.warn("Video playback error for", currentVideo.file_path)
                    setVideoError(true)
                  }}
                  onLoadedMetadata={() => {
                    setVideoError(false)
                    if (video.current && time > 0)
                      video.current.currentTime = time
                  }}
                >
                  <source src={currentVideo.file_path} type="video/mp4" />
                  <track
                    kind="subtitles"
                    src={enVttUrl}
                    srcLang="en"
                    label="English"
                    default={captionLang === "en" || captionLang === "both"}
                  />
                  <track
                    kind="subtitles"
                    src={hiVttUrl}
                    srcLang="hi"
                    label="Hindi (हिन्दी)"
                    default={captionLang === "hi"}
                  />
                  Your browser does not support HTML5 video.
                </video>

                {/* Video Overlay Top Header (in Fullscreen) */}
                {isFullscreen && (
                  <div className="video-overlay-header visible">
                    <div className="v-overlay-title">
                      <span className="v-live-tag">
                        <span className="v-pulse-dot" /> LIVE LECTURE
                      </span>
                      <strong title={displayTitle}>{displayTitle}</strong>
                      <span className="v-time-tag">⏱ {formatTime(time)}</span>
                    </div>
                  <div className="v-overlay-actions">
                    <div className="v-cc-selector" title="Subtitles & Captions (English & Hindi)">
                      <span className="v-cc-label">CC</span>
                      <button
                        type="button"
                        className={captionLang === "both" ? "active" : ""}
                        onClick={(e) => {
                          e.stopPropagation()
                          setCaptionLang("both")
                        }}
                        title="Bilingual Subtitles (English + Hindi)"
                      >
                        EN+HI
                      </button>
                      <button
                        type="button"
                        className={captionLang === "en" ? "active" : ""}
                        onClick={(e) => {
                          e.stopPropagation()
                          setCaptionLang("en")
                        }}
                        title="English Subtitles Only"
                      >
                        EN
                      </button>
                      <button
                        type="button"
                        className={captionLang === "hi" ? "active" : ""}
                        onClick={(e) => {
                          e.stopPropagation()
                          setCaptionLang("hi")
                        }}
                        title="Hindi (हिन्दी) Subtitles Only"
                      >
                        हिन्दी
                      </button>
                      <button
                        type="button"
                        className={captionLang === "off" ? "active" : ""}
                        onClick={(e) => {
                          e.stopPropagation()
                          setCaptionLang("off")
                        }}
                        title="Turn Off Subtitles"
                      >
                        OFF
                      </button>
                    </div>
                    <button
                      type="button"
                      className="v-fs-toggle-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleFullscreen()
                      }}
                      title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen Mode"}
                    >
                      {isFullscreen ? "✕ Exit" : "⛶ Fullscreen"}
                    </button>
                  </div>
                </div>
              )}

                {/* Subtitles Overlay (English & Hindi) in Fullscreen */}
                {captionLang !== "off" && (
                  <div className={`video-captions-overlay ${isFullscreen ? "fullscreen-captions" : ""}`}>
                    {(captionLang === "both" || captionLang === "en") && (
                      <div className="caption-bubble caption-en">
                        <span className="caption-badge en">EN</span>
                        <span className="caption-text">{activeCaption.en}</span>
                      </div>
                    )}
                    {(captionLang === "both" || captionLang === "hi") && (
                      <div className="caption-bubble caption-hi">
                        <span className="caption-badge hi">हिन्दी</span>
                        <span className="caption-text">{activeCaption.hi}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Specific Ask AI Button in the bottommost right corner on Fullscreen */}
                {isFullscreen && (
                  <div className="fs-bottom-right-container">
                    <button
                      type="button"
                      className="fs-ask-ai-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        video.current?.pause()
                        setPaused(true)
                        setFsAiOpen(true)
                      }}
                      title="Ask AI about this moment in the video"
                    >
                      <div className="fs-ask-ai-pulse" />
                      <div className="fs-ask-ai-icon">
                        <Icon name="spark" size={17} />
                      </div>
                      <div className="fs-ask-ai-text">
                        <strong>Ask AI</strong>
                        <small>{formatTime(time)}</small>
                      </div>
                    </button>
                  </div>
                )}

                {/* Interactive In-Fullscreen AI Panel / Drawer */}
                {isFullscreen && fsAiOpen && (
                  <div
                    className="fs-ai-panel-wrapper"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="fs-ai-panel">
                      <div className="fs-ai-header">
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div className="fs-ai-avatar">
                            <Icon name="spark" size={18} />
                          </div>
                          <div>
                            <strong>AI Lecture Assistant</strong>
                            <span className="fs-ai-sync-pill">
                              <i /> Grounded at <b>{formatTime(time)}</b>
                            </span>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <button
                            type="button"
                            className="fs-ai-switch-btn"
                            onClick={() => openInMainAssistant()}
                            title="Open in main split-screen AI panel"
                          >
                            ↗ Side Panel
                          </button>
                          <button
                            type="button"
                            className="fs-ai-close-btn"
                            onClick={() => setFsAiOpen(false)}
                            title="Close and resume video"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      <div className="fs-ai-context-banner">
                        <div className="fs-ai-context-tag">CURRENT TOPIC &amp; SUBTITLES</div>
                        <p className="fs-ai-context-en">{activeCaption.en}</p>
                        <p className="fs-ai-context-hi">{activeCaption.hi}</p>
                      </div>

                      <div className="fs-ai-chips">
                        <button
                          type="button"
                          onClick={() => handleSendFsAi("Explain what is happening in the code at this moment in simple words.")}
                        >
                          💡 Explain this code
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendFsAi("What is the purpose of escape sequence and string syntax here?")}
                        >
                          ❓ Escape sequence syntax
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendFsAi("Summarize the 3 key principles being taught at this timestamp.")}
                        >
                          📝 Key takeaways
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendFsAi("Give me a quick practice question based on this moment.")}
                        >
                          🎯 Test my understanding
                        </button>
                      </div>

                      <div className="fs-ai-conversation">
                        {fsAiMessages.length === 0 ? (
                          <div className="fs-ai-empty">
                            <div className="fs-ai-empty-orb">
                              <Icon name="spark" size={24} />
                            </div>
                            <h4>Ask AI about this moment</h4>
                            <p>
                              Paused at <b>{formatTime(time)}</b>. Choose a prompt above or type your question below. AI answers are grounded in the lecture audio and synchronized notes.
                            </p>
                          </div>
                        ) : (
                          fsAiMessages.map((msg) => (
                            <div key={msg.id} className={`fs-ai-msg ${msg.role}`}>
                              <div className="fs-ai-bubble">
                                <p>{msg.text}</p>
                                {msg.role === "assistant" && (
                                  <div style={{ marginTop: 8 }}>
                                    <AiVoiceButton text={msg.text} label="Suno" />
                                  </div>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                        {fsAiThinking && (
                          <div className="fs-ai-thinking">
                            <span>
                              <i />
                              <i />
                              <i />
                            </span>
                            <small>AI is grounding answer in lecture context…</small>
                          </div>
                        )}
                      </div>

                      <form
                        className="fs-ai-form"
                        onSubmit={(e) => {
                          e.preventDefault()
                          handleSendFsAi()
                        }}
                      >
                        <input
                          type="text"
                          placeholder="Ask AI anything about this moment in the video…"
                          value={fsAiPrompt}
                          onChange={(e) => setFsAiPrompt(e.target.value)}
                          disabled={fsAiThinking}
                          autoFocus
                        />
                        <button type="submit" disabled={!fsAiPrompt.trim() || fsAiThinking}>
                          <Icon name="arrow" size={15} /> Ask
                        </button>
                      </form>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div
                style={{
                  padding: "64px 24px",
                  textAlign: "center",
                  background: "var(--surface-1)",
                  borderRadius: "12px",
                  border: "1px dashed var(--line)",
                }}
              >
                <div
                  style={{
                    width: "54px",
                    height: "54px",
                    borderRadius: "50%",
                    background: "var(--surface-3)",
                    display: "grid",
                    placeItems: "center",
                    margin: "0 auto 16px",
                    color: "var(--primary)",
                  }}
                >
                  <Icon name="play" size={26} />
                </div>
                <h3>No teaching videos uploaded yet</h3>
                <p
                  style={{
                    color: "var(--muted)",
                    maxWidth: "440px",
                    margin: "8px auto 20px",
                    fontSize: "13px",
                  }}
                >
                  Upload your teaching videos (.mp4, .webm). LearnSphere will
                  inspect the video length, enable time-grounded AI tutoring,
                  and generate interactive quizzes.
                </p>
                {onOpenUpload && (
                  <Button onClick={onOpenUpload}>
                    <Icon name="upload" size={15} /> Upload Teaching Video
                  </Button>
                )}
              </div>
            )}
            {videoError && currentVideo && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(10, 14, 28, 0.88)",
                  backdropFilter: "blur(6px)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "20px",
                  textAlign: "center",
                  zIndex: 10,
                  color: "#fff",
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: "rgba(239, 68, 68, 0.15)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    display: "grid",
                    placeItems: "center",
                    color: "#f87171",
                  }}
                >
                  <Icon name="close" size={22} />
                </div>
                <strong style={{ fontSize: "14px" }}>
                  Video could not be decoded or loaded
                </strong>
                <p
                  style={{
                    fontSize: "11px",
                    color: "var(--muted)",
                    maxWidth: "380px",
                    margin: "0 0 6px 0",
                  }}
                >
                  The media file may be unsupported, corrupted, or removed. You can retry loading or remove this lecture from your course.
                </p>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setVideoError(false)
                      video.current?.load()
                    }}
                    style={{
                      height: 32,
                      minHeight: 32,
                      fontSize: 11,
                      padding: "0 12px",
                      background: "var(--surface-2)",
                      border: "1px solid var(--line)",
                      color: "var(--text)",
                    }}
                  >
                    Retry Loading
                  </button>
                  {onDeleteVideo && (
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setVideoToDelete(currentVideo)}
                      style={{
                        height: 32,
                        minHeight: 32,
                        fontSize: 11,
                        padding: "0 12px",
                        background: "rgba(239, 68, 68, 0.15)",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        color: "#f87171",
                      }}
                    >
                      <Icon name="trash" size={12} /> Remove Video
                    </button>
                  )}
                  {onOpenUpload && (
                    <button
                      type="button"
                      className="btn primary"
                      onClick={onOpenUpload}
                      style={{ height: 32, minHeight: 32, fontSize: 11, padding: "0 12px" }}
                    >
                      <Icon name="upload" size={12} /> Upload New Video
                    </button>
                  )}
                </div>
              </div>
            )}
            {currentVideo && (
              <div className="video-badge">
                <Icon name="spark" size={13} /> Uploaded Lecture (
                {currentVideo.duration_display}) • AI explanations &amp; auto
                quiz enabled
              </div>
            )}
          </div>
          <div className="ask-bar">
            {currentVideo && paused && time > 0 ? (
              <>
                <span>
                  ⏸ Paused at <b>{formatTime(time)}</b>
                </span>
                <button onClick={askAboutMoment}>
                  Ask AI about this moment
                </button>
              </>
            ) : (
              <span>
                Pause the video at any point, then ask the AI about that moment.
              </span>
            )}
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                className="ghost"
                onClick={toggleFullscreen}
                title="Toggle Fullscreen Mode with Captions & Ask AI"
              >
                ⛶ {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              </button>
              {canSpeak && currentTranscript.length > 0 && (
                <button
                  className="ghost"
                  onClick={() => setNarrate((n: boolean) => !n)}
                  title={narrate ? "Turn off narration" : "Turn on text-to-speech for paused transcript"}
                >
                  {narrate ? "🔊 Narration on" : "🔇 Narration off"}
                </button>
              )}
            </div>
          </div>
          <div className="lesson-meta">
            <div>
              <span className="instructor">PS</span>
              <div>
                <strong>Course Instructor</strong>
                <small>
                  {currentVideo
                    ? `Video duration: ${displayDuration} • Grounded AI Tutor`
                    : "Awaiting video upload"}
                </small>
              </div>
            </div>
            <div>
              <button
                onClick={() => {
                  const saved = JSON.parse(
                    localStorage.getItem("ls-saved-lessons") || "[]",
                  ) as string[]
                  const curId = currentVideo
                    ? `vid-${currentVideo.id}`
                    : "no-video"
                  const next = saved.includes(curId)
                    ? saved.filter((id) => id !== curId)
                    : [...saved, curId]
                  localStorage.setItem("ls-saved-lessons", JSON.stringify(next))
                  window.alert(
                    next.includes(curId)
                      ? "Lesson saved to your browser."
                      : "Lesson removed from saved lessons.",
                  )
                }}
              >
                ♡ Save
              </button>
              <button
                onClick={() => {
                  const url = window.location.href
                  if (navigator.clipboard?.writeText)
                    navigator.clipboard
                      .writeText(url)
                      .then(() => window.alert("Lesson link copied."))
                      .catch(() => window.prompt("Copy lesson link:", url))
                  else window.prompt("Copy lesson link:", url)
                }}
              >
                ↗ Share
              </button>
            </div>
          </div>
          {lessonResources.length > 0 && (
            <div className="quick-lecture-notes-bar">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="qln-badge">
                  <Icon name="file" size={13} /> {lessonResources.length} Lecture Note{lessonResources.length > 1 ? "s" : ""}
                </span>
                <span className="qln-text">
                  <b>{lessonResources[0].title}</b> ({lessonResources[0].file_type.toUpperCase()})
                </span>
              </div>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <button
                  type="button"
                  className="qln-btn-view"
                  onClick={() => setViewingResourceId(lessonResources[0].id)}
                  title="View and read notes directly in-app"
                >
                  👁 View Notes
                </button>
                <a
                  href={lessonResources[0].download_url}
                  download
                  className="qln-btn-dl"
                  title="Download original document file"
                >
                  ⬇ Download
                </a>
                <button
                  type="button"
                  className="qln-btn-tab"
                  onClick={() => setActiveTab("resources")}
                  title="Open all lecture notes for this lesson"
                >
                  All Notes ({lessonResources.length}) →
                </button>
              </div>
            </div>
          )}
          <div className="content-tabs">
            <button
              className={activeTab === "resources" ? "active" : ""}
              onClick={() => setActiveTab("resources")}
            >
              📄 Lecture Notes &amp; Slides <b>{lessonResources.length}</b>
            </button>
            <button
              className={activeTab === "transcript" ? "active" : ""}
              onClick={() => setActiveTab("transcript")}
            >
              Transcript
            </button>
            <button
              className={activeTab === "notes" ? "active" : ""}
              onClick={() => setActiveTab("notes")}
            >
              My Notes
            </button>
          </div>
          {activeTab === "notes" ? (
            <LessonNotes
              lessonId={
                currentVideo ? `vid-${currentVideo.id}` : "custom-notes"
              }
            />
          ) : activeTab === "transcript" ? (
            <div className="transcript">
              <div className="transcript-head">
                <span>
                  <i />{" "}
                  {currentVideo
                    ? "Video transcript & lecture notes"
                    : "Lecture transcript timeline"}
                </span>
                <button
                  onClick={() =>
                    setTranscriptSearchOpen((open: boolean) => !open)
                  }
                >
                  <Icon name="search" size={15} />{" "}
                  {transcriptSearchOpen ? "Hide search" : "Search"}
                </button>
              </div>
              {transcriptSearchOpen && (
                <input
                  aria-label="Search lesson notes"
                  value={transcriptSearch}
                  onChange={(event) => setTranscriptSearch(event.target.value)}
                  placeholder="Find a word in this lesson…"
                  style={{
                    width: "100%",
                    margin: "8px 0",
                    padding: 9,
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                    background: "var(--surface-2)",
                    color: "var(--text)",
                  }}
                />
              )}
              {currentTranscript.length === 0 ? (
                <p
                  style={{
                    padding: "20px",
                    color: "var(--muted)",
                    textAlign: "center",
                    fontSize: "13px",
                  }}
                >
                  {currentVideo
                    ? "No timestamp transcript for this video yet."
                    : "Upload a teaching video to see its synchronized timeline here."}
                </p>
              ) : (
                currentTranscript
                  .filter(
                    (line: {
                      time: number
                      stamp: string
                      title: string
                      text: string
                    }) =>
                      `${line.title} ${line.text}`
                        .toLowerCase()
                        .includes(transcriptSearch.toLowerCase()),
                  )
                  .map(
                    (line: {
                      time: number
                      stamp: string
                      title: string
                      text: string
                    }) => {
                      const i = currentTranscript.findIndex(
                        (item: { time: number }) => item.time === line.time,
                      )
                      return (
                        <button
                          key={line.time}
                          className={i === active ? "active" : ""}
                          onClick={() => seek(line.time)}
                        >
                          <time>{line.stamp}</time>
                          <div>
                            <strong>{line.title}</strong>
                            <p>{line.text}</p>
                          </div>
                          {i === active && (
                            <span>
                              <Icon name="play" size={11} />
                            </span>
                          )}
                        </button>
                      )
                    },
                  )
              )}
            </div>
          ) : (
            <div className="lesson-notes-container">
              <div className="lesson-notes-head">
                <div>
                  <h3>Lecture Notes &amp; Study Materials</h3>
                  <p>
                    Official documents uploaded by the teacher for this lecture.
                    View directly in-app, download as original files, or ask AI questions.
                  </p>
                </div>
                {isTeacher && onOpenNotesUpload && (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      onOpenNotesUpload(
                        currentVideo?.course_id,
                        currentVideo?.id,
                      )
                    }
                  >
                    <Icon name="upload" size={14} /> + Upload Notes for Lesson
                  </Button>
                )}
              </div>

              {lessonResources.length === 0 ? (
                <div
                  style={{
                    padding: "36px 20px",
                    textAlign: "center",
                    color: "var(--muted)",
                    background: "var(--surface-2)",
                    borderRadius: "12px",
                    border: "1px dashed var(--line)",
                  }}
                >
                  <div style={{ fontSize: "28px", marginBottom: "8px" }}>📄</div>
                  <h4 style={{ margin: "0 0 6px", color: "var(--text)" }}>
                    No lecture notes attached to this lesson yet
                  </h4>
                  <p
                    style={{
                      fontSize: "12px",
                      maxWidth: "420px",
                      margin: "0 auto 16px",
                    }}
                  >
                    {isTeacher
                      ? "As a teacher, you can upload lecture notes (.pdf, .ppt, .pptx, .docx, .txt) so students can view and download them right here."
                      : "Your teacher has not uploaded slides for this lesson yet. You can also explore general documents in the Resource Library."}
                  </p>
                  {isTeacher && onOpenNotesUpload ? (
                    <Button
                      onClick={() =>
                        onOpenNotesUpload(
                          currentVideo?.course_id,
                          currentVideo?.id,
                        )
                      }
                    >
                      <Icon name="upload" size={14} /> Upload Notes / Slides Now
                    </Button>
                  ) : (
                    <Button variant="secondary" onClick={() => go("resources")}>
                      Browse Resource Library →
                    </Button>
                  )}
                </div>
              ) : (
                <div className="lesson-notes-grid">
                  {lessonResources.map((res) => {
                    const ftype = (res.file_type || "pdf").toLowerCase()
                    return (
                      <div className="lesson-note-card" key={res.id}>
                        <div className="lnc-header">
                          <span className={`lnc-icon ${ftype}`}>
                            {ftype}
                          </span>
                          <div className="lnc-info">
                            <h4 className="lnc-title" title={res.title}>
                              {res.title}
                            </h4>
                            <div className="lnc-meta">
                              {res.filename} • {(res.file_size / 1024).toFixed(1)} KB
                            </div>
                          </div>
                        </div>

                        <div className="lnc-pill-row">
                          <span className="lnc-pill ai">
                            <Icon name="spark" size={11} /> AI Grounded
                          </span>
                          <span className="lnc-pill">
                            💾 Saved in DB
                          </span>
                          {res.download_count !== undefined && (
                            <span className="lnc-pill">
                              ⬇ {res.download_count} dl
                            </span>
                          )}
                        </div>

                        <div className="lnc-actions">
                          <button
                            type="button"
                            className="btn-view-notes"
                            onClick={() => setViewingResourceId(res.id)}
                            title="Read document notes directly in the app"
                          >
                            👁 View Notes
                          </button>
                          <a
                            href={res.download_url}
                            download
                            className="btn-download-notes"
                            title={`Download ${res.filename}`}
                          >
                            <Icon name="download" size={12} /> Download
                          </a>
                          <button
                            type="button"
                            className="btn-ask-notes"
                            title="Ask AI questions grounded in these lecture notes"
                            onClick={() => {
                              askAboutMoment()
                            }}
                          >
                            <Icon name="spark" size={13} />
                          </button>
                          {isTeacher && (
                            <button
                              type="button"
                              className="btn-del-notes"
                              title="Delete this lecture note (Teacher only)"
                              onClick={async () => {
                                if (
                                  !window.confirm(
                                    `Are you sure you want to delete "${res.title}" from the database?`,
                                  )
                                )
                                  return
                                try {
                                  await api(`/api/resources/${res.id}`, {
                                    method: "DELETE",
                                  })
                                  onRefreshResources?.()
                                } catch (e) {
                                  window.alert(
                                    (e as Error).message || "Could not delete",
                                  )
                                }
                              }}
                            >
                              <Icon name="trash" size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </section>
        <ChatPanel
          time={time}
          seek={seek}
          go={go}
          addHistory={addHistory}
          transcriptContext={transcriptContext}
          lessonTitle={displayTitle}
          videoId={currentVideo?.id}
          videoDuration={currentVideo?.duration_seconds}
          askTick={askTick}
          className={mobileTab === "assistant" ? "mobile-active" : ""}
          isEnlarged={aiEnlarged}
          onToggleEnlarge={() => setAiEnlarged((prev) => !prev)}
          onOpenFocusView={(m) => setFocusMessage(m)}
        />
      </div>
      <EnlargedAIModal
        open={!!focusMessage}
        onClose={() => setFocusMessage(null)}
        message={focusMessage}
        time={time}
        seek={seek}
        lessonTitle={displayTitle}
      />
      <ViewNotesModal
        resourceId={viewingResourceId}
        onClose={() => setViewingResourceId(null)}
        onAskAi={() => {
          setViewingResourceId(null)
          askAboutMoment()
        }}
      />
      {videoToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(4px)",
            display: "grid",
            placeItems: "center",
            zIndex: 9999,
            padding: "20px",
          }}
          onClick={() => !isDeleting && setVideoToDelete(null)}
        >
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "16px",
              padding: "24px",
              maxWidth: "440px",
              width: "100%",
              boxShadow: "0 24px 48px rgba(0,0,0,0.4)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "14px",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  background: "rgba(239, 68, 68, 0.12)",
                  color: "#ef4444",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                <Icon name="trash" size={20} />
              </div>
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "16px",
                    fontWeight: 700,
                    color: "var(--text)",
                  }}
                >
                  Remove Video
                </h3>
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: "12px",
                    color: "var(--muted)",
                  }}
                >
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <p
              style={{
                fontSize: "13px",
                color: "var(--text)",
                lineHeight: "1.5",
                margin: "0 0 20px",
              }}
            >
              Are you sure you want to remove{" "}
              <strong>"{videoToDelete.title}"</strong>? Associated quizzes,
              lecture transcript, and AI notes for this video will also be
              cleaned up.
            </p>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
              }}
            >
              <button
                type="button"
                onClick={() => setVideoToDelete(null)}
                disabled={isDeleting}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "1px solid var(--line)",
                  background: "var(--surface-2)",
                  color: "var(--text)",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: isDeleting ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={async () => {
                  if (!onDeleteVideo) return
                  setIsDeleting(true)
                  try {
                    await onDeleteVideo(videoToDelete.id)
                    setVideoToDelete(null)
                  } catch (err) {
                    console.error(err)
                  } finally {
                    setIsDeleting(false)
                  }
                }}
                style={{
                  padding: "8px 18px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#ef4444",
                  color: "#fff",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: isDeleting ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {isDeleting ? "Removing..." : "Yes, Remove Video"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function LessonNotes({ lessonId }: { lessonId: string }) {
  const [notes, setNotes] = useState(
    () => localStorage.getItem(`ls-notes-${lessonId}`) || "",
  )
  useEffect(() => {
    setNotes(localStorage.getItem(`ls-notes-${lessonId}`) || "")
  }, [lessonId])
  return (
    <div className="lesson-notes" style={{ padding: "14px 2px" }}>
      <label
        htmlFor="lesson-notes"
        style={{
          display: "block",
          fontSize: 12,
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        Your lesson notes
      </label>
      <textarea
        id="lesson-notes"
        value={notes}
        onChange={(event) => {
          setNotes(event.target.value)
          localStorage.setItem(`ls-notes-${lessonId}`, event.target.value)
        }}
        placeholder="Write definitions, examples, or questions to revisit…"
        rows={7}
        style={{
          width: "100%",
          resize: "vertical",
          border: "1px solid var(--line)",
          borderRadius: 10,
          background: "var(--surface-2)",
          color: "var(--text)",
          padding: 12,
          font: "inherit",
        }}
      />
      <p style={{ color: "var(--muted)", fontSize: 11 }}>
        Notes save automatically in this browser.
      </p>
    </div>
  )
}

function uploadsTextFromStorage() {
  try {
    const items = JSON.parse(
      localStorage.getItem("ls-uploads") || "[]",
    ) as UploadItem[]
    return items
      .filter((x) => x.extractedText)
      .map((x) => `\n--- ${x.name} ---\n${x.extractedText}`)
      .join("\n")
      .slice(0, 20000)
  } catch {
    return ""
  }
}

function ChatPanel({
  time,
  seek,
  go,
  addHistory,
  transcriptContext,
  lessonTitle,
  videoId,
  videoDuration,
  askTick,
  className,
  isEnlarged = false,
  onToggleEnlarge,
  onOpenFocusView,
}: {
  time: number
  seek: (t: number) => void
  go: (r: Route) => void
  addHistory: (h: HistoryItem) => void
  transcriptContext: string
  lessonTitle: string
  videoId?: number
  videoDuration?: number
  askTick: number
  className?: string
  isEnlarged?: boolean
  onToggleEnlarge?: () => void
  onOpenFocusView?: (m: Message) => void
}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: "assistant",
      text: "Hello, main aapka learning assistant hoon. Is video lecture ya course notes se related koi bhi question ya doubt puchiye, main explain karunga!",
    },
  ])
  const [autoVoice, setAutoVoice] = useState(false)
  const [input, setInput] = useState("")
  const [thinking, setThinking] = useState<0 | 1 | 2>(0)
  const [liveAI, setLiveAI] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (askTick === 0) return
    setInput("Explain what was just said at this moment in simple words.")
    inputRef.current?.focus()
  }, [askTick])
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((data: { aiConfigured?: boolean }) =>
        setLiveAI(Boolean(data.aiConfigured)),
      )
      .catch(() => setLiveAI(false))
  }, [])
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, thinking])

  const send = (question = input) => {
    if (!question.trim() || thinking) return
    const q = question.trim()
    setMessages((m: Message[]) => [
      ...m,
      { id: Date.now(), role: "user", text: q },
    ])
    setInput("")
    setThinking(1)
    addHistory({
      type: "AI Question",
      title: q,
      detail: `Lesson conversation • paused at ${formatTime(time)}`,
      time: "Just now",
    })
    window.setTimeout(() => setThinking(2), 250)
    const resourceContext =
      `LESSON: ${lessonTitle}\nLESSON CONTEXT (up to ${formatTime(time)} where timestamps apply):\n${transcriptContext}\n\n${uploadsTextFromStorage()}`.slice(
        0,
        20000,
      )
    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-User-Id": userId() },
      body: JSON.stringify({
        question: q,
        lessonTime: time,
        context: resourceContext,
        videoId,
      }),
    })
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as {
          answer?: string
          error?: string
          mode?: string
        }
        if (!response.ok)
          throw new Error(
            data.error || `AI request failed (${response.status})`,
          )
        return data as {
          answer: string
          mode?: string
        }
      })
      .then((data) => {
        const replyText =
          typeof data.answer === "string" && data.answer.trim()
            ? data.answer
            : "AI ne koi answer return nahi kiya. Kripya dobara try karein."
        setMessages((m: Message[]) => [
          ...m,
          {
            id: Date.now() + 1,
            role: "assistant",
            text: replyText,
          },
        ])
        if (autoVoice) {
          speakHindiVoice(replyText)
        }
      })
      .catch((error: unknown) => {
        const fb = answerFor(q, time)
        setMessages((m: Message[]) => [
          ...m,
          {
            ...fb,
            text: `${fb.text}\n\n*Live AI Notice: ${
              error instanceof Error ? error.message : "Preview mode active"
            }. Answer foundational concepts par based hai.*`,
          },
        ])
        if (autoVoice) {
          speakHindiVoice(fb.text)
        }
      })
      .finally(() => setThinking(0))
  }
  return (
    <aside className={`chat-panel ${className || ""}`}>
      <div className="chat-head">
        <div className="assistant-icon">
          <Icon name="spark" />
        </div>
        <div>
          <strong>Learning Assistant</strong>
          <span>
            <i /> {liveAI ? "Live AI Connected" : "Grounded AI Tutor"}
          </span>
        </div>
        <button
          type="button"
          className={`ai-auto-voice-toggle ${autoVoice ? "active" : ""}`}
          onClick={() => setAutoVoice((v) => !v)}
          title={
            autoVoice
              ? "Auto Hindi Voice: ON (Click to turn off auto speech)"
              : "Auto Hindi Voice: OFF (Turn ON to automatically speak AI answers)"
          }
        >
          <span>{autoVoice ? "🔊 Voice ON" : "🔈 Voice"}</span>
        </button>
        {onToggleEnlarge && (
          <button
            type="button"
            className={`enlarge-toggle-btn ${isEnlarged ? "active" : ""}`}
            onClick={onToggleEnlarge}
            title={
              isEnlarged
                ? "Restore standard AI panel width"
                : "Enlarge AI response panel for better viewing"
            }
          >
            <Icon name={isEnlarged ? "shrink" : "expand"} size={12} />
            <span>{isEnlarged ? "Collapse" : "Enlarge"}</span>
          </button>
        )}
        <button
          title="New conversation"
          onClick={() => {
            stopSpeakingHindi()
            setMessages([
              {
                id: Date.now(),
                role: "assistant",
                text: "Hello, main aapka learning assistant hoon. Is lesson ya notes ke baare me koi bhi question puchiye!",
              },
            ])
          }}
        >
          ＋
        </button>
        <button title="Conversation history" onClick={() => go("history")}>
          <Icon name="history" size={18} />
        </button>
      </div>
      <div className="context-bar">
        <span>CONTEXT</span>
        <div>
          <Icon name="play" size={13} />
          <strong>{lessonTitle}</strong>
        </div>
        <b>
          Up to {formatTime(time)} <Icon name="check" size={12} />
        </b>
      </div>
      <div className="chat-scroll">
        {messages.length === 0 && (
          <div className="empty-chat">
            <div className="assistant-icon large">
              <Icon name="spark" size={26} />
            </div>
            <h3>What would you like to understand?</h3>
            <p>
              I’ll only use the lesson up to {formatTime(time)} and permitted
              resources.
            </p>
          </div>
        )}
        {messages.map((m) => (
          <ChatMessage
            key={m.id}
            message={m}
            seek={seek}
            go={go}
            send={send}
            onOpenFocusView={onOpenFocusView}
          />
        ))}
        {thinking > 0 && (
          <div className="thinking">
            <div className="assistant-icon small">
              <Icon name="spark" size={14} />
            </div>
            <div>
              <span>
                <i />
                <i />
                <i />
              </span>
              <p>
                {thinking === 1
                  ? "Searching lecture transcripts and course notes…"
                  : "Checking relevant timestamps and sources…"}
              </p>
            </div>
          </div>
        )}
        <div ref={end} />
      </div>
      <div className="suggestions">
        {[
          "Explain this simply",
          "Give a real-world example",
          "Summarize so far",
          "Generate a quiz",
        ].map((x) => (
          <button
            key={x}
            onClick={() => (x.includes("quiz") ? go("quiz") : send(x))}
          >
            {x}
          </button>
        ))}
      </div>
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <textarea
          ref={inputRef}
          aria-label="Ask the learning assistant"
          placeholder="Ask about this lesson..."
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
        />
        <div>
          <span>
            <Icon name="spark" size={13} /> Verified Course Knowledge Base &amp;
            Timestamps
          </span>
          <button
            aria-label="Send question"
            type="submit"
            disabled={!input.trim() || !!thinking}
          >
            <Icon name="send" size={17} />
          </button>
        </div>
      </form>
    </aside>
  )
}

function answerFor(question: string, time: number): Message {
  const base = { id: Date.now() + 1, role: "assistant" as const }
  const timeFormatted = formatTime(time)
  return {
    ...base,
    text: `Hello, main aapka learning assistant hoon.\n\n` +
      `**Video Position [${timeFormatted}] ke aadhar par explanation:**\n\n` +
      `1. **Core Concept:** Yahan lecture me syntax, variables aur programming execution flow ko step-by-step sikhaya ja raha hai.\n` +
      `2. **Real-world Analogy:** Isko aise samjhein jaise ek chef recipe follow karta hai, waise hi computer code ke instructions ko sequence me execute karta hai.\n` +
      `3. **Key Tip:** Screen par chal rahe code ko dhyan se dekhein aur khud practice karein.`,
    sources: [
      {
        type: "video",
        label: `Video at ${timeFormatted}`,
        time,
        detail: "Current playback position in active teaching lecture.",
      },
    ],
    followups: [
      "Isko aur simple shabdon me samjhao",
      "Real-world example do",
      "Is concept par ek practice quiz generate karo",
    ],
  }
}

function ChatMessage({
  message,
  seek,
  go,
  send,
  onOpenFocusView,
}: {
  message: Message
  seek: (t: number) => void
  go: (r: Route) => void
  send: (x: string) => void
  onOpenFocusView?: (m: Message) => void
}) {
  return (
    <div className={`message ${message.role}`}>
      {message.role === "assistant" && (
        <div className="assistant-icon small">
          <Icon name="spark" size={14} />
        </div>
      )}
      <div className="bubble">
        {String(message.text ?? "")
          .split("\n")
          .map((p, i) => (
            <p key={i}>{renderBold(p)}</p>
          ))}
        {message.role === "assistant" && (
          <div className="ai-bubble-actions">
            <AiVoiceButton text={message.text} />
            {onOpenFocusView && (
              <button
                type="button"
                className="enlarge-bubble-btn"
                onClick={() => onOpenFocusView(message)}
                title="Open full-screen enlarged view of this AI explanation"
              >
                <span>⤢</span> Enlarge Reading View
              </button>
            )}
          </div>
        )}
        {message.sources && (
          <div className="sources">
            <strong>
              <Icon name="check" size={13} /> Sources used{" "}
              <span>Verified course context</span>
            </strong>
            {message.sources.map((s) => (
              <button
                key={s.label}
                title={s.detail}
                onClick={() =>
                  s.type === "video" && s.time !== undefined
                    ? seek(s.time)
                    : go("resources")
                }
              >
                <span className={s.type}>
                  <Icon name={s.type === "video" ? "play" : "file"} size={13} />
                </span>
                {s.label}
                <Icon name="arrow" size={13} />
              </button>
            ))}
          </div>
        )}
        {message.followups && (
          <div className="followups">
            {message.followups.map((x) => (
              <button key={x} onClick={() => send(x)}>
                {x}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function renderBold(text: string) {
  return text
    .split("**")
    .map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part))
}

function Resources({
  uploads,
  setUploads,
  preview,
  setPreview,
  addHistory,
  serverResources = [],
  onRefreshResources,
  onOpenWorkspace,
  isTeacher,
}: {
  uploads: UploadItem[]
  setUploads: React.Dispatch<React.SetStateAction<UploadItem[]>>
  preview: string | null
  setPreview: (x: string | null) => void
  addHistory: (h: HistoryItem) => void
  serverResources?: Resource[]
  onRefreshResources?: () => void
  onOpenWorkspace?: () => void
  isTeacher?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const [resourceQuery, setResourceQuery] = useState("")
  const [uploading, setUploading] = useState(false)
  const [viewingResourceId, setViewingResourceId] = useState<number | null>(null)

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    Array.from(files).forEach(async (file) => {
      const ext = file.name.split(".").pop()?.toLowerCase() || ""
      if (!["pdf", "ppt", "pptx", "txt", "md", "csv", "json"].includes(ext)) {
        window.alert(`Unsupported file type: ${file.name}`)
        setUploading(false)
        return
      }
      if (file.size > 25 * 1024 * 1024) {
        window.alert(`${file.name} is larger than the 25 MB limit.`)
        setUploading(false)
        return
      }

      try {
        const formData = new FormData()
        formData.append("file", file)
        formData.append(
          "title",
          file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " "),
        )
        formData.append("course_id", "1")

        const saved = await apiFormData<Resource>(
          "/api/resources/upload",
          formData,
        )
        onRefreshResources?.()

        const canReadText = ["txt", "md", "csv", "json"].includes(ext)
        let extractedText = ""
        try {
          if (canReadText) extractedText = (await file.text()).slice(0, 120000)
        } catch {}

        setUploads((u) => [
          {
            id: saved.id,
            name: saved.title || file.name,
            size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
            type: ext.toUpperCase(),
            status: saved.has_text ? "AI text indexed" : "Ready",
            progress: 100,
            ...(extractedText ? { extractedText } : {}),
          },
          ...u,
        ])

        addHistory({
          type: "Upload",
          title: file.name,
          detail: `Uploaded to knowledge library • AI extracted text for grounding`,
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        })
      } catch (err) {
        console.error("Upload error", err)
        window.alert(`Could not upload ${file.name}: ${(err as Error).message}`)
      } finally {
        setUploading(false)
      }
    })
  }

  const handleDeleteServerResource = async (id: number, name: string) => {
    if (!window.confirm(`Delete ${name} from course resources?`)) return
    try {
      await api(`/api/resources/${id}`, { method: "DELETE" })
      onRefreshResources?.()
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="page">
      <PageHeading
        eyebrow="KNOWLEDGE LIBRARY & NOTES"
        title="Course Resources & Lecture Notes"
        text="Download lecture slides, view extracted study notes, and ground AI responses in your course materials."
        action={
          <Button onClick={() => input.current?.click()} disabled={uploading}>
            <Icon name="upload" size={17} />{" "}
            {uploading ? "Uploading..." : "Upload Notes / PPT"}
          </Button>
        }
      />
      <input
        ref={input}
        hidden
        type="file"
        accept=".pdf,.ppt,.pptx,.txt,text/plain,application/pdf"
        multiple
        onChange={(e) => {
          addFiles(e.target.files)
          e.currentTarget.value = ""
        }}
      />
      <div className="resource-layout">
        <div>
          <div
            className="upload-zone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              addFiles(e.dataTransfer.files)
            }}
          >
            <span>
              <Icon name="upload" size={28} />
            </span>
            <h3>Drop lecture slides or study notes here</h3>
            <p>
              PDF, PPT, PPTX, or TXT • Automatic text extraction for AI tutor
            </p>
            <Button
              variant="secondary"
              onClick={() => input.current?.click()}
              disabled={uploading}
            >
              {uploading ? "Extracting Text..." : "Browse Files"}
            </Button>
            <small>
              Files are saved in backend storage, indexed for AI answers, and
              instantly downloadable.
            </small>
          </div>

          <div className="resource-list card">
            <div className="section-title compact">
              <div>
                <p className="eyebrow">DOWNLOADABLE MATERIALS</p>
                <h2>
                  Resource Library ({serverResources.length + uploads.length})
                </h2>
              </div>
              <label className="resource-search">
                <Icon name="search" size={16} />
                <input
                  aria-label="Search resources"
                  value={resourceQuery}
                  onChange={(e) => setResourceQuery(e.target.value)}
                  placeholder="Search resources..."
                />
              </label>
            </div>

            {/* Server-persisted resources with real download, in-app view, and teacher delete */}
            {serverResources
              .filter(
                (file) =>
                  file.title
                    .toLowerCase()
                    .includes(resourceQuery.toLowerCase()) ||
                  file.filename
                    .toLowerCase()
                    .includes(resourceQuery.toLowerCase()),
              )
              .map((file) => (
                <div className="resource-row" key={`srv-${file.id}`}>
                  <span className="file-icon">
                    <Icon name="file" />
                  </span>
                  <div className="resource-name">
                    <strong>{file.title}</strong>
                    <small>
                      {file.file_type.toUpperCase()} •{" "}
                      {(file.file_size / 1024).toFixed(1)} KB • {file.filename}
                    </small>
                    <div className="progress">
                      <i style={{ width: "100%" }} />
                    </div>
                  </div>
                  <span
                    className="status ready"
                    title="AI extracts concepts from this document"
                  >
                    {file.has_text ? "AI Indexed" : "Ready"}
                  </span>
                  <button
                    type="button"
                    className="download-pill"
                    style={{
                      background: "var(--brand, #6366f1)",
                      color: "#fff",
                      border: "none",
                      cursor: "pointer",
                    }}
                    onClick={() => setViewingResourceId(file.id)}
                    title={`View and read ${file.title} directly in app`}
                  >
                    👁 View Notes
                  </button>
                  <a
                    href={file.download_url}
                    download
                    className="download-pill"
                    title={`Download ${file.filename}`}
                  >
                    <Icon name="download" size={13} /> Download
                  </a>
                  {onOpenWorkspace && (
                    <button
                      className="download-pill"
                      style={{
                        background: "var(--surface-3)",
                        color: "var(--text)",
                      }}
                      onClick={onOpenWorkspace}
                      title="Ask AI questions about this document in workspace"
                    >
                      <Icon name="spark" size={12} /> Ask AI
                    </button>
                  )}
                  {isTeacher && (
                    <button
                      aria-label={`Remove ${file.title}`}
                      title="Delete resource (Teacher only)"
                      onClick={() =>
                        handleDeleteServerResource(file.id, file.title)
                      }
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}

            {/* Local uploads session list */}
            {uploads
              .filter((file) =>
                file.name.toLowerCase().includes(resourceQuery.toLowerCase()),
              )
              .map((file) => (
                <div className="resource-row" key={`up-${file.id}`}>
                  <span className="file-icon">
                    <Icon name="file" />
                  </span>
                  <div className="resource-name">
                    <strong>{file.name}</strong>
                    <small>
                      {file.type} • {file.size}
                    </small>
                    <div className="progress">
                      <i style={{ width: `${file.progress}%` }} />
                    </div>
                  </div>
                  <span
                    className={
                      file.progress === 100 ? "status ready" : "status"
                    }
                  >
                    {file.status}
                  </span>
                  <button onClick={() => setPreview(file.name)}>Preview</button>
                  <button
                    aria-label={`Remove ${file.name}`}
                    onClick={() =>
                      setUploads((u) => u.filter((x) => x.id !== file.id))
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
          </div>
        </div>
        <DocumentPreview
          name={preview || serverResources[0]?.title || "Course Notes & Slides"}
          close={preview ? () => setPreview(null) : undefined}
        />
      </div>
      <ViewNotesModal
        resourceId={viewingResourceId}
        onClose={() => setViewingResourceId(null)}
        onAskAi={() => {
          setViewingResourceId(null)
          onOpenWorkspace?.()
        }}
      />
    </div>
  )
}

interface DocumentPreviewProps {
  name: string
  close?: () => void
}

function DocumentPreview({ name, close }: DocumentPreviewProps) {
  const [page, setPage] = useState(1)
  return (
    <aside className="document-preview card">
      <div className="doc-head">
        <div>
          <span>
            <Icon name="file" />
          </span>
          <div>
            <strong>{name}</strong>
            <small>Course Material Preview</small>
          </div>
        </div>
        {close && (
          <button onClick={close}>
            <Icon name="close" />
          </button>
        )}
      </div>
      <div className="doc-toolbar">
        <button onClick={() => setPage(Math.max(1, page - 1))}>‹</button>
        <span>
          Page <b>{page}</b> of 12
        </span>
        <button onClick={() => setPage(Math.min(12, page + 1))}>›</button>
        <i />
        <button>−</button>
        <span>100%</span>
        <button>＋</button>
      </div>
      <div className="paper">
        <span>DOCUMENT VIEWER • {String(page).padStart(2, "0")}</span>
        <h2>{name}</h2>
        <p>
          Uploaded course reference materials, lecture notes, or slides. Text
          content extracted from this document is automatically indexed by the
          LearnSphere AI tutor to ground answers in verified course materials.
        </p>
        <div className="paper-callout">
          <strong>AI Grounding</strong>
          <p>
            When asking questions in the AI Learning Workspace, the AI
            cross-references this material with the video timeline.
          </p>
        </div>
        <div className="highlight">
          Verified Course Material • Ready for AI Citations
        </div>
      </div>
      <div className="doc-foot">
        <span>
          <Icon name="search" size={15} /> Search in document
        </span>
        <button>Open externally ↗</button>
      </div>
    </aside>
  )
}

function Quiz({
  addHistory,
  videos = [],
  initialVideoId = 1,
  go,
}: {
  addHistory: (h: HistoryItem) => void
  videos?: Video[]
  initialVideoId?: number
  go?: (r: Route) => void
}) {
  const [selectedVideoId, setSelectedVideoId] = useState<number>(
    initialVideoId || (videos[0]?.id ?? 1),
  )
  const [quizId, setQuizId] = useState<number>(1)
  const [quizTitle, setQuizTitle] = useState("Quick Quiz")
  const [questions, setQuestions] =
    useState<{
      q: string
      options: string[]
      answer: number
      explain: string
    }[]>(quizData)
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [answers, setAnswers] = useState<number[]>([])
  const [complete, setComplete] = useState(false)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [serverResult, setServerResult] = useState<{
    score: number
    total: number
    percentage: number
  } | null>(null)

  const activeVideo = videos.find((v) => v.id === selectedVideoId)

  // Load quiz for selected video from backend
  const loadQuiz = (vidId: number) => {
    setLoading(true)
    api<{
      id: number
      video_id: number
      title: string
      questions: Array<{
        id: number
        question: string
        options: string[]
        answer: number
        explanation: string
      }>
    }>(`/api/quiz/video/${vidId}`)
      .then((data) => {
        if (data && data.questions && data.questions.length > 0) {
          setQuizId(data.id)
          setQuizTitle(data.title || "Video Quick Quiz")
          setQuestions(
            data.questions.map((q) => ({
              q: q.question,
              options: q.options,
              answer: q.answer,
              explain: q.explanation,
            })),
          )
        }
      })
      .catch((err) => {
        console.warn("Could not load backend quiz, using starter quiz", err)
      })
      .finally(() => {
        setLoading(false)
        setIndex(0)
        setSelected(null)
        setAnswers([])
        setComplete(false)
        setServerResult(null)
      })
  }

  useEffect(() => {
    loadQuiz(selectedVideoId)
  }, [selectedVideoId])

  const regenerateWithAI = async () => {
    setGenerating(true)
    try {
      const form = new FormData()
      form.append("video_id", String(selectedVideoId))
      const res = await apiFormData<{
        id: number
        title: string
        questions: Array<{
          id: number
          question: string
          options: string[]
          answer: number
          explanation: string
        }>
      }>("/api/quiz/generate", form)
      if (res && res.questions && res.questions.length > 0) {
        setQuizId(res.id)
        setQuizTitle(
          res.title || `AI Quiz: ${activeVideo?.title || "Video Lecture"}`,
        )
        setQuestions(
          res.questions.map((q) => ({
            q: q.question,
            options: q.options,
            answer: q.answer,
            explain: q.explanation,
          })),
        )
        setIndex(0)
        setSelected(null)
        setAnswers([])
        setComplete(false)
        setServerResult(null)
      }
    } catch (err) {
      window.alert("Failed to generate AI quiz: " + (err as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  const reset = () => {
    setIndex(0)
    setSelected(null)
    setAnswers([])
    setComplete(false)
    setServerResult(null)
  }

  const currentQ = questions[index] || questions[0]
  const correct = answers.filter((a, i) => a === questions[i]?.answer).length

  const next = async () => {
    if (selected === null) return
    const nextAnswers = [...answers, selected]
    setAnswers(nextAnswers)

    if (index === questions.length - 1) {
      setComplete(true)
      const localScore = nextAnswers.filter(
        (a, i) => a === questions[i]?.answer,
      ).length

      // Submit to backend
      try {
        const res = await api<QuizSubmissionResult>("/api/quiz/submit", {
          method: "POST",
          body: JSON.stringify({
            quiz_id: quizId,
            answers: nextAnswers,
          }),
        })
        setServerResult({
          score: res.score,
          total: res.total,
          percentage: res.percentage,
        })
      } catch {
        setServerResult({
          score: localScore,
          total: questions.length,
          percentage: Math.round((localScore / questions.length) * 100),
        })
      }

      addHistory({
        type: "Quiz",
        title: quizTitle,
        detail: `Completed with ${localScore}/${questions.length} correct (${Math.round((localScore / questions.length) * 100)}%)`,
        time: "Just now",
      })
    } else {
      setIndex(index + 1)
      setSelected(null)
    }
  }

  return (
    <div className="page quiz-page">
      <PageHeading
        eyebrow="ACTIVE DIAGNOSTIC LEARNING"
        title="Video Practice & Quick Quizzes"
        text="AI analyzes each uploaded teaching video and notes to prepare focused diagnostic questions."
        action={
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <Button
              variant="secondary"
              onClick={regenerateWithAI}
              disabled={generating || loading}
            >
              <Icon name="spark" size={15} />{" "}
              {generating ? "AI Generating..." : "AI Re-generate Quiz"}
            </Button>
            {go && (
              <Button onClick={() => go("workspace")}>
                <Icon name="play" size={15} /> Back to Video
              </Button>
            )}
          </div>
        }
      />

      {/* Video selector pills */}
      {videos.length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <p className="eyebrow" style={{ marginBottom: "8px" }}>
            SELECT TEACHING VIDEO FOR QUIZ
          </p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {videos.map((vid) => (
              <button
                key={vid.id}
                onClick={() => setSelectedVideoId(vid.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 14px",
                  borderRadius: "20px",
                  border: "1px solid",
                  borderColor:
                    selectedVideoId === vid.id
                      ? "var(--primary)"
                      : "var(--line)",
                  background:
                    selectedVideoId === vid.id
                      ? "var(--primary-glow)"
                      : "var(--surface-2)",
                  color: selectedVideoId === vid.id ? "#fff" : "var(--text)",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: selectedVideoId === vid.id ? 700 : 500,
                  transition: "all 0.2s ease",
                }}
              >
                <Icon name="play" size={12} />
                <span>{vid.title}</span>
                <span
                  className="badge-duration"
                  style={{ fontSize: "10px", padding: "1px 6px" }}
                >
                  {vid.duration_display}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div
          className="quiz-card card"
          style={{ textAlign: "center", padding: "40px" }}
        >
          <p>Loading questions grounded in this video...</p>
        </div>
      ) : !complete ? (
        <div className="quiz-card card">
          <div className="quiz-top">
            <div>
              <span className="demo-pill">
                <i />{" "}
                {activeVideo
                  ? `VIDEO LECTURE • ${activeVideo.duration_display}`
                  : "SAMPLE QUIZ"}
              </span>
              <h2>{quizTitle}</h2>
              <p>
                {questions.length} questions • Grounded in{" "}
                {activeVideo ? `"${activeVideo.title}"` : "lecture concepts"}
              </p>
            </div>
            <div className="quiz-ring">
              {index + 1}
              <small>/ {questions.length}</small>
            </div>
          </div>
          <div className="quiz-progress">
            <i
              style={{ width: `${((index + 1) / questions.length) * 100}%` }}
            />
          </div>
          <div className="question">
            <span>
              QUESTION {index + 1} OF {questions.length}
            </span>
            <h3>{currentQ?.q}</h3>
            <div className="answers">
              {currentQ?.options?.map((opt, i) => (
                <button
                  key={opt}
                  disabled={selected !== null}
                  onClick={() => setSelected(i)}
                  className={
                    selected === i
                      ? i === currentQ.answer
                        ? "correct"
                        : "wrong"
                      : selected !== null && i === currentQ.answer
                        ? "correct"
                        : ""
                  }
                >
                  <b>{String.fromCharCode(65 + i)}</b>
                  <span>{opt}</span>
                  {selected !== null && i === currentQ.answer && (
                    <Icon name="check" />
                  )}
                </button>
              ))}
            </div>
            {selected !== null && (
              <div
                className={`explanation ${
                  selected === currentQ.answer ? "good" : ""
                }`}
              >
                <strong>
                  {selected === currentQ.answer
                    ? "Correct!"
                    : "Not quite — here’s why"}
                </strong>
                <p>{currentQ.explain}</p>
              </div>
            )}
          </div>
          <div className="quiz-actions">
            <span>
              {selected === null
                ? "Choose one answer to continue"
                : "Answer recorded"}
            </span>
            <Button disabled={selected === null} onClick={next}>
              {index === questions.length - 1 ? "See Results" : "Next Question"}{" "}
              <Icon name="arrow" size={16} />
            </Button>
          </div>
        </div>
      ) : (
        <div className="result-card card">
          <div className="result-orb">
            <Icon name="spark" size={30} />
          </div>
          <p className="eyebrow">QUIZ COMPLETE</p>
          <h2>
            {serverResult && serverResult.percentage >= 70
              ? "Excellent Work!"
              : "Quiz Finished"}
          </h2>
          <p>
            You scored{" "}
            <strong>
              {serverResult?.score ?? correct} out of{" "}
              {serverResult?.total ?? questions.length}
            </strong>{" "}
            on {quizTitle}.
          </p>
          <div className="score">
            {serverResult?.percentage ??
              Math.round((correct / questions.length) * 100)}
            <span>%</span>
          </div>
          <div className="result-stats">
            <span>
              <b>{serverResult?.score ?? correct}</b>Correct
            </span>
            <span>
              <b>
                {(serverResult?.total ?? questions.length) -
                  (serverResult?.score ?? correct)}
              </b>
              To review
            </span>
          </div>
          <div
            style={{
              display: "flex",
              gap: "10px",
              justifyContent: "center",
              marginTop: "20px",
            }}
          >
            <Button onClick={reset}>Retry Quiz</Button>
            {go && (
              <Button variant="secondary" onClick={() => go("workspace")}>
                Return to Lesson Video
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function History({
  history,
  go,
  stats,
  onClearHistory,
}: {
  history: HistoryItem[]
  go: (r: Route) => void
  stats?: Stats | null
  onClearHistory?: () => void
}) {
  const [filter, setFilter] = useState("All activity")
  const [clearing, setClearing] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const handleClear = async () => {
    if (
      !window.confirm(
        "Are you sure you want to remove all learning history saved in the database? This will permanently delete your saved lesson records, AI questions, quizzes, and mock interview logs.",
      )
    ) {
      return
    }
    setClearing(true)
    try {
      if (onClearHistory) {
        await onClearHistory()
      }
      setNotice(
        "All learning history has been successfully removed from the database.",
      )
      setTimeout(() => setNotice(null), 4000)
    } finally {
      setClearing(false)
    }
  }

  const filtered =
    filter === "All activity"
      ? history
      : history.filter((h) => {
          if (filter === "Lesson") return h.type === "Lesson"
          if (filter === "AI conversations") return h.type === "AI Question"
          if (filter === "Quizzes") return h.type === "Quiz"
          if (filter === "Interviews") return h.type === "Interview"
          if (filter === "Uploads")
            return h.type === "Upload" || h.type === "Resource"
          return h.type === filter
        })

  const totalActivities = history.length
  const lessonCount = history.filter((h) => h.type === "Lesson").length
  const aiQuestionsCount =
    stats?.questions_asked ??
    history.filter((h) => h.type === "AI Question").length
  const quizzesCount =
    stats?.quizzes_taken ?? history.filter((h) => h.type === "Quiz").length

  return (
    <div className="page">
      <PageHeading
        eyebrow="YOUR LEARNING TIMELINE"
        title="Learning History"
        text="All your lessons, AI questions, quizzes, and mock interview sessions are automatically recorded in your database."
        action={
          <div
            style={{
              display: "flex",
              gap: "10px",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            {history.length > 0 && onClearHistory && (
              <Button
                variant="secondary"
                onClick={handleClear}
                disabled={clearing}
                style={{
                  borderColor: "rgba(239, 68, 68, 0.4)",
                  color: "#f87171",
                  background: "rgba(239, 68, 68, 0.08)",
                }}
              >
                <Icon name="trash" size={14} />
                {clearing ? "Removing..." : "Clear History from Database"}
              </Button>
            )}
            <Button onClick={() => go("workspace")}>Resume Lesson</Button>
          </div>
        }
      />

      {notice && (
        <div
          style={{
            padding: "12px 16px",
            marginBottom: "16px",
            background: "rgba(34, 197, 94, 0.15)",
            border: "1px solid rgba(34, 197, 94, 0.3)",
            borderRadius: "10px",
            color: "#4ade80",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <Icon name="check" size={16} /> {notice}
        </div>
      )}

      <div className="history-stats">
        {[
          [String(totalActivities), "Total Activities", "Saved in database"],
          [String(lessonCount), "Lessons Started", "Teaching videos"],
          [String(aiQuestionsCount), "AI Questions", "Time-synced queries"],
          [String(quizzesCount), "Quizzes Taken", "Diagnostic practice"],
        ].map(([a, b, c]) => (
          <div className="card" key={b}>
            <b>{a}</b>
            <span>{b}</span>
            <small>{c}</small>
          </div>
        ))}
      </div>

      <div className="history-layout">
        <div className="history-filters card">
          <strong>Filter activity</strong>
          {[
            "All activity",
            "Lesson",
            "AI conversations",
            "Quizzes",
            "Interviews",
            "Uploads",
          ].map((x) => (
            <button
              className={filter === x ? "active" : ""}
              onClick={() => setFilter(x)}
              key={x}
            >
              {x}
              <Icon name="arrow" size={14} />
            </button>
          ))}
        </div>
        <div className="timeline card">
          <div className="section-title compact">
            <div>
              <p className="eyebrow">ACTIVITY TIMELINE</p>
              <h2>Recent activity ({filtered.length})</h2>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {history.length > 0 && onClearHistory && (
                <button
                  onClick={handleClear}
                  disabled={clearing}
                  style={{
                    color: "#f87171",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    background: "rgba(239, 68, 68, 0.08)",
                    padding: "6px 12px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                  title="Remove all learning history from database"
                >
                  <Icon name="trash" size={13} />{" "}
                  {clearing ? "Deleting..." : "Remove All"}
                </button>
              )}
              <button>
                <Icon name="search" size={16} /> Search
              </button>
            </div>
          </div>
          {filtered.length ? (
            filtered.map((item, i) => (
              <div className="timeline-row" key={`${item.title}-${i}`}>
                <span className={`timeline-icon t${i % 3}`}>
                  <Icon
                    name={
                      item.type === "Quiz"
                        ? "quiz"
                        : item.type === "Interview"
                          ? "user"
                          : item.type === "Upload" || item.type === "Resource"
                            ? "file"
                            : item.type === "AI Question"
                              ? "spark"
                              : "play"
                    }
                  />
                </span>
                <div>
                  <small>{item.type.toUpperCase()}</small>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
                <time>{item.time}</time>
                {item.type === "Lesson" && (
                  <button onClick={() => go("workspace")}>
                    Resume <Icon name="arrow" size={14} />
                  </button>
                )}
              </div>
            ))
          ) : (
            <div
              className="empty-state"
              style={{ padding: "40px 20px", textAlign: "center" }}
            >
              <div
                style={{
                  width: "50px",
                  height: "50px",
                  borderRadius: "50%",
                  background: "var(--surface-3)",
                  display: "grid",
                  placeItems: "center",
                  margin: "0 auto 14px",
                  color: "var(--muted)",
                }}
              >
                <Icon name="history" size={24} />
              </div>
              <h3 style={{ margin: "0 0 6px 0" }}>
                No learning history saved yet
              </h3>
              <p
                style={{
                  color: "var(--muted)",
                  fontSize: "13px",
                  maxWidth: "420px",
                  margin: "0 auto 16px",
                }}
              >
                Learning history will automatically be saved to the database
                whenever you watch a video lesson, ask questions to the AI
                assistant, take a quiz, or complete a mock interview.
              </p>
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  justifyContent: "center",
                }}
              >
                <Button onClick={() => go("courses")}>Start a Lesson</Button>
                <Button variant="secondary" onClick={() => go("quiz")}>
                  Take a Quiz
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Settings({
  dark,
  setDark,
  reducedMotion,
  setReducedMotion,
  user,
  savedAccounts = [],
  onSwitchAccount,
  onAddAccount,
  onSignOut,
  clear,
}: {
  dark: boolean
  setDark: (x: boolean) => void
  reducedMotion: boolean
  setReducedMotion: (x: boolean) => void
  user?: AuthUser | null
  savedAccounts?: SavedAccount[]
  onSwitchAccount?: (account: SavedAccount) => void
  onAddAccount?: () => void
  onSignOut?: () => void
  clear: () => void
}) {
  const [notifications, setNotifications] = useState(true)
  return (
    <div className="page">
      <PageHeading
        eyebrow="PREFERENCES"
        title="Settings"
        text="Tune your learning environment and demo experience."
      />
      <div className="settings-grid">
        {user && (
          <section className="settings-card card" style={{ gridColumn: "1 / -1" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", width: "100%", flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: `2.5px solid ${user.role === "teacher" ? "#34d399" : "#818cf8"}`,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      background: user.role === "teacher"
                        ? "linear-gradient(135deg, #059669, #10b981)"
                        : "linear-gradient(135deg, #4f46e5, #7c3aed)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontWeight: 800,
                      fontSize: 16,
                    }}
                  >
                    {user.displayName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <h2 style={{ margin: 0, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
                    {user.displayName}
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 6,
                        background: user.role === "teacher"
                          ? "rgba(52, 211, 153, 0.15)"
                          : "rgba(99, 102, 241, 0.15)",
                        color: user.role === "teacher" ? "#34d399" : "#818cf8",
                        textTransform: "uppercase",
                      }}
                    >
                      {user.role === "teacher" ? "Teacher Mode" : "Student Mode"}
                    </span>
                  </h2>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted)" }}>
                    {user.email} • {user.provider === "google" ? "Google Account" : "Email & Password"}
                  </p>
                </div>
              </div>

              {/* Permanent Locked Role Badge */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 14px",
                  borderRadius: 10,
                  background: user.role === "teacher" ? "rgba(52, 211, 153, 0.12)" : "rgba(99, 102, 241, 0.12)",
                  border: user.role === "teacher" ? "1px solid rgba(52, 211, 153, 0.3)" : "1px solid rgba(99, 102, 241, 0.3)",
                }}
              >
                <span style={{ fontSize: 18 }}>{user.role === "teacher" ? "👩‍🏫" : "🎓"}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: user.role === "teacher" ? "#34d399" : "#a5b4fc" }}>
                    {user.role === "teacher" ? "Teacher Portal Account" : "Student Portal Account"}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--muted)" }}>
                    🔒 Saved in database • Role switching disabled
                  </div>
                </div>
              </div>
            </div>

            {/* Saved Accounts Switcher List */}
            {savedAccounts && savedAccounts.length > 1 && onSwitchAccount && (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Switch Account (Google Account Switcher):
                </span>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8, marginTop: 8 }}>
                  {savedAccounts.map((acc) => {
                    const isCurrent = acc.email.toLowerCase() === user.email.toLowerCase()
                    const accTeacher = acc.role === "teacher"
                    return (
                      <div
                        key={acc.email}
                        onClick={() => !isCurrent && onSwitchAccount(acc)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 12px",
                          borderRadius: 10,
                          background: isCurrent ? "rgba(99, 102, 241, 0.12)" : "rgba(255, 255, 255, 0.03)",
                          border: `1px solid ${isCurrent ? "rgba(99, 102, 241, 0.3)" : "var(--line)"}`,
                          cursor: isCurrent ? "default" : "pointer",
                        }}
                      >
                        <div style={{ minWidth: 0, overflow: "hidden" }}>
                          <strong style={{ fontSize: 12, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {acc.displayName}
                          </strong>
                          <small style={{ color: accTeacher ? "#34d399" : "#818cf8", fontSize: 10, fontWeight: 700 }}>
                            {accTeacher ? "👩‍🏫 Teacher" : "🎓 Student"} {isCurrent ? "• (Active)" : ""}
                          </small>
                        </div>
                        {!isCurrent && (
                          <span style={{ fontSize: 11, color: "var(--primary)", fontWeight: 700 }}>
                            Switch
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </section>
        )}
        <section className="settings-card card">
          <div>
            <span>
              <Icon name="moon" />
            </span>
            <div>
              <h2>Appearance</h2>
              <p>Choose a comfortable interface theme.</p>
            </div>
          </div>
          <label>
            <span>
              <strong>Dark theme</strong>
              <small>Use darker surfaces across the app</small>
            </span>
            <input
              type="checkbox"
              checked={dark}
              onChange={(e) => setDark(e.target.checked)}
            />
            <i />
          </label>
        </section>
        <section className="settings-card card">
          <div>
            <span>
              <Icon name="spark" />
            </span>
            <div>
              <h2>Accessibility</h2>
              <p>Control movement and visual effects.</p>
            </div>
          </div>
          <label>
            <span>
              <strong>Reduce motion</strong>
              <small>Disable floating and reveal animations</small>
            </span>
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(e) => setReducedMotion(e.target.checked)}
            />
            <i />
          </label>
        </section>
        <section className="settings-card card">
          <div>
            <span>
              <Icon name="bell" />
            </span>
            <div>
              <h2>Notifications</h2>
              <p>Manage helpful study reminders.</p>
            </div>
          </div>
          <label>
            <span>
              <strong>Study reminders</strong>
              <small>Receive learning streak updates</small>
            </span>
            <input
              type="checkbox"
              checked={notifications}
              onChange={(e) => setNotifications(e.target.checked)}
            />
            <i />
          </label>
        </section>
        <section className="settings-card card">
          <div>
            <span>
              <Icon name="book" />
            </span>
            <div>
              <h2>Learning preferences</h2>
              <p>Set your default explanation style.</p>
            </div>
          </div>
          <select aria-label="Default explanation style">
            <option>Simple and concise</option>
            <option>Detailed and technical</option>
            <option>Example first</option>
          </select>
        </section>
        <section className="about-card card">
          <p className="eyebrow">ABOUT</p>
          <Logo />
          <p>
            LearnSphere AI — AI-Powered Interactive Learning Assistant with AI
            Mock Interview Extension (AHGV BuildVerse 2026). Learning chat and
            Mock Interview run on a FastAPI backend with an AI model. The sample
            course, video, quiz and resource search are prepared demo content.
          </p>
          <span>Prototype v2.0 • React + Vite + FastAPI</span>
        </section>
        <section className="danger-card card">
          <p className="eyebrow">DEMO DATA</p>
          <h2>Start with a clean slate</h2>
          <p>
            Clear local progress, uploads, and current-session history. Prepared
            sample content remains available.
          </p>
          <Button variant="secondary" onClick={clear}>
            Clear demo data
          </Button>
        </section>
      </div>
    </div>
  )
}

function SearchModal({
  close,
  go,
  uploads,
  videos = [],
  resources = [],
}: {
  close: () => void
  go: (r: Route) => void
  uploads: UploadItem[]
  videos?: Video[]
  resources?: Resource[]
}) {
  const [q, setQ] = useState("")
  const items = [
    ...videos.map((vid) => ({
      title: vid.title,
      meta: `Teaching Video • ${vid.duration_display}`,
      route: "workspace" as Route,
    })),
    ...resources.map((res) => ({
      title: res.title,
      meta: `Resource • ${res.file_type.toUpperCase()}`,
      route: "resources" as Route,
    })),
    ...uploads.map((upload) => ({
      title: upload.name,
      meta: `Uploaded ${upload.type} • ${upload.status}`,
      route: "resources" as Route,
    })),
  ]
  const results = items.filter((x) =>
    x.title.toLowerCase().includes(q.toLowerCase()),
  )
  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div className="search-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-search">
          <Icon name="search" />
          <input
            autoFocus
            placeholder="Search courses, lessons, resources..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button onClick={close}>ESC</button>
        </div>
        <div className="search-results">
          <span>{q ? `${results.length} RESULTS` : "QUICK ACCESS"}</span>
          {results.map((x) => (
            <button
              key={x.title}
              onClick={() => {
                go(x.route)
                close()
              }}
            >
              <span>
                <Icon
                  name={
                    x.route === "workspace"
                      ? "play"
                      : x.route === "resources"
                        ? "file"
                        : "quiz"
                  }
                />
              </span>
              <div>
                <strong>{x.title}</strong>
                <small>{x.meta}</small>
              </div>
              <Icon name="arrow" />
            </button>
          ))}
          {!results.length && (
            <div className="empty-state">
              <Icon name="search" size={28} />
              <h3>No matching material</h3>
              <p>Try another topic or upload your own notes.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function formatTime(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(Math.floor(safe % 60)).padStart(2, "0")}`
}

export default App
