"""
Add-to-cart flow for Supreme using Playwright.
Uses human-like random delays to avoid bot detection. Stops at cart; user handles captcha/checkout.
"""

import asyncio
import random
from typing import Optional

from playwright.async_api import async_playwright, Browser, BrowserContext


# Delays in seconds - randomized within range to appear human
DELAY_BEFORE_NAV = (0.8, 2.0)
DELAY_AFTER_PAGE_LOAD = (2.0, 4.5)
DELAY_BEFORE_SIZE_SELECT = (1.0, 2.5)
DELAY_BEFORE_ADD_CLICK = (1.5, 4.0)
DELAY_AFTER_ADD = (1.0, 2.0)


def _rand_delay(low: float, high: float) -> float:
    return random.uniform(low, high)


async def add_to_cart(
    product_url: str,
    size: Optional[str] = None,
    headless: bool = False,
) -> tuple[bool, str]:
    """
    Open product page and add item to cart. Uses human-like delays.
    Returns (success, message). Leaves browser open so user can complete checkout/captcha.
    """
    message = ""
    KEEP_BROWSER_OPEN_SEC = 300  # 5 min for user to complete checkout/captcha
    async with async_playwright() as p:
        browser: Browser = await p.chromium.launch(headless=headless)
        try:
            context: BrowserContext = await browser.new_context(
                viewport={"width": 1280, "height": 900},
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            )
            page = await context.new_page()

            await asyncio.sleep(_rand_delay(*DELAY_BEFORE_NAV))
            await page.goto(product_url, wait_until="domcontentloaded", timeout=20000)
            await asyncio.sleep(_rand_delay(*DELAY_AFTER_PAGE_LOAD))

            # If product has a size select, choose size (Supreme uses id="size" or name="size")
            size_select = page.locator('select#size, select[name="size"]').first
            size_count = await size_select.count()
            if size_count > 0 and size:
                await asyncio.sleep(_rand_delay(*DELAY_BEFORE_SIZE_SELECT))
                try:
                    await size_select.select_option(label=size)
                    await asyncio.sleep(_rand_delay(0.5, 1.2))
                except Exception as e:
                    try:
                        await size_select.select_option(value=size)
                    except Exception:
                        message = f"Size select failed: {e}. Try adding manually."
            elif size_count > 0 and not size:
                message = "This item has sizes but none was selected. Please select a size and try again."
                return False, message

            # Add to cart: form id="cart-add" or button "add to cart"
            add_btn = page.get_by_role("button", name="add to cart")
            if await add_btn.count() == 0:
                add_btn = page.locator('input[type="submit"][value*="add"], input[type="submit"][value*="Add"]').first
            if await add_btn.count() == 0:
                add_btn = page.locator("#cart-add input[type=submit], #cart-add button").first
            if await add_btn.count() == 0:
                add_btn = page.locator('button:has-text("cart"), input[value*="cart"]').first

            await asyncio.sleep(_rand_delay(*DELAY_BEFORE_ADD_CLICK))
            await add_btn.click()
            await asyncio.sleep(_rand_delay(*DELAY_AFTER_ADD))

            success = True
            try:
                added = page.locator("text=added to cart, text=Added, [data-cart-count]").first
                await added.wait_for(state="visible", timeout=5000)
            except Exception:
                pass

            message = "Added to cart. Browser will stay open 5 min for checkout/captcha."
            # Keep browser open so user can complete checkout/captcha
            await asyncio.sleep(KEEP_BROWSER_OPEN_SEC)
            return success, message

        except Exception as e:
            message = str(e)
            return False, message


def run_add_to_cart(
    product_url: str,
    size: Optional[str] = None,
    headless: bool = False,
) -> tuple[bool, str]:
    """Synchronous wrapper for NiceGUI."""
    return asyncio.run(add_to_cart(product_url, size=size, headless=headless))
