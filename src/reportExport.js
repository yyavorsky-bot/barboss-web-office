export function getDownloadFileName(response, fallbackName) {
  const disposition = response.headers.get("Content-Disposition") || "";

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const simpleMatch = disposition.match(/filename="?([^";]+)"?/i);
  return simpleMatch?.[1] || fallbackName;
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

let exportBusyDepth = 0;
let exportBusyOverlay = null;
let exportBusyStyle = null;

function showExportBusy(format) {
  if (typeof document === "undefined") {
    return;
  }

  exportBusyDepth += 1;

  if (exportBusyOverlay) {
    return;
  }

  if (!exportBusyStyle) {
    exportBusyStyle = document.createElement("style");
    exportBusyStyle.dataset.barbossExportBusy = "1";
    exportBusyStyle.textContent = `
      @keyframes barboss-export-spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(exportBusyStyle);
  }

  const overlay = document.createElement("div");
  overlay.dataset.barbossExportBusy = "1";
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "polite");

  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483647",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255, 255, 255, 0.32)",
    cursor: "wait"
  });

  const panel = document.createElement("div");
  Object.assign(panel.style, {
    minWidth: "94px",
    padding: "14px 18px",
    borderRadius: "12px",
    background: "rgba(255, 255, 255, 0.96)",
    boxShadow: "0 8px 28px rgba(0, 0, 0, 0.18)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "9px",
    fontFamily: "Arial, sans-serif",
    fontSize: "12px",
    fontWeight: "700",
    color: "#315f5a"
  });

  const spinner = document.createElement("div");
  Object.assign(spinner.style, {
    width: "30px",
    height: "30px",
    boxSizing: "border-box",
    border: "3px solid rgba(49, 95, 90, 0.22)",
    borderTopColor: "#315f5a",
    borderRadius: "50%",
    animation: "barboss-export-spin 0.75s linear infinite"
  });

  const label = document.createElement("div");
  label.textContent = format === "docx" ? "WORD…" : "EXCEL…";

  panel.appendChild(spinner);
  panel.appendChild(label);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  exportBusyOverlay = overlay;
}

function hideExportBusy() {
  if (typeof document === "undefined") {
    return;
  }

  exportBusyDepth = Math.max(0, exportBusyDepth - 1);

  if (exportBusyDepth > 0) {
    return;
  }

  exportBusyOverlay?.remove();
  exportBusyOverlay = null;
}

export async function exportReportFile({
  fetchWithAuth,
  reportModel,
  format,
  errorMessage = "Ошибка экспорта отчёта."
}) {
  if (!fetchWithAuth || !reportModel) {
    throw new Error(errorMessage);
  }

  const safeFormat = String(format || "").toLowerCase();

  if (safeFormat !== "xlsx" && safeFormat !== "docx") {
    throw new Error(errorMessage);
  }

  const body = new URLSearchParams();
  body.set("Format", safeFormat);
  body.set("Report", JSON.stringify(reportModel));

  showExportBusy(safeFormat);

  try {
    const response = await fetchWithAuth(
      "https://webback.bar-boss.com/wr_Export.php",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
        },
        body
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      let errorData = null;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        // Сервер мог вернуть обычный текст ошибки.
      }

      throw new Error(
        errorData?.error ||
          errorData?.message ||
          errorText ||
          errorMessage
      );
    }

    const blob = await response.blob();
    const fallbackFileName =
      `${reportModel.fileName || "report"}.${safeFormat}`;

    downloadBlob(
      blob,
      getDownloadFileName(response, fallbackFileName)
    );
  } finally {
    hideExportBusy();
  }
}
const UTF8_ENCODER = new TextEncoder();

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function numericValue(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function sumField(rows, field) {
  return rows.reduce((sum, row) => sum + numericValue(row?.[field]), 0);
}

function formatReportDate(value) {
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : text;
}

function createMoneyFormatter(locale) {
  try {
    return new Intl.NumberFormat(locale || "ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  } catch {
    return new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
}

function formatTableMoney(value, formatter) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const number = Number(value);
  if (!Number.isFinite(number) || number === 0) {
    return "";
  }

  return formatter.format(number);
}

function safeFilePart(value) {
  return String(value ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function revenueFileBase(dateFrom, dateTo, organizationName) {
  const from = safeFilePart(dateFrom) || "from";
  const to = safeFilePart(dateTo) || "to";
  const org = safeFilePart(organizationName || "Все") || "Все";
  return `Revenue_${from}_${to}_${org}`;
}

function downloadBytes(bytes, mimeType, fileName) {
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function uint16(value) {
  return [value & 0xff, (value >>> 8) & 0xff];
}

function uint32(value) {
  return [
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff
  ];
}

let crcTable = null;

function getCrcTable() {
  if (crcTable) {
    return crcTable;
  }

  crcTable = new Uint32Array(256);

  for (let i = 0; i < 256; i += 1) {
    let crc = i;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) !== 0 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }

    crcTable[i] = crc >>> 0;
  }

  return crcTable;
}

function crc32(bytes) {
  const table = getCrcTable();
  let crc = 0xffffffff;

  for (let i = 0; i < bytes.length; i += 1) {
    crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function concatUint8(parts) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;

  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }

  return result;
}

function toBytes(value) {
  return value instanceof Uint8Array ? value : UTF8_ENCODER.encode(String(value));
}

function createStoredZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  files.forEach((file) => {
    const nameBytes = UTF8_ENCODER.encode(file.name);
    const dataBytes = toBytes(file.data);
    const crc = crc32(dataBytes);
    const flags = 0x0800;

    const localHeader = new Uint8Array([
      ...uint32(0x04034b50),
      ...uint16(20),
      ...uint16(flags),
      ...uint16(0),
      ...uint16(0),
      ...uint16(0),
      ...uint32(crc),
      ...uint32(dataBytes.length),
      ...uint32(dataBytes.length),
      ...uint16(nameBytes.length),
      ...uint16(0)
    ]);

    localParts.push(localHeader, nameBytes, dataBytes);

    const centralHeader = new Uint8Array([
      ...uint32(0x02014b50),
      ...uint16(20),
      ...uint16(20),
      ...uint16(flags),
      ...uint16(0),
      ...uint16(0),
      ...uint16(0),
      ...uint32(crc),
      ...uint32(dataBytes.length),
      ...uint32(dataBytes.length),
      ...uint16(nameBytes.length),
      ...uint16(0),
      ...uint16(0),
      ...uint16(0),
      ...uint16(0),
      ...uint32(0),
      ...uint32(offset)
    ]);

    centralParts.push(centralHeader, nameBytes);
    offset += localHeader.length + nameBytes.length + dataBytes.length;
  });

  const localData = concatUint8(localParts);
  const centralData = concatUint8(centralParts);
  const endRecord = new Uint8Array([
    ...uint32(0x06054b50),
    ...uint16(0),
    ...uint16(0),
    ...uint16(files.length),
    ...uint16(files.length),
    ...uint32(centralData.length),
    ...uint32(localData.length),
    ...uint16(0)
  ]);

  return concatUint8([localData, centralData, endRecord]);
}

function columnLetter(index) {
  let value = index + 1;
  let result = "";

  while (value > 0) {
    const rem = (value - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    value = Math.floor((value - 1) / 26);
  }

  return result;
}

function xlsxInlineCell(ref, value, style = 0) {
  return `<c r="${ref}" t="inlineStr"${style ? ` s="${style}"` : ""}><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function xlsxNumberCell(ref, value, style = 2) {
  const number = numericValue(value);
  return `<c r="${ref}"${style ? ` s="${style}"` : ""}><v>${number}</v></c>`;
}

function xlsxBlankCell(ref, style = 0) {
  return `<c r="${ref}"${style ? ` s="${style}"` : ""}/>`;
}

function makeSheetXml({ rows, merges = [], cols = "", freezeRow = 0, landscape = false }) {
  const mergeXml = merges.length
    ? `<mergeCells count="${merges.length}">${merges.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>`
    : "";

  const freezeXml = freezeRow > 0
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${freezeRow}" topLeftCell="A${freezeRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    : `<sheetViews><sheetView workbookViewId="0"/></sheetViews>`;

  const pageXml = landscape
    ? `<pageMargins left="0.25" right="0.25" top="0.35" bottom="0.35" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>`
    : `<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
${freezeXml}
<sheetFormatPr defaultRowHeight="15"/>
${cols}
<sheetData>${rows.join("")}</sheetData>
${mergeXml}
${pageXml}
</worksheet>`;
}

function mainSheetRows({ mainColumns, mainRows, dateFrom, dateTo, organizationName }) {
  const rows = [];
  const lastCol = columnLetter(mainColumns.length - 1);
  const title = `Оплата по официантам с ${formatReportDate(dateFrom)} по ${formatReportDate(dateTo)}`;
  const org = `*** ${organizationName || "Все"}`;

  rows.push(`<row r="1" ht="21" customHeight="1">${xlsxInlineCell("A1", title, 4)}</row>`);
  rows.push(`<row r="2">${xlsxInlineCell("A2", org, 5)}</row>`);

  const headerCells = mainColumns.map((column, index) =>
    xlsxInlineCell(`${columnLetter(index)}4`, String(column.label).replace(/\n/g, " "), 1)
  ).join("");
  rows.push(`<row r="4" ht="28" customHeight="1">${headerCells}</row>`);

  mainRows.forEach((row, rowIndex) => {
    const excelRow = rowIndex + 5;
    const cells = mainColumns.map((column, colIndex) => {
      const ref = `${columnLetter(colIndex)}${excelRow}`;
      return column.kind === "text"
        ? xlsxInlineCell(ref, row?.[column.field] ?? "", 0)
        : xlsxNumberCell(ref, row?.[column.field], 2);
    }).join("");
    rows.push(`<row r="${excelRow}" ht="13" customHeight="1">${cells}</row>`);
  });

  const totalRow = mainRows.length + 5;
  const totalCells = mainColumns.map((column, colIndex) => {
    const ref = `${columnLetter(colIndex)}${totalRow}`;
    if (colIndex === 0) {
      return xlsxInlineCell(ref, "Итого", 3);
    }
    return xlsxNumberCell(ref, sumField(mainRows, column.field), 6);
  }).join("");
  rows.push(`<row r="${totalRow}" ht="15" customHeight="1">${totalCells}</row>`);

  return {
    rows,
    merges: [`A1:${lastCol}1`, `A2:${lastCol}2`]
  };
}

function cashSheetRows({ cashColumns, cashRows }) {
  const rows = [];
  const headerCells = cashColumns.map((column, index) =>
    xlsxInlineCell(`${columnLetter(index)}1`, column.label, 1)
  ).join("");
  rows.push(`<row r="1" ht="24" customHeight="1">${headerCells}</row>`);

  cashRows.forEach((row, rowIndex) => {
    const excelRow = rowIndex + 2;
    const cells = cashColumns.map((column, colIndex) => {
      const ref = `${columnLetter(colIndex)}${excelRow}`;
      return column.kind === "text"
        ? xlsxInlineCell(ref, row?.[column.field] ?? "")
        : xlsxNumberCell(ref, row?.[column.field], 2);
    }).join("");
    rows.push(`<row r="${excelRow}">${cells}</row>`);
  });

  const totalRow = cashRows.length + 2;
  const totalCells = cashColumns.map((column, colIndex) => {
    const ref = `${columnLetter(colIndex)}${totalRow}`;
    if (colIndex === 0) {
      return xlsxInlineCell(ref, "Итого", 3);
    }
    if (column.kind === "text") {
      return xlsxBlankCell(ref, 3);
    }
    return xlsxNumberCell(ref, sumField(cashRows, column.field), 6);
  }).join("");
  rows.push(`<row r="${totalRow}">${totalCells}</row>`);

  return rows;
}

function bonusSheetRows({ bonusRows }) {
  const row = bonusRows[0] ?? {};
  const items = [
    ["Пополнено бонусов", "SumBonus"],
    ["Получ. авансов нал", "SumAdvCash"],
    ["Получ. авансов кред", "SumAdvKred"]
  ];

  return items.map(([label, field], index) => {
    const excelRow = index + 1;
    return `<row r="${excelRow}">${xlsxInlineCell(`A${excelRow}`, label, 3)}${xlsxNumberCell(`B${excelRow}`, row?.[field], 6)}</row>`;
  });
}

export function buildRevenueXlsxBytes({
  mainColumns,
  cashColumns,
  mainRows,
  cashRows,
  bonusRows,
  dateFrom,
  dateTo,
  organizationName
}) {
  const main = mainSheetRows({ mainColumns, mainRows, dateFrom, dateTo, organizationName });
  const cash = cashSheetRows({ cashColumns, cashRows });
  const bonuses = bonusSheetRows({ bonusRows });

  const mainCols = `<cols>${mainColumns.map((column, index) => {
    const width = column.kind === "text" ? 25 : 12;
    return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
  }).join("")}</cols>`;

  const cashCols = `<cols>${cashColumns.map((column, index) => {
    const width = column.kind === "text" ? 22 : 13;
    return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
  }).join("")}</cols>`;

  const files = [
    {
      name: "[Content_Types].xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`
    },
    {
      name: "_rels/.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
    },
    {
      name: "xl/workbook.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>
<sheet name="Выручка" sheetId="1" r:id="rId1"/>
<sheet name="По кассам" sheetId="2" r:id="rId2"/>
<sheet name="Бонусы" sheetId="3" r:id="rId3"/>
</sheets>
</workbook>`
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
    },
    {
      name: "xl/styles.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="# ##0.00;-# ##0.00;;"/></numFmts>
<fonts count="3">
<font><sz val="9"/><name val="Arial"/></font>
<font><b/><sz val="9"/><name val="Arial"/></font>
<font><b/><i/><sz val="11"/><name val="Arial"/></font>
</fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border/><border><bottom style="thin"><color rgb="FF666666"/></bottom></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="7">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right"/></xf>
<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="164" fontId="1" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`
    },
    {
      name: "xl/worksheets/sheet1.xml",
      data: makeSheetXml({ rows: main.rows, merges: main.merges, cols: mainCols, freezeRow: 4, landscape: true })
    },
    {
      name: "xl/worksheets/sheet2.xml",
      data: makeSheetXml({ rows: cash, cols: cashCols, freezeRow: 1, landscape: false })
    },
    {
      name: "xl/worksheets/sheet3.xml",
      data: makeSheetXml({
        rows: bonuses,
        cols: `<cols><col min="1" max="1" width="28" customWidth="1"/><col min="2" max="2" width="16" customWidth="1"/></cols>`,
        freezeRow: 0,
        landscape: false
      })
    }
  ];

  return createStoredZip(files);
}

function wordRun(text, { bold = false, italic = false, size = 16 } = {}) {
  const props = [bold ? "<w:b/>" : "", italic ? "<w:i/>" : "", `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`].join("");
  return `<w:r><w:rPr>${props}</w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

function wordParagraph(text, options = {}) {
  const align = options.align ? `<w:jc w:val="${options.align}"/>` : "";
  const spacing = `<w:spacing w:before="${options.before ?? 0}" w:after="${options.after ?? 0}"/>`;
  return `<w:p><w:pPr>${align}${spacing}</w:pPr>${wordRun(text, options)}</w:p>`;
}

function wordCell(value, { width = 800, bold = false, align = "right", shade = "", size = 15 } = {}) {
  const shading = shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${shade}"/>` : "";
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${shading}<w:tcMar><w:top w:w="20" w:type="dxa"/><w:left w:w="35" w:type="dxa"/><w:bottom w:w="20" w:type="dxa"/><w:right w:w="35" w:type="dxa"/></w:tcMar></w:tcPr>${wordParagraph(value, { bold, align, size, after: 0 })}</w:tc>`;
}

function wordTable({ columns, rows, formatter, total = true, widths = [] }) {
  const grid = columns.map((_, index) => `<w:gridCol w:w="${widths[index] ?? 800}"/>`).join("");
  const header = `<w:tr><w:trPr><w:tblHeader/></w:trPr>${columns.map((column, index) =>
    wordCell(String(column.label).replace(/\n/g, " "), {
      width: widths[index] ?? 800,
      bold: true,
      align: column.kind === "text" ? "left" : "center",
      shade: "F2F2F2",
      size: 14
    })
  ).join("")}</w:tr>`;

  const body = rows.map((row) => `<w:tr><w:trPr><w:trHeight w:val="220" w:hRule="atLeast"/></w:trPr>${columns.map((column, index) => {
    const value = column.kind === "text"
      ? row?.[column.field] ?? ""
      : formatTableMoney(row?.[column.field], formatter);
    return wordCell(value, {
      width: widths[index] ?? 800,
      align: column.kind === "text" ? "left" : "right",
      size: 14
    });
  }).join("")}</w:tr>`).join("");

  let totalRow = "";
  if (total && rows.length > 0) {
    totalRow = `<w:tr>${columns.map((column, index) => {
      const value = index === 0
        ? "Итого"
        : column.kind === "text"
          ? ""
          : formatter.format(sumField(rows, column.field));
      return wordCell(value, {
        width: widths[index] ?? 800,
        bold: true,
        align: column.kind === "text" ? "left" : "right",
        size: 14
      });
    }).join("")}</w:tr>`;
  }

  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:bottom w:val="single" w:sz="2" w:color="B0B0B0"/><w:insideH w:val="dotted" w:sz="2" w:color="B0B0B0"/></w:tblBorders></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${header}${body}${totalRow}</w:tbl>`;
}

export function buildRevenueDocxBytes({
  mainColumns,
  cashColumns,
  mainRows,
  cashRows,
  bonusRows,
  dateFrom,
  dateTo,
  organizationName,
  locale
}) {
  const formatter = createMoneyFormatter(locale);
  const mainWidths = mainColumns.map((column) => column.kind === "text" ? 2100 : 780);
  const cashWidths = cashColumns.map((column) => column.kind === "text" ? 1900 : 1500);
  const bonus = bonusRows[0] ?? {};

  const bonusTable = `<w:tbl><w:tblPr><w:tblW w:w="5200" w:type="dxa"/></w:tblPr><w:tblGrid><w:gridCol w:w="3300"/><w:gridCol w:w="1900"/></w:tblGrid>
${[
    ["Пополнено бонусов:", "SumBonus"],
    ["Получ. авансов нал:", "SumAdvCash"],
    ["Получ. авансов кред:", "SumAdvKred"]
  ].map(([label, field]) => `<w:tr>${wordCell(label, { width: 3300, bold: true, align: "left", size: 15 })}${wordCell(formatter.format(numericValue(bonus?.[field])), { width: 1900, bold: true, align: "right", size: 15 })}</w:tr>`).join("")}
</w:tbl>`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
${wordParagraph(`Оплата по официантам с ${formatReportDate(dateFrom)} по ${formatReportDate(dateTo)}`, { bold: true, italic: true, size: 20, after: 40 })}
${wordParagraph(`*** ${organizationName || "Все"}`, { bold: true, size: 17, after: 80 })}
${wordTable({ columns: mainColumns, rows: mainRows, formatter, total: true, widths: mainWidths })}
${wordParagraph("Оплата по кассам:", { bold: true, italic: true, size: 18, before: 120, after: 40 })}
${wordTable({ columns: cashColumns, rows: cashRows, formatter, total: true, widths: cashWidths })}
${wordParagraph("Бонусы и авансы", { bold: true, italic: true, size: 18, before: 120, after: 40 })}
${bonusTable}
<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="500" w:right="500" w:bottom="500" w:left="500" w:header="300" w:footer="300" w:gutter="0"/></w:sectPr>
</w:body>
</w:document>`;

  return createStoredZip([
    {
      name: "[Content_Types].xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
    },
    {
      name: "_rels/.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
    },
    { name: "word/document.xml", data: documentXml },
    {
      name: "word/_rels/document.xml.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`
    }
  ]);
}

function htmlMoney(value, formatter) {
  return formatTableMoney(value, formatter);
}

function htmlTable(columns, rows, formatter, className) {
  const header = columns.map((column) => `<th>${escapeHtml(String(column.label).replace(/\n/g, " "))}</th>`).join("");
  const body = rows.map((row) => `<tr>${columns.map((column) => {
    const value = column.kind === "text" ? row?.[column.field] ?? "" : htmlMoney(row?.[column.field], formatter);
    const cls = column.kind === "text" ? "text" : "money";
    return `<td class="${cls}">${escapeHtml(value)}</td>`;
  }).join("")}</tr>`).join("");
  const total = rows.length > 0
    ? `<tr class="total">${columns.map((column, index) => {
        const value = index === 0 ? "Итого" : column.kind === "text" ? "" : formatter.format(sumField(rows, column.field));
        return `<td class="${column.kind === "text" ? "text" : "money"}">${escapeHtml(value)}</td>`;
      }).join("")}</tr>`
    : "";

  return `<table class="${className}"><thead><tr>${header}</tr></thead><tbody>${body}</tbody><tfoot>${total}</tfoot></table>`;
}

function buildPrintableRevenueHtml({
  mainColumns,
  cashColumns,
  mainRows,
  cashRows,
  bonusRows,
  dateFrom,
  dateTo,
  organizationName,
  locale
}) {
  const formatter = createMoneyFormatter(locale);
  const bonus = bonusRows[0] ?? {};

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Revenue</title>
<style>
@page { size: A4 landscape; margin: 8mm; }
html, body { margin: 0; padding: 0; font-family: Arial, sans-serif; color: #111; }
body { font-size: 8.5pt; }
h1 { margin: 0 0 2mm; font-size: 11pt; font-style: italic; }
.org { margin-bottom: 3mm; font-size: 9pt; font-weight: 700; text-decoration: underline; text-align: right; }
table { width: 100%; border-collapse: collapse; table-layout: auto; }
th, td { padding: 1.2mm 1.4mm; border-bottom: 0.2mm dotted #888; white-space: nowrap; }
th { border-bottom: 0.3mm solid #555; background: #f4f4f4; font-weight: 700; text-align: right; }
th:first-child, td.text { text-align: left; }
td.money { text-align: right; }
.main tbody td { padding-top: 0.75mm; padding-bottom: 0.75mm; }
.total td { border-top: 0.3mm solid #444; border-bottom: 0; font-weight: 700; }
.bottom { display: table; width: 100%; margin-top: 4mm; table-layout: fixed; }
.cash-wrap { display: table-cell; width: 68%; vertical-align: top; padding-right: 7mm; }
.bonus-wrap { display: table-cell; width: 32%; vertical-align: top; padding-top: 6mm; }
h2 { margin: 0 0 1.5mm; font-size: 10pt; font-style: italic; }
.bonus-row { display: table; width: 100%; margin: 1mm 0; }
.bonus-row span, .bonus-row strong { display: table-cell; }
.bonus-row strong { text-align: right; }
</style></head><body>
<h1>Оплата по официантам с ${escapeHtml(formatReportDate(dateFrom))} по ${escapeHtml(formatReportDate(dateTo))}</h1>
<div class="org">*** ${escapeHtml(organizationName || "Все")}</div>
${htmlTable(mainColumns, mainRows, formatter, "main")}
<div class="bottom">
<div class="cash-wrap"><h2>Оплата по кассам:</h2>${htmlTable(cashColumns, cashRows, formatter, "cash")}</div>
<div class="bonus-wrap">
<div class="bonus-row"><span>Пополнено бонусов:</span><strong>${escapeHtml(formatter.format(numericValue(bonus?.SumBonus)))}</strong></div>
<div class="bonus-row"><span>Получ. авансов нал:</span><strong>${escapeHtml(formatter.format(numericValue(bonus?.SumAdvCash)))}</strong></div>
<div class="bonus-row"><span>Получ. авансов кред:</span><strong>${escapeHtml(formatter.format(numericValue(bonus?.SumAdvKred)))}</strong></div>
</div></div>
</body></html>`;
}

function closePrintWindowAfterPrint(printWindow) {
  if (!printWindow) {
    return;
  }

  printWindow.addEventListener(
    "afterprint",
    () => {
      printWindow.close();
      window.focus();
    },
    { once: true }
  );
}

export function printRevenueReport(options) {
  const printWindow = window.open("", "_blank", "width=1280,height=900");

  if (!printWindow) {
    window.alert("Браузер заблокировал окно печати. Разрешите всплывающие окна для Web Office.");
    return;
  }

  printWindow.document.open();
  printWindow.document.write(buildPrintableRevenueHtml(options));
  printWindow.document.close();
  printWindow.focus();
  closePrintWindowAfterPrint(printWindow);

  window.setTimeout(() => {
    printWindow.print();
  }, 150);
}

export function exportRevenueXlsx(options) {
  const bytes = buildRevenueXlsxBytes(options);
  const fileName = `${revenueFileBase(options.dateFrom, options.dateTo, options.organizationName)}.xlsx`;
  downloadBytes(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
}

export function exportRevenueDocx(options) {
  const bytes = buildRevenueDocxBytes(options);
  const fileName = `${revenueFileBase(options.dateFrom, options.dateTo, options.organizationName)}.docx`;
  downloadBytes(bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", fileName);
}

const REVENUE_GRAPH_COLORS = [
  "#6f6ad8",
  "#a64b82",
  "#e7b64c",
  "#59a99d",
  "#d56b68",
  "#7a9b55",
  "#5b86b3",
  "#b87345",
  "#8a6bb8",
  "#4f9b68"
];

function revenueGraphFileBase(dateFrom, dateTo, organizationName) {
  const from = safeFilePart(dateFrom) || "from";
  const to = safeFilePart(dateTo) || "to";
  const org = safeFilePart(organizationName || "Все") || "Все";
  return `RevenueGraph_${from}_${to}_${org}`;
}

function buildRevenueSummaryRow(mainColumns, mainRows) {
  return mainColumns.reduce((result, column) => {
    result[column.field] = column.kind === "text"
      ? "Итого"
      : sumField(mainRows, column.field);
    return result;
  }, {});
}

function normalizeGraphRows(graphRows) {
  const rows = Array.isArray(graphRows) ? graphRows : [];
  const total = rows.reduce((sum, row) => sum + numericValue(row?.Summ ?? row?.summ), 0);

  return rows
    .map((row, index) => {
      const value = numericValue(row?.Summ ?? row?.summ);
      return {
        NamePodr: String(row?.NamePodr ?? row?.name ?? `Подразделение ${index + 1}`),
        Summ: value,
        Percent: total > 0 ? (value / total) * 100 : 0
      };
    })
    .filter((row) => row.Summ > 0);
}

function revenueGraphSummarySheetRows({ mainColumns, mainRows, dateFrom, dateTo, organizationName }) {
  const rows = [];
  const lastCol = columnLetter(mainColumns.length - 1);
  const title = `Выручка по подразделениям с ${formatReportDate(dateFrom)} по ${formatReportDate(dateTo)}`;
  const org = `*** ${organizationName || "Все"}`;
  const summary = buildRevenueSummaryRow(mainColumns, mainRows);

  rows.push(`<row r="1" ht="21" customHeight="1">${xlsxInlineCell("A1", title, 4)}</row>`);
  rows.push(`<row r="2">${xlsxInlineCell("A2", org, 5)}</row>`);

  const headerCells = mainColumns.map((column, index) =>
    xlsxInlineCell(`${columnLetter(index)}4`, String(column.label).replace(/\n/g, " "), 1)
  ).join("");
  rows.push(`<row r="4" ht="28" customHeight="1">${headerCells}</row>`);

  const summaryCells = mainColumns.map((column, index) => {
    const ref = `${columnLetter(index)}5`;
    return column.kind === "text"
      ? xlsxInlineCell(ref, summary[column.field], 3)
      : xlsxNumberCell(ref, summary[column.field], 6);
  }).join("");
  rows.push(`<row r="5" ht="16" customHeight="1">${summaryCells}</row>`);

  return {
    rows,
    merges: [`A1:${lastCol}1`, `A2:${lastCol}2`]
  };
}

function revenueGraphDataSheetRows(graphRows) {
  const rows = [];
  const normalized = normalizeGraphRows(graphRows);
  const total = normalized.reduce((sum, row) => sum + row.Summ, 0);

  rows.push(`<row r="1" ht="24" customHeight="1">${xlsxInlineCell("A1", "Подразделение", 1)}${xlsxInlineCell("B1", "Выручка", 1)}${xlsxInlineCell("C1", "Доля, %", 1)}</row>`);

  normalized.forEach((row, index) => {
    const excelRow = index + 2;
    rows.push(`<row r="${excelRow}">${xlsxInlineCell(`A${excelRow}`, row.NamePodr)}${xlsxNumberCell(`B${excelRow}`, row.Summ, 2)}${xlsxNumberCell(`C${excelRow}`, row.Percent, 2)}</row>`);
  });

  const totalRow = normalized.length + 2;
  rows.push(`<row r="${totalRow}">${xlsxInlineCell(`A${totalRow}`, "Итого", 3)}${xlsxNumberCell(`B${totalRow}`, total, 6)}${xlsxNumberCell(`C${totalRow}`, 100, 6)}</row>`);

  return rows;
}

export function buildRevenueGraphXlsxBytes({
  mainColumns,
  mainRows,
  graphRows,
  dateFrom,
  dateTo,
  organizationName
}) {
  const summary = revenueGraphSummarySheetRows({
    mainColumns,
    mainRows,
    dateFrom,
    dateTo,
    organizationName
  });
  const graph = revenueGraphDataSheetRows(graphRows);

  const mainCols = `<cols>${mainColumns.map((column, index) => {
    const width = column.kind === "text" ? 18 : 12;
    return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
  }).join("")}</cols>`;

  const files = [
    {
      name: "[Content_Types].xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`
    },
    {
      name: "_rels/.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
    },
    {
      name: "xl/workbook.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>
<sheet name="Итого" sheetId="1" r:id="rId1"/>
<sheet name="Подразделения" sheetId="2" r:id="rId2"/>
</sheets>
</workbook>`
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
    },
    {
      name: "xl/styles.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="# ##0.00;-# ##0.00;;"/></numFmts>
<fonts count="3">
<font><sz val="9"/><name val="Arial"/></font>
<font><b/><sz val="9"/><name val="Arial"/></font>
<font><b/><i/><sz val="11"/><name val="Arial"/></font>
</fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border/><border><bottom style="thin"><color rgb="FF666666"/></bottom></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="7">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right"/></xf>
<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="164" fontId="1" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`
    },
    {
      name: "xl/worksheets/sheet1.xml",
      data: makeSheetXml({ rows: summary.rows, merges: summary.merges, cols: mainCols, freezeRow: 4, landscape: true })
    },
    {
      name: "xl/worksheets/sheet2.xml",
      data: makeSheetXml({
        rows: graph,
        cols: `<cols><col min="1" max="1" width="28" customWidth="1"/><col min="2" max="3" width="16" customWidth="1"/></cols>`,
        freezeRow: 1,
        landscape: false
      })
    }
  ];

  return createStoredZip(files);
}

export function buildRevenueGraphDocxBytes({
  mainColumns,
  mainRows,
  graphRows,
  dateFrom,
  dateTo,
  organizationName,
  locale
}) {
  const formatter = createMoneyFormatter(locale);
  const summary = buildRevenueSummaryRow(mainColumns, mainRows);
  const normalizedGraph = normalizeGraphRows(graphRows);
  const summaryWidths = mainColumns.map((column) => column.kind === "text" ? 1600 : 800);
  const graphColumns = [
    { field: "NamePodr", label: "Подразделение", kind: "text" },
    { field: "Summ", label: "Выручка" },
    { field: "Percent", label: "Доля, %" }
  ];

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
${wordParagraph(`Выручка по подразделениям с ${formatReportDate(dateFrom)} по ${formatReportDate(dateTo)}`, { bold: true, italic: true, size: 20, after: 40 })}
${wordParagraph(`*** ${organizationName || "Все"}`, { bold: true, size: 17, after: 80 })}
${wordTable({ columns: mainColumns, rows: [summary], formatter, total: false, widths: summaryWidths })}
${wordParagraph("Структура выручки по подразделениям", { bold: true, italic: true, size: 18, before: 160, after: 40 })}
${wordTable({ columns: graphColumns, rows: normalizedGraph, formatter, total: true, widths: [3200, 1800, 1500] })}
<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="500" w:right="500" w:bottom="500" w:left="500" w:header="300" w:footer="300" w:gutter="0"/></w:sectPr>
</w:body>
</w:document>`;

  return createStoredZip([
    {
      name: "[Content_Types].xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
    },
    {
      name: "_rels/.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
    },
    { name: "word/document.xml", data: documentXml },
    {
      name: "word/_rels/document.xml.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`
    }
  ]);
}

function htmlSingleRowTable(columns, row, formatter, className) {
  const header = columns.map((column) => `<th>${escapeHtml(String(column.label).replace(/\n/g, " "))}</th>`).join("");
  const cells = columns.map((column) => {
    const value = column.kind === "text"
      ? row?.[column.field] ?? ""
      : htmlMoney(row?.[column.field], formatter);
    const cls = column.kind === "text" ? "text" : "money";
    return `<td class="${cls}">${escapeHtml(value)}</td>`;
  }).join("");
  return `<table class="${className}"><thead><tr>${header}</tr></thead><tbody><tr>${cells}</tr></tbody></table>`;
}

function buildPrintableRevenueGraphHtml({
  mainColumns,
  mainRows,
  graphRows,
  dateFrom,
  dateTo,
  organizationName,
  locale
}) {
  const formatter = createMoneyFormatter(locale);
  const summary = buildRevenueSummaryRow(mainColumns, mainRows);
  const normalizedGraph = normalizeGraphRows(graphRows);
  const total = normalizedGraph.reduce((sum, row) => sum + row.Summ, 0);
  let offset = 0;

  const segments = normalizedGraph.map((row, index) => {
    const percent = total > 0 ? (row.Summ / total) * 100 : 0;
    const dashOffset = -offset;
    offset += percent;
    return `<circle cx="130" cy="130" r="82" pathLength="100" fill="none" stroke="${REVENUE_GRAPH_COLORS[index % REVENUE_GRAPH_COLORS.length]}" stroke-width="40" stroke-dasharray="${percent} ${100 - percent}" stroke-dashoffset="${dashOffset}" transform="rotate(-90 130 130)"/>`;
  }).join("");

  const legend = normalizedGraph.map((row, index) => {
    const percent = total > 0 ? (row.Summ / total) * 100 : 0;
    return `<div class="legend-row"><span class="swatch" style="background:${REVENUE_GRAPH_COLORS[index % REVENUE_GRAPH_COLORS.length]}"></span><span>${escapeHtml(row.NamePodr)}</span><strong>${percent.toFixed(1)}%</strong><span class="money">${escapeHtml(formatter.format(row.Summ))}</span></div>`;
  }).join("");

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Revenue Graph</title>
<style>
@page { size: A4 landscape; margin: 8mm; }
html, body { margin: 0; padding: 0; font-family: Arial, sans-serif; color: #111; }
body { font-size: 8.5pt; }
h1 { margin: 0 0 2mm; font-size: 11pt; font-style: italic; }
.org { margin-bottom: 3mm; font-size: 9pt; font-weight: 700; text-decoration: underline; text-align: right; }
table { width: 100%; border-collapse: collapse; table-layout: auto; }
th, td { padding: 1.2mm 1.4mm; border-bottom: 0.2mm dotted #888; white-space: nowrap; }
th { border-bottom: 0.3mm solid #555; background: #f4f4f4; font-weight: 700; text-align: right; }
th:first-child, td.text { text-align: left; }
td.money { text-align: right; }
.summary td { font-weight: 700; }
.graph { display: table; width: 78%; margin: 7mm auto 0; table-layout: fixed; }
.chart-wrap, .legend { display: table-cell; vertical-align: middle; }
.chart-wrap { width: 48%; text-align: center; }
.chart { width: 78mm; height: 78mm; }
.legend { width: 52%; padding-left: 7mm; }
.legend h2 { margin: 0 0 2mm; font-size: 10pt; }
.legend-row { display: grid; grid-template-columns: 4mm 1fr 16mm 29mm; gap: 2mm; align-items: center; padding: 1.3mm 0; border-bottom: 0.2mm dotted #bbb; }
.swatch { width: 3mm; height: 3mm; display: inline-block; }
.legend-row strong, .legend-row .money { text-align: right; }
.legend-total { display: flex; justify-content: space-between; margin-top: 2mm; padding-top: 2mm; border-top: 0.3mm solid #555; font-weight: 700; }
</style></head><body>
<h1>Выручка по подразделениям с ${escapeHtml(formatReportDate(dateFrom))} по ${escapeHtml(formatReportDate(dateTo))}</h1>
<div class="org">*** ${escapeHtml(organizationName || "Все")}</div>
${htmlSingleRowTable(mainColumns, summary, formatter, "summary")}
<div class="graph">
<div class="chart-wrap"><svg class="chart" viewBox="0 0 260 260"><circle cx="130" cy="130" r="82" fill="none" stroke="#edf0f1" stroke-width="40"/>${segments}<text x="130" y="119" text-anchor="middle" font-size="13" font-weight="600" fill="#666">Выручка</text><text x="130" y="143" text-anchor="middle" font-size="15" font-weight="800">${escapeHtml(formatter.format(total))}</text></svg></div>
<div class="legend"><h2>Выручка по подразделениям</h2>${legend}<div class="legend-total"><span>Итого</span><strong>${escapeHtml(formatter.format(total))}</strong></div></div>
</div>
</body></html>`;
}

export function printRevenueGraphReport(options) {
  const printWindow = window.open("", "_blank", "width=1280,height=900");

  if (!printWindow) {
    window.alert("Браузер заблокировал окно печати. Разрешите всплывающие окна для Web Office.");
    return;
  }

  printWindow.document.open();
  printWindow.document.write(buildPrintableRevenueGraphHtml(options));
  printWindow.document.close();
  printWindow.focus();
  closePrintWindowAfterPrint(printWindow);

  window.setTimeout(() => {
    printWindow.print();
  }, 150);
}

export function exportRevenueGraphXlsx(options) {
  const bytes = buildRevenueGraphXlsxBytes(options);
  const fileName = `${revenueGraphFileBase(options.dateFrom, options.dateTo, options.organizationName)}.xlsx`;
  downloadBytes(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
}

export function exportRevenueGraphDocx(options) {
  const bytes = buildRevenueGraphDocxBytes(options);
  const fileName = `${revenueGraphFileBase(options.dateFrom, options.dateTo, options.organizationName)}.docx`;
  downloadBytes(bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", fileName);
}
