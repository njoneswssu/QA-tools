"""
Supreme preview product scraper using Playwright.
Fetches product links and names from seasonal preview pages (unreleased items).
Supports cached preview load (once), backend search, and JSON product data
(products not in the lookbook that may release in the upcoming drop).
"""

import asyncio
import json
import random
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import List
from urllib.parse import quote_plus, urljoin, urlparse, parse_qs
from urllib.request import Request, urlopen

from playwright.async_api import async_playwright, Page, Browser, BrowserContext


# Default preview URL - Spring/Summer 2026; update for new seasons (e.g. fallwinter2026)
DEFAULT_PREVIEW_URL = "https://www.supreme.com/previews/springsummer2026/all"
BASE_URL = "https://www.supreme.com"

# Cache file for preview products (one-time load; refresh only when user asks)
CACHE_DIR = Path.home() / ".supreme_checkout"
PREVIEW_CACHE_FILE = CACHE_DIR / "preview_products.json"


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


# ---------- Cache: load once, refresh only when new products desired ----------


def _ensure_cache_dir() -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)


def load_cached_preview_products() -> List[PreviewProduct]:
    """Load preview products from local cache if present. Returns [] if no cache or error."""
    if not PREVIEW_CACHE_FILE.exists():
        return []
    try:
        data = json.loads(PREVIEW_CACHE_FILE.read_text(encoding="utf-8"))
        return [PreviewProduct(**item) for item in data]
    except (json.JSONDecodeError, TypeError, KeyError):
        return []


def save_preview_products_cache(products: List[PreviewProduct]) -> None:
    """Save preview products to local cache."""
    _ensure_cache_dir()
    data = [asdict(p) for p in products]
    PREVIEW_CACHE_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")


# ---------- JSON product data: items not in lookbook, potential upcoming release ----------

# Endpoints that may expose product JSON (Shopify-style or similar). Tried in order.
_JSON_PRODUCT_URLS = [
    f"{BASE_URL}/products.json",
    f"{BASE_URL}/collections/all/products.json",
]


def _fetch_json_url(url: str, timeout: int = 15) -> dict | None:
    """Fetch URL and parse as JSON. Returns None on error."""
    try:
        req = Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "application/json",
            },
        )
        with urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception:
        return None


def fetch_products_from_json() -> List[PreviewProduct]:
    """
    Fetch product list from Supreme's JSON endpoints (no browser).
    Returns products from the backend catalog that may include upcoming items.
    """
    products: List[PreviewProduct] = []
    for url in _JSON_PRODUCT_URLS:
        data = _fetch_json_url(url)
        if not data:
            continue
        # Shopify-style: {"products": [{"id", "title", "handle", ...}]}
        raw_list = data.get("products") if isinstance(data, dict) else None
        if not raw_list:
            continue
        for p in raw_list:
            if not isinstance(p, dict):
                continue
            title = (p.get("title") or "").strip()
            handle = (p.get("handle") or "").strip()
            if not handle:
                continue
            product_url = f"{BASE_URL}/products/{handle}"
            name = title or _name_from_slug(handle)
            products.append(PreviewProduct(name=name, url=product_url, slug=handle))
        if products:
            break
    return products


def fetch_upcoming_not_in_preview(preview_products: List[PreviewProduct]) -> List[PreviewProduct]:
    """
    Fetch products from JSON that are NOT in the preview lookbook.
    These may be in the backend for an upcoming release.
    """
    preview_slugs = {p.slug.lower() for p in preview_products}
    preview_urls = {p.url.rstrip("/").lower() for p in preview_products}
    from_json = fetch_products_from_json()
    upcoming: List[PreviewProduct] = []
    for p in from_json:
        if p.slug.lower() in preview_slugs:
            continue
        norm_url = p.url.rstrip("/").lower()
        if norm_url in preview_urls:
            continue
        upcoming.append(p)
    return upcoming


def run_fetch_upcoming_not_in_preview(
    preview_products: List[PreviewProduct],
) -> List[PreviewProduct]:
    """Synchronous wrapper for use from NiceGUI."""
    return fetch_upcoming_not_in_preview(preview_products)


# ---------- Backend search: products beyond the preseason lookbook ----------


async def _search_page_products(page: Page, search_url: str) -> List[PreviewProduct]:
    """Scrape product links from a search/shop page. Works with Shopify-style product links."""
    seen: set[str] = set()
    products: List[PreviewProduct] = []
    await page.goto(search_url, wait_until="domcontentloaded", timeout=20000)
    await asyncio.sleep(random.uniform(1.0, 2.0))

    # Supreme/Shopify: product links often in a[href*="/products/"] or similar
    links = await page.eval_on_selector_all(
        "a[href*='/products/'], a[href*='/previews/']",
        """els => els.map(el => ({
            href: el.href,
            text: (el.querySelector('span, .product-name, [class*="title"]') || el).textContent?.trim() || el.getAttribute('title') || ''
        }))"""
    )
    for item in links:
        href = (item.get("href") or "").strip()
        if not href or href in seen:
            continue
        seen.add(href)
        if not href.startswith("http"):
            href = urljoin(BASE_URL, href)
        path = urlparse(href).path.rstrip("/")
        slug = path.split("/")[-1] if "/" in path else path or "product"
        name = (item.get("text") or "").strip() or _name_from_slug(slug)
        if name and href:
            products.append(PreviewProduct(name=name, url=href, slug=slug))
    return products


async def fetch_search_products(query: str) -> List[PreviewProduct]:
    """
    Search Supreme's site for products via /search?q= (Playwright).
    Does not use /collections/all (often ERR_ABORTED). For more products
    use "Load upcoming" to pull from JSON instead.
    """
    query = (query or "").strip()
    if not query:
        return []
    search_url = f"{BASE_URL}/search?q={quote_plus(query)}"
    products: List[PreviewProduct] = []
    async with async_playwright() as p:
        browser: Browser = await p.chromium.launch(headless=True)
        try:
            context: BrowserContext = await browser.new_context(
                viewport={"width": 1280, "height": 800},
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            )
            page = await context.new_page()
            products = await _search_page_products(page, search_url)
            await context.close()
        finally:
            await browser.close()
    return products


def run_search_products(query: str) -> List[PreviewProduct]:
    """Synchronous wrapper for search (NiceGUI)."""
    return asyncio.run(fetch_search_products(query))
