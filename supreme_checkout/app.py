"""
Supreme Auto Add-to-Cart — NiceGUI app with Supreme-style layout.
Pulls unreleased product links from Supreme preview, lets you pick item/size, adds to cart with human-like delays.
You handle captcha and checkout in the browser.
"""
import asyncio
from typing import List, Optional

from nicegui import ui

from supreme_checkout.scraper import (
    run_fetch_preview_products,
    run_fetch_upcoming_not_in_preview,
    run_search_products,
    load_cached_preview_products,
    save_preview_products_cache,
    PreviewProduct,
)
from supreme_checkout.add_to_cart import run_add_to_cart

# Supreme brand colors
SUPREME_RED = "#ED1C24"
SUPREME_WHITE = "#FFFFFF"
SUPREME_BLACK = "#000000"


def apply_supreme_style():
    """Inject Supreme-like global styles."""
    ui.add_head_html("""
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Fugaz+One&family=Inter:wght@400;700;900&display=swap" rel="stylesheet">
    """)
    ui.query("body").style(f"""
        background-color: {SUPREME_RED} !important;
        color: {SUPREME_WHITE} !important;
        font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif !important;
    """)
    ui.query(".nicegui-content").style(f"""
        background-color: {SUPREME_RED} !important;
        color: {SUPREME_WHITE} !important;
    """)


def product_display_name(p: PreviewProduct) -> str:
    """Short display name for dropdown."""
    return p.name if len(p.name) <= 60 else p.name[:57] + "..."


@ui.page("/")
def index():
    apply_supreme_style()

    products: List[PreviewProduct] = []
    status_message: Optional[ui.label] = None
    add_btn_ref: Optional[ui.button] = None
    size_select_ref: Optional[ui.select] = None
    product_select_ref: Optional[ui.select] = None

    with ui.column().classes("w-full max-w-2xl mx-auto q-pa-lg"):
        # Header — Supreme-style
        with ui.row().classes("w-full items-center justify-between mb-6"):
            ui.label("SUPREME").classes("text-h3 font-bold tracking-widest").style(
                "font-family: 'Fugaz One', sans-serif; letter-spacing: 0.2em;"
            )
            ui.label("AUTO ADD TO CART").classes("text-caption opacity-80").style(
                "letter-spacing: 0.15em;"
            )

        ui.separator().classes("bg-white opacity-30 my-4")

        # Section: Products (cached preview + optional refresh + backend search)
        ui.label("PRODUCTS").classes("text-uppercase text-caption mb-2").style(
            "letter-spacing: 0.2em; opacity: 0.9;"
        )
        ui.label("Preview products load once and are cached. Refresh for new lookbook items; Load upcoming adds products from JSON not in the lookbook; Search uses the site search.").classes(
            "text-body2 opacity-80 mb-4"
        )

        load_state: dict = {"loading": False}
        search_state: dict = {"loading": False}
        upcoming_state: dict = {"loading": False}

        with ui.row().classes("w-full gap-4 items-end flex-wrap"):
            refresh_btn = ui.button("REFRESH PREVIEW", on_click=lambda: refresh_preview()).classes(
                "bg-white text-black font-bold"
            ).style("border-radius: 0;")
            ui.spinner("dots", size="md").bind_visibility_from(load_state, "loading")

            upcoming_btn = ui.button("LOAD UPCOMING", on_click=lambda: load_upcoming()).classes(
                "bg-white text-black font-bold"
            ).style("border-radius: 0;")
            ui.spinner("dots", size="sm").bind_visibility_from(upcoming_state, "loading")

            backend_search_input = ui.input(
                label="Search site",
                placeholder="e.g. tee, hoodie, cap…",
            ).classes("flex-1 min-w-32 bg-white/10").style("border-radius: 0;")
            search_btn = ui.button("SEARCH", on_click=lambda: do_backend_search()).classes(
                "bg-black text-white font-bold"
            ).style("border-radius: 0;")
            ui.spinner("dots", size="sm").bind_visibility_from(search_state, "loading")

        # Product choice — search and select
        ui.label("PRODUCT").classes("text-uppercase text-caption mt-6 mb-2").style(
            "letter-spacing: 0.2em; opacity: 0.9;"
        )
        full_product_options: dict[str, str] = {}  # display -> url (all loaded products)
        product_select = ui.select(
            options={},
            label="Select item",
            with_input=True,
        ).classes("w-full bg-white/10").style("border-radius: 0;")
        product_select_ref = product_select

        def apply_product_filter():
            """Filter product dropdown by current search query (name or URL/slug)."""
            query = (search_input.value or "").strip().lower()
            if not query:
                filtered = dict(full_product_options)
            else:
                filtered = {
                    name: url
                    for name, url in full_product_options.items()
                    if query in name.lower() or query in url.lower()
                }
            product_select.set_options(filtered)

        search_input = ui.input(
            label="Filter list",
            placeholder="Type to filter loaded products...",
        ).classes("w-full bg-white/10 mb-2").style("border-radius: 0;")
        search_input.on("input", lambda: apply_product_filter())

        # Load from cache on first paint so user doesn't have to click anything
        products[:] = load_cached_preview_products()
        for p in products:
            full_product_options[product_display_name(p)] = p.url
        apply_product_filter()

        ui.label("SIZE (if applicable)").classes("text-uppercase text-caption mt-4 mb-2").style(
            "letter-spacing: 0.2em; opacity: 0.9;"
        )
        size_select = ui.select(
            options=["", "Small", "Medium", "Large", "X-Large", "XX-Large", "One Size"],
            label="Size",
            value="",
        ).classes("w-full max-w-xs bg-white/10").style("border-radius: 0;")
        size_select_ref = size_select

        # Add to cart (runs in thread so UI stays responsive during delays)
        async def do_add():
            url = product_select.value
            size = (size_select.value or "").strip() or None
            if not url:
                if status_message:
                    status_message.set_text("Select a product first.")
                return
            add_btn_ref._props["loading"] = True
            if status_message:
                status_message.set_text("Adding to cart (with delays to avoid bot detection)...")
            try:
                success, msg = await asyncio.to_thread(
                    lambda: run_add_to_cart(url, size=size, headless=False)
                )
                if status_message:
                    status_message.set_text(msg)
            except Exception as e:
                if status_message:
                    status_message.set_text(f"Error: {e}")
            finally:
                add_btn_ref._props["loading"] = False

        add_btn = ui.button("ADD TO CART", on_click=do_add).classes(
            "mt-6 bg-black text-white font-bold"
        ).style("border-radius: 0;")
        add_btn_ref = add_btn

        status_message = ui.label("").classes("mt-4 text-body2")
        if products:
            status_message.set_text(f"Loaded {len(products)} products from cache. Refresh preview or search for more, then select and Add to cart.")
        else:
            status_message.set_text("Click Refresh preview to load seasonal items, or Search to find products on the site. Then select and Add to cart.")

        async def refresh_preview():
            """Re-fetch preview products once, update cache, replace list."""
            load_state["loading"] = True
            refresh_btn._props["loading"] = True
            if status_message:
                status_message.set_text("Fetching preview products…")
            try:
                new_list = await asyncio.to_thread(run_fetch_preview_products)
                products[:] = new_list
                save_preview_products_cache(products)
                full_product_options.clear()
                for p in products:
                    full_product_options[product_display_name(p)] = p.url
                apply_product_filter()
                if status_message:
                    status_message.set_text(f"Refreshed: {len(products)} preview products. Search or select one, then Add to cart.")
            except Exception as e:
                if status_message:
                    status_message.set_text(f"Refresh failed: {e}")
            finally:
                load_state["loading"] = False
                refresh_btn._props["loading"] = False

        async def load_upcoming():
            """Load products from JSON that aren't in the preview lookbook (potential upcoming release)."""
            upcoming_state["loading"] = True
            upcoming_btn._props["loading"] = True
            if status_message:
                status_message.set_text("Loading products from JSON (not in lookbook)…")
            try:
                upcoming = await asyncio.to_thread(run_fetch_upcoming_not_in_preview, products)
                for p in upcoming:
                    key = product_display_name(p)
                    full_product_options[key] = p.url
                search_input.set_value("")
                apply_product_filter()
                ui.update(product_select)
                if status_message:
                    status_message.set_text(f"Added {len(upcoming)} product(s) not in lookbook. Select one and Add to cart.")
            except Exception as e:
                if status_message:
                    status_message.set_text(f"Load upcoming failed: {e}")
            finally:
                upcoming_state["loading"] = False
                upcoming_btn._props["loading"] = False

        async def do_backend_search():
            """Search Supreme site and merge results into the product list."""
            query = (backend_search_input.value or "").strip()
            if not query:
                if status_message:
                    status_message.set_text("Enter a search term (e.g. tee, hoodie) and click Search.")
                return
            search_state["loading"] = True
            search_btn._props["loading"] = True
            if status_message:
                status_message.set_text(f"Searching for “{query}”…")
            try:
                found = await asyncio.to_thread(run_search_products, query)
                for p in found:
                    key = product_display_name(p)
                    full_product_options[key] = p.url
                search_input.set_value("")
                apply_product_filter()
                ui.update(product_select)
                if status_message:
                    status_message.set_text(f"Found {len(found)} product(s). Select one and Add to cart.")
            except Exception as e:
                if status_message:
                    status_message.set_text(f"Search failed: {e}")
            finally:
                search_state["loading"] = False
                search_btn._props["loading"] = False


def main():
    """Entry point for the app (CLI and console script)."""
    ui.run(
        title="Supreme — Auto Add to Cart",
        port=8080,
        dark=None,
        reload=False,
    )


if __name__ in {"__main__", "__mp_main__"}:
    main()
