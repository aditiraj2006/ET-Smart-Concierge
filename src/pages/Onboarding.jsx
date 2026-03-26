// src/pages/Onboarding.jsx
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import GlassCard from '../components/shared/GlassCard';
import GoldButton from '../components/shared/GoldButton';
import styles from './Onboarding.module.css';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

// --- Sub-components ---

const ChatMessage = ({ ai, text, children, delay = 0 }) => {
  return (
    <motion.div
      className={`${styles.message} ${ai ? styles.aiMessage : styles.userMessage}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {ai && <div className={styles.aiAvatar}>ET</div>}
      <div className={styles.messageContent}>
        {text}
        {children}
      </div>
    </motion.div>
  );
};

const TypingIndicator = () => (
  <div className={styles.typingIndicator}>
    <motion.span
      animate={{ scale: [0, 1, 0], opacity: [0.4, 1, 0.4] }}
      transition={{ repeat: Infinity, duration: 1.4, delay: 0 }}
    />
    <motion.span
      animate={{ scale: [0, 1, 0], opacity: [0.4, 1, 0.4] }}
      transition={{ repeat: Infinity, duration: 1.4, delay: 0.16 }}
    />
    <motion.span
      animate={{ scale: [0, 1, 0], opacity: [0.4, 1, 0.4] }}
      transition={{ repeat: Infinity, duration: 1.4, delay: 0.32 }}
    />
  </div>
);

// --- Main Page Component ---

export default function Onboarding() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const chatRef = useRef(null);
  const inputRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [profile, setProfile] = useState(null);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [error, setError] = useState(null);

  // Get user ID from localStorage
  const userId = localStorage.getItem('user_id');
  const token = localStorage.getItem('firebase_token');

  // --- Particle Canvas Animation ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width, height;
    let particles = [];
    let animationFrameId;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };

    class Particle {
      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.size = Math.random() * 2 + 1;
        this.speedX = Math.random() * 0.5 - 0.25;
        this.speedY = Math.random() * -0.5 - 0.1;
        this.opacity = Math.random() * 0.5 + 0.1;
        const colors = ['rgba(255,255,255,', 'rgba(245,166,35,', 'rgba(0,212,184,'];
        this.color = colors[Math.floor(Math.random() * colors.length)];
      }
      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        if (this.y < 0) { this.y = height; this.x = Math.random() * width; }
        if (this.x < 0) this.x = width;
        if (this.x > width) this.x = 0;
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color + this.opacity + ')';
        ctx.fill();
        if (Math.random() > 0.98) {
          ctx.beginPath();
          ctx.moveTo(this.x, this.y);
          ctx.lineTo(this.x + (Math.random() * 20 - 10), this.y + (Math.random() * 20 - 10));
          ctx.strokeStyle = this.color + (this.opacity * 0.5) + ')';
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    const createParticles = () => {
      particles = [];
      const numParticles = Math.floor((width * height) / 15000);
      for (let i = 0; i < numParticles; i++) particles.push(new Particle());
    };

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      particles.forEach(p => { p.update(); p.draw(); });
      animationFrameId = requestAnimationFrame(animate);
    };

    resize();
    createParticles();
    animate();

    window.addEventListener('resize', () => { resize(); createParticles(); });

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // Auto-scroll chat window
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Focus input
  useEffect(() => {
    if (!isComplete && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isComplete, isTyping]);

  // --- Load initial greeting ---
  useEffect(() => {
    const loadInitialGreeting = async () => {
      // Add welcome message
      setMessages([
        {
          id: Date.now(),
          role: 'assistant',
          content: "Hi! I'm ET, your financial co-pilot. Let's get to know you better so I can help with personalized advice. What's your name?",
        }
      ]);
      setConversationHistory([
        { role: 'assistant', content: "Hi! I'm ET, your financial co-pilot. Let's get to know you better so I can help with personalized advice. What's your name?" }
      ]);
    };

    loadInitialGreeting();
  }, []);

  // --- Send message to backend ---
  const sendMessage = async (message) => {
    if (!message.trim() || isTyping) return;

    // Add user message
    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: message,
    };
    setMessages(prev => [...prev, userMessage]);
    setConversationHistory(prev => [...prev, { role: 'user', content: message }]);

    // Clear input
    setInputText('');
    setIsTyping(true);
    setError(null);

    try {
      const response = await fetch(`${BASE_URL}/api/onboarding/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: userId,
          message: message,
          conversation_history: conversationHistory.concat({ role: 'user', content: message }),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to get response');
      }

      const data = await response.json();

      // Add AI response
      const aiMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: data.reply,
      };
      setMessages(prev => [...prev, aiMessage]);
      setConversationHistory(prev => [...prev, { role: 'assistant', content: data.reply }]);

      // Check if onboarding is complete
      if (data.is_complete && data.extracted_profile) {
        setIsComplete(true);
        setProfile(data.extracted_profile);

        // Save profile to state and show completion message
        setTimeout(() => {
          setMessages(prev => [...prev, {
            id: Date.now() + 2,
            role: 'assistant',
            content: "✅ Great! Your financial profile has been created. I'll now be able to provide personalized financial advice tailored to your goals. Click below to continue to your dashboard!",
          }]);
        }, 500);
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setError(err.message);

      // Show error message
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: "Sorry, I ran into a hiccup. Could you repeat that? 🙏",
      }]);
      setConversationHistory(prev => [...prev, {
        role: 'assistant',
        content: "Sorry, I ran into a hiccup. Could you repeat that? 🙏"
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  // --- Handle form submit ---
  const handleSend = (e) => {
    e.preventDefault();
    if (inputText.trim() && !isTyping && !isComplete) {
      sendMessage(inputText);
    }
  };

  // --- Handle Enter key ---
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  // --- Navigate to dashboard ---
  const handleComplete = () => {
    // Force a small delay to ensure profile is saved
    setTimeout(() => {
      navigate('/dashboard');
    }, 100);
  };

  // Also add a check at the beginning to prevent re-onboarding
  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!userId || !token) {
        navigate('/login');
        return;
      }

      try {
        const response = await fetch(`${BASE_URL}/api/onboarding/status/${userId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          // If already completed, redirect to dashboard
          if (data.onboarding_completed) {
            navigate('/dashboard');
          }
        }
      } catch (err) {
        console.error('Error checking onboarding status:', err);
      }
    };

    checkOnboardingStatus();
  }, [userId, token, navigate]);

  // Calculate progress (rough estimate based on conversation history)
  const calculateProgress = () => {
    if (isComplete) return 100;
    // Count answered questions (user messages)
    const userMessages = messages.filter(m => m.role === 'user').length;
    // There are 5 questions total
    return Math.min(100, Math.floor((userMessages / 5) * 100));
  };

  const progress = calculateProgress();

  return (
    <motion.div
      className={styles.onboardingContainer}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {/* Background Layer */}
      <motion.div
        className={styles.gradientMesh}
        animate={{ x: ['0%', '-5%'], y: ['0%', '-5%'], rotate: [0, 5] }}
        transition={{ duration: 20, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
      />
      <canvas ref={canvasRef} className={styles.particleCanvas}></canvas>
      <div className={styles.grainOverlay}></div>

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="var(--gold)" />
          </svg>
          <span className={styles.logoText}>ET Smart Concierge</span>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.progressContainer}>
            <div className={styles.progressText}>
              Building your financial profile...
              <span className={styles.progressPct}>{progress}%</span>
            </div>
            <div className={styles.progressTrack}>
              <motion.div
                className={styles.progressFill}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
          </div>
          {!isComplete && (
            <GoldButton
              variant="ghost"
              onClick={() => navigate('/dashboard')}
              style={{ padding: '0.6rem 1.2rem', borderRadius: '20px', fontSize: '0.9rem' }}
            >
              Skip for now
            </GoldButton>
          )}
        </div>
      </header>

      {/* Main Layout */}
      <main className={styles.layout}>
        {/* Left Side: Chat Interface */}
        <section className={styles.chatSection}>
          <div className={styles.chatContainer} ref={chatRef}>
            {messages.map((msg, idx) => (
              <ChatMessage
                key={msg.id}
                ai={msg.role === 'assistant'}
                text={msg.content}
                delay={idx * 0.05}
              />
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <ChatMessage ai text="">
                <TypingIndicator />
              </ChatMessage>
            )}

            {/* Error message */}
            {error && (
              <div className={styles.errorMessage}>
                {error}
              </div>
            )}

            {/* Completion button */}
            {isComplete && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 }}
                className={styles.completeButtonContainer}
              >
                <GoldButton
                  onClick={handleComplete}
                  style={{ padding: '0.9rem 2rem', fontSize: '1rem', width: 'auto', minWidth: '200px' }}
                >
                  Go to Dashboard →
                </GoldButton>
              </motion.div>
            )}
          </div>

          {!isComplete && (
            <div className={styles.inputArea}>
              <div className={styles.questionsLeft}>
                {progress < 100 ? `${5 - Math.floor(progress / 20)} questions left` : 'Almost done!'}
              </div>
              <form onSubmit={handleSend} className={styles.inputBox}>
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Type your answer..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isTyping}
                />
                <button
                  type="submit"
                  className={styles.sendBtn}
                  disabled={isTyping || !inputText.trim()}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                </button>
              </form>
            </div>
          )}
        </section>

        {/* Right Side: Financial DNA Card - Live Preview */}
        <section className={styles.profileSection}>
          <GlassCard className={styles.dnaCard}>
            <div className={styles.cardHeader}>
              <h2>Financial DNA</h2>
              <div className={styles.dnaStatus}>
                {profile ? 'Complete' : 'Building...'}
              </div>
            </div>

            <div className={styles.cardContent}>
              <div className={styles.profileHeader}>
                <div className={styles.userAvatarLarge}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </div>
                <div className={styles.profileInfo}>
                  <div className={styles.infoLabel}>Name</div>
                  <motion.div
                    className={styles.infoValue}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                  >
                    {profile?.name || '—'}
                  </motion.div>
                </div>
              </div>

              <div className={styles.infoRow}>
                <div className={styles.infoLabel}>Income Range</div>
                <div className={styles.infoValue}>
                  {profile?.income_range || '—'}
                </div>
              </div>

              <div className={styles.goalsContainer}>
                <div className={styles.infoLabel}>Primary Goal</div>
                <div className={styles.tagsWrapper}>
                  <span className={styles.goalTag}>
                    {profile?.goal_type || '—'}
                  </span>
                </div>
              </div>

              <div className={styles.infoRow}>
                <div className={styles.infoLabel}>Investment Knowledge</div>
                <div className={styles.infoValue}>
                  {profile?.investment_knowledge || '—'}
                </div>
              </div>

              <div className={styles.riskMeterContainer}>
                <div className={styles.infoLabel}>Risk Profile</div>
                <motion.div
                  className={styles.gaugeWrapper}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                >
                  <svg viewBox="0 0 100 50" className={styles.gauge}>
                    <path className={styles.gaugeBg} d="M 10 50 A 40 40 0 0 1 90 50" />
                    <motion.path
                      className={styles.gaugeFill}
                      d="M 10 50 A 40 40 0 0 1 90 50"
                      initial={{ strokeDashoffset: 126 }}
                      animate={{
                        strokeDashoffset: profile?.risk_appetite === 'high' ? 50 :
                          profile?.risk_appetite === 'medium' ? 88 : 110
                      }}
                      transition={{ duration: 1, ease: "easeOut" }}
                    />
                  </svg>
                  <div className={styles.gaugeValue}>
                    {profile?.risk_appetite || '—'}
                  </div>
                </motion.div>
              </div>

              {profile?.persona && (
                <motion.div
                  className={styles.personaBadge}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                >
                  <span className={styles.personaLabel}>Persona</span>
                  <span className={styles.personaValue}>{profile.persona}</span>
                </motion.div>
              )}
            </div>
          </GlassCard>
        </section>
      </main>
    </motion.div>
  );
}