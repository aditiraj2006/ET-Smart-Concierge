// Opportunities.jsx - Updated to show mix of all feeds
import React, { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { auth } from '../config/firebase';
import styles from './Opportunities.module.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const buildOpportunitiesRequest = (userId, token, selectedFeed) => {
  const params = new URLSearchParams();
  params.set('limit', selectedFeed ? '20' : '12');
  if (selectedFeed) {
    params.set('feed_type', selectedFeed);
  }

  return fetch(`${API_BASE}/api/opportunities/user/${userId}?${params.toString()}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
};

const fetchETOpportunities = async (userId, token, selectedFeed) => {
  if (!userId) {
    console.error('No user ID provided');
    throw new Error('User not authenticated');
  }

  // Use current Firebase user token first to avoid stale localStorage/context tokens.
  let authToken = token || localStorage.getItem('firebase_token');
  if (auth.currentUser) {
    authToken = await auth.currentUser.getIdToken();
    localStorage.setItem('firebase_token', authToken);
  }

  if (!authToken) {
    console.error('No auth token available');
    throw new Error('Authentication token missing');
  }

  let response = await buildOpportunitiesRequest(userId, authToken, selectedFeed);

  // Token may be expired. Refresh once and retry automatically.
  if (response.status === 401 && auth.currentUser) {
    const refreshedToken = await auth.currentUser.getIdToken(true);
    if (refreshedToken) {
      localStorage.setItem('firebase_token', refreshedToken);
      response = await buildOpportunitiesRequest(userId, refreshedToken, selectedFeed);
    }
  }

  if (response.status === 401) {
    throw new Error('Authentication failed. Please log in again.');
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch opportunities: ${response.status}`);
  }

  return response.json();
};

const fetchFeedStats = async (token) => {
  const response = await fetch(`${API_BASE}/api/opportunities/feed-stats`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) return null;
  return response.json();
};

const getRelativeTime = (pubDate) => {
  if (!pubDate) return "Just now";
  const date = new Date(pubDate);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
};

const getCategoryColor = (chipLabel) => {
  const colors = {
    'ET Editorial': '#D4891A',
    'ET Commentary': '#52c41a',
    'ET View': '#1890ff',
    'Just in Jest': '#eb2f96',
    'Speaking Tree': '#13c2c2',
    'Bliss of Life': '#722ed1',
    'ET Citings': '#fa8c16',
    'Interviews': '#f5222d'
  };
  
  for (const [key, color] of Object.entries(colors)) {
    if (chipLabel.includes(key)) {
      return color;
    }
  }
  return '#667085';
};

const OpportunityCard = ({ opportunity, index }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  const color = getCategoryColor(opportunity.chip_label);

  return (
    <motion.div 
      ref={ref}
      className={styles.opportunityCard}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
      transition={{ duration: 0.6, delay: (index % 3) * 0.1, type: 'spring' }}
      whileHover={{ y: -5, boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}
    >
      <div className={styles.cardContent}>
        <div className={styles.categoryChip} style={{ backgroundColor: `${color}15`, color: color }}>
          {opportunity.chip_label}
        </div>
        
        <h3 className={styles.headline}>{opportunity.headline}</h3>
        <p className={styles.description}>
          {isExpanded ? opportunity.subtext : `${opportunity.subtext?.slice(0, 120) || ''}...`}
          {opportunity.subtext?.length > 120 && (
            <button 
              className={styles.readMoreBtn}
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? ' Show less' : ' Read more'}
            </button>
          )}
        </p>
        
        <div className={styles.cardFooter}>
          <div className={styles.metaRow}>
            {opportunity.author && (
              <span className={styles.author}>✍️ {opportunity.author}</span>
            )}
            <span className={styles.readTime}>
              🕒 {getRelativeTime(opportunity.article_published)}
            </span>
          </div>
          
          <div className={styles.actionButtons}>
            <a 
              href={opportunity.article_link} 
              target="_blank" 
              rel="noopener noreferrer" 
              className={styles.readFullBtn}
            >
              Read Full Article →
            </a>
            <button className={styles.saveBtn}>
              📌 Save
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default function Opportunities() {
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState(0);
  const [feedStats, setFeedStats] = useState(null);
  
  const { user, token, loading: authLoading } = useAuth();
  const userId = user?.uid || auth.currentUser?.uid || localStorage.getItem('user_id');
  const authToken = token || localStorage.getItem('firebase_token');

  const FILTERS = [
    { label: 'All', feedType: null },
    { label: 'Editorial', feedType: 'et_editorial' },
    { label: 'Commentary', feedType: 'et_commentary' },
    { label: 'ET View', feedType: 'et_view' },
    { label: 'Just in Jest', feedType: 'just_in_jest' },
    { label: 'Speaking Tree', feedType: 'speaking_tree' },
    { label: 'Bliss of Life', feedType: 'bliss_of_everyday_life' },
    { label: 'ET Citings', feedType: 'et_citings' },
    { label: 'Interviews', feedType: 'interviews' }
  ];

  const selectedFeed = FILTERS[activeFilter]?.feedType || null;

  useEffect(() => {
    if (authLoading) return;

    if (userId && authToken) {
      loadOpportunities();
      loadFeedStats();
    } else {
      setError('Please log in to view ET Opinion & Editorial insights');
      setLoading(false);
    }
  }, [userId, authToken, authLoading, activeFilter]);

  const loadFeedStats = async () => {
    try {
      const stats = await fetchFeedStats(authToken);
      if (stats) setFeedStats(stats.stats);
    } catch (err) {
      console.error('Error loading feed stats:', err);
    }
  };

  const loadOpportunities = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchETOpportunities(userId, authToken, selectedFeed);
      setOpportunities(data.opportunities || []);
      console.log('Loaded opportunities by feed:', data.feed_counts);
    } catch (err) {
      console.error('Error loading opportunities:', err);
      setError(err.message || 'Failed to load insights from ET');
    } finally {
      setLoading(false);
    }
  };

  const filteredOpportunities = opportunities;
  const featuredOpportunity = filteredOpportunities.find(opp => opp.chip_label === 'ET Editorial');

  if (authLoading || loading) {
    return (
      <div className={styles.pageWrapper}>
        <div className={styles.loadingContainer}>
          <div className={styles.loader}></div>
          <p>Loading ET Opinion & Editorial insights...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.pageWrapper}>
        <div className={styles.errorContainer}>
          <p>{error}</p>
          <button onClick={loadOpportunities} className={styles.retryBtn}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      className={styles.pageWrapper}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <div className={styles.halftoneBg}></div>

      <main className={styles.mainContent}>
        <motion.div className={styles.filterBar} initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <h1 className={styles.feedTitle}>
            ET Opinions & Editorial
          </h1>
          <div className={styles.chipContainer}>
            {FILTERS.map((f, i) => (
              <button 
                key={f.label} 
                className={`${styles.filterChip} ${activeFilter === i ? styles.active : ''}`}
                onClick={() => setActiveFilter(i)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Featured Editorial Card */}
        {featuredOpportunity && (
          <motion.div 
            className={styles.featuredCard} 
            initial={{ opacity: 0, scale: 0.98 }} 
            animate={{ opacity: 1, scale: 1 }} 
            transition={{ delay: 0.2 }}
          >
            <div className={styles.featuredContent}>
              <div className={styles.featuredTag}>ET Editorial • Opinion</div>
              <h2 className={styles.featuredHeadline}>{featuredOpportunity.headline}</h2>
              <p className={styles.featuredExcerpt}>
                {featuredOpportunity.subtext?.slice(0, 150)}...
              </p>
              <a 
                href={featuredOpportunity.article_link} 
                target="_blank" 
                rel="noopener noreferrer" 
                className={styles.readFeaturedBtn}
              >
                Read Full Editorial →
              </a>
            </div>
          </motion.div>
        )}

        {/* Masonry Grid - Shows mixed feeds */}
        <div className={styles.masonryGrid}>
          {filteredOpportunities.length > 0 ? (
            filteredOpportunities.map((opportunity, index) => (
              <OpportunityCard key={opportunity.id || index} opportunity={opportunity} index={index} />
            ))
          ) : (
            <div className={styles.noArticles}>
              <p>No insights found. Try a different category.</p>
            </div>
          )}
        </div>
      </main>

      {/* Right Rail */}
      <aside className={styles.rightRail}>
        <motion.div className={styles.streakCard} initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.5 }}>
          <div className={styles.streakHeader}>
            <span className={styles.streakFlame}>🔥</span>
            <h3>Reading Streak</h3>
          </div>
          <p className={styles.streakText}>You've read {opportunities.length} opinion pieces this week.</p>
          <div className={styles.streakProgress}><div className={styles.streakFill} style={{width:'65%'}}></div></div>
        </motion.div>

        <motion.div className={styles.trendingCard} initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.6 }}>
          <h3 className={styles.railTitle}>Latest from All Feeds</h3>
          <ul className={styles.railList}>
            {opportunities.slice(0, 5).map((opp, idx) => (
              <li key={idx}>
                <span className={styles.feedIcon}>{opp.icon}</span>
                <a href={opp.article_link} target="_blank" rel="noopener noreferrer">
                  {opp.headline?.substring(0, 50)}...
                </a>
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div className={styles.quoteCard} initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.7 }}>
          <h3 className={styles.railTitle}>From Speaking Tree</h3>
          <div className={styles.quoteContent}>
            <p>"Wisdom begins with the understanding that we are all connected."</p>
            <span className={styles.quoteAuthor}>— ET Speaking Tree</span>
          </div>
        </motion.div>
      </aside>
    </motion.div>
  );
}