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

_KNOWLEDGE_ORDER = [
    InvestmentKnowledge.BEGINNER,
    InvestmentKnowledge.INTERMEDIATE,
    InvestmentKnowledge.EXPERT,
]

_RISK_ORDER = [
    RiskAppetite.LOW,
    RiskAppetite.MEDIUM,
    RiskAppetite.HIGH,
]

_ADVANCED_TOPICS = {
    "alpha",
    "beta",
    "sharpe",
    "std dev",
    "volatility",
    "drawdown",
    "rebalance",
    "asset allocation",
    "hedging",
    "futures",
    "options",
    "covered call",
    "put option",
    "yield curve",
    "duration",
    "expense ratio",
    "cagr",
    "irr",
    "valuation",
}

_HIGH_RISK_ACTIONS = {
    "futures",
    "options",
    "intraday",
    "leverage",
    "margin",
    "crypto",
    "penny stock",
    "smallcap trading",
    "short sell",
}

_BEHAVIOR_PERSONA_MAP: dict[tuple[str, str], str] = {
    ("beginner", "low"): "Cautious Beginner",
    ("beginner", "medium"): "Emerging Planner",
    ("beginner", "high"): "Bold Beginner",
    ("intermediate", "low"): "Steady Planner",
    ("intermediate", "medium"): "Active Wealth Builder",
    ("intermediate", "high"): "Growth Accelerator",
    ("expert", "low"): "Disciplined Strategist",
    ("expert", "medium"): "Strategic Wealth Builder",
    ("expert", "high"): "Aggressive Growth Investor",
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


def _project_future_value(monthly_saving: float, months: int, annual_return: float) -> float:
    """Simple monthly compounding projection for recurring SIP-like contributions."""
    if months <= 0 or monthly_saving <= 0:
        return 0.0
    monthly_rate = annual_return / 12.0
    if monthly_rate <= 0:
        return monthly_saving * months
    return monthly_saving * (((1 + monthly_rate) ** months - 1) / monthly_rate)


def _estimate_timeline_for_target(
    target_amount: float,
    monthly_saving: float,
    annual_return: float,
    default_timeline: int,
) -> int:
    """Estimate number of months needed to reach a target using simple projection."""
    if target_amount <= 0:
        return max(int(default_timeline or 12), 1)
    if monthly_saving <= 0:
        return max(int(default_timeline or 12), 1)

    for months in range(1, 601):  # cap at 50 years
        if _project_future_value(monthly_saving, months, annual_return) >= target_amount:
            return months
    return max(int(default_timeline or 12), 1)


def simulate_goal_scenarios(goal_plan: dict) -> list[dict]:
    """Generate conservative, balanced, and aggressive goal scenarios."""
    base_timeline = int(goal_plan.get("timeline_months", 12) or 12)
    target_amount = float(goal_plan.get("target_amount", 0) or 0)
    base_monthly = float(goal_plan.get("monthly_saving", 0) or 0)

    if base_monthly <= 0 and target_amount > 0 and base_timeline > 0:
        base_monthly = target_amount / base_timeline
    if base_monthly <= 0:
        base_monthly = 5000.0

    scenario_defs = [
        {"type": "conservative", "saving_multiplier": 0.9, "annual_return": 0.04, "risk": "low"},
        {"type": "balanced", "saving_multiplier": 1.0, "annual_return": 0.07, "risk": "medium"},
        {"type": "aggressive", "saving_multiplier": 1.15, "annual_return": 0.1, "risk": "high"},
    ]

    scenarios: list[dict] = []
    for scenario in scenario_defs:
        monthly_saving = round(base_monthly * scenario["saving_multiplier"])
        timeline = _estimate_timeline_for_target(
            target_amount=target_amount,
            monthly_saving=float(monthly_saving),
            annual_return=float(scenario["annual_return"]),
            default_timeline=base_timeline,
        )

        scenarios.append(
            {
                "type": scenario["type"],
                "monthly_saving": int(monthly_saving),
                "timeline": int(timeline),
                "risk": scenario["risk"],
            }
        )

    return scenarios


def _extract_activity_text(user_actions) -> str:
    if isinstance(user_actions, str):
        return user_actions.lower()

    if isinstance(user_actions, dict):
        return " ".join(str(v) for v in user_actions.values()).lower()

    if isinstance(user_actions, list):
        chunks: list[str] = []
        for item in user_actions:
            if isinstance(item, str):
                chunks.append(item)
            elif isinstance(item, dict):
                chunks.extend(str(v) for v in item.values())
            else:
                chunks.append(str(item))
        return " ".join(chunks).lower()

    return ""


def _detect_inactivity(user_actions, inactive_days: int = 30) -> bool:
    if not user_actions:
        return True

    if isinstance(user_actions, dict):
        possible_date = user_actions.get("last_active_at") or user_actions.get("last_action_at")
        if possible_date:
            try:
                last_dt = datetime.fromisoformat(str(possible_date).replace("Z", "+00:00"))
                return (datetime.utcnow() - last_dt.replace(tzinfo=None)).days >= inactive_days
            except Exception:
                return False

    if isinstance(user_actions, list):
        latest: Optional[datetime] = None
        for item in user_actions:
            if not isinstance(item, dict):
                continue
            raw = item.get("created_at") or item.get("timestamp") or item.get("date")
            if not raw:
                continue
            try:
                dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00")).replace(tzinfo=None)
            except Exception:
                continue
            if latest is None or dt > latest:
                latest = dt
        if latest is None:
            return False
        return (datetime.utcnow() - latest).days >= inactive_days

    return False


def _upgrade_enum(current, ordered_values):
    try:
        idx = ordered_values.index(current)
        return ordered_values[min(idx + 1, len(ordered_values) - 1)]
    except ValueError:
        return current


def _to_dict(obj):
    if hasattr(obj, "model_dump"):
        return obj.model_dump()
    if isinstance(obj, dict):
        return obj
    return {}


def _clamp_score(value: float) -> int:
    return max(0, min(100, int(round(value))))


def _score_savings_consistency(activity: dict) -> int:
    """
    Savings consistency score (0-100).
    Expected hints in activity:
    - savings_consistency_pct (0-100)
    - sip_paid_months, sip_expected_months
    """
    if not activity:
        return 50

    if activity.get("savings_consistency_pct") is not None:
        try:
            return _clamp_score(float(activity.get("savings_consistency_pct")))
        except (TypeError, ValueError):
            pass

    paid = activity.get("sip_paid_months")
    expected = activity.get("sip_expected_months")
    if isinstance(paid, (int, float)) and isinstance(expected, (int, float)) and expected > 0:
        return _clamp_score((float(paid) / float(expected)) * 100)

    return 50


def _score_goal_progress(goals: list) -> int:
    """
    Goal progress score (0-100).
    Uses average of explicit progress_pct if available,
    otherwise estimates from target_amount vs monthly_saving * timeline_months.
    """
    if not goals:
        return 40

    progress_values: list[float] = []
    for goal in goals:
        g = _to_dict(goal)
        explicit = g.get("progress_pct")
        if isinstance(explicit, (int, float)):
            progress_values.append(float(explicit))
            continue

        target = g.get("target_amount")
        monthly = g.get("monthly_saving")
        timeline = g.get("timeline_months")
        if all(isinstance(x, (int, float)) for x in (target, monthly, timeline)) and float(target) > 0:
            estimated = (float(monthly) * float(timeline)) / float(target) * 100
            progress_values.append(min(100.0, max(0.0, estimated)))

    if not progress_values:
        return 40

    return _clamp_score(sum(progress_values) / len(progress_values))


def _score_risk_alignment(user_profile: dict, activity: dict) -> int:
    """
    Risk alignment score (0-100).
    Compares user's declared risk appetite with observed behavior hints.
    """
    declared = str(user_profile.get("risk_appetite", "medium")).lower()
    observed = str(activity.get("observed_risk_level", declared)).lower()

    order = {"low": 0, "medium": 1, "high": 2}
    d = order.get(declared, 1)
    o = order.get(observed, d)
    gap = abs(d - o)

    if gap == 0:
        return 100
    if gap == 1:
        return 70
    return 35


def _score_learning_activity(activity: dict) -> int:
    """
    Learning activity score (0-100).
    Expected hints in activity:
    - learning_sessions_30d
    - advanced_questions_30d
    - education_minutes_30d
    """
    if not activity:
        return 35

    sessions = float(activity.get("learning_sessions_30d", 0) or 0)
    advanced_q = float(activity.get("advanced_questions_30d", 0) or 0)
    minutes = float(activity.get("education_minutes_30d", 0) or 0)

    # Weighted micro-score with practical caps.
    score = min(100.0, sessions * 8 + advanced_q * 6 + (minutes / 6.0))
    return _clamp_score(score)


def calculate_financial_score(user_profile, goals, activity):
    """
    Calculate user financial score out of 100.

    Weights:
    - Savings consistency: 30%
    - Goal progress: 30%
    - Risk alignment: 20%
    - Learning activity: 20%

    Returns:
    {
      "score": 72,
      "label": "Good Progress",
      "insight": "You're doing well but can improve consistency"
    }
    """
    profile_data = _to_dict(user_profile)
    activity_data = _to_dict(activity)

    goal_items: list = []
    if isinstance(goals, list):
        goal_items = goals
    elif profile_data.get("goals") and isinstance(profile_data.get("goals"), list):
        goal_items = profile_data.get("goals")

    savings_score = _score_savings_consistency(activity_data)
    goal_score = _score_goal_progress(goal_items)
    risk_score = _score_risk_alignment(profile_data, activity_data)
    learning_score = _score_learning_activity(activity_data)

    final_score = _clamp_score(
        savings_score * 0.30
        + goal_score * 0.30
        + risk_score * 0.20
        + learning_score * 0.20
    )

    if final_score >= 80:
        label = "Excellent Momentum"
        insight = "You're building strong habits, keep compounding this discipline."
    elif final_score >= 65:
        label = "Good Progress"
        insight = "You're doing well but can improve consistency."
    elif final_score >= 45:
        label = "Needs Attention"
        insight = "Your base is set, now focus on regular savings and learning cadence."
    else:
        label = "Getting Started"
        insight = "Start with one small weekly action to build steady financial momentum."

    return {
        "score": final_score,
        "label": label,
        "insight": insight,
    }


def _parse_iso_datetime(raw_value) -> Optional[datetime]:
    if not raw_value:
        return None
    try:
        return datetime.fromisoformat(str(raw_value).replace("Z", "+00:00")).replace(tzinfo=None)
    except Exception:
        return None


def generate_nudges(user_profile, activity) -> list[str]:
    """
    Generate user nudges from behavior and market context.

    Example nudges:
    - "You missed your SIP this month"
    - "Markets dipped — good time to invest"
    - "You haven't checked your goal in 5 days"
    """
    profile_data = _to_dict(user_profile)
    activity_data = _to_dict(activity)
    nudges: list[str] = []

    # SIP consistency nudge
    sip_paid_this_month = activity_data.get("sip_paid_this_month")
    paid = activity_data.get("sip_paid_months")
    expected = activity_data.get("sip_expected_months")
    if sip_paid_this_month is False:
        nudges.append("You missed your SIP this month")
    elif isinstance(paid, (int, float)) and isinstance(expected, (int, float)) and expected > paid:
        nudges.append("You missed your SIP this month")

    # Market dip opportunity nudge
    nifty_change = activity_data.get("nifty_change_pct")
    market_change = activity_data.get("market_change_pct")
    dip_signal = nifty_change if isinstance(nifty_change, (int, float)) else market_change
    risk = str(profile_data.get("risk_appetite", "medium")).lower()
    if isinstance(dip_signal, (int, float)) and float(dip_signal) <= -1.0 and risk in {"medium", "high"}:
        nudges.append("Markets dipped - good time to invest")

    # Goal check inactivity nudge
    last_goal_check = _parse_iso_datetime(activity_data.get("goal_last_checked_at"))
    if last_goal_check and (datetime.utcnow() - last_goal_check).days >= 5:
        nudges.append("You haven't checked your goal in 5 days")

    # Lightweight personalized fallbacks
    if not nudges:
        knowledge = str(profile_data.get("investment_knowledge", "beginner")).lower()
        if knowledge == "beginner":
            nudges.append("Take 5 minutes today to review your first investment goal")
        else:
            nudges.append("Quick portfolio check can keep your plan on track")

    # Keep nudges concise and non-duplicated.
    deduped = list(dict.fromkeys(nudges))
    return deduped[:5]


def update_persona_based_on_behavior(user_profile, user_actions):
    """
    Dynamically adjust persona from behavioral signals and track persona history.

    Rules:
    - Advanced questions  -> upgrade investment knowledge by one level.
    - High-risk actions   -> increase risk appetite by one level.
    - Inactivity detected -> mark as passive investor.

    Returns updated persona label string.
    Mutates user_profile in-place (dict or UserProfile object) with:
    - investment_knowledge (possible upgrade)
    - risk_appetite (possible increase)
    - passive_investor
    - persona
    - persona_history (append-on-change)
    """
    profile_dict = user_profile.model_dump() if hasattr(user_profile, "model_dump") else dict(user_profile)

    raw_knowledge = str(profile_dict.get("investment_knowledge", InvestmentKnowledge.BEGINNER.value)).lower()
    raw_risk = str(profile_dict.get("risk_appetite", RiskAppetite.LOW.value)).lower()

    knowledge = _normalise_knowledge(raw_knowledge)
    risk = _normalise_risk(raw_risk)

    old_persona = profile_dict.get("persona") or _BEHAVIOR_PERSONA_MAP.get((knowledge.value, risk.value), "Active Wealth Builder")
    text = _extract_activity_text(user_actions)

    has_advanced_questions = any(topic in text for topic in _ADVANCED_TOPICS)
    has_high_risk_actions = any(term in text for term in _HIGH_RISK_ACTIONS)
    is_inactive = _detect_inactivity(user_actions)

    if has_advanced_questions:
        knowledge = _upgrade_enum(knowledge, _KNOWLEDGE_ORDER)

    if has_high_risk_actions:
        risk = _upgrade_enum(risk, _RISK_ORDER)

    if is_inactive:
        new_persona = f"Passive Investor - {_BEHAVIOR_PERSONA_MAP.get((knowledge.value, risk.value), 'Cautious Beginner')}"
    else:
        new_persona = _BEHAVIOR_PERSONA_MAP.get((knowledge.value, risk.value), "Active Wealth Builder")

    history = list(profile_dict.get("persona_history", []))
    if new_persona != old_persona:
        reason_parts: list[str] = []
        if has_advanced_questions:
            reason_parts.append("advanced_questions")
        if has_high_risk_actions:
            reason_parts.append("high_risk_actions")
        if is_inactive:
            reason_parts.append("inactive_user")
        history.append(
            {
                "from": old_persona,
                "to": new_persona,
                "timestamp": datetime.utcnow().isoformat(),
                "reason": ",".join(reason_parts) if reason_parts else "behavior_update",
            }
        )

    profile_dict["investment_knowledge"] = knowledge.value
    profile_dict["risk_appetite"] = risk.value
    profile_dict["passive_investor"] = is_inactive
    profile_dict["persona"] = new_persona
    profile_dict["persona_history"] = history

    if hasattr(user_profile, "model_dump"):
        user_profile.investment_knowledge = knowledge
        user_profile.risk_appetite = risk
        user_profile.passive_investor = is_inactive
        user_profile.persona = new_persona
        user_profile.persona_history = history
    else:
        user_profile.update(
            {
                "investment_knowledge": knowledge.value,
                "risk_appetite": risk.value,
                "passive_investor": is_inactive,
                "persona": new_persona,
                "persona_history": history,
            }
        )

    return new_persona


async def apply_persona_update_from_behavior(user_id: str, user_actions) -> Optional[UserProfile]:
    """Load profile, apply behavior-based persona update, and persist changes."""
    profile = await get_profile(user_id)
    if not profile:
        return None

    update_persona_based_on_behavior(profile, user_actions)
    payload = {
        "investment_knowledge": profile.investment_knowledge.value,
        "risk_appetite": profile.risk_appetite.value,
        "passive_investor": profile.passive_investor,
        "persona": profile.persona,
        "persona_history": profile.persona_history,
    }
    data = await db.update_user(user_id, payload)
    return UserProfile(**data) if data else None


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
        persona_history=[
            {
                "from": None,
                "to": persona,
                "timestamp": now,
                "reason": "onboarding_profile_created",
            }
        ],
        passive_investor=False,
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
