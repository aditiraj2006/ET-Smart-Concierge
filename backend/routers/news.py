# routers/news.py
"""
routers/news.py — Personalized news feed powered by real RSS feeds.
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
import logging
from services.rss_service import RSSFeedService
import services.profile_service as profile_svc
from middleware.auth import verify_firebase_token
from typing import Optional

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/feed/{user_id}")
async def personalized_feed(
    user_id: str,
    category: Optional[str] = Query(None),
    verified_uid: str = Depends(verify_firebase_token),
):
    """Return real-time articles from Economic Times RSS feeds"""
    if user_id != verified_uid:
        raise HTTPException(status_code=403, detail="Forbidden")
    
    try:
        # Fetch articles from RSS feeds
        categories = [category] if category and category != "All" else None
        articles = await RSSFeedService.fetch_all_feeds(categories)
        
        if not articles:
            logger.warning(f"No articles found for user {user_id}")
            return {
                "user_id": user_id,
                "total": 0,
                "articles": []
            }
        
        # Try to get user profile for personalization
        try:
            profile = await profile_svc.get_profile(user_id)
            if profile:
                # Here you would add Gemini personalization
                # articles = await personalize_news(articles, profile.model_dump())
                pass
        except Exception as e:
            logger.error(f"Error getting profile: {e}")
            # Continue without personalization
        
        return {
            "user_id": user_id,
            "total": len(articles),
            "articles": articles[:30]  # Return top 30
        }
        
    except Exception as e:
        logger.error(f"Error in personalized_feed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/categories")
async def get_categories(verified_uid: str = Depends(verify_firebase_token)):
    """Return available categories with feed counts"""
    try:
        categories = []
        for feed_key, feed_url in RSSFeedService.FEEDS.items():
            articles = await RSSFeedService.fetch_feed(feed_url)
            categories.append({
                "name": feed_key.replace("_", " ").title(),
                "slug": feed_key,
                "count": len(articles),
                "feed_url": feed_url
            })
        return {"categories": categories}
    except Exception as e:
        logger.error(f"Error getting categories: {e}")
        raise HTTPException(status_code=500, detail=str(e))