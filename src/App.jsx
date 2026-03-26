import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/Layout/DashboardLayout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import ChatAssistant from './pages/ChatAssistant';

const NewsFeed     = lazy(() => import('./pages/NewsFeed'));
const Opportunities = lazy(() => import('./pages/Opportunities'));

const Fallback = ({ label }) => (
  <div style={{ color: '#fff', padding: '2rem' }}>Loading {label}…</div>
);

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* ── Public ─────────────────────────────────────────── */}
          <Route path="/login"  element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* ── Onboarding (auth required) ──────────────────────── */}
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <Onboarding />
              </ProtectedRoute>
            }
          />

          {/* ── Dashboard shell (auth required) ─────────────────── */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="chat"      element={<ChatAssistant />} />
            <Route
              path="news"
              element={
                <Suspense fallback={<Fallback label="News" />}>
                  <NewsFeed />
                </Suspense>
              }
            />
            <Route
              path="opportunities"
              element={
                <Suspense fallback={<Fallback label="Opportunities" />}>
                  <Opportunities />
                </Suspense>
              }
            />
          </Route>

          {/* ── Fallback ─────────────────────────────────────────── */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
