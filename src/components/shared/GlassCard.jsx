import React from 'react';
import { motion } from 'framer-motion';

export default function GlassCard({ children, className = '', glow = 'none', hover = false, style }) {
  const glowClass = glow === 'gold' ? 'glass-glow-gold' : glow === 'teal' ? 'glass-glow-teal' : '';
  const hoverClass = hover ? 'glass-hover' : '';

  // Only apply animation properties if hover is true
  const motionProps = hover ? {
    whileHover: { scale: 1.01, y: -2 },
    transition: { type: 'spring', stiffness: 400, damping: 25 }
  } : {};

  return (
    <motion.div 
      className={`glass-card ${glowClass} ${hoverClass} ${className}`}
      style={style}
      {...motionProps}
    >
      {children}
    </motion.div>
  );
}
