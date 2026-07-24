/***
 * Folder Scanner WebApp (Multi-spreadsheet, first-level only)
 *
 * ✅ FIXED VERSION - Removed LockService completely
 *
 * GET  ?action=list&token=YOUR_TOKEN[&status=all|torun|completed]
 * POST ?action=done&token=YOUR_TOKEN
 *      body: {"spreadsheetId":"<id>","sheetName":"C new","row":25}
 * POST ?action=setRemarks&token=YOUR_TOKEN
 *      body: {"spreadsheetId":"<id>","sheetName":"C new","row":25,"remarks":"Completed"|"To run"}
 *
 * Output item fields:
 * spreadsheetId, spreadsheetName, projectName, sheetName, rowNumber, buswayNo, lot, description, stockCode, remarks, quantity(optional)
 */

// ====================== CONFIG (fill these) ======================
const CONFIG = {
  // TODO 1) Put your Drive Folder ID here
  FOLDER_ID: "YOUR_DRIVE_FOLDER_ID",

  // TODO 2) Set your token here (used in URL query parameter token=...)
  TOKEN: "YOUR_API_TOKEN",

  // Header names (must match sheet header display text)
  H_DESCRIPTION: "Description",
  H_REMARKS: "REMARKS",
  H_BUSWAY: "Busway No",
  H_LOT: "Lot",

  HEADER_SCAN_ROWS: 25,
  HEADER_LOOK_AROUND: 2,

  // compare normalized (lowercase + collapse spaces)
  REMARKS_TORUN_NORM: "to run",
  REMARKS_DONE_NORM: "completed",

  // write values (exactly what you want in sheet)
  REMARKS_DONE_WRITE: "Completed",
  REMARKS_TORUN_WRITE: "To run",

  // StockCode columns: C-F-H-L (0-based)
  STOCKCODE_COLS_0BASED: [2, 5, 7, 11],
  // Special fallback mode when To run + busway empty
  STOCKCODE_COL_C_0BASED: 2, // C
  DESC_COL_M_0BASED: 12, // M
  QTY_COL_N_0BASED: 13, // N

  // TODO 3) ProjectName cell A1 (if your project is in C5, change to "C5")
  PROJECT_CELL_A1: "A4",
  PROJECT_FALLBACK: "Unknown Project",

  // App update config for in-app update prompt
  APP_UPDATE: {
    latestVersion: "1.0.1",
    latestVersionCode: 2,
    minSupportedVersionCode: 1,
    forceUpdate: false,
    apkUrl: "",
    changelog: "",
  },
};

// ====================== WebApp entry ======================
function doGet(e) {
  return handle_(e);
}

function doPost(e) {
  return handle_(e);
}

function handle_(e) {
  try {
    const p = e && e.parameter ? e.parameter : {};

    // Auth token in query
    if (String(p.token || "") !== CONFIG.TOKEN) {
      return json_({ ok: false, error: "Unauthorized" });
    }

    const action = String(p.action || "list").trim();

    // status: all | torun | completed  (default all)
    const status = normalizeForCompare_(p.status || "all");
    const statusMode = normalizeStatusMode_(status);

    if (action === "list") {
      const result = listAllFromFolder_(statusMode);
      result.version = "no-lock-v1"; // ✅ Version identifier
      return json_(result);
    }

    // ✅ Add version check endpoint
    if (action === "version") {
      return json_({
        ok: true,
        version: "no-lock-v1",
        lockServiceRemoved: true,
      });
    }

    if (action === "appConfig") {
      return json_({
        ok: true,
        ...CONFIG.APP_UPDATE,
        serverTime: new Date().toISOString(),
      });
    }

    // ✅ Add folder test endpoint
    if (action === "testFolder") {
      try {
        const folder = DriveApp.getFolderById(CONFIG.FOLDER_ID);
        const name = folder.getName();
        const files = folder.getFilesByType(MimeType.GOOGLE_SHEETS);
        let totalSheetCount = 0;
        const fileNames = [];

        while (files.hasNext()) {
          const file = files.next();
          totalSheetCount++;
          if (fileNames.length < 10) {
            fileNames.push(file.getName());
          }
        }

        return json_({
          ok: true,
          folderId: CONFIG.FOLDER_ID,
          folderName: name,
          sheetCount: totalSheetCount, // backward-compatible
          totalSheetCount,
          sampleCount: fileNames.length,
          sampleFiles: fileNames,
          message: "Folder access successful",
        });
      } catch (error) {
        return json_({
          ok: false,
          folderId: CONFIG.FOLDER_ID,
          error: String(error),
          errorType: error.name || "Unknown",
          message: "Cannot access folder - check folder ID and permissions",
        });
      }
    }

    // ✅ Add test endpoint to check spreadsheet access
    if (action === "testAccess") {
      const spreadsheetId = p.spreadsheetId || "";
      if (!spreadsheetId) {
        return json_({ ok: false, error: "Missing spreadsheetId parameter" });
      }

      try {
        const ss = SpreadsheetApp.openById(spreadsheetId);
        const name = ss.getName();
        const sheets = ss.getSheets().map((s) => s.getName());
        return json_({
          ok: true,
          spreadsheetId: spreadsheetId,
          spreadsheetName: name,
          sheetCount: sheets.length,
          sheetNames: sheets,
          message: "Access granted - spreadsheet can be opened",
        });
      } catch (error) {
        return json_({
          ok: false,
          error: String(error),
          spreadsheetId: spreadsheetId,
          message: "Cannot access spreadsheet - check permissions",
        });
      }
    }

    if (action === "done") {
      const body = parseBody_(e);
      const spreadsheetId = clean_(body.spreadsheetId);
      const sheetName = clean_(body.sheetName);
      const row = Number(body.row);

      if (!spreadsheetId)
        return json_({ ok: false, error: "Missing spreadsheetId" });
      if (!sheetName) return json_({ ok: false, error: "Missing sheetName" });
      if (!row || row < 2) return json_({ ok: false, error: "Invalid row" });

      return json_(
        setRemarksInSpreadsheet_(
          spreadsheetId,
          sheetName,
          row,
          CONFIG.REMARKS_DONE_WRITE,
        ),
      );
    }

    if (action === "setRemarks") {
      const body = parseBody_(e);
      const spreadsheetId = clean_(body.spreadsheetId);
      const sheetName = clean_(body.sheetName);
      const row = Number(body.row);
      const remarksRaw = clean_(body.remarks);

      if (!spreadsheetId)
        return json_({ ok: false, error: "Missing spreadsheetId" });
      if (!sheetName) return json_({ ok: false, error: "Missing sheetName" });
      if (!row || row < 2) return json_({ ok: false, error: "Invalid row" });
      if (!remarksRaw) return json_({ ok: false, error: "Missing remarks" });

      const normalizedWrite = normalizeRemarksWrite_(remarksRaw);
      if (!normalizedWrite) {
        return json_({
          ok: false,
          error: `Invalid remarks. Use "${CONFIG.REMARKS_DONE_WRITE}" or "${CONFIG.REMARKS_TORUN_WRITE}"`,
          got: remarksRaw,
        });
      }

      return json_(
        setRemarksInSpreadsheet_(
          spreadsheetId,
          sheetName,
          row,
          normalizedWrite,
        ),
      );
    }

    if (action === "setRemarksBatchRows") {
      const body = parseBody_(e);
      const spreadsheetId = clean_(body.spreadsheetId);
      const sheetName = clean_(body.sheetName);
      const remarksRaw = clean_(body.remarks);
      const rowNumbersRaw = Array.isArray(body.rowNumbers)
        ? body.rowNumbers
        : [];

      if (!spreadsheetId)
        return json_({ ok: false, error: "Missing spreadsheetId" });
      if (!sheetName) return json_({ ok: false, error: "Missing sheetName" });
      if (!remarksRaw) return json_({ ok: false, error: "Missing remarks" });
      if (!rowNumbersRaw.length)
        return json_({ ok: false, error: "Missing rowNumbers" });

      const normalizedWrite = normalizeRemarksWrite_(remarksRaw);
      if (!normalizedWrite) {
        return json_({
          ok: false,
          error: `Invalid remarks. Use "${CONFIG.REMARKS_DONE_WRITE}" or "${CONFIG.REMARKS_TORUN_WRITE}"`,
          got: remarksRaw,
        });
      }

      const rowNumbers = rowNumbersRaw
        .map((v) => Number(v))
        .filter((v) => Number.isInteger(v) && v >= 2);
      if (!rowNumbers.length)
        return json_({ ok: false, error: "Invalid rowNumbers" });

      return json_(
        setRemarksBatchRowsInSpreadsheet_(
          spreadsheetId,
          sheetName,
          rowNumbers,
          normalizedWrite,
        ),
      );
    }

    return json_({ ok: false, error: "Unknown action" });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// ====================== Folder scan (adds spreadsheetId to each item) ======================
function listAllFromFolder_(statusMode) {
  const folder = DriveApp.getFolderById(CONFIG.FOLDER_ID);
  const files = folder.getFilesByType(MimeType.GOOGLE_SHEETS);

  const items = [];
  let total = 0;

  while (files.hasNext()) {
    const f = files.next();
    const spreadsheetId = f.getId();
    const spreadsheetName = f.getName(); // ✅ quick identify (optional)

    const one = listAllFromSpreadsheet_(
      spreadsheetId,
      spreadsheetName,
      statusMode,
    );
    total += one.total;
    if (one.items.length) items.push(...one.items);
  }

  return { ok: true, status: statusMode, total, items };
}

// spreadsheetName passed in to avoid extra open for name
function listAllFromSpreadsheet_(spreadsheetId, spreadsheetName, statusMode) {
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sheets = ss.getSheets();

  const items = [];
  let total = 0;

  for (let i = 0; i < sheets.length; i++) {
    const sh = sheets[i];
    const projectName = readProjectName_(sh);
    const one = listOne_(sh, statusMode, projectName);
    total += one.total;

    if (one.items.length) {
      // ✅ add spreadsheetId (+ name) into each item for fast locate in future writeback
      for (const it of one.items) {
        it.spreadsheetId = spreadsheetId;
        it.spreadsheetName = spreadsheetName; // optional, remove if you don't want
      }
      items.push(...one.items);
    }
  }

  return { total, items };
}

// ====================== Core scan per sheet ======================
function listOne_(sh, statusMode, projectName) {
  const sheetName = clean_(sh.getName()); // ✅ 去除 Sheet 名称的前后空格
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();

  if (lastRow < 3 || lastCol < 1) return { sheetName, items: [], total: 0 };

  const values = sh.getRange(1, 1, lastRow, lastCol).getValues();

  let header;
  try {
    header = detectHeaderBlockByRemarks_(values);
  } catch (_) {
    // no header -> skip
    return { sheetName, items: [], total: 0 };
  }

  const dataStart = header.r0 + 2;
  const idx = locateCols_(values, header);

  const out = [];
  let count = 0;

  for (let r = dataStart; r < values.length; r++) {
    const row = values[r];
    const remarksRaw = idx.remarks >= 0 ? clean_(row[idx.remarks]) : "";
    const remarksNorm = normalizeForCompare_(remarksRaw);

    // allow only To run / Completed
    if (
      remarksNorm !== CONFIG.REMARKS_TORUN_NORM &&
      remarksNorm !== CONFIG.REMARKS_DONE_NORM
    )
      continue;

    // status filter
    if (statusMode === "torun" && remarksNorm !== CONFIG.REMARKS_TORUN_NORM)
      continue;
    if (statusMode === "completed" && remarksNorm !== CONFIG.REMARKS_DONE_NORM)
      continue;

    const lot = idx.lot >= 0 ? clean_(row[idx.lot]) : "";
    const buswayNo = idx.busway >= 0 ? clean_(row[idx.busway]) : "";

    // Special fallback:
    // To run + empty busway => use C as stock code, M as description,
    // and if description matches target keywords then read N as quantity.
    if (!buswayNo) {
      // status filtering already happened above (torun/completed/all),
      // so keep special rows for both To run and Completed.

      const stockCodeRaw = clean_(row[CONFIG.STOCKCODE_COL_C_0BASED]);
      const stockCodeC = extractStockCodePrefix_(stockCodeRaw);
      if (!stockCodeC) continue;

      const descM = clean_(row[CONFIG.DESC_COL_M_0BASED]);
      if (!containsSpecialDesc_(descM)) continue;

      const quantity = parseQuantity_(row[CONFIG.QTY_COL_N_0BASED]);
      if (quantity === null) continue;

      count++;
      out.push({
        projectName,
        sheetName,
        rowNumber: r + 1,
        buswayNo: "",
        lot,
        description: descM,
        stockCode: stockCodeC,
        remarks: remarksRaw,
        quantity,
      });
      continue;
    }

    count++;
    out.push({
      projectName,
      sheetName,
      rowNumber: r + 1,
      buswayNo,
      lot,
      description: idx.desc >= 0 ? clean_(row[idx.desc]) : "",
      stockCode: buildStockCode_(row),
      remarks: remarksRaw,
    });
  }

  return { sheetName, items: out, total: count };
}

// ====================== Write (requires spreadsheetId) ======================
// ✅ COMPLETELY REMOVED LOCKSERVICE - This was causing the null error
function setRemarksInSpreadsheet_(
  spreadsheetId,
  sheetName,
  rowNumber,
  remarksValue,
) {
  const ss = SpreadsheetApp.openById(spreadsheetId);

  // ✅ 清理 Sheet 名称（去除前后空格）
  const cleanSheetName = clean_(sheetName);

  // ✅ 使用清理后的名称查找，但也尝试原始名称
  let sh = ss.getSheetByName(cleanSheetName);
  if (!sh) {
    sh = ss.getSheetByName(sheetName); // 尝试原始名称
  }

  if (!sh) {
    // ✅ 提供更详细的错误信息
    const allSheets = ss.getSheets();
    const allSheetNames = allSheets.map((s) => clean_(s.getName()));
    throw new Error(
      "Sheet not found: " +
        cleanSheetName +
        ". Available sheets: " +
        allSheetNames.join(", "),
    );
  }

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();

  if (rowNumber > lastRow) {
    return {
      ok: false,
      error: `Row out of range. row=${rowNumber}, lastRow=${lastRow}`,
    };
  }

  const scanRows = Math.min(CONFIG.HEADER_SCAN_ROWS + 10, lastRow);
  const values = sh.getRange(1, 1, scanRows, lastCol).getValues();
  const header = detectHeaderBlockByRemarks_(values);
  const idx = locateCols_(values, header);

  sh.getRange(rowNumber, idx.remarks + 1).setValue(remarksValue);

  return {
    ok: true,
    spreadsheetId,
    sheetName,
    rowNumber,
    remarks: remarksValue,
  };
}

function setRemarksBatchRowsInSpreadsheet_(
  spreadsheetId,
  sheetName,
  rowNumbers,
  remarksValue,
) {
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const cleanSheetName = clean_(sheetName);

  let sh = ss.getSheetByName(cleanSheetName);
  if (!sh) {
    sh = ss.getSheetByName(sheetName);
  }
  if (!sh) {
    throw new Error("Sheet not found: " + cleanSheetName);
  }

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  const scanRows = Math.min(CONFIG.HEADER_SCAN_ROWS + 10, lastRow);
  const values = sh.getRange(1, 1, scanRows, lastCol).getValues();
  const header = detectHeaderBlockByRemarks_(values);
  const idx = locateCols_(values, header);

  const validRows = [...new Set(rowNumbers)].filter(
    (r) => Number.isInteger(r) && r >= 2 && r <= lastRow,
  );
  if (!validRows.length) {
    return { ok: false, error: "No valid rows in rowNumbers" };
  }

  const a1s = validRows.map((row) => columnToA1_(idx.remarks + 1) + row);
  sh.getRangeList(a1s).setValue(remarksValue);

  return {
    ok: true,
    spreadsheetId,
    sheetName,
    remarks: remarksValue,
    updatedRows: validRows,
    updatedCount: validRows.length,
  };
}

// ====================== Helpers ======================
function parseBody_(e) {
  try {
    return e && e.postData && e.postData.contents
      ? JSON.parse(e.postData.contents)
      : {};
  } catch {
    return {};
  }
}

/** for list / param compare: lower + collapse spaces */
function normalizeForCompare_(v) {
  const s = clean_(v).toLowerCase();
  return s.replace(/\s+/g, " ").trim();
}

/** status -> fixed mode */
function normalizeStatusMode_(statusNorm) {
  if (!statusNorm || statusNorm === "all") return "all";
  if (statusNorm === "torun" || statusNorm === CONFIG.REMARKS_TORUN_NORM)
    return "torun";
  if (statusNorm === CONFIG.REMARKS_DONE_NORM) return "completed";
  return "all";
}

/**
 * write value normalize:
 * Accept: Completed / done / To run (case-insensitive)
 * Return exact write: "Completed" or "To run"
 */
function normalizeRemarksWrite_(v) {
  const s = normalizeForCompare_(v);
  if (!s) return "";
  if (s === "completed" || s === "done") return CONFIG.REMARKS_DONE_WRITE;
  if (s === "to run") return CONFIG.REMARKS_TORUN_WRITE;
  return "";
}

/** Project Name cleanup */
function extractProjectName_(raw) {
  const s = String(raw ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return "";

  const m = s.match(/^\s*project\s*name\s*[:：]\s*(.+)$/i);
  if (m && m[1]) return m[1].trim();

  const idx = s.search(/[:：]/);
  if (idx >= 0) return s.slice(idx + 1).trim();

  return s;
}

function readProjectName_(sh) {
  try {
    const raw = sh.getRange(CONFIG.PROJECT_CELL_A1).getDisplayValue();
    const name = extractProjectName_(raw);
    return name || CONFIG.PROJECT_FALLBACK;
  } catch (_) {
    return CONFIG.PROJECT_FALLBACK;
  }
}

/** StockCode: join C-F-H-L */
function buildStockCode_(row) {
  const parts = CONFIG.STOCKCODE_COLS_0BASED.map((i) => clean_(row[i]));
  return parts.join("-");
}

function containsSpecialDesc_(desc) {
  const s = normalizeForCompare_(desc);
  if (!s) return false;
  return (
    s.includes("mounting") ||
    s.includes("plug-in box") ||
    s.includes("bolt-on box")
  );
}

function parseQuantity_(v) {
  const s = clean_(v);
  if (!s) return null;
  const normalized = s.replace(/,/g, "");
  const matched = normalized.match(/-?\d+(\.\d+)?/);
  if (!matched) return null;
  const n = Number(matched[0]);
  return Number.isFinite(n) ? n : null;
}

function extractStockCodePrefix_(raw) {
  const s = clean_(raw);
  if (!s) return "";
  const prefixPart = s.split("-")[0] || "";
  const letters = prefixPart.match(/[A-Za-z]+/g);
  return letters ? letters.join("").toUpperCase() : "";
}

/** Detect 2-row header block: union(row r, r+1) contains REMARKS */
function detectHeaderBlockByRemarks_(values) {
  const maxScan = Math.min(CONFIG.HEADER_SCAN_ROWS, values.length - 1);
  const need = clean_(CONFIG.H_REMARKS);

  for (let r = 0; r < maxScan; r++) {
    const a = values[r].map(clean_);
    const b = values[r + 1].map(clean_);
    const union = new Set([...a, ...b]);
    if (union.has(need)) return { r0: r, rowA: values[r], rowB: values[r + 1] };
  }

  throw new Error("Header block with REMARKS not found");
}

function locateCols_(values, header) {
  const rowA = header.rowA.map(clean_);
  const rowB = header.rowB.map(clean_);

  const mustInBlock = (name) => {
    const t = clean_(name);
    let i = rowA.indexOf(t);
    if (i >= 0) return i;
    i = rowB.indexOf(t);
    if (i >= 0) return i;
    throw new Error("Missing required header in block: " + name);
  };

  const resolve = (name) => {
    const t = clean_(name);
    let i = rowA.indexOf(t);
    if (i >= 0) return i;
    i = rowB.indexOf(t);
    if (i >= 0) return i;

    const start = Math.max(0, header.r0 - CONFIG.HEADER_LOOK_AROUND);
    const end = Math.min(
      values.length - 1,
      header.r0 + 1 + CONFIG.HEADER_LOOK_AROUND,
    );
    for (let r = start; r <= end; r++) {
      const c = (values[r] || []).map(clean_).indexOf(t);
      if (c >= 0) return c;
    }

    const maxScan = Math.min(CONFIG.HEADER_SCAN_ROWS + 10, values.length);
    for (let r = 0; r < maxScan; r++) {
      const c = (values[r] || []).map(clean_).indexOf(t);
      if (c >= 0) return c;
    }

    return -1;
  };

  return {
    remarks: mustInBlock(CONFIG.H_REMARKS),
    busway: resolve(CONFIG.H_BUSWAY),
    lot: resolve(CONFIG.H_LOT),
    desc: resolve(CONFIG.H_DESCRIPTION),
  };
}

function clean_(v) {
  return String(v ?? "")
    .replace(/\u00A0/g, " ") // 替换不间断空格
    .replace(/\r?\n/g, " ") // 替换换行符
    .trim(); // 去除前后空格
}

function columnToA1_(colIndex1Based) {
  let n = Number(colIndex1Based);
  let result = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
