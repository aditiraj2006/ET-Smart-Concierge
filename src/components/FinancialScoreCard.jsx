import React, { useMemo } from 'react';
import GlassCard from './shared/GlassCard';
import styles from './FinancialScoreCard.module.css';

function getScoreLabel(score) {
  if (score >= 80) return 'Excellent';
  if (score >= 65) return 'Good';
  if (score >= 45) return 'Needs Improvement';
  return 'Critical';
}

export default function FinancialScoreCard({ financialScore }) {
  const normalizedScore = useMemo(() => {
    const n = Number(financialScore?.score);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.min(100, Math.round(n)));
  }, [financialScore]);

  const label = normalizedScore === null ? 'Unavailable' : getScoreLabel(normalizedScore);
  const insight =
    financialScore?.insight ||
    'Complete your profile and keep contributions consistent to improve your score.';

  const isLoading = financialScore === null;

  if (isLoading) {
    return (
      <GlassCard className={`${styles.card} ${styles.skeletonCard}`} glow="teal" hover={false}>
        <div className={styles.skelHeader}></div>
        <div className={styles.skelRing}></div>
        <div className={styles.skelLine}></div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className={styles.card} glow="teal" hover>
      <div className={styles.headerRow}>
        <h3 className={styles.title}>Financial Score</h3>
        <span className={styles.statusChip}>{label}</span>
      </div>

      <div className={styles.scoreWrap}>
        <div className={styles.ring}>
          <div className={styles.inner}>
            <div className={styles.scoreText}>
              {normalizedScore === null ? '--' : normalizedScore}
              <span>/100</span>
            </div>
          </div>
        </div>
      </div>

      <p className={styles.insight}>{insight}</p>
    </GlassCard>
  );
}
