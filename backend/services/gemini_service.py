"""
services/gemini_service.py
All Google Gemini API calls for ET Smart Concierge.
Uses the new google-genai SDK (google.genai).
"""
import asyncio
import json
import logging
import re
from functools import partial

from google import genai
from google.genai import types

from config import settings

logger = logging.getLogger(__name__)

# Single client instance reused across all requests
_client = genai.Client(api_key=settings.gemini_api_key)


# ── System Prompts ──────────────────────────────────────────────────────────

_ONBOARDING_SYSTEM = """
You are ET Smart Concierge, an AI financial co-pilot for Economic Times India.
Your job is to onboard a new user through a friendly 5-question conversation to build their financial profile.

Ask ONLY these questions, one at a time, in this order:
1. Their name
2. Monthly income range (offer options: Below ₹30k / ₹30k-60k / ₹60k-80k / ₹80k-1L / Above ₹1L)
3. Primary financial goal (Car / House / Savings / Investment / Education / Other)
4. Investment knowledge (Beginner / Intermediate / Expert)
5. Risk appetite (Low - I prefer safe returns / Medium - Balanced / High - I want maximum growth)

Rules:
- Be warm, concise, encouraging. Max 2 sentences per response.
- After each answer, briefly acknowledge it positively before asking next question.
- After question 5 is answered, respond with a JSON block in this exact format:
  PROFILE_COMPLETE: {"name": "", "income_range": "", "goal_type": "", "investment_knowledge": "", "risk_appetite": "", "persona": ""}
- For persona, generate a short 2-3 word label like "Beginner Investor", "Aggressive Saver", "Goal-Oriented Planner"
- Do not ask any other questions. Do not give financial advice yet.
""".strip()

_OPPORTUNITY_SYSTEM = """
You are the Smart Opportunity Engine for ET Smart Concierge.
Analyze the user's current context and profile to decide if a financial product suggestion is appropriate.

If relevant, respond with JSON:
{
  "should_trigger": true,
  "type": "home_loan|credit_card|mutual_fund|sip|fixed_deposit",
  "headline": "",
  "subtext": "",
  "cta": ""
}

If no relevant opportunity, respond with: {"should_trigger": false}

Rules:
- Only suggest if genuinely relevant to context
- Keep headline under 8 words
- Keep subtext under 15 words
- Be specific with numbers when possible (e.g. "save ₹2.3L", "earn 1.4% more")
""".strip()

_NEWS_SYSTEM = """
You are a financial content curator for Economic Times India.
Given a user profile and list of articles, rank and filter the most relevant articles for this user.
Return ONLY a JSON array of article IDs in order of relevance. No explanation.
Format: ["id1", "id2", "id3", ...]
""".strip()


def _build_goal_system(user_profile: dict) -> str:
    return f"""
You are ET Smart Concierge, a warm and intelligent financial advisor for Economic Times India.

User Profile:
- Name: {user_profile.get("name", "User")}
- Income: {user_profile.get("income_range", "unknown")}
- Risk appetite: {user_profile.get("risk_appetite", "medium")}
- Investment knowledge: {user_profile.get("investment_knowledge", "beginner")}
- Persona: {user_profile.get("persona", "Beginner Investor")}

Your role: Help this user plan and achieve their financial goals.

When a user mentions a goal (buy car, buy house, save for X):
1. Ask clarifying questions: target amount and timeline (if not given)
2. Once you have both, generate a structured plan in this exact JSON block:
GOAL_PLAN: {{
  "goal_type": "",
  "target_amount": 0,
  "timeline_months": 0,
  "monthly_saving": 0,
  "down_payment": 0,
  "loan_amount": 0,
  "emi_estimate": 0,
  "milestones": ["Month 3: ...", "Month 6: ...", "Month 12: ..."],
  "et_recommendations": ["Article: Why SIPs work", "Tool: EMI Calculator", "Masterclass: Home Buying Guide"]
}}

For calculations:
- monthly_saving = target_amount / timeline_months (simplified)
- down_payment = 15% of target for vehicles, 20% for property
- loan_amount = target_amount - down_payment
- emi_estimate = rough EMI at 8.5% annual interest

After the JSON block, add 1-2 encouraging sentences.
Also provide 3 short follow-up suggestion chips as:
SUGGESTIONS: ["Increase savings by ₹2k", "Extend to 18 months", "Compare loan options"]

For non-goal messages: answer financial questions conversationally using the user's profile context.
Keep all responses friendly, jargon-free, and India-specific (use ₹, lakhs, crores).
""".strip()


# ── Helpers ─────────────────────────────────────────────────────────────────

def _history_to_gemini(conversation_history: list) -> list[dict]:
    """Convert our {role, content} history to Gemini's {role, parts} format."""
    messages = []
    for m in conversation_history:
        role = m.get("role") if isinstance(m, dict) else str(m.role)
        gemini_role = "model" if role in ("assistant", "MessageRole.assistant") else "user"
        content = m.get("content") if isinstance(m, dict) else m.content
        messages.append({"role": gemini_role, "parts": [{"text": content}]})
    return messages


def _extract_block(text: str, marker: str) -> str | None:
    """Extract the JSON string following a MARKER: prefix using bracket depth tracking."""
    idx = text.find(f"{marker}:")
    if idx == -1:
        return None
    after = text[idx + len(marker) + 1:].strip()
    for open_ch, close_ch in [('{', '}'), ('[', ']')]:
        if after.startswith(open_ch):
            depth = 0
            for i, ch in enumerate(after):
                if ch == open_ch:
                    depth += 1
                elif ch == close_ch:
                    depth -= 1
                    if depth == 0:
                        return after[:i + 1]
    return None


def _clean_reply(text: str, *markers: str) -> str:
    """Strip structured data blocks from the user-facing reply."""
    for marker in markers:
        idx = text.find(f"{marker}:")
        if idx != -1:
            text = text[:idx].strip()
    return text


def _sync_chat(system: str, history: list, user_message: str, max_tokens: int) -> str:
    """
    Synchronous Gemini chat call via the new google.genai SDK.
    Run in a thread via asyncio.to_thread() to avoid blocking FastAPI's event loop.
    """
    chat = _client.chats.create(
        model=settings.model_id,
        history=history,
        config=types.GenerateContentConfig(
            system_instruction=system,
            max_output_tokens=max_tokens,
        ),
    )
    response = chat.send_message(user_message)
    return response.text


def _sync_generate(system: str, prompt: str, max_tokens: int) -> str:
    """Single-shot generation (no history) for news ranking and opportunity detection."""
    response = _client.models.generate_content(
        model=settings.model_id,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=system,
            max_output_tokens=max_tokens,
        ),
    )
    return response.text


# ── Public API ───────────────────────────────────────────────────────────────

async def onboarding_chat(message: str, conversation_history: list) -> dict:
    """Drive the 5-question onboarding conversation."""
    try:
        history = _history_to_gemini(conversation_history)
        raw = await asyncio.to_thread(
            _sync_chat, _ONBOARDING_SYSTEM, history, message, 1000
        )

        extracted_profile = None
        is_complete = False
        block = _extract_block(raw, "PROFILE_COMPLETE")
        if block:
            try:
                extracted_profile = json.loads(block)
                is_complete = True
            except json.JSONDecodeError:
                logger.warning("Failed to parse PROFILE_COMPLETE block: %s", block)

        reply = _clean_reply(raw, "PROFILE_COMPLETE")
        return {"reply": reply, "is_complete": is_complete, "extracted_profile": extracted_profile}

    except Exception as exc:
        logger.error("onboarding_chat error: %s", exc, exc_info=True)
        return {"reply": "Sorry, I ran into a hiccup. Could you repeat that? 🙏", "is_complete": False, "extracted_profile": None}


async def goal_chat(message: str, conversation_history: list, user_profile: dict) -> dict:
    """Goal-planning and financial Q&A with structured plan extraction."""
    try:
        history = _history_to_gemini(conversation_history)
        system = _build_goal_system(user_profile)
        raw = await asyncio.to_thread(
            _sync_chat, system, history, message, 1500
        )

        goal_plan = None
        has_plan = False
        suggestions: list[str] = []

        plan_block = _extract_block(raw, "GOAL_PLAN")
        if plan_block:
            try:
                goal_plan = json.loads(plan_block)
                has_plan = True
            except json.JSONDecodeError:
                logger.warning("Failed to parse GOAL_PLAN block: %s", plan_block)

        suggestions_block = _extract_block(raw, "SUGGESTIONS")
        if suggestions_block:
            try:
                suggestions = json.loads(suggestions_block)
            except json.JSONDecodeError:
                logger.warning("Failed to parse SUGGESTIONS block: %s", suggestions_block)

        reply = _clean_reply(raw, "GOAL_PLAN", "SUGGESTIONS")
        return {"reply": reply, "goal_plan": goal_plan, "has_plan": has_plan, "suggestions": suggestions}

    except Exception as exc:
        logger.error("goal_chat error: %s", exc, exc_info=True)
        return {"reply": "I couldn't process that right now. Please try again.", "goal_plan": None, "has_plan": False, "suggestions": []}


async def personalize_news(articles: list, user_profile: dict) -> list:
    """Rank articles by relevance to the user profile."""
    try:
        articles_index = {a["id"]: a for a in articles if "id" in a}
        prompt = (
            f"User Profile: {json.dumps(user_profile, ensure_ascii=False)}\n\n"
            f"Articles: {json.dumps(articles, ensure_ascii=False)}\n\n"
            "Return the top 6 most relevant article IDs for this user."
        )
        raw = await asyncio.to_thread(
            _sync_generate, _NEWS_SYSTEM, prompt, 500
        )
        match = re.search(r"\[.*?\]", raw, re.DOTALL)
        if match:
            ranked_ids: list[str] = json.loads(match.group())
            ranked = [articles_index[aid] for aid in ranked_ids if aid in articles_index]
            seen = set(ranked_ids)
            ranked += [a for a in articles if a.get("id") not in seen]
            return ranked[:6]

    except Exception as exc:
        logger.error("personalize_news error: %s", exc, exc_info=True)

    return articles[:6]


async def detect_opportunity(user_context: str, user_profile: dict) -> dict | None:
    """Return an opportunity card dict if Gemini decides one should be surfaced."""
    try:
        prompt = (
            f"User context: {user_context}\n\n"
            f"User profile: {json.dumps(user_profile, ensure_ascii=False)}"
        )
        raw = await asyncio.to_thread(
            _sync_generate, _OPPORTUNITY_SYSTEM, prompt, 1000
        )
        match = re.search(r"\{.*?\}", raw, re.DOTALL)
        if match:
            result = json.loads(match.group())
            if result.get("should_trigger"):
                return result
        return None

    except Exception as exc:
        logger.error("detect_opportunity error: %s", exc, exc_info=True)
        return None
