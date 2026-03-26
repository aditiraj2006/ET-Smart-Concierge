"""
services/profile_service.py
Profile CRUD, persona calculation, and goal management for ET Smart Concierge.
"""
import re
import uuid
from datetime import datetime
from typing import Optional

import database as db
from models.user import (
    FinancialGoal,
    IncomeRange,
    InvestmentKnowledge,
    RiskAppetite,
    UserProfile,
)

# ── Persona lookup table ────────────────────────────────────────────────────

_PERSONA_MAP: dict[tuple[str, str], str] = {
    ("beginner",     "low"):    "Cautious Starter",
    ("beginner",     "medium"): "Beginner Investor",
    ("beginner",     "high"):   "Ambitious Beginner",
    ("intermediate", "low"):    "Steady Builder",
    ("intermediate", "medium"): "Smart Planner",
    ("intermediate", "high"):   "Growth Seeker",
    ("expert",       "low"):    "Wise Investor",
    ("expert",       "medium"): "Seasoned Strategist",
    ("expert",       "high"):   "Aggressive Trader",
}

# ── Enum normalisation helpers ──────────────────────────────────────────────

def _normalise_income(raw: str) -> IncomeRange:
    """Map free-text income strings returned by Claude to IncomeRange enum values."""
    s = raw.lower().replace(" ", "").replace(",", "")
    if "below30" in s or "30k" not in s and "30" in s:
        return IncomeRange.BELOW_30K
    if "30" in s and "60" in s:
        return IncomeRange.RANGE_30_60K
    if "60" in s and "80" in s:
        return IncomeRange.RANGE_60_80K
    if "80" in s and ("1l" in s or "1lakh" in s or "100" in s):
        return IncomeRange.RANGE_80K_1L
    if "above1" in s or "1l+" in s or "above1l" in s:
        return IncomeRange.ABOVE_1L
    # Default fallback
    return IncomeRange.RANGE_30_60K


def _normalise_risk(raw: str) -> RiskAppetite:
    s = raw.lower()
    if "high" in s:
        return RiskAppetite.HIGH
    if "medium" in s or "moderate" in s or "balanced" in s:
        return RiskAppetite.MEDIUM
    return RiskAppetite.LOW


def _normalise_knowledge(raw: str) -> InvestmentKnowledge:
    s = raw.lower()
    if "expert" in s or "advanced" in s:
        return InvestmentKnowledge.EXPERT
    if "intermediate" in s:
        return InvestmentKnowledge.INTERMEDIATE
    return InvestmentKnowledge.BEGINNER


# ── Public helpers ──────────────────────────────────────────────────────────

def calculate_persona(income_range: str, risk_appetite: str, knowledge: str) -> str:
    """
    Rule-based persona label generator.
    All three inputs are matched case-insensitively.
    """
    k = knowledge.lower()
    r = risk_appetite.lower()
    return _PERSONA_MAP.get((k, r), "Smart Planner")


# ── CRUD functions ──────────────────────────────────────────────────────────

async def create_profile(extracted_data: dict) -> UserProfile:
    """
    Build and persist a UserProfile from the dict Claude emits after onboarding.

    Expected keys: name, income_range, goal_type, investment_knowledge, risk_appetite, persona
    """
    now = datetime.utcnow().isoformat()

    income = _normalise_income(extracted_data.get("income_range", ""))
    risk = _normalise_risk(extracted_data.get("risk_appetite", ""))
    knowledge = _normalise_knowledge(extracted_data.get("investment_knowledge", ""))
    persona = extracted_data.get("persona") or calculate_persona(
        income.value, risk.value, knowledge.value
    )

    profile = UserProfile(
        user_id=extracted_data.get("user_id") or str(uuid.uuid4()),
        name=extracted_data.get("name", "User"),
        income_range=income,
        risk_appetite=risk,
        investment_knowledge=knowledge,
        goals=[],
        persona=persona,
        onboarding_completed=True,
        created_at=now,
        updated_at=now,
    )

    await db.save_user(profile.user_id, profile.model_dump())
    return profile


async def get_profile(user_id: str) -> Optional[UserProfile]:
    """Fetch and parse a stored profile. Returns None if not found."""
    data = await db.get_user(user_id)
    if not data:
        return None
    return UserProfile(**data)


async def update_profile_from_chat(user_id: str, message: str) -> Optional[UserProfile]:
    """
    Detect profile update intent via keyword matching and apply it.

    Supported patterns:
    - "income" + a number  → update income_range
    - "risk" + low/medium/high → update risk_appetite
    """
    updates: dict = {}
    msg_lower = message.lower()

    # Income update — look for a number near the word "income"
    if "income" in msg_lower:
        numbers = re.findall(r"\d[\d,k.]+", msg_lower)
        if numbers:
            raw_val = numbers[0].replace(",", "").replace("k", "000")
            updates["income_range"] = _normalise_income(raw_val).value

    # Risk update — look for low / medium / high near "risk"
    if "risk" in msg_lower:
        for keyword in ("high", "medium", "moderate", "balanced", "low"):
            if keyword in msg_lower:
                updates["risk_appetite"] = _normalise_risk(keyword).value
                break

    if not updates:
        return await get_profile(user_id)

    data = await db.update_user(user_id, updates)
    if not data:
        return None
    return UserProfile(**data)


async def add_goal(user_id: str, goal_plan: dict) -> Optional[UserProfile]:
    """
    Convert a goal_plan dict (from Claude's GOAL_PLAN block) into a FinancialGoal
    and append it to the user's goals list.
    """
    now = datetime.utcnow().isoformat()

    goal = FinancialGoal(
        goal_type=goal_plan.get("goal_type", "savings"),
        target_amount=float(goal_plan.get("target_amount", 0)),
        timeline_months=int(goal_plan.get("timeline_months", 12)),
        monthly_saving=float(goal_plan.get("monthly_saving", 0)),
        status="active",
        created_at=now,
    )

    user_data = await db.get_user(user_id)
    if not user_data:
        return None

    goals: list = user_data.get("goals", [])
    goals.append(goal.model_dump())
    user_data["goals"] = goals
    user_data["updated_at"] = now

    await db.save_user(user_id, user_data)
    return UserProfile(**user_data)
