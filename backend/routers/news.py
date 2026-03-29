# routers/news.py
"""
routers/news.py — Personalized news feed powered by real RSS feeds.
"""
from datetime import datetime
from typing import Optional
import asyncio
from fastapi import APIRouter, Depends, HTTPException, Query
import logging
import aiohttp
from services.rss_service import RSSFeedService
import services.profile_service as profile_svc
from middleware.auth import verify_firebase_token

logger = logging.getLogger(__name__)
router = APIRouter()

_MARKET_SYMBOLS = {
    "NIFTY 50": "^NSEI",
    "SENSEX": "^BSESN",
    "GOLD": "GC=F",
}


def _estimate_read_minutes(article: dict) -> int:
    text = f"{article.get('title', '')} {article.get('summary', '')}".strip()
    words = len(text.split())
    if words <= 40:
        return 2
    return max(2, min(12, round(words / 180)))


def _profile_categories(profile) -> list[str]:
    categories = ["markets", "personal_finance"]
    if not profile:
        return categories

    risk = getattr(profile, "risk_appetite", "")
    risk_value = risk.value if hasattr(risk, "value") else str(risk)
    goal_types = [g.goal_type.lower() for g in getattr(profile, "goals", []) if getattr(g, "goal_type", None)]

    if "house" in " ".join(goal_types) or "real estate" in " ".join(goal_types):
        categories.append("real_estate")
    if "tax" in " ".join(goal_types):
        categories.append("tax")
    if any(k in " ".join(goal_types) for k in ("retire", "savings", "emergency")):
        categories.append("savings")
    if risk_value in {"high", "medium"}:
        categories.append("economy")

    # Preserve order and deduplicate
    seen: set[str] = set()
    ordered: list[str] = []
    for c in categories:
        if c not in seen:
            ordered.append(c)
            seen.add(c)
    return ordered


async def _fetch_market_ticker(session: aiohttp.ClientSession, label: str, symbol: str) -> Optional[dict]:
    quote_url = f"https://query1.finance.yahoo.com/v7/finance/quote?symbols={symbol}"
    chart_url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=5m&range=1d"

    try:
        async with session.get(quote_url, timeout=8) as quote_res:
            if quote_res.status != 200:
                return None
            quote_data = await quote_res.json()

        results = quote_data.get("quoteResponse", {}).get("result", [])
        if not results:
            return None
        quote = results[0]

        history: list[float] = []
        async with session.get(chart_url, timeout=8) as chart_res:
            if chart_res.status == 200:
                chart_data = await chart_res.json()
                closes = (
                    chart_data.get("chart", {})
                    .get("result", [{}])[0]
                    .get("indicators", {})
                    .get("quote", [{}])[0]
                    .get("close", [])
                )
                history = [round(float(v), 2) for v in closes if isinstance(v, (float, int))]

        change = float(quote.get("regularMarketChange", 0) or 0)
        change_pct = float(quote.get("regularMarketChangePercent", 0) or 0)

        return {
            "label": label,
            "symbol": symbol,
            "price": round(float(quote.get("regularMarketPrice", 0) or 0), 2),
            "change": round(change, 2),
            "change_percent": round(change_pct, 2),
            "is_positive": change >= 0,
            "currency": quote.get("currency", "INR"),
            "history": history[-24:],
        }
    except Exception as exc:
        logger.warning("Failed to fetch market ticker %s (%s): %s", label, symbol, exc)
        return None

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


@router.get("/dashboard/{user_id}")
async def dashboard_feed(
    user_id: str,
    limit: int = Query(6, ge=3, le=12),
    verified_uid: str = Depends(verify_firebase_token),
):
    """Return dashboard-ready curated feed cards based on user profile and goal context."""
    if user_id != verified_uid:
        raise HTTPException(status_code=403, detail="Forbidden")

    try:
        profile = await profile_svc.get_profile(user_id)
        category_keys = _profile_categories(profile)
        selected_urls = [
            RSSFeedService.FEEDS[key]
            for key in category_keys
            if key in RSSFeedService.FEEDS
        ] or [RSSFeedService.FEEDS["top_stories"]]

        tasks = [RSSFeedService.fetch_feed(url) for url in selected_urls]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        merged: list[dict] = []
        seen_links: set[str] = set()
        for result in results:
            if isinstance(result, Exception):
                continue
            for article in result:
                link = article.get("link")
                if not link or link in seen_links:
                    continue
                seen_links.add(link)
                article["read_minutes"] = _estimate_read_minutes(article)
                merged.append(article)

        if not merged:
            merged = await RSSFeedService.fetch_all_feeds()
            for article in merged:
                article["read_minutes"] = _estimate_read_minutes(article)

        cards = sorted(merged, key=lambda x: x.get("published", ""), reverse=True)[:limit]

        return {
            "user_id": user_id,
            "categories": category_keys,
            "total": len(cards),
            "articles": cards,
        }
    except Exception as exc:
        logger.error("Error building dashboard feed: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to build dashboard feed")


@router.get("/market/live")
async def market_live(verified_uid: str = Depends(verify_firebase_token)):
    """Return live market tickers for dashboard right rail."""
    _ = verified_uid
    try:
        timeout = aiohttp.ClientTimeout(total=10)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            tasks = [
                _fetch_market_ticker(session, label, symbol)
                for label, symbol in _MARKET_SYMBOLS.items()
            ]
            results = await asyncio.gather(*tasks, return_exceptions=True)

        tickers = [r for r in results if isinstance(r, dict)]
        return {
            "updated_at": datetime.utcnow().isoformat(),
            "total": len(tickers),
            "tickers": tickers,
        }
    except Exception as exc:
        logger.error("Error in market_live: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to fetch market data")