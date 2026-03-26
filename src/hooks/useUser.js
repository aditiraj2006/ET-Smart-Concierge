/**
 * src/hooks/useUser.js
 * Thin adapter over AuthContext so existing pages keep the same API.
 * userId === Firebase UID.
 */
import { useAuth } from "../context/AuthContext";

export function useUser() {
  const { user, logOut } = useAuth();

  return {
    userId: user?.uid ?? null,
    user,
    setUserId: () => {}, // identity provided by Firebase — no manual setter needed
    clearUser: logOut,
  };
}

export default useUser;
