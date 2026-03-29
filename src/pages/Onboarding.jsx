// src/pages/Onboarding.jsx
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './Onboarding.module.css';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export default function Onboarding() {
  const navigate = useNavigate();
  const location = useLocation();

  const isEditMode =
    new URLSearchParams(location.search).get('mode') === 'edit';

  const chatRef = useRef(null);
  const inputRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [profile, setProfile] = useState(null);
  const [conversationHistory, setConversationHistory] = useState([]);

  const onboardingTitle = isEditMode
    ? 'Update Your Profile'
    : 'Let\'s Build Your Profile';

  const onboardingSubtitle = isEditMode
    ? 'Tune your settings with ET in one quick chat.'
    : 'Tell ET about your goals so recommendations can be personalized.';

  const userId = localStorage.getItem('user_id');
  const token = localStorage.getItem('firebase_token');

  // ─────────────────────────────────────────────
  // AUTO SCROLL
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // ─────────────────────────────────────────────
  // LOAD MODE (ONBOARDING vs EDIT)
  // ─────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      if (!userId || !token) {
        navigate('/login');
        return;
      }

      // EDIT MODE
      if (isEditMode) {
        try {
          const res = await fetch(`${BASE_URL}/api/profile/${userId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          const data = await res.json();
          setProfile(data);

          const msg = {
            id: Date.now(),
            role: 'assistant',
            content: `Hey ${data.name || 'there'} 👋

Here’s your current profile:

• Income: ${data.income_range}
• Risk: ${data.risk_appetite}
• Goal: ${data.goal_type || 'Not set'}

What would you like to change?`,
          };

          setMessages([msg]);
          setConversationHistory([{ role: 'assistant', content: msg.content }]);
        } catch (err) {
          console.error(err);
        }
        return;
      }

      // NORMAL ONBOARDING
      setMessages([
        {
          id: Date.now(),
          role: 'assistant',
          content:
            "Hi! I'm ET 🤖 Let's build your financial profile.\n\nWhat’s your name?",
        },
      ]);

      setConversationHistory([
        {
          role: 'assistant',
          content:
            "Hi! I'm ET 🤖 Let's build your financial profile.\n\nWhat’s your name?",
        },
      ]);
    };

    init();
  }, [isEditMode]);

  // ─────────────────────────────────────────────
  // SEND MESSAGE
  // ─────────────────────────────────────────────
  const sendMessage = async () => {
    if (!inputText.trim() || isTyping) return;

    const userMsg = {
      id: Date.now(),
      role: 'user',
      content: inputText,
    };

    const nextHistory = [
      ...conversationHistory,
      { role: 'user', content: inputText },
    ];

    setMessages((prev) => [...prev, userMsg]);
    setConversationHistory(nextHistory);

    setInputText('');
    setIsTyping(true);

    try {
      const endpoint = isEditMode
        ? `${BASE_URL}/api/assistant/chat`
        : `${BASE_URL}/api/onboarding/chat`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: userId,
          message: userMsg.content,
          conversation_history: nextHistory,
        }),
      });

      const data = await res.json();

      const aiMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: data.reply,
      };

      setMessages((prev) => [...prev, aiMsg]);
      setConversationHistory((prev) => [
        ...prev,
        { role: 'assistant', content: data.reply },
      ]);

      // onboarding complete
      if (!isEditMode && data.is_complete) {
        setIsComplete(true);
      }

      // edit mode success
      if (isEditMode) {
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now(),
              role: 'assistant',
              content:
                '✅ Profile updated successfully!\n\nRedirecting to dashboard...',
            },
          ]);

          setTimeout(() => navigate('/dashboard'), 1500);
        }, 500);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsTyping(false);
    }
  };

  // ─────────────────────────────────────────────
  // HANDLE ENTER
  // ─────────────────────────────────────────────
  const handleKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
  };

  // ─────────────────────────────────────────────
  // UI
  // ─────────────────────────────────────────────
  return (
    <div className={styles.onboardingContainer}>
      <div className={styles.gradientMesh} aria-hidden="true" />
      <div className={styles.grainOverlay} aria-hidden="true" />

      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <h2 className={styles.headerTitle}>{onboardingTitle}</h2>
          <p className={styles.headerSubtitle}>{onboardingSubtitle}</p>
        </div>
      </header>

      <main className={styles.layout}>
        <section className={styles.chatSection}>
          <div className={styles.chatContainer} ref={chatRef}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
              className={
                `${styles.message} ${
                  msg.role === 'assistant' ? styles.aiMessage : styles.userMessage
                }`
              }
            >
              {msg.role === 'assistant' && <div className={styles.aiAvatar}>ET</div>}
              <div className={styles.messageContent}>{msg.content}</div>
            </motion.div>
          ))}

            {isTyping && (
              <div className={`${styles.message} ${styles.aiMessage}`}>
                <div className={styles.aiAvatar}>ET</div>
                <div className={styles.messageContent}>
                  <div className={styles.typingIndicator}>
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            )}
          </div>

          {!isComplete && (
            <div className={styles.inputArea}>
              <div className={styles.inputBox}>
                <input
                  ref={inputRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKey}
                  disabled={isTyping}
                  placeholder={
                    isEditMode
                      ? 'Tell me what to change...'
                      : 'Type your answer...'
                  }
                />
                <button
                  className={styles.sendBtn}
                  onClick={sendMessage}
                  disabled={isTyping || !inputText.trim()}
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}