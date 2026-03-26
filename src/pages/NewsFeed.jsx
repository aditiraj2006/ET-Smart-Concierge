// NewsFeed.jsx - Fix the userId retrieval
import React, { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { useAuth } from '../context/AuthContext'; // Import your auth context
import styles from './NewsFeed.module.css';

const FILTERS = ['All', 'Markets', 'Mutual Funds', 'Real Estate', 'Economy', 'Tax', 'Savings', 'Tech'];

// API Service - Fix for Vite
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const fetchFeed = async (userId, category = null, token) => {
  if (!userId) {
    console.error('No user ID provided');
    throw new Error('User not authenticated');
  }

  if (!token) {
    console.error('No auth token provided');
    throw new Error('Authentication token missing');
  }
  
  let url = `${API_BASE}/api/news/feed/${userId}`;
  if (category && category !== 'All') {
    url += `?category=${category.toLowerCase()}`;
  }
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (response.status === 401) {
    throw new Error('Authentication failed. Please log in again.');
  }
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Feed endpoint not found. Please check backend configuration.');
    }
    throw new Error(`Failed to fetch feed: ${response.status}`);
  }
  return response.json();
};

const stripHtml = (text = '') => text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

const buildArticleDescription = (article) => {
  const sourceText =
    article?.summary ||
    article?.excerpt ||
    article?.description ||
    article?.content ||
    '';

  const clean = stripHtml(sourceText);
  if (!clean) {
    return `Get a quick breakdown of this ${article?.category || 'finance'} update and what it may mean for your money decisions.`;
  }

  return clean.length > 220 ? `${clean.slice(0, 217)}...` : clean;
};

const FlipCard = ({ article, index }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

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

  const categoryColors = {
    'Markets': '#1890ff',
    'Mutual Funds': '#eb2f96',
    'Real Estate': '#fa8c16',
    'Economy': '#52c41a',
    'Tax': '#f5222d',
    'Savings': '#722ed1',
    'Tech': '#13c2c2'
  };

  const color = categoryColors[article.category] || '#667085';

  return (
    <motion.div 
      ref={ref}
      className={styles.articleCard}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
      transition={{ duration: 0.6, delay: (index % 4) * 0.1, type: 'spring' }}
      whileHover={{ y: -5, boxShadow: '0 20px 40px rgba(0,0,0,0.08)' }}
    >
      <div className={styles.cardInner} style={{ transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0)' }}>
        <div className={styles.cardFront}>
          {article.image_url && (
            <div className={styles.articleImage}>
              <img src={article.image_url} alt={article.title} />
            </div>
          )}
          <div className={styles.categoryChip} style={{ backgroundColor: `${color}15`, color: color }}>
            {article.category}
          </div>
          <h3 className={styles.headline}>{article.title}</h3>
          <p className={styles.description}>{buildArticleDescription(article)}</p>
          <div className={styles.cardBottom}>
            <div className={styles.metaRow}>
              {article.is_prime && <span className={styles.primeLock}>Prime 🔒</span>}
              <span className={styles.readTime}>🕒 {getRelativeTime(article.published)}</span>
            </div>
            <a href={article.link} target="_blank" rel="noopener noreferrer" className={styles.readMoreLink}>
              Read More →
            </a>
            <button className={styles.eli15Btn} onClick={() => setIsFlipped(true)}>
              Explain Like I'm 15 💡
            </button>
          </div>
        </div>
        
        <div className={styles.cardBack}>
          <div className={styles.eliHeader}>
            <div className={styles.eliHeaderTitle}>
              <span className={styles.bulbIcon}>💡</span> Explain Like I'm 15
            </div>
            <button className={styles.closeEliBtn} onClick={() => setIsFlipped(false)}>×</button>
          </div>
          <p className={styles.eliContent}>
            <strong>Simple explanation:</strong> {article.eli_explanation || `Think of ${article.category} as a marketplace. ${article.title.split('.')[0]}... It's like when everyone rushes to buy the same thing at once, causing prices to move quickly.`}
          </p>
          <a href={article.link} target="_blank" rel="noopener noreferrer" className={styles.readFullBtn}>
            Read Full Article on ET →
          </a>
        </div>
      </div>
    </motion.div>
  );
};

export default function NewsFeed() {
  const [activeFilter, setActiveFilter] = useState(0);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [featuredArticle, setFeaturedArticle] = useState(null);
  
  // Get user from auth context
  const { user, token, loading: authLoading } = useAuth();
  const userId = user?.uid || localStorage.getItem('user_id');
  const authToken = token || localStorage.getItem('firebase_token');

  useEffect(() => {
    if (authLoading) return;

    if (userId && authToken) {
      loadFeed();
    } else {
      setError('Please log in to view your personalized feed');
      setLoading(false);
    }
  }, [activeFilter, userId, authToken, authLoading]);

  const loadFeed = async () => {
    setLoading(true);
    setError(null);
    try {
      const category = activeFilter === 0 ? null : FILTERS[activeFilter];
      const data = await fetchFeed(userId, category, authToken);
      setArticles(data.articles || []);
      
      if (data.articles && data.articles.length > 0) {
        setFeaturedArticle(data.articles[0]);
      }
    } catch (err) {
      console.error('Error loading feed:', err);
      setError(err.message || 'Failed to load news feed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className={styles.pageWrapper}>
        <div className={styles.loadingContainer}>
          <div className={styles.loader}></div>
          <p>Loading the latest news...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.pageWrapper}>
        <div className={styles.errorContainer}>
          <p>{error}</p>
          <button onClick={loadFeed} className={styles.retryBtn}>Retry</button>
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

      <main className={styles.mainFeed}>
        <motion.div className={styles.filterBar} initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <h1 className={styles.feedTitle}>Economic Times  Your Feed</h1>
          <div className={styles.chipContainer}>
            {FILTERS.map((f, i) => (
              <button 
                key={f} 
                className={`${styles.filterChip} ${activeFilter === i ? styles.active : ''}`}
                onClick={() => setActiveFilter(i)}
              >
                {f}
              </button>
            ))}
          </div>
        </motion.div>

        {featuredArticle && (
          <motion.div className={styles.featuredCard} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>
            {featuredArticle.image_url && (
              <div className={styles.featuredImage} style={{ backgroundImage: `url(${featuredArticle.image_url})` }} />
            )}
            <div className={styles.featuredContent}>
              <div className={styles.featuredTag}>
                {featuredArticle.is_prime ? 'Prime Exclusive' : 'Top Story'}
              </div>
              <h2 className={styles.featuredHeadline}>{featuredArticle.title}</h2>
              <p className={styles.featuredExcerpt}>{featuredArticle.summary}</p>
              <a href={featuredArticle.link} target="_blank" rel="noopener noreferrer" className={styles.readFeaturedBtn}>
                Read Full Story →
              </a>
            </div>
          </motion.div>
        )}

        <div className={styles.masonryGrid}>
          {articles.length > 0 ? (
            articles.map((article, index) => (
              <FlipCard key={article.id || index} article={article} index={index} />
            ))
          ) : (
            <div className={styles.noArticles}>
              <p>No articles found. Try a different category.</p>
            </div>
          )}
        </div>
      </main>

      <aside className={styles.rightRail}>
        <motion.div className={styles.streakCard} initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.5 }}>
          <div className={styles.streakHeader}>
            <span className={styles.streakFlame}>🔥</span>
            <h3>4 Day Streak!</h3>
          </div>
          <p className={styles.streakText}>You've read 12 articles about {FILTERS[activeFilter] !== 'All' ? FILTERS[activeFilter] : 'finance'} this week.</p>
          <div className={styles.streakProgress}><div className={styles.streakFill} style={{width:'80%'}}></div></div>
        </motion.div>

        <motion.div className={styles.trendingCard} initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.6 }}>
          <h3 className={styles.railTitle}>Trending on ET</h3>
          <ul className={styles.railList}>
            {articles.slice(0, 5).map((article, idx) => (
              <li key={idx}>
                <a href={article.link} target="_blank" rel="noopener noreferrer">
                  {article.title && article.title.substring(0, 60)}...
                </a>
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div className={styles.goalPicksCard} initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.7 }}>
          <h3 className={styles.railTitle}>For your "House" Goal</h3>
          <ul className={styles.railList}>
            <li>How to save for a 20% down payment ↗</li>
            <li>Should you break FDs for real estate? ↗</li>
            <li>Top areas seeing price corrections in 2024 ↗</li>
          </ul>
        </motion.div>
      </aside>
    </motion.div>
  );
}