"""
Smart opportunity engine — selects and scores contextual cross-sell cards.
"""
from typing import List, Optional
import database as db
from models.opportunity import OpportunityCard


def detect_market_opportunity(market_data: dict, user_profile: dict) -> dict:
    """
    Detect one high-signal opportunity from market data and user profile.

    Returns shape:
    {
      "opportunity": "...",
      "impact": "...",
      "action": "..."
    }
    """
    market = market_data or {}
    profile = user_profile or {}

    risk = str(profile.get("risk_appetite", "medium")).lower()
    income = str(profile.get("income_range", "")).lower()

    fd_rate_change = float(market.get("fd_rate_change_bps", 0) or 0)
    inflation = float(market.get("inflation_rate", 0) or 0)
    nifty_change = float(market.get("nifty_change_pct", 0) or 0)
    debt_yield = float(market.get("debt_fund_yield", 0) or 0)

    # Rule 1: Fixed deposit rates have moved up.
    if fd_rate_change >= 15 and risk == "low":
        return {
            "opportunity": "FD rates increased",
            "impact": "Better returns for low-risk users",
            "action": "Consider switching savings",
        }

    # Rule 2: Equity momentum for higher-risk users.
    if nifty_change >= 2.0 and risk in {"medium", "high"}:
        return {
            "opportunity": "Market momentum improving",
            "impact": "Growth assets may offer stronger short-term upside",
            "action": "Review SIP allocation toward diversified equity funds",
        }

    # Rule 3: Inflation pressure favors better yielding debt.
    if inflation >= 6.0 and debt_yield >= 7.0:
        return {
            "opportunity": "Debt yields becoming attractive",
            "impact": "Can protect purchasing power better than idle cash",
            "action": "Evaluate short-duration debt funds or high-yield FDs",
        }

    # Fallback opportunity by user profile.
    if risk == "low":
        return {
            "opportunity": "Stable income opportunity",
            "impact": "Lower volatility products can improve consistency",
            "action": "Move surplus cash into laddered FDs or short-term debt",
        }

    if risk == "high":
        return {
            "opportunity": "Growth optimization opportunity",
            "impact": "Higher-risk profile can benefit from phased equity exposure",
            "action": "Increase monthly SIP step-up by 5-10%",
        }

    if "below_30k" in income:
        return {
            "opportunity": "Small-ticket compounding opportunity",
            "impact": "Consistent small SIPs can still create meaningful long-term value",
            "action": "Start or increase SIP by Rs 500 this month",
        }

    return {
        "opportunity": "Portfolio rebalance window",
        "impact": "Balanced allocation can improve risk-adjusted returns",
        "action": "Review equity-debt mix and rebalance if drift exceeds 5%",
    }


def get_triggered_opportunity(
    user_id: str,
    reading_category: Optional[str] = None,
    spending_spike: bool = False,
) -> Optional[OpportunityCard]:
    """
    Select the best opportunity card to surface based on:
    1. What the user is currently reading (reading_category)
    2. Detected spending anomaly (spending_spike)
    3. User profile goals and interests
    """
    templates: List[dict] = db.load_opportunities()
    user = db.get_user(user_id) or {}
    goals = [g.get("title", "").lower() for g in user.get("goals", [])]
    interests = [i.lower() for i in user.get("interests", [])]

    scored: List[tuple] = []
    for t in templates:
        score = t.get("priority", 5)
        trigger_cat = (t.get("trigger_category") or "").lower()

        # Boost for reading context match
        if reading_category and trigger_cat in reading_category.lower():
            score += 50

        # Boost for spending spike match
        if spending_spike and t.get("variant") == "cashback_card":
            score += 40

        # Boost if opportunity aligns with a user goal
        for goal in goals:
            if trigger_cat and trigger_cat in goal:
                score += 30
                break

        # Boost if category matches user interest
        if trigger_cat in interests:
            score += 20

        scored.append((score, t))

    if not scored:
        return None

    scored.sort(key=lambda x: x[0], reverse=True)
    best = scored[0][1]
    return OpportunityCard(**best)


def list_all_opportunities() -> List[OpportunityCard]:
    return [OpportunityCard(**t) for t in db.load_opportunities()]
