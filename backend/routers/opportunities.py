# routers/opportunities.py - Fixed to mix all feeds
"""
routers/opportunities.py — Contextual smart opportunity cards with ET Opinion content.
"""
import json
import logging
import random
from pathlib import Path
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

import services.gemini_service as gemini
import services.profile_service as profile_svc
from services.rss_service import RSSFeedService
from middleware.auth import verify_firebase_token
from models.opportunity import OpportunityCard, OpportunityType

logger = logging.getLogger(__name__)
router = APIRouter()


class OpportunityTriggerRequest(BaseModel):
    user_id: str
    reading_category: Optional[str] = None
    spending_spike: Optional[bool] = False


@router.get("/user/{user_id}")
async def get_user_opportunities(
    user_id: str,
    verified_uid: str = Depends(verify_firebase_token),
    limit: int = Query(6, ge=1, le=20),
    feed_type: Optional[str] = Query(None),
):
    """Get personalized opportunities from ET Opinion & Editorial content."""
    if user_id != verified_uid:
        raise HTTPException(status_code=403, detail="Forbidden")
    
    try:
        profile = await profile_svc.get_profile(user_id)
        
        profile_dict = {}
        if profile:
            if hasattr(profile, 'model_dump'):
                profile_dict = profile.model_dump()
            elif hasattr(profile, 'dict'):
                profile_dict = profile.dict()
            elif isinstance(profile, dict):
                profile_dict = profile
        
        # Fetch from ALL Opinion/Editorial feeds (or a single selected feed)
        opinion_feeds = [
            "et_editorial", 
            "et_commentary", 
            "et_view", 
            "just_in_jest", 
            "speaking_tree", 
            "bliss_of_everyday_life",
            "et_citings", 
            "interviews"
        ]

        selected_feeds = opinion_feeds
        if feed_type:
            normalized_feed = feed_type.strip().lower()
            if normalized_feed in opinion_feeds:
                selected_feeds = [normalized_feed]
            else:
                raise HTTPException(status_code=400, detail=f"Invalid feed_type: {feed_type}")
        
        all_articles = []
        
        # Fetch from each feed
        for feed_key in selected_feeds:
            try:
                if feed_key in RSSFeedService.FEEDS:
                    articles = await RSSFeedService.fetch_feed(RSSFeedService.FEEDS[feed_key])
                    # Add feed type to each article
                    for article in articles:
                        article["feed_type"] = feed_key
                        article["source_feed"] = feed_key
                    all_articles.extend(articles[:5])  # Get top 5 from each feed
                    logger.info(f"Fetched {len(articles[:5])} articles from {feed_key}")
            except Exception as e:
                logger.error(f"Error fetching feed {feed_key}: {e}")
                continue
        
        # Remove duplicates by link
        seen_links = set()
        unique_articles = []
        for article in all_articles:
            link = article.get("link", "")
            if link and link not in seen_links:
                seen_links.add(link)
                unique_articles.append(article)
        
        logger.info(f"Total unique articles fetched: {len(unique_articles)}")

        # Group by feed and guarantee representation across filters.
        articles_by_feed = {feed: [] for feed in selected_feeds}
        for article in unique_articles:
            feed_type = article.get("feed_type")
            if feed_type in articles_by_feed:
                articles_by_feed[feed_type].append(article)

        selected_articles = []

        # First pass: pick one from each feed (if available).
        for feed in selected_feeds:
            feed_articles = articles_by_feed.get(feed, [])
            if feed_articles:
                selected_articles.append(feed_articles.pop(0))

        # Second pass: fill remaining slots from all leftover articles.
        remaining_articles = []
        for feed in selected_feeds:
            remaining_articles.extend(articles_by_feed.get(feed, []))

        random.shuffle(remaining_articles)
        remaining_slots = max(0, limit - len(selected_articles))
        selected_articles.extend(remaining_articles[:remaining_slots])

        # Generate opportunities from selected Opinion articles.
        opportunities = await generate_opinion_opportunities(
            user_id,
            et_articles=selected_articles,
            profile=profile_dict,
            limit=limit
        )

        # Final shuffle keeps mixed ordering without dropping categories.
        random.shuffle(opportunities)

        feed_counts = {
            feed: len([a for a in unique_articles if a.get("feed_type") == feed])
            for feed in selected_feeds
        }
        
        return {
            "user_id": user_id,
            "total": len(opportunities),
            "opportunities": opportunities[:limit],
            "source": "economic_times_opinion",
            "feed_counts": feed_counts
        }
    
    except Exception as e:
        logger.error(f"Error getting user opportunities: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/feed-stats")
async def get_feed_stats(verified_uid: str = Depends(verify_firebase_token)):
    """Get statistics about each opinion feed."""
    try:
        opinion_feeds = [
            "et_editorial", "et_commentary", "et_view", 
            "just_in_jest", "speaking_tree", "bliss_of_everyday_life",
            "et_citings", "interviews"
        ]
        
        stats = {}
        for feed_key in opinion_feeds:
            if feed_key in RSSFeedService.FEEDS:
                articles = await RSSFeedService.fetch_feed(RSSFeedService.FEEDS[feed_key])
                stats[feed_key] = {
                    "name": get_category_for_feed(feed_key)["label"],
                    "count": len(articles),
                    "icon": get_category_for_feed(feed_key)["icon"]
                }
        
        return {"stats": stats}
    
    except Exception as e:
        logger.error(f"Error getting feed stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def generate_opinion_opportunities(
    user_id: str,
    et_articles: List[dict],
    profile: Optional[dict],
    limit: int = 6
) -> list:
    """Generate personalized opportunities from Opinion/Editorial ET articles."""
    
    opportunities = []
    
    if not et_articles:
        return opportunities
    
    # Create opportunities from each article
    for idx, article in enumerate(et_articles):
        try:
            feed_type = article.get("feed_type", "opinion")
            
            # Get category and icon based on feed type
            category_info = get_category_for_feed(feed_type)
            
            # Generate opportunity based on article content
            opportunity = {
                "id": f"et_opp_{article.get('id', idx)}_{idx}",
                "type": "insight",
                "icon": category_info["icon"],
                "chip_label": category_info["label"],
                "headline": article.get("title", "Read this ET Opinion")[:100],
                "subtext": generate_opinion_insight(article, profile),
                "cta_primary": "Read Full Article",
                "cta_secondary": "Save for Later",
                "trigger_context": feed_type,
                "article_link": article.get("link", ""),
                "article_published": article.get("published", ""),
                "is_prime": article.get("is_prime", False),
                "summary": article.get("summary", ""),
                "author": article.get("author", "ET Bureau"),
                "feed_type": feed_type
            }
            
            opportunities.append(opportunity)
        except Exception as e:
            logger.error(f"Error creating opportunity from article: {e}")
            continue
    
    return opportunities


def get_category_for_feed(feed_type: str) -> dict:
    """Map feed type to display category and icon."""
    categories = {
        "et_editorial": {"label": "ET Editorial", "icon": "📰", "color": "#D4891A"},
        "et_commentary": {"label": "ET Commentary", "icon": "💭", "color": "#52c41a"},
        "et_view": {"label": "ET View", "icon": "👁️", "color": "#1890ff"},
        "just_in_jest": {"label": "Just in Jest", "icon": "😄", "color": "#eb2f96"},
        "speaking_tree": {"label": "Speaking Tree", "icon": "🌳", "color": "#13c2c2"},
        "bliss_of_everyday_life": {"label": "Bliss of Life", "icon": "✨", "color": "#722ed1"},
        "et_citings": {"label": "ET Citings", "icon": "📌", "color": "#fa8c16"},
        "interviews": {"label": "Interviews", "icon": "🎤", "color": "#f5222d"}
    }
    return categories.get(feed_type, {"label": "ET Opinion", "icon": "💡", "color": "#667085"})


def generate_opinion_insight(article: dict, profile: Optional[dict]) -> str:
    """Generate a personalized insight from opinion article."""
    title = article.get("title", "")
    feed_type = article.get("feed_type", "")
    summary = article.get("summary", "")
    
    # Create insight based on feed type
    insights = {
        "et_editorial": f"ET's editorial take: {title[:80]}...",
        "et_commentary": f"Expert perspective: {title[:80]}...",
        "et_view": f"ET's official viewpoint: {title[:80]}...",
        "just_in_jest": f"A light-hearted take: {title[:80]}...",
        "speaking_tree": f"Spiritual insight: {title[:80]}...",
        "bliss_of_everyday_life": f"Life wisdom: {title[:80]}...",
        "et_citings": f"ET observation: {title[:80]}...",
        "interviews": f"Exclusive interview insight: {title[:80]}..."
    }
    
    base_insight = insights.get(feed_type, f"Opinion piece: {title[:100]}...")
    
    if summary:
        base_insight = f"{base_insight} {summary[:100]}..."
    
    return base_insight