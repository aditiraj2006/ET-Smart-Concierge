import React from 'react';
import { motion } from 'framer-motion';

export default function GoldButton({ children, variant = 'filled', onClick, icon: Icon, className = '', style }) {
  const variantClass = variant === 'filled' ? 'gold-btn-filled' : 'gold-btn-ghost';

  return (
    <motion.button
      className={`gold-btn ${variantClass} ${className}`}
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      style={style}
    >
      {children}
      {Icon && <Icon size={16} />}
    </motion.button>
  );
}
