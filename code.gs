# 400 kV Karjat Grid Portal

A static, zero-build React site (React + Babel loaded via CDN, so there's no
`npm install` / build step — just push and enable GitHub Pages) covering:

1. **Home** — full-scale map, Map/Hybrid/Satellite layers (adjustable satellite
   opacity in Hybrid mode), live weather badges, PDF export of current view.
2. **LMSD Map** — same map with LMSD jurisdiction zones shaded, km markers
   along each line, click/hover a zone for its responsible office + officers.
3. **Maintenance** — full line-by-line contact directory.
4. **Coordinates** — every substation's lat/lon in one table.
5. **Statewide** — the wider 400kV/220kV network from your uploaded diagrams.
6. **Weather** — tab per substation, current + hourly + 16-day forecast,
   background/animation changes with conditions (sun/cloud/rain/storm), plus
   an all-substations map with live weather badges.
7. **LMSD Teams** — editable team roster (max 5 teams/line, 1–5 people/team),
   backed by a Google Sheet via Apps Script.

## Deploy to GitHub Pages

1. Create a new GitHub repo, push all these files to the root (or to `/docs`
   and point Pages at that folder).
2. Repo Settings → Pages → Source: deploy from branch, folder `/ (root)`.
3. Done — your site will be live at `https://<username>.github.io/<repo>/`.

No build tooling, no `package.json` needed — `index.html` loads React,
Babel (for in-browser JSX), and Leaflet straight from CDNs.

## NEW: Print Maps (`#/printmaps`)

Four A4-ready diagrams, one per tab:

1. **400 kV — Karjat network** — every 400/765 kV bus and line reached from
   400 kV Karjat SS (Lonikand I & II, Girawali, the planned Pune East tie).
2. **220 kV — Karjat network** — every 220 kV bus/line reached from Karjat
   (Ahilyanagar, Bhose/Belwandi, Bhigwan, Shirsuphal, Jeur).
3. **Overall 400 kV** — the full statewide 400/765 kV picture, with Karjat's
   own lines drawn bold/full-colour and every other utility's line drawn thin
   and dimmed, so Karjat's network still reads clearly against the wider grid.
4. **Overall 220 kV** — same idea, statewide 220 kV.

Each tab has:
- A **Portrait/Landscape** toggle sized to true A4 (210×297mm).
- A light lat/lon **coordinate graticule** overlaid on the map for a
  surveyed-diagram feel.
- An **LMSD responsibility table** underneath, listing each Karjat line's
  chainage and assigned division — pulled live from the same Sheet as the
  Maintenance Directory.
- **Print** (opens your browser's print dialog, pre-sized to the sheet) and
  **Download PDF** (renders the sheet to a true A4 PDF) buttons.

Note: since GitHub Pages' satellite/hybrid tiles sometimes block canvas
export over CORS, if "Download PDF" ever fails, the Print button's browser
"Save as PDF" is the reliable fallback — it always works because it's a real
print, not a canvas screenshot.

## NEW: Line & Substation Editor (`#/editor`)

A full editing page has been added:

- **Move substations** — toggle "Move substations" on, then drag any dot to
  its real spot (switch to Satellite/Hybrid layer first for accuracy). Any
  line attached to that substation automatically snaps its endpoint along
  with it, so you never get a gap.
- **Trace real line routes** — click a line in the right-hand list to select
  it (it highlights on the map), click **"+ Add tower point"**, then click
  along the satellite imagery to lay down tower/route points one by one —
  each click inserts the point at the correct place along the line, even if
  you click out of order. Drag any existing point to nudge it; right-click a
  point to delete it.
- **Draw brand-new lines** — "+ Draw new line", pick the From/To substations,
  a colour and kV class, then click points on the map and hit "Finish line".
- **Add/delete substations** — "+ Add substation", give it a name, then click
  the map to place it. Delete any substation from the list (it warns you and
  offers to remove dependent lines too).
- **Colour** — every line has its own colour swatch/picker in the side panel,
  independent of the default kV colour.
- **Saving** — "Save changes" always saves into this browser (localStorage)
  immediately. If you've connected the Google Sheet (see below), it also
  pushes the same JSON to a new `Geometry` tab in your sheet, so edits show
  up on every device instead of just the one you edited on. "Export JSON" /
  "Import JSON" give you an offline backup/transfer file either way.
- Once saved, every other page (LMSD map, Statewide map, Coordinates,
  Weather, Maintenance) automatically reads the corrected positions/paths the
  next time you open them — no separate step needed.

### Coordinates double-checked in this pass

`400 kV BBLR` was corrected from a rough placeholder to the verified real
site — it's actually **400 kV Babhleshwar SS, Tal. Rahata (near Shirdi/Loni),
Ahmednagar district** at 19.6203°N 74.4914°E, not down near Osmanabad as the
old placeholder had it. `400 kV Kalamb` was tightened to the Kalamb taluka
centre (Dharashiv district). The remaining substations still flagged
`approx: true` are close (taluka/town-level) but worth a final drag-correction
pass in the new Editor once you're looking at satellite imagery — that's
exactly what the tool is for.

## Connect the Google Sheet (LMSD Teams page)

1. Open `code.gs` — follow the deployment steps written at the top of that
   file (create an Apps Script project, paste the code, Deploy → Web app).
2. Visit your deployed web app URL once with `?action=init` appended, to
   create and auto-populate the spreadsheet.
3. Open `data.js`, find this line near the top:
   ```js
   const APPS_SCRIPT_URL = "PASTE_YOUR_WEB_APP_URL_HERE";
   ```
   Replace the placeholder with your `.../exec` URL and commit.
4. The **LMSD Teams** page will now read/write live to your Sheet. Until you
   do this, that page runs in local preview mode (edits aren't persisted).

## Files

Just two files now:

| File | Purpose |
|---|---|
| `index.html` | Everything — CSS, data, weather helper, map engine, all 7 pages, app shell. One merged JSX bundle transformed in-browser by Babel. |
| `code.gs` | Google Apps Script backend (Sheet-as-database) — deployed separately at script.google.com, not part of the website files. |

### Why this was merged into one file

The first version split the code across 5 separate `<script type="text/babel">`
files. Browsers share **one global scope** across classic `<script>` tags, and
each file had its own `const { useState, useEffect, ... } = React;` at the top.
The second file to run threw `SyntaxError: Identifier 'useState' has already
been declared`, which silently aborted everything after it — including the
final `ReactDOM.createRoot().render()` call. That's what produced the blank
page. Merging into one script (with the hook destructuring done exactly once)
fixes this at the root cause, not just cosmetically.

The merged `index.html` also now shows a visible error message in the page
itself (not just the console) if anything else throws during startup, so any
future issue won't be a silent blank screen.

Where to find your Apps Script URL setting: search `index.html` for
`APPS_SCRIPT_URL` (near the top of the inlined script block).

## Honest scope notes — please read before relying on this

- **Line paths are illustrative**, built from the line lengths, LILO points,
  and bearings you gave me — not surveyed tower/GPS coordinates. Several
  statewide-network substations (marked `approx: true` in `data.js`) use a
  nearby town/taluka center as a stand-in because I couldn't find an exact
  site pin — worth double-checking against MSETCL's own records before this
  goes anywhere official.
- **Satellite tiles** are Esri World Imagery (free, no API key) rather than
  Google's own satellite layer — visually very similar, but if you specifically
  need Google's tiles you'd need a Google Maps API key and a small swap in
  `mapEngine.js`.
- **PDF export** uses `html2canvas`, which can occasionally fail to capture
  map tiles if a tile provider's CORS headers are strict in a given browser —
  I've added `crossOrigin` flags to reduce this, and the UI falls back to
  suggesting your browser's Print → Save as PDF if the export throws.
- **Weather** is real, live data (Open-Meteo, no key required) — but the
  rain/sun/cloud page background is a CSS/animation approximation of mood,
  not a literal radar rendering.
- **"Google Earth-like"**: this uses Leaflet (2D, open-source, no key) with
  satellite/hybrid/map layers and full zoom — genuinely close to Google Maps'
  UX, but it isn't a tilting 3D globe. If true 3D is important, that would
  mean swapping in Cesium or Google's own 3D Maps JS API (needs a billed
  Google Cloud key), which I didn't want to assume you wanted without asking.
- The historic Ahilyanagar–Belwandi circuit cut is used only to shape the
  double-circuit corridor visually, per your instruction — it isn't labeled
  anywhere in the UI.
