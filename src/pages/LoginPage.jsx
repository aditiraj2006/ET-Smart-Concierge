/**
 * src/pages/LoginPage.jsx
 * Firebase-powered sign-in page matching the ET Smart Concierge glassmorphism aesthetic.
 */
import React, { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();

  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGoogle = async () => {
    setError("");
    setLoading(true);
    try {
      await signInWithGoogle();
      navigate("/dashboard");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmail = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "signup") {
        await signUpWithEmail(email, password);
        navigate("/onboarding");
      } else {
        await signInWithEmail(email, password);
        navigate("/dashboard");
      }
    } catch (e) {
      setError(
        e.code === "auth/user-not-found"
          ? "No account found. Create one below."
          : e.code === "auth/wrong-password"
          ? "Incorrect password."
          : e.code === "auth/email-already-in-use"
          ? "Email already in use. Sign in instead."
          : e.message
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      {/* Animated gradient background */}
      <motion.div
        style={styles.gradientMesh}
        animate={{ x: ["0%", "-5%"], y: ["0%", "-5%"], rotate: [0, 5] }}
        transition={{ duration: 20, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
      />

      <motion.div
        style={styles.card}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Logo */}
        <div style={styles.logo}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="var(--gold)" />
          </svg>
          <span style={styles.logoText}>ET Smart Concierge</span>
        </div>

        <h1 style={styles.title}>{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
        <p style={styles.subtitle}>Your AI-powered financial co-pilot</p>

        {/* Google SSO */}
        <motion.button
          style={styles.googleBtn}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleGoogle}
          disabled={loading}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </motion.button>

        <div style={styles.divider}>
          <div style={styles.dividerLine} />
          <span style={styles.dividerText}>or</span>
          <div style={styles.dividerLine} />
        </div>

        {/* Email / Password form */}
        <form onSubmit={handleEmail} style={styles.form}>
          <input
            style={styles.input}
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <input
            style={styles.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
          {error && <p style={styles.error}>{error}</p>}
          <motion.button
            type="submit"
            style={{ ...styles.submitBtn, opacity: loading ? 0.7 : 1 }}
            whileHover={{ scale: loading ? 1 : 1.02 }}
            whileTap={{ scale: loading ? 1 : 0.98 }}
            disabled={loading}
          >
            {loading ? "Please wait…" : mode === "signin" ? "Sign In" : "Create Account"}
          </motion.button>
        </form>

        {/* Toggle mode */}
        <p style={styles.toggleText}>
          {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            style={styles.toggleBtn}
            onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); }}
          >
            {mode === "signin" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </motion.div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "var(--bg-base)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
    fontFamily: "var(--font-body)",
  },
  gradientMesh: {
    position: "absolute",
    inset: "-50%",
    background:
      "radial-gradient(ellipse at 20% 50%, rgba(245,166,35,0.12) 0%, transparent 50%), " +
      "radial-gradient(ellipse at 80% 20%, rgba(0,212,184,0.08) 0%, transparent 50%)",
    zIndex: 0,
  },
  card: {
    position: "relative",
    zIndex: 1,
    width: "100%",
    maxWidth: 440,
    margin: "0 1rem",
    padding: "2.5rem",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 24,
    backdropFilter: "blur(20px)",
    boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: "0.6rem",
    marginBottom: "2rem",
    justifyContent: "center",
  },
  logoText: {
    fontFamily: "var(--font-display)",
    color: "#fff",
    fontSize: "1.1rem",
    fontWeight: 600,
  },
  title: {
    fontFamily: "var(--font-display)",
    color: "#fff",
    fontSize: "1.75rem",
    fontWeight: 700,
    margin: "0 0 0.4rem",
    textAlign: "center",
  },
  subtitle: {
    color: "rgba(255,255,255,0.45)",
    fontSize: "0.9rem",
    textAlign: "center",
    margin: "0 0 2rem",
  },
  googleBtn: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.75rem",
    padding: "0.85rem",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 12,
    color: "#fff",
    fontFamily: "var(--font-body)",
    fontSize: "0.95rem",
    fontWeight: 500,
    cursor: "pointer",
    transition: "background 0.2s",
  },
  divider: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    margin: "1.5rem 0",
  },
  dividerLine: {
    flex: 1,
    height: 1,
    background: "rgba(255,255,255,0.1)",
  },
  dividerText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: "0.8rem",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "0.9rem",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "0.85rem 1rem",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 12,
    color: "#fff",
    fontFamily: "var(--font-body)",
    fontSize: "0.95rem",
    outline: "none",
    transition: "border-color 0.2s",
  },
  error: {
    color: "#ff6b6b",
    fontSize: "0.85rem",
    margin: 0,
    padding: "0.5rem 0.75rem",
    background: "rgba(255,107,107,0.08)",
    borderRadius: 8,
  },
  submitBtn: {
    width: "100%",
    padding: "0.9rem",
    background: "linear-gradient(135deg, var(--gold) 0%, #e09225 100%)",
    border: "none",
    borderRadius: 12,
    color: "#1a1205",
    fontFamily: "var(--font-body)",
    fontSize: "0.95rem",
    fontWeight: 700,
    cursor: "pointer",
    transition: "opacity 0.2s",
    marginTop: "0.25rem",
  },
  toggleText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: "0.85rem",
    textAlign: "center",
    marginTop: "1.5rem",
    marginBottom: 0,
  },
  toggleBtn: {
    background: "none",
    border: "none",
    color: "var(--gold)",
    cursor: "pointer",
    fontFamily: "var(--font-body)",
    fontSize: "0.85rem",
    fontWeight: 600,
    padding: 0,
    textDecoration: "underline",
  },
};
