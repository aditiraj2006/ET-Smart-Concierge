# ET Smart Concierge 🤖

**An AI-powered Financial Co-Pilot that guides users through the Economic Times ecosystem**

A production-ready full-stack application that combines conversational AI, personalized recommendations, and real-time financial data to deliver a next-generation user experience for financial exploration and planning.

---

## 🎯 Overview

ET Smart Concierge is a three-tier application:
- **Frontend**: React 18 SPA with Vite, Firebase Auth, and Framer Motion animations
- **Backend**: FastAPI async service with Google Gemini AI integration
- **Data**: Firestore for persistence, RSS feeds for real-time content, Yahoo Finance for market data

### Key Features

✨ **Conversational Onboarding** — 5-question AI chat to understand user profile  
🧠 **Dynamic Personalization** — 9 behavioral personas with real-time updates  
💬 **Financial Assistant** — Goal planning and investment Q&A with ET ecosystem context  
📰 **Real-Time News Feed** — Curated content from 8 ET opinion/editorial feeds  
💡 **Smart Opportunities** — Contextual recommendations matched to user profile  
📊 **Financial Score** — Multi-factor scoring with smart nudges and inactivity detection  
🗺 **ET Ecosystem Journey** — Guided path to ET Prime, masterclasses, tools, and markets  
📈 **Live Market Pulse** — Real-time NIFTY 50, SENSEX, GOLD tickers with sparklines  

---

## 📋 Prerequisites

Before you start, ensure you have:

- **Node.js** (v18+)
- **Python** (v3.11+)
- **pip** (Python package manager)
- **Google Gemini API Key** (free tier available)
- **Firebase Project** with:
  - Firebase Authentication enabled
  - Firestore database configured
  - Firebase credentials JSON for Admin SDK

### Get Your Free Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click **"Create API Key"**
3. Copy the key (important for backend setup)

**Free Tier Limits:**
- 15 requests/minute
- 1,000,000 tokens/minute
- 1,500 requests/day

---

## 🚀 Quick Start

### Step 1: Clone & Navigate

```bash
cd ET-Smart-Concierge
```

### Step 2: Backend Setup

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
```

Edit `.env` and add your credentials:
```env
GEMINI_API_KEY=your_gemini_api_key_here
MODEL_ID=gemini-3-flash-preview
APP_ENV=development
CORS_ORIGINS=http://localhost:5173
FIREBASE_CREDENTIALS_PATH=./firebase_credentials.json
```

Place your Firebase credentials JSON file at `backend/firebase_credentials.json`.

Start the backend:
```bash
uvicorn main:app --reload --port 8000
```

✅ Verify: Visit `http://localhost:8000/` — should return `{"status": "ok", ...}`

### Step 3: Frontend Setup

```bash
cd ..
npm install
```

Create `.env.local`:
```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_API_BASE_URL=http://localhost:8000/api
```

Start the frontend:
```bash
npm run dev
```

✅ Open `http://localhost:5173/`

---

## 📁 Project Structure

```
ET-Smart-Concierge/
├── README.md                          ← This file
├── package.json                       ← Frontend dependencies
├── vite.config.js                     ← Vite build config
├── index.html                         ← Entry point
│
├── src/                               ← React Frontend (Vite SPA)
│   ├── main.jsx                       ← App render entry
│   ├── App.jsx                        ← Router & layout
│   ├── index.css                      ← Global styles
│   ├── config/
│   │   └── firebase.js                ← Firebase initialization
│   ├── context/
│   │   └── AuthContext.jsx            ← Firebase auth state
│   ├── hooks/
│   │   └── useUser.js                 ← User & profile hooks
│   ├── services/
│   │   └── api_client.js              ← Centralized API client
│   ├── pages/                         ← Route components
│   │   ├── Dashboard.jsx              ← KPI & journey
│   │   ├── ChatAssistant.jsx          ← Goal planning chat
│   │   ├── Opportunities.jsx          ← Opportunities feed
│   │   ├── NewsFeed.jsx               ← Real-time ET content
│   │   ├── Journey.jsx                ← ET ecosystem map
│   │   ├── Onboarding.jsx             ← 5-question setup
│   │   └── Login.jsx                  ← Firebase auth UI
│   ├── components/
│   │   ├── Layout/                    ← Dashboard layout
│   │   ├── shared/                    ← Reusable UI components
│   │   └── *.jsx                      ← Page-specific components
│   └── styles/                        ← Design tokens, animations
│
└── backend/                           ← FastAPI Backend (Python)
    ├── main.py                        ← FastAPI app initialization
    ├── config.py                      ← Environment & settings
    ├── database.py                    ← Firestore client wrapper
    ├── firebase_admin_init.py         ← Firebase Admin SDK setup
    ├── requirements.txt               ← Python dependencies
    ├── .env.example                   ← Env template
    ├── README.md                      ← Backend API docs
    │
    ├── models/                        ← Pydantic data models
    │   ├── user.py                    ← UserProfile, Financial Goal
    │   ├── chat.py                    ← Request/Response DTOs
    │   └── opportunity.py             ← Opportunity cards
    ├── services/                      ← Business logic
    │   ├── gemini_service.py          ← 5 AI agents + prompts
    │   ├── profile_service.py         ← Profile CRUD & persona
    │   ├── claude_service.py          ← Alternative AI (optional)
    │   ├── recommendation_service.py  ← Recommendations engine
    │   ├── rss_service.py             ← ET feed fetcher
    │   └── opportunity_service.py     ← Opportunity detection
    ├── routers/                       ← API endpoint handlers
    │   ├── onboarding.py              ← POST /api/onboarding/chat
    │   ├── assistant.py               ← POST /api/assistant/chat
    │   ├── profile.py                 ← GET/PATCH /api/profile
    │   ├── news.py                    ← GET /api/news/feed
    │   └── opportunities.py           ← GET /api/opportunities
    ├── middleware/                    ← Request interceptors
    │   └── auth.py                    ← Firebase token verification
    ├── data/                          ← Mock data
    │   ├── articles.json              ← 12 ET articles
    │   ├── opportunities.json         ← 5 templates
    │   └── users/                     ← Auto-created user profiles
    └── __pycache__/                   ← Python bytecode
```

---

## 🔧 Environment Configuration

### Backend (.env)

```env
# Gemini Configuration
GEMINI_API_KEY=your_gemini_api_key
MODEL_ID=gemini-3-flash-preview

# Firebase
FIREBASE_CREDENTIALS_PATH=./firebase_credentials.json

# App Settings
APP_ENV=development
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Database
DATABASE_URL=./data/users
```

### Frontend (.env.local)

```env
# Firebase Web Config
VITE_FIREBASE_API_KEY=your_web_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_web_app_id

# API Gateway
VITE_API_BASE_URL=http://localhost:8000/api
```

---

## 🏃 Running the Application

### Start Backend (Terminal 1)

```bash
cd backend
uvicorn main:app --reload --port 8000
```

Expected output:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete
```

### Start Frontend (Terminal 2)

```bash
npm run dev
```

Expected output:
```
  VITE v5.0.0  ready in 123 ms

  ➜  Local:   http://localhost:5173/
```

### Verify Both Services

| Service | URL | Check |
|---------|-----|-------|
| Frontend | http://localhost:5173/ | React app loads, login page appears |
| Backend (API) | http://localhost:8000/ | Returns `{"status": "ok"}` |
| API Docs | http://localhost:8000/docs | Swagger UI with all endpoints |

---

## 📡 API Endpoints

### Authentication (Firestore-based)
All endpoints require a valid Firebase ID token in the `Authorization: Bearer {token}` header.

### Onboarding Flow
```
POST   /api/onboarding/chat                 → Drive 5-question conversation
GET    /api/onboarding/status/{user_id}    → Check completion status
```

### Chat Assistant
```
POST   /api/assistant/chat                  → Goal planning & financial Q&A
GET    /api/assistant/goals/{user_id}      → Fetch user's financial goals
```

### User Profile
```
GET    /api/profile/{user_id}               → Fetch user profile
PATCH  /api/profile/{user_id}               → Update profile fields
DELETE /api/profile/{user_id}               → Delete profile
```

### News & Opportunities
```
GET    /api/news/feed/{user_id}             → Personalized ET news feed
GET    /api/news/articles                   → All articles (filters: ?category=, ?is_prime=)
POST   /api/opportunities/detect            → Detect contextual opportunity
GET    /api/opportunities/templates         → All opportunity templates
```

**Full API Documentation:** http://localhost:8000/docs (Swagger UI)

---

## 🔐 Authentication Flow

1. User signs up/logs in via Firebase Auth UI
2. Firebase issues an ID token (1-hour expiry)
3. Frontend calls `getIdToken(forceRefresh=true)` before every API request
4. Token is sent as `Authorization: Bearer {token}`
5. Backend verifies token via Firebase Admin SDK
6. `verified_uid` is extracted and validated per endpoint

**Token Fallback:** If Firebase hasn't loaded yet, frontend uses cached token from `localStorage`.

---

## 🧠 How It Works

### User Journey

1. **Signup/Login** → Firebase Auth
2. **Onboarding** → 5-question Gemini chat
   - Income range
   - Investment knowledge
   - Risk appetite
   - Financial goals
   - Time horizon
3. **Profile Created** → Persona assigned (9 archetypes)
4. **Dashboard** → 7 parallel API calls load KPIs, goals, journey, market data
5. **Chat Assistant** → Ask financial questions
6. **Opportunities** → Real-time ET content curated for your profile
7. **Journey** → Personalized ET ecosystem map

### AI Agents (Gemini-Powered)

| Agent | Purpose | Trigger |
|-------|---------|---------|
| 🧑‍🏫 Onboarding | Profile collection | New user signup |
| 🤖 Goal Planning | Financial planning & Q&A | Chat message sent |
| 📰 News Ranker | Content personalization | Dashboard load, news page |
| 💡 Opportunity | Smart recommendations | Every chat message |
| 🔔 Nudge | Behavioral prompts | Inactivity, missed SIP, market event |

---

## 📊 Data Models

### UserProfile
```python
{
  "user_id": str,
  "name": str,
  "email": str,
  "income_range": IncomeRange,          # 5 levels: < 20k, 20-50k, 50-80k, 80-100k, > 100k
  "investment_knowledge": InvestmentLevel,  # BEGINNER, INTERMEDIATE, EXPERT
  "risk_appetite": RiskLevel,            # CONSERVATIVE, MODERATE, AGGRESSIVE
  "financial_goals": [FinancialGoal],    # List of user's goals
  "persona": str,                        # e.g., "Aggressive Growth Seeker"
  "onboarding_complete": bool,
  "created_at": datetime,
  "updated_at": datetime,
  "last_active_at": datetime
}
```

### FinancialGoal
```python
{
  "goal_type": str,                # e.g., "Buy a car"
  "target_amount": float,          # ₹ amount
  "timeline_months": int,          # Months to achieve
  "monthly_saving": float,         # Suggested monthly investment
  "priority": str,                 # HIGH, MEDIUM, LOW
  "created_at": datetime
}
```

---

## 🛠 Troubleshooting

### Backend Issues

**Error: `GEMINI_API_KEY not found`**
- Verify `.env` file exists in `backend/` directory
- Check key is copied correctly from Google AI Studio

**Error: `Firebase credentials not loaded`**
- Ensure `firebase_credentials.json` is in `backend/` AND path in `.env` is correct
- Download from Firebase Console → Project Settings → Service Accounts

**Error: `CORS error / 403 on frontend requests`**
- Check `CORS_ORIGINS` in `.env` includes frontend URL
- Default should include `http://localhost:5173`

### Frontend Issues

**Error: `Firebase config invalid`**
- Verify `.env.local` has correct Firebase project credentials
- All 6 values (API Key, Auth Domain, Project ID, etc.) must be filled

**Error: `Cannot reach backend`**
- Ensure backend is running on port 8000
- Check `VITE_API_BASE_URL` in `.env.local` matches backend URL

**Error: `Token expired / 401 Unauthorized`**
- Token refresh is automatic; refresh the page
- Clear `localStorage` if issues persist

---

## 🚀 Development Workflow

### Making Changes

**Frontend:**
```bash
npm run dev              # Hot reload enabled
npm run build           # Production build
npm run preview         # Preview production build
```

**Backend:**
```bash
uvicorn main:app --reload    # Auto-restart on code changes
```

### Testing API Manually

```bash
# Get a Firebase token, then:
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8000/api/profile/YOUR_USER_ID
```

---

## 📚 Key Technologies

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18 | UI components & state |
| Build | Vite | Fast dev server & build |
| Styling | CSS Modules + Tailwind | Component styles |
| Animations | Framer Motion | Smooth transitions |
| Backend | FastAPI | Async web framework |
| AI | Google Gemini | LLM for all agents |
| Auth | Firebase Auth | User authentication |
| Database | Firestore | User data persistence |
| Real-time | Yahoo Finance | Market data |
| Content | ET RSS Feeds | Financial news |

---

## 📖 Documentation

- **[Backend API README](backend/README.md)** — Detailed API docs, agents, services
- **[Architecture Document](docs/ARCHITECTURE.md)** — System design, data flows, error handling
- **[Google Gemini Docs](https://ai.google.dev/docs)** — LLM capabilities
- **[FastAPI Docs](https://fastapi.tiangolo.com/)** — Backend framework
- **[Firebase Docs](https://firebase.google.com/docs)** — Auth & Firestore

---

## 🎓 Next Steps

1. ✅ Complete setup (frontend + backend running)
2. ✅ Sign up via Firebase Auth
3. ✅ Complete 5-question onboarding
4. ✅ Explore Dashboard, Chat, Opportunities, News
5. 🚀 Deploy to staging/production

---

## 📝 License

This project is part of the **ET Hackatide** initiative.

---

## 🤝 Support

For questions or issues:
1. Check [Troubleshooting](#-troubleshooting) section above
2. Review [Backend README](backend/README.md) for API-specific help
3. Verify all `.env` variables are set correctly
4. Ensure Firebase project is properly configured

---

**Built with ❤️ for Economic Times**
