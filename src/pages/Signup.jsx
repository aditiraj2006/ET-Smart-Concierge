/**
 * src/pages/Signup.jsx
 * Firebase email/password + Google sign-up page.
 * Design: same #040B18 dark, gold #F5A623, teal #00D4B8, glassmorphism.
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import {
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
} from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';
import AnimatedBg from '../components/shared/AnimatedBg';
import GlassCard from '../components/shared/GlassCard';
import GoldButton from '../components/shared/GoldButton';

const mapFirebaseError = (code) =>
  ({
    'auth/email-already-in-use': 'An account with this email already exists',
    'auth/weak-password':        'Password must be at least 6 characters',
    'auth/invalid-email':        'Please enter a valid email',
    'auth/too-many-requests':    'Too many attempts. Try again later',
  }[code] || 'Something went wrong. Please try again');

// ── Password strength ────────────────────────────────────────────────────────
function getStrength(pw) {
  if (!pw) return { score: 0, label: '', color: 'transparent' };
  let score = 0;
  if (pw.length >= 8)          score++;
  if (/\d/.test(pw))           score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const map = [
    { label: '',       color: 'transparent' },
    { label: 'Weak',   color: '#ef4444' },
    { label: 'Medium', color: '#f97316' },
    { label: 'Strong', color: '#22c55e' },
  ];
  return { score, ...map[score] };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: 18, height: 18,
      border: '2px solid rgba(4,11,24,0.3)',
      borderTopColor: '#040B18',
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
      verticalAlign: 'middle',
    }} />
  );
}

function EyeIcon({ open }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Signup() {
  const navigate = useNavigate();
  const [fullName, setFullName]           = useState('');
  const [email, setEmail]                 = useState('');
  const [password, setPassword]           = useState('');
  const [confirmPassword, setConfirmPw]   = useState('');
  const [showPw, setShowPw]               = useState(false);
  const [showConfirm, setShowConfirm]     = useState(false);
  const [loading, setLoading]             = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError]                 = useState('');

  const strength = getStrength(password);

  // ── Google sign-up ────────────────────────────────────────────────────────
  const handleGoogleSignup = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const token = await result.user.getIdToken();
      localStorage.setItem('firebase_token', token);
      localStorage.setItem('user_id', result.user.uid);
      // All Google sign-in goes to onboarding (server will redirect if already done)
      navigate('/onboarding');
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') setError(mapFirebaseError(err.code));
    } finally {
      setGoogleLoading(false);
    }
  };

  // ── Email sign-up ─────────────────────────────────────────────────────────
  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    setLoading(true);
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName: fullName });
      const token = await result.user.getIdToken();
      localStorage.setItem('firebase_token', token);
      localStorage.setItem('user_id', result.user.uid);
      navigate('/onboarding');
    } catch (err) {
      setError(mapFirebaseError(err.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={S.page}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .auth-input { transition: border-color 0.2s, box-shadow 0.2s; }
        .auth-input:focus { border-color: var(--gold) !important; box-shadow: 0 0 0 3px rgba(245,166,35,0.15) !important; outline: none; }
        .google-btn:hover { background: rgba(255,255,255,0.13) !important; transform: translateY(-1px); }
        .google-btn:active { transform: translateY(0); }
      `}</style>

      <AnimatedBg />

      <motion.div
        style={S.wrapper}
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Logo */}
        <div style={S.logo}>
          <motion.div
            style={S.monogram}
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="var(--gold)"/>
            </svg>
            <span style={S.monogramText}>ET</span>
          </motion.div>
          <div>
            <div style={S.logoName}>ET Smart Concierge</div>
            <div style={S.tagline}>Your Financial Co-Pilot</div>
          </div>
        </div>

        {/* Card */}
        <GlassCard style={S.card}>
          <h1 style={S.heading}>Create Your Account</h1>

          {/* Google Button — at top */}
          <motion.button
            className="google-btn"
            style={S.googleBtn}
            onClick={handleGoogleSignup}
            disabled={googleLoading}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            {googleLoading ? <Spinner /> : <GoogleIcon />}
            <span>{googleLoading ? 'Connecting…' : 'Sign up with Google'}</span>
          </motion.button>

          {/* Divider */}
          <div style={S.divider}>
            <div style={S.divLine} />
            <span style={S.divText}>or</span>
            <div style={S.divLine} />
          </div>

          {/* Email form */}
          <form onSubmit={handleSignup} style={S.form} noValidate>
            <input
              className="auth-input"
              style={S.input}
              type="text"
              placeholder="Full Name"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              required
              autoComplete="name"
            />
            <input
              className="auth-input"
              style={S.input}
              type="email"
              placeholder="Email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />

            {/* Password + strength */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ position: 'relative' }}>
                <input
                  className="auth-input"
                  style={S.input}
                  type={showPw ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  style={S.eyeBtn}
                  tabIndex={-1}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon open={showPw} />
                </button>
              </div>

              {/* Strength bar */}
              <AnimatePresence>
                {password && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={S.strengthTrack}>
                      {[1, 2, 3].map(i => (
                        <motion.div
                          key={i}
                          style={{
                            flex: 1,
                            height: '100%',
                            borderRadius: 4,
                            background: i <= strength.score ? strength.color : 'rgba(255,255,255,0.08)',
                            transition: 'background 0.3s',
                          }}
                        />
                      ))}
                    </div>
                    <div style={{ ...S.strengthLabel, color: strength.color }}>{strength.label}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Confirm password */}
            <div style={{ position: 'relative' }}>
              <input
                className="auth-input"
                style={{
                  ...S.input,
                  borderColor: confirmPassword && confirmPassword !== password
                    ? 'rgba(239,68,68,0.5)'
                    : undefined,
                }}
                type={showConfirm ? 'text' : 'password'}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={e => setConfirmPw(e.target.value)}
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                style={S.eyeBtn}
                tabIndex={-1}
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
              >
                <EyeIcon open={showConfirm} />
              </button>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  style={S.error}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: [0, -6, 6, -4, 4, 0] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35 }}
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <GoldButton
              style={{ width: '100%', padding: '0.85rem', fontSize: '0.95rem', fontWeight: 700, opacity: loading ? 0.75 : 1 }}
              onClick={() => {}}
            >
              {loading ? <Spinner /> : 'Create Account'}
            </GoldButton>
          </form>

          {/* Terms */}
          <p style={S.terms}>
            By signing up you agree to ET's{' '}
            <span style={{ color: 'var(--text-secondary)' }}>Terms of Service</span>
          </p>

          {/* Footer */}
          <p style={S.footer}>
            Already have an account?{' '}
            <Link to="/login" style={S.authLink}>Sign In</Link>
          </p>
        </GlassCard>
      </motion.div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const S = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg-base)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    fontFamily: 'var(--font-body)',
    padding: '1rem',
  },
  wrapper: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: 420,
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.9rem',
  },
  monogram: {
    width: 48,
    height: 48,
    borderRadius: 14,
    background: 'rgba(245,166,35,0.12)',
    border: '1px solid rgba(245,166,35,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.2rem',
    flexShrink: 0,
  },
  monogramText: {
    fontFamily: 'var(--font-display)',
    color: 'var(--gold)',
    fontWeight: 800,
    fontSize: '0.9rem',
  },
  logoName: {
    fontFamily: 'var(--font-display)',
    color: 'var(--text-primary)',
    fontWeight: 700,
    fontSize: '1.05rem',
    lineHeight: 1.2,
  },
  tagline: {
    color: 'var(--gold)',
    fontSize: '0.78rem',
    fontWeight: 500,
    letterSpacing: '0.02em',
  },
  card: {
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  heading: {
    fontFamily: 'var(--font-display)',
    fontSize: '1.7rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: 0,
  },
  googleBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.7rem',
    padding: '0.82rem 1rem',
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.13)',
    borderRadius: 12,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-body)',
    fontSize: '0.92rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 0.2s, transform 0.15s',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  divLine: {
    flex: 1,
    height: 1,
    background: 'var(--border)',
  },
  divText: {
    color: 'var(--text-secondary)',
    fontSize: '0.8rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
  },
  input: {
    width: '100%',
    padding: '0.8rem 1rem',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-body)',
    fontSize: '0.92rem',
  },
  eyeBtn: {
    position: 'absolute',
    right: '0.9rem',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    padding: 0,
    transition: 'color 0.2s',
  },
  strengthTrack: {
    display: 'flex',
    gap: '0.3rem',
    height: 4,
    borderRadius: 4,
  },
  strengthLabel: {
    fontSize: '0.75rem',
    fontWeight: 600,
    marginTop: '0.25rem',
    transition: 'color 0.3s',
  },
  error: {
    padding: '0.6rem 0.8rem',
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 8,
    color: '#fc8181',
    fontSize: '0.85rem',
  },
  terms: {
    textAlign: 'center',
    color: 'var(--text-secondary)',
    fontSize: '0.75rem',
    margin: 0,
    lineHeight: 1.6,
  },
  footer: {
    textAlign: 'center',
    color: 'var(--text-secondary)',
    fontSize: '0.85rem',
    margin: 0,
  },
  authLink: {
    color: 'var(--gold)',
    fontWeight: 600,
    textDecoration: 'none',
  },
};
