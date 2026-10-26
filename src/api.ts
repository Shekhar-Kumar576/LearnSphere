// Small helper for talking to the FastAPI backend.
// There is no login: each browser gets an anonymous id so its data stays separate.
const KEY = "ls-user-id"
const AUTH_KEY = "ls-auth-user"
let memoryId = ""

export function userId(): string {
  try {
    const authData = localStorage.getItem(AUTH_KEY)
    if (authData) {
      try {
        const u = JSON.parse(authData)
        if (u?.sessionId) return u.sessionId
        if (u?.uid) return String(u.uid).slice(0, 60)
      } catch {
        /* invalid json */
      }
    }
    let id = localStorage.getItem(KEY)
    if (!id) {
      id = newId()
      localStorage.setItem(KEY, id)
    }
    return id
  } catch {
    return memoryId || (memoryId = newId())
  }
}

export function userRole(): string {
  try {
    const authData = localStorage.getItem(AUTH_KEY)
    if (authData) {
      const u = JSON.parse(authData)
      if (u?.role) return String(u.role).toLowerCase()
    }
  } catch {
    /* ignore */
  }
  return "student"
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return crypto.randomUUID()
  return `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
}

export async function api<T>(
  path: string,
  init: {
    method?: string
    body?: unknown
  } = {},
): Promise<T> {
  const res = await fetch(path, {
    method: init.method || "GET",
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": userId(),
      "X-User-Role": userRole(),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    /* non-JSON response */
  }
  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error
    throw new Error(msg || `Request failed (${res.status})`)
  }
  return data as T
}

export async function apiFormData<T>(
  path: string,
  formData: FormData,
): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: {
      "X-User-Id": userId(),
      "X-User-Role": userRole(),
    },
    body: formData,
  })
  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    /* non-JSON response */
  }
  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error
    throw new Error(msg || `Upload failed (${res.status})`)
  }
  return data as T
}

export type Stats = {
  questions_asked: number
  interviews_started: number
  interviews_finished: number
  answers_reviewed: number
  average_rating: number | null
  focus_areas: string[]
  quizzes_taken?: number
}

export type Health = {
  ok: boolean
  aiConfigured: boolean
  provider?: string
  model: string | null
}

export type Course = {
  id: number
  title: string
  description: string
  instructor: string
  thumbnail: string
  video_count?: number
}

export type Video = {
  id: number
  course_id: number
  course_title?: string
  lesson_topic?: string
  title: string
  filename: string
  file_path: string
  duration_seconds: number
  duration_display: string
  file_size: number
  transcript_text?: string
  ai_summary?: string
  quiz_id?: number | null
}

export type Resource = {
  id: number
  course_id?: number
  video_id?: number
  title: string
  filename: string
  file_type: string
  file_size: number
  download_url: string
  download_count?: number
  has_text?: boolean
  extracted_text?: string
}

export type QuizQuestion = {
  id: number
  question: string
  options: string[]
  answer: number
  explanation: string
}

export type Quiz = {
  id: number
  video_id: number
  title: string
  questions: QuizQuestion[]
}

export type QuizAnswerFeedback = {
  question_id: number
  selected: number
  correct_answer: number
  is_correct: boolean
  explanation: string
}

export type QuizSubmissionResult = {
  quiz_id: number
  score: number
  total: number
  percentage: number
  feedback: QuizAnswerFeedback[]
}
