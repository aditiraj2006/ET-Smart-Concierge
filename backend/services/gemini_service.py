"""
services/gemini_service.py
Improved Gemini service with human-like conversational tone + ET news integration.
"""

import asyncio
import json
import logging
import aiohttp
import re
from datetime import datetime
from google import genai
from google.genai import types
from config import settings
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

_client = genai.Client(api_key=settings.gemini_api_key)

# services/gemini_service.py (add at the top after imports)

# Add this constant at the top of gemini_service.py

DASHBOARD_CONCIERGE_PROMPT = """
You are ET Smart Concierge — an AI that maps users to the full Economic Times ecosystem.

Your job is to analyze the user profile and generate a personalized "ET Journey".

User Profile:
{user_profile}

---

🎯 Your Goal:
Understand the user deeply and recommend:

1. WHO THEY ARE (persona)
2. WHAT THEY SHOULD DO (strategy)
3. WHERE THEY SHOULD GO in ET ecosystem

---

📊 Generate output in JSON with these sections:

{
  "persona_summary": "...",
  "strategy": "...",
  "priority_actions": [
    "..."
  ],
  "et_recommendations": {
    "et_prime": [
            {
                "title": "...",
                "url": "https://economictimes.indiatimes.com/...",
                "why": "..."
            }
    ],
    "et_markets": [
            {
                "title": "...",
                "url": "https://economictimes.indiatimes.com/...",
                "why": "..."
            }
    ],
    "masterclasses": [
            {
                "title": "...",
                "url": "https://economictimes.indiatimes.com/...",
                "why": "..."
            }
    ],
    "events": [
            {
                "title": "...",
                "url": "https://economictimes.indiatimes.com/...",
                "why": "..."
            }
    ],
    "financial_tools": [
            {
                "title": "...",
                "url": "https://economictimes.indiatimes.com/...",
                "why": "..."
            }
    ]
  }
}

---

🧠 Instructions:

1. Persona:
- Combine income + risk + knowledge
- Give a human label (e.g., "Cautious Beginner", "Growth Seeker")

2. Strategy:
- 1–2 lines max
- Clear financial direction

3. Priority Actions:
- Immediate steps user should take
- Practical (start SIP, read article, etc.)

4. ET Mapping (VERY IMPORTANT):
Map user to full ET ecosystem:

- ET Prime → articles they should read
- ET Markets → what to track (stocks, indices)
- Masterclasses → what to learn
- Events → relevant summits/webinars
- Financial Tools → SIP calculators, loan tools

For each recommendation include:
- title (specific)
- url (real ET URL if possible)
- why (one short line)

---

⚠️ Rules:
- Keep suggestions practical and specific
- Do NOT be generic
- Do NOT explain too much
- Focus on ACTIONABLE insights

---

Example style:

Persona: "Beginner Investor exploring wealth building"
Strategy: "Start disciplined investing with low-risk funds"

---

Return ONLY JSON (no explanation).
"""

# Add helper for one-shot generation (if not already present)
def _sync_generate(system: str, prompt: str) -> str:
    response = _client.models.generate_content(
        model=settings.model_id,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=system,
            temperature=0.7,
            max_output_tokens=1000,
        ),
    )
    return response.text


def _fallback_et_journey(user_profile: dict) -> dict:
    goals = user_profile.get("goals") or []
    first_goal = goals[0] if goals and isinstance(goals[0], dict) else {}
    goal_type = (first_goal.get("goal_type") or user_profile.get("goal_type") or "wealth_building").replace("_", " ")
    risk = (user_profile.get("risk_appetite") or "medium").lower()
    knowledge = (user_profile.get("knowledge_level") or "beginner").lower()

    persona = f"{risk.capitalize()}-risk {knowledge} focused on {goal_type}"
    strategy = f"Build steady progress on your {goal_type} goal with disciplined monthly actions."

    return {
        "persona_summary": persona,
        "strategy": strategy,
        "priority_actions": [
            "Start or continue a monthly SIP aligned to your goal",
            "Review one ET Markets update before your next allocation",
            "Track goal progress weekly and adjust contribution if needed",
        ],
        "et_recommendations": {
            "et_prime": [
                "Read one ET Prime personal finance deep-dive this week",
                "Follow ET Prime explainers on inflation and asset allocation",
            ],
            "et_markets": [
                "Track NIFTY 50 trend and sector rotation updates",
                "Watch large-cap earnings headlines before rebalancing",
            ],
            "masterclasses": [
                "Watch an ET investing basics masterclass",
                "Take a risk-management focused market session",
            ],
            "events": [
                "Attend one ET webinar on long-term wealth planning",
            ],
            "financial_tools": [
                "Use SIP calculator to validate monthly target",
                "Use goal planner to check timeline feasibility",
            ],
        },
    }


def _normalize_et_journey(journey: dict, user_profile: dict) -> dict:
    fallback = _fallback_et_journey(user_profile)

    if not isinstance(journey, dict):
        return fallback

    def _norm_item(item):
        if isinstance(item, dict):
            title = str(item.get("title") or item.get("name") or item.get("headline") or "").strip()
            url = str(item.get("url") or item.get("link") or item.get("href") or "").strip()
            why = str(item.get("why") or item.get("reason") or item.get("summary") or "").strip()
            if title:
                normalized = {"title": title}
                if url:
                    normalized["url"] = url
                if why:
                    normalized["why"] = why
                return normalized
            return None

        text = str(item).strip()
        return text or None

    def _norm_list(value, fallback_items):
        if not isinstance(value, list):
            return fallback_items
        clean = []
        for item in value:
            normalized = _norm_item(item)
            if normalized:
                clean.append(normalized)
        return clean if clean else fallback_items

    rec = journey.get("et_recommendations")
    if not isinstance(rec, dict):
        rec = {}

    return {
        "persona_summary": str(journey.get("persona_summary") or fallback["persona_summary"]).strip(),
        "strategy": str(journey.get("strategy") or fallback["strategy"]).strip(),
        "priority_actions": _norm_list(
            journey.get("priority_actions"),
            fallback["priority_actions"],
        ),
        "et_recommendations": {
            "et_prime": _norm_list(rec.get("et_prime"), fallback["et_recommendations"]["et_prime"]),
            "et_markets": _norm_list(rec.get("et_markets"), fallback["et_recommendations"]["et_markets"]),
            "masterclasses": _norm_list(rec.get("masterclasses"), fallback["et_recommendations"]["masterclasses"]),
            "events": _norm_list(rec.get("events"), fallback["et_recommendations"]["events"]),
            "financial_tools": _norm_list(rec.get("financial_tools"), fallback["et_recommendations"]["financial_tools"]),
        },
    }

async def generate_et_journey(user_profile: dict) -> dict:
    """Generate personalized ET journey recommendations using Gemini."""
    try:
        prompt = DASHBOARD_CONCIERGE_PROMPT.replace(
            "{user_profile}",
            json.dumps(user_profile, ensure_ascii=False, indent=2),
        )
        raw = await asyncio.to_thread(
            _sync_generate,
            "You are ET Smart Concierge, an AI that maps users to the full Economic Times ecosystem.",
            prompt,
        )
        parsed = _extract_first_json_object(raw)
        if not isinstance(parsed, dict):
            logger.warning("No valid JSON found in journey response; returning fallback journey")
            return _fallback_et_journey(user_profile)

        return _normalize_et_journey(parsed, user_profile)
    except Exception as e:
        logger.error(f"Error generating ET journey: {e}")
        return _fallback_et_journey(user_profile)

# ─────────────────────────────────────────────────────────
# 🧠 SYSTEM PROMPT (FIXED - HUMAN LIKE)
# ─────────────────────────────────────────────────────────

_FINANCIAL_ASSISTANT_SYSTEM = """
You are ET Smart Concierge — a highly intelligent, friendly, and conversational financial advisor.

🎯 Your personality:
- Talk like a human, not a robot
- Be warm, slightly casual, and helpful
- Keep answers clear and easy to understand
- Adapt tone based on user knowledge (beginner → simple, expert → deeper)
- Ask smart follow-up questions

💬 How to respond:
- Do NOT sound like a blog or report
- Keep responses conversational (like Gemini)
- Break into small readable chunks
- Use examples when helpful
- Avoid long boring paragraphs

🇮🇳 Financial context:
- Always use Indian context (₹, SIP, tax, EMI)
- Suggest practical actions
- Never promise guaranteed returns

⚙️ Special behavior (VERY IMPORTANT):

1. If user is onboarding:
   - Ask one question at a time
   - Extract profile details

2. If user is updating profile:
   - Understand what they want to change
   - Confirm the update clearly
   - Example:
     "Got it — updating your risk to low 👍"

3. If user asks financial questions:
   - Give actionable advice
   - Keep it simple
   - Add disclaimer only if needed

4. Always behave like a personal financial coach, not a generic bot

⚠️ Never:
- Dump too much information
- Sound robotic
- Ignore user context

End every few responses with:
→ a helpful follow-up question (if relevant)
"""

_NEXT_BEST_ACTION_SYSTEM = """
You are ET Smart Concierge, a smart financial coach for Indian users.

You must return ONLY valid JSON with this exact schema:
{
    "action": "short actionable sentence",
    "reason": "why this is recommended",
    "cta": "button text",
    "type": "learn | invest | track | optimize"
}

Rules:
- Action must be specific, measurable, and immediate.
- Reason must be exactly one line and concise.
- Tone: confident, practical, supportive.
- No markdown, no extra keys, no explanations outside JSON.
"""

# ─────────────────────────────────────────────────────────
# 📰 ET NEWS FETCHER (unchanged)
# ─────────────────────────────────────────────────────────

class ETNewsFetcher:
    def __init__(self):
        self.base_url = "https://economictimes.indiatimes.com"
        self.session = None

    async def get_session(self):
        if not self.session:
            self.session = aiohttp.ClientSession()
        return self.session

    async def fetch_news(self, query=None, category=None, limit=5):
        try:
            session = await self.get_session()

            if query:
                url = f"{self.base_url}/search.cms?query={query}"
            elif category:
                url = f"{self.base_url}/{category}/news"
            else:
                url = f"{self.base_url}/news"

            async with session.get(url) as response:
                html = await response.text()
                soup = BeautifulSoup(html, "html.parser")

                articles = []
                for article in soup.find_all("article")[:limit]:
                    title = article.find("h2") or article.find("h3")
                    link = article.find("a")

                    if title and link:
                        articles.append({
                            "title": title.get_text(strip=True),
                            "link": link.get("href", ""),
                            "source": "Economic Times"
                        })

                return articles

        except Exception as e:
            logger.error(f"ET fetch error: {e}")
            return []

    async def search_et(self, query):
        return await self.fetch_news(query=query, limit=3)

    async def get_market_updates(self):
        return await self.fetch_news(category="markets", limit=3)


et_fetcher = ETNewsFetcher()

# ─────────────────────────────────────────────────────────
# 🧩 HELPERS
# ─────────────────────────────────────────────────────────

def _history_to_gemini(history):
    messages = []
    for m in history:
        role = m.get("role")
        gemini_role = "model" if role == "assistant" else "user"
        messages.append({
            "role": gemini_role,
            "parts": [{"text": m.get("content")}]
        })
    return messages


def _extract_block(text, marker):
    idx = text.find(f"{marker}:")
    if idx == -1:
        return None

    after = text[idx + len(marker) + 1:].strip()

    if after.startswith("{"):
        depth = 0
        for i, ch in enumerate(after):
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    return after[:i+1]
    return None


def _clean_reply(text, *markers):
    for marker in markers:
        idx = text.find(f"{marker}:")
        if idx != -1:
            text = text[:idx].strip()
    return text


def _extract_first_json_object(text: str) -> dict | None:
    """Extract first valid JSON object from mixed model output text."""
    if not text:
        return None

    start = text.find("{")
    if start == -1:
        return None

    depth = 0
    for i, ch in enumerate(text[start:], start=start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                candidate = text[start : i + 1]
                try:
                    return json.loads(candidate)
                except json.JSONDecodeError:
                    break

    # Fallback regex attempt if bracket scanning parse fails
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            return None
    return None


def _extract_first_json_array(text: str) -> list | None:
    """Extract first valid JSON array from mixed model output text."""
    if not text:
        return None

    start = text.find("[")
    if start == -1:
        return None

    depth = 0
    for i, ch in enumerate(text[start:], start=start):
        if ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 0:
                candidate = text[start : i + 1]
                try:
                    parsed = json.loads(candidate)
                    return parsed if isinstance(parsed, list) else None
                except json.JSONDecodeError:
                    break

    match = re.search(r"\[.*\]", text, re.DOTALL)
    if match:
        try:
            parsed = json.loads(match.group())
            return parsed if isinstance(parsed, list) else None
        except json.JSONDecodeError:
            return None
    return None


def _income_to_monthly_sip(income_range: str) -> int:
    mapping = {
        "below_30k": 2000,
        "30k_60k": 5000,
        "60k_80k": 8000,
        "80k_1l": 12000,
        "above_1l": 18000,
    }
    return mapping.get((income_range or "").lower(), 5000)


def _build_fallback_next_best_action(user_profile: dict, journey: dict, recent_activity) -> dict:
    """Deterministic backup recommendation if model output is invalid."""
    goals = user_profile.get("goals") or []
    first_goal = goals[0] if goals and isinstance(goals[0], dict) else {}
    goal_type = (first_goal.get("goal_type") or user_profile.get("goal_type") or "wealth").replace("_", " ")
    income_range = user_profile.get("income_range", "30k_60k")
    risk = (user_profile.get("risk_appetite") or "medium").lower()

    sip_amount = int(first_goal.get("monthly_saving") or _income_to_monthly_sip(income_range))

    recent_text = ""
    if isinstance(recent_activity, str):
        recent_text = recent_activity.lower()
    elif isinstance(recent_activity, list):
        recent_text = " ".join(str(x) for x in recent_activity).lower()
    elif isinstance(recent_activity, dict):
        recent_text = json.dumps(recent_activity).lower()

    if "news" in recent_text or "market" in recent_text:
        return {
            "action": "Track NIFTY 50 and one goal-linked ETF daily for the next 7 days",
            "reason": "You are actively checking markets, so consistent tracking will sharpen your entry decisions.",
            "cta": "Start Tracking",
            "type": "track",
        }

    if risk == "low":
        return {
            "action": f"Start Rs {sip_amount} monthly SIP in a large-cap index fund this week",
            "reason": "This aligns with your lower-risk profile while building progress toward your {goal_type} goal.",
            "cta": "Start SIP",
            "type": "invest",
        }

    if risk == "high":
        return {
            "action": f"Allocate Rs {sip_amount} this week across one index fund and one flexi-cap fund",
            "reason": "A split approach supports growth potential while avoiding single-fund concentration risk.",
            "cta": "Build Allocation",
            "type": "optimize",
        }

    return {
        "action": f"Start Rs {sip_amount} SIP in an index fund and review it every month",
        "reason": "This keeps your plan disciplined and directly tied to your {goal_type} timeline.",
        "cta": "Start Plan",
        "type": "invest",
    }


async def get_next_best_action(user_profile):
    """Return one precise next action as valid JSON using Gemini chat."""
    try:
        profile_data = user_profile or {}
        journey = profile_data.get("journey", {}) if isinstance(profile_data, dict) else {}
        recent_activity = profile_data.get("recent_activity", {}) if isinstance(profile_data, dict) else {}

        prompt = (
            "Generate one highly specific next best action for this user.\n\n"
            "Return ONLY valid JSON in this exact format:\n"
            "{\n"
            "  \"action\": \"...\",\n"
            "  \"reason\": \"...\",\n"
            "  \"cta\": \"...\",\n"
            "  \"type\": \"learn|invest|track|optimize\"\n"
            "}\n\n"
            "Rules:\n"
            "- Keep output concise.\n"
            "- Action must be specific and immediate.\n"
            "- Reason must be one short line.\n"
            "- CTA should be 2-4 words.\n\n"
            f"User Profile:\n{json.dumps(profile_data, ensure_ascii=False, indent=2)}\n\n"
            f"ET Journey:\n{json.dumps(journey or {}, ensure_ascii=False, indent=2)}\n\n"
            f"Recent Activity:\n{json.dumps(recent_activity or {}, ensure_ascii=False, indent=2)}\n\n"
            "Output JSON only."
        )

        raw = await asyncio.to_thread(_sync_chat, _NEXT_BEST_ACTION_SYSTEM, [], prompt, 0.7)
        parsed = _extract_first_json_object(raw)

        if not isinstance(parsed, dict):
            return _build_fallback_next_best_action(profile_data, journey or {}, recent_activity)

        action = str(parsed.get("action", "")).strip()
        reason = str(parsed.get("reason", "")).strip()
        cta = str(parsed.get("cta", "")).strip()
        action_type = str(parsed.get("type", "")).strip().lower()

        allowed = {"learn", "invest", "track", "optimize"}

        if not action or len(action.split()) < 4:
            return _build_fallback_next_best_action(profile_data, journey or {}, recent_activity)
        if not reason:
            return _build_fallback_next_best_action(profile_data, journey or {}, recent_activity)
        if not cta:
            cta = "Take Action"
        if action_type not in allowed:
            action_type = "optimize"

        # Keep reason to one line as requested.
        reason = reason.splitlines()[0].strip()

        return {
            "action": action,
            "reason": reason,
            "cta": cta,
            "type": action_type,
        }
    except Exception as exc:
        logger.error("Error generating next best action: %s", exc)
        fallback_profile = user_profile or {}
        return _build_fallback_next_best_action(
            fallback_profile,
            fallback_profile.get("journey", {}) if isinstance(fallback_profile, dict) else {},
            fallback_profile.get("recent_activity", {}) if isinstance(fallback_profile, dict) else {},
        )


async def calculate_financial_score(user_profile):
    """Calculate financial score JSON using Gemini chat."""
    try:
        profile_data = user_profile or {}
        activity = profile_data.get("recent_activity", {}) if isinstance(profile_data, dict) else {}

        prompt = (
            "Score this user's financial health out of 100.\n\n"
            "Return ONLY valid JSON in this exact format:\n"
            "{\n"
            "  \"score\": 0,\n"
            "  \"label\": \"...\",\n"
            "  \"insight\": \"...\"\n"
            "}\n\n"
            "Scoring factors (must consider all): savings, goals, risk, activity.\n"
            "Keep insight concise (max 1 sentence).\n"
            "Score must be integer 0-100.\n\n"
            f"User Profile:\n{json.dumps(profile_data, ensure_ascii=False, indent=2)}\n\n"
            f"Recent Activity:\n{json.dumps(activity, ensure_ascii=False, indent=2)}\n\n"
            "Output JSON only."
        )

        system = (
            "You are ET Smart Concierge. Always output strict valid JSON only. "
            "Be concise and practical."
        )
        raw = await asyncio.to_thread(_sync_chat, system, [], prompt, 0.7)
        parsed = _extract_first_json_object(raw)

        if not isinstance(parsed, dict):
            return {
                "score": 55,
                "label": "Needs Attention",
                "insight": "Improve savings consistency and track goals weekly.",
            }

        score = parsed.get("score", 55)
        try:
            score = int(round(float(score)))
        except (TypeError, ValueError):
            score = 55
        score = max(0, min(100, score))

        label = str(parsed.get("label", "Needs Attention")).strip() or "Needs Attention"
        insight = str(parsed.get("insight", "Improve savings consistency and track goals weekly.")).strip()
        insight = insight.splitlines()[0] if insight else "Improve savings consistency and track goals weekly."

        return {
            "score": score,
            "label": label,
            "insight": insight,
        }
    except Exception as exc:
        logger.error("Error calculating financial score: %s", exc)
        return {
            "score": 55,
            "label": "Needs Attention",
            "insight": "Improve savings consistency and track goals weekly.",
        }


async def generate_nudges(user_profile):
    """Generate exactly three concise nudges as JSON array using Gemini chat."""
    try:
        profile_data = user_profile or {}
        inactivity_days = 0
        if isinstance(profile_data, dict):
            last_active_raw = profile_data.get("last_active_at") or profile_data.get("updated_at")
            if last_active_raw:
                try:
                    last_active = datetime.fromisoformat(str(last_active_raw).replace("Z", "+00:00")).replace(tzinfo=None)
                    inactivity_days = max(0, (datetime.utcnow() - last_active).days)
                except Exception:
                    inactivity_days = 0

        prompt = (
            "Generate exactly 3 short, actionable nudges for this user.\n\n"
            "Return ONLY valid JSON array of strings, like:\n"
            "[\n"
            "  \"...\",\n"
            "  \"...\",\n"
            "  \"...\"\n"
            "]\n\n"
            "Rules:\n"
            "- Max 12 words per nudge.\n"
            "- Keep concise and specific.\n"
            "- Include one inactivity-based nudge if inactivity_days >= 3.\n"
            "- No markdown, no numbering.\n\n"
            f"User Profile:\n{json.dumps(profile_data, ensure_ascii=False, indent=2)}\n\n"
            f"inactivity_days: {inactivity_days}\n"
            "Output JSON only."
        )

        system = "You are ET Smart Concierge. Return strict valid JSON only, concise style."
        raw = await asyncio.to_thread(_sync_chat, system, [], prompt, 0.7)
        parsed = _extract_first_json_array(raw)

        if not isinstance(parsed, list):
            parsed_obj = _extract_first_json_object(raw)
            if isinstance(parsed_obj, dict) and isinstance(parsed_obj.get("nudges"), list):
                parsed = parsed_obj.get("nudges")

        if not isinstance(parsed, list):
            if inactivity_days >= 3:
                return [
                    "You missed your SIP this month",
                    "Markets dipped - good time to invest",
                    "You haven't checked your goal in 5 days",
                ]
            return [
                "Review your goal progress for 2 minutes today",
                "Top up your SIP to stay on track",
                "Check one market update before making changes",
            ]

        clean = [str(item).strip() for item in parsed if str(item).strip()]
        clean = list(dict.fromkeys(clean))
        clean = clean[:3]

        if len(clean) < 3:
            fillers = [
                "Review your goal progress for 2 minutes today",
                "Top up your SIP to stay on track",
                "Check one market update before making changes",
            ]
            for f in fillers:
                if f not in clean:
                    clean.append(f)
                if len(clean) == 3:
                    break

        return clean
    except Exception as exc:
        logger.error("Error generating nudges: %s", exc)
        return [
            "Review your goal progress for 2 minutes today",
            "Top up your SIP to stay on track",
            "Check one market update before making changes",
        ]


def _sync_chat(system, history, user_message, temperature: float = 0.9):
    chat = _client.chats.create(
        model=settings.model_id,
        history=history,
        config=types.GenerateContentConfig(
            system_instruction=system,
            temperature=temperature,
            max_output_tokens=1500,
        ),
    )
    response = chat.send_message(user_message)
    return response.text


# ─────────────────────────────────────────────────────────
# 🚀 MAIN CHAT FUNCTION (FIXED)
# ─────────────────────────────────────────────────────────

async def financial_chat_with_et(message, conversation_history, user_profile):
    try:
        message_lower = message.lower()

        # detect news intent
        is_news = any(word in message_lower for word in [
            "news", "market", "sensex", "nifty", "stock", "update"
        ])

        et_articles = []
        if is_news:
            if "sensex" in message_lower or "nifty" in message_lower:
                et_articles = await et_fetcher.get_market_updates()
            else:
                et_articles = await et_fetcher.search_et(message)

        history = _history_to_gemini(conversation_history)

        # ✅ CLEAN USER MESSAGE + CONTEXT (FIXED)
        context = f"""
User Profile:
{json.dumps(user_profile, indent=2)}

ET News:
{json.dumps(et_articles, indent=2)}
"""

        final_prompt = f"""
User: {message}

[Internal Context - do not mention explicitly]
{context}
"""

        raw = await asyncio.to_thread(
            _sync_chat,
            _FINANCIAL_ASSISTANT_SYSTEM,
            history,
            final_prompt
        )

        # ── Extract structured blocks
        goal_plan = None
        has_plan = False
        suggestions = []

        plan_block = _extract_block(raw, "GOAL_PLAN")
        if plan_block:
            goal_plan = json.loads(plan_block)
            has_plan = True

        reply = _clean_reply(raw, "GOAL_PLAN", "SUGGESTIONS")

        # ✅ Conversational finishing touch
        if not reply.strip().endswith("?"):
            reply += "\n\nWant me to tailor this based on your situation?"

        # add ET references
        if et_articles:
            reply += "\n\n📰 Latest from ET:\n"
            for a in et_articles[:2]:
                reply += f"• {a['title']}\n"

        return {
            "reply": reply,
            "goal_plan": goal_plan,
            "has_plan": has_plan,
            "suggestions": suggestions,
        }

    except Exception as e:
        logger.error(e)
        return {
            "reply": "Something went wrong. Try again.",
            "goal_plan": None,
            "has_plan": False,
            "suggestions": [],
        }