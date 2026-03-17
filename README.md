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

1. **Load preview products** — Fetches product links from Supreme’s current seasonal preview (e.g. Fall/Winter 2024). Uses Playwright with short delays so it doesn’t look like a bot.
2. **Select product** — Choose the item from the dropdown (filled from the preview).
3. **Select size** — Pick a size if the item has one (Small, Medium, Large, etc.).
4. **Add to cart** — Clicks through to the product page and adds to cart with randomized delays (about 1.5–4 seconds between actions). A browser window stays open for 5 minutes so you can complete checkout and captcha.

## Notes

- **Preview URL**: The scraper uses `https://www.supreme.com/previews/fallwinter2024/all` by default. For new seasons, change `DEFAULT_PREVIEW_URL` in `supreme_checkout/scraper.py`.
- **Add-to-cart**: Only adds to cart; no checkout or captcha handling. The browser is left open so you can finish manually.
- **Delays**: Delays between actions are randomized to mimic human behavior and reduce bot detection.
