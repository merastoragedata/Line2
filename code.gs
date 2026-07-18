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

function INIT_() {
  const ss = getOrCreateSpreadsheet_();

  // Remove default blank sheet if present and unused
  const defaultSheet = ss.getSheetByName("Sheet1");

  SEED_LINES.forEach((lineObj) => {
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
  });

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
  const sheet = ss.getSheetByName(tabName);
  if (!sheet) throw new Error("Line not found: " + lineName);

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
    return jsonOut_({ ok: false, error: "Unknown action: " + action });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  }
}
