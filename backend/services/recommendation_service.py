"""
Content recommendation service — filters and ranks articles based on user profile.
"""
from typing import List, Optional
import database as db


def get_personalized_feed(user_id: str, category_filter: Optional[str] = None, limit: int = 20) -> List[dict]:
    """
    Return articles ranked by user interests.
    Priority: category_filter match > user interest match > recency.
    """
    articles = db.load_articles()
    user = db.get_user(user_id)
    user_interests: List[str] = (user or {}).get("interests", [])

    def score(article: dict) -> int:
        cat = article.get("category", "").lower().replace(" ", "_")
        s = 0
        if category_filter and cat == category_filter.lower().replace(" ", "_"):
            s += 100
        if cat in [i.lower() for i in user_interests]:
            s += 50
        if article.get("prime"):
            s -= 5  # Slightly deprioritise locked content in feed score
        return s

    sorted_articles = sorted(articles, key=score, reverse=True)
    return sorted_articles[:limit]


def get_article_by_id(article_id: str) -> Optional[dict]:
    articles = db.load_articles()
    return next((a for a in articles if a.get("id") == article_id), None)
