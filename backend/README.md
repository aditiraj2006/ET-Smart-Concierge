# ET Smart Concierge — Backend

AI Financial Co-Pilot API powered by Google Gemini and FastAPI.

## Get Your FREE Gemini API Key

1. Go to https://aistudio.google.com/app/apikey
2. Click **"Create API Key"**
3. Copy the key into `.env` as `GEMINI_API_KEY=...`

### Free Tier Limits (gemini-3-flash-preview)

| Limit | Value |
|---|---|
| Requests per minute | 15 |
| Tokens per minute | 1,000,000 |
| Requests per day | 1,500 |

→ More than enough for prototyping and demos!

---

## Setup

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
```

Open `.env` and add your Gemini API key:

```
GEMINI_API_KEY=your_gemini_api_key_here
MODEL_ID=gemini-3-flash-preview
APP_ENV=development
CORS_ORIGINS=http://localhost:5173
```

## Run

```bash
uvicorn main:app --reload --port 8000
```

## Verify

```bash
curl http://localhost:8000/
# → {"status": "ok", "model": "gemini-3-flash-preview", "provider": "Google Gemini", "api_docs": "/docs"}
```

## API Docs (Swagger UI)

```
http://localhost:8000/docs
```

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/onboarding/chat` | Drive onboarding conversation |
| `GET`  | `/api/onboarding/status/{user_id}` | Check onboarding completion |
| `POST` | `/api/assistant/chat` | Goal planning & financial Q&A |
| `GET`  | `/api/assistant/goals/{user_id}` | List user goals |
| `GET`  | `/api/profile/{user_id}` | Fetch user profile |
| `PATCH`| `/api/profile/{user_id}` | Update profile fields |
| `DELETE`| `/api/profile/{user_id}` | Delete profile |
| `GET`  | `/api/news/feed/{user_id}` | Personalized news feed |
| `GET`  | `/api/news/articles` | All articles (`?category=&is_prime=`) |
| `POST` | `/api/opportunities/detect` | Detect contextual opportunity |
| `GET`  | `/api/opportunities/templates` | All opportunity templates |

---

## Project Structure

```
backend/
├── main.py                    ← FastAPI app, CORS, exception handler
├── config.py                  ← Pydantic settings from .env
├── database.py                ← JSON file-based storage
├── requirements.txt
├── .env.example
├── models/
│   ├── user.py                ← UserProfile, enums, FinancialGoal
│   ├── chat.py                ← OnboardingRequest/Response, AssistantRequest/Response
│   └── opportunity.py        ← OpportunityCard, OpportunityType
├── services/
│   ├── gemini_service.py      ← All Google Gemini API calls
│   └── profile_service.py    ← Profile CRUD, persona logic, goal management
├── routers/
│   ├── onboarding.py
│   ├── assistant.py
│   ├── profile.py
│   ├── news.py
│   └── opportunities.py
└── data/
    ├── articles.json          ← 12 mock ET articles
    ├── opportunities.json     ← 5 opportunity templates
    └── users/                 ← Auto-created; one JSON per user
```

## Frontend Integration

The React app connects via `src/services/api_client.js`.  
User sessions are managed with `src/hooks/useUser.js` (localStorage, no auth required).

After onboarding completes the backend returns a `user_id` — save it:

```js
const { setUserId } = useUser();
const res = await api.onboardingChat(tempId, message, history);
if (res.is_complete) setUserId(res.extracted_profile.user_id);
```
