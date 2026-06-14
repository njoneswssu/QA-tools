# JCP WSCO order XML CLI

A Node.js command-line tool that:

1. Opens the JCP WCSO search page, runs a PO search for each order number you provide, and downloads linked `.xml` files.
2. Finds the right `<Comergent>` message for each PO.
3. Converts XML using the same rules as the legacy **`xml-converter.html`** flow (logic lives in `xml-convert.js`).
4. Writes a single **`ComergentData`** file (no `<?xml …?>` on the first line) under `jcp-wsco-cli/output/`.

Search site: `http://transfer.levsuite.com/search_wsco.php`

---

## Prerequisites

- **Node.js** 18+ (includes `fetch`-style APIs; the script uses modern ESM).
- Network access to the transfer site.

### One-time setup

```bash
cd jcp-wsco-cli
npm install
npx playwright install chromium
```

Playwright drives Chromium to submit the search form and reuse session cookies when fetching XML.

---

## How to run

### From this folder (`jcp-wsco-cli`)

```bash
node cli.mjs
```

## End-to-end workflow

1. **Order numbers**  
   You enter every PO you want to process in this run (interactive multiline prompt, or `--orders` / positional args).

2. **Shipment-only vs regular** (before any search)  
   You decide which of those POs should get **ORDER INPUT SHIPMENT–only** output (a single regenerated shipment `<Comergent>` block).  
   Every **other** PO in the same run gets **regular** conversion: the **ORDER INPUT ORDER STATUS UPDATE ACCEPT** block immediately followed by the **ORDER INPUT SHIPMENT** block—the same pairing as the blue “Convert” button in `xml-converter.html`.

3. **Search**  
   For each PO, the tool fills “JCP WCSO PO”, clicks Search, collects `.xml` links on the results page, and downloads each file with the same browser context.

4. **Summary**  
   By default you get a short table per PO (mode, XML link count, export ok/skip). Use **verbose** for full per-file detail.

5. **Write**  
   You confirm writing one combined file containing all shipment-only blocks (first in the file) and all regular pairs (second). Invalid yes/no answers are rejected until you answer `y`/`yes` or `n`/`no`.

---

## Conversion modes (exact strings)

| Mode | Meaning in XML | What gets written |
|------|----------------|-------------------|
| **Regular** | Source has `ORDER INPUT SHIPMENT` or `ORDER INPUT ORDER STATUS UPDATE ACCEPT` in the matching block | `ORDER INPUT ORDER STATUS UPDATE ACCEPT` version (shipment noise stripped), then the regenerated `ORDER INPUT SHIPMENT` block—mirrors **XML mode + blue button** in `xml-converter.html`. |
| **Shipment-only** | Same source block | Only the **ORDER INPUT SHIPMENT** half (dates + default tracking block applied like the HTML tool). |

---

## How the tool chooses XML and blocks

- **Which file:** First search result page is scanned for `a[href]` pointing at `.xml` URLs; files are fetched in that order. The **first** file that contains an exportable block for that PO wins.
- **Which `<Comergent>` block:** Blocks are split on `<Comergent>`. For each PO, the **first** block whose `<OrderNumber>` matches the searched PO is used:
  - If that block contains **`ORDER INPUT SHIPMENT`**, it is treated as **regular** when this PO is not in the shipment-only list.
  - If it contains **`ORDER INPUT ORDER STATUS UPDATE ACCEPT`** but not the shipment phrase, it is treated as **accept-style** input; in **shipment-only** mode you still output only the shipment block built from that source.

Only **one** conversion bundle is produced **per PO per run** (first qualifying file, first qualifying block).

---

## Interactive input (one line vs column)

**Default:** Enter all POs on **one line** (commas or spaces), then a **single** Enter.

**Column paste:** When prompted, type **`paste`** and press Enter. Then paste **one PO per line** and end with **Enter on an empty line**. This uses a dedicated reader so every row is captured (the usual readline API only takes one line per prompt, which previously dropped middle rows).

The **shipment-only** step supports the same: one line with **`all`**, **`none`**, or comma-separated POs, or **`paste`** for a column.

One-line input still supports commas, spaces, tabs, and strips a UTF-8 **BOM** on paste.

**Duplicates:** If the same PO appears more than once (after normalization / leading zeros), extras are dropped: **one search and one conversion block** per distinct PO.

### Leading zeros on numeric POs

If a PO is **digits only** and shorter than the configured width (default **8**), it is left-padded with zeros so it matches XML like `02450977`. Example: `2450977` → `02450977`. Already-wide numbers (length ≥ width) are unchanged. Non-numeric PO strings are only trimmed.

Override width: environment variable **`JCP_PO_PAD_WIDTH`** (positive integer, e.g. `10`).

### Shipment-only prompt keywords

- **`all`** (alone, case-insensitive): every PO in this run is shipment-only.
- **`none`** or **`no`** (alone): no shipment-only POs (all regular).
- Otherwise: list POs that must appear in this run; unknown tokens are reported and ignored.

---

## Command-line arguments

| Argument | Description |
|----------|-------------|
| `PO PO …` | Positional order numbers (same as `--orders`). |
| `--orders "PO,PO"` | Order list; value can include newlines for column-style pasting in the shell. |
| `--shipment-only all` | Every PO in this run is shipment-only. |
| `--shipment-only "PO,PO"` | Subset of POs that are shipment-only (must match POs in this run). |
| `--verbose` / `-v` | Print full per-XML-file breakdown after the search. |

Examples:

```bash
node cli.mjs --orders "02450977,02450978" --shipment-only 02450977
node cli.mjs 02450977 02450978 --shipment-only all
```

If you pass `--orders` / POs on the command line, the **shipment-only** question is skipped when you also pass `--shipment-only`. If stdin is not a TTY (e.g. piped), shipment-only defaults to **none** unless `--shipment-only` is provided.

---

## Environment variables

| Variable | Effect |
|----------|--------|
| `HEADFUL=1` or `HEADFUL=true` | Run Chromium **visible** (useful if selectors or the site change). |
| `VERBOSE=1` or `VERBOSE=true` | Same as `--verbose`. |
| `JCP_PO_PAD_WIDTH` | Min digit length for leading-zero padding (default `8`). |

---

## Output

- **Directory:** `jcp-wsco-cli/output/`
- **Filename pattern:** `converted_order_status_<ISO-timestamp>.xml`
- **Structure:** Root element `<ComergentData>` wrapping concatenated `<Comergent>` fragments. There is **no** XML declaration line at the top (by design).

---

## Project files

| File | Role |
|------|------|
| `cli.mjs` | Playwright search, prompts, summary, file write. |
| `xml-convert.js` | Conversion helpers aligned with `xml-converter.html`. |
| `package.json` | Depends on `playwright`. |
| `output/` | Generated XML (gitignored via `.gitignore`). |

---

## Relation to `xml-converter.html`

The HTML file’s **XML input mode** and **blue** convert path (ACCEPT + SHIPMENT pair) are the reference for **regular** mode. Shipment regeneration (dates, `JCPOrderShipmentUpdateInfoList`, tracking placeholders) follows the same string replacements and structure as that page.

---

## Troubleshooting

- **`Cannot find module 'playwright'`** — Run `npm install` in `jcp-wsco-cli`.
- **Browser errors** — Run `npx playwright install chromium` from `jcp-wsco-cli`.
- **No exportable block / skip** — The downloaded XML may not contain a `<Comergent>` with a matching `<OrderNumber>`, or no `.xml` links appeared for that search. Use `--verbose` to inspect each file.
- **Wrong PO in output** — Only the **first** qualifying XML file and **first** qualifying block per PO are used; add a separate run if you need another file.

---

## License / use

Private tooling in this repository; use only in line with your employer’s policies and the transfer site’s terms of use.
