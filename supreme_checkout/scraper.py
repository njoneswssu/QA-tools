"""
Supreme preview product scraper using Playwright.
Fetches product links and names from seasonal preview pages (unreleased items).
"""

import asyncio
import random
from dataclasses import dataclass
from typing import List
from urllib.parse import urljoin, urlparse, parse_qs

from playwright.async_api import async_playwright, Page, Browser, BrowserContext


# Default preview URL - Fall/Winter 2024; can be updated for new seasons
DEFAULT_PREVIEW_URL = "https://www.supreme.com/previews/fallwinter2024/all"
BASE_URL = "https://www.supreme.com"


@dataclass
class PreviewProduct:
    """A product from Supreme's preview (unreleased) list."""
    name: str
    url: str
    slug: str
    category: str = ""


def _slug_from_url(url: str) -> str:
    """Extract product slug from preview URL query string."""
    parsed = urlparse(url)
    qs = parse_qs(parsed.query)
    # URL format: .../all/1?=product-slug&back=all
    for key, values in qs.items():
        if key == "" or (key and values and not key.startswith("back")):
            val = values[0] if values else ""
            if val and val != "all":
                return val
    path = parsed.path.rstrip("/")
    parts = path.split("/")
    if len(parts) >= 2:
        return parts[-1]  # fallback to last path segment
    return ""


def _name_from_slug(slug: str) -> str:
    """Convert URL slug to readable product name."""
    if not slug:
        return "Unknown"
    name = slug.replace("-", " ").title()
    return name


async def _scroll_and_collect_links(page: Page, preview_url: str) -> List[PreviewProduct]:
    """Scroll preview page and collect unique product links."""
    seen_slugs: set[str] = set()
    products: List[PreviewProduct] = []
    last_height = 0

    for _ in range(15):  # limit scrolls
        # Collect product links from current view
        links = await page.eval_on_selector_all(
            "a[href*='/previews/'][href*='?=']",
            """els => els.map(el => ({
                href: el.href,
                alt: el.querySelector('img')?.alt || '',
                text: el.textContent?.trim() || ''
            }))"""
        )

        for item in links:
            href = item.get("href", "")
            if not href or "/previews/" not in href or "=" not in href:
                continue
            slug = _slug_from_url(href)
            if not slug or slug in seen_slugs:
                continue
            seen_slugs.add(slug)
            full_url = href if href.startswith("http") else urljoin(BASE_URL, href)
            name = (item.get("alt") or item.get("text") or _name_from_slug(slug)).strip() or _name_from_slug(slug)
            products.append(PreviewProduct(name=name, url=full_url, slug=slug))

        # Scroll down
        await page.evaluate("window.scrollBy(0, window.innerHeight)")
        await asyncio.sleep(random.uniform(0.5, 1.2))
        new_height = await page.evaluate("document.body.scrollHeight")
        if new_height == last_height:
            break
        last_height = new_height

    return products


async def fetch_preview_products(preview_url: str = DEFAULT_PREVIEW_URL) -> List[PreviewProduct]:
    """
    Open Supreme preview page with Playwright and return list of unreleased products.
    Uses human-like delays to avoid bot detection.
    """
    products: List[PreviewProduct] = []
    async with async_playwright() as p:
        browser: Browser = await p.chromium.launch(headless=True)
        try:
            context: BrowserContext = await browser.new_context(
                viewport={"width": 1280, "height": 800},
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            )
            page = await context.new_page()
            await page.goto(preview_url, wait_until="domcontentloaded", timeout=25000)
            await asyncio.sleep(random.uniform(1.5, 3.0))
            products = await _scroll_and_collect_links(page, preview_url)
            await context.close()
        finally:
            await browser.close()
    return products


def run_fetch_preview_products(preview_url: str = DEFAULT_PREVIEW_URL) -> List[PreviewProduct]:
    """Synchronous wrapper for use from NiceGUI."""
    return asyncio.run(fetch_preview_products(preview_url))
