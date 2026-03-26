import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, CreditCard, TrendingUp, ArrowRight } from 'lucide-react';
import GlassCard from './shared/GlassCard';
import GoldButton from './shared/GoldButton';

// Variant content configurations
const VARIANTS = [
  {
    id: 1,
    icon: Home,
    chip: "Smart Insight — Based on what you're reading",
    headline: "You could save ₹2.3L on your home loan",
    sub: "SBI vs HDFC rates differ by 0.4% — that adds up over 20 years",
    ctaPrimary: "Compare Now",
    ctaGhost: "Dismiss"
  },
  {
    id: 2,
    icon: CreditCard,
    chip: "Opportunity Spotted",
    headline: "A cashback credit card matches your profile",
    sub: "Your monthly spends qualify for ₹800–₹1,200/mo savings",
    ctaPrimary: "See Options",
    ctaGhost: "Dismiss"
  },
  {
    id: 3,
    icon: TrendingUp,
    chip: "For Beginner Investors",
    headline: "Start a ₹500 SIP today — no minimum lock-in",
    sub: "Top 3 funds for your goal and risk level",
    ctaPrimary: "Explore Funds",
    ctaGhost: "Remind me later"
  }
];

const SmartOpportunity = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Initial appearance after 3 seconds on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    
    // Schedule next variant to slide up after 30 seconds
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % VARIANTS.length);
      setIsVisible(true);
    }, 30000);
  };

  const currentVariant = VARIANTS[currentIndex];
  const Icon = currentVariant.icon;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 999, width: '360px' }}
          initial={{ y: 150, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 150, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        >
          <GlassCard style={{ overflow: 'hidden', padding: '1.25rem' }}>
            <div style={{ 
              position: 'absolute', top: 0, left: 0, right: 0, height: '3px', 
              background: 'linear-gradient(90deg, var(--gold), #FFD07B, var(--gold-dark), var(--gold))', 
              backgroundSize: '200% 100%', 
              animation: 'goldShimmer 3s linear infinite' 
            }} />
            
            <header style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <motion.div 
                animate={{ y: [0, -4, 0] }} 
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                style={{ 
                  width: '32px', height: '32px', borderRadius: '50%', 
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center' 
                }}
              >
                <Icon size={16} color="var(--text-primary)" />
              </motion.div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {currentVariant.chip}
              </div>
            </header>

            <div style={{ marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.05rem', lineHeight: 1.4, marginBottom: '4px', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                {currentVariant.headline}
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {currentVariant.sub}
              </p>
            </div>

            <footer style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <GoldButton variant="ghost" onClick={() => console.log('Primary action')} icon={ArrowRight} style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', border: 'none' }}>
                  {currentVariant.ctaPrimary}
                </GoldButton>
                <button 
                  onClick={handleDismiss} 
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer', padding: '0.5rem', fontFamily: 'var(--font-body)', fontWeight: 500 }}
                >
                  {currentVariant.ctaGhost}
                </button>
              </div>
              <a href="#" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textDecoration: 'underline' }}>Why am I seeing this?</a>
            </footer>
          </GlassCard>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// React.memo to prevent unnecessary re-renders of this global component across route changes
export default React.memo(SmartOpportunity);
