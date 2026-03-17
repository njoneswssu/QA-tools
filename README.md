# Supreme Checkout

**Version:** 0.1.0

NiceGUI + Python app that uses [Supreme](https://supreme.com) and Playwright to load **unreleased** product links from the seasonal preview, let you pick item and size, and add to cart with human-like delays. You handle captcha and checkout in the browser.

## Layout

The GUI is styled like Supreme: red background (`#ED1C24`), white text, bold headers, minimal layout.

## Requirements

- Python 3.10+
- NiceGUI, Playwright (Chromium)

## Install (standalone project)

From this folder (separate from playwrightautomation):

```bash
cd supreme-checkout
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -e .
playwright install chromium
```

Or install as a package elsewhere:

```bash
pip install /path/to/supreme-checkout
playwright install chromium
```

## Run

```bash
# After pip install -e .
supreme-checkout
# or
python -m supreme_checkout.app
```

Open http://localhost:8080

## Build / versioning

- Version is in `pyproject.toml` and `supreme_checkout/__init__.py` (`__version__`).
- Build a wheel: `pip install build && python -m build`
- See `CHANGELOG.md` for version history.

## Flow

1. **Products (one-time load)** — On first run, click **Refresh preview** to fetch seasonal preview products; they are cached in `~/.supreme_checkout/preview_products.json`. On later visits the app loads from cache.
2. **Load upcoming** — Fetches product data from Supreme’s JSON endpoints and adds items that are *not* in the preview lookbook (potential upcoming release). No browser; avoids the failing `/collections/all` page.
3. **Search (optional)** — Use **Search site** to find products by keyword (uses `/search?q=...`; does not use `/collections/all` to avoid navigation errors).
4. **Filter & select** — Type in “Filter list” to narrow the dropdown by name or URL. Choose a size if the item has one.
5. **Add to cart** — Adds to cart with randomized delays. A browser stays open so you can complete captcha and checkout.

## Notes

- **Preview URL**: The scraper uses `https://www.supreme.com/previews/springsummer2026/all` by default. For new seasons, change `DEFAULT_PREVIEW_URL` in `supreme_checkout/scraper.py`.
- **Cache**: Preview products are stored in `~/.supreme_checkout/preview_products.json`. Delete that file to clear the cache.
- **Load upcoming**: Uses JSON endpoints (`/products.json` or `/collections/all/products.json`) if available. If Supreme changes their API, update `_JSON_PRODUCT_URLS` in `supreme_checkout/scraper.py`.
- **Add-to-cart**: Only adds to cart; no checkout or captcha handling. The browser is left open so you can finish manually.
- **Delays**: Delays between actions are randomized to mimic human behavior and reduce bot detection.
