import React from 'react';
import styles from './NudgeBar.module.css';

export default function NudgeBar({ nudges = [], isLoading = false }) {
  if (isLoading) {
    return (
      <section className={styles.wrapper} aria-label="Nudges loading">
        <div className={styles.row}>
          <span className={`${styles.pill} ${styles.skeletonPill}`}></span>
          <span className={`${styles.pill} ${styles.skeletonPill}`}></span>
        </div>
      </section>
    );
  }

  const topNudges = Array.isArray(nudges) ? nudges.filter(Boolean).slice(0, 2) : [];

  if (!topNudges.length) return null;

  return (
    <section className={styles.wrapper} aria-label="Top nudges">
      <div className={styles.row}>
        {topNudges.map((nudge, idx) => (
          <span key={`nudge-${idx}`} className={styles.pill}>
            {nudge}
          </span>
        ))}
      </div>
    </section>
  );
}
