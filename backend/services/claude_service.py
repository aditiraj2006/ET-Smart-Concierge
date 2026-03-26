"""
services/claude_service.py
All Anthropic API calls for ET Smart Concierge go through this module.
"""
import json
import logging
import re
import anthropic

from config import settings

logger = logging.getLogger(__name__)

# Async client — single instance reused across requests
_client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

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

def _history_to_messages(conversation_history: list) -> list[dict]:
    """Convert ChatMessage objects or plain dicts to Anthropic message format."""
    messages = []
    for m in conversation_history:
        role = m.get("role") if isinstance(m, dict) else m.role
        content = m.get("content") if isinstance(m, dict) else m.content
        messages.append({"role": str(role).replace("MessageRole.", ""), "content": content})
    return messages


def _extract_block(text: str, marker: str) -> str | None:
    """Extract the JSON string following a MARKER: prefix."""
    idx = text.find(f"{marker}:")
    if idx == -1:
        return None
    after = text[idx + len(marker) + 1:].strip()
    # Grab everything from the first { or [ to the matching close bracket
    for open_ch, close_ch in [('{', '}'), ('[', ']')]:
        if after.startswith(open_ch):
            depth = 0
            for i, ch in enumerate(after):
                if ch == open_ch:
                    depth += 1
                elif ch == close_ch:
                    depth -= 1
                    if depth == 0:
                        return after[: i + 1]
    return None


def _clean_reply(text: str, *markers: str) -> str:
    """Strip structured data blocks from the user-facing reply text."""
    for marker in markers:
        idx = text.find(f"{marker}:")
        if idx != -1:
            text = text[:idx].strip()
    return text


# ── Public API ───────────────────────────────────────────────────────────────

async def onboarding_chat(message: str, conversation_history: list) -> dict:
    """
    Drive the 5-question onboarding conversation.

    Returns:
        {
            "reply": str,
            "is_complete": bool,
            "extracted_profile": dict | None
        }
    """
    try:
        messages = _history_to_messages(conversation_history)
        messages.append({"role": "user", "content": message})

        response = await _client.messages.create(
            model=settings.model_id,
            max_tokens=1000,
            system=_ONBOARDING_SYSTEM,
            messages=messages,
        )
        raw = response.content[0].text

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
        return {
            "reply": "Sorry, I ran into a hiccup. Could you repeat that? 🙏",
            "is_complete": False,
            "extracted_profile": None,
        }


async def goal_chat(message: str, conversation_history: list, user_profile: dict) -> dict:
    """
    Goal-planning and general financial Q&A with structured plan extraction.

    Returns:
        {
            "reply": str,
            "goal_plan": dict | None,
            "has_plan": bool,
            "suggestions": list[str]
        }
    """
    try:
        messages = _history_to_messages(conversation_history)
        messages.append({"role": "user", "content": message})

        response = await _client.messages.create(
            model=settings.model_id,
            max_tokens=1500,
            system=_build_goal_system(user_profile),
            messages=messages,
        )
        raw = response.content[0].text

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
        return {
            "reply": "I couldn't process that right now. Please try again in a moment.",
            "goal_plan": None,
            "has_plan": False,
            "suggestions": [],
        }


async def personalize_news(articles: list, user_profile: dict) -> list:
    """
    Rank and filter articles based on the user's profile using Claude.
    Falls back to the original ordering if parsing fails.

    Returns:
        Reordered list of article dicts (up to 6).
    """
    try:
        articles_index = {a["id"]: a for a in articles if "id" in a}
        user_msg = (
            f"User Profile: {json.dumps(user_profile, ensure_ascii=False)}\n\n"
            f"Articles: {json.dumps(articles, ensure_ascii=False)}\n\n"
            "Return the top 6 most relevant article IDs for this user."
        )

        response = await _client.messages.create(
            model=settings.model_id,
            max_tokens=500,
            system=_NEWS_SYSTEM,
            messages=[{"role": "user", "content": user_msg}],
        )
        raw = response.content[0].text.strip()

        # Parse a bare JSON array from the response
        match = re.search(r"\[.*?\]", raw, re.DOTALL)
        if match:
            ranked_ids: list[str] = json.loads(match.group())
            ranked = [articles_index[aid] for aid in ranked_ids if aid in articles_index]
            # Append any articles not in ranked list (in original order)
            seen = set(ranked_ids)
            ranked += [a for a in articles if a.get("id") not in seen]
            return ranked[:6]

    except Exception as exc:
        logger.error("personalize_news error: %s", exc, exc_info=True)

    # Fallback: return original list capped at 6
    return articles[:6]


async def detect_opportunity(user_context: str, user_profile: dict) -> dict | None:
    """
    Decide whether a contextual financial opportunity should be surfaced.

    Returns:
        Opportunity dict if should_trigger is True, else None.
    """
    try:
        user_msg = (
            f"User context: {user_context}\n\n"
            f"User profile: {json.dumps(user_profile, ensure_ascii=False)}"
        )

        response = await _client.messages.create(
            model=settings.model_id,
            max_tokens=1000,
            system=_OPPORTUNITY_SYSTEM,
            messages=[{"role": "user", "content": user_msg}],
        )
        raw = response.content[0].text.strip()

        match = re.search(r"\{.*?\}", raw, re.DOTALL)
        if match:
            result = json.loads(match.group())
            if result.get("should_trigger"):
                return result
            return None

    except Exception as exc:
        logger.error("detect_opportunity error: %s", exc, exc_info=True)

    return None
