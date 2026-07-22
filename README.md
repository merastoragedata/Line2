# HANDOFF — "Line Maps for 400 kV Karjat"

Paste this whole message into a new chat along with the 4 files attached, and say "continue from this handoff."

## Files (all current, all attached)
- **index.html** — the entire app. Single-file, zero-build, React+Babel-free (plain `React.createElement`, no JSX) + Leaflet, loaded via CDN. Deploy: push to a GitHub repo, enable Pages.
- **code.gs** — Google Apps Script backend. Already deployed once this session; deploy the updated version as a **new version** of the same deployment (Deploy → Manage deployments → Edit → New version) so the URL stays the same.
- **README.md** — deployment steps + feature notes (not updated this session, still reflects an earlier state — treat index.html/code.gs as ground truth).
- **nojekyll** — required for GitHub Pages.

## Critical live values already wired in
- `APPS_SCRIPT_URL` in index.html is **already set** to a real deployed URL: `https://script.google.com/macros/s/AKfycby1qjIKX1jM8RAxH11MTTfDHvieUdOoP0JaObXDzVPTltDn103McLOe0WaNAkrPC6QdQg/exec`. **You must redeploy the updated code.gs from this handoff** for the new backend actions to exist at that URL — the frontend already expects them.
- To force-initialize the spreadsheet from scratch, visit `<APPS_SCRIPT_URL>?action=init` once in a browser.

## Architecture essentials (read this before touching anything)
- **No JSX, no Babel** — everything is `React.createElement(...)`. Unicode escapes follow the file's existing convention (`\uXXXX`, surrogate pairs for emoji like `\ud83d\uddbc\ufe0f`) rather than literal UTF-8 characters in strings.
- **Sandbox note for whoever continues in a fresh Claude session**: this dev sandbox cannot reach `unpkg.com` (CDN) or `script.google.com` (Apps Script) directly. To actually test in a browser, vendor React/ReactDOM/Leaflet/html2canvas/jspdf from the npm registry (`registry.npmjs.org` is allowed) into a local folder, rewrite the CDN `<script>`/`<link>` tags to point at the local copies in a **throwaway test copy** (never edit the real index.html's CDN links), and serve with `python3 -m http.server`. This sandbox's bash tool is also intermittently flaky — commands sometimes hang for no discernible reason (not tied to complexity) and the whole tool call returns with zero output. Retry with `echo ping` first to confirm the tool itself is responsive, then re-run the same command; it usually succeeds on retry. Always start server + run test in the **same** bash call (backgrounded processes die between separate tool calls).
- **Karjat family classification is now dynamic**, not a hardcoded list. `KARJAT_SUBSTATION_KEYS` = every substation tagged `group: "karjat"` in `SUBSTATIONS`. `KARJAT_LINE_KEYS` = every `LINES` entry touching one of those substations. Tag a new substation `group: "karjat"` in its data and it — and everything connected to it — automatically appears on all Karjat-scoped pages (LMSD Map, Length Wise, Downloads-Karjat-only). This replaced a static array that silently went stale whenever a line was added via the editor (a real bug the user hit and reported).
- **LMSD data model was fully restructured this session** (see below) — this is the most significant architectural change. Read it carefully before editing anything LMSD-related.
- **Geometry/region/color overrides still persist via localStorage** (browser-only, not synced across devices) — `karjatGeoOverrides_v1`. The user has explicitly and repeatedly asked for **everything to be DB-backed, nothing localStorage-only** — this is NOT done yet. Only the new LMSD Details/Line Coverage model got proper backend persistence this session (see below). Weather background photos, region boundary, division color overrides, highlight level/width preferences, and trace-tool settings are all still localStorage/sessionStorage only. This is flagged as a known gap, not an oversight.
- **`str_replace` on this file is failure-prone** when the same code pattern exists in multiple functions or when copying text from a `grep`/`view` tool result verbatim (those outputs JSON-escape quotes, e.g. showing `\"` for what is actually just `"` in the real file) — always re-`view` the exact target text immediately before editing, never trust remembered/grepped text for the `old_str` argument.

## THE BIG CHANGE THIS SESSION: LMSD data model restructure

The old model conflated "LMSD office info" and "which line it covers" into one array (`JURISDICTION_SEED`) with per-line `segments`+`teams`. This caused real bugs (duplicate officer listings, no way to reuse one LMSD's info across lines cleanly) and didn't match how the user actually thinks about the data.

**New model** (two normalized tables):
```js
LMSD_DETAILS_SEED = [
  { id: "lmsd_lonikand", name: "LMSD Lonikand", zone: "", circle: "", division: "", color: "",
    employees: [{ name, post, mobile, whatsapp: true/false }] },
  ... 6 entries total (Lonikand, Lamboti, Girwali, POWERGRID-tba, Kedgaon, Baramati)
]

LINE_COVERAGE_SEED = [
  { line: "400 kV Karjat - Girawali Line 1 & 2", lineKeys: [...], length: "214.6 km",
    ranges: [{ lmsdId: "lmsd_lonikand", kmEnd: 37 }, { lmsdId: "lmsd_lamboti", kmEnd: 87 }, { lmsdId: "lmsd_girwali", kmEnd: 214.6 }] },
  ... 9 lines total
]
```
A range's **start** is implicit: 0 for the first range, the previous range's `kmEnd` otherwise. Only `kmEnd` is stored/edited.

**`deriveLinesFromCoverage(lmsdDetails, lineCoverage)`** reconstructs the OLD `{line, length, lineKeys, segments, teams}` shape that every pre-existing consumer (corridor building, the LMSD side panel, Length Wise tool, Employee Directory, Downloads LMSD table) already expects — **verified byte-for-byte equivalent to the original hand-written data** via a standalone Node test before this went live. This is *why* the migration didn't require touching those consumers.

**Two new UI sections** replace the old single "Line Maintenance Directory", both under the "All Lines" tab of the LMSD page:
1. **LMSD Details** — CRUD for the master LMSD records: zone/circle/division/name, employees (name/post/mobile/WhatsApp-toggle, add/remove), highlight color picker (writes into both the record's `color` field and the existing `DIVISION_COLOR_OVERRIDES` localStorage system for backward compat with `divisionColor()`). Verified rendering all 6 records, edit mode, and "+ Add employee" working live.
2. **LMSDs Covering Line** — per-line: shows total length, an editable "how many LMSDs cover this line?" count that auto-resizes the `ranges` array and redistributes `kmEnd` evenly, a dropdown per range to pick from LMSD Details, and (when not editing) the assigned LMSD's officers with Call/WhatsApp. **Verified live**: setting count from 1→2 on the 85.4km Lonikand line correctly split it into two 42.7km ranges.

**Backend (code.gs)**: new blob-storage pattern mirroring how geometry is already stored — a dedicated `LmsdModel` sheet tab holding one row of `[timestamp, lmsdDetailsJSON, lineCoverageJSON]`. New actions:
- `GET ?action=getlmsdmodel` → `{ok, lmsdDetails, lineCoverage}`
- `POST {action:"savelmsddetails", lmsdDetails}` — saves details, preserves existing coverage
- `POST {action:"savelinecoverage", lineCoverage}` — saves coverage, preserves existing details
- `INIT_()` now also seeds `LmsdModel` with the same seed data, **only if empty** (never clobbers real edits on repeat init)
- The old `saveteams`/`getData` per-line-sheet-tab actions are **still present** for backward compatibility but are no longer used by the frontend's LMSD page (only kept in case anything external depends on them — safe to remove later if not needed)

`useLiveJurisdiction()` (used by Downloads/PrintMapPage) was updated to also pull from `getlmsdmodel` and run through `deriveLinesFromCoverage`, so Downloads and the LMSD page can never show inconsistent data again (this directly fixes the earlier "LMSD info shows for a few seconds then disappears" bug class).

## Also fixed this session (all verified live in browser except where noted)
1. **Line-name label bug**: permanent on-map labels were reconstructing "Karjat SS ↔ Girawali SS" instead of using the standardized directory name. Fixed via `lineKeyToNames()` lookup.
2. **"Display Line Names" is now a real sliding switch**, defaults to **off**.
3. **Click-to-select corridor redesign**: clicking a corridor now shows exactly that LMSD + line (not every line in that division), highlights it white with others dimmed, and computes real distance-from-both-ends via point-to-path projection (`nearestPointFractionOnPath`). Side panel officer data is a `useMemo` derived fresh from live state every render — can never go stale.
4. **The real "Line not found" save bug**: `doPost`'s save handler never called `INIT_()`, so saving before any GET request (or for a line added after the sheet was last initialized) threw. Fixed: `saveTeamsForLine_` now lazily seeds its own sheet tab if missing. (This was for the old per-line model; the new LMSD model's save functions don't have this failure mode at all since they're single blob writes.)
5. **Employee Directory**: now groups by employee first (name shown once, lines-covered listed as chips underneath) instead of repeating full officer details per line.
6. **Maintenance Directory** (now "LMSDs Covering Line"): removed redundant "LMSDs on this line" block, decoration moved into the table's LMSD column as colored chips.
7. **"All Lines" statewide overlay bug**: root cause was the map staying zoomed to Karjat's local view when a statewide overlay ("All lines" 400kV/220kV) was checked — lines rendered fine but off-screen, and the visible Karjat lines got overdrawn making it look like their color just changed. Fixed: dedicated effect auto-fits map bounds when a statewide layer is newly toggled on (verified 47%→37% zoom), without fighting the user's subsequent manual pan/zoom.
8. **Total line length** has hero styling (large cyan number) in both the LMSD side panel and Length Wise tool.
9. **"Show LMSD Region" checkbox** at top of LMSD map, toggles `showZones` — verified hides/shows all corridor polygons.
10. **"Adjust Highlight" popover** (level % opacity + width in meters, both `localStorage`-persisted) — opens to the side of the button (not below, which was covering the map). Verified level slider live-changes fill-opacity and persists.
11. **Length Wise tab** (renamed from "Trace Line Area"): default margin 10%→3%, base map now shows only Karjat's own lines (no statewide clutter, no corridor overlay — "drop highlights" as requested), reuses the same Adjust Highlight state as the LMSD map, Tower Numbers/Line Names controls moved outside the map to match LMSD, map height increased to 78vh, substation names shown only above **57.5%** zoom (vs. LMSD map's 47% — page-specific via new `substationZoomThreshold` prop).
12. **Statewide page**: now uses `emphasizeKeys: KARJAT_LINE_KEYS` so Karjat's own lines render bold/full-opacity and other statewide lines render thin/dimmed (previously all lines rendered identically) — matches LMSD map's visual convention, no corridor highlight overlay, just line colors as requested. Also now passes `jurisdictionData` so hover tooltips show correct names/lengths (previously missing entirely).
13. **Downloads SVG**: LILO/tee points no longer render as fake substation bus-bar symbols — now a small neutral dot labeled "Tpoint".
14. **Tower number labels**: moved to the side of the tower point with real clearance (previously directly overlapping it).
15. **Substation name labels**: zoom-gated (47% on LMSD map, 57.5% on Length Wise, both via configurable `substationZoomThreshold` prop — was previously always-on).
16. **Circuits now render as N separate parallel lines**, not capped at 2 — verified standalone: the Karjat→LILO shared 4-circuit stretch now draws 4 lines, evenly spaced within the same ±90m corridor width as before (was previously only ever drawing 2 lines regardless of circuit count).
17. **Dotted/dashed line bug** (reported twice by the user, described as looking like "under construction" lines): root cause was the "Line Overlays" toggle feature (400kV/220kV Karjat-only / All-lines checkboxes) always rendering with `dashArray: "10 6"` regardless of context. Removed — overlays are now solid, color alone distinguishes them.

## Session: Full localStorage → DB migration (this session)

Picked up the "Full localStorage → DB migration" item from the Known Gaps list below. Migrated everything that was still local-only, **except trace margin** (kept session-only by explicit original design — it's meant to reset each browser session).

**Backend (`code.gs`) — new sheets/actions:**
- **`AppSettings` sheet**: one row holding `divisionColors` (JSON), `highlightLevel`, `highlightWidth`, `traceColor`. Read-merge-write pattern (same as the LMSD model) so saving one field never clobbers the others. New actions: `getappsettings` (GET), `savedivisioncolors` / `savehighlight` / `savetracecolor` (POST).
- **`WeatherBg` sheet**: photos stored as row-groups — one row per ~40,000-char chunk (Sheets cells cap at 50,000 chars; a single compressed phone photo can exceed that as one blob), all sharing a generated `photoId` so they reassemble in order. New actions: `getweatherbg` (GET), `addweatherphoto` / `removeweatherphoto` (POST). Delete-by-`photoId` (not array index) so it's safe across devices.
- Geometry (`getgeometry`/`savegeometry`) already existed from an earlier session but was **only wired into the Editor page**, not applied app-wide on boot — see frontend fix below.

**Frontend (`index.html`):**
- **New `bootSyncFromServer()`**, called once from `App`'s mount effect. Important architectural note: `KARJAT_FAMILY_`/`KARJAT_SUBSTATION_KEYS`/`KARJAT_LINE_KEYS`/`LMSD_LAYER_DEFS` etc. are `const`s computed **synchronously at parse time** — an async fetch can never beat that. Rather than a deep reactivity refactor, `bootSyncFromServer()` fetches geometry + app settings, and **only if either differs from what's already cached locally**, writes the fresh values into `localStorage` and does **one** `location.reload()` (guarded by a `sessionStorage` flag so it can never loop). The reload re-parses the file with the fresh cache already in place, so every module-level constant computes correctly. First load on a brand-new device: brief flash, one reload. Every load after that: no reload, nothing to sync.
- **Division colors** (`setDivisionColorOverride`/`resetDivisionColorOverride`) and **highlight level/width** (`saveHighlightLevel`/`saveHighlightWidth`) and **trace color** (`saveTraceColor`) now fire-and-forget `POST` to the backend in addition to `localStorage`, matching the existing `savelinecoverage` pattern.
- **Weather background photos**: switched the local storage shape from bare data-URL strings to `{id, dataUrl}` objects (old-format entries auto-normalize on load, tagged with a `local_`-prefixed id). On `WeatherPage` mount, pulls the Sheet's photo library (source of truth), then pushes up any `local_`-id photos this browser added while offline so they stop being stuck on one device. Upload/remove now call `addweatherphoto`/`removeweatherphoto`.

**Verification**: syntax-checked both `code.gs` and both inline `<script>` blocks in `index.html` with `node --check`. Browser-tested via the vendored-Playwright workaround (see sandbox note above) — loaded LMSD Map, Weather (opened the photo manager panel, confirmed the "synced to your Google Sheet" hint text appears), Editor, and the Adjust Highlight popover. Zero page/JS errors; the only console noise was CORS failures from `script.google.com` and map tiles, which is expected in this sandbox (egress is restricted to an allow-list that doesn't include those domains — this is a sandbox limitation, not a code issue, since it uses the exact same `fetch(APPS_SCRIPT_URL, ...)` pattern as the already-working `getlmsdmodel`/`savelinecoverage` calls). **Not tested against a live deployed Apps Script** — you must redeploy the updated `code.gs` as a new version of the existing deployment before any of the new actions exist at the live URL.

**What's left un-migrated, on purpose:**
- Trace margin (`sessionStorage`) — resets each browser session by design, not a gap.
- The reload-once boot-sync UX (brief flash + reload on a device's first sync) is a deliberate tradeoff to avoid a much larger reactivity refactor of module-level constants — flagged in case the user wants something smoother later.

## Known gaps / explicitly deferred (do not surprise-implement these without discussion)
- ~~**Full localStorage → DB migration**~~ — **DONE this session**, see above. (Trace margin intentionally stays session-only.)
- **Multi-substation / multi-tenant platform**: the user described a full vision (search-or-coordinates-or-map-click substation creation, "Home Substation" declaration with an alert on first registration, per-substation admin/editor/viewer/guest roles with distinct passwords, auto-listing connected substations in Weather, tower-click → village/taluka/district reverse geocoding, seamless line-route editing with draggable tower insertion, LILO-point creation at arbitrary towers, line-slicing/joining between towers). **None of this is built.** This is a genuinely large rebuild, not a patch. The user acknowledged the security caveat (client-side passwords are visible to anyone via dev tools / view-source) and still wants literal per-substation password credentials — flagged, not silently agreed with as a good security practice, but the user's explicit informed choice.
- **Gaussian multi-voltage regions** (auto-computed convex/concave hull covering all lines+substations of a given voltage or combined, editable by adding/deleting path points, multiple named regions, black/dotted/thick/customizable styling remembered, "Select Other Regions" show/hide with remembered state) — not built. Only the original single global `REGION` (dashed boundary) exists.
- **New "Maharashtra flow map" page** — copy of the Line Editor mapping ALL Maharashtra substations/lines with power-flow animation, modeled on an uploaded SLD screenshot — not built. The reference image was received earlier in this conversation but the feature itself was never started.
- **Line Editor improvements**: substation-list-moved-below-map, LILO-as-reference-note-only display, per-line color scheme picker (default-by-kV, custom kV level entry with a remembered dropdown), calculated-km-by-path display, "duplicate this line" copy feature, add-substation via search/coordinates/map-click page, draggable tower insertion with village/taluka/district lookup on hover, line-thickness control at editor level, drag-to-reorder line list — none of this is built. The editor is otherwise functionally unchanged from before this session.
- **Weather page**: circular/oval cloud shapes user found unrealistic, and "auto-list substations connected to home lines + search to add more" — not addressed.
- **"Select Other Regions to sh[ow]"** — message was cut off mid-word in the original request; never clarified.

## Verification method used throughout this session
A real headless Chromium (via Playwright, already installed in `/home/claude/.npm-global/lib/node_modules/playwright`, binary at the path returned by `chromium.executablePath()`) was used for actual browser testing, not just syntax checks — clicking through corridor selections, verifying computed distances (e.g. 53.04+32.36=85.4km checks out), verifying localStorage persistence across reloads, verifying visual screenshots. This is significantly more rigorous than syntax-checking alone and is recommended for any further work — see the sandbox note above for the exact vendoring workaround needed since the CDN is unreachable from this environment.

## Immediate next step if picking this up fresh
Ask the user which of the "Known gaps" section they want next — do not assume. The user has a strong preference for discussing scope before large changes (multi-substation platform, DB migration, login) but wants incremental fixes/features executed directly without excessive check-ins once scope is agreed. Balance accordingly: small well-defined asks (a bug, a styling tweak, a single new toggle) — just do it and verify. Large architectural asks (auth, multi-tenant, full region system) — confirm scope/sequencing first, the user has explicitly asked for this pattern.
