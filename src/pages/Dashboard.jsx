import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

import GlassCard from '../components/shared/GlassCard';
import FinancialScoreCard from '../components/FinancialScoreCard';
import NudgeBar from '../components/NudgeBar';
import NextActionCard from '../components/NextActionCard';
import api from '../services/api_client';
import styles from './Dashboard.module.css';

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * DAY_MS;

const KpiCard = ({ title, glow, children, subText }) => (
  <GlassCard className={styles.kpiCard} glow={glow} hover>
    <h3 className={styles.kpiTitle}>{title}</h3>
    <div className={styles.kpiValueRow}>{children}</div>
    {subText && <div className={styles.kpiSubtext}>{subText}</div>}
  </GlassCard>
);

const ActionCard = ({ icon, title, desc, glow, delay, onClick }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
  >
    <GlassCard className={styles.actionCard} glow={glow} hover onClick={onClick}>
      <div
        className={`${styles.actionIcon} ${
          glow === 'teal' ? styles.tealGlow : styles.goldGlow
        }`}
      >
        {icon}
      </div>
      <div className={styles.actionText}>
        <h4>{title}</h4>
        <p>{desc}</p>
      </div>
    </GlassCard>
  </motion.div>
);

const Sparkline = ({ points, isPositive }) => {
  if (!points || points.length < 2) {
    return <div className={styles.sparklineFallback}>--</div>;
  }

  const width = 84;
  const height = 26;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = Math.max(1, max - min);

  const pathPoints = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * (width - 2) + 1;
      const y = height - ((p - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg className={styles.sparkline} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        points={pathPoints}
        className={isPositive ? styles.sparklineUp : styles.sparklineDown}
      />
    </svg>
  );
};

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function shuffleList(items = []) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function jitterTicker(ticker) {
  const basePrice = Number(ticker?.price);
  if (!Number.isFinite(basePrice) || basePrice <= 0) {
    return ticker;
  }

  const driftPct = (Math.random() - 0.5) * 0.2;
  const nextPrice = +(basePrice * (1 + driftPct / 100)).toFixed(2);
  const change = Number(ticker?.change) + (nextPrice - basePrice);
  const changePercent = (change / basePrice) * 100;

  const history = Array.isArray(ticker?.history)
    ? [...ticker.history.slice(-11), nextPrice]
    : [nextPrice];

  return {
    ...ticker,
    price: nextPrice,
    change: +change.toFixed(2),
    change_percent: +changePercent.toFixed(2),
    is_positive: change >= 0,
    history,
  };
}

function formatINR(value) {
  const safe = Number.isFinite(value) ? value : 0;
  return `₹${Math.round(safe).toLocaleString('en-IN')}`;
}

function getPrimaryGoal(profile) {
  if (profile?.goals?.length) {
    return profile.goals[0];
  }

  if (profile?.goal_type) {
    return {
      goal_type: profile.goal_type,
      timeline_months: 12,
      monthly_saving: 5000,
      target_amount: 600000,
      created_at: new Date().toISOString(),
    };
  }

  return null;
}

function buildActionItems(goal, journey, nextAction, nudges = []) {
  const aiAction = nextAction?.action?.trim();
  const aiReason = nextAction?.reason?.trim();

  if (aiAction) {
    const fromNudges = nudges.slice(0, 2).map((nudge, idx) => ({
      icon: idx === 0 ? '💡' : '📌',
      title: nudge,
      desc: 'Quick nudge from your ET concierge',
      glow: idx % 2 === 0 ? 'gold' : 'teal',
    }));

    return [
      {
        icon: '⚡',
        title: aiAction,
        desc: aiReason || 'Recommended next step from your assistant',
        glow: 'teal',
      },
      ...fromNudges,
    ].slice(0, 3);
  }

  const fromJourney = journey?.priority_actions?.slice(0, 3) || [];
  const iconSet = ['📈', '🏦', '📰'];

  if (fromJourney.length) {
    return fromJourney.map((item, idx) => ({
      icon: iconSet[idx] || '✨',
      title: item,
      desc: 'Tap to explore next step',
      glow: idx % 2 === 0 ? 'teal' : 'gold',
    }));
  }

  const goalType = goal?.goal_type || 'financial goal';
  return [
    {
      icon: '📈',
      title: `Increase ${goalType} allocation`,
      desc: 'Improve monthly progress consistency',
      glow: 'teal',
    },
    {
      icon: '🧾',
      title: 'Review risk and balance',
      desc: 'Align portfolio with your profile',
      glow: 'gold',
    },
    {
      icon: '📰',
      title: 'Read latest ET insights',
      desc: 'Stay updated with market changes',
      glow: 'teal',
    },
  ];
}

export default function Dashboard() {
  const navigate = useNavigate();

  const [userName, setUserName] = useState('User');
  const [userProfile, setUserProfile] = useState(null);
  const [dashboardNews, setDashboardNews] = useState([]);
  const [marketTickers, setMarketTickers] = useState([]);
  const [etJourney, setEtJourney] = useState(null);
  const [nextAction, setNextAction] = useState(null);
  const [financialScore, setFinancialScore] = useState(null);
  const [nudges, setNudges] = useState([]);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [greeting, setGreeting] = useState('Good morning');

  const userId = localStorage.getItem('user_id');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  useEffect(() => {
    const loadDashboard = async () => {
      if (!userId) {
        navigate('/login');
        return;
      }

      try {
        setLoading(true);
        setInsightsLoading(true);
        setError(null);

        const status = await api.onboardingStatus(userId);
        if (!status.onboarding_completed) {
          navigate('/onboarding');
          return;
        }

        const [profileData, journeyData, feedData, marketData, nextActionData, scoreData, nudgesData] = await Promise.all([
          api.getProfile(userId).catch(() => null),
          api.getJourney(userId).catch(() => null),
          api.getDashboardFeed(userId, 6).catch(() => ({ articles: [] })),
          api.getLiveMarket().catch(() => ({ tickers: [] })),
          api.getNextAction(userId).catch(() => null),
          api.getFinancialScore(userId).catch(() => null),
          api.getNudges(userId).catch(() => ({ nudges: [] })),
        ]);

        if (profileData) {
          setUserProfile(profileData);
          setUserName(profileData.name || 'User');
        }

        setEtJourney(journeyData);
        setDashboardNews(feedData.articles || []);
        setMarketTickers(shuffleList(marketData.tickers || []));
        setNextAction(nextActionData);
        setFinancialScore(scoreData);
        setNudges(Array.isArray(nudgesData?.nudges) ? nudgesData.nudges : []);
      } catch (err) {
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        setInsightsLoading(false);
        setLoading(false);
      }
    };

    loadDashboard();
  }, [navigate, userId]);

  useEffect(() => {
    const intervalId = setInterval(async () => {
      try {
        const marketData = await api.getLiveMarket();
        setMarketTickers(shuffleList(marketData.tickers || []));
      } catch {
        // Keep existing market values if refresh fails.
      }
    }, 45000);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const jitterId = setInterval(() => {
      setMarketTickers((prev) => prev.map(jitterTicker));
    }, 6000);

    return () => clearInterval(jitterId);
  }, []);

  const primaryGoal = useMemo(() => getPrimaryGoal(userProfile), [userProfile]);

  const goalMetrics = useMemo(() => {
    if (!primaryGoal) {
      return {
        progressPct: 0,
        timelineMonths: 12,
        elapsedMonths: 0,
        remainingMonths: 12,
        targetAmount: 600000,
        monthlySaving: 5000,
        currentSaved: 0,
      };
    }

    const timelineMonths = clamp(Number(primaryGoal.timeline_months || 12), 1, 600);
    const monthlySaving = Number(primaryGoal.monthly_saving || 5000);
    const targetAmount = Number(primaryGoal.target_amount || monthlySaving * timelineMonths);

    const createdAt = primaryGoal.created_at ? new Date(primaryGoal.created_at) : new Date();
    const elapsedMonths = clamp(
      Math.floor((Date.now() - createdAt.getTime()) / MONTH_MS) + 1,
      1,
      timelineMonths,
    );
    const progressPct = clamp(Math.round((elapsedMonths / timelineMonths) * 100), 1, 100);
    const currentSaved = clamp(monthlySaving * elapsedMonths, 0, targetAmount);

    return {
      progressPct,
      timelineMonths,
      elapsedMonths,
      remainingMonths: Math.max(0, timelineMonths - elapsedMonths),
      targetAmount,
      monthlySaving,
      currentSaved,
    };
  }, [primaryGoal]);

  const nextSip = useMemo(() => {
    const now = new Date();
    const baseDay = primaryGoal?.created_at
      ? new Date(primaryGoal.created_at).getDate()
      : 5;

    const next = new Date(now.getFullYear(), now.getMonth(), baseDay);
    if (next <= now) {
      next.setMonth(next.getMonth() + 1);
    }

    const daysLeft = Math.ceil((next.getTime() - now.getTime()) / DAY_MS);
    return {
      label: next.toLocaleDateString('en-IN', { month: 'long', day: 'numeric' }),
      daysLeft,
    };
  }, [primaryGoal]);

  const actionItems = useMemo(
    () => buildActionItems(primaryGoal, etJourney, nextAction, nudges),
    [primaryGoal, etJourney, nextAction, nudges],
  );
  const isStartMilestoneCrowded = goalMetrics.progressPct <= 12;
  const isEndMilestoneCrowded = goalMetrics.progressPct >= 88;

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <h2>Something went wrong</h2>
        <p>{error}</p>
        <button
          onClick={() => window.location.reload()}
          className={styles.retryBtn}
        >
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
            {loading ? (
              'Preparing your dashboard insights...'
            ) : (
              <>
                Your goal is{' '}
                <span className={styles.highlightTeal}>
                  {goalMetrics.progressPct}% on track
                </span>
              </>
            )}
          </p>
        </header>

        <NudgeBar nudges={nudges} isLoading={insightsLoading} />

        <section className={styles.kpiRow}>
          <KpiCard title="Monthly Savings Progress" glow="gold">
            <div className={styles.circularProgress}>
              <svg
                viewBox="0 0 100 100"
                width="100%"
                height="100%"
                transform="rotate(-90 50 50)"
              >
                <circle cx="50" cy="50" r="40" className={styles.circleBg}></circle>
                <motion.circle
                  cx="50"
                  cy="50"
                  r="40"
                  className={styles.circleFill}
                  initial={{ strokeDashoffset: 251.2 }}
                  animate={{
                    strokeDashoffset:
                      251.2 - (251.2 * goalMetrics.progressPct) / 100,
                  }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                />
              </svg>
              <span className={styles.progressVal}>{goalMetrics.progressPct}%</span>
            </div>
            <div className={styles.kpiText}>
              <span className={styles.amount}>{formatINR(goalMetrics.currentSaved)}</span>
              <span className={styles.subAmount}>
                / {formatINR(goalMetrics.targetAmount)} target
              </span>
            </div>
          </KpiCard>

          <KpiCard
            title="Financial Score"
            glow="teal"
            subText={financialScore?.insight || 'Personalized score updates as your profile evolves'}
          >
            <div className={styles.kpiMainVal}>
              {Number.isFinite(Number(financialScore?.score))
                ? `${Math.round(Number(financialScore.score))}/100`
                : '--'}
            </div>
            <div className={`${styles.chip} ${styles.tealChip}`}>
              Assistant powered
            </div>
          </KpiCard>

          <KpiCard
            title="Next SIP Date"
            glow="teal"
            subText={
              <>
                {formatINR(goalMetrics.monthlySaving)} planned debit{' '}
                <span style={{ color: 'var(--text-muted)' }}>
                  ({(primaryGoal?.goal_type || 'Goal').toUpperCase()})
                </span>
              </>
            }
          >
            <div className={styles.kpiMainVal}>{nextSip.label}</div>
            <div className={`${styles.chip} ${styles.tealChip}`}>
              {nextSip.daysLeft} days left
            </div>
          </KpiCard>

          <KpiCard title="Goal Timeline" glow="gold">
            <div style={{ width: '100%' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <div className={styles.kpiMainVal}>
                  {(primaryGoal?.goal_type || 'House').replace('_', ' ')}
                </div>
                <div className={`${styles.chip} ${styles.goldChip}`}>
                  in {goalMetrics.timelineMonths} months
                </div>
              </div>
              <div className={styles.miniProgressBar}>
                <motion.div
                  className={styles.miniFill}
                  initial={{ width: 0 }}
                  animate={{ width: `${goalMetrics.progressPct}%` }}
                  transition={{ duration: 1 }}
                />
              </div>
            </div>
          </KpiCard>
        </section>

        <section className={styles.activeGoalSection}>
          <div className={styles.sectionHeader}>
            <h2>
              Your Active Goal - {(primaryGoal?.goal_type || 'Build wealth').replace('_', ' ')}
            </h2>
          </div>

          <GlassCard className={styles.timelineContainer}>
            <div className={styles.timelineTrack}>
              <div className={styles.timelineLine}></div>
              <motion.div
                className={styles.timelineProgress}
                initial={{ width: 0 }}
                animate={{ width: `${goalMetrics.progressPct}%` }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
              />
              <div className={`${styles.milestone} ${styles.past}`} style={{ left: '0%' }}>
                <div className={styles.dot}></div>
                <span className={styles.label}>Start</span>
              </div>
              <div
                className={`${styles.milestone} ${styles.current}`}
                style={{ left: `${goalMetrics.progressPct}%` }}
              >
                <div className={`${styles.dot} ${styles.pulseGold}`}></div>
                <span
                  className={`${styles.label} ${styles.textGold} ${
                    isStartMilestoneCrowded
                      ? styles.labelShiftDown
                      : isEndMilestoneCrowded
                        ? styles.labelShiftUp
                        : ''
                  }`}
                >
                  Month {goalMetrics.elapsedMonths}
                </span>
              </div>
              <div className={`${styles.milestone} ${styles.future}`} style={{ left: '100%' }}>
                <div className={styles.dot}></div>
                <span className={styles.label}>Target month {goalMetrics.timelineMonths}</span>
              </div>
            </div>
          </GlassCard>

          <div className={styles.actionCards}>
            {actionItems.slice(0, 3).map((item, idx) => (
              <ActionCard
                key={`${item.title}-${idx}`}
                delay={0.2 + idx * 0.2}
                icon={item.icon}
                title={item.title}
                desc={item.desc}
                glow={item.glow}
                onClick={() => navigate('/chat')}
              />
            ))}
          </div>
        </section>

        <section className={styles.recommendedSection}>
          <h2>Recommended for You</h2>
          <div className={styles.newsScrollContainer}>
            <div className={styles.newsScroll}>
              {dashboardNews.map((news) => (
                <GlassCard
                  key={news.id || news.link}
                  className={styles.newsCard}
                  hover
                  onClick={() => {
                    if (news.link) {
                      window.open(news.link, '_blank', 'noopener,noreferrer');
                    } else {
                      navigate('/news');
                    }
                  }}
                >
                  <div
                    className={styles.newsThumb}
                    style={
                      news.image_url
                        ? {
                            backgroundImage: `linear-gradient(135deg, rgba(4, 14, 24, 0.5), rgba(4, 14, 24, 0.65)), url(${news.image_url})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                          }
                        : {
                            background:
                              'linear-gradient(135deg, rgba(12, 36, 66, 0.95), rgba(35, 86, 140, 0.95))',
                          }
                    }
                  >
                    <span
                      className={styles.categoryChip}
                      style={{
                        background: news.is_prime ? 'var(--gold)' : 'var(--teal)',
                        color: '#000',
                      }}
                    >
                      {news.category || 'Markets'}
                    </span>
                  </div>
                  <div className={styles.newsContent}>
                    <h4>{news.title}</h4>
                    <span className={styles.readTime}>
                      {news.read_minutes || 3} min read
                    </span>
                  </div>
                </GlassCard>
              ))}
              {!dashboardNews.length && (
                <GlassCard className={styles.newsCard}>
                  <div className={styles.newsContent}>
                    <h4>No feed articles yet</h4>
                    <span className={styles.readTime}>Tap to open full ET feed</span>
                  </div>
                </GlassCard>
              )}
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
              How can I help you optimize your plan today?
            </div>
          </div>
          <div className={styles.chatInputWrapper}>
            <input type="text" placeholder="Message Concierge..." readOnly />
            <button className={styles.sendBtn} onClick={() => navigate('/chat')}>
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

        <NextActionCard nextAction={nextAction} isLoading={insightsLoading} />

        <FinancialScoreCard financialScore={insightsLoading ? null : financialScore} />

        <GlassCard className={`${styles.smartOpportunity} ${styles.glowBorderGold}`}>
          <div className={styles.oppHeader}>
            <span>💡</span>
            <h3>ET Smart Journey</h3>
          </div>
          {!!nudges.length && (
            <ul
              style={{
                margin: '0 0 0.75rem 1rem',
                paddingLeft: 0,
                listStyle: 'disc',
              }}
            >
              {nudges.slice(0, 2).map((nudge, i) => (
                <li key={`nudge-${i}`} style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                  {nudge}
                </li>
              ))}
            </ul>
          )}
          {etJourney ? (
            <>
              <p style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>
                <strong>{etJourney.persona_summary}</strong>
                <br />
                {etJourney.strategy}
              </p>
              <ul
                style={{
                  margin: '0.5rem 0 0 1rem',
                  paddingLeft: 0,
                  listStyle: 'disc',
                }}
              >
                {etJourney.priority_actions?.slice(0, 2).map((action, i) => (
                  <li
                    key={i}
                    style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}
                  >
                    {action}
                  </li>
                ))}
              </ul>
              <button className={styles.ctaGold} onClick={() => navigate('/opportunities')}>
                Explore Smart Actions {'>'}
              </button>
            </>
          ) : (
            <p>Loading your personalized ET journey...</p>
          )}
        </GlassCard>

        <GlassCard className={styles.marketPulse}>
          <div className={styles.sectionHeaderMini}>
            <h3>Market Pulse</h3>
            <span className={styles.liveIndicator}>LIVE</span>
          </div>
          <div className={styles.tickerList}>
            {marketTickers.map((ticker) => (
              <div className={styles.tickerItem} key={ticker.symbol}>
                <div className={styles.tickerInfo}>
                  <span className={styles.tickerName}>{ticker.label}</span>
                  <span
                    className={`${styles.tickerVal} ${
                      ticker.is_positive ? styles.positive : styles.negative
                    }`}
                  >
                    {ticker.currency === 'INR'
                      ? formatINR(ticker.price)
                      : `${ticker.price} ${ticker.currency}`}
                  </span>
                  <span
                    className={`${styles.tickerDelta} ${
                      ticker.is_positive ? styles.positive : styles.negative
                    }`}
                  >
                    {ticker.change >= 0 ? '+' : ''}
                    {ticker.change} ({ticker.change_percent}%)
                  </span>
                </div>
                <Sparkline
                  points={ticker.history || []}
                  isPositive={ticker.is_positive}
                />
              </div>
            ))}
            {!marketTickers.length && (
              <div className={styles.marketFallback}>Live quotes unavailable right now.</div>
            )}
          </div>
        </GlassCard>
      </aside>
    </motion.div>
  );
}
