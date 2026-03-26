import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Target, Bot, Newspaper, Brain, Settings, ArrowRight, Zap, X, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import '../../styles/tokens.css';

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Dashboard",  path: "/dashboard" },
  { icon: Target,          label: "Goals",      path: "/goals" },
  { icon: Bot,             label: "Assistant",  path: "/chat" },
  { icon: Newspaper,       label: "News",       path: "/news" },
  { icon: Brain,      label: "Opinions",  path: "/opportunities" },
  { icon: Settings,        label: "Settings",   path: "/settings" },
];

/** Derive initials from a display-name string. */
function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** User avatar — photo if available, else gold initials circle. */
function UserAvatar({ user }) {
  if (user?.photoURL) {
    return (
      <img
        src={user.photoURL}
        alt={user.displayName ?? 'User'}
        style={{
          width: 40, height: 40, borderRadius: '50%',
          objectFit: 'cover',
          border: '2px solid rgba(245,166,35,0.4)',
        }}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <div style={{
      width: 40, height: 40, borderRadius: '50%',
      background: 'linear-gradient(135deg, var(--gold), #ff8a00)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#000', fontWeight: 700, fontSize: '0.9rem',
      flexShrink: 0,
    }}>
      {getInitials(user?.displayName || user?.email)}
    </div>
  );
}

export default function Sidebar({ isOpen, onClose, isMobile }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Derive a friendly display name
  const displayName = user?.displayName
    || user?.email?.split('@')[0]
    || 'User';

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const sidebarContent = (
    <>
      {/* Logo row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Zap color="var(--gold)" fill="var(--gold)" size={24} />
          <span style={{ fontSize: '1.2rem', fontWeight: 800, fontFamily: 'var(--font-display)' }}>ET Concierge</span>
        </div>
        {isMobile && (
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        )}
      </div>

      {/* User identity card */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2rem',
        padding: '12px',
        background: 'rgba(255,255,255,0.02)',
        borderRadius: '12px',
        border: '1px solid var(--border)',
      }}>
        <UserAvatar user={user} />
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontWeight: 600, fontSize: '0.95rem',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {displayName}
          </div>
          <div style={{
            fontSize: '0.7rem', color: 'var(--teal)',
            background: 'rgba(0, 212, 184, 0.1)',
            padding: '2px 6px', borderRadius: '4px',
            marginTop: '4px', display: 'inline-block', fontWeight: 600,
          }}>
            🌱 Beginner Investor
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.label}
              to={item.path}
              className={({ isActive }) =>
                `nav-link ${isActive && item.path !== '/settings' && item.path !== '/goals' ? 'active' : ''}`
              }
              onClick={isMobile ? onClose : undefined}
            >
              <Icon size={20} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {/* Upgrade card */}
      <div className="upgrade-card">
        <h4 style={{ fontFamily: 'var(--font-display)' }}>Upgrade to ET Prime ✨</h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.4 }}>
          Unlock premium insights and advanced portfolio tracking.
        </p>
        <button style={{
          width: '100%', padding: '0.6rem',
          background: 'var(--text-primary)', color: 'var(--bg-base)',
          border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
          fontFamily: 'var(--font-body)',
        }}>
          Upgrade <ArrowRight size={16} />
        </button>
      </div>

      {/* Sign Out */}
      <motion.button
        onClick={handleLogout}
        whileHover={{ x: 2 }}
        whileTap={{ scale: 0.97 }}
        style={{
          marginTop: '0.75rem',
          display: 'flex', alignItems: 'center', gap: '0.6rem',
          width: '100%', padding: '0.6rem 0.75rem',
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '10px',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-body)',
          fontSize: '0.88rem',
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'color 0.2s, border-color 0.2s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.color = '#fc8181';
          e.currentTarget.style.borderColor = 'rgba(252,129,129,0.25)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.color = 'var(--text-secondary)';
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)';
        }}
      >
        <LogOut size={16} />
        Sign Out
      </motion.button>
    </>
  );

  return (
    <>
      {isMobile ? (
        <AnimatePresence>
          {isOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                style={{ position: 'fixed', inset: 0, background: 'rgba(4,11,24,0.6)', zIndex: 45, backdropFilter: 'blur(4px)' }}
              />
              <motion.aside
                className="sidebar"
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                style={{ position: 'fixed', top: 0, left: 0, zIndex: 50, borderRight: '1px solid var(--gold)' }}
              >
                {sidebarContent}
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      ) : (
        <aside className="sidebar">
          {sidebarContent}
        </aside>
      )}
    </>
  );
}
