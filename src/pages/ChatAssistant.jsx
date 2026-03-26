import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import GlassCard from '../components/shared/GlassCard';
import GoldButton from '../components/shared/GoldButton';
import styles from './ChatAssistant.module.css';

export default function ChatAssistant() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(true);
  const scrollRef = useRef(null);

  // Auto-scroll chat window
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isTyping]);

  // Chat conversation sequence
  useEffect(() => {
    let timers = [];
    timers.push(setTimeout(() => {
      setMessages([{ id: 1, sender: 'ai', text: "I'd love to help you plan for your car! 🚗 What's your target budget?" }]);
      setIsTyping(false);
    }, 1000));
    
    timers.push(setTimeout(() => {
      setMessages(p => [...p, { id: 2, sender: 'user', text: "Around ₹8 lakhs" }]);
      setIsTyping(true);
    }, 2500));

    timers.push(setTimeout(() => {
      setMessages(p => [...p, { id: 3, sender: 'ai', text: "Great choice! When are you hoping to drive it home?" }]);
      setIsTyping(false);
    }, 4000));

    timers.push(setTimeout(() => {
      setMessages(p => [...p, { id: 4, sender: 'user', text: "In about 12 months" }]);
      setIsTyping(true);
    }, 5500));

    timers.push(setTimeout(() => {
      setMessages(p => [...p, 
        { id: 5, sender: 'ai', text: "Here's your personalized Car Purchase Plan 🎯" },
        { id: 6, sender: 'ai', isCard: true }
      ]);
      setIsTyping(false);
    }, 8500));

    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={styles.modalOverlay}
    >
      <div className={styles.dashboardBg}></div>
      <div className={styles.chatModalWrapper}>
        <div className={styles.chatModal}>
          {/* Top Bar */}
          <header className={styles.modalHeader}>
            <div className={styles.headerLeft}>
              <div className={styles.title}>
                <div className={styles.pulseIndicator}></div>
                <h2>🤖 ET Concierge</h2>
              </div>
              <div className={styles.contextChip}>Goal: Buy a Car 🚗</div>
            </div>
            <button className={styles.closeBtn} onClick={() => navigate('/dashboard')}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </header>

          {/* Chat Area */}
          <main className={styles.chatArea} ref={scrollRef}>
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={`msg-${msg.id}`}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className={`${styles.message} ${msg.sender === 'ai' ? styles.ai : styles.user}`}
                >
                  {msg.isCard ? (
                    <div className={styles.planCardWrapper}>
                      <div className={styles.planCard}>
                        <h3 className={styles.planTitle}>🚗 Car Purchase Plan — ₹8L in 12 months</h3>
                        <div className={styles.planSteps}>
                          <div className={styles.step}>
                            <div className={styles.stepNum}>1</div>
                            <div className={styles.stepTitle}>Monthly SIP: ₹55,000</div>
                            <div className={styles.stepDesc}>Invest in Hybrid Mutual Funds (expected 10% return)</div>
                            <div className={styles.stepChip}>Auto-Invest</div>
                          </div>
                          <div className={styles.step}>
                            <div className={styles.stepNum}>2</div>
                            <div className={styles.stepTitle}>Lump sum at Month 12: ₹1.2L</div>
                            <div className={styles.stepDesc}>From your annual bonus to complete the corpus</div>
                          </div>
                          <div className={styles.step}>
                            <div className={styles.stepNum}>3</div>
                            <div className={styles.stepTitle}>Smart Savings: ₹8,500/mo</div>
                            <div className={styles.stepDesc}>Cut down dining out based on your recent spending analysis</div>
                          </div>
                        </div>
                        <div className={styles.planActions}>
                          <GoldButton variant="filled">Activate Auto-SIP</GoldButton>
                          <button className={`${styles.actionPill} ${styles.outline}`}>Customize</button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.msgContent}>
                      {msg.text}
                    </div>
                  )}
                </motion.div>
              ))}

              {isTyping && (
                <motion.div
                  key="typing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={`${styles.message} ${styles.ai}`}
                >
                  <div className={styles.msgContent}>
                    <div className={styles.typingIndicator}>
                      <motion.span animate={{ scale: [0, 1, 0], opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.4, delay: 0 }} />
                      <motion.span animate={{ scale: [0, 1, 0], opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.4, delay: 0.16 }} />
                      <motion.span animate={{ scale: [0, 1, 0], opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.4, delay: 0.32 }} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </main>
          
          {/* Input Bar */}
          <footer className={styles.modalFooter}>
            <div className={styles.quickChips}>
              {['Increase savings', 'What if I extend to 18 months?', 'Show SIP options'].map((chip) => (
                <button key={chip} className={styles.chip}>{chip}</button>
              ))}
            </div>
            <div className={styles.inputContainer}>
              <input type="text" placeholder="Type a message..." disabled />
              <button className={styles.sendMessageBtn} disabled>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </button>
            </div>
          </footer>
        </div>
      </div>
    </motion.div>
  );
}
