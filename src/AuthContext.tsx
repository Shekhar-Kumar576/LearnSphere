/**
 * AuthContext — Real User Authentication + Role Management for LearnSphere AI
 *
 * Supports:
 * 1. Real Email & Password Registration (stored in backend SQLite database)
 * 2. Real Email & Password Login
 * 3. Google Sign-In (Firebase OAuth when configured, with seamless fallback)
 * 4. Separate Student / Teacher roles (preserved across account switches)
 * 5. Google Account Switcher with 1-click account switching
 */
import React, { createContext, useContext, useEffect, useState } from "react"
import { initializeApp, type FirebaseApp } from "firebase/app"
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type Auth,
} from "firebase/auth"

// ── Firebase config (optional, from .env) ────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
}

export const isFirebaseConfigured = Boolean(
  FIREBASE_CONFIG.apiKey &&
    FIREBASE_CONFIG.apiKey !== "YOUR_API_KEY" &&
    !FIREBASE_CONFIG.apiKey.startsWith("YOUR_") &&
    FIREBASE_CONFIG.apiKey.length > 10,
)

const AUTH_USER_KEY = "ls-auth-user"
const ROLE_KEY = "ls-user-role"
const SAVED_ACCOUNTS_KEY = "ls-saved-accounts"
const LAST_ACCOUNT_KEY = "ls-last-email"

// ── Types ─────────────────────────────────────────────────────────────────────
export type UserRole = "student" | "teacher"

export type SavedAccount = {
  id?: number
  uid?: string
  sessionId?: string
  email: string
  displayName: string
  role: UserRole
  provider: "email" | "google"
  photoURL?: string | null
  lastLogin: number
}

export function getSavedAccounts(): SavedAccount[] {
  try {
    const raw = localStorage.getItem(SAVED_ACCOUNTS_KEY)
    return raw ? (JSON.parse(raw) as SavedAccount[]) : []
  } catch {
    return []
  }
}

export type AuthUser = {
  id?: number
  uid: string
  displayName: string
  email: string
  photoURL: string | null
  role: UserRole
  sessionId?: string
  provider?: "email" | "google"
}

type AuthContextType = {
  user: AuthUser | null
  loading: boolean
  isConfigured: boolean
  savedAccounts: SavedAccount[]
  removeSavedAccount: (email: string) => void
  switchAccount: (account: SavedAccount) => void
  updateUserRole: (newRole: UserRole) => Promise<void>
  loginWithEmail: (
    email: string,
    password: string,
    role?: UserRole,
  ) => Promise<void>
  registerWithEmail: (
    name: string,
    email: string,
    password: string,
    role: UserRole,
  ) => Promise<void>
  loginWithGoogle: (
    role: UserRole,
    prefilledEmail?: string,
    prefilledName?: string,
  ) => Promise<void>
  logout: () => Promise<void>
  error: string | null
  setError: (e: string | null) => void
}

let firebaseApp: FirebaseApp | null = null
let firebaseAuth: Auth | null = null

function getFirebase() {
  if (!isFirebaseConfigured) return null
  if (!firebaseApp) {
    try {
      firebaseApp = initializeApp(FIREBASE_CONFIG)
      firebaseAuth = getAuth(firebaseApp)
    } catch {
      return null
    }
  }
  return { app: firebaseApp, auth: firebaseAuth! }
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isConfigured: isFirebaseConfigured,
  savedAccounts: [],
  removeSavedAccount: () => {},
  switchAccount: () => {},
  updateUserRole: async () => {},
  loginWithEmail: async () => {},
  registerWithEmail: async () => {},
  loginWithGoogle: async () => {},
  logout: async () => {},
  error: null,
  setError: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>(() =>
    getSavedAccounts(),
  )

  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTH_USER_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as AuthUser
        setUser(parsed)

        // Sync with SQLite database to ensure the saved role is 100% current
        fetch(`/api/auth/user?email=${encodeURIComponent(parsed.email)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d && d.user && d.user.role) {
              const dbRole = d.user.role as UserRole
              if (dbRole !== parsed.role) {
                const refreshed: AuthUser = { ...parsed, role: dbRole }
                setUser(refreshed)
                localStorage.setItem(AUTH_USER_KEY, JSON.stringify(refreshed))
                localStorage.setItem(ROLE_KEY, dbRole)
                saveAccountRecord({
                  id: refreshed.id,
                  uid: refreshed.uid,
                  sessionId: refreshed.sessionId,
                  email: refreshed.email,
                  displayName: refreshed.displayName,
                  role: dbRole,
                  provider: refreshed.provider || "email",
                  photoURL: refreshed.photoURL,
                  lastLogin: Date.now(),
                })
              }
            }
          })
          .catch(() => {})
      }

      // Sync all saved accounts to ensure their roles strictly match their database registration
      const currentSaved = getSavedAccounts()
      if (currentSaved.length > 0) {
        Promise.all(
          currentSaved.map(async (acc) => {
            try {
              const res = await fetch(`/api/auth/user?email=${encodeURIComponent(acc.email)}`)
              if (res.ok) {
                const data = await res.json()
                if (data?.user?.role) {
                  return { ...acc, role: data.user.role as UserRole }
                }
              }
            } catch {}
            return acc
          }),
        ).then((synced) => {
          localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(synced))
          setSavedAccounts(synced)
        })
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  const saveAccountRecord = (account: SavedAccount) => {
    try {
      const current = getSavedAccounts()
      const updated = [
        account,
        ...current.filter(
          (a) => a.email.toLowerCase() !== account.email.toLowerCase(),
        ),
      ].slice(0, 10)
      localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(updated))
      localStorage.setItem(LAST_ACCOUNT_KEY, account.email)
      setSavedAccounts(updated)
    } catch {}
  }

  const removeSavedAccount = (email: string) => {
    try {
      const updated = getSavedAccounts().filter(
        (a) => a.email.toLowerCase() !== email.toLowerCase(),
      )
      localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(updated))
      setSavedAccounts(updated)
    } catch {}
  }

  const saveUserSession = (authUser: AuthUser) => {
    setUser(authUser)
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(authUser))
    localStorage.setItem(ROLE_KEY, authUser.role)
    saveAccountRecord({
      id: authUser.id,
      uid: authUser.uid,
      sessionId: authUser.sessionId,
      email: authUser.email,
      displayName: authUser.displayName,
      role: authUser.role,
      provider: authUser.provider || "email",
      photoURL: authUser.photoURL,
      lastLogin: Date.now(),
    })
  }

  // ── Switch account 1-click (Google account switcher style) ──────────────────
  const switchAccount = (account: SavedAccount) => {
    setError(null)
    const authUser: AuthUser = {
      id: account.id,
      uid: account.uid || (account.id ? String(account.id) : `u_${account.email}`),
      displayName: account.displayName,
      email: account.email,
      photoURL: account.photoURL || null,
      role: account.role,
      sessionId: account.sessionId || (account.id ? `usr_${account.id}` : undefined),
      provider: account.provider,
    }
    saveUserSession(authUser)

    // Sync latest role from database in background
    fetch(`/api/auth/user?email=${encodeURIComponent(account.email)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && d.user && d.user.role && d.user.role !== account.role) {
          const updatedUser: AuthUser = { ...authUser, role: d.user.role as UserRole }
          saveUserSession(updatedUser)
        }
      })
      .catch(() => {})
  }

  // ── Role is permanently locked to its registration portal ──────────────────
  const updateUserRole = async (_newRole: UserRole) => {
    console.info("Account role is permanently locked to its registration portal in the database.")
  }

  // ── 1. Real Email + Password Registration ──────────────────────────────────
  const registerWithEmail = async (
    name: string,
    email: string,
    password: string,
    role: UserRole,
  ) => {
    setError(null)
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role }),
    })
    let data: any = null
    try {
      data = await res.json()
    } catch {
      const msg = `Server returned an error (${res.status}). Please check function logs.`
      setError(msg)
      throw new Error(msg)
    }
    if (!res.ok) {
      const msg = data?.error || `Registration failed (${res.status})`
      setError(msg)
      throw new Error(msg)
    }
    const dbUser = data.user
    const authUser: AuthUser = {
      id: dbUser.id,
      uid: String(dbUser.id),
      displayName: dbUser.name,
      email: dbUser.email,
      photoURL: dbUser.avatar_url || null,
      role: (dbUser.role || role) as UserRole,
      sessionId: data.sessionId,
      provider: "email",
    }
    saveUserSession(authUser)
  }

  // ── 2. Real Email + Password Login ─────────────────────────────────────────
  const loginWithEmail = async (
    email: string,
    password: string,
    role?: UserRole,
  ) => {
    setError(null)
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, role }),
    })
    let data: any = null
    try {
      data = await res.json()
    } catch {
      const msg = `Server returned an error (${res.status}). Please check function logs.`
      setError(msg)
      throw new Error(msg)
    }
    if (!res.ok) {
      const msg = data?.error || `Login failed (${res.status})`
      setError(msg)
      throw new Error(msg)
    }
    const dbUser = data.user
    // Always prioritize the user's role saved in the database!
    const effectiveRole = (dbUser.role || role || "student") as UserRole
    const authUser: AuthUser = {
      id: dbUser.id,
      uid: String(dbUser.id),
      displayName: dbUser.name,
      email: dbUser.email,
      photoURL: dbUser.avatar_url || null,
      role: effectiveRole,
      sessionId: data.sessionId,
      provider: "email",
    }
    saveUserSession(authUser)
  }

  // ── 3. Google Sign-In (Firebase live or backend Google sync) ───────────────
  const loginWithGoogle = async (
    role: UserRole,
    prefilledEmail?: string,
    prefilledName?: string,
  ) => {
    setError(null)
    const fb = getFirebase()

    // A) If real Firebase is configured, open real Google OAuth popup
    if (fb) {
      try {
        const provider = new GoogleAuthProvider()
        provider.setCustomParameters({
          prompt: "select_account",
          ...(prefilledEmail ? { login_hint: prefilledEmail } : {}),
        })
        const result = await signInWithPopup(fb.auth, provider)
        const gu = result.user

        // Sync with backend SQLite users table
        const res = await fetch("/api/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: gu.email,
            name: gu.displayName || "Google User",
            role,
            avatar_url: gu.photoURL || "",
          }),
        })
        const data = await res.json()
        const dbUser = data.user
        // Always prioritize the preserved role from database
        const effectiveRole = (dbUser.role || role || "student") as UserRole
        const authUser: AuthUser = {
          id: dbUser.id,
          uid: gu.uid,
          displayName: gu.displayName || dbUser.name,
          email: gu.email || dbUser.email,
          photoURL: gu.photoURL || null,
          role: effectiveRole,
          sessionId: data.sessionId,
          provider: "google",
        }
        saveUserSession(authUser)
        return
      } catch (err: unknown) {
        const code = (err as { code?: string }).code
        if (code === "auth/popup-closed-by-user") {
          setError("Sign-in was cancelled.")
          return
        }
        if (code === "auth/unauthorized-domain") {
          setError(
            "Unauthorized domain: Please add your Vercel domain to Firebase Console -> Authentication -> Settings -> Authorized domains.",
          )
          return
        }
        if (code === "auth/operation-not-allowed") {
          setError(
            "Google provider is not enabled in Firebase. Please enable it in Firebase Console -> Authentication -> Sign-in method.",
          )
          return
        }
        if (
          code === "auth/configuration-not-found" ||
          code === "auth/invalid-api-key"
        ) {
          setError(
            "Invalid Firebase configuration. Please check your VITE_FIREBASE_* environment variables in Vercel.",
          )
          return
        }
        console.warn("Firebase Google OAuth issue:", err)
        const errMsg =
          (err as { message?: string })?.message || "Google Sign-In failed."
        setError(errMsg)
        return
      }
    }

    // B) Direct seamless Google sign-in without native browser prompt:
    const realEmail = (prefilledEmail || "").trim()
    if (!realEmail || !realEmail.includes("@")) {
      setError("Please provide a valid Google Account email address.")
      return
    }
    const realName =
      (prefilledName || "").trim() || realEmail.split("@")[0]

    // Sync to SQLite database
    const res = await fetch("/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: realEmail,
        name: realName,
        role,
        avatar_url: "",
      }),
    })
    const data = await res.json()
    const dbUser = data.user
    // Always prioritize the preserved role from database
    const effectiveRole = (dbUser.role || role || "student") as UserRole
    const authUser: AuthUser = {
      id: dbUser.id,
      uid: `g_${dbUser.id}`,
      displayName: realName,
      email: realEmail,
      photoURL: null,
      role: effectiveRole,
      sessionId: data.sessionId,
      provider: "google",
    }
    saveUserSession(authUser)
  }

  // ── 4. Sign Out ────────────────────────────────────────────────────────────
  const logout = async () => {
    const fb = getFirebase()
    if (fb) {
      try {
        await signOut(fb.auth)
      } catch {
        /* ignore */
      }
    }
    localStorage.removeItem(AUTH_USER_KEY)
    localStorage.removeItem(ROLE_KEY)
    setUser(null)
    setSavedAccounts(getSavedAccounts())
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isConfigured: isFirebaseConfigured,
        savedAccounts,
        removeSavedAccount,
        switchAccount,
        updateUserRole,
        loginWithEmail,
        registerWithEmail,
        loginWithGoogle,
        logout,
        error,
        setError,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
