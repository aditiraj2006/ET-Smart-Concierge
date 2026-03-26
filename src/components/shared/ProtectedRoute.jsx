/**
 * src/components/shared/ProtectedRoute.jsx
 * Redirects unauthenticated users to /login.
 * Shows a full-screen loader while Firebase resolves the auth state.
 */
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-base)",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            border: "3px solid rgba(245,166,35,0.2)",
            borderTopColor: "var(--gold)",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
