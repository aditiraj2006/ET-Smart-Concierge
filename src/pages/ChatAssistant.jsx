// ChatAssistant.jsx (Enhanced with ET integration)
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './ChatAssistant.module.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Quick suggestions for common queries
const QUICK_SUGGESTIONS = [
  { text: "Latest market news", icon: "📈" },
  { text: "Best mutual funds for beginners", icon: "💰" },
  { text: "How to save tax", icon: "📊" },
  { text: "Explain SIP vs lumpsum", icon: "💡" },
  { text: "Car loan interest rates", icon: "🚗" },
  { text: "Stock market outlook", icon: "📰" }
];

export default function ChatAssistant() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const autoContextTriggeredRef = useRef(false);

  const userId = user?.uid || localStorage.getItem('user_id');
  const authToken = token || localStorage.getItem('firebase_token');

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const welcomeMessage = {
      id: Date.now(),
      sender: 'ai',
      text: "Hi! I'm your ET Smart Concierge 🤖\n\nI have real-time access to Economic Times news and can help you with:\n• Financial planning and goals\n• Market insights and news\n• Investment advice\n• Tax saving strategies\n• Loan and EMI calculations\n\nWhat would you like to know today?",
      timestamp: new Date()
    };
    setMessages([welcomeMessage]);
    setConversationHistory([{ role: 'assistant', content: welcomeMessage.text }]);
  }, []);

  const sendMessage = async (overrideMessage = null) => {
    const messageToSend = (overrideMessage ?? inputMessage).trim();
    if (!messageToSend || isLoading) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: messageToSend,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setConversationHistory(prev => [...prev, { role: 'user', content: inputMessage }]);
    setInputMessage('');
    setIsTyping(true);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/assistant/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          user_id: userId,
          message: messageToSend,
          conversation_history: conversationHistory
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      
      // Process the response - split into paragraphs for better readability
      const formattedReply = data.reply
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n\n/g, '<br/><br/>')
      
      const aiMsg = {
        id: Date.now() + 1,
        sender: 'ai',
        text: formattedReply,
        rawText: data.reply,
        goalPlan: data.goal_plan,
        hasPlan: data.has_plan,
        suggestions: data.suggestions,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, aiMsg]);
      setConversationHistory(prev => [...prev, { role: 'assistant', content: data.reply }]);

      // If there's a goal plan, show it as a card
      if (data.has_plan && data.goal_plan) {
        setTimeout(() => {
          const planCard = {
            id: Date.now() + 2,
            sender: 'ai',
            isPlanCard: true,
            goalPlan: data.goal_plan,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, planCard]);
        }, 300);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMsg = {
        id: Date.now() + 1,
        sender: 'ai',
        text: "I'm having trouble connecting right now. Please check your connection and try again. 🔄\n\nYou can also try asking a different question or check back later.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const context = params.get('context');
    const nextAction = params.get('nextAction') || params.get('action');

    if (context !== 'next_action') return;
    if (!nextAction) return;
    if (autoContextTriggeredRef.current) return;
    if (!conversationHistory.length) return;

    autoContextTriggeredRef.current = true;
    sendMessage(`Help me with this action: ${nextAction}`);
  }, [location.search, conversationHistory.length]);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setInputMessage(suggestion);
    inputRef.current?.focus();
  };

  const formatTimestamp = (date) => {
    if (!date) return '';
    const now = new Date();
    const msgDate = new Date(date);
    const diffMs = now - msgDate;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return msgDate.toLocaleDateString();
  };

  const GoalPlanCard = ({ plan }) => (
    <div className={styles.planCard}>
      <div className={styles.planHeader}>
        <div className={styles.planIcon}>🎯</div>
        <h3 className={styles.planTitle}>Your {plan.goal_type} Plan</h3>
      </div>
      
      <div className={styles.planMetrics}>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Target Amount</span>
          <span className={styles.metricValue}>₹{plan.target_amount?.toLocaleString()}</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Timeline</span>
          <span className={styles.metricValue}>{plan.timeline_months} months</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Monthly SIP</span>
          <span className={styles.metricValue}>₹{plan.monthly_saving?.toLocaleString()}</span>
        </div>
      </div>

      {plan.down_payment && (
        <div className={styles.loanDetails}>
          <div className={styles.detailRow}>
            <span>Down Payment</span>
            <span>₹{plan.down_payment?.toLocaleString()}</span>
          </div>
          <div className={styles.detailRow}>
            <span>Loan Amount</span>
            <span>₹{plan.loan_amount?.toLocaleString()}</span>
          </div>
          <div className={styles.detailRow}>
            <span>EMI Estimate</span>
            <span>₹{plan.emi_estimate?.toLocaleString()}/month</span>
          </div>
        </div>
      )}

      {plan.milestones?.length > 0 && (
        <div className={styles.milestones}>
          <h4 className={styles.sectionTitle}>Key Milestones</h4>
          <div className={styles.milestoneList}>
            {plan.milestones.map((milestone, idx) => (
              <div key={idx} className={styles.milestoneItem}>
                <div className={styles.milestoneDot}></div>
                <span>{milestone}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {plan.et_recommendations?.length > 0 && (
        <div className={styles.recommendations}>
          <h4 className={styles.sectionTitle}>ET Recommends</h4>
          <div className={styles.recommendList}>
            {plan.et_recommendations.map((rec, idx) => (
              <button key={idx} className={styles.recommendBtn}>
                {rec}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={styles.planFooter}>
        <span className={styles.disclaimer}>
          *Investment returns are subject to market risks
        </span>
      </div>
    </div>
  );

  const MessageContent = ({ message }) => {
    if (message.isPlanCard && message.goalPlan) {
      return <GoalPlanCard plan={message.goalPlan} />;
    }
    
    return (
      <div 
        className={styles.msgText}
        dangerouslySetInnerHTML={{ __html: message.text }}
      />
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={styles.chatPageWrapper}
    >
      <div className={styles.chatBackground}></div>
      
      <div className={styles.chatContainer}>
        {/* Header */}
        <header className={styles.chatHeader}>
          <div className={styles.headerContent}>
            <div className={styles.logoSection}>
              <div className={styles.logoIcon}>📰</div>
              <div className={styles.logoText}>
                <h1>ET Smart Concierge</h1>
                <span>Powered by Gemini AI & Economic Times</span>
              </div>
            </div>
            <button className={styles.closeBtn} onClick={() => navigate('/dashboard')}>
              ✕
            </button>
          </div>
        </header>

        {/* Chat Messages */}
        <main className={styles.chatMessagesArea} ref={scrollRef}>
          <div className={styles.messagesContainer}>
            <AnimatePresence>
              {messages.map((msg, idx) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.05 }}
                  className={`${styles.messageRow} ${msg.sender === 'ai' ? styles.aiRow : styles.userRow}`}
                >
                  <div className={styles.messageAvatar}>
                    {msg.sender === 'ai' ? '🤖' : '👤'}
                  </div>
                  <div className={`${styles.messageBubble} ${msg.sender === 'ai' ? styles.aiBubble : styles.userBubble}`}>
                    {msg.sender === 'ai' && !msg.isPlanCard && (
                      <div className={styles.aiIndicator}>
                        <span className={styles.aiDot}></span>
                        <span>ET Concierge</span>
                      </div>
                    )}
                    <MessageContent message={msg} />
                    <div className={styles.messageTime}>
                      {formatTimestamp(msg.timestamp)}
                    </div>
                  </div>
                </motion.div>
              ))}

              {isTyping && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`${styles.messageRow} ${styles.aiRow}`}
                >
                  <div className={styles.messageAvatar}>🤖</div>
                  <div className={`${styles.messageBubble} ${styles.aiBubble}`}>
                    <div className={styles.typingIndicator}>
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>

        {/* Quick Suggestions */}
        <div className={styles.quickSuggestions}>
          {QUICK_SUGGESTIONS.map((suggestion, idx) => (
            <button
              key={idx}
              className={styles.suggestionChip}
              onClick={() => handleSuggestionClick(suggestion.text)}
              disabled={isLoading}
            >
              <span className={styles.suggestionIcon}>{suggestion.icon}</span>
              <span>{suggestion.text}</span>
            </button>
          ))}
        </div>

        {/* Input Area */}
        <footer className={styles.chatFooter}>
          <div className={styles.inputWrapper}>
            <textarea
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything about finance, markets, or your goals..."
              disabled={isLoading}
              rows={1}
              className={styles.chatInput}
            />
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className={styles.sendButton}
            >
              {isLoading ? '⏳' : '📤'}
            </button>
          </div>
          <div className={styles.inputDisclaimer}>
            ET Smart Concierge provides AI-powered financial guidance. Please verify important information.
          </div>
        </footer>
      </div>
    </motion.div>
  );
}