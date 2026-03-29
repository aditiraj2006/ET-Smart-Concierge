# services/rss_service.py
import asyncio
from typing import List, Dict, Optional
from datetime import datetime
import feedparser
import aiohttp
from bs4 import BeautifulSoup
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RSSFeedService:
    """Fetches and parses Economic Times RSS feeds"""
    
    # ET RSS Feed URLs mapping
    FEEDS = {
        "top_stories": "https://economictimes.indiatimes.com/rssfeedstopstories.cms",
        "markets": "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",
        "mutual_funds": "https://economictimes.indiatimes.com/mf/mf-news/rssfeeds/1107225967.cms",
        "real_estate": "https://economictimes.indiatimes.com/markets/digital-real-estate/realty-news/rssfeeds/121976877.cms",
        "economy": "https://economictimes.indiatimes.com/news/economy/rssfeeds/1373380680.cms",
        "tech": "https://economictimes.indiatimes.com/tech/rssfeeds/13357257.cms",
        "personal_finance": "https://economictimes.indiatimes.com/personal-finance/rssfeeds/147296857.cms",
        "tax": "https://economictimes.indiatimes.com/personal-finance/tax/rssfeeds/147296979.cms",
        "savings": "https://economictimes.indiatimes.com/personal-finance/savings/rssfeeds/147296873.cms",
         "et_editorial": "https://economictimes.indiatimes.com/opinion/et-editorial/rssfeeds/3376910.cms",
        "et_commentary": "https://economictimes.indiatimes.com/opinion/et-commentary/rssfeeds/3389985.cms",
        "et_view": "https://economictimes.indiatimes.com/opinion/et-view/rssfeeds/63829738.cms",
        "just_in_jest": "https://economictimes.indiatimes.com/opinion/just-in-jest/rssfeeds/81544607.cms",
        "speaking_tree": "https://economictimes.indiatimes.com/opinion/speaking-tree/rssfeeds/52109321.cms",
        "bliss_of_everyday_life": "https://economictimes.indiatimes.com/opinion/bliss-of-everyday-life/rssfeeds/103022834.cms",
        "et_citings": "https://economictimes.indiatimes.com/opinion/et-citings/rssfeeds/18951109.cms",
        "interviews": "https://economictimes.indiatimes.com/opinion/interviews/rssfeeds/2184566.cms",
        
        #for dashboard
        "et-wealth": "https://economictimes.indiatimes.com/wealth/et-wealth/rssfeeds/50943048.cms",
        "et-prime": "https://economictimes.indiatimes.com/prime/rssfeeds/69891145.cms",
        "et-promotions":  "https://economictimes.indiatimes.com/et-now/et-promotions/rssfeeds/6809269.cms",
        "et-learn": "https://economictimes.indiatimes.com/market-data/et-learn/rssfeeds/111840820.cms",
        "plan": "https://economictimes.indiatimes.com/wealth/plan/rssfeeds/49674351.cms",
        "live-stock": "https://economictimes.indiatimes.com/markets/live-stream/rssfeeds/93033407.cms",
        
    }
    
    @staticmethod
    async def fetch_feed(feed_url: str) -> List[Dict]:
        """Fetch and parse a single RSS feed"""
        try:
            logger.info(f"Fetching feed: {feed_url}")
            
            # Use feedparser in thread pool (it's synchronous)
            loop = asyncio.get_event_loop()
            feed = await loop.run_in_executor(None, feedparser.parse, feed_url)
            
            if feed.bozo:  # Check for parsing errors
                logger.warning(f"Feed parsing warning for {feed_url}: {feed.bozo_exception}")
            
            articles = []
            for entry in feed.entries[:20]:  # Limit to latest 20
                try:
                    # Extract clean text from summary
                    summary = entry.get("summary", "")
                    if summary:
                        soup = BeautifulSoup(summary, 'html.parser')
                        summary = soup.get_text()[:200]  # Limit to 200 chars
                    
                    article = {
                        "id": entry.get("id", entry.get("link", "")),
                        "title": entry.get("title", ""),
                        "link": entry.get("link", ""),
                        "published": entry.get("published", ""),
                        "summary": summary,
                        "category": RSSFeedService._extract_category(entry, feed_url),
                        "is_prime": "prime" in feed_url or "prime" in entry.get("link", ""),
                        "image_url": RSSFeedService._extract_image(entry)
                    }
                    articles.append(article)
                except Exception as e:
                    logger.error(f"Error parsing entry: {e}")
                    continue
            
            logger.info(f"Fetched {len(articles)} articles from {feed_url}")
            return articles
            
        except Exception as e:
            logger.error(f"Error fetching {feed_url}: {e}")
            return []
    
    @staticmethod
    def _extract_category(entry, feed_url: str) -> str:
        """Extract category from entry tags or feed URL"""
        # Try to get from tags first
        if hasattr(entry, 'tags') and entry.tags:
            for tag in entry.tags:
                term = tag.get('term', '')
                if term:
                    return term.capitalize()
        
        # Fallback to feed URL mapping
        feed_lower = feed_url.lower()
        if "markets" in feed_lower:
            return "Markets"
        elif "mf" in feed_lower or "mutual" in feed_lower:
            return "Mutual Funds"
        elif "real-estate" in feed_lower or "realty" in feed_lower:
            return "Real Estate"
        elif "tax" in feed_lower:
            return "Tax"
        elif "savings" in feed_lower:
            return "Savings"
        elif "economy" in feed_lower:
            return "Economy"
        elif "tech" in feed_lower:
            return "Tech"
        return "News"
    
    @staticmethod
    def _extract_image(entry) -> Optional[str]:
        """Extract image URL from entry"""
        try:
            # Check media content
            if hasattr(entry, 'media_content') and entry.media_content:
                for media in entry.media_content:
                    if media.get('url'):
                        return media.get('url')
            
            # Check enclosures
            if hasattr(entry, 'enclosures') and entry.enclosures:
                for enc in entry.enclosures:
                    if enc.get('type', '').startswith('image/'):
                        return enc.get('url')
            
            # Check for link with image extensions
            if hasattr(entry, 'link') and entry.link:
                if any(ext in entry.link.lower() for ext in ['.jpg', '.jpeg', '.png', '.gif']):
                    return entry.link
            
            return None
        except Exception as e:
            logger.debug(f"Error extracting image: {e}")
            return None
    
    @staticmethod
    async def fetch_all_feeds(categories: Optional[List[str]] = None) -> List[Dict]:
        """Fetch articles from multiple feeds"""
        feeds_to_fetch = RSSFeedService.FEEDS
        
        # Filter by categories if specified
        if categories:
            category_map = {
                "markets": "markets",
                "mutual funds": "mutual_funds",
                "real estate": "real_estate",
                "economy": "economy",
                "tax": "tax",
                "savings": "savings",
                "tech": "tech"
            }
            feed_keys = []
            for cat in categories:
                if cat.lower() in category_map:
                    feed_keys.append(category_map[cat.lower()])
            
            if feed_keys:
                feeds_to_fetch = {k: v for k, v in RSSFeedService.FEEDS.items() if k in feed_keys}
        
        # Fetch all feeds concurrently
        tasks = [RSSFeedService.fetch_feed(url) for url in feeds_to_fetch.values()]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Flatten results, skip exceptions
        all_articles = []
        for result in results:
            if isinstance(result, list):
                all_articles.extend(result)
            elif isinstance(result, Exception):
                logger.error(f"Feed fetch failed: {result}")
        
        # Sort by publish date (newest first)
        def get_date(article):
            try:
                if article.get("published"):
                    # Parse different date formats
                    return datetime.strptime(article["published"], "%a, %d %b %Y %H:%M:%S %z")
            except:
                pass
            return datetime.now()
        
        all_articles.sort(key=get_date, reverse=True)
        
        logger.info(f"Total articles fetched: {len(all_articles)}")
        return all_articles