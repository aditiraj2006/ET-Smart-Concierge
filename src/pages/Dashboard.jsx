// src/pages/Dashboard.jsx
import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

import GlassCard from '../components/shared/GlassCard';
import styles from './Dashboard.module.css';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

const KpiCard = ({ title, glow, children, subText }) => (
  <GlassCard className={styles.kpiCard} glow={glow} hover>
    <h3 className={styles.kpiTitle}>{title}</h3>
    <div className={styles.kpiValueRow}>{children}</div>
    {subText && <div className={styles.kpiSubtext}>{subText}</div>}
  </GlassCard>
);

const ActionCard = ({ icon, title, desc, glow, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
  >
    <GlassCard className={styles.actionCard} glow={glow} hover>
      <div className={`${styles.actionIcon} ${glow === 'teal' ? styles.tealGlow : styles.goldGlow}`}>
        {icon}
      </div>
      <div className={styles.actionText}>
        <h4>{title}</h4>
        <p>{desc}</p>
      </div>
    </GlassCard>
  </motion.div>
);

export default function Dashboard() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState('');
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState('Good morning');
  const [error, setError] = useState(null);

  // Get user info from localStorage
  const userId = localStorage.getItem('user_id');
  const token = localStorage.getItem('firebase_token');

  // Draw Sparklines directly via canvas refs
  const niftyRef = useRef(null);
  const sensexRef = useRef(null);
  const goldRef = useRef(null);

  // Set greeting based on time of day
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  // Fetch user profile and check onboarding
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!userId || !token) {
        navigate('/login');
        return;
      }

      try {
        setLoading(true);

        // First check onboarding status
        const statusRes = await fetch(`${BASE_URL}/api/onboarding/status/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!statusRes.ok) {
          throw new Error('Failed to fetch status');
        }

        const statusData = await statusRes.json();

        // If onboarding not completed, redirect to onboarding
        if (!statusData.onboarding_completed) {
          navigate('/onboarding');
          return;
        }

        // Fetch full profile using the profile endpoint
        const profileRes = await fetch(`${BASE_URL}/api/profile/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (profileRes.ok) {
          const profileData = await profileRes.json();
          setUserProfile(profileData);
          setUserName(profileData.name || 'User');
        } else if (profileRes.status === 404) {
          console.error('Profile not found despite onboarding being complete');
          setUserName('User');
        } else {
          throw new Error('Failed to fetch profile');
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
        setError(err.message);
        setUserName('User');
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [userId, token, navigate]);

  // Draw sparklines
  useEffect(() => {
    const drawSparkline = (canvas, dataPoints, color) => {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const width = canvas.width,
        height = canvas.height;
      ctx.clearRect(0, 0, width, height);
      const min = Math.min(...dataPoints),
        max = Math.max(...dataPoints),
        range = max - min || 1;
      const stepX = width / (dataPoints.length - 1);

      ctx.beginPath();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;

      const rgb = color === '#ff4d4f' ? '255, 77, 79' : '0, 212, 184';
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, `rgba(${rgb}, 0.3)`);
      gradient.addColorStop(1, `rgba(${rgb}, 0)`);

      dataPoints.forEach((val, i) => {
        const x = i * stepX,
          y = height - 2 - ((val - min) / range) * (height - 4);
        if (i === 0) ctx.moveTo(x, y);
        else {
          const prevX = (i - 1) * stepX,
            prevY = height - 2 - ((dataPoints[i - 1] - min) / range) * (height - 4);
          const cpX = (prevX + x) / 2;
          ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
        }
      });
      ctx.stroke();
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.fillStyle = gradient;
      ctx.fill();

      const lastX = width,
        lastY = height - 2 - ((dataPoints[dataPoints.length - 1] - min) / range) * (height - 4);
      ctx.beginPath();
      ctx.arc(lastX - 1, lastY, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = color;
      ctx.stroke();
    };

    drawSparkline(
      niftyRef.current,
      [22100, 22150, 22120, 22200, 22280, 22250, 22340.5],
      '#00D4B8'
    );
    drawSparkline(
      sensexRef.current,
      [73200, 73350, 73300, 73500, 73450, 73600, 73651.35],
      '#00D4B8'
    );
    drawSparkline(
      goldRef.current,
      [66100, 66050, 66150, 65900, 65950, 65850, 65800],
      '#ff4d4f'
    );
  }, []);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1 }}
          className={styles.loadingSpinner}
        >
          ⚡
        </motion.div>
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <h2>Something went wrong</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()} className={styles.retryBtn}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <motion.div
      className={styles.appContainer}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <div className={styles.dotGrid}></div>

      <main className={styles.mainContent}>
        <header className={styles.greetingBar}>
          <h1>
            {greeting}, {userName} 👋
          </h1>
          <p className={styles.subtitle}>
            Your goal is{' '}
            <span className={styles.highlightTeal}>68% on track</span>
          </p>
        </header>

        <section className={styles.kpiRow}>
          <KpiCard title="Monthly Savings Progress" glow="gold">
            <div className={styles.circularProgress}>
              <svg
                viewBox="0 0 100 100"
                width="100%"
                height="100%"
                transform="rotate(-90 50 50)"
              >
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  className={styles.circleBg}
                ></circle>
                <motion.circle
                  cx="50"
                  cy="50"
                  r="40"
                  className={styles.circleFill}
                  initial={{ strokeDashoffset: 251.2 }}
                  animate={{ strokeDashoffset: 80.38 }}
                  transition={{ duration: 1.5, ease: 'easeOut' }}
                />
              </svg>
              <span className={styles.progressVal}>68%</span>
            </div>
            <div className={styles.kpiText}>
              <span className={styles.amount}>₹24k</span>
              <span className={styles.subAmount}>/ ₹35k target</span>
            </div>
          </KpiCard>

          <KpiCard
            title="Next SIP Date"
            glow="teal"
            subText={
              <>
                ₹5,000 auto-debit{' '}
                <span style={{ color: 'var(--text-muted)' }}>
                  (HDFC Flexi Cap)
                </span>
              </>
            }
          >
            <div className={styles.kpiMainVal}>March 28</div>
            <div className={`${styles.chip} ${styles.tealChip}`}>4 days left</div>
          </KpiCard>

          <KpiCard title="Goal Timeline" glow="gold">
            <div style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div className={styles.kpiMainVal}>
                  {userProfile?.goals?.[0]?.goal_type ||
                    userProfile?.goal_type ||
                    'House'} 🏠
                </div>
                <div className={`${styles.chip} ${styles.goldChip}`}>
                  in {userProfile?.goals?.[0]?.timeline_months || 28} months
                </div>
              </div>
              <div className={styles.miniProgressBar}>
                <motion.div
                  className={styles.miniFill}
                  initial={{ width: 0 }}
                  animate={{ width: '25%' }}
                  transition={{ duration: 1 }}
                ></motion.div>
              </div>
            </div>
          </KpiCard>
        </section>

        <section className={styles.activeGoalSection}>
          <div className={styles.sectionHeader}>
            <h2>
              Your Active Goal —{' '}
              {userProfile?.goals?.[0]?.goal_type ||
                userProfile?.goal_type ||
                'Buy a House'} 🏠
            </h2>
          </div>
          <GlassCard className={styles.timelineContainer}>
            <div className={styles.timelineTrack}>
              <div className={styles.timelineLine}></div>
              <motion.div
                className={styles.timelineProgress}
                initial={{ width: 0 }}
                animate={{ width: '25%' }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
              ></motion.div>

              <div
                className={`${styles.milestone} ${styles.past}`}
                style={{ left: '0%' }}
              >
                <div className={styles.dot}></div>
                <span className={styles.label}>Start</span>
              </div>
              <div
                className={`${styles.milestone} ${styles.current}`}
                style={{ left: '25%' }}
              >
                <div className={`${styles.dot} ${styles.pulseGold}`}></div>
                <span className={`${styles.label} ${styles.textGold}`}>
                  Month 9
                </span>
              </div>
              <div
                className={`${styles.milestone} ${styles.future}`}
                style={{ left: '50%' }}
              >
                <div className={styles.dot}></div>
                <span className={styles.label}>
                  Down Payment
                  <br />
                  Saved
                </span>
              </div>
              <div
                className={`${styles.milestone} ${styles.future}`}
                style={{ left: '75%' }}
              >
                <div className={styles.dot}></div>
                <span className={styles.label}>
                  Loan
                  <br />
                  Eligibility
                </span>
              </div>
              <div
                className={`${styles.milestone} ${styles.future}`}
                style={{ left: '100%' }}
              >
                <div className={styles.dot}></div>
                <span className={styles.label}>
                  Final
                  <br />
                  Purchase
                </span>
              </div>
            </div>
          </GlassCard>

          <div className={styles.actionCards}>
            <ActionCard
              delay={0.2}
              icon="📈"
              title="Increase SIP"
              desc="Boost your progress"
              glow="teal"
            />
            <ActionCard
              delay={0.4}
              icon="🏦"
              title="View Loan Options"
              desc="Check eligibility early"
              glow="gold"
            />
            <ActionCard
              delay={0.6}
              icon="📰"
              title="Read ET Guide"
              desc="Home buying essentials"
              glow="teal"
            />
          </div>
        </section>

        <section className={styles.recommendedSection}>
          <h2>Recommended for You</h2>
          <div
            className={styles.newsScrollContainer}
            onClick={() => navigate('/news')}
          >
            <div className={styles.newsScroll}>
              {[
                {
                  title: 'Is real estate still the best bet for millennials?',
                  chip: 'ET Prime',
                  time: '5 min read',
                  bg: 'var(--teal)',
                },
                {
                  title: 'Home Loan Negotiation Strategies',
                  chip: 'Masterclass',
                  time: '12 min watch',
                  bg: 'var(--gold)',
                  textColor: '#000',
                },
                {
                  title: 'Interest rates pause: What it means for borrowers',
                  chip: 'Market Trend',
                  time: '4 min read',
                  bg: 'var(--teal)',
                },
              ].map((news) => (
                <GlassCard key={news.title} className={styles.newsCard} hover>
                  <div
                    className={styles.newsThumb}
                    style={{
                      background: `linear-gradient(135deg, #1e3c72, #2a5298)`,
                    }}
                  >
                    <span
                      className={styles.categoryChip}
                      style={{
                        background: news.bg,
                        color: news.textColor || '#000',
                      }}
                    >
                      {news.chip}
                    </span>
                  </div>
                  <div className={styles.newsContent}>
                    <h4>{news.title}</h4>
                    <span className={styles.readTime}>🕒 {news.time}</span>
                  </div>
                </GlassCard>
              ))}
            </div>
          </div>
        </section>
      </main>

      <aside className={styles.sidebarRight}>
        <GlassCard className={styles.chatWidget}>
          <div className={styles.chatHeader}>
            <h3>Ask Your Concierge</h3>
            <div className={styles.onlineDot}></div>
          </div>
          <div className={styles.chatHistory}>
            <div className={styles.chatMsgAi}>
              How can I help you optimize your portfolio today?
            </div>
          </div>
          <div className={styles.chatInputWrapper}>
            <input type="text" placeholder="Message Concierge..." />
            <button
              className={styles.sendBtn}
              onClick={() => navigate('/chat')}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
        </GlassCard>

        <GlassCard className={`${styles.smartOpportunity} ${styles.glowBorderGold}`}>
          <div className={styles.oppHeader}>
            <span>💡</span>
            <h3>Smart Opportunity</h3>
          </div>
          <p>
            You're saving well! A Flexi RD could boost returns by{' '}
            <strong className={styles.textGold}>1.4%</strong> without locking
            your funds.
          </p>
          <button
            className={styles.ctaGold}
            onClick={() => navigate('/opportunities')}
          >
            Learn More
          </button>
        </GlassCard>

        <GlassCard className={styles.marketPulse}>
          <div className={styles.sectionHeaderMini}>
            <h3>Market Pulse</h3>
            <span className={styles.liveIndicator}>LIVE</span>
          </div>
          <div className={styles.tickerList}>
            <div className={styles.tickerItem}>
              <div className={styles.tickerInfo}>
                <span className={styles.tickerName}>NIFTY 50</span>
                <span className={`${styles.tickerVal} ${styles.positive}`}>
                  22,340.50
                </span>
              </div>
              <canvas ref={niftyRef} width="80" height="24"></canvas>
            </div>
            <div className={styles.tickerItem}>
              <div className={styles.tickerInfo}>
                <span className={styles.tickerName}>SENSEX</span>
                <span className={`${styles.tickerVal} ${styles.positive}`}>
                  73,651.35
                </span>
              </div>
              <canvas ref={sensexRef} width="80" height="24"></canvas>
            </div>
            <div className={styles.tickerItem}>
              <div className={styles.tickerInfo}>
                <span className={styles.tickerName}>GOLD (10g)</span>
                <span className={`${styles.tickerVal} ${styles.negative}`}>
                  ₹65,800.00
                </span>
              </div>
              <canvas ref={goldRef} width="80" height="24"></canvas>
            </div>
          </div>
        </GlassCard>
      </aside>
    </motion.div>
  );
}