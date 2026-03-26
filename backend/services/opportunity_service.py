"""
Smart opportunity engine — selects and scores contextual cross-sell cards.
"""
from typing import List, Optional
import database as db
from models.opportunity import OpportunityCard


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
