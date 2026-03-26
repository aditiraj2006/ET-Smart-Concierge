import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import AnimatedBg from '../shared/AnimatedBg';
import SmartOpportunity from '../SmartOpportunity';

export default function DashboardLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%', position: 'relative' }}>
      {/* Global Background Layer */}
      <AnimatedBg />
      
      {/* Mobile Hamburger Trigger */}
      {isMobile && (
        <button 
          onClick={() => setIsSidebarOpen(true)}
          style={{ position: 'fixed', top: '1.5rem', left: '1.5rem', zIndex: 40, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem', color: 'var(--gold)', cursor: 'pointer', backdropFilter: 'blur(10px)' }}
        >
          <Menu size={24} />
        </button>
      )}

      {/* Sidebar with Mobile Drawer State */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isMobile={isMobile} />
      
      {/* Dynamic Content Area offset from sidebar */ }
      <main style={{ 
        flex: 1, 
        marginLeft: isMobile ? '0' : '220px', 
        width: isMobile ? '100%' : 'calc(100% - 220px)',
        transition: 'margin 0.3s ease',
        position: 'relative',
        zIndex: 5
      }}>
        <Outlet />
      </main>

      {/* Persistent global contextual card layer */}
      <SmartOpportunity />
    </div>
  );
}
