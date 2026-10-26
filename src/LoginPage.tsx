/**
 * LoginPage — Full-Featured Authentication Portal with Remembered Accounts
 *
 * Supports:
 * - Two separate roles: 🎓 Student and 👩‍🏫 Teacher
 * - Remembered / Saved Accounts for quick 1-click re-login after logout
 * - Option to log in with a new email address or switch accounts
 * - Real Email & Password Login and Account Registration
 * - Real Google Sign-In with remembered account support
 * - Clean deletion of remembered accounts on demand
 */
import React, { useState, useEffect } from "react"
import { useAuth, type UserRole, type SavedAccount } from "./AuthContext"

function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <path
        d="M43.6 20.5h-19.5v7.5h11.3C33.9 33.4 29.4 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.4-5.4C33.5 6.5 29 4.5 24 4.5 12.7 4.5 3.5 13.7 3.5 25S12.7 45.5 24 45.5c10.5 0 19.5-7.5 19.5-19.5 0-1.3-.1-2.5-.3-3.5z"
        fill="#FFC107"
      />
      <path
        d="M6.3 15.2l6.3 4.6C14.1 15.8 18.7 13 24 13c3 0 5.8 1.1 7.9 3l5.4-5.4C33.5 6.5 29 4.5 24 4.5c-7.6 0-14.2 4.4-17.7 10.7z"
        fill="#FF3D00"
      />
      <path
        d="M24 45.5c5 0 9.5-1.7 13-4.5l-6-5.2C29 37.5 26.6 38.5 24 38.5c-5.3 0-9.8-3.6-11.4-8.5L6.3 34.8C9.8 41.1 16.4 45.5 24 45.5z"
        fill="#4CAF50"
      />
      <path
        d="M43.6 20.5H24v7.5h11.3c-.8 2.3-2.3 4.2-4.3 5.5l6 5.2c3.5-3.3 5.5-8.2 5.5-14 0-1.3-.1-2.5-.3-3.5-.1-.3-.1 0 0 0z"
        fill="#1976D2"
      />
    </svg>
  )
}

export default function LoginPage() {
  const {
    loginWithEmail,
    registerWithEmail,
    loginWithGoogle,
    savedAccounts,
    removeSavedAccount,
    switchAccount,
    error,
    setError,
  } = useAuth()

  const [role, setRole] = useState<UserRole>("student")
  const [mode, setMode] = useState<"login" | "register">("login")

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [googleModalOpen, setGoogleModalOpen] = useState(false)
  const [googleEmail, setGoogleEmail] = useState("")
  const [googleName, setGoogleName] = useState("")

  // View state: 'saved' (pick from remembered accounts) vs 'form' (enter email/password or google)
  const [viewState, setViewState] = useState<"saved" | "form">(() =>
    savedAccounts.length > 0 ? "saved" : "form",
  )
  const [selectedAccount, setSelectedAccount] = useState<SavedAccount | null>(
    null,
  )

  // Keep viewState in sync if all saved accounts are removed
  useEffect(() => {
    if (savedAccounts.length === 0 && viewState === "saved") {
      setViewState("form")
      setSelectedAccount(null)
    }
  }, [savedAccounts.length, viewState])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const targetEmail = selectedAccount ? selectedAccount.email : email.trim()
    const targetRole = selectedAccount ? selectedAccount.role : role

    if (!targetEmail || !password.trim()) {
      setError("Please fill in both email and password.")
      return
    }
    if (mode === "register" && !name.trim()) {
      setError("Please provide your full name.")
      return
    }

    setSubmitting(true)
    try {
      if (mode === "register") {
        await registerWithEmail(name.trim(), targetEmail, password, targetRole)
      } else {
        await loginWithEmail(targetEmail, password, targetRole)
      }
    } catch {
      // error handled in AuthContext
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogleLogin = async (
    prefilledEmail?: string,
    prefilledName?: string,
    explicitRole?: UserRole,
  ) => {
    setSubmitting(true)
    try {
      const targetRole = explicitRole || (selectedAccount ? selectedAccount.role : role)
      await loginWithGoogle(targetRole, prefilledEmail, prefilledName)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSelectSavedAccount = (acc: SavedAccount) => {
    setError(null)
    setRole(acc.role)
    if (acc.provider === "google") {
      // Direct 1-click re-login for Google accounts keeping exact saved role!
      handleGoogleLogin(acc.email, acc.displayName, acc.role)
    } else if (acc.sessionId) {
      // Direct 1-click session switch like Google account switcher!
      switchAccount(acc)
    } else {
      // Email account: prepare password field with locked saved role
      setSelectedAccount(acc)
      setEmail(acc.email)
      setPassword("")
    }
  }

  const handleUseNewEmail = () => {
    setSelectedAccount(null)
    setViewState("form")
    setEmail("")
    setPassword("")
    setError(null)
  }

  const isTeacher = role === "teacher"
  const themeColor = isTeacher ? "#34d399" : "#818cf8"
  const gradient = isTeacher
    ? "linear-gradient(135deg, #065f46 0%, #047857 100%)"
    : "linear-gradient(135deg, #4338ca 0%, #6d28d9 100%)"

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(circle at 20% 30%, rgba(108,92,231,0.22), transparent 40%)," +
          "radial-gradient(circle at 80% 70%, rgba(34,211,238,0.16), transparent 40%)," +
          "linear-gradient(135deg, #08091a 0%, #10152e 55%, #151842)",
        padding: "32px 18px",
        fontFamily: '"Manrope", sans-serif',
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative background grid */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px)," +
            "linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          zIndex: 0,
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: 480,
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {/* Brand Header */}
        <div
          style={{
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: 15,
              background: "linear-gradient(145deg, #6c5ce7, #3b82f6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 10px 28px rgba(108,92,231,0.45)",
              transform: "rotate(-8deg)",
            }}
          >
            <svg
              width="25"
              height="25"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m12 3-1.7 4.3L6 9l4.3 1.7L12 15l1.7-4.3L18 9l-4.3-1.7L12 3Z" />
              <path d="m5 14-.8 2.2L2 17l2.2.8L5 20l.8-2.2L8 17l-2.2-.8L5 14Z" />
            </svg>
          </div>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 26,
                fontWeight: 800,
                color: "#f2f4ff",
                letterSpacing: "-0.8px",
              }}
            >
              LearnSphere{" "}
              <em style={{ fontStyle: "normal", color: "#9d8bff" }}>AI</em>
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#8d97bb" }}>
              AI-Powered Personalized Learning Platform
            </p>
          </div>
        </div>

        {/* ── CASE 1: Pick from Saved / Remembered Accounts ────────────────── */}
        {viewState === "saved" && !selectedAccount && (
          <div
            style={{
              borderRadius: 20,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.045)",
              backdropFilter: "blur(16px)",
              boxShadow: "0 25px 60px rgba(0,0,0,0.45)",
              padding: "26px 28px",
              display: "flex",
              flexDirection: "column",
              gap: 18,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                paddingBottom: 14,
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "1px",
                    color: "#818cf8",
                    textTransform: "uppercase",
                  }}
                >
                  Saved Profiles
                </span>
                <h2
                  style={{
                    margin: "2px 0 0",
                    fontSize: 20,
                    fontWeight: 800,
                    color: "#f2f4ff",
                    letterSpacing: "-0.4px",
                  }}
                >
                  Choose an account
                </h2>
              </div>
              <span
                style={{
                  fontSize: 11,
                  color: "#8d97bb",
                  background: "rgba(255,255,255,0.06)",
                  padding: "4px 10px",
                  borderRadius: 8,
                }}
              >
                {savedAccounts.length} saved
              </span>
            </div>

            {error && (
              <div
                style={{
                  background: "rgba(239,68,68,0.12)",
                  border: "1px solid rgba(239,68,68,0.35)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontSize: 12,
                  color: "#fca5a5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>⚠ {error}</span>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  style={{
                    border: 0,
                    background: "none",
                    color: "#fca5a5",
                    cursor: "pointer",
                  }}
                >
                  ×
                </button>
              </div>
            )}

            {/* List of saved accounts */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {savedAccounts.map((acc) => {
                const accTeacher = acc.role === "teacher"
                const accColor = accTeacher ? "#10b981" : "#6366f1"
                return (
                  <div
                    key={acc.email}
                    onClick={() => handleSelectSavedAccount(acc)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.09)",
                      background: "rgba(255,255,255,0.04)",
                      cursor: submitting ? "wait" : "pointer",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background =
                        "rgba(255,255,255,0.08)"
                      e.currentTarget.style.borderColor = accColor
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background =
                        "rgba(255,255,255,0.04)"
                      e.currentTarget.style.borderColor =
                        "rgba(255,255,255,0.09)"
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        overflow: "hidden",
                      }}
                    >
                      {acc.photoURL ? (
                        <img
                          src={acc.photoURL}
                          alt={acc.displayName}
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: "50%",
                            objectFit: "cover",
                            border: `2px solid ${accColor}`,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: "50%",
                            background: accTeacher
                              ? "linear-gradient(135deg, #059669, #10b981)"
                              : "linear-gradient(135deg, #4f46e5, #7c3aed)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#fff",
                            fontWeight: 700,
                            fontSize: 14,
                            flexShrink: 0,
                          }}
                        >
                          {acc.displayName.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div style={{ overflow: "hidden" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <strong
                            style={{
                              fontSize: 13,
                              color: "#f2f4ff",
                              display: "block",
                              textOverflow: "ellipsis",
                              overflow: "hidden",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {acc.displayName}
                          </strong>
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              textTransform: "uppercase",
                              padding: "2px 6px",
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
                            fontSize: 12,
                            color: "#8d97bb",
                            display: "block",
                            textOverflow: "ellipsis",
                            overflow: "hidden",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {acc.email}
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          padding: "3px 8px",
                          borderRadius: 6,
                          background: "rgba(255,255,255,0.08)",
                          color: "#c7d2fe",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        {acc.provider === "google" ? (
                          <GoogleIcon size={12} />
                        ) : (
                          "✉"
                        )}{" "}
                        {acc.provider === "google" ? "Google" : "Email"}
                      </span>
                      <button
                        type="button"
                        title="Remove remembered account"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeSavedAccount(acc.email)
                        }}
                        style={{
                          border: 0,
                          background: "transparent",
                          color: "#9ca3af",
                          cursor: "pointer",
                          fontSize: 14,
                          padding: 4,
                          borderRadius: 4,
                          lineHeight: 1,
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.color = "#ef4444")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.color = "#9ca3af")
                        }
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Action to log in with a new email */}
            <button
              type="button"
              onClick={handleUseNewEmail}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                width: "100%",
                padding: "12px 18px",
                borderRadius: 11,
                border: "1px dashed rgba(255,255,255,0.2)",
                background: "rgba(255,255,255,0.03)",
                color: "#e0e7ff",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all .2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(255,255,255,0.07)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "rgba(255,255,255,0.03)")
              }
            >
              <span>➕</span>
              <span>Use another account / Log in with new email</span>
            </button>
          </div>
        )}

        {/* ── CASE 2: Selected Remembered Account (Password Prompt) ──────────── */}
        {selectedAccount && (
          <div
            style={{
              borderRadius: 20,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.045)",
              backdropFilter: "blur(16px)",
              boxShadow: "0 25px 60px rgba(0,0,0,0.45)",
              padding: "26px 28px",
              display: "flex",
              flexDirection: "column",
              gap: 18,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                paddingBottom: 14,
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "1px",
                    color: themeColor,
                    textTransform: "uppercase",
                  }}
                >
                  {isTeacher ? "Teacher Portal" : "Student Portal"}
                </span>
                <h2
                  style={{
                    margin: "2px 0 0",
                    fontSize: 20,
                    fontWeight: 800,
                    color: "#f2f4ff",
                    letterSpacing: "-0.4px",
                  }}
                >
                  Welcome back
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAccount(null)}
                style={{
                  border: 0,
                  background: "rgba(255,255,255,0.06)",
                  color: "#a5b4fc",
                  fontSize: 11,
                  padding: "5px 10px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Switch account
              </button>
            </div>

            {/* Selected account summary card */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                background: "rgba(255,255,255,0.05)",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: gradient,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {selectedAccount.displayName.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <strong
                  style={{ fontSize: 13, color: "#fff", display: "block" }}
                >
                  {selectedAccount.displayName}
                </strong>
                <span style={{ fontSize: 12, color: "#9ca3af" }}>
                  {selectedAccount.email}
                </span>
              </div>
            </div>

            {error && (
              <div
                style={{
                  background: "rgba(239,68,68,0.12)",
                  border: "1px solid rgba(239,68,68,0.35)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontSize: 12,
                  color: "#fca5a5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>⚠ {error}</span>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  style={{
                    border: 0,
                    background: "none",
                    color: "#fca5a5",
                    cursor: "pointer",
                  }}
                >
                  ×
                </button>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              style={{ display: "flex", flexDirection: "column", gap: 14 }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label
                  style={{ fontSize: 11, fontWeight: 700, color: "#c7d2fe" }}
                >
                  Enter Password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={submitting}
                    autoFocus
                    required
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.14)",
                      borderRadius: 10,
                      padding: "11px 40px 11px 14px",
                      color: "#fff",
                      fontSize: 13,
                      outline: "none",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: "absolute",
                      right: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: 0,
                      color: "#9ca3af",
                      fontSize: 13,
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    {showPassword ? "🙈" : "👁"}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  marginTop: 4,
                  padding: "13px 20px",
                  borderRadius: 11,
                  border: 0,
                  background: gradient,
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: submitting ? "wait" : "pointer",
                  boxShadow: isTeacher
                    ? "0 8px 20px rgba(16,185,129,0.3)"
                    : "0 8px 20px rgba(99,102,241,0.3)",
                }}
              >
                {submitting
                  ? "Signing In..."
                  : `Sign In as ${selectedAccount.displayName}`}
              </button>
            </form>

            <button
              type="button"
              onClick={handleUseNewEmail}
              style={{
                border: 0,
                background: "none",
                color: "#8d97bb",
                fontSize: 12,
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              Sign in with a different email address →
            </button>
          </div>
        )}

        {/* ── CASE 3: Standard Email & Password Form or New Email Login ─────── */}
        {viewState === "form" && !selectedAccount && (
          <>
            {/* If there are saved accounts, give an easy toggle back */}
            {savedAccounts.length > 0 && (
              <button
                type="button"
                onClick={() => setViewState("saved")}
                style={{
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.06)",
                  borderRadius: 10,
                  padding: "9px 14px",
                  color: "#c7d2fe",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  transition: "all .2s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(255,255,255,0.1)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "rgba(255,255,255,0.06)")
                }
              >
                <span>←</span> Back to saved accounts ({savedAccounts.length})
              </button>
            )}

            {/* Role Selector Tabs (Student vs Teacher) */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                padding: 5,
                borderRadius: 14,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setRole("student")
                  setError(null)
                }}
                style={{
                  border: 0,
                  borderRadius: 10,
                  padding: "11px 16px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all .2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  background: !isTeacher
                    ? "linear-gradient(135deg, #4338ca, #6d28d9)"
                    : "transparent",
                  color: !isTeacher ? "#fff" : "#9aa5c4",
                  boxShadow: !isTeacher
                    ? "0 4px 14px rgba(99,102,241,0.3)"
                    : "none",
                }}
              >
                <span>🎓</span> Student Portal
              </button>
              <button
                type="button"
                onClick={() => {
                  setRole("teacher")
                  setError(null)
                }}
                style={{
                  border: 0,
                  borderRadius: 10,
                  padding: "11px 16px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all .2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  background: isTeacher
                    ? "linear-gradient(135deg, #065f46, #047857)"
                    : "transparent",
                  color: isTeacher ? "#fff" : "#9aa5c4",
                  boxShadow: isTeacher
                    ? "0 4px 14px rgba(16,185,129,0.3)"
                    : "none",
                }}
              >
                <span>👩‍🏫</span> Teacher Portal
              </button>
            </div>

            {/* Main Form Card */}
            <div
              style={{
                borderRadius: 20,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.045)",
                backdropFilter: "blur(16px)",
                boxShadow: "0 25px 60px rgba(0,0,0,0.45)",
                padding: "26px 28px",
                display: "flex",
                flexDirection: "column",
                gap: 18,
              }}
            >
              {/* Card Title & Mode Toggle (Sign In / Register) */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  paddingBottom: 14,
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: "1px",
                      color: themeColor,
                      textTransform: "uppercase",
                    }}
                  >
                    {isTeacher ? "Teacher Account" : "Student Account"}
                  </span>
                  <h2
                    style={{
                      margin: "2px 0 0",
                      fontSize: 20,
                      fontWeight: 800,
                      color: "#f2f4ff",
                      letterSpacing: "-0.4px",
                    }}
                  >
                    {mode === "login" ? "Sign In" : "Create Account"}
                  </h2>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    background: "rgba(0,0,0,0.25)",
                    padding: 3,
                    borderRadius: 8,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login")
                      setError(null)
                    }}
                    style={{
                      border: 0,
                      borderRadius: 6,
                      padding: "5px 11px",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      background:
                        mode === "login"
                          ? "rgba(255,255,255,0.14)"
                          : "transparent",
                      color: mode === "login" ? "#fff" : "#8d97bb",
                    }}
                  >
                    Login
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("register")
                      setError(null)
                    }}
                    style={{
                      border: 0,
                      borderRadius: 6,
                      padding: "5px 11px",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      background:
                        mode === "register"
                          ? "rgba(255,255,255,0.14)"
                          : "transparent",
                      color: mode === "register" ? "#fff" : "#8d97bb",
                    }}
                  >
                    Sign Up
                  </button>
                </div>
              </div>

              {/* Error Banner */}
              {error && (
                <div
                  style={{
                    background: "rgba(239,68,68,0.12)",
                    border: "1px solid rgba(239,68,68,0.35)",
                    borderRadius: 10,
                    padding: "10px 14px",
                    fontSize: 12,
                    color: "#fca5a5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <span>⚠ {error}</span>
                  <button
                    type="button"
                    onClick={() => setError(null)}
                    style={{
                      border: 0,
                      background: "none",
                      color: "#fca5a5",
                      cursor: "pointer",
                      fontSize: 14,
                    }}
                  >
                    ×
                  </button>
                </div>
              )}

              {/* Credentials Form */}
              <form
                onSubmit={handleSubmit}
                style={{ display: "flex", flexDirection: "column", gap: 14 }}
              >
                {mode === "register" && (
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 6 }}
                  >
                    <label
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#c7d2fe",
                      }}
                    >
                      Full Name
                    </label>
                    <input
                      type="text"
                      placeholder={
                        isTeacher ? "Dr. Sharma / Prof. John" : "Your full name"
                      }
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={submitting}
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.14)",
                        borderRadius: 10,
                        padding: "11px 14px",
                        color: "#fff",
                        fontSize: 13,
                        outline: "none",
                      }}
                    />
                  </div>
                )}

                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  <label
                    style={{ fontSize: 11, fontWeight: 700, color: "#c7d2fe" }}
                  >
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="youremail@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={submitting}
                    autoComplete="email"
                    required
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.14)",
                      borderRadius: 10,
                      padding: "11px 14px",
                      color: "#fff",
                      fontSize: 13,
                      outline: "none",
                    }}
                  />
                </div>

                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <label
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#c7d2fe",
                      }}
                    >
                      Password
                    </label>
                    {mode === "login" && (
                      <span
                        style={{
                          fontSize: 11,
                          color: "#818cf8",
                          cursor: "pointer",
                        }}
                        onClick={() =>
                          alert(
                            "Enter your email and password to log in. If you don't have an account, click 'Sign Up' tab!",
                          )
                        }
                      >
                        Forgot?
                      </span>
                    )}
                  </div>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={submitting}
                      autoComplete={
                        mode === "login" ? "current-password" : "new-password"
                      }
                      required
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.14)",
                        borderRadius: 10,
                        padding: "11px 40px 11px 14px",
                        color: "#fff",
                        fontSize: 13,
                        outline: "none",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: "absolute",
                        right: 12,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: 0,
                        color: "#9ca3af",
                        fontSize: 13,
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      {showPassword ? "🙈" : "👁"}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    marginTop: 6,
                    padding: "13px 20px",
                    borderRadius: 11,
                    border: 0,
                    background: gradient,
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: submitting ? "wait" : "pointer",
                    boxShadow: isTeacher
                      ? "0 8px 20px rgba(16,185,129,0.3)"
                      : "0 8px 20px rgba(99,102,241,0.3)",
                    transition: "transform .15s",
                  }}
                >
                  {submitting
                    ? "Processing..."
                    : mode === "login"
                      ? `Sign In as ${isTeacher ? "Teacher" : "Student"}`
                      : `Create ${isTeacher ? "Teacher" : "Student"} Account`}
                </button>
              </form>

              {/* Divider */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  margin: "2px 0",
                }}
              >
                <div
                  style={{
                    flex: 1,
                    height: 1,
                    background: "rgba(255,255,255,0.1)",
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    color: "#8d97bb",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  or
                </span>
                <div
                  style={{
                    flex: 1,
                    height: 1,
                    background: "rgba(255,255,255,0.1)",
                  }}
                />
              </div>

              {/* Google Sign-In Button */}
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  if (email.trim().includes("@")) {
                    handleGoogleLogin(email.trim(), name.trim(), role)
                  } else {
                    setGoogleEmail(email.trim())
                    setGoogleName(name.trim())
                    setGoogleModalOpen(true)
                  }
                }}
                disabled={submitting}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  width: "100%",
                  padding: "12px 18px",
                  borderRadius: 11,
                  border: "1px solid rgba(255,255,255,0.16)",
                  background: "rgba(255,255,255,0.08)",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: submitting ? "wait" : "pointer",
                  transition: "all .2s",
                }}
              >
                <GoogleIcon size={18} />
                <span>Sign in with Google</span>
              </button>
            </div>
          </>
        )}

        {/* Footer info */}
        <p
          style={{
            textAlign: "center",
            fontSize: 11,
            color: "#6b7280",
            margin: 0,
          }}
        >
          Accounts are automatically remembered on this browser for fast
          re-login.
          <br />
          Students and Teachers have separate dashboards &amp; permissions.
        </p>
      </div>

      {/* In-App Google Sign-In Modal (Eliminates ugly browser window.prompt) */}
      {googleModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(5, 7, 20, 0.78)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setGoogleModalOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 420,
              background: "#0d1124",
              border: "1px solid rgba(255, 255, 255, 0.14)",
              borderRadius: 20,
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.65)",
              padding: "26px 28px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                paddingBottom: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    padding: 8,
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <GoogleIcon size={20} />
                </div>
                <div>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 16,
                      fontWeight: 800,
                      color: "#f3f4f6",
                      letterSpacing: "-0.3px",
                    }}
                  >
                    Sign in with Google
                  </h3>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: isTeacher ? "#34d399" : "#818cf8",
                    }}
                  >
                    Continuing as {isTeacher ? "Teacher" : "Student"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGoogleModalOpen(false)}
                style={{
                  background: "transparent",
                  border: 0,
                  color: "#9ca3af",
                  fontSize: 18,
                  cursor: "pointer",
                  padding: 4,
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: 0, fontSize: 12, color: "#9ca3af", lineHeight: 1.5 }}>
              Enter your Google Account email to sign in directly without passwords.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                const trimmedEmail = googleEmail.trim()
                if (!trimmedEmail || !trimmedEmail.includes("@")) {
                  setError("Please enter a valid Google Account email.")
                  return
                }
                setGoogleModalOpen(false)
                handleGoogleLogin(
                  trimmedEmail,
                  googleName.trim() || trimmedEmail.split("@")[0],
                  role,
                )
              }}
              style={{ display: "flex", flexDirection: "column", gap: 14 }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label
                  style={{ fontSize: 11, fontWeight: 700, color: "#c7d2fe" }}
                >
                  Google Account Email *
                </label>
                <input
                  type="email"
                  placeholder="name@gmail.com"
                  value={googleEmail}
                  onChange={(e) => setGoogleEmail(e.target.value)}
                  autoFocus
                  required
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.14)",
                    borderRadius: 10,
                    padding: "11px 14px",
                    color: "#fff",
                    fontSize: 13,
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label
                  style={{ fontSize: 11, fontWeight: 700, color: "#c7d2fe" }}
                >
                  Display Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder={
                    googleEmail.includes("@")
                      ? googleEmail.split("@")[0]
                      : "Your Name"
                  }
                  value={googleName}
                  onChange={(e) => setGoogleName(e.target.value)}
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.14)",
                    borderRadius: 10,
                    padding: "11px 14px",
                    color: "#fff",
                    fontSize: 13,
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setGoogleModalOpen(false)}
                  style={{
                    flex: 1,
                    padding: "11px 16px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.14)",
                    background: "rgba(255,255,255,0.06)",
                    color: "#d1d5db",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    flex: 1.5,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: "11px 16px",
                    borderRadius: 10,
                    border: 0,
                    background: gradient,
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: submitting ? "wait" : "pointer",
                  }}
                >
                  <GoogleIcon size={16} />
                  <span>Continue</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
