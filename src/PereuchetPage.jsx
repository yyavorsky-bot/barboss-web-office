import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { exportReportFile } from "./reportExport.js";
import "./pereuchet-report.css";
import "./pereuchet-row-visual-fix.css";

function formatDateForInput(value) {
  if (!value) return "";

  const text = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const dotMatch = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);

  if (dotMatch) {
    return `${dotMatch[3]}-${dotMatch[2]}-${dotMatch[1]}`;
  }

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateForApi(value) {
  if (!value) return "";

  const text = String(value).trim();

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(text)) {
    return text;
  }

  const [year, month, day] = text.split("-");

  if (!year || !month || !day) {
    return text;
  }

  return `${day}.${month}.${year}`;
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === "") return "0";

  const n = Number(String(value).replace(",", "."));

  if (!Number.isFinite(n)) {
    return "0";
  }

  return String(n);
}

function formatNumber(value, digits = 3, locale = "ru-RU") {
  const n = Number(value || 0);

  if (!Number.isFinite(n)) {
    return "";
  }

  return n.toLocaleString(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function numberToInput(value) {
  if (value === null || value === undefined || value === "") return "";

  const n = Number(value);

  if (!Number.isFinite(n)) {
    return String(value);
  }

  return String(Number(n.toFixed(3))).replace(".", ",");
}

function calcFactExpression(value) {
  const text = String(value || "").trim();

  if (!text.includes("+") && !text.includes("*")) {
    return null;
  }

  // Разрешаем только положительные числа, + и *.
  // Минус, деление, скобки и любые другие символы намеренно не поддерживаем.
  if (!/^[0-9\s.,+*]+$/.test(text)) {
    return null;
  }

  const sumParts = text
    .split("+")
    .map((part) => part.trim());

  if (
    sumParts.length === 0 ||
    sumParts.some((part) => !part)
  ) {
    return null;
  }

  let sum = 0;

  for (const sumPart of sumParts) {
    const multiplyParts = sumPart
      .split("*")
      .map((part) => part.trim());

    if (
      multiplyParts.length === 0 ||
      multiplyParts.some((part) => !part)
    ) {
      return null;
    }

    let product = 1;

    for (const part of multiplyParts) {
      const n = Number(part.replace(",", "."));

      if (!Number.isFinite(n)) {
        return null;
      }

      product *= n;
    }

    sum += product;
  }

  return String(Number(sum.toFixed(3))).replace(".", ",");
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function findDateRow(rows, dateValue) {
  const date = formatDateForInput(dateValue);

  return rows.find((row) => formatDateForInput(row.Date) === date) || null;
}


const PEREUCHET_SHORT_THRESHOLD = 0.1;

// wr_Reports.php Action for the report "Сырье в готовых блюдах на переучет".
// If the backend action has another name, only this constant needs to be changed.
const PEREUCHET_RAW_IN_DISHES_REPORT_ACTION = "PereuchetSiryo";

const PEREUCHET_REPORT_TOTAL_COLUMNS = [
  { key: "Сальдо", digits: 3 },
  { key: "Поступило", digits: 3 },
  { key: "Перемещено", digits: 3 },
  { key: "Реализовано", digits: 3 },
  { key: "Списано", digits: 3 },
  { key: "__prepared", digits: 3 },
  { key: "Остаток", digits: 3 },
  { key: "Факт", digits: 3 },
  { key: "РазнВес", digits: 3 },
  { key: "РазнСеб", digits: 2 },
  { key: "РазницаПр", digits: 2 }
];

function finiteNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function hasOwn(row, field) {
  return Boolean(row) && Object.prototype.hasOwnProperty.call(row, field);
}

function getPreparedQuantity(row) {
  return finiteNumber(row?.["ВГотовых"] ?? row?.["ВБлюдах"] ?? 0);
}

function getCalculatedWeightDifference(row) {
  const canCalculate =
    hasOwn(row, "Остаток") &&
    hasOwn(row, "Факт") &&
    (hasOwn(row, "ВГотовых") || hasOwn(row, "ВБлюдах"));

  if (canCalculate) {
    return finiteNumber(row["Остаток"]) -
      (finiteNumber(row["Факт"]) + getPreparedQuantity(row));
  }

  return finiteNumber(row?.["РазнВес"]);
}

function getDisplayedWeightDifference(row) {
  if (hasOwn(row, "РазнВес")) {
    return finiteNumber(row["РазнВес"]);
  }

  return getCalculatedWeightDifference(row);
}

function formatReportDate(value, locale = "ru-RU") {
  const normalized = formatDateForInput(value);

  if (!normalized) {
    return String(value || "");
  }

  const [year, month, day] = normalized.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  if (Number.isNaN(date.getTime())) {
    return normalized;
  }

  return new Intl.DateTimeFormat(locale).format(date);
}

function groupPereuchetReportRows(rows, emptyCategoryName) {
  const groups = [];
  const groupMap = new Map();

  rows.forEach((row) => {
    const category = String(row?.Category || "").trim() || emptyCategoryName;

    if (!groupMap.has(category)) {
      const group = { category, rows: [] };
      groupMap.set(category, group);
      groups.push(group);
    }

    groupMap.get(category).rows.push(row);
  });

  return groups;
}

function sumPereuchetReportColumn(rows, key) {
  return rows.reduce((sum, row) => {
    if (key === "__prepared") {
      return sum + getPreparedQuantity(row);
    }

    if (key === "РазнВес") {
      return sum + getDisplayedWeightDifference(row);
    }

    return sum + finiteNumber(row?.[key]);
  }, 0);
}


function getPereuchetVisibleRows(report, variant) {
  const allRows = Array.isArray(report?.Pereuchet) ? report.Pereuchet : [];

  if (variant !== "brief") {
    return allRows;
  }

  return allRows.filter(
    (row) =>
      Math.abs(getCalculatedWeightDifference(row)) >
      PEREUCHET_SHORT_THRESHOLD
  );
}

function buildPereuchetExportModel(report, variant, t, locale) {
  const visibleRows = getPereuchetVisibleRows(report, variant);
  const modeTitle =
    variant === "brief"
      ? t("Pereuchet.Report.BriefMode", "Кратко")
      : t("Pereuchet.Report.ExpandedMode", "Развернуто");

  const reportTitle = t(
    "Pereuchet.Report.Title",
    "Результаты переучета"
  );

  const exportRows = visibleRows.map((row) => ({
    Category:
      String(row?.Category || "").trim() ||
      t("Pereuchet.Report.NoCategory", "Без категории"),
    NameTov: row?.NameTov || "",
    EdIzm: row?.EdIzm || "",
    Price: finiteNumber(row?.Price),
    Saldo: finiteNumber(row?.["Сальдо"]),
    Received: finiteNumber(row?.["Поступило"]),
    Moved: finiteNumber(row?.["Перемещено"]),
    Sold: finiteNumber(row?.["Реализовано"]),
    WrittenOff: finiteNumber(row?.["Списано"]),
    Prepared: getPreparedQuantity(row),
    Balance: finiteNumber(row?.["Остаток"]),
    Actual: finiteNumber(row?.["Факт"]),
    WeightDifference: getDisplayedWeightDifference(row),
    CostDifference: finiteNumber(row?.["РазнСеб"]),
    SaleDifference: finiteNumber(row?.["РазницаПр"])
  }));

  const fileDate =
    formatDateForInput(report?.ToDate || report?.FromDate) || "report";

  return {
    title: `${reportTitle} — ${modeTitle}`,
    fileName: `Pereuchet_${
      variant === "brief" ? "Brief" : "Expanded"
    }_${fileDate}`,
    orientation: "landscape",
    locale,
    meta: [
      {
        label: t("Common.Period", "Период"),
        value:
          `${formatReportDate(report?.FromDate, locale)} — ` +
          `${formatReportDate(report?.ToDate, locale)}`
      },
      {
        label: t("Common.Warehouse", "Склад"),
        value: report?.["Склад"] || "—"
      },
      {
        label: t("Pereuchet.Report.Rows", "Позиций"),
        value: String(visibleRows.length)
      }
    ],
    columns: [
      {
        key: "Category",
        title: t("Pereuchet.Report.Category", "Категория"),
        type: "text",
        width: 22
      },
      {
        key: "NameTov",
        title: t("Pereuchet.Report.RawMaterial", "Сырье"),
        type: "text",
        width: 34
      },
      {
        key: "EdIzm",
        title: t("Pereuchet.Report.Unit", "Ед."),
        type: "text",
        width: 8
      },
      {
        key: "Price",
        title: t("Pereuchet.Report.Price", "Цена"),
        type: "number",
        decimals: 2,
        width: 12
      },
      {
        key: "Saldo",
        title: t("Pereuchet.Report.Opening", "Сальдо"),
        type: "number",
        decimals: 3,
        width: 13
      },
      {
        key: "Received",
        title: t("Pereuchet.Report.Received", "Поступило"),
        type: "number",
        decimals: 3,
        width: 13
      },
      {
        key: "Moved",
        title: t("Pereuchet.Report.Moved", "Перемещено"),
        type: "number",
        decimals: 3,
        width: 13
      },
      {
        key: "Sold",
        title: t("Pereuchet.Report.Sold", "Реализовано"),
        type: "number",
        decimals: 3,
        width: 13
      },
      {
        key: "WrittenOff",
        title: t("Pereuchet.Report.WrittenOff", "Списано"),
        type: "number",
        decimals: 3,
        width: 13
      },
      {
        key: "Prepared",
        title: t("Pereuchet.Report.InPrepared", "В готовых"),
        type: "number",
        decimals: 3,
        width: 13
      },
      {
        key: "Balance",
        title: t("Pereuchet.Report.Balance", "Остаток"),
        type: "number",
        decimals: 3,
        width: 13
      },
      {
        key: "Actual",
        title: t("Pereuchet.Report.Actual", "Факт"),
        type: "number",
        decimals: 3,
        width: 13
      },
      {
        key: "WeightDifference",
        title: t(
          "Pereuchet.Report.WeightDifference",
          "Разн. вес"
        ),
        type: "number",
        decimals: 3,
        width: 13
      },
      {
        key: "CostDifference",
        title: t(
          "Pereuchet.Report.CostDifference",
          "Разн. себ."
        ),
        type: "number",
        decimals: 2,
        width: 13
      },
      {
        key: "SaleDifference",
        title: t(
          "Pereuchet.Report.SaleDifference",
          "Разн. продажная"
        ),
        type: "number",
        decimals: 2,
        width: 16
      }
    ],
    rows: exportRows,
    footerRows: [
      {
        label: t("Pereuchet.Report.GrandTotal", "Итого"),
        values: {
          Saldo: sumPereuchetReportColumn(visibleRows, "Сальдо"),
          Received: sumPereuchetReportColumn(
            visibleRows,
            "Поступило"
          ),
          Moved: sumPereuchetReportColumn(
            visibleRows,
            "Перемещено"
          ),
          Sold: sumPereuchetReportColumn(
            visibleRows,
            "Реализовано"
          ),
          WrittenOff: sumPereuchetReportColumn(
            visibleRows,
            "Списано"
          ),
          Prepared: sumPereuchetReportColumn(
            visibleRows,
            "__prepared"
          ),
          Balance: sumPereuchetReportColumn(
            visibleRows,
            "Остаток"
          ),
          Actual: sumPereuchetReportColumn(
            visibleRows,
            "Факт"
          ),
          WeightDifference: sumPereuchetReportColumn(
            visibleRows,
            "РазнВес"
          ),
          CostDifference: sumPereuchetReportColumn(
            visibleRows,
            "РазнСеб"
          ),
          SaleDifference: sumPereuchetReportColumn(
            visibleRows,
            "РазницаПр"
          )
        }
      }
    ]
  };
}

function PereuchetResultsReport({
  report,
  variant,
  onBack,
  onExport,
  exportLoading,
  t,
  locale
}) {
  const visibleRows = useMemo(
    () => getPereuchetVisibleRows(report, variant),
    [report, variant]
  );

  const groups = useMemo(
    () => groupPereuchetReportRows(
      visibleRows,
      t("Pereuchet.Report.NoCategory", "Без категории")
    ),
    [visibleRows, t]
  );

  const modeTitle = variant === "brief"
    ? t("Pereuchet.Report.BriefMode", "Кратко")
    : t("Pereuchet.Report.ExpandedMode", "Развернуто");

  return (
    <div className="pereuchet-report-page">
      <div className="module-toolbar pereuchet-report-toolbar no-print">
        <div className="toolbar-left">
          <button type="button" className="toolbar-button" onClick={onBack}>
            {t("Common.Back", "Назад")}
          </button>
        </div>

        <div className="toolbar-right pereuchet-report-actions">
          <button
            type="button"
            className="toolbar-button"
            disabled={Boolean(exportLoading)}
            onClick={() => onExport?.("xlsx")}
          >
            {t("Common.Excel", "Excel")}
          </button>

          <button
            type="button"
            className="toolbar-button"
            disabled={Boolean(exportLoading)}
            onClick={() => onExport?.("docx")}
          >
            {t("Common.Word", "Word")}
          </button>

          <button
            type="button"
            className="toolbar-button primary"
            disabled={Boolean(exportLoading)}
            onClick={() => window.print()}
          >
            {t("Common.Print", "Печать")}
          </button>
        </div>
      </div>

      <article className="pereuchet-report-sheet">
        <header className="pereuchet-report-header">
          <div>
            <div className="pereuchet-report-kicker">{modeTitle}</div>
            <h1>{t("Pereuchet.Report.Title", "Результаты переучета")}</h1>
            <div className="pereuchet-report-period">
              {t("Common.Period", "Период")}: {formatReportDate(report?.FromDate, locale)} — {formatReportDate(report?.ToDate, locale)}
            </div>
          </div>

          <div className="pereuchet-report-meta">
            <div>
              <span>{t("Common.Warehouse", "Склад")}</span>
              <strong>{report?.["Склад"] || "—"}</strong>
            </div>
            <div>
              <span>{t("Pereuchet.Report.Rows", "Позиций")}</span>
              <strong>{visibleRows.length}</strong>
            </div>
          </div>
        </header>

 
        {visibleRows.length === 0 ? (
          <div className="pereuchet-report-empty">
            {t("Pereuchet.Report.NoRows", "Нет позиций, соответствующих условиям отчета.")}
          </div>
        ) : (
          <div className="pereuchet-report-table-wrap">
            <table className="pereuchet-report-table">
              <colgroup>
                <col className="pereuchet-report-col-name" />
                <col className="pereuchet-report-col-unit" />
                <col className="pereuchet-report-col-price" />
                {PEREUCHET_REPORT_TOTAL_COLUMNS.map((column) => (
                  <col key={column.key} className="pereuchet-report-col-number" />
                ))}
              </colgroup>

              <thead>
                <tr>
                  <th>{t("Pereuchet.Report.RawMaterial", "Сырье")}</th>
                  <th>{t("Pereuchet.Report.Unit", "Ед.")}</th>
                  <th className="num">{t("Pereuchet.Report.Price", "Цена")}</th>
                  <th className="num">{t("Pereuchet.Report.Opening", "Сальдо")}</th>
                  <th className="num">{t("Pereuchet.Report.Received", "Поступило")}</th>
                  <th className="num">{t("Pereuchet.Report.Moved", "Перемещено")}</th>
                  <th className="num">{t("Pereuchet.Report.Sold", "Реализовано")}</th>
                  <th className="num">{t("Pereuchet.Report.WrittenOff", "Списано")}</th>
                  <th className="num">{t("Pereuchet.Report.InPrepared", "В готовых")}</th>
                  <th className="num">{t("Pereuchet.Report.Balance", "Остаток")}</th>
                  <th className="num">{t("Pereuchet.Report.Actual", "Факт")}</th>
                  <th className="num">{t("Pereuchet.Report.WeightDifference", "Разн. вес")}</th>
                  <th className="num">{t("Pereuchet.Report.CostDifference", "Разн. себ.")}</th>
                  <th className="num">{t("Pereuchet.Report.SaleDifference", "Разн. продажная")}</th>
                </tr>
              </thead>

              <tbody>
                {groups.map((group) => (
                  <Fragment key={group.category}>
                    <tr className="pereuchet-report-category-row">
                      <td colSpan="14">{group.category}</td>
                    </tr>

                    {group.rows.map((row, index) => {
                      const hasSignificantDifference =
                        Math.abs(getCalculatedWeightDifference(row)) > PEREUCHET_SHORT_THRESHOLD;

                      return (
                        <tr
                          key={`${row.IdTov ?? "tov"}-${index}`}
                          className={hasSignificantDifference ? "pereuchet-report-difference-row" : ""}
                        >
                          <td title={row.NameTov || ""}>{row.NameTov || "—"}</td>
                          <td>{row.EdIzm || ""}</td>
                          <td className="num">{formatNumber(row.Price, 2, locale)}</td>
                          <td className="num">{formatNumber(row["Сальдо"], 3, locale)}</td>
                          <td className="num">{formatNumber(row["Поступило"], 3, locale)}</td>
                          <td className="num">{formatNumber(row["Перемещено"], 3, locale)}</td>
                          <td className="num">{formatNumber(row["Реализовано"], 3, locale)}</td>
                          <td className="num">{formatNumber(row["Списано"], 3, locale)}</td>
                          <td className="num">{formatNumber(getPreparedQuantity(row), 3, locale)}</td>
                          <td className="num">{formatNumber(row["Остаток"], 3, locale)}</td>
                          <td className="num">{formatNumber(row["Факт"], 3, locale)}</td>
                          <td className="num difference">{formatNumber(getDisplayedWeightDifference(row), 3, locale)}</td>
                          <td className="num difference">{formatNumber(row["РазнСеб"], 2, locale)}</td>
                          <td className="num difference">{formatNumber(row["РазницаПр"], 2, locale)}</td>
                        </tr>
                      );
                    })}

                    <tr className="pereuchet-report-category-total">
                      <td colSpan="3">
                        {t("Pereuchet.Report.CategoryTotal", "Итого по категории")}
                      </td>
                      {PEREUCHET_REPORT_TOTAL_COLUMNS.map((column) => (
                        <td key={column.key} className="num">
                          {formatNumber(
                            sumPereuchetReportColumn(group.rows, column.key),
                            column.digits,
                            locale
                          )}
                        </td>
                      ))}
                    </tr>
                  </Fragment>
                ))}
              </tbody>

              <tfoot>
                <tr>
                  <td colSpan="3">{t("Pereuchet.Report.GrandTotal", "Итого")}</td>
                  {PEREUCHET_REPORT_TOTAL_COLUMNS.map((column) => (
                    <td key={column.key} className="num">
                      {formatNumber(
                        sumPereuchetReportColumn(visibleRows, column.key),
                        column.digits,
                        locale
                      )}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </article>
    </div>
  );
}


function getPereuchetRawReportRows(report) {
  return Array.isArray(report?.rows) ? report.rows : [];
}

function groupPereuchetRawReportRows(rows, emptyName) {
  const groups = [];
  const map = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const rawMaterial = String(row?.Siryo || "").trim() || emptyName;

    if (!map.has(rawMaterial)) {
      const group = { rawMaterial, rows: [] };
      map.set(rawMaterial, group);
      groups.push(group);
    }

    map.get(rawMaterial).rows.push(row);
  });

  return groups;
}

function sumPereuchetRawQuantity(rows) {
  return (Array.isArray(rows) ? rows : []).reduce(
    (sum, row) => sum + finiteNumber(row?.Kolvo),
    0
  );
}

function buildPereuchetRawExportModel(report, t, locale) {
  const rows = getPereuchetRawReportRows(report);
  const groups = groupPereuchetRawReportRows(
    rows,
    t("Pereuchet.RawInDishes.NoRawMaterial", "Без сырья")
  );
  const exportRows = [];

  groups.forEach((group) => {
    group.rows.forEach((row) => {
      exportRows.push({
        RawMaterial: group.rawMaterial,
        Dish: row?.NameDish || "",
        Portions: finiteNumber(row?.Porciy),
        Quantity: finiteNumber(row?.Kolvo)
      });
    });

    exportRows.push({
      RawMaterial: group.rawMaterial,
      Dish: t("Pereuchet.RawInDishes.GroupTotal", "Всего количество"),
      Portions: "",
      Quantity: sumPereuchetRawQuantity(group.rows)
    });
  });

  const date = formatDateForInput(report?.date) || "report";

  return {
    title: `${t(
      "Pereuchet.RawInDishes.Title",
      "Сырье в готовых блюдах на переучет"
    )} (${formatReportDate(report?.date, locale)})`,
    fileName: `Pereuchet_RawInDishes_${date}`,
    orientation: "portrait",
    locale,
    meta: [
      {
        label: t("Common.Warehouse", "Склад"),
        value: report?.warehouse || "—"
      }
    ],
    columns: [
      {
        key: "RawMaterial",
        title: t("Pereuchet.RawMaterial", "Сырьё"),
        type: "text",
        width: 30
      },
      {
        key: "Dish",
        title: t("Pereuchet.RawInDishes.Name", "Наименование"),
        type: "text",
        width: 44
      },
      {
        key: "Portions",
        title: t("Pereuchet.RawInDishes.Portions", "Порций"),
        type: "number",
        decimals: 3,
        width: 13
      },
      {
        key: "Quantity",
        title: t("Pereuchet.RawInDishes.Quantity", "Количество"),
        type: "number",
        decimals: 3,
        width: 13
      }
    ],
    rows: exportRows,
    footerRows: []
  };
}

function PereuchetRawInDishesReport({
  report,
  onBack,
  onExport,
  exportLoading,
  t,
  locale
}) {
  const rows = getPereuchetRawReportRows(report);
  const groups = useMemo(
    () =>
      groupPereuchetRawReportRows(
        rows,
        t("Pereuchet.RawInDishes.NoRawMaterial", "Без сырья")
      ),
    [rows, t]
  );

  return (
    <div className="pereuchet-report-page pereuchet-raw-report-page">
      <div className="module-toolbar pereuchet-report-toolbar no-print">
        <div className="toolbar-left">
          <button type="button" className="toolbar-button" onClick={onBack}>
            {t("Common.Back", "Назад")}
          </button>
        </div>

        <div className="toolbar-right pereuchet-report-actions">
          <button
            type="button"
            className="toolbar-button"
            disabled={Boolean(exportLoading)}
            onClick={() => onExport?.("xlsx")}
          >
            {t("Common.Excel", "Excel")}
          </button>

          <button
            type="button"
            className="toolbar-button"
            disabled={Boolean(exportLoading)}
            onClick={() => onExport?.("docx")}
          >
            {t("Common.Word", "Word")}
          </button>

          <button
            type="button"
            className="toolbar-button primary"
            disabled={Boolean(exportLoading)}
            onClick={() => window.print()}
          >
            {t("Common.Print", "Печать")}
          </button>
        </div>
      </div>

      <article className="pereuchet-report-sheet pereuchet-raw-report-sheet">
        <header className="pereuchet-report-header pereuchet-raw-report-header">
          <div>
            <h1>
              {t(
                "Pereuchet.RawInDishes.Title",
                "Сырье в готовых блюдах на переучет"
              )}{" "}
              ({formatReportDate(report?.date, locale)})
            </h1>
          </div>

          <div className="pereuchet-report-meta pereuchet-raw-report-meta">
            <div>
              <span>{t("Common.Warehouse", "Склад")}</span>
              <strong>{report?.warehouse || "—"}</strong>
            </div>
          </div>
        </header>

        {rows.length === 0 ? (
          <div className="pereuchet-report-empty">
            {t(
              "Pereuchet.RawInDishes.NoRows",
              "Нет сырья в готовых блюдах для выбранного переучета."
            )}
          </div>
        ) : (
          <div className="pereuchet-raw-report-table-wrap">
            <table className="pereuchet-raw-report-table">
              <colgroup>
                <col className="pereuchet-raw-report-col-name" />
                <col className="pereuchet-raw-report-col-portions" />
                <col className="pereuchet-raw-report-col-quantity" />
              </colgroup>

              <thead>
                <tr>
                  <th>{t("Pereuchet.RawInDishes.Name", "Наименование")}</th>
                  <th className="num">
                    {t("Pereuchet.RawInDishes.Portions", "Порций")}
                  </th>
                  <th className="num">
                    {t("Pereuchet.RawInDishes.Quantity", "Количество")}
                  </th>
                </tr>
              </thead>

              <tbody>
                {groups.map((group) => (
                  <Fragment key={group.rawMaterial}>
                    <tr className="pereuchet-raw-report-group-row">
                      <td colSpan="3">{group.rawMaterial}</td>
                    </tr>

                    {group.rows.map((row, index) => (
                      <tr
                        key={`${group.rawMaterial}-${row?.NameDish || "dish"}-${index}`}
                      >
                        <td title={row?.NameDish || ""}>
                          {row?.NameDish || "—"}
                        </td>
                        <td className="num">
                          {formatNumber(row?.Porciy, 3, locale)}
                        </td>
                        <td className="num">
                          {formatNumber(row?.Kolvo, 3, locale)}
                        </td>
                      </tr>
                    ))}

                    <tr className="pereuchet-raw-report-group-total">
                      <td colSpan="2">
                        {t(
                          "Pereuchet.RawInDishes.GroupTotal",
                          "Всего количество"
                        )}
                      </td>
                      <td className="num">
                        {formatNumber(
                          sumPereuchetRawQuantity(group.rows),
                          3,
                          locale
                        )}
                      </td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </div>
  );
}

function SearchableSelect({
  value,
  options,
  disabled,
  onChange,
  onKeyDown,
  placeholder,
  t = (key, fallback = "") => fallback
}) {
  const selected = options.find((item) => Number(item.ID) === Number(value));
  const [text, setText] = useState(selected?.Name || "");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const item = options.find((row) => Number(row.ID) === Number(value));
    setText(item?.Name || "");
  }, [value, options]);

  const filtered = useMemo(() => {
    const q = text.trim().toLowerCase();

    if (!q) {
      return options.slice(0, 40);
    }

    return options
      .filter((item) => String(item.Name || "").toLowerCase().includes(q))
      .slice(0, 40);
  }, [text, options]);

  return (
    <div className="searchable-select pereuchet-search">
      <input
        value={text}
        disabled={disabled}
        placeholder={placeholder || t("Pereuchet.SelectPlaceholder", "Выберите...")}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setText(event.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          setTimeout(() => setOpen(false), 150);
        }}
      />

      {open && !disabled && (
        <div className="searchable-select-list">
          {filtered.map((item) => (
            <button
              key={item.ID}
              type="button"
              className="searchable-select-option"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(item.ID);
                setText(item.Name || "");
                setOpen(false);
              }}
            >
              {item.Name}
            </button>
          ))}

          {filtered.length === 0 && (
            <div className="searchable-select-empty">
              {t("Pereuchet.NothingFound", "Ничего не найдено")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PereuchetPage({
  data,
  currentSklad,
  fetchWithAuth,
  onReload,
  onDirtyChange,
  readOnly = false,
  t = (key, fallback = "") => fallback,
  locale = "ru-RU"
}) {
  const skladId = Number(currentSklad || 1);
  const [rows, setRows] = useState([]);
  const [deletedRows, setDeletedRows] = useState([]);
  const [headerDate, setHeaderDate] = useState("");
  const [selectedPerId, setSelectedPerId] = useState(null);
  const [activeMode, setActiveMode] = useState("list");

  const [perRows, setPerRows] = useState([]);
  const [selectedPerRowId, setSelectedPerRowId] = useState(null);
  const [perChanged, setPerChanged] = useState(false);
  const [perLoading, setPerLoading] = useState(false);
  const [perError, setPerError] = useState("");
  const perInputRefs = useRef([]);

  const [pfRows, setPfRows] = useState([]);
  const [selectedPfRowId, setSelectedPfRowId] = useState(null);
  const [pfDeletedRows, setPfDeletedRows] = useState([]);
  const [dishOptions, setDishOptions] = useState([]);
  const [pfChanged, setPfChanged] = useState(false);
  const [pfLoading, setPfLoading] = useState(false);
  const [pfError, setPfError] = useState("");
  const [pfIdPer, setPfIdPer] = useState(null);

  const [reportData, setReportData] = useState(null);
  const [reportVariant, setReportVariant] = useState("brief");
  const [reportLoading, setReportLoading] = useState("");
  const [reportError, setReportError] = useState("");
  const [reportReturnMode, setReportReturnMode] = useState("list");
  const [reportExportLoading, setReportExportLoading] = useState(false);

  const [rawReportData, setRawReportData] = useState(null);
  const [rawReportLoading, setRawReportLoading] = useState(false);
  const [rawReportError, setRawReportError] = useState("");
  const [rawReportReturnMode, setRawReportReturnMode] = useState("list");
  const [rawReportExportLoading, setRawReportExportLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    const list = Array.isArray(data) ? data : [];

    const normalized = list.map((row) => ({
      ID: Number(row.ID || 0),
      Date: formatDateForInput(row.Date),
      Zakr: Boolean(row.Zakr),
      IDSklad: Number(row.IDSklad || skladId),
      _changed: false,
      _deleted: false
    }));

    setRows(normalized);
    setDeletedRows([]);
    setActiveMode("list");
    setPerRows([]);
    setSelectedPerRowId(null);
    setPerChanged(false);
    setPerError("");
    setPfRows([]);
    setSelectedPfRowId(null);
    setPfDeletedRows([]);
    setPfChanged(false);
    setPfError("");
    setPfIdPer(null);
    setReportData(null);
    setReportVariant("brief");
    setReportLoading("");
    setReportError("");
    setReportReturnMode("list");
    setReportExportLoading(false);
    setRawReportData(null);
    setRawReportLoading(false);
    setRawReportError("");
    setRawReportReturnMode("list");
    setRawReportExportLoading(false);

    if (normalized.length > 0) {
      setHeaderDate(formatDateForInput(normalized[0].Date));
      setSelectedPerId(Number(normalized[0].ID || 0));
    } else {
      setHeaderDate(new Date().toISOString().slice(0, 10));
      setSelectedPerId(null);
    }
  }, [data, skladId]);

  const selectedPerRow = useMemo(() => {
    const byId = rows.find((row) => Number(row.ID) === Number(selectedPerId));

    if (byId) {
      return byId;
    }

    return findDateRow(rows, headerDate);
  }, [rows, selectedPerId, headerDate]);

  const canOpenPf = Boolean(selectedPerRow?.ID);
  const canOpenReport = Number(selectedPerRow?.ID || 0) > 0;

  const listChanged = useMemo(
    () => rows.some((row) => row._changed || row._deleted) || deletedRows.length > 0,
    [rows, deletedRows]
  );

  const isDirty = Boolean(listChanged || perChanged || pfChanged);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    return () => {
      onDirtyChange?.(false);
    };
  }, [onDirtyChange]);

  useEffect(() => {
    function handleBeforeUnload(event) {
      if (!isDirty) return;

      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

  function confirmDiscardChanges(condition = isDirty) {
    if (!condition) return true;

    return window.confirm(t("Pereuchet.UnsavedChangesWarning", "Внимание! Вы не сохранили измененные данные!\nУверены, что хотите уйти?"));
  }

  function resetPerEditor() {
    setPerRows([]);
    setSelectedPerRowId(null);
    setPerChanged(false);
    setPerError("");
  }

  function resetPfEditor() {
    setPfRows([]);
    setSelectedPfRowId(null);
    setPfDeletedRows([]);
    setPfChanged(false);
    setPfError("");
    setPfIdPer(null);
  }

  function closeWorkEditors() {
    resetPerEditor();
    resetPfEditor();
    setActiveMode("list");
  }

  function handleHeaderDateChange(value) {
    if (readOnly) return;

    if ((perChanged || pfChanged) && !confirmDiscardChanges(perChanged || pfChanged)) {
      return;
    }

    if (perChanged || pfChanged) {
      closeWorkEditors();
    }

    setHeaderDate(value);
  }

  function updateListRow(id, field, value) {
    if (readOnly) return;

    setRows((prev) =>
      prev.map((row) =>
        row.ID === id
          ? {
              ...row,
              [field]: value,
              _changed: true
            }
          : row
      )
    );
  }

  function deleteListRow(row) {
    if (readOnly) return;

    const deletingSelected =
      Number(selectedPerId) === Number(row.ID) &&
      (perChanged || pfChanged);

    if (deletingSelected && !confirmDiscardChanges(true)) {
      return;
    }

    if (!window.confirm(t("Pereuchet.ConfirmDelete", "Вы уверены?"))) {
      return;
    }

    if (row.ID > 0) {
      setDeletedRows((prev) => [...prev, row]);
    }

    setRows((prev) => prev.filter((item) => item.ID !== row.ID));

    if (Number(selectedPerId) === Number(row.ID)) {
      closeWorkEditors();
      setSelectedPerId(null);
    }
  }

  function selectPerListRow(row) {
    const nextPerId = Number(row.ID || 0);
    const isAnotherRow = Number(selectedPerId) !== nextPerId;

    if (
      isAnotherRow &&
      (perChanged || pfChanged) &&
      !confirmDiscardChanges(perChanged || pfChanged)
    ) {
      return false;
    }

    if (isAnotherRow) {
      closeWorkEditors();
    }

    setSelectedPerId(nextPerId);
    setHeaderDate(formatDateForInput(row.Date));
    return true;
  }

  function focusPerListRow(perId) {
    window.requestAnimationFrame(() => {
      const row = document.querySelector(
        `[data-pereuchet-list-id="${Number(perId || 0)}"]`
      );

      if (!(row instanceof HTMLElement)) return;

      row.focus({ preventScroll: true });
      row.scrollIntoView({
        block: "nearest",
        inline: "nearest"
      });
    });
  }

  function handlePerListRowArrowNavigation(event, rowIndex) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    event.preventDefault();

    const direction = event.key === "ArrowDown" ? 1 : -1;
    const nextRow = rows[rowIndex + direction];

    if (!nextRow) return;
    if (!selectPerListRow(nextRow)) return;

    focusPerListRow(nextRow.ID);
  }

  function handlePerListControlArrowNavigation(event, rowIndex) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    const target = event.currentTarget;
    const currentRow = target.closest("tr");
    const currentCell = target.closest("td");
    const tbody = currentRow?.parentElement;

    if (!currentRow || !currentCell || !tbody) return;

    event.preventDefault();
    event.stopPropagation();

    const direction = event.key === "ArrowDown" ? 1 : -1;
    const nextDataRow = rows[rowIndex + direction];

    if (!nextDataRow) return;
    if (!selectPerListRow(nextDataRow)) return;

    const cellIndex = Array.from(currentRow.children).indexOf(currentCell);

    window.requestAnimationFrame(() => {
      const nextRow = tbody.querySelector(
        `[data-pereuchet-list-id="${Number(nextDataRow.ID || 0)}"]`
      );
      const nextCell = nextRow?.children?.[cellIndex];
      const nextControl = nextCell?.querySelector(
        "input:not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled)"
      );

      if (nextControl instanceof HTMLElement) {
        nextControl.focus({ preventScroll: true });
        nextControl.select?.();
        nextRow.scrollIntoView({ block: "nearest", inline: "nearest" });
        return;
      }

      focusPerListRow(nextDataRow.ID);
    });
  }

  function handlePfCellArrowNavigation(event) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    const target = event.currentTarget;
    const currentRow = target.closest("tr");
    const currentCell = target.closest("td");
    const tbody = currentRow?.parentElement;

    if (!currentRow || !currentCell || !tbody) return;

    const tableRows = Array.from(tbody.children).filter(
      (element) => element instanceof HTMLTableRowElement
    );

    const currentPfId = Number(currentRow.dataset.pereuchetPfId || 0);
    if (currentPfId) {
      setSelectedPfRowId(currentPfId);
    }

    const currentRowIndex = tableRows.indexOf(currentRow);
    const currentCellIndex = Array.from(currentRow.children).indexOf(currentCell);

    if (currentRowIndex < 0 || currentCellIndex < 0) return;

    event.preventDefault();

    const direction = event.key === "ArrowDown" ? 1 : -1;
    const nextRow = tableRows[currentRowIndex + direction];

    if (!nextRow) return;

    const nextPfId = Number(nextRow.dataset.pereuchetPfId || 0);
    if (nextPfId) {
      setSelectedPfRowId(nextPfId);
    }

    const nextCell = nextRow.children[currentCellIndex];

    if (!(nextCell instanceof HTMLTableCellElement)) return;

    const nextControl = nextCell.querySelector(
      "input:not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled)"
    );

    if (!(nextControl instanceof HTMLElement)) return;

    nextControl.focus({ preventScroll: true });
    nextControl.select?.();
    nextRow.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  function buildPerListXml() {
    const items = rows
      .map(
        (row) =>
          `<Item ID="${row.ID}" Date="${escapeXml(formatDateForApi(row.Date))}" Zakr="${row.Zakr ? 1 : 0}" IDSklad="${skladId}" />`
      )
      .join("");

    const deleted = deletedRows
      .filter((row) => row.ID > 0)
      .map((row) => `<Item ID="${row.ID}" />`)
      .join("");

    return `<PerList Sklad="${skladId}"><Items>${items}</Items><Deleted>${deleted}</Deleted></PerList>`;
  }

  function buildPfXml() {
    const items = pfRows
      .filter((row) => !row._deleted)
      .map(
        (row) =>
          `<Item ID="${row.ID}" IdPer="${pfIdPer}" IdDish="${Number(row.IdDish || 0)}" Kolvo="${escapeXml(normalizeNumber(row.Kolvo))}" />`
      )
      .join("");

    const deleted = pfDeletedRows
      .filter((row) => row.ID > 0)
      .map((row) => `<Item ID="${row.ID}" />`)
      .join("");

    return `<PerPF IdPer="${pfIdPer}" Sklad="${skladId}"><Items>${items}</Items><Deleted>${deleted}</Deleted></PerPF>`;
  }

  function buildPerXml() {
    const items = perRows
      .filter((row) => row._changed)
      .map(
        (row) =>
          `<Item ID="${row.ID}" OnFact="${escapeXml(normalizeNumber(row.OnFactInput ?? row.OnFact))}" />`
      )
      .join("");

    return `<Per Dat="${escapeXml(formatDateForApi(headerDate))}" Sklad="${skladId}"><Items>${items}</Items></Per>`;
  }

  async function saveAction(action, xml) {
    const body = new URLSearchParams();
    body.set("Action", action);
    body.set("xml", xml);

    const response = await fetchWithAuth("https://webback.bar-boss.com/wf_RefSave.php", {
      method: "POST",
      body
    });

    const text = await response.text();

    let result;

    try {
      result = JSON.parse(text);
    } catch {
      throw new Error(
        t("Pereuchet.ServerInvalidJson", "Сервер вернул не JSON: {details}")
          .replace("{details}", text.slice(0, 500))
      );
    }

    if (!response.ok || result.status === "error") {
      throw new Error(result.message || result.error || t("Pereuchet.SaveError", "Ошибка сохранения"));
    }

    return result;
  }

  async function savePerList() {
    if (readOnly) return;

    if (
      (perChanged || pfChanged) &&
      !confirmDiscardChanges(perChanged || pfChanged)
    ) {
      return;
    }

    if (perChanged || pfChanged) {
      closeWorkEditors();
    }

    try {
      setSaving(true);
      setSaveError("");

      await saveAction("SavePerList", buildPerListXml());
      await onReload?.();

      setRows((prev) => prev.map((row) => ({ ...row, _changed: false })));
      setDeletedRows([]);
      onDirtyChange?.(false);
    } catch (err) {
      setSaveError(err.message || t("Pereuchet.SaveListError", "Ошибка сохранения списка переучетов"));
    } finally {
      setSaving(false);
    }
  }

  async function loadJson(url, errorPrefix) {
    const response = await fetchWithAuth(url, { method: "GET" });
    const text = await response.text();

    let result;

    try {
      result = JSON.parse(text);
    } catch {
      throw new Error(
        t("Pereuchet.NamedInvalidJson", "{name} вернул не JSON: {details}")
          .replace("{name}", errorPrefix)
          .replace("{details}", text.slice(0, 500))
      );
    }

    if (!response.ok || result.status === "error") {
      throw new Error(result.message || result.error || errorPrefix);
    }

    return result;
  }

  async function refreshPerList() {
    const result = await loadJson(
      `https://webback.bar-boss.com/wf_SpisokPer.php?Sklad=${encodeURIComponent(skladId)}`,
      t("Pereuchet.ListRequestName", "Список переучетов")
    );

    const normalized = (Array.isArray(result) ? result : []).map((row) => ({
      ID: Number(row.ID || 0),
      Date: formatDateForInput(row.Date),
      Zakr: Boolean(row.Zakr),
      IDSklad: Number(row.IDSklad || skladId),
      _changed: false,
      _deleted: false
    }));

    setRows(normalized);
    setDeletedRows([]);

    const selected = normalized.find((row) => formatDateForInput(row.Date) === formatDateForInput(headerDate));

    if (selected?.ID) {
      setSelectedPerId(Number(selected.ID));
    }

    return normalized;
  }

  async function openPf() {
    if (
      (perChanged || pfChanged) &&
      !confirmDiscardChanges(perChanged || pfChanged)
    ) {
      return;
    }

    if (perChanged || pfChanged) {
      closeWorkEditors();
    }

    let perRow =
      rows.find((row) => Number(row.ID) === Number(selectedPerId)) ||
      selectedPerRow;

    if (!perRow?.ID) {
      const freshRows = await refreshPerList();
      perRow =
        freshRows.find((row) => Number(row.ID) === Number(selectedPerId)) ||
        findDateRow(freshRows, headerDate);
    }

    if (!perRow?.ID) {
      setPfError(t("Pereuchet.SelectedDateNotFound", "Для выбранной даты переучет еще не найден в списке. Сначала нажмите «Вывести переучет»."));
      return;
    }

    setSelectedPerId(Number(perRow.ID));
    setHeaderDate(formatDateForInput(perRow.Date));

    try {
      setPfLoading(true);
      setPfError("");
      setSaveError("");

      const [pfData, dishData] = await Promise.all([
        loadJson(
          `https://webback.bar-boss.com/wf_SpisokPerVGot.php?IdPer=${encodeURIComponent(perRow.ID)}`,
          t("Pereuchet.SemiFinishedRequestName", "Полуфабрикаты")
        ),
        loadJson(
          `https://webback.bar-boss.com/wf_DishShort.php?Sklad=${encodeURIComponent(skladId)}`,
          t("Pereuchet.DishesRequestName", "Список блюд")
        )
      ]);

      const loadedPfRows = (Array.isArray(pfData) ? pfData : []).map((row) => ({
        ID: Number(row.ID || 0),
        IdDish: Number(row.IdDish || 0),
        Kolvo: numberToInput(row.Kolvo),
        _changed: false,
        _deleted: false
      }));

      setPfRows(loadedPfRows);
      setSelectedPfRowId(loadedPfRows[0]?.ID ?? null);

      setDishOptions(Array.isArray(dishData) ? dishData : []);
      setPfDeletedRows([]);
      setPfChanged(false);
      setPfIdPer(Number(perRow.ID));
      setActiveMode("pf");
      onDirtyChange?.(listChanged);
    } catch (err) {
      setPfError(err.message || t("Pereuchet.LoadSemiFinishedError", "Ошибка загрузки полуфабрикатов"));
    } finally {
      setPfLoading(false);
    }
  }

  function updatePfRow(id, field, value) {
    if (readOnly) return;

    setPfRows((prev) =>
      prev.map((row) =>
        row.ID === id
          ? {
              ...row,
              [field]: value,
              _changed: true
            }
          : row
      )
    );

    setPfChanged(true);
  }

  function addPfRow() {
    if (readOnly) return;

    const minId = Math.min(0, ...pfRows.map((row) => Number(row.ID || 0)));
    const nextId = minId - 1;

    setPfRows((prev) => [
      ...prev,
      {
        ID: nextId,
        IdDish: 0,
        Kolvo: "",
        _changed: true,
        _deleted: false
      }
    ]);

    setSelectedPfRowId(nextId);
    setPfChanged(true);
  }

  function deletePfRow(row) {
    if (readOnly) return;

    if (!window.confirm(t("Pereuchet.ConfirmDelete", "Вы уверены?"))) {
      return;
    }

    if (row.ID > 0) {
      setPfDeletedRows((prev) => [...prev, row]);
    }

    setPfRows((prev) => {
      const nextRows = prev.filter((item) => item.ID !== row.ID);

      if (Number(selectedPfRowId) === Number(row.ID)) {
        setSelectedPfRowId(nextRows[0]?.ID ?? null);
      }

      return nextRows;
    });
    setPfChanged(true);
  }

  async function savePf() {
    if (readOnly) return;

    try {
      setSaving(true);
      setSaveError("");

      await saveAction("SavePerPF", buildPfXml());

      setPfRows((prev) => prev.map((row) => ({ ...row, _changed: false })));
      setPfDeletedRows([]);
      setPfChanged(false);
      onDirtyChange?.(listChanged);
    } catch (err) {
      setSaveError(err.message || t("Pereuchet.SaveSemiFinishedError", "Ошибка сохранения полуфабрикатов"));
    } finally {
      setSaving(false);
    }
  }

  async function openRawMaterialsReport() {
    const idPer = Number(selectedPerRow?.ID || 0);

    if (!idPer) {
      setRawReportError(
        t("Pereuchet.Report.SelectStocktake", "Сначала выберите переучет из списка.")
      );
      return;
    }

    if (
      (perChanged || pfChanged) &&
      !confirmDiscardChanges(perChanged || pfChanged)
    ) {
      return;
    }

    const reportDate = formatDateForInput(selectedPerRow?.Date || headerDate);
    const xml =
      `<Report>` +
      `<Date1>${escapeXml(reportDate)}</Date1>` +
      `<Date2>${escapeXml(reportDate)}</Date2>` +
      `<Org>0</Org>` +
      `<All>1</All>` +
      `<Skl>${escapeXml(skladId)}</Skl>` +
      `<IdKli>0</IdKli>` +
      `<IdPer>${escapeXml(idPer)}</IdPer>` +
      `</Report>`;

    try {
      setRawReportLoading(true);
      setRawReportError("");
      setReportError("");
      setSaveError("");

      const url = new URL("https://webback.bar-boss.com/wr_Reports.php");
      url.searchParams.set("Action", PEREUCHET_RAW_IN_DISHES_REPORT_ACTION);

      const response = await fetchWithAuth(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/xml; charset=utf-8"
        },
        body: xml
      });

      const text = await response.text();
      let result;

      try {
        result = JSON.parse(text);
      } catch {
        throw new Error(
          t("Pereuchet.RawInDishes.InvalidJson", "Отчет вернул не JSON: {details}")
            .replace("{details}", text.slice(0, 500))
        );
      }

      if (!response.ok || result?.status === "error") {
        throw new Error(
          result?.error ||
            result?.message ||
            t(
              "Pereuchet.RawInDishes.LoadError",
              "Ошибка формирования отчета по сырью в готовых блюдах"
            )
        );
      }

      let resultRows = [];

      if (Array.isArray(result)) {
        resultRows = result;
      } else if (Array.isArray(result?.rows)) {
        resultRows = result.rows;
      } else if (Array.isArray(result?.Rows)) {
        resultRows = result.Rows;
      } else if (Array.isArray(result?.data)) {
        resultRows = result.data;
      } else if (Array.isArray(result?.Data)) {
        resultRows = result.Data;
      } else if (result && typeof result === "object" && (result.NameDish || result.Siryo)) {
        resultRows = [result];
      }

      const firstRow = resultRows[0] || {};
      const warehouse =
        result?.["Склад"] ||
        result?.SkladName ||
        result?.Sklad ||
        firstRow?.["Склад"] ||
        firstRow?.SkladName ||
        firstRow?.Sklad ||
        String(skladId);

      setRawReportData({
        rows: resultRows,
        date: reportDate,
        warehouse: String(warehouse || skladId),
        idPer
      });
      setRawReportReturnMode(
        activeMode === "raw-report" ? "list" : activeMode
      );
      setActiveMode("raw-report");
    } catch (err) {
      setRawReportError(
        err?.message ||
          t(
            "Pereuchet.RawInDishes.LoadError",
            "Ошибка формирования отчета по сырью в готовых блюдах"
          )
      );
    } finally {
      setRawReportLoading(false);
    }
  }

  async function exportRawMaterialsReport(format) {
    if (!rawReportData || rawReportExportLoading || rawReportLoading) {
      return;
    }

    const reportModel = buildPereuchetRawExportModel(
      rawReportData,
      t,
      locale
    );

    setRawReportExportLoading(true);

    try {
      await exportReportFile({
        fetchWithAuth,
        reportModel,
        format,
        errorMessage: t("Report.ExportError", "Ошибка экспорта отчёта.")
      });
    } catch (err) {
      window.alert(
        err?.message || t("Report.ExportError", "Ошибка экспорта отчёта.")
      );
    } finally {
      setRawReportExportLoading(false);
    }
  }

  function closeRawMaterialsReport() {
    setActiveMode(rawReportReturnMode || "list");
    setRawReportError("");
  }

  async function openResultsReport(variant) {
    const idPer = Number(selectedPerRow?.ID || 0);

    if (!idPer) {
      setReportError(
        t("Pereuchet.Report.SelectStocktake", "Сначала выберите переучет из списка.")
      );
      return;
    }

    if (
      (perChanged || pfChanged) &&
      !confirmDiscardChanges(perChanged || pfChanged)
    ) {
      return;
    }

    try {
      setReportLoading(variant);
      setReportError("");
      setSaveError("");

      const result = await loadJson(
        `https://webback.bar-boss.com/wr_PereuchetRazv.php?IdPer=${encodeURIComponent(idPer)}`,
        t("Pereuchet.Report.RequestName", "Результаты переучета")
      );

      const reportObject = Array.isArray(result) ? result[0] : result;

      if (!reportObject || typeof reportObject !== "object") {
        throw new Error(
          t("Pereuchet.Report.InvalidResponse", "Сервер не вернул данные отчета.")
        );
      }

      setReportData(reportObject);
      setReportVariant(variant);
      setReportReturnMode(activeMode === "report" ? "list" : activeMode);
      setActiveMode("report");
    } catch (err) {
      setReportError(
        err.message ||
          t("Pereuchet.Report.LoadError", "Ошибка загрузки результатов переучета")
      );
    } finally {
      setReportLoading("");
    }
  }


  async function exportResultsReport(format) {
    if (
      !reportData ||
      reportExportLoading ||
      reportLoading
    ) {
      return;
    }

    const reportModel = buildPereuchetExportModel(
      reportData,
      reportVariant,
      t,
      locale
    );

    setReportExportLoading(true);

    try {
      await exportReportFile({
        fetchWithAuth,
        reportModel,
        format,
        errorMessage: t(
          "Report.ExportError",
          "Ошибка экспорта отчёта."
        )
      });
    } catch (err) {
      window.alert(
        err?.message ||
          t("Report.ExportError", "Ошибка экспорта отчёта.")
      );
    } finally {
      setReportExportLoading(false);
    }
  }

  function closeResultsReport() {
    setActiveMode(reportReturnMode || "list");
    setReportError("");
  }

  async function openPer() {
    if (readOnly && !Number(selectedPerRow?.ID || 0)) {
      setPerError(
        t(
          "Pereuchet.ReadOnlyExistingOnly",
          "В режиме только чтения можно открыть только существующий переучет."
        )
      );
      return;
    }

    if (isDirty && !confirmDiscardChanges(true)) {
      return;
    }

    if (perChanged || pfChanged) {
      closeWorkEditors();
    }

    try {
      setPerLoading(true);
      setPerError("");
      setSaveError("");

      const apiDate = formatDateForApi(headerDate);

      const result = await loadJson(
        `https://webback.bar-boss.com/wf_SpisokPerEdit.php?Dat=${encodeURIComponent(apiDate)}&Sklad=${encodeURIComponent(skladId)}`,
        t("Pereuchet.StocktakeRequestName", "Переучет")
      );

      const loadedPerRows = (Array.isArray(result) ? result : []).map((row) => ({
        ID: Number(row.ID || 0),
        Name: row.Name || "",
        Edizm: row.Edizm || "",
        Price: Number(row.Price || 0),
        Saldo0: Number(row.Saldo0 || 0),
        Postup: Number(row.Postup || 0),
        Moved: Number(row.Moved || 0),
        Realiz: Number(row.Realiz || 0),
        Spisano: Number(row.Spisano || 0),
        InPF: Number(row.InPF || 0),
        OnFact: Number(row.OnFact || 0),
        OnFactInput: numberToInput(row.OnFact),
        _changed: false
      }));

      setPerRows(loadedPerRows);
      setSelectedPerRowId(loadedPerRows[0]?.ID ?? null);
      setPerChanged(false);

      try {
        const freshRows = await refreshPerList();
        const selected = findDateRow(freshRows, headerDate);

        if (selected?.ID) {
          setSelectedPerId(Number(selected.ID));
        }
      } catch {
        // Если список не перечитался, сам переучет всё равно оставляем открытым.
      }

      setActiveMode("per");
    } catch (err) {
      setPerError(err.message || t("Pereuchet.LoadStocktakeError", "Ошибка загрузки переучета"));
    } finally {
      setPerLoading(false);
    }
  }

  function updatePerOnFact(index, value) {
    if (readOnly) return;

    setPerRows((prev) =>
      prev.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              OnFactInput: value,
              _changed: true
            }
          : row
      )
    );

    setPerChanged(true);
  }

  function handlePerOnFactKeyDown(event, index) {
    if (readOnly) return;

    const currentRow = perRows[index];
    if (currentRow) {
      setSelectedPerRowId(Number(currentRow.ID || 0));
    }

    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      event.preventDefault();

      const direction = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex = index + direction;
      const nextInput = perInputRefs.current[nextIndex];
      const nextRow = perRows[nextIndex];

      if (nextRow) {
        setSelectedPerRowId(Number(nextRow.ID || 0));
      }

      if (nextInput) {
        nextInput.focus({ preventScroll: true });
        nextInput.select();
        nextInput.closest("tr")?.scrollIntoView({
          block: "nearest",
          inline: "nearest"
        });
      }

      return;
    }

    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();

    const value = event.currentTarget.value;
    const result = calcFactExpression(value);

    if (result !== null) {
      updatePerOnFact(index, result);
    }

    const nextInput = perInputRefs.current[index + 1];
    const nextRow = perRows[index + 1];

    if (nextRow) {
      setSelectedPerRowId(Number(nextRow.ID || 0));
    }

    if (nextInput) {
      nextInput.focus();
      nextInput.select();
    }
  }

  async function savePer() {
    if (readOnly) return;

    try {
      setSaving(true);
      setSaveError("");

      await saveAction("SavePer", buildPerXml());

      setPerRows((prev) =>
        prev.map((row) => ({
          ...row,
          OnFact: Number(normalizeNumber(row.OnFactInput)),
          _changed: false
        }))
      );

      setPerChanged(false);
      onDirtyChange?.(listChanged || pfChanged);
    } catch (err) {
      setSaveError(err.message || t("Pereuchet.SaveStocktakeError", "Ошибка сохранения переучета"));
    } finally {
      setSaving(false);
    }
  }

  if (activeMode === "raw-report" && rawReportData) {
    return (
      <PereuchetRawInDishesReport
        report={rawReportData}
        onBack={closeRawMaterialsReport}
        onExport={exportRawMaterialsReport}
        exportLoading={rawReportExportLoading}
        t={t}
        locale={locale}
      />
    );
  }

  if (activeMode === "report" && reportData) {
    return (
      <PereuchetResultsReport
        report={reportData}
        variant={reportVariant}
        onBack={closeResultsReport}
        onExport={exportResultsReport}
        exportLoading={reportExportLoading}
        t={t}
        locale={locale}
      />
    );
  }

  return (
    <div className="pereuchet-page">
      <div className="module-toolbar pereuchet-toolbar">
        <div className="toolbar-left">
          <label className="toolbar-field">
            {t("Pereuchet.StocktakeDate", "Дата переучета")}
            <input
              type="date"
              className="toolbar-date"
              value={headerDate}
              disabled={readOnly}
              onChange={(event) => handleHeaderDateChange(event.target.value)}
            />
          </label>

          <button
            type="button"
            className="primary-button pereuchet-open-button"
            onClick={openPer}
            disabled={perLoading || saving || (readOnly && !canOpenReport)}
          >
            {perLoading ? t("Pereuchet.Loading", "Загрузка...") : t("Pereuchet.OpenStocktake", "Вывести переучет")}
          </button>

          <button
            type="button"
            className="small-action-button pereuchet-pf-button"
            onClick={openPf}
            disabled={!canOpenPf || pfLoading || saving}
            title={!canOpenPf ? t("Pereuchet.DateNotCreatedTitle", "Для этой даты переучет еще не создан") : ""}
          >
            {pfLoading ? t("Pereuchet.Loading", "Загрузка...") : t("Pereuchet.SemiFinished", "Полуфабрикаты")}
          </button>

          {activeMode === "pf" && (
            <button
              type="button"
              className="small-action-button pereuchet-report-button pereuchet-report-raw-button"
              onClick={openRawMaterialsReport}
              disabled={
                !canOpenReport ||
                rawReportLoading ||
                Boolean(reportLoading) ||
                saving
              }
              title={!canOpenReport ? t("Pereuchet.DateNotCreatedTitle", "Для этой даты переучет еще не создан") : ""}
            >
              {rawReportLoading
                ? t("Pereuchet.Loading", "Загрузка...")
                : t("Pereuchet.RawInDishes.Button", "Просмотр сырья")}
            </button>
          )}


          <button
            type="button"
            className="small-action-button pereuchet-report-button pereuchet-report-brief-button"
            onClick={() => openResultsReport("brief")}
            disabled={!canOpenReport || Boolean(reportLoading) || rawReportLoading || saving}
            title={!canOpenReport ? t("Pereuchet.DateNotCreatedTitle", "Для этой даты переучет еще не создан") : ""}
          >
            {reportLoading === "brief"
              ? t("Pereuchet.Loading", "Загрузка...")
              : t("Pereuchet.Report.Brief", "Кратко")}
          </button>

          <button
            type="button"
            className="small-action-button pereuchet-report-button pereuchet-report-expanded-button"
            onClick={() => openResultsReport("expanded")}
            disabled={!canOpenReport || Boolean(reportLoading) || rawReportLoading || saving}
            title={!canOpenReport ? t("Pereuchet.DateNotCreatedTitle", "Для этой даты переучет еще не создан") : ""}
          >
            {reportLoading === "expanded"
              ? t("Pereuchet.Loading", "Загрузка...")
              : t("Pereuchet.Report.Expanded", "Развернуто")}
          </button>
        </div>

        <div className="toolbar-right">
          {!readOnly && listChanged && (
            <button
              type="button"
              className="save-button save-button-active pereuchet-save-button"
              onClick={savePerList}
              disabled={saving}
            >
              {t("Pereuchet.SaveList", "Сохранить список")}
            </button>
          )}
        </div>
      </div>

      {saveError && <div className="login-error">{saveError}</div>}
      {perError && <div className="login-error">{perError}</div>}
      {pfError && <div className="login-error">{pfError}</div>}
      {reportError && <div className="login-error">{reportError}</div>}
      {rawReportError && <div className="login-error">{rawReportError}</div>}

      <div className="pereuchet-layout">
        <section className="pereuchet-list-panel">
          <div className="pereuchet-panel-title">
            <strong>{t("Pereuchet.StocktakeList", "Список переучетов")}</strong>
          </div>

          <div className="table-wrap pereuchet-list-wrap">
            <table className="data-table pereuchet-list-table">
              <colgroup>
                <col className="pereuchet-list-col-date" />
                <col className="pereuchet-list-col-closed" />
                <col className="pereuchet-list-col-delete" />
              </colgroup>

              <thead>
                <tr>
                  <th>{t("Pereuchet.Date", "Дата")}</th>
                  <th>{t("Pereuchet.ClosedShort", "Закр.")}</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr
                    key={row.ID}
                    data-pereuchet-list-id={Number(row.ID || 0)}
                    className={[
                      row._changed ? "changed-row" : "",
                      selectedPerRow?.ID === row.ID ? "selected-row" : ""
                    ].join(" ")}
                    tabIndex={selectedPerRow?.ID === row.ID ? 0 : -1}
                    onKeyDown={(event) =>
                      handlePerListRowArrowNavigation(event, rowIndex)
                    }
                    onClick={(event) => {
                      if (!selectPerListRow(row)) return;
                      event.currentTarget.focus({ preventScroll: true });
                    }}
                  >
                    <td>
                      <input
                        type="date"
                        className="table-input pereuchet-date-input"
                        value={formatDateForInput(row.Date)}
                        disabled={readOnly}
                        onClick={(event) => {
                          event.stopPropagation();
                          selectPerListRow(row);
                        }}
                        onFocus={() => selectPerListRow(row)}
                        onKeyDown={(event) =>
                          handlePerListControlArrowNavigation(event, rowIndex)
                        }
                        onChange={(event) => {
                          updateListRow(row.ID, "Date", event.target.value);
                          setSelectedPerId(Number(row.ID || 0));
                          setHeaderDate(event.target.value);
                        }}
                      />
                    </td>
                    <td className="center">
                      <input
                        type="checkbox"
                        checked={row.Zakr}
                        disabled={readOnly}
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) =>
                          handlePerListControlArrowNavigation(event, rowIndex)
                        }
                        onChange={(event) =>
                          updateListRow(row.ID, "Zakr", event.target.checked)
                        }
                      />
                    </td>
                    <td className="action-column delete-column">
                      {!readOnly && (
                        <button
                          type="button"
                          className="small-danger-button pereuchet-delete-button"
                          title={t("Pereuchet.DeleteRow", "Удалить строку")}
                          aria-label={t("Pereuchet.DeleteRow", "Удалить строку")}
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteListRow(row);
                          }}
                        >
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                ))}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan="3" className="empty-cell pereuchet-empty-row">
                      {t("Pereuchet.NoStocktakes", "Переучетов нет")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {activeMode === "pf" && (
          <section className="pereuchet-work-panel">
            <div className="pereuchet-panel-title">
              <strong>{t("Pereuchet.SemiFinished", "Полуфабрикаты")}</strong>

              {!readOnly && pfChanged && (
                <button
                  type="button"
                  className="save-button save-button-active pereuchet-save-button"
                  onClick={savePf}
                  disabled={saving}
                >
                  {t("Pereuchet.Save", "Сохранить")}
                </button>
              )}
            </div>

            {!readOnly && (
              <div className="page-toolbar">
                <button
                  type="button"
                  className="small-action-button pereuchet-add-row-button"
                  onClick={addPfRow}
                  disabled={saving}
                >
                  {t("Pereuchet.AddRow", "+ Добавить строку")}
                </button>
              </div>
            )}

            <div className="table-wrap pereuchet-pf-wrap">
              <table className="data-table pereuchet-pf-table">
                <colgroup>
                  <col className="pereuchet-pf-col-name" />
                  <col className="pereuchet-pf-col-qty" />
                  <col className="pereuchet-pf-col-delete" />
                </colgroup>

                <thead>
                  <tr>
                    <th>{t("Pereuchet.SemiFinishedItem", "Полуфабрикат")}</th>
                    <th>{t("Pereuchet.QuantityShort", "Кол-во")}</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {pfRows.map((row) => (
                    <tr
                      key={row.ID}
                      data-pereuchet-pf-id={Number(row.ID || 0)}
                      className={[
                        row._changed ? "changed-row" : "",
                        Number(selectedPfRowId) === Number(row.ID)
                          ? "selected-row"
                          : ""
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => setSelectedPfRowId(Number(row.ID || 0))}
                    >
                      <td>
                        <SearchableSelect
                          value={row.IdDish}
                          options={dishOptions}
                          disabled={readOnly}
                          t={t}
                          onKeyDown={handlePfCellArrowNavigation}
                          onChange={(value) => updatePfRow(row.ID, "IdDish", value)}
                        />
                      </td>
                      <td>
                        <input
                          className="table-input text-right"
                          value={row.Kolvo}
                          disabled={readOnly}
                          onFocus={() => setSelectedPfRowId(Number(row.ID || 0))}
                          onKeyDown={handlePfCellArrowNavigation}
                          onChange={(event) =>
                            updatePfRow(row.ID, "Kolvo", event.target.value)
                          }
                        />
                      </td>
                      <td className="action-column delete-column">
                        {!readOnly && (
                          <button
                            type="button"
                            className="small-danger-button pereuchet-delete-button"
                            title={t("Pereuchet.DeleteRow", "Удалить строку")}
                            aria-label={t("Pereuchet.DeleteRow", "Удалить строку")}
                            onClick={() => deletePfRow(row)}
                          >
                            ×
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}

                  {pfRows.length === 0 && (
                    <tr>
                      <td colSpan="3" className="empty-cell pereuchet-empty-row">
                        {t("Pereuchet.NoSemiFinished", "Полуфабрикаты не указаны")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeMode === "per" && (
          <section className="pereuchet-work-panel">
            <div className="pereuchet-panel-title">
              <strong>{t("Pereuchet.RawStocktake", "Переучет сырья")}</strong>

              {!readOnly && perChanged && (
                <button
                  type="button"
                  className="save-button save-button-active pereuchet-save-button"
                  onClick={savePer}
                  disabled={saving}
                >
                  {t("Pereuchet.Save", "Сохранить")}
                </button>
              )}
            </div>

            <div className="table-wrap pereuchet-edit-wrap">
              <table className="data-table pereuchet-edit-table">
                <colgroup>
                  <col className="pereuchet-edit-col-name" />
                  <col className="pereuchet-edit-col-unit" />
                  <col className="pereuchet-edit-col-number" />
                  <col className="pereuchet-edit-col-number" />
                  <col className="pereuchet-edit-col-number" />
                  <col className="pereuchet-edit-col-number" />
                  <col className="pereuchet-edit-col-number" />
                  <col className="pereuchet-edit-col-number" />
                  <col className="pereuchet-edit-col-number" />
                  <col className="pereuchet-edit-col-fact" />
                </colgroup>

                <thead>
                  <tr>
                    <th>{t("Pereuchet.RawMaterial", "Сырьё")}</th>
                    <th>{t("Pereuchet.UnitShort", "Ед.")}</th>
                    <th>{t("Pereuchet.Price", "Цена")}</th>
                    <th>{t("Pereuchet.OpeningShort", "Нач.")}</th>
                    <th>{t("Pereuchet.Receipts", "Приход")}</th>
                    <th>{t("Pereuchet.TransfersShort", "Перем.")}</th>
                    <th>{t("Pereuchet.SoldShort", "Реализ.")}</th>
                    <th>{t("Pereuchet.WrittenOff", "Списано")}</th>
                    <th>{t("Pereuchet.InSemiFinished", "В ПФ")}</th>
                    <th>{t("Pereuchet.Actual", "Факт")}</th>
                  </tr>
                </thead>

                <tbody>
                  {perRows.map((row, index) => (
                    <tr
                      key={row.ID}
                      className={[
                        row._changed ? "changed-row" : "",
                        Number(selectedPerRowId) === Number(row.ID)
                          ? "selected-row"
                          : ""
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => setSelectedPerRowId(Number(row.ID || 0))}
                    >
                      <td title={row.Name || ""}>{row.Name}</td>
                      <td>{row.Edizm}</td>
                      <td className="text-right">{formatNumber(row.Price, 2, locale)}</td>
                      <td className="text-right">{formatNumber(row.Saldo0, 3, locale)}</td>
                      <td className="text-right">{formatNumber(row.Postup, 3, locale)}</td>
                      <td className="text-right">{formatNumber(row.Moved, 3, locale)}</td>
                      <td className="text-right">{formatNumber(row.Realiz, 3, locale)}</td>
                      <td className="text-right">{formatNumber(row.Spisano, 3, locale)}</td>
                      <td className="text-right">{formatNumber(row.InPF, 3, locale)}</td>
                      <td>
                        <input
                          ref={(input) => {
                            perInputRefs.current[index] = input;
                          }}
                          className="table-input text-right pereuchet-fact-input"
                          value={row.OnFactInput}
                          disabled={readOnly}
                          onFocus={() => setSelectedPerRowId(Number(row.ID || 0))}
                          onChange={(event) =>
                            updatePerOnFact(index, event.target.value)
                          }
                          onKeyDown={(event) =>
                            handlePerOnFactKeyDown(event, index)
                          }
                        />
                      </td>
                    </tr>
                  ))}

                  {perRows.length === 0 && (
                    <tr>
                      <td colSpan="10" className="empty-cell pereuchet-empty-row">
                        {t("Pereuchet.NoStocktakeData", "Данных переучета нет")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeMode === "list" && (
          <section className="pereuchet-work-panel pereuchet-empty-panel">
            <div>
              {t("Pereuchet.SelectModeHint", "Выберите дату и нажмите «Вывести переучет» или «Полуфабрикаты».")}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}