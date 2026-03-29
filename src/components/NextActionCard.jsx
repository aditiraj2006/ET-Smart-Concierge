import React from 'react';
import { useNavigate } from 'react-router-dom';
import GlassCard from './shared/GlassCard';
import styles from './NextActionCard.module.css';

export default function NextActionCard({ nextAction, isLoading = false }) {
  const navigate = useNavigate();

  const actionText = nextAction?.action || 'Review your latest goal plan and pick one small step for today.';
  const reasonText =
    nextAction?.reason ||
    'This keeps your progress consistent and improves long-term outcomes.';
  const ctaText = nextAction?.cta_text || nextAction?.cta || 'Open Concierge Chat';

  const handleClick = () => {
    if (isLoading) return;

    navigate('/chat', {
      state: {
        source: 'next-action-card',
        context: nextAction || {
          action: actionText,
          reason: reasonText,
        },
        prefillMessage: `Help me execute this action: ${actionText}`,
      },
    });
  };

  if (isLoading) {
    return (
      <GlassCard className={`${styles.card} ${styles.skeletonCard}`} glow="teal" hover={false}>
        <div className={styles.skelHeader}></div>
        <div className={styles.skelLineLong}></div>
        <div className={styles.skelLineShort}></div>
        <div className={styles.skelBtn}></div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className={styles.card} glow="teal" hover>
      <div className={styles.headerRow}>
        <span className={styles.badge}>AI</span>
        <h3 className={styles.title}>Next Best Action</h3>
      </div>

      <p className={styles.actionText}>{actionText}</p>
      <p className={styles.reasonText}>{reasonText}</p>

      <button type="button" className={styles.ctaBtn} onClick={handleClick}>
        {ctaText}
      </button>
    </GlassCard>
  );
}
