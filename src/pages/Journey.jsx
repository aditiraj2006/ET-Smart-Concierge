import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import GlassCard from '../components/shared/GlassCard';
import api from '../services/api_client';
import styles from './Journey.module.css';

const ET_BASE = 'https://economictimes.indiatimes.com';

function buildEtSearchUrl(query) {
  return `${ET_BASE}/search.cms?query=${encodeURIComponent(query || 'personal finance')}`;
}

function recommendationHint(section) {
  const hints = {
    et_prime: 'Why this matters: deeper context for better financial decisions.',
    et_markets: 'Use this to track market signals linked to your goals.',
    masterclasses: 'Build practical investing skills with guided learning.',
    events: 'Stay updated with expert sessions and live insights.',
    financial_tools: 'Use this tool to calculate and validate your next step.',
  };
  return hints[section] || 'Recommended for your current ET journey.';
}

function normalizeRecommendation(item, section) {
  const urlRegex = /(https?:\/\/[^\s]+)/i;

  if (item && typeof item === 'object') {
    const title = String(
      item.title || item.headline || item.name || item.text || 'ET recommendation',
    ).trim();
    const url = String(item.url || item.link || item.href || '').trim() || buildEtSearchUrl(title);
    const why = String(item.why || item.reason || item.summary || '').trim() || recommendationHint(section);
    return { title, url, why };
  }

  const raw = String(item || '').trim();
  const match = raw.match(urlRegex);
  const extractedUrl = match?.[1] || '';
  const title = raw.replace(urlRegex, '').replace(/[\-:|]+$/, '').trim() || 'ET recommendation';

  return {
    title,
    url: extractedUrl || buildEtSearchUrl(title),
    why: recommendationHint(section),
  };
}

export default function Journey() {
  const navigate = useNavigate();
  const [journey, setJourney] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const userId = localStorage.getItem('user_id');

  useEffect(() => {
    const fetchJourney = async () => {
      if (!userId) {
        navigate('/login');
        return;
      }
      try {
        const data = await api.getJourney(userId);
        setJourney(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchJourney();
  }, [userId, navigate]);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}>⚡</div>
        <p>Creating your personalized ET journey...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <h2>Something went wrong</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()} className={styles.retryBtn}>Retry</button>
      </div>
    );
  }

  if (!journey) return null;

  const safeJourney = journey || {};
  const personaSummary = safeJourney.persona_summary || 'Your ET financial persona is being prepared';
  const strategy = safeJourney.strategy || 'We are personalizing recommendations based on your profile and activity.';
  const priorityActions = Array.isArray(safeJourney.priority_actions) && safeJourney.priority_actions.length
    ? safeJourney.priority_actions
    : ['Review your latest goal progress and choose one action for this week'];
  const recommendations = safeJourney.et_recommendations || {};

  return (
    <motion.div
      className={styles.journeyContainer}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className={styles.background}></div>

      <div className={styles.content}>
        <header className={styles.header}>
          <button className={styles.backBtn} onClick={() => navigate('/dashboard')}>
            ← Back to Dashboard
          </button>
          <h1>Your ET Journey</h1>
          <p>Personalized recommendations powered by Economic Times</p>
        </header>

        {/* Persona & Strategy */}
        <GlassCard className={styles.personaCard}>
          <div className={styles.personaIcon}>🎯</div>
          <div>
            <h2>{personaSummary}</h2>
            <p>{strategy}</p>
          </div>
        </GlassCard>

        {/* Priority Actions */}
        <section>
          <h2>Priority Actions</h2>
          <div className={styles.actionsGrid}>
            {priorityActions.map((action, idx) => (
              <GlassCard key={idx} className={styles.actionItem} hover>
                <span className={styles.actionNumber}>{idx + 1}</span>
                <p>{action}</p>
              </GlassCard>
            ))}
          </div>
        </section>

        {/* ET Prime Recommendations */}
        {recommendations.et_prime?.length > 0 && (
          <section>
            <h2>📚 ET Prime Reads</h2>
            <div className={styles.articleGrid}>
              {recommendations.et_prime.map((article, idx) => {
                const rec = normalizeRecommendation(article, 'et_prime');
                return (
                <GlassCard key={idx} className={styles.articleCard} hover>
                  <div className={styles.primeBadge}>Prime</div>
                  <p className={styles.recTitle}>{rec.title}</p>
                  <p className={styles.recMeta}>{rec.why}</p>
                  <a className={styles.readBtn} href={rec.url} target="_blank" rel="noreferrer">
                    Read on ET →
                  </a>
                </GlassCard>
                );
              })}
            </div>
          </section>
        )}

        {/* Markets to Watch */}
        {recommendations.et_markets?.length > 0 && (
          <section>
            <h2>📊 Markets to Watch</h2>
            <div className={styles.marketsList}>
              {recommendations.et_markets.map((item, idx) => {
                const rec = normalizeRecommendation(item, 'et_markets');
                return (
                  <GlassCard key={idx} className={styles.marketItem} hover>
                    <a className={styles.marketLink} href={rec.url} target="_blank" rel="noreferrer">
                      {rec.title}
                    </a>
                  </GlassCard>
                );
              })}
            </div>
          </section>
        )}

        {/* Masterclasses */}
        {recommendations.masterclasses?.length > 0 && (
          <section>
            <h2>🎓 ET Masterclasses</h2>
            <div className={styles.classesGrid}>
              {recommendations.masterclasses.map((cls, idx) => {
                const rec = normalizeRecommendation(cls, 'masterclasses');
                return (
                <GlassCard key={idx} className={styles.classCard} hover>
                  <div className={styles.classIcon}>🎬</div>
                  <p className={styles.recTitle}>{rec.title}</p>
                  <p className={styles.recMeta}>{rec.why}</p>
                  <a className={styles.watchLabel} href={rec.url} target="_blank" rel="noreferrer">
                    Watch on ET →
                  </a>
                </GlassCard>
                );
              })}
            </div>
          </section>
        )}

        {/* Events */}
        {recommendations.events?.length > 0 && (
          <section>
            <h2>📅 Upcoming Events</h2>
            <div className={styles.eventsList}>
              {recommendations.events.map((event, idx) => {
                const rec = normalizeRecommendation(event, 'events');
                return (
                <GlassCard key={idx} className={styles.eventCard} hover>
                  <div className={styles.eventDate}>📅 {idx + 1}</div>
                  <div>
                    <p className={styles.recTitle}>{rec.title}</p>
                    <p className={styles.recMeta}>{rec.why}</p>
                  </div>
                  <a className={styles.registerBtn} href={rec.url} target="_blank" rel="noreferrer">
                    Open on ET →
                  </a>
                </GlassCard>
                );
              })}
            </div>
          </section>
        )}

        {/* Financial Tools */}
        {recommendations.financial_tools?.length > 0 && (
          <section>
            <h2>🛠️ Financial Tools</h2>
            <div className={styles.toolsGrid}>
              {recommendations.financial_tools.map((tool, idx) => {
                const rec = normalizeRecommendation(tool, 'financial_tools');
                return (
                <GlassCard key={idx} className={styles.toolCard} hover>
                  <span className={styles.toolIcon}>⚙️</span>
                  <a className={styles.marketLink} href={rec.url} target="_blank" rel="noreferrer">
                    {rec.title}
                  </a>
                </GlassCard>
                );
              })}
            </div>
          </section>
        )}

        <div className={styles.consultCta}>
          <button className={styles.consultBtn} onClick={() => navigate('/chat')}>
            Talk to Concierge
          </button>
        </div>
      </div>
    </motion.div>
  );
}