/**
 * src/services/api_client.js
 * Centralised fetch client for ET Smart Concierge → FastAPI backend.
 *
 * Token handling:
 *  - Forces a token refresh before every request (tokens expire after 1 hr).
 *  - Falls back to the localStorage cached token if no active Firebase user
 *    (e.g. during server-side rendering or right after page load).
 */
import { auth } from "../config/firebase";

const BASE_URL = `${import.meta.env.VITE_API_URL ?? "http://localhost:8000"}/api`;

/**
 * Always returns a fresh Firebase ID token.
 * forceRefresh=true silently renews expired tokens before the server rejects them.
 */
async function getAuthHeader() {
  try {
    // Prefer live token with force-refresh over cached value
    if (auth.currentUser) {
      const token = await auth.currentUser.getIdToken(/* forceRefresh= */ true);
      localStorage.setItem("firebase_token", token); // keep localStorage in sync
      return { Authorization: `Bearer ${token}` };
    }
  } catch {
    // getIdToken can fail if the user is signed out mid-request; fall through
  }

  // Fallback: use whatever is in localStorage (may be slightly stale)
  const cached = localStorage.getItem("firebase_token");
  if (cached) return { Authorization: `Bearer ${cached}` };

  return {};
}

async function request(path, options = {}) {
  const authHeader = await getAuthHeader();

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...authHeader,
      ...(options.headers ?? {}),
    },
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Request failed: ${res.status}`);
  }

  return res.json();
}

const api = {
  // ── Onboarding ────────────────────────────────────────────────────────
  onboardingChat: (userId, message, history = []) =>
    request("/onboarding/chat", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, message, conversation_history: history }),
    }),

  onboardingStatus: (userId) => request(`/onboarding/status/${userId}`),

  // ── Assistant ─────────────────────────────────────────────────────────
  assistantChat: (userId, message, history = []) =>
    request("/assistant/chat", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, message, conversation_history: history }),
    }),

  getGoals: (userId) => request(`/assistant/goals/${userId}`),
  getJourney: (userId) => request(`/assistant/journey/${userId}`),
  getNextAction: (userId) => request(`/assistant/next-action/${userId}`),
  getFinancialScore: (userId) => request(`/assistant/financial-score/${userId}`),
  getNudges: (userId) => request(`/assistant/nudges/${userId}`),

  // ── Profile ───────────────────────────────────────────────────────────
  getProfile:    (userId)          => request(`/profile/${userId}`),
  updateProfile: (userId, updates) => request(`/profile/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  }),
  deleteProfile: (userId) => request(`/profile/${userId}`, { method: "DELETE" }),

  // ── News ──────────────────────────────────────────────────────────────
  getNewsFeed: (userId) => request(`/news/feed/${userId}`),
  getDashboardFeed: (userId, limit = 6) => request(`/news/dashboard/${userId}?limit=${limit}`),
  getLiveMarket: () => request('/news/market/live'),
  getArticles: ({ category, is_prime } = {}) => {
    const params = new URLSearchParams();
    if (category  !== undefined) params.append("category",  category);
    if (is_prime  !== undefined) params.append("is_prime",  is_prime);
    const qs = params.toString();
    return request(`/news/articles${qs ? `?${qs}` : ""}`);
  },

  // ── Opportunities ─────────────────────────────────────────────────────
  detectOpportunity: (userId, context) =>
    request("/opportunities/detect", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, context }),
    }),
  getOpportunityTemplates: () => request("/opportunities/templates"),
};

export default api;
