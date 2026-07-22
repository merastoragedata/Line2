/**
 * ============================================================================
 *  400 kV KARJAT — LMSD TEAM DATABASE (Google Apps Script backend)
 * ============================================================================
 *  What this does
 *  --------------
 *  1. On first run (INIT_) it creates a Google Sheet ("Karjat_LMSD_Database")
 *     inside a Drive folder ("Karjat_400kV_Portal"), with one tab per line,
 *     and auto-populates it with the jurisdiction data you already gave me.
 *  2. Exposes a small JSON API (doGet / doPost) so the static website can:
 *       - action=getData      -> read all lines + teams + members
 *       - action=saveTeams    -> overwrite the teams for one line (validated:
 *                                 max 5 teams/line, 1-5 members/team)
 *       - action=init         -> (re)build the sheet from scratch
 *
 *  DEPLOY STEPS (do this once)
 *  ----------------------------
 *  1. Go to https://script.google.com -> New project. Paste this whole file
 *     in as Code.gs (replace the default content).
 *  2. Click Deploy -> New deployment -> type: "Web app".
 *       - Execute as: Me
 *       - Who has access: Anyone  (or "Anyone with Google account" if you
 *         want to restrict edits to your org)
 *  3. Click Deploy, authorize the permissions it asks for.
 *  4. Copy the Web App URL it gives you (ends in /exec).
 *  5. Paste that URL into `data.js` in the website files, where it says
 *         const APPS_SCRIPT_URL = "PASTE_YOUR_WEB_APP_URL_HERE";
 *  6. Open the deployed URL once in your browser with ?action=init at the
 *     end (e.g. https://script.google.com/macros/s/XXXX/exec?action=init)
 *     to create and auto-populate the spreadsheet the first time.
 * ============================================================================
 */

const FOLDER_NAME = "Karjat_400kV_Portal";
const SHEET_NAME = "Karjat_LMSD_Database";

// ---- Seed data: exactly what you gave me, used to auto-populate on init ----
const SEED_LINES = [
  {
    line: "400 kV Karjat - Girawali Line 1 & 2",
    length: "214.6 km",
    segments: [
      { chainage: "0-37 km", division: "LMSD Lonikand" },
      { chainage: "37-87 km", division: "400 kV LMSD Lamboti" },
      { chainage: "87-214.6 km", division: "LMSD Girwali" },
    ],
    teams: [
      { teamName: "Team 1", members: [{ name: "Aishwarya Kirtane", post: "AEE", mobile: "9922364856" }] },
      { teamName: "Team 2", members: [{ name: "Shri Nadgire", post: "DyCT", mobile: "9850704944" }] },
      { teamName: "Team 3", members: [{ name: "Nagesh Saray", post: "AE", mobile: "8554994942" }] },
    ],
  },
  {
    line: "400 kV Karjat - Lonikand Line 1 & 2",
    length: "85.4 km",
    segments: [{ chainage: "0-85.4 km", division: "LMSD Lonikand" }],
    teams: [
      { teamName: "Team 1", members: [{ name: "Aishwarya Kirtane", post: "AEE", mobile: "9922364856" }] },
    ],
  },
  {
    line: "400/765 kV Karjat - Pune East Line 1 (planned)",
    length: "~50 km D/C",
    segments: [{ chainage: "0-50 km", division: "POWERGRID (to be assigned)" }],
    teams: [],
  },
  {
    line: "220 kV Karjat - Ahilyanagar Line 1",
    length: "79.6 km",
    segments: [{ chainage: "0-79.6 km", division: "LMSD Kedgaon" }],
    teams: [
      {
        teamName: "Team 1",
        members: [
          { name: "Kishor Katore", post: "AEE", mobile: "9762430884" },
          { name: "Kailash Patil", post: "DyEE", mobile: "7030831440" },
        ],
      },
    ],
  },
  {
    line: "220 kV Karjat - Belwandi Line 1",
    length: "40.7 km",
    segments: [{ chainage: "0-40.7 km", division: "LMSD Kedgaon" }],
    teams: [
      {
        teamName: "Team 1",
        members: [
          { name: "Kishor Katore", post: "AEE", mobile: "9762430884" },
          { name: "Kailash Patil", post: "DyEE", mobile: "7030831440" },
        ],
      },
    ],
  },
  {
    line: "220 kV Karjat - Bhigwan Line 1",
    length: "19.84 km",
    segments: [{ chainage: "0-19.84 km", division: "LMSD Baramati" }],
    teams: [{ teamName: "Team 1", members: [{ name: "Mali", post: "AEE", mobile: "7798430251" }] }],
  },
  {
    line: "220 kV Karjat - Shirsuphal Line 1",
    length: "19.84 km",
    segments: [{ chainage: "0-19.84 km", division: "LMSD Baramati" }],
    teams: [{ teamName: "Team 1", members: [{ name: "Mali", post: "AEE", mobile: "7798430251" }] }],
  },
  {
    line: "220 kV Karjat - Jeur Line 1",
    length: "50.69 km",
    segments: [{ chainage: "0-50.69 km", division: "LMSD Baramati" }],
    teams: [{ teamName: "Team 1", members: [{ name: "Mali", post: "AEE", mobile: "7798430251" }] }],
  },
  {
    line: "220 kV Karjat - Jeur Line 2",
    length: "50.69 km",
    segments: [{ chainage: "0-50.69 km", division: "LMSD Baramati" }],
    teams: [{ teamName: "Team 1", members: [{ name: "Mali", post: "AEE", mobile: "7798430251" }] }],
  },
];

const MAX_TEAMS_PER_LINE = 5;
const MAX_MEMBERS_PER_TEAM = 5;
const MIN_MEMBERS_PER_TEAM = 1;

function getOrCreateFolder_() {
  const it = DriveApp.getFoldersByName(FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
}

const SEED_LMSD_DETAILS = [
  { id: "lmsd_lonikand", name: "LMSD Lonikand", zone: "", circle: "", division: "", color: "",
    employees: [{ name: "Aishwarya Kirtane", post: "AEE", mobile: "9922364856", whatsapp: true }] },
  { id: "lmsd_lamboti", name: "400 kV LMSD Lamboti", zone: "", circle: "", division: "", color: "",
    employees: [{ name: "Shri Nadgire", post: "DyCT", mobile: "9850704944", whatsapp: true }] },
  { id: "lmsd_girwali", name: "LMSD Girwali", zone: "", circle: "", division: "", color: "",
    employees: [{ name: "Nagesh Saray", post: "AE", mobile: "8554994942", whatsapp: true }] },
  { id: "lmsd_powergrid_tba", name: "POWERGRID (to be assigned)", zone: "", circle: "", division: "", color: "", employees: [] },
  { id: "lmsd_kedgaon", name: "LMSD Kedgaon", zone: "", circle: "", division: "", color: "",
    employees: [
      { name: "Kishor Katore", post: "AEE", mobile: "9762430884", whatsapp: true },
      { name: "Kailash Patil", post: "DyEE", mobile: "7030831440", whatsapp: true }
    ] },
  { id: "lmsd_baramati", name: "LMSD Baramati", zone: "", circle: "", division: "", color: "",
    employees: [{ name: "Mali", post: "AEE", mobile: "7798430251", whatsapp: true }] }
];
const SEED_LINE_COVERAGE = [
  { line: "400 kV Karjat - Girawali Line 1 & 2", lineKeys: ["karjat_lilo", "lilo_girawali"], length: "214.6 km",
    ranges: [{ lmsdId: "lmsd_lonikand", kmEnd: 37 }, { lmsdId: "lmsd_lamboti", kmEnd: 87 }, { lmsdId: "lmsd_girwali", kmEnd: 214.6 }] },
  { line: "400 kV Karjat - Lonikand Line 1 & 2", lineKeys: ["karjat_lilo", "lilo_lonikand2"], length: "85.4 km",
    ranges: [{ lmsdId: "lmsd_lonikand", kmEnd: 85.4 }] },
  { line: "400/765 kV Karjat - Pune East Line 1 (planned)", lineKeys: ["karjat_puneeast"], length: "~50 km D/C",
    ranges: [{ lmsdId: "lmsd_powergrid_tba", kmEnd: 50 }] },
  { line: "220 kV Karjat - Ahilyanagar Line 1", lineKeys: ["karjat_cutab", "cutab_ahilyanagar"], length: "79.6 km",
    ranges: [{ lmsdId: "lmsd_kedgaon", kmEnd: 79.6 }] },
  { line: "220 kV Karjat - Belwandi Line 1", lineKeys: ["karjat_cutab", "cutab_belwandi"], length: "40.7 km",
    ranges: [{ lmsdId: "lmsd_kedgaon", kmEnd: 40.7 }] },
  { line: "220 kV Karjat - Bhigwan Line 1", lineKeys: ["karjat_bhigwan"], length: "19.84 km",
    ranges: [{ lmsdId: "lmsd_baramati", kmEnd: 19.84 }] },
  { line: "220 kV Karjat - Shirsuphal Line 1", lineKeys: ["karjat_shirsuphal"], length: "19.84 km",
    ranges: [{ lmsdId: "lmsd_baramati", kmEnd: 19.84 }] },
  { line: "220 kV Karjat - Jeur Line 1", lineKeys: ["karjat_jeur"], length: "50.69 km",
    ranges: [{ lmsdId: "lmsd_baramati", kmEnd: 50.69 }] },
  { line: "220 kV Karjat - Jeur Line 2", lineKeys: ["karjat_jeur"], length: "50.69 km",
    ranges: [{ lmsdId: "lmsd_baramati", kmEnd: 50.69 }] }
];

function getOrCreateSpreadsheet_() {
  const folder = getOrCreateFolder_();
  const files = folder.getFilesByName(SHEET_NAME);
  if (files.hasNext()) {
    return SpreadsheetApp.open(files.next());
  }
  const ss = SpreadsheetApp.create(SHEET_NAME);
  const file = DriveApp.getFileById(ss.getId());
  folder.addFile(file);
  DriveApp.getRootFolder().removeFile(file); // keep it only inside our folder
  return ss;
}

function sheetNameForLine_(lineName) {
  // Sheet tab names max 100 chars & can't contain []*?/\:
  return lineName.replace(/[\[\]\*\?\/\\:]/g, "").substring(0, 90);
}

function seedLineSheet_(ss, lineObj) {
  const tabName = sheetNameForLine_(lineObj.line);
  let sheet = ss.getSheetByName(tabName);
  if (!sheet) sheet = ss.insertSheet(tabName);
  sheet.clear();

  sheet.getRange(1, 1, 1, 2).setValues([["Line", lineObj.line]]).setFontWeight("bold");
  sheet.getRange(2, 1, 1, 2).setValues([["Length", lineObj.length]]);

  let row = 4;
  sheet.getRange(row, 1, 1, 2).setValues([["Chainage", "Division"]]).setFontWeight("bold");
  row++;
  lineObj.segments.forEach((seg) => {
    sheet.getRange(row, 1, 1, 2).setValues([[seg.chainage, seg.division]]);
    row++;
  });

  row += 1;
  const headerRow = row;
  sheet.getRange(row, 1, 1, 5).setValues([["Team", "Member #", "Name", "Post", "Mobile"]]).setFontWeight("bold");
  row++;
  lineObj.teams.forEach((team) => {
    team.members.forEach((m, i) => {
      sheet.getRange(row, 1, 1, 5).setValues([[team.teamName, i + 1, m.name, m.post, m.mobile]]);
      row++;
    });
  });

  sheet.autoResizeColumns(1, 5);
  sheet.setFrozenRows(headerRow);
  return sheet;
}

function INIT_() {
  const ss = getOrCreateSpreadsheet_();

  // Remove default blank sheet if present and unused
  const defaultSheet = ss.getSheetByName("Sheet1");

  SEED_LINES.forEach((lineObj) => seedLineSheet_(ss, lineObj));

  // Seed the LMSD Details / Line Coverage model only if nothing has been
  // saved there yet \u2014 never clobber real edits on a repeat init.
  if (!getLmsdModel_()) {
    saveLmsdDetails_(SEED_LMSD_DETAILS);
    saveLineCoverage_(SEED_LINE_COVERAGE);
  }

  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }

  return ss.getUrl();
}

function readLineFromSheet_(sheet) {
  const data = sheet.getDataRange().getValues();
  const lineName = data[0][1];
  const length = data[1][1];

  const segments = [];
  let r = 4; // 0-indexed row 4 = "Chainage/Division" header
  r++; // move past header
  while (r < data.length && data[r][0] && data[r][0] !== "Team") {
    segments.push({ chainage: data[r][0], division: data[r][1] });
    r++;
  }

  // find the "Team" header row
  while (r < data.length && data[r][0] !== "Team") r++;
  r++; // past header

  const teamsMap = {};
  const teamOrder = [];
  for (; r < data.length; r++) {
    const row = data[r];
    if (!row[0]) continue;
    const teamName = String(row[0]);
    if (!teamsMap[teamName]) {
      teamsMap[teamName] = [];
      teamOrder.push(teamName);
    }
    teamsMap[teamName].push({ name: row[2], post: row[3], mobile: String(row[4]) });
  }
  const teams = teamOrder.map((t) => ({ teamName: t, members: teamsMap[t] }));

  return { line: lineName, length: length, segments: segments, teams: teams };
}

function getAllData_() {
  const ss = getOrCreateSpreadsheet_();
  const sheets = ss.getSheets();
  if (sheets.length === 0 || (sheets.length === 1 && sheets[0].getName() === "Sheet1")) {
    INIT_();
  }
  const fresh = getOrCreateSpreadsheet_();
  return fresh
    .getSheets()
    .filter((s) => s.getLastRow() > 0)
    .map(readLineFromSheet_);
}

function saveTeamsForLine_(lineName, teams) {
  if (!Array.isArray(teams) || teams.length > MAX_TEAMS_PER_LINE) {
    throw new Error("A line can have at most " + MAX_TEAMS_PER_LINE + " teams.");
  }
  teams.forEach((t) => {
    if (!t.members || t.members.length < MIN_MEMBERS_PER_TEAM || t.members.length > MAX_MEMBERS_PER_TEAM) {
      throw new Error(
        "Each team needs between " + MIN_MEMBERS_PER_TEAM + " and " + MAX_MEMBERS_PER_TEAM + " members."
      );
    }
  });

  const ss = getOrCreateSpreadsheet_();
  const tabName = sheetNameForLine_(lineName);
  let sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    // Spreadsheet was never (fully) initialized for this line \u2014 e.g. a save
    // happened before any page ever did a GET, or this line was added to
    // SEED_LINES after the sheet was first set up. Seed it now instead of
    // failing the save outright.
    const seedObj = SEED_LINES.find((l) => l.line === lineName);
    if (!seedObj) throw new Error("Line not found: " + lineName);
    sheet = seedLineSheet_(ss, seedObj);
  }

  const existing = readLineFromSheet_(sheet);

  sheet.clear();
  sheet.getRange(1, 1, 1, 2).setValues([["Line", existing.line]]).setFontWeight("bold");
  sheet.getRange(2, 1, 1, 2).setValues([["Length", existing.length]]);

  let row = 4;
  sheet.getRange(row, 1, 1, 2).setValues([["Chainage", "Division"]]).setFontWeight("bold");
  row++;
  existing.segments.forEach((seg) => {
    sheet.getRange(row, 1, 1, 2).setValues([[seg.chainage, seg.division]]);
    row++;
  });

  row += 1;
  const headerRow = row;
  sheet.getRange(row, 1, 1, 5).setValues([["Team", "Member #", "Name", "Post", "Mobile"]]).setFontWeight("bold");
  row++;
  teams.forEach((team) => {
    team.members.forEach((m, i) => {
      sheet.getRange(row, 1, 1, 5).setValues([[team.teamName, i + 1, m.name, m.post, m.mobile]]);
      row++;
    });
  });
  sheet.autoResizeColumns(1, 5);
  sheet.setFrozenRows(headerRow);

  return readLineFromSheet_(sheet);
}

// ---- Line/Substation Editor geometry storage (single JSON blob per save) ----
const GEOMETRY_SHEET_NAME = "Geometry";
const LMSD_MODEL_SHEET_NAME = "LmsdModel";

function getLmsdModelSheet_() {
  const ss = getOrCreateSpreadsheet_();
  let sheet = ss.getSheetByName(LMSD_MODEL_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(LMSD_MODEL_SHEET_NAME);
    sheet.getRange(1, 1, 1, 3).setValues([["Saved at", "LMSD Details JSON", "Line Coverage JSON"]]).setFontWeight("bold");
  }
  return sheet;
}

function getLmsdModel_() {
  const sheet = getLmsdModelSheet_();
  if (sheet.getLastRow() < 2) return null;
  const row = sheet.getLastRow();
  const detailsJson = sheet.getRange(row, 2).getValue();
  const coverageJson = sheet.getRange(row, 3).getValue();
  if (!detailsJson || !coverageJson) return null;
  try {
    return { lmsdDetails: JSON.parse(detailsJson), lineCoverage: JSON.parse(coverageJson) };
  } catch (e) {
    return null;
  }
}

function saveLmsdDetails_(lmsdDetails) {
  if (!lmsdDetails || !lmsdDetails.length) throw new Error("lmsdDetails must be a non-empty array.");
  const existing = getLmsdModel_();
  const lineCoverage = existing ? existing.lineCoverage : [];
  const sheet = getLmsdModelSheet_();
  if (sheet.getLastRow() > 1) sheet.deleteRows(2, sheet.getLastRow() - 1);
  sheet.getRange(2, 1, 1, 3).setValues([[new Date().toISOString(), JSON.stringify(lmsdDetails), JSON.stringify(lineCoverage)]]);
  return lmsdDetails;
}

function saveLineCoverage_(lineCoverage) {
  if (!lineCoverage || !lineCoverage.length) throw new Error("lineCoverage must be a non-empty array.");
  const existing = getLmsdModel_();
  const lmsdDetails = existing ? existing.lmsdDetails : [];
  const sheet = getLmsdModelSheet_();
  if (sheet.getLastRow() > 1) sheet.deleteRows(2, sheet.getLastRow() - 1);
  sheet.getRange(2, 1, 1, 3).setValues([[new Date().toISOString(), JSON.stringify(lmsdDetails), JSON.stringify(lineCoverage)]]);
  return lineCoverage;
}

function getGeometrySheet_() {
  const ss = getOrCreateSpreadsheet_();
  let sheet = ss.getSheetByName(GEOMETRY_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(GEOMETRY_SHEET_NAME);
    sheet.getRange(1, 1, 1, 2).setValues([["Saved at", "Geometry JSON"]]).setFontWeight("bold");
  }
  return sheet;
}

function getGeometry_() {
  const sheet = getGeometrySheet_();
  if (sheet.getLastRow() < 2) return null;
  const json = sheet.getRange(sheet.getLastRow(), 2).getValue();
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

function saveGeometry_(geometry) {
  if (!geometry || !geometry.subs || !geometry.lines) {
    throw new Error("Geometry must include both 'subs' and 'lines'.");
  }
  const sheet = getGeometrySheet_();
  // Keep just one row (the latest save) so the sheet doesn't grow forever.
  if (sheet.getLastRow() > 1) sheet.deleteRows(2, sheet.getLastRow() - 1);
  sheet.getRange(2, 1, 1, 2).setValues([[new Date().toISOString(), JSON.stringify(geometry)]]);
  return geometry;
}

// ---- App-wide small settings (division colour overrides, highlight
// level/width, trace highlight colour) \u2014 one JSON blob per field, same
// read-merge-write pattern as the LMSD model so saving one field never
// clobbers the others. All of these are small strings/numbers, so a single
// row comfortably stays under the per-cell character limit. ----
const APP_SETTINGS_SHEET_NAME = "AppSettings";
const APP_SETTINGS_DEFAULTS = { divisionColors: {}, highlightLevel: 24, highlightWidth: 2600, traceColor: "#ffcc00" };

function getAppSettingsSheet_() {
  const ss = getOrCreateSpreadsheet_();
  let sheet = ss.getSheetByName(APP_SETTINGS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(APP_SETTINGS_SHEET_NAME);
    sheet.getRange(1, 1, 1, 5).setValues([["Saved at", "Division Colors JSON", "Highlight Level", "Highlight Width (m)", "Trace Colour"]]).setFontWeight("bold");
  }
  return sheet;
}

function getAppSettings_() {
  const sheet = getAppSettingsSheet_();
  if (sheet.getLastRow() < 2) return { ...APP_SETTINGS_DEFAULTS };
  const row = sheet.getLastRow();
  const vals = sheet.getRange(row, 2, 1, 4).getValues()[0];
  let divisionColors = APP_SETTINGS_DEFAULTS.divisionColors;
  try { divisionColors = vals[0] ? JSON.parse(vals[0]) : {}; } catch (e) {}
  return {
    divisionColors,
    highlightLevel: vals[1] || APP_SETTINGS_DEFAULTS.highlightLevel,
    highlightWidth: vals[2] || APP_SETTINGS_DEFAULTS.highlightWidth,
    traceColor: vals[3] || APP_SETTINGS_DEFAULTS.traceColor
  };
}

function writeAppSettings_(settings) {
  const sheet = getAppSettingsSheet_();
  if (sheet.getLastRow() > 1) sheet.deleteRows(2, sheet.getLastRow() - 1);
  sheet.getRange(2, 1, 1, 5).setValues([[
    new Date().toISOString(),
    JSON.stringify(settings.divisionColors || {}),
    settings.highlightLevel || APP_SETTINGS_DEFAULTS.highlightLevel,
    settings.highlightWidth || APP_SETTINGS_DEFAULTS.highlightWidth,
    settings.traceColor || APP_SETTINGS_DEFAULTS.traceColor
  ]]);
  return settings;
}

function saveDivisionColors_(divisionColors) {
  if (!divisionColors || typeof divisionColors !== "object") throw new Error("divisionColors must be an object.");
  const current = getAppSettings_();
  const next = { ...current, divisionColors };
  return writeAppSettings_(next);
}

function saveHighlight_(highlightLevel, highlightWidth) {
  const current = getAppSettings_();
  const next = { ...current };
  if (highlightLevel !== undefined && highlightLevel !== null) next.highlightLevel = highlightLevel;
  if (highlightWidth !== undefined && highlightWidth !== null) next.highlightWidth = highlightWidth;
  return writeAppSettings_(next);
}

function saveTraceColor_(traceColor) {
  if (!traceColor) throw new Error("traceColor is required.");
  const current = getAppSettings_();
  const next = { ...current, traceColor };
  return writeAppSettings_(next);
}

// ---- Weather background photos, per substation. Each photo is stored as a
// row-group: one row per ~40,000-char chunk (Sheets cells cap at 50,000
// chars, and compressed phone photos can exceed that as one blob), all
// sharing a photoId so they can be reassembled in order. This also makes
// deletes safe across devices (delete by photoId, not by array index, which
// could point at different photos on different devices). ----
const WEATHER_BG_SHEET_NAME = "WeatherBg";
const WEATHER_BG_CHUNK_SIZE = 40000;

function getWeatherBgSheet_() {
  const ss = getOrCreateSpreadsheet_();
  let sheet = ss.getSheetByName(WEATHER_BG_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(WEATHER_BG_SHEET_NAME);
    sheet.getRange(1, 1, 1, 5).setValues([["Substation Key", "Photo ID", "Chunk Index", "Chunk Text", "Saved at"]]).setFontWeight("bold");
  }
  return sheet;
}

function getWeatherBg_() {
  const sheet = getWeatherBgSheet_();
  if (sheet.getLastRow() < 2) return {};
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  // photoGroups: subKey -> photoId -> { chunks: {idx: text}, savedAt }
  const photoGroups = {};
  rows.forEach((r) => {
    const [subKey, photoId, chunkIdx, chunkText, savedAt] = r;
    if (!subKey || !photoId) return;
    photoGroups[subKey] = photoGroups[subKey] || {};
    photoGroups[subKey][photoId] = photoGroups[subKey][photoId] || { chunks: {}, savedAt };
    photoGroups[subKey][photoId].chunks[chunkIdx] = chunkText;
    photoGroups[subKey][photoId].savedAt = savedAt;
  });
  const store = {};
  Object.entries(photoGroups).forEach(([subKey, photos]) => {
    const list = Object.entries(photos).map(([photoId, p]) => {
      const chunkIndices = Object.keys(p.chunks).map(Number).sort((a, b) => a - b);
      const dataUrl = chunkIndices.map((i) => p.chunks[i]).join("");
      return { id: photoId, dataUrl, savedAt: p.savedAt };
    });
    list.sort((a, b) => String(a.savedAt).localeCompare(String(b.savedAt)));
    store[subKey] = list.map(({ id, dataUrl }) => ({ id, dataUrl }));
  });
  return store;
}

function addWeatherPhoto_(subKey, dataUrl) {
  if (!subKey || !dataUrl) throw new Error("subKey and dataUrl are required.");
  const sheet = getWeatherBgSheet_();
  const photoId = "p" + Date.now() + "_" + Math.floor(Math.random() * 1e6);
  const savedAt = new Date().toISOString();
  const rows = [];
  for (let i = 0; i < dataUrl.length; i += WEATHER_BG_CHUNK_SIZE) {
    rows.push([subKey, photoId, rows.length, dataUrl.slice(i, i + WEATHER_BG_CHUNK_SIZE), savedAt]);
  }
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 5).setValues(rows);
  return { id: photoId, subKey };
}

function removeWeatherPhoto_(subKey, photoId) {
  if (!subKey || !photoId) throw new Error("subKey and photoId are required.");
  const sheet = getWeatherBgSheet_();
  if (sheet.getLastRow() < 2) return { removed: 0 };
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  let removed = 0;
  // Delete bottom-up so row indices don't shift under us mid-loop.
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i][0] === subKey && String(rows[i][1]) === String(photoId)) {
      sheet.deleteRow(i + 2);
      removed++;
    }
  }
  return { removed };
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  // Note: if you click "Run" on this function directly in the Apps Script
  // editor, `e` is undefined (there's no real web request) — that's the
  // "Cannot read properties of undefined (reading 'parameter')" error.
  // This is expected; test the deployed .../exec URL in a browser instead.
  const params = (e && e.parameter) || {};
  const action = (params.action || "getData").toLowerCase();
  try {
    if (action === "init") {
      const url = INIT_();
      return jsonOut_({ ok: true, message: "Initialized", sheetUrl: url });
    }
    if (action === "getdata") {
      return jsonOut_({ ok: true, lines: getAllData_() });
    }
    if (action === "getgeometry") {
      return jsonOut_({ ok: true, geometry: getGeometry_() });
    }
    if (action === "getlmsdmodel") {
      const model = getLmsdModel_();
      return jsonOut_({ ok: true, lmsdDetails: model ? model.lmsdDetails : [], lineCoverage: model ? model.lineCoverage : [] });
    }
    if (action === "getappsettings") {
      return jsonOut_({ ok: true, settings: getAppSettings_() });
    }
    if (action === "getweatherbg") {
      return jsonOut_({ ok: true, store: getWeatherBg_() });
    }
    return jsonOut_({ ok: false, error: "Unknown action: " + action });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData) {
      return jsonOut_({ ok: false, error: "No request body \u2014 doPost must be called via the deployed web app URL, not run manually." });
    }
    const body = JSON.parse(e.postData.contents);
    const action = (body.action || "").toLowerCase();
    if (action === "saveteams") {
      const result = saveTeamsForLine_(body.line, body.teams);
      return jsonOut_({ ok: true, line: result });
    }
    if (action === "savegeometry") {
      const result = saveGeometry_(body.geometry);
      return jsonOut_({ ok: true, geometry: result });
    }
    if (action === "savelmsddetails") {
      const result = saveLmsdDetails_(body.lmsdDetails);
      return jsonOut_({ ok: true, lmsdDetails: result });
    }
    if (action === "savelinecoverage") {
      const result = saveLineCoverage_(body.lineCoverage);
      return jsonOut_({ ok: true, lineCoverage: result });
    }
    if (action === "savedivisioncolors") {
      const result = saveDivisionColors_(body.divisionColors);
      return jsonOut_({ ok: true, settings: result });
    }
    if (action === "savehighlight") {
      const result = saveHighlight_(body.highlightLevel, body.highlightWidth);
      return jsonOut_({ ok: true, settings: result });
    }
    if (action === "savetracecolor") {
      const result = saveTraceColor_(body.traceColor);
      return jsonOut_({ ok: true, settings: result });
    }
    if (action === "addweatherphoto") {
      const result = addWeatherPhoto_(body.subKey, body.dataUrl);
      return jsonOut_({ ok: true, photo: result });
    }
    if (action === "removeweatherphoto") {
      const result = removeWeatherPhoto_(body.subKey, body.photoId);
      return jsonOut_({ ok: true, result });
    }
    return jsonOut_({ ok: false, error: "Unknown action: " + action });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  }
}
