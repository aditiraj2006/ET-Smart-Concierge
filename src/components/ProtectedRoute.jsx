/**
 * src/components/ProtectedRoute.jsx
 * Redirects unauthenticated users to /login.
 * AuthProvider suppresses rendering until auth state resolves,
 * so by the time this renders, loading is always false.
 */
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  return children;
}
