# Merchant Google latency (Playwright + Chrome for Testing)

Browser-level automation for: **Wildlink merchant -> Google SERP -> first organic link -> wait for `wild.link/_sales/offer-view` (`OFFER_VIEWED`) or Citi EMA UI**.

Playwright attaches to the **whole browser context**, so **extension-originated** requests to `wild.link` (e.g. Citi Shop) show up on `context.on('request')` / `'response'` ? unlike `chrome.webRequest` from another extension.

**Citi Shop extension:** when Playwright **launches** Chrome (not CDP), the script loads Citi in this order:

1. **`CITI_EXTENSION_PATH`** or **`--citi-extension "<path>"`** if you set them.
2. Otherwise the latest install under the **latency Chrome profile** (`WL_LATENCY_CHROME_USER_DATA` or `~/.wl-latency-chrome-profile`), then under your **system Google Chrome** profile, for the [Chrome Web Store listing](https://chromewebstore.google.com/detail/citi-shop%C2%AE-program-add-sh/coilflpnmfnnbdpjfcglhgommahebcci) (extension id `coilflpnmfnnbdpjfcglhgommahebcci`), under `.../<Profile>/Extensions/<id>/<version>/`.
3. Otherwise, if this folder exists: `/Users/neiljones/Downloads/dist 4` (unpacked dev build).

Use **`--chrome-setup`** once to sign in and install Citi into the latency profile, install in normal Chrome for step 2 only, or point `--citi-extension` at an unpacked folder (quote paths that contain spaces).

### Persistent profile + Google sign-in + Web Store (recommended if you see "Installation is not enabled")

Playwright?s Chromium launch **defaults include `--disable-extensions`**, which makes the Chrome Web Store show **?Installation is not enabled?**. This script passes `ignoreDefaultArgs: ['--enable-automation', '--disable-extensions']` so extensions and Web Store installs work.

Playwright uses a **dedicated Chrome user-data directory** (not your daily Chrome profile) so runs are isolated. That folder **persists** Google cookies, sign-in, and extensions you add from the Web Store:

- **Default:** `~/.wl-latency-chrome-profile` (override with `WL_LATENCY_CHROME_USER_DATA`).
- **One-time setup:** open Chrome **without** `--load-extension`, sign in to Google, install Citi Shop from the store, then close:

```bash
node src/run-latency.mjs --chrome-setup
# or: CHROME_SETUP=1 node src/run-latency.mjs
```

If the Web Store is still blocked, force **Google Chrome stable** (not a stripped testing build):

```bash
CHROME_EXECUTABLE="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node src/run-latency.mjs --chrome-setup
```

After setup, normal runs reuse the same directory and pick up Citi automatically (no `CDP_URL` needed).

## Zero-wait testing: connect to Chrome you already opened (CDP)

MV3 extensions need a moment after a **cold** browser start. To avoid **any** Playwright warmup during the run:

1. Start **Chrome / Chrome for Testing** yourself with remote debugging and Citi (same profile is fine):

```bash
# Example: macOS Google Chrome ? adjust binary path for Chrome for Testing if you use that.
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.wl-latency-cdp-profile" \
  --load-extension="$HOME/Library/Application Support/Google/Chrome/Default/Extensions/coilflpnmfnnbdpjfcglhgommahebcci/<version>"
```

Use the real `<version>` folder from your profile after installing [Citi Shop from the Web Store](https://chromewebstore.google.com/detail/citi-shop%C2%AE-program-add-sh/coilflpnmfnnbdpjfcglhgommahebcci), or an unpacked path such as `"/Users/neiljones/Downloads/dist 4"`.

2. Wait until Citi is fully up (open a tab, visit a site if you want ? **before** you run the script).

3. Run the latency script **attached** to that browser (no launch, **no** `EXTENSION_WARMUP_*` waits):

```bash
CDP_URL=http://127.0.0.1:9222 node src/run-latency.mjs --merchant "47 Brand"
# or port only:
node src/run-latency.mjs --cdp-url 9222 --merchant "47 Brand"
```

Playwright calls `chromium.connectOverCDP` and uses your existing context. **`browser.close()`** only disconnects Playwright; it does not quit Chrome.

### Optional: skip warmup when Playwright still launches Chrome

If you accept a cold start but want to skip our scripted warmup (not recommended unless you know the profile is hot):

```bash
SKIP_EXTENSION_WARMUP=1 node src/run-latency.mjs --merchant "47 Brand"
# or
node src/run-latency.mjs --skip-warmup --merchant "47 Brand"
```

## Prerequisites

- Node 18+
- [Chrome for Testing](https://developer.chrome.com/blog/chrome-for-testing/) via Playwright:

```bash
cd merchant-google-latency-playwright
npm install
npm run install:browsers
```

`npm run install:browsers` runs `playwright install chrome` (Google Chrome / Chrome for Testing channel).

## Run (Playwright launches Chrome)

```bash
# One merchant by name (Google query = name)
node src/run-latency.mjs --merchant "47 Brand"

# Several merchants
node src/run-latency.mjs --merchants "Kohl's,Nike"

# First N merchants from Wildlink app 209 feed (default 5 if no args)
node src/run-latency.mjs --limit 3

# Comma-separated from env
MERCHANTS="Acme,Beta" node src/run-latency.mjs

# Citi: auto: Chrome Web Store install in your Google Chrome profile, else unpacked dist 4 if present
node src/run-latency.mjs --merchant "47 Brand"

# Or set explicitly (quote paths that contain spaces)
node src/run-latency.mjs --merchant "47 Brand" --citi-extension "/Users/neiljones/Downloads/dist 4"
CITI_EXTENSION_PATH="/Users/neiljones/Downloads/dist 4" node src/run-latency.mjs --merchant "47 Brand"

# Custom results folder
node src/run-latency.mjs --merchant "47 Brand" --output-dir /tmp/latency-out
```

Outputs:

- **Playwright trace** ZIPs under `traces/` (override with `TRACE_DIR=...`).
- **JSONL** recordings under **`output/`** (override with `OUTPUT_DIR` or `--output-dir`): `output/latency-results-YYYY-MM-DD.jsonl` with `endReason`, **`secondsToSignalFromNav`** (seconds from **start of navigation to the organic merchant URL** until `offer_view` or EMA), `secondsToOfferViewFromNav`, `secondsToEmaFromNav`, `msToSignal`, `tracePath`, `recordedAt`.

## Web UI (pick merchants from app 209, stream results)

```bash
cd merchant-google-latency-playwright
npm run ui
# open http://127.0.0.1:8787/  (override port with UI_PORT=9999)
```

Load the Wildlink merchant list, select merchants, **Run selected**. The server opens Chrome (same profile / Citi rules as the CLI) and appends each row to **`output/latency-results-*.jsonl`** while streaming rows to the page.

**Merchant list cache:** `GET /api/merchants` reads **`data/merchants-app-<APP_ID>.json`** when it is younger than **`MERCHANT_CACHE_MAX_AGE_MS`** (default 7 days), so the UI does not call Wildlink on every load. Use **Reload feed** in the UI (adds `?refresh=1`) or run **`npm run sync:merchants`** (same `APP_ID` as env, default 209) to refresh the file. If a refresh fails but an older backup exists, the server falls back to that backup and marks the response `stale: true`.

### Google Sheets (same service account as merchant-rate auditor)

- Uses the **same credential resolution** as the merchant-rate auditor: set **`GOOGLE_APPLICATION_CREDENTIALS`** to your JSON path (see `merchant-rate-weekly-report/.env.example`), or place **`google-sheets-key.json`** under `merchant-rate-weekly-report/secrets/` next to this repo, or under `merchant-google-latency-playwright/secrets/`.
- Default spreadsheet: **`1MrzC7t3bDXDzS5NTxQaFeMj7xPI3HLzFm2AH0KEoTSY`** (same workbook as your template link; new latency tabs are added there unless you override `GOOGLE_LATENCY_SPREADSHEET_ID` or the UI field).
- Share that sheet with the service account **`client_email`** as **Editor**.

### In-browser video (Video column)

- After a run, each row's **Video (.webm)** cell embeds a **`<video>`** when `recordVideo` is enabled and a path is present. The UI serves files from **`GET /api/traces/media?name=<basename>.webm`** under **`TRACE_DIR`** (default `./traces`). Keep the default trace folder so paths resolve.

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `APP_ID` | `209` | Wildlink merchant JSON `wildlink.me/data/{APP_ID}/merchant/1` |
| `OFFER_TIMEOUT_MS` | `90000` | Max wait after organic navigation |
| `EMA_MODAL_MIN_W` / `H` | `180` / `200` | Citi EMA is usually a **cross-origin** `chrome-extension` iframe (parent page cannot read ?Activate Offer?); when text is invisible to the page, we treat a **tall** visible iframe as the modal |
| `EMA_MODAL_MIN_VIS_AREA` | `24000` | Min visible iframe area (px?) in viewport for that geometry path |
| `EMA_STABLE_POLLS` / `EMA_POLL_MS` | `4` / `400` | Consecutive passes required and poll interval for `ema_visible` |
| `CDP_URL` | (unset) | If set (e.g. `http://127.0.0.1:9222`), attach to existing Chrome instead of launching; **no extension warmup** |
| `EXTENSION_WARMUP_MS` | `5000` | After **launch**, extra settle time (ms) for MV3 extensions after SW detection (skipped with `CDP_URL` or UI default skip) |
| `EXTENSION_WARMUP_SW_DEADLINE_MS` | `12000` | Max time (ms) to poll for extension service workers before settle |
| `EXTENSION_WARMUP_URL` | `https://www.example.com/` | First navigation before tests when Playwright launches Chrome |
| `SKIP_EXTENSION_WARMUP` | `0` | Set to `1` to skip warmup when Playwright launches (use CDP for true zero-wait) |
| `MERCHANTS` | (unset) | Comma-separated names (same as `--merchants`) |
| `CITI_EXTENSION_PATH` | (unset) | Overrides auto-resolve: unpacked extension root (`manifest.json`). When unset, prefers Citi under **latency profile** (`WL_LATENCY_CHROME_USER_DATA` / default), then system Chrome, then `dist 4`. Ignored for **loading** when using CDP |
| `WL_LATENCY_CHROME_USER_DATA` | `~/.wl-latency-chrome-profile` | Chrome `user-data-dir` for Playwright-launched runs; keeps Google login + Web Store installs |
| `CHROME_EXECUTABLE` / `GOOGLE_CHROME_BIN` | (unset) | If set, launch this Chrome binary instead of Playwright's `channel: 'chrome'` resolution (useful for Web Store) |
| `CHROME_SETUP` | `0` | Set to `1` with no args (or use `--chrome-setup`) to open the store for sign-in + install only |
| `WL_LATENCY_DEBUG_NET` | `0` | Set to `1` to log `wild.link` request/response URLs to the terminal (debug missed `offer_view`) |
| `TRACE_DIR` | `./traces` | Playwright trace ZIP directory |
| `OUTPUT_DIR` | `./output` | JSONL latency recordings (`latency-results-YYYY-MM-DD.jsonl`) |
| `UI_PORT` | `8787` | Port for `npm run ui` |
| `UI_MERCHANTS_LIMIT` | `400` | Max merchants returned to the UI list (`GET /api/merchants`); full Wildlink feeds can be 10k+ rows and slow down the browser |
| `MERCHANT_CACHE_MAX_AGE_MS` | `604800000` (7d) | Treat `data/merchants-app-<id>.json` as fresh for this long; otherwise refetch on next `GET /api/merchants` unless served from cache |

## Notes

- Uses **`chromium.launchPersistentContext`** with **`channel: 'chrome'`** (or `CHROME_EXECUTABLE`) and **`WL_LATENCY_CHROME_USER_DATA`** / `~/.wl-latency-chrome-profile` when **not** using CDP. (Older runs used `.wl-latency-profile/` under the repo; set `WL_LATENCY_CHROME_USER_DATA` to that path if you want to keep it.)
- Citi from **inside** that same user-data dir is loaded as a normal profile extension (**no** `--load-extension`). Citi from elsewhere still uses **`--load-extension` only** (not `--disable-extensions-except`, which blocks Web Store installs).
- When Playwright launches Chrome with Citi, the script **preloads extensions** before Google: `EXTENSION_WARMUP_URL` + wait for a **service worker** (up to **`EXTENSION_WARMUP_SW_DEADLINE_MS`**, default 12s) + **`EXTENSION_WARMUP_MS`** (default 5s).
- **`offer_view` detection** listens on the browser context **before** `page.goto` to the organic merchant URL, so early `wild.link` requests are not missed. **EMA (Citi Shop)** is detected when either (a) **copy** (?Activate Offer?, ?citi shop?, ?Earn up to ? back?, etc.) appears in the **merchant** DOM, or (b) a **tall visible `chrome-extension://?` iframe** matches modal-like geometry (inner iframe is cross-origin, so text there is not readable from the page).
- Headed only (`headless: false`) when Playwright launches with extensions.
- The MV3 extension under `merchant-google-latency-runner/` is unchanged.
