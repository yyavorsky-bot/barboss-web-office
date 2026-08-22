import "./reports.css";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  exportReportFile,
  exportRevenueDocx,
  exportRevenueGraphDocx,
  exportRevenueGraphXlsx,
  exportRevenueXlsx,
  printRevenueGraphReport,
  printRevenueReport
} from "./reportExport";

const MAIN_COLUMNS = [
  { field: "Waiter", label: "Официант", kind: "text" },
  { field: "Summ", label: "Всего\nотпущено" },
  { field: "Cash", label: "Наличные" },
  { field: "SumDolg", label: "Долговые" },
  { field: "SumKred", label: "Кредиты" },
  { field: "SumDisc", label: "Сумма\nскидок" },
  { field: "Sum1", label: "Кухня" },
  { field: "Sum2", label: "Бар" },
  { field: "Sum3", label: "Посуда" },
  { field: "Sum4", label: "Кальян" },
  { field: "Sum5", label: "Кухня III" },
  { field: "Other", label: "Прочие" },
  { field: "SumBon", label: "Бонусами" },
  { field: "SumBn", label: "Expirenza" },
  { field: "SumAdv", label: "Закрыто\nавансов" },
  { field: "SumObslTotal", label: "Обслужи-\nвание" }
];


const GRAPH_COLORS = [
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

const CASH_BASE_COLUMNS = [
  { field: "NameKass", label: "Название", kind: "text" },
  { field: "Summ", label: "Наличные" },
  { field: "SumKred", label: "Кредиты" },
  { field: "SumCash", label: "Об.нал" },
  { field: "SumBN", label: "Об.бн" }
];

function normalizeRows(value) {
  return Array.isArray(value) ? value : [];
}

function numericValue(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function sumField(rows, field) {
  return rows.reduce((sum, row) => sum + numericValue(row?.[field]), 0);
}

function hasNonZeroValue(rows, field) {
  return rows.some((row) => numericValue(row?.[field]) !== 0);
}

function firstExistingField(rows, candidates) {
  for (const field of candidates) {
    if (rows.some((row) => row && Object.prototype.hasOwnProperty.call(row, field))) {
      return field;
    }
  }

  return "";
}

function formatReportDate(value) {
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!match) {
    return text;
  }

  return `${match[3]}.${match[2]}.${match[1]}`;
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

function MoneyCell({ value, formatter, blankZero = true }) {
  if (value === null || value === undefined || value === "") {
    return <td className="report-money" />;
  }

  const n = Number(value);

  if (!Number.isFinite(n) || (blankZero && n === 0)) {
    return <td className="report-money" />;
  }

  return <td className="report-money">{formatter.format(n)}</td>;
}

function HeaderLabel({ text }) {
  return String(text)
    .split("\n")
    .map((part, index) => (
      <span key={`${part}-${index}`}>
        {index > 0 && <br />}
        {part}
      </span>
    ));
}

function RevenueMainTable({ rows, formatter }) {
  return (
    <div className="report-table-scroll revenue-main-scroll">
      <table className="report-table revenue-main-table">
        <thead>
          <tr>
            {MAIN_COLUMNS.map((column) => (
              <th key={column.field} className={column.kind === "text" ? "report-text" : "report-money"}>
                <HeaderLabel text={column.label} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row?.IdWt ?? `${row?.Waiter ?? "row"}-${index}`}>
              {MAIN_COLUMNS.map((column) =>
                column.kind === "text" ? (
                  <td key={column.field} className="report-text revenue-waiter-cell">
                    {row?.[column.field] ?? ""}
                  </td>
                ) : (
                  <MoneyCell
                    key={column.field}
                    value={row?.[column.field]}
                    formatter={formatter}
                  />
                )
              )}
            </tr>
          ))}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr>
              <td className="report-text report-total-label">Итого</td>
              {MAIN_COLUMNS.slice(1).map((column) => (
                <MoneyCell
                  key={column.field}
                  value={sumField(rows, column.field)}
                  formatter={formatter}
                  blankZero
                />
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function getRevenueCashColumns(rows) {
  const cashCodeField = firstExistingField(rows, ["IdKass", "IDKass", "Kassa", "Kass", "ID", "Code"]);

  return [
    ...(cashCodeField
      ? [{ field: cashCodeField, label: "Касса", kind: "text", isCode: true }]
      : []),
    ...CASH_BASE_COLUMNS,
    ...(hasNonZeroValue(rows, "SumBon")
      ? [{ field: "SumBon", label: "Бонусами" }]
      : [])
  ];
}

function RevenueCashTable({ rows, formatter, columns }) {

  return (
    <section className="revenue-cash-section">
      <h3>Оплата по кассам:</h3>
      <div className="report-table-scroll">
        <table className="report-table revenue-cash-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={`${column.field}-${column.label}`} className={column.kind === "text" ? "report-text" : "report-money"}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row?.NameKass ?? "cash"}-${index}`}>
                {columns.map((column) =>
                  column.kind === "text" ? (
                    <td key={`${column.field}-${column.label}`} className="report-text">
                      {row?.[column.field] ?? ""}
                    </td>
                  ) : (
                    <MoneyCell
                      key={`${column.field}-${column.label}`}
                      value={row?.[column.field]}
                      formatter={formatter}
                    />
                  )
                )}
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr>
                {columns.map((column, index) => {
                  if (index === 0) {
                    return (
                      <td key={`${column.field}-total`} className="report-text report-total-label">
                        Итого
                      </td>
                    );
                  }

                  if (column.kind === "text") {
                    return <td key={`${column.field}-total`} />;
                  }

                  return (
                    <MoneyCell
                      key={`${column.field}-total`}
                      value={sumField(rows, column.field)}
                      formatter={formatter}
                      blankZero
                    />
                  );
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}

function RevenueBonusSummary({ rows, formatter }) {
  const row = rows[0] ?? {};

  const items = [
    { field: "SumBonus", label: "Пополнено бонусов:" },
    { field: "SumAdvCash", label: "Получ. авансов нал:" },
    { field: "SumAdvKred", label: "Получ. авансов кред:" }
  ];

  return (
    <section className="revenue-bonus-section" aria-label="Бонусы и авансы">
      {items.map((item) => (
        <div className="revenue-bonus-row" key={item.field}>
          <span>{item.label}</span>
          <strong>{formatter.format(numericValue(row?.[item.field]))}</strong>
        </div>
      ))}
    </section>
  );
}

function RevenueSummaryTable({ rows, formatter }) {
  if (rows.length === 0) {
    return null;
  }

  const summary = MAIN_COLUMNS.reduce((result, column) => {
    if (column.kind === "text") {
      result[column.field] = "Итого";
    } else {
      result[column.field] = sumField(rows, column.field);
    }
    return result;
  }, {});

  return (
    <div className="report-table-scroll revenue-summary-scroll">
      <table className="report-table revenue-summary-table">
        <thead>
          <tr>
            {MAIN_COLUMNS.map((column) => (
              <th key={column.field} className={column.kind === "text" ? "report-text" : "report-money"}>
                <HeaderLabel text={column.label} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {MAIN_COLUMNS.map((column) =>
              column.kind === "text" ? (
                <td key={column.field} className="report-text report-total-label">
                  {summary[column.field]}
                </td>
              ) : (
                <MoneyCell
                  key={column.field}
                  value={summary[column.field]}
                  formatter={formatter}
                />
              )
            )}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function RevenueDonutChart({ rows, formatter }) {
  const chartRows = rows
    .map((row, index) => ({
      name: String(row?.NamePodr ?? row?.name ?? `Подразделение ${index + 1}`),
      value: numericValue(row?.Summ ?? row?.summ),
      color: GRAPH_COLORS[index % GRAPH_COLORS.length]
    }))
    .filter((row) => row.value > 0);

  const total = chartRows.reduce((sum, row) => sum + row.value, 0);
  let offset = 0;

  if (chartRows.length === 0 || total <= 0) {
    return <div className="report-empty">Нет данных для графика по подразделениям.</div>;
  }

  return (
    <section className="revenue-graph-section" aria-label="Структура выручки по подразделениям">
      <div className="revenue-donut-wrap">
        <svg
          className="revenue-donut"
          viewBox="0 0 260 260"
          role="img"
          aria-label="Кольцевой график выручки по подразделениям"
        >
          <circle className="revenue-donut-track" cx="130" cy="130" r="82" />
          {chartRows.map((row) => {
            const percent = (row.value / total) * 100;
            const dashOffset = -offset;
            offset += percent;
            return (
              <circle
                key={row.name}
                className="revenue-donut-segment"
                cx="130"
                cy="130"
                r="82"
                pathLength="100"
                stroke={row.color}
                strokeDasharray={`${percent} ${100 - percent}`}
                strokeDashoffset={dashOffset}
              />
            );
          })}
          <text className="revenue-donut-center-label" x="130" y="119" textAnchor="middle">
            Выручка
          </text>
          <text className="revenue-donut-center-value" x="130" y="143" textAnchor="middle">
            {formatter.format(total)}
          </text>
        </svg>
      </div>

      <div className="revenue-graph-legend">
        <h3>Выручка по подразделениям</h3>
        {chartRows.map((row) => {
          const percent = (row.value / total) * 100;
          return (
            <div className="revenue-graph-legend-row" key={row.name}>
              <span className="revenue-graph-swatch" style={{ backgroundColor: row.color }} />
              <span className="revenue-graph-name">{row.name}</span>
              <strong className="revenue-graph-percent">{percent.toFixed(1)}%</strong>
              <span className="revenue-graph-value">{formatter.format(row.value)}</span>
            </div>
          );
        })}
        <div className="revenue-graph-legend-total">
          <span>Итого</span>
          <strong>{formatter.format(total)}</strong>
        </div>
      </div>
    </section>
  );
}

function RevenueGraphReport({ data, dateFrom, dateTo, organizationName, locale, onReload }) {
  const formatter = createMoneyFormatter(locale);
  const payload = data?.data ?? data?.Data ?? {};
  const mainRows = normalizeRows(payload?.Main ?? payload?.main);
  const graphRows = normalizeRows(payload?.Graph ?? payload?.graph);

  const exportOptions = {
    mainColumns: MAIN_COLUMNS,
    mainRows,
    graphRows,
    dateFrom,
    dateTo,
    organizationName,
    locale
  };

  return (
    <div className="reports-page revenue-report-page revenue-graph-report-page">
      <div className="report-toolbar">
        <button type="button" className="report-run-button" onClick={onReload}>
          Сформировать
        </button>
        <button
          type="button"
          className="report-action-button report-print-button"
          onClick={() => printRevenueGraphReport(exportOptions)}
        >
          Печать
        </button>
        <button
          type="button"
          className="report-action-button report-excel-button"
          onClick={() => exportRevenueGraphXlsx(exportOptions)}
        >
          Excel
        </button>
        <button
          type="button"
          className="report-action-button report-word-button"
          onClick={() => exportRevenueGraphDocx(exportOptions)}
        >
          Word
        </button>
      </div>

      <article className="revenue-report-sheet revenue-graph-report-sheet">
        <header className="revenue-report-heading">
          <h3>
            Выручка по подразделениям с {formatReportDate(dateFrom)} по {formatReportDate(dateTo)}
          </h3>
          <div className="revenue-report-org">*** {organizationName || "Все"}</div>
        </header>

        {mainRows.length > 0 ? (
          <RevenueSummaryTable rows={mainRows} formatter={formatter} />
        ) : (
          <div className="report-empty">За выбранный период данных нет.</div>
        )}

        <RevenueDonutChart rows={graphRows} formatter={formatter} />
      </article>
    </div>
  );
}

function RevenueReport({ data, dateFrom, dateTo, organizationName, locale, onReload }) {
  const formatter = createMoneyFormatter(locale);
  const payload = data?.data ?? data?.Data ?? {};
  const mainRows = normalizeRows(payload?.Main ?? payload?.main);
  const cashRows = normalizeRows(payload?.PoKassam ?? payload?.poKassam ?? payload?.pokassam);
  const bonusRows = normalizeRows(payload?.Bonuses ?? payload?.bonuses);
  const cashColumns = getRevenueCashColumns(cashRows);

  const exportOptions = {
    mainColumns: MAIN_COLUMNS,
    cashColumns,
    mainRows,
    cashRows,
    bonusRows,
    dateFrom,
    dateTo,
    organizationName,
    locale
  };

  return (
    <div className="reports-page revenue-report-page">
      <div className="report-toolbar">
        <button type="button" className="report-run-button" onClick={onReload}>
          Сформировать
        </button>
        <button
          type="button"
          className="report-action-button report-print-button"
          onClick={() => printRevenueReport(exportOptions)}
        >
          Печать
        </button>
        <button
          type="button"
          className="report-action-button report-excel-button"
          onClick={() => exportRevenueXlsx(exportOptions)}
        >
          Excel
        </button>
        <button
          type="button"
          className="report-action-button report-word-button"
          onClick={() => exportRevenueDocx(exportOptions)}
        >
          Word
        </button>
      </div>

      <article className="revenue-report-sheet">
        <header className="revenue-report-heading">
          <h3>
            Оплата по официантам с {formatReportDate(dateFrom)} по {formatReportDate(dateTo)}
          </h3>
          <div className="revenue-report-org">*** {organizationName || "Все"}</div>
        </header>

        {mainRows.length > 0 ? (
          <RevenueMainTable rows={mainRows} formatter={formatter} />
        ) : (
          <div className="report-empty">За выбранный период данных нет.</div>
        )}

        {(cashRows.length > 0 || bonusRows.length > 0) && (
          <div className="revenue-bottom-grid">
            {cashRows.length > 0 ? (
              <RevenueCashTable rows={cashRows} formatter={formatter} columns={cashColumns} />
            ) : (
              <div />
            )}

            {bonusRows.length > 0 && (
              <RevenueBonusSummary rows={bonusRows} formatter={formatter} />
            )}
          </div>
        )}
      </article>
    </div>
  );
}


function getRevenueDatesRows(data) {
  const payload = data?.data ?? data?.Data ?? data;

  if (Array.isArray(payload)) {
    return payload;
  }

  const candidates = [
    payload?.Main,
    payload?.main,
    payload?.Rows,
    payload?.rows,
    payload?.RevenueDates,
    payload?.revenueDates,
    payload?.Dates,
    payload?.dates
  ];

  return normalizeRows(candidates.find((value) => Array.isArray(value)));
}

function revenueDatesAverageCheck(row) {
  const guests = numericValue(row?.SumKl);
  if (guests <= 0) {
    return null;
  }

  return (
    numericValue(row?.Cash) +
    numericValue(row?.SumKr) +
    numericValue(row?.SumBN) +
    numericValue(row?.SumBon)
  ) / guests;
}

function getRevenueDatesColumns(all, t) {
  if (Number(all) !== 0) {
    return [
      { field: "Dat", label: t("RevenueDates.Date", "Дата"), kind: "date", width: 12, total: false },
      { field: "Cash", label: t("RevenueDates.Cash", "Наличных"), kind: "money", width: 14, total: true },
      { field: "SumDolg", label: t("RevenueDates.Debt", "Долговых"), kind: "money", width: 13, total: true },
      { field: "SumKr", label: t("RevenueDates.Cards", "Кред. карты"), kind: "money", width: 14, total: true },
      { field: "SumBN", label: t("RevenueDates.Cashless", "Безнал"), kind: "money", width: 12, total: true },
      { field: "SumBon", label: t("RevenueDates.Bonuses", "Бонусы"), kind: "money", width: 12, total: true },
      { field: "SumDisc", label: t("RevenueDates.Discounts", "Скидки"), kind: "money", width: 12, total: true },
      { field: "KolvoSch", label: t("RevenueDates.Bills", "Счетов"), kind: "count", width: 10, total: true },
      { field: "AvgSchet", label: t("RevenueDates.AvgBill", "Ср. счет"), kind: "money", width: 12, total: false },
      { field: "Dohod", label: t("RevenueDates.Income", "Доход"), kind: "money", width: 14, total: true },
      { field: "SumKl", label: t("RevenueDates.Guests", "Гостей"), kind: "count", width: 10, total: true },
      { field: "AvgGuest", label: t("RevenueDates.AvgCheck", "Ср. чек"), kind: "money", width: 12, total: false, computed: revenueDatesAverageCheck }
    ];
  }

  return [
    { field: "Dat", label: t("RevenueDates.Date", "Дата"), kind: "date", width: 13, total: false },
    { field: "Cash", label: t("RevenueDates.PaidInclCreditBonus", "Оплаченных\nвкл. кред. и бон."), kind: "money", width: 22, total: true },
    { field: "SumDolg", label: t("RevenueDates.Debt", "Долговых"), kind: "money", width: 14, total: true },
    { field: "SumDisc", label: t("RevenueDates.Discounts", "Скидки"), kind: "money", width: 14, total: true },
    { field: "KolvoSch", label: t("RevenueDates.Bills", "Счетов"), kind: "count", width: 11, total: true },
    { field: "AvgSchet", label: t("RevenueDates.AvgBill", "Ср. счет"), kind: "money", width: 14, total: false },
    { field: "Dohod", label: t("RevenueDates.Income", "Доход"), kind: "money", width: 16, total: true }
  ];
}

function revenueDatesCellValue(row, column) {
  if (typeof column.computed === "function") {
    return column.computed(row);
  }

  return row?.[column.field];
}

function formatRevenueDatesCell(value, column, formatter, integerFormatter) {
  if (column.kind === "date") {
    return formatReportDate(value);
  }

  if (value === null || value === undefined || value === "") {
    return "";
  }

  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "";
  }

  if (column.kind === "count") {
    return integerFormatter.format(number);
  }

  return formatter.format(number);
}

function RevenueDatesTable({ rows, columns, formatter, integerFormatter, t }) {
  return (
    <div className="report-table-scroll revenue-dates-scroll">
      <table className="report-table revenue-dates-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.field}
                className={column.kind === "date" ? "report-text" : "report-money"}
              >
                <HeaderLabel text={column.label} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row?.Dat ?? "date"}-${index}`}>
              {columns.map((column) => {
                const value = revenueDatesCellValue(row, column);
                return (
                  <td
                    key={column.field}
                    className={column.kind === "date" ? "report-text revenue-dates-date" : "report-money"}
                  >
                    {formatRevenueDatesCell(value, column, formatter, integerFormatter)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr>
              {columns.map((column, index) => {
                if (index === 0) {
                  return (
                    <td key={column.field} className="report-text report-total-label">
                      {t("Common.Total", "Итого")}
                    </td>
                  );
                }

                if (!column.total) {
                  return <td key={column.field} className="report-money" />;
                }

                const value = sumField(rows, column.field);
                return (
                  <td key={column.field} className="report-money">
                    {formatRevenueDatesCell(value, column, formatter, integerFormatter)}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function closePrintWindowAfterPrint(printWindow) {
  if (!printWindow) {
    return;
  }

  const closeWindow = () => {
    if (!printWindow.closed) {
      printWindow.close();
    }

    window.focus();
  };

  printWindow.addEventListener(
    "afterprint",
    () => {
      // Firefox может вызвать afterprint сразу после открытия
      // предпросмотра. В этот момент close() игнорируется.
      // После закрытия предпросмотра (в том числе по Esc)
      // фокус возвращается в служебное окно — закрываем его тогда.
      printWindow.addEventListener(
        "focus",
        closeWindow,
        { once: true }
      );

      // Chrome / Edge: afterprint приходит после закрытия preview,
      // поэтому окно закрывается сразу.
      closeWindow();
    },
    { once: true }
  );
}

function buildRevenueDatesPrintHtml({
  rows,
  columns,
  all,
  dateFrom,
  dateTo,
  scopeName,
  locale,
  t
}) {
  const formatter = createMoneyFormatter(locale);
  let integerFormatter;
  try {
    integerFormatter = new Intl.NumberFormat(locale || "ru-RU", { maximumFractionDigits: 0 });
  } catch {
    integerFormatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
  }

  const headerCells = columns
    .map((column) => `<th>${escapeHtml(String(column.label).replace(/\n/g, " "))}</th>`)
    .join("");

  const bodyRows = rows
    .map((row) => {
      const cells = columns
        .map((column) => {
          const value = revenueDatesCellValue(row, column);
          const text = formatRevenueDatesCell(value, column, formatter, integerFormatter);
          const cls = column.kind === "date" ? "text" : "number";
          return `<td class="${cls}">${escapeHtml(text)}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  const footerCells = columns
    .map((column, index) => {
      if (index === 0) {
        return `<td class="text total">${escapeHtml(t("Common.Total", "Итого"))}</td>`;
      }
      if (!column.total) {
        return '<td class="number total"></td>';
      }
      const value = sumField(rows, column.field);
      return `<td class="number total">${escapeHtml(formatRevenueDatesCell(value, column, formatter, integerFormatter))}</td>`;
    })
    .join("");

  const orientation = Number(all) !== 0 ? "landscape" : "portrait";
  const title = t("RevenueDates.Title", "Выручка по дням");

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
@page { size: A4 ${orientation}; margin: 10mm 9mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; color: #111; font-size: 8.5pt; }
.header { display: flex; justify-content: space-between; align-items: flex-end; gap: 10mm; margin: 0 0 3mm; }
h1 { margin: 0; font-size: 12pt; font-style: italic; font-weight: 700; }
.scope { font-size: 9pt; font-weight: 700; text-decoration: underline; white-space: nowrap; }
table { width: 100%; border-collapse: collapse; table-layout: auto; }
th { padding: 1.1mm 1.2mm; border-top: 0.35mm solid #333; border-bottom: 0.35mm solid #333; font-size: 7.5pt; font-weight: 400; text-align: right; white-space: nowrap; }
th:first-child { text-align: left; }
td { padding: 0.75mm 1.2mm; font-size: 8pt; line-height: 1.05; white-space: nowrap; }
td.text { text-align: left; }
td.number { text-align: right; }
tfoot td { border-top: 0.35mm solid #333; font-weight: 700; padding-top: 1mm; }
</style></head><body>
<div class="header"><h1>${escapeHtml(title)} ${escapeHtml(t("Common.From", "с"))} ${escapeHtml(formatReportDate(dateFrom))} ${escapeHtml(t("Common.To", "по"))} ${escapeHtml(formatReportDate(dateTo))}</h1><div class="scope">${escapeHtml(scopeName || "")}</div></div>
<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody><tfoot><tr>${footerCells}</tr></tfoot></table>
</body></html>`;
}

function printRevenueDatesReport(options) {
  const printWindow = window.open("", "_blank", "width=1280,height=900");

  if (!printWindow) {
    window.alert(
      options.t(
        "Reports.PrintPopupBlocked",
        "Браузер заблокировал окно печати. Разрешите всплывающие окна для Web Office."
      )
    );
    return;
  }

  printWindow.document.open();
  printWindow.document.write(buildRevenueDatesPrintHtml(options));
  printWindow.document.close();
  printWindow.focus();
  closePrintWindowAfterPrint(printWindow);
  window.setTimeout(() => printWindow.print(), 150);
}

function safeRevenueDatesFilePart(value) {
  return String(value ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

function buildRevenueDatesExportModel({
  rows,
  columns,
  all,
  dateFrom,
  dateTo,
  scopeName,
  organizationName,
  locale,
  t
}) {
  const exportRows = rows.map((row) => {
    const result = {};
    columns.forEach((column) => {
      const value = revenueDatesCellValue(row, column);
      result[column.field] = column.kind === "date" ? formatReportDate(value) : value;
    });
    return result;
  });

  const footerValues = {};
  columns.forEach((column) => {
    if (column.total) {
      footerValues[column.field] = sumField(rows, column.field);
    }
  });

  return {
    title: `${t("RevenueDates.Title", "Выручка по дням")} ${formatReportDate(dateFrom)} — ${formatReportDate(dateTo)}`,
    fileName: `RevenueDates_${safeRevenueDatesFilePart(dateFrom)}_${safeRevenueDatesFilePart(dateTo)}_${safeRevenueDatesFilePart(scopeName || "report")}`,
    orientation: Number(all) !== 0 ? "landscape" : "portrait",
    locale,
    meta: [
      {
        label: Number(all) !== 0
          ? t("RevenueDates.Organization", "Организация")
          : t("RevenueDates.Department", "Подразделение"),
        value: scopeName || organizationName || ""
      }
    ],
    columns: columns.map((column) => ({
      key: column.field,
      title: String(column.label).replace(/\n/g, " "),
      type: column.kind === "date" ? "text" : "number",
      decimals: column.kind === "count" ? 0 : column.kind === "date" ? undefined : 2,
      width: column.width
    })),
    rows: exportRows,
    footerRows: [
      {
        label: t("Common.Total", "Итого"),
        values: footerValues
      }
    ]
  };
}

function RevenueDatesReport({
  data,
  all,
  dateFrom,
  dateTo,
  organizationName,
  departmentName,
  locale,
  fetchWithAuth,
  t,
  onReload
}) {
  const rows = getRevenueDatesRows(data);
  const columns = getRevenueDatesColumns(all, t);
  const formatter = createMoneyFormatter(locale);
  let integerFormatter;
  try {
    integerFormatter = new Intl.NumberFormat(locale || "ru-RU", { maximumFractionDigits: 0 });
  } catch {
    integerFormatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
  }

  const scopeName = Number(all) !== 0 ? organizationName : departmentName;
  const commonOptions = {
    rows,
    columns,
    all,
    dateFrom,
    dateTo,
    scopeName,
    organizationName,
    locale,
    t
  };

  async function handleExport(format) {
    try {
      await exportReportFile({
        fetchWithAuth,
        reportModel: buildRevenueDatesExportModel(commonOptions),
        format,
        errorMessage: t("Report.ExportError", "Ошибка экспорта отчёта.")
      });
    } catch (err) {
      window.alert(err?.message || t("Report.ExportError", "Ошибка экспорта отчёта."));
    }
  }

  return (
    <div className="reports-page revenue-dates-report-page">
      <div className="report-toolbar">
        <button type="button" className="report-run-button" onClick={onReload}>
          {t("Common.Generate", "Сформировать")}
        </button>
        <button
          type="button"
          className="report-action-button report-print-button"
          onClick={() => printRevenueDatesReport(commonOptions)}
        >
          {t("Common.Print", "Печать")}
        </button>
        <button
          type="button"
          className="report-action-button report-excel-button"
          onClick={() => handleExport("xlsx")}
        >
          {t("Common.Excel", "Excel")}
        </button>
        <button
          type="button"
          className="report-action-button report-word-button"
          onClick={() => handleExport("docx")}
        >
          {t("Common.Word", "Word")}
        </button>
      </div>

      <article className={`revenue-report-sheet revenue-dates-sheet ${Number(all) !== 0 ? "revenue-dates-all" : "revenue-dates-one"}`}>
        <header className="revenue-report-heading revenue-dates-heading">
          <h3>
            {t("RevenueDates.Title", "Выручка по дням")} {t("Common.From", "с")} {formatReportDate(dateFrom)} {t("Common.To", "по")} {formatReportDate(dateTo)}
          </h3>
          <div className="revenue-report-org">{scopeName || ""}</div>
        </header>

        {rows.length > 0 ? (
          <RevenueDatesTable
            rows={rows}
            columns={columns}
            formatter={formatter}
            integerFormatter={integerFormatter}
            t={t}
          />
        ) : (
          <div className="report-empty">
            {t("Reports.NoDataForPeriod", "За выбранный период данных нет.")}
          </div>
        )}
      </article>
    </div>
  );
}


function getRevenueHourRows(data) {
  const payload = data?.data ?? data?.Data ?? data;

  if (Array.isArray(payload)) {
    return [...payload].sort(
      (left, right) => numericValue(left?.Hour) - numericValue(right?.Hour)
    );
  }

  const candidates = [
    payload?.Main,
    payload?.main,
    payload?.Rows,
    payload?.rows,
    payload?.RevenueHour,
    payload?.revenueHour,
    payload?.Hours,
    payload?.hours
  ];

  const rows = normalizeRows(
    candidates.find((value) => Array.isArray(value))
  );

  return [...rows].sort(
    (left, right) => numericValue(left?.Hour) - numericValue(right?.Hour)
  );
}

function formatRevenueHourRange(value) {
  const hour = Number(value);

  if (!Number.isFinite(hour)) {
    return String(value ?? "");
  }

  const normalizedHour = Math.trunc(hour);
  return `${normalizedHour}-${normalizedHour + 1}`;
}

function revenueHourAverageBill(row) {
  const bills = numericValue(row?.Qty);

  if (bills <= 0) {
    return null;
  }

  return numericValue(row?.Summ) / bills;
}

function revenueHourTotals(rows) {
  const summ = sumField(rows, "Summ");
  const summDisc = sumField(rows, "SummDisc");
  const qty = sumField(rows, "Qty");
  const guests = sumField(rows, "Kolvo");

  return {
    Summ: summ,
    SummDisc: summDisc,
    Qty: qty,
    AvgBill: qty > 0 ? summ / qty : null,
    Kolvo: guests
  };
}

function RevenueHourTable({
  rows,
  formatter,
  integerFormatter,
  t
}) {
  const totals = revenueHourTotals(rows);

  return (
    <div className="report-table-scroll revenue-hour-scroll">
      <table className="report-table revenue-hour-table">
        <thead>
          <tr>
            <th className="report-text">
              {t("RevenueHour.Hour", "Час")}
            </th>
            <th className="report-money">
              {t("RevenueHour.Amount", "Сумма")}
            </th>
            <th className="report-money">
              {t("RevenueHour.Discounts", "Скидки")}
            </th>
            <th className="report-money">
              {t("RevenueHour.Bills", "Счетов")}
            </th>
            <th className="report-money">
              {t("RevenueHour.AvgBill", "Средний счет")}
            </th>
            <th className="report-money">
              {t("RevenueHour.Guests", "Гостей")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row?.Hour ?? "hour"}-${index}`}>
              <td className="report-text revenue-hour-label">
                {formatRevenueHourRange(row?.Hour)}
              </td>
              <td className="report-money">
                {formatter.format(numericValue(row?.Summ))}
              </td>
              <td className="report-money">
                {formatter.format(numericValue(row?.SummDisc))}
              </td>
              <td className="report-money">
                {integerFormatter.format(numericValue(row?.Qty))}
              </td>
              <td className="report-money">
                {revenueHourAverageBill(row) === null
                  ? ""
                  : formatter.format(revenueHourAverageBill(row))}
              </td>
              <td className="report-money">
                {integerFormatter.format(numericValue(row?.Kolvo))}
              </td>
            </tr>
          ))}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr>
              <td className="report-text report-total-label">
                {t("Common.Total", "Итого")}
              </td>
              <td className="report-money">
                {formatter.format(totals.Summ)}
              </td>
              <td className="report-money">
                {formatter.format(totals.SummDisc)}
              </td>
              <td className="report-money">
                {integerFormatter.format(totals.Qty)}
              </td>
              <td className="report-money">
                {totals.AvgBill === null
                  ? ""
                  : formatter.format(totals.AvgBill)}
              </td>
              <td className="report-money">
                {integerFormatter.format(totals.Kolvo)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function buildRevenueHourPrintHtml({
  rows,
  dateFrom,
  dateTo,
  organizationName,
  locale,
  t
}) {
  const formatter = createMoneyFormatter(locale);
  let integerFormatter;

  try {
    integerFormatter = new Intl.NumberFormat(
      locale || "ru-RU",
      { maximumFractionDigits: 0 }
    );
  } catch {
    integerFormatter = new Intl.NumberFormat(
      "ru-RU",
      { maximumFractionDigits: 0 }
    );
  }

  const totals = revenueHourTotals(rows);

  const bodyRows = rows
    .map((row) => {
      const average = revenueHourAverageBill(row);

      return `<tr>
<td class="text">${escapeHtml(formatRevenueHourRange(row?.Hour))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.Summ)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.SummDisc)))}</td>
<td class="number">${escapeHtml(integerFormatter.format(numericValue(row?.Qty)))}</td>
<td class="number">${escapeHtml(average === null ? "" : formatter.format(average))}</td>
<td class="number">${escapeHtml(integerFormatter.format(numericValue(row?.Kolvo)))}</td>
</tr>`;
    })
    .join("");

  const title = t("RevenueHour.Title", "Выручка по часам");

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
@page { size: A4 portrait; margin: 10mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; color: #111; font-size: 9pt; }
.header { display: flex; justify-content: space-between; align-items: flex-end; gap: 8mm; margin: 0 0 4mm; }
h1 { margin: 0; font-size: 12pt; font-style: italic; font-weight: 700; }
.scope { font-size: 9pt; font-weight: 700; text-decoration: underline; white-space: nowrap; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th { padding: 1.2mm 1.4mm; border-top: 0.35mm solid #333; border-bottom: 0.35mm solid #333; font-size: 8pt; font-weight: 600; text-align: right; white-space: nowrap; }
th:first-child { text-align: left; }
td { padding: 0.9mm 1.4mm; font-size: 8.5pt; line-height: 1.05; white-space: nowrap; }
td.text { text-align: left; }
td.number { text-align: right; }
tfoot td { border-top: 0.35mm solid #333; font-weight: 700; padding-top: 1.1mm; }
</style></head><body>
<div class="header"><h1>${escapeHtml(title)} ${escapeHtml(t("Common.From", "с"))} ${escapeHtml(formatReportDate(dateFrom))} ${escapeHtml(t("Common.To", "по"))} ${escapeHtml(formatReportDate(dateTo))}</h1><div class="scope">${escapeHtml(organizationName || "")}</div></div>
<table>
<thead><tr>
<th>${escapeHtml(t("RevenueHour.Hour", "Час"))}</th>
<th>${escapeHtml(t("RevenueHour.Amount", "Сумма"))}</th>
<th>${escapeHtml(t("RevenueHour.Discounts", "Скидки"))}</th>
<th>${escapeHtml(t("RevenueHour.Bills", "Счетов"))}</th>
<th>${escapeHtml(t("RevenueHour.AvgBill", "Средний счет"))}</th>
<th>${escapeHtml(t("RevenueHour.Guests", "Гостей"))}</th>
</tr></thead>
<tbody>${bodyRows}</tbody>
<tfoot><tr>
<td class="text">${escapeHtml(t("Common.Total", "Итого"))}</td>
<td class="number">${escapeHtml(formatter.format(totals.Summ))}</td>
<td class="number">${escapeHtml(formatter.format(totals.SummDisc))}</td>
<td class="number">${escapeHtml(integerFormatter.format(totals.Qty))}</td>
<td class="number">${escapeHtml(totals.AvgBill === null ? "" : formatter.format(totals.AvgBill))}</td>
<td class="number">${escapeHtml(integerFormatter.format(totals.Kolvo))}</td>
</tr></tfoot>
</table>
</body></html>`;
}

function printRevenueHourReport(options) {
  const printWindow = window.open("", "_blank", "width=980,height=820");

  if (!printWindow) {
    window.alert(
      options.t(
        "Reports.PrintPopupBlocked",
        "Браузер заблокировал окно печати. Разрешите всплывающие окна для Web Office."
      )
    );
    return;
  }

  printWindow.document.open();
  printWindow.document.write(buildRevenueHourPrintHtml(options));
  printWindow.document.close();
  printWindow.focus();
  closePrintWindowAfterPrint(printWindow);

  window.setTimeout(() => {
    printWindow.print();
  }, 150);
}

function safeRevenueHourFilePart(value) {
  return String(value ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

function buildRevenueHourExportModel({
  rows,
  dateFrom,
  dateTo,
  organizationName,
  locale,
  t
}) {
  const totals = revenueHourTotals(rows);

  return {
    title: `${t("RevenueHour.Title", "Выручка по часам")} ${formatReportDate(dateFrom)} — ${formatReportDate(dateTo)}`,
    fileName: `RevenueHour_${safeRevenueHourFilePart(dateFrom)}_${safeRevenueHourFilePart(dateTo)}_${safeRevenueHourFilePart(organizationName || "report")}`,
    orientation: "portrait",
    locale,
    meta: [
      {
        label: t("RevenueHour.Organization", "Организация"),
        value: organizationName || ""
      }
    ],
    columns: [
      {
        key: "HourLabel",
        title: t("RevenueHour.Hour", "Час"),
        type: "text",
        width: 12
      },
      {
        key: "Summ",
        title: t("RevenueHour.Amount", "Сумма"),
        type: "number",
        decimals: 2,
        width: 15
      },
      {
        key: "SummDisc",
        title: t("RevenueHour.Discounts", "Скидки"),
        type: "number",
        decimals: 2,
        width: 15
      },
      {
        key: "Qty",
        title: t("RevenueHour.Bills", "Счетов"),
        type: "integer",
        decimals: 0,
        width: 11
      },
      {
        key: "AvgBill",
        title: t("RevenueHour.AvgBill", "Средний счет"),
        type: "number",
        decimals: 2,
        width: 15
      },
      {
        key: "Kolvo",
        title: t("RevenueHour.Guests", "Гостей"),
        type: "integer",
        decimals: 0,
        width: 11
      }
    ],
    rows: rows.map((row) => ({
      HourLabel: formatRevenueHourRange(row?.Hour),
      Summ: numericValue(row?.Summ),
      SummDisc: numericValue(row?.SummDisc),
      Qty: numericValue(row?.Qty),
      AvgBill: revenueHourAverageBill(row),
      Kolvo: numericValue(row?.Kolvo)
    })),
    footerRows: [
      {
        label: t("Common.Total", "Итого"),
        values: {
          Summ: totals.Summ,
          SummDisc: totals.SummDisc,
          Qty: totals.Qty,
          AvgBill: totals.AvgBill,
          Kolvo: totals.Kolvo
        }
      }
    ]
  };
}

function RevenueHourReport({
  data,
  dateFrom,
  dateTo,
  organizationName,
  locale,
  fetchWithAuth,
  t,
  onReload
}) {
  const rows = getRevenueHourRows(data);
  const formatter = createMoneyFormatter(locale);
  let integerFormatter;

  try {
    integerFormatter = new Intl.NumberFormat(
      locale || "ru-RU",
      { maximumFractionDigits: 0 }
    );
  } catch {
    integerFormatter = new Intl.NumberFormat(
      "ru-RU",
      { maximumFractionDigits: 0 }
    );
  }

  const commonOptions = {
    rows,
    dateFrom,
    dateTo,
    organizationName,
    locale,
    t
  };

  async function handleExport(format) {
    try {
      await exportReportFile({
        fetchWithAuth,
        reportModel: buildRevenueHourExportModel(commonOptions),
        format,
        errorMessage: t("Report.ExportError", "Ошибка экспорта отчёта.")
      });
    } catch (err) {
      window.alert(
        err?.message ||
          t("Report.ExportError", "Ошибка экспорта отчёта.")
      );
    }
  }

  return (
    <div className="reports-page revenue-hour-report-page">
      <div className="report-toolbar">
        <button
          type="button"
          className="report-run-button"
          onClick={onReload}
        >
          {t("Common.Generate", "Сформировать")}
        </button>

        <button
          type="button"
          className="report-action-button report-print-button"
          onClick={() => printRevenueHourReport(commonOptions)}
        >
          {t("Common.Print", "Печать")}
        </button>

        <button
          type="button"
          className="report-action-button report-excel-button"
          onClick={() => handleExport("xlsx")}
        >
          {t("Common.Excel", "Excel")}
        </button>

        <button
          type="button"
          className="report-action-button report-word-button"
          onClick={() => handleExport("docx")}
        >
          {t("Common.Word", "Word")}
        </button>
      </div>

      <article className="revenue-report-sheet revenue-hour-sheet">
        <header className="revenue-report-heading revenue-hour-heading">
          <h3>
            {t("RevenueHour.Title", "Выручка по часам")}{" "}
            {t("Common.From", "с")} {formatReportDate(dateFrom)}{" "}
            {t("Common.To", "по")} {formatReportDate(dateTo)}
          </h3>
          <div className="revenue-report-org">
            {organizationName || ""}
          </div>
        </header>

        {rows.length > 0 ? (
          <RevenueHourTable
            rows={rows}
            formatter={formatter}
            integerFormatter={integerFormatter}
            t={t}
          />
        ) : (
          <div className="report-empty">
            {t(
              "Reports.NoDataForPeriod",
              "За выбранный период данных нет."
            )}
          </div>
        )}
      </article>
    </div>
  );
}


function getRevenueLanchPayload(data) {
  const raw = data?.data ?? data?.Data ?? data;

  let root = raw;

  if (Array.isArray(raw)) {
    root = raw[0] ?? {};
  } else if (Array.isArray(raw?.Main)) {
    root = raw.Main[0] ?? {};
  } else if (Array.isArray(raw?.RevenueLanch)) {
    root = raw.RevenueLanch[0] ?? {};
  }

  const items = Array.isArray(root?.items)
    ? root.items
    : Array.isArray(root?.Items)
      ? root.Items
      : [];

  return {
    TimeZavtrak: String(root?.TimeZavtrak ?? "").trim(),
    TimeObed: String(root?.TimeObed ?? "").trim(),
    TimeUzin: String(root?.TimeUzin ?? "").trim(),
    items
  };
}

function formatRevenueLanchTime(value) {
  const text = String(value ?? "").trim();

  if (!text) {
    return "";
  }

  const match = text.match(/^(\d{1,2}):(\d{2})/);

  if (!match) {
    return text;
  }

  return `${String(Number(match[1])).padStart(2, "0")}:${match[2]}`;
}

function revenueLanchRanges(payload) {
  const breakfast = formatRevenueLanchTime(payload?.TimeZavtrak);
  const lunch = formatRevenueLanchTime(payload?.TimeObed);
  const dinner = formatRevenueLanchTime(payload?.TimeUzin);

  return [
    breakfast && lunch ? `${breakfast} -- ${lunch}` : "",
    lunch && dinner ? `${lunch} -- ${dinner}` : "",
    dinner && breakfast ? `${dinner} -- ${breakfast}` : ""
  ];
}

function revenueLanchAverageBill(row) {
  const bills = numericValue(row?.Bills);

  if (bills <= 0) {
    return null;
  }

  return numericValue(row?.Summ) / bills;
}

function revenueLanchTotals(rows) {
  return {
    Summ: sumField(rows, "Summ"),
    Bills: sumField(rows, "Bills")
  };
}

function RevenueLanchDonut({
  rows,
  formatter,
  t
}) {
  const chartRows = rows
    .map((row, index) => ({
      name: String(row?.Period ?? `#${index + 1}`),
      value: numericValue(row?.Summ),
      color: GRAPH_COLORS[index % GRAPH_COLORS.length]
    }))
    .filter((row) => row.value > 0);

  const total = chartRows.reduce((sum, row) => sum + row.value, 0);
  let offset = 0;

  if (chartRows.length === 0 || total <= 0) {
    return null;
  }

  return (
    <section
      className="revenue-graph-section revenue-lanch-graph-section"
      aria-label={t("RevenueLanch.Structure", "Структура выручки")}
    >
      <div className="revenue-donut-wrap">
        <svg
          className="revenue-donut"
          viewBox="0 0 260 260"
          role="img"
          aria-label={t("RevenueLanch.Structure", "Структура выручки")}
        >
          <circle
            className="revenue-donut-track"
            cx="130"
            cy="130"
            r="82"
          />

          {chartRows.map((row) => {
            const percent = (row.value / total) * 100;
            const dashOffset = -offset;
            offset += percent;

            return (
              <circle
                key={row.name}
                className="revenue-donut-segment"
                cx="130"
                cy="130"
                r="82"
                pathLength="100"
                stroke={row.color}
                strokeDasharray={`${percent} ${100 - percent}`}
                strokeDashoffset={dashOffset}
              />
            );
          })}

          <text
            className="revenue-donut-center-label"
            x="130"
            y="119"
            textAnchor="middle"
          >
            {t("RevenueLanch.Revenue", "Выручка")}
          </text>

          <text
            className="revenue-donut-center-value"
            x="130"
            y="143"
            textAnchor="middle"
          >
            {formatter.format(total)}
          </text>
        </svg>
      </div>

      <div className="revenue-graph-legend">
        <h3>
          {t("RevenueLanch.Structure", "Структура выручки")}
        </h3>

        {chartRows.map((row) => {
          const percent = (row.value / total) * 100;

          return (
            <div
              className="revenue-graph-legend-row"
              key={row.name}
            >
              <span
                className="revenue-graph-swatch"
                style={{ backgroundColor: row.color }}
              />
              <span className="revenue-graph-name">
                {row.name}
              </span>
              <strong className="revenue-graph-percent">
                {percent.toFixed(1)}%
              </strong>
              <span className="revenue-graph-value">
                {formatter.format(row.value)}
              </span>
            </div>
          );
        })}

        <div className="revenue-graph-legend-total">
          <span>{t("Common.Total", "Итого")}</span>
          <strong>{formatter.format(total)}</strong>
        </div>
      </div>
    </section>
  );
}

function RevenueLanchTable({
  payload,
  formatter,
  integerFormatter,
  t
}) {
  const rows = payload.items;
  const ranges = revenueLanchRanges(payload);
  const totals = revenueLanchTotals(rows);

  return (
    <div className="report-table-scroll revenue-lanch-scroll">
      <table className="report-table revenue-lanch-table">
        <thead>
          <tr>
            <th className="report-text">
              {t("RevenueLanch.Period", "Период")}
            </th>
            <th className="report-money">
              {t("RevenueLanch.Amount", "Сумма")}
            </th>
            <th className="report-money">
              {t("RevenueLanch.Bills", "Счетов")}
            </th>
            <th className="report-money">
              {t("RevenueLanch.AvgBill", "Ср.Счет")}
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => {
            const average = revenueLanchAverageBill(row);

            return (
              <tr key={`${row?.Period ?? "period"}-${index}`}>
                <td className="report-text">
                  <div className="revenue-lanch-period-cell">
                    <strong>{row?.Period || "—"}</strong>
                    <span>{ranges[index] || ""}</span>
                  </div>
                </td>
                <td className="report-money">
                  {formatter.format(numericValue(row?.Summ))}
                </td>
                <td className="report-money">
                  {integerFormatter.format(numericValue(row?.Bills))}
                </td>
                <td className="report-money">
                  {average === null
                    ? ""
                    : formatter.format(average)}
                </td>
              </tr>
            );
          })}
        </tbody>

        {rows.length > 0 && (
          <tfoot>
            <tr>
              <td className="report-text report-total-label">
                {t("Common.Total", "Итого")}
              </td>
              <td className="report-money">
                {formatter.format(totals.Summ)}
              </td>
              <td className="report-money">
                {integerFormatter.format(totals.Bills)}
              </td>
              <td className="report-money" />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function buildRevenueLanchPrintHtml({
  payload,
  dateFrom,
  dateTo,
  organizationName,
  locale,
  t
}) {
  const rows = payload.items;
  const ranges = revenueLanchRanges(payload);
  const totals = revenueLanchTotals(rows);
  const formatter = createMoneyFormatter(locale);

  let integerFormatter;

  try {
    integerFormatter = new Intl.NumberFormat(
      locale || "ru-RU",
      { maximumFractionDigits: 0 }
    );
  } catch {
    integerFormatter = new Intl.NumberFormat(
      "ru-RU",
      { maximumFractionDigits: 0 }
    );
  }

  const bodyRows = rows
    .map((row, index) => {
      const average = revenueLanchAverageBill(row);

      return `<tr>
<td class="period"><strong>${escapeHtml(row?.Period || "—")}</strong><span>${escapeHtml(ranges[index] || "")}</span></td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.Summ)))}</td>
<td class="number">${escapeHtml(integerFormatter.format(numericValue(row?.Bills)))}</td>
<td class="number">${escapeHtml(average === null ? "" : formatter.format(average))}</td>
</tr>`;
    })
    .join("");

  const positiveRows = rows
    .map((row, index) => ({
      name: String(row?.Period ?? `#${index + 1}`),
      value: numericValue(row?.Summ),
      color: GRAPH_COLORS[index % GRAPH_COLORS.length]
    }))
    .filter((row) => row.value > 0);

  const graphTotal = positiveRows.reduce(
    (sum, row) => sum + row.value,
    0
  );

  let offset = 0;

  const segments = positiveRows
    .map((row) => {
      const percent = graphTotal > 0
        ? (row.value / graphTotal) * 100
        : 0;
      const dashOffset = -offset;
      offset += percent;

      return `<circle cx="130" cy="130" r="82" pathLength="100" fill="none" stroke="${row.color}" stroke-width="40" stroke-dasharray="${percent} ${100 - percent}" stroke-dashoffset="${dashOffset}" transform="rotate(-90 130 130)"/>`;
    })
    .join("");

  const legend = positiveRows
    .map((row) => {
      const percent = graphTotal > 0
        ? (row.value / graphTotal) * 100
        : 0;

      return `<div class="legend-row"><span class="swatch" style="background:${row.color}"></span><span>${escapeHtml(row.name)}</span><strong>${percent.toFixed(1)}%</strong><span class="money">${escapeHtml(formatter.format(row.value))}</span></div>`;
    })
    .join("");

  const title = t("RevenueLanch.Title", "Выручка по времени");

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
@page { size: A4 portrait; margin: 9mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; color: #111; font-size: 9pt; }
.header { display: flex; justify-content: space-between; align-items: flex-end; gap: 7mm; margin-bottom: 4mm; }
h1 { margin: 0; font-size: 12pt; font-style: italic; font-weight: 700; }
.org { font-weight: 700; text-decoration: underline; white-space: nowrap; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th { padding: 1.2mm 1.4mm; border-top: 0.35mm solid #333; border-bottom: 0.35mm solid #333; font-size: 8pt; font-weight: 600; text-align: right; white-space: nowrap; }
th:first-child { text-align: left; }
td { padding: 1.05mm 1.4mm; font-size: 8.5pt; line-height: 1.05; }
td.period { display: flex; justify-content: space-between; gap: 4mm; white-space: nowrap; }
td.period span { color: #555; }
td.number { text-align: right; white-space: nowrap; }
tfoot td { border-top: 0.35mm solid #333; font-weight: 700; padding-top: 1.2mm; }
.graph { display: table; width: 92%; margin: 8mm auto 0; table-layout: fixed; }
.chart-wrap, .legend { display: table-cell; vertical-align: middle; }
.chart-wrap { width: 48%; text-align: center; }
.chart { width: 70mm; height: 70mm; }
.legend { width: 52%; padding-left: 5mm; }
.legend h2 { margin: 0 0 2mm; font-size: 10pt; }
.legend-row { display: grid; grid-template-columns: 4mm 1fr 13mm 26mm; gap: 2mm; align-items: center; padding: 1.2mm 0; border-bottom: 0.2mm dotted #bbb; }
.swatch { width: 3mm; height: 3mm; display: inline-block; }
.legend-row strong, .legend-row .money { text-align: right; }
.legend-total { display: flex; justify-content: space-between; margin-top: 2mm; padding-top: 2mm; border-top: 0.3mm solid #555; font-weight: 700; }
</style></head><body>
<div class="header"><h1>${escapeHtml(title)} ${escapeHtml(t("Common.From", "с"))} ${escapeHtml(formatReportDate(dateFrom))} ${escapeHtml(t("Common.To", "по"))} ${escapeHtml(formatReportDate(dateTo))}</h1><div class="org">${escapeHtml(organizationName || "")}</div></div>
<table>
<thead><tr>
<th>${escapeHtml(t("RevenueLanch.Period", "Период"))}</th>
<th>${escapeHtml(t("RevenueLanch.Amount", "Сумма"))}</th>
<th>${escapeHtml(t("RevenueLanch.Bills", "Счетов"))}</th>
<th>${escapeHtml(t("RevenueLanch.AvgBill", "Ср.Счет"))}</th>
</tr></thead>
<tbody>${bodyRows}</tbody>
<tfoot><tr>
<td>${escapeHtml(t("Common.Total", "Итого"))}</td>
<td class="number">${escapeHtml(formatter.format(totals.Summ))}</td>
<td class="number">${escapeHtml(integerFormatter.format(totals.Bills))}</td>
<td class="number"></td>
</tr></tfoot>
</table>
${graphTotal > 0 ? `<div class="graph"><div class="chart-wrap"><svg class="chart" viewBox="0 0 260 260"><circle cx="130" cy="130" r="82" fill="none" stroke="#edf0f1" stroke-width="40"/>${segments}<text x="130" y="119" text-anchor="middle" font-size="13" font-weight="600" fill="#666">${escapeHtml(t("RevenueLanch.Revenue", "Выручка"))}</text><text x="130" y="143" text-anchor="middle" font-size="15" font-weight="800">${escapeHtml(formatter.format(graphTotal))}</text></svg></div><div class="legend"><h2>${escapeHtml(t("RevenueLanch.Structure", "Структура выручки"))}</h2>${legend}<div class="legend-total"><span>${escapeHtml(t("Common.Total", "Итого"))}</span><strong>${escapeHtml(formatter.format(graphTotal))}</strong></div></div></div>` : ""}
</body></html>`;
}

function printRevenueLanchReport(options) {
  const printWindow = window.open(
    "",
    "_blank",
    "width=980,height=820"
  );

  if (!printWindow) {
    window.alert(
      options.t(
        "Reports.PrintPopupBlocked",
        "Браузер заблокировал окно печати. Разрешите всплывающие окна для Web Office."
      )
    );
    return;
  }

  printWindow.document.open();
  printWindow.document.write(
    buildRevenueLanchPrintHtml(options)
  );
  printWindow.document.close();
  printWindow.focus();
  closePrintWindowAfterPrint(printWindow);

  window.setTimeout(() => {
    printWindow.print();
  }, 150);
}

function safeRevenueLanchFilePart(value) {
  return String(value ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

function buildRevenueLanchExportModel({
  payload,
  dateFrom,
  dateTo,
  organizationName,
  locale,
  t
}) {
  const rows = payload.items;
  const ranges = revenueLanchRanges(payload);
  const totals = revenueLanchTotals(rows);

  return {
    title: `${t("RevenueLanch.Title", "Выручка по времени")} ${formatReportDate(dateFrom)} — ${formatReportDate(dateTo)}`,
    fileName: `RevenueLanch_${safeRevenueLanchFilePart(dateFrom)}_${safeRevenueLanchFilePart(dateTo)}_${safeRevenueLanchFilePart(organizationName || "report")}`,
    orientation: "portrait",
    locale,
    meta: [
      {
        label: t("RevenueLanch.Organization", "Организация"),
        value: organizationName || ""
      }
    ],
    columns: [
      {
        key: "Period",
        title: t("RevenueLanch.Period", "Период"),
        type: "text",
        width: 34
      },
      {
        key: "Summ",
        title: t("RevenueLanch.Amount", "Сумма"),
        type: "number",
        decimals: 2,
        width: 16
      },
      {
        key: "Bills",
        title: t("RevenueLanch.Bills", "Счетов"),
        type: "integer",
        decimals: 0,
        width: 12
      },
      {
        key: "AvgBill",
        title: t("RevenueLanch.AvgBill", "Ср.Счет"),
        type: "number",
        decimals: 2,
        width: 16
      }
    ],
    rows: rows.map((row, index) => ({
      Period: `${row?.Period || ""}${
        ranges[index] ? `  ${ranges[index]}` : ""
      }`,
      Summ: numericValue(row?.Summ),
      Bills: numericValue(row?.Bills),
      AvgBill: revenueLanchAverageBill(row)
    })),
    footerRows: [
      {
        label: t("Common.Total", "Итого"),
        values: {
          Summ: totals.Summ,
          Bills: totals.Bills,
          AvgBill: null
        }
      }
    ]
  };
}

function RevenueLanchReport({
  data,
  dateFrom,
  dateTo,
  organizationName,
  locale,
  fetchWithAuth,
  t,
  onReload
}) {
  const payload = getRevenueLanchPayload(data);
  const rows = payload.items;
  const formatter = createMoneyFormatter(locale);

  let integerFormatter;

  try {
    integerFormatter = new Intl.NumberFormat(
      locale || "ru-RU",
      { maximumFractionDigits: 0 }
    );
  } catch {
    integerFormatter = new Intl.NumberFormat(
      "ru-RU",
      { maximumFractionDigits: 0 }
    );
  }

  const commonOptions = {
    payload,
    dateFrom,
    dateTo,
    organizationName,
    locale,
    t
  };

  async function handleExport(format) {
    try {
      await exportReportFile({
        fetchWithAuth,
        reportModel: buildRevenueLanchExportModel(commonOptions),
        format,
        errorMessage: t(
          "Report.ExportError",
          "Ошибка экспорта отчёта."
        )
      });
    } catch (err) {
      window.alert(
        err?.message ||
          t(
            "Report.ExportError",
            "Ошибка экспорта отчёта."
          )
      );
    }
  }

  return (
    <div className="reports-page revenue-lanch-report-page">
      <div className="report-toolbar">
        <button
          type="button"
          className="report-run-button"
          onClick={onReload}
        >
          {t("Common.Generate", "Сформировать")}
        </button>

        <button
          type="button"
          className="report-action-button report-print-button"
          onClick={() => printRevenueLanchReport(commonOptions)}
        >
          {t("Common.Print", "Печать")}
        </button>

        <button
          type="button"
          className="report-action-button report-excel-button"
          onClick={() => handleExport("xlsx")}
        >
          {t("Common.Excel", "Excel")}
        </button>

        <button
          type="button"
          className="report-action-button report-word-button"
          onClick={() => handleExport("docx")}
        >
          {t("Common.Word", "Word")}
        </button>
      </div>

      <article className="revenue-report-sheet revenue-lanch-sheet">
        <header className="revenue-report-heading revenue-lanch-heading">
          <h3>
            {t("RevenueLanch.Title", "Выручка по времени")}{" "}
            {t("Common.From", "с")} {formatReportDate(dateFrom)}{" "}
            {t("Common.To", "по")} {formatReportDate(dateTo)}
          </h3>

          <div className="revenue-report-org">
            {organizationName || ""}
          </div>
        </header>

        {rows.length > 0 ? (
          <>
            <RevenueLanchTable
              payload={payload}
              formatter={formatter}
              integerFormatter={integerFormatter}
              t={t}
            />

            <RevenueLanchDonut
              rows={rows}
              formatter={formatter}
              t={t}
            />
          </>
        ) : (
          <div className="report-empty">
            {t(
              "Reports.NoDataForPeriod",
              "За выбранный период данных нет."
            )}
          </div>
        )}
      </article>
    </div>
  );
}


function getRevenueDohodRows(data) {
  const payload = data?.data ?? data?.Data ?? data;

  if (Array.isArray(payload)) {
    return payload;
  }

  const candidates = [
    payload?.Main,
    payload?.main,
    payload?.Rows,
    payload?.rows,
    payload?.RevenueDohod,
    payload?.revenueDohod,
    payload?.Items,
    payload?.items
  ];

  return normalizeRows(
    candidates.find((value) => Array.isArray(value))
  );
}

function revenueDohodPeriodDays(dateFrom, dateTo) {
  const parseDate = (value) => {
    const text = String(value ?? "").trim();
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (iso) {
      return Date.UTC(
        Number(iso[1]),
        Number(iso[2]) - 1,
        Number(iso[3])
      );
    }

    const local = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);

    if (local) {
      return Date.UTC(
        Number(local[3]),
        Number(local[2]) - 1,
        Number(local[1])
      );
    }

    return NaN;
  };

  const from = parseDate(dateFrom);
  const to = parseDate(dateTo);

  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) {
    return 0;
  }

  return Math.floor((to - from) / 86400000) + 1;
}

function revenueDohodAverageRevenue(sumTotal, days) {
  if (days <= 0) {
    return null;
  }

  return numericValue(sumTotal) / days;
}

function revenueDohodTotals(rows, days) {
  const sumTotal = sumField(rows, "SumTotal");
  const sumDolg = sumField(rows, "SumDolg");
  const sumSeb = sumField(rows, "SumSeb");
  const dohod = sumField(rows, "Dohod");

  return {
    SumTotal: sumTotal,
    SumDolg: sumDolg,
    SumSeb: sumSeb,
    Dohod: dohod,
    Rate: sumSeb !== 0 ? sumTotal / sumSeb : null,
    AvgRevenue: revenueDohodAverageRevenue(sumTotal, days)
  };
}

function RevenueDohodTable({
  rows,
  days,
  formatter,
  integerFormatter,
  rateFormatter,
  t
}) {
  const totals = revenueDohodTotals(rows, days);

  return (
    <div className="report-table-scroll revenue-dohod-scroll">
      <table className="report-table revenue-dohod-table">
        <thead>
          <tr>
            <th className="report-text">
              {t("RevenueDohod.Warehouse", "Склад")}
            </th>
            <th className="report-money">
              {t("RevenueDohod.Released", "Отпущено")}
            </th>
            <th className="report-money">
              {t("RevenueDohod.Debt", "в т.ч. долговых")}
            </th>
            <th className="report-money">
              {t("RevenueDohod.Cost", "По себест.")}
            </th>
            <th className="report-money">
              {t("RevenueDohod.Income", "Доход")}
            </th>
            <th className="report-money">
              {t("RevenueDohod.Rate", "Коэф.")}
            </th>
            <th className="report-money">
              {t("RevenueDohod.AvgRevenue", "Ср.выручка")}
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row?.Id ?? row?.NameSkl ?? "row"}-${index}`}>
              <td className="report-text">
                {row?.NameSkl || "—"}
              </td>
              <td className="report-money">
                {formatter.format(numericValue(row?.SumTotal))}
              </td>
              <td className="report-money">
                {formatter.format(numericValue(row?.SumDolg))}
              </td>
              <td className="report-money">
                {formatter.format(numericValue(row?.SumSeb))}
              </td>
              <td className="report-money">
                {formatter.format(numericValue(row?.Dohod))}
              </td>
              <td className="report-money">
                {rateFormatter.format(numericValue(row?.Rate))}
              </td>
              <td className="report-money">
                {integerFormatter.format(
                  revenueDohodAverageRevenue(row?.SumTotal, days) ?? 0
                )}
              </td>
            </tr>
          ))}
        </tbody>

        {rows.length > 0 && (
          <tfoot>
            <tr>
              <td className="report-text report-total-label">
                {t("Common.Total", "Итого")}
              </td>
              <td className="report-money">
                {formatter.format(totals.SumTotal)}
              </td>
              <td className="report-money">
                {formatter.format(totals.SumDolg)}
              </td>
              <td className="report-money">
                {formatter.format(totals.SumSeb)}
              </td>
              <td className="report-money">
                {formatter.format(totals.Dohod)}
              </td>
              <td className="report-money">
                {totals.Rate === null
                  ? ""
                  : rateFormatter.format(totals.Rate)}
              </td>
              <td className="report-money">
                {totals.AvgRevenue === null
                  ? ""
                  : integerFormatter.format(totals.AvgRevenue)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function buildRevenueDohodPrintHtml({
  rows,
  dateFrom,
  dateTo,
  organizationName,
  locale,
  t
}) {
  const formatter = createMoneyFormatter(locale);
  const days = revenueDohodPeriodDays(dateFrom, dateTo);
  const totals = revenueDohodTotals(rows, days);

  let integerFormatter;
  let rateFormatter;

  try {
    integerFormatter = new Intl.NumberFormat(
      locale || "ru-RU",
      { maximumFractionDigits: 0 }
    );
    rateFormatter = new Intl.NumberFormat(
      locale || "ru-RU",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }
    );
  } catch {
    integerFormatter = new Intl.NumberFormat(
      "ru-RU",
      { maximumFractionDigits: 0 }
    );
    rateFormatter = new Intl.NumberFormat(
      "ru-RU",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }
    );
  }

  const bodyRows = rows
    .map((row) => {
      const avgRevenue = revenueDohodAverageRevenue(
        row?.SumTotal,
        days
      );

      return `<tr>
<td class="text">${escapeHtml(row?.NameSkl || "—")}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.SumTotal)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.SumDolg)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.SumSeb)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.Dohod)))}</td>
<td class="number">${escapeHtml(rateFormatter.format(numericValue(row?.Rate)))}</td>
<td class="number">${escapeHtml(avgRevenue === null ? "" : integerFormatter.format(avgRevenue))}</td>
</tr>`;
    })
    .join("");

  const title = t(
    "RevenueDohod.Title",
    "Валовый доход за период"
  );

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
@page { size: A4 landscape; margin: 9mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; color: #111; font-size: 9pt; }
.header { display: flex; justify-content: space-between; align-items: flex-end; gap: 8mm; margin-bottom: 4mm; }
h1 { margin: 0; font-size: 12pt; font-style: italic; font-weight: 700; }
.org { font-size: 9pt; font-weight: 700; text-decoration: underline; white-space: nowrap; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th { padding: 1.2mm 1.3mm; border-top: 0.35mm solid #333; border-bottom: 0.35mm solid #333; font-size: 8pt; font-weight: 600; text-align: right; white-space: nowrap; }
th:first-child { text-align: left; }
td { padding: 0.9mm 1.3mm; font-size: 8.5pt; line-height: 1.05; white-space: nowrap; }
td.text { text-align: left; }
td.number { text-align: right; }
tfoot td { border-top: 0.35mm solid #333; font-weight: 700; padding-top: 1.1mm; }
</style></head><body>
<div class="header"><h1>${escapeHtml(title)} ${escapeHtml(t("Common.From", "с"))} ${escapeHtml(formatReportDate(dateFrom))} ${escapeHtml(t("Common.To", "по"))} ${escapeHtml(formatReportDate(dateTo))}</h1><div class="org">${escapeHtml(organizationName || "")}</div></div>
<table>
<thead><tr>
<th>${escapeHtml(t("RevenueDohod.Warehouse", "Склад"))}</th>
<th>${escapeHtml(t("RevenueDohod.Released", "Отпущено"))}</th>
<th>${escapeHtml(t("RevenueDohod.Debt", "в т.ч. долговых"))}</th>
<th>${escapeHtml(t("RevenueDohod.Cost", "По себест."))}</th>
<th>${escapeHtml(t("RevenueDohod.Income", "Доход"))}</th>
<th>${escapeHtml(t("RevenueDohod.Rate", "Коэф."))}</th>
<th>${escapeHtml(t("RevenueDohod.AvgRevenue", "Ср.выручка"))}</th>
</tr></thead>
<tbody>${bodyRows}</tbody>
<tfoot><tr>
<td class="text">${escapeHtml(t("Common.Total", "Итого"))}</td>
<td class="number">${escapeHtml(formatter.format(totals.SumTotal))}</td>
<td class="number">${escapeHtml(formatter.format(totals.SumDolg))}</td>
<td class="number">${escapeHtml(formatter.format(totals.SumSeb))}</td>
<td class="number">${escapeHtml(formatter.format(totals.Dohod))}</td>
<td class="number">${escapeHtml(totals.Rate === null ? "" : rateFormatter.format(totals.Rate))}</td>
<td class="number">${escapeHtml(totals.AvgRevenue === null ? "" : integerFormatter.format(totals.AvgRevenue))}</td>
</tr></tfoot>
</table>
</body></html>`;
}

function printRevenueDohodReport(options) {
  const printWindow = window.open(
    "",
    "_blank",
    "width=1180,height=820"
  );

  if (!printWindow) {
    window.alert(
      options.t(
        "Reports.PrintPopupBlocked",
        "Браузер заблокировал окно печати. Разрешите всплывающие окна для Web Office."
      )
    );
    return;
  }

  printWindow.document.open();
  printWindow.document.write(
    buildRevenueDohodPrintHtml(options)
  );
  printWindow.document.close();
  printWindow.focus();
  closePrintWindowAfterPrint(printWindow);

  window.setTimeout(() => {
    printWindow.print();
  }, 150);
}

function safeRevenueDohodFilePart(value) {
  return String(value ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

function buildRevenueDohodExportModel({
  rows,
  dateFrom,
  dateTo,
  organizationName,
  locale,
  t
}) {
  const days = revenueDohodPeriodDays(dateFrom, dateTo);
  const totals = revenueDohodTotals(rows, days);

  return {
    title: `${t("RevenueDohod.Title", "Валовый доход за период")} ${formatReportDate(dateFrom)} — ${formatReportDate(dateTo)}`,
    fileName: `RevenueDohod_${safeRevenueDohodFilePart(dateFrom)}_${safeRevenueDohodFilePart(dateTo)}_${safeRevenueDohodFilePart(organizationName || "report")}`,
    orientation: "landscape",
    locale,
    meta: [
      {
        label: t("RevenueDohod.Organization", "Организация"),
        value: organizationName || ""
      }
    ],
    columns: [
      {
        key: "NameSkl",
        title: t("RevenueDohod.Warehouse", "Склад"),
        type: "text",
        width: 25
      },
      {
        key: "SumTotal",
        title: t("RevenueDohod.Released", "Отпущено"),
        type: "number",
        decimals: 2,
        width: 16
      },
      {
        key: "SumDolg",
        title: t("RevenueDohod.Debt", "в т.ч. долговых"),
        type: "number",
        decimals: 2,
        width: 16
      },
      {
        key: "SumSeb",
        title: t("RevenueDohod.Cost", "По себест."),
        type: "number",
        decimals: 2,
        width: 16
      },
      {
        key: "Dohod",
        title: t("RevenueDohod.Income", "Доход"),
        type: "number",
        decimals: 2,
        width: 16
      },
      {
        key: "Rate",
        title: t("RevenueDohod.Rate", "Коэф."),
        type: "number",
        decimals: 2,
        width: 11
      },
      {
        key: "AvgRevenue",
        title: t("RevenueDohod.AvgRevenue", "Ср.выручка"),
        type: "integer",
        decimals: 0,
        width: 15
      }
    ],
    rows: rows.map((row) => ({
      NameSkl: row?.NameSkl || "",
      SumTotal: numericValue(row?.SumTotal),
      SumDolg: numericValue(row?.SumDolg),
      SumSeb: numericValue(row?.SumSeb),
      Dohod: numericValue(row?.Dohod),
      Rate: numericValue(row?.Rate),
      AvgRevenue: revenueDohodAverageRevenue(
        row?.SumTotal,
        days
      )
    })),
    footerRows: [
      {
        label: t("Common.Total", "Итого"),
        values: {
          SumTotal: totals.SumTotal,
          SumDolg: totals.SumDolg,
          SumSeb: totals.SumSeb,
          Dohod: totals.Dohod,
          Rate: totals.Rate,
          AvgRevenue: totals.AvgRevenue
        }
      }
    ]
  };
}

function RevenueDohodReport({
  data,
  dateFrom,
  dateTo,
  organizationName,
  locale,
  fetchWithAuth,
  t,
  onReload
}) {
  const rows = getRevenueDohodRows(data);
  const formatter = createMoneyFormatter(locale);
  const days = revenueDohodPeriodDays(dateFrom, dateTo);

  let integerFormatter;
  let rateFormatter;

  try {
    integerFormatter = new Intl.NumberFormat(
      locale || "ru-RU",
      { maximumFractionDigits: 0 }
    );
    rateFormatter = new Intl.NumberFormat(
      locale || "ru-RU",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }
    );
  } catch {
    integerFormatter = new Intl.NumberFormat(
      "ru-RU",
      { maximumFractionDigits: 0 }
    );
    rateFormatter = new Intl.NumberFormat(
      "ru-RU",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }
    );
  }

  const commonOptions = {
    rows,
    dateFrom,
    dateTo,
    organizationName,
    locale,
    t
  };

  async function handleExport(format) {
    try {
      await exportReportFile({
        fetchWithAuth,
        reportModel: buildRevenueDohodExportModel(
          commonOptions
        ),
        format,
        errorMessage: t(
          "Report.ExportError",
          "Ошибка экспорта отчёта."
        )
      });
    } catch (err) {
      window.alert(
        err?.message ||
          t(
            "Report.ExportError",
            "Ошибка экспорта отчёта."
          )
      );
    }
  }

  return (
    <div className="reports-page revenue-dohod-report-page">
      <div className="report-toolbar">
        <button
          type="button"
          className="report-run-button"
          onClick={onReload}
        >
          {t("Common.Generate", "Сформировать")}
        </button>

        <button
          type="button"
          className="report-action-button report-print-button"
          onClick={() => printRevenueDohodReport(commonOptions)}
        >
          {t("Common.Print", "Печать")}
        </button>

        <button
          type="button"
          className="report-action-button report-excel-button"
          onClick={() => handleExport("xlsx")}
        >
          {t("Common.Excel", "Excel")}
        </button>

        <button
          type="button"
          className="report-action-button report-word-button"
          onClick={() => handleExport("docx")}
        >
          {t("Common.Word", "Word")}
        </button>
      </div>

      <article className="revenue-report-sheet revenue-dohod-sheet">
        <header className="revenue-report-heading revenue-dohod-heading">
          <h3>
            {t(
              "RevenueDohod.Title",
              "Валовый доход за период"
            )}{" "}
            {t("Common.From", "с")} {formatReportDate(dateFrom)}{" "}
            {t("Common.To", "по")} {formatReportDate(dateTo)}
          </h3>

          <div className="revenue-report-org">
            {organizationName || ""}
          </div>
        </header>

        {rows.length > 0 ? (
          <RevenueDohodTable
            rows={rows}
            days={days}
            formatter={formatter}
            integerFormatter={integerFormatter}
            rateFormatter={rateFormatter}
            t={t}
          />
        ) : (
          <div className="report-empty">
            {t(
              "Reports.NoDataForPeriod",
              "За выбранный период данных нет."
            )}
          </div>
        )}
      </article>
    </div>
  );
}


function getReestrBillRows(data) {
  const payload = data?.data ?? data?.Data ?? data;

  if (Array.isArray(payload)) {
    return payload;
  }

  const candidates = [
    payload?.Main,
    payload?.main,
    payload?.Rows,
    payload?.rows,
    payload?.ReestrBill,
    payload?.reestrBill,
    payload?.Bills,
    payload?.bills,
    payload?.Items,
    payload?.items
  ];

  return normalizeRows(
    candidates.find((value) => Array.isArray(value))
  );
}

function reestrBillDateKey(value) {
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!match) {
    return text || "unknown";
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}

function formatReestrBillDate(value, locale) {
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!match) {
    return text || "—";
  }

  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  );

  try {
    return date.toLocaleDateString(locale || "ru-RU");
  } catch {
    return date.toLocaleDateString("ru-RU");
  }
}

function formatReestrBillTime(value) {
  const text = String(value ?? "").trim();
  const match = text.match(/[T\s](\d{2}):(\d{2})/);

  if (!match) {
    return "";
  }

  return `${match[1]}:${match[2]}`;
}

function reestrBillItems(bill) {
  if (Array.isArray(bill?.items)) {
    return bill.items;
  }

  if (Array.isArray(bill?.Items)) {
    return bill.Items;
  }

  return [];
}

function reestrBillAmount(bill) {
  return reestrBillItems(bill).reduce(
    (sum, item) => sum + numericValue(item?.Summ),
    0
  );
}

function reestrBillGroupByDate(rows) {
  const sorted = [...rows].sort((left, right) => {
    const leftText = String(left?.Oplachen ?? "");
    const rightText = String(right?.Oplachen ?? "");

    if (leftText !== rightText) {
      return leftText.localeCompare(rightText);
    }

    return numericValue(left?.Number) - numericValue(right?.Number);
  });

  const groups = [];

  for (const bill of sorted) {
    const key = reestrBillDateKey(bill?.Oplachen);
    let group = groups[groups.length - 1];

    if (!group || group.key !== key) {
      group = {
        key,
        dateValue: bill?.Oplachen ?? "",
        bills: []
      };
      groups.push(group);
    }

    group.bills.push(bill);
  }

  return groups;
}

function reestrBillGroupAmount(group) {
  return group.bills.reduce(
    (sum, bill) => sum + reestrBillAmount(bill),
    0
  );
}

function ReportBooleanCheckbox({
  value,
  label
}) {
  return (
    <input
      type="checkbox"
      className="report-boolean-checkbox"
      checked={Boolean(value)}
      readOnly
      tabIndex={-1}
      aria-label={label}
    />
  );
}

function ReestrBillReportTable({
  rows,
  formatter,
  integerFormatter,
  locale,
  t
}) {
  const groups = reestrBillGroupByDate(rows);
  const totalAmount = rows.reduce(
    (sum, bill) => sum + reestrBillAmount(bill),
    0
  );

  return (
    <div className="reestr-bill-groups">
      {groups.map((group) => (
        <section
          className="reestr-bill-day"
          key={group.key}
        >
          <div className="reestr-bill-day-header">
            <strong>
              {formatReestrBillDate(group.dateValue, locale)}
            </strong>

            <span>
              {t("ReestrBill.BillsCount", "Счетов")}:{" "}
              {integerFormatter.format(group.bills.length)}
            </span>

            <span>
              {t("ReestrBill.Amount", "Сумма")}:{" "}
              {formatter.format(reestrBillGroupAmount(group))}
            </span>
          </div>

          <div className="report-table-scroll reestr-bill-scroll">
            <table className="report-table reestr-bill-table">
              <thead>
                <tr>
                  <th className="report-money reestr-bill-col-number">
                    {t("ReestrBill.Bill", "Счет")}
                  </th>
                  <th className="report-text reestr-bill-col-time">
                    {t("Common.Time", "Время")}
                  </th>
                  <th className="report-text">
                    {t("ReestrBill.Waiter", "Официант")}
                  </th>
                  <th className="report-check">
                    {t("ReestrBill.Debt", "Долг")}
                  </th>
                  <th className="report-check">
                    {t("ReestrBill.Cancelled", "Аннулирован")}
                  </th>
                  <th className="report-money">
                    {t("ReestrBill.Amount", "Сумма")}
                  </th>
                </tr>
              </thead>

              <tbody>
                {group.bills.map((bill, billIndex) => {
                  const items = reestrBillItems(bill);

                  return (
                    <Fragment
                      key={`${bill?.ID ?? bill?.Number ?? "bill"}-${billIndex}`}
                    >
                      <tr className="reestr-bill-row">
                        <td className="report-money reestr-bill-number">
                          {bill?.Number ?? "—"}
                        </td>
                        <td className="report-text">
                          {formatReestrBillTime(bill?.Oplachen)}
                        </td>
                        <td className="report-text">
                          {bill?.Waiter || "—"}
                        </td>
                        <td className="report-check">
                          <ReportBooleanCheckbox
                            value={bill?.Dolg}
                            label={t("ReestrBill.Debt", "Долг")}
                          />
                        </td>
                        <td className="report-check">
                          <ReportBooleanCheckbox
                            value={bill?.Anul}
                            label={t(
                              "ReestrBill.Cancelled",
                              "Аннулирован"
                            )}
                          />
                        </td>
                        <td className="report-money">
                          {formatter.format(reestrBillAmount(bill))}
                        </td>
                      </tr>

                      <tr className="reestr-bill-items-row">
                        <td colSpan="6">
                          {items.length > 0 ? (
                            <table className="reestr-bill-items-table">
                              <thead>
                                <tr>
                                  <th className="report-text">
                                    {t("ReestrBill.Dish", "Блюдо")}
                                  </th>
                                  <th className="report-money">
                                    {t("Common.Quantity", "Количество")}
                                  </th>
                                  <th className="report-money">
                                    {t("Common.Price", "Цена")}
                                  </th>
                                  <th className="report-money">
                                    {t("ReestrBill.Discount", "Скидка")}
                                  </th>
                                  <th className="report-money">
                                    {t("ReestrBill.Amount", "Сумма")}
                                  </th>
                                  <th className="report-check">
                                    {t(
                                      "ReestrBill.PositionCancelled",
                                      "Анул."
                                    )}
                                  </th>
                                  <th className="report-check">
                                    {t(
                                      "ReestrBill.Transfer",
                                      "Переброска"
                                    )}
                                  </th>
                                  <th className="report-text reestr-admin-col">
                                    {t(
                                      "ReestrBill.Admin",
                                      "Администратор"
                                    )}
                                  </th>
                                </tr>
                              </thead>

                              <tbody>
                                {items.map((item, itemIndex) => (
                                  <tr
                                    key={`${bill?.ID ?? billIndex}-item-${itemIndex}`}
                                    className={[
                                      numericValue(item?.Kolvo) < 0
                                        ? "reestr-bill-item-negative"
                                        : "",
                                      item?.Anul
                                        ? "reestr-bill-item-cancelled"
                                        : ""
                                    ]
                                      .filter(Boolean)
                                      .join(" ")}
                                  >
                                    <td className="report-text">
                                      {item?.NameDish || "—"}
                                    </td>
                                    <td className="report-money">
                                      {formatter.format(
                                        numericValue(item?.Kolvo)
                                      )}
                                    </td>
                                    <td className="report-money">
                                      {formatter.format(
                                        numericValue(item?.Price)
                                      )}
                                    </td>
                                    <td className="report-money">
                                      {formatter.format(
                                        numericValue(item?.Discount)
                                      )}
                                    </td>
                                    <td className="report-money">
                                      {formatter.format(
                                        numericValue(item?.Summ)
                                      )}
                                    </td>
                                    <td className="report-check">
                                      <ReportBooleanCheckbox
                                        value={item?.Anul}
                                        label={t(
                                          "ReestrBill.PositionCancelled",
                                          "Анул."
                                        )}
                                      />
                                    </td>
                                    <td className="report-check">
                                      <ReportBooleanCheckbox
                                        value={item?.Perebr}
                                        label={t(
                                          "ReestrBill.Transfer",
                                          "Переброска"
                                        )}
                                      />
                                    </td>
                                    <td className="report-text reestr-admin-value">
                                      {item?.AdminVozvr || ""}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <div className="reestr-bill-no-items">
                              {t(
                                "ReestrBill.NoItems",
                                "В счете нет позиций."
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>

              <tfoot>
                <tr>
                  <td
                    colSpan="5"
                    className="report-text report-total-label"
                  >
                    {t("Common.Total", "Итого")}
                  </td>
                  <td className="report-money">
                    {formatter.format(reestrBillGroupAmount(group))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      ))}

      {groups.length > 0 && (
        <div className="reestr-bill-grand-total">
          <span>
            {t("ReestrBill.BillsCount", "Счетов")}:{" "}
            <strong>{integerFormatter.format(rows.length)}</strong>
          </span>
          <span>
            {t("Common.Total", "Итого")}:{" "}
            <strong>{formatter.format(totalAmount)}</strong>
          </span>
        </div>
      )}
    </div>
  );
}

function booleanMark(value) {
  return value ? "☑" : "☐";
}

function buildReestrBillPrintHtml({
  rows,
  dateFrom,
  dateTo,
  organizationName,
  locale,
  t
}) {
  const formatter = createMoneyFormatter(locale);
  const groups = reestrBillGroupByDate(rows);
  const totalAmount = rows.reduce(
    (sum, bill) => sum + reestrBillAmount(bill),
    0
  );

  let integerFormatter;

  try {
    integerFormatter = new Intl.NumberFormat(
      locale || "ru-RU",
      { maximumFractionDigits: 0 }
    );
  } catch {
    integerFormatter = new Intl.NumberFormat(
      "ru-RU",
      { maximumFractionDigits: 0 }
    );
  }

  const groupsHtml = groups
    .map((group) => {
      const billsHtml = group.bills
        .map((bill) => {
          const items = reestrBillItems(bill);

          const itemsHtml = items.length > 0
            ? `<table class="items">
<thead><tr>
<th>${escapeHtml(t("ReestrBill.Dish", "Блюдо"))}</th>
<th>${escapeHtml(t("Common.Quantity", "Количество"))}</th>
<th>${escapeHtml(t("Common.Price", "Цена"))}</th>
<th>${escapeHtml(t("ReestrBill.Discount", "Скидка"))}</th>
<th>${escapeHtml(t("ReestrBill.Amount", "Сумма"))}</th>
<th>${escapeHtml(t("ReestrBill.PositionCancelled", "Анул."))}</th>
<th>${escapeHtml(t("ReestrBill.Transfer", "Переброска"))}</th>
<th>${escapeHtml(t("ReestrBill.Admin", "Администратор"))}</th>
</tr></thead>
<tbody>${items.map((item) => {
  const classes = [];
  if (numericValue(item?.Kolvo) < 0) classes.push("negative");
  if (item?.Anul) classes.push("cancelled");

  return `<tr${classes.length ? ` class="${classes.join(" ")}"` : ""}>
<td class="text">${escapeHtml(item?.NameDish || "—")}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(item?.Kolvo)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(item?.Price)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(item?.Discount)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(item?.Summ)))}</td>
<td class="check">${escapeHtml(booleanMark(item?.Anul))}</td>
<td class="check">${escapeHtml(booleanMark(item?.Perebr))}</td>
<td class="text admin">${escapeHtml(item?.AdminVozvr || "")}</td>
</tr>`;
}).join("")}</tbody>
</table>`
            : `<div class="no-items">${escapeHtml(
                t("ReestrBill.NoItems", "В счете нет позиций.")
              )}</div>`;

          return `<tr class="bill">
<td class="number">${escapeHtml(String(bill?.Number ?? "—"))}</td>
<td class="text">${escapeHtml(formatReestrBillTime(bill?.Oplachen))}</td>
<td class="text">${escapeHtml(bill?.Waiter || "—")}</td>
<td class="check">${escapeHtml(booleanMark(bill?.Dolg))}</td>
<td class="check">${escapeHtml(booleanMark(bill?.Anul))}</td>
<td class="number">${escapeHtml(formatter.format(reestrBillAmount(bill)))}</td>
</tr>
<tr class="details"><td colspan="6">${itemsHtml}</td></tr>`;
        })
        .join("");

      return `<section class="day">
<div class="day-header">
<strong>${escapeHtml(formatReestrBillDate(group.dateValue, locale))}</strong>
<span>${escapeHtml(t("ReestrBill.BillsCount", "Счетов"))}: ${escapeHtml(integerFormatter.format(group.bills.length))}</span>
<span>${escapeHtml(t("ReestrBill.Amount", "Сумма"))}: ${escapeHtml(formatter.format(reestrBillGroupAmount(group)))}</span>
</div>
<table class="bills">
<thead><tr>
<th>${escapeHtml(t("ReestrBill.Bill", "Счет"))}</th>
<th>${escapeHtml(t("Common.Time", "Время"))}</th>
<th>${escapeHtml(t("ReestrBill.Waiter", "Официант"))}</th>
<th>${escapeHtml(t("ReestrBill.Debt", "Долг"))}</th>
<th>${escapeHtml(t("ReestrBill.Cancelled", "Аннулирован"))}</th>
<th>${escapeHtml(t("ReestrBill.Amount", "Сумма"))}</th>
</tr></thead>
<tbody>${billsHtml}</tbody>
<tfoot><tr><td colspan="5">${escapeHtml(t("Common.Total", "Итого"))}</td><td class="number">${escapeHtml(formatter.format(reestrBillGroupAmount(group)))}</td></tr></tfoot>
</table>
</section>`;
    })
    .join("");

  const title = t("ReestrBill.Title", "Реестр счетов");

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
@page { size: A4 landscape; margin: 8mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; color: #111; font-size: 8.5pt; }
.header { display: flex; justify-content: space-between; align-items: flex-end; gap: 8mm; margin-bottom: 4mm; }
h1 { margin: 0; font-size: 12pt; font-style: italic; font-weight: 700; }
.org { font-weight: 700; text-decoration: underline; white-space: nowrap; }
.day { margin-top: 4mm; break-inside: auto; }
.day-header { display: flex; align-items: center; gap: 7mm; padding: 1.4mm 2mm; background: #edf2f4; border-top: 0.35mm solid #657573; border-bottom: 0.2mm solid #aeb8b6; }
.day-header strong { font-size: 9pt; }
table { width: 100%; border-collapse: collapse; }
.bills > thead th { padding: 1.1mm 1.3mm; border-bottom: 0.3mm solid #555; font-size: 7.8pt; font-weight: 600; text-align: right; white-space: nowrap; }
.bills > thead th:nth-child(2),
.bills > thead th:nth-child(3) { text-align: left; }
.bill td { padding: 1.1mm 1.3mm; border-bottom: 0.15mm solid #d2d7d6; font-weight: 700; white-space: nowrap; }
td.text { text-align: left; }
td.number { text-align: right; }
td.check { text-align: center; font-size: 10pt; }
.details > td { padding: 0 2mm 2mm 6mm; }
.items { margin-top: 0.5mm; background: #fafbfb; }
.items th { padding: 0.8mm 1.1mm; border-bottom: 0.2mm solid #c0c7c5; font-size: 7.2pt; font-weight: 600; text-align: right; }
.items th:first-child { text-align: left; }
.items td { padding: 0.7mm 1.1mm; border-bottom: 0.12mm dotted #c7cdcb; font-size: 7.5pt; }
.items .negative td { background: #ffdede; }
.items .cancelled td { color: #777; text-decoration: line-through; }
.items .cancelled td.check { text-decoration: none; }
.no-items { padding: 1mm 0; color: #777; font-style: italic; }
.bills tfoot td { padding: 1mm 1.3mm; border-top: 0.3mm solid #555; font-weight: 700; }
.grand-total { display: flex; justify-content: flex-end; gap: 10mm; margin-top: 5mm; padding-top: 2mm; border-top: 0.4mm solid #333; font-size: 9pt; }
</style></head><body>
<div class="header"><h1>${escapeHtml(title)} ${escapeHtml(t("Common.From", "с"))} ${escapeHtml(formatReportDate(dateFrom))} ${escapeHtml(t("Common.To", "по"))} ${escapeHtml(formatReportDate(dateTo))}</h1><div class="org">${escapeHtml(organizationName || "")}</div></div>
${groupsHtml}
<div class="grand-total"><span>${escapeHtml(t("ReestrBill.BillsCount", "Счетов"))}: <strong>${escapeHtml(integerFormatter.format(rows.length))}</strong></span><span>${escapeHtml(t("Common.Total", "Итого"))}: <strong>${escapeHtml(formatter.format(totalAmount))}</strong></span></div>
</body></html>`;
}

function printReestrBillReport(options) {
  const printWindow = window.open(
    "",
    "_blank",
    "width=1280,height=900"
  );

  if (!printWindow) {
    window.alert(
      options.t(
        "Reports.PrintPopupBlocked",
        "Браузер заблокировал окно печати. Разрешите всплывающие окна для Web Office."
      )
    );
    return;
  }

  printWindow.document.open();
  printWindow.document.write(
    buildReestrBillPrintHtml(options)
  );
  printWindow.document.close();
  printWindow.focus();
  closePrintWindowAfterPrint(printWindow);

  window.setTimeout(() => {
    printWindow.print();
  }, 150);
}

function safeReestrBillFilePart(value) {
  return String(value ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

function buildReestrBillExportModel({
  rows,
  dateFrom,
  dateTo,
  organizationName,
  locale,
  t
}) {
  const exportRows = [];

  for (const bill of rows) {
    const items = reestrBillItems(bill);

    if (items.length === 0) {
      exportRows.push({
        Date: formatReestrBillDate(bill?.Oplachen, locale),
        Bill: bill?.Number ?? "",
        Time: formatReestrBillTime(bill?.Oplachen),
        Waiter: bill?.Waiter || "",
        Debt: booleanMark(bill?.Dolg),
        BillCancelled: booleanMark(bill?.Anul),
        Dish: "",
        Quantity: "",
        Price: "",
        Discount: "",
        Summ: "",
        ItemCancelled: "",
        Transfer: "",
        Admin: ""
      });
      continue;
    }

    for (const item of items) {
      exportRows.push({
        Date: formatReestrBillDate(bill?.Oplachen, locale),
        Bill: bill?.Number ?? "",
        Time: formatReestrBillTime(bill?.Oplachen),
        Waiter: bill?.Waiter || "",
        Debt: booleanMark(bill?.Dolg),
        BillCancelled: booleanMark(bill?.Anul),
        Dish: item?.NameDish || "",
        Quantity: numericValue(item?.Kolvo),
        Price: numericValue(item?.Price),
        Discount: numericValue(item?.Discount),
        Summ: numericValue(item?.Summ),
        ItemCancelled: booleanMark(item?.Anul),
        Transfer: booleanMark(item?.Perebr),
        Admin: item?.AdminVozvr || ""
      });
    }
  }

  const totalAmount = rows.reduce(
    (sum, bill) => sum + reestrBillAmount(bill),
    0
  );

  return {
    title: `${t("ReestrBill.Title", "Реестр счетов")} ${formatReportDate(dateFrom)} — ${formatReportDate(dateTo)}`,
    fileName: `ReestrBill_${safeReestrBillFilePart(dateFrom)}_${safeReestrBillFilePart(dateTo)}_${safeReestrBillFilePart(organizationName || "report")}`,
    orientation: "landscape",
    locale,
    meta: [
      {
        label: t("ReestrBill.Organization", "Организация"),
        value: organizationName || ""
      }
    ],
    columns: [
      {
        key: "Date",
        title: t("ReestrBill.Date", "Дата"),
        type: "text",
        width: 13
      },
      {
        key: "Bill",
        title: t("ReestrBill.Bill", "Счет"),
        type: "integer",
        decimals: 0,
        width: 10
      },
      {
        key: "Time",
        title: t("Common.Time", "Время"),
        type: "text",
        width: 9
      },
      {
        key: "Waiter",
        title: t("ReestrBill.Waiter", "Официант"),
        type: "text",
        width: 17
      },
      {
        key: "Debt",
        title: t("ReestrBill.Debt", "Долг"),
        type: "text",
        width: 8
      },
      {
        key: "BillCancelled",
        title: t("ReestrBill.Cancelled", "Аннулирован"),
        type: "text",
        width: 11
      },
      {
        key: "Dish",
        title: t("ReestrBill.Dish", "Блюдо"),
        type: "text",
        width: 27
      },
      {
        key: "Quantity",
        title: t("Common.Quantity", "Количество"),
        type: "number",
        decimals: 2,
        width: 11
      },
      {
        key: "Price",
        title: t("Common.Price", "Цена"),
        type: "number",
        decimals: 2,
        width: 11
      },
      {
        key: "Discount",
        title: t("ReestrBill.Discount", "Скидка"),
        type: "number",
        decimals: 2,
        width: 11
      },
      {
        key: "Summ",
        title: t("ReestrBill.Amount", "Сумма"),
        type: "number",
        decimals: 2,
        width: 12
      },
      {
        key: "ItemCancelled",
        title: t("ReestrBill.PositionCancelled", "Анул."),
        type: "text",
        width: 8
      },
      {
        key: "Transfer",
        title: t("ReestrBill.Transfer", "Переброска"),
        type: "text",
        width: 11
      },
      {
        key: "Admin",
        title: t("ReestrBill.Admin", "Администратор"),
        type: "text",
        width: 18
      }
    ],
    rows: exportRows,
    footerRows: [
      {
        label: t("Common.Total", "Итого"),
        values: {
          Summ: totalAmount
        }
      }
    ]
  };
}

function ReestrBillReport({
  data,
  dateFrom,
  dateTo,
  organizationName,
  locale,
  fetchWithAuth,
  t,
  onReload
}) {
  const rows = getReestrBillRows(data);
  const formatter = createMoneyFormatter(locale);

  let integerFormatter;

  try {
    integerFormatter = new Intl.NumberFormat(
      locale || "ru-RU",
      { maximumFractionDigits: 0 }
    );
  } catch {
    integerFormatter = new Intl.NumberFormat(
      "ru-RU",
      { maximumFractionDigits: 0 }
    );
  }

  const commonOptions = {
    rows,
    dateFrom,
    dateTo,
    organizationName,
    locale,
    t
  };

  async function handleExport(format) {
    try {
      await exportReportFile({
        fetchWithAuth,
        reportModel: buildReestrBillExportModel(
          commonOptions
        ),
        format,
        errorMessage: t(
          "Report.ExportError",
          "Ошибка экспорта отчёта."
        )
      });
    } catch (err) {
      window.alert(
        err?.message ||
          t(
            "Report.ExportError",
            "Ошибка экспорта отчёта."
          )
      );
    }
  }

  return (
    <div className="reports-page reestr-bill-report-page">
      <div className="report-toolbar">
        <button
          type="button"
          className="report-run-button"
          onClick={onReload}
        >
          {t("Common.Generate", "Сформировать")}
        </button>

        <button
          type="button"
          className="report-action-button report-print-button"
          onClick={() => printReestrBillReport(commonOptions)}
        >
          {t("Common.Print", "Печать")}
        </button>

        <button
          type="button"
          className="report-action-button report-excel-button"
          onClick={() => handleExport("xlsx")}
        >
          {t("Common.Excel", "Excel")}
        </button>

        <button
          type="button"
          className="report-action-button report-word-button"
          onClick={() => handleExport("docx")}
        >
          {t("Common.Word", "Word")}
        </button>
      </div>

      <article className="revenue-report-sheet reestr-bill-sheet">
        <header className="revenue-report-heading reestr-bill-heading">
          <h3>
            {t("ReestrBill.Title", "Реестр счетов")}{" "}
            {t("Common.From", "с")} {formatReportDate(dateFrom)}{" "}
            {t("Common.To", "по")} {formatReportDate(dateTo)}
          </h3>

          <div className="revenue-report-org">
            {organizationName || ""}
          </div>
        </header>

        {rows.length > 0 ? (
          <ReestrBillReportTable
            rows={rows}
            formatter={formatter}
            integerFormatter={integerFormatter}
            locale={locale}
            t={t}
          />
        ) : (
          <div className="report-empty">
            {t(
              "Reports.NoDataForPeriod",
              "За выбранный период данных нет."
            )}
          </div>
        )}
      </article>
    </div>
  );
}


function getReestrReturnRows(data) {
  const payload = data?.data ?? data?.Data ?? data;

  if (Array.isArray(payload)) {
    return payload;
  }

  const candidates = [
    payload?.Main,
    payload?.main,
    payload?.Rows,
    payload?.rows,
    payload?.ReestrReturn,
    payload?.reestrReturn,
    payload?.Bills,
    payload?.bills,
    payload?.Items,
    payload?.items
  ];

  return normalizeRows(
    candidates.find((value) => Array.isArray(value))
  );
}

function reestrReturnGroupByWaiterAndDate(rows) {
  const waiterMap = new Map();

  for (const bill of rows) {
    const waiter = String(bill?.Waiter ?? "").trim() || "—";
    const dateKey = reestrBillDateKey(bill?.Oplachen);

    if (!waiterMap.has(waiter)) {
      waiterMap.set(waiter, new Map());
    }

    const dateMap = waiterMap.get(waiter);

    if (!dateMap.has(dateKey)) {
      dateMap.set(dateKey, {
        key: dateKey,
        dateValue: bill?.Oplachen ?? "",
        bills: []
      });
    }

    dateMap.get(dateKey).bills.push(bill);
  }

  return [...waiterMap.entries()]
    .sort(([left], [right]) =>
      left.localeCompare(right, undefined, {
        sensitivity: "base"
      })
    )
    .map(([waiter, dateMap]) => ({
      waiter,
      dates: [...dateMap.values()]
        .sort((left, right) =>
          String(left.key).localeCompare(String(right.key))
        )
        .map((group) => ({
          ...group,
          bills: [...group.bills].sort((left, right) => {
            const leftTime = String(left?.Oplachen ?? "");
            const rightTime = String(right?.Oplachen ?? "");

            if (leftTime !== rightTime) {
              return leftTime.localeCompare(rightTime);
            }

            return numericValue(left?.Number) -
              numericValue(right?.Number);
          })
        }))
    }));
}

function ReestrReturnReportTable({
  rows,
  formatter,
  locale,
  t
}) {
  const waiterGroups = reestrReturnGroupByWaiterAndDate(rows);

  return (
    <div className="reestr-return-groups">
      {waiterGroups.map((waiterGroup) => (
        <section
          className="reestr-return-waiter"
          key={waiterGroup.waiter}
        >
          <div className="reestr-return-waiter-header">
            {waiterGroup.waiter}
          </div>

          {waiterGroup.dates.map((dateGroup) => (
            <section
              className="reestr-return-day"
              key={`${waiterGroup.waiter}-${dateGroup.key}`}
            >
              <div className="reestr-return-day-header">
                {formatReestrBillDate(
                  dateGroup.dateValue,
                  locale
                )}
              </div>

              <div className="report-table-scroll reestr-return-scroll">
                <table className="report-table reestr-return-table">
                  <thead>
                    <tr>
                      <th className="report-money reestr-return-col-number">
                        {t("ReestrReturn.Bill", "Счет")}
                      </th>
                      <th className="report-text reestr-return-col-time">
                        {t("Common.Time", "Время")}
                      </th>
                      <th className="report-check">
                        {t("ReestrReturn.Debt", "Долг")}
                      </th>
                      <th className="report-check">
                        {t(
                          "ReestrReturn.Cancelled",
                          "Аннулирован"
                        )}
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {dateGroup.bills.map((bill, billIndex) => {
                      const items = reestrBillItems(bill);

                      return (
                        <Fragment
                          key={`${bill?.ID ?? bill?.Number ?? "bill"}-${billIndex}`}
                        >
                          <tr className="reestr-return-bill-row">
                            <td className="report-money reestr-return-bill-number">
                              {bill?.Number ?? "—"}
                            </td>
                            <td className="report-text">
                              {formatReestrBillTime(
                                bill?.Oplachen
                              )}
                            </td>
                            <td className="report-check">
                              <ReportBooleanCheckbox
                                value={bill?.Dolg}
                                label={t(
                                  "ReestrReturn.Debt",
                                  "Долг"
                                )}
                              />
                            </td>
                            <td className="report-check">
                              <ReportBooleanCheckbox
                                value={bill?.Anul}
                                label={t(
                                  "ReestrReturn.Cancelled",
                                  "Аннулирован"
                                )}
                              />
                            </td>
                          </tr>

                          <tr className="reestr-return-items-row">
                            <td colSpan="4">
                              {items.length > 0 ? (
                                <table className="reestr-return-items-table">
                                  <thead>
                                    <tr>
                                      <th className="report-text">
                                        {t(
                                          "ReestrReturn.Dish",
                                          "Блюдо"
                                        )}
                                      </th>
                                      <th className="report-money">
                                        {t(
                                          "Common.Quantity",
                                          "Количество"
                                        )}
                                      </th>
                                      <th className="report-money">
                                        {t(
                                          "Common.Price",
                                          "Цена"
                                        )}
                                      </th>
                                      <th className="report-money">
                                        {t(
                                          "ReestrReturn.Discount",
                                          "Скидка"
                                        )}
                                      </th>
                                      <th className="report-money">
                                        {t(
                                          "ReestrReturn.Amount",
                                          "Сумма"
                                        )}
                                      </th>
                                      <th className="report-check">
                                        {t(
                                          "ReestrReturn.PositionCancelled",
                                          "Анул."
                                        )}
                                      </th>
                                      <th className="report-check">
                                        {t(
                                          "ReestrReturn.Transfer",
                                          "Переброска"
                                        )}
                                      </th>
                                      <th className="report-text reestr-admin-col">
                                        {t(
                                          "ReestrReturn.Admin",
                                          "Администратор"
                                        )}
                                      </th>
                                    </tr>
                                  </thead>

                                  <tbody>
                                    {items.map((item, itemIndex) => {
                                      const isReturn =
                                        numericValue(
                                          item?.Kolvo
                                        ) < 0;

                                      return (
                                        <tr
                                          key={`${bill?.ID ?? billIndex}-item-${itemIndex}`}
                                          className={[
                                            isReturn
                                              ? "reestr-return-item-negative"
                                              : "",
                                            item?.Anul
                                              ? "reestr-return-item-cancelled"
                                              : ""
                                          ]
                                            .filter(Boolean)
                                            .join(" ")}
                                        >
                                          <td className="report-text">
                                            {item?.NameDish || "—"}
                                          </td>
                                          <td className="report-money">
                                            {formatter.format(
                                              numericValue(
                                                item?.Kolvo
                                              )
                                            )}
                                          </td>
                                          <td className="report-money">
                                            {formatter.format(
                                              numericValue(
                                                item?.Price
                                              )
                                            )}
                                          </td>
                                          <td className="report-money">
                                            {formatter.format(
                                              numericValue(
                                                item?.Discount
                                              )
                                            )}
                                          </td>
                                          <td className="report-money">
                                            {formatter.format(
                                              numericValue(
                                                item?.Summ
                                              )
                                            )}
                                          </td>
                                          <td className="report-check">
                                            <ReportBooleanCheckbox
                                              value={item?.Anul}
                                              label={t(
                                                "ReestrReturn.PositionCancelled",
                                                "Анул."
                                              )}
                                            />
                                          </td>
                                          <td className="report-check">
                                            <ReportBooleanCheckbox
                                              value={item?.Perebr}
                                              label={t(
                                                "ReestrReturn.Transfer",
                                                "Переброска"
                                              )}
                                            />
                                          </td>
                                          <td className="report-text reestr-admin-value">
                                            {item?.AdminVozvr || ""}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              ) : (
                                <div className="reestr-return-no-items">
                                  {t(
                                    "ReestrReturn.NoItems",
                                    "В счете нет позиций."
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </section>
      ))}
    </div>
  );
}

function buildReestrReturnPrintHtml({
  rows,
  dateFrom,
  dateTo,
  organizationName,
  locale,
  t
}) {
  const formatter = createMoneyFormatter(locale);
  const waiterGroups = reestrReturnGroupByWaiterAndDate(rows);

  const waiterHtml = waiterGroups
    .map((waiterGroup) => {
      const datesHtml = waiterGroup.dates
        .map((dateGroup) => {
          const billsHtml = dateGroup.bills
            .map((bill) => {
              const items = reestrBillItems(bill);

              const itemsHtml = items.length > 0
                ? `<table class="items">
<thead><tr>
<th>${escapeHtml(t("ReestrReturn.Dish", "Блюдо"))}</th>
<th>${escapeHtml(t("Common.Quantity", "Количество"))}</th>
<th>${escapeHtml(t("Common.Price", "Цена"))}</th>
<th>${escapeHtml(t("ReestrReturn.Discount", "Скидка"))}</th>
<th>${escapeHtml(t("ReestrReturn.Amount", "Сумма"))}</th>
<th>${escapeHtml(t("ReestrReturn.PositionCancelled", "Анул."))}</th>
<th>${escapeHtml(t("ReestrReturn.Transfer", "Переброска"))}</th>
<th>${escapeHtml(t("ReestrReturn.Admin", "Администратор"))}</th>
</tr></thead>
<tbody>${items.map((item) => {
  const classes = [];
  if (numericValue(item?.Kolvo) < 0) classes.push("negative");
  if (item?.Anul) classes.push("cancelled");

  return `<tr${classes.length ? ` class="${classes.join(" ")}"` : ""}>
<td class="text">${escapeHtml(item?.NameDish || "—")}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(item?.Kolvo)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(item?.Price)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(item?.Discount)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(item?.Summ)))}</td>
<td class="check">${escapeHtml(booleanMark(item?.Anul))}</td>
<td class="check">${escapeHtml(booleanMark(item?.Perebr))}</td>
<td class="text admin">${escapeHtml(item?.AdminVozvr || "")}</td>
</tr>`;
}).join("")}</tbody>
</table>`
                : `<div class="no-items">${escapeHtml(
                    t(
                      "ReestrReturn.NoItems",
                      "В счете нет позиций."
                    )
                  )}</div>`;

              return `<tr class="bill">
<td class="number">${escapeHtml(String(bill?.Number ?? "—"))}</td>
<td class="text">${escapeHtml(formatReestrBillTime(bill?.Oplachen))}</td>
<td class="check">${escapeHtml(booleanMark(bill?.Dolg))}</td>
<td class="check">${escapeHtml(booleanMark(bill?.Anul))}</td>
</tr>
<tr class="details"><td colspan="4">${itemsHtml}</td></tr>`;
            })
            .join("");

          return `<section class="day">
<div class="day-header">${escapeHtml(formatReestrBillDate(dateGroup.dateValue, locale))}</div>
<table class="bills">
<thead><tr>
<th>${escapeHtml(t("ReestrReturn.Bill", "Счет"))}</th>
<th>${escapeHtml(t("Common.Time", "Время"))}</th>
<th>${escapeHtml(t("ReestrReturn.Debt", "Долг"))}</th>
<th>${escapeHtml(t("ReestrReturn.Cancelled", "Аннулирован"))}</th>
</tr></thead>
<tbody>${billsHtml}</tbody>
</table>
</section>`;
        })
        .join("");

      return `<section class="waiter">
<div class="waiter-header">${escapeHtml(waiterGroup.waiter)}</div>
${datesHtml}
</section>`;
    })
    .join("");

  const title = t(
    "ReestrReturn.Title",
    "Счета с возвратами"
  );

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
@page { size: A4 landscape; margin: 8mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; color: #111; font-size: 8.5pt; }
.header { display: flex; justify-content: space-between; align-items: flex-end; gap: 8mm; margin-bottom: 4mm; }
h1 { margin: 0; font-size: 12pt; font-style: italic; font-weight: 700; }
.org { font-weight: 700; text-decoration: underline; white-space: nowrap; }
.waiter { margin-top: 4mm; }
.waiter-header { padding: 1.5mm 2mm; background: #dfe8e5; border-top: 0.45mm solid #596b67; border-bottom: 0.25mm solid #9eaaa7; font-size: 10pt; font-weight: 700; }
.day { margin-top: 2.5mm; break-inside: auto; }
.day-header { padding: 1.2mm 2mm; background: #eef3f1; border-bottom: 0.2mm solid #b7c0bd; font-size: 8.5pt; font-weight: 700; }
table { width: 100%; border-collapse: collapse; }
.bills > thead th { padding: 1mm 1.3mm; border-bottom: 0.3mm solid #555; font-size: 7.8pt; font-weight: 600; text-align: right; white-space: nowrap; }
.bills > thead th:nth-child(2) { text-align: left; }
.bill td { padding: 1.05mm 1.3mm; border-bottom: 0.15mm solid #d2d7d6; font-weight: 700; white-space: nowrap; }
td.text { text-align: left; }
td.number { text-align: right; }
td.check { text-align: center; font-size: 10pt; }
.details > td { padding: 0 2mm 2mm 6mm; }
.items { margin-top: 0.5mm; background: #fafbfb; }
.items th { padding: 0.8mm 1.1mm; border-bottom: 0.2mm solid #c0c7c5; font-size: 7.2pt; font-weight: 600; text-align: right; }
.items th:first-child { text-align: left; }
.items td { padding: 0.7mm 1.1mm; border-bottom: 0.12mm dotted #c7cdcb; font-size: 7.5pt; }
.items tr.negative td { background: #fde8e8; }
.items tr.cancelled td { color: #777; text-decoration: line-through; }
.items tr.cancelled td.check { text-decoration: none; }
.no-items { padding: 1mm 0; color: #777; font-style: italic; }
</style></head><body>
<div class="header"><h1>${escapeHtml(title)} ${escapeHtml(t("Common.From", "с"))} ${escapeHtml(formatReportDate(dateFrom))} ${escapeHtml(t("Common.To", "по"))} ${escapeHtml(formatReportDate(dateTo))}</h1><div class="org">${escapeHtml(organizationName || "")}</div></div>
${waiterHtml}
</body></html>`;
}

function printReestrReturnReport(options) {
  const printWindow = window.open(
    "",
    "_blank",
    "width=1280,height=900"
  );

  if (!printWindow) {
    window.alert(
      options.t(
        "Reports.PrintPopupBlocked",
        "Браузер заблокировал окно печати. Разрешите всплывающие окна для Web Office."
      )
    );
    return;
  }

  printWindow.document.open();
  printWindow.document.write(
    buildReestrReturnPrintHtml(options)
  );
  printWindow.document.close();
  printWindow.focus();
  closePrintWindowAfterPrint(printWindow);

  window.setTimeout(() => {
    printWindow.print();
  }, 150);
}

function safeReestrReturnFilePart(value) {
  return String(value ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

function buildReestrReturnExportModel({
  rows,
  dateFrom,
  dateTo,
  organizationName,
  locale,
  t
}) {
  const exportRows = [];
  const waiterGroups = reestrReturnGroupByWaiterAndDate(rows);

  for (const waiterGroup of waiterGroups) {
    for (const dateGroup of waiterGroup.dates) {
      for (const bill of dateGroup.bills) {
        const items = reestrBillItems(bill);

        if (items.length === 0) {
          exportRows.push({
            Waiter: waiterGroup.waiter,
            Date: formatReestrBillDate(
              bill?.Oplachen,
              locale
            ),
            Bill: bill?.Number ?? "",
            Time: formatReestrBillTime(bill?.Oplachen),
            Debt: booleanMark(bill?.Dolg),
            BillCancelled: booleanMark(bill?.Anul),
            Dish: "",
            Quantity: "",
            Price: "",
            Discount: "",
            Summ: "",
            ItemCancelled: "",
            Transfer: "",
            Admin: ""
          });
          continue;
        }

        for (const item of items) {
          exportRows.push({
            Waiter: waiterGroup.waiter,
            Date: formatReestrBillDate(
              bill?.Oplachen,
              locale
            ),
            Bill: bill?.Number ?? "",
            Time: formatReestrBillTime(bill?.Oplachen),
            Debt: booleanMark(bill?.Dolg),
            BillCancelled: booleanMark(bill?.Anul),
            Dish: item?.NameDish || "",
            Quantity: numericValue(item?.Kolvo),
            Price: numericValue(item?.Price),
            Discount: numericValue(item?.Discount),
            Summ: numericValue(item?.Summ),
            ItemCancelled: booleanMark(item?.Anul),
            Transfer: booleanMark(item?.Perebr),
            Admin: item?.AdminVozvr || ""
          });
        }
      }
    }
  }

  return {
    title: `${t("ReestrReturn.Title", "Счета с возвратами")} ${formatReportDate(dateFrom)} — ${formatReportDate(dateTo)}`,
    fileName: `ReestrReturn_${safeReestrReturnFilePart(dateFrom)}_${safeReestrReturnFilePart(dateTo)}_${safeReestrReturnFilePart(organizationName || "report")}`,
    orientation: "landscape",
    locale,
    meta: [
      {
        label: t(
          "ReestrReturn.Organization",
          "Организация"
        ),
        value: organizationName || ""
      }
    ],
    columns: [
      {
        key: "Waiter",
        title: t("ReestrReturn.Waiter", "Официант"),
        type: "text",
        width: 18
      },
      {
        key: "Date",
        title: t("ReestrReturn.Date", "Дата"),
        type: "text",
        width: 13
      },
      {
        key: "Bill",
        title: t("ReestrReturn.Bill", "Счет"),
        type: "integer",
        decimals: 0,
        width: 10
      },
      {
        key: "Time",
        title: t("Common.Time", "Время"),
        type: "text",
        width: 9
      },
      {
        key: "Debt",
        title: t("ReestrReturn.Debt", "Долг"),
        type: "text",
        width: 8
      },
      {
        key: "BillCancelled",
        title: t(
          "ReestrReturn.Cancelled",
          "Аннулирован"
        ),
        type: "text",
        width: 11
      },
      {
        key: "Dish",
        title: t("ReestrReturn.Dish", "Блюдо"),
        type: "text",
        width: 28
      },
      {
        key: "Quantity",
        title: t("Common.Quantity", "Количество"),
        type: "number",
        decimals: 2,
        width: 11
      },
      {
        key: "Price",
        title: t("Common.Price", "Цена"),
        type: "number",
        decimals: 2,
        width: 11
      },
      {
        key: "Discount",
        title: t("ReestrReturn.Discount", "Скидка"),
        type: "number",
        decimals: 2,
        width: 11
      },
      {
        key: "Summ",
        title: t("ReestrReturn.Amount", "Сумма"),
        type: "number",
        decimals: 2,
        width: 12
      },
      {
        key: "ItemCancelled",
        title: t(
          "ReestrReturn.PositionCancelled",
          "Анул."
        ),
        type: "text",
        width: 8
      },
      {
        key: "Transfer",
        title: t(
          "ReestrReturn.Transfer",
          "Переброска"
        ),
        type: "text",
        width: 11
      },
      {
        key: "Admin",
        title: t(
          "ReestrReturn.Admin",
          "Администратор"
        ),
        type: "text",
        width: 18
      }
    ],
    rows: exportRows,
    footerRows: []
  };
}

function ReestrReturnReport({
  data,
  dateFrom,
  dateTo,
  organizationName,
  locale,
  fetchWithAuth,
  t,
  onReload
}) {
  const rows = getReestrReturnRows(data);
  const formatter = createMoneyFormatter(locale);

  const commonOptions = {
    rows,
    dateFrom,
    dateTo,
    organizationName,
    locale,
    t
  };

  async function handleExport(format) {
    try {
      await exportReportFile({
        fetchWithAuth,
        reportModel: buildReestrReturnExportModel(
          commonOptions
        ),
        format,
        errorMessage: t(
          "Report.ExportError",
          "Ошибка экспорта отчёта."
        )
      });
    } catch (err) {
      window.alert(
        err?.message ||
          t(
            "Report.ExportError",
            "Ошибка экспорта отчёта."
          )
      );
    }
  }

  return (
    <div className="reports-page reestr-return-report-page">
      <div className="report-toolbar">
        <button
          type="button"
          className="report-run-button"
          onClick={onReload}
        >
          {t("Common.Generate", "Сформировать")}
        </button>

        <button
          type="button"
          className="report-action-button report-print-button"
          onClick={() => printReestrReturnReport(commonOptions)}
        >
          {t("Common.Print", "Печать")}
        </button>

        <button
          type="button"
          className="report-action-button report-excel-button"
          onClick={() => handleExport("xlsx")}
        >
          {t("Common.Excel", "Excel")}
        </button>

        <button
          type="button"
          className="report-action-button report-word-button"
          onClick={() => handleExport("docx")}
        >
          {t("Common.Word", "Word")}
        </button>
      </div>

      <article className="revenue-report-sheet reestr-return-sheet">
        <header className="revenue-report-heading reestr-return-heading">
          <h3>
            {t(
              "ReestrReturn.Title",
              "Счета с возвратами"
            )}{" "}
            {t("Common.From", "с")} {formatReportDate(dateFrom)}{" "}
            {t("Common.To", "по")} {formatReportDate(dateTo)}
          </h3>

          <div className="revenue-report-org">
            {organizationName || ""}
          </div>
        </header>

        {rows.length > 0 ? (
          <ReestrReturnReportTable
            rows={rows}
            formatter={formatter}
            locale={locale}
            t={t}
          />
        ) : (
          <div className="report-empty">
            {t(
              "Reports.NoDataForPeriod",
              "За выбранный период данных нет."
            )}
          </div>
        )}
      </article>
    </div>
  );
}


function getReestrAnulRows(data) {
  const payload = data?.data ?? data?.Data ?? data;

  if (Array.isArray(payload)) {
    return payload;
  }

  const candidates = [
    payload?.Main,
    payload?.main,
    payload?.Rows,
    payload?.rows,
    payload?.ReestrAnul,
    payload?.reestrAnul,
    payload?.Bills,
    payload?.bills,
    payload?.Items,
    payload?.items
  ];

  return normalizeRows(
    candidates.find((value) => Array.isArray(value))
  );
}

function ReestrAnulReportTable({
  rows,
  formatter,
  integerFormatter,
  locale,
  t
}) {
  const groups = reestrBillGroupByDate(rows);
  const totalAmount = rows.reduce(
    (sum, bill) => sum + reestrBillAmount(bill),
    0
  );

  return (
    <div className="reestr-anul-groups">
      {groups.map((group) => (
        <section
          className="reestr-anul-day"
          key={group.key}
        >
          <div className="reestr-anul-day-header">
            <strong>
              {formatReestrBillDate(group.dateValue, locale)}
            </strong>

            <span>
              {t("ReestrAnul.BillsCount", "Счетов")}:{" "}
              {integerFormatter.format(group.bills.length)}
            </span>

            <span>
              {t("ReestrAnul.Amount", "Сумма")}:{" "}
              {formatter.format(reestrBillGroupAmount(group))}
            </span>
          </div>

          <div className="report-table-scroll reestr-anul-scroll">
            <table className="report-table reestr-anul-table">
              <thead>
                <tr>
                  <th className="report-money reestr-anul-col-number">
                    {t("ReestrAnul.Bill", "Счет")}
                  </th>
                  <th className="report-text reestr-anul-col-time">
                    {t("Common.Time", "Время")}
                  </th>
                  <th className="report-text">
                    {t("ReestrAnul.Waiter", "Официант")}
                  </th>
                  <th className="report-check">
                    {t("ReestrAnul.Debt", "Долг")}
                  </th>
                  <th className="report-check">
                    {t(
                      "ReestrAnul.Cancelled",
                      "Аннулирован"
                    )}
                  </th>
                  <th className="report-money">
                    {t("ReestrAnul.Amount", "Сумма")}
                  </th>
                </tr>
              </thead>

              <tbody>
                {group.bills.map((bill, billIndex) => {
                  const items = reestrBillItems(bill);

                  return (
                    <Fragment
                      key={`${bill?.ID ?? bill?.Number ?? "bill"}-${billIndex}`}
                    >
                      <tr
                        className={[
                          "reestr-anul-bill-row",
                          bill?.Anul
                            ? "reestr-anul-bill-cancelled"
                            : ""
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <td className="report-money reestr-anul-bill-number">
                          {bill?.Number ?? "—"}
                        </td>
                        <td className="report-text">
                          {formatReestrBillTime(bill?.Oplachen)}
                        </td>
                        <td className="report-text">
                          {bill?.Waiter || "—"}
                        </td>
                        <td className="report-check">
                          <ReportBooleanCheckbox
                            value={bill?.Dolg}
                            label={t(
                              "ReestrAnul.Debt",
                              "Долг"
                            )}
                          />
                        </td>
                        <td className="report-check">
                          <ReportBooleanCheckbox
                            value={bill?.Anul}
                            label={t(
                              "ReestrAnul.Cancelled",
                              "Аннулирован"
                            )}
                          />
                        </td>
                        <td className="report-money">
                          {formatter.format(
                            reestrBillAmount(bill)
                          )}
                        </td>
                      </tr>

                      <tr className="reestr-anul-items-row">
                        <td colSpan="6">
                          {items.length > 0 ? (
                            <table className="reestr-anul-items-table">
                              <thead>
                                <tr>
                                  <th className="report-text">
                                    {t(
                                      "ReestrAnul.Dish",
                                      "Блюдо"
                                    )}
                                  </th>
                                  <th className="report-money">
                                    {t(
                                      "Common.Quantity",
                                      "Количество"
                                    )}
                                  </th>
                                  <th className="report-money">
                                    {t(
                                      "Common.Price",
                                      "Цена"
                                    )}
                                  </th>
                                  <th className="report-money">
                                    {t(
                                      "ReestrAnul.Discount",
                                      "Скидка"
                                    )}
                                  </th>
                                  <th className="report-money">
                                    {t(
                                      "ReestrAnul.Amount",
                                      "Сумма"
                                    )}
                                  </th>
                                  <th className="report-check">
                                    {t(
                                      "ReestrAnul.PositionCancelled",
                                      "Анул."
                                    )}
                                  </th>
                                  <th className="report-check">
                                    {t(
                                      "ReestrAnul.Transfer",
                                      "Переброска"
                                    )}
                                  </th>
                                  <th className="report-text reestr-admin-col">
                                    {t(
                                      "ReestrAnul.Admin",
                                      "Администратор"
                                    )}
                                  </th>
                                </tr>
                              </thead>

                              <tbody>
                                {items.map((item, itemIndex) => (
                                  <tr
                                    key={`${bill?.ID ?? billIndex}-item-${itemIndex}`}
                                    className={
                                      item?.Anul
                                        ? "reestr-anul-item-cancelled"
                                        : ""
                                    }
                                  >
                                    <td className="report-text">
                                      {item?.NameDish || "—"}
                                    </td>
                                    <td className="report-money">
                                      {formatter.format(
                                        numericValue(
                                          item?.Kolvo
                                        )
                                      )}
                                    </td>
                                    <td className="report-money">
                                      {formatter.format(
                                        numericValue(
                                          item?.Price
                                        )
                                      )}
                                    </td>
                                    <td className="report-money">
                                      {formatter.format(
                                        numericValue(
                                          item?.Discount
                                        )
                                      )}
                                    </td>
                                    <td className="report-money">
                                      {formatter.format(
                                        numericValue(
                                          item?.Summ
                                        )
                                      )}
                                    </td>
                                    <td className="report-check">
                                      <ReportBooleanCheckbox
                                        value={item?.Anul}
                                        label={t(
                                          "ReestrAnul.PositionCancelled",
                                          "Анул."
                                        )}
                                      />
                                    </td>
                                    <td className="report-check">
                                      <ReportBooleanCheckbox
                                        value={item?.Perebr}
                                        label={t(
                                          "ReestrAnul.Transfer",
                                          "Переброска"
                                        )}
                                      />
                                    </td>
                                    <td className="report-text reestr-admin-value">
                                      {item?.AdminVozvr || ""}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <div className="reestr-anul-no-items">
                              {t(
                                "ReestrAnul.NoItems",
                                "В счете нет позиций."
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>

              <tfoot>
                <tr>
                  <td
                    colSpan="5"
                    className="report-text report-total-label"
                  >
                    {t("Common.Total", "Итого")}
                  </td>
                  <td className="report-money">
                    {formatter.format(
                      reestrBillGroupAmount(group)
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      ))}

      {groups.length > 0 && (
        <div className="reestr-anul-grand-total">
          <span>
            {t("ReestrAnul.BillsCount", "Счетов")}:{" "}
            <strong>
              {integerFormatter.format(rows.length)}
            </strong>
          </span>
          <span>
            {t("Common.Total", "Итого")}:{" "}
            <strong>
              {formatter.format(totalAmount)}
            </strong>
          </span>
        </div>
      )}
    </div>
  );
}

function buildReestrAnulPrintHtml({
  rows,
  dateFrom,
  dateTo,
  organizationName,
  locale,
  t
}) {
  const formatter = createMoneyFormatter(locale);
  const groups = reestrBillGroupByDate(rows);
  const totalAmount = rows.reduce(
    (sum, bill) => sum + reestrBillAmount(bill),
    0
  );

  let integerFormatter;

  try {
    integerFormatter = new Intl.NumberFormat(
      locale || "ru-RU",
      { maximumFractionDigits: 0 }
    );
  } catch {
    integerFormatter = new Intl.NumberFormat(
      "ru-RU",
      { maximumFractionDigits: 0 }
    );
  }

  const groupsHtml = groups
    .map((group) => {
      const billsHtml = group.bills
        .map((bill) => {
          const items = reestrBillItems(bill);

          const itemsHtml = items.length > 0
            ? `<table class="items">
<thead><tr>
<th>${escapeHtml(t("ReestrAnul.Dish", "Блюдо"))}</th>
<th>${escapeHtml(t("Common.Quantity", "Количество"))}</th>
<th>${escapeHtml(t("Common.Price", "Цена"))}</th>
<th>${escapeHtml(t("ReestrAnul.Discount", "Скидка"))}</th>
<th>${escapeHtml(t("ReestrAnul.Amount", "Сумма"))}</th>
<th>${escapeHtml(t("ReestrAnul.PositionCancelled", "Анул."))}</th>
<th>${escapeHtml(t("ReestrAnul.Transfer", "Переброска"))}</th>
<th>${escapeHtml(t("ReestrAnul.Admin", "Администратор"))}</th>
</tr></thead>
<tbody>${items.map((item) => `<tr${item?.Anul ? ' class="cancelled"' : ""}>
<td class="text">${escapeHtml(item?.NameDish || "—")}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(item?.Kolvo)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(item?.Price)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(item?.Discount)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(item?.Summ)))}</td>
<td class="check">${escapeHtml(booleanMark(item?.Anul))}</td>
<td class="check">${escapeHtml(booleanMark(item?.Perebr))}</td>
<td class="text admin">${escapeHtml(item?.AdminVozvr || "")}</td>
</tr>`).join("")}</tbody>
</table>`
            : `<div class="no-items">${escapeHtml(
                t(
                  "ReestrAnul.NoItems",
                  "В счете нет позиций."
                )
              )}</div>`;

          return `<tr class="bill${bill?.Anul ? " cancelled" : ""}">
<td class="number">${escapeHtml(String(bill?.Number ?? "—"))}</td>
<td class="text">${escapeHtml(formatReestrBillTime(bill?.Oplachen))}</td>
<td class="text">${escapeHtml(bill?.Waiter || "—")}</td>
<td class="check">${escapeHtml(booleanMark(bill?.Dolg))}</td>
<td class="check">${escapeHtml(booleanMark(bill?.Anul))}</td>
<td class="number">${escapeHtml(formatter.format(reestrBillAmount(bill)))}</td>
</tr>
<tr class="details"><td colspan="6">${itemsHtml}</td></tr>`;
        })
        .join("");

      return `<section class="day">
<div class="day-header">
<strong>${escapeHtml(formatReestrBillDate(group.dateValue, locale))}</strong>
<span>${escapeHtml(t("ReestrAnul.BillsCount", "Счетов"))}: ${escapeHtml(integerFormatter.format(group.bills.length))}</span>
<span>${escapeHtml(t("ReestrAnul.Amount", "Сумма"))}: ${escapeHtml(formatter.format(reestrBillGroupAmount(group)))}</span>
</div>
<table class="bills">
<thead><tr>
<th>${escapeHtml(t("ReestrAnul.Bill", "Счет"))}</th>
<th>${escapeHtml(t("Common.Time", "Время"))}</th>
<th>${escapeHtml(t("ReestrAnul.Waiter", "Официант"))}</th>
<th>${escapeHtml(t("ReestrAnul.Debt", "Долг"))}</th>
<th>${escapeHtml(t("ReestrAnul.Cancelled", "Аннулирован"))}</th>
<th>${escapeHtml(t("ReestrAnul.Amount", "Сумма"))}</th>
</tr></thead>
<tbody>${billsHtml}</tbody>
<tfoot><tr><td colspan="5">${escapeHtml(t("Common.Total", "Итого"))}</td><td class="number">${escapeHtml(formatter.format(reestrBillGroupAmount(group)))}</td></tr></tfoot>
</table>
</section>`;
    })
    .join("");

  const title = t(
    "ReestrAnul.Title",
    "Счета с ануляциями"
  );

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
@page { size: A4 landscape; margin: 8mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; color: #111; font-size: 8.5pt; }
.header { display: flex; justify-content: space-between; align-items: flex-end; gap: 8mm; margin-bottom: 4mm; }
h1 { margin: 0; font-size: 12pt; font-style: italic; font-weight: 700; }
.org { font-weight: 700; text-decoration: underline; white-space: nowrap; }
.day { margin-top: 4mm; break-inside: auto; }
.day-header { display: flex; align-items: center; gap: 7mm; padding: 1.4mm 2mm; background: #edf2f4; border-top: 0.35mm solid #657573; border-bottom: 0.2mm solid #aeb8b6; }
.day-header strong { font-size: 9pt; }
table { width: 100%; border-collapse: collapse; }
.bills > thead th { padding: 1.1mm 1.3mm; border-bottom: 0.3mm solid #555; font-size: 7.8pt; font-weight: 600; text-align: right; white-space: nowrap; }
.bills > thead th:nth-child(2),
.bills > thead th:nth-child(3) { text-align: left; }
.bill td { padding: 1.1mm 1.3mm; border-bottom: 0.15mm solid #d2d7d6; font-weight: 700; white-space: nowrap; }
.bill.cancelled td { background: #fff0cf; }
td.text { text-align: left; }
td.number { text-align: right; }
td.check { text-align: center; font-size: 10pt; }
.details > td { padding: 0 2mm 2mm 6mm; }
.items { margin-top: 0.5mm; background: #fafbfb; }
.items th { padding: 0.8mm 1.1mm; border-bottom: 0.2mm solid #c0c7c5; font-size: 7.2pt; font-weight: 600; text-align: right; }
.items th:first-child { text-align: left; }
.items td { padding: 0.7mm 1.1mm; border-bottom: 0.12mm dotted #c7cdcb; font-size: 7.5pt; }
.items .cancelled td { background: #fff0cf; }
.no-items { padding: 1mm 0; color: #777; font-style: italic; }
.bills tfoot td { padding: 1mm 1.3mm; border-top: 0.3mm solid #555; font-weight: 700; }
.grand-total { display: flex; justify-content: flex-end; gap: 10mm; margin-top: 5mm; padding-top: 2mm; border-top: 0.4mm solid #333; font-size: 9pt; }
</style></head><body>
<div class="header"><h1>${escapeHtml(title)} ${escapeHtml(t("Common.From", "с"))} ${escapeHtml(formatReportDate(dateFrom))} ${escapeHtml(t("Common.To", "по"))} ${escapeHtml(formatReportDate(dateTo))}</h1><div class="org">${escapeHtml(organizationName || "")}</div></div>
${groupsHtml}
<div class="grand-total"><span>${escapeHtml(t("ReestrAnul.BillsCount", "Счетов"))}: <strong>${escapeHtml(integerFormatter.format(rows.length))}</strong></span><span>${escapeHtml(t("Common.Total", "Итого"))}: <strong>${escapeHtml(formatter.format(totalAmount))}</strong></span></div>
</body></html>`;
}

function printReestrAnulReport(options) {
  const printWindow = window.open(
    "",
    "_blank",
    "width=1280,height=900"
  );

  if (!printWindow) {
    window.alert(
      options.t(
        "Reports.PrintPopupBlocked",
        "Браузер заблокировал окно печати. Разрешите всплывающие окна для Web Office."
      )
    );
    return;
  }

  printWindow.document.open();
  printWindow.document.write(
    buildReestrAnulPrintHtml(options)
  );
  printWindow.document.close();
  printWindow.focus();
  closePrintWindowAfterPrint(printWindow);

  window.setTimeout(() => {
    printWindow.print();
  }, 150);
}

function safeReestrAnulFilePart(value) {
  return String(value ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

function buildReestrAnulExportModel({
  rows,
  dateFrom,
  dateTo,
  organizationName,
  locale,
  t
}) {
  const exportRows = [];
  const groups = reestrBillGroupByDate(rows);

  for (const group of groups) {
    for (const bill of group.bills) {
      const items = reestrBillItems(bill);

      if (items.length === 0) {
        exportRows.push({
          Date: formatReestrBillDate(
            bill?.Oplachen,
            locale
          ),
          Bill: bill?.Number ?? "",
          Time: formatReestrBillTime(bill?.Oplachen),
          Waiter: bill?.Waiter || "",
          Debt: booleanMark(bill?.Dolg),
          BillCancelled: booleanMark(bill?.Anul),
          Dish: "",
          Quantity: "",
          Price: "",
          Discount: "",
          Summ: "",
          ItemCancelled: "",
          Transfer: "",
          Admin: ""
        });
        continue;
      }

      for (const item of items) {
        exportRows.push({
          Date: formatReestrBillDate(
            bill?.Oplachen,
            locale
          ),
          Bill: bill?.Number ?? "",
          Time: formatReestrBillTime(bill?.Oplachen),
          Waiter: bill?.Waiter || "",
          Debt: booleanMark(bill?.Dolg),
          BillCancelled: booleanMark(bill?.Anul),
          Dish: item?.NameDish || "",
          Quantity: numericValue(item?.Kolvo),
          Price: numericValue(item?.Price),
          Discount: numericValue(item?.Discount),
          Summ: numericValue(item?.Summ),
          ItemCancelled: booleanMark(item?.Anul),
          Transfer: booleanMark(item?.Perebr),
          Admin: item?.AdminVozvr || ""
        });
      }
    }
  }

  const totalAmount = rows.reduce(
    (sum, bill) => sum + reestrBillAmount(bill),
    0
  );

  return {
    title: `${t("ReestrAnul.Title", "Счета с ануляциями")} ${formatReportDate(dateFrom)} — ${formatReportDate(dateTo)}`,
    fileName: `ReestrAnul_${safeReestrAnulFilePart(dateFrom)}_${safeReestrAnulFilePart(dateTo)}_${safeReestrAnulFilePart(organizationName || "report")}`,
    orientation: "landscape",
    locale,
    meta: [
      {
        label: t(
          "ReestrAnul.Organization",
          "Организация"
        ),
        value: organizationName || ""
      }
    ],
    columns: [
      {
        key: "Date",
        title: t("ReestrAnul.Date", "Дата"),
        type: "text",
        width: 13
      },
      {
        key: "Bill",
        title: t("ReestrAnul.Bill", "Счет"),
        type: "integer",
        decimals: 0,
        width: 10
      },
      {
        key: "Time",
        title: t("Common.Time", "Время"),
        type: "text",
        width: 9
      },
      {
        key: "Waiter",
        title: t(
          "ReestrAnul.Waiter",
          "Официант"
        ),
        type: "text",
        width: 18
      },
      {
        key: "Debt",
        title: t("ReestrAnul.Debt", "Долг"),
        type: "text",
        width: 8
      },
      {
        key: "BillCancelled",
        title: t(
          "ReestrAnul.Cancelled",
          "Аннулирован"
        ),
        type: "text",
        width: 11
      },
      {
        key: "Dish",
        title: t("ReestrAnul.Dish", "Блюдо"),
        type: "text",
        width: 28
      },
      {
        key: "Quantity",
        title: t(
          "Common.Quantity",
          "Количество"
        ),
        type: "number",
        decimals: 2,
        width: 11
      },
      {
        key: "Price",
        title: t("Common.Price", "Цена"),
        type: "number",
        decimals: 2,
        width: 11
      },
      {
        key: "Discount",
        title: t(
          "ReestrAnul.Discount",
          "Скидка"
        ),
        type: "number",
        decimals: 2,
        width: 11
      },
      {
        key: "Summ",
        title: t("ReestrAnul.Amount", "Сумма"),
        type: "number",
        decimals: 2,
        width: 12
      },
      {
        key: "ItemCancelled",
        title: t(
          "ReestrAnul.PositionCancelled",
          "Анул."
        ),
        type: "text",
        width: 8
      },
      {
        key: "Transfer",
        title: t(
          "ReestrAnul.Transfer",
          "Переброска"
        ),
        type: "text",
        width: 11
      },
      {
        key: "Admin",
        title: t(
          "ReestrAnul.Admin",
          "Администратор"
        ),
        type: "text",
        width: 18
      }
    ],
    rows: exportRows,
    footerRows: [
      {
        label: t("Common.Total", "Итого"),
        values: {
          Summ: totalAmount
        }
      }
    ]
  };
}

function ReestrAnulReport({
  data,
  dateFrom,
  dateTo,
  organizationName,
  locale,
  fetchWithAuth,
  t,
  onReload
}) {
  const rows = getReestrAnulRows(data);
  const formatter = createMoneyFormatter(locale);

  let integerFormatter;

  try {
    integerFormatter = new Intl.NumberFormat(
      locale || "ru-RU",
      { maximumFractionDigits: 0 }
    );
  } catch {
    integerFormatter = new Intl.NumberFormat(
      "ru-RU",
      { maximumFractionDigits: 0 }
    );
  }

  const commonOptions = {
    rows,
    dateFrom,
    dateTo,
    organizationName,
    locale,
    t
  };

  async function handleExport(format) {
    try {
      await exportReportFile({
        fetchWithAuth,
        reportModel: buildReestrAnulExportModel(
          commonOptions
        ),
        format,
        errorMessage: t(
          "Report.ExportError",
          "Ошибка экспорта отчёта."
        )
      });
    } catch (err) {
      window.alert(
        err?.message ||
          t(
            "Report.ExportError",
            "Ошибка экспорта отчёта."
          )
      );
    }
  }

  return (
    <div className="reports-page reestr-anul-report-page">
      <div className="report-toolbar">
        <button
          type="button"
          className="report-run-button"
          onClick={onReload}
        >
          {t("Common.Generate", "Сформировать")}
        </button>

        <button
          type="button"
          className="report-action-button report-print-button"
          onClick={() =>
            printReestrAnulReport(commonOptions)
          }
        >
          {t("Common.Print", "Печать")}
        </button>

        <button
          type="button"
          className="report-action-button report-excel-button"
          onClick={() => handleExport("xlsx")}
        >
          {t("Common.Excel", "Excel")}
        </button>

        <button
          type="button"
          className="report-action-button report-word-button"
          onClick={() => handleExport("docx")}
        >
          {t("Common.Word", "Word")}
        </button>
      </div>

      <article className="revenue-report-sheet reestr-anul-sheet">
        <header className="revenue-report-heading reestr-anul-heading">
          <h3>
            {t(
              "ReestrAnul.Title",
              "Счета с ануляциями"
            )}{" "}
            {t("Common.From", "с")} {formatReportDate(dateFrom)}{" "}
            {t("Common.To", "по")} {formatReportDate(dateTo)}
          </h3>

          <div className="revenue-report-org">
            {organizationName || ""}
          </div>
        </header>

        {rows.length > 0 ? (
          <ReestrAnulReportTable
            rows={rows}
            formatter={formatter}
            integerFormatter={integerFormatter}
            locale={locale}
            t={t}
          />
        ) : (
          <div className="report-empty">
            {t(
              "Reports.NoDataForPeriod",
              "За выбранный период данных нет."
            )}
          </div>
        )}
      </article>
    </div>
  );
}


function getReestrExcisePayload(data) {
  const payload = data?.data ?? data?.Data ?? data;

  const main = normalizeRows(
    payload?.Main ??
    payload?.main ??
    payload?.Rows ??
    payload?.rows
  );

  const poMarkam = normalizeRows(
    payload?.PoMarkam ??
    payload?.poMarkam ??
    payload?.Pomarkam ??
    payload?.po_markam
  );

  return {
    main,
    poMarkam
  };
}

function reestrExciseGroupByShift(rows) {
  const sorted = [...rows].sort((left, right) => {
    const leftShift = String(left?.Smena ?? "");
    const rightShift = String(right?.Smena ?? "");

    if (leftShift !== rightShift) {
      return leftShift.localeCompare(rightShift);
    }

    const leftPaid = String(left?.Oplacheno ?? "");
    const rightPaid = String(right?.Oplacheno ?? "");

    if (leftPaid !== rightPaid) {
      return leftPaid.localeCompare(rightPaid);
    }

    const numberDiff =
      numericValue(left?.Number) - numericValue(right?.Number);

    if (numberDiff !== 0) {
      return numberDiff;
    }

    return String(left?.ExciseB ?? "").localeCompare(
      String(right?.ExciseB ?? "")
    );
  });

  const groups = [];

  for (const row of sorted) {
    const key = String(row?.Smena ?? "").trim() || "unknown";
    let group = groups[groups.length - 1];

    if (!group || group.key !== key) {
      group = {
        key,
        shift: row?.Smena ?? "",
        rows: []
      };
      groups.push(group);
    }

    group.rows.push(row);
  }

  return groups;
}

function sortReestrExciseMarks(rows) {
  return [...rows].sort((left, right) => {
    const dishCompare = String(left?.NameDish ?? "").localeCompare(
      String(right?.NameDish ?? ""),
      undefined,
      { sensitivity: "base" }
    );

    if (dishCompare !== 0) {
      return dishCompare;
    }

    return String(left?.ExciseB ?? "").localeCompare(
      String(right?.ExciseB ?? "")
    );
  });
}

function ReestrExciseMainTable({
  rows,
  formatter,
  t
}) {
  return (
    <div className="report-table-scroll reestr-excise-scroll">
      <table className="report-table reestr-excise-table">
        <thead>
          <tr>
            <th className="report-text reestr-excise-mark-col">
              {t("ReestrExcise.ExciseMark", "Акцизная марка")}
            </th>
            <th className="report-money">
              {t("ReestrExcise.Bill", "Счет")}
            </th>
            <th className="report-text">
              {t("Common.Time", "Время")}
            </th>
            <th className="report-text">
              {t("ReestrExcise.Waiter", "Официант")}
            </th>
            <th className="report-text reestr-excise-dish-col">
              {t("ReestrExcise.Dish", "Блюдо")}
            </th>
            <th className="report-money">
              {t("Common.Quantity", "Количество")}
            </th>
            <th className="report-money">
              {t("Common.Price", "Цена")}
            </th>
            <th className="report-money">
              {t("ReestrExcise.Amount", "Сумма")}
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`${row?.Smena ?? "shift"}-${row?.Number ?? "bill"}-${row?.ExciseB ?? "mark"}-${index}`}
            >
              <td className="report-text reestr-excise-mark">
                {row?.ExciseB || "—"}
              </td>
              <td className="report-money">
                {row?.Number ?? "—"}
              </td>
              <td className="report-text reestr-excise-time">
                {formatReestrBillTime(row?.Oplacheno)}
              </td>
              <td className="report-text">
                {row?.Waiter || "—"}
              </td>
              <td className="report-text">
                {row?.NameDish || "—"}
              </td>
              <td className="report-money">
                {formatter.format(numericValue(row?.Kolvo))}
              </td>
              <td className="report-money">
                {formatter.format(numericValue(row?.Price))}
              </td>
              <td className="report-money">
                {formatter.format(numericValue(row?.Summa))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReestrExciseByMarksTable({
  rows,
  formatter,
  t
}) {
  const sortedRows = sortReestrExciseMarks(rows);

  return (
    <section className="reestr-excise-marks-section">
      <h4>
        {t(
          "ReestrExcise.ByMarks",
          "По акцизным маркам"
        )}
      </h4>

      <div className="report-table-scroll reestr-excise-marks-scroll">
        <table className="report-table reestr-excise-marks-table">
          <thead>
            <tr>
              <th className="report-text">
                {t(
                  "ReestrExcise.ExciseMark",
                  "Акцизная марка"
                )}
              </th>
              <th className="report-text">
                {t("ReestrExcise.Dish", "Блюдо")}
              </th>
              <th className="report-money">
                {t("Common.Quantity", "Количество")}
              </th>
            </tr>
          </thead>

          <tbody>
            {sortedRows.map((row, index) => (
              <tr
                key={`${row?.ExciseB ?? "mark"}-${row?.NameDish ?? "dish"}-${index}`}
              >
                <td className="report-text reestr-excise-mark">
                  {row?.ExciseB || "—"}
                </td>
                <td className="report-text">
                  {row?.NameDish || "—"}
                </td>
                <td className="report-money">
                  {formatter.format(
                    numericValue(row?.Kolvo)
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function buildReestrExcisePrintHtml({
  main,
  poMarkam,
  dateFrom,
  dateTo,
  organizationName,
  locale,
  t
}) {
  const formatter = createMoneyFormatter(locale);
  const shiftGroups = reestrExciseGroupByShift(main);
  const markRows = sortReestrExciseMarks(poMarkam);

  const mainHtml = shiftGroups
    .map((group) => {
      const rowsHtml = group.rows
        .map((row) => `<tr>
<td class="text mark">${escapeHtml(row?.ExciseB || "—")}</td>
<td class="number">${escapeHtml(String(row?.Number ?? "—"))}</td>
<td class="text time">${escapeHtml(formatReestrBillTime(row?.Oplacheno))}</td>
<td class="text">${escapeHtml(row?.Waiter || "—")}</td>
<td class="text">${escapeHtml(row?.NameDish || "—")}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.Kolvo)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.Price)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.Summa)))}</td>
</tr>`)
        .join("");

      return `<section class="shift">
<div class="shift-title">${escapeHtml(t("ReestrExcise.Shift", "Смена"))}: ${escapeHtml(formatReportDate(group.shift))}</div>
<table class="main-table">
<thead><tr>
<th>${escapeHtml(t("ReestrExcise.ExciseMark", "Акцизная марка"))}</th>
<th>${escapeHtml(t("ReestrExcise.Bill", "Счет"))}</th>
<th>${escapeHtml(t("Common.Time", "Время"))}</th>
<th>${escapeHtml(t("ReestrExcise.Waiter", "Официант"))}</th>
<th>${escapeHtml(t("ReestrExcise.Dish", "Блюдо"))}</th>
<th>${escapeHtml(t("Common.Quantity", "Количество"))}</th>
<th>${escapeHtml(t("Common.Price", "Цена"))}</th>
<th>${escapeHtml(t("ReestrExcise.Amount", "Сумма"))}</th>
</tr></thead>
<tbody>${rowsHtml}</tbody>
</table>
</section>`;
    })
    .join("");

  const marksHtml = markRows
    .map((row) => `<tr>
<td class="text mark">${escapeHtml(row?.ExciseB || "—")}</td>
<td class="text">${escapeHtml(row?.NameDish || "—")}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.Kolvo)))}</td>
</tr>`)
    .join("");

  const title = t(
    "ReestrExcise.Title",
    "Реестр счетов с акцизными марками"
  );

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
@page { size: A4 landscape; margin: 8mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; color: #111; font-size: 8.2pt; }
.header { display: flex; justify-content: space-between; align-items: flex-end; gap: 8mm; margin-bottom: 4mm; }
h1 { margin: 0; font-size: 12pt; font-style: italic; font-weight: 700; }
.org { font-weight: 700; text-decoration: underline; white-space: nowrap; }
.shift { margin-top: 3.5mm; }
.shift-title { padding: 1.3mm 2mm; background: #e8efed; border-top: 0.35mm solid #647571; border-bottom: 0.2mm solid #acb8b5; font-size: 9pt; font-weight: 700; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th { padding: 1mm 1.1mm; border-bottom: 0.3mm solid #555; font-size: 7.2pt; font-weight: 600; text-align: right; white-space: nowrap; }
th:first-child, th:nth-child(3), th:nth-child(4), th:nth-child(5) { text-align: left; }
td { padding: 0.75mm 1.1mm; border-bottom: 0.12mm dotted #c7cdcb; font-size: 7.5pt; line-height: 1.05; }
td.text { text-align: left; }
td.number { text-align: right; white-space: nowrap; }
td.mark { font-family: Consolas, "Courier New", monospace; font-weight: 700; white-space: nowrap; }
td.time { white-space: nowrap; }
.main-table th:nth-child(1) { width: 14%; }
.main-table th:nth-child(2) { width: 7%; }
.main-table th:nth-child(3) { width: 7%; }
.main-table th:nth-child(4) { width: 14%; }
.main-table th:nth-child(5) { width: 28%; }
.main-table th:nth-child(6) { width: 10%; }
.main-table th:nth-child(7) { width: 10%; }
.main-table th:nth-child(8) { width: 10%; }
.marks { margin-top: 7mm; break-inside: auto; }
.marks h2 { margin: 0 0 2mm; font-size: 10pt; }
.marks-table { width: 75%; }
.marks-table th:first-child,
.marks-table th:nth-child(2) { text-align: left; }
.marks-table th:nth-child(1) { width: 30%; }
.marks-table th:nth-child(2) { width: 55%; }
.marks-table th:nth-child(3) { width: 15%; }
</style>
</head>
<body>
<div class="header">
  <h1>${escapeHtml(title)} ${escapeHtml(t("Common.From", "с"))} ${escapeHtml(formatReportDate(dateFrom))} ${escapeHtml(t("Common.To", "по"))} ${escapeHtml(formatReportDate(dateTo))}</h1>
  <div class="org">${escapeHtml(organizationName || "")}</div>
</div>
${mainHtml}
${markRows.length > 0 ? `<section class="marks"><h2>${escapeHtml(t("ReestrExcise.ByMarks", "По акцизным маркам"))}</h2><table class="marks-table"><thead><tr><th>${escapeHtml(t("ReestrExcise.ExciseMark", "Акцизная марка"))}</th><th>${escapeHtml(t("ReestrExcise.Dish", "Блюдо"))}</th><th>${escapeHtml(t("Common.Quantity", "Количество"))}</th></tr></thead><tbody>${marksHtml}</tbody></table></section>` : ""}
</body>
</html>`;
}

function printReestrExciseReport(options) {
  const printWindow = window.open(
    "",
    "_blank",
    "width=1280,height=900"
  );

  if (!printWindow) {
    window.alert(
      options.t(
        "Reports.PrintPopupBlocked",
        "Браузер заблокировал окно печати. Разрешите всплывающие окна для Web Office."
      )
    );
    return;
  }

  printWindow.document.open();
  printWindow.document.write(
    buildReestrExcisePrintHtml(options)
  );
  printWindow.document.close();
  printWindow.focus();
  closePrintWindowAfterPrint(printWindow);

  window.setTimeout(() => {
    printWindow.print();
  }, 150);
}

function safeReestrExciseFilePart(value) {
  return String(value ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

function buildReestrExciseExportModel({
  main,
  poMarkam,
  dateFrom,
  dateTo,
  organizationName,
  locale,
  t
}) {
  const rows = [];

  for (const group of reestrExciseGroupByShift(main)) {
    for (const row of group.rows) {
      rows.push({
        Section: t(
          "ReestrExcise.Registry",
          "Реестр"
        ),
        Shift: formatReportDate(row?.Smena),
        ExciseB: row?.ExciseB || "",
        Number: row?.Number ?? "",
        Time: formatReestrBillTime(row?.Oplacheno),
        Waiter: row?.Waiter || "",
        Dish: row?.NameDish || "",
        Kolvo: numericValue(row?.Kolvo),
        Price: numericValue(row?.Price),
        Summa: numericValue(row?.Summa)
      });
    }
  }

  if (poMarkam.length > 0) {
    rows.push({
      Section: "",
      Shift: "",
      ExciseB: "",
      Number: "",
      Time: "",
      Waiter: "",
      Dish: "",
      Kolvo: "",
      Price: "",
      Summa: ""
    });

    for (const row of sortReestrExciseMarks(poMarkam)) {
      rows.push({
        Section: t(
          "ReestrExcise.ByMarks",
          "По акцизным маркам"
        ),
        Shift: "",
        ExciseB: row?.ExciseB || "",
        Number: "",
        Time: "",
        Waiter: "",
        Dish: row?.NameDish || "",
        Kolvo: numericValue(row?.Kolvo),
        Price: "",
        Summa: ""
      });
    }
  }

  return {
    title: `${t("ReestrExcise.Title", "Реестр счетов с акцизными марками")} ${formatReportDate(dateFrom)} — ${formatReportDate(dateTo)}`,
    fileName: `ReestrExcise_${safeReestrExciseFilePart(dateFrom)}_${safeReestrExciseFilePart(dateTo)}_${safeReestrExciseFilePart(organizationName || "report")}`,
    orientation: "landscape",
    locale,
    meta: [
      {
        label: t(
          "ReestrExcise.Organization",
          "Организация"
        ),
        value: organizationName || ""
      }
    ],
    columns: [
      {
        key: "Section",
        title: t(
          "ReestrExcise.Section",
          "Раздел"
        ),
        type: "text",
        width: 18
      },
      {
        key: "Shift",
        title: t(
          "ReestrExcise.Shift",
          "Смена"
        ),
        type: "text",
        width: 12
      },
      {
        key: "ExciseB",
        title: t(
          "ReestrExcise.ExciseMark",
          "Акцизная марка"
        ),
        type: "text",
        width: 18
      },
      {
        key: "Number",
        title: t(
          "ReestrExcise.Bill",
          "Счет"
        ),
        type: "integer",
        decimals: 0,
        width: 10
      },
      {
        key: "Time",
        title: t(
          "Common.Time",
          "Время"
        ),
        type: "text",
        width: 9
      },
      {
        key: "Waiter",
        title: t(
          "ReestrExcise.Waiter",
          "Официант"
        ),
        type: "text",
        width: 18
      },
      {
        key: "Dish",
        title: t(
          "ReestrExcise.Dish",
          "Блюдо"
        ),
        type: "text",
        width: 30
      },
      {
        key: "Kolvo",
        title: t(
          "Common.Quantity",
          "Количество"
        ),
        type: "number",
        decimals: 2,
        width: 12
      },
      {
        key: "Price",
        title: t(
          "Common.Price",
          "Цена"
        ),
        type: "number",
        decimals: 2,
        width: 12
      },
      {
        key: "Summa",
        title: t(
          "ReestrExcise.Amount",
          "Сумма"
        ),
        type: "number",
        decimals: 2,
        width: 13
      }
    ],
    rows,
    footerRows: []
  };
}

function ReestrExciseReport({
  data,
  dateFrom,
  dateTo,
  organizationName,
  locale,
  fetchWithAuth,
  t,
  onReload
}) {
  const payload = getReestrExcisePayload(data);
  const shiftGroups = reestrExciseGroupByShift(
    payload.main
  );
  const formatter = createMoneyFormatter(locale);

  const commonOptions = {
    main: payload.main,
    poMarkam: payload.poMarkam,
    dateFrom,
    dateTo,
    organizationName,
    locale,
    t
  };

  async function handleExport(format) {
    try {
      await exportReportFile({
        fetchWithAuth,
        reportModel: buildReestrExciseExportModel(
          commonOptions
        ),
        format,
        errorMessage: t(
          "Report.ExportError",
          "Ошибка экспорта отчёта."
        )
      });
    } catch (err) {
      window.alert(
        err?.message ||
          t(
            "Report.ExportError",
            "Ошибка экспорта отчёта."
          )
      );
    }
  }

  const hasData =
    payload.main.length > 0 ||
    payload.poMarkam.length > 0;

  return (
    <div className="reports-page reestr-excise-report-page">
      <div className="report-toolbar">
        <button
          type="button"
          className="report-run-button"
          onClick={onReload}
        >
          {t("Common.Generate", "Сформировать")}
        </button>

        <button
          type="button"
          className="report-action-button report-print-button"
          onClick={() =>
            printReestrExciseReport(commonOptions)
          }
        >
          {t("Common.Print", "Печать")}
        </button>

        <button
          type="button"
          className="report-action-button report-excel-button"
          onClick={() => handleExport("xlsx")}
        >
          {t("Common.Excel", "Excel")}
        </button>

        <button
          type="button"
          className="report-action-button report-word-button"
          onClick={() => handleExport("docx")}
        >
          {t("Common.Word", "Word")}
        </button>
      </div>

      <article className="revenue-report-sheet reestr-excise-sheet">
        <header className="revenue-report-heading reestr-excise-heading">
          <h3>
            {t(
              "ReestrExcise.Title",
              "Реестр счетов с акцизными марками"
            )}{" "}
            {t("Common.From", "с")} {formatReportDate(dateFrom)}{" "}
            {t("Common.To", "по")} {formatReportDate(dateTo)}
          </h3>

          <div className="revenue-report-org">
            {organizationName || ""}
          </div>
        </header>

        {hasData ? (
          <>
            {shiftGroups.map((group) => (
              <section
                className="reestr-excise-shift"
                key={group.key}
              >
                <div className="reestr-excise-shift-header">
                  <span>
                    {t("ReestrExcise.Shift", "Смена")}
                  </span>
                  <strong>
                    {formatReportDate(group.shift)}
                  </strong>
                </div>

                <ReestrExciseMainTable
                  rows={group.rows}
                  formatter={formatter}
                  t={t}
                />
              </section>
            ))}

            {payload.poMarkam.length > 0 && (
              <ReestrExciseByMarksTable
                rows={payload.poMarkam}
                formatter={formatter}
                t={t}
              />
            )}
          </>
        ) : (
          <div className="report-empty">
            {t(
              "Reports.NoDataForPeriod",
              "За выбранный период данных нет."
            )}
          </div>
        )}
      </article>
    </div>
  );
}


function getAdvancePayload(data) {
  const payload = data?.data ?? data?.Data ?? data;

  return {
    received: normalizeRows(
      payload?.PoluchAdv ??
      payload?.poluchAdv ??
      payload?.Received ??
      payload?.received
    ),
    settled: normalizeRows(
      payload?.RaschitAdv ??
      payload?.raschitAdv ??
      payload?.Settled ??
      payload?.settled
    ),
    closed: normalizeRows(
      payload?.ZakrAdv ??
      payload?.zakrAdv ??
      payload?.Closed ??
      payload?.closed
    )
  };
}

function formatAdvanceDateTime(value, locale) {
  const text = String(value ?? "").trim();

  if (!text) {
    return "";
  }

  const match = text.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/
  );

  if (!match) {
    return text;
  }

  const datePart = `${match[1]}-${match[2]}-${match[3]}`;
  const timePart =
    match[4] && match[5]
      ? `${match[4]}:${match[5]}`
      : "";

  return [
    formatReportDate(datePart),
    timePart
  ]
    .filter(Boolean)
    .join(" ");
}

function formatAdvanceTime(value) {
  const text = String(value ?? "").trim();

  if (!text) {
    return "";
  }

  const match = text.match(/^(\d{1,2}):(\d{2})/);

  if (!match) {
    return text;
  }

  return `${String(Number(match[1])).padStart(2, "0")}:${match[2]}`;
}

function sortAdvanceRows(rows, field) {
  return [...rows].sort((left, right) =>
    String(left?.[field] ?? "").localeCompare(
      String(right?.[field] ?? "")
    )
  );
}

function AdvanceSection({
  title,
  rows,
  columns,
  totals,
  formatter,
  t
}) {
  return (
    <section className="advance-section">
      <div className="advance-section-title">
        <h4>{title}</h4>
        <span>
          {t("Advance.Records", "Записей")}: {rows.length}
        </span>
      </div>

      {rows.length > 0 ? (
        <div className="report-table-scroll advance-table-scroll">
          <table className="report-table advance-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={
                      column.align === "right"
                        ? "report-money"
                        : column.align === "center"
                          ? "report-check"
                          : "report-text"
                    }
                  >
                    {column.title}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={`${title}-${index}`}
                >
                  {columns.map((column) => {
                    const value = row?.[column.key];

                    if (column.type === "boolean") {
                      return (
                        <td
                          key={column.key}
                          className="report-check"
                        >
                          <ReportBooleanCheckbox
                            value={value}
                            label={column.title}
                          />
                        </td>
                      );
                    }

                    if (column.type === "money") {
                      return (
                        <td
                          key={column.key}
                          className="report-money"
                        >
                          {formatter.format(
                            numericValue(value)
                          )}
                        </td>
                      );
                    }

                    return (
                      <td
                        key={column.key}
                        className={
                          column.align === "right"
                            ? "report-money"
                            : "report-text"
                        }
                      >
                        {value ?? ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>

            {totals?.length > 0 && (
              <tfoot>
                <tr>
                  {columns.map((column, index) => {
                    if (index === 0) {
                      return (
                        <td
                          key={column.key}
                          className="report-text report-total-label"
                        >
                          {t("Common.Total", "Итого")}
                        </td>
                      );
                    }

                    const total = totals.find(
                      (item) => item.key === column.key
                    );

                    return (
                      <td
                        key={column.key}
                        className={
                          total
                            ? "report-money"
                            : "report-text"
                        }
                      >
                        {total
                          ? formatter.format(total.value)
                          : ""}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      ) : (
        <div className="advance-section-empty">
          {t(
            "Advance.NoRows",
            "Нет данных."
          )}
        </div>
      )}
    </section>
  );
}

function buildAdvanceReceivedRows(rows, locale) {
  return sortAdvanceRows(rows, "DateAdv").map((row) => ({
    DateAdv: formatAdvanceDateTime(
      row?.DateAdv,
      locale
    ),
    SummAdv: numericValue(row?.SummAdv),
    Waiter: row?.Waiter || "",
    Table: row?.Table || "",
    Client: row?.Client || "",
    DateBanket: row?.DateBanket
      ? formatReportDate(row.DateBanket)
      : "",
    TimeBanket: formatAdvanceTime(row?.TimeBanket),
    Admin: row?.Admin || "",
    Depozit: Boolean(row?.Depozit),
    Smena: row?.Smena
      ? formatReportDate(row.Smena)
      : "",
    TipOplati: row?.TipOplati || ""
  }));
}

function buildAdvanceSettledRows(rows, locale) {
  return sortAdvanceRows(rows, "DateAdv").map((row) => ({
    Oplacheno: formatAdvanceDateTime(
      row?.Oplacheno,
      locale
    ),
    DateAdv: formatAdvanceDateTime(
      row?.DateAdv,
      locale
    ),
    SumAdv: numericValue(row?.SumAdv),
    Waiter: row?.Waiter || "",
    Table: row?.Table || "",
    Client: row?.Client || "",
    Admin: row?.Admin || "",
    Depozit: Boolean(row?.Depozit),
    TipOplati: row?.TipOplati || ""
  }));
}

function buildAdvanceClosedRows(rows, locale) {
  return sortAdvanceRows(rows, "DateAdv").map((row) => ({
    Oplacheno: formatAdvanceDateTime(
      row?.Oplacheno,
      locale
    ),
    DateAdv: formatAdvanceDateTime(
      row?.DateAdv,
      locale
    ),
    Polucheno: numericValue(row?.Polucheno),
    Pogasheno: numericValue(row?.Pogasheno),
    Waiter: row?.Waiter || "",
    Table: row?.Table || "",
    Client: row?.Client || "",
    Admin: row?.Admin || "",
    Depozit: Boolean(row?.Depozit),
    IdNakl: row?.IdNakl ?? "",
    BanketZakr: Boolean(row?.BanketZakr),
    TipOplati: row?.TipOplati || ""
  }));
}

function advanceColumns(t) {
  return {
    received: [
      {
        key: "DateAdv",
        title: t(
          "Advance.AdvanceDate",
          "Дата аванса"
        )
      },
      {
        key: "SummAdv",
        title: t("Advance.Amount", "Сумма"),
        type: "money",
        align: "right"
      },
      {
        key: "Waiter",
        title: t("Advance.Waiter", "Официант")
      },
      {
        key: "Table",
        title: t("Advance.Table", "Стол")
      },
      {
        key: "Client",
        title: t("Advance.Client", "Клиент")
      },
      {
        key: "DateBanket",
        title: t(
          "Advance.BanquetDate",
          "Дата банкета"
        )
      },
      {
        key: "TimeBanket",
        title: t(
          "Advance.BanquetTime",
          "Время банкета"
        )
      },
      {
        key: "Admin",
        title: t(
          "Advance.Admin",
          "Администратор"
        )
      },
      {
        key: "Depozit",
        title: t(
          "Advance.Deposit",
          "Депозит"
        ),
        type: "boolean",
        align: "center"
      },
      {
        key: "Smena",
        title: t("Advance.Shift", "Смена")
      },
      {
        key: "TipOplati",
        title: t(
          "Advance.PaymentType",
          "Оплата"
        )
      }
    ],
    settled: [
      {
        key: "Oplacheno",
        title: t(
          "Advance.SettledAt",
          "Рассчитан"
        )
      },
      {
        key: "DateAdv",
        title: t(
          "Advance.AdvanceDate",
          "Дата аванса"
        )
      },
      {
        key: "SumAdv",
        title: t("Advance.Amount", "Сумма"),
        type: "money",
        align: "right"
      },
      {
        key: "Waiter",
        title: t("Advance.Waiter", "Официант")
      },
      {
        key: "Table",
        title: t("Advance.Table", "Стол")
      },
      {
        key: "Client",
        title: t("Advance.Client", "Клиент")
      },
      {
        key: "Admin",
        title: t(
          "Advance.Admin",
          "Администратор"
        )
      },
      {
        key: "Depozit",
        title: t(
          "Advance.Deposit",
          "Депозит"
        ),
        type: "boolean",
        align: "center"
      },
      {
        key: "TipOplati",
        title: t(
          "Advance.PaymentType",
          "Оплата"
        )
      }
    ],
    closed: [
      {
        key: "Oplacheno",
        title: t(
          "Advance.ClosedAt",
          "Закрыт"
        )
      },
      {
        key: "DateAdv",
        title: t(
          "Advance.AdvanceDate",
          "Дата аванса"
        )
      },
      {
        key: "Polucheno",
        title: t(
          "Advance.Received",
          "Получено"
        ),
        type: "money",
        align: "right"
      },
      {
        key: "Pogasheno",
        title: t(
          "Advance.Redeemed",
          "Погашено"
        ),
        type: "money",
        align: "right"
      },
      {
        key: "Waiter",
        title: t("Advance.Waiter", "Официант")
      },
      {
        key: "Table",
        title: t("Advance.Table", "Стол")
      },
      {
        key: "Client",
        title: t("Advance.Client", "Клиент")
      },
      {
        key: "Admin",
        title: t(
          "Advance.Admin",
          "Администратор"
        )
      },
      {
        key: "Depozit",
        title: t(
          "Advance.Deposit",
          "Депозит"
        ),
        type: "boolean",
        align: "center"
      },
      {
        key: "IdNakl",
        title: t(
          "Advance.Document",
          "№ документа"
        ),
        align: "right"
      },
      {
        key: "BanketZakr",
        title: t(
          "Advance.BanquetClosed",
          "Банкет закрыт"
        ),
        type: "boolean",
        align: "center"
      },
      {
        key: "TipOplati",
        title: t(
          "Advance.PaymentType",
          "Оплата"
        )
      }
    ]
  };
}

function advanceTotals(payload) {
  return {
    received: [
      {
        key: "SummAdv",
        value: sumField(payload.received, "SummAdv")
      }
    ],
    settled: [
      {
        key: "SumAdv",
        value: sumField(payload.settled, "SumAdv")
      }
    ],
    closed: [
      {
        key: "Polucheno",
        value: sumField(payload.closed, "Polucheno")
      },
      {
        key: "Pogasheno",
        value: sumField(payload.closed, "Pogasheno")
      }
    ]
  };
}

function advancePrintTableHtml({
  title,
  rows,
  columns,
  totals,
  formatter,
  t
}) {
  const head = columns
    .map(
      (column) =>
        `<th class="${column.align === "right" ? "number" : column.align === "center" ? "check" : "text"}">${escapeHtml(column.title)}</th>`
    )
    .join("");

  const body = rows
    .map(
      (row) =>
        `<tr>${columns
          .map((column) => {
            const value = row?.[column.key];

            if (column.type === "boolean") {
              return `<td class="check">${escapeHtml(booleanMark(value))}</td>`;
            }

            if (column.type === "money") {
              return `<td class="number">${escapeHtml(formatter.format(numericValue(value)))}</td>`;
            }

            return `<td class="${column.align === "right" ? "number" : "text"}">${escapeHtml(value ?? "")}</td>`;
          })
          .join("")}</tr>`
    )
    .join("");

  const footer =
    totals?.length > 0
      ? `<tfoot><tr>${columns
          .map((column, index) => {
            if (index === 0) {
              return `<td class="text total-label">${escapeHtml(t("Common.Total", "Итого"))}</td>`;
            }

            const total = totals.find(
              (item) => item.key === column.key
            );

            return total
              ? `<td class="number">${escapeHtml(formatter.format(total.value))}</td>`
              : `<td></td>`;
          })
          .join("")}</tr></tfoot>`
      : "";

  return `<section class="section">
<h2>${escapeHtml(title)}</h2>
<div class="record-count">${escapeHtml(t("Advance.Records", "Записей"))}: ${rows.length}</div>
${rows.length > 0 ? `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${footer}</table>` : `<div class="empty">${escapeHtml(t("Advance.NoRows", "Нет данных."))}</div>`}
</section>`;
}

function buildAdvancePrintHtml({
  payload,
  dateFrom,
  dateTo,
  organizationName,
  locale,
  t
}) {
  const formatter = createMoneyFormatter(locale);
  const columns = advanceColumns(t);
  const totals = advanceTotals(payload);

  const received = buildAdvanceReceivedRows(
    payload.received,
    locale
  );
  const settled = buildAdvanceSettledRows(
    payload.settled,
    locale
  );
  const closed = buildAdvanceClosedRows(
    payload.closed,
    locale
  );

  const title = t("Advance.Title", "Авансы");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
@page { size: A4 landscape; margin: 7mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; color: #111; font-size: 7.8pt; }
.header { display: flex; justify-content: space-between; align-items: flex-end; gap: 8mm; margin-bottom: 4mm; }
h1 { margin: 0; font-size: 12pt; font-style: italic; font-weight: 700; }
.org { font-weight: 700; text-decoration: underline; white-space: nowrap; }
.section { margin-top: 5mm; break-inside: auto; }
.section h2 { display: inline-block; margin: 0 4mm 1.5mm 0; font-size: 10pt; }
.record-count { display: inline-block; color: #68726f; font-size: 7.5pt; }
table { width: 100%; border-collapse: collapse; table-layout: auto; }
th { padding: 0.9mm 1mm; border-top: 0.3mm solid #555; border-bottom: 0.3mm solid #555; background: #f0f3f2; font-size: 6.8pt; font-weight: 600; white-space: nowrap; }
th.text { text-align: left; }
th.number { text-align: right; }
th.check { text-align: center; }
td { padding: 0.7mm 1mm; border-bottom: 0.12mm dotted #c8cfcd; font-size: 7pt; line-height: 1.03; vertical-align: top; }
td.text { text-align: left; }
td.number { text-align: right; white-space: nowrap; }
td.check { text-align: center; font-size: 9pt; white-space: nowrap; }
tfoot td { border-top: 0.3mm solid #555; border-bottom: 0; font-weight: 700; background: #f7f9f8; }
.total-label { text-align: left; }
.empty { padding: 2mm; color: #777; font-style: italic; }
</style>
</head>
<body>
<div class="header">
  <h1>${escapeHtml(title)} ${escapeHtml(t("Common.From", "с"))} ${escapeHtml(formatReportDate(dateFrom))} ${escapeHtml(t("Common.To", "по"))} ${escapeHtml(formatReportDate(dateTo))}</h1>
  <div class="org">${escapeHtml(organizationName || "")}</div>
</div>
${advancePrintTableHtml({
  title: t(
    "Advance.ReceivedAdvances",
    "Полученные авансы"
  ),
  rows: received,
  columns: columns.received,
  totals: totals.received,
  formatter,
  t
})}
${advancePrintTableHtml({
  title: t(
    "Advance.SettledTables",
    "Расчитанные столы"
  ),
  rows: settled,
  columns: columns.settled,
  totals: totals.settled,
  formatter,
  t
})}
${advancePrintTableHtml({
  title: t(
    "Advance.ClosedAdvances",
    "Закрытые авансы"
  ),
  rows: closed,
  columns: columns.closed,
  totals: totals.closed,
  formatter,
  t
})}
</body>
</html>`;
}

function printAdvanceReport(options) {
  const printWindow = window.open(
    "",
    "_blank",
    "width=1280,height=900"
  );

  if (!printWindow) {
    window.alert(
      options.t(
        "Reports.PrintPopupBlocked",
        "Браузер заблокировал окно печати. Разрешите всплывающие окна для Web Office."
      )
    );
    return;
  }

  printWindow.document.open();
  printWindow.document.write(
    buildAdvancePrintHtml(options)
  );
  printWindow.document.close();
  printWindow.focus();
  closePrintWindowAfterPrint(printWindow);

  window.setTimeout(() => {
    printWindow.print();
  }, 150);
}

function safeAdvanceFilePart(value) {
  return String(value ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

function buildAdvanceExportModel({
  payload,
  dateFrom,
  dateTo,
  organizationName,
  locale,
  t
}) {
  const exportRows = [];

  for (const row of buildAdvanceReceivedRows(
    payload.received,
    locale
  )) {
    exportRows.push({
      Section: t(
        "Advance.ReceivedAdvances",
        "Полученные авансы"
      ),
      EventDate: row.DateAdv,
      AdvanceDate: row.DateAdv,
      Amount: row.SummAdv,
      Received: "",
      Redeemed: "",
      Waiter: row.Waiter,
      Table: row.Table,
      Client: row.Client,
      BanquetDate: row.DateBanket,
      BanquetTime: row.TimeBanket,
      Admin: row.Admin,
      Deposit: booleanMark(row.Depozit),
      Shift: row.Smena,
      Document: "",
      BanquetClosed: "",
      PaymentType: row.TipOplati
    });
  }

  for (const row of buildAdvanceSettledRows(
    payload.settled,
    locale
  )) {
    exportRows.push({
      Section: t(
        "Advance.SettledTables",
        "Расчитанные столы"
      ),
      EventDate: row.Oplacheno,
      AdvanceDate: row.DateAdv,
      Amount: row.SumAdv,
      Received: "",
      Redeemed: "",
      Waiter: row.Waiter,
      Table: row.Table,
      Client: row.Client,
      BanquetDate: "",
      BanquetTime: "",
      Admin: row.Admin,
      Deposit: booleanMark(row.Depozit),
      Shift: "",
      Document: "",
      BanquetClosed: "",
      PaymentType: row.TipOplati
    });
  }

  for (const row of buildAdvanceClosedRows(
    payload.closed,
    locale
  )) {
    exportRows.push({
      Section: t(
        "Advance.ClosedAdvances",
        "Закрытые авансы"
      ),
      EventDate: row.Oplacheno,
      AdvanceDate: row.DateAdv,
      Amount: "",
      Received: row.Polucheno,
      Redeemed: row.Pogasheno,
      Waiter: row.Waiter,
      Table: row.Table,
      Client: row.Client,
      BanquetDate: "",
      BanquetTime: "",
      Admin: row.Admin,
      Deposit: booleanMark(row.Depozit),
      Shift: "",
      Document: row.IdNakl,
      BanquetClosed: booleanMark(row.BanketZakr),
      PaymentType: row.TipOplati
    });
  }

  return {
    title: `${t("Advance.Title", "Авансы")} ${formatReportDate(dateFrom)} — ${formatReportDate(dateTo)}`,
    fileName: `Advance_${safeAdvanceFilePart(dateFrom)}_${safeAdvanceFilePart(dateTo)}_${safeAdvanceFilePart(organizationName || "report")}`,
    orientation: "landscape",
    locale,
    meta: [
      {
        label: t(
          "Advance.Organization",
          "Организация"
        ),
        value: organizationName || ""
      }
    ],
    columns: [
      {
        key: "Section",
        title: t("Advance.Section", "Раздел"),
        type: "text",
        width: 22
      },
      {
        key: "EventDate",
        title: t(
          "Advance.EventDate",
          "Дата события"
        ),
        type: "text",
        width: 18
      },
      {
        key: "AdvanceDate",
        title: t(
          "Advance.AdvanceDate",
          "Дата аванса"
        ),
        type: "text",
        width: 18
      },
      {
        key: "Amount",
        title: t("Advance.Amount", "Сумма"),
        type: "number",
        decimals: 2,
        width: 13
      },
      {
        key: "Received",
        title: t(
          "Advance.Received",
          "Получено"
        ),
        type: "number",
        decimals: 2,
        width: 13
      },
      {
        key: "Redeemed",
        title: t(
          "Advance.Redeemed",
          "Погашено"
        ),
        type: "number",
        decimals: 2,
        width: 13
      },
      {
        key: "Waiter",
        title: t(
          "Advance.Waiter",
          "Официант"
        ),
        type: "text",
        width: 18
      },
      {
        key: "Table",
        title: t("Advance.Table", "Стол"),
        type: "text",
        width: 9
      },
      {
        key: "Client",
        title: t(
          "Advance.Client",
          "Клиент"
        ),
        type: "text",
        width: 22
      },
      {
        key: "BanquetDate",
        title: t(
          "Advance.BanquetDate",
          "Дата банкета"
        ),
        type: "text",
        width: 13
      },
      {
        key: "BanquetTime",
        title: t(
          "Advance.BanquetTime",
          "Время банкета"
        ),
        type: "text",
        width: 11
      },
      {
        key: "Admin",
        title: t(
          "Advance.Admin",
          "Администратор"
        ),
        type: "text",
        width: 18
      },
      {
        key: "Deposit",
        title: t(
          "Advance.Deposit",
          "Депозит"
        ),
        type: "text",
        width: 9
      },
      {
        key: "Shift",
        title: t(
          "Advance.Shift",
          "Смена"
        ),
        type: "text",
        width: 12
      },
      {
        key: "Document",
        title: t(
          "Advance.Document",
          "№ документа"
        ),
        type: "integer",
        decimals: 0,
        width: 12
      },
      {
        key: "BanquetClosed",
        title: t(
          "Advance.BanquetClosed",
          "Банкет закрыт"
        ),
        type: "text",
        width: 13
      },
      {
        key: "PaymentType",
        title: t(
          "Advance.PaymentType",
          "Оплата"
        ),
        type: "text",
        width: 12
      }
    ],
    rows: exportRows,
    footerRows: []
  };
}

function AdvanceReport({
  data,
  dateFrom,
  dateTo,
  organizationName,
  locale,
  fetchWithAuth,
  t,
  onReload
}) {
  const payload = getAdvancePayload(data);
  const formatter = createMoneyFormatter(locale);
  const columns = advanceColumns(t);
  const totals = advanceTotals(payload);

  const received = buildAdvanceReceivedRows(
    payload.received,
    locale
  );
  const settled = buildAdvanceSettledRows(
    payload.settled,
    locale
  );
  const closed = buildAdvanceClosedRows(
    payload.closed,
    locale
  );

  const commonOptions = {
    payload,
    dateFrom,
    dateTo,
    organizationName,
    locale,
    t
  };

  async function handleExport(format) {
    try {
      await exportReportFile({
        fetchWithAuth,
        reportModel: buildAdvanceExportModel(
          commonOptions
        ),
        format,
        errorMessage: t(
          "Report.ExportError",
          "Ошибка экспорта отчёта."
        )
      });
    } catch (err) {
      window.alert(
        err?.message ||
          t(
            "Report.ExportError",
            "Ошибка экспорта отчёта."
          )
      );
    }
  }

  const hasData =
    received.length > 0 ||
    settled.length > 0 ||
    closed.length > 0;

  return (
    <div className="reports-page advance-report-page">
      <div className="report-toolbar">
        <button
          type="button"
          className="report-run-button"
          onClick={onReload}
        >
          {t("Common.Generate", "Сформировать")}
        </button>

        <button
          type="button"
          className="report-action-button report-print-button"
          onClick={() => printAdvanceReport(commonOptions)}
        >
          {t("Common.Print", "Печать")}
        </button>

        <button
          type="button"
          className="report-action-button report-excel-button"
          onClick={() => handleExport("xlsx")}
        >
          {t("Common.Excel", "Excel")}
        </button>

        <button
          type="button"
          className="report-action-button report-word-button"
          onClick={() => handleExport("docx")}
        >
          {t("Common.Word", "Word")}
        </button>
      </div>

      <article className="revenue-report-sheet advance-report-sheet">
        <header className="revenue-report-heading advance-report-heading">
          <h3>
            {t("Advance.Title", "Авансы")}{" "}
            {t("Common.From", "с")} {formatReportDate(dateFrom)}{" "}
            {t("Common.To", "по")} {formatReportDate(dateTo)}
          </h3>

          <div className="revenue-report-org">
            {organizationName || ""}
          </div>
        </header>

        {hasData ? (
          <div className="advance-sections">
            <AdvanceSection
              title={t(
                "Advance.ReceivedAdvances",
                "Полученные авансы"
              )}
              rows={received}
              columns={columns.received}
              totals={totals.received}
              formatter={formatter}
              t={t}
            />

            <AdvanceSection
              title={t(
                "Advance.SettledTables",
                "Расчитанные столы"
              )}
              rows={settled}
              columns={columns.settled}
              totals={totals.settled}
              formatter={formatter}
              t={t}
            />

            <AdvanceSection
              title={t(
                "Advance.ClosedAdvances",
                "Закрытые авансы"
              )}
              rows={closed}
              columns={columns.closed}
              totals={totals.closed}
              formatter={formatter}
              t={t}
            />
          </div>
        ) : (
          <div className="report-empty">
            {t(
              "Reports.NoDataForPeriod",
              "За выбранный период данных нет."
            )}
          </div>
        )}
      </article>
    </div>
  );
}


function getRemainRows(data) {
  const payload = data?.data ?? data?.Data ?? data;

  if (Array.isArray(payload)) {
    return payload;
  }

  return normalizeRows(
    payload?.Main ??
    payload?.main ??
    payload?.Rows ??
    payload?.rows ??
    payload?.Remain ??
    payload?.remain
  );
}

function groupRemainRows(rows) {
  const sorted = [...rows].sort((left, right) => {
    const groupCompare = String(
      left?.NameGroup ?? ""
    ).localeCompare(
      String(right?.NameGroup ?? ""),
      undefined,
      { sensitivity: "base" }
    );

    if (groupCompare !== 0) {
      return groupCompare;
    }

    return String(left?.NameTov ?? "").localeCompare(
      String(right?.NameTov ?? ""),
      undefined,
      { sensitivity: "base" }
    );
  });

  const groups = [];

  for (const row of sorted) {
    const name =
      String(row?.NameGroup ?? "").trim() ||
      "—";

    let group = groups[groups.length - 1];

    if (!group || group.name !== name) {
      group = {
        name,
        rows: []
      };
      groups.push(group);
    }

    group.rows.push(row);
  }

  return groups;
}

function remainGroupSum(rows) {
  return rows.reduce(
    (sum, row) => sum + numericValue(row?.SumRest),
    0
  );
}

function RemainReportTable({
  rows,
  formatter,
  t
}) {
  const groups = groupRemainRows(rows);
  const totalSum = remainGroupSum(rows);

  return (
    <div className="remain-groups">
      <div className="remain-groups-grid">
        {groups.map((group) => (
          <section
            className="remain-group"
            key={group.name}
          >
          <div className="remain-group-title">
            {group.name}
          </div>

          <div className="report-table-scroll remain-table-scroll">
            <table className="report-table remain-table">
              <thead>
                <tr>
                  <th className="report-text">
                    {t("Remain.Product", "Товар")}
                  </th>
                  <th className="report-money">
                    {t(
                      "Remain.Quantity",
                      "Остаток"
                    )}
                  </th>
                  <th className="report-money">
                    {t(
                      "Remain.AveragePrice",
                      "Ср. цена"
                    )}
                  </th>
                  <th className="report-money">
                    {t(
                      "Remain.Amount",
                      "Сумма остатка"
                    )}
                  </th>
                </tr>
              </thead>

              <tbody>
                {group.rows.map((row, index) => (
                  <tr
                    key={`${row?.IdTov ?? "item"}-${index}`}
                  >
                    <td className="report-text">
                      {row?.NameTov || "—"}
                    </td>
                    <td className="report-money">
                      {formatter.format(
                        numericValue(row?.KolvoRest)
                      )}
                    </td>
                    <td className="report-money">
                      {formatter.format(
                        numericValue(row?.PriceAvg)
                      )}
                    </td>
                    <td className="report-money">
                      {formatter.format(
                        numericValue(row?.SumRest)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr>
                  <td
                    colSpan="3"
                    className="report-text report-total-label"
                  >
                    {t(
                      "Remain.GroupTotal",
                      "Итого по группе"
                    )}
                  </td>
                  <td className="report-money">
                    {formatter.format(
                      remainGroupSum(group.rows)
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          </section>
        ))}
      </div>

      {groups.length > 0 && (
        <div className="remain-grand-total">
          <span>
            {t("Common.Total", "Итого")}
          </span>
          <strong>
            {formatter.format(totalSum)}
          </strong>
        </div>
      )}
    </div>
  );
}

function buildRemainPrintHtml({
  rows,
  dateTo,
  organizationName,
  locale,
  t
}) {
  const formatter = createMoneyFormatter(locale);
  const groups = groupRemainRows(rows);
  const totalSum = remainGroupSum(rows);

  const groupsHtml = groups
    .map((group) => {
      const body = group.rows
        .map(
          (row) => `<tr>
<td class="text">${escapeHtml(row?.NameTov || "—")}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.KolvoRest)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.PriceAvg)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.SumRest)))}</td>
</tr>`
        )
        .join("");

      return `<section class="group">
<div class="group-title">${escapeHtml(group.name)}</div>
<table>
<thead><tr>
<th class="text">${escapeHtml(t("Remain.Product", "Товар"))}</th>
<th class="number">${escapeHtml(t("Remain.Quantity", "Остаток"))}</th>
<th class="number">${escapeHtml(t("Remain.AveragePrice", "Ср. цена"))}</th>
<th class="number">${escapeHtml(t("Remain.Amount", "Сумма остатка"))}</th>
</tr></thead>
<tbody>${body}</tbody>
<tfoot><tr>
<td colspan="3" class="text">${escapeHtml(t("Remain.GroupTotal", "Итого по группе"))}</td>
<td class="number">${escapeHtml(formatter.format(remainGroupSum(group.rows)))}</td>
</tr></tfoot>
</table>
</section>`;
    })
    .join("");

  const title = `${t(
    "Remain.Title",
    "Остатки на дату"
  )} ${formatReportDate(dateTo)}`;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
@page { size: A4 portrait; margin: 10mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; color: #111; font-size: 9pt; }
.header { display: flex; justify-content: space-between; align-items: flex-end; gap: 8mm; margin-bottom: 5mm; }
h1 { margin: 0; font-size: 13pt; font-style: italic; font-weight: 700; }
.org { font-weight: 700; text-decoration: underline; white-space: nowrap; }
.groups-columns { column-count: 2; column-gap: 5mm; column-fill: auto; }
.group { display: block; width: 100%; margin: 0 0 3mm; break-inside: auto; page-break-inside: auto; }
.group-title { padding: 1.1mm 1.4mm; background: #e8efed; border-top: 0.35mm solid #647571; border-bottom: 0.2mm solid #acb8b5; font-size: 8.2pt; font-weight: 700; break-after: avoid; page-break-after: avoid; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th { padding: 0.8mm 0.8mm; border-bottom: 0.3mm solid #555; font-size: 6.6pt; font-weight: 600; }
th.text { text-align: left; }
th.number { text-align: right; }
td { padding: 0.65mm 0.8mm; border-bottom: 0.12mm dotted #c7cdcb; font-size: 6.9pt; line-height: 1.05; }
td.text { text-align: left; }
td.number { text-align: right; white-space: nowrap; }
th:nth-child(1) { width: 46%; }
th:nth-child(2) { width: 18%; }
th:nth-child(3) { width: 18%; }
th:nth-child(4) { width: 18%; }
tfoot td { border-top: 0.3mm solid #555; border-bottom: 0; background: #f4f7f6; font-weight: 700; }
.grand-total { display: flex; justify-content: flex-end; gap: 8mm; margin-top: 4mm; padding-top: 2mm; border-top: 0.45mm solid #333; font-size: 9pt; }
</style>
</head>
<body>
<div class="header">
  <h1>${escapeHtml(title)}</h1>
  <div class="org">${escapeHtml(organizationName || "")}</div>
</div>
<div class="groups-columns">${groupsHtml}</div>
${groups.length > 0 ? `<div class="grand-total"><span>${escapeHtml(t("Common.Total", "Итого"))}</span><strong>${escapeHtml(formatter.format(totalSum))}</strong></div>` : ""}
</body>
</html>`;
}

function printRemainReport(options) {
  const printWindow = window.open(
    "",
    "_blank",
    "width=1100,height=900"
  );

  if (!printWindow) {
    window.alert(
      options.t(
        "Reports.PrintPopupBlocked",
        "Браузер заблокировал окно печати. Разрешите всплывающие окна для Web Office."
      )
    );
    return;
  }

  printWindow.document.open();
  printWindow.document.write(
    buildRemainPrintHtml(options)
  );
  printWindow.document.close();
  printWindow.focus();
  closePrintWindowAfterPrint(printWindow);

  window.setTimeout(() => {
    printWindow.print();
  }, 150);
}

function safeRemainFilePart(value) {
  return String(value ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

function buildRemainExportModel({
  rows,
  dateTo,
  organizationName,
  locale,
  t
}) {
  const exportRows = [];

  for (const group of groupRemainRows(rows)) {
    for (const row of group.rows) {
      exportRows.push({
        Group: group.name,
        Product: row?.NameTov || "",
        Quantity: numericValue(row?.KolvoRest),
        AveragePrice: numericValue(row?.PriceAvg),
        Amount: numericValue(row?.SumRest)
      });
    }

    exportRows.push({
      Group: group.name,
      Product: t(
        "Remain.GroupTotal",
        "Итого по группе"
      ),
      Quantity: "",
      AveragePrice: "",
      Amount: remainGroupSum(group.rows)
    });
  }

  return {
    title: `${t("Remain.Title", "Остатки на дату")} ${formatReportDate(dateTo)}`,
    fileName: `Remain_${safeRemainFilePart(dateTo)}_${safeRemainFilePart(organizationName || "report")}`,
    orientation: "portrait",
    locale,
    meta: [
      {
        label: t(
          "Remain.Organization",
          "Организация"
        ),
        value: organizationName || ""
      }
    ],
    columns: [
      {
        key: "Group",
        title: t("Remain.Group", "Группа"),
        type: "text",
        width: 24
      },
      {
        key: "Product",
        title: t("Remain.Product", "Товар"),
        type: "text",
        width: 34
      },
      {
        key: "Quantity",
        title: t("Remain.Quantity", "Остаток"),
        type: "number",
        decimals: 2,
        width: 13
      },
      {
        key: "AveragePrice",
        title: t(
          "Remain.AveragePrice",
          "Ср. цена"
        ),
        type: "number",
        decimals: 2,
        width: 13
      },
      {
        key: "Amount",
        title: t(
          "Remain.Amount",
          "Сумма остатка"
        ),
        type: "number",
        decimals: 2,
        width: 15
      }
    ],
    rows: exportRows,
    footerRows: [
      {
        label: t("Common.Total", "Итого"),
        values: {
          Amount: remainGroupSum(rows)
        }
      }
    ]
  };
}

function RemainReport({
  data,
  dateTo,
  organizationName,
  locale,
  fetchWithAuth,
  t,
  onReload
}) {
  const rows = getRemainRows(data);
  const formatter = createMoneyFormatter(locale);

  const commonOptions = {
    rows,
    dateTo,
    organizationName,
    locale,
    t
  };

  async function handleExport(format) {
    try {
      await exportReportFile({
        fetchWithAuth,
        reportModel: buildRemainExportModel(
          commonOptions
        ),
        format,
        errorMessage: t(
          "Report.ExportError",
          "Ошибка экспорта отчёта."
        )
      });
    } catch (err) {
      window.alert(
        err?.message ||
          t(
            "Report.ExportError",
            "Ошибка экспорта отчёта."
          )
      );
    }
  }

  return (
    <div className="reports-page remain-report-page">
      <div className="report-toolbar">
        <button
          type="button"
          className="report-run-button"
          onClick={onReload}
        >
          {t("Common.Generate", "Сформировать")}
        </button>

        <button
          type="button"
          className="report-action-button report-print-button"
          onClick={() =>
            printRemainReport(commonOptions)
          }
        >
          {t("Common.Print", "Печать")}
        </button>

        <button
          type="button"
          className="report-action-button report-excel-button"
          onClick={() => handleExport("xlsx")}
        >
          {t("Common.Excel", "Excel")}
        </button>

        <button
          type="button"
          className="report-action-button report-word-button"
          onClick={() => handleExport("docx")}
        >
          {t("Common.Word", "Word")}
        </button>
      </div>

      <article className="revenue-report-sheet remain-report-sheet">
        <header className="revenue-report-heading remain-report-heading">
          <h3>
            {t(
              "Remain.Title",
              "Остатки на дату"
            )}{" "}
            {formatReportDate(dateTo)}
          </h3>

          <div className="revenue-report-org">
            {organizationName || ""}
          </div>
        </header>

        {rows.length > 0 ? (
          <RemainReportTable
            rows={rows}
            formatter={formatter}
            t={t}
          />
        ) : (
          <div className="report-empty">
            {t(
              "Reports.NoDataForPeriod",
              "За выбранный период данных нет."
            )}
          </div>
        )}
      </article>
    </div>
  );
}


function getOborotRows(data) {
  const payload = data?.data ?? data?.Data ?? data;

  if (Array.isArray(payload)) {
    return payload;
  }

  return normalizeRows(
    payload?.Main ??
    payload?.main ??
    payload?.Rows ??
    payload?.rows ??
    payload?.Oborot ??
    payload?.oborot
  );
}

function groupOborotRows(rows) {
  const sorted = [...rows].sort((left, right) => {
    const categoryCompare = String(
      left?.Category ?? ""
    ).localeCompare(
      String(right?.Category ?? ""),
      undefined,
      { sensitivity: "base" }
    );

    if (categoryCompare !== 0) {
      return categoryCompare;
    }

    return String(left?.NameTov ?? "").localeCompare(
      String(right?.NameTov ?? ""),
      undefined,
      { sensitivity: "base" }
    );
  });

  const groups = [];

  for (const row of sorted) {
    const name =
      String(row?.Category ?? "").trim() ||
      "—";

    let group = groups[groups.length - 1];

    if (!group || group.name !== name) {
      group = {
        name,
        rows: []
      };
      groups.push(group);
    }

    group.rows.push(row);
  }

  return groups;
}

function oborotValue(value, formatter) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "";
  }

  return formatter.format(numericValue(value));
}

function OborotMetricCell({
  quantity,
  price,
  amount,
  formatter,
  t
}) {
  const quantityText = oborotValue(
    quantity,
    formatter
  );
  const priceText = oborotValue(price, formatter);
  const amountText = oborotValue(
    amount,
    formatter
  );

  if (!quantityText && !priceText && !amountText) {
    return <span className="oborot-empty-cell">—</span>;
  }

  return (
    <div className="oborot-metric-cell">
      {quantityText && (
        <div>
          <span>{t("Oborot.QtyShort", "К")}</span>
          <strong>{quantityText}</strong>
        </div>
      )}
      {priceText && (
        <div>
          <span>{t("Oborot.PriceShort", "Ц")}</span>
          <strong>{priceText}</strong>
        </div>
      )}
      {amountText && (
        <div>
          <span>{t("Oborot.SumShort", "С")}</span>
          <strong>{amountText}</strong>
        </div>
      )}
    </div>
  );
}

function OborotSubtotalCell({
  value,
  formatter,
  t
}) {
  return (
    <div className="oborot-metric-cell oborot-subtotal-metric">
      <div>
        <span>{t("Oborot.SumShort", "С")}</span>
        <strong>{formatter.format(value)}</strong>
      </div>
    </div>
  );
}

const OBOROT_SUM_FIELDS = [
  "SaldoSumm",
  "PrihodSumm",
  "PeremSumm",
  "UshloSumm",
  "SpisanoSumm",
  "RealizSumm",
  "FaktSumm"
];

function oborotTotals(rows) {
  const totals = {};

  for (const field of OBOROT_SUM_FIELDS) {
    totals[field] = sumField(rows, field);
  }

  return totals;
}

function OborotReportTable({
  rows,
  formatter,
  t
}) {
  const groups = groupOborotRows(rows);
  const grandTotals = oborotTotals(rows);

  return (
    <div className="oborot-report-content">
      <div className="oborot-legend">
        {t(
          "Oborot.Legend",
          "В ячейках: К — количество, Ц — цена, С — сумма."
        )}
      </div>

      {groups.map((group) => {
        const totals = oborotTotals(group.rows);

        return (
          <section
            className="oborot-group"
            key={group.name}
          >
            <div className="oborot-group-title">
              {group.name}
            </div>

            <div className="report-table-scroll oborot-table-scroll">
              <table className="report-table oborot-table">
                <thead>
                  <tr>
                    <th className="report-text oborot-product-col">
                      {t("Oborot.Product", "Товар")}
                    </th>
                    <th>{t("Oborot.Opening", "Нач. остаток")}</th>
                    <th>{t("Oborot.Incoming", "Приход")}</th>
                    <th>{t("Oborot.Transfer", "Перемещение")}</th>
                    <th>{t("Oborot.Outgoing", "Ушло")}</th>
                    <th>{t("Oborot.WrittenOff", "Списано")}</th>
                    <th>{t("Oborot.Sales", "Реализация")}</th>
                    <th>{t("Oborot.Stock", "Остаток")}</th>
                    <th>{t("Oborot.Actual", "Факт")}</th>
                    <th>{t("Oborot.Difference", "Разница")}</th>
                  </tr>
                </thead>

                <tbody>
                  {group.rows.map((row, index) => (
                    <tr
                      key={`${row?.IdTov ?? "item"}-${index}`}
                    >
                      <td className="report-text oborot-product">
                        {row?.NameTov || "—"}
                      </td>
                      <td>
                        <OborotMetricCell
                          quantity={row?.Saldo}
                          price={row?.SaldoPrice}
                          amount={row?.SaldoSumm}
                          formatter={formatter}
                          t={t}
                        />
                      </td>
                      <td>
                        <OborotMetricCell
                          quantity={row?.Prihod}
                          amount={row?.PrihodSumm}
                          formatter={formatter}
                          t={t}
                        />
                      </td>
                      <td>
                        <OborotMetricCell
                          quantity={row?.Perem}
                          amount={row?.PeremSumm}
                          formatter={formatter}
                          t={t}
                        />
                      </td>
                      <td>
                        <OborotMetricCell
                          quantity={row?.Ushlo}
                          amount={row?.UshloSumm}
                          formatter={formatter}
                          t={t}
                        />
                      </td>
                      <td>
                        <OborotMetricCell
                          quantity={row?.Spisano}
                          amount={row?.SpisanoSumm}
                          formatter={formatter}
                          t={t}
                        />
                      </td>
                      <td>
                        <OborotMetricCell
                          quantity={row?.Realiz}
                          amount={row?.RealizSumm}
                          formatter={formatter}
                          t={t}
                        />
                      </td>
                      <td>
                        <OborotMetricCell
                          quantity={row?.Ostatoe}
                          price={row?.PriceAVOst}
                          formatter={formatter}
                          t={t}
                        />
                      </td>
                      <td>
                        <OborotMetricCell
                          quantity={row?.Fakt}
                          amount={row?.FaktSumm}
                          formatter={formatter}
                          t={t}
                        />
                      </td>
                      <td>
                        <OborotMetricCell
                          quantity={row?.Raznica}
                          formatter={formatter}
                          t={t}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>

                <tfoot>
                  <tr>
                    <td className="report-text report-total-label">
                      {t(
                        "Oborot.CategoryTotal",
                        "Итого по категории"
                      )}
                    </td>
                    <td>
                      <OborotSubtotalCell
                        value={totals.SaldoSumm}
                        formatter={formatter}
                        t={t}
                      />
                    </td>
                    <td>
                      <OborotSubtotalCell
                        value={totals.PrihodSumm}
                        formatter={formatter}
                        t={t}
                      />
                    </td>
                    <td>
                      <OborotSubtotalCell
                        value={totals.PeremSumm}
                        formatter={formatter}
                        t={t}
                      />
                    </td>
                    <td>
                      <OborotSubtotalCell
                        value={totals.UshloSumm}
                        formatter={formatter}
                        t={t}
                      />
                    </td>
                    <td>
                      <OborotSubtotalCell
                        value={totals.SpisanoSumm}
                        formatter={formatter}
                        t={t}
                      />
                    </td>
                    <td>
                      <OborotSubtotalCell
                        value={totals.RealizSumm}
                        formatter={formatter}
                        t={t}
                      />
                    </td>
                    <td></td>
                    <td>
                      <OborotSubtotalCell
                        value={totals.FaktSumm}
                        formatter={formatter}
                        t={t}
                      />
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        );
      })}

      {groups.length > 0 && (
        <section className="oborot-grand-total">
          <div className="oborot-grand-total-title">
            {t("Common.Total", "Итого")}
          </div>
          <div className="oborot-grand-total-grid">
            <div>
              <span>{t("Oborot.Opening", "Нач. остаток")}</span>
              <strong>{formatter.format(grandTotals.SaldoSumm)}</strong>
            </div>
            <div>
              <span>{t("Oborot.Incoming", "Приход")}</span>
              <strong>{formatter.format(grandTotals.PrihodSumm)}</strong>
            </div>
            <div>
              <span>{t("Oborot.Transfer", "Перемещение")}</span>
              <strong>{formatter.format(grandTotals.PeremSumm)}</strong>
            </div>
            <div>
              <span>{t("Oborot.Outgoing", "Ушло")}</span>
              <strong>{formatter.format(grandTotals.UshloSumm)}</strong>
            </div>
            <div>
              <span>{t("Oborot.WrittenOff", "Списано")}</span>
              <strong>{formatter.format(grandTotals.SpisanoSumm)}</strong>
            </div>
            <div>
              <span>{t("Oborot.Sales", "Реализация")}</span>
              <strong>{formatter.format(grandTotals.RealizSumm)}</strong>
            </div>
            <div>
              <span>{t("Oborot.Actual", "Факт")}</span>
              <strong>{formatter.format(grandTotals.FaktSumm)}</strong>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function oborotPrintMetricHtml({
  quantity,
  price,
  amount,
  formatter,
  t
}) {
  const parts = [];

  if (quantity !== null && quantity !== undefined && quantity !== "") {
    parts.push(
      `<div><span>${escapeHtml(t("Oborot.QtyShort", "К"))}</span><b>${escapeHtml(formatter.format(numericValue(quantity)))}</b></div>`
    );
  }

  if (price !== null && price !== undefined && price !== "") {
    parts.push(
      `<div><span>${escapeHtml(t("Oborot.PriceShort", "Ц"))}</span><b>${escapeHtml(formatter.format(numericValue(price)))}</b></div>`
    );
  }

  if (amount !== null && amount !== undefined && amount !== "") {
    parts.push(
      `<div><span>${escapeHtml(t("Oborot.SumShort", "С"))}</span><b>${escapeHtml(formatter.format(numericValue(amount)))}</b></div>`
    );
  }

  return parts.length > 0
    ? `<div class="metric">${parts.join("")}</div>`
    : `<span class="empty">—</span>`;
}

function oborotPrintSubtotalHtml(value, formatter, t) {
  return `<div class="metric subtotal"><div><span>${escapeHtml(t("Oborot.SumShort", "С"))}</span><b>${escapeHtml(formatter.format(value))}</b></div></div>`;
}

function buildOborotPrintHtml({
  rows,
  dateFrom,
  dateTo,
  organizationName,
  locale,
  t
}) {
  const formatter = createMoneyFormatter(locale);
  const groups = groupOborotRows(rows);
  const grandTotals = oborotTotals(rows);

  const groupsHtml = groups
    .map((group) => {
      const totals = oborotTotals(group.rows);
      const body = group.rows
        .map((row) => `<tr>
<td class="product">${escapeHtml(row?.NameTov || "—")}</td>
<td>${oborotPrintMetricHtml({ quantity: row?.Saldo, price: row?.SaldoPrice, amount: row?.SaldoSumm, formatter, t })}</td>
<td>${oborotPrintMetricHtml({ quantity: row?.Prihod, amount: row?.PrihodSumm, formatter, t })}</td>
<td>${oborotPrintMetricHtml({ quantity: row?.Perem, amount: row?.PeremSumm, formatter, t })}</td>
<td>${oborotPrintMetricHtml({ quantity: row?.Ushlo, amount: row?.UshloSumm, formatter, t })}</td>
<td>${oborotPrintMetricHtml({ quantity: row?.Spisano, amount: row?.SpisanoSumm, formatter, t })}</td>
<td>${oborotPrintMetricHtml({ quantity: row?.Realiz, amount: row?.RealizSumm, formatter, t })}</td>
<td>${oborotPrintMetricHtml({ quantity: row?.Ostatoe, price: row?.PriceAVOst, formatter, t })}</td>
<td>${oborotPrintMetricHtml({ quantity: row?.Fakt, amount: row?.FaktSumm, formatter, t })}</td>
<td>${oborotPrintMetricHtml({ quantity: row?.Raznica, formatter, t })}</td>
</tr>`)
        .join("");

      return `<section class="group">
<div class="group-title">${escapeHtml(group.name)}</div>
<table>
<thead><tr>
<th class="product">${escapeHtml(t("Oborot.Product", "Товар"))}</th>
<th>${escapeHtml(t("Oborot.Opening", "Нач. остаток"))}</th>
<th>${escapeHtml(t("Oborot.Incoming", "Приход"))}</th>
<th>${escapeHtml(t("Oborot.Transfer", "Перемещение"))}</th>
<th>${escapeHtml(t("Oborot.Outgoing", "Ушло"))}</th>
<th>${escapeHtml(t("Oborot.WrittenOff", "Списано"))}</th>
<th>${escapeHtml(t("Oborot.Sales", "Реализация"))}</th>
<th>${escapeHtml(t("Oborot.Stock", "Остаток"))}</th>
<th>${escapeHtml(t("Oborot.Actual", "Факт"))}</th>
<th>${escapeHtml(t("Oborot.Difference", "Разница"))}</th>
</tr></thead>
<tbody>${body}</tbody>
<tfoot><tr>
<td class="product total-label">${escapeHtml(t("Oborot.CategoryTotal", "Итого по категории"))}</td>
<td>${oborotPrintSubtotalHtml(totals.SaldoSumm, formatter, t)}</td>
<td>${oborotPrintSubtotalHtml(totals.PrihodSumm, formatter, t)}</td>
<td>${oborotPrintSubtotalHtml(totals.PeremSumm, formatter, t)}</td>
<td>${oborotPrintSubtotalHtml(totals.UshloSumm, formatter, t)}</td>
<td>${oborotPrintSubtotalHtml(totals.SpisanoSumm, formatter, t)}</td>
<td>${oborotPrintSubtotalHtml(totals.RealizSumm, formatter, t)}</td>
<td></td>
<td>${oborotPrintSubtotalHtml(totals.FaktSumm, formatter, t)}</td>
<td></td>
</tr></tfoot>
</table>
</section>`;
    })
    .join("");

  const title = t(
    "Oborot.Title",
    "Оборотная ведомость"
  );

  const grandItems = [
    [t("Oborot.Opening", "Нач. остаток"), grandTotals.SaldoSumm],
    [t("Oborot.Incoming", "Приход"), grandTotals.PrihodSumm],
    [t("Oborot.Transfer", "Перемещение"), grandTotals.PeremSumm],
    [t("Oborot.Outgoing", "Ушло"), grandTotals.UshloSumm],
    [t("Oborot.WrittenOff", "Списано"), grandTotals.SpisanoSumm],
    [t("Oborot.Sales", "Реализация"), grandTotals.RealizSumm],
    [t("Oborot.Actual", "Факт"), grandTotals.FaktSumm]
  ]
    .map(([label, value]) => `<div><span>${escapeHtml(label)}</span><b>${escapeHtml(formatter.format(value))}</b></div>`)
    .join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
@page { size: A4 portrait; margin: 6mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; color: #111; font-size: 6.4pt; }
.header { display: flex; justify-content: space-between; align-items: flex-end; gap: 4mm; margin-bottom: 2.5mm; }
h1 { margin: 0; font-size: 10.5pt; font-style: italic; font-weight: 700; }
.org { max-width: 36%; font-size: 7pt; font-weight: 700; text-align: right; text-decoration: underline; }
.legend { margin-bottom: 2mm; color: #66706d; font-size: 5.8pt; }
.group { margin: 0 0 2.5mm; page-break-inside: auto; }
.group-title { padding: 0.9mm 1.1mm; background: #e8efed; border-top: 0.3mm solid #647571; border-bottom: 0.15mm solid #acb8b5; font-size: 7pt; font-weight: 700; break-after: avoid; page-break-after: avoid; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th { padding: 0.55mm 0.35mm; border-bottom: 0.2mm solid #555; font-size: 5.2pt; line-height: 1; text-align: center; vertical-align: bottom; }
th.product { width: 22%; text-align: left; }
th:not(.product) { width: 8.666%; }
td { padding: 0.45mm 0.35mm; border-bottom: 0.1mm dotted #c8cecc; vertical-align: top; }
td.product { text-align: left; font-size: 5.8pt; overflow-wrap: anywhere; }
.metric { display: flex; flex-direction: column; gap: 0.12mm; }
.metric > div { display: flex; justify-content: space-between; gap: 0.4mm; white-space: nowrap; }
.metric span { color: #6d7774; font-size: 4.7pt; }
.metric b { font-size: 5.2pt; font-weight: 600; }
.empty { color: #a0a6a4; }
tfoot td { border-top: 0.2mm solid #555; border-bottom: 0; background: #f3f6f5; font-weight: 700; }
.subtotal b { font-weight: 700; }
.total-label { font-weight: 700; }
.grand { margin-top: 3mm; padding-top: 1.5mm; border-top: 0.35mm solid #333; }
.grand-title { margin-bottom: 1mm; font-size: 7.5pt; font-weight: 700; }
.grand-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.7mm 4mm; }
.grand-grid > div { display: flex; justify-content: space-between; gap: 2mm; }
.grand-grid span { color: #596460; }
.grand-grid b { font-weight: 700; white-space: nowrap; }
</style>
</head>
<body>
<div class="header">
  <h1>${escapeHtml(title)} ${escapeHtml(t("Common.From", "с"))} ${escapeHtml(formatReportDate(dateFrom))} ${escapeHtml(t("Common.To", "по"))} ${escapeHtml(formatReportDate(dateTo))}</h1>
  <div class="org">${escapeHtml(organizationName || "")}</div>
</div>
<div class="legend">${escapeHtml(t("Oborot.Legend", "В ячейках: К — количество, Ц — цена, С — сумма."))}</div>
${groupsHtml}
${groups.length > 0 ? `<section class="grand"><div class="grand-title">${escapeHtml(t("Common.Total", "Итого"))}</div><div class="grand-grid">${grandItems}</div></section>` : ""}
</body>
</html>`;
}

function printOborotReport(options) {
  const printWindow = window.open(
    "",
    "_blank",
    "width=1050,height=900"
  );

  if (!printWindow) {
    window.alert(
      options.t(
        "Reports.PrintPopupBlocked",
        "Браузер заблокировал окно печати. Разрешите всплывающие окна для Web Office."
      )
    );
    return;
  }

  printWindow.document.open();
  printWindow.document.write(
    buildOborotPrintHtml(options)
  );
  printWindow.document.close();
  printWindow.focus();
  closePrintWindowAfterPrint(printWindow);

  window.setTimeout(() => {
    printWindow.print();
  }, 150);
}

function safeOborotFilePart(value) {
  return String(value ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

function buildOborotExportModel({
  rows,
  dateFrom,
  dateTo,
  organizationName,
  locale,
  t
}) {
  const exportRows = [];

  for (const group of groupOborotRows(rows)) {
    for (const row of group.rows) {
      exportRows.push({
        Category: group.name,
        Product: row?.NameTov || "",
        Saldo: row?.Saldo ?? "",
        SaldoPrice: row?.SaldoPrice ?? "",
        SaldoSumm: row?.SaldoSumm ?? "",
        Prihod: row?.Prihod ?? "",
        PrihodSumm: row?.PrihodSumm ?? "",
        Perem: row?.Perem ?? "",
        PeremSumm: row?.PeremSumm ?? "",
        Ushlo: row?.Ushlo ?? "",
        UshloSumm: row?.UshloSumm ?? "",
        Spisano: row?.Spisano ?? "",
        SpisanoSumm: row?.SpisanoSumm ?? "",
        Realiz: row?.Realiz ?? "",
        RealizSumm: row?.RealizSumm ?? "",
        Ostatoe: row?.Ostatoe ?? "",
        PriceAVOst: row?.PriceAVOst ?? "",
        Fakt: row?.Fakt ?? "",
        FaktSumm: row?.FaktSumm ?? "",
        Raznica: row?.Raznica ?? ""
      });
    }

    const totals = oborotTotals(group.rows);
    exportRows.push({
      Category: group.name,
      Product: t(
        "Oborot.CategoryTotal",
        "Итого по категории"
      ),
      Saldo: "",
      SaldoPrice: "",
      SaldoSumm: totals.SaldoSumm,
      Prihod: "",
      PrihodSumm: totals.PrihodSumm,
      Perem: "",
      PeremSumm: totals.PeremSumm,
      Ushlo: "",
      UshloSumm: totals.UshloSumm,
      Spisano: "",
      SpisanoSumm: totals.SpisanoSumm,
      Realiz: "",
      RealizSumm: totals.RealizSumm,
      Ostatoe: "",
      PriceAVOst: "",
      Fakt: "",
      FaktSumm: totals.FaktSumm,
      Raznica: ""
    });
  }

  const totals = oborotTotals(rows);

  return {
    title: `${t("Oborot.Title", "Оборотная ведомость")} ${formatReportDate(dateFrom)} — ${formatReportDate(dateTo)}`,
    fileName: `Oborot_${safeOborotFilePart(dateFrom)}_${safeOborotFilePart(dateTo)}_${safeOborotFilePart(organizationName || "report")}`,
    orientation: "portrait",
    locale,
    meta: [
      {
        label: t(
          "Oborot.Organization",
          "Организация"
        ),
        value: organizationName || ""
      }
    ],
    columns: [
      { key: "Category", title: t("Oborot.Category", "Категория"), type: "text", width: 22 },
      { key: "Product", title: t("Oborot.Product", "Товар"), type: "text", width: 28 },
      { key: "Saldo", title: t("Oborot.OpeningQty", "Нач. остаток, кол."), type: "number", decimals: 2, width: 13 },
      { key: "SaldoPrice", title: t("Oborot.OpeningPrice", "Нач. цена"), type: "number", decimals: 2, width: 13 },
      { key: "SaldoSumm", title: t("Oborot.OpeningSum", "Нач. сумма"), type: "number", decimals: 2, width: 14 },
      { key: "Prihod", title: t("Oborot.IncomingQty", "Приход, кол."), type: "number", decimals: 2, width: 13 },
      { key: "PrihodSumm", title: t("Oborot.IncomingSum", "Приход, сумма"), type: "number", decimals: 2, width: 14 },
      { key: "Perem", title: t("Oborot.TransferQty", "Перемещение, кол."), type: "number", decimals: 2, width: 14 },
      { key: "PeremSumm", title: t("Oborot.TransferSum", "Перемещение, сумма"), type: "number", decimals: 2, width: 16 },
      { key: "Ushlo", title: t("Oborot.OutgoingQty", "Ушло, кол."), type: "number", decimals: 2, width: 13 },
      { key: "UshloSumm", title: t("Oborot.OutgoingSum", "Ушло, сумма"), type: "number", decimals: 2, width: 14 },
      { key: "Spisano", title: t("Oborot.WrittenOffQty", "Списано, кол."), type: "number", decimals: 2, width: 13 },
      { key: "SpisanoSumm", title: t("Oborot.WrittenOffSum", "Списано, сумма"), type: "number", decimals: 2, width: 14 },
      { key: "Realiz", title: t("Oborot.SalesQty", "Реализация, кол."), type: "number", decimals: 2, width: 13 },
      { key: "RealizSumm", title: t("Oborot.SalesSum", "Реализация, сумма"), type: "number", decimals: 2, width: 15 },
      { key: "Ostatoe", title: t("Oborot.StockQty", "Остаток, кол."), type: "number", decimals: 2, width: 13 },
      { key: "PriceAVOst", title: t("Oborot.StockPrice", "Цена остатка"), type: "number", decimals: 2, width: 13 },
      { key: "Fakt", title: t("Oborot.ActualQty", "Факт, кол."), type: "number", decimals: 2, width: 13 },
      { key: "FaktSumm", title: t("Oborot.ActualSum", "Факт, сумма"), type: "number", decimals: 2, width: 14 },
      { key: "Raznica", title: t("Oborot.DifferenceQty", "Разница, кол."), type: "number", decimals: 2, width: 13 }
    ],
    rows: exportRows,
    footerRows: [
      {
        label: t("Common.Total", "Итого"),
        values: {
          SaldoSumm: totals.SaldoSumm,
          PrihodSumm: totals.PrihodSumm,
          PeremSumm: totals.PeremSumm,
          UshloSumm: totals.UshloSumm,
          SpisanoSumm: totals.SpisanoSumm,
          RealizSumm: totals.RealizSumm,
          FaktSumm: totals.FaktSumm
        }
      }
    ]
  };
}

function OborotReport({
  data,
  dateFrom,
  dateTo,
  organizationName,
  locale,
  fetchWithAuth,
  t,
  onReload
}) {
  const rows = getOborotRows(data);
  const formatter = createMoneyFormatter(locale);

  const commonOptions = {
    rows,
    dateFrom,
    dateTo,
    organizationName,
    locale,
    t
  };

  async function handleExport(format) {
    try {
      await exportReportFile({
        fetchWithAuth,
        reportModel: buildOborotExportModel(
          commonOptions
        ),
        format,
        errorMessage: t(
          "Report.ExportError",
          "Ошибка экспорта отчёта."
        )
      });
    } catch (err) {
      window.alert(
        err?.message ||
          t(
            "Report.ExportError",
            "Ошибка экспорта отчёта."
          )
      );
    }
  }

  return (
    <div className="reports-page oborot-report-page">
      <div className="report-toolbar">
        <button
          type="button"
          className="report-run-button"
          onClick={onReload}
        >
          {t("Common.Generate", "Сформировать")}
        </button>

        <button
          type="button"
          className="report-action-button report-print-button"
          onClick={() =>
            printOborotReport(commonOptions)
          }
        >
          {t("Common.Print", "Печать")}
        </button>

        <button
          type="button"
          className="report-action-button report-excel-button"
          onClick={() => handleExport("xlsx")}
        >
          {t("Common.Excel", "Excel")}
        </button>

        <button
          type="button"
          className="report-action-button report-word-button"
          onClick={() => handleExport("docx")}
        >
          {t("Common.Word", "Word")}
        </button>
      </div>

      <article className="revenue-report-sheet oborot-report-sheet">
        <header className="revenue-report-heading oborot-report-heading">
          <h3>
            {t(
              "Oborot.Title",
              "Оборотная ведомость"
            )}{" "}
            {t("Common.From", "с")} {formatReportDate(dateFrom)}{" "}
            {t("Common.To", "по")} {formatReportDate(dateTo)}
          </h3>

          <div className="revenue-report-org">
            {organizationName || ""}
          </div>
        </header>

        {rows.length > 0 ? (
          <OborotReportTable
            rows={rows}
            formatter={formatter}
            t={t}
          />
        ) : (
          <div className="report-empty">
            {t(
              "Reports.NoDataForPeriod",
              "За выбранный период данных нет."
            )}
          </div>
        )}
      </article>
    </div>
  );
}


function getBlank1Rows(data) {
  const payload = data?.data ?? data?.Data ?? data;

  if (Array.isArray(payload)) {
    return payload;
  }

  return normalizeRows(
    payload?.Main ??
    payload?.main ??
    payload?.Rows ??
    payload?.rows ??
    payload?.Blank1 ??
    payload?.blank1
  );
}

function groupBlank1Rows(rows) {
  const sorted = [...rows].sort((left, right) => {
    const categoryCompare = String(
      left?.Categor ?? ""
    ).localeCompare(
      String(right?.Categor ?? ""),
      undefined,
      { sensitivity: "base" }
    );

    if (categoryCompare !== 0) {
      return categoryCompare;
    }

    return String(left?.NameTov ?? "").localeCompare(
      String(right?.NameTov ?? ""),
      undefined,
      { sensitivity: "base" }
    );
  });

  const groups = [];

  for (const row of sorted) {
    const name =
      String(row?.Categor ?? "").trim() ||
      "—";

    let group = groups[groups.length - 1];

    if (!group || group.name !== name) {
      group = {
        name,
        rows: []
      };
      groups.push(group);
    }

    group.rows.push(row);
  }

  return groups;
}

function Blank1ReportTable({
  rows,
  t
}) {
  const groups = groupBlank1Rows(rows);

  return (
    <div className="blank1-groups">
      {groups.map((group) => (
        <section
          className="blank1-group"
          key={group.name}
        >
          <div className="blank1-category">
            {group.name}
          </div>

          <table className="blank1-table">
            <thead>
              <tr>
                <th className="blank1-name-col">
                  {t(
                    "Blank1.Product",
                    "Наименование"
                  )}
                </th>
                <th className="blank1-fact-col">
                  {t("Blank1.Fact", "Факт")}
                </th>
              </tr>
            </thead>

            <tbody>
              {group.rows.map((row, index) => (
                <tr
                  key={`${row?.IdTov ?? "item"}-${index}`}
                >
                  <td className="blank1-product">
                    {row?.NameTov || "—"}
                  </td>
                  <td className="blank1-fact-cell">
                    <span aria-hidden="true">&nbsp;</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}

function blank1SystemDate() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function blank1Title(t) {
  return `${t(
    "Blank1.Title",
    "Бланк переучета простой"
  )} ${t("Blank1.AsOf", "на")} ${formatReportDate(
    blank1SystemDate()
  )}`;
}

function buildBlank1PrintHtml({
  rows,
  departmentName,
  organizationName,
  t
}) {
  const groups = groupBlank1Rows(rows);

  const groupsHtml = groups
    .map((group) => {
      const body = group.rows
        .map(
          (row) => `<tr>
<td class="product">${escapeHtml(row?.NameTov || "—")}</td>
<td class="fact">&nbsp;</td>
</tr>`
        )
        .join("");

      return `<section class="group">
<div class="category">${escapeHtml(group.name)}</div>
<table>
<thead><tr>
<th class="product">${escapeHtml(t("Blank1.Product", "Наименование"))}</th>
<th class="fact">${escapeHtml(t("Blank1.Fact", "Факт"))}</th>
</tr></thead>
<tbody>${body}</tbody>
</table>
</section>`;
    })
    .join("");

  const title = blank1Title(t);

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
@page { size: A4 portrait; margin: 10mm 12mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; color: #111; font-size: 9pt; }
.header { margin-bottom: 5mm; }
h1 { margin: 0; font-size: 13pt; font-style: italic; font-weight: 700; }
.warehouse { margin-top: 2mm; font-size: 10pt; font-weight: 700; }
.group { margin: 0 0 4mm; break-inside: auto; page-break-inside: auto; }
.category { padding: 1.4mm 2mm; border-top: 0.35mm solid #555; border-bottom: 0.25mm solid #777; background: #ecefee; font-size: 9pt; font-weight: 700; break-after: avoid; page-break-after: avoid; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; break-inside: auto; page-break-inside: auto; }
thead { display: table-header-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
th { padding: 1.2mm 1.5mm; border-bottom: 0.35mm solid #555; font-size: 8pt; font-weight: 700; }
th.product { width: 50%; text-align: left; }
th.fact { width: 50%; text-align: center; }
td { height: 7.5mm; padding: 1.2mm 1.5mm; vertical-align: bottom; }
td.product { border-bottom: 0.15mm dotted #c4c4c4; }
td.fact { border-bottom: 0.35mm solid #111; }
</style>
</head>
<body>
<div class="header">
  <h1>${escapeHtml(title)}</h1>
  <div class="warehouse">${escapeHtml(t("Blank1.Warehouse", "Склад"))}: ${escapeHtml(departmentName || "")}</div>
</div>
${groupsHtml}
</body>
</html>`;
}

function printBlank1Report(options) {
  const printWindow = window.open(
    "",
    "_blank",
    "width=1050,height=900"
  );

  if (!printWindow) {
    window.alert(
      options.t(
        "Reports.PrintPopupBlocked",
        "Браузер заблокировал окно печати. Разрешите всплывающие окна для Web Office."
      )
    );
    return;
  }

  printWindow.document.open();
  printWindow.document.write(
    buildBlank1PrintHtml(options)
  );
  printWindow.document.close();
  printWindow.focus();
  closePrintWindowAfterPrint(printWindow);

  window.setTimeout(() => {
    printWindow.print();
  }, 150);
}

function safeBlank1FilePart(value) {
  return String(value ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

function buildBlank1ExportModel({
  rows,
  departmentName,
  organizationName,
  locale,
  t
}) {
  const exportRows = [];

  for (const group of groupBlank1Rows(rows)) {
    for (const row of group.rows) {
      exportRows.push({
        Category: group.name,
        Product: row?.NameTov || "",
        Fact: ""
      });
    }
  }

  return {
    title: t(
      "Blank1.Title",
      "Бланк переучета простой"
    ),
    fileName: `Blank1_${safeBlank1FilePart(departmentName || "warehouse")}`,
    orientation: "portrait",
    locale,
    meta: [
      {
        label: t(
          "Blank1.Organization",
          "Организация"
        ),
        value: organizationName || ""
      },
      {
        label: t(
          "Blank1.Warehouse",
          "Склад"
        ),
        value: departmentName || ""
      }
    ],
    columns: [
      {
        key: "Category",
        title: t("Blank1.Category", "Категория"),
        type: "text",
        width: 24
      },
      {
        key: "Product",
        title: t(
          "Blank1.Product",
          "Наименование"
        ),
        type: "text",
        width: 38
      },
      {
        key: "Fact",
        title: t("Blank1.Fact", "Факт"),
        type: "text",
        width: 22
      }
    ],
    rows: exportRows,
    footerRows: []
  };
}

function Blank1Report({
  data,
  departmentName,
  organizationName,
  locale,
  fetchWithAuth,
  t,
  onReload
}) {
  const rows = getBlank1Rows(data);

  const commonOptions = {
    rows,
    departmentName,
    organizationName,
    locale,
    t
  };

  async function handleExport(format) {
    try {
      await exportReportFile({
        fetchWithAuth,
        reportModel: buildBlank1ExportModel(
          commonOptions
        ),
        format,
        errorMessage: t(
          "Report.ExportError",
          "Ошибка экспорта отчёта."
        )
      });
    } catch (err) {
      window.alert(
        err?.message ||
          t(
            "Report.ExportError",
            "Ошибка экспорта отчёта."
          )
      );
    }
  }

  return (
    <div className="reports-page blank1-report-page">
      <div className="report-toolbar">
        <button
          type="button"
          className="report-run-button"
          onClick={onReload}
        >
          {t("Common.Generate", "Сформировать")}
        </button>

        <button
          type="button"
          className="report-action-button report-print-button"
          onClick={() =>
            printBlank1Report(commonOptions)
          }
        >
          {t("Common.Print", "Печать")}
        </button>

        <button
          type="button"
          className="report-action-button report-excel-button"
          onClick={() => handleExport("xlsx")}
        >
          {t("Common.Excel", "Excel")}
        </button>

        <button
          type="button"
          className="report-action-button report-word-button"
          onClick={() => handleExport("docx")}
        >
          {t("Common.Word", "Word")}
        </button>
      </div>

      <article className="revenue-report-sheet blank1-report-sheet">
        <header className="revenue-report-heading blank1-report-heading">
          <div>
            <h3>{blank1Title(t)}</h3>
            <div className="blank1-warehouse">
              {t("Blank1.Warehouse", "Склад")}:{" "}
              <strong>
                {departmentName || ""}
              </strong>
            </div>
          </div>

        </header>

        {rows.length > 0 ? (
          <Blank1ReportTable
            rows={rows}
            t={t}
          />
        ) : (
          <div className="report-empty">
            {t(
              "Reports.NoDataForPeriod",
              "Данных нет."
            )}
          </div>
        )}
      </article>
    </div>
  );
}


function blank1ComplexDateParts(dateFrom) {
  const text = String(dateFrom ?? "").trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!match) {
    return [];
  }

  const start = new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3])
    )
  );

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);

    const year = date.getUTCFullYear();
    const month = String(
      date.getUTCMonth() + 1
    ).padStart(2, "0");
    const day = String(
      date.getUTCDate()
    ).padStart(2, "0");

    return {
      iso: `${year}-${month}-${day}`,
      short: `${day}.${month}`,
      full: `${day}.${month}.${year}`
    };
  });
}

function blank1ComplexTitle({
  dateFrom,
  t
}) {
  return `${t(
    "Blank2.Title",
    "Бланк переучета сложный"
  )} ${t("Blank2.From", "с")} ${formatReportDate(
    dateFrom
  )}`;
}

function Blank1ComplexReportTable({
  rows,
  dateFrom,
  t
}) {
  const groups = groupBlank1Rows(rows);
  const dates = blank1ComplexDateParts(dateFrom);

  return (
    <div className="blank2-groups">
      {groups.map((group) => (
        <section
          className="blank2-group"
          key={group.name}
        >
          <div className="blank2-category">
            {group.name}
          </div>

          <div className="blank2-table-scroll">
            <table className="blank2-table">
              <thead>
                <tr>
                  <th className="blank2-name-col">
                    {t(
                      "Blank1.Product",
                      "Наименование"
                    )}
                  </th>

                  {dates.map((date) => (
                    <th
                      className="blank2-entry-col"
                      key={date.iso}
                    >
                      {date.short}
                    </th>
                  ))}

                  <th className="blank2-entry-col">
                    {t("Blank1.Fact", "Факт")}
                  </th>
                </tr>
              </thead>

              <tbody>
                {group.rows.map((row, index) => (
                  <tr
                    key={`${row?.IdTov ?? "item"}-${index}`}
                  >
                    <td className="blank2-product">
                      {row?.NameTov || "—"}
                    </td>

                    {dates.map((date) => (
                      <td
                        className="blank2-write-cell"
                        key={`${row?.IdTov ?? index}-${date.iso}`}
                      >
                        &nbsp;
                      </td>
                    ))}

                    <td className="blank2-write-cell">
                      &nbsp;
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

function buildBlank1ComplexPrintHtml({
  rows,
  dateFrom,
  departmentName,
  t
}) {
  const groups = groupBlank1Rows(rows);
  const dates = blank1ComplexDateParts(dateFrom);

  const dateHeaders = dates
    .map(
      (date) =>
        `<th class="entry">${escapeHtml(date.short)}</th>`
    )
    .join("");

  const groupsHtml = groups
    .map((group) => {
      const body = group.rows
        .map((row) => {
          const dateCells = dates
            .map(() => `<td class="write">&nbsp;</td>`)
            .join("");

          return `<tr>
<td class="product">${escapeHtml(row?.NameTov || "—")}</td>
${dateCells}
<td class="write">&nbsp;</td>
</tr>`;
        })
        .join("");

      return `<section class="group">
<div class="category">${escapeHtml(group.name)}</div>
<table>
<thead>
<tr>
<th class="product">${escapeHtml(t("Blank1.Product", "Наименование"))}</th>
${dateHeaders}
<th class="entry">${escapeHtml(t("Blank1.Fact", "Факт"))}</th>
</tr>
</thead>
<tbody>${body}</tbody>
</table>
</section>`;
    })
    .join("");

  const title = blank1ComplexTitle({
    dateFrom,
    t
  });

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
@page { size: A4 portrait; margin: 8mm 7mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; color: #111; font-size: 7.2pt; }
.header { margin-bottom: 3mm; }
h1 { margin: 0; font-size: 11pt; font-style: italic; font-weight: 700; }
.warehouse { margin-top: 1.2mm; font-size: 8.2pt; font-weight: 700; }
.group { margin: 0 0 3mm; break-inside: auto; page-break-inside: auto; }
.category { padding: 1mm 1.3mm; border-top: 0.35mm solid #555; border-bottom: 0.25mm solid #777; background: #ecefee; font-size: 7.5pt; font-weight: 700; break-after: avoid; page-break-after: avoid; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; break-inside: auto; page-break-inside: auto; }
thead { display: table-header-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
th { height: 5.5mm; padding: 0.6mm 0.3mm; border: 0.25mm solid #777; font-size: 6.4pt; font-weight: 700; text-align: center; white-space: nowrap; }
th.product { width: 29%; text-align: left; }
th.entry { width: 8.875%; }
td { height: 7.5mm; padding: 0.6mm 0.7mm; vertical-align: middle; }
td.product { border: 0.2mm solid #aaa; font-size: 6.8pt; overflow-wrap: anywhere; }
td.write { border: 0.3mm solid #555; }
</style>
</head>
<body>
<div class="header">
  <h1>${escapeHtml(title)}</h1>
  <div class="warehouse">${escapeHtml(t("Blank1.Warehouse", "Склад"))}: ${escapeHtml(departmentName || "")}</div>
</div>
${groupsHtml}
</body>
</html>`;
}

function printBlank1ComplexReport(options) {
  const printWindow = window.open(
    "",
    "_blank",
    "width=1250,height=900"
  );

  if (!printWindow) {
    window.alert(
      options.t(
        "Reports.PrintPopupBlocked",
        "Браузер заблокировал окно печати. Разрешите всплывающие окна для Web Office."
      )
    );
    return;
  }

  printWindow.document.open();
  printWindow.document.write(
    buildBlank1ComplexPrintHtml(options)
  );
  printWindow.document.close();
  printWindow.focus();
  closePrintWindowAfterPrint(printWindow);

  window.setTimeout(() => {
    printWindow.print();
  }, 150);
}

function buildBlank1ComplexExportModel({
  rows,
  dateFrom,
  departmentName,
  locale,
  t
}) {
  const dates = blank1ComplexDateParts(dateFrom);
  const exportRows = [];

  for (const group of groupBlank1Rows(rows)) {
    for (const row of group.rows) {
      const exportRow = {
        Category: group.name,
        Product: row?.NameTov || ""
      };

      dates.forEach((date, index) => {
        exportRow[`Day${index + 1}`] = "";
      });

      exportRow.Fact = "";
      exportRows.push(exportRow);
    }
  }

  return {
    title: blank1ComplexTitle({
      dateFrom,
      t
    }),
    fileName: `Blank1Complex_${safeBlank1FilePart(
      dateFrom
    )}_${safeBlank1FilePart(
      departmentName || "warehouse"
    )}`,
    orientation: "portrait",
    locale,
    meta: [
      {
        label: t(
          "Blank1.Warehouse",
          "Склад"
        ),
        value: departmentName || ""
      }
    ],
    columns: [
      {
        key: "Category",
        title: t(
          "Blank1.Category",
          "Категория"
        ),
        type: "text",
        width: 20
      },
      {
        key: "Product",
        title: t(
          "Blank1.Product",
          "Наименование"
        ),
        type: "text",
        width: 32
      },
      ...dates.map((date, index) => ({
        key: `Day${index + 1}`,
        title: date.short,
        type: "text",
        width: 10
      })),
      {
        key: "Fact",
        title: t("Blank1.Fact", "Факт"),
        type: "text",
        width: 12
      }
    ],
    rows: exportRows,
    footerRows: []
  };
}

function Blank1ComplexReport({
  data,
  dateFrom,
  departmentName,
  locale,
  fetchWithAuth,
  t,
  onReload
}) {
  const rows = getBlank1Rows(data);

  const commonOptions = {
    rows,
    dateFrom,
    departmentName,
    locale,
    t
  };

  async function handleExport(format) {
    try {
      await exportReportFile({
        fetchWithAuth,
        reportModel: buildBlank1ComplexExportModel(
          commonOptions
        ),
        format,
        errorMessage: t(
          "Report.ExportError",
          "Ошибка экспорта отчёта."
        )
      });
    } catch (err) {
      window.alert(
        err?.message ||
          t(
            "Report.ExportError",
            "Ошибка экспорта отчёта."
          )
      );
    }
  }

  return (
    <div className="reports-page blank2-report-page">
      <div className="report-toolbar">
        <button
          type="button"
          className="report-run-button"
          onClick={onReload}
        >
          {t("Common.Generate", "Сформировать")}
        </button>

        <button
          type="button"
          className="report-action-button report-print-button"
          onClick={() =>
            printBlank1ComplexReport(commonOptions)
          }
        >
          {t("Common.Print", "Печать")}
        </button>

        <button
          type="button"
          className="report-action-button report-excel-button"
          onClick={() => handleExport("xlsx")}
        >
          {t("Common.Excel", "Excel")}
        </button>

        <button
          type="button"
          className="report-action-button report-word-button"
          onClick={() => handleExport("docx")}
        >
          {t("Common.Word", "Word")}
        </button>
      </div>

      <article className="revenue-report-sheet blank2-report-sheet">
        <header className="revenue-report-heading blank2-report-heading">
          <div>
            <h3>
              {blank1ComplexTitle({
                dateFrom,
                t
              })}
            </h3>

            <div className="blank2-warehouse">
              {t("Blank1.Warehouse", "Склад")}:{" "}
              <strong>
                {departmentName || ""}
              </strong>
            </div>
          </div>
        </header>

        {rows.length > 0 ? (
          <Blank1ComplexReportTable
            rows={rows}
            dateFrom={dateFrom}
            t={t}
          />
        ) : (
          <div className="report-empty">
            {t(
              "Reports.NoDataForPeriod",
              "Данных нет."
            )}
          </div>
        )}
      </article>
    </div>
  );
}


function getOborotSvodRows(data) {
  const payload = data?.data ?? data?.Data ?? data;

  if (Array.isArray(payload)) {
    return payload;
  }

  return normalizeRows(
    payload?.Main ??
    payload?.main ??
    payload?.Rows ??
    payload?.rows ??
    payload?.OborotSvod ??
    payload?.oborotSvod ??
    payload?.oborotsvod
  );
}

function groupOborotSvodRows(rows) {
  const sorted = [...rows].sort((left, right) => {
    const categoryCompare = String(
      left?.Category ?? ""
    ).localeCompare(
      String(right?.Category ?? ""),
      undefined,
      { sensitivity: "base" }
    );

    if (categoryCompare !== 0) {
      return categoryCompare;
    }

    return String(left?.NameTov ?? "").localeCompare(
      String(right?.NameTov ?? ""),
      undefined,
      { sensitivity: "base" }
    );
  });

  const groups = [];

  for (const row of sorted) {
    const name =
      String(row?.Category ?? "").trim() ||
      "—";

    let group = groups[groups.length - 1];

    if (!group || group.name !== name) {
      group = {
        name,
        rows: []
      };
      groups.push(group);
    }

    group.rows.push(row);
  }

  return groups;
}

const OBOROT_SVOD_SUM_FIELDS = [
  "SaldoSumm",
  "PrihodSumm",
  "RealizSumm",
  "SpisanoDishSumm",
  "SpisanoTovSumm",
  "OststokSum",
  "FaktSumm"
];

function oborotSvodTotals(rows) {
  const totals = {};

  for (const field of OBOROT_SVOD_SUM_FIELDS) {
    totals[field] = sumField(rows, field);
  }

  return totals;
}

function OborotSvodReportTable({
  rows,
  formatter,
  t
}) {
  const groups = groupOborotSvodRows(rows);
  const grandTotals = oborotSvodTotals(rows);

  return (
    <div className="oborot-report-content oborot-svod-report-content">
      <div className="oborot-legend">
        {t(
          "Oborot.Legend",
          "В ячейках: К — количество, Ц — цена, С — сумма."
        )}
      </div>

      {groups.map((group) => {
        const totals = oborotSvodTotals(group.rows);

        return (
          <section
            className="oborot-group"
            key={group.name}
          >
            <div className="oborot-group-title">
              {group.name}
            </div>

            <div className="report-table-scroll oborot-table-scroll">
              <table className="report-table oborot-table oborot-svod-table">
                <thead>
                  <tr>
                    <th className="report-text oborot-product-col">
                      {t("Oborot.Product", "Товар")}
                    </th>
                    <th>{t("Oborot.Opening", "Нач. остаток")}</th>
                    <th>{t("Oborot.Incoming", "Приход")}</th>
                    <th>{t("Oborot.Sales", "Реализация")}</th>
                    <th>
                      {t(
                        "OborotSvod.WrittenOffDish",
                        "Списано блюд"
                      )}
                    </th>
                    <th>
                      {t(
                        "OborotSvod.WrittenOffProduct",
                        "Списано товаров"
                      )}
                    </th>
                    <th>{t("Oborot.Stock", "Остаток")}</th>
                    <th>{t("Oborot.Actual", "Факт")}</th>
                  </tr>
                </thead>

                <tbody>
                  {group.rows.map((row, index) => (
                    <tr
                      key={`${row?.IdTov ?? "item"}-${index}`}
                    >
                      <td className="report-text oborot-product">
                        {row?.NameTov || "—"}
                      </td>

                      <td>
                        <OborotMetricCell
                          quantity={row?.Saldo}
                          price={row?.SaldoPrice}
                          amount={row?.SaldoSumm}
                          formatter={formatter}
                          t={t}
                        />
                      </td>

                      <td>
                        <OborotMetricCell
                          quantity={row?.Prihod}
                          amount={row?.PrihodSumm}
                          formatter={formatter}
                          t={t}
                        />
                      </td>

                      <td>
                        <OborotMetricCell
                          quantity={row?.Realiz}
                          amount={row?.RealizSumm}
                          formatter={formatter}
                          t={t}
                        />
                      </td>

                      <td>
                        <OborotMetricCell
                          quantity={row?.SpisanoDish}
                          amount={row?.SpisanoDishSumm}
                          formatter={formatter}
                          t={t}
                        />
                      </td>

                      <td>
                        <OborotMetricCell
                          quantity={row?.SpisanoTov}
                          amount={row?.SpisanoTovSumm}
                          formatter={formatter}
                          t={t}
                        />
                      </td>

                      <td>
                        <OborotMetricCell
                          quantity={row?.Ostatok}
                          price={row?.PriceAvgOst}
                          amount={row?.OststokSum}
                          formatter={formatter}
                          t={t}
                        />
                      </td>

                      <td>
                        <OborotMetricCell
                          quantity={row?.Fakt}
                          amount={row?.FaktSumm}
                          formatter={formatter}
                          t={t}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>

                <tfoot>
                  <tr>
                    <td className="report-text report-total-label">
                      {t(
                        "Oborot.CategoryTotal",
                        "Итого по категории"
                      )}
                    </td>
                    <td>
                      <OborotSubtotalCell
                        value={totals.SaldoSumm}
                        formatter={formatter}
                        t={t}
                      />
                    </td>
                    <td>
                      <OborotSubtotalCell
                        value={totals.PrihodSumm}
                        formatter={formatter}
                        t={t}
                      />
                    </td>
                    <td>
                      <OborotSubtotalCell
                        value={totals.RealizSumm}
                        formatter={formatter}
                        t={t}
                      />
                    </td>
                    <td>
                      <OborotSubtotalCell
                        value={totals.SpisanoDishSumm}
                        formatter={formatter}
                        t={t}
                      />
                    </td>
                    <td>
                      <OborotSubtotalCell
                        value={totals.SpisanoTovSumm}
                        formatter={formatter}
                        t={t}
                      />
                    </td>
                    <td>
                      <OborotSubtotalCell
                        value={totals.OststokSum}
                        formatter={formatter}
                        t={t}
                      />
                    </td>
                    <td>
                      <OborotSubtotalCell
                        value={totals.FaktSumm}
                        formatter={formatter}
                        t={t}
                      />
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        );
      })}

      {groups.length > 0 && (
        <div className="oborot-grand-total">
          <div className="oborot-grand-total-title">
            {t("Common.Total", "Итого")}
          </div>

          <div className="oborot-grand-total-grid">
            <div>
              <span>{t("Oborot.Opening", "Нач. остаток")}</span>
              <strong>{formatter.format(grandTotals.SaldoSumm)}</strong>
            </div>
            <div>
              <span>{t("Oborot.Incoming", "Приход")}</span>
              <strong>{formatter.format(grandTotals.PrihodSumm)}</strong>
            </div>
            <div>
              <span>{t("Oborot.Sales", "Реализация")}</span>
              <strong>{formatter.format(grandTotals.RealizSumm)}</strong>
            </div>
            <div>
              <span>
                {t(
                  "OborotSvod.WrittenOffDish",
                  "Списано блюд"
                )}
              </span>
              <strong>{formatter.format(grandTotals.SpisanoDishSumm)}</strong>
            </div>
            <div>
              <span>
                {t(
                  "OborotSvod.WrittenOffProduct",
                  "Списано товаров"
                )}
              </span>
              <strong>{formatter.format(grandTotals.SpisanoTovSumm)}</strong>
            </div>
            <div>
              <span>{t("Oborot.Stock", "Остаток")}</span>
              <strong>{formatter.format(grandTotals.OststokSum)}</strong>
            </div>
            <div>
              <span>{t("Oborot.Actual", "Факт")}</span>
              <strong>{formatter.format(grandTotals.FaktSumm)}</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function buildOborotSvodPrintHtml({
  rows,
  dateFrom,
  dateTo,
  organizationName,
  locale,
  t
}) {
  const formatter = createMoneyFormatter(locale);
  const groups = groupOborotSvodRows(rows);
  const grandTotals = oborotSvodTotals(rows);

  const groupsHtml = groups
    .map((group) => {
      const totals = oborotSvodTotals(group.rows);

      const body = group.rows
        .map((row) => `<tr>
<td class="product">${escapeHtml(row?.NameTov || "—")}</td>
<td>${oborotPrintMetricHtml({ quantity: row?.Saldo, price: row?.SaldoPrice, amount: row?.SaldoSumm, formatter, t })}</td>
<td>${oborotPrintMetricHtml({ quantity: row?.Prihod, amount: row?.PrihodSumm, formatter, t })}</td>
<td>${oborotPrintMetricHtml({ quantity: row?.Realiz, amount: row?.RealizSumm, formatter, t })}</td>
<td>${oborotPrintMetricHtml({ quantity: row?.SpisanoDish, amount: row?.SpisanoDishSumm, formatter, t })}</td>
<td>${oborotPrintMetricHtml({ quantity: row?.SpisanoTov, amount: row?.SpisanoTovSumm, formatter, t })}</td>
<td>${oborotPrintMetricHtml({ quantity: row?.Ostatok, price: row?.PriceAvgOst, amount: row?.OststokSum, formatter, t })}</td>
<td>${oborotPrintMetricHtml({ quantity: row?.Fakt, amount: row?.FaktSumm, formatter, t })}</td>
</tr>`)
        .join("");

      return `<section class="group">
<div class="group-title">${escapeHtml(group.name)}</div>
<table>
<thead><tr>
<th class="product">${escapeHtml(t("Oborot.Product", "Товар"))}</th>
<th>${escapeHtml(t("Oborot.Opening", "Нач. остаток"))}</th>
<th>${escapeHtml(t("Oborot.Incoming", "Приход"))}</th>
<th>${escapeHtml(t("Oborot.Sales", "Реализация"))}</th>
<th>${escapeHtml(t("OborotSvod.WrittenOffDish", "Списано блюд"))}</th>
<th>${escapeHtml(t("OborotSvod.WrittenOffProduct", "Списано товаров"))}</th>
<th>${escapeHtml(t("Oborot.Stock", "Остаток"))}</th>
<th>${escapeHtml(t("Oborot.Actual", "Факт"))}</th>
</tr></thead>
<tbody>${body}</tbody>
<tfoot><tr>
<td class="product total-label">${escapeHtml(t("Oborot.CategoryTotal", "Итого по категории"))}</td>
<td>${oborotPrintSubtotalHtml(totals.SaldoSumm, formatter, t)}</td>
<td>${oborotPrintSubtotalHtml(totals.PrihodSumm, formatter, t)}</td>
<td>${oborotPrintSubtotalHtml(totals.RealizSumm, formatter, t)}</td>
<td>${oborotPrintSubtotalHtml(totals.SpisanoDishSumm, formatter, t)}</td>
<td>${oborotPrintSubtotalHtml(totals.SpisanoTovSumm, formatter, t)}</td>
<td>${oborotPrintSubtotalHtml(totals.OststokSum, formatter, t)}</td>
<td>${oborotPrintSubtotalHtml(totals.FaktSumm, formatter, t)}</td>
</tr></tfoot>
</table>
</section>`;
    })
    .join("");

  const title = t(
    "OborotSvod.Title",
    "Сводные обороты"
  );

  const grandItems = [
    [t("Oborot.Opening", "Нач. остаток"), grandTotals.SaldoSumm],
    [t("Oborot.Incoming", "Приход"), grandTotals.PrihodSumm],
    [t("Oborot.Sales", "Реализация"), grandTotals.RealizSumm],
    [
      t("OborotSvod.WrittenOffDish", "Списано блюд"),
      grandTotals.SpisanoDishSumm
    ],
    [
      t("OborotSvod.WrittenOffProduct", "Списано товаров"),
      grandTotals.SpisanoTovSumm
    ],
    [t("Oborot.Stock", "Остаток"), grandTotals.OststokSum],
    [t("Oborot.Actual", "Факт"), grandTotals.FaktSumm]
  ]
    .map(
      ([label, value]) =>
        `<div><span>${escapeHtml(label)}</span><b>${escapeHtml(
          formatter.format(value)
        )}</b></div>`
    )
    .join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
@page { size: A4 portrait; margin: 6mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; color: #111; font-size: 6.7pt; }
.header { display: flex; justify-content: space-between; align-items: flex-end; gap: 4mm; margin-bottom: 2.5mm; }
h1 { margin: 0; font-size: 10.5pt; font-style: italic; font-weight: 700; }
.org { max-width: 34%; font-size: 7pt; font-weight: 700; text-align: right; text-decoration: underline; }
.legend { margin-bottom: 2mm; color: #66706d; font-size: 5.8pt; }
.group { margin: 0 0 2.5mm; page-break-inside: auto; }
.group-title { padding: 0.9mm 1.1mm; background: #e8efed; border-top: 0.3mm solid #647571; border-bottom: 0.15mm solid #acb8b5; font-size: 7pt; font-weight: 700; break-after: avoid; page-break-after: avoid; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
thead { display: table-header-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
th { padding: 0.55mm 0.35mm; border-bottom: 0.2mm solid #555; font-size: 5.4pt; line-height: 1; text-align: center; vertical-align: bottom; }
th.product { width: 25%; text-align: left; }
th:not(.product) { width: 10.714%; }
td { padding: 0.42mm 0.35mm; border-bottom: 0.1mm dotted #c8cecc; vertical-align: top; }
td.product { text-align: left; font-size: 5.9pt; overflow-wrap: anywhere; }
.metric { display: flex; flex-direction: column; gap: 0.1mm; }
.metric > div { display: flex; justify-content: space-between; gap: 0.4mm; white-space: nowrap; }
.metric span { color: #6d7774; font-size: 4.8pt; }
.metric b { font-size: 5.35pt; font-weight: 600; }
.empty { color: #a0a6a4; }
tfoot td { border-top: 0.2mm solid #555; border-bottom: 0; background: #f3f6f5; font-weight: 700; }
.subtotal b { font-weight: 700; }
.total-label { font-weight: 700; }
.grand { margin-top: 3mm; padding-top: 1.5mm; border-top: 0.35mm solid #333; }
.grand-title { margin-bottom: 1mm; font-size: 7.5pt; font-weight: 700; }
.grand-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.7mm 4mm; }
.grand-grid > div { display: flex; justify-content: space-between; gap: 2mm; }
.grand-grid span { color: #596460; }
.grand-grid b { font-weight: 700; white-space: nowrap; }
</style>
</head>
<body>
<div class="header">
  <h1>${escapeHtml(title)} ${escapeHtml(t("Common.From", "с"))} ${escapeHtml(formatReportDate(dateFrom))} ${escapeHtml(t("Common.To", "по"))} ${escapeHtml(formatReportDate(dateTo))}</h1>
  <div class="org">${escapeHtml(organizationName || "")}</div>
</div>
<div class="legend">${escapeHtml(t("Oborot.Legend", "В ячейках: К — количество, Ц — цена, С — сумма."))}</div>
${groupsHtml}
${groups.length > 0 ? `<section class="grand"><div class="grand-title">${escapeHtml(t("Common.Total", "Итого"))}</div><div class="grand-grid">${grandItems}</div></section>` : ""}
</body>
</html>`;
}

function printOborotSvodReport(options) {
  const printWindow = window.open(
    "",
    "_blank",
    "width=1050,height=900"
  );

  if (!printWindow) {
    window.alert(
      options.t(
        "Reports.PrintPopupBlocked",
        "Браузер заблокировал окно печати. Разрешите всплывающие окна для Web Office."
      )
    );
    return;
  }

  printWindow.document.open();
  printWindow.document.write(
    buildOborotSvodPrintHtml(options)
  );
  printWindow.document.close();
  printWindow.focus();
  closePrintWindowAfterPrint(printWindow);

  window.setTimeout(() => {
    printWindow.print();
  }, 150);
}

function safeOborotSvodFilePart(value) {
  return String(value ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

function buildOborotSvodExportModel({
  rows,
  dateFrom,
  dateTo,
  organizationName,
  locale,
  t
}) {
  const exportRows = [];

  for (const group of groupOborotSvodRows(rows)) {
    for (const row of group.rows) {
      exportRows.push({
        Category: group.name,
        Product: row?.NameTov || "",
        Saldo: row?.Saldo ?? "",
        SaldoPrice: row?.SaldoPrice ?? "",
        SaldoSumm: row?.SaldoSumm ?? "",
        Prihod: row?.Prihod ?? "",
        PrihodSumm: row?.PrihodSumm ?? "",
        Realiz: row?.Realiz ?? "",
        RealizSumm: row?.RealizSumm ?? "",
        SpisanoDish: row?.SpisanoDish ?? "",
        SpisanoDishSumm: row?.SpisanoDishSumm ?? "",
        SpisanoTov: row?.SpisanoTov ?? "",
        SpisanoTovSumm: row?.SpisanoTovSumm ?? "",
        Ostatok: row?.Ostatok ?? "",
        PriceAvgOst: row?.PriceAvgOst ?? "",
        OststokSum: row?.OststokSum ?? "",
        Fakt: row?.Fakt ?? "",
        FaktSumm: row?.FaktSumm ?? ""
      });
    }

    const totals = oborotSvodTotals(group.rows);

    exportRows.push({
      Category: group.name,
      Product: t(
        "Oborot.CategoryTotal",
        "Итого по категории"
      ),
      Saldo: "",
      SaldoPrice: "",
      SaldoSumm: totals.SaldoSumm,
      Prihod: "",
      PrihodSumm: totals.PrihodSumm,
      Realiz: "",
      RealizSumm: totals.RealizSumm,
      SpisanoDish: "",
      SpisanoDishSumm: totals.SpisanoDishSumm,
      SpisanoTov: "",
      SpisanoTovSumm: totals.SpisanoTovSumm,
      Ostatok: "",
      PriceAvgOst: "",
      OststokSum: totals.OststokSum,
      Fakt: "",
      FaktSumm: totals.FaktSumm
    });
  }

  const totals = oborotSvodTotals(rows);

  return {
    title: `${t(
      "OborotSvod.Title",
      "Сводные обороты"
    )} ${formatReportDate(dateFrom)} — ${formatReportDate(dateTo)}`,
    fileName: `OborotSvod_${safeOborotSvodFilePart(
      dateFrom
    )}_${safeOborotSvodFilePart(
      dateTo
    )}_${safeOborotSvodFilePart(
      organizationName || "report"
    )}`,
    orientation: "portrait",
    locale,
    meta: [
      {
        label: t(
          "Oborot.Organization",
          "Организация"
        ),
        value: organizationName || ""
      }
    ],
    columns: [
      {
        key: "Category",
        title: t("Oborot.Category", "Категория"),
        type: "text",
        width: 22
      },
      {
        key: "Product",
        title: t("Oborot.Product", "Товар"),
        type: "text",
        width: 28
      },
      {
        key: "Saldo",
        title: t(
          "Oborot.OpeningQty",
          "Нач. остаток, кол."
        ),
        type: "number",
        decimals: 2,
        width: 13
      },
      {
        key: "SaldoPrice",
        title: t(
          "Oborot.OpeningPrice",
          "Нач. цена"
        ),
        type: "number",
        decimals: 2,
        width: 13
      },
      {
        key: "SaldoSumm",
        title: t(
          "Oborot.OpeningSum",
          "Нач. сумма"
        ),
        type: "number",
        decimals: 2,
        width: 14
      },
      {
        key: "Prihod",
        title: t(
          "Oborot.IncomingQty",
          "Приход, кол."
        ),
        type: "number",
        decimals: 2,
        width: 13
      },
      {
        key: "PrihodSumm",
        title: t(
          "Oborot.IncomingSum",
          "Приход, сумма"
        ),
        type: "number",
        decimals: 2,
        width: 14
      },
      {
        key: "Realiz",
        title: t(
          "Oborot.SalesQty",
          "Реализация, кол."
        ),
        type: "number",
        decimals: 2,
        width: 13
      },
      {
        key: "RealizSumm",
        title: t(
          "Oborot.SalesSum",
          "Реализация, сумма"
        ),
        type: "number",
        decimals: 2,
        width: 15
      },
      {
        key: "SpisanoDish",
        title: t(
          "OborotSvod.WrittenOffDishQty",
          "Списано блюд, кол."
        ),
        type: "number",
        decimals: 2,
        width: 14
      },
      {
        key: "SpisanoDishSumm",
        title: t(
          "OborotSvod.WrittenOffDishSum",
          "Списано блюд, сумма"
        ),
        type: "number",
        decimals: 2,
        width: 16
      },
      {
        key: "SpisanoTov",
        title: t(
          "OborotSvod.WrittenOffProductQty",
          "Списано товаров, кол."
        ),
        type: "number",
        decimals: 2,
        width: 15
      },
      {
        key: "SpisanoTovSumm",
        title: t(
          "OborotSvod.WrittenOffProductSum",
          "Списано товаров, сумма"
        ),
        type: "number",
        decimals: 2,
        width: 17
      },
      {
        key: "Ostatok",
        title: t(
          "Oborot.StockQty",
          "Остаток, кол."
        ),
        type: "number",
        decimals: 2,
        width: 13
      },
      {
        key: "PriceAvgOst",
        title: t(
          "Oborot.StockPrice",
          "Цена остатка"
        ),
        type: "number",
        decimals: 2,
        width: 13
      },
      {
        key: "OststokSum",
        title: t(
          "OborotSvod.StockSum",
          "Остаток, сумма"
        ),
        type: "number",
        decimals: 2,
        width: 14
      },
      {
        key: "Fakt",
        title: t(
          "Oborot.ActualQty",
          "Факт, кол."
        ),
        type: "number",
        decimals: 2,
        width: 13
      },
      {
        key: "FaktSumm",
        title: t(
          "Oborot.ActualSum",
          "Факт, сумма"
        ),
        type: "number",
        decimals: 2,
        width: 14
      }
    ],
    rows: exportRows,
    footerRows: [
      {
        label: t("Common.Total", "Итого"),
        values: {
          SaldoSumm: totals.SaldoSumm,
          PrihodSumm: totals.PrihodSumm,
          RealizSumm: totals.RealizSumm,
          SpisanoDishSumm: totals.SpisanoDishSumm,
          SpisanoTovSumm: totals.SpisanoTovSumm,
          OststokSum: totals.OststokSum,
          FaktSumm: totals.FaktSumm
        }
      }
    ]
  };
}

function OborotSvodReport({
  data,
  dateFrom,
  dateTo,
  organizationName,
  locale,
  fetchWithAuth,
  t,
  onReload
}) {
  const rows = getOborotSvodRows(data);
  const formatter = createMoneyFormatter(locale);

  const commonOptions = {
    rows,
    dateFrom,
    dateTo,
    organizationName,
    locale,
    t
  };

  async function handleExport(format) {
    try {
      await exportReportFile({
        fetchWithAuth,
        reportModel: buildOborotSvodExportModel(
          commonOptions
        ),
        format,
        errorMessage: t(
          "Report.ExportError",
          "Ошибка экспорта отчёта."
        )
      });
    } catch (err) {
      window.alert(
        err?.message ||
          t(
            "Report.ExportError",
            "Ошибка экспорта отчёта."
          )
      );
    }
  }

  return (
    <div className="reports-page oborot-report-page oborot-svod-report-page">
      <div className="report-toolbar">
        <button
          type="button"
          className="report-run-button"
          onClick={onReload}
        >
          {t("Common.Generate", "Сформировать")}
        </button>

        <button
          type="button"
          className="report-action-button report-print-button"
          onClick={() =>
            printOborotSvodReport(commonOptions)
          }
        >
          {t("Common.Print", "Печать")}
        </button>

        <button
          type="button"
          className="report-action-button report-excel-button"
          onClick={() => handleExport("xlsx")}
        >
          {t("Common.Excel", "Excel")}
        </button>

        <button
          type="button"
          className="report-action-button report-word-button"
          onClick={() => handleExport("docx")}
        >
          {t("Common.Word", "Word")}
        </button>
      </div>

      <article className="revenue-report-sheet oborot-report-sheet">
        <header className="revenue-report-heading oborot-report-heading">
          <h3>
            {t(
              "OborotSvod.Title",
              "Сводные обороты"
            )}{" "}
            {t("Common.From", "с")} {formatReportDate(dateFrom)}{" "}
            {t("Common.To", "по")} {formatReportDate(dateTo)}
          </h3>

          <div className="revenue-report-org">
            {organizationName || ""}
          </div>
        </header>

        {rows.length > 0 ? (
          <OborotSvodReportTable
            rows={rows}
            formatter={formatter}
            t={t}
          />
        ) : (
          <div className="report-empty">
            {t(
              "Reports.NoDataForPeriod",
              "За выбранный период данных нет."
            )}
          </div>
        )}
      </article>
    </div>
  );
}


function getEnterExitRows(data) {
  const payload = data?.data ?? data?.Data ?? data;

  if (Array.isArray(payload)) {
    return payload;
  }

  return normalizeRows(
    payload?.Main ??
    payload?.main ??
    payload?.Rows ??
    payload?.rows ??
    payload?.EnterExit ??
    payload?.enterExit ??
    payload?.enterexit
  );
}

function enterExitDateKey(value) {
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

  return match ? `${match[1]}-${match[2]}-${match[3]}` : text;
}

function enterExitTime(value) {
  const text = String(value ?? "").trim();
  const match = text.match(/T(\d{2}):(\d{2}):(\d{2})/);

  if (!match) {
    return text;
  }

  return `${match[1]}:${match[2]}:${match[3]}`;
}

function createHoursFormatter(locale) {
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

function groupEnterExitRows(rows) {
  const sorted = [...rows].sort((left, right) => {
    const leftDate = enterExitDateKey(left?.DateWork);
    const rightDate = enterExitDateKey(right?.DateWork);
    const dateCompare = leftDate.localeCompare(rightDate);

    if (dateCompare !== 0) {
      return dateCompare;
    }

    const employeeCompare = String(
      left?.NameSotr ?? ""
    ).localeCompare(
      String(right?.NameSotr ?? ""),
      undefined,
      { sensitivity: "base" }
    );

    if (employeeCompare !== 0) {
      return employeeCompare;
    }

    return String(left?.Enter ?? "").localeCompare(
      String(right?.Enter ?? "")
    );
  });

  const groups = [];

  for (const row of sorted) {
    const key = enterExitDateKey(row?.DateWork);
    const name = formatReportDate(key) || "—";

    let group = groups[groups.length - 1];

    if (!group || group.key !== key) {
      group = {
        key,
        name,
        rows: []
      };
      groups.push(group);
    }

    group.rows.push(row);
  }

  return groups;
}

function buildEnterExitSummary(rows) {
  const map = new Map();

  for (const row of rows) {
    const name =
      String(row?.NameSotr ?? "").trim() ||
      "—";

    let item = map.get(name);

    if (!item) {
      item = {
        NameSotr: name,
        Hours: 0,
        dates: new Set()
      };
      map.set(name, item);
    }

    item.Hours += numericValue(row?.Hours);

    const dateKey = enterExitDateKey(
      row?.DateWork
    );

    if (dateKey) {
      item.dates.add(dateKey);
    }
  }

  return [...map.values()]
    .map((item) => {
      const WorkDays = item.dates.size;
      const AverageHours =
        WorkDays > 0
          ? item.Hours / WorkDays
          : 0;

      return {
        NameSotr: item.NameSotr,
        WorkDays,
        Hours: item.Hours,
        AverageHours
      };
    })
    .sort((left, right) =>
      String(left.NameSotr).localeCompare(
        String(right.NameSotr),
        undefined,
        { sensitivity: "base" }
      )
    );
}

function EnterExitReportTables({
  rows,
  formatter,
  t
}) {
  const groups = groupEnterExitRows(rows);
  const summary = buildEnterExitSummary(rows);

  return (
    <div className="enterexit-content">
      {groups.map((group) => {
        const dayHours = sumField(
          group.rows,
          "Hours"
        );

        return (
          <section
            className="enterexit-day-group"
            key={group.key}
          >
            <div className="enterexit-day-title">
              {group.name}
            </div>

            <div className="report-table-scroll">
              <table className="report-table enterexit-detail-table">
                <thead>
                  <tr>
                    <th className="report-text">
                      {t(
                        "EnterExit.Employee",
                        "Сотрудник"
                      )}
                    </th>
                    <th>
                      {t(
                        "EnterExit.Enter",
                        "Вход"
                      )}
                    </th>
                    <th>
                      {t(
                        "EnterExit.Exit",
                        "Выход"
                      )}
                    </th>
                    <th className="report-text">
                      {t(
                        "EnterExit.Position",
                        "Должность"
                      )}
                    </th>
                    <th className="report-money">
                      {t(
                        "EnterExit.Hours",
                        "Часы"
                      )}
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {group.rows.map((row, index) => (
                    <tr
                      key={`${row?.CdVh ?? "row"}-${index}`}
                    >
                      <td className="report-text">
                        {row?.NameSotr || "—"}
                      </td>
                      <td className="enterexit-time-cell">
                        {enterExitTime(row?.Enter)}
                      </td>
                      <td className="enterexit-time-cell">
                        {enterExitTime(row?.Exit)}
                      </td>
                      <td className="report-text">
                        {row?.Doljnost || ""}
                      </td>
                      <td className="report-money">
                        {formatter.format(
                          numericValue(row?.Hours)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>

                <tfoot>
                  <tr>
                    <td
                      className="report-text report-total-label"
                      colSpan={4}
                    >
                      {t(
                        "EnterExit.DayTotal",
                        "Итого за день"
                      )}
                    </td>
                    <td className="report-money">
                      {formatter.format(dayHours)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        );
      })}

      {summary.length > 0 && (
        <section className="enterexit-summary-section">
          <div className="enterexit-summary-title">
            {t(
              "EnterExit.SummaryTitle",
              "Итого по сотрудникам за период"
            )}
          </div>

          <div className="report-table-scroll">
            <table className="report-table enterexit-summary-table">
              <thead>
                <tr>
                  <th className="report-text">
                    {t(
                      "EnterExit.Employee",
                      "Сотрудник"
                    )}
                  </th>
                  <th className="report-money">
                    {t(
                      "EnterExit.WorkDays",
                      "Рабочих дней"
                    )}
                  </th>
                  <th className="report-money">
                    {t(
                      "EnterExit.TotalHours",
                      "Всего часов"
                    )}
                  </th>
                  <th className="report-money">
                    {t(
                      "EnterExit.AveragePerDay",
                      "В среднем за день"
                    )}
                  </th>
                </tr>
              </thead>

              <tbody>
                {summary.map((item) => (
                  <tr key={item.NameSotr}>
                    <td className="report-text">
                      {item.NameSotr}
                    </td>
                    <td className="report-money">
                      {item.WorkDays}
                    </td>
                    <td className="report-money">
                      {formatter.format(item.Hours)}
                    </td>
                    <td className="report-money">
                      {formatter.format(
                        item.AverageHours
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr>
                  <td className="report-text report-total-label">
                    {t("Common.Total", "Итого")}
                  </td>
                  <td className="report-money" />
                  <td className="report-money">
                    {formatter.format(
                      sumField(rows, "Hours")
                    )}
                  </td>
                  <td className="report-money" />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function buildEnterExitPrintHtml({
  rows,
  dateFrom,
  dateTo,
  organizationName,
  locale,
  t
}) {
  const formatter = createHoursFormatter(locale);
  const groups = groupEnterExitRows(rows);
  const summary = buildEnterExitSummary(rows);

  const groupsHtml = groups
    .map((group) => {
      const body = group.rows
        .map(
          (row) => `<tr>
<td class="employee">${escapeHtml(row?.NameSotr || "—")}</td>
<td class="time">${escapeHtml(enterExitTime(row?.Enter))}</td>
<td class="time">${escapeHtml(enterExitTime(row?.Exit))}</td>
<td class="position">${escapeHtml(row?.Doljnost || "")}</td>
<td class="hours">${escapeHtml(formatter.format(numericValue(row?.Hours)))}</td>
</tr>`
        )
        .join("");

      const dayHours = sumField(
        group.rows,
        "Hours"
      );

      return `<section class="day-group">
<div class="day-title">${escapeHtml(group.name)}</div>
<table class="detail">
<thead><tr>
<th class="employee">${escapeHtml(t("EnterExit.Employee", "Сотрудник"))}</th>
<th class="time">${escapeHtml(t("EnterExit.Enter", "Вход"))}</th>
<th class="time">${escapeHtml(t("EnterExit.Exit", "Выход"))}</th>
<th class="position">${escapeHtml(t("EnterExit.Position", "Должность"))}</th>
<th class="hours">${escapeHtml(t("EnterExit.Hours", "Часы"))}</th>
</tr></thead>
<tbody>${body}</tbody>
<tfoot><tr>
<td class="total-label" colspan="4">${escapeHtml(t("EnterExit.DayTotal", "Итого за день"))}</td>
<td class="hours">${escapeHtml(formatter.format(dayHours))}</td>
</tr></tfoot>
</table>
</section>`;
    })
    .join("");

  const summaryBody = summary
    .map(
      (item) => `<tr>
<td class="employee">${escapeHtml(item.NameSotr)}</td>
<td class="number">${escapeHtml(String(item.WorkDays))}</td>
<td class="number">${escapeHtml(formatter.format(item.Hours))}</td>
<td class="number">${escapeHtml(formatter.format(item.AverageHours))}</td>
</tr>`
    )
    .join("");

  const title = t(
    "EnterExit.Title",
    "Регистрация персонала"
  );

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
@page { size: A4 portrait; margin: 9mm 10mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; color: #111; font-size: 8.2pt; }
.header { display: flex; justify-content: space-between; align-items: flex-end; gap: 6mm; margin-bottom: 4mm; }
h1 { margin: 0; font-size: 12pt; font-style: italic; font-weight: 700; }
.org { max-width: 38%; font-size: 8pt; font-weight: 700; text-align: right; text-decoration: underline; }
.day-group { margin: 0 0 4mm; break-inside: auto; page-break-inside: auto; }
.day-title { padding: 1.1mm 1.5mm; background: #e8efed; border-top: 0.3mm solid #647571; border-bottom: 0.2mm solid #acb8b5; font-size: 8.5pt; font-weight: 700; break-after: avoid; page-break-after: avoid; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
thead { display: table-header-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
th { padding: 1mm 1.2mm; border-bottom: 0.25mm solid #666; font-size: 7.4pt; text-align: center; }
td { padding: 1mm 1.2mm; border-bottom: 0.15mm dotted #c7cecb; }
.employee { width: 31%; text-align: left; }
.time { width: 14%; text-align: center; white-space: nowrap; }
.position { width: 27%; text-align: left; }
.hours { width: 14%; text-align: right; white-space: nowrap; }
tfoot td { border-top: 0.25mm solid #666; border-bottom: 0; background: #f3f6f5; font-weight: 700; }
.total-label { text-align: right; }
.summary { margin-top: 6mm; break-before: auto; }
.summary-title { margin-bottom: 1.5mm; padding-top: 2mm; border-top: 0.35mm solid #333; font-size: 9pt; font-weight: 700; }
.summary th:first-child, .summary td:first-child { width: 46%; text-align: left; }
.summary th:not(:first-child), .summary td:not(:first-child) { width: 18%; }
.number { text-align: right; white-space: nowrap; }
</style>
</head>
<body>
<div class="header">
  <h1>${escapeHtml(title)} ${escapeHtml(t("Common.From", "с"))} ${escapeHtml(formatReportDate(dateFrom))} ${escapeHtml(t("Common.To", "по"))} ${escapeHtml(formatReportDate(dateTo))}</h1>
  <div class="org">${escapeHtml(organizationName || "")}</div>
</div>
${groupsHtml}
${summary.length > 0 ? `<section class="summary">
<div class="summary-title">${escapeHtml(t("EnterExit.SummaryTitle", "Итого по сотрудникам за период"))}</div>
<table>
<thead><tr>
<th>${escapeHtml(t("EnterExit.Employee", "Сотрудник"))}</th>
<th>${escapeHtml(t("EnterExit.WorkDays", "Рабочих дней"))}</th>
<th>${escapeHtml(t("EnterExit.TotalHours", "Всего часов"))}</th>
<th>${escapeHtml(t("EnterExit.AveragePerDay", "В среднем за день"))}</th>
</tr></thead>
<tbody>${summaryBody}</tbody>
<tfoot><tr>
<td>${escapeHtml(t("Common.Total", "Итого"))}</td>
<td></td>
<td class="number">${escapeHtml(formatter.format(sumField(rows, "Hours")))}</td>
<td></td>
</tr></tfoot>
</table>
</section>` : ""}
</body>
</html>`;
}

function printEnterExitReport(options) {
  const printWindow = window.open(
    "",
    "_blank",
    "width=1050,height=900"
  );

  if (!printWindow) {
    window.alert(
      options.t(
        "Reports.PrintPopupBlocked",
        "Браузер заблокировал окно печати. Разрешите всплывающие окна для Web Office."
      )
    );
    return;
  }

  printWindow.document.open();
  printWindow.document.write(
    buildEnterExitPrintHtml(options)
  );
  printWindow.document.close();
  printWindow.focus();
  closePrintWindowAfterPrint(printWindow);

  window.setTimeout(() => {
    printWindow.print();
  }, 150);
}

function safeEnterExitFilePart(value) {
  return String(value ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

function buildEnterExitExportModel({
  rows,
  dateFrom,
  dateTo,
  organizationName,
  locale,
  t
}) {
  const exportRows = [];

  for (const group of groupEnterExitRows(rows)) {
    for (const row of group.rows) {
      exportRows.push({
        DateWork: group.name,
        NameSotr: row?.NameSotr || "",
        Enter: enterExitTime(row?.Enter),
        Exit: enterExitTime(row?.Exit),
        Doljnost: row?.Doljnost || "",
        Hours: row?.Hours ?? "",
        WorkDays: "",
        AverageHours: ""
      });
    }

    exportRows.push({
      DateWork: "",
      NameSotr: t(
        "EnterExit.DayTotal",
        "Итого за день"
      ),
      Enter: "",
      Exit: "",
      Doljnost: "",
      Hours: sumField(group.rows, "Hours"),
      WorkDays: "",
      AverageHours: ""
    });
  }

  const summary = buildEnterExitSummary(rows);

  if (summary.length > 0) {
    exportRows.push({
      DateWork: "",
      NameSotr: t(
        "EnterExit.SummaryTitle",
        "Итого по сотрудникам за период"
      ),
      Enter: "",
      Exit: "",
      Doljnost: "",
      Hours: "",
      WorkDays: "",
      AverageHours: ""
    });

    for (const item of summary) {
      exportRows.push({
        DateWork: "",
        NameSotr: item.NameSotr,
        Enter: "",
        Exit: "",
        Doljnost: "",
        Hours: item.Hours,
        WorkDays: item.WorkDays,
        AverageHours: item.AverageHours
      });
    }
  }

  return {
    title: `${t(
      "EnterExit.Title",
      "Регистрация персонала"
    )} ${formatReportDate(dateFrom)} — ${formatReportDate(dateTo)}`,
    fileName: `EnterExit_${safeEnterExitFilePart(
      dateFrom
    )}_${safeEnterExitFilePart(
      dateTo
    )}_${safeEnterExitFilePart(
      organizationName || "report"
    )}`,
    orientation: "portrait",
    locale,
    meta: [
      {
        label: t(
          "EnterExit.Organization",
          "Организация"
        ),
        value: organizationName || ""
      }
    ],
    columns: [
      {
        key: "DateWork",
        title: t(
          "EnterExit.WorkDate",
          "Рабочая дата"
        ),
        type: "text",
        width: 14
      },
      {
        key: "NameSotr",
        title: t(
          "EnterExit.Employee",
          "Сотрудник"
        ),
        type: "text",
        width: 28
      },
      {
        key: "Enter",
        title: t(
          "EnterExit.Enter",
          "Вход"
        ),
        type: "text",
        width: 12
      },
      {
        key: "Exit",
        title: t(
          "EnterExit.Exit",
          "Выход"
        ),
        type: "text",
        width: 12
      },
      {
        key: "Doljnost",
        title: t(
          "EnterExit.Position",
          "Должность"
        ),
        type: "text",
        width: 22
      },
      {
        key: "Hours",
        title: t(
          "EnterExit.TotalHours",
          "Всего часов"
        ),
        type: "number",
        decimals: 2,
        width: 13
      },
      {
        key: "WorkDays",
        title: t(
          "EnterExit.WorkDays",
          "Рабочих дней"
        ),
        type: "number",
        decimals: 0,
        width: 13
      },
      {
        key: "AverageHours",
        title: t(
          "EnterExit.AveragePerDay",
          "В среднем за день"
        ),
        type: "number",
        decimals: 2,
        width: 16
      }
    ],
    rows: exportRows,
    footerRows: [
      {
        label: t("Common.Total", "Итого"),
        values: {
          Hours: sumField(rows, "Hours")
        }
      }
    ]
  };
}

function EnterExitReport({
  data,
  dateFrom,
  dateTo,
  organizationName,
  locale,
  fetchWithAuth,
  t,
  onReload
}) {
  const rows = getEnterExitRows(data);
  const formatter = createHoursFormatter(locale);

  const commonOptions = {
    rows,
    dateFrom,
    dateTo,
    organizationName,
    locale,
    t
  };

  async function handleExport(format) {
    try {
      await exportReportFile({
        fetchWithAuth,
        reportModel: buildEnterExitExportModel(
          commonOptions
        ),
        format,
        errorMessage: t(
          "Report.ExportError",
          "Ошибка экспорта отчёта."
        )
      });
    } catch (err) {
      window.alert(
        err?.message ||
          t(
            "Report.ExportError",
            "Ошибка экспорта отчёта."
          )
      );
    }
  }

  return (
    <div className="reports-page enterexit-report-page">
      <div className="report-toolbar">
        <button
          type="button"
          className="report-run-button"
          onClick={onReload}
        >
          {t("Common.Generate", "Сформировать")}
        </button>

        <button
          type="button"
          className="report-action-button report-print-button"
          onClick={() =>
            printEnterExitReport(commonOptions)
          }
        >
          {t("Common.Print", "Печать")}
        </button>

        <button
          type="button"
          className="report-action-button report-excel-button"
          onClick={() => handleExport("xlsx")}
        >
          {t("Common.Excel", "Excel")}
        </button>

        <button
          type="button"
          className="report-action-button report-word-button"
          onClick={() => handleExport("docx")}
        >
          {t("Common.Word", "Word")}
        </button>
      </div>

      <article className="revenue-report-sheet enterexit-report-sheet">
        <header className="revenue-report-heading enterexit-report-heading">
          <h3>
            {t(
              "EnterExit.Title",
              "Регистрация персонала"
            )}{" "}
            {t("Common.From", "с")} {formatReportDate(dateFrom)}{" "}
            {t("Common.To", "по")} {formatReportDate(dateTo)}
          </h3>

          <div className="revenue-report-org">
            {organizationName || ""}
          </div>
        </header>

        {rows.length > 0 ? (
          <EnterExitReportTables
            rows={rows}
            formatter={formatter}
            t={t}
          />
        ) : (
          <div className="report-empty">
            {t(
              "Reports.NoDataForPeriod",
              "За выбранный период данных нет."
            )}
          </div>
        )}
      </article>
    </div>
  );
}


function getOstatNormRows(data) {
  const payload = data?.data ?? data?.Data ?? data;

  if (Array.isArray(payload)) {
    return payload;
  }

  return normalizeRows(
    payload?.Main ??
    payload?.main ??
    payload?.Rows ??
    payload?.rows ??
    payload?.OstatNorm ??
    payload?.ostatNorm ??
    payload?.ostatnorm
  );
}

function groupOstatNormRows(rows) {
  const sorted = [...rows].sort((left, right) => {
    const categoryCompare = String(
      left?.Category ?? ""
    ).localeCompare(
      String(right?.Category ?? ""),
      undefined,
      { sensitivity: "base" }
    );

    if (categoryCompare !== 0) {
      return categoryCompare;
    }

    return String(left?.NameTov ?? "").localeCompare(
      String(right?.NameTov ?? ""),
      undefined,
      { sensitivity: "base" }
    );
  });

  const groups = [];

  for (const row of sorted) {
    const name =
      String(row?.Category ?? "").trim() ||
      "—";

    let group = groups[groups.length - 1];

    if (!group || group.name !== name) {
      group = {
        name,
        rows: []
      };
      groups.push(group);
    }

    group.rows.push(row);
  }

  return groups;
}

function OstatNormReportTable({
  rows,
  formatter,
  t
}) {
  const groups = groupOstatNormRows(rows);

  return (
    <div className="ostatnorm-groups">
      {groups.map((group) => (
        <section
          className="ostatnorm-group"
          key={group.name}
        >
          <div className="ostatnorm-group-title">
            {group.name}
          </div>

          <div className="report-table-scroll">
            <table className="report-table ostatnorm-table">
              <thead>
                <tr>
                  <th className="report-text">
                    {t(
                      "OstatNorm.Product",
                      "Сырье"
                    )}
                  </th>
                  <th className="report-money">
                    {t(
                      "OstatNorm.Stock",
                      "Остаток"
                    )}
                  </th>
                  <th className="report-money">
                    {t(
                      "OstatNorm.AveragePrice",
                      "Ср. цена"
                    )}
                  </th>
                  <th className="report-money">
                    {t(
                      "OstatNorm.StockAmount",
                      "Сумма остатка"
                    )}
                  </th>
                  <th className="report-money">
                    {t(
                      "OstatNorm.Minimum",
                      "Норма мин."
                    )}
                  </th>
                </tr>
              </thead>

              <tbody>
                {group.rows.map((row, index) => (
                  <tr
                    key={`${row?.IdTov ?? "item"}-${index}`}
                  >
                    <td className="report-text">
                      {row?.NameTov || "—"}
                    </td>
                    <td className="report-money">
                      {formatter.format(
                        numericValue(row?.Ostatok)
                      )}
                    </td>
                    <td className="report-money">
                      {formatter.format(
                        numericValue(row?.PriceAvg)
                      )}
                    </td>
                    <td className="report-money">
                      {formatter.format(
                        numericValue(row?.OstatokSumm)
                      )}
                    </td>
                    <td className="report-money">
                      {formatter.format(
                        numericValue(row?.NormaMin)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

function buildOstatNormPrintHtml({
  rows,
  dateTo,
  departmentName,
  locale,
  t
}) {
  const formatter = createMoneyFormatter(locale);
  const groups = groupOstatNormRows(rows);

  const groupsHtml = groups
    .map((group) => {
      const body = group.rows
        .map(
          (row) => `<tr>
<td class="text">${escapeHtml(row?.NameTov || "—")}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.Ostatok)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.PriceAvg)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.OstatokSumm)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.NormaMin)))}</td>
</tr>`
        )
        .join("");

      return `<section class="group">
<div class="group-title">${escapeHtml(group.name)}</div>
<table>
<thead><tr>
<th class="text">${escapeHtml(t("OstatNorm.Product", "Сырье"))}</th>
<th class="number">${escapeHtml(t("OstatNorm.Stock", "Остаток"))}</th>
<th class="number">${escapeHtml(t("OstatNorm.AveragePrice", "Ср. цена"))}</th>
<th class="number">${escapeHtml(t("OstatNorm.StockAmount", "Сумма остатка"))}</th>
<th class="number">${escapeHtml(t("OstatNorm.Minimum", "Норма мин."))}</th>
</tr></thead>
<tbody>${body}</tbody>
</table>
</section>`;
    })
    .join("");

  const title = `${t(
    "OstatNorm.Title",
    "Остатки сырья ниже нормы на"
  )} ${formatReportDate(dateTo)}`;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
@page { size: A4 portrait; margin: 9mm 10mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; color: #111; font-size: 8.4pt; }
.header { margin-bottom: 4mm; }
h1 { margin: 0; font-size: 12pt; font-style: italic; font-weight: 700; }
.warehouse { margin-top: 1.5mm; font-size: 9pt; font-weight: 700; }
.group { margin: 0 0 4mm; break-inside: auto; page-break-inside: auto; }
.group-title { padding: 1.1mm 1.5mm; background: #e8efed; border-top: 0.3mm solid #647571; border-bottom: 0.2mm solid #acb8b5; font-size: 8.2pt; font-weight: 700; break-after: avoid; page-break-after: avoid; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
thead { display: table-header-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
th { padding: 0.9mm 1mm; border-bottom: 0.25mm solid #666; font-size: 7pt; font-weight: 700; }
td { padding: 0.9mm 1mm; border-bottom: 0.15mm dotted #c7cecb; font-size: 7.4pt; }
.text { text-align: left; }
.number { text-align: right; white-space: nowrap; }
th:nth-child(1) { width: 40%; }
th:nth-child(2) { width: 14%; }
th:nth-child(3) { width: 14%; }
th:nth-child(4) { width: 18%; }
th:nth-child(5) { width: 14%; }
</style>
</head>
<body>
<div class="header">
  <h1>${escapeHtml(title)}</h1>
  <div class="warehouse">${escapeHtml(t("OstatNorm.Warehouse", "Склад"))}: ${escapeHtml(departmentName || "")}</div>
</div>
${groupsHtml}
</body>
</html>`;
}

function printOstatNormReport(options) {
  const printWindow = window.open(
    "",
    "_blank",
    "width=1050,height=900"
  );

  if (!printWindow) {
    window.alert(
      options.t(
        "Reports.PrintPopupBlocked",
        "Браузер заблокировал окно печати. Разрешите всплывающие окна для Web Office."
      )
    );
    return;
  }

  printWindow.document.open();
  printWindow.document.write(
    buildOstatNormPrintHtml(options)
  );
  printWindow.document.close();
  printWindow.focus();
  closePrintWindowAfterPrint(printWindow);

  window.setTimeout(() => {
    printWindow.print();
  }, 150);
}

function safeOstatNormFilePart(value) {
  return String(value ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

function buildOstatNormExportModel({
  rows,
  dateTo,
  departmentName,
  locale,
  t
}) {
  const exportRows = [];

  for (const group of groupOstatNormRows(rows)) {
    for (const row of group.rows) {
      exportRows.push({
        Category: group.name,
        Product: row?.NameTov || "",
        Stock: row?.Ostatok ?? "",
        AveragePrice: row?.PriceAvg ?? "",
        StockAmount: row?.OstatokSumm ?? "",
        Minimum: row?.NormaMin ?? ""
      });
    }
  }

  return {
    title: `${t(
      "OstatNorm.Title",
      "Остатки сырья ниже нормы на"
    )} ${formatReportDate(dateTo)}`,
    fileName: `OstatNorm_${safeOstatNormFilePart(
      dateTo
    )}_${safeOstatNormFilePart(
      departmentName || "warehouse"
    )}`,
    orientation: "portrait",
    locale,
    meta: [
      {
        label: t(
          "OstatNorm.Warehouse",
          "Склад"
        ),
        value: departmentName || ""
      }
    ],
    columns: [
      {
        key: "Category",
        title: t(
          "OstatNorm.Category",
          "Категория"
        ),
        type: "text",
        width: 24
      },
      {
        key: "Product",
        title: t(
          "OstatNorm.Product",
          "Сырье"
        ),
        type: "text",
        width: 34
      },
      {
        key: "Stock",
        title: t(
          "OstatNorm.Stock",
          "Остаток"
        ),
        type: "number",
        decimals: 2,
        width: 13
      },
      {
        key: "AveragePrice",
        title: t(
          "OstatNorm.AveragePrice",
          "Ср. цена"
        ),
        type: "number",
        decimals: 2,
        width: 13
      },
      {
        key: "StockAmount",
        title: t(
          "OstatNorm.StockAmount",
          "Сумма остатка"
        ),
        type: "number",
        decimals: 2,
        width: 15
      },
      {
        key: "Minimum",
        title: t(
          "OstatNorm.Minimum",
          "Норма мин."
        ),
        type: "number",
        decimals: 2,
        width: 13
      }
    ],
    rows: exportRows,
    footerRows: []
  };
}

function OstatNormReport({
  data,
  dateTo,
  departmentName,
  locale,
  fetchWithAuth,
  t,
  onReload
}) {
  const rows = getOstatNormRows(data);
  const formatter = createMoneyFormatter(locale);

  const commonOptions = {
    rows,
    dateTo,
    departmentName,
    locale,
    t
  };

  async function handleExport(format) {
    try {
      await exportReportFile({
        fetchWithAuth,
        reportModel: buildOstatNormExportModel(
          commonOptions
        ),
        format,
        errorMessage: t(
          "Report.ExportError",
          "Ошибка экспорта отчёта."
        )
      });
    } catch (err) {
      window.alert(
        err?.message ||
          t(
            "Report.ExportError",
            "Ошибка экспорта отчёта."
          )
      );
    }
  }

  return (
    <div className="reports-page ostatnorm-report-page">
      <div className="report-toolbar">
        <button
          type="button"
          className="report-run-button"
          onClick={onReload}
        >
          {t("Common.Generate", "Сформировать")}
        </button>

        <button
          type="button"
          className="report-action-button report-print-button"
          onClick={() =>
            printOstatNormReport(commonOptions)
          }
        >
          {t("Common.Print", "Печать")}
        </button>

        <button
          type="button"
          className="report-action-button report-excel-button"
          onClick={() => handleExport("xlsx")}
        >
          {t("Common.Excel", "Excel")}
        </button>

        <button
          type="button"
          className="report-action-button report-word-button"
          onClick={() => handleExport("docx")}
        >
          {t("Common.Word", "Word")}
        </button>
      </div>

      <article className="revenue-report-sheet ostatnorm-report-sheet">
        <header className="ostatnorm-report-heading">
          <h3>
            {t(
              "OstatNorm.Title",
              "Остатки сырья ниже нормы на"
            )}{" "}
            {formatReportDate(dateTo)}
          </h3>

          <div className="ostatnorm-warehouse">
            {t(
              "OstatNorm.Warehouse",
              "Склад"
            )}:{" "}
            <strong>
              {departmentName || ""}
            </strong>
          </div>
        </header>

        {rows.length > 0 ? (
          <OstatNormReportTable
            rows={rows}
            formatter={formatter}
            t={t}
          />
        ) : (
          <div className="report-empty">
            {t(
              "Reports.NoDataForPeriod",
              "За выбранный период данных нет."
            )}
          </div>
        )}
      </article>
    </div>
  );
}


function getOstatSvodRows(data) {
  const payload = data?.data ?? data?.Data ?? data;

  if (Array.isArray(payload)) {
    return payload;
  }

  return normalizeRows(
    payload?.Main ??
    payload?.main ??
    payload?.Rows ??
    payload?.rows ??
    payload?.OstatSvod ??
    payload?.ostatSvod ??
    payload?.ostatsvod
  );
}

function groupOstatSvodRows(rows) {
  const sorted = [...rows].sort((left, right) => {
    const categoryCompare = String(
      left?.["Название"] ?? ""
    ).localeCompare(
      String(right?.["Название"] ?? ""),
      undefined,
      { sensitivity: "base" }
    );

    if (categoryCompare !== 0) {
      return categoryCompare;
    }

    return String(
      left?.["Наименование"] ?? ""
    ).localeCompare(
      String(right?.["Наименование"] ?? ""),
      undefined,
      { sensitivity: "base" }
    );
  });

  const groups = [];

  for (const row of sorted) {
    const name =
      String(row?.["Название"] ?? "").trim() ||
      "—";

    let group = groups[groups.length - 1];

    if (!group || group.name !== name) {
      group = {
        name,
        rows: []
      };
      groups.push(group);
    }

    group.rows.push(row);
  }

  return groups;
}

function ostatSvodAnalysis(row) {
  const stock = numericValue(row?.Ostatok);
  const sales = numericValue(row?.Rash1);
  const writeOff = numericValue(row?.Rash2);
  const averageExpense = sales + writeOff;

  return {
    averageExpense,
    days:
      averageExpense > 0
        ? stock / averageExpense
        : 0,
    sales,
    salesDays:
      sales > 0
        ? stock / sales
        : 0,
    writeOff,
    writeOffDays:
      writeOff > 0
        ? stock / writeOff
        : 0
  };
}

function ostatSvodDaysClass(days) {
  const value = numericValue(days);

  if (value > 60) {
    return "ostat-svod-days-critical";
  }

  if (value > 30) {
    return "ostat-svod-days-warning";
  }

  return "";
}

function OstatSvodReportTable({
  rows,
  formatter,
  t
}) {
  const groups = groupOstatSvodRows(rows);

  return (
    <div className="ostat-svod-groups">
      <div className="ostat-svod-legend">
        <span className="ostat-svod-legend-item ostat-svod-legend-warning">
          {t(
            "OstatSvod.Warning30",
            "Более 30 дней"
          )}
        </span>
        <span className="ostat-svod-legend-item ostat-svod-legend-critical">
          {t(
            "OstatSvod.Warning60",
            "Более 60 дней"
          )}
        </span>
      </div>

      {groups.map((group) => (
        <section
          className="ostat-svod-group"
          key={group.name}
        >
          <div className="ostat-svod-group-title">
            {group.name}
          </div>

          <div className="report-table-scroll ostat-svod-table-scroll">
            <table className="report-table ostat-svod-table">
              <thead>
                <tr>
                  <th className="report-text">
                    {t(
                      "OstatSvod.Product",
                      "Наименование"
                    )}
                  </th>
                  <th className="report-money">
                    {t(
                      "OstatSvod.Price",
                      "Цена"
                    )}
                  </th>
                  <th className="report-money">
                    {t(
                      "OstatSvod.Stock",
                      "Остаток"
                    )}
                  </th>
                  <th className="report-money">
                    {t(
                      "OstatSvod.StockAmount",
                      "Сумма"
                    )}
                  </th>
                  <th className="report-money">
                    {t(
                      "OstatSvod.AverageExpense",
                      "Средний расход"
                    )}
                  </th>
                  <th className="report-money">
                    {t(
                      "OstatSvod.Days",
                      "Дней"
                    )}
                  </th>
                  <th className="report-money">
                    {t(
                      "OstatSvod.AverageSales",
                      "Средние продажи"
                    )}
                  </th>
                  <th className="report-money">
                    {t(
                      "OstatSvod.SalesDays",
                      "Дней продаж"
                    )}
                  </th>
                  <th className="report-money">
                    {t(
                      "OstatSvod.AverageWriteOff",
                      "Среднее списание"
                    )}
                  </th>
                  <th className="report-money">
                    {t(
                      "OstatSvod.WriteOffDays",
                      "Дней списания"
                    )}
                  </th>
                </tr>
              </thead>

              <tbody>
                {group.rows.map((row, index) => {
                  const analysis =
                    ostatSvodAnalysis(row);

                  return (
                    <tr
                      key={`${row?.IdTov ?? "item"}-${index}`}
                    >
                      <td className="report-text">
                        {row?.["Наименование"] || "—"}
                      </td>
                      <td className="report-money">
                        {formatter.format(
                          numericValue(row?.Price)
                        )}
                      </td>
                      <td className="report-money">
                        {formatter.format(
                          numericValue(row?.Ostatok)
                        )}
                      </td>
                      <td className="report-money">
                        {formatter.format(
                          numericValue(row?.OstatokSumma)
                        )}
                      </td>
                      <td className="report-money">
                        {formatter.format(
                          analysis.averageExpense
                        )}
                      </td>
                      <td
                        className={[
                          "report-money",
                          "ostat-svod-days-cell",
                          ostatSvodDaysClass(
                            analysis.days
                          )
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {formatter.format(
                          analysis.days
                        )}
                      </td>
                      <td className="report-money">
                        {formatter.format(
                          analysis.sales
                        )}
                      </td>
                      <td className="report-money">
                        {formatter.format(
                          analysis.salesDays
                        )}
                      </td>
                      <td className="report-money">
                        {formatter.format(
                          analysis.writeOff
                        )}
                      </td>
                      <td className="report-money">
                        {formatter.format(
                          analysis.writeOffDays
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

function buildOstatSvodPrintHtml({
  rows,
  dateTo,
  departmentName,
  locale,
  t
}) {
  const formatter = createMoneyFormatter(locale);
  const groups = groupOstatSvodRows(rows);

  const groupsHtml = groups
    .map((group) => {
      const body = group.rows
        .map((row) => {
          const analysis =
            ostatSvodAnalysis(row);
          const daysClass =
            ostatSvodDaysClass(analysis.days);

          return `<tr>
<td class="text">${escapeHtml(row?.["Наименование"] || "—")}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.Price)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.Ostatok)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.OstatokSumma)))}</td>
<td class="number">${escapeHtml(formatter.format(analysis.averageExpense))}</td>
<td class="number days ${escapeHtml(daysClass)}">${escapeHtml(formatter.format(analysis.days))}</td>
<td class="number">${escapeHtml(formatter.format(analysis.sales))}</td>
<td class="number">${escapeHtml(formatter.format(analysis.salesDays))}</td>
<td class="number">${escapeHtml(formatter.format(analysis.writeOff))}</td>
<td class="number">${escapeHtml(formatter.format(analysis.writeOffDays))}</td>
</tr>`;
        })
        .join("");

      return `<section class="group">
<div class="group-title">${escapeHtml(group.name)}</div>
<table>
<thead><tr>
<th class="text product">${escapeHtml(t("OstatSvod.Product", "Наименование"))}</th>
<th>${escapeHtml(t("OstatSvod.Price", "Цена"))}</th>
<th>${escapeHtml(t("OstatSvod.Stock", "Остаток"))}</th>
<th>${escapeHtml(t("OstatSvod.StockAmount", "Сумма"))}</th>
<th>${escapeHtml(t("OstatSvod.AverageExpense", "Средний расход"))}</th>
<th>${escapeHtml(t("OstatSvod.Days", "Дней"))}</th>
<th>${escapeHtml(t("OstatSvod.AverageSales", "Средние продажи"))}</th>
<th>${escapeHtml(t("OstatSvod.SalesDays", "Дней продаж"))}</th>
<th>${escapeHtml(t("OstatSvod.AverageWriteOff", "Среднее списание"))}</th>
<th>${escapeHtml(t("OstatSvod.WriteOffDays", "Дней списания"))}</th>
</tr></thead>
<tbody>${body}</tbody>
</table>
</section>`;
    })
    .join("");

  const title = `${t(
    "OstatSvod.Title",
    "Остатки (перезакупка)"
  )} ${t("OstatSvod.AsOf", "на")} ${formatReportDate(
    dateTo
  )}`;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
@page { size: A4 landscape; margin: 7mm; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: Arial, sans-serif; color: #111; font-size: 6.8pt; }
.header { margin-bottom: 3mm; }
h1 { margin: 0; font-size: 11pt; font-style: italic; font-weight: 700; }
.warehouse { margin-top: 1.2mm; font-size: 8pt; font-weight: 700; }
.legend { display: flex; gap: 3mm; margin: 1.7mm 0 2.5mm; font-size: 6.3pt; }
.legend span { padding: 0.5mm 1.4mm; border: 0.15mm solid #999; }
.legend-warning { background: #fde4e8; color: #7f3039; }
.legend-critical { background: #ef9ca8; color: #711722; font-weight: 700; }
.group { margin: 0 0 3mm; break-inside: auto; page-break-inside: auto; }
.group-title { padding: 0.9mm 1.2mm; background: #e8efed; border-top: 0.3mm solid #647571; border-bottom: 0.15mm solid #acb8b5; font-size: 7pt; font-weight: 700; break-after: avoid; page-break-after: avoid; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
thead { display: table-header-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
th { padding: 0.55mm 0.35mm; border-bottom: 0.2mm solid #555; font-size: 5.3pt; line-height: 1; text-align: right; vertical-align: bottom; }
th.text { text-align: left; }
th.product { width: 22%; }
th:not(.product) { width: 8.666%; }
td { padding: 0.5mm 0.35mm; border-bottom: 0.1mm dotted #c8cecc; font-size: 5.8pt; }
td.text { text-align: left; overflow-wrap: anywhere; }
td.number { text-align: right; white-space: nowrap; }
td.days { font-weight: 700; }
td.ostat-svod-days-warning { background: #fde4e8; color: #7f3039; }
td.ostat-svod-days-critical { background: #ef9ca8; color: #711722; }
</style>
</head>
<body>
<div class="header">
  <h1>${escapeHtml(title)}</h1>
  <div class="warehouse">${escapeHtml(t("OstatSvod.Warehouse", "Склад"))}: ${escapeHtml(departmentName || "")}</div>
</div>
<div class="legend">
  <span class="legend-warning">${escapeHtml(t("OstatSvod.Warning30", "Более 30 дней"))}</span>
  <span class="legend-critical">${escapeHtml(t("OstatSvod.Warning60", "Более 60 дней"))}</span>
</div>
${groupsHtml}
</body>
</html>`;
}

function printOstatSvodReport(options) {
  const printWindow = window.open(
    "",
    "_blank",
    "width=1250,height=900"
  );

  if (!printWindow) {
    window.alert(
      options.t(
        "Reports.PrintPopupBlocked",
        "Браузер заблокировал окно печати. Разрешите всплывающие окна для Web Office."
      )
    );
    return;
  }

  printWindow.document.open();
  printWindow.document.write(
    buildOstatSvodPrintHtml(options)
  );
  printWindow.document.close();
  printWindow.focus();
  closePrintWindowAfterPrint(printWindow);

  window.setTimeout(() => {
    printWindow.print();
  }, 150);
}

function safeOstatSvodFilePart(value) {
  return String(value ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

function buildOstatSvodExportModel({
  rows,
  dateTo,
  departmentName,
  locale,
  t
}) {
  const exportRows = [];

  for (const group of groupOstatSvodRows(rows)) {
    for (const row of group.rows) {
      const analysis =
        ostatSvodAnalysis(row);

      exportRows.push({
        Category: group.name,
        Product:
          row?.["Наименование"] || "",
        Price: row?.Price ?? "",
        Stock: row?.Ostatok ?? "",
        StockAmount:
          row?.OstatokSumma ?? "",
        AverageExpense:
          analysis.averageExpense,
        Days: analysis.days,
        AverageSales:
          analysis.sales,
        SalesDays:
          analysis.salesDays,
        AverageWriteOff:
          analysis.writeOff,
        WriteOffDays:
          analysis.writeOffDays
      });
    }
  }

  return {
    title: `${t(
      "OstatSvod.Title",
      "Остатки (перезакупка)"
    )} ${t("OstatSvod.AsOf", "на")} ${formatReportDate(
      dateTo
    )}`,
    fileName: `OstatSvod_${safeOstatSvodFilePart(
      dateTo
    )}_${safeOstatSvodFilePart(
      departmentName || "warehouse"
    )}`,
    orientation: "landscape",
    locale,
    meta: [
      {
        label: t(
          "OstatSvod.Warehouse",
          "Склад"
        ),
        value: departmentName || ""
      }
    ],
    columns: [
      {
        key: "Category",
        title: t(
          "OstatSvod.Category",
          "Категория"
        ),
        type: "text",
        width: 22
      },
      {
        key: "Product",
        title: t(
          "OstatSvod.Product",
          "Наименование"
        ),
        type: "text",
        width: 30
      },
      {
        key: "Price",
        title: t(
          "OstatSvod.Price",
          "Цена"
        ),
        type: "number",
        decimals: 2,
        width: 12
      },
      {
        key: "Stock",
        title: t(
          "OstatSvod.Stock",
          "Остаток"
        ),
        type: "number",
        decimals: 2,
        width: 13
      },
      {
        key: "StockAmount",
        title: t(
          "OstatSvod.StockAmount",
          "Сумма"
        ),
        type: "number",
        decimals: 2,
        width: 14
      },
      {
        key: "AverageExpense",
        title: t(
          "OstatSvod.AverageExpense",
          "Средний расход"
        ),
        type: "number",
        decimals: 2,
        width: 15
      },
      {
        key: "Days",
        title: t(
          "OstatSvod.Days",
          "Дней"
        ),
        type: "number",
        decimals: 2,
        width: 12
      },
      {
        key: "AverageSales",
        title: t(
          "OstatSvod.AverageSales",
          "Средние продажи"
        ),
        type: "number",
        decimals: 2,
        width: 15
      },
      {
        key: "SalesDays",
        title: t(
          "OstatSvod.SalesDays",
          "Дней продаж"
        ),
        type: "number",
        decimals: 2,
        width: 13
      },
      {
        key: "AverageWriteOff",
        title: t(
          "OstatSvod.AverageWriteOff",
          "Среднее списание"
        ),
        type: "number",
        decimals: 2,
        width: 15
      },
      {
        key: "WriteOffDays",
        title: t(
          "OstatSvod.WriteOffDays",
          "Дней списания"
        ),
        type: "number",
        decimals: 2,
        width: 14
      }
    ],
    rows: exportRows,
    footerRows: []
  };
}

function OstatSvodReport({
  data,
  dateTo,
  departmentName,
  locale,
  fetchWithAuth,
  t,
  onReload
}) {
  const rows = getOstatSvodRows(data);
  const formatter = createMoneyFormatter(locale);

  const commonOptions = {
    rows,
    dateTo,
    departmentName,
    locale,
    t
  };

  async function handleExport(format) {
    try {
      await exportReportFile({
        fetchWithAuth,
        reportModel: buildOstatSvodExportModel(
          commonOptions
        ),
        format,
        errorMessage: t(
          "Report.ExportError",
          "Ошибка экспорта отчёта."
        )
      });
    } catch (err) {
      window.alert(
        err?.message ||
          t(
            "Report.ExportError",
            "Ошибка экспорта отчёта."
          )
      );
    }
  }

  return (
    <div className="reports-page ostat-svod-report-page">
      <div className="report-toolbar">
        <button
          type="button"
          className="report-run-button"
          onClick={onReload}
        >
          {t("Common.Generate", "Сформировать")}
        </button>

        <button
          type="button"
          className="report-action-button report-print-button"
          onClick={() =>
            printOstatSvodReport(commonOptions)
          }
        >
          {t("Common.Print", "Печать")}
        </button>

        <button
          type="button"
          className="report-action-button report-excel-button"
          onClick={() => handleExport("xlsx")}
        >
          {t("Common.Excel", "Excel")}
        </button>

        <button
          type="button"
          className="report-action-button report-word-button"
          onClick={() => handleExport("docx")}
        >
          {t("Common.Word", "Word")}
        </button>
      </div>

      <article className="revenue-report-sheet ostat-svod-report-sheet">
        <header className="ostat-svod-report-heading">
          <h3>
            {t(
              "OstatSvod.Title",
              "Остатки (перезакупка)"
            )}{" "}
            {t("OstatSvod.AsOf", "на")}{" "}
            {formatReportDate(dateTo)}
          </h3>

          <div className="ostat-svod-warehouse">
            {t(
              "OstatSvod.Warehouse",
              "Склад"
            )}:{" "}
            <strong>
              {departmentName || ""}
            </strong>
          </div>
        </header>

        {rows.length > 0 ? (
          <OstatSvodReportTable
            rows={rows}
            formatter={formatter}
            t={t}
          />
        ) : (
          <div className="report-empty">
            {t(
              "Reports.NoDataForPeriod",
              "За выбранный период данных нет."
            )}
          </div>
        )}
      </article>
    </div>
  );
}


function getRashodSirRows(data) {
  const payload = data?.data ?? data?.Data ?? data;

  if (Array.isArray(payload)) {
    return payload;
  }

  return normalizeRows(
    payload?.Main ??
    payload?.main ??
    payload?.Rows ??
    payload?.rows ??
    payload?.RashodSir ??
    payload?.rashodSir ??
    payload?.rashodsir
  );
}

function groupRashodSirRows(rows) {
  const sorted = [...rows].sort((left, right) => {
    const categoryCompare = String(
      left?.Categor ?? ""
    ).localeCompare(
      String(right?.Categor ?? ""),
      undefined,
      { sensitivity: "base" }
    );

    if (categoryCompare !== 0) {
      return categoryCompare;
    }

    return String(left?.NameTov ?? "").localeCompare(
      String(right?.NameTov ?? ""),
      undefined,
      { sensitivity: "base" }
    );
  });

  const groups = [];

  for (const row of sorted) {
    const name =
      String(row?.Categor ?? "").trim() ||
      "—";

    let group = groups[groups.length - 1];

    if (!group || group.name !== name) {
      group = {
        name,
        rows: []
      };
      groups.push(group);
    }

    group.rows.push(row);
  }

  return groups;
}

function rashodSirSum(rows) {
  return rows.reduce(
    (sum, row) => sum + numericValue(row?.Summ),
    0
  );
}

function RashodSirReportTable({
  rows,
  formatter,
  t
}) {
  const groups = groupRashodSirRows(rows);
  const grandTotal = rashodSirSum(rows);

  return (
    <div className="rashodsir-groups">
      <div className="rashodsir-groups-grid">
        {groups.map((group) => (
          <section
            className="rashodsir-group"
            key={group.name}
          >
          <div className="rashodsir-group-title">
            {group.name}
          </div>

          <div className="report-table-scroll">
            <table className="report-table rashodsir-table">
              <thead>
                <tr>
                  <th className="report-text">
                    {t(
                      "RashodSir.Product",
                      "Сырье"
                    )}
                  </th>
                  <th className="report-money">
                    {t(
                      "RashodSir.Quantity",
                      "Количество"
                    )}
                  </th>
                  <th className="report-money">
                    {t(
                      "RashodSir.Price",
                      "Цена"
                    )}
                  </th>
                  <th className="report-money">
                    {t(
                      "RashodSir.Amount",
                      "Сумма"
                    )}
                  </th>
                </tr>
              </thead>

              <tbody>
                {group.rows.map((row, index) => (
                  <tr
                    key={`${row?.NameTov ?? "item"}-${index}`}
                  >
                    <td className="report-text">
                      {row?.NameTov || "—"}
                    </td>
                    <td className="report-money">
                      {formatter.format(
                        numericValue(row?.Kolvo)
                      )}
                    </td>
                    <td className="report-money">
                      {formatter.format(
                        numericValue(row?.Price)
                      )}
                    </td>
                    <td className="report-money">
                      {formatter.format(
                        numericValue(row?.Summ)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr>
                  <td
                    colSpan="3"
                    className="report-text report-total-label"
                  >
                    {t(
                      "RashodSir.CategoryTotal",
                      "Итого по категории"
                    )}
                  </td>
                  <td className="report-money">
                    {formatter.format(
                      rashodSirSum(group.rows)
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          </section>
        ))}
      </div>

      {groups.length > 0 && (
        <div className="rashodsir-grand-total">
          <span>
            {t("Common.Total", "Итого")}
          </span>
          <strong>
            {formatter.format(grandTotal)}
          </strong>
        </div>
      )}
    </div>
  );
}

function buildRashodSirPrintHtml({
  rows,
  dateFrom,
  dateTo,
  departmentName,
  locale,
  t
}) {
  const formatter = createMoneyFormatter(locale);
  const groups = groupRashodSirRows(rows);
  const grandTotal = rashodSirSum(rows);

  const groupsHtml = groups
    .map((group) => {
      const body = group.rows
        .map(
          (row) => `<tr>
<td class="text">${escapeHtml(row?.NameTov || "—")}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.Kolvo)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.Price)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.Summ)))}</td>
</tr>`
        )
        .join("");

      return `<section class="group">
<div class="group-title">${escapeHtml(group.name)}</div>
<table>
<thead><tr>
<th class="text">${escapeHtml(t("RashodSir.Product", "Сырье"))}</th>
<th class="number">${escapeHtml(t("RashodSir.Quantity", "Количество"))}</th>
<th class="number">${escapeHtml(t("RashodSir.Price", "Цена"))}</th>
<th class="number">${escapeHtml(t("RashodSir.Amount", "Сумма"))}</th>
</tr></thead>
<tbody>${body}</tbody>
<tfoot><tr>
<td colspan="3" class="text total-label">${escapeHtml(t("RashodSir.CategoryTotal", "Итого по категории"))}</td>
<td class="number">${escapeHtml(formatter.format(rashodSirSum(group.rows)))}</td>
</tr></tfoot>
</table>
</section>`;
    })
    .join("");

  const title = `${t(
    "RashodSir.Title",
    "Расход сырья за период"
  )} ${t("Common.From", "с")} ${formatReportDate(
    dateFrom
  )} ${t("Common.To", "по")} ${formatReportDate(
    dateTo
  )}`;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
@page { size: A4 portrait; margin: 9mm 10mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; color: #111; font-size: 8.5pt; }
.header { margin-bottom: 4mm; }
h1 { margin: 0; font-size: 12pt; font-style: italic; font-weight: 700; }
.warehouse { margin-top: 1.5mm; font-size: 8.5pt; font-weight: 700; }
.groups-columns { column-count: 2; column-gap: 5mm; column-fill: auto; }
.group { display: block; width: 100%; margin: 0 0 3mm; break-inside: auto; page-break-inside: auto; }
.group-title { padding: 1mm 1.4mm; background: #e8efed; border-top: 0.3mm solid #647571; border-bottom: 0.2mm solid #acb8b5; font-size: 8.2pt; font-weight: 700; break-after: avoid; page-break-after: avoid; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
thead { display: table-header-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
th { padding: 0.8mm 1mm; border-bottom: 0.25mm solid #666; font-size: 7pt; }
td { padding: 0.75mm 1mm; border-bottom: 0.15mm dotted #c7cecb; font-size: 7.4pt; }
.text { text-align: left; }
.number { text-align: right; white-space: nowrap; }
th:nth-child(1) { width: 55%; }
th:nth-child(2) { width: 15%; }
th:nth-child(3) { width: 15%; }
th:nth-child(4) { width: 15%; }
tfoot td { border-top: 0.25mm solid #666; border-bottom: 0; background: #f3f6f5; font-weight: 700; }
.total-label { text-align: right; }
.grand-total { display: flex; justify-content: flex-end; gap: 8mm; margin-top: 5mm; padding-top: 2mm; border-top: 0.35mm solid #333; font-size: 9pt; }
</style>
</head>
<body>
<div class="header">
  <h1>${escapeHtml(title)}</h1>
  <div class="warehouse">${escapeHtml(t("RashodSir.Warehouse", "Склад"))}: ${escapeHtml(departmentName || "")}</div>
</div>
<div class="groups-columns">${groupsHtml}</div>
${groups.length > 0 ? `<div class="grand-total"><span>${escapeHtml(t("Common.Total", "Итого"))}</span><strong>${escapeHtml(formatter.format(grandTotal))}</strong></div>` : ""}
</body>
</html>`;
}

function printRashodSirReport(options) {
  const printWindow = window.open(
    "",
    "_blank",
    "width=1050,height=900"
  );

  if (!printWindow) {
    window.alert(
      options.t(
        "Reports.PrintPopupBlocked",
        "Браузер заблокировал окно печати. Разрешите всплывающие окна для Web Office."
      )
    );
    return;
  }

  printWindow.document.open();
  printWindow.document.write(
    buildRashodSirPrintHtml(options)
  );
  printWindow.document.close();
  printWindow.focus();
  closePrintWindowAfterPrint(printWindow);

  window.setTimeout(() => {
    printWindow.print();
  }, 150);
}

function safeRashodSirFilePart(value) {
  return String(value ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

function buildRashodSirExportModel({
  rows,
  dateFrom,
  dateTo,
  departmentName,
  locale,
  t
}) {
  const exportRows = [];

  for (const group of groupRashodSirRows(rows)) {
    for (const row of group.rows) {
      exportRows.push({
        Category: group.name,
        Product: row?.NameTov || "",
        Quantity: row?.Kolvo ?? "",
        Price: row?.Price ?? "",
        Amount: row?.Summ ?? ""
      });
    }

    exportRows.push({
      Category: group.name,
      Product: t(
        "RashodSir.CategoryTotal",
        "Итого по категории"
      ),
      Quantity: "",
      Price: "",
      Amount: rashodSirSum(group.rows)
    });
  }

  return {
    title: `${t(
      "RashodSir.Title",
      "Расход сырья за период"
    )} ${formatReportDate(dateFrom)} — ${formatReportDate(dateTo)}`,
    fileName: `RashodSir_${safeRashodSirFilePart(
      dateFrom
    )}_${safeRashodSirFilePart(
      dateTo
    )}_${safeRashodSirFilePart(
      departmentName || "warehouse"
    )}`,
    orientation: "portrait",
    locale,
    meta: [
      {
        label: t(
          "RashodSir.Warehouse",
          "Склад"
        ),
        value: departmentName || ""
      }
    ],
    columns: [
      {
        key: "Category",
        title: t(
          "RashodSir.Category",
          "Категория"
        ),
        type: "text",
        width: 24
      },
      {
        key: "Product",
        title: t(
          "RashodSir.Product",
          "Сырье"
        ),
        type: "text",
        width: 36
      },
      {
        key: "Quantity",
        title: t(
          "RashodSir.Quantity",
          "Количество"
        ),
        type: "number",
        decimals: 2,
        width: 14
      },
      {
        key: "Price",
        title: t(
          "RashodSir.Price",
          "Цена"
        ),
        type: "number",
        decimals: 2,
        width: 14
      },
      {
        key: "Amount",
        title: t(
          "RashodSir.Amount",
          "Сумма"
        ),
        type: "number",
        decimals: 2,
        width: 15
      }
    ],
    rows: exportRows,
    footerRows: [
      {
        label: t("Common.Total", "Итого"),
        values: {
          Amount: rashodSirSum(rows)
        }
      }
    ]
  };
}

function RashodSirReport({
  data,
  dateFrom,
  dateTo,
  departmentName,
  locale,
  fetchWithAuth,
  t,
  onReload
}) {
  const rows = getRashodSirRows(data);
  const formatter = createMoneyFormatter(locale);

  const commonOptions = {
    rows,
    dateFrom,
    dateTo,
    departmentName,
    locale,
    t
  };

  async function handleExport(format) {
    try {
      await exportReportFile({
        fetchWithAuth,
        reportModel: buildRashodSirExportModel(
          commonOptions
        ),
        format,
        errorMessage: t(
          "Report.ExportError",
          "Ошибка экспорта отчёта."
        )
      });
    } catch (err) {
      window.alert(
        err?.message ||
          t(
            "Report.ExportError",
            "Ошибка экспорта отчёта."
          )
      );
    }
  }

  return (
    <div className="reports-page rashodsir-report-page">
      <div className="report-toolbar">
        <button
          type="button"
          className="report-run-button"
          onClick={onReload}
        >
          {t("Common.Generate", "Сформировать")}
        </button>

        <button
          type="button"
          className="report-action-button report-print-button"
          onClick={() =>
            printRashodSirReport(commonOptions)
          }
        >
          {t("Common.Print", "Печать")}
        </button>

        <button
          type="button"
          className="report-action-button report-excel-button"
          onClick={() => handleExport("xlsx")}
        >
          {t("Common.Excel", "Excel")}
        </button>

        <button
          type="button"
          className="report-action-button report-word-button"
          onClick={() => handleExport("docx")}
        >
          {t("Common.Word", "Word")}
        </button>
      </div>

      <article className="revenue-report-sheet rashodsir-report-sheet">
        <header className="rashodsir-report-heading">
          <h3>
            {t(
              "RashodSir.Title",
              "Расход сырья за период"
            )}{" "}
            {t("Common.From", "с")} {formatReportDate(dateFrom)}{" "}
            {t("Common.To", "по")} {formatReportDate(dateTo)}
          </h3>

          <div className="rashodsir-warehouse">
            {t(
              "RashodSir.Warehouse",
              "Склад"
            )}:{" "}
            <strong>{departmentName || ""}</strong>
          </div>
        </header>

        {rows.length > 0 ? (
          <RashodSirReportTable
            rows={rows}
            formatter={formatter}
            t={t}
          />
        ) : (
          <div className="report-empty">
            {t(
              "Reports.NoDataForPeriod",
              "За выбранный период данных нет."
            )}
          </div>
        )}
      </article>
    </div>
  );
}


function getProizvRows(data) {
  const payload = data?.data ?? data?.Data ?? data;

  if (Array.isArray(payload)) {
    return payload;
  }

  return normalizeRows(
    payload?.Main ??
    payload?.main ??
    payload?.Rows ??
    payload?.rows ??
    payload?.Proizv ??
    payload?.proizv
  );
}

function sortProizvRows(rows) {
  return [...rows].sort((left, right) =>
    String(left?.NameTov ?? "").localeCompare(
      String(right?.NameTov ?? ""),
      undefined,
      { sensitivity: "base" }
    )
  );
}

function proizvSum(rows) {
  return rows.reduce(
    (sum, row) => sum + numericValue(row?.Summ),
    0
  );
}

function ProizvReportTable({
  rows,
  formatter,
  t
}) {
  const sortedRows = sortProizvRows(rows);
  const total = proizvSum(rows);

  return (
    <div className="report-table-scroll proizv-table-scroll">
      <table className="report-table proizv-table">
        <thead>
          <tr>
            <th className="report-text">
              {t(
                "Proizv.Product",
                "Наименование"
              )}
            </th>
            <th className="report-money">
              {t(
                "Proizv.Quantity",
                "Количество"
              )}
            </th>
            <th className="report-money">
              {t(
                "Proizv.Price",
                "Цена"
              )}
            </th>
            <th className="report-money">
              {t(
                "Proizv.Amount",
                "Сумма"
              )}
            </th>
          </tr>
        </thead>

        <tbody>
          {sortedRows.map((row, index) => (
            <tr
              key={`${row?.NameTov ?? "item"}-${index}`}
            >
              <td className="report-text">
                {row?.NameTov || "—"}
              </td>
              <td className="report-money">
                {formatter.format(
                  numericValue(row?.Kolvo)
                )}
              </td>
              <td className="report-money">
                {formatter.format(
                  numericValue(row?.Price)
                )}
              </td>
              <td className="report-money">
                {formatter.format(
                  numericValue(row?.Summ)
                )}
              </td>
            </tr>
          ))}
        </tbody>

        {sortedRows.length > 0 && (
          <tfoot>
            <tr>
              <td
                colSpan="3"
                className="report-text report-total-label"
              >
                {t("Common.Total", "Итого")}
              </td>
              <td className="report-money">
                {formatter.format(total)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function buildProizvPrintHtml({
  rows,
  dateFrom,
  dateTo,
  departmentName,
  locale,
  t
}) {
  const formatter = createMoneyFormatter(locale);
  const sortedRows = sortProizvRows(rows);
  const total = proizvSum(rows);

  const body = sortedRows
    .map(
      (row) => `<tr>
<td class="text">${escapeHtml(row?.NameTov || "—")}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.Kolvo)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.Price)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.Summ)))}</td>
</tr>`
    )
    .join("");

  const title = `${t(
    "Proizv.Title",
    "Производство за период"
  )} ${t("Common.From", "с")} ${formatReportDate(
    dateFrom
  )} ${t("Common.To", "по")} ${formatReportDate(
    dateTo
  )}`;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
@page { size: A4 portrait; margin: 10mm 12mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; color: #111; font-size: 9pt; }
.header { margin-bottom: 5mm; }
h1 { margin: 0; font-size: 13pt; font-style: italic; font-weight: 700; }
.warehouse { margin-top: 1.5mm; font-size: 9pt; font-weight: 700; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
thead { display: table-header-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
th { padding: 0.9mm 1mm; border-bottom: 0.3mm solid #555; font-size: 7.4pt; }
td { padding: 0.85mm 1mm; border-bottom: 0.15mm dotted #c7cecb; font-size: 8pt; }
.text { text-align: left; }
.number { text-align: right; white-space: nowrap; }
th:nth-child(1) { width: 55%; }
th:nth-child(2) { width: 15%; }
th:nth-child(3) { width: 15%; }
th:nth-child(4) { width: 15%; }
tfoot td { border-top: 0.3mm solid #555; border-bottom: 0; background: #f3f6f5; font-weight: 700; }
.total-label { text-align: right; }
</style>
</head>
<body>
<div class="header">
  <h1>${escapeHtml(title)}</h1>
  <div class="warehouse">${escapeHtml(t("Proizv.Warehouse", "Склад"))}: ${escapeHtml(departmentName || "")}</div>
</div>
<table>
<thead><tr>
<th class="text">${escapeHtml(t("Proizv.Product", "Наименование"))}</th>
<th class="number">${escapeHtml(t("Proizv.Quantity", "Количество"))}</th>
<th class="number">${escapeHtml(t("Proizv.Price", "Цена"))}</th>
<th class="number">${escapeHtml(t("Proizv.Amount", "Сумма"))}</th>
</tr></thead>
<tbody>${body}</tbody>
${sortedRows.length > 0 ? `<tfoot><tr><td colspan="3" class="text total-label">${escapeHtml(t("Common.Total", "Итого"))}</td><td class="number">${escapeHtml(formatter.format(total))}</td></tr></tfoot>` : ""}
</table>
</body>
</html>`;
}

function printProizvReport(options) {
  const printWindow = window.open(
    "",
    "_blank",
    "width=1050,height=900"
  );

  if (!printWindow) {
    window.alert(
      options.t(
        "Reports.PrintPopupBlocked",
        "Браузер заблокировал окно печати. Разрешите всплывающие окна для Web Office."
      )
    );
    return;
  }

  printWindow.document.open();
  printWindow.document.write(
    buildProizvPrintHtml(options)
  );
  printWindow.document.close();
  printWindow.focus();
  closePrintWindowAfterPrint(printWindow);

  window.setTimeout(() => {
    printWindow.print();
  }, 150);
}

function safeProizvFilePart(value) {
  return String(value ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

function buildProizvExportModel({
  rows,
  dateFrom,
  dateTo,
  departmentName,
  locale,
  t
}) {
  const exportRows = sortProizvRows(rows).map(
    (row) => ({
      Product: row?.NameTov || "",
      Quantity: row?.Kolvo ?? "",
      Price: row?.Price ?? "",
      Amount: row?.Summ ?? ""
    })
  );

  return {
    title: `${t(
      "Proizv.Title",
      "Производство за период"
    )} ${formatReportDate(dateFrom)} — ${formatReportDate(dateTo)}`,
    fileName: `Proizv_${safeProizvFilePart(
      dateFrom
    )}_${safeProizvFilePart(
      dateTo
    )}_${safeProizvFilePart(
      departmentName || "warehouse"
    )}`,
    orientation: "portrait",
    locale,
    meta: [
      {
        label: t(
          "Proizv.Warehouse",
          "Склад"
        ),
        value: departmentName || ""
      }
    ],
    columns: [
      {
        key: "Product",
        title: t(
          "Proizv.Product",
          "Наименование"
        ),
        type: "text",
        width: 40
      },
      {
        key: "Quantity",
        title: t(
          "Proizv.Quantity",
          "Количество"
        ),
        type: "number",
        decimals: 2,
        width: 14
      },
      {
        key: "Price",
        title: t(
          "Proizv.Price",
          "Цена"
        ),
        type: "number",
        decimals: 2,
        width: 14
      },
      {
        key: "Amount",
        title: t(
          "Proizv.Amount",
          "Сумма"
        ),
        type: "number",
        decimals: 2,
        width: 15
      }
    ],
    rows: exportRows,
    footerRows: [
      {
        label: t("Common.Total", "Итого"),
        values: {
          Amount: proizvSum(rows)
        }
      }
    ]
  };
}

function ProizvReport({
  data,
  dateFrom,
  dateTo,
  departmentName,
  locale,
  fetchWithAuth,
  t,
  onReload
}) {
  const rows = getProizvRows(data);
  const formatter = createMoneyFormatter(locale);

  const commonOptions = {
    rows,
    dateFrom,
    dateTo,
    departmentName,
    locale,
    t
  };

  async function handleExport(format) {
    try {
      await exportReportFile({
        fetchWithAuth,
        reportModel: buildProizvExportModel(
          commonOptions
        ),
        format,
        errorMessage: t(
          "Report.ExportError",
          "Ошибка экспорта отчёта."
        )
      });
    } catch (err) {
      window.alert(
        err?.message ||
          t(
            "Report.ExportError",
            "Ошибка экспорта отчёта."
          )
      );
    }
  }

  return (
    <div className="reports-page proizv-report-page">
      <div className="report-toolbar">
        <button
          type="button"
          className="report-run-button"
          onClick={onReload}
        >
          {t("Common.Generate", "Сформировать")}
        </button>

        <button
          type="button"
          className="report-action-button report-print-button"
          onClick={() =>
            printProizvReport(commonOptions)
          }
        >
          {t("Common.Print", "Печать")}
        </button>

        <button
          type="button"
          className="report-action-button report-excel-button"
          onClick={() => handleExport("xlsx")}
        >
          {t("Common.Excel", "Excel")}
        </button>

        <button
          type="button"
          className="report-action-button report-word-button"
          onClick={() => handleExport("docx")}
        >
          {t("Common.Word", "Word")}
        </button>
      </div>

      <article className="revenue-report-sheet proizv-report-sheet">
        <header className="proizv-report-heading">
          <h3>
            {t(
              "Proizv.Title",
              "Производство за период"
            )}{" "}
            {t("Common.From", "с")} {formatReportDate(dateFrom)}{" "}
            {t("Common.To", "по")} {formatReportDate(dateTo)}
          </h3>

          <div className="proizv-warehouse">
            {t(
              "Proizv.Warehouse",
              "Склад"
            )}:{" "}
            <strong>{departmentName || ""}</strong>
          </div>
        </header>

        {rows.length > 0 ? (
          <ProizvReportTable
            rows={rows}
            formatter={formatter}
            t={t}
          />
        ) : (
          <div className="report-empty">
            {t(
              "Reports.NoDataForPeriod",
              "За выбранный период данных нет."
            )}
          </div>
        )}
      </article>
    </div>
  );
}


function getRashodDishRows(data) {
  const payload = data?.data ?? data?.Data ?? data;

  if (Array.isArray(payload)) {
    return payload;
  }

  return normalizeRows(
    payload?.Main ??
    payload?.main ??
    payload?.Rows ??
    payload?.rows ??
    payload?.RashodDish ??
    payload?.rashodDish ??
    payload?.rashoddish
  );
}

function sortRashodDishByName(rows) {
  return [...rows].sort((left, right) =>
    String(left?.NameDish ?? "").localeCompare(
      String(right?.NameDish ?? ""),
      undefined,
      { sensitivity: "base" }
    )
  );
}

function sortRashodDishByRating(rows) {
  return [...rows].sort((left, right) => {
    const quantityCompare =
      numericValue(right?.Realiz) -
      numericValue(left?.Realiz);

    if (quantityCompare !== 0) {
      return quantityCompare;
    }

    return String(left?.NameDish ?? "").localeCompare(
      String(right?.NameDish ?? ""),
      undefined,
      { sensitivity: "base" }
    );
  });
}

function groupRashodDishRows(rows, field) {
  const sorted = [...rows].sort((left, right) => {
    const groupCompare = String(
      left?.[field] ?? ""
    ).localeCompare(
      String(right?.[field] ?? ""),
      undefined,
      { sensitivity: "base" }
    );

    if (groupCompare !== 0) {
      return groupCompare;
    }

    return String(left?.NameDish ?? "").localeCompare(
      String(right?.NameDish ?? ""),
      undefined,
      { sensitivity: "base" }
    );
  });

  const groups = [];

  for (const row of sorted) {
    const name =
      String(row?.[field] ?? "").trim() ||
      "—";

    let group = groups[groups.length - 1];

    if (!group || group.name !== name) {
      group = {
        name,
        rows: []
      };
      groups.push(group);
    }

    group.rows.push(row);
  }

  return groups;
}

function rashodDishTotals(rows) {
  return {
    Summ: sumField(rows, "Summ"),
    SummSeb: sumField(rows, "SummSeb")
  };
}

function RashodDishColumnsHeader({ t }) {
  return (
    <tr>
      <th className="report-text">
        {t(
          "RashodDish.Dish",
          "Блюдо"
        )}
      </th>
      <th className="report-money">
        {t(
          "RashodDish.Quantity",
          "Количество"
        )}
      </th>
      <th className="report-money">
        {t(
          "RashodDish.Amount",
          "Сумма"
        )}
      </th>
      <th className="report-money">
        {t(
          "RashodDish.CostAmount",
          "Себестоимость, сумма"
        )}
      </th>
      <th className="report-money">
        {t(
          "RashodDish.Rate",
          "Rate"
        )}
      </th>
      <th className="report-money">
        {t(
          "RashodDish.Price",
          "Цена"
        )}
      </th>
      <th className="report-money">
        {t(
          "RashodDish.Cost",
          "Себестоимость"
        )}
      </th>
    </tr>
  );
}

function RashodDishRowsBody({
  rows,
  formatter
}) {
  return (
    <tbody>
      {rows.map((row, index) => (
        <tr
          key={`${row?.NameDish ?? "dish"}-${index}`}
        >
          <td className="report-text">
            {row?.NameDish || "—"}
          </td>
          <td className="report-money">
            {formatter.format(
              numericValue(row?.Realiz)
            )}
          </td>
          <td className="report-money">
            {formatter.format(
              numericValue(row?.Summ)
            )}
          </td>
          <td className="report-money">
            {formatter.format(
              numericValue(row?.SummSeb)
            )}
          </td>
          <td className="report-money">
            {formatter.format(
              numericValue(row?.Rate)
            )}
          </td>
          <td className="report-money">
            {formatter.format(
              numericValue(row?.Price)
            )}
          </td>
          <td className="report-money">
            {formatter.format(
              numericValue(row?.Sebest)
            )}
          </td>
        </tr>
      ))}
    </tbody>
  );
}

function RashodDishGroupedTable({
  rows,
  groupField,
  formatter,
  t
}) {
  const groups = groupRashodDishRows(
    rows,
    groupField
  );
  const grandTotals = rashodDishTotals(rows);

  return (
    <div className="rashoddish-groups">
      {groups.map((group) => {
        const totals =
          rashodDishTotals(group.rows);

        return (
          <section
            className="rashoddish-group"
            key={group.name}
          >
            <div className="rashoddish-group-title">
              {group.name}
            </div>

            <div className="report-table-scroll">
              <table className="report-table rashoddish-table">
                <thead>
                  <RashodDishColumnsHeader t={t} />
                </thead>

                <RashodDishRowsBody
                  rows={group.rows}
                  formatter={formatter}
                />

                <tfoot>
                  <tr>
                    <td className="report-text report-total-label">
                      {t(
                        "RashodDish.GroupTotal",
                        "Итого"
                      )}
                    </td>
                    <td />
                    <td className="report-money">
                      {formatter.format(
                        totals.Summ
                      )}
                    </td>
                    <td className="report-money">
                      {formatter.format(
                        totals.SummSeb
                      )}
                    </td>
                    <td />
                    <td />
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        );
      })}

      {groups.length > 0 && (
        <div className="rashoddish-grand-total">
          <div>
            <span>
              {t(
                "RashodDish.Amount",
                "Сумма"
              )}
            </span>
            <strong>
              {formatter.format(
                grandTotals.Summ
              )}
            </strong>
          </div>

          <div>
            <span>
              {t(
                "RashodDish.CostAmount",
                "Себестоимость, сумма"
              )}
            </span>
            <strong>
              {formatter.format(
                grandTotals.SummSeb
              )}
            </strong>
          </div>
        </div>
      )}
    </div>
  );
}

function RashodDishRatingTable({
  rows,
  formatter,
  t
}) {
  const sortedRows =
    sortRashodDishByRating(rows);

  return (
    <div className="report-table-scroll">
      <table className="report-table rashoddish-table rashoddish-rating-table">
        <thead>
          <RashodDishColumnsHeader t={t} />
        </thead>

        <RashodDishRowsBody
          rows={sortedRows}
          formatter={formatter}
        />
      </table>
    </div>
  );
}

function rashodDishPrintRowsHtml({
  rows,
  formatter
}) {
  return rows
    .map(
      (row) => `<tr>
<td class="text">${escapeHtml(row?.NameDish || "—")}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.Realiz)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.Summ)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.SummSeb)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.Rate)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.Price)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.Sebest)))}</td>
</tr>`
    )
    .join("");
}

function rashodDishPrintTableHeader(t) {
  return `<thead><tr>
<th class="text dish">${escapeHtml(t("RashodDish.Dish", "Блюдо"))}</th>
<th>${escapeHtml(t("RashodDish.Quantity", "Количество"))}</th>
<th>${escapeHtml(t("RashodDish.Amount", "Сумма"))}</th>
<th>${escapeHtml(t("RashodDish.CostAmount", "Себестоимость, сумма"))}</th>
<th>${escapeHtml(t("RashodDish.Rate", "Rate"))}</th>
<th>${escapeHtml(t("RashodDish.Price", "Цена"))}</th>
<th>${escapeHtml(t("RashodDish.Cost", "Себестоимость"))}</th>
</tr></thead>`;
}

function buildRashodDishPrintHtml({
  rows,
  variant,
  dateFrom,
  dateTo,
  departmentName,
  locale,
  t
}) {
  const formatter =
    createMoneyFormatter(locale);

  const title =
    variant === "rating"
      ? t(
          "RashodDish.RatingTitle",
          "Рейтинг продаж блюд"
        )
      : variant === "ceh"
        ? t(
            "RashodDish.CehTitle",
            "Расход блюд по цехам"
          )
        : variant === "typdish"
          ? t(
              "RashodDish.TypeTitle",
              "Расход блюд по типам"
            )
          : variant === "hh"
            ? t(
                "RashodDish.HappyHoursTitle",
                "Продажи счастливых часов"
              )
            : t(
                "RashodDish.Title",
                "Расход блюд за период"
              );

  let contentHtml = "";

  if (variant === "rating") {
    const sortedRows =
      sortRashodDishByRating(rows);

    contentHtml = `<table>
${rashodDishPrintTableHeader(t)}
<tbody>${rashodDishPrintRowsHtml({
      rows: sortedRows,
      formatter
    })}</tbody>
</table>`;
  } else {
    const groupField =
      variant === "ceh"
        ? "Ceh"
        : variant === "typdish"
          ? "TypDish"
          : "Groups";
    const groups =
      groupRashodDishRows(
        rows,
        groupField
      );

    contentHtml = groups
      .map((group) => {
        const totals =
          rashodDishTotals(group.rows);

        return `<section class="group">
<div class="group-title">${escapeHtml(group.name)}</div>
<table>
${rashodDishPrintTableHeader(t)}
<tbody>${rashodDishPrintRowsHtml({
          rows: group.rows,
          formatter
        })}</tbody>
<tfoot><tr>
<td class="text total-label">${escapeHtml(t("RashodDish.GroupTotal", "Итого"))}</td>
<td></td>
<td class="number">${escapeHtml(formatter.format(totals.Summ))}</td>
<td class="number">${escapeHtml(formatter.format(totals.SummSeb))}</td>
<td></td>
<td></td>
<td></td>
</tr></tfoot>
</table>
</section>`;
      })
      .join("");

    const grandTotals =
      rashodDishTotals(rows);

    if (groups.length > 0) {
      contentHtml += `<div class="grand-total">
<div><span>${escapeHtml(t("RashodDish.Amount", "Сумма"))}</span><strong>${escapeHtml(formatter.format(grandTotals.Summ))}</strong></div>
<div><span>${escapeHtml(t("RashodDish.CostAmount", "Себестоимость, сумма"))}</span><strong>${escapeHtml(formatter.format(grandTotals.SummSeb))}</strong></div>
</div>`;
    }
  }

  const fullTitle = `${title} ${t(
    "Common.From",
    "с"
  )} ${formatReportDate(dateFrom)} ${t(
    "Common.To",
    "по"
  )} ${formatReportDate(dateTo)}`;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(fullTitle)}</title>
<style>
@page { size: A4 portrait; margin: 8mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; color: #111; font-size: 7.5pt; }
.header { margin-bottom: 4mm; }
h1 { margin: 0; font-size: 11pt; font-style: italic; font-weight: 700; }
.warehouse { margin-top: 1.2mm; font-size: 8pt; font-weight: 700; }
.group { margin: 0 0 3.5mm; break-inside: auto; page-break-inside: auto; }
.group-title { padding: 0.9mm 1.2mm; background: #e8efed; border-top: 0.3mm solid #647571; border-bottom: 0.15mm solid #acb8b5; font-size: 7.4pt; font-weight: 700; break-after: avoid; page-break-after: avoid; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
thead { display: table-header-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
th { padding: 0.7mm 0.55mm; border-bottom: 0.2mm solid #555; font-size: 6.2pt; line-height: 1.05; text-align: right; vertical-align: bottom; }
th.text { text-align: left; }
th.dish { width: 34%; }
th:not(.dish) { width: 11%; }
td { padding: 0.65mm 0.55mm; border-bottom: 0.1mm dotted #c8cecc; font-size: 6.6pt; }
td.text { text-align: left; overflow-wrap: anywhere; }
td.number { text-align: right; white-space: nowrap; }
tfoot td { border-top: 0.2mm solid #555; border-bottom: 0; background: #f3f6f5; font-weight: 700; }
.total-label { font-weight: 700; }
.grand-total { display: flex; justify-content: flex-end; gap: 8mm; margin-top: 4mm; padding-top: 1.5mm; border-top: 0.35mm solid #333; }
.grand-total > div { display: flex; gap: 3mm; }
</style>
</head>
<body>
<div class="header">
  <h1>${escapeHtml(fullTitle)}</h1>
  <div class="warehouse">${escapeHtml(t("RashodDish.Warehouse", "Склад"))}: ${escapeHtml(departmentName || "")}</div>
</div>
${contentHtml}
</body>
</html>`;
}

function printRashodDishReport(options) {
  const printWindow = window.open(
    "",
    "_blank",
    "width=1200,height=900"
  );

  if (!printWindow) {
    window.alert(
      options.t(
        "Reports.PrintPopupBlocked",
        "Браузер заблокировал окно печати. Разрешите всплывающие окна для Web Office."
      )
    );
    return;
  }

  printWindow.document.open();
  printWindow.document.write(
    buildRashodDishPrintHtml(options)
  );
  printWindow.document.close();
  printWindow.focus();
  closePrintWindowAfterPrint(printWindow);

  window.setTimeout(() => {
    printWindow.print();
  }, 150);
}

function safeRashodDishFilePart(value) {
  return String(value ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

function buildRashodDishExportModel({
  rows,
  variant,
  dateFrom,
  dateTo,
  departmentName,
  locale,
  t
}) {
  const title =
    variant === "rating"
      ? t(
          "RashodDish.RatingTitle",
          "Рейтинг продаж блюд"
        )
      : variant === "ceh"
        ? t(
            "RashodDish.CehTitle",
            "Расход блюд по цехам"
          )
        : variant === "typdish"
          ? t(
              "RashodDish.TypeTitle",
              "Расход блюд по типам"
            )
          : variant === "hh"
            ? t(
                "RashodDish.HappyHoursTitle",
                "Продажи счастливых часов"
              )
            : t(
                "RashodDish.Title",
                "Расход блюд за период"
              );

  const exportRows = [];

  if (variant === "rating") {
    for (
      const row of sortRashodDishByRating(rows)
    ) {
      exportRows.push({
        Group: "",
        Dish: row?.NameDish || "",
        Quantity: row?.Realiz ?? "",
        Amount: row?.Summ ?? "",
        CostAmount: row?.SummSeb ?? "",
        Rate: row?.Rate ?? "",
        Price: row?.Price ?? "",
        Cost: row?.Sebest ?? ""
      });
    }
  } else {
    const groupField =
      variant === "ceh"
        ? "Ceh"
        : variant === "typdish"
          ? "TypDish"
          : "Groups";

    for (
      const group of groupRashodDishRows(
        rows,
        groupField
      )
    ) {
      for (const row of group.rows) {
        exportRows.push({
          Group: group.name,
          Dish: row?.NameDish || "",
          Quantity: row?.Realiz ?? "",
          Amount: row?.Summ ?? "",
          CostAmount: row?.SummSeb ?? "",
          Rate: row?.Rate ?? "",
          Price: row?.Price ?? "",
          Cost: row?.Sebest ?? ""
        });
      }

      const totals =
        rashodDishTotals(group.rows);

      exportRows.push({
        Group: group.name,
        Dish: t(
          "RashodDish.GroupTotal",
          "Итого"
        ),
        Quantity: "",
        Amount: totals.Summ,
        CostAmount: totals.SummSeb,
        Rate: "",
        Price: "",
        Cost: ""
      });
    }
  }

  const totals = rashodDishTotals(rows);

  return {
    title: `${title} ${formatReportDate(
      dateFrom
    )} — ${formatReportDate(dateTo)}`,
    fileName: `RashodDish_${
      variant === "rating"
        ? "Rating"
        : variant === "ceh"
          ? "Ceh"
          : variant === "typdish"
            ? "TypDish"
            : variant === "hh"
              ? "HappyHours"
              : "Groups"
    }_${safeRashodDishFilePart(
      dateFrom
    )}_${safeRashodDishFilePart(
      dateTo
    )}_${safeRashodDishFilePart(
      departmentName || "warehouse"
    )}`,
    orientation: "portrait",
    locale,
    meta: [
      {
        label: t(
          "RashodDish.Warehouse",
          "Склад"
        ),
        value: departmentName || ""
      }
    ],
    columns: [
      ...(variant === "rating"
        ? []
        : [
            {
              key: "Group",
              title:
                variant === "ceh"
                  ? t(
                      "RashodDish.Ceh",
                      "Цех"
                    )
                  : variant === "typdish"
                    ? t(
                        "RashodDish.TypeDish",
                        "Тип блюда"
                      )
                    : t(
                        "RashodDish.Group",
                        "Группа"
                      ),
              type: "text",
              width: 22
            }
          ]),
      {
        key: "Dish",
        title: t(
          "RashodDish.Dish",
          "Блюдо"
        ),
        type: "text",
        width: 30
      },
      {
        key: "Quantity",
        title: t(
          "RashodDish.Quantity",
          "Количество"
        ),
        type: "number",
        decimals: 2,
        width: 13
      },
      {
        key: "Amount",
        title: t(
          "RashodDish.Amount",
          "Сумма"
        ),
        type: "number",
        decimals: 2,
        width: 14
      },
      {
        key: "CostAmount",
        title: t(
          "RashodDish.CostAmount",
          "Себестоимость, сумма"
        ),
        type: "number",
        decimals: 2,
        width: 16
      },
      {
        key: "Rate",
        title: t(
          "RashodDish.Rate",
          "Rate"
        ),
        type: "number",
        decimals: 2,
        width: 12
      },
      {
        key: "Price",
        title: t(
          "RashodDish.Price",
          "Цена"
        ),
        type: "number",
        decimals: 2,
        width: 13
      },
      {
        key: "Cost",
        title: t(
          "RashodDish.Cost",
          "Себестоимость"
        ),
        type: "number",
        decimals: 2,
        width: 14
      }
    ],
    rows: exportRows,
    footerRows:
      variant === "rating"
        ? []
        : [
            {
              label: t(
                "Common.Total",
                "Итого"
              ),
              values: {
                Amount: totals.Summ,
                CostAmount: totals.SummSeb
              }
            }
          ]
  };
}

function RashodDishReport({
  data,
  variant,
  dateFrom,
  dateTo,
  departmentName,
  locale,
  fetchWithAuth,
  t,
  onReload
}) {
  const rows = getRashodDishRows(data);
  const formatter =
    createMoneyFormatter(locale);

  const title =
    variant === "rating"
      ? t(
          "RashodDish.RatingTitle",
          "Рейтинг продаж блюд"
        )
      : variant === "ceh"
        ? t(
            "RashodDish.CehTitle",
            "Расход блюд по цехам"
          )
        : variant === "typdish"
          ? t(
              "RashodDish.TypeTitle",
              "Расход блюд по типам"
            )
          : variant === "hh"
            ? t(
                "RashodDish.HappyHoursTitle",
                "Продажи счастливых часов"
              )
            : t(
                "RashodDish.Title",
                "Расход блюд за период"
              );

  const commonOptions = {
    rows,
    variant,
    dateFrom,
    dateTo,
    departmentName,
    locale,
    t
  };

  async function handleExport(format) {
    try {
      await exportReportFile({
        fetchWithAuth,
        reportModel:
          buildRashodDishExportModel(
            commonOptions
          ),
        format,
        errorMessage: t(
          "Report.ExportError",
          "Ошибка экспорта отчёта."
        )
      });
    } catch (err) {
      window.alert(
        err?.message ||
          t(
            "Report.ExportError",
            "Ошибка экспорта отчёта."
          )
      );
    }
  }

  return (
    <div className="reports-page rashoddish-report-page">
      <div className="report-toolbar">
        <button
          type="button"
          className="report-run-button"
          onClick={onReload}
        >
          {t(
            "Common.Generate",
            "Сформировать"
          )}
        </button>

        <button
          type="button"
          className="report-action-button report-print-button"
          onClick={() =>
            printRashodDishReport(
              commonOptions
            )
          }
        >
          {t("Common.Print", "Печать")}
        </button>

        <button
          type="button"
          className="report-action-button report-excel-button"
          onClick={() =>
            handleExport("xlsx")
          }
        >
          {t("Common.Excel", "Excel")}
        </button>

        <button
          type="button"
          className="report-action-button report-word-button"
          onClick={() =>
            handleExport("docx")
          }
        >
          {t("Common.Word", "Word")}
        </button>
      </div>

      <article className="revenue-report-sheet rashoddish-report-sheet">
        <header className="rashoddish-report-heading">
          <h3>
            {title}{" "}
            {t("Common.From", "с")}{" "}
            {formatReportDate(dateFrom)}{" "}
            {t("Common.To", "по")}{" "}
            {formatReportDate(dateTo)}
          </h3>

          <div className="rashoddish-warehouse">
            {t(
              "RashodDish.Warehouse",
              "Склад"
            )}:{" "}
            <strong>
              {departmentName || ""}
            </strong>
          </div>
        </header>

        {rows.length > 0 ? (
          variant === "rating" ? (
            <RashodDishRatingTable
              rows={rows}
              formatter={formatter}
              t={t}
            />
          ) : (
            <RashodDishGroupedTable
              rows={rows}
              groupField={
                variant === "ceh"
                  ? "Ceh"
                  : variant === "typdish"
                    ? "TypDish"
                    : "Groups"
              }
              formatter={formatter}
              t={t}
            />
          )
        ) : (
          <div className="report-empty">
            {t(
              "Reports.NoDataForPeriod",
              "За выбранный период данных нет."
            )}
          </div>
        )}
      </article>
    </div>
  );
}


function getAbcRows(data) {
  const payload = data?.data ?? data?.Data ?? data;

  if (Array.isArray(payload)) {
    return payload;
  }

  return normalizeRows(
    payload?.Main ??
    payload?.main ??
    payload?.Rows ??
    payload?.rows ??
    payload?.ABC ??
    payload?.abc
  );
}

function groupAbcRows(rows) {
  const groupsByName = new Map();

  for (const row of rows) {
    const name =
      String(row?.GrupABC ?? "").trim() ||
      "—";

    if (!groupsByName.has(name)) {
      groupsByName.set(name, []);
    }

    groupsByName.get(name).push(row);
  }

  const order = new Map([
    ["A", 0],
    ["B", 1],
    ["C", 2]
  ]);

  return [...groupsByName.entries()]
    .sort(([left], [right]) => {
      const leftOrder =
        order.has(left)
          ? order.get(left)
          : 100;
      const rightOrder =
        order.has(right)
          ? order.get(right)
          : 100;

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return left.localeCompare(
        right,
        undefined,
        { sensitivity: "base" }
      );
    })
    .map(([name, groupRows]) => ({
      name,
      rows: groupRows
    }));
}

function abcTotals(rows) {
  return {
    Kolvo: sumField(rows, "Kolvo"),
    Summ: sumField(rows, "Summ"),
    Sebest: sumField(rows, "Sebest"),
    Dohod: sumField(rows, "Dohod")
  };
}

function AbcReportTable({
  rows,
  formatter,
  t
}) {
  const groups = groupAbcRows(rows);
  const grandTotals = abcTotals(rows);

  return (
    <div className="abc-groups">
      {groups.map((group) => {
        const totals = abcTotals(group.rows);

        return (
          <section
            className="abc-group"
            key={group.name}
          >
            <div className="abc-group-title">
              {t(
                "ABC.GroupPrefix",
                "Группа"
              )}{" "}
              {group.name}
            </div>

            <div className="report-table-scroll">
              <table className="report-table abc-table">
                <thead>
                  <tr>
                    <th className="report-text">
                      {t(
                        "ABC.Dish",
                        "Блюдо"
                      )}
                    </th>
                    <th className="report-money">
                      {t(
                        "ABC.Quantity",
                        "Количество"
                      )}
                    </th>
                    <th className="report-money">
                      {t(
                        "ABC.Amount",
                        "Сумма"
                      )}
                    </th>
                    <th className="report-money">
                      {t(
                        "ABC.Cost",
                        "Себестоимость"
                      )}
                    </th>
                    <th className="report-money">
                      {t(
                        "ABC.Rate",
                        "Rate"
                      )}
                    </th>
                    <th className="report-money">
                      {t(
                        "ABC.Income",
                        "Доход"
                      )}
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {group.rows.map((row, index) => (
                    <tr
                      key={`${row?.NameDish ?? "dish"}-${index}`}
                    >
                      <td className="report-text">
                        {row?.NameDish || "—"}
                      </td>
                      <td className="report-money">
                        {formatter.format(
                          numericValue(row?.Kolvo)
                        )}
                      </td>
                      <td className="report-money">
                        {formatter.format(
                          numericValue(row?.Summ)
                        )}
                      </td>
                      <td className="report-money">
                        {formatter.format(
                          numericValue(row?.Sebest)
                        )}
                      </td>
                      <td className="report-money">
                        {formatter.format(
                          numericValue(row?.Rate)
                        )}
                      </td>
                      <td className="report-money">
                        {formatter.format(
                          numericValue(row?.Dohod)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>

                <tfoot>
                  <tr>
                    <td className="report-text report-total-label">
                      {t(
                        "ABC.GroupTotal",
                        "Итого"
                      )}
                    </td>
                    <td className="report-money">
                      {formatter.format(
                        totals.Kolvo
                      )}
                    </td>
                    <td className="report-money">
                      {formatter.format(
                        totals.Summ
                      )}
                    </td>
                    <td className="report-money">
                      {formatter.format(
                        totals.Sebest
                      )}
                    </td>
                    <td />
                    <td className="report-money">
                      {formatter.format(
                        totals.Dohod
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        );
      })}

      {groups.length > 0 && (
        <div className="abc-grand-total">
          <div>
            <span>
              {t(
                "ABC.Quantity",
                "Количество"
              )}
            </span>
            <strong>
              {formatter.format(
                grandTotals.Kolvo
              )}
            </strong>
          </div>
          <div>
            <span>
              {t(
                "ABC.Amount",
                "Сумма"
              )}
            </span>
            <strong>
              {formatter.format(
                grandTotals.Summ
              )}
            </strong>
          </div>
          <div>
            <span>
              {t(
                "ABC.Cost",
                "Себестоимость"
              )}
            </span>
            <strong>
              {formatter.format(
                grandTotals.Sebest
              )}
            </strong>
          </div>
          <div>
            <span>
              {t(
                "ABC.Income",
                "Доход"
              )}
            </span>
            <strong>
              {formatter.format(
                grandTotals.Dohod
              )}
            </strong>
          </div>
        </div>
      )}
    </div>
  );
}

function buildAbcPrintHtml({
  rows,
  dateFrom,
  dateTo,
  departmentName,
  locale,
  t
}) {
  const formatter =
    createMoneyFormatter(locale);
  const groups = groupAbcRows(rows);
  const grandTotals = abcTotals(rows);

  const groupsHtml = groups
    .map((group) => {
      const totals = abcTotals(group.rows);

      const body = group.rows
        .map(
          (row) => `<tr>
<td class="text">${escapeHtml(row?.NameDish || "—")}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.Kolvo)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.Summ)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.Sebest)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.Rate)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.Dohod)))}</td>
</tr>`
        )
        .join("");

      return `<section class="group">
<div class="group-title">${escapeHtml(t("ABC.GroupPrefix", "Группа"))} ${escapeHtml(group.name)}</div>
<table>
<thead><tr>
<th class="text dish">${escapeHtml(t("ABC.Dish", "Блюдо"))}</th>
<th>${escapeHtml(t("ABC.Quantity", "Количество"))}</th>
<th>${escapeHtml(t("ABC.Amount", "Сумма"))}</th>
<th>${escapeHtml(t("ABC.Cost", "Себестоимость"))}</th>
<th>${escapeHtml(t("ABC.Rate", "Rate"))}</th>
<th>${escapeHtml(t("ABC.Income", "Доход"))}</th>
</tr></thead>
<tbody>${body}</tbody>
<tfoot><tr>
<td class="text total-label">${escapeHtml(t("ABC.GroupTotal", "Итого"))}</td>
<td class="number">${escapeHtml(formatter.format(totals.Kolvo))}</td>
<td class="number">${escapeHtml(formatter.format(totals.Summ))}</td>
<td class="number">${escapeHtml(formatter.format(totals.Sebest))}</td>
<td></td>
<td class="number">${escapeHtml(formatter.format(totals.Dohod))}</td>
</tr></tfoot>
</table>
</section>`;
    })
    .join("");

  const title = `${t(
    "ABC.Title",
    "\"ABC\" анализ (80/95/100)"
  )} ${t(
    "Common.From",
    "с"
  )} ${formatReportDate(dateFrom)} ${t(
    "Common.To",
    "по"
  )} ${formatReportDate(dateTo)}`;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
@page { size: A4 portrait; margin: 8mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; color: #111; font-size: 7.6pt; }
.header { margin-bottom: 4mm; }
h1 { margin: 0; font-size: 11.5pt; font-style: italic; font-weight: 700; }
.warehouse { margin-top: 1.2mm; font-size: 8pt; font-weight: 700; }
.group { margin: 0 0 3.5mm; break-inside: auto; page-break-inside: auto; }
.group-title { padding: 0.9mm 1.2mm; background: #e8efed; border-top: 0.3mm solid #647571; border-bottom: 0.15mm solid #acb8b5; font-size: 7.5pt; font-weight: 700; break-after: avoid; page-break-after: avoid; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
thead { display: table-header-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
th { padding: 0.7mm 0.5mm; border-bottom: 0.2mm solid #555; font-size: 6.1pt; text-align: right; vertical-align: bottom; }
th.text { text-align: left; }
th.dish { width: 36%; }
th:not(.dish) { width: 12.8%; }
td { padding: 0.65mm 0.5mm; border-bottom: 0.1mm dotted #c8cecc; font-size: 6.6pt; }
td.text { text-align: left; overflow-wrap: anywhere; }
td.number { text-align: right; white-space: nowrap; }
tfoot td { border-top: 0.2mm solid #555; border-bottom: 0; background: #f3f6f5; font-weight: 700; }
.total-label { font-weight: 700; }
.grand-total { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 3mm 7mm; margin-top: 4mm; padding-top: 1.5mm; border-top: 0.35mm solid #333; }
.grand-total > div { display: flex; gap: 2mm; }
</style>
</head>
<body>
<div class="header">
  <h1>${escapeHtml(title)}</h1>
  <div class="warehouse">${escapeHtml(t("ABC.Warehouse", "Склад"))}: ${escapeHtml(departmentName || "")}</div>
</div>
${groupsHtml}
${groups.length > 0 ? `<div class="grand-total">
<div><span>${escapeHtml(t("ABC.Quantity", "Количество"))}</span><strong>${escapeHtml(formatter.format(grandTotals.Kolvo))}</strong></div>
<div><span>${escapeHtml(t("ABC.Amount", "Сумма"))}</span><strong>${escapeHtml(formatter.format(grandTotals.Summ))}</strong></div>
<div><span>${escapeHtml(t("ABC.Cost", "Себестоимость"))}</span><strong>${escapeHtml(formatter.format(grandTotals.Sebest))}</strong></div>
<div><span>${escapeHtml(t("ABC.Income", "Доход"))}</span><strong>${escapeHtml(formatter.format(grandTotals.Dohod))}</strong></div>
</div>` : ""}
</body>
</html>`;
}

function printAbcReport(options) {
  const printWindow = window.open(
    "",
    "_blank",
    "width=1100,height=900"
  );

  if (!printWindow) {
    window.alert(
      options.t(
        "Reports.PrintPopupBlocked",
        "Браузер заблокировал окно печати. Разрешите всплывающие окна для Web Office."
      )
    );
    return;
  }

  printWindow.document.open();
  printWindow.document.write(
    buildAbcPrintHtml(options)
  );
  printWindow.document.close();
  printWindow.focus();
  closePrintWindowAfterPrint(printWindow);

  window.setTimeout(() => {
    printWindow.print();
  }, 150);
}

function safeAbcFilePart(value) {
  return String(value ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

function buildAbcExportModel({
  rows,
  dateFrom,
  dateTo,
  departmentName,
  locale,
  t
}) {
  const exportRows = [];

  for (const group of groupAbcRows(rows)) {
    for (const row of group.rows) {
      exportRows.push({
        Group: `${t(
          "ABC.GroupPrefix",
          "Группа"
        )} ${group.name}`,
        Dish: row?.NameDish || "",
        Quantity: row?.Kolvo ?? "",
        Amount: row?.Summ ?? "",
        Cost: row?.Sebest ?? "",
        Rate: row?.Rate ?? "",
        Income: row?.Dohod ?? ""
      });
    }

    const totals = abcTotals(group.rows);

    exportRows.push({
      Group: `${t(
        "ABC.GroupPrefix",
        "Группа"
      )} ${group.name}`,
      Dish: t(
        "ABC.GroupTotal",
        "Итого"
      ),
      Quantity: totals.Kolvo,
      Amount: totals.Summ,
      Cost: totals.Sebest,
      Rate: "",
      Income: totals.Dohod
    });
  }

  const totals = abcTotals(rows);

  return {
    title: `${t(
      "ABC.Title",
      "\"ABC\" анализ (80/95/100)"
    )} ${formatReportDate(
      dateFrom
    )} — ${formatReportDate(dateTo)}`,
    fileName: `ABC_${safeAbcFilePart(
      dateFrom
    )}_${safeAbcFilePart(
      dateTo
    )}_${safeAbcFilePart(
      departmentName || "warehouse"
    )}`,
    orientation: "portrait",
    locale,
    meta: [
      {
        label: t(
          "ABC.Warehouse",
          "Склад"
        ),
        value: departmentName || ""
      }
    ],
    columns: [
      {
        key: "Group",
        title: t(
          "ABC.Group",
          "Группа ABC"
        ),
        type: "text",
        width: 18
      },
      {
        key: "Dish",
        title: t(
          "ABC.Dish",
          "Блюдо"
        ),
        type: "text",
        width: 30
      },
      {
        key: "Quantity",
        title: t(
          "ABC.Quantity",
          "Количество"
        ),
        type: "number",
        decimals: 2,
        width: 13
      },
      {
        key: "Amount",
        title: t(
          "ABC.Amount",
          "Сумма"
        ),
        type: "number",
        decimals: 2,
        width: 14
      },
      {
        key: "Cost",
        title: t(
          "ABC.Cost",
          "Себестоимость"
        ),
        type: "number",
        decimals: 2,
        width: 14
      },
      {
        key: "Rate",
        title: t(
          "ABC.Rate",
          "Rate"
        ),
        type: "number",
        decimals: 2,
        width: 11
      },
      {
        key: "Income",
        title: t(
          "ABC.Income",
          "Доход"
        ),
        type: "number",
        decimals: 2,
        width: 14
      }
    ],
    rows: exportRows,
    footerRows: [
      {
        label: t(
          "Common.Total",
          "Итого"
        ),
        values: {
          Quantity: totals.Kolvo,
          Amount: totals.Summ,
          Cost: totals.Sebest,
          Income: totals.Dohod
        }
      }
    ]
  };
}

function AbcReport({
  data,
  dateFrom,
  dateTo,
  departmentName,
  locale,
  fetchWithAuth,
  t,
  onReload
}) {
  const rows = getAbcRows(data);
  const formatter =
    createMoneyFormatter(locale);

  const commonOptions = {
    rows,
    dateFrom,
    dateTo,
    departmentName,
    locale,
    t
  };

  async function handleExport(format) {
    try {
      await exportReportFile({
        fetchWithAuth,
        reportModel:
          buildAbcExportModel(
            commonOptions
          ),
        format,
        errorMessage: t(
          "Report.ExportError",
          "Ошибка экспорта отчёта."
        )
      });
    } catch (err) {
      window.alert(
        err?.message ||
          t(
            "Report.ExportError",
            "Ошибка экспорта отчёта."
          )
      );
    }
  }

  return (
    <div className="reports-page abc-report-page">
      <div className="report-toolbar">
        <button
          type="button"
          className="report-run-button"
          onClick={onReload}
        >
          {t(
            "Common.Generate",
            "Сформировать"
          )}
        </button>

        <button
          type="button"
          className="report-action-button report-print-button"
          onClick={() =>
            printAbcReport(
              commonOptions
            )
          }
        >
          {t("Common.Print", "Печать")}
        </button>

        <button
          type="button"
          className="report-action-button report-excel-button"
          onClick={() =>
            handleExport("xlsx")
          }
        >
          {t("Common.Excel", "Excel")}
        </button>

        <button
          type="button"
          className="report-action-button report-word-button"
          onClick={() =>
            handleExport("docx")
          }
        >
          {t("Common.Word", "Word")}
        </button>
      </div>

      <article className="revenue-report-sheet abc-report-sheet">
        <header className="abc-report-heading">
          <h3>
            {t(
              "ABC.Title",
              "\"ABC\" анализ (80/95/100)"
            )}{" "}
            {t("Common.From", "с")}{" "}
            {formatReportDate(dateFrom)}{" "}
            {t("Common.To", "по")}{" "}
            {formatReportDate(dateTo)}
          </h3>

          <div className="abc-warehouse">
            {t(
              "ABC.Warehouse",
              "Склад"
            )}:{" "}
            <strong>
              {departmentName || ""}
            </strong>
          </div>
        </header>

        {rows.length > 0 ? (
          <AbcReportTable
            rows={rows}
            formatter={formatter}
            t={t}
          />
        ) : (
          <div className="report-empty">
            {t(
              "Reports.NoDataForPeriod",
              "За выбранный период данных нет."
            )}
          </div>
        )}
      </article>
    </div>
  );
}


function getPrihodTovRows(data) {
  const payload = data?.data ?? data?.Data ?? data;

  if (Array.isArray(payload)) {
    return payload;
  }

  return normalizeRows(
    payload?.Main ??
    payload?.main ??
    payload?.Rows ??
    payload?.rows ??
    payload?.PrihodTov ??
    payload?.prihodTov ??
    payload?.prihodtov
  );
}

function sortPrihodTovRows(rows) {
  return [...rows].sort((left, right) =>
    String(left?.NameTov ?? "").localeCompare(
      String(right?.NameTov ?? ""),
      undefined,
      { sensitivity: "base" }
    )
  );
}

function prihodTovDisplayValue(
  value,
  formatter
) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    numericValue(value) === 0
  ) {
    return "";
  }

  return formatter.format(
    numericValue(value)
  );
}

function prihodTovSupplierPrice(row) {
  const quantity = numericValue(
    row?.Postup
  );

  if (quantity === 0) {
    return 0;
  }

  return (
    numericValue(row?.PostupSumm) /
    quantity
  );
}

function prihodTovTotals(rows) {
  return {
    Postup: sumField(rows, "Postup"),
    PostupSumm: sumField(
      rows,
      "PostupSumm"
    ),
    Perem: sumField(rows, "Perem"),
    PeremSumm: sumField(
      rows,
      "PeremSumm"
    )
  };
}

function PrihodTovReportTable({
  rows,
  formatter,
  t
}) {
  const sortedRows =
    sortPrihodTovRows(rows);
  const totals =
    prihodTovTotals(rows);

  return (
    <div className="report-table-scroll prihodtov-table-scroll">
      <table className="report-table prihodtov-table">
        <thead>
          <tr>
            <th
              rowSpan="2"
              className="report-text prihodtov-name-head"
            >
              {t(
                "PrihodTov.Product",
                "Наименование"
              )}
            </th>
            <th
              colSpan="3"
              className="report-center prihodtov-section-head"
            >
              {t(
                "PrihodTov.SupplierReceipt",
                "Приход от поставщиков"
              )}
            </th>
            <th
              colSpan="3"
              className="report-center prihodtov-section-head"
            >
              {t(
                "PrihodTov.Transfer",
                "Перемещение"
              )}
            </th>
          </tr>

          <tr>
            <th className="report-money">
              {t(
                "PrihodTov.Quantity",
                "Кол-во"
              )}
            </th>
            <th className="report-money">
              {t(
                "PrihodTov.Price",
                "Цена"
              )}
            </th>
            <th className="report-money">
              {t(
                "PrihodTov.Amount",
                "Сумма"
              )}
            </th>
            <th className="report-money">
              {t(
                "PrihodTov.Quantity",
                "Кол-во"
              )}
            </th>
            <th className="report-money">
              {t(
                "PrihodTov.Price",
                "Цена"
              )}
            </th>
            <th className="report-money">
              {t(
                "PrihodTov.Amount",
                "Сумма"
              )}
            </th>
          </tr>
        </thead>

        <tbody>
          {sortedRows.map((row, index) => (
            <tr
              key={`${row?.NameTov ?? "item"}-${index}`}
            >
              <td className="report-text">
                {row?.NameTov || "—"}
              </td>
              <td className="report-money">
                {prihodTovDisplayValue(
                  row?.Postup,
                  formatter
                )}
              </td>
              <td className="report-money">
                {prihodTovDisplayValue(
                  prihodTovSupplierPrice(row),
                  formatter
                )}
              </td>
              <td className="report-money">
                {prihodTovDisplayValue(
                  row?.PostupSumm,
                  formatter
                )}
              </td>
              <td className="report-money">
                {prihodTovDisplayValue(
                  row?.Perem,
                  formatter
                )}
              </td>
              <td className="report-money">
                {prihodTovDisplayValue(
                  row?.SrkPer,
                  formatter
                )}
              </td>
              <td className="report-money">
                {prihodTovDisplayValue(
                  row?.PeremSumm,
                  formatter
                )}
              </td>
            </tr>
          ))}
        </tbody>

        {sortedRows.length > 0 && (
          <tfoot>
            <tr>
              <td className="report-text report-total-label">
                {t(
                  "Common.Total",
                  "Итого"
                )}
              </td>
              <td className="report-money">
                {prihodTovDisplayValue(
                  totals.Postup,
                  formatter
                )}
              </td>
              <td />
              <td className="report-money">
                {prihodTovDisplayValue(
                  totals.PostupSumm,
                  formatter
                )}
              </td>
              <td className="report-money">
                {prihodTovDisplayValue(
                  totals.Perem,
                  formatter
                )}
              </td>
              <td />
              <td className="report-money">
                {prihodTovDisplayValue(
                  totals.PeremSumm,
                  formatter
                )}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function buildPrihodTovPrintHtml({
  rows,
  dateFrom,
  dateTo,
  departmentName,
  locale,
  t
}) {
  const formatter =
    createMoneyFormatter(locale);
  const sortedRows =
    sortPrihodTovRows(rows);
  const totals =
    prihodTovTotals(rows);

  const body = sortedRows
    .map(
      (row) => `<tr>
<td class="text">${escapeHtml(row?.NameTov || "—")}</td>
<td class="number">${escapeHtml(prihodTovDisplayValue(row?.Postup, formatter))}</td>
<td class="number">${escapeHtml(prihodTovDisplayValue(prihodTovSupplierPrice(row), formatter))}</td>
<td class="number">${escapeHtml(prihodTovDisplayValue(row?.PostupSumm, formatter))}</td>
<td class="number">${escapeHtml(prihodTovDisplayValue(row?.Perem, formatter))}</td>
<td class="number">${escapeHtml(prihodTovDisplayValue(row?.SrkPer, formatter))}</td>
<td class="number">${escapeHtml(prihodTovDisplayValue(row?.PeremSumm, formatter))}</td>
</tr>`
    )
    .join("");

  const title = `${t(
    "PrihodTov.Title",
    "Приход сырья за период"
  )} ${t(
    "Common.From",
    "с"
  )} ${formatReportDate(dateFrom)} ${t(
    "Common.To",
    "по"
  )} ${formatReportDate(dateTo)}`;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
@page { size: A4 portrait; margin: 8mm 9mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; color: #111; font-size: 7.5pt; }
.header { display: flex; justify-content: space-between; align-items: flex-end; gap: 6mm; margin-bottom: 3.5mm; }
h1 { margin: 0; font-size: 11.5pt; font-style: italic; font-weight: 700; }
.warehouse { font-size: 8pt; font-weight: 700; white-space: nowrap; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
thead { display: table-header-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
th { padding: 0.55mm 0.45mm; border-bottom: 0.2mm solid #555; font-size: 6pt; line-height: 1.02; vertical-align: bottom; }
th.text { text-align: left; }
th.center { text-align: center; }
th.number { text-align: right; }
td { padding: 0.52mm 0.45mm; border-bottom: 0.1mm dotted #c8cecc; font-size: 6.5pt; }
td.text { text-align: left; overflow-wrap: anywhere; }
td.number { text-align: right; white-space: nowrap; }
th.name { width: 34%; }
th.metric { width: 11%; }
.section-head { border-left: 0.15mm solid #aaa; }
tfoot td { border-top: 0.2mm solid #555; border-bottom: 0; background: #f3f6f5; font-weight: 700; }
</style>
</head>
<body>
<div class="header">
  <h1>${escapeHtml(title)}</h1>
  <div class="warehouse">${escapeHtml(departmentName || "")}</div>
</div>
<table>
<thead>
<tr>
<th rowspan="2" class="text name">${escapeHtml(t("PrihodTov.Product", "Наименование"))}</th>
<th colspan="3" class="center section-head">${escapeHtml(t("PrihodTov.SupplierReceipt", "Приход от поставщиков"))}</th>
<th colspan="3" class="center section-head">${escapeHtml(t("PrihodTov.Transfer", "Перемещение"))}</th>
</tr>
<tr>
<th class="number metric">${escapeHtml(t("PrihodTov.Quantity", "Кол-во"))}</th>
<th class="number metric">${escapeHtml(t("PrihodTov.Price", "Цена"))}</th>
<th class="number metric">${escapeHtml(t("PrihodTov.Amount", "Сумма"))}</th>
<th class="number metric">${escapeHtml(t("PrihodTov.Quantity", "Кол-во"))}</th>
<th class="number metric">${escapeHtml(t("PrihodTov.Price", "Цена"))}</th>
<th class="number metric">${escapeHtml(t("PrihodTov.Amount", "Сумма"))}</th>
</tr>
</thead>
<tbody>${body}</tbody>
${sortedRows.length > 0 ? `<tfoot><tr>
<td class="text">${escapeHtml(t("Common.Total", "Итого"))}</td>
<td class="number">${escapeHtml(prihodTovDisplayValue(totals.Postup, formatter))}</td>
<td></td>
<td class="number">${escapeHtml(prihodTovDisplayValue(totals.PostupSumm, formatter))}</td>
<td class="number">${escapeHtml(prihodTovDisplayValue(totals.Perem, formatter))}</td>
<td></td>
<td class="number">${escapeHtml(prihodTovDisplayValue(totals.PeremSumm, formatter))}</td>
</tr></tfoot>` : ""}
</table>
</body>
</html>`;
}

function printPrihodTovReport(options) {
  const printWindow = window.open(
    "",
    "_blank",
    "width=1100,height=900"
  );

  if (!printWindow) {
    window.alert(
      options.t(
        "Reports.PrintPopupBlocked",
        "Браузер заблокировал окно печати. Разрешите всплывающие окна для Web Office."
      )
    );
    return;
  }

  printWindow.document.open();
  printWindow.document.write(
    buildPrihodTovPrintHtml(options)
  );
  printWindow.document.close();
  printWindow.focus();
  closePrintWindowAfterPrint(printWindow);

  window.setTimeout(() => {
    printWindow.print();
  }, 150);
}

function safePrihodTovFilePart(value) {
  return String(value ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

function buildPrihodTovExportModel({
  rows,
  dateFrom,
  dateTo,
  departmentName,
  locale,
  t
}) {
  const exportRows =
    sortPrihodTovRows(rows).map(
      (row) => ({
        Product: row?.NameTov || "",
        SupplierQuantity:
          numericValue(row?.Postup) === 0
            ? ""
            : row?.Postup,
        SupplierPrice:
          numericValue(row?.Postup) === 0
            ? ""
            : prihodTovSupplierPrice(row),
        SupplierAmount:
          numericValue(row?.PostupSumm) === 0
            ? ""
            : row?.PostupSumm,
        TransferQuantity:
          numericValue(row?.Perem) === 0
            ? ""
            : row?.Perem,
        TransferPrice:
          numericValue(row?.SrkPer) === 0
            ? ""
            : row?.SrkPer,
        TransferAmount:
          numericValue(row?.PeremSumm) === 0
            ? ""
            : row?.PeremSumm
      })
    );

  const totals =
    prihodTovTotals(rows);

  return {
    title: `${t(
      "PrihodTov.Title",
      "Приход сырья за период"
    )} ${formatReportDate(
      dateFrom
    )} — ${formatReportDate(dateTo)}`,
    fileName: `PrihodTov_${safePrihodTovFilePart(
      dateFrom
    )}_${safePrihodTovFilePart(
      dateTo
    )}_${safePrihodTovFilePart(
      departmentName || "warehouse"
    )}`,
    orientation: "portrait",
    locale,
    meta: [
      {
        label: t(
          "PrihodTov.Warehouse",
          "Склад"
        ),
        value: departmentName || ""
      }
    ],
    columns: [
      {
        key: "Product",
        title: t(
          "PrihodTov.Product",
          "Наименование"
        ),
        type: "text",
        width: 34
      },
      {
        key: "SupplierQuantity",
        title: `${t(
          "PrihodTov.SupplierReceipt",
          "Приход от поставщиков"
        )} — ${t(
          "PrihodTov.Quantity",
          "Кол-во"
        )}`,
        type: "number",
        decimals: 2,
        width: 13
      },
      {
        key: "SupplierPrice",
        title: `${t(
          "PrihodTov.SupplierReceipt",
          "Приход от поставщиков"
        )} — ${t(
          "PrihodTov.Price",
          "Цена"
        )}`,
        type: "number",
        decimals: 2,
        width: 13
      },
      {
        key: "SupplierAmount",
        title: `${t(
          "PrihodTov.SupplierReceipt",
          "Приход от поставщиков"
        )} — ${t(
          "PrihodTov.Amount",
          "Сумма"
        )}`,
        type: "number",
        decimals: 2,
        width: 14
      },
      {
        key: "TransferQuantity",
        title: `${t(
          "PrihodTov.Transfer",
          "Перемещение"
        )} — ${t(
          "PrihodTov.Quantity",
          "Кол-во"
        )}`,
        type: "number",
        decimals: 2,
        width: 13
      },
      {
        key: "TransferPrice",
        title: `${t(
          "PrihodTov.Transfer",
          "Перемещение"
        )} — ${t(
          "PrihodTov.Price",
          "Цена"
        )}`,
        type: "number",
        decimals: 2,
        width: 13
      },
      {
        key: "TransferAmount",
        title: `${t(
          "PrihodTov.Transfer",
          "Перемещение"
        )} — ${t(
          "PrihodTov.Amount",
          "Сумма"
        )}`,
        type: "number",
        decimals: 2,
        width: 14
      }
    ],
    rows: exportRows,
    footerRows: [
      {
        label: t(
          "Common.Total",
          "Итого"
        ),
        values: {
          SupplierQuantity:
            totals.Postup,
          SupplierAmount:
            totals.PostupSumm,
          TransferQuantity:
            totals.Perem,
          TransferAmount:
            totals.PeremSumm
        }
      }
    ]
  };
}

function PrihodTovReport({
  data,
  dateFrom,
  dateTo,
  departmentName,
  locale,
  fetchWithAuth,
  t,
  onReload
}) {
  const rows = getPrihodTovRows(data);
  const formatter =
    createMoneyFormatter(locale);

  const commonOptions = {
    rows,
    dateFrom,
    dateTo,
    departmentName,
    locale,
    t
  };

  async function handleExport(format) {
    try {
      await exportReportFile({
        fetchWithAuth,
        reportModel:
          buildPrihodTovExportModel(
            commonOptions
          ),
        format,
        errorMessage: t(
          "Report.ExportError",
          "Ошибка экспорта отчёта."
        )
      });
    } catch (err) {
      window.alert(
        err?.message ||
          t(
            "Report.ExportError",
            "Ошибка экспорта отчёта."
          )
      );
    }
  }

  return (
    <div className="reports-page prihodtov-report-page">
      <div className="report-toolbar">
        <button
          type="button"
          className="report-run-button"
          onClick={onReload}
        >
          {t(
            "Common.Generate",
            "Сформировать"
          )}
        </button>

        <button
          type="button"
          className="report-action-button report-print-button"
          onClick={() =>
            printPrihodTovReport(
              commonOptions
            )
          }
        >
          {t("Common.Print", "Печать")}
        </button>

        <button
          type="button"
          className="report-action-button report-excel-button"
          onClick={() =>
            handleExport("xlsx")
          }
        >
          {t("Common.Excel", "Excel")}
        </button>

        <button
          type="button"
          className="report-action-button report-word-button"
          onClick={() =>
            handleExport("docx")
          }
        >
          {t("Common.Word", "Word")}
        </button>
      </div>

      <article className="revenue-report-sheet prihodtov-report-sheet">
        <header className="prihodtov-report-heading">
          <h3>
            {t(
              "PrihodTov.Title",
              "Приход сырья за период"
            )}{" "}
            {t("Common.From", "с")}{" "}
            {formatReportDate(dateFrom)}{" "}
            {t("Common.To", "по")}{" "}
            {formatReportDate(dateTo)}
          </h3>

          <div className="prihodtov-warehouse">
            {departmentName || ""}
          </div>
        </header>

        {rows.length > 0 ? (
          <PrihodTovReportTable
            rows={rows}
            formatter={formatter}
            t={t}
          />
        ) : (
          <div className="report-empty">
            {t(
              "Reports.NoDataForPeriod",
              "За выбранный период данных нет."
            )}
          </div>
        )}
      </article>
    </div>
  );
}


function getPeremPerRows(data) {
  const payload = data?.data ?? data?.Data ?? data;

  if (Array.isArray(payload)) {
    return payload;
  }

  return normalizeRows(
    payload?.Main ??
    payload?.main ??
    payload?.Rows ??
    payload?.rows ??
    payload?.PeremPer ??
    payload?.peremPer ??
    payload?.peremper
  );
}

function sortPeremPerRows(rows) {
  return [...rows].sort((left, right) =>
    String(left?.NameTov ?? "").localeCompare(
      String(right?.NameTov ?? ""),
      undefined,
      { sensitivity: "base" }
    )
  );
}

function peremPerPrice(row) {
  const quantity = numericValue(row?.Kolvo);

  if (quantity === 0) {
    return 0;
  }

  return numericValue(row?.Summ) / quantity;
}

function peremPerTotals(rows) {
  return {
    Kolvo: sumField(rows, "Kolvo"),
    Summ: sumField(rows, "Summ")
  };
}

function peremPerDisplayValue(
  value,
  formatter
) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    numericValue(value) === 0
  ) {
    return "";
  }

  return formatter.format(
    numericValue(value)
  );
}

function PeremPerReportTable({
  rows,
  formatter,
  t
}) {
  const sortedRows = sortPeremPerRows(rows);
  const totals = peremPerTotals(rows);

  return (
    <div className="report-table-scroll peremper-table-scroll">
      <table className="report-table peremper-table">
        <thead>
          <tr>
            <th className="report-text">
              {t(
                "PeremPer.Product",
                "Наименование"
              )}
            </th>
            <th className="report-money">
              {t(
                "PeremPer.Quantity",
                "Количество"
              )}
            </th>
            <th className="report-money">
              {t(
                "PeremPer.Price",
                "Цена"
              )}
            </th>
            <th className="report-money">
              {t(
                "PeremPer.Amount",
                "Сумма"
              )}
            </th>
          </tr>
        </thead>

        <tbody>
          {sortedRows.map((row, index) => (
            <tr
              key={`${row?.NameTov ?? "item"}-${index}`}
            >
              <td className="report-text">
                {row?.NameTov || "—"}
              </td>
              <td className="report-money">
                {peremPerDisplayValue(
                  row?.Kolvo,
                  formatter
                )}
              </td>
              <td className="report-money">
                {peremPerDisplayValue(
                  peremPerPrice(row),
                  formatter
                )}
              </td>
              <td className="report-money">
                {peremPerDisplayValue(
                  row?.Summ,
                  formatter
                )}
              </td>
            </tr>
          ))}
        </tbody>

        {sortedRows.length > 0 && (
          <tfoot>
            <tr>
              <td className="report-text report-total-label">
                {t("Common.Total", "Итого")}
              </td>
              <td className="report-money">
                {peremPerDisplayValue(
                  totals.Kolvo,
                  formatter
                )}
              </td>
              <td />
              <td className="report-money">
                {peremPerDisplayValue(
                  totals.Summ,
                  formatter
                )}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function buildPeremPerPrintHtml({
  rows,
  dateFrom,
  dateTo,
  departmentName,
  locale,
  t
}) {
  const formatter =
    createMoneyFormatter(locale);
  const sortedRows =
    sortPeremPerRows(rows);
  const totals =
    peremPerTotals(rows);

  const body = sortedRows
    .map(
      (row) => `<tr>
<td class="text">${escapeHtml(row?.NameTov || "—")}</td>
<td class="number">${escapeHtml(peremPerDisplayValue(row?.Kolvo, formatter))}</td>
<td class="number">${escapeHtml(peremPerDisplayValue(peremPerPrice(row), formatter))}</td>
<td class="number">${escapeHtml(peremPerDisplayValue(row?.Summ, formatter))}</td>
</tr>`
    )
    .join("");

  const title = `${t(
    "PeremPer.Title",
    "Перемещено сырья"
  )} ${t(
    "Common.From",
    "с"
  )} ${formatReportDate(dateFrom)} ${t(
    "Common.To",
    "по"
  )} ${formatReportDate(dateTo)} ${t(
    "PeremPer.FromDepartment",
    "с подразделения"
  )} ${departmentName || ""}`;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
@page { size: A4 portrait; margin: 10mm 12mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; color: #111; font-size: 9pt; }
.header { margin-bottom: 5mm; }
h1 { margin: 0; font-size: 12.5pt; font-style: italic; font-weight: 700; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
thead { display: table-header-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
th { padding: 0.85mm 1mm; border-bottom: 0.3mm solid #555; font-size: 7.2pt; }
td { padding: 0.8mm 1mm; border-bottom: 0.15mm dotted #c7cecb; font-size: 7.8pt; }
.text { text-align: left; }
.number { text-align: right; white-space: nowrap; }
th:nth-child(1) { width: 55%; }
th:nth-child(2) { width: 15%; }
th:nth-child(3) { width: 15%; }
th:nth-child(4) { width: 15%; }
tfoot td { border-top: 0.3mm solid #555; border-bottom: 0; background: #f3f6f5; font-weight: 700; }
</style>
</head>
<body>
<div class="header">
  <h1>${escapeHtml(title)}</h1>
</div>
<table>
<thead><tr>
<th class="text">${escapeHtml(t("PeremPer.Product", "Наименование"))}</th>
<th class="number">${escapeHtml(t("PeremPer.Quantity", "Количество"))}</th>
<th class="number">${escapeHtml(t("PeremPer.Price", "Цена"))}</th>
<th class="number">${escapeHtml(t("PeremPer.Amount", "Сумма"))}</th>
</tr></thead>
<tbody>${body}</tbody>
${sortedRows.length > 0 ? `<tfoot><tr>
<td class="text">${escapeHtml(t("Common.Total", "Итого"))}</td>
<td class="number">${escapeHtml(peremPerDisplayValue(totals.Kolvo, formatter))}</td>
<td></td>
<td class="number">${escapeHtml(peremPerDisplayValue(totals.Summ, formatter))}</td>
</tr></tfoot>` : ""}
</table>
</body>
</html>`;
}

function printPeremPerReport(options) {
  const printWindow = window.open(
    "",
    "_blank",
    "width=1050,height=900"
  );

  if (!printWindow) {
    window.alert(
      options.t(
        "Reports.PrintPopupBlocked",
        "Браузер заблокировал окно печати. Разрешите всплывающие окна для Web Office."
      )
    );
    return;
  }

  printWindow.document.open();
  printWindow.document.write(
    buildPeremPerPrintHtml(options)
  );
  printWindow.document.close();
  printWindow.focus();
  closePrintWindowAfterPrint(printWindow);

  window.setTimeout(() => {
    printWindow.print();
  }, 150);
}

function safePeremPerFilePart(value) {
  return String(value ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

function buildPeremPerExportModel({
  rows,
  dateFrom,
  dateTo,
  departmentName,
  locale,
  t
}) {
  const exportRows =
    sortPeremPerRows(rows).map(
      (row) => ({
        Product: row?.NameTov || "",
        Quantity:
          numericValue(row?.Kolvo) === 0
            ? ""
            : row?.Kolvo,
        Price:
          numericValue(row?.Kolvo) === 0
            ? ""
            : peremPerPrice(row),
        Amount:
          numericValue(row?.Summ) === 0
            ? ""
            : row?.Summ
      })
    );

  const totals =
    peremPerTotals(rows);

  return {
    title: `${t(
      "PeremPer.Title",
      "Перемещено сырья"
    )} ${formatReportDate(
      dateFrom
    )} — ${formatReportDate(
      dateTo
    )} ${t(
      "PeremPer.FromDepartment",
      "с подразделения"
    )} ${departmentName || ""}`,
    fileName: `PeremPer_${safePeremPerFilePart(
      dateFrom
    )}_${safePeremPerFilePart(
      dateTo
    )}_${safePeremPerFilePart(
      departmentName || "department"
    )}`,
    orientation: "portrait",
    locale,
    meta: [],
    columns: [
      {
        key: "Product",
        title: t(
          "PeremPer.Product",
          "Наименование"
        ),
        type: "text",
        width: 40
      },
      {
        key: "Quantity",
        title: t(
          "PeremPer.Quantity",
          "Количество"
        ),
        type: "number",
        decimals: 2,
        width: 14
      },
      {
        key: "Price",
        title: t(
          "PeremPer.Price",
          "Цена"
        ),
        type: "number",
        decimals: 2,
        width: 14
      },
      {
        key: "Amount",
        title: t(
          "PeremPer.Amount",
          "Сумма"
        ),
        type: "number",
        decimals: 2,
        width: 15
      }
    ],
    rows: exportRows,
    footerRows: [
      {
        label: t(
          "Common.Total",
          "Итого"
        ),
        values: {
          Quantity: totals.Kolvo,
          Amount: totals.Summ
        }
      }
    ]
  };
}

function PeremPerReport({
  data,
  dateFrom,
  dateTo,
  departmentName,
  locale,
  fetchWithAuth,
  t,
  onReload
}) {
  const rows = getPeremPerRows(data);
  const formatter =
    createMoneyFormatter(locale);

  const commonOptions = {
    rows,
    dateFrom,
    dateTo,
    departmentName,
    locale,
    t
  };

  async function handleExport(format) {
    try {
      await exportReportFile({
        fetchWithAuth,
        reportModel:
          buildPeremPerExportModel(
            commonOptions
          ),
        format,
        errorMessage: t(
          "Report.ExportError",
          "Ошибка экспорта отчёта."
        )
      });
    } catch (err) {
      window.alert(
        err?.message ||
          t(
            "Report.ExportError",
            "Ошибка экспорта отчёта."
          )
      );
    }
  }

  const title = `${t(
    "PeremPer.Title",
    "Перемещено сырья"
  )} ${t(
    "Common.From",
    "с"
  )} ${formatReportDate(dateFrom)} ${t(
    "Common.To",
    "по"
  )} ${formatReportDate(dateTo)} ${t(
    "PeremPer.FromDepartment",
    "с подразделения"
  )} ${departmentName || ""}`;

  return (
    <div className="reports-page peremper-report-page">
      <div className="report-toolbar">
        <button
          type="button"
          className="report-run-button"
          onClick={onReload}
        >
          {t(
            "Common.Generate",
            "Сформировать"
          )}
        </button>

        <button
          type="button"
          className="report-action-button report-print-button"
          onClick={() =>
            printPeremPerReport(
              commonOptions
            )
          }
        >
          {t("Common.Print", "Печать")}
        </button>

        <button
          type="button"
          className="report-action-button report-excel-button"
          onClick={() =>
            handleExport("xlsx")
          }
        >
          {t("Common.Excel", "Excel")}
        </button>

        <button
          type="button"
          className="report-action-button report-word-button"
          onClick={() =>
            handleExport("docx")
          }
        >
          {t("Common.Word", "Word")}
        </button>
      </div>

      <article className="revenue-report-sheet peremper-report-sheet">
        <header className="peremper-report-heading">
          <h3>{title}</h3>
        </header>

        {rows.length > 0 ? (
          <PeremPerReportTable
            rows={rows}
            formatter={formatter}
            t={t}
          />
        ) : (
          <div className="report-empty">
            {t(
              "Reports.NoDataForPeriod",
              "За выбранный период данных нет."
            )}
          </div>
        )}
      </article>
    </div>
  );
}


function getRashodOfRows(data) {
  const payload = data?.data ?? data?.Data ?? data;
  if (Array.isArray(payload)) return payload;
  return normalizeRows(
    payload?.Main ?? payload?.main ?? payload?.Rows ?? payload?.rows ??
    payload?.RashodOf ?? payload?.rashodOf ?? payload?.rashodof
  );
}

function normalizeRashodOfId(value) {
  return String(value ?? "").trim();
}

function buildRashodOfOptions(rows, idField, nameField) {
  const map = new Map();
  for (const row of rows) {
    const id = normalizeRashodOfId(row?.[idField]);
    const name = String(row?.[nameField] ?? "").trim();
    if (id && name && !map.has(id)) map.set(id, name);
  }
  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

function filterRashodOfRows(rows, groupId, waiterId) {
  return rows.filter((row) =>
    (!groupId || normalizeRashodOfId(row?.IdGroup) === groupId) &&
    (!waiterId || normalizeRashodOfId(row?.IdWaiter) === waiterId)
  );
}

function groupRashodOfRows(rows) {
  const sorted = [...rows].sort((a, b) => {
    const w = String(a?.Waiter ?? "").localeCompare(String(b?.Waiter ?? ""), undefined, { sensitivity: "base" });
    if (w !== 0) return w;
    return String(a?.NameDish ?? "").localeCompare(String(b?.NameDish ?? ""), undefined, { sensitivity: "base" });
  });
  const groups = [];
  for (const row of sorted) {
    const name = String(row?.Waiter ?? "").trim() || "—";
    let group = groups[groups.length - 1];
    if (!group || group.name !== name) {
      group = { name, rows: [] };
      groups.push(group);
    }
    group.rows.push(row);
  }
  return groups;
}

function rashodOfTotals(rows) {
  return {
    Kolvo: sumField(rows, "Kolvo"),
    Summ: sumField(rows, "Summ"),
    SumSeb: sumField(rows, "SumSeb")
  };
}

function RashodOfFilters({ groupId, waiterId, groupOptions, waiterOptions, onGroupChange, onWaiterChange, t }) {
  return (
    <div className="rashodof-filters">
      <label className="rashodof-filter">
        <span>{t("RashodOf.DishGroup", "Группа блюд")}</span>
        <select value={groupId} onChange={(e) => onGroupChange(e.target.value)}>
          <option value="">{t("Common.All", "Все")}</option>
          {groupOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
        </select>
      </label>
      <label className="rashodof-filter">
        <span>{t("RashodOf.Waiter", "Официант")}</span>
        <select value={waiterId} onChange={(e) => onWaiterChange(e.target.value)}>
          <option value="">{t("Common.All", "Все")}</option>
          {waiterOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
        </select>
      </label>
    </div>
  );
}

function RashodOfReportTable({ rows, formatter, t }) {
  const groups = groupRashodOfRows(rows);
  const grand = rashodOfTotals(rows);
  return (
    <div className="rashodof-groups">
      {groups.map((group) => {
        const total = rashodOfTotals(group.rows);
        return (
          <section className="rashodof-group" key={group.name}>
            <div className="rashodof-group-title">{group.name}</div>
            <div className="report-table-scroll">
              <table className="report-table rashodof-table">
                <thead><tr>
                  <th className="report-text">{t("RashodOf.Dish", "Блюдо")}</th>
                  <th className="report-money">{t("RashodOf.Quantity", "Количество")}</th>
                  <th className="report-money">{t("RashodOf.Price", "Цена")}</th>
                  <th className="report-money">{t("RashodOf.Amount", "Сумма")}</th>
                  <th className="report-money">{t("RashodOf.Cost", "Себестоимость")}</th>
                  <th className="report-money">{t("RashodOf.CostAmount", "Сумма себест.")}</th>
                  <th className="report-money">{t("RashodOf.Guests", "Гостей")}</th>
                </tr></thead>
                <tbody>
                  {group.rows.map((row, index) => <tr key={`${normalizeRashodOfId(row?.IdWaiter)}-${row?.NameDish ?? "dish"}-${index}`}>
                    <td className="report-text">{row?.NameDish || "—"}</td>
                    <td className="report-money">{formatter.format(numericValue(row?.Kolvo))}</td>
                    <td className="report-money">{formatter.format(numericValue(row?.Price))}</td>
                    <td className="report-money">{formatter.format(numericValue(row?.Summ))}</td>
                    <td className="report-money">{formatter.format(numericValue(row?.Sebest))}</td>
                    <td className="report-money">{formatter.format(numericValue(row?.SumSeb))}</td>
                    <td className="report-money">{formatter.format(numericValue(row?.Guests))}</td>
                  </tr>)}
                </tbody>
                <tfoot><tr>
                  <td className="report-text report-total-label">{t("RashodOf.WaiterTotal", "Итого по официанту")}</td>
                  <td className="report-money">{formatter.format(total.Kolvo)}</td>
                  <td />
                  <td className="report-money">{formatter.format(total.Summ)}</td>
                  <td />
                  <td className="report-money">{formatter.format(total.SumSeb)}</td>
                  <td />
                </tr></tfoot>
              </table>
            </div>
          </section>
        );
      })}
      {groups.length > 0 && <div className="rashodof-grand-total">
        <div><span>{t("RashodOf.Quantity", "Количество")}</span><strong>{formatter.format(grand.Kolvo)}</strong></div>
        <div><span>{t("RashodOf.Amount", "Сумма")}</span><strong>{formatter.format(grand.Summ)}</strong></div>
        <div><span>{t("RashodOf.CostAmount", "Сумма себест.")}</span><strong>{formatter.format(grand.SumSeb)}</strong></div>
      </div>}
    </div>
  );
}

function rashodOfFilterText({ groupId, waiterId, groupOptions, waiterOptions, t }) {
  const parts = [];
  const group = groupOptions.find((o) => o.id === groupId)?.name;
  const waiter = waiterOptions.find((o) => o.id === waiterId)?.name;
  if (group) parts.push(`${t("RashodOf.DishGroup", "Группа блюд")}: ${group}`);
  if (waiter) parts.push(`${t("RashodOf.Waiter", "Официант")}: ${waiter}`);
  return parts.join(" • ");
}

function buildRashodOfPrintHtml({ rows, dateFrom, dateTo, departmentName, groupId, waiterId, groupOptions, waiterOptions, locale, t }) {
  const formatter = createMoneyFormatter(locale);
  const groups = groupRashodOfRows(rows);
  const grand = rashodOfTotals(rows);
  const filterText = rashodOfFilterText({ groupId, waiterId, groupOptions, waiterOptions, t });
  const groupsHtml = groups.map((group) => {
    const total = rashodOfTotals(group.rows);
    const body = group.rows.map((row) => `<tr>
<td class="text">${escapeHtml(row?.NameDish || "—")}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.Kolvo)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.Price)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.Summ)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.Sebest)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.SumSeb)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.Guests)))}</td>
</tr>`).join("");
    return `<section class="group"><div class="group-title">${escapeHtml(group.name)}</div><table>
<thead><tr><th class="text dish">${escapeHtml(t("RashodOf.Dish", "Блюдо"))}</th><th>${escapeHtml(t("RashodOf.Quantity", "Количество"))}</th><th>${escapeHtml(t("RashodOf.Price", "Цена"))}</th><th>${escapeHtml(t("RashodOf.Amount", "Сумма"))}</th><th>${escapeHtml(t("RashodOf.Cost", "Себестоимость"))}</th><th>${escapeHtml(t("RashodOf.CostAmount", "Сумма себест."))}</th><th>${escapeHtml(t("RashodOf.Guests", "Гостей"))}</th></tr></thead>
<tbody>${body}</tbody><tfoot><tr><td class="text">${escapeHtml(t("RashodOf.WaiterTotal", "Итого по официанту"))}</td><td class="number">${escapeHtml(formatter.format(total.Kolvo))}</td><td></td><td class="number">${escapeHtml(formatter.format(total.Summ))}</td><td></td><td class="number">${escapeHtml(formatter.format(total.SumSeb))}</td><td></td></tr></tfoot>
</table></section>`;
  }).join("");
  const title = `${t("RashodOf.Title", "Расход блюд по официантам")} ${t("Common.From", "с")} ${formatReportDate(dateFrom)} ${t("Common.To", "по")} ${formatReportDate(dateTo)}`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
@page { size: A4 portrait; margin: 8mm; } * { box-sizing: border-box; } body { margin:0; font-family:Arial,sans-serif; color:#111; font-size:7.3pt; }
.header { margin-bottom:3.5mm; } h1 { margin:0; font-size:11pt; font-style:italic; } .warehouse { margin-top:1mm; font-weight:700; } .filters { margin-top:1mm; color:#444; }
.group { margin:0 0 3.5mm; break-inside:auto; } .group-title { padding:.9mm 1.2mm; background:#e8efed; border-top:.3mm solid #647571; border-bottom:.15mm solid #acb8b5; font-weight:700; break-after:avoid; }
table { width:100%; border-collapse:collapse; table-layout:fixed; } thead { display:table-header-group; } tr { break-inside:avoid; } th { padding:.6mm .45mm; border-bottom:.2mm solid #555; font-size:5.7pt; text-align:right; } th.text { text-align:left; } th.dish { width:34%; } th:not(.dish) { width:11%; }
td { padding:.58mm .45mm; border-bottom:.1mm dotted #c8cecc; font-size:6.2pt; } td.text { text-align:left; } td.number { text-align:right; white-space:nowrap; } tfoot td { border-top:.2mm solid #555; background:#f3f6f5; font-weight:700; }
.grand-total { display:flex; justify-content:flex-end; flex-wrap:wrap; gap:3mm 7mm; margin-top:4mm; padding-top:1.5mm; border-top:.35mm solid #333; } .grand-total>div { display:flex; gap:2mm; }
</style></head><body><div class="header"><h1>${escapeHtml(title)}</h1><div class="warehouse">${escapeHtml(departmentName || "")}</div>${filterText ? `<div class="filters">${escapeHtml(filterText)}</div>` : ""}</div>${groupsHtml}${groups.length ? `<div class="grand-total"><div><span>${escapeHtml(t("RashodOf.Quantity", "Количество"))}</span><strong>${escapeHtml(formatter.format(grand.Kolvo))}</strong></div><div><span>${escapeHtml(t("RashodOf.Amount", "Сумма"))}</span><strong>${escapeHtml(formatter.format(grand.Summ))}</strong></div><div><span>${escapeHtml(t("RashodOf.CostAmount", "Сумма себест."))}</span><strong>${escapeHtml(formatter.format(grand.SumSeb))}</strong></div></div>` : ""}</body></html>`;
}

function printRashodOfReport(options) {
  const printWindow = window.open("", "_blank", "width=1100,height=900");
  if (!printWindow) {
    window.alert(options.t("Reports.PrintPopupBlocked", "Браузер заблокировал окно печати. Разрешите всплывающие окна для Web Office."));
    return;
  }
  printWindow.document.open(); printWindow.document.write(buildRashodOfPrintHtml(options)); printWindow.document.close(); printWindow.focus(); closePrintWindowAfterPrint(printWindow);
  window.setTimeout(() => printWindow.print(), 150);
}

function safeRashodOfFilePart(value) {
  return String(value ?? "").trim().replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_").slice(0, 60);
}

function buildRashodOfExportModel({ rows, dateFrom, dateTo, departmentName, groupId, waiterId, groupOptions, waiterOptions, locale, t }) {
  const exportRows = [];
  for (const group of groupRashodOfRows(rows)) {
    for (const row of group.rows) exportRows.push({ Waiter: group.name, Dish: row?.NameDish || "", Quantity: row?.Kolvo ?? "", Price: row?.Price ?? "", Amount: row?.Summ ?? "", Cost: row?.Sebest ?? "", CostAmount: row?.SumSeb ?? "", Guests: row?.Guests ?? "" });
    const total = rashodOfTotals(group.rows);
    exportRows.push({ Waiter: group.name, Dish: t("RashodOf.WaiterTotal", "Итого по официанту"), Quantity: total.Kolvo, Price: "", Amount: total.Summ, Cost: "", CostAmount: total.SumSeb, Guests: "" });
  }
  const total = rashodOfTotals(rows);
  const meta = [{ label: t("RashodOf.Warehouse", "Склад"), value: departmentName || "" }];
  const filterText = rashodOfFilterText({ groupId, waiterId, groupOptions, waiterOptions, t });
  if (filterText) meta.push({ label: t("RashodOf.Filters", "Фильтр"), value: filterText });
  return {
    title: `${t("RashodOf.Title", "Расход блюд по официантам")} ${formatReportDate(dateFrom)} — ${formatReportDate(dateTo)}`,
    fileName: `RashodOf_${safeRashodOfFilePart(dateFrom)}_${safeRashodOfFilePart(dateTo)}_${safeRashodOfFilePart(departmentName || "warehouse")}`,
    orientation: "portrait", locale, meta,
    columns: [
      { key:"Waiter", title:t("RashodOf.Waiter","Официант"), type:"text", width:20 },
      { key:"Dish", title:t("RashodOf.Dish","Блюдо"), type:"text", width:28 },
      { key:"Quantity", title:t("RashodOf.Quantity","Количество"), type:"number", decimals:2, width:12 },
      { key:"Price", title:t("RashodOf.Price","Цена"), type:"number", decimals:2, width:12 },
      { key:"Amount", title:t("RashodOf.Amount","Сумма"), type:"number", decimals:2, width:13 },
      { key:"Cost", title:t("RashodOf.Cost","Себестоимость"), type:"number", decimals:2, width:14 },
      { key:"CostAmount", title:t("RashodOf.CostAmount","Сумма себест."), type:"number", decimals:2, width:14 },
      { key:"Guests", title:t("RashodOf.Guests","Гостей"), type:"number", decimals:0, width:10 }
    ],
    rows: exportRows,
    footerRows: [{ label:t("Common.Total","Итого"), values:{ Quantity:total.Kolvo, Amount:total.Summ, CostAmount:total.SumSeb } }]
  };
}

function RashodOfReport({ data, dateFrom, dateTo, departmentName, locale, fetchWithAuth, t, onReload }) {
  const rows = getRashodOfRows(data);
  const formatter = createMoneyFormatter(locale);
  const groupOptions = useMemo(() => buildRashodOfOptions(rows, "IdGroup", "NameGroup"), [rows]);
  const waiterOptions = useMemo(() => buildRashodOfOptions(rows, "IdWaiter", "Waiter"), [rows]);
  const [groupId, setGroupId] = useState("");
  const [waiterId, setWaiterId] = useState("");
  useEffect(() => { if (groupId && !groupOptions.some((o) => o.id === groupId)) setGroupId(""); }, [groupId, groupOptions]);
  useEffect(() => { if (waiterId && !waiterOptions.some((o) => o.id === waiterId)) setWaiterId(""); }, [waiterId, waiterOptions]);
  const filteredRows = useMemo(() => filterRashodOfRows(rows, groupId, waiterId), [rows, groupId, waiterId]);
  const commonOptions = { rows: filteredRows, dateFrom, dateTo, departmentName, groupId, waiterId, groupOptions, waiterOptions, locale, t };
  async function handleExport(format) {
    try { await exportReportFile({ fetchWithAuth, reportModel: buildRashodOfExportModel(commonOptions), format, errorMessage:t("Report.ExportError","Ошибка экспорта отчёта.") }); }
    catch (err) { window.alert(err?.message || t("Report.ExportError","Ошибка экспорта отчёта.")); }
  }
  return (
    <div className="reports-page rashodof-report-page">
      <div className="report-toolbar rashodof-toolbar">
        <button type="button" className="report-run-button" onClick={onReload}>{t("Common.Generate","Сформировать")}</button>
        <button type="button" className="report-action-button report-print-button" onClick={() => printRashodOfReport(commonOptions)}>{t("Common.Print","Печать")}</button>
        <button type="button" className="report-action-button report-excel-button" onClick={() => handleExport("xlsx")}>{t("Common.Excel","Excel")}</button>
        <button type="button" className="report-action-button report-word-button" onClick={() => handleExport("docx")}>{t("Common.Word","Word")}</button>
        <RashodOfFilters groupId={groupId} waiterId={waiterId} groupOptions={groupOptions} waiterOptions={waiterOptions} onGroupChange={setGroupId} onWaiterChange={setWaiterId} t={t} />
      </div>
      <article className="revenue-report-sheet rashodof-report-sheet">
        <header className="rashodof-report-heading"><h3>{t("RashodOf.Title","Расход блюд по официантам")} {t("Common.From","с")} {formatReportDate(dateFrom)} {t("Common.To","по")} {formatReportDate(dateTo)}</h3><div className="rashodof-warehouse">{departmentName || ""}</div></header>
        {rows.length > 0 ? (filteredRows.length > 0 ? <RashodOfReportTable rows={filteredRows} formatter={formatter} t={t} /> : <div className="report-empty">{t("RashodOf.NoFilteredData","По выбранным фильтрам данных нет.")}</div>) : <div className="report-empty">{t("Reports.NoDataForPeriod","За выбранный период данных нет.")}</div>}
      </article>
    </div>
  );
}



function getSpisBludRows(data) {
  const payload = data?.data ?? data?.Data ?? data;

  if (Array.isArray(payload)) {
    return payload;
  }

  return normalizeRows(
    payload?.Main ??
    payload?.main ??
    payload?.Rows ??
    payload?.rows ??
    payload?.SpisBlud ??
    payload?.spisBlud ??
    payload?.spisblud
  );
}

function spisBludName(row) {
  return String(
    row?.["Наименование"] ?? ""
  ).trim();
}

function spisBludCostAmount(row) {
  return numericValue(
    row?.SummSebest
  );
}

function spisBludDate(row) {
  const raw =
    row?.Smena ??
    row?.DataSpis ??
    "";

  if (!raw) {
    return "";
  }

  return String(raw).slice(0, 10);
}

function aggregateSpisBludRows(
  rows,
  allWarehouses
) {
  if (!allWarehouses) {
    return [...rows].sort(
      (left, right) => {
        const dateCompare =
          spisBludDate(left).localeCompare(
            spisBludDate(right)
          );

        if (dateCompare !== 0) {
          return dateCompare;
        }

        return spisBludName(left).localeCompare(
          spisBludName(right),
          undefined,
          { sensitivity: "base" }
        );
      }
    );
  }

  const grouped = new Map();

  for (const row of rows) {
    const name = spisBludName(row);
    const key = name.toLocaleLowerCase();

    if (!grouped.has(key)) {
      grouped.set(key, {
        ...row,
        "Наименование": name,
        Kolvo: 0,
        SummSebest: 0,
        Sebest: 0,
        Smena: "",
        DataSpis: "",
        Rem: "",
        NameSkl: "",
        IdSkl: 0
      });
    }

    const target = grouped.get(key);

    target.Kolvo += numericValue(
      row?.Kolvo
    );
    target.SummSebest +=
      spisBludCostAmount(row);
  }

  for (const row of grouped.values()) {
    row.Sebest =
      numericValue(row.Kolvo) === 0
        ? 0
        : numericValue(
            row.SummSebest
          ) / numericValue(row.Kolvo);
  }

  return [...grouped.values()].sort(
    (left, right) =>
      spisBludName(left).localeCompare(
        spisBludName(right),
        undefined,
        { sensitivity: "base" }
      )
  );
}

function spisBludTotals(rows) {
  return {
    Kolvo: rows.reduce(
      (sum, row) =>
        sum + numericValue(row?.Kolvo),
      0
    ),
    SummSebest: rows.reduce(
      (sum, row) =>
        sum + spisBludCostAmount(row),
      0
    )
  };
}

function SpisBludReportTable({
  rows,
  allWarehouses,
  formatter,
  t
}) {
  const displayedRows =
    aggregateSpisBludRows(
      rows,
      allWarehouses
    );
  const totals =
    spisBludTotals(displayedRows);

  return (
    <div className="report-table-scroll">
      <table className="report-table spisblud-table">
        <thead>
          <tr>
            {!allWarehouses && (
              <th className="report-text spisblud-date">
                {t(
                  "SpisBlud.Date",
                  "Дата"
                )}
              </th>
            )}

            <th className="report-text spisblud-name">
              {t(
                "SpisBlud.Dish",
                "Блюдо"
              )}
            </th>

            <th className="report-money">
              {t(
                "SpisBlud.Quantity",
                "Количество"
              )}
            </th>

            <th className="report-money">
              {t(
                "SpisBlud.Cost",
                "Себестоимость"
              )}
            </th>

            <th className="report-money spisblud-costamount-head">
              <span>
                {t(
                  "SpisBlud.CostAmountLine1",
                  "Сумма"
                )}
                <br />
                {t(
                  "SpisBlud.CostAmountLine2",
                  "себестоимости"
                )}
              </span>
            </th>

            {!allWarehouses && (
              <th className="report-text spisblud-reason">
                {t(
                  "SpisBlud.Reason",
                  "Причина"
                )}
              </th>
            )}
          </tr>
        </thead>

        <tbody>
          {displayedRows.map(
            (row, index) => (
              <tr
                key={`${spisBludName(row)}-${index}`}
              >
                {!allWarehouses && (
                  <td className="report-text">
                    {formatReportDate(
                      spisBludDate(row)
                    )}
                  </td>
                )}

                <td className="report-text">
                  {spisBludName(row) || "—"}
                </td>

                <td className="report-money">
                  {formatter.format(
                    numericValue(
                      row?.Kolvo
                    )
                  )}
                </td>

                <td className="report-money">
                  {formatter.format(
                    numericValue(
                      row?.Sebest
                    )
                  )}
                </td>

                <td className="report-money">
                  {formatter.format(
                    spisBludCostAmount(row)
                  )}
                </td>

                {!allWarehouses && (
                  <td className="report-text">
                    {String(
                      row?.Rem ?? ""
                    ).trim()}
                  </td>
                )}
              </tr>
            )
          )}
        </tbody>

        {displayedRows.length > 0 && (
          <tfoot>
            <tr>
              {!allWarehouses && <td />}

              <td className="report-text report-total-label">
                {t(
                  "Common.Total",
                  "Итого"
                )}
              </td>

              <td className="report-money">
                {formatter.format(
                  totals.Kolvo
                )}
              </td>

              <td />

              <td className="report-money">
                {formatter.format(
                  totals.SummSebest
                )}
              </td>

              {!allWarehouses && <td />}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function buildSpisBludPrintHtml({
  rows,
  allWarehouses,
  dateFrom,
  dateTo,
  departmentName,
  locale,
  t
}) {
  const formatter =
    createMoneyFormatter(locale);
  const displayedRows =
    aggregateSpisBludRows(
      rows,
      allWarehouses
    );
  const totals =
    spisBludTotals(displayedRows);

  const body = displayedRows
    .map((row) => {
      const dateCell = allWarehouses
        ? ""
        : `<td class="text">${escapeHtml(
            formatReportDate(
              spisBludDate(row)
            )
          )}</td>`;

      const reasonCell = allWarehouses
        ? ""
        : `<td class="text">${escapeHtml(
            String(
              row?.Rem ?? ""
            ).trim()
          )}</td>`;

      return `<tr>
${dateCell}
<td class="text">${escapeHtml(spisBludName(row) || "—")}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.Kolvo)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.Sebest)))}</td>
<td class="number">${escapeHtml(formatter.format(spisBludCostAmount(row)))}</td>
${reasonCell}
</tr>`;
    })
    .join("");

  const title = `${t(
    "SpisBlud.Title",
    "Списание блюд"
  )} ${t(
    "Common.From",
    "с"
  )} ${formatReportDate(dateFrom)} ${t(
    "Common.To",
    "по"
  )} ${formatReportDate(dateTo)}`;

  const scopeText = allWarehouses
    ? t(
        "SpisBlud.AllWarehouses",
        "По всем складам"
      )
    : departmentName || "";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
@page { size: A4 portrait; margin: 9mm 10mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; color: #111; font-size: 8pt; }
.header { margin-bottom: 4mm; }
h1 { margin: 0; font-size: 12pt; font-style: italic; font-weight: 700; }
.scope { margin-top: 1mm; font-size: 8pt; font-weight: 700; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
thead { display: table-header-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
th { padding: 0.65mm 0.55mm; border-bottom: 0.2mm solid #555; font-size: 6.7pt; text-align: right; vertical-align: bottom; }
th.text { text-align: left; }
td { padding: 0.62mm 0.55mm; border-bottom: 0.1mm dotted #c8cecc; font-size: 7.1pt; }
td.text { text-align: left; overflow-wrap: anywhere; }
td.number { text-align: right; white-space: nowrap; }
tfoot td { border-top: 0.2mm solid #555; border-bottom: 0; background: #f3f6f5; font-weight: 700; }
</style>
</head>
<body>
<div class="header">
  <h1>${escapeHtml(title)}</h1>
  <div class="scope">${escapeHtml(scopeText)}</div>
</div>

<table>
<thead>
<tr>
${allWarehouses ? "" : `<th class="text">${escapeHtml(t("SpisBlud.Date", "Дата"))}</th>`}
<th class="text">${escapeHtml(t("SpisBlud.Dish", "Блюдо"))}</th>
<th>${escapeHtml(t("SpisBlud.Quantity", "Количество"))}</th>
<th>${escapeHtml(t("SpisBlud.Cost", "Себестоимость"))}</th>
<th>${escapeHtml(t("SpisBlud.CostAmountLine1", "Сумма"))}<br>${escapeHtml(t("SpisBlud.CostAmountLine2", "себестоимости"))}</th>
${allWarehouses ? "" : `<th class="text">${escapeHtml(t("SpisBlud.Reason", "Причина"))}</th>`}
</tr>
</thead>

<tbody>${body}</tbody>

${displayedRows.length > 0 ? `<tfoot><tr>
${allWarehouses ? "" : "<td></td>"}
<td class="text">${escapeHtml(t("Common.Total", "Итого"))}</td>
<td class="number">${escapeHtml(formatter.format(totals.Kolvo))}</td>
<td></td>
<td class="number">${escapeHtml(formatter.format(totals.SummSebest))}</td>
${allWarehouses ? "" : "<td></td>"}
</tr></tfoot>` : ""}
</table>
</body>
</html>`;
}

function printSpisBludReport(options) {
  const printWindow = window.open(
    "",
    "_blank",
    "width=1050,height=900"
  );

  if (!printWindow) {
    window.alert(
      options.t(
        "Reports.PrintPopupBlocked",
        "Браузер заблокировал окно печати. Разрешите всплывающие окна для Web Office."
      )
    );
    return;
  }

  printWindow.document.open();
  printWindow.document.write(
    buildSpisBludPrintHtml(options)
  );
  printWindow.document.close();
  printWindow.focus();
  closePrintWindowAfterPrint(printWindow);

  window.setTimeout(() => {
    printWindow.print();
  }, 150);
}

function safeSpisBludFilePart(value) {
  return String(value ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

function buildSpisBludExportModel({
  rows,
  allWarehouses,
  dateFrom,
  dateTo,
  departmentName,
  locale,
  t
}) {
  const displayedRows =
    aggregateSpisBludRows(
      rows,
      allWarehouses
    );
  const totals =
    spisBludTotals(displayedRows);

  const columns = [];

  if (!allWarehouses) {
    columns.push({
      key: "Date",
      title: t(
        "SpisBlud.Date",
        "Дата"
      ),
      type: "text",
      width: 13
    });
  }

  columns.push(
    {
      key: "Dish",
      title: t(
        "SpisBlud.Dish",
        "Блюдо"
      ),
      type: "text",
      width: 32
    },
    {
      key: "Quantity",
      title: t(
        "SpisBlud.Quantity",
        "Количество"
      ),
      type: "number",
      decimals: 2,
      width: 13
    },
    {
      key: "Cost",
      title: t(
        "SpisBlud.Cost",
        "Себестоимость"
      ),
      type: "number",
      decimals: 2,
      width: 14
    },
    {
      key: "CostAmount",
      title: t(
        "SpisBlud.CostAmount",
        "Сумма себестоимости"
      ),
      type: "number",
      decimals: 2,
      width: 15
    }
  );

  if (!allWarehouses) {
    columns.push({
      key: "Reason",
      title: t(
        "SpisBlud.Reason",
        "Причина"
      ),
      type: "text",
      width: 20
    });
  }

  const exportRows =
    displayedRows.map((row) => ({
      Date: allWarehouses
        ? undefined
        : formatReportDate(
            spisBludDate(row)
          ),
      Dish: spisBludName(row),
      Quantity: row?.Kolvo ?? "",
      Cost: row?.Sebest ?? "",
      CostAmount: spisBludCostAmount(row),
      Reason: allWarehouses
        ? undefined
        : String(
            row?.Rem ?? ""
          ).trim()
    }));

  return {
    title: `${t(
      "SpisBlud.Title",
      "Списание блюд"
    )} ${formatReportDate(
      dateFrom
    )} — ${formatReportDate(dateTo)}`,
    fileName: `SpisBlud_${safeSpisBludFilePart(
      dateFrom
    )}_${safeSpisBludFilePart(
      dateTo
    )}_${safeSpisBludFilePart(
      allWarehouses
        ? "all"
        : departmentName || "warehouse"
    )}`,
    orientation: "portrait",
    locale,
    meta: [
      {
        label: t(
          "SpisBlud.Warehouse",
          "Склад"
        ),
        value: allWarehouses
          ? t(
              "SpisBlud.All",
              "Все"
            )
          : departmentName || ""
      }
    ],
    columns,
    rows: exportRows,
    footerRows: [
      {
        label: t(
          "Common.Total",
          "Итого"
        ),
        values: {
          Quantity: totals.Kolvo,
          CostAmount: totals.SummSebestSebest
        }
      }
    ]
  };
}

function SpisBludReport({
  data,
  all,
  dateFrom,
  dateTo,
  departmentId,
  departmentName,
  locale,
  fetchWithAuth,
  t,
  onReload
}) {
  const rows = getSpisBludRows(data);
  const formatter =
    createMoneyFormatter(locale);

  const [allWarehouses, setAllWarehouses] =
    useState(Number(all) !== 0);

  useEffect(() => {
    setAllWarehouses(
      Number(all) !== 0
    );
  }, [all]);

  const selectedDepartmentId =
    String(departmentId ?? "").trim();

  const scopedRows = useMemo(() => {
    if (allWarehouses) {
      return rows;
    }

    if (!selectedDepartmentId) {
      return [];
    }

    return rows.filter(
      (row) =>
        String(row?.IdSkl ?? "").trim() ===
        selectedDepartmentId
    );
  }, [
    rows,
    allWarehouses,
    selectedDepartmentId
  ]);

  const commonOptions = {
    rows: scopedRows,
    allWarehouses,
    dateFrom,
    dateTo,
    departmentName,
    locale,
    t
  };

  function handleAllWarehousesChange(
    event
  ) {
    setAllWarehouses(
      event.target.checked
    );
  }

  async function handleExport(format) {
    try {
      await exportReportFile({
        fetchWithAuth,
        reportModel:
          buildSpisBludExportModel(
            commonOptions
          ),
        format,
        errorMessage: t(
          "Report.ExportError",
          "Ошибка экспорта отчёта."
        )
      });
    } catch (err) {
      window.alert(
        err?.message ||
          t(
            "Report.ExportError",
            "Ошибка экспорта отчёта."
          )
      );
    }
  }

  return (
    <div className="reports-page spisblud-report-page">
      <div className="report-toolbar spisblud-toolbar">
        <button
          type="button"
          className="report-run-button"
          onClick={() => onReload?.()}
        >
          {t(
            "Common.Generate",
            "Сформировать"
          )}
        </button>

        <button
          type="button"
          className="report-action-button report-print-button"
          onClick={() =>
            printSpisBludReport(
              commonOptions
            )
          }
        >
          {t("Common.Print", "Печать")}
        </button>

        <button
          type="button"
          className="report-action-button report-excel-button"
          onClick={() =>
            handleExport("xlsx")
          }
        >
          {t("Common.Excel", "Excel")}
        </button>

        <button
          type="button"
          className="report-action-button report-word-button"
          onClick={() =>
            handleExport("docx")
          }
        >
          {t("Common.Word", "Word")}
        </button>

        <label className="spisblud-all-filter">
          <input
            type="checkbox"
            checked={allWarehouses}
            onChange={
              handleAllWarehousesChange
            }
          />
          <span>
            {t(
              "SpisBlud.AllWarehouses",
              "По всем складам"
            )}
          </span>
        </label>
      </div>

      <article className="revenue-report-sheet spisblud-report-sheet">
        <header className="spisblud-report-heading">
          <h3>
            {t(
              "SpisBlud.Title",
              "Списание блюд"
            )}{" "}
            {t("Common.From", "с")}{" "}
            {formatReportDate(dateFrom)}{" "}
            {t("Common.To", "по")}{" "}
            {formatReportDate(dateTo)}
          </h3>

          <div className="spisblud-scope">
            {allWarehouses
              ? t(
                  "SpisBlud.AllWarehouses",
                  "По всем складам"
                )
              : departmentName || ""}
          </div>
        </header>

        {rows.length > 0 ? (
          scopedRows.length > 0 ? (
            <SpisBludReportTable
              rows={scopedRows}
              allWarehouses={
                allWarehouses
              }
              formatter={formatter}
              t={t}
            />
          ) : (
            <div className="report-empty">
              {t(
                "SpisBlud.NoDataForWarehouse",
                "По выбранному складу данных нет."
              )}
            </div>
          )
        ) : (
          <div className="report-empty">
            {t(
              "Reports.NoDataForPeriod",
              "За выбранный период данных нет."
            )}
          </div>
        )}
      </article>
    </div>
  );
}


function getSpisTovRows(data) {
  const payload = data?.data ?? data?.Data ?? data;

  if (Array.isArray(payload)) {
    return payload;
  }

  return normalizeRows(
    payload?.Main ??
    payload?.main ??
    payload?.Rows ??
    payload?.rows ??
    payload?.SpisTov ??
    payload?.spisTov ??
    payload?.spistov
  );
}

function spisTovReason(row) {
  return String(
    row?.["Затр"] ?? ""
  ).trim();
}

function aggregateSpisTovRows(
  rows,
  allWarehouses
) {
  if (!allWarehouses) {
    return [...rows];
  }

  const grouped = new Map();

  for (const row of rows) {
    const name = String(
      row?.NameTov ?? ""
    ).trim();
    const reason = spisTovReason(row);
    const key = `${reason}\u0000${name}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        ...row,
        NameTov: name,
        "Затр": reason,
        IdSkl: 0,
        Kolvo: 0,
        Summ: 0
      });
    }

    const target = grouped.get(key);
    target.Kolvo += numericValue(
      row?.Kolvo
    );
    target.Summ += numericValue(
      row?.Summ
    );
  }

  return [...grouped.values()];
}

function groupSpisTovRows(
  rows,
  allWarehouses
) {
  const source = aggregateSpisTovRows(
    rows,
    allWarehouses
  );
  const groups = new Map();

  for (const row of source) {
    const reason =
      spisTovReason(row) || "—";

    if (!groups.has(reason)) {
      groups.set(reason, []);
    }

    groups.get(reason).push(row);
  }

  return [...groups.entries()]
    .sort(([left], [right]) =>
      left.localeCompare(
        right,
        undefined,
        { sensitivity: "base" }
      )
    )
    .map(([reason, groupRows]) => ({
      reason,
      rows: [...groupRows].sort(
        (left, right) =>
          String(
            left?.NameTov ?? ""
          ).localeCompare(
            String(
              right?.NameTov ?? ""
            ),
            undefined,
            { sensitivity: "base" }
          )
      )
    }));
}

function spisTovTotals(rows) {
  return {
    Kolvo: sumField(rows, "Kolvo"),
    Summ: sumField(rows, "Summ")
  };
}

function SpisTovReportTable({
  rows,
  allWarehouses,
  formatter,
  t
}) {
  const groups = groupSpisTovRows(
    rows,
    allWarehouses
  );
  const displayedRows = groups.flatMap(
    (group) => group.rows
  );
  const grandTotals =
    spisTovTotals(displayedRows);

  return (
    <div className="spistov-groups">
      {groups.map((group) => {
        const totals =
          spisTovTotals(group.rows);

        return (
          <section
            className="spistov-group"
            key={group.reason}
          >
            <div className="spistov-group-title">
              {group.reason}
            </div>

            <div className="report-table-scroll">
              <table className="report-table spistov-table">
                <thead>
                  <tr>
                    <th className="report-text">
                      {t(
                        "SpisTov.Product",
                        "Сырье"
                      )}
                    </th>
                    <th className="report-money">
                      {t(
                        "SpisTov.Quantity",
                        "Количество"
                      )}
                    </th>
                    <th className="report-money">
                      {t(
                        "SpisTov.Amount",
                        "Сумма"
                      )}
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {group.rows.map(
                    (row, index) => (
                      <tr
                        key={`${row?.NameTov ?? "item"}-${index}`}
                      >
                        <td className="report-text">
                          {row?.NameTov || "—"}
                        </td>
                        <td className="report-money">
                          {formatter.format(
                            numericValue(
                              row?.Kolvo
                            )
                          )}
                        </td>
                        <td className="report-money">
                          {formatter.format(
                            numericValue(
                              row?.Summ
                            )
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>

                <tfoot>
                  <tr>
                    <td className="report-text report-total-label">
                      {t(
                        "Common.Total",
                        "Итого"
                      )}
                    </td>
                    <td className="report-money">
                      {formatter.format(
                        totals.Kolvo
                      )}
                    </td>
                    <td className="report-money">
                      {formatter.format(
                        totals.Summ
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        );
      })}

      {groups.length > 1 && (
        <div className="spistov-grand-total">
          <span>
            {t(
              "Common.Total",
              "Итого"
            )}
          </span>
          <strong>
            {formatter.format(
              grandTotals.Kolvo
            )}
          </strong>
          <strong>
            {formatter.format(
              grandTotals.Summ
            )}
          </strong>
        </div>
      )}
    </div>
  );
}

function buildSpisTovPrintHtml({
  rows,
  allWarehouses,
  dateFrom,
  dateTo,
  departmentName,
  locale,
  t
}) {
  const formatter =
    createMoneyFormatter(locale);
  const groups = groupSpisTovRows(
    rows,
    allWarehouses
  );
  const displayedRows = groups.flatMap(
    (group) => group.rows
  );
  const grandTotals =
    spisTovTotals(displayedRows);

  const groupsHtml = groups
    .map((group) => {
      const totals =
        spisTovTotals(group.rows);
      const body = group.rows
        .map(
          (row) => `<tr>
<td class="text">${escapeHtml(row?.NameTov || "—")}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.Kolvo)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.Summ)))}</td>
</tr>`
        )
        .join("");

      return `<section class="group">
<div class="group-title">${escapeHtml(group.reason)}</div>
<table>
<thead><tr>
<th class="text">${escapeHtml(t("SpisTov.Product", "Сырье"))}</th>
<th>${escapeHtml(t("SpisTov.Quantity", "Количество"))}</th>
<th>${escapeHtml(t("SpisTov.Amount", "Сумма"))}</th>
</tr></thead>
<tbody>${body}</tbody>
<tfoot><tr>
<td class="text">${escapeHtml(t("Common.Total", "Итого"))}</td>
<td class="number">${escapeHtml(formatter.format(totals.Kolvo))}</td>
<td class="number">${escapeHtml(formatter.format(totals.Summ))}</td>
</tr></tfoot>
</table>
</section>`;
    })
    .join("");

  const title = `${t(
    "SpisTov.Title",
    "Списание сырья"
  )} ${t(
    "Common.From",
    "с"
  )} ${formatReportDate(dateFrom)} ${t(
    "Common.To",
    "по"
  )} ${formatReportDate(dateTo)}`;

  const scopeText = allWarehouses
    ? t(
        "SpisTov.AllWarehouses",
        "По всем складам"
      )
    : departmentName || "";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
@page { size: A4 portrait; margin: 10mm 12mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; color: #111; font-size: 8.4pt; }
.header { margin-bottom: 4mm; }
h1 { margin: 0; font-size: 12pt; font-style: italic; font-weight: 700; }
.scope { margin-top: 1mm; font-size: 8pt; font-weight: 700; }
.group { margin: 0 0 4mm; break-inside: auto; page-break-inside: auto; }
.group-title { padding: 0.9mm 1.2mm; background: #e8efed; border-top: 0.3mm solid #647571; border-bottom: 0.15mm solid #acb8b5; font-size: 8pt; font-weight: 700; break-after: avoid; page-break-after: avoid; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
thead { display: table-header-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
th { padding: 0.7mm 0.7mm; border-bottom: 0.2mm solid #555; font-size: 7pt; text-align: right; }
th.text { width: 62%; text-align: left; }
th:not(.text) { width: 19%; }
td { padding: 0.65mm 0.7mm; border-bottom: 0.1mm dotted #c8cecc; font-size: 7.4pt; }
td.text { text-align: left; overflow-wrap: anywhere; }
td.number { text-align: right; white-space: nowrap; }
tfoot td { border-top: 0.2mm solid #555; border-bottom: 0; background: #f3f6f5; font-weight: 700; }
.grand { display: flex; justify-content: flex-end; gap: 8mm; margin-top: 4mm; padding-top: 1.5mm; border-top: 0.35mm solid #333; font-weight: 700; }
</style>
</head>
<body>
<div class="header">
  <h1>${escapeHtml(title)}</h1>
  <div class="scope">${escapeHtml(scopeText)}</div>
</div>
${groupsHtml}
${groups.length > 1 ? `<div class="grand"><span>${escapeHtml(t("Common.Total", "Итого"))}</span><span>${escapeHtml(formatter.format(grandTotals.Kolvo))}</span><span>${escapeHtml(formatter.format(grandTotals.Summ))}</span></div>` : ""}
</body>
</html>`;
}

function printSpisTovReport(options) {
  const printWindow = window.open(
    "",
    "_blank",
    "width=1000,height=900"
  );

  if (!printWindow) {
    window.alert(
      options.t(
        "Reports.PrintPopupBlocked",
        "Браузер заблокировал окно печати. Разрешите всплывающие окна для Web Office."
      )
    );
    return;
  }

  printWindow.document.open();
  printWindow.document.write(
    buildSpisTovPrintHtml(options)
  );
  printWindow.document.close();
  printWindow.focus();
  closePrintWindowAfterPrint(printWindow);

  window.setTimeout(() => {
    printWindow.print();
  }, 150);
}

function safeSpisTovFilePart(value) {
  return String(value ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

function buildSpisTovExportModel({
  rows,
  allWarehouses,
  dateFrom,
  dateTo,
  departmentName,
  locale,
  t
}) {
  const groups = groupSpisTovRows(
    rows,
    allWarehouses
  );
  const exportRows = [];

  for (const group of groups) {
    for (const row of group.rows) {
      exportRows.push({
        Reason: group.reason,
        Product: row?.NameTov || "",
        Quantity: row?.Kolvo ?? "",
        Amount: row?.Summ ?? ""
      });
    }

    const totals =
      spisTovTotals(group.rows);

    exportRows.push({
      Reason: group.reason,
      Product: t(
        "Common.Total",
        "Итого"
      ),
      Quantity: totals.Kolvo,
      Amount: totals.Summ
    });
  }

  const displayedRows = groups.flatMap(
    (group) => group.rows
  );
  const totals =
    spisTovTotals(displayedRows);

  return {
    title: `${t(
      "SpisTov.Title",
      "Списание сырья"
    )} ${formatReportDate(
      dateFrom
    )} — ${formatReportDate(dateTo)}`,
    fileName: `SpisTov_${safeSpisTovFilePart(
      dateFrom
    )}_${safeSpisTovFilePart(
      dateTo
    )}_${safeSpisTovFilePart(
      allWarehouses
        ? "all"
        : departmentName || "warehouse"
    )}`,
    orientation: "portrait",
    locale,
    meta: [
      {
        label: t(
          "SpisTov.Warehouse",
          "Склад"
        ),
        value: allWarehouses
          ? t(
              "SpisTov.All",
              "Все"
            )
          : departmentName || ""
      }
    ],
    columns: [
      {
        key: "Reason",
        title: t(
          "SpisTov.Reason",
          "Причина списания"
        ),
        type: "text",
        width: 22
      },
      {
        key: "Product",
        title: t(
          "SpisTov.Product",
          "Сырье"
        ),
        type: "text",
        width: 34
      },
      {
        key: "Quantity",
        title: t(
          "SpisTov.Quantity",
          "Количество"
        ),
        type: "number",
        decimals: 2,
        width: 14
      },
      {
        key: "Amount",
        title: t(
          "SpisTov.Amount",
          "Сумма"
        ),
        type: "number",
        decimals: 2,
        width: 15
      }
    ],
    rows: exportRows,
    footerRows: [
      {
        label: t(
          "Common.Total",
          "Итого"
        ),
        values: {
          Quantity: totals.Kolvo,
          Amount: totals.Summ
        }
      }
    ]
  };
}

function SpisTovReport({
  data,
  all,
  dateFrom,
  dateTo,
  departmentId,
  departmentName,
  locale,
  fetchWithAuth,
  t,
  onReload
}) {
  const rows = getSpisTovRows(data);
  const formatter =
    createMoneyFormatter(locale);
  const [allWarehouses, setAllWarehouses] =
    useState(Number(all) !== 0);

  useEffect(() => {
    setAllWarehouses(
      Number(all) !== 0
    );
  }, [all]);

  const selectedDepartmentId =
    String(departmentId ?? "").trim();

  const scopedRows = useMemo(() => {
    if (allWarehouses) {
      return rows;
    }

    if (!selectedDepartmentId) {
      return [];
    }

    return rows.filter(
      (row) =>
        String(row?.IdSkl ?? "").trim() ===
        selectedDepartmentId
    );
  }, [
    rows,
    allWarehouses,
    selectedDepartmentId
  ]);

  const commonOptions = {
    rows: scopedRows,
    allWarehouses,
    dateFrom,
    dateTo,
    departmentName,
    locale,
    t
  };

  function handleAllWarehousesChange(
    event
  ) {
    setAllWarehouses(
      event.target.checked
    );
  }

  async function handleExport(format) {
    try {
      await exportReportFile({
        fetchWithAuth,
        reportModel:
          buildSpisTovExportModel(
            commonOptions
          ),
        format,
        errorMessage: t(
          "Report.ExportError",
          "Ошибка экспорта отчёта."
        )
      });
    } catch (err) {
      window.alert(
        err?.message ||
          t(
            "Report.ExportError",
            "Ошибка экспорта отчёта."
          )
      );
    }
  }

  return (
    <div className="reports-page spistov-report-page">
      <div className="report-toolbar spistov-toolbar">
        <button
          type="button"
          className="report-run-button"
          onClick={() =>
            onReload?.()
          }
        >
          {t(
            "Common.Generate",
            "Сформировать"
          )}
        </button>

        <button
          type="button"
          className="report-action-button report-print-button"
          onClick={() =>
            printSpisTovReport(
              commonOptions
            )
          }
        >
          {t("Common.Print", "Печать")}
        </button>

        <button
          type="button"
          className="report-action-button report-excel-button"
          onClick={() =>
            handleExport("xlsx")
          }
        >
          {t("Common.Excel", "Excel")}
        </button>

        <button
          type="button"
          className="report-action-button report-word-button"
          onClick={() =>
            handleExport("docx")
          }
        >
          {t("Common.Word", "Word")}
        </button>

        <label className="spistov-all-filter">
          <input
            type="checkbox"
            checked={allWarehouses}
            onChange={
              handleAllWarehousesChange
            }
          />
          <span>
            {t(
              "SpisTov.AllWarehouses",
              "По всем складам"
            )}
          </span>
        </label>
      </div>

      <article className="revenue-report-sheet spistov-report-sheet">
        <header className="spistov-report-heading">
          <h3>
            {t(
              "SpisTov.Title",
              "Списание сырья"
            )}{" "}
            {t("Common.From", "с")}{" "}
            {formatReportDate(dateFrom)}{" "}
            {t("Common.To", "по")}{" "}
            {formatReportDate(dateTo)}
          </h3>

          <div className="spistov-scope">
            {allWarehouses
              ? t(
                  "SpisTov.AllWarehouses",
                  "По всем складам"
                )
              : departmentName || ""}
          </div>
        </header>

        {rows.length > 0 ? (
          scopedRows.length > 0 ? (
            <SpisTovReportTable
              rows={scopedRows}
              allWarehouses={
                allWarehouses
              }
              formatter={formatter}
              t={t}
            />
          ) : (
            <div className="report-empty">
              {t(
                "SpisTov.NoDataForWarehouse",
                "По выбранному складу данных нет."
              )}
            </div>
          )
        ) : (
          <div className="report-empty">
            {t(
              "Reports.NoDataForPeriod",
              "За выбранный период данных нет."
            )}
          </div>
        )}
      </article>
    </div>
  );
}


function getSpisSirBludRows(data) {
  const payload = data?.data ?? data?.Data ?? data;

  if (Array.isArray(payload)) {
    return payload;
  }

  return normalizeRows(
    payload?.Main ??
    payload?.main ??
    payload?.Rows ??
    payload?.rows ??
    payload?.SpisSirBlud ??
    payload?.spisSirBlud ??
    payload?.spissirblud
  );
}

function sortSpisSirBludRows(rows) {
  return [...rows].sort((left, right) =>
    String(left?.NameTov ?? "").localeCompare(
      String(right?.NameTov ?? ""),
      undefined,
      { sensitivity: "base" }
    )
  );
}

function spisSirBludPrice(row) {
  const quantity = numericValue(
    row?.Kolvo
  );

  if (quantity === 0) {
    return 0;
  }

  return (
    numericValue(row?.Summ) /
    quantity
  );
}

function spisSirBludTotals(rows) {
  return {
    Kolvo: sumField(rows, "Kolvo"),
    Summ: sumField(rows, "Summ")
  };
}

function spisSirBludDisplayValue(
  value,
  formatter
) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    numericValue(value) === 0
  ) {
    return "";
  }

  return formatter.format(
    numericValue(value)
  );
}

function SpisSirBludReportTable({
  rows,
  formatter,
  t
}) {
  const sortedRows =
    sortSpisSirBludRows(rows);
  const totals =
    spisSirBludTotals(rows);

  return (
    <div className="report-table-scroll">
      <table className="report-table spissirblud-table">
        <thead>
          <tr>
            <th className="report-text">
              {t(
                "SpisSirBlud.Product",
                "Сырье"
              )}
            </th>
            <th className="report-money">
              {t(
                "SpisSirBlud.Quantity",
                "Количество"
              )}
            </th>
            <th className="report-money">
              {t(
                "SpisSirBlud.Price",
                "Цена"
              )}
            </th>
            <th className="report-money">
              {t(
                "SpisSirBlud.Amount",
                "Сумма"
              )}
            </th>
          </tr>
        </thead>

        <tbody>
          {sortedRows.map((row, index) => (
            <tr
              key={`${row?.NameTov ?? "item"}-${index}`}
            >
              <td className="report-text">
                {row?.NameTov || "—"}
              </td>
              <td className="report-money">
                {spisSirBludDisplayValue(
                  row?.Kolvo,
                  formatter
                )}
              </td>
              <td className="report-money">
                {spisSirBludDisplayValue(
                  spisSirBludPrice(row),
                  formatter
                )}
              </td>
              <td className="report-money">
                {spisSirBludDisplayValue(
                  row?.Summ,
                  formatter
                )}
              </td>
            </tr>
          ))}
        </tbody>

        {sortedRows.length > 0 && (
          <tfoot>
            <tr>
              <td className="report-text report-total-label">
                {t(
                  "Common.Total",
                  "Итого"
                )}
              </td>
              <td className="report-money">
                {spisSirBludDisplayValue(
                  totals.Kolvo,
                  formatter
                )}
              </td>
              <td />
              <td className="report-money">
                {spisSirBludDisplayValue(
                  totals.Summ,
                  formatter
                )}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function buildSpisSirBludPrintHtml({
  rows,
  dateFrom,
  dateTo,
  departmentName,
  locale,
  t
}) {
  const formatter =
    createMoneyFormatter(locale);
  const sortedRows =
    sortSpisSirBludRows(rows);
  const totals =
    spisSirBludTotals(rows);

  const body = sortedRows
    .map(
      (row) => `<tr>
<td class="text">${escapeHtml(row?.NameTov || "—")}</td>
<td class="number">${escapeHtml(spisSirBludDisplayValue(row?.Kolvo, formatter))}</td>
<td class="number">${escapeHtml(spisSirBludDisplayValue(spisSirBludPrice(row), formatter))}</td>
<td class="number">${escapeHtml(spisSirBludDisplayValue(row?.Summ, formatter))}</td>
</tr>`
    )
    .join("");

  const title = `${t(
    "SpisSirBlud.Title",
    "Списание сырья в блюдах"
  )} ${t(
    "Common.From",
    "с"
  )} ${formatReportDate(dateFrom)} ${t(
    "Common.To",
    "по"
  )} ${formatReportDate(dateTo)}`;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
@page { size: A4 portrait; margin: 10mm 12mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; color: #111; font-size: 9pt; }
.header { margin-bottom: 5mm; }
h1 { margin: 0; font-size: 12.5pt; font-style: italic; font-weight: 700; }
.warehouse { margin-top: 1mm; font-size: 8pt; font-weight: 700; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
thead { display: table-header-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
th { padding: 0.85mm 1mm; border-bottom: 0.3mm solid #555; font-size: 7.2pt; }
td { padding: 0.8mm 1mm; border-bottom: 0.15mm dotted #c7cecb; font-size: 7.8pt; }
.text { text-align: left; }
.number { text-align: right; white-space: nowrap; }
th:nth-child(1) { width: 55%; text-align: left; }
th:nth-child(2),
th:nth-child(3),
th:nth-child(4) { width: 15%; text-align: right; }
tfoot td { border-top: 0.3mm solid #555; border-bottom: 0; background: #f3f6f5; font-weight: 700; }
</style>
</head>
<body>
<div class="header">
  <h1>${escapeHtml(title)}</h1>
  <div class="warehouse">${escapeHtml(departmentName || "")}</div>
</div>
<table>
<thead><tr>
<th>${escapeHtml(t("SpisSirBlud.Product", "Сырье"))}</th>
<th>${escapeHtml(t("SpisSirBlud.Quantity", "Количество"))}</th>
<th>${escapeHtml(t("SpisSirBlud.Price", "Цена"))}</th>
<th>${escapeHtml(t("SpisSirBlud.Amount", "Сумма"))}</th>
</tr></thead>
<tbody>${body}</tbody>
${sortedRows.length > 0 ? `<tfoot><tr>
<td class="text">${escapeHtml(t("Common.Total", "Итого"))}</td>
<td class="number">${escapeHtml(spisSirBludDisplayValue(totals.Kolvo, formatter))}</td>
<td></td>
<td class="number">${escapeHtml(spisSirBludDisplayValue(totals.Summ, formatter))}</td>
</tr></tfoot>` : ""}
</table>
</body>
</html>`;
}

function printSpisSirBludReport(options) {
  const printWindow = window.open(
    "",
    "_blank",
    "width=1050,height=900"
  );

  if (!printWindow) {
    window.alert(
      options.t(
        "Reports.PrintPopupBlocked",
        "Браузер заблокировал окно печати. Разрешите всплывающие окна для Web Office."
      )
    );
    return;
  }

  printWindow.document.open();
  printWindow.document.write(
    buildSpisSirBludPrintHtml(options)
  );
  printWindow.document.close();
  printWindow.focus();
  closePrintWindowAfterPrint(printWindow);

  window.setTimeout(() => {
    printWindow.print();
  }, 150);
}

function safeSpisSirBludFilePart(value) {
  return String(value ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

function buildSpisSirBludExportModel({
  rows,
  dateFrom,
  dateTo,
  departmentName,
  locale,
  t
}) {
  const exportRows =
    sortSpisSirBludRows(rows).map(
      (row) => ({
        Product: row?.NameTov || "",
        Quantity:
          numericValue(row?.Kolvo) === 0
            ? ""
            : row?.Kolvo,
        Price:
          numericValue(row?.Kolvo) === 0
            ? ""
            : spisSirBludPrice(row),
        Amount:
          numericValue(row?.Summ) === 0
            ? ""
            : row?.Summ
      })
    );

  const totals =
    spisSirBludTotals(rows);

  return {
    title: `${t(
      "SpisSirBlud.Title",
      "Списание сырья в блюдах"
    )} ${formatReportDate(
      dateFrom
    )} — ${formatReportDate(dateTo)}`,
    fileName: `SpisSirBlud_${safeSpisSirBludFilePart(
      dateFrom
    )}_${safeSpisSirBludFilePart(
      dateTo
    )}_${safeSpisSirBludFilePart(
      departmentName || "warehouse"
    )}`,
    orientation: "portrait",
    locale,
    meta: [
      {
        label: t(
          "SpisSirBlud.Warehouse",
          "Склад"
        ),
        value: departmentName || ""
      }
    ],
    columns: [
      {
        key: "Product",
        title: t(
          "SpisSirBlud.Product",
          "Сырье"
        ),
        type: "text",
        width: 38
      },
      {
        key: "Quantity",
        title: t(
          "SpisSirBlud.Quantity",
          "Количество"
        ),
        type: "number",
        decimals: 3,
        width: 14
      },
      {
        key: "Price",
        title: t(
          "SpisSirBlud.Price",
          "Цена"
        ),
        type: "number",
        decimals: 2,
        width: 14
      },
      {
        key: "Amount",
        title: t(
          "SpisSirBlud.Amount",
          "Сумма"
        ),
        type: "number",
        decimals: 2,
        width: 15
      }
    ],
    rows: exportRows,
    footerRows: [
      {
        label: t(
          "Common.Total",
          "Итого"
        ),
        values: {
          Quantity: totals.Kolvo,
          Amount: totals.Summ
        }
      }
    ]
  };
}

function SpisSirBludReport({
  data,
  dateFrom,
  dateTo,
  departmentName,
  locale,
  fetchWithAuth,
  t,
  onReload
}) {
  const rows = getSpisSirBludRows(data);
  const formatter =
    createMoneyFormatter(locale);

  const commonOptions = {
    rows,
    dateFrom,
    dateTo,
    departmentName,
    locale,
    t
  };

  async function handleExport(format) {
    try {
      await exportReportFile({
        fetchWithAuth,
        reportModel:
          buildSpisSirBludExportModel(
            commonOptions
          ),
        format,
        errorMessage: t(
          "Report.ExportError",
          "Ошибка экспорта отчёта."
        )
      });
    } catch (err) {
      window.alert(
        err?.message ||
          t(
            "Report.ExportError",
            "Ошибка экспорта отчёта."
          )
      );
    }
  }

  return (
    <div className="reports-page spissirblud-report-page">
      <div className="report-toolbar">
        <button
          type="button"
          className="report-run-button"
          onClick={onReload}
        >
          {t(
            "Common.Generate",
            "Сформировать"
          )}
        </button>

        <button
          type="button"
          className="report-action-button report-print-button"
          onClick={() =>
            printSpisSirBludReport(
              commonOptions
            )
          }
        >
          {t("Common.Print", "Печать")}
        </button>

        <button
          type="button"
          className="report-action-button report-excel-button"
          onClick={() =>
            handleExport("xlsx")
          }
        >
          {t("Common.Excel", "Excel")}
        </button>

        <button
          type="button"
          className="report-action-button report-word-button"
          onClick={() =>
            handleExport("docx")
          }
        >
          {t("Common.Word", "Word")}
        </button>
      </div>

      <article className="revenue-report-sheet spissirblud-report-sheet">
        <header className="spissirblud-report-heading">
          <h3>
            {t(
              "SpisSirBlud.Title",
              "Списание сырья в блюдах"
            )}{" "}
            {t("Common.From", "с")}{" "}
            {formatReportDate(dateFrom)}{" "}
            {t("Common.To", "по")}{" "}
            {formatReportDate(dateTo)}
          </h3>

          <div className="spissirblud-warehouse">
            {departmentName || ""}
          </div>
        </header>

        {rows.length > 0 ? (
          <SpisSirBludReportTable
            rows={rows}
            formatter={formatter}
            t={t}
          />
        ) : (
          <div className="report-empty">
            {t(
              "Reports.NoDataForPeriod",
              "За выбранный период данных нет."
            )}
          </div>
        )}
      </article>
    </div>
  );
}


function getTovOtchDataset(
  data,
  ...names
) {
  const sources = [
    data?.data,
    data?.Data,
    data?.result,
    data?.Result,
    data
  ].filter(
    (source) =>
      source &&
      typeof source === "object"
  );

  for (const source of sources) {
    for (const name of names) {
      const value =
        source?.[name];

      if (Array.isArray(value)) {
        return value;
      }
    }
  }

  return [];
}

function getTovOtchData(data) {
  const saldoRows =
    getTovOtchDataset(
      data,
      "Saldo",
      "saldo"
    );

  return {
    saldo:
      saldoRows[0] ?? {},
    prihodPost:
      getTovOtchDataset(
        data,
        "PrihodPost",
        "prihodPost"
      ),
    prihodFromPodrazd:
      getTovOtchDataset(
        data,
        "PrihodFromPodrazd",
        "prihodFromPodrazd"
      ),
    rashodToPodrazd:
      getTovOtchDataset(
        data,
        "RashodToPodrazd",
        "rashodToPodrazd"
      ),
    spisanoSirya:
      getTovOtchDataset(
        data,
        "SpisanoSirya",
        "spisanoSirya"
      )
  };
}

function tovOtchTotals(reportData) {
  const prihodPost =
    sumField(
      reportData.prihodPost,
      "Summ"
    );

  const prihodFromPodrazd =
    sumField(
      reportData.prihodFromPodrazd,
      "Summ"
    );

  const rashodToPodrazd =
    sumField(
      reportData.rashodToPodrazd,
      "Summ"
    );

  const spisanoSirya =
    sumField(
      reportData.spisanoSirya,
      "Summ"
    );

  const sumSald =
    numericValue(
      reportData.saldo?.SumSald
    );

  const sumFact =
    numericValue(
      reportData.saldo?.SumFact
    );

  const sumReal =
    numericValue(
      reportData.saldo?.SumReal
    );

  const sumSpisBl =
    numericValue(
      reportData.saldo?.SumSpisBl
    );

  const calculatedSaldo =
    sumSald +
    prihodPost +
    prihodFromPodrazd -
    rashodToPodrazd -
    sumReal -
    sumSpisBl -
    spisanoSirya;

  return {
    sumSald,
    sumFact,
    sumReal,
    sumSpisBl,
    prihodPost,
    prihodFromPodrazd,
    rashodToPodrazd,
    spisanoSirya,
    calculatedSaldo
  };
}

function tovOtchMoney(
  value,
  formatter,
  blankNull = false
) {
  if (
    blankNull &&
    (
      value === null ||
      value === undefined ||
      value === ""
    )
  ) {
    return "";
  }

  return formatter.format(
    numericValue(value)
  );
}

function TovOtchAmountLine({
  label,
  value,
  formatter,
  strong = false,
  calculated = false
}) {
  return (
    <div
      className={[
        "tovotch-amount-line",
        strong
          ? "tovotch-amount-line-strong"
          : "",
        calculated
          ? "tovotch-amount-line-calculated"
          : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span>{label}</span>
      <strong>
        {tovOtchMoney(
          value,
          formatter
        )}
      </strong>
    </div>
  );
}

function TovOtchSection({
  title,
  columns,
  rows,
  total,
  formatter,
  t
}) {
  return (
    <section className="tovotch-section">
      <h4>{title}</h4>

      <div className="report-table-scroll">
        <table className="report-table tovotch-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={
                    column.kind === "money" ||
                    column.kind === "number"
                      ? "report-money"
                      : "report-text"
                  }
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => (
              <tr
                key={`${title}-${index}`}
              >
                {columns.map((column) => {
                  const value =
                    column.value(row);

                  if (
                    column.kind === "money"
                  ) {
                    return (
                      <td
                        key={column.key}
                        className="report-money"
                      >
                        {tovOtchMoney(
                          value,
                          formatter,
                          true
                        )}
                      </td>
                    );
                  }

                  if (
                    column.kind === "number"
                  ) {
                    return (
                      <td
                        key={column.key}
                        className="report-money"
                      >
                        {value === null ||
                        value === undefined ||
                        value === ""
                          ? ""
                          : formatter.format(
                              numericValue(
                                value
                              )
                            )}
                      </td>
                    );
                  }

                  return (
                    <td
                      key={column.key}
                      className="report-text"
                    >
                      {String(
                        value ?? ""
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr>
              <td
                className="report-text report-total-label"
                colSpan={Math.max(
                  columns.length - 1,
                  1
                )}
              >
                {t(
                  "Common.Total",
                  "Итого"
                )}
              </td>

              <td className="report-money">
                {tovOtchMoney(
                  total,
                  formatter
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function buildTovOtchPrintHtml({
  reportData,
  totals,
  dateFrom,
  dateTo,
  departmentName,
  locale,
  t
}) {
  const formatter =
    createMoneyFormatter(locale);

  const amountLine = (
    label,
    value,
    className = ""
  ) => `
<div class="amount-line ${className}">
  <span>${escapeHtml(label)}</span>
  <strong>${escapeHtml(
    tovOtchMoney(
      value,
      formatter
    )
  )}</strong>
</div>`;

  const tableHtml = (
    title,
    columns,
    rows,
    total
  ) => {
    const header = columns
      .map(
        (column) =>
          `<th class="${
            column.kind === "text"
              ? "text"
              : "number"
          }">${escapeHtml(
            column.label
          )}</th>`
      )
      .join("");

    const body = rows
      .map((row) => {
        return `<tr>${columns
          .map((column) => {
            const value =
              column.value(row);

            if (
              column.kind === "money"
            ) {
              return `<td class="number">${escapeHtml(
                tovOtchMoney(
                  value,
                  formatter,
                  true
                )
              )}</td>`;
            }

            if (
              column.kind === "number"
            ) {
              return `<td class="number">${escapeHtml(
                value === null ||
                value === undefined ||
                value === ""
                  ? ""
                  : formatter.format(
                      numericValue(
                        value
                      )
                    )
              )}</td>`;
            }

            return `<td class="text">${escapeHtml(
              String(value ?? "")
            )}</td>`;
          })
          .join("")}</tr>`;
      })
      .join("");

    return `
<section class="report-section">
  <h2>${escapeHtml(title)}</h2>
  <table>
    <thead><tr>${header}</tr></thead>
    <tbody>${body}</tbody>
    <tfoot>
      <tr>
        <td class="text" colspan="${Math.max(
          columns.length - 1,
          1
        )}">${escapeHtml(
          t(
            "Common.Total",
            "Итого"
          )
        )}</td>
        <td class="number">${escapeHtml(
          tovOtchMoney(
            total,
            formatter
          )
        )}</td>
      </tr>
    </tfoot>
  </table>
</section>`;
  };

  const title = `${t(
    "TovOtch.Title",
    "Товарный отчет за период"
  )} ${t(
    "Common.From",
    "с"
  )} ${formatReportDate(
    dateFrom
  )} ${t(
    "Common.To",
    "по"
  )} ${formatReportDate(
    dateTo
  )}`;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
@page { size: A4 portrait; margin: 9mm 10mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; color: #111; font-size: 8pt; }
.header { margin-bottom: 4mm; }
h1 { margin: 0; font-size: 12.5pt; font-style: italic; font-weight: 700; }
.warehouse { margin-top: 1mm; font-size: 8pt; font-weight: 700; }
.amount-line {
  display: flex;
  justify-content: space-between;
  gap: 8mm;
  padding: 1.7mm 2mm;
  margin: 1.5mm 0;
  border: 0.2mm solid #d7ddd4;
  background: #f7f9f5;
  font-weight: 700;
}
.amount-line.final {
  border-color: #aab6a6;
  background: #edf3e9;
  font-size: 9pt;
}
.report-section { margin: 3mm 0 4mm; }
.report-section h2 { margin: 0 0 1.4mm; font-size: 9pt; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
thead { display: table-header-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
th {
  padding: 0.7mm 0.7mm;
  border-bottom: 0.2mm solid #555;
  font-size: 6.8pt;
  vertical-align: bottom;
}
td {
  padding: 0.65mm 0.7mm;
  border-bottom: 0.1mm dotted #c8cecc;
  font-size: 7.1pt;
}
.text { text-align: left; overflow-wrap: anywhere; }
.number { text-align: right; white-space: nowrap; }
tfoot td {
  border-top: 0.2mm solid #666;
  border-bottom: 0;
  background: #f3f6f2;
  font-weight: 700;
}
</style>
</head>
<body>
<div class="header">
  <h1>${escapeHtml(title)}</h1>
  <div class="warehouse">${escapeHtml(
    departmentName || ""
  )}</div>
</div>

${amountLine(
  t(
    "TovOtch.OpeningBalance",
    "Сальдо на начало"
  ),
  totals.sumSald
)}

${tableHtml(
  t(
    "TovOtch.PrihodPost",
    "Приход за период"
  ),
  [
    {
      label: t(
        "TovOtch.Date",
        "Дата"
      ),
      kind: "text",
      value: (row) =>
        formatReportDate(
          row?.DatePrih
        )
    },
    {
      label: t(
        "TovOtch.Supplier",
        "Поставщик"
      ),
      kind: "text",
      value: (row) =>
        row?.Postav ?? ""
    },
    {
      label: t(
        "TovOtch.PaymentForm",
        "Форма оплаты"
      ),
      kind: "text",
      value: (row) =>
        row?.FormaOpl ?? ""
    },
    {
      label: t(
        "TovOtch.Amount",
        "Сумма"
      ),
      kind: "money",
      value: (row) =>
        row?.Summ
    }
  ],
  reportData.prihodPost,
  totals.prihodPost
)}

${tableHtml(
  t(
    "TovOtch.PrihodFromDepartments",
    "Приход с других подразделений"
  ),
  [
    {
      label: t(
        "TovOtch.Date",
        "Дата"
      ),
      kind: "text",
      value: (row) =>
        formatReportDate(
          row?.DatePrih
        )
    },
    {
      label: t(
        "TovOtch.FromDepartment",
        "Из подразделения"
      ),
      kind: "text",
      value: (row) =>
        row?.PeremeschenoFrom ?? ""
    },
    {
      label: t(
        "TovOtch.Amount",
        "Сумма"
      ),
      kind: "money",
      value: (row) =>
        row?.Summ
    }
  ],
  reportData.prihodFromPodrazd,
  totals.prihodFromPodrazd
)}

${tableHtml(
  t(
    "TovOtch.RashodToDepartments",
    "Расход на другие подразделения"
  ),
  [
    {
      label: t(
        "TovOtch.Date",
        "Дата"
      ),
      kind: "text",
      value: (row) =>
        formatReportDate(
          row?.DateRash
        )
    },
    {
      label: t(
        "TovOtch.ToDepartment",
        "В подразделение"
      ),
      kind: "text",
      value: (row) =>
        row?.PeremeschTo ?? ""
    },
    {
      label: t(
        "TovOtch.Amount",
        "Сумма"
      ),
      kind: "money",
      value: (row) =>
        row?.Summ
    }
  ],
  reportData.rashodToPodrazd,
  totals.rashodToPodrazd
)}

${amountLine(
  t(
    "TovOtch.Realized",
    "Реализовано"
  ),
  totals.sumReal
)}

${tableHtml(
  t(
    "TovOtch.SpisanoSirya",
    "Списано сырья"
  ),
  [
    {
      label: t(
        "TovOtch.Reason",
        "Причина"
      ),
      kind: "text",
      value: (row) =>
        row?.Zatr ?? ""
    },
    {
      label: t(
        "TovOtch.Quantity",
        "Количество"
      ),
      kind: "number",
      value: (row) =>
        row?.Kolvo
    },
    {
      label: t(
        "TovOtch.Amount",
        "Сумма"
      ),
      kind: "money",
      value: (row) =>
        row?.Summ
    }
  ],
  reportData.spisanoSirya,
  totals.spisanoSirya
)}

${amountLine(
  t(
    "TovOtch.SpisanoBlud",
    "Списано блюд"
  ),
  totals.sumSpisBl
)}

${amountLine(
  t(
    "TovOtch.ClosingBalance",
    "Сальдо на конец"
  ),
  totals.sumFact
)}

${amountLine(
  t(
    "TovOtch.CalculatedBalance",
    "Расчетное сальдо"
  ),
  totals.calculatedSaldo,
  "final"
)}
</body>
</html>`;
}

function printTovOtchReport(options) {
  const printWindow = window.open(
    "",
    "_blank",
    "width=1050,height=900"
  );

  if (!printWindow) {
    window.alert(
      options.t(
        "Reports.PrintPopupBlocked",
        "Браузер заблокировал окно печати. Разрешите всплывающие окна для Web Office."
      )
    );
    return;
  }

  printWindow.document.open();
  printWindow.document.write(
    buildTovOtchPrintHtml(options)
  );
  printWindow.document.close();
  printWindow.focus();
  closePrintWindowAfterPrint(
    printWindow
  );

  window.setTimeout(() => {
    printWindow.print();
  }, 150);
}

function safeTovOtchFilePart(value) {
  return String(value ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

function buildTovOtchExportModel({
  reportData,
  totals,
  dateFrom,
  dateTo,
  departmentName,
  locale,
  t
}) {
  const rows = [];

  const pushAmountLine = (
    operation,
    amount
  ) => {
    rows.push({
      Operation: operation,
      Date: "",
      Description: "",
      Payment: "",
      Quantity: "",
      Amount: amount
    });
  };

  const pushTotal = (
    operation,
    amount
  ) => {
    rows.push({
      Operation: `${t(
        "Common.Total",
        "Итого"
      )}: ${operation}`,
      Date: "",
      Description: "",
      Payment: "",
      Quantity: "",
      Amount: amount
    });
  };

  pushAmountLine(
    t(
      "TovOtch.OpeningBalance",
      "Сальдо на начало"
    ),
    totals.sumSald
  );

  for (
    const row of reportData.prihodPost
  ) {
    rows.push({
      Operation: t(
        "TovOtch.PrihodPost",
        "Приход за период"
      ),
      Date: formatReportDate(
        row?.DatePrih
      ),
      Description:
        row?.Postav ?? "",
      Payment:
        row?.FormaOpl ?? "",
      Quantity: "",
      Amount:
        row?.Summ ?? ""
    });
  }

  pushTotal(
    t(
      "TovOtch.PrihodPost",
      "Приход за период"
    ),
    totals.prihodPost
  );

  for (
    const row of
      reportData.prihodFromPodrazd
  ) {
    rows.push({
      Operation: t(
        "TovOtch.PrihodFromDepartments",
        "Приход с других подразделений"
      ),
      Date: formatReportDate(
        row?.DatePrih
      ),
      Description:
        row?.PeremeschenoFrom ?? "",
      Payment: "",
      Quantity: "",
      Amount:
        row?.Summ ?? ""
    });
  }

  pushTotal(
    t(
      "TovOtch.PrihodFromDepartments",
      "Приход с других подразделений"
    ),
    totals.prihodFromPodrazd
  );

  for (
    const row of
      reportData.rashodToPodrazd
  ) {
    rows.push({
      Operation: t(
        "TovOtch.RashodToDepartments",
        "Расход на другие подразделения"
      ),
      Date: formatReportDate(
        row?.DateRash
      ),
      Description:
        row?.PeremeschTo ?? "",
      Payment: "",
      Quantity: "",
      Amount:
        row?.Summ ?? ""
    });
  }

  pushTotal(
    t(
      "TovOtch.RashodToDepartments",
      "Расход на другие подразделения"
    ),
    totals.rashodToPodrazd
  );

  pushAmountLine(
    t(
      "TovOtch.Realized",
      "Реализовано"
    ),
    totals.sumReal
  );

  for (
    const row of reportData.spisanoSirya
  ) {
    rows.push({
      Operation: t(
        "TovOtch.SpisanoSirya",
        "Списано сырья"
      ),
      Date: "",
      Description:
        row?.Zatr ?? "",
      Payment: "",
      Quantity:
        row?.Kolvo ?? "",
      Amount:
        row?.Summ ?? ""
    });
  }

  pushTotal(
    t(
      "TovOtch.SpisanoSirya",
      "Списано сырья"
    ),
    totals.spisanoSirya
  );

  pushAmountLine(
    t(
      "TovOtch.SpisanoBlud",
      "Списано блюд"
    ),
    totals.sumSpisBl
  );

  pushAmountLine(
    t(
      "TovOtch.ClosingBalance",
      "Сальдо на конец"
    ),
    totals.sumFact
  );

  pushAmountLine(
    t(
      "TovOtch.CalculatedBalance",
      "Расчетное сальдо"
    ),
    totals.calculatedSaldo
  );

  return {
    title: `${t(
      "TovOtch.Title",
      "Товарный отчет за период"
    )} ${formatReportDate(
      dateFrom
    )} — ${formatReportDate(
      dateTo
    )}`,
    fileName: `TovOtch_${safeTovOtchFilePart(
      dateFrom
    )}_${safeTovOtchFilePart(
      dateTo
    )}_${safeTovOtchFilePart(
      departmentName || "warehouse"
    )}`,
    orientation: "portrait",
    locale,
    meta: [
      {
        label: t(
          "TovOtch.Warehouse",
          "Склад"
        ),
        value:
          departmentName || ""
      }
    ],
    columns: [
      {
        key: "Operation",
        title: t(
          "TovOtch.Operation",
          "Операция"
        ),
        type: "text",
        width: 24
      },
      {
        key: "Date",
        title: t(
          "TovOtch.Date",
          "Дата"
        ),
        type: "text",
        width: 12
      },
      {
        key: "Description",
        title: t(
          "TovOtch.Description",
          "Наименование / подразделение / причина"
        ),
        type: "text",
        width: 32
      },
      {
        key: "Payment",
        title: t(
          "TovOtch.PaymentForm",
          "Форма оплаты"
        ),
        type: "text",
        width: 15
      },
      {
        key: "Quantity",
        title: t(
          "TovOtch.Quantity",
          "Количество"
        ),
        type: "number",
        decimals: 2,
        width: 12
      },
      {
        key: "Amount",
        title: t(
          "TovOtch.Amount",
          "Сумма"
        ),
        type: "number",
        decimals: 2,
        width: 14
      }
    ],
    rows,
    footerRows: []
  };
}

function TovOtchReport({
  data,
  dateFrom,
  dateTo,
  departmentName,
  locale,
  fetchWithAuth,
  t,
  onReload
}) {
  const reportData =
    getTovOtchData(data);

  const totals =
    tovOtchTotals(reportData);

  const formatter =
    createMoneyFormatter(locale);

  const commonOptions = {
    reportData,
    totals,
    dateFrom,
    dateTo,
    departmentName,
    locale,
    t
  };

  const prihodPostColumns = [
    {
      key: "date",
      label: t(
        "TovOtch.Date",
        "Дата"
      ),
      kind: "text",
      value: (row) =>
        formatReportDate(
          row?.DatePrih
        )
    },
    {
      key: "supplier",
      label: t(
        "TovOtch.Supplier",
        "Поставщик"
      ),
      kind: "text",
      value: (row) =>
        row?.Postav ?? ""
    },
    {
      key: "payment",
      label: t(
        "TovOtch.PaymentForm",
        "Форма оплаты"
      ),
      kind: "text",
      value: (row) =>
        row?.FormaOpl ?? ""
    },
    {
      key: "amount",
      label: t(
        "TovOtch.Amount",
        "Сумма"
      ),
      kind: "money",
      value: (row) =>
        row?.Summ
    }
  ];

  const prihodFromColumns = [
    {
      key: "date",
      label: t(
        "TovOtch.Date",
        "Дата"
      ),
      kind: "text",
      value: (row) =>
        formatReportDate(
          row?.DatePrih
        )
    },
    {
      key: "from",
      label: t(
        "TovOtch.FromDepartment",
        "Из подразделения"
      ),
      kind: "text",
      value: (row) =>
        row?.PeremeschenoFrom ?? ""
    },
    {
      key: "amount",
      label: t(
        "TovOtch.Amount",
        "Сумма"
      ),
      kind: "money",
      value: (row) =>
        row?.Summ
    }
  ];

  const rashodToColumns = [
    {
      key: "date",
      label: t(
        "TovOtch.Date",
        "Дата"
      ),
      kind: "text",
      value: (row) =>
        formatReportDate(
          row?.DateRash
        )
    },
    {
      key: "to",
      label: t(
        "TovOtch.ToDepartment",
        "В подразделение"
      ),
      kind: "text",
      value: (row) =>
        row?.PeremeschTo ?? ""
    },
    {
      key: "amount",
      label: t(
        "TovOtch.Amount",
        "Сумма"
      ),
      kind: "money",
      value: (row) =>
        row?.Summ
    }
  ];

  const spisanoSiryaColumns = [
    {
      key: "reason",
      label: t(
        "TovOtch.Reason",
        "Причина"
      ),
      kind: "text",
      value: (row) =>
        row?.Zatr ?? ""
    },
    {
      key: "quantity",
      label: t(
        "TovOtch.Quantity",
        "Количество"
      ),
      kind: "number",
      value: (row) =>
        row?.Kolvo
    },
    {
      key: "amount",
      label: t(
        "TovOtch.Amount",
        "Сумма"
      ),
      kind: "money",
      value: (row) =>
        row?.Summ
    }
  ];

  async function handleExport(format) {
    try {
      await exportReportFile({
        fetchWithAuth,
        reportModel:
          buildTovOtchExportModel(
            commonOptions
          ),
        format,
        errorMessage: t(
          "Report.ExportError",
          "Ошибка экспорта отчёта."
        )
      });
    } catch (err) {
      window.alert(
        err?.message ||
          t(
            "Report.ExportError",
            "Ошибка экспорта отчёта."
          )
      );
    }
  }

  return (
    <div className="reports-page tovotch-report-page">
      <div className="report-toolbar">
        <button
          type="button"
          className="report-run-button"
          onClick={onReload}
        >
          {t(
            "Common.Generate",
            "Сформировать"
          )}
        </button>

        <button
          type="button"
          className="report-action-button report-print-button"
          onClick={() =>
            printTovOtchReport(
              commonOptions
            )
          }
        >
          {t(
            "Common.Print",
            "Печать"
          )}
        </button>

        <button
          type="button"
          className="report-action-button report-excel-button"
          onClick={() =>
            handleExport("xlsx")
          }
        >
          {t(
            "Common.Excel",
            "Excel"
          )}
        </button>

        <button
          type="button"
          className="report-action-button report-word-button"
          onClick={() =>
            handleExport("docx")
          }
        >
          {t(
            "Common.Word",
            "Word"
          )}
        </button>
      </div>

      <article className="revenue-report-sheet tovotch-report-sheet">
        <header className="tovotch-report-heading">
          <h3>
            {t(
              "TovOtch.Title",
              "Товарный отчет за период"
            )}{" "}
            {t(
              "Common.From",
              "с"
            )}{" "}
            {formatReportDate(
              dateFrom
            )}{" "}
            {t(
              "Common.To",
              "по"
            )}{" "}
            {formatReportDate(
              dateTo
            )}
          </h3>

          {departmentName && (
            <div className="tovotch-warehouse">
              {departmentName}
            </div>
          )}
        </header>

        <TovOtchAmountLine
          label={t(
            "TovOtch.OpeningBalance",
            "Сальдо на начало"
          )}
          value={totals.sumSald}
          formatter={formatter}
          strong
        />

        <TovOtchSection
          title={t(
            "TovOtch.PrihodPost",
            "Приход за период"
          )}
          columns={
            prihodPostColumns
          }
          rows={
            reportData.prihodPost
          }
          total={
            totals.prihodPost
          }
          formatter={formatter}
          t={t}
        />

        <TovOtchSection
          title={t(
            "TovOtch.PrihodFromDepartments",
            "Приход с других подразделений"
          )}
          columns={
            prihodFromColumns
          }
          rows={
            reportData.prihodFromPodrazd
          }
          total={
            totals.prihodFromPodrazd
          }
          formatter={formatter}
          t={t}
        />

        <TovOtchSection
          title={t(
            "TovOtch.RashodToDepartments",
            "Расход на другие подразделения"
          )}
          columns={
            rashodToColumns
          }
          rows={
            reportData.rashodToPodrazd
          }
          total={
            totals.rashodToPodrazd
          }
          formatter={formatter}
          t={t}
        />

        <TovOtchAmountLine
          label={t(
            "TovOtch.Realized",
            "Реализовано"
          )}
          value={totals.sumReal}
          formatter={formatter}
          strong
        />

        <TovOtchSection
          title={t(
            "TovOtch.SpisanoSirya",
            "Списано сырья"
          )}
          columns={
            spisanoSiryaColumns
          }
          rows={
            Array.isArray(
              reportData.spisanoSirya
            )
              ? reportData.spisanoSirya
              : []
          }
          total={
            totals.spisanoSirya
          }
          formatter={formatter}
          t={t}
        />

        <TovOtchAmountLine
          label={t(
            "TovOtch.SpisanoBlud",
            "Списано блюд"
          )}
          value={totals.sumSpisBl}
          formatter={formatter}
          strong
        />

        <TovOtchAmountLine
          label={t(
            "TovOtch.ClosingBalance",
            "Сальдо на конец"
          )}
          value={totals.sumFact}
          formatter={formatter}
          strong
        />

        <TovOtchAmountLine
          label={t(
            "TovOtch.CalculatedBalance",
            "Расчетное сальдо"
          )}
          value={
            totals.calculatedSaldo
          }
          formatter={formatter}
          strong
          calculated
        />
      </article>
    </div>
  );
}


function normalizeSupplierMovementRows(data) {
  if (Array.isArray(data)) {
    return data;
  }

  const candidates = [
    data?.data,
    data?.Data,
    data?.Postav,
    data?.postav,
    data?.data?.Postav,
    data?.data?.postav,
    data?.Data?.Postav,
    data?.Data?.postav
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
}

function supplierBooleanValue(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  const text = String(value ?? "")
    .trim()
    .toLowerCase();

  return [
    "1",
    "true",
    "yes",
    "y",
    "да"
  ].includes(text);
}

function supplierDisplayMoney(
  value,
  formatter,
  blankNull = true
) {
  if (
    blankNull &&
    (
      value === null ||
      value === undefined ||
      value === ""
    )
  ) {
    return "";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "";
  }

  return formatter.format(number);
}

function supplierEscapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildSupplierCardXml({
  dateFrom,
  dateTo,
  organizationId,
  all,
  departmentId,
  idPost
}) {
  return `<Report><Date1>${supplierEscapeXml(
    dateFrom
  )}</Date1><Date2>${supplierEscapeXml(
    dateTo
  )}</Date2><Org>${supplierEscapeXml(
    organizationId
  )}</Org><All>${supplierEscapeXml(
    all
  )}</All><Skl>${supplierEscapeXml(
    departmentId
  )}</Skl><IdKli>0</IdKli><IdPost>${supplierEscapeXml(
    idPost
  )}</IdPost></Report>`;
}

function getSupplierCardData(data) {
  const payload =
    data?.data ??
    data?.Data ??
    data ??
    {};

  return {
    saldo: normalizeRows(
      payload?.Saldo ??
      payload?.saldo
    )[0] ?? {},
    prihod: normalizeRows(
      payload?.Prihod ??
      payload?.prihod
    ),
    oplata: normalizeRows(
      payload?.Oplata ??
      payload?.oplata
    )
  };
}

function supplierPaymentBucket(value) {
  const text = String(value ?? "")
    .trim()
    .toLowerCase();

  if (
    text.includes("безнал") ||
    text.includes("без/нал") ||
    text.includes("cashless") ||
    text.includes("non-cash") ||
    text.includes("noncash")
  ) {
    return "cashless";
  }

  if (
    text.includes("налич") ||
    text === "cash"
  ) {
    return "cash";
  }

  return "";
}

function splitSupplierPrihod(prihod) {
  return prihod.reduce(
    (result, row) => {
      const hasSplitFields =
        Object.prototype.hasOwnProperty.call(
          row ?? {},
          "Summ1"
        ) ||
        Object.prototype.hasOwnProperty.call(
          row ?? {},
          "Summ2"
        );

      if (hasSplitFields) {
        result.cash += numericValue(
          row?.Summ1
        );
        result.cashless += numericValue(
          row?.Summ2
        );
        return result;
      }

      const amount = numericValue(
        row?.Summ
      );
      const bucket = supplierPaymentBucket(
        row?.FormaOpl
      );

      if (bucket === "cashless") {
        result.cashless += amount;
      } else if (bucket === "cash") {
        result.cash += amount;
      }

      return result;
    },
    {
      cash: 0,
      cashless: 0
    }
  );
}

function splitSupplierOplata(oplata) {
  return oplata.reduce(
    (result, row) => {
      const hasSplitFields =
        Object.prototype.hasOwnProperty.call(
          row ?? {},
          "Summ1"
        ) ||
        Object.prototype.hasOwnProperty.call(
          row ?? {},
          "Summ2"
        );

      if (hasSplitFields) {
        result.cash += numericValue(
          row?.Summ1
        );
        result.cashless += numericValue(
          row?.Summ2
        );
        return result;
      }

      const amount = numericValue(
        row?.Summ
      );
      const bucket = supplierPaymentBucket(
        row?.FormaOpl
      );

      if (bucket === "cashless") {
        result.cashless += amount;
      } else if (bucket === "cash") {
        result.cash += amount;
      }

      return result;
    },
    {
      cash: 0,
      cashless: 0
    }
  );
}

function supplierCardSummary(cardData) {
  const prihod = splitSupplierPrihod(
    cardData.prihod
  );
  const oplata = splitSupplierOplata(
    cardData.oplata
  );

  const openingCash = numericValue(
    cardData.saldo?.Dolg1
  );
  const openingCashless = numericValue(
    cardData.saldo?.Dolg2
  );

  return {
    openingCash,
    openingCashless,
    prihodCash: prihod.cash,
    prihodCashless: prihod.cashless,
    oplataCash: oplata.cash,
    oplataCashless: oplata.cashless,
    closingCash:
      openingCash +
      prihod.cash -
      oplata.cash,
    closingCashless:
      openingCashless +
      prihod.cashless -
      oplata.cashless
  };
}

function supplierReportPeriodTitle({
  baseTitle,
  dateFrom,
  dateTo,
  t
}) {
  return `${baseTitle} ${t(
    "Common.From",
    "с"
  )} ${formatReportDate(
    dateFrom
  )} ${t(
    "Common.To",
    "по"
  )} ${formatReportDate(dateTo)}`;
}

function SupplierBalanceSummary({
  summary,
  formatter,
  t
}) {
  const rows = [
    {
      label: t(
        "PostavMovements.OpeningBalance",
        "Сальдо на начало"
      ),
      cash: summary.openingCash,
      cashless: summary.openingCashless
    },
    {
      label: t(
        "PostavMovements.Receipts",
        "Приход"
      ),
      cash: summary.prihodCash,
      cashless: summary.prihodCashless
    },
    {
      label: t(
        "PostavMovements.Payments",
        "Оплата"
      ),
      cash: summary.oplataCash,
      cashless: summary.oplataCashless
    },
    {
      label: t(
        "PostavMovements.ClosingBalance",
        "Сальдо на конец"
      ),
      cash: summary.closingCash,
      cashless: summary.closingCashless,
      closing: true
    }
  ];

  return (
    <div className="supplier-card-summary-wrap">
      <table className="report-table supplier-card-summary-table">
        <thead>
          <tr>
            <th className="report-text" />
            <th className="report-money">
              {t(
                "PostavMovements.Cash",
                "Наличные"
              )}
            </th>
            <th className="report-money">
              {t(
                "PostavMovements.Cashless",
                "Безналичные"
              )}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.label}
              className={
                row.closing
                  ? "supplier-card-summary-closing"
                  : ""
              }
            >
              <td className="report-text">
                {row.label}
              </td>
              <td className="report-money">
                {supplierDisplayMoney(
                  row.cash,
                  formatter,
                  false
                )}
              </td>
              <td className="report-money">
                {supplierDisplayMoney(
                  row.cashless,
                  formatter,
                  false
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SupplierPaymentsTable({
  rows,
  formatter,
  t
}) {
  return (
    <section className="supplier-card-section">
      <h4>
        {t(
          "PostavMovements.Payments",
          "Оплата"
        )}
      </h4>
      <div className="report-table-scroll">
        <table className="report-table supplier-card-table supplier-payment-table">
          <thead>
            <tr>
              <th className="report-text">
                {t(
                  "PostavMovements.Date",
                  "Дата"
                )}
              </th>
              <th className="report-text">
                {t(
                  "PostavMovements.PaymentForm",
                  "Форма оплаты"
                )}
              </th>
              <th className="report-text">
                {t(
                  "PostavMovements.Note",
                  "Примечание"
                )}
              </th>
              <th className="report-money">
                {t(
                  "PostavMovements.Cash",
                  "Наличные"
                )}
              </th>
              <th className="report-money">
                {t(
                  "PostavMovements.Cashless",
                  "Безналичные"
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row?.DateOpl ?? "opl"}-${index}`}>
                <td className="report-text">
                  {formatReportDate(
                    row?.DateOpl
                  )}
                </td>
                <td className="report-text">
                  {row?.FormaOpl ?? ""}
                </td>
                <td className="report-text">
                  {row?.Rem ?? ""}
                </td>
                <td className="report-money">
                  {supplierDisplayMoney(
                    row?.Summ1,
                    formatter
                  )}
                </td>
                <td className="report-money">
                  {supplierDisplayMoney(
                    row?.Summ2,
                    formatter
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SupplierShortPrihodTable({
  rows,
  formatter,
  t
}) {
  return (
    <section className="supplier-card-section">
      <h4>
        {t(
          "PostavMovements.Receipts",
          "Приход"
        )}
      </h4>
      <div className="report-table-scroll">
        <table className="report-table supplier-card-table supplier-short-prihod-table">
          <thead>
            <tr>
              <th className="report-text">
                {t(
                  "PostavMovements.Date",
                  "Дата"
                )}
              </th>
              <th className="report-text">
                {t(
                  "PostavMovements.InvoiceNo",
                  "№ накладной"
                )}
              </th>
              <th className="report-money">
                {t(
                  "PostavMovements.Cash",
                  "Наличные"
                )}
              </th>
              <th className="report-money">
                {t(
                  "PostavMovements.Cashless",
                  "Безналичные"
                )}
              </th>
              <th className="report-money">
                {t(
                  "PostavMovements.PaidInvoice",
                  "Оплачено"
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row?.Number ?? "prih"}-${index}`}>
                <td className="report-text">
                  {formatReportDate(
                    row?.DatePrih
                  )}
                </td>
                <td className="report-text">
                  {row?.Number ?? ""}
                </td>
                <td className="report-money">
                  {supplierDisplayMoney(
                    row?.Summ1,
                    formatter
                  )}
                </td>
                <td className="report-money">
                  {supplierDisplayMoney(
                    row?.Summ2,
                    formatter
                  )}
                </td>
                <td className="report-money">
                  {supplierDisplayMoney(
                    row?.Oplacheno,
                    formatter
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SupplierExpandedPrihodTable({
  rows,
  formatter,
  t
}) {
  return (
    <section className="supplier-card-section">
      <h4>
        {t(
          "PostavMovements.Receipts",
          "Приход"
        )}
      </h4>
      <div className="report-table-scroll">
        <table className="report-table supplier-card-table supplier-expanded-prihod-table">
          <thead>
            <tr>
              <th className="report-text">
                {t(
                  "PostavMovements.Date",
                  "Дата"
                )}
              </th>
              <th className="report-text">
                {t(
                  "PostavMovements.InvoiceNo",
                  "№ накладной"
                )}
              </th>
              <th className="report-text">
                {t(
                  "PostavMovements.Item",
                  "Сырье"
                )}
              </th>
              <th className="report-money">
                {t(
                  "PostavMovements.Quantity",
                  "Количество"
                )}
              </th>
              <th className="report-money">
                {t(
                  "PostavMovements.Price",
                  "Цена"
                )}
              </th>
              <th className="report-money">
                {t(
                  "PostavMovements.Amount",
                  "Сумма"
                )}
              </th>
              <th className="report-text">
                {t(
                  "PostavMovements.PaymentForm",
                  "Форма оплаты"
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row?.IdNakl ?? row?.Number ?? "prih"}-${index}`}>
                <td className="report-text">
                  {formatReportDate(
                    row?.DatePrih
                  )}
                </td>
                <td className="report-text">
                  {row?.Number ?? ""}
                </td>
                <td className="report-text">
                  {row?.NameTov ?? ""}
                </td>
                <td className="report-money">
                  {supplierDisplayMoney(
                    row?.Kolvo,
                    formatter
                  )}
                </td>
                <td className="report-money">
                  {supplierDisplayMoney(
                    row?.Expr1,
                    formatter
                  )}
                </td>
                <td className="report-money">
                  {supplierDisplayMoney(
                    row?.Summ,
                    formatter
                  )}
                </td>
                <td className="report-text">
                  {row?.FormaOpl ?? ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function buildSupplierMainPrintHtml({
  rows,
  dateFrom,
  dateTo,
  formatter,
  serviceOnly,
  t
}) {
  const title = supplierReportPeriodTitle({
    baseTitle: t(
      "PostavMovements.Title",
      "Движения по поставщикам за период"
    ),
    dateFrom,
    dateTo,
    t
  });

  const bodyRows = rows
    .map(
      (row) => `
<tr>
  <td class="text">${escapeHtml(
    row?.NamePost ?? ""
  )}</td>
  <td class="number">${escapeHtml(
    supplierDisplayMoney(
      row?.Dolg1,
      formatter
    )
  )}</td>
  <td class="number">${escapeHtml(
    supplierDisplayMoney(
      row?.Polucceno1,
      formatter
    )
  )}</td>
  <td class="number">${escapeHtml(
    supplierDisplayMoney(
      row?.Oplata1,
      formatter
    )
  )}</td>
  <td class="number">${escapeHtml(
    supplierDisplayMoney(
      row?.DolgTek1,
      formatter
    )
  )}</td>
  <td class="number">${escapeHtml(
    supplierDisplayMoney(
      row?.Dolg2,
      formatter
    )
  )}</td>
  <td class="number">${escapeHtml(
    supplierDisplayMoney(
      row?.Polucceno2,
      formatter
    )
  )}</td>
  <td class="number">${escapeHtml(
    supplierDisplayMoney(
      row?.Oplata2,
      formatter
    )
  )}</td>
  <td class="number">${escapeHtml(
    supplierDisplayMoney(
      row?.DolgTek2,
      formatter
    )
  )}</td>
</tr>`
    )
    .join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
@page { size: A4 portrait; margin: 8mm 7mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; color: #111; font-size: 6.2pt; }
h1 { margin: 0 0 1.8mm; font-size: 11pt; font-style: italic; }
.scope { margin: 0 0 2.5mm; font-size: 7.2pt; font-weight: 700; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
thead { display: table-header-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
th, td { padding: 0.75mm 0.55mm; border-bottom: 0.1mm solid #c7cdca; }
th { background: #edf3f1; font-size: 5.9pt; font-weight: 700; line-height: 1.12; }
th.group { padding-top: 1.2mm; padding-bottom: 1.2mm; text-align: center; border-bottom: 0.2mm solid #888; }
.text { text-align: left; overflow-wrap: anywhere; }
.number { text-align: right; white-space: nowrap; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<div class="scope">${escapeHtml(
    serviceOnly
      ? t(
          "PostavMovements.Service",
          "Служебные"
        )
      : t(
          "PostavMovements.Regular",
          "Обычные"
        )
  )}</div>
<table>
  <colgroup>
    <col style="width:28%">
    <col span="8" style="width:9%">
  </colgroup>
  <thead>
    <tr>
      <th rowspan="2" class="text">${escapeHtml(
        t(
          "PostavMovements.Supplier",
          "Поставщик"
        )
      )}</th>
      <th colspan="4" class="group">${escapeHtml(
        t(
          "PostavMovements.Cash",
          "Наличные"
        )
      )}</th>
      <th colspan="4" class="group">${escapeHtml(
        t(
          "PostavMovements.Cashless",
          "Безналичные"
        )
      )}</th>
    </tr>
    <tr>
      <th>${escapeHtml(t("PostavMovements.Debt", "Долг"))}</th>
      <th>${escapeHtml(t("PostavMovements.Received", "Получ"))}</th>
      <th>${escapeHtml(t("PostavMovements.Paid", "Оплач"))}</th>
      <th>${escapeHtml(t("PostavMovements.Debt", "Долг"))}</th>
      <th>${escapeHtml(t("PostavMovements.Debt", "Долг"))}</th>
      <th>${escapeHtml(t("PostavMovements.Received", "Получ"))}</th>
      <th>${escapeHtml(t("PostavMovements.Paid", "Оплач"))}</th>
      <th>${escapeHtml(t("PostavMovements.Debt", "Долг"))}</th>
    </tr>
  </thead>
  <tbody>${bodyRows}</tbody>
</table>
</body>
</html>`;
}

function supplierSummaryPrintRows({
  summary,
  formatter,
  t
}) {
  const rows = [
    [
      t(
        "PostavMovements.OpeningBalance",
        "Сальдо на начало"
      ),
      summary.openingCash,
      summary.openingCashless,
      false
    ],
    [
      t(
        "PostavMovements.Receipts",
        "Приход"
      ),
      summary.prihodCash,
      summary.prihodCashless,
      false
    ],
    [
      t(
        "PostavMovements.Payments",
        "Оплата"
      ),
      summary.oplataCash,
      summary.oplataCashless,
      false
    ],
    [
      t(
        "PostavMovements.ClosingBalance",
        "Сальдо на конец"
      ),
      summary.closingCash,
      summary.closingCashless,
      true
    ]
  ];

  return rows
    .map(
      ([label, cash, cashless, closing]) => `
<tr class="${closing ? "closing" : ""}">
  <td class="text">${escapeHtml(label)}</td>
  <td class="number">${escapeHtml(
    supplierDisplayMoney(
      cash,
      formatter,
      false
    )
  )}</td>
  <td class="number">${escapeHtml(
    supplierDisplayMoney(
      cashless,
      formatter,
      false
    )
  )}</td>
</tr>`
    )
    .join("");
}

function buildSupplierCardPrintHtml({
  cardData,
  expanded,
  dateFrom,
  dateTo,
  formatter,
  t
}) {
  const summary = supplierCardSummary(
    cardData
  );
  const supplierName =
    cardData.saldo?.NamePost ?? "";
  const baseTitle = expanded
    ? t(
        "PostavMovements.ExpandedCardTitle",
        "Карточка поставщика развернуто за период"
      )
    : t(
        "PostavMovements.ShortCardTitle",
        "Карточка поставщика кратко за период"
      );
  const title = supplierReportPeriodTitle({
    baseTitle,
    dateFrom,
    dateTo,
    t
  });

  const prihodHeader = expanded
    ? `
<tr>
  <th class="text">${escapeHtml(t("PostavMovements.Date", "Дата"))}</th>
  <th class="text">${escapeHtml(t("PostavMovements.InvoiceNo", "№ накладной"))}</th>
  <th class="text">${escapeHtml(t("PostavMovements.Item", "Сырье"))}</th>
  <th class="number">${escapeHtml(t("PostavMovements.Quantity", "Количество"))}</th>
  <th class="number">${escapeHtml(t("PostavMovements.Price", "Цена"))}</th>
  <th class="number">${escapeHtml(t("PostavMovements.Amount", "Сумма"))}</th>
  <th class="text">${escapeHtml(t("PostavMovements.PaymentForm", "Форма оплаты"))}</th>
</tr>`
    : `
<tr>
  <th class="text">${escapeHtml(t("PostavMovements.Date", "Дата"))}</th>
  <th class="text">${escapeHtml(t("PostavMovements.InvoiceNo", "№ накладной"))}</th>
  <th class="number">${escapeHtml(t("PostavMovements.Cash", "Наличные"))}</th>
  <th class="number">${escapeHtml(t("PostavMovements.Cashless", "Безналичные"))}</th>
  <th class="number">${escapeHtml(t("PostavMovements.PaidInvoice", "Оплачено"))}</th>
</tr>`;

  const prihodBody = cardData.prihod
    .map((row) => {
      if (expanded) {
        return `
<tr>
  <td class="text">${escapeHtml(formatReportDate(row?.DatePrih))}</td>
  <td class="text">${escapeHtml(row?.Number ?? "")}</td>
  <td class="text">${escapeHtml(row?.NameTov ?? "")}</td>
  <td class="number">${escapeHtml(supplierDisplayMoney(row?.Kolvo, formatter))}</td>
  <td class="number">${escapeHtml(supplierDisplayMoney(row?.Expr1, formatter))}</td>
  <td class="number">${escapeHtml(supplierDisplayMoney(row?.Summ, formatter))}</td>
  <td class="text">${escapeHtml(row?.FormaOpl ?? "")}</td>
</tr>`;
      }

      return `
<tr>
  <td class="text">${escapeHtml(formatReportDate(row?.DatePrih))}</td>
  <td class="text">${escapeHtml(row?.Number ?? "")}</td>
  <td class="number">${escapeHtml(supplierDisplayMoney(row?.Summ1, formatter))}</td>
  <td class="number">${escapeHtml(supplierDisplayMoney(row?.Summ2, formatter))}</td>
  <td class="number">${escapeHtml(supplierDisplayMoney(row?.Oplacheno, formatter))}</td>
</tr>`;
    })
    .join("");

  const oplataBody = cardData.oplata
    .map(
      (row) => `
<tr>
  <td class="text">${escapeHtml(formatReportDate(row?.DateOpl))}</td>
  <td class="text">${escapeHtml(row?.FormaOpl ?? "")}</td>
  <td class="text">${escapeHtml(row?.Rem ?? "")}</td>
  <td class="number">${escapeHtml(supplierDisplayMoney(row?.Summ1, formatter))}</td>
  <td class="number">${escapeHtml(supplierDisplayMoney(row?.Summ2, formatter))}</td>
</tr>`
    )
    .join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
@page { size: A4 ${expanded ? "landscape" : "portrait"}; margin: 9mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; color: #111; font-size: 7.4pt; }
h1 { margin: 0; font-size: 12pt; font-style: italic; }
.supplier { margin: 1mm 0 3mm; font-size: 10pt; font-weight: 700; }
h2 { margin: 3mm 0 1mm; font-size: 9pt; }
table { width: 100%; border-collapse: collapse; table-layout: auto; }
thead { display: table-header-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
th, td { padding: 0.9mm 1mm; border-bottom: 0.1mm solid #c8cfcb; }
th { background: #edf3f1; font-size: 7pt; font-weight: 700; }
.text { text-align: left; }
.number { text-align: right; white-space: nowrap; }
.summary { width: 62%; margin-bottom: 3mm; }
.summary .closing td { background: #edf3e9; border-top: 0.2mm solid #85977e; font-weight: 700; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<div class="supplier">${escapeHtml(supplierName)}</div>
<table class="summary">
  <thead>
    <tr>
      <th class="text"></th>
      <th class="number">${escapeHtml(t("PostavMovements.Cash", "Наличные"))}</th>
      <th class="number">${escapeHtml(t("PostavMovements.Cashless", "Безналичные"))}</th>
    </tr>
  </thead>
  <tbody>${supplierSummaryPrintRows({ summary, formatter, t })}</tbody>
</table>
<h2>${escapeHtml(t("PostavMovements.Receipts", "Приход"))}</h2>
<table>
  <thead>${prihodHeader}</thead>
  <tbody>${prihodBody}</tbody>
</table>
<h2>${escapeHtml(t("PostavMovements.Payments", "Оплата"))}</h2>
<table>
  <thead>
    <tr>
      <th class="text">${escapeHtml(t("PostavMovements.Date", "Дата"))}</th>
      <th class="text">${escapeHtml(t("PostavMovements.PaymentForm", "Форма оплаты"))}</th>
      <th class="text">${escapeHtml(t("PostavMovements.Note", "Примечание"))}</th>
      <th class="number">${escapeHtml(t("PostavMovements.Cash", "Наличные"))}</th>
      <th class="number">${escapeHtml(t("PostavMovements.Cashless", "Безналичные"))}</th>
    </tr>
  </thead>
  <tbody>${oplataBody}</tbody>
</table>
</body>
</html>`;
}

function openSupplierPrintWindow(html, t) {
  const printWindow = window.open(
    "",
    "_blank",
    "width=1100,height=900"
  );

  if (!printWindow) {
    window.alert(
      t(
        "Reports.PrintPopupBlocked",
        "Браузер заблокировал окно печати. Разрешите всплывающие окна для Web Office."
      )
    );
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  closePrintWindowAfterPrint(printWindow);

  window.setTimeout(() => {
    printWindow.print();
  }, 150);
}

function buildSupplierMainExportModel({
  rows,
  dateFrom,
  dateTo,
  serviceOnly,
  t
}) {
  return {
    title: supplierReportPeriodTitle({
      baseTitle: t(
        "PostavMovements.Title",
        "Движения по поставщикам за период"
      ),
      dateFrom,
      dateTo,
      t
    }),
    fileName: `Postav_${String(dateFrom ?? "").replace(/[^0-9-]/g, "")}_${String(dateTo ?? "").replace(/[^0-9-]/g, "")}`,
    orientation: "portrait",
    meta: [
      {
        label: t(
          "PostavMovements.Service",
          "Служебные"
        ),
        value: serviceOnly
          ? t("Common.Yes", "Да")
          : t("Common.No", "Нет")
      }
    ],
    columns: [
      {
        key: "NamePost",
        title: t(
          "PostavMovements.Supplier",
          "Поставщик"
        ),
        type: "text",
        width: 26
      },
      {
        key: "Dolg1",
        title: `${t("PostavMovements.Cash", "Наличные")} — ${t("PostavMovements.Debt", "Долг")}`,
        type: "number",
        decimals: 2,
        width: 9
      },
      {
        key: "Polucceno1",
        title: `${t("PostavMovements.Cash", "Наличные")} — ${t("PostavMovements.Received", "Получ")}`,
        type: "number",
        decimals: 2,
        width: 9
      },
      {
        key: "Oplata1",
        title: `${t("PostavMovements.Cash", "Наличные")} — ${t("PostavMovements.Paid", "Оплач")}`,
        type: "number",
        decimals: 2,
        width: 9
      },
      {
        key: "DolgTek1",
        title: `${t("PostavMovements.Cash", "Наличные")} — ${t("PostavMovements.Debt", "Долг")}`,
        type: "number",
        decimals: 2,
        width: 9
      },
      {
        key: "Dolg2",
        title: `${t("PostavMovements.Cashless", "Безналичные")} — ${t("PostavMovements.Debt", "Долг")}`,
        type: "number",
        decimals: 2,
        width: 9
      },
      {
        key: "Polucceno2",
        title: `${t("PostavMovements.Cashless", "Безналичные")} — ${t("PostavMovements.Received", "Получ")}`,
        type: "number",
        decimals: 2,
        width: 9
      },
      {
        key: "Oplata2",
        title: `${t("PostavMovements.Cashless", "Безналичные")} — ${t("PostavMovements.Paid", "Оплач")}`,
        type: "number",
        decimals: 2,
        width: 9
      },
      {
        key: "DolgTek2",
        title: `${t("PostavMovements.Cashless", "Безналичные")} — ${t("PostavMovements.Debt", "Долг")}`,
        type: "number",
        decimals: 2,
        width: 9
      }
    ],
    rows,
    footerRows: []
  };
}

function buildSupplierCardExportModel({
  cardData,
  expanded,
  dateFrom,
  dateTo,
  t
}) {
  const summary = supplierCardSummary(
    cardData
  );
  const supplierName =
    cardData.saldo?.NamePost ?? "";
  const baseTitle = expanded
    ? t(
        "PostavMovements.ExpandedCardTitle",
        "Карточка поставщика развернуто за период"
      )
    : t(
        "PostavMovements.ShortCardTitle",
        "Карточка поставщика кратко за период"
      );
  const rows = [];

  const pushSummary = (
    label,
    cash,
    cashless
  ) => {
    rows.push({
      Section: t(
        "PostavMovements.Summary",
        "Итоги"
      ),
      Date: "",
      Number: "",
      Description: label,
      Quantity: "",
      Price: "",
      Cash: cash,
      Cashless: cashless,
      Amount: "",
      PaymentForm: ""
    });
  };

  pushSummary(
    t(
      "PostavMovements.OpeningBalance",
      "Сальдо на начало"
    ),
    summary.openingCash,
    summary.openingCashless
  );
  pushSummary(
    t(
      "PostavMovements.Receipts",
      "Приход"
    ),
    summary.prihodCash,
    summary.prihodCashless
  );
  pushSummary(
    t(
      "PostavMovements.Payments",
      "Оплата"
    ),
    summary.oplataCash,
    summary.oplataCashless
  );
  pushSummary(
    t(
      "PostavMovements.ClosingBalance",
      "Сальдо на конец"
    ),
    summary.closingCash,
    summary.closingCashless
  );

  for (const row of cardData.prihod) {
    if (expanded) {
      const bucket = supplierPaymentBucket(
        row?.FormaOpl
      );
      const amount = numericValue(
        row?.Summ
      );

      rows.push({
        Section: t(
          "PostavMovements.Receipts",
          "Приход"
        ),
        Date: formatReportDate(
          row?.DatePrih
        ),
        Number: row?.Number ?? "",
        Description:
          row?.NameTov ?? "",
        Quantity:
          row?.Kolvo ?? "",
        Price:
          row?.Expr1 ?? "",
        Cash:
          bucket === "cash"
            ? amount
            : "",
        Cashless:
          bucket === "cashless"
            ? amount
            : "",
        Amount:
          row?.Summ ?? "",
        PaymentForm:
          row?.FormaOpl ?? ""
      });
    } else {
      rows.push({
        Section: t(
          "PostavMovements.Receipts",
          "Приход"
        ),
        Date: formatReportDate(
          row?.DatePrih
        ),
        Number: row?.Number ?? "",
        Description: "",
        Quantity: "",
        Price: "",
        Cash: row?.Summ1 ?? "",
        Cashless: row?.Summ2 ?? "",
        Amount:
          row?.Oplacheno ?? "",
        PaymentForm: ""
      });
    }
  }

  for (const row of cardData.oplata) {
    rows.push({
      Section: t(
        "PostavMovements.Payments",
        "Оплата"
      ),
      Date: formatReportDate(
        row?.DateOpl
      ),
      Number: "",
      Description: row?.Rem ?? "",
      Quantity: "",
      Price: "",
      Cash: row?.Summ1 ?? "",
      Cashless: row?.Summ2 ?? "",
      Amount: row?.Summ ?? "",
      PaymentForm:
        row?.FormaOpl ?? ""
    });
  }

  return {
    title: supplierReportPeriodTitle({
      baseTitle,
      dateFrom,
      dateTo,
      t
    }),
    fileName: `${expanded ? "PostRazv" : "PostKratro"}_${String(cardData.saldo?.IdPost ?? "")}`,
    orientation: expanded
      ? "landscape"
      : "portrait",
    meta: [
      {
        label: t(
          "PostavMovements.Supplier",
          "Поставщик"
        ),
        value: supplierName
      }
    ],
    columns: [
      {
        key: "Section",
        title: t(
          "PostavMovements.Section",
          "Раздел"
        ),
        type: "text",
        width: 16
      },
      {
        key: "Date",
        title: t(
          "PostavMovements.Date",
          "Дата"
        ),
        type: "text",
        width: 12
      },
      {
        key: "Number",
        title: t(
          "PostavMovements.InvoiceNo",
          "№ накладной"
        ),
        type: "text",
        width: 12
      },
      {
        key: "Description",
        title: t(
          "PostavMovements.Description",
          "Наименование / примечание"
        ),
        type: "text",
        width: 28
      },
      {
        key: "Quantity",
        title: t(
          "PostavMovements.Quantity",
          "Количество"
        ),
        type: "number",
        decimals: 2,
        width: 12
      },
      {
        key: "Price",
        title: t(
          "PostavMovements.Price",
          "Цена"
        ),
        type: "number",
        decimals: 2,
        width: 12
      },
      {
        key: "Cash",
        title: t(
          "PostavMovements.Cash",
          "Наличные"
        ),
        type: "number",
        decimals: 2,
        width: 14
      },
      {
        key: "Cashless",
        title: t(
          "PostavMovements.Cashless",
          "Безналичные"
        ),
        type: "number",
        decimals: 2,
        width: 14
      },
      {
        key: "Amount",
        title: t(
          "PostavMovements.Amount",
          "Сумма"
        ),
        type: "number",
        decimals: 2,
        width: 14
      },
      {
        key: "PaymentForm",
        title: t(
          "PostavMovements.PaymentForm",
          "Форма оплаты"
        ),
        type: "text",
        width: 16
      }
    ],
    rows,
    footerRows: []
  };
}

function SupplierCardView({
  data,
  expanded,
  dateFrom,
  dateTo,
  locale,
  fetchWithAuth,
  t,
  onBack,
  onReload
}) {
  const cardData = getSupplierCardData(
    data
  );
  const summary = supplierCardSummary(
    cardData
  );
  const formatter = createMoneyFormatter(
    locale
  );
  const baseTitle = expanded
    ? t(
        "PostavMovements.ExpandedCardTitle",
        "Карточка поставщика развернуто за период"
      )
    : t(
        "PostavMovements.ShortCardTitle",
        "Карточка поставщика кратко за период"
      );
  const title = supplierReportPeriodTitle({
    baseTitle,
    dateFrom,
    dateTo,
    t
  });

  async function handleExport(format) {
    try {
      await exportReportFile({
        fetchWithAuth,
        reportModel:
          buildSupplierCardExportModel({
            cardData,
            expanded,
            dateFrom,
            dateTo,
            t
          }),
        format,
        errorMessage: t(
          "Report.ExportError",
          "Ошибка экспорта отчёта."
        )
      });
    } catch (error) {
      window.alert(
        error?.message ||
          t(
            "Report.ExportError",
            "Ошибка экспорта отчёта."
          )
      );
    }
  }

  return (
    <div className="reports-page supplier-card-page">
      <div className="report-toolbar supplier-report-toolbar">
        <button
          type="button"
          className="supplier-back-button"
          onClick={onBack}
        >
          ← {t(
            "PostavMovements.BackToSuppliers",
            "К поставщикам"
          )}
        </button>

        <button
          type="button"
          className="report-run-button"
          onClick={onReload}
        >
          {t(
            "Common.Generate",
            "Сформировать"
          )}
        </button>

        <button
          type="button"
          className="report-action-button report-print-button"
          onClick={() =>
            openSupplierPrintWindow(
              buildSupplierCardPrintHtml({
                cardData,
                expanded,
                dateFrom,
                dateTo,
                formatter,
                t
              }),
              t
            )
          }
        >
          {t(
            "Common.Print",
            "Печать"
          )}
        </button>

        <button
          type="button"
          className="report-action-button report-excel-button"
          onClick={() =>
            handleExport("xlsx")
          }
        >
          {t(
            "Common.Excel",
            "Excel"
          )}
        </button>

        <button
          type="button"
          className="report-action-button report-word-button"
          onClick={() =>
            handleExport("docx")
          }
        >
          {t(
            "Common.Word",
            "Word"
          )}
        </button>
      </div>

      <article className="revenue-report-sheet supplier-card-sheet">
        <header className="supplier-card-heading">
          <div>
            <h3>{title}</h3>
            <div className="supplier-card-name">
              {cardData.saldo?.NamePost ?? ""}
            </div>
          </div>
        </header>

        <SupplierBalanceSummary
          summary={summary}
          formatter={formatter}
          t={t}
        />

        {expanded ? (
          <SupplierExpandedPrihodTable
            rows={cardData.prihod}
            formatter={formatter}
            t={t}
          />
        ) : (
          <SupplierShortPrihodTable
            rows={cardData.prihod}
            formatter={formatter}
            t={t}
          />
        )}

        <SupplierPaymentsTable
          rows={cardData.oplata}
          formatter={formatter}
          t={t}
        />
      </article>
    </div>
  );
}

function PostavMovementsReport({
  data,
  dateFrom,
  dateTo,
  organizationId,
  departmentId,
  all,
  locale,
  fetchWithAuth,
  t,
  onReload
}) {
  const [serviceOnly, setServiceOnly] =
    useState(false);
  const [expanded, setExpanded] =
    useState(false);
  const [cardData, setCardData] =
    useState(null);
  const [cardExpanded, setCardExpanded] =
    useState(false);
  const [cardSupplierId, setCardSupplierId] =
    useState(null);
  const [cardLoading, setCardLoading] =
    useState(false);
  const [cardError, setCardError] =
    useState("");

  const formatter = createMoneyFormatter(
    locale
  );
  const rows = normalizeSupplierMovementRows(
    data
  );
  const visibleRows = rows.filter(
    (row) =>
      supplierBooleanValue(row?.Slug) ===
      serviceOnly
  );
  const title = supplierReportPeriodTitle({
    baseTitle: t(
      "PostavMovements.Title",
      "Движения по поставщикам за период"
    ),
    dateFrom,
    dateTo,
    t
  });

  useEffect(() => {
    setCardData(null);
    setCardSupplierId(null);
    setCardError("");
  }, [data, dateFrom, dateTo]);

  async function loadSupplierCard(
    row,
    forceExpanded = expanded
  ) {
    const idPost = Number(
      row?.IdPost ?? 0
    );

    if (!idPost) {
      return;
    }

    const reportAction = forceExpanded
      ? "PostRazv"
      : "PostKratro";

    setCardLoading(true);
    setCardError("");

    try {
      const url = new URL(
        "https://webback.bar-boss.com/wr_Reports.php"
      );
      url.searchParams.set(
        "Action",
        reportAction
      );

      const response = await fetchWithAuth(
        url.toString(),
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/xml; charset=utf-8"
          },
          body: buildSupplierCardXml({
            dateFrom,
            dateTo,
            organizationId,
            all,
            departmentId,
            idPost
          })
        }
      );

      const text = await response.text();
      let result;

      try {
        result = JSON.parse(text);
      } catch {
        throw new Error(
          "Отчёт вернул не JSON: " +
            text.substring(0, 500)
        );
      }

      if (
        !response.ok ||
        result?.status === "error"
      ) {
        throw new Error(
          result?.error ||
            result?.message ||
            t(
              "PostavMovements.CardLoadError",
              "Ошибка формирования карточки поставщика"
            )
        );
      }

      setCardSupplierId(idPost);
      setCardExpanded(forceExpanded);
      setCardData(result);
    } catch (error) {
      setCardError(
        error?.message ||
          t(
            "PostavMovements.CardLoadError",
            "Ошибка формирования карточки поставщика"
          )
      );
    } finally {
      setCardLoading(false);
    }
  }

  async function handleMainExport(format) {
    try {
      await exportReportFile({
        fetchWithAuth,
        reportModel:
          buildSupplierMainExportModel({
            rows: visibleRows,
            dateFrom,
            dateTo,
            serviceOnly,
            t
          }),
        format,
        errorMessage: t(
          "Report.ExportError",
          "Ошибка экспорта отчёта."
        )
      });
    } catch (error) {
      window.alert(
        error?.message ||
          t(
            "Report.ExportError",
            "Ошибка экспорта отчёта."
          )
      );
    }
  }

  if (cardLoading) {
    return (
      <div className="reports-page">
        <div className="supplier-card-loading">
          {t(
            "App.Loading",
            "Загрузка..."
          )}
        </div>
      </div>
    );
  }

  if (cardData) {
    const selectedRow = rows.find(
      (row) =>
        Number(row?.IdPost ?? 0) ===
        Number(cardSupplierId ?? 0)
    );

    return (
      <SupplierCardView
        data={cardData}
        expanded={cardExpanded}
        dateFrom={dateFrom}
        dateTo={dateTo}
        locale={locale}
        fetchWithAuth={fetchWithAuth}
        t={t}
        onBack={() => {
          setCardData(null);
          setCardSupplierId(null);
          setCardError("");
        }}
        onReload={() =>
          loadSupplierCard(
            selectedRow ?? {
              IdPost: cardSupplierId
            },
            cardExpanded
          )
        }
      />
    );
  }

  return (
    <div className="reports-page supplier-movements-page">
      <div className="report-toolbar supplier-report-toolbar">
        <button
          type="button"
          className="report-run-button"
          onClick={onReload}
        >
          {t(
            "Common.Generate",
            "Сформировать"
          )}
        </button>

        <label className="supplier-filter-check">
          <input
            type="checkbox"
            checked={serviceOnly}
            onChange={(event) =>
              setServiceOnly(
                event.target.checked
              )
            }
          />
          <span>
            {t(
              "PostavMovements.Service",
              "Служебные"
            )}
          </span>
        </label>

        <label className="supplier-filter-check">
          <input
            type="checkbox"
            checked={expanded}
            onChange={(event) =>
              setExpanded(
                event.target.checked
              )
            }
          />
          <span>
            {t(
              "PostavMovements.Expanded",
              "Развернутый"
            )}
          </span>
        </label>

        <div className="supplier-toolbar-spacer" />

        <button
          type="button"
          className="report-action-button report-print-button"
          onClick={() =>
            openSupplierPrintWindow(
              buildSupplierMainPrintHtml({
                rows: visibleRows,
                dateFrom,
                dateTo,
                formatter,
                serviceOnly,
                t
              }),
              t
            )
          }
        >
          {t(
            "Common.Print",
            "Печать"
          )}
        </button>

        <button
          type="button"
          className="report-action-button report-excel-button"
          onClick={() =>
            handleMainExport("xlsx")
          }
        >
          {t(
            "Common.Excel",
            "Excel"
          )}
        </button>

        <button
          type="button"
          className="report-action-button report-word-button"
          onClick={() =>
            handleMainExport("docx")
          }
        >
          {t(
            "Common.Word",
            "Word"
          )}
        </button>
      </div>

      {cardError && (
        <div className="login-error supplier-card-error">
          {cardError}
        </div>
      )}

      <article className="revenue-report-sheet supplier-movements-sheet">
        <header className="supplier-movements-heading">
          <h3>{title}</h3>
          <div className="supplier-movements-hint">
            {t(
              "PostavMovements.DoubleClickHint",
              "Двойной клик по поставщику — открыть карточку"
            )}
          </div>
        </header>

        <div className="report-table-scroll supplier-movements-scroll">
          <table className="report-table supplier-movements-table">
            <thead>
              <tr>
                <th
                  rowSpan="2"
                  className="report-text supplier-name-head"
                >
                  {t(
                    "PostavMovements.Supplier",
                    "Поставщик"
                  )}
                </th>
                <th
                  colSpan="4"
                  className="supplier-money-group-head"
                >
                  {t(
                    "PostavMovements.Cash",
                    "Наличные"
                  )}
                </th>
                <th
                  colSpan="4"
                  className="supplier-money-group-head"
                >
                  {t(
                    "PostavMovements.Cashless",
                    "Безналичные"
                  )}
                </th>
              </tr>
              <tr>
                {["Dolg1", "Polucceno1", "Oplata1", "DolgTek1", "Dolg2", "Polucceno2", "Oplata2", "DolgTek2"].map(
                  (field, index) => {
                    const labels = [
                      t(
                        "PostavMovements.Debt",
                        "Долг"
                      ),
                      t(
                        "PostavMovements.Received",
                        "Получ"
                      ),
                      t(
                        "PostavMovements.Paid",
                        "Оплач"
                      ),
                      t(
                        "PostavMovements.Debt",
                        "Долг"
                      )
                    ];

                    return (
                      <th
                        key={field}
                        className="report-money"
                      >
                        {labels[index % 4]}
                      </th>
                    );
                  }
                )}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, index) => (
                <tr
                  key={`${row?.IdPost ?? "post"}-${index}`}
                  className="supplier-movement-row"
                  onDoubleClick={() =>
                    loadSupplierCard(row)
                  }
                  title={t(
                    "PostavMovements.DoubleClickHint",
                    "Двойной клик по поставщику — открыть карточку"
                  )}
                >
                  <td className="report-text supplier-name-cell">
                    {row?.NamePost ?? ""}
                  </td>
                  {[
                    "Dolg1",
                    "Polucceno1",
                    "Oplata1",
                    "DolgTek1",
                    "Dolg2",
                    "Polucceno2",
                    "Oplata2",
                    "DolgTek2"
                  ].map((field) => (
                    <td
                      key={field}
                      className="report-money"
                    >
                      {supplierDisplayMoney(
                        row?.[field],
                        formatter
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}


function normalizeClientNavigatorRows(data) {
  if (Array.isArray(data)) {
    return data;
  }

  const candidates = [
    data?.Clients,
    data?.clients,
    data?.data?.Clients,
    data?.data?.clients,
    data?.Data?.Clients,
    data?.Data?.clients,
    data?.data,
    data?.Data
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
}

function normalizeClientReportRows(data) {
  if (Array.isArray(data)) {
    return data;
  }

  const candidates = [
    data?.data,
    data?.Data,
    data?.rows,
    data?.Rows
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  if (
    data?.data &&
    typeof data.data === "object" &&
    !Array.isArray(data.data)
  ) {
    for (const value of Object.values(data.data)) {
      if (Array.isArray(value)) {
        return value;
      }
    }

    return [data.data];
  }

  if (
    data?.Data &&
    typeof data.Data === "object" &&
    !Array.isArray(data.Data)
  ) {
    return [data.Data];
  }

  if (
    data &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    !("status" in data) &&
    !("report" in data)
  ) {
    return [data];
  }

  return [];
}

function clientEscapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildClientReportXml({
  dateFrom,
  dateTo,
  organizationId,
  all,
  departmentId,
  idKli = 0
}) {
  return `<Report><Date1>${clientEscapeXml(
    dateFrom
  )}</Date1><Date2>${clientEscapeXml(
    dateTo
  )}</Date2><Org>${clientEscapeXml(
    organizationId
  )}</Org><All>${clientEscapeXml(
    all
  )}</All><Skl>${clientEscapeXml(
    departmentId
  )}</Skl><IdKli>${clientEscapeXml(
    idKli ?? 0
  )}</IdKli></Report>`;
}

function clientPeriodTitle({
  baseTitle,
  dateFrom,
  dateTo,
  t
}) {
  return `${baseTitle} ${t(
    "Common.From",
    "с"
  )} ${formatReportDate(
    dateFrom
  )} ${t(
    "Common.To",
    "по"
  )} ${formatReportDate(dateTo)}`;
}

function safeClientReportFilePart(value) {
  return String(value ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 80);
}

function getClientSimpleDefinition(key, t) {
  if (key === "dolgi") {
    return {
      key,
      apiAction: "DolgiKl",
      title: t(
        "ClientMovements.DebtPeriod",
        "Долговые за период"
      ),
      orientation: "portrait",
      columns: [
        {
          field: "Фамилия",
          label: t(
            "ClientMovements.Client",
            "Клиент"
          ),
          kind: "text",
          total: false,
          width: 38
        },
        {
          field: "Summ",
          label: t(
            "ClientMovements.Amount",
            "Сумма"
          ),
          kind: "money",
          total: true,
          width: 18
        },
        {
          field: "SummSebest",
          label: t(
            "ClientMovements.Cost",
            "Себестоимость"
          ),
          kind: "money",
          total: true,
          width: 18
        }
      ]
    };
  }

  if (key === "skidki") {
    return {
      key,
      apiAction: "SkidkiKl",
      title: t(
        "ClientMovements.DiscountPeriod",
        "Скидочные за период"
      ),
      orientation: "portrait",
      columns: [
        {
          field: "NameKli",
          label: t(
            "ClientMovements.Client",
            "Клиент"
          ),
          kind: "text",
          total: false,
          width: 34
        },
        {
          field: "Skidka",
          label: t(
            "ClientMovements.DiscountPercent",
            "Скидка %"
          ),
          kind: "number",
          total: false,
          width: 10
        },
        {
          field: "Summ",
          label: t(
            "ClientMovements.Amount",
            "Сумма"
          ),
          kind: "money",
          total: true,
          width: 16
        },
        {
          field: "SummSkid",
          label: t(
            "ClientMovements.DiscountAmount",
            "Сумма скидки"
          ),
          kind: "money",
          total: true,
          width: 16
        },
        {
          field: "Sebest",
          label: t(
            "ClientMovements.Cost",
            "Себестоимость"
          ),
          kind: "money",
          total: true,
          width: 16
        }
      ]
    };
  }

  if (key === "bonusList") {
    return {
      key,
      apiAction: "BonusList",
      title: t(
        "ClientMovements.BonusMovements",
        "Движения бонусов"
      ),
      orientation: "portrait",
      columns: [
        {
          field: "NameKli",
          label: t(
            "ClientMovements.Client",
            "Имя клиента"
          ),
          kind: "text",
          total: false,
          width: 30
        },
        {
          field: "MomCard",
          label: t(
            "ClientMovements.BonusCard",
            "Карта"
          ),
          kind: "text",
          total: false,
          width: 16
        },
        {
          field: "Nachisleno",
          label: t(
            "ClientMovements.BonusAccrued",
            "Начислено"
          ),
          kind: "money",
          total: true,
          width: 14
        },
        {
          field: "Oplacheno",
          label: t(
            "ClientMovements.BonusUsed",
            "Использовано"
          ),
          kind: "money",
          total: true,
          width: 14
        },
        {
          field: "Popolmemo",
          label: t(
            "ClientMovements.BonusReplenished",
            "Пополнено"
          ),
          kind: "money",
          total: true,
          width: 14
        },
        {
          field: "Anulirovano",
          label: t(
            "ClientMovements.BonusAnnulled",
            "Аннулировано"
          ),
          kind: "money",
          total: true,
          width: 14
        },
        {
          field: "__BonusBalance",
          label: t(
            "ClientMovements.BonusBalance",
            "Остаток"
          ),
          kind: "money",
          total: true,
          width: 14,
          computed: (row) =>
            numericValue(row?.Nachisleno) -
            numericValue(row?.Oplacheno) +
            numericValue(row?.Popolmemo) -
            numericValue(row?.Anulirovano)
        }
      ]
    };
  }

  if (key === "bonusPeriod") {
    return {
      key,
      apiAction: "BonusPeriod",
      title: t(
        "ClientMovements.BonusPeriod",
        "Бонусы за период"
      ),
      orientation: "portrait",
      columns: [
        {
          field: "NameKli",
          label: t(
            "ClientMovements.Client",
            "Имя клиента"
          ),
          kind: "text",
          total: false,
          width: 26
        },
        {
          field: "MomCard",
          label: t(
            "ClientMovements.BonusCard",
            "Карта"
          ),
          kind: "text",
          total: false,
          width: 14
        },
        {
          field: "Phone",
          label: t(
            "ClientMovements.Phone",
            "Телефон"
          ),
          kind: "text",
          total: false,
          width: 14
        },
        {
          field: "OstNach",
          label: t(
            "ClientMovements.BonusOpeningBalance",
            "Остаток на начало"
          ),
          kind: "money",
          total: true,
          width: 13
        },
        {
          field: "Nach",
          label: t(
            "ClientMovements.BonusAccrued",
            "Начислено"
          ),
          kind: "money",
          total: true,
          width: 12
        },
        {
          field: "Opl",
          label: t(
            "ClientMovements.BonusUsed",
            "Использовано"
          ),
          kind: "money",
          total: true,
          width: 12
        },
        {
          field: "Popoln",
          label: t(
            "ClientMovements.BonusReplenished",
            "Пополнено"
          ),
          kind: "money",
          total: true,
          width: 12
        },
        {
          field: "Anulirovano",
          label: t(
            "ClientMovements.BonusAnnulled",
            "Аннулировано"
          ),
          kind: "money",
          total: true,
          width: 12
        },
        {
          field: "Ost",
          label: t(
            "ClientMovements.BonusBalance",
            "Остаток"
          ),
          kind: "money",
          total: true,
          width: 13
        }
      ]
    };
  }

  if (key === "bonusClient") {
    return {
      key,
      apiAction: "BonusKli",
      title: t(
        "ClientMovements.BonusClient",
        "Бонусы клиента"
      ),
      orientation: "portrait",
      columns: [
        {
          field: "DatOp",
          label: t(
            "ClientMovements.Date",
            "Дата"
          ),
          kind: "date",
          total: false,
          width: 14
        },
        {
          field: "TypOper",
          label: t(
            "ClientMovements.OperationType",
            "Тип операции"
          ),
          kind: "number",
          total: false,
          width: 12
        },
        {
          field: "SummaBill",
          label: t(
            "ClientMovements.BillAmount",
            "Сумма счета"
          ),
          kind: "money",
          total: true,
          width: 14
        },
        {
          field: "ProcBon",
          label: t(
            "ClientMovements.BonusPercent",
            "Бонус %"
          ),
          kind: "number",
          total: false,
          width: 11
        },
        {
          field: "SummBon",
          label: t(
            "ClientMovements.BonusAmount",
            "Сумма бонуса"
          ),
          kind: "money",
          total: true,
          width: 14
        },
        {
          field: "SumLock",
          label: t(
            "ClientMovements.LockedAmount",
            "Заблокировано"
          ),
          kind: "money",
          total: true,
          width: 14
        },
        {
          field: "Locked",
          label: t(
            "ClientMovements.Locked",
            "Блокировка"
          ),
          kind: "boolean",
          total: false,
          width: 11
        },
        {
          field: "RealID",
          label: t(
            "ClientMovements.OperationId",
            "ID операции"
          ),
          kind: "number",
          total: false,
          width: 12
        }
      ]
    };
  }

  return {
    key: "dolgisvod",
    apiAction: "DolgiSvod",
    title: t(
      "ClientMovements.DebtSummary",
      "Свод по долговым"
    ),
    orientation: "landscape",
    columns: [
      {
        field: "NameKl",
        label: t(
          "ClientMovements.Client",
          "Клиент"
        ),
        kind: "text",
        total: false,
        width: 30
      },
      {
        field: "Saldo",
        label: t(
          "ClientMovements.OpeningBalanceShort",
          "Сальдо"
        ),
        kind: "money",
        total: true,
        width: 13
      },
      {
        field: "Otpusch",
        label: t(
          "ClientMovements.Issued",
          "Отпущено"
        ),
        kind: "money",
        total: true,
        width: 13
      },
      {
        field: "Oplach",
        label: t(
          "ClientMovements.Paid",
          "Оплачено"
        ),
        kind: "money",
        total: true,
        width: 13
      },
      {
        field: "OtpuschKred",
        label: t(
          "ClientMovements.IssuedCredit",
          "Отпущено кредит"
        ),
        kind: "money",
        total: true,
        width: 14
      },
      {
        field: "OplachKred",
        label: t(
          "ClientMovements.PaidCredit",
          "Оплачено кредит"
        ),
        kind: "money",
        total: true,
        width: 14
      },
      {
        field: "DolgTek",
        label: t(
          "ClientMovements.CurrentDebt",
          "Долг текущий"
        ),
        kind: "money",
        total: true,
        width: 14
      }
    ]
  };
}

function clientSimpleCellValue(row, column) {
  if (typeof column.computed === "function") {
    return column.computed(row);
  }

  return row?.[column.field];
}

function sumClientSimpleColumn(rows, column) {
  return rows.reduce(
    (sum, row) =>
      sum +
      numericValue(
        clientSimpleCellValue(
          row,
          column
        )
      ),
    0
  );
}

function clientFormatCell(
  value,
  column,
  formatter,
  t
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "";
  }

  if (column.kind === "text") {
    return String(value);
  }

  if (column.kind === "date") {
    return formatReportDate(value);
  }

  if (column.kind === "boolean") {
    return value === true ||
      value === 1 ||
      String(value).trim().toLowerCase() === "true"
      ? t(
          "ClientMovements.Yes",
          "Да"
        )
      : t(
          "ClientMovements.No",
          "Нет"
        );
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "";
  }

  if (column.kind === "number") {
    return new Intl.NumberFormat(
      "ru-RU",
      {
        maximumFractionDigits: 2
      }
    ).format(number);
  }

  return formatter.format(number);
}

function ClientSimpleTable({
  rows,
  columns,
  formatter,
  t
}) {
  return (
    <div className="report-table-scroll client-report-scroll">
      <table className="report-table client-simple-report-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.field}
                className={
                  column.kind === "text"
                    ? "report-text"
                    : "report-money"
                }
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`${index}-${row?.ID ?? row?.IdKl ?? row?.NameKl ?? row?.NameKli ?? row?.["Фамилия"] ?? "row"}`}
            >
              {columns.map((column) => (
                <td
                  key={column.field}
                  className={
                    column.kind === "text"
                      ? "report-text"
                      : "report-money"
                  }
                >
                  {clientFormatCell(
                    clientSimpleCellValue(
                      row,
                      column
                    ),
                    column,
                    formatter,
                    t
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>

        {rows.length > 0 && (
          <tfoot>
            <tr>
              {columns.map(
                (column, index) => {
                  if (index === 0) {
                    return (
                      <td
                        key={column.field}
                        className="report-text report-total-label"
                      >
                        {t(
                          "Common.Total",
                          "Итого"
                        )}
                      </td>
                    );
                  }

                  if (!column.total) {
                    return (
                      <td
                        key={column.field}
                        className="report-money"
                      />
                    );
                  }

                  return (
                    <td
                      key={column.field}
                      className="report-money"
                    >
                      {formatter.format(
                        sumClientSimpleColumn(
                          rows,
                          column
                        )
                      )}
                    </td>
                  );
                }
              )}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function buildClientSimplePrintHtml({
  rows,
  definition,
  dateFrom,
  dateTo,
  locale,
  t,
  contextName = ""
}) {
  const formatter =
    createMoneyFormatter(locale);
  const baseTitle = clientPeriodTitle({
    baseTitle: definition.title,
    dateFrom,
    dateTo,
    t
  });
  const title = contextName
    ? `${baseTitle} — ${contextName}`
    : baseTitle;

  const head = definition.columns
    .map(
      (column) =>
        `<th class="${
          column.kind === "text"
            ? "text"
            : "number"
        }">${escapeHtml(
          column.label
        )}</th>`
    )
    .join("");

  const body = rows
    .map(
      (row) =>
        `<tr>${definition.columns
          .map((column) => {
            const text =
              clientFormatCell(
                clientSimpleCellValue(
                  row,
                  column
                ),
                column,
                formatter,
                t
              );

            return `<td class="${
              column.kind === "text"
                ? "text"
                : "number"
            }">${escapeHtml(
              text
            )}</td>`;
          })
          .join("")}</tr>`
    )
    .join("");

  const footer =
    rows.length === 0
      ? ""
      : `<tfoot><tr>${definition.columns
          .map((column, index) => {
            if (index === 0) {
              return `<td class="text total">${escapeHtml(
                t(
                  "Common.Total",
                  "Итого"
                )
              )}</td>`;
            }

            if (!column.total) {
              return `<td class="number total"></td>`;
            }

            return `<td class="number total">${escapeHtml(
              formatter.format(
                sumClientSimpleColumn(
                  rows,
                  column
                )
              )
            )}</td>`;
          })
          .join("")}</tr></tfoot>`;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
@page { size: A4 ${definition.orientation}; margin: 9mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; color: #111; font-size: 8pt; }
h1 { margin: 0 0 4mm; font-size: 13pt; font-style: italic; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
thead { display: table-header-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
th, td { padding: 1mm 1.2mm; border-bottom: 0.1mm solid #c9cfcc; }
th { background: #edf3f1; font-size: 7.2pt; }
.text { text-align: left; overflow-wrap: anywhere; }
.number { text-align: right; white-space: nowrap; }
.total { border-top: 0.2mm solid #777; background: #f3f6f2; font-weight: 700; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<table>
<thead><tr>${head}</tr></thead>
<tbody>${body}</tbody>
${footer}
</table>
</body>
</html>`;
}

function buildClientSimpleExportModel({
  rows,
  definition,
  dateFrom,
  dateTo,
  t,
  contextName = ""
}) {
  return {
    title: (() => {
      const baseTitle =
        clientPeriodTitle({
          baseTitle: definition.title,
          dateFrom,
          dateTo,
          t
        });

      return contextName
        ? `${baseTitle} — ${contextName}`
        : baseTitle;
    })(),
    fileName: `${definition.apiAction}_${safeClientReportFilePart(
      dateFrom
    )}_${safeClientReportFilePart(
      dateTo
    )}`,
    orientation:
      definition.orientation,
    columns: definition.columns.map(
      (column) => ({
        key: column.field,
        title: column.label,
        type:
          ["text", "date", "boolean"].includes(
            column.kind
          )
            ? "text"
            : "number",
        decimals:
          ["text", "date", "boolean"].includes(
            column.kind
          )
            ? undefined
            : 2,
        width: column.width
      })
    ),
    rows: rows.map((row) =>
      definition.columns.reduce(
        (result, column) => {
          result[column.field] =
            clientSimpleCellValue(
              row,
              column
            );
          return result;
        },
        {}
      )
    ),
    footerRows: [
      definition.columns.reduce(
        (result, column, index) => {
          if (index === 0) {
            result[column.field] = t(
              "Common.Total",
              "Итого"
            );
          } else if (column.total) {
            result[column.field] =
              sumClientSimpleColumn(
                rows,
                column
              );
          } else {
            result[column.field] = "";
          }

          return result;
        },
        {}
      )
    ]
  };
}

function getClientCardData(data) {
  const payload =
    data?.data ??
    data?.Data ??
    data ??
    {};

  return {
    saldo:
      normalizeRows(
        payload?.Saldo ??
        payload?.saldo
      )[0] ?? {},
    otpuscheno: normalizeRows(
      payload?.Otpuscheno ??
      payload?.otpuscheno
    ),
    oplata: normalizeRows(
      payload?.Oplata ??
      payload?.oplata
    )
  };
}

function clientCardSummary(cardData) {
  const opening = numericValue(
    cardData.saldo?.Saldo
  );
  const issuedDebt = sumField(
    cardData.otpuscheno,
    "SummDolg"
  );
  const payments = sumField(
    cardData.oplata,
    "Summ"
  );

  return {
    opening,
    issued: sumField(
      cardData.otpuscheno,
      "Summ"
    ),
    issuedDebt,
    payments,
    closing:
      opening +
      issuedDebt -
      payments
  };
}

function clientBillKey(row, index) {
  const number = String(
    row?.Number ?? ""
  ).trim();
  const date = String(
    row?.Oplacheno ??
    row?.DateOplat ??
    ""
  ).trim();
  const table = String(
    row?.Table ?? ""
  ).trim();

  if (number || date || table) {
    return `${date}|${number}|${table}`;
  }

  return `row-${index}`;
}

function clientExpandedStats(rows) {
  const bills = new Map();

  rows.forEach((row, index) => {
    const key = clientBillKey(
      row,
      index
    );

    if (!bills.has(key)) {
      bills.set(key, row);
    }
  });

  const billCount = bills.size;
  let guests = 0;

  for (const row of bills.values()) {
    guests += numericValue(
      row?.Guests
    );
  }

  const total = sumField(
    rows,
    "Summ"
  );
  const debt = sumField(
    rows,
    "SummDolg"
  );

  return {
    total,
    debt,
    billCount,
    guests,
    average:
      billCount > 0
        ? total / billCount
        : 0
  };
}

function ClientCardHeader({
  cardData,
  summary,
  formatter,
  t
}) {
  return (
    <div className="client-card-summary-grid">
      <div className="client-card-name">
        <span>
          {t(
            "ClientMovements.Client",
            "Клиент"
          )}
        </span>
        <strong>
          {cardData.saldo?.Klient ?? ""}
        </strong>
      </div>

      <div>
        <span>
          {t(
            "ClientMovements.Discount",
            "Скидка"
          )}
        </span>
        <strong>
          {cardData.saldo?.Skidka ?? ""}
        </strong>
      </div>

      <div>
        <span>
          {t(
            "ClientMovements.OpeningBalance",
            "Сальдо на начало"
          )}
        </span>
        <strong>
          {formatter.format(
            summary.opening
          )}
        </strong>
      </div>
    </div>
  );
}

function ClientPaymentsTable({
  rows,
  formatter,
  t
}) {
  return (
    <section className="client-card-section">
      <h4>
        {t(
          "ClientMovements.Payments",
          "Оплата"
        )}
      </h4>

      <div className="report-table-scroll">
        <table className="report-table client-card-table client-payments-table">
          <thead>
            <tr>
              <th className="report-text">
                {t(
                  "ClientMovements.Date",
                  "Дата"
                )}
              </th>
              <th className="report-money">
                {t(
                  "ClientMovements.Amount",
                  "Сумма"
                )}
              </th>
              <th className="report-text">
                {t(
                  "ClientMovements.Note",
                  "Примечание"
                )}
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map(
              (row, index) => (
                <tr
                  key={`${row?.IdKl ?? "pay"}-${row?.DateOpl ?? index}-${index}`}
                >
                  <td className="report-text">
                    {formatReportDate(
                      row?.DateOpl
                    )}
                  </td>
                  <td className="report-money">
                    {supplierDisplayMoney(
                      row?.Summ,
                      formatter,
                      true
                    )}
                  </td>
                  <td className="report-text">
                    {row?.Rem ?? ""}
                  </td>
                </tr>
              )
            )}
          </tbody>

          {rows.length > 0 && (
            <tfoot>
              <tr>
                <td className="report-text report-total-label">
                  {t(
                    "Common.Total",
                    "Итого"
                  )}
                </td>
                <td className="report-money">
                  {formatter.format(
                    sumField(
                      rows,
                      "Summ"
                    )
                  )}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}

function ClientIssuedCompactTable({
  rows,
  formatter,
  t
}) {
  return (
    <section className="client-card-section">
      <h4>
        {t(
          "ClientMovements.Issued",
          "Отпущено"
        )}
      </h4>

      <div className="report-table-scroll">
        <table className="report-table client-card-table client-issued-compact-table">
          <thead>
            <tr>
              <th className="report-text">
                {t(
                  "ClientMovements.Date",
                  "Дата"
                )}
              </th>
              <th className="report-text">
                {t(
                  "ClientMovements.Bill",
                  "Счет"
                )}
              </th>
              <th className="report-text">
                {t(
                  "ClientMovements.Table",
                  "Стол"
                )}
              </th>
              <th className="report-text">
                {t(
                  "ClientMovements.Waiter",
                  "Официант"
                )}
              </th>
              <th className="report-money">
                {t(
                  "ClientMovements.Amount",
                  "Сумма"
                )}
              </th>
              <th className="report-money">
                {t(
                  "ClientMovements.InDebt",
                  "В долг"
                )}
              </th>
              <th className="report-money">
                {t(
                  "ClientMovements.Cost",
                  "Себестоимость"
                )}
              </th>
              <th className="report-text">
                {t(
                  "ClientMovements.Note",
                  "Примечание"
                )}
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map(
              (row, index) => (
                <tr
                  key={`${row?.Number ?? "bill"}-${row?.DateOplat ?? index}-${index}`}
                >
                  <td className="report-text">
                    {formatReportDate(
                      row?.DateOplat
                    )}
                  </td>
                  <td className="report-text">
                    {row?.Number ?? ""}
                  </td>
                  <td className="report-text">
                    {row?.Table ?? ""}
                  </td>
                  <td className="report-text">
                    {row?.NameKl ?? ""}
                  </td>
                  <td className="report-money">
                    {supplierDisplayMoney(
                      row?.Summ,
                      formatter,
                      true
                    )}
                  </td>
                  <td className="report-money">
                    {supplierDisplayMoney(
                      row?.SummDolg,
                      formatter,
                      true
                    )}
                  </td>
                  <td className="report-money">
                    {supplierDisplayMoney(
                      row?.Sebest,
                      formatter,
                      true
                    )}
                  </td>
                  <td className="report-text">
                    {row?.Rem ?? ""}
                  </td>
                </tr>
              )
            )}
          </tbody>

          {rows.length > 0 && (
            <tfoot>
              <tr>
                <td
                  colSpan="4"
                  className="report-text report-total-label"
                >
                  {t(
                    "Common.Total",
                    "Итого"
                  )}
                </td>
                <td className="report-money">
                  {formatter.format(
                    sumField(
                      rows,
                      "Summ"
                    )
                  )}
                </td>
                <td className="report-money">
                  {formatter.format(
                    sumField(
                      rows,
                      "SummDolg"
                    )
                  )}
                </td>
                <td className="report-money">
                  {formatter.format(
                    sumField(
                      rows,
                      "Sebest"
                    )
                  )}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}

function ClientIssuedExpandedTable({
  rows,
  formatter,
  t
}) {
  const stats =
    clientExpandedStats(rows);

  return (
    <section className="client-card-section">
      <h4>
        {t(
          "ClientMovements.IssuedExpanded",
          "Отпущено — развернуто"
        )}
      </h4>

      <div className="report-table-scroll">
        <table className="report-table client-card-table client-issued-expanded-table">
          <thead>
            <tr>
              <th className="report-text">
                {t(
                  "ClientMovements.Date",
                  "Дата"
                )}
              </th>
              <th className="report-text">
                {t(
                  "ClientMovements.Bill",
                  "Счет"
                )}
              </th>
              <th className="report-text">
                {t(
                  "ClientMovements.Table",
                  "Стол"
                )}
              </th>
              <th className="report-text">
                {t(
                  "ClientMovements.Dish",
                  "Блюдо"
                )}
              </th>
              <th className="report-money">
                {t(
                  "ClientMovements.Quantity",
                  "Количество"
                )}
              </th>
              <th className="report-money">
                {t(
                  "ClientMovements.Price",
                  "Цена"
                )}
              </th>
              <th className="report-money">
                {t(
                  "ClientMovements.Amount",
                  "Сумма"
                )}
              </th>
              <th className="report-money">
                {t(
                  "ClientMovements.InDebt",
                  "В долг"
                )}
              </th>
              <th className="report-money">
                {t(
                  "ClientMovements.DiscountPercent",
                  "Скидка %"
                )}
              </th>
              <th className="report-text">
                {t(
                  "ClientMovements.Waiter",
                  "Официант"
                )}
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map(
              (row, index) => (
                <tr
                  key={`${clientBillKey(
                    row,
                    index
                  )}-${row?.NameDish ?? index}`}
                >
                  <td className="report-text">
                    {formatReportDate(
                      row?.Oplacheno
                    )}
                  </td>
                  <td className="report-text">
                    {row?.Number ?? ""}
                  </td>
                  <td className="report-text">
                    {row?.Table ?? ""}
                  </td>
                  <td className="report-text">
                    {row?.NameDish ?? ""}
                  </td>
                  <td className="report-money">
                    {supplierDisplayMoney(
                      row?.Kolvo,
                      formatter,
                      true
                    )}
                  </td>
                  <td className="report-money">
                    {supplierDisplayMoney(
                      row?.Price,
                      formatter,
                      true
                    )}
                  </td>
                  <td className="report-money">
                    {supplierDisplayMoney(
                      row?.Summ,
                      formatter,
                      true
                    )}
                  </td>
                  <td className="report-money">
                    {supplierDisplayMoney(
                      row?.SummDolg,
                      formatter,
                      true
                    )}
                  </td>
                  <td className="report-money">
                    {supplierDisplayMoney(
                      row?.Discount,
                      formatter,
                      true
                    )}
                  </td>
                  <td className="report-text">
                    {row?.Waiter ?? ""}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>

      <div className="client-expanded-stats">
        <div>
          <span>
            {t(
              "ClientMovements.Total",
              "Всего"
            )}
          </span>
          <strong>
            {formatter.format(
              stats.total
            )}
          </strong>
        </div>
        <div>
          <span>
            {t(
              "ClientMovements.IncludingDebt",
              "В т.ч. в долг"
            )}
          </span>
          <strong>
            {formatter.format(
              stats.debt
            )}
          </strong>
        </div>
        <div>
          <span>
            {t(
              "ClientMovements.BillCount",
              "Количество счетов"
            )}
          </span>
          <strong>
            {stats.billCount}
          </strong>
        </div>
        <div>
          <span>
            {t(
              "ClientMovements.GuestCount",
              "Количество гостей"
            )}
          </span>
          <strong>
            {stats.guests}
          </strong>
        </div>
        <div>
          <span>
            {t(
              "ClientMovements.AverageBill",
              "Средний чек"
            )}
          </span>
          <strong>
            {formatter.format(
              stats.average
            )}
          </strong>
        </div>
      </div>
    </section>
  );
}

function clientCardPrintIssuedRows({
  rows,
  expanded,
  formatter
}) {
  if (expanded) {
    return rows
      .map(
        (row, index) => `<tr>
<td class="text">${escapeHtml(
          formatReportDate(
            row?.Oplacheno
          )
        )}</td>
<td class="text">${escapeHtml(
          row?.Number ?? ""
        )}</td>
<td class="text">${escapeHtml(
          row?.Table ?? ""
        )}</td>
<td class="text">${escapeHtml(
          row?.NameDish ?? ""
        )}</td>
<td class="number">${escapeHtml(
          supplierDisplayMoney(
            row?.Kolvo,
            formatter,
            true
          )
        )}</td>
<td class="number">${escapeHtml(
          supplierDisplayMoney(
            row?.Price,
            formatter,
            true
          )
        )}</td>
<td class="number">${escapeHtml(
          supplierDisplayMoney(
            row?.Summ,
            formatter,
            true
          )
        )}</td>
<td class="number">${escapeHtml(
          supplierDisplayMoney(
            row?.SummDolg,
            formatter,
            true
          )
        )}</td>
<td class="number">${escapeHtml(
          supplierDisplayMoney(
            row?.Discount,
            formatter,
            true
          )
        )}</td>
<td class="text">${escapeHtml(
          row?.Waiter ?? ""
        )}</td>
</tr>`
      )
      .join("");
  }

  return rows
    .map(
      (row) => `<tr>
<td class="text">${escapeHtml(
        formatReportDate(
          row?.DateOplat
        )
      )}</td>
<td class="text">${escapeHtml(
        row?.Number ?? ""
      )}</td>
<td class="text">${escapeHtml(
        row?.Table ?? ""
      )}</td>
<td class="text">${escapeHtml(
        row?.NameKl ?? ""
      )}</td>
<td class="number">${escapeHtml(
        supplierDisplayMoney(
          row?.Summ,
          formatter,
          true
        )
      )}</td>
<td class="number">${escapeHtml(
        supplierDisplayMoney(
          row?.SummDolg,
          formatter,
          true
        )
      )}</td>
<td class="number">${escapeHtml(
        supplierDisplayMoney(
          row?.Sebest,
          formatter,
          true
        )
      )}</td>
<td class="text">${escapeHtml(
        row?.Rem ?? ""
      )}</td>
</tr>`
    )
    .join("");
}

function buildClientCardPrintHtml({
  data,
  expanded,
  dateFrom,
  dateTo,
  locale,
  t
}) {
  const cardData =
    getClientCardData(data);
  const summary =
    clientCardSummary(cardData);
  const formatter =
    createMoneyFormatter(locale);
  const stats = expanded
    ? clientExpandedStats(
        cardData.otpuscheno
      )
    : null;

  const title = clientPeriodTitle({
    baseTitle: t(
      expanded
        ? "ClientMovements.CardExpanded"
        : "ClientMovements.Card",
      expanded
        ? "Карточка Клиента развернуто за период"
        : "Карточка Клиента за период"
    ),
    dateFrom,
    dateTo,
    t
  });

  const issuedHead = expanded
    ? `
<th class="text">${escapeHtml(t("ClientMovements.Date", "Дата"))}</th>
<th class="text">${escapeHtml(t("ClientMovements.Bill", "Счет"))}</th>
<th class="text">${escapeHtml(t("ClientMovements.Table", "Стол"))}</th>
<th class="text">${escapeHtml(t("ClientMovements.Dish", "Блюдо"))}</th>
<th class="number">${escapeHtml(t("ClientMovements.Quantity", "Количество"))}</th>
<th class="number">${escapeHtml(t("ClientMovements.Price", "Цена"))}</th>
<th class="number">${escapeHtml(t("ClientMovements.Amount", "Сумма"))}</th>
<th class="number">${escapeHtml(t("ClientMovements.InDebt", "В долг"))}</th>
<th class="number">${escapeHtml(t("ClientMovements.DiscountPercent", "Скидка %"))}</th>
<th class="text">${escapeHtml(t("ClientMovements.Waiter", "Официант"))}</th>`
    : `
<th class="text">${escapeHtml(t("ClientMovements.Date", "Дата"))}</th>
<th class="text">${escapeHtml(t("ClientMovements.Bill", "Счет"))}</th>
<th class="text">${escapeHtml(t("ClientMovements.Table", "Стол"))}</th>
<th class="text">${escapeHtml(t("ClientMovements.Waiter", "Официант"))}</th>
<th class="number">${escapeHtml(t("ClientMovements.Amount", "Сумма"))}</th>
<th class="number">${escapeHtml(t("ClientMovements.InDebt", "В долг"))}</th>
<th class="number">${escapeHtml(t("ClientMovements.Cost", "Себестоимость"))}</th>
<th class="text">${escapeHtml(t("ClientMovements.Note", "Примечание"))}</th>`;

  const paymentsBody =
    cardData.oplata
      .map(
        (row) => `<tr>
<td class="text">${escapeHtml(
          formatReportDate(
            row?.DateOpl
          )
        )}</td>
<td class="number">${escapeHtml(
          supplierDisplayMoney(
            row?.Summ,
            formatter,
            true
          )
        )}</td>
<td class="text">${escapeHtml(
          row?.Rem ?? ""
        )}</td>
</tr>`
      )
      .join("");

  const statsHtml = stats
    ? `<div class="stats">
<div><span>${escapeHtml(t("ClientMovements.Total", "Всего"))}</span><strong>${escapeHtml(formatter.format(stats.total))}</strong></div>
<div><span>${escapeHtml(t("ClientMovements.IncludingDebt", "В т.ч. в долг"))}</span><strong>${escapeHtml(formatter.format(stats.debt))}</strong></div>
<div><span>${escapeHtml(t("ClientMovements.BillCount", "Количество счетов"))}</span><strong>${stats.billCount}</strong></div>
<div><span>${escapeHtml(t("ClientMovements.GuestCount", "Количество гостей"))}</span><strong>${stats.guests}</strong></div>
<div><span>${escapeHtml(t("ClientMovements.AverageBill", "Средний чек"))}</span><strong>${escapeHtml(formatter.format(stats.average))}</strong></div>
</div>`
    : "";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
@page { size: A4 portrait; margin: 8mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; color: #111; font-size: 7pt; }
h1 { margin: 0 0 2mm; font-size: 12pt; font-style: italic; }
.info { display: grid; grid-template-columns: 1fr auto auto; gap: 5mm; margin-bottom: 3mm; padding: 2mm; background: #f3f6f2; border: 0.2mm solid #d0d6d2; }
.info span { display: block; font-size: 6.5pt; color: #555; }
.info strong { font-size: 8pt; }
h2 { margin: 4mm 0 1.2mm; font-size: 8.5pt; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
thead { display: table-header-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
th, td { padding: 0.7mm 0.7mm; border-bottom: 0.1mm solid #c9cfcc; }
th { background: #edf3f1; font-size: 6.3pt; }
.text { text-align: left; overflow-wrap: anywhere; }
.number { text-align: right; white-space: nowrap; }
.stats { margin: 2mm 0 3mm auto; width: 70mm; }
.stats div { display: flex; justify-content: space-between; gap: 4mm; padding: 0.6mm 0; }
.final { display: flex; justify-content: space-between; gap: 8mm; margin-top: 4mm; padding: 2mm 3mm; border: 0.3mm solid #9eaa9a; background: #edf3e9; font-size: 9pt; font-weight: 700; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>

<div class="info">
  <div>
    <span>${escapeHtml(t("ClientMovements.Client", "Клиент"))}</span>
    <strong>${escapeHtml(cardData.saldo?.Klient ?? "")}</strong>
  </div>
  <div>
    <span>${escapeHtml(t("ClientMovements.Discount", "Скидка"))}</span>
    <strong>${escapeHtml(cardData.saldo?.Skidka ?? "")}</strong>
  </div>
  <div>
    <span>${escapeHtml(t("ClientMovements.OpeningBalance", "Сальдо на начало"))}</span>
    <strong>${escapeHtml(formatter.format(summary.opening))}</strong>
  </div>
</div>

<h2>${escapeHtml(
    t(
      expanded
        ? "ClientMovements.IssuedExpanded"
        : "ClientMovements.Issued",
      expanded
        ? "Отпущено — развернуто"
        : "Отпущено"
    )
  )}</h2>

<table>
<thead><tr>${issuedHead}</tr></thead>
<tbody>${clientCardPrintIssuedRows({
    rows: cardData.otpuscheno,
    expanded,
    formatter
  })}</tbody>
</table>

${statsHtml}

<h2>${escapeHtml(t("ClientMovements.Payments", "Оплата"))}</h2>
<table>
<thead>
<tr>
<th class="text">${escapeHtml(t("ClientMovements.Date", "Дата"))}</th>
<th class="number">${escapeHtml(t("ClientMovements.Amount", "Сумма"))}</th>
<th class="text">${escapeHtml(t("ClientMovements.Note", "Примечание"))}</th>
</tr>
</thead>
<tbody>${paymentsBody}</tbody>
</table>

<div class="final">
  <span>${escapeHtml(t("ClientMovements.TotalDebt", "Итого долг"))}</span>
  <strong>${escapeHtml(formatter.format(summary.closing))}</strong>
</div>
</body>
</html>`;
}

function buildClientCardExportModel({
  data,
  expanded,
  dateFrom,
  dateTo,
  t
}) {
  const cardData =
    getClientCardData(data);
  const summary =
    clientCardSummary(cardData);
  const stats = expanded
    ? clientExpandedStats(
        cardData.otpuscheno
      )
    : null;

  const rows = [];

  rows.push({
    Section: t(
      "ClientMovements.OpeningBalance",
      "Сальдо на начало"
    ),
    Date: "",
    Bill: "",
    Table: "",
    Description:
      cardData.saldo?.Klient ?? "",
    Quantity: "",
    Price: "",
    Amount: summary.opening,
    Debt: "",
    Discount:
      cardData.saldo?.Skidka ?? "",
    Note: ""
  });

  cardData.otpuscheno.forEach(
    (row) => {
      rows.push({
        Section: t(
          "ClientMovements.Issued",
          "Отпущено"
        ),
        Date: formatReportDate(
          expanded
            ? row?.Oplacheno
            : row?.DateOplat
        ),
        Bill: row?.Number ?? "",
        Table: row?.Table ?? "",
        Description: expanded
          ? row?.NameDish ?? ""
          : row?.NameKl ?? "",
        Quantity: expanded
          ? row?.Kolvo ?? ""
          : "",
        Price: expanded
          ? row?.Price ?? ""
          : "",
        Amount: row?.Summ ?? "",
        Debt: row?.SummDolg ?? "",
        Discount: expanded
          ? row?.Discount ?? ""
          : "",
        Note: row?.Rem ?? ""
      });
    }
  );

  if (stats) {
    rows.push({
      Section: t(
        "ClientMovements.Total",
        "Всего"
      ),
      Date: "",
      Bill: "",
      Table: "",
      Description: "",
      Quantity: "",
      Price: "",
      Amount: stats.total,
      Debt: stats.debt,
      Discount: "",
      Note: ""
    });

    rows.push({
      Section: t(
        "ClientMovements.BillCount",
        "Количество счетов"
      ),
      Date: "",
      Bill: "",
      Table: "",
      Description:
        stats.billCount,
      Quantity: "",
      Price: "",
      Amount: "",
      Debt: "",
      Discount: "",
      Note: ""
    });

    rows.push({
      Section: t(
        "ClientMovements.GuestCount",
        "Количество гостей"
      ),
      Date: "",
      Bill: "",
      Table: "",
      Description:
        stats.guests,
      Quantity: "",
      Price: "",
      Amount: "",
      Debt: "",
      Discount: "",
      Note: ""
    });

    rows.push({
      Section: t(
        "ClientMovements.AverageBill",
        "Средний чек"
      ),
      Date: "",
      Bill: "",
      Table: "",
      Description: "",
      Quantity: "",
      Price: "",
      Amount: stats.average,
      Debt: "",
      Discount: "",
      Note: ""
    });
  }

  cardData.oplata.forEach(
    (row) => {
      rows.push({
        Section: t(
          "ClientMovements.Payments",
          "Оплата"
        ),
        Date: formatReportDate(
          row?.DateOpl
        ),
        Bill: "",
        Table: "",
        Description: "",
        Quantity: "",
        Price: "",
        Amount: row?.Summ ?? "",
        Debt: "",
        Discount: "",
        Note: row?.Rem ?? ""
      });
    }
  );

  rows.push({
    Section: t(
      "ClientMovements.TotalDebt",
      "Итого долг"
    ),
    Date: "",
    Bill: "",
    Table: "",
    Description: "",
    Quantity: "",
    Price: "",
    Amount: "",
    Debt: summary.closing,
    Discount: "",
    Note: ""
  });

  return {
    title: clientPeriodTitle({
      baseTitle: t(
        expanded
          ? "ClientMovements.CardExpanded"
          : "ClientMovements.Card",
        expanded
          ? "Карточка Клиента развернуто за период"
          : "Карточка Клиента за период"
      ),
      dateFrom,
      dateTo,
      t
    }),
    fileName: `${
      expanded
        ? "CardsKliRazv"
        : "CardsKli"
    }_${safeClientReportFilePart(
      dateFrom
    )}_${safeClientReportFilePart(
      dateTo
    )}`,
    orientation: "portrait",
    columns: [
      {
        key: "Section",
        title: t(
          "ClientMovements.Section",
          "Раздел"
        ),
        type: "text",
        width: 20
      },
      {
        key: "Date",
        title: t(
          "ClientMovements.Date",
          "Дата"
        ),
        type: "text",
        width: 12
      },
      {
        key: "Bill",
        title: t(
          "ClientMovements.Bill",
          "Счет"
        ),
        type: "text",
        width: 10
      },
      {
        key: "Table",
        title: t(
          "ClientMovements.Table",
          "Стол"
        ),
        type: "text",
        width: 8
      },
      {
        key: "Description",
        title: t(
          "ClientMovements.Description",
          "Наименование"
        ),
        type: "text",
        width: 30
      },
      {
        key: "Quantity",
        title: t(
          "ClientMovements.Quantity",
          "Количество"
        ),
        type: "number",
        decimals: 2,
        width: 11
      },
      {
        key: "Price",
        title: t(
          "ClientMovements.Price",
          "Цена"
        ),
        type: "number",
        decimals: 2,
        width: 11
      },
      {
        key: "Amount",
        title: t(
          "ClientMovements.Amount",
          "Сумма"
        ),
        type: "number",
        decimals: 2,
        width: 12
      },
      {
        key: "Debt",
        title: t(
          "ClientMovements.InDebt",
          "В долг"
        ),
        type: "number",
        decimals: 2,
        width: 12
      },
      {
        key: "Discount",
        title: t(
          "ClientMovements.Discount",
          "Скидка"
        ),
        type: "text",
        width: 10
      },
      {
        key: "Note",
        title: t(
          "ClientMovements.Note",
          "Примечание"
        ),
        type: "text",
        width: 20
      }
    ],
    rows,
    footerRows: []
  };
}

function openClientReportPrintWindow(
  html,
  t
) {
  const printWindow = window.open(
    "",
    "_blank",
    "width=1100,height=900"
  );

  if (!printWindow) {
    window.alert(
      t(
        "Reports.PrintPopupBlocked",
        "Браузер заблокировал окно печати. Разрешите всплывающие окна для Web Office."
      )
    );
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();

  closePrintWindowAfterPrint(
    printWindow
  );

  window.setTimeout(() => {
    printWindow.print();
  }, 150);
}

function ClientNestedReportToolbar({
  onBack,
  onReload,
  onPrint,
  onExcel,
  onWord,
  t
}) {
  return (
    <div className="report-toolbar client-report-toolbar">
      <button
        type="button"
        className="report-action-button client-report-back-button"
        onClick={onBack}
      >
        ←{" "}
        {t(
          "ClientMovements.Back",
          "К отчетам"
        )}
      </button>

      <button
        type="button"
        className="report-run-button"
        onClick={onReload}
      >
        {t(
          "Common.Generate",
          "Сформировать"
        )}
      </button>

      <div className="client-report-toolbar-spacer" />

      <button
        type="button"
        className="report-action-button report-print-button"
        onClick={onPrint}
      >
        {t(
          "Common.Print",
          "Печать"
        )}
      </button>

      <button
        type="button"
        className="report-action-button report-excel-button"
        onClick={onExcel}
      >
        {t(
          "Common.Excel",
          "Excel"
        )}
      </button>

      <button
        type="button"
        className="report-action-button report-word-button"
        onClick={onWord}
      >
        {t(
          "Common.Word",
          "Word"
        )}
      </button>
    </div>
  );
}

function ClientSimpleReportView({
  reportKey,
  data,
  dateFrom,
  dateTo,
  locale,
  fetchWithAuth,
  t,
  contextName = "",
  onBack,
  onReload
}) {
  const definition =
    getClientSimpleDefinition(
      reportKey,
      t
    );
  const rows =
    normalizeClientReportRows(data);
  const formatter =
    createMoneyFormatter(locale);
  const baseTitle = clientPeriodTitle({
    baseTitle: definition.title,
    dateFrom,
    dateTo,
    t
  });
  const title = contextName
    ? `${baseTitle} — ${contextName}`
    : baseTitle;

  async function exportFile(format) {
    try {
      await exportReportFile({
        fetchWithAuth,
        reportModel:
          buildClientSimpleExportModel({
            rows,
            definition,
            dateFrom,
            dateTo,
            t,
            contextName
          }),
        format,
        errorMessage: t(
          "Report.ExportError",
          "Ошибка экспорта отчёта."
        )
      });
    } catch (error) {
      window.alert(
        error?.message ||
          t(
            "Report.ExportError",
            "Ошибка экспорта отчёта."
          )
      );
    }
  }

  return (
    <div className="reports-page client-nested-report-page">
      <ClientNestedReportToolbar
        onBack={onBack}
        onReload={onReload}
        onPrint={() =>
          openClientReportPrintWindow(
            buildClientSimplePrintHtml({
              rows,
              definition,
              dateFrom,
              dateTo,
              locale,
              t,
              contextName
            }),
            t
          )
        }
        onExcel={() =>
          exportFile("xlsx")
        }
        onWord={() =>
          exportFile("docx")
        }
        t={t}
      />

      <article className="revenue-report-sheet client-report-sheet">
        <h3>{title}</h3>

        <ClientSimpleTable
          rows={rows}
          columns={
            definition.columns
          }
          formatter={formatter}
          t={t}
        />
      </article>
    </div>
  );
}

function ClientCardReportView({
  data,
  expanded,
  dateFrom,
  dateTo,
  locale,
  fetchWithAuth,
  t,
  onBack,
  onReload
}) {
  const cardData =
    getClientCardData(data);
  const summary =
    clientCardSummary(cardData);
  const formatter =
    createMoneyFormatter(locale);
  const title = clientPeriodTitle({
    baseTitle: t(
      expanded
        ? "ClientMovements.CardExpanded"
        : "ClientMovements.Card",
      expanded
        ? "Карточка Клиента развернуто за период"
        : "Карточка Клиента за период"
    ),
    dateFrom,
    dateTo,
    t
  });

  async function exportFile(format) {
    try {
      await exportReportFile({
        fetchWithAuth,
        reportModel:
          buildClientCardExportModel({
            data,
            expanded,
            dateFrom,
            dateTo,
            t
          }),
        format,
        errorMessage: t(
          "Report.ExportError",
          "Ошибка экспорта отчёта."
        )
      });
    } catch (error) {
      window.alert(
        error?.message ||
          t(
            "Report.ExportError",
            "Ошибка экспорта отчёта."
          )
      );
    }
  }

  return (
    <div className="reports-page client-nested-report-page">
      <ClientNestedReportToolbar
        onBack={onBack}
        onReload={onReload}
        onPrint={() =>
          openClientReportPrintWindow(
            buildClientCardPrintHtml({
              data,
              expanded,
              dateFrom,
              dateTo,
              locale,
              t
            }),
            t
          )
        }
        onExcel={() =>
          exportFile("xlsx")
        }
        onWord={() =>
          exportFile("docx")
        }
        t={t}
      />

      <article className="revenue-report-sheet client-report-sheet client-card-report-sheet">
        <h3>{title}</h3>

        <ClientCardHeader
          cardData={cardData}
          summary={summary}
          formatter={formatter}
          t={t}
        />

        {expanded ? (
          <ClientIssuedExpandedTable
            rows={
              cardData.otpuscheno
            }
            formatter={formatter}
            t={t}
          />
        ) : (
          <ClientIssuedCompactTable
            rows={
              cardData.otpuscheno
            }
            formatter={formatter}
            t={t}
          />
        )}

        <ClientPaymentsTable
          rows={cardData.oplata}
          formatter={formatter}
          t={t}
        />

        <div className="client-total-debt-line">
          <span>
            {t(
              "ClientMovements.TotalDebt",
              "Итого долг"
            )}
          </span>
          <strong>
            {formatter.format(
              summary.closing
            )}
          </strong>
        </div>
      </article>
    </div>
  );
}

function ClientReportsNavigator({
  data,
  dateFrom,
  dateTo,
  organizationId,
  departmentId,
  all,
  locale,
  fetchWithAuth,
  bonusEnabled = false,
  t
}) {
  const clients =
    normalizeClientNavigatorRows(data);
  const [query, setQuery] =
    useState("");
  const [
    showResults,
    setShowResults
  ] = useState(false);
  const [
    selectedClient,
    setSelectedClient
  ] = useState(null);
  const [
    activeReport,
    setActiveReport
  ] = useState(null);
  const [
    reportLoading,
    setReportLoading
  ] = useState(false);
  const [
    reportError,
    setReportError
  ] = useState("");

  const searchableClients =
    useMemo(
      () =>
        clients.map((row) => ({
          row,
          name: String(
            row?.Name ?? ""
          ).toLocaleLowerCase(),
          phone: String(
            row?.Phone ?? ""
          ).toLocaleLowerCase(),
          phoneDigits: String(
            row?.Phone ?? ""
          ).replace(/\D/g, "")
        })),
      [clients]
    );

  const foundClients =
    useMemo(() => {
      const text = query
        .trim()
        .toLocaleLowerCase();

      if (!text) {
        return [];
      }

      const digits =
        text.replace(/\D/g, "");
      return searchableClients
        .filter((item) => {
          const nameMatch =
            item.name.includes(text);
          const phoneMatch =
            item.phone.includes(text);
          const phoneDigitsMatch =
            digits.length > 0 &&
            item.phoneDigits.includes(
              digits
            );

          return (
            nameMatch ||
            phoneMatch ||
            phoneDigitsMatch
          );
        })
        .slice(0, 50)
        .map((item) => item.row);
    }, [query, searchableClients]);

  useEffect(() => {
    setActiveReport(null);
    setReportError("");
  }, [
    dateFrom,
    dateTo,
    organizationId,
    departmentId,
    all
  ]);

  async function loadClientReport(
    reportKey
  ) {
    const isClientSelectedReport =
      reportKey === "card" ||
      reportKey === "cardExpanded" ||
      reportKey === "bonusClient";

    const isBonusReport =
      reportKey === "bonusList" ||
      reportKey === "bonusPeriod" ||
      reportKey === "bonusClient";

    if (isBonusReport && !bonusEnabled) {
      return;
    }

    const idKli = isClientSelectedReport
      ? Number(
          selectedClient?.ID ?? 0
        )
      : 0;

    if (
      isClientSelectedReport &&
      !idKli
    ) {
      return;
    }

    const definition =
      reportKey === "card" ||
      reportKey === "cardExpanded"
        ? {
            apiAction:
              reportKey ===
              "cardExpanded"
                ? "CardsKliRazv"
                : "CardsKli"
          }
        : getClientSimpleDefinition(
            reportKey,
            t
          );

    setReportLoading(true);
    setReportError("");

    try {
      const url = new URL(
        "https://webback.bar-boss.com/wr_Reports.php"
      );
      url.searchParams.set(
        "Action",
        definition.apiAction
      );

      const response =
        await fetchWithAuth(
          url.toString(),
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/xml; charset=utf-8"
            },
            body: buildClientReportXml({
              dateFrom,
              dateTo,
              organizationId,
              all,
              departmentId,
              idKli
            })
          }
        );

      const text =
        await response.text();
      let result;

      try {
        result =
          JSON.parse(text);
      } catch {
        throw new Error(
          "Отчёт вернул не JSON: " +
            text.substring(
              0,
              500
            )
        );
      }

      if (
        !response.ok ||
        result?.status === "error"
      ) {
        throw new Error(
          result?.error ||
            result?.message ||
            t(
              "ClientMovements.ReportLoadError",
              "Ошибка формирования отчёта по клиенту"
            )
        );
      }

      setActiveReport({
        key: reportKey,
        apiAction:
          definition.apiAction,
        idKli,
        data: result
      });
    } catch (error) {
      setReportError(
        error?.message ||
          t(
            "ClientMovements.ReportLoadError",
            "Ошибка формирования отчёта по клиенту"
          )
      );
    } finally {
      setReportLoading(false);
    }
  }

  if (activeReport) {
    const reload = () =>
      loadClientReport(
        activeReport.key
      );

    if (
      activeReport.key === "card" ||
      activeReport.key ===
        "cardExpanded"
    ) {
      return (
        <ClientCardReportView
          data={activeReport.data}
          expanded={
            activeReport.key ===
            "cardExpanded"
          }
          dateFrom={dateFrom}
          dateTo={dateTo}
          locale={locale}
          fetchWithAuth={
            fetchWithAuth
          }
          t={t}
          onBack={() => {
            setActiveReport(null);
            setReportError("");
          }}
          onReload={reload}
        />
      );
    }

    return (
      <ClientSimpleReportView
        reportKey={
          activeReport.key
        }
        data={activeReport.data}
        dateFrom={dateFrom}
        dateTo={dateTo}
        locale={locale}
        fetchWithAuth={fetchWithAuth}
        t={t}
        contextName={
          activeReport.key ===
          "bonusClient"
            ? selectedClient?.Name ?? ""
            : ""
        }
        onBack={() => {
          setActiveReport(null);
          setReportError("");
        }}
        onReload={reload}
      />
    );
  }

  const title = clientPeriodTitle({
    baseTitle: t(
      "ClientMovements.Title",
      "Движения по клиентам"
    ),
    dateFrom,
    dateTo,
    t
  });

  return (
    <div className="reports-page client-reports-navigator-page">
      {reportLoading && (
        <div
          className="client-report-busy"
          role="status"
          aria-live="polite"
        >
          <div className="client-report-busy-panel">
            <div className="oborot-generation-spinner" />
            <div>
              {t(
                "Oborot.Calculating",
                "ФОРМИРУЕМ…"
              )}
            </div>
          </div>
        </div>
      )}

      <article className="revenue-report-sheet client-reports-navigator-sheet">
        <header className="client-reports-navigator-heading">
          <div>
            <h3>{title}</h3>
            <div className="client-reports-count">
              {t(
                "ClientMovements.ClientsLoaded",
                "Клиентов загружено"
              )}
              : {clients.length}
            </div>
          </div>
        </header>

        <section className="client-search-panel">
          <label htmlFor="client-report-search">
            {t(
              "ClientMovements.SearchClient",
              "Клиент / телефон"
            )}
          </label>

          <div className="client-search-control">
            <input
              id="client-report-search"
              type="text"
              value={query}
              autoComplete="off"
              placeholder={t(
                "ClientMovements.SearchPlaceholder",
                "Введите имя или телефон"
              )}
              onFocus={() => {
                if (query.trim()) {
                  setShowResults(true);
                }
              }}
              onBlur={() => {
                window.setTimeout(
                  () =>
                    setShowResults(
                      false
                    ),
                  150
                );
              }}
              onChange={(event) => {
                setQuery(
                  event.target.value
                );
                setShowResults(true);
              }}
            />

            {(query ||
              selectedClient) && (
              <button
                type="button"
                className="client-search-clear"
                onClick={() => {
                  setQuery("");
                  setSelectedClient(
                    null
                  );
                  setShowResults(
                    false
                  );
                }}
                aria-label={t(
                  "ClientMovements.ClearClient",
                  "Очистить клиента"
                )}
              >
                ×
              </button>
            )}

            {showResults &&
              query.trim() && (
                <div className="client-search-results">
                  {foundClients.length >
                  0 ? (
                    foundClients.map(
                      (row, index) => (
                        <button
                          type="button"
                          key={`${row?.ID ?? "client"}-${index}`}
                          className="client-search-result"
                          onMouseDown={(
                            event
                          ) =>
                            event.preventDefault()
                          }
                          onClick={() => {
                            setSelectedClient(
                              row
                            );
                            setQuery(
                              String(
                                row?.Name ??
                                  ""
                              )
                            );
                            setShowResults(
                              false
                            );
                          }}
                        >
                          <span>
                            {row?.Name ??
                              ""}
                          </span>
                          <small>
                            {row?.Phone ??
                              ""}
                          </small>
                        </button>
                      )
                    )
                  ) : (
                    <div className="client-search-empty">
                      {t(
                        "ClientMovements.NotFound",
                        "Клиенты не найдены"
                      )}
                    </div>
                  )}
                </div>
              )}
          </div>

          {selectedClient && (
            <div className="client-selected-card">
              <span>
                {t(
                  "ClientMovements.SelectedClient",
                  "Выбран клиент"
                )}
              </span>
              <strong>
                {selectedClient?.Name ??
                  ""}
              </strong>
              <em>
                {selectedClient?.Phone ??
                  ""}
              </em>
            </div>
          )}
        </section>

        {reportError && (
          <div className="login-error client-report-error">
            {reportError}
          </div>
        )}

        <section className="client-report-buttons">
          <button
            type="button"
            onClick={() =>
              loadClientReport(
                "dolgi"
              )
            }
          >
            <strong>
              {t(
                "ClientMovements.DebtPeriod",
                "Долговые за период"
              )}
            </strong>
          </button>

          <button
            type="button"
            onClick={() =>
              loadClientReport(
                "skidki"
              )
            }
          >
            <strong>
              {t(
                "ClientMovements.DiscountPeriod",
                "Скидочные за период"
              )}
            </strong>
          </button>

          <button
            type="button"
            onClick={() =>
              loadClientReport(
                "dolgisvod"
              )
            }
          >
            <strong>
              {t(
                "ClientMovements.DebtSummary",
                "Свод по долговым"
              )}
            </strong>
          </button>

          {bonusEnabled && (
            <>
              <button
                type="button"
                onClick={() =>
                  loadClientReport(
                    "bonusList"
                  )
                }
              >
                <strong>
                  {t(
                    "ClientMovements.BonusMovements",
                    "Движения бонусов"
                  )}
                </strong>
              </button>

              <button
                type="button"
                onClick={() =>
                  loadClientReport(
                    "bonusPeriod"
                  )
                }
              >
                <strong>
                  {t(
                    "ClientMovements.BonusPeriod",
                    "Бонусы за период"
                  )}
                </strong>
              </button>
            </>
          )}

          {selectedClient && (
            <>
              <button
                type="button"
                className="client-report-button-selected"
                onClick={() =>
                  loadClientReport(
                    "card"
                  )
                }
              >
                <strong>
                  {t(
                    "ClientMovements.CardButton",
                    "Карточка Клиента"
                  )}
                </strong>
                <span>
                  {selectedClient?.Name ??
                    ""}
                </span>
              </button>

              <button
                type="button"
                className="client-report-button-selected"
                onClick={() =>
                  loadClientReport(
                    "cardExpanded"
                  )
                }
              >
                <strong>
                  {t(
                    "ClientMovements.CardExpandedButton",
                    "Карточка Развернуто"
                  )}
                </strong>
                <span>
                  {selectedClient?.Name ??
                    ""}
                </span>
              </button>

              {bonusEnabled && (
                <button
                  type="button"
                  className="client-report-button-selected"
                  onClick={() =>
                    loadClientReport(
                      "bonusClient"
                    )
                  }
                >
                  <strong>
                    {t(
                      "ClientMovements.BonusClient",
                      "Бонусы клиента"
                    )}
                  </strong>
                  <span>
                    {selectedClient?.Name ??
                      ""}
                  </span>
                </button>
              )}
            </>
          )}
        </section>

        {!selectedClient && (
          <div className="client-card-buttons-hint">
            {t(
              "ClientMovements.SelectClientHint",
              "После выбора клиента появятся его карточки."
            )}
          </div>
        )}
      </article>
    </div>
  );
}


function getKonsumRows(data) {
  const payload = data?.data ?? data?.Data ?? data;

  if (Array.isArray(payload)) {
    return payload;
  }

  return normalizeRows(
    payload?.Main ??
    payload?.main ??
    payload?.Rows ??
    payload?.rows ??
    payload?.Konsum ??
    payload?.konsum
  );
}

function sortKonsumText(left, right) {
  return String(left ?? "").localeCompare(
    String(right ?? ""),
    undefined,
    { sensitivity: "base" }
  );
}

function groupKonsumRows(rows) {
  const sorted = [...rows].sort((left, right) => {
    const girlCompare = sortKonsumText(
      left?.NemeGirl,
      right?.NemeGirl
    );

    if (girlCompare !== 0) {
      return girlCompare;
    }

    const groupCompare = sortKonsumText(
      left?.GroupBlud,
      right?.GroupBlud
    );

    if (groupCompare !== 0) {
      return groupCompare;
    }

    return sortKonsumText(
      left?.NameDish,
      right?.NameDish
    );
  });

  const girls = [];

  for (const row of sorted) {
    const girlName =
      String(row?.NemeGirl ?? "").trim() || "—";
    const groupName =
      String(row?.GroupBlud ?? "").trim() || "—";

    let girl = girls[girls.length - 1];

    if (!girl || girl.name !== girlName) {
      girl = {
        name: girlName,
        rows: [],
        groups: []
      };
      girls.push(girl);
    }

    girl.rows.push(row);

    let dishGroup =
      girl.groups[girl.groups.length - 1];

    if (!dishGroup || dishGroup.name !== groupName) {
      dishGroup = {
        name: groupName,
        rows: []
      };
      girl.groups.push(dishGroup);
    }

    dishGroup.rows.push(row);
  }

  return girls;
}

function konsumTotals(rows) {
  return {
    Kolvo: sumField(rows, "Kolvo"),
    Summ: sumField(rows, "Summ"),
    SummCred: sumField(rows, "SummCred"),
    SumKons: sumField(rows, "SumKons"),
    KonsCred: sumField(rows, "KonsCred")
  };
}

function KonsumHeader({ t }) {
  return (
    <tr>
      <th className="report-text">
        {t("Konsum.Dish", "Блюдо")}
      </th>
      <th className="report-money">
        {t("Konsum.Quantity", "Количество")}
      </th>
      <th className="report-money">
        {t("Konsum.Percent", "% консумации")}
      </th>
      <th className="report-money">
        {t("Konsum.CashAmount", "Сумма нал")}
      </th>
      <th className="report-money">
        {t("Konsum.CreditAmount", "Сумма кред")}
      </th>
      <th className="report-money">
        {t("Konsum.Payout", "К выплате")}
      </th>
      <th className="report-money">
        {t("Konsum.CreditPayout", "К выплате Кред")}
      </th>
    </tr>
  );
}

function KonsumRows({ rows, formatter }) {
  return (
    <>
      {rows.map((row, index) => (
        <tr
          key={`${row?.NameDish ?? "dish"}-${index}`}
        >
          <td className="report-text">
            {row?.NameDish || "—"}
          </td>
          <td className="report-money">
            {formatter.format(
              numericValue(row?.Kolvo)
            )}
          </td>
          <td className="report-money">
            {formatter.format(
              numericValue(row?.ProcKonsum)
            )}
          </td>
          <td className="report-money">
            {formatter.format(
              numericValue(row?.Summ)
            )}
          </td>
          <td className="report-money">
            {formatter.format(
              numericValue(row?.SummCred)
            )}
          </td>
          <td className="report-money">
            {formatter.format(
              numericValue(row?.SumKons)
            )}
          </td>
          <td className="report-money">
            {formatter.format(
              numericValue(row?.KonsCred)
            )}
          </td>
        </tr>
      ))}
    </>
  );
}

function KonsumSubtotalRow({
  label,
  totals,
  formatter,
  className = ""
}) {
  return (
    <tr className={className}>
      <td className="report-text report-total-label">
        {label}
      </td>
      <td className="report-money">
        {formatter.format(totals.Kolvo)}
      </td>
      <td />
      <td className="report-money">
        {formatter.format(totals.Summ)}
      </td>
      <td className="report-money">
        {formatter.format(totals.SummCred)}
      </td>
      <td className="report-money">
        {formatter.format(totals.SumKons)}
      </td>
      <td className="report-money">
        {formatter.format(totals.KonsCred)}
      </td>
    </tr>
  );
}

function KonsumReportTable({ rows, formatter, t }) {
  const girls = groupKonsumRows(rows);
  const grandTotals = konsumTotals(rows);

  return (
    <div className="konsum-groups">
      {girls.map((girl) => {
        const girlTotals = konsumTotals(girl.rows);

        return (
          <section
            className="konsum-girl-group"
            key={girl.name}
          >
            <div className="konsum-girl-title">
              {girl.name}
            </div>

            <div className="report-table-scroll">
              <table className="report-table konsum-table">
                <thead>
                  <KonsumHeader t={t} />
                </thead>

                <tbody>
                  {girl.groups.map((dishGroup) => {
                    const groupTotals =
                      konsumTotals(dishGroup.rows);

                    return (
                      <Fragment key={dishGroup.name}>
                        <tr className="konsum-dish-group-row">
                          <td colSpan="7">
                            {dishGroup.name}
                          </td>
                        </tr>

                        <KonsumRows
                          rows={dishGroup.rows}
                          formatter={formatter}
                        />

                        <KonsumSubtotalRow
                          label={`${t(
                            "Konsum.GroupTotal",
                            "Итого по группе"
                          )}: ${dishGroup.name}`}
                          totals={groupTotals}
                          formatter={formatter}
                          className="konsum-group-total-row"
                        />
                      </Fragment>
                    );
                  })}

                  <KonsumSubtotalRow
                    label={`${t(
                      "Konsum.PersonTotal",
                      "Итого"
                    )}: ${girl.name}`}
                    totals={girlTotals}
                    formatter={formatter}
                    className="konsum-person-total-row"
                  />
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {girls.length > 0 && (
        <div className="konsum-grand-total">
          <div className="konsum-grand-total-title">
            {t("Common.Total", "Итого")}
          </div>
          <div>
            <span>{t("Konsum.CashAmount", "Сумма нал")}</span>
            <strong>{formatter.format(grandTotals.Summ)}</strong>
          </div>
          <div>
            <span>{t("Konsum.CreditAmount", "Сумма кред")}</span>
            <strong>{formatter.format(grandTotals.SummCred)}</strong>
          </div>
          <div>
            <span>{t("Konsum.Payout", "К выплате")}</span>
            <strong>{formatter.format(grandTotals.SumKons)}</strong>
          </div>
          <div>
            <span>{t("Konsum.CreditPayout", "К выплате Кред")}</span>
            <strong>{formatter.format(grandTotals.KonsCred)}</strong>
          </div>
        </div>
      )}
    </div>
  );
}

function konsumPrintHeader(t) {
  return `<thead><tr>
<th class="text dish">${escapeHtml(t("Konsum.Dish", "Блюдо"))}</th>
<th>${escapeHtml(t("Konsum.Quantity", "Количество"))}</th>
<th>${escapeHtml(t("Konsum.Percent", "% консумации"))}</th>
<th>${escapeHtml(t("Konsum.CashAmount", "Сумма нал"))}</th>
<th>${escapeHtml(t("Konsum.CreditAmount", "Сумма кред"))}</th>
<th>${escapeHtml(t("Konsum.Payout", "К выплате"))}</th>
<th>${escapeHtml(t("Konsum.CreditPayout", "К выплате Кред"))}</th>
</tr></thead>`;
}

function konsumPrintDataRows(rows, formatter) {
  return rows
    .map(
      (row) => `<tr>
<td class="text">${escapeHtml(row?.NameDish || "—")}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.Kolvo)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.ProcKonsum)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.Summ)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.SummCred)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.SumKons)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.KonsCred)))}</td>
</tr>`
    )
    .join("");
}

function konsumPrintSubtotal({ label, totals, formatter, className }) {
  return `<tr class="${className}">
<td class="text total-label">${escapeHtml(label)}</td>
<td class="number">${escapeHtml(formatter.format(totals.Kolvo))}</td>
<td></td>
<td class="number">${escapeHtml(formatter.format(totals.Summ))}</td>
<td class="number">${escapeHtml(formatter.format(totals.SummCred))}</td>
<td class="number">${escapeHtml(formatter.format(totals.SumKons))}</td>
<td class="number">${escapeHtml(formatter.format(totals.KonsCred))}</td>
</tr>`;
}

function buildKonsumPrintHtml({
  rows,
  dateFrom,
  dateTo,
  locale,
  t
}) {
  const formatter = createMoneyFormatter(locale);
  const girls = groupKonsumRows(rows);
  const grandTotals = konsumTotals(rows);
  const title = `${t(
    "Konsum.Title",
    "Отчет по консумации"
  )} ${t("Common.From", "с")} ${formatReportDate(
    dateFrom
  )} ${t("Common.To", "по")} ${formatReportDate(dateTo)}`;

  const body = girls
    .map((girl) => {
      const girlTotals = konsumTotals(girl.rows);
      const groupHtml = girl.groups
        .map((dishGroup) => {
          const groupTotals = konsumTotals(dishGroup.rows);

          return `<tr class="dish-group"><td colspan="7">${escapeHtml(
            dishGroup.name
          )}</td></tr>
${konsumPrintDataRows(dishGroup.rows, formatter)}
${konsumPrintSubtotal({
            label: `${t("Konsum.GroupTotal", "Итого по группе")}: ${dishGroup.name}`,
            totals: groupTotals,
            formatter,
            className: "group-total"
          })}`;
        })
        .join("");

      return `<section class="girl-group">
<h2>${escapeHtml(girl.name)}</h2>
<table>
${konsumPrintHeader(t)}
<tbody>
${groupHtml}
${konsumPrintSubtotal({
        label: `${t("Konsum.PersonTotal", "Итого")}: ${girl.name}`,
        totals: girlTotals,
        formatter,
        className: "person-total"
      })}
</tbody>
</table>
</section>`;
    })
    .join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
@page { size: A4 portrait; margin: 8mm 7mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; color: #111; font-size: 6.8pt; }
h1 { margin: 0 0 3mm; font-size: 12pt; font-style: italic; }
h2 { margin: 3.5mm 0 1.2mm; padding: 1.2mm 1.5mm; background: #e8efe7; font-size: 8.2pt; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
thead { display: table-header-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
th, td { padding: 0.65mm 0.75mm; border-bottom: 0.1mm solid #cbd1cc; vertical-align: top; }
th { background: #f0f3ef; font-size: 6.1pt; line-height: 1.15; }
th.dish { width: 31%; }
.text { text-align: left; overflow-wrap: anywhere; }
.number { text-align: right; white-space: nowrap; }
.dish-group td { padding-top: 1mm; padding-bottom: 0.8mm; background: #f6f8f5; font-weight: 700; }
.group-total td { background: #f8faf7; font-weight: 700; }
.person-total td { border-top: 0.25mm solid #89958c; background: #edf3eb; font-weight: 700; }
.total-label { text-align: left; }
.grand { margin: 4mm 0 0 auto; width: 100%; border-top: 0.35mm solid #6f7d72; background: #e8efe7; }
.grand td { padding: 1.2mm 1mm; font-weight: 700; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
${body}
<table class="grand"><tbody>
<tr>
<td class="text">${escapeHtml(t("Common.Total", "Итого"))}</td>
<td class="number">${escapeHtml(t("Konsum.CashAmount", "Сумма нал"))}: ${escapeHtml(formatter.format(grandTotals.Summ))}</td>
<td class="number">${escapeHtml(t("Konsum.CreditAmount", "Сумма кред"))}: ${escapeHtml(formatter.format(grandTotals.SummCred))}</td>
</tr>
<tr>
<td></td>
<td class="number">${escapeHtml(t("Konsum.Payout", "К выплате"))}: ${escapeHtml(formatter.format(grandTotals.SumKons))}</td>
<td class="number">${escapeHtml(t("Konsum.CreditPayout", "К выплате Кред"))}: ${escapeHtml(formatter.format(grandTotals.KonsCred))}</td>
</tr>
</tbody></table>
</body>
</html>`;
}

function printKonsumReport(options) {
  const printWindow = window.open(
    "",
    "_blank",
    "width=900,height=900"
  );

  if (!printWindow) {
    window.alert(
      options.t(
        "Reports.PrintPopupBlocked",
        "Браузер заблокировал окно печати. Разрешите всплывающие окна для Web Office."
      )
    );
    return;
  }

  printWindow.document.open();
  printWindow.document.write(
    buildKonsumPrintHtml(options)
  );
  printWindow.document.close();
  printWindow.focus();
  closePrintWindowAfterPrint(printWindow);

  window.setTimeout(() => {
    printWindow.print();
  }, 150);
}

function safeKonsumFilePart(value) {
  return String(value ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

function buildKonsumExportModel({
  rows,
  dateFrom,
  dateTo,
  locale,
  t
}) {
  const exportRows = [];

  for (const girl of groupKonsumRows(rows)) {
    for (const dishGroup of girl.groups) {
      for (const row of dishGroup.rows) {
        exportRows.push({
          Person: girl.name,
          Group: dishGroup.name,
          Dish: row?.NameDish || "",
          Quantity: row?.Kolvo ?? "",
          Percent: row?.ProcKonsum ?? "",
          CashAmount: row?.Summ ?? "",
          CreditAmount: row?.SummCred ?? "",
          Payout: row?.SumKons ?? "",
          CreditPayout: row?.KonsCred ?? ""
        });
      }

      const groupTotals = konsumTotals(dishGroup.rows);
      exportRows.push({
        Person: girl.name,
        Group: dishGroup.name,
        Dish: t("Konsum.GroupTotal", "Итого по группе"),
        Quantity: groupTotals.Kolvo,
        Percent: "",
        CashAmount: groupTotals.Summ,
        CreditAmount: groupTotals.SummCred,
        Payout: groupTotals.SumKons,
        CreditPayout: groupTotals.KonsCred
      });
    }

    const personTotals = konsumTotals(girl.rows);
    exportRows.push({
      Person: girl.name,
      Group: "",
      Dish: t("Konsum.PersonTotal", "Итого"),
      Quantity: personTotals.Kolvo,
      Percent: "",
      CashAmount: personTotals.Summ,
      CreditAmount: personTotals.SummCred,
      Payout: personTotals.SumKons,
      CreditPayout: personTotals.KonsCred
    });
  }

  const grandTotals = konsumTotals(rows);

  return {
    title: `${t(
      "Konsum.Title",
      "Отчет по консумации"
    )} ${formatReportDate(dateFrom)} — ${formatReportDate(dateTo)}`,
    fileName: `Konsum_${safeKonsumFilePart(
      dateFrom
    )}_${safeKonsumFilePart(dateTo)}`,
    orientation: "portrait",
    locale,
    columns: [
      {
        key: "Person",
        title: t("Konsum.Person", "Консумант"),
        type: "text",
        width: 18
      },
      {
        key: "Group",
        title: t("Konsum.Group", "Группа блюд"),
        type: "text",
        width: 18
      },
      {
        key: "Dish",
        title: t("Konsum.Dish", "Блюдо"),
        type: "text",
        width: 28
      },
      {
        key: "Quantity",
        title: t("Konsum.Quantity", "Количество"),
        type: "number",
        decimals: 2,
        width: 11
      },
      {
        key: "Percent",
        title: t("Konsum.Percent", "% консумации"),
        type: "number",
        decimals: 2,
        width: 11
      },
      {
        key: "CashAmount",
        title: t("Konsum.CashAmount", "Сумма нал"),
        type: "number",
        decimals: 2,
        width: 13
      },
      {
        key: "CreditAmount",
        title: t("Konsum.CreditAmount", "Сумма кред"),
        type: "number",
        decimals: 2,
        width: 13
      },
      {
        key: "Payout",
        title: t("Konsum.Payout", "К выплате"),
        type: "number",
        decimals: 2,
        width: 13
      },
      {
        key: "CreditPayout",
        title: t("Konsum.CreditPayout", "К выплате Кред"),
        type: "number",
        decimals: 2,
        width: 14
      }
    ],
    rows: exportRows,
    footerRows: [
      {
        label: t("Common.Total", "Итого"),
        values: {
          Quantity: grandTotals.Kolvo,
          CashAmount: grandTotals.Summ,
          CreditAmount: grandTotals.SummCred,
          Payout: grandTotals.SumKons,
          CreditPayout: grandTotals.KonsCred
        }
      }
    ]
  };
}

function KonsumReport({
  data,
  dateFrom,
  dateTo,
  locale,
  fetchWithAuth,
  t,
  onReload
}) {
  const rows = getKonsumRows(data);
  const formatter = createMoneyFormatter(locale);
  const commonOptions = {
    rows,
    dateFrom,
    dateTo,
    locale,
    t
  };

  async function handleExport(format) {
    try {
      await exportReportFile({
        fetchWithAuth,
        reportModel: buildKonsumExportModel(
          commonOptions
        ),
        format,
        errorMessage: t(
          "Report.ExportError",
          "Ошибка экспорта отчёта."
        )
      });
    } catch (error) {
      window.alert(
        error?.message ||
          t(
            "Report.ExportError",
            "Ошибка экспорта отчёта."
          )
      );
    }
  }

  return (
    <div className="reports-page konsum-report-page">
      <div className="report-toolbar">
        <button
          type="button"
          className="report-run-button"
          onClick={onReload}
        >
          {t("Common.Generate", "Сформировать")}
        </button>

        <button
          type="button"
          className="report-action-button report-print-button"
          onClick={() => printKonsumReport(commonOptions)}
        >
          {t("Common.Print", "Печать")}
        </button>

        <button
          type="button"
          className="report-action-button report-excel-button"
          onClick={() => handleExport("xlsx")}
        >
          {t("Common.Excel", "Excel")}
        </button>

        <button
          type="button"
          className="report-action-button report-word-button"
          onClick={() => handleExport("docx")}
        >
          {t("Common.Word", "Word")}
        </button>
      </div>

      <article className="revenue-report-sheet konsum-report-sheet">
        <header className="konsum-report-heading">
          <h3>
            {t("Konsum.Title", "Отчет по консумации")}{" "}
            {t("Common.From", "с")} {formatReportDate(dateFrom)}{" "}
            {t("Common.To", "по")} {formatReportDate(dateTo)}
          </h3>
        </header>

        {rows.length > 0 ? (
          <KonsumReportTable
            rows={rows}
            formatter={formatter}
            t={t}
          />
        ) : (
          <div className="report-empty">
            {t(
              "Reports.NoDataForPeriod",
              "За выбранный период данных нет."
            )}
          </div>
        )}
      </article>
    </div>
  );
}


function getPrihodPeriodRows(data) {
  const payload = data?.data ?? data?.Data ?? data;

  if (Array.isArray(payload)) {
    return payload;
  }

  return normalizeRows(
    payload?.Main ??
    payload?.main ??
    payload?.Rows ??
    payload?.rows ??
    payload?.PrihodPeriod ??
    payload?.prihodPeriod
  );
}

function groupPrihodPeriodRows(rows) {
  const groups = new Map();

  for (const row of rows) {
    const name =
      String(row?.NameZatr ?? "").trim() || "—";

    if (!groups.has(name)) {
      groups.set(name, []);
    }

    groups.get(name).push(row);
  }

  return [...groups.entries()]
    .map(([name, groupRows]) => ({
      name,
      rows: groupRows
    }))
    .sort((left, right) =>
      left.name.localeCompare(
        right.name,
        undefined,
        { sensitivity: "base" }
      )
    );
}

function prihodPeriodTotals(rows) {
  return {
    SumNal: sumField(rows, "SumNal"),
    SumKred: sumField(rows, "SumKred")
  };
}

function PrihodPeriodSubtotalRow({
  label,
  totals,
  formatter,
  className = ""
}) {
  return (
    <tr className={className}>
      <td
        colSpan="3"
        className="report-text report-total-label"
      >
        {label}
      </td>
      <td className="report-money">
        {formatter.format(totals.SumNal)}
      </td>
      <td className="report-money">
        {formatter.format(totals.SumKred)}
      </td>
    </tr>
  );
}

function PrihodPeriodReportTable({
  rows,
  formatter,
  t
}) {
  const groups = groupPrihodPeriodRows(rows);
  const grandTotals = prihodPeriodTotals(rows);

  return (
    <div className="money-prihod-period-groups">
      {groups.map((group) => {
        const groupTotals =
          prihodPeriodTotals(group.rows);

        return (
          <section
            className="money-prihod-period-group"
            key={group.name}
          >
            <div className="money-prihod-period-group-title">
              {group.name}
            </div>

            <div className="report-table-scroll">
              <table className="report-table money-prihod-period-table">
                <thead>
                  <tr>
                    <th className="report-text">
                      {t(
                        "Money.Note",
                        "Примечание"
                      )}
                    </th>
                    <th className="report-text">
                      {t(
                        "Money.ToWhom",
                        "Кому"
                      )}
                    </th>
                    <th className="report-text">
                      {t(
                        "Money.PaymentForm",
                        "Форма оплаты"
                      )}
                    </th>
                    <th className="report-money">
                      {t(
                        "Money.Cash",
                        "Наличные"
                      )}
                    </th>
                    <th className="report-money">
                      {t(
                        "Money.Cashless",
                        "Безналичные"
                      )}
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {group.rows.map((row, index) => (
                    <tr
                      key={`${group.name}-${index}-${row?.Rem ?? ""}`}
                    >
                      <td className="report-text">
                        {row?.Rem ?? ""}
                      </td>
                      <td className="report-text">
                        {row?.NameKomu ?? ""}
                      </td>
                      <td className="report-text">
                        {row?.FormaOpl ?? ""}
                      </td>
                      <td className="report-money">
                        {formatter.format(
                          numericValue(row?.SumNal)
                        )}
                      </td>
                      <td className="report-money">
                        {formatter.format(
                          numericValue(row?.SumKred)
                        )}
                      </td>
                    </tr>
                  ))}

                  <PrihodPeriodSubtotalRow
                    label={`${t(
                      "Money.GroupTotal",
                      "Итого по группе"
                    )}: ${group.name}`}
                    totals={groupTotals}
                    formatter={formatter}
                    className="money-prihod-period-group-total"
                  />
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {groups.length > 0 && (
        <table className="report-table money-prihod-period-grand-total">
          <tbody>
            <PrihodPeriodSubtotalRow
              label={t(
                "Common.Total",
                "Итого"
              )}
              totals={grandTotals}
              formatter={formatter}
              className="money-prihod-period-grand-total-row"
            />
          </tbody>
        </table>
      )}
    </div>
  );
}

function buildPrihodPeriodPrintHtml({
  rows,
  dateFrom,
  dateTo,
  locale,
  t
}) {
  const formatter =
    createMoneyFormatter(locale);
  const groups =
    groupPrihodPeriodRows(rows);
  const grandTotals =
    prihodPeriodTotals(rows);
  const title = `${t(
    "Money.PrihodPeriodTitle",
    "Приход за период"
  )} ${t(
    "Common.From",
    "с"
  )} ${formatReportDate(
    dateFrom
  )} ${t(
    "Common.To",
    "по"
  )} ${formatReportDate(dateTo)}`;

  const groupsHtml = groups
    .map((group) => {
      const totals =
        prihodPeriodTotals(group.rows);

      const body = group.rows
        .map(
          (row) => `<tr>
<td class="text">${escapeHtml(row?.Rem ?? "")}</td>
<td class="text">${escapeHtml(row?.NameKomu ?? "")}</td>
<td class="text">${escapeHtml(row?.FormaOpl ?? "")}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.SumNal)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.SumKred)))}</td>
</tr>`
        )
        .join("");

      return `<section class="group">
<h2>${escapeHtml(group.name)}</h2>
<table>
<thead>
<tr>
<th class="text note">${escapeHtml(t("Money.Note", "Примечание"))}</th>
<th class="text">${escapeHtml(t("Money.ToWhom", "Кому"))}</th>
<th class="text">${escapeHtml(t("Money.PaymentForm", "Форма оплаты"))}</th>
<th class="number">${escapeHtml(t("Money.Cash", "Наличные"))}</th>
<th class="number">${escapeHtml(t("Money.Cashless", "Безналичные"))}</th>
</tr>
</thead>
<tbody>
${body}
<tr class="subtotal">
<td colspan="3" class="text">${escapeHtml(
        `${t("Money.GroupTotal", "Итого по группе")}: ${group.name}`
      )}</td>
<td class="number">${escapeHtml(formatter.format(totals.SumNal))}</td>
<td class="number">${escapeHtml(formatter.format(totals.SumKred))}</td>
</tr>
</tbody>
</table>
</section>`;
    })
    .join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
@page { size: A4 portrait; margin: 9mm 8mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; color: #111; font-size: 8pt; }
h1 { margin: 0 0 4mm; font-size: 13pt; font-style: italic; }
h2 { margin: 3.5mm 0 1mm; padding: 1.2mm 1.5mm; background: #e8efe7; font-size: 9pt; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
thead { display: table-header-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
th, td { padding: 0.9mm 1mm; border-bottom: 0.1mm solid #cbd1cc; vertical-align: top; }
th { background: #f0f3ef; font-size: 7.1pt; }
th.note { width: 34%; }
.text { text-align: left; overflow-wrap: anywhere; }
.number { text-align: right; white-space: nowrap; }
.subtotal td { border-top: 0.2mm solid #a2aca4; background: #f5f8f4; font-weight: 700; }
.grand { margin-top: 4mm; }
.grand td { border-top: 0.35mm solid #78857a; background: #e8efe7; font-weight: 700; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
${groupsHtml}
<table class="grand">
<tbody>
<tr>
<td colspan="3" class="text">${escapeHtml(t("Common.Total", "Итого"))}</td>
<td class="number">${escapeHtml(formatter.format(grandTotals.SumNal))}</td>
<td class="number">${escapeHtml(formatter.format(grandTotals.SumKred))}</td>
</tr>
</tbody>
</table>
</body>
</html>`;
}

function printPrihodPeriodReport(options) {
  const printWindow = window.open(
    "",
    "_blank",
    "width=900,height=900"
  );

  if (!printWindow) {
    window.alert(
      options.t(
        "Reports.PrintPopupBlocked",
        "Браузер заблокировал окно печати. Разрешите всплывающие окна для Web Office."
      )
    );
    return;
  }

  printWindow.document.open();
  printWindow.document.write(
    buildPrihodPeriodPrintHtml(options)
  );
  printWindow.document.close();
  printWindow.focus();
  closePrintWindowAfterPrint(printWindow);

  window.setTimeout(() => {
    printWindow.print();
  }, 150);
}

function safePrihodPeriodFilePart(value) {
  return String(value ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

function buildPrihodPeriodExportModel({
  rows,
  dateFrom,
  dateTo,
  locale,
  t
}) {
  const exportRows = [];

  for (
    const group of groupPrihodPeriodRows(rows)
  ) {
    for (const row of group.rows) {
      exportRows.push({
        Group: group.name,
        Note: row?.Rem ?? "",
        ToWhom: row?.NameKomu ?? "",
        PaymentForm: row?.FormaOpl ?? "",
        Cash: numericValue(row?.SumNal),
        Cashless: numericValue(row?.SumKred)
      });
    }

    const totals =
      prihodPeriodTotals(group.rows);

    exportRows.push({
      Group: group.name,
      Note: t(
        "Money.GroupTotal",
        "Итого по группе"
      ),
      ToWhom: "",
      PaymentForm: "",
      Cash: totals.SumNal,
      Cashless: totals.SumKred
    });
  }

  const grandTotals =
    prihodPeriodTotals(rows);

  return {
    title: `${t(
      "Money.PrihodPeriodTitle",
      "Приход за период"
    )} ${formatReportDate(
      dateFrom
    )} — ${formatReportDate(dateTo)}`,
    fileName: `PrihodPeriod_${safePrihodPeriodFilePart(
      dateFrom
    )}_${safePrihodPeriodFilePart(dateTo)}`,
    orientation: "portrait",
    locale,
    columns: [
      {
        key: "Group",
        title: t(
          "Money.ExpenseItem",
          "Статья"
        ),
        type: "text",
        width: 22
      },
      {
        key: "Note",
        title: t(
          "Money.Note",
          "Примечание"
        ),
        type: "text",
        width: 30
      },
      {
        key: "ToWhom",
        title: t(
          "Money.ToWhom",
          "Кому"
        ),
        type: "text",
        width: 20
      },
      {
        key: "PaymentForm",
        title: t(
          "Money.PaymentForm",
          "Форма оплаты"
        ),
        type: "text",
        width: 16
      },
      {
        key: "Cash",
        title: t(
          "Money.Cash",
          "Наличные"
        ),
        type: "number",
        decimals: 2,
        width: 13
      },
      {
        key: "Cashless",
        title: t(
          "Money.Cashless",
          "Безналичные"
        ),
        type: "number",
        decimals: 2,
        width: 13
      }
    ],
    rows: exportRows,
    footerRows: [
      {
        label: t(
          "Common.Total",
          "Итого"
        ),
        values: {
          Cash: grandTotals.SumNal,
          Cashless: grandTotals.SumKred
        }
      }
    ]
  };
}

function PrihodPeriodReport({
  data,
  dateFrom,
  dateTo,
  locale,
  fetchWithAuth,
  t,
  onReload
}) {
  const rows =
    getPrihodPeriodRows(data);
  const formatter =
    createMoneyFormatter(locale);

  const commonOptions = {
    rows,
    dateFrom,
    dateTo,
    locale,
    t
  };

  async function handleExport(format) {
    try {
      await exportReportFile({
        fetchWithAuth,
        reportModel:
          buildPrihodPeriodExportModel(
            commonOptions
          ),
        format,
        errorMessage: t(
          "Report.ExportError",
          "Ошибка экспорта отчёта."
        )
      });
    } catch (error) {
      window.alert(
        error?.message ||
          t(
            "Report.ExportError",
            "Ошибка экспорта отчёта."
          )
      );
    }
  }

  return (
    <div className="reports-page money-prihod-period-page">
      <div className="report-toolbar">
        <button
          type="button"
          className="report-run-button"
          onClick={onReload}
        >
          {t(
            "Common.Generate",
            "Сформировать"
          )}
        </button>

        <button
          type="button"
          className="report-action-button report-print-button"
          onClick={() =>
            printPrihodPeriodReport(
              commonOptions
            )
          }
        >
          {t("Common.Print", "Печать")}
        </button>

        <button
          type="button"
          className="report-action-button report-excel-button"
          onClick={() =>
            handleExport("xlsx")
          }
        >
          {t("Common.Excel", "Excel")}
        </button>

        <button
          type="button"
          className="report-action-button report-word-button"
          onClick={() =>
            handleExport("docx")
          }
        >
          {t("Common.Word", "Word")}
        </button>
      </div>

      <article className="revenue-report-sheet money-prihod-period-sheet">
        <h3 className="money-prihod-period-title">
          {t(
            "Money.PrihodPeriodTitle",
            "Приход за период"
          )}{" "}
          {t("Common.From", "с")}{" "}
          {formatReportDate(dateFrom)}{" "}
          {t("Common.To", "по")}{" "}
          {formatReportDate(dateTo)}
        </h3>

        {rows.length > 0 ? (
          <PrihodPeriodReportTable
            rows={rows}
            formatter={formatter}
            t={t}
          />
        ) : (
          <div className="report-empty">
            {t(
              "Reports.NoDataForPeriod",
              "За выбранный период данных нет."
            )}
          </div>
        )}
      </article>
    </div>
  );
}


function getRashodPeriodRows(data) {
  const payload = data?.data ?? data?.Data ?? data;

  if (Array.isArray(payload)) {
    return payload;
  }

  return normalizeRows(
    payload?.Main ??
    payload?.main ??
    payload?.Rows ??
    payload?.rows ??
    payload?.RashodPeriod ??
    payload?.rashodPeriod
  );
}

function groupRashodPeriodRows(rows) {
  const groups = new Map();

  for (const row of rows) {
    const name =
      String(row?.NameZatr ?? "").trim() || "—";

    if (!groups.has(name)) {
      groups.set(name, []);
    }

    groups.get(name).push(row);
  }

  return [...groups.entries()]
    .map(([name, groupRows]) => ({
      name,
      rows: groupRows
    }))
    .sort((left, right) =>
      left.name.localeCompare(
        right.name,
        undefined,
        { sensitivity: "base" }
      )
    );
}

function rashodPeriodTotals(rows) {
  return {
    SumNal: sumField(rows, "SumNal"),
    SumKred: sumField(rows, "SumKred")
  };
}

function RashodPeriodSubtotalRow({
  label,
  totals,
  formatter,
  className = ""
}) {
  return (
    <tr className={className}>
      <td
        colSpan="2"
        className="report-text report-total-label"
      >
        {label}
      </td>
      <td className="report-money">
        {formatter.format(totals.SumNal)}
      </td>
      <td className="report-money">
        {formatter.format(totals.SumKred)}
      </td>
    </tr>
  );
}

function RashodPeriodReportTable({
  rows,
  formatter,
  t
}) {
  const groups =
    groupRashodPeriodRows(rows);
  const grandTotals =
    rashodPeriodTotals(rows);

  return (
    <div className="money-rashod-period-groups">
      {groups.map((group) => {
        const groupTotals =
          rashodPeriodTotals(group.rows);

        return (
          <section
            className="money-rashod-period-group"
            key={group.name}
          >
            <div className="money-rashod-period-group-title">
              {group.name}
            </div>

            <div className="report-table-scroll">
              <table className="report-table money-rashod-period-table">
                <thead>
                  <tr>
                    <th className="report-text">
                      {t(
                        "Money.Note",
                        "Примечание"
                      )}
                    </th>
                    <th className="report-text">
                      {t(
                        "Money.ToWhom",
                        "Кому"
                      )}
                    </th>
                    <th className="report-money">
                      {t(
                        "Money.Cash",
                        "Наличные"
                      )}
                    </th>
                    <th className="report-money">
                      {t(
                        "Money.Cashless",
                        "Безналичные"
                      )}
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {group.rows.map((row, index) => (
                    <tr
                      key={`${group.name}-${index}-${row?.Rem ?? ""}`}
                    >
                      <td className="report-text">
                        {row?.Rem ?? ""}
                      </td>
                      <td className="report-text">
                        {row?.NameKomu ?? ""}
                      </td>
                      <td className="report-money">
                        {formatter.format(
                          numericValue(row?.SumNal)
                        )}
                      </td>
                      <td className="report-money">
                        {formatter.format(
                          numericValue(row?.SumKred)
                        )}
                      </td>
                    </tr>
                  ))}

                  <RashodPeriodSubtotalRow
                    label={`${t(
                      "Money.GroupTotal",
                      "Итого по группе"
                    )}: ${group.name}`}
                    totals={groupTotals}
                    formatter={formatter}
                    className="money-rashod-period-group-total"
                  />
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {groups.length > 0 && (
        <table className="report-table money-rashod-period-grand-total">
          <tbody>
            <RashodPeriodSubtotalRow
              label={t(
                "Common.Total",
                "Итого"
              )}
              totals={grandTotals}
              formatter={formatter}
              className="money-rashod-period-grand-total-row"
            />
          </tbody>
        </table>
      )}
    </div>
  );
}

function buildRashodPeriodPrintHtml({
  rows,
  dateFrom,
  dateTo,
  locale,
  t
}) {
  const formatter =
    createMoneyFormatter(locale);
  const groups =
    groupRashodPeriodRows(rows);
  const grandTotals =
    rashodPeriodTotals(rows);
  const title = `${t(
    "Money.RashodPeriodTitle",
    "Расходы за период"
  )} ${t(
    "Common.From",
    "с"
  )} ${formatReportDate(
    dateFrom
  )} ${t(
    "Common.To",
    "по"
  )} ${formatReportDate(dateTo)}`;

  const groupsHtml = groups
    .map((group) => {
      const totals =
        rashodPeriodTotals(group.rows);

      const body = group.rows
        .map(
          (row) => `<tr>
<td class="text">${escapeHtml(row?.Rem ?? "")}</td>
<td class="text">${escapeHtml(row?.NameKomu ?? "")}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.SumNal)))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.SumKred)))}</td>
</tr>`
        )
        .join("");

      return `<section class="group">
<h2>${escapeHtml(group.name)}</h2>
<table>
<thead>
<tr>
<th class="text note">${escapeHtml(t("Money.Note", "Примечание"))}</th>
<th class="text">${escapeHtml(t("Money.ToWhom", "Кому"))}</th>
<th class="number">${escapeHtml(t("Money.Cash", "Наличные"))}</th>
<th class="number">${escapeHtml(t("Money.Cashless", "Безналичные"))}</th>
</tr>
</thead>
<tbody>
${body}
<tr class="subtotal">
<td colspan="2" class="text">${escapeHtml(
        `${t("Money.GroupTotal", "Итого по группе")}: ${group.name}`
      )}</td>
<td class="number">${escapeHtml(formatter.format(totals.SumNal))}</td>
<td class="number">${escapeHtml(formatter.format(totals.SumKred))}</td>
</tr>
</tbody>
</table>
</section>`;
    })
    .join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
@page { size: A4 portrait; margin: 9mm 8mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; color: #111; font-size: 8pt; }
h1 { margin: 0 0 4mm; font-size: 13pt; font-style: italic; }
h2 { margin: 3.5mm 0 1mm; padding: 1.2mm 1.5mm; background: #e8efe7; font-size: 9pt; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
thead { display: table-header-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
th, td { padding: 0.9mm 1mm; border-bottom: 0.1mm solid #cbd1cc; vertical-align: top; }
th { background: #f0f3ef; font-size: 7.1pt; }
th.note { width: 42%; }
.text { text-align: left; overflow-wrap: anywhere; }
.number { text-align: right; white-space: nowrap; }
.subtotal td { border-top: 0.2mm solid #a2aca4; background: #f5f8f4; font-weight: 700; }
.grand { margin-top: 4mm; }
.grand td { border-top: 0.35mm solid #78857a; background: #e8efe7; font-weight: 700; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
${groupsHtml}
<table class="grand">
<tbody>
<tr>
<td colspan="2" class="text">${escapeHtml(t("Common.Total", "Итого"))}</td>
<td class="number">${escapeHtml(formatter.format(grandTotals.SumNal))}</td>
<td class="number">${escapeHtml(formatter.format(grandTotals.SumKred))}</td>
</tr>
</tbody>
</table>
</body>
</html>`;
}

function printRashodPeriodReport(options) {
  const printWindow = window.open(
    "",
    "_blank",
    "width=900,height=900"
  );

  if (!printWindow) {
    window.alert(
      options.t(
        "Reports.PrintPopupBlocked",
        "Браузер заблокировал окно печати. Разрешите всплывающие окна для Web Office."
      )
    );
    return;
  }

  printWindow.document.open();
  printWindow.document.write(
    buildRashodPeriodPrintHtml(options)
  );
  printWindow.document.close();
  printWindow.focus();
  closePrintWindowAfterPrint(printWindow);

  window.setTimeout(() => {
    printWindow.print();
  }, 150);
}

function buildRashodPeriodExportModel({
  rows,
  dateFrom,
  dateTo,
  locale,
  t
}) {
  const exportRows = [];

  for (
    const group of groupRashodPeriodRows(rows)
  ) {
    for (const row of group.rows) {
      exportRows.push({
        Group: group.name,
        Note: row?.Rem ?? "",
        ToWhom: row?.NameKomu ?? "",
        Cash: numericValue(row?.SumNal),
        Cashless: numericValue(row?.SumKred)
      });
    }

    const totals =
      rashodPeriodTotals(group.rows);

    exportRows.push({
      Group: group.name,
      Note: t(
        "Money.GroupTotal",
        "Итого по группе"
      ),
      ToWhom: "",
      Cash: totals.SumNal,
      Cashless: totals.SumKred
    });
  }

  const grandTotals =
    rashodPeriodTotals(rows);

  return {
    title: `${t(
      "Money.RashodPeriodTitle",
      "Расходы за период"
    )} ${formatReportDate(
      dateFrom
    )} — ${formatReportDate(dateTo)}`,
    fileName: `RashodPeriod_${safePrihodPeriodFilePart(
      dateFrom
    )}_${safePrihodPeriodFilePart(dateTo)}`,
    orientation: "portrait",
    locale,
    columns: [
      {
        key: "Group",
        title: t(
          "Money.ExpenseItem",
          "Статья"
        ),
        type: "text",
        width: 24
      },
      {
        key: "Note",
        title: t(
          "Money.Note",
          "Примечание"
        ),
        type: "text",
        width: 34
      },
      {
        key: "ToWhom",
        title: t(
          "Money.ToWhom",
          "Кому"
        ),
        type: "text",
        width: 22
      },
      {
        key: "Cash",
        title: t(
          "Money.Cash",
          "Наличные"
        ),
        type: "number",
        decimals: 2,
        width: 14
      },
      {
        key: "Cashless",
        title: t(
          "Money.Cashless",
          "Безналичные"
        ),
        type: "number",
        decimals: 2,
        width: 14
      }
    ],
    rows: exportRows,
    footerRows: [
      {
        label: t(
          "Common.Total",
          "Итого"
        ),
        values: {
          Cash: grandTotals.SumNal,
          Cashless: grandTotals.SumKred
        }
      }
    ]
  };
}

function RashodPeriodReport({
  data,
  dateFrom,
  dateTo,
  locale,
  fetchWithAuth,
  t,
  onReload
}) {
  const rows =
    getRashodPeriodRows(data);
  const formatter =
    createMoneyFormatter(locale);

  const commonOptions = {
    rows,
    dateFrom,
    dateTo,
    locale,
    t
  };

  async function handleExport(format) {
    try {
      await exportReportFile({
        fetchWithAuth,
        reportModel:
          buildRashodPeriodExportModel(
            commonOptions
          ),
        format,
        errorMessage: t(
          "Report.ExportError",
          "Ошибка экспорта отчёта."
        )
      });
    } catch (error) {
      window.alert(
        error?.message ||
          t(
            "Report.ExportError",
            "Ошибка экспорта отчёта."
          )
      );
    }
  }

  return (
    <div className="reports-page money-rashod-period-page">
      <div className="report-toolbar">
        <button
          type="button"
          className="report-run-button"
          onClick={onReload}
        >
          {t(
            "Common.Generate",
            "Сформировать"
          )}
        </button>

        <button
          type="button"
          className="report-action-button report-print-button"
          onClick={() =>
            printRashodPeriodReport(
              commonOptions
            )
          }
        >
          {t("Common.Print", "Печать")}
        </button>

        <button
          type="button"
          className="report-action-button report-excel-button"
          onClick={() =>
            handleExport("xlsx")
          }
        >
          {t("Common.Excel", "Excel")}
        </button>

        <button
          type="button"
          className="report-action-button report-word-button"
          onClick={() =>
            handleExport("docx")
          }
        >
          {t("Common.Word", "Word")}
        </button>
      </div>

      <article className="revenue-report-sheet money-rashod-period-sheet">
        <h3 className="money-rashod-period-title">
          {t(
            "Money.RashodPeriodTitle",
            "Расходы за период"
          )}{" "}
          {t("Common.From", "с")}{" "}
          {formatReportDate(dateFrom)}{" "}
          {t("Common.To", "по")}{" "}
          {formatReportDate(dateTo)}
        </h3>

        {rows.length > 0 ? (
          <RashodPeriodReportTable
            rows={rows}
            formatter={formatter}
            t={t}
          />
        ) : (
          <div className="report-empty">
            {t(
              "Reports.NoDataForPeriod",
              "За выбранный период данных нет."
            )}
          </div>
        )}
      </article>
    </div>
  );
}

function normalizeDdsPayload(data) {
  const payload =
    data?.data ??
    data?.Data ??
    data ??
    {};

  return {
    saldo: normalizeRows(
      payload?.Saldo ??
      payload?.saldo
    ),
    postuplenie: normalizeRows(
      payload?.Postuplenie ??
      payload?.postuplenie
    ),
    rashod: normalizeRows(
      payload?.Rashod ??
      payload?.rashod
    )
  };
}

function ddsOptionalNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue)
    ? numberValue
    : null;
}

function ddsRowAmounts(row) {
  const cash =
    numericValue(row?.SummNal);
  const cashless =
    numericValue(row?.SummKred);
  const explicitTotal =
    ddsOptionalNumber(row?.Summ);

  return {
    total:
      explicitTotal === null
        ? cash + cashless
        : explicitTotal,
    cash,
    cashless
  };
}

function ddsSaldoAmounts(rows) {
  let cash = 0;
  let cashless = 0;

  for (const row of rows) {
    const valuts =
      Number(row?.Valuts || 0);
    const saldo =
      numericValue(row?.Sald0);

    if (valuts === 1) {
      cash += saldo;
    } else if (valuts === 2) {
      cashless += saldo;
    }
  }

  return {
    total: cash + cashless,
    cash,
    cashless
  };
}

function ddsHasMeaningfulDetail(row) {
  const name =
    String(row?.NameOsn ?? "").trim();

  if (name) {
    return true;
  }

  return [
    row?.Summ,
    row?.SummNal,
    row?.SummKred
  ].some(
    (value) =>
      value !== null &&
      value !== undefined &&
      value !== ""
  );
}

function ddsSectionName(row, t) {
  return (
    String(row?.Razdel ?? "").trim() ||
    t(
      "Money.DdsWithoutSection",
      "Без раздела"
    )
  );
}

function groupDdsRows(
  rows,
  {
    sortByIndex = false,
    t
  }
) {
  const prepared = rows.map(
    (row, sourceIndex) => ({
      row,
      sourceIndex,
      indexSort:
        ddsOptionalNumber(
          row?.IndexSort
        )
    })
  );

  if (sortByIndex) {
    prepared.sort((left, right) => {
      const leftIndex =
        left.indexSort === null
          ? Number.MAX_SAFE_INTEGER
          : left.indexSort;
      const rightIndex =
        right.indexSort === null
          ? Number.MAX_SAFE_INTEGER
          : right.indexSort;

      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }

      return (
        left.sourceIndex -
        right.sourceIndex
      );
    });
  }

  const groups = new Map();

  for (const item of prepared) {
    const name =
      ddsSectionName(item.row, t);

    if (!groups.has(name)) {
      groups.set(name, []);
    }

    groups.get(name).push(item.row);
  }

  return [...groups.entries()].map(
    ([name, groupRows]) => ({
      name,
      rows: groupRows
    })
  );
}

function ddsTotals(rows) {
  return rows.reduce(
    (totals, row) => {
      const values =
        ddsRowAmounts(row);

      totals.total += values.total;
      totals.cash += values.cash;
      totals.cashless +=
        values.cashless;

      return totals;
    },
    {
      total: 0,
      cash: 0,
      cashless: 0
    }
  );
}

function DdsAmountCells({
  values,
  formatter
}) {
  return (
    <>
      <td className="report-money">
        {formatter.format(values.total)}
      </td>
      <td className="report-money">
        {formatter.format(values.cash)}
      </td>
      <td className="report-money">
        {formatter.format(values.cashless)}
      </td>
    </>
  );
}

function DdsSectionRows({
  title,
  groups,
  formatter,
  t
}) {
  return (
    <>
      <tr className="money-dds-section-row">
        <td colSpan="4">
          {title}
        </td>
      </tr>

      {groups.map((group) => {
        const detailRows =
          group.rows.filter(
            ddsHasMeaningfulDetail
          );
        const groupTotals =
          ddsTotals(group.rows);

        return (
          <Fragment key={group.name}>
            <tr className="money-dds-group-row">
              <td colSpan="4">
                {group.name}
              </td>
            </tr>

            {detailRows.map(
              (row, index) => (
                <tr
                  key={`${group.name}-${index}-${row?.NameOsn ?? ""}`}
                >
                  <td className="report-text">
                    {String(
                      row?.NameOsn ?? ""
                    ).trim() || "—"}
                  </td>

                  <DdsAmountCells
                    values={ddsRowAmounts(
                      row
                    )}
                    formatter={formatter}
                  />
                </tr>
              )
            )}

            <tr className="money-dds-group-total-row">
              <td className="report-text">
                {t(
                  "Money.DdsSectionTotal",
                  "Итого по разделу"
                )}
                : {group.name}
              </td>

              <DdsAmountCells
                values={groupTotals}
                formatter={formatter}
              />
            </tr>
          </Fragment>
        );
      })}
    </>
  );
}

function DdsReportTable({
  ddsData,
  formatter,
  t
}) {
  const saldo =
    ddsSaldoAmounts(ddsData.saldo);
  const incomeGroups =
    groupDdsRows(
      ddsData.postuplenie,
      {
        sortByIndex: false,
        t
      }
    );
  const expenseGroups =
    groupDdsRows(
      ddsData.rashod,
      {
        sortByIndex: true,
        t
      }
    );

  return (
    <div className="report-table-scroll">
      <table className="report-table money-dds-table">
        <thead>
          <tr>
            <th className="report-text">
              {t(
                "Money.DdsName",
                "Наименование"
              )}
            </th>
            <th className="report-money">
              {t(
                "Common.Total",
                "Итого"
              )}
            </th>
            <th className="report-money">
              {t(
                "Money.DdsCash",
                "Нал"
              )}
            </th>
            <th className="report-money">
              {t(
                "Money.DdsCashless",
                "Безнал"
              )}
            </th>
          </tr>
        </thead>

        <tbody>
          <tr className="money-dds-opening-row">
            <td className="report-text">
              {t(
                "Money.DdsOpeningBalance",
                "Сальдо на начало"
              )}
            </td>

            <DdsAmountCells
              values={saldo}
              formatter={formatter}
            />
          </tr>

          <DdsSectionRows
            title={t(
              "Money.DdsIncome",
              "Поступление ДС"
            )}
            groups={incomeGroups}
            formatter={formatter}
            t={t}
          />

          <DdsSectionRows
            title={t(
              "Money.DdsExpense",
              "Расходование ДС"
            )}
            groups={expenseGroups}
            formatter={formatter}
            t={t}
          />
        </tbody>
      </table>
    </div>
  );
}

function buildDdsPrintHtml({
  ddsData,
  dateFrom,
  dateTo,
  organizationName,
  locale,
  t
}) {
  const formatter =
    createMoneyFormatter(locale);
  const saldo =
    ddsSaldoAmounts(ddsData.saldo);
  const incomeGroups =
    groupDdsRows(
      ddsData.postuplenie,
      {
        sortByIndex: false,
        t
      }
    );
  const expenseGroups =
    groupDdsRows(
      ddsData.rashod,
      {
        sortByIndex: true,
        t
      }
    );

  const title = `${t(
    "Money.DdsTitle",
    "Отчет по движению ДС за период"
  )} ${t(
    "Common.From",
    "с"
  )} ${formatReportDate(
    dateFrom
  )} ${t(
    "Common.To",
    "по"
  )} ${formatReportDate(dateTo)}`;

  const amountCells = (values) =>
    `<td class="number">${escapeHtml(
      formatter.format(values.total)
    )}</td><td class="number">${escapeHtml(
      formatter.format(values.cash)
    )}</td><td class="number">${escapeHtml(
      formatter.format(values.cashless)
    )}</td>`;

  const sectionHtml = (
    sectionTitle,
    groups
  ) => {
    const groupHtml = groups
      .map((group) => {
        const detailRows =
          group.rows.filter(
            ddsHasMeaningfulDetail
          );
        const totals =
          ddsTotals(group.rows);

        const details = detailRows
          .map(
            (row) => `<tr>
<td class="text">${escapeHtml(
              String(
                row?.NameOsn ?? ""
              ).trim() || "—"
            )}</td>
${amountCells(
  ddsRowAmounts(row)
)}
</tr>`
          )
          .join("");

        return `<tr class="group">
<td colspan="4">${escapeHtml(group.name)}</td>
</tr>
${details}
<tr class="subtotal">
<td class="text">${escapeHtml(
          `${t(
            "Money.DdsSectionTotal",
            "Итого по разделу"
          )}: ${group.name}`
        )}</td>
${amountCells(totals)}
</tr>`;
      })
      .join("");

    return `<tr class="section">
<td colspan="4">${escapeHtml(sectionTitle)}</td>
</tr>
${groupHtml}`;
  };

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
@page { size: A4 portrait; margin: 9mm 8mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; color: #111; font-size: 8pt; }
.header { display: flex; justify-content: space-between; align-items: flex-start; gap: 8mm; margin-bottom: 4mm; }
h1 { margin: 0; font-size: 12pt; font-style: italic; }
.org { max-width: 42%; text-align: right; font-size: 9pt; font-weight: 700; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
thead { display: table-header-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
th, td { padding: 1mm 1.2mm; border-bottom: 0.1mm solid #cbd1cc; vertical-align: top; }
th { background: #f0f3ef; font-size: 7.4pt; }
th:first-child { width: 55%; }
.text { text-align: left; overflow-wrap: anywhere; }
.number { width: 15%; text-align: right; white-space: nowrap; }
.opening td { background: #f5f8f4; font-weight: 700; }
.section td { padding-top: 2.4mm; border-bottom: 0.25mm solid #4d5950; font-size: 8.5pt; font-weight: 700; text-decoration: underline; }
.group td { background: #edf3eb; font-weight: 700; }
.subtotal td { border-top: 0.2mm solid #a2aca4; background: #f7f9f6; font-weight: 700; }
</style>
</head>
<body>
<div class="header">
<h1>${escapeHtml(title)}</h1>
<div class="org">${escapeHtml(organizationName || "")}</div>
</div>
<table>
<thead>
<tr>
<th class="text">${escapeHtml(t("Money.DdsName", "Наименование"))}</th>
<th class="number">${escapeHtml(t("Common.Total", "Итого"))}</th>
<th class="number">${escapeHtml(t("Money.DdsCash", "Нал"))}</th>
<th class="number">${escapeHtml(t("Money.DdsCashless", "Безнал"))}</th>
</tr>
</thead>
<tbody>
<tr class="opening">
<td class="text">${escapeHtml(t("Money.DdsOpeningBalance", "Сальдо на начало"))}</td>
${amountCells(saldo)}
</tr>
${sectionHtml(
  t("Money.DdsIncome", "Поступление ДС"),
  incomeGroups
)}
${sectionHtml(
  t("Money.DdsExpense", "Расходование ДС"),
  expenseGroups
)}
</tbody>
</table>
</body>
</html>`;
}

function printDdsReport(options) {
  const printWindow = window.open(
    "",
    "_blank",
    "width=900,height=900"
  );

  if (!printWindow) {
    window.alert(
      options.t(
        "Reports.PrintPopupBlocked",
        "Браузер заблокировал окно печати. Разрешите всплывающие окна для Web Office."
      )
    );
    return;
  }

  printWindow.document.open();
  printWindow.document.write(
    buildDdsPrintHtml(options)
  );
  printWindow.document.close();
  printWindow.focus();
  closePrintWindowAfterPrint(printWindow);

  window.setTimeout(() => {
    printWindow.print();
  }, 150);
}

function buildDdsExportModel({
  ddsData,
  dateFrom,
  dateTo,
  organizationName,
  locale,
  t
}) {
  const rows = [];
  const saldo =
    ddsSaldoAmounts(ddsData.saldo);
  const incomeGroups =
    groupDdsRows(
      ddsData.postuplenie,
      {
        sortByIndex: false,
        t
      }
    );
  const expenseGroups =
    groupDdsRows(
      ddsData.rashod,
      {
        sortByIndex: true,
        t
      }
    );

  const pushAmounts = (
    name,
    values
  ) => {
    rows.push({
      Name: name,
      Total: values.total,
      Cash: values.cash,
      Cashless: values.cashless
    });
  };

  pushAmounts(
    t(
      "Money.DdsOpeningBalance",
      "Сальдо на начало"
    ),
    saldo
  );

  const pushSection = (
    sectionTitle,
    groups
  ) => {
    rows.push({
      Name: sectionTitle,
      Total: null,
      Cash: null,
      Cashless: null
    });

    for (const group of groups) {
      rows.push({
        Name: group.name,
        Total: null,
        Cash: null,
        Cashless: null
      });

      for (
        const row of group.rows.filter(
          ddsHasMeaningfulDetail
        )
      ) {
        pushAmounts(
          String(
            row?.NameOsn ?? ""
          ).trim() || "—",
          ddsRowAmounts(row)
        );
      }

      pushAmounts(
        `${t(
          "Money.DdsSectionTotal",
          "Итого по разделу"
        )}: ${group.name}`,
        ddsTotals(group.rows)
      );
    }
  };

  pushSection(
    t(
      "Money.DdsIncome",
      "Поступление ДС"
    ),
    incomeGroups
  );

  pushSection(
    t(
      "Money.DdsExpense",
      "Расходование ДС"
    ),
    expenseGroups
  );

  const title = `${t(
    "Money.DdsTitle",
    "Отчет по движению ДС за период"
  )} ${formatReportDate(
    dateFrom
  )} — ${formatReportDate(dateTo)}`;

  return {
    title:
      organizationName
        ? `${title} — ${organizationName}`
        : title,
    fileName: `DDS_${safePrihodPeriodFilePart(
      dateFrom
    )}_${safePrihodPeriodFilePart(dateTo)}`,
    orientation: "portrait",
    locale,
    columns: [
      {
        key: "Name",
        title: t(
          "Money.DdsName",
          "Наименование"
        ),
        type: "text",
        width: 44
      },
      {
        key: "Total",
        title: t(
          "Common.Total",
          "Итого"
        ),
        type: "number",
        decimals: 2,
        width: 16
      },
      {
        key: "Cash",
        title: t(
          "Money.DdsCash",
          "Нал"
        ),
        type: "number",
        decimals: 2,
        width: 16
      },
      {
        key: "Cashless",
        title: t(
          "Money.DdsCashless",
          "Безнал"
        ),
        type: "number",
        decimals: 2,
        width: 16
      }
    ],
    rows,
    footerRows: []
  };
}

function DdsReport({
  data,
  dateFrom,
  dateTo,
  organizationName,
  locale,
  fetchWithAuth,
  t,
  onReload
}) {
  const ddsData =
    normalizeDdsPayload(data);
  const formatter =
    createMoneyFormatter(locale);

  const hasData =
    ddsData.saldo.length > 0 ||
    ddsData.postuplenie.length > 0 ||
    ddsData.rashod.length > 0;

  const commonOptions = {
    ddsData,
    dateFrom,
    dateTo,
    organizationName,
    locale,
    t
  };

  async function handleExport(format) {
    try {
      await exportReportFile({
        fetchWithAuth,
        reportModel:
          buildDdsExportModel(
            commonOptions
          ),
        format,
        errorMessage: t(
          "Report.ExportError",
          "Ошибка экспорта отчёта."
        )
      });
    } catch (error) {
      window.alert(
        error?.message ||
          t(
            "Report.ExportError",
            "Ошибка экспорта отчёта."
          )
      );
    }
  }

  return (
    <div className="reports-page money-dds-page">
      <div className="report-toolbar">
        <button
          type="button"
          className="report-run-button"
          onClick={onReload}
        >
          {t(
            "Common.Generate",
            "Сформировать"
          )}
        </button>

        <button
          type="button"
          className="report-action-button report-print-button"
          onClick={() =>
            printDdsReport(
              commonOptions
            )
          }
        >
          {t("Common.Print", "Печать")}
        </button>

        <button
          type="button"
          className="report-action-button report-excel-button"
          onClick={() =>
            handleExport("xlsx")
          }
        >
          {t("Common.Excel", "Excel")}
        </button>

        <button
          type="button"
          className="report-action-button report-word-button"
          onClick={() =>
            handleExport("docx")
          }
        >
          {t("Common.Word", "Word")}
        </button>
      </div>

      <article className="revenue-report-sheet money-dds-sheet">
        <div className="money-dds-heading">
          <h3 className="money-dds-title">
            {t(
              "Money.DdsTitle",
              "Отчет по движению ДС за период"
            )}{" "}
            {t("Common.From", "с")}{" "}
            {formatReportDate(dateFrom)}{" "}
            {t("Common.To", "по")}{" "}
            {formatReportDate(dateTo)}
          </h3>

          <div className="money-dds-org">
            {organizationName || ""}
          </div>
        </div>

        {hasData ? (
          <DdsReportTable
            ddsData={ddsData}
            formatter={formatter}
            t={t}
          />
        ) : (
          <div className="report-empty">
            {t(
              "Reports.NoDataForPeriod",
              "За выбранный период данных нет."
            )}
          </div>
        )}
      </article>
    </div>
  );
}


function getBtrRows(data) {
  const payload = data?.data ?? data?.Data ?? data;

  if (Array.isArray(payload)) {
    return payload;
  }

  return normalizeRows(
    payload?.Main ??
    payload?.main ??
    payload?.Rows ??
    payload?.rows ??
    payload?.BTR ??
    payload?.btr
  );
}

function btrRowAmounts(row) {
  const cash = numericValue(
    row?.["Сум1"] ??
    row?.Sum1 ??
    row?.SummNal
  );
  const cashless = numericValue(
    row?.["Сум2"] ??
    row?.Sum2 ??
    row?.SummKred
  );
  const explicitTotal =
    ddsOptionalNumber(
      row?.["Сумм"] ??
      row?.Summ
    );

  return {
    total:
      explicitTotal === null
        ? cash + cashless
        : explicitTotal,
    cash,
    cashless
  };
}

function btrSectionName(row, t) {
  return (
    String(row?.Razdel ?? "").trim() ||
    t(
      "Money.DdsWithoutSection",
      "Без раздела"
    )
  );
}

function groupBtrRows(rows, t) {
  const prepared = rows
    .map((row, sourceIndex) => ({
      row,
      sourceIndex,
      indexSort:
        ddsOptionalNumber(
          row?.IndexSort
        )
    }))
    .sort((left, right) => {
      const leftIndex =
        left.indexSort === null
          ? Number.MAX_SAFE_INTEGER
          : left.indexSort;
      const rightIndex =
        right.indexSort === null
          ? Number.MAX_SAFE_INTEGER
          : right.indexSort;

      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }

      return (
        left.sourceIndex -
        right.sourceIndex
      );
    });

  const groups = new Map();

  for (const item of prepared) {
    const name =
      btrSectionName(item.row, t);

    if (!groups.has(name)) {
      groups.set(name, []);
    }

    groups.get(name).push(item.row);
  }

  return [...groups.entries()].map(
    ([name, groupRows]) => ({
      name,
      rows: groupRows
    })
  );
}

function btrTotals(rows) {
  return rows.reduce(
    (totals, row) => {
      const values =
        btrRowAmounts(row);

      totals.total += values.total;
      totals.cash += values.cash;
      totals.cashless +=
        values.cashless;

      return totals;
    },
    {
      total: 0,
      cash: 0,
      cashless: 0
    }
  );
}

function BtrAmountCells({
  values,
  formatter
}) {
  return (
    <>
      <td className="report-money">
        {formatter.format(values.total)}
      </td>
      <td className="report-money">
        {formatter.format(values.cash)}
      </td>
      <td className="report-money">
        {formatter.format(values.cashless)}
      </td>
    </>
  );
}

function BtrReportTable({
  rows,
  formatter,
  t
}) {
  const groups =
    groupBtrRows(rows, t);
  const grandTotals =
    btrTotals(rows);

  return (
    <div className="report-table-scroll">
      <table className="report-table money-btr-table">
        <thead>
          <tr>
            <th className="report-text">
              {t(
                "Money.DdsName",
                "Наименование"
              )}
            </th>
            <th className="report-money">
              {t(
                "Common.Total",
                "Итого"
              )}
            </th>
            <th className="report-money">
              {t(
                "Money.DdsCash",
                "Нал"
              )}
            </th>
            <th className="report-money">
              {t(
                "Money.DdsCashless",
                "Безнал"
              )}
            </th>
          </tr>
        </thead>

        <tbody>
          {groups.map((group) => {
            const totals =
              btrTotals(group.rows);

            return (
              <Fragment key={group.name}>
                <tr className="money-btr-group-row">
                  <td colSpan="4">
                    {group.name}
                  </td>
                </tr>

                {group.rows.map(
                  (row, index) => (
                    <tr
                      key={`${group.name}-${index}-${row?.NameZatr ?? ""}`}
                    >
                      <td className="report-text">
                        {row?.NameZatr ?? ""}
                      </td>

                      <BtrAmountCells
                        values={btrRowAmounts(
                          row
                        )}
                        formatter={formatter}
                      />
                    </tr>
                  )
                )}

                <tr className="money-btr-group-total-row">
                  <td className="report-text">
                    {t(
                      "Money.DdsSectionTotal",
                      "Итого по разделу"
                    )}
                    : {group.name}
                  </td>

                  <BtrAmountCells
                    values={totals}
                    formatter={formatter}
                  />
                </tr>
              </Fragment>
            );
          })}

          {groups.length > 0 && (
            <tr className="money-btr-grand-total-row">
              <td className="report-text">
                {t(
                  "Common.Total",
                  "Итого"
                )}
              </td>

              <BtrAmountCells
                values={grandTotals}
                formatter={formatter}
              />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function buildBtrPrintHtml({
  rows,
  dateFrom,
  dateTo,
  locale,
  t
}) {
  const formatter =
    createMoneyFormatter(locale);
  const groups =
    groupBtrRows(rows, t);
  const grandTotals =
    btrTotals(rows);

  const title = `${t(
    "Money.BtrTitle",
    "Текущие расходы"
  )} ${t(
    "Common.From",
    "с"
  )} ${formatReportDate(
    dateFrom
  )} ${t(
    "Common.To",
    "по"
  )} ${formatReportDate(dateTo)}`;

  const amountCells = (values) =>
    `<td class="number">${escapeHtml(
      formatter.format(values.total)
    )}</td><td class="number">${escapeHtml(
      formatter.format(values.cash)
    )}</td><td class="number">${escapeHtml(
      formatter.format(values.cashless)
    )}</td>`;

  const groupsHtml = groups
    .map((group) => {
      const totals =
        btrTotals(group.rows);

      const detailRows = group.rows
        .map(
          (row) => `<tr>
<td class="text">${escapeHtml(row?.NameZatr ?? "")}</td>
${amountCells(
  btrRowAmounts(row)
)}
</tr>`
        )
        .join("");

      return `<tr class="group">
<td colspan="4">${escapeHtml(group.name)}</td>
</tr>
${detailRows}
<tr class="subtotal">
<td class="text">${escapeHtml(
        `${t(
          "Money.DdsSectionTotal",
          "Итого по разделу"
        )}: ${group.name}`
      )}</td>
${amountCells(totals)}
</tr>`;
    })
    .join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
@page { size: A4 portrait; margin: 9mm 8mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; color: #111; font-size: 8pt; }
h1 { margin: 0 0 4mm; font-size: 12pt; font-style: italic; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
thead { display: table-header-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
th, td { padding: 1mm 1.2mm; border-bottom: 0.1mm solid #cbd1cc; vertical-align: top; }
th { background: #f0f3ef; font-size: 7.4pt; }
th:first-child { width: 55%; }
.text { text-align: left; overflow-wrap: anywhere; }
.number { width: 15%; text-align: right; white-space: nowrap; }
.group td { padding-top: 2mm; background: #edf3eb; font-weight: 700; }
.subtotal td { border-top: 0.2mm solid #a2aca4; background: #f7f9f6; font-weight: 700; }
.grand td { border-top: 0.35mm solid #78857a; background: #e8efe7; font-weight: 700; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<table>
<thead>
<tr>
<th class="text">${escapeHtml(t("Money.DdsName", "Наименование"))}</th>
<th class="number">${escapeHtml(t("Common.Total", "Итого"))}</th>
<th class="number">${escapeHtml(t("Money.DdsCash", "Нал"))}</th>
<th class="number">${escapeHtml(t("Money.DdsCashless", "Безнал"))}</th>
</tr>
</thead>
<tbody>
${groupsHtml}
<tr class="grand">
<td class="text">${escapeHtml(t("Common.Total", "Итого"))}</td>
${amountCells(grandTotals)}
</tr>
</tbody>
</table>
</body>
</html>`;
}

function printBtrReport(options) {
  const printWindow = window.open(
    "",
    "_blank",
    "width=900,height=900"
  );

  if (!printWindow) {
    window.alert(
      options.t(
        "Reports.PrintPopupBlocked",
        "Браузер заблокировал окно печати. Разрешите всплывающие окна для Web Office."
      )
    );
    return;
  }

  printWindow.document.open();
  printWindow.document.write(
    buildBtrPrintHtml(options)
  );
  printWindow.document.close();
  printWindow.focus();
  closePrintWindowAfterPrint(printWindow);

  window.setTimeout(() => {
    printWindow.print();
  }, 150);
}

function buildBtrExportModel({
  rows,
  dateFrom,
  dateTo,
  locale,
  t
}) {
  const exportRows = [];

  for (
    const group of groupBtrRows(
      rows,
      t
    )
  ) {
    exportRows.push({
      Name: group.name,
      Total: null,
      Cash: null,
      Cashless: null
    });

    for (const row of group.rows) {
      const values =
        btrRowAmounts(row);

      exportRows.push({
        Name: row?.NameZatr ?? "",
        Total: values.total,
        Cash: values.cash,
        Cashless: values.cashless
      });
    }

    const totals =
      btrTotals(group.rows);

    exportRows.push({
      Name: `${t(
        "Money.DdsSectionTotal",
        "Итого по разделу"
      )}: ${group.name}`,
      Total: totals.total,
      Cash: totals.cash,
      Cashless: totals.cashless
    });
  }

  const grandTotals =
    btrTotals(rows);

  exportRows.push({
    Name: t(
      "Common.Total",
      "Итого"
    ),
    Total: grandTotals.total,
    Cash: grandTotals.cash,
    Cashless: grandTotals.cashless
  });

  return {
    title: `${t(
      "Money.BtrTitle",
      "Текущие расходы"
    )} ${formatReportDate(
      dateFrom
    )} — ${formatReportDate(dateTo)}`,
    fileName: `BTR_${safePrihodPeriodFilePart(
      dateFrom
    )}_${safePrihodPeriodFilePart(dateTo)}`,
    orientation: "portrait",
    locale,
    columns: [
      {
        key: "Name",
        title: t(
          "Money.DdsName",
          "Наименование"
        ),
        type: "text",
        width: 44
      },
      {
        key: "Total",
        title: t(
          "Common.Total",
          "Итого"
        ),
        type: "number",
        decimals: 2,
        width: 16
      },
      {
        key: "Cash",
        title: t(
          "Money.DdsCash",
          "Нал"
        ),
        type: "number",
        decimals: 2,
        width: 16
      },
      {
        key: "Cashless",
        title: t(
          "Money.DdsCashless",
          "Безнал"
        ),
        type: "number",
        decimals: 2,
        width: 16
      }
    ],
    rows: exportRows,
    footerRows: []
  };
}

function BtrReport({
  data,
  dateFrom,
  dateTo,
  locale,
  fetchWithAuth,
  t,
  onReload
}) {
  const rows =
    getBtrRows(data);
  const formatter =
    createMoneyFormatter(locale);

  const commonOptions = {
    rows,
    dateFrom,
    dateTo,
    locale,
    t
  };

  async function handleExport(format) {
    try {
      await exportReportFile({
        fetchWithAuth,
        reportModel:
          buildBtrExportModel(
            commonOptions
          ),
        format,
        errorMessage: t(
          "Report.ExportError",
          "Ошибка экспорта отчёта."
        )
      });
    } catch (error) {
      window.alert(
        error?.message ||
          t(
            "Report.ExportError",
            "Ошибка экспорта отчёта."
          )
      );
    }
  }

  return (
    <div className="reports-page money-btr-page">
      <div className="report-toolbar">
        <button
          type="button"
          className="report-run-button"
          onClick={onReload}
        >
          {t(
            "Common.Generate",
            "Сформировать"
          )}
        </button>

        <button
          type="button"
          className="report-action-button report-print-button"
          onClick={() =>
            printBtrReport(
              commonOptions
            )
          }
        >
          {t("Common.Print", "Печать")}
        </button>

        <button
          type="button"
          className="report-action-button report-excel-button"
          onClick={() =>
            handleExport("xlsx")
          }
        >
          {t("Common.Excel", "Excel")}
        </button>

        <button
          type="button"
          className="report-action-button report-word-button"
          onClick={() =>
            handleExport("docx")
          }
        >
          {t("Common.Word", "Word")}
        </button>
      </div>

      <article className="revenue-report-sheet money-btr-sheet">
        <h3 className="money-btr-title">
          {t(
            "Money.BtrTitle",
            "Текущие расходы"
          )}{" "}
          {t("Common.From", "с")}{" "}
          {formatReportDate(dateFrom)}{" "}
          {t("Common.To", "по")}{" "}
          {formatReportDate(dateTo)}
        </h3>

        {rows.length > 0 ? (
          <BtrReportTable
            rows={rows}
            formatter={formatter}
            t={t}
          />
        ) : (
          <div className="report-empty">
            {t(
              "Reports.NoDataForPeriod",
              "За выбранный период данных нет."
            )}
          </div>
        )}
      </article>
    </div>
  );
}


function normalizePribilPayload(data) {
  const payload =
    data?.data ??
    data?.Data ??
    data ??
    {};

  return {
    saldo: normalizeRows(
      payload?.Saldo ??
      payload?.saldo
    ),
    dolgiPost: normalizeRows(
      payload?.DolgiPost ??
      payload?.dolgiPost
    ),
    kass: normalizeRows(
      payload?.Kass ??
      payload?.kass
    ),
    realiz: normalizeRows(
      payload?.Realiz ??
      payload?.realiz
    ),
    spisPit: normalizeRows(
      payload?.SpisPit ??
      payload?.spisPit
    ),
    spisCalc: normalizeRows(
      payload?.SpisCalc ??
      payload?.spisCalc
    ),
    upr: normalizeRows(
      payload?.UPR ??
      payload?.upr
    ),
    viruch: normalizeRows(
      payload?.Viruch ??
      payload?.viruch
    )
  };
}

function pribilSum(rows, field) {
  return (Array.isArray(rows) ? rows : [])
    .reduce(
      (sum, row) =>
        sum + numericValue(row?.[field]),
      0
    );
}

function pribilSaldoTotals(rows) {
  return (Array.isArray(rows) ? rows : [])
    .reduce(
      (totals, row) => {
        totals.begin +=
          numericValue(row?.SaldoBegin);

        totals.end +=
          numericValue(
            row?.SalldoEnd ??
            row?.SaldoEnd
          );

        return totals;
      },
      {
        begin: 0,
        end: 0
      }
    );
}

function pribilDebtTotals(rows) {
  return (Array.isArray(rows) ? rows : [])
    .reduce(
      (totals, row) => {
        totals.begin +=
          numericValue(
            row?.DolgBegin ??
            row?.Dolg1
          );

        totals.end +=
          numericValue(
            row?.DolgEnd ??
            row?.Dolg2
          );

        return totals;
      },
      {
        begin: 0,
        end: 0
      }
    );
}

function pribilCashTotals(rows) {
  return (Array.isArray(rows) ? rows : [])
    .reduce(
      (totals, row) => {
        totals.begin +=
          numericValue(row?.SaldoBegin);

        totals.end +=
          numericValue(row?.SaldoEnd);

        return totals;
      },
      {
        begin: 0,
        end: 0
      }
    );
}

function pribilUprGroups(rows, t) {
  return groupBtrRows(rows, t);
}

function calculatePribil(data) {
  const saldo =
    pribilSaldoTotals(data.saldo);

  const debts =
    pribilDebtTotals(data.dolgiPost);

  const realizTotal =
    pribilSum(data.realiz, "Summ");

  const spisPitTotal =
    pribilSum(data.spisPit, "Summ");

  const spisCalcTotal =
    pribilSum(data.spisCalc, "Summ");

  const variableExpenses =
    spisPitTotal + spisCalcTotal;

  const grossProfit =
    realizTotal - variableExpenses;

  const uprTotal =
    pribilSum(data.upr, "Summ");

  const inventoryChange =
    saldo.end - saldo.begin;

  const supplierDebtChange =
    debts.begin - debts.end;

  const balanceProfit =
    grossProfit -
    uprTotal +
    inventoryChange +
    supplierDebtChange;

  const viruch =
    pribilSum(data.viruch, "Summ");

  const foodCost =
    viruch !== 0
      ? variableExpenses / viruch
      : null;

  return {
    saldo,
    debts,
    kass: pribilCashTotals(data.kass),
    realizTotal,
    spisPitTotal,
    spisCalcTotal,
    variableExpenses,
    grossProfit,
    uprTotal,
    inventoryChange,
    supplierDebtChange,
    balanceProfit,
    viruch,
    foodCost
  };
}

function formatPribilPercent(value, locale) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return "—";
  }

  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value));
}

function PribilBeginEndTable({
  rows,
  nameField,
  beginField,
  endField,
  formatter,
  t,
  totalLabel
}) {
  const totals = rows.reduce(
    (accumulator, row) => {
      accumulator.begin +=
        numericValue(row?.[beginField]);

      accumulator.end +=
        numericValue(
          row?.[endField] ??
          (
            endField === "SalldoEnd"
              ? row?.SaldoEnd
              : undefined
          )
        );

      return accumulator;
    },
    {
      begin: 0,
      end: 0
    }
  );

  return (
    <div className="report-table-scroll">
      <table className="report-table money-pribil-begin-end-table">
        <thead>
          <tr>
            <th className="report-text">
              {t(
                "Money.PribilName",
                "Наименование"
              )}
            </th>
            <th className="report-money">
              {t(
                "Money.PribilBegin",
                "На начало"
              )}
            </th>
            <th className="report-money">
              {t(
                "Money.PribilEnd",
                "На конец"
              )}
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`${row?.[nameField] ?? "row"}-${index}`}
            >
              <td className="report-text">
                {row?.[nameField] ?? "—"}
              </td>
              <td className="report-money">
                {formatter.format(
                  numericValue(
                    row?.[beginField]
                  )
                )}
              </td>
              <td className="report-money">
                {formatter.format(
                  numericValue(
                    row?.[endField] ??
                    (
                      endField === "SalldoEnd"
                        ? row?.SaldoEnd
                        : undefined
                    )
                  )
                )}
              </td>
            </tr>
          ))}

          <tr className="money-pribil-subtotal-row">
            <td className="report-text">
              {totalLabel}
            </td>
            <td className="report-money">
              {formatter.format(
                totals.begin
              )}
            </td>
            <td className="report-money">
              {formatter.format(
                totals.end
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function PribilDetailAmountTable({
  rows,
  nameField,
  formatter,
  total,
  totalLabel,
  t
}) {
  return (
    <div className="report-table-scroll">
      <table className="report-table money-pribil-detail-table">
        <thead>
          <tr>
            <th className="report-text">
              {t(
                "Money.PribilName",
                "Наименование"
              )}
            </th>
            <th className="report-money">
              {t(
                "Common.Total",
                "Итого"
              )}
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`${row?.[nameField] ?? "row"}-${index}`}
            >
              <td className="report-text">
                {row?.[nameField] ?? "—"}
              </td>
              <td className="report-money">
                {formatter.format(
                  numericValue(row?.Summ)
                )}
              </td>
            </tr>
          ))}

          <tr className="money-pribil-subtotal-row">
            <td className="report-text">
              {totalLabel}
            </td>
            <td className="report-money">
              {formatter.format(total)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function PribilMetricRow({
  label,
  value,
  formatter,
  percent = false,
  locale
}) {
  return (
    <div className="money-pribil-metric-row">
      <span className="money-pribil-metric-label">
        {label}
      </span>

      <span className="money-pribil-metric-value">
        {percent
          ? formatPribilPercent(
              value,
              locale
            )
          : formatter.format(value)}
      </span>
    </div>
  );
}

function PribilReportBody({
  pribilData,
  calculations,
  locale,
  formatter,
  t
}) {
  const uprGroups =
    pribilUprGroups(
      pribilData.upr,
      t
    );

  return (
    <div className="money-pribil-content">
      <section className="money-pribil-section">
        <div className="money-pribil-section-title">
          {t(
            "Money.PribilInventory",
            "Остатки сырья по подразделениям"
          )}
        </div>

        <PribilBeginEndTable
          rows={pribilData.saldo}
          nameField="NameSkl"
          beginField="SaldoBegin"
          endField="SalldoEnd"
          formatter={formatter}
          t={t}
          totalLabel={t(
            "Common.Total",
            "Итого"
          )}
        />
      </section>

      <section className="money-pribil-section money-pribil-compact-section">
        <div className="money-pribil-section-title">
          {t(
            "Money.PribilSupplierDebts",
            "Долги поставщикам"
          )}
        </div>

        <div className="money-pribil-begin-end-line">
          <span>
            {t(
              "Money.PribilBegin",
              "На начало"
            )}:{" "}
            <strong>
              {formatter.format(
                calculations.debts.begin
              )}
            </strong>
          </span>

          <span>
            {t(
              "Money.PribilEnd",
              "На конец"
            )}:{" "}
            <strong>
              {formatter.format(
                calculations.debts.end
              )}
            </strong>
          </span>
        </div>
      </section>

      <section className="money-pribil-section">
        <div className="money-pribil-section-title">
          {t(
            "Money.PribilCashBalances",
            "Остатки по кассам"
          )}
        </div>

        <PribilBeginEndTable
          rows={pribilData.kass}
          nameField="FormaOpl"
          beginField="SaldoBegin"
          endField="SaldoEnd"
          formatter={formatter}
          t={t}
          totalLabel={t(
            "Common.Total",
            "Итого"
          )}
        />
      </section>

      <section className="money-pribil-section">
        <div className="money-pribil-primary-line">
          <span>
            {t(
              "Money.PribilRevenue",
              "Выручка от реализации"
            )}
          </span>
          <strong>
            {formatter.format(
              calculations.realizTotal
            )}
          </strong>
        </div>

        <PribilDetailAmountTable
          rows={pribilData.realiz}
          nameField="NameDohod"
          formatter={formatter}
          total={
            calculations.realizTotal
          }
          totalLabel={t(
            "Money.PribilRevenueTotal",
            "Итого выручка"
          )}
          t={t}
        />
      </section>

      <section className="money-pribil-section">
        <div className="money-pribil-primary-line">
          <span>
            {t(
              "Money.PribilVariableExpenses",
              "Переменные расходы"
            )}
          </span>
          <strong>
            {formatter.format(
              calculations.variableExpenses
            )}
          </strong>
        </div>

        <div className="money-pribil-subgroup">
          <div className="money-pribil-subgroup-title">
            {t(
              "Money.PribilRawWriteOff",
              "Списание сырья"
            )}
          </div>

          <PribilDetailAmountTable
            rows={pribilData.spisPit}
            nameField="Zatr"
            formatter={formatter}
            total={
              calculations.spisPitTotal
            }
            totalLabel={t(
              "Money.PribilRawWriteOffTotal",
              "Итого списание сырья"
            )}
            t={t}
          />
        </div>

        <div className="money-pribil-subgroup">
          <div className="money-pribil-subgroup-title">
            {t(
              "Money.PribilCalcWriteOff",
              "Списание по калькуляциям"
            )}
          </div>

          <div className="money-pribil-single-value">
            {formatter.format(
              calculations.spisCalcTotal
            )}
          </div>
        </div>
      </section>

      <PribilMetricRow
        label={t(
          "Money.PribilGrossProfit",
          "Валовая прибыль:"
        )}
        value={
          calculations.grossProfit
        }
        formatter={formatter}
        locale={locale}
      />

      <section className="money-pribil-section">
        <div className="money-pribil-primary-line">
          <span>
            {t(
              "Money.PribilFixedExpenses",
              "Условно-постоянные расходы"
            )}
          </span>
          <strong>
            {formatter.format(
              calculations.uprTotal
            )}
          </strong>
        </div>

        <div className="money-pribil-upr-groups">
          {uprGroups.map((group) => {
            const groupTotal =
              pribilSum(
                group.rows,
                "Summ"
              );

            return (
              <div
                className="money-pribil-upr-group"
                key={group.name}
              >
                <div className="money-pribil-upr-group-title">
                  {group.name}
                </div>

                <table className="report-table money-pribil-detail-table">
                  <tbody>
                    {group.rows.map(
                      (row, index) => (
                        <tr
                          key={`${group.name}-${index}-${row?.NameZatr ?? ""}`}
                        >
                          <td className="report-text">
                            {row?.NameZatr ?? "—"}
                          </td>
                          <td className="report-money">
                            {formatter.format(
                              numericValue(
                                row?.Summ
                              )
                            )}
                          </td>
                        </tr>
                      )
                    )}

                    <tr className="money-pribil-subtotal-row">
                      <td className="report-text">
                        {t(
                          "Money.DdsSectionTotal",
                          "Итого по разделу"
                        )}
                        : {group.name}
                      </td>
                      <td className="report-money">
                        {formatter.format(
                          groupTotal
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </section>

      <PribilMetricRow
        label={t(
          "Money.PribilBalanceProfit",
          "Балансовая прибыль:"
        )}
        value={
          calculations.balanceProfit
        }
        formatter={formatter}
        locale={locale}
      />

      <PribilMetricRow
        label={t(
          "Money.PribilFoodCost",
          "Фудкост:"
        )}
        value={
          calculations.foodCost
        }
        formatter={formatter}
        percent
        locale={locale}
      />
    </div>
  );
}

function buildPribilPrintHtml({
  pribilData,
  dateFrom,
  dateTo,
  organizationName,
  locale,
  t
}) {
  const formatter =
    createMoneyFormatter(locale);
  const calculations =
    calculatePribil(pribilData);

  const title = `${t(
    "Money.PribilTitle",
    "Отчет о доходах и расходах за период"
  )} ${t(
    "Common.From",
    "с"
  )} ${formatReportDate(
    dateFrom
  )} ${t(
    "Common.To",
    "по"
  )} ${formatReportDate(dateTo)}`;

  const beginEndRows = (
    rows,
    nameField,
    beginField,
    endField
  ) => {
    const totals = rows.reduce(
      (accumulator, row) => {
        accumulator.begin +=
          numericValue(
            row?.[beginField]
          );

        accumulator.end +=
          numericValue(
            row?.[endField] ??
            (
              endField === "SalldoEnd"
                ? row?.SaldoEnd
                : undefined
            )
          );

        return accumulator;
      },
      {
        begin: 0,
        end: 0
      }
    );

    const body = rows
      .map(
        (row) => `<tr>
<td class="text">${escapeHtml(row?.[nameField] ?? "—")}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.[beginField])))}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.[endField] ?? (endField === "SalldoEnd" ? row?.SaldoEnd : undefined))))}</td>
</tr>`
      )
      .join("");

    return `${body}
<tr class="subtotal">
<td class="text">${escapeHtml(t("Common.Total", "Итого"))}</td>
<td class="number">${escapeHtml(formatter.format(totals.begin))}</td>
<td class="number">${escapeHtml(formatter.format(totals.end))}</td>
</tr>`;
  };

  const detailRows = (
    rows,
    nameField
  ) =>
    rows
      .map(
        (row) => `<tr>
<td class="text">${escapeHtml(row?.[nameField] ?? "—")}</td>
<td class="number">${escapeHtml(formatter.format(numericValue(row?.Summ)))}</td>
</tr>`
      )
      .join("");

  const uprGroups =
    pribilUprGroups(
      pribilData.upr,
      t
    );

  const uprHtml = uprGroups
    .map((group) => {
      const groupTotal =
        pribilSum(
          group.rows,
          "Summ"
        );

      return `<div class="subgroup-title">${escapeHtml(group.name)}</div>
<table>
<tbody>
${detailRows(group.rows, "NameZatr")}
<tr class="subtotal">
<td class="text">${escapeHtml(
        `${t("Money.DdsSectionTotal", "Итого по разделу")}: ${group.name}`
      )}</td>
<td class="number">${escapeHtml(formatter.format(groupTotal))}</td>
</tr>
</tbody>
</table>`;
    })
    .join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
@page { size: A4 portrait; margin: 8mm 8mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; color: #111; font-size: 7.6pt; }
.header { display: flex; justify-content: space-between; align-items: flex-start; gap: 8mm; margin-bottom: 3mm; }
h1 { margin: 0; font-size: 11.5pt; font-style: italic; }
.org { max-width: 42%; text-align: right; font-size: 8.5pt; font-weight: 700; }
.section { margin-top: 3mm; break-inside: avoid; page-break-inside: avoid; }
.section-title { margin-bottom: 1mm; padding: 1mm 1.5mm; background: #e8efe7; font-weight: 700; }
.primary { display: flex; justify-content: space-between; gap: 6mm; padding: 1.2mm 1.5mm; border-bottom: 0.25mm solid #738178; font-weight: 700; }
.subgroup-title { margin-top: 1.5mm; padding: 0.8mm 1.5mm; background: #f0f4ef; font-weight: 700; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
tr { break-inside: avoid; page-break-inside: avoid; }
th, td { padding: 0.8mm 1mm; border-bottom: 0.1mm solid #cbd1cc; vertical-align: top; }
th { background: #f0f3ef; font-size: 7pt; }
.text { text-align: left; overflow-wrap: anywhere; }
.number { width: 24%; text-align: right; white-space: nowrap; }
.subtotal td { background: #f6f8f5; font-weight: 700; border-top: 0.2mm solid #9fac9f; }
.metric { display: flex; justify-content: flex-end; gap: 8mm; margin-top: 3mm; padding: 1.7mm 2mm; border-top: 0.35mm solid #59695e; border-bottom: 0.35mm solid #59695e; background: #e8efe7; font-size: 9pt; font-weight: 700; }
.metric .value { min-width: 34mm; text-align: right; }
.compact-line { display: flex; gap: 12mm; padding: 1mm 1.5mm; background: #f8faf7; }
.single-value { padding: 1mm 1.5mm; text-align: right; font-weight: 700; }
</style>
</head>
<body>
<div class="header">
<h1>${escapeHtml(title)}</h1>
<div class="org">${escapeHtml(organizationName || "")}</div>
</div>

<div class="section">
<div class="section-title">${escapeHtml(t("Money.PribilInventory", "Остатки сырья по подразделениям"))}</div>
<table>
<thead>
<tr>
<th class="text">${escapeHtml(t("Money.PribilName", "Наименование"))}</th>
<th class="number">${escapeHtml(t("Money.PribilBegin", "На начало"))}</th>
<th class="number">${escapeHtml(t("Money.PribilEnd", "На конец"))}</th>
</tr>
</thead>
<tbody>
${beginEndRows(pribilData.saldo, "NameSkl", "SaldoBegin", "SalldoEnd")}
</tbody>
</table>
</div>

<div class="section">
<div class="section-title">${escapeHtml(t("Money.PribilSupplierDebts", "Долги поставщикам"))}</div>
<div class="compact-line">
<span>${escapeHtml(t("Money.PribilBegin", "На начало"))}: <strong>${escapeHtml(formatter.format(calculations.debts.begin))}</strong></span>
<span>${escapeHtml(t("Money.PribilEnd", "На конец"))}: <strong>${escapeHtml(formatter.format(calculations.debts.end))}</strong></span>
</div>
</div>

<div class="section">
<div class="section-title">${escapeHtml(t("Money.PribilCashBalances", "Остатки по кассам"))}</div>
<table>
<thead>
<tr>
<th class="text">${escapeHtml(t("Money.PribilName", "Наименование"))}</th>
<th class="number">${escapeHtml(t("Money.PribilBegin", "На начало"))}</th>
<th class="number">${escapeHtml(t("Money.PribilEnd", "На конец"))}</th>
</tr>
</thead>
<tbody>
${beginEndRows(pribilData.kass, "FormaOpl", "SaldoBegin", "SaldoEnd")}
</tbody>
</table>
</div>

<div class="section">
<div class="primary"><span>${escapeHtml(t("Money.PribilRevenue", "Выручка от реализации"))}</span><span>${escapeHtml(formatter.format(calculations.realizTotal))}</span></div>
<table>
<tbody>
${detailRows(pribilData.realiz, "NameDohod")}
<tr class="subtotal">
<td class="text">${escapeHtml(t("Money.PribilRevenueTotal", "Итого выручка"))}</td>
<td class="number">${escapeHtml(formatter.format(calculations.realizTotal))}</td>
</tr>
</tbody>
</table>
</div>

<div class="section">
<div class="primary"><span>${escapeHtml(t("Money.PribilVariableExpenses", "Переменные расходы"))}</span><span>${escapeHtml(formatter.format(calculations.variableExpenses))}</span></div>
<div class="subgroup-title">${escapeHtml(t("Money.PribilRawWriteOff", "Списание сырья"))}</div>
<table>
<tbody>
${detailRows(pribilData.spisPit, "Zatr")}
<tr class="subtotal">
<td class="text">${escapeHtml(t("Money.PribilRawWriteOffTotal", "Итого списание сырья"))}</td>
<td class="number">${escapeHtml(formatter.format(calculations.spisPitTotal))}</td>
</tr>
</tbody>
</table>
<div class="subgroup-title">${escapeHtml(t("Money.PribilCalcWriteOff", "Списание по калькуляциям"))}</div>
<div class="single-value">${escapeHtml(formatter.format(calculations.spisCalcTotal))}</div>
</div>

<div class="metric">
<span>${escapeHtml(t("Money.PribilGrossProfit", "Валовая прибыль:"))}</span>
<span class="value">${escapeHtml(formatter.format(calculations.grossProfit))}</span>
</div>

<div class="section">
<div class="primary"><span>${escapeHtml(t("Money.PribilFixedExpenses", "Условно-постоянные расходы"))}</span><span>${escapeHtml(formatter.format(calculations.uprTotal))}</span></div>
${uprHtml}
</div>

<div class="metric">
<span>${escapeHtml(t("Money.PribilBalanceProfit", "Балансовая прибыль:"))}</span>
<span class="value">${escapeHtml(formatter.format(calculations.balanceProfit))}</span>
</div>

<div class="metric">
<span>${escapeHtml(t("Money.PribilFoodCost", "Фудкост:"))}</span>
<span class="value">${escapeHtml(formatPribilPercent(calculations.foodCost, locale))}</span>
</div>
</body>
</html>`;
}

function printPribilReport(options) {
  const printWindow = window.open(
    "",
    "_blank",
    "width=900,height=950"
  );

  if (!printWindow) {
    window.alert(
      options.t(
        "Reports.PrintPopupBlocked",
        "Браузер заблокировал окно печати. Разрешите всплывающие окна для Web Office."
      )
    );
    return;
  }

  printWindow.document.open();
  printWindow.document.write(
    buildPribilPrintHtml(options)
  );
  printWindow.document.close();
  printWindow.focus();

  closePrintWindowAfterPrint(
    printWindow
  );

  window.setTimeout(() => {
    printWindow.print();
  }, 150);
}

function buildPribilExportModel({
  pribilData,
  dateFrom,
  dateTo,
  organizationName,
  locale,
  t
}) {
  const calculations =
    calculatePribil(pribilData);

  const rows = [];

  const pushLine = (
    section,
    name,
    begin = null,
    end = null,
    amount = null
  ) => {
    rows.push({
      Section: section,
      Name: name,
      Begin: begin,
      End: end,
      Amount: amount
    });
  };

  for (const row of pribilData.saldo) {
    pushLine(
      t(
        "Money.PribilInventory",
        "Остатки сырья по подразделениям"
      ),
      row?.NameSkl ?? "—",
      numericValue(row?.SaldoBegin),
      numericValue(
        row?.SalldoEnd ??
        row?.SaldoEnd
      )
    );
  }

  pushLine(
    t(
      "Money.PribilSupplierDebts",
      "Долги поставщикам"
    ),
    t(
      "Money.PribilSupplierDebts",
      "Долги поставщикам"
    ),
    calculations.debts.begin,
    calculations.debts.end
  );

  for (const row of pribilData.kass) {
    pushLine(
      t(
        "Money.PribilCashBalances",
        "Остатки по кассам"
      ),
      row?.FormaOpl ?? "—",
      numericValue(row?.SaldoBegin),
      numericValue(row?.SaldoEnd)
    );
  }

  pushLine(
    t(
      "Money.PribilRevenue",
      "Выручка от реализации"
    ),
    t(
      "Money.PribilRevenue",
      "Выручка от реализации"
    ),
    null,
    null,
    calculations.realizTotal
  );

  for (const row of pribilData.realiz) {
    pushLine(
      t(
        "Money.PribilRevenue",
        "Выручка от реализации"
      ),
      row?.NameDohod ?? "—",
      null,
      null,
      numericValue(row?.Summ)
    );
  }

  pushLine(
    t(
      "Money.PribilVariableExpenses",
      "Переменные расходы"
    ),
    t(
      "Money.PribilVariableExpenses",
      "Переменные расходы"
    ),
    null,
    null,
    calculations.variableExpenses
  );

  for (const row of pribilData.spisPit) {
    pushLine(
      t(
        "Money.PribilRawWriteOff",
        "Списание сырья"
      ),
      row?.Zatr ?? "—",
      null,
      null,
      numericValue(row?.Summ)
    );
  }

  pushLine(
    t(
      "Money.PribilCalcWriteOff",
      "Списание по калькуляциям"
    ),
    t(
      "Money.PribilCalcWriteOff",
      "Списание по калькуляциям"
    ),
    null,
    null,
    calculations.spisCalcTotal
  );

  pushLine(
    "",
    t(
      "Money.PribilGrossProfit",
      "Валовая прибыль:"
    ),
    null,
    null,
    calculations.grossProfit
  );

  for (
    const group of pribilUprGroups(
      pribilData.upr,
      t
    )
  ) {
    for (const row of group.rows) {
      pushLine(
        `${t(
          "Money.PribilFixedExpenses",
          "Условно-постоянные расходы"
        )} / ${group.name}`,
        row?.NameZatr ?? "—",
        null,
        null,
        numericValue(row?.Summ)
      );
    }
  }

  pushLine(
    "",
    t(
      "Money.PribilBalanceProfit",
      "Балансовая прибыль:"
    ),
    null,
    null,
    calculations.balanceProfit
  );

  pushLine(
    "",
    t(
      "Money.PribilFoodCost",
      "Фудкост:"
    ),
    null,
    null,
    calculations.foodCost === null
      ? null
      : calculations.foodCost * 100
  );

  const title = `${t(
    "Money.PribilTitle",
    "Отчет о доходах и расходах за период"
  )} ${formatReportDate(
    dateFrom
  )} — ${formatReportDate(dateTo)}`;

  return {
    title:
      organizationName
        ? `${title} — ${organizationName}`
        : title,
    fileName: `Pribil_${safePrihodPeriodFilePart(
      dateFrom
    )}_${safePrihodPeriodFilePart(dateTo)}`,
    orientation: "portrait",
    locale,
    columns: [
      {
        key: "Section",
        title: t(
          "Money.PribilSection",
          "Раздел"
        ),
        type: "text",
        width: 31
      },
      {
        key: "Name",
        title: t(
          "Money.PribilName",
          "Наименование"
        ),
        type: "text",
        width: 37
      },
      {
        key: "Begin",
        title: t(
          "Money.PribilBegin",
          "На начало"
        ),
        type: "number",
        decimals: 2,
        width: 15
      },
      {
        key: "End",
        title: t(
          "Money.PribilEnd",
          "На конец"
        ),
        type: "number",
        decimals: 2,
        width: 15
      },
      {
        key: "Amount",
        title: t(
          "Common.Total",
          "Итого"
        ),
        type: "number",
        decimals: 2,
        width: 15
      }
    ],
    rows,
    footerRows: []
  };
}

function PribilReport({
  data,
  dateFrom,
  dateTo,
  organizationName,
  locale,
  fetchWithAuth,
  t,
  onReload
}) {
  const pribilData =
    normalizePribilPayload(data);

  const formatter =
    createMoneyFormatter(locale);

  const calculations =
    calculatePribil(pribilData);

  const hasData =
    pribilData.saldo.length > 0 ||
    pribilData.dolgiPost.length > 0 ||
    pribilData.kass.length > 0 ||
    pribilData.realiz.length > 0 ||
    pribilData.spisPit.length > 0 ||
    pribilData.spisCalc.length > 0 ||
    pribilData.upr.length > 0 ||
    pribilData.viruch.length > 0;

  const commonOptions = {
    pribilData,
    dateFrom,
    dateTo,
    organizationName,
    locale,
    t
  };

  async function handleExport(format) {
    try {
      await exportReportFile({
        fetchWithAuth,
        reportModel:
          buildPribilExportModel(
            commonOptions
          ),
        format,
        errorMessage: t(
          "Report.ExportError",
          "Ошибка экспорта отчёта."
        )
      });
    } catch (error) {
      window.alert(
        error?.message ||
          t(
            "Report.ExportError",
            "Ошибка экспорта отчёта."
          )
      );
    }
  }

  return (
    <div className="reports-page money-pribil-page">
      <div className="report-toolbar">
        <button
          type="button"
          className="report-run-button"
          onClick={onReload}
        >
          {t(
            "Common.Generate",
            "Сформировать"
          )}
        </button>

        <button
          type="button"
          className="report-action-button report-print-button"
          onClick={() =>
            printPribilReport(
              commonOptions
            )
          }
        >
          {t(
            "Common.Print",
            "Печать"
          )}
        </button>

        <button
          type="button"
          className="report-action-button report-excel-button"
          onClick={() =>
            handleExport("xlsx")
          }
        >
          {t(
            "Common.Excel",
            "Excel"
          )}
        </button>

        <button
          type="button"
          className="report-action-button report-word-button"
          onClick={() =>
            handleExport("docx")
          }
        >
          {t(
            "Common.Word",
            "Word"
          )}
        </button>
      </div>

      <article className="revenue-report-sheet money-pribil-sheet">
        <div className="money-pribil-heading">
          <h3 className="money-pribil-title">
            {t(
              "Money.PribilTitle",
              "Отчет о доходах и расходах за период"
            )}{" "}
            {t(
              "Common.From",
              "с"
            )}{" "}
            {formatReportDate(
              dateFrom
            )}{" "}
            {t(
              "Common.To",
              "по"
            )}{" "}
            {formatReportDate(
              dateTo
            )}
          </h3>

          {organizationName && (
            <div className="money-pribil-org">
              {organizationName}
            </div>
          )}
        </div>

        {hasData ? (
          <PribilReportBody
            pribilData={pribilData}
            calculations={calculations}
            locale={locale}
            formatter={formatter}
            t={t}
          />
        ) : (
          <div className="report-empty">
            {t(
              "Reports.NoDataForPeriod",
              "За выбранный период данных нет."
            )}
          </div>
        )}
      </article>
    </div>
  );
}

export default function ReportsPage({
  code,
  apiAction,
  data,
  dateFrom,
  dateTo,
  organizationName,
  organizationId = 0,
  departmentName,
  departmentId,
  all = 1,
  locale,
  fetchWithAuth,
  bonusEnabled = false,
  multiOrg = true,
  t = (key, fallback = "") => fallback,
  onReload
}) {
  const normalizedAction = String(apiAction ?? "").trim().toLowerCase();
  const normalizedCode = String(code ?? "").trim();
  const reportOrganizationName =
    multiOrg
      ? organizationName
      : "";

  if (
    normalizedCode === "05.14.01" ||
    normalizedAction === "prihodperiod"
  ) {
    return (
      <PrihodPeriodReport
        data={data}
        dateFrom={dateFrom}
        dateTo={dateTo}
        locale={locale}
        fetchWithAuth={fetchWithAuth}
        t={t}
        onReload={onReload}
      />
    );
  }

  if (
    normalizedCode === "05.14.02" ||
    normalizedAction === "rashodperiod"
  ) {
    return (
      <RashodPeriodReport
        data={data}
        dateFrom={dateFrom}
        dateTo={dateTo}
        locale={locale}
        fetchWithAuth={fetchWithAuth}
        t={t}
        onReload={onReload}
      />
    );
  }

  if (
    normalizedCode === "05.14.03" ||
    normalizedAction === "dds"
  ) {
    return (
      <DdsReport
        data={data}
        dateFrom={dateFrom}
        dateTo={dateTo}
        organizationName={reportOrganizationName}
        locale={locale}
        fetchWithAuth={fetchWithAuth}
        t={t}
        onReload={onReload}
      />
    );
  }

  if (
    normalizedCode === "05.14.04" ||
    normalizedAction === "btr"
  ) {
    return (
      <BtrReport
        data={data}
        dateFrom={dateFrom}
        dateTo={dateTo}
        locale={locale}
        fetchWithAuth={fetchWithAuth}
        t={t}
        onReload={onReload}
      />
    );
  }

  if (
    normalizedCode === "05.14.05" ||
    normalizedAction === "pibil" ||
    normalizedAction === "pribil"
  ) {
    return (
      <PribilReport
        data={data}
        dateFrom={dateFrom}
        dateTo={dateTo}
        organizationName={reportOrganizationName}
        locale={locale}
        fetchWithAuth={fetchWithAuth}
        t={t}
        onReload={onReload}
      />
    );
  }

  if (
    normalizedCode === "05.16" ||
    normalizedAction === "konsum"
  ) {
    return (
      <KonsumReport
        data={data}
        dateFrom={dateFrom}
        dateTo={dateTo}
        locale={locale}
        fetchWithAuth={fetchWithAuth}
        t={t}
        onReload={onReload}
      />
    );
  }

  if (normalizedCode === "05.12") {
    return (
      <ClientReportsNavigator
        data={data}
        dateFrom={dateFrom}
        dateTo={dateTo}
        organizationId={organizationId}
        departmentId={departmentId}
        all={all}
        locale={locale}
        fetchWithAuth={fetchWithAuth}
        bonusEnabled={bonusEnabled}
        t={t}
      />
    );
  }

  if (
    normalizedCode === "05.13" ||
    normalizedAction === "postav"
  ) {
    return (
      <PostavMovementsReport
        data={data}
        dateFrom={dateFrom}
        dateTo={dateTo}
        organizationId={organizationId}
        departmentId={departmentId}
        all={all}
        locale={locale}
        fetchWithAuth={fetchWithAuth}
        t={t}
        onReload={onReload}
      />
    );
  }

  if (
    normalizedCode === "05.04" ||
    normalizedAction === "tovotch"
  ) {
    return (
      <TovOtchReport
        data={data}
        dateFrom={dateFrom}
        dateTo={dateTo}
        departmentName={departmentName}
        locale={locale}
        fetchWithAuth={fetchWithAuth}
        t={t}
        onReload={onReload}
      />
    );
  }

  if (
    normalizedCode === "05.10.03" ||
    normalizedAction === "spissirblud"
  ) {
    return (
      <SpisSirBludReport
        data={data}
        dateFrom={dateFrom}
        dateTo={dateTo}
        departmentName={departmentName}
        locale={locale}
        fetchWithAuth={fetchWithAuth}
        t={t}
        onReload={onReload}
      />
    );
  }

  if (
    normalizedCode === "05.10.02" ||
    normalizedAction === "spisblud"
  ) {
    return (
      <SpisBludReport
        data={data}
        all={all}
        dateFrom={dateFrom}
        dateTo={dateTo}
        departmentId={departmentId}
        departmentName={departmentName}
        locale={locale}
        fetchWithAuth={fetchWithAuth}
        t={t}
        onReload={onReload}
      />
    );
  }

  if (
    normalizedCode === "05.10.01" ||
    normalizedAction === "spistov"
  ) {
    return (
      <SpisTovReport
        data={data}
        all={all}
        dateFrom={dateFrom}
        dateTo={dateTo}
        departmentId={departmentId}
        departmentName={departmentName}
        locale={locale}
        fetchWithAuth={fetchWithAuth}
        t={t}
        onReload={onReload}
      />
    );
  }

  if (normalizedCode === "05.08.03") {
    return (
      <RashodDishReport
        data={data}
        variant="groups"
        dateFrom={dateFrom}
        dateTo={dateTo}
        departmentName={departmentName}
        locale={locale}
        fetchWithAuth={fetchWithAuth}
        t={t}
        onReload={onReload}
      />
    );
  }

  if (normalizedCode === "05.08.04") {
    return (
      <RashodDishReport
        data={data}
        variant="typdish"
        dateFrom={dateFrom}
        dateTo={dateTo}
        departmentName={departmentName}
        locale={locale}
        fetchWithAuth={fetchWithAuth}
        t={t}
        onReload={onReload}
      />
    );
  }

  if (normalizedCode === "05.08.05") {
    return (
      <RashodDishReport
        data={data}
        variant="rating"
        dateFrom={dateFrom}
        dateTo={dateTo}
        departmentName={departmentName}
        locale={locale}
        fetchWithAuth={fetchWithAuth}
        t={t}
        onReload={onReload}
      />
    );
  }

  if (
    normalizedCode === "05.08.07" ||
    normalizedAction === "rashodof"
  ) {
    return (
      <RashodOfReport
        data={data}
        dateFrom={dateFrom}
        dateTo={dateTo}
        departmentName={departmentName}
        locale={locale}
        fetchWithAuth={fetchWithAuth}
        t={t}
        onReload={onReload}
      />
    );
  }

  if (
    normalizedCode === "05.08.08" ||
    normalizedAction === "peremper"
  ) {
    return (
      <PeremPerReport
        data={data}
        dateFrom={dateFrom}
        dateTo={dateTo}
        departmentName={departmentName}
        locale={locale}
        fetchWithAuth={fetchWithAuth}
        t={t}
        onReload={onReload}
      />
    );
  }

  if (
    normalizedCode === "05.08.06" ||
    normalizedAction === "prihodtov"
  ) {
    return (
      <PrihodTovReport
        data={data}
        dateFrom={dateFrom}
        dateTo={dateTo}
        departmentName={departmentName}
        locale={locale}
        fetchWithAuth={fetchWithAuth}
        t={t}
        onReload={onReload}
      />
    );
  }

  if (
    normalizedCode === "05.08.10" ||
    normalizedAction === "abc"
  ) {
    return (
      <AbcReport
        data={data}
        dateFrom={dateFrom}
        dateTo={dateTo}
        departmentName={departmentName}
        locale={locale}
        fetchWithAuth={fetchWithAuth}
        t={t}
        onReload={onReload}
      />
    );
  }

  if (
    normalizedCode === "05.08.09" ||
    normalizedAction === "rashoddishhh"
  ) {
    return (
      <RashodDishReport
        data={data}
        variant="hh"
        dateFrom={dateFrom}
        dateTo={dateTo}
        departmentName={departmentName}
        locale={locale}
        fetchWithAuth={fetchWithAuth}
        t={t}
        onReload={onReload}
      />
    );
  }

  if (normalizedCode === "05.08.11") {
    return (
      <RashodDishReport
        data={data}
        variant="ceh"
        dateFrom={dateFrom}
        dateTo={dateTo}
        departmentName={departmentName}
        locale={locale}
        fetchWithAuth={fetchWithAuth}
        t={t}
        onReload={onReload}
      />
    );
  }

  if (
    normalizedCode === "05.08.02" ||
    normalizedAction === "proizv"
  ) {
    return (
      <ProizvReport
        data={data}
        dateFrom={dateFrom}
        dateTo={dateTo}
        departmentName={departmentName}
        locale={locale}
        fetchWithAuth={fetchWithAuth}
        t={t}
        onReload={onReload}
      />
    );
  }

  if (
    normalizedCode === "05.08.01" ||
    normalizedAction === "rashodsir"
  ) {
    return (
      <RashodSirReport
        data={data}
        dateFrom={dateFrom}
        dateTo={dateTo}
        departmentName={departmentName}
        locale={locale}
        fetchWithAuth={fetchWithAuth}
        t={t}
        onReload={onReload}
      />
    );
  }

  if (
    normalizedCode === "05.19" ||
    normalizedAction === "ostatsvod"
  ) {
    return (
      <OstatSvodReport
        data={data}
        dateTo={dateTo}
        departmentName={departmentName}
        locale={locale}
        fetchWithAuth={fetchWithAuth}
        t={t}
        onReload={onReload}
      />
    );
  }

  if (
    normalizedCode === "05.17" ||
    normalizedAction === "ostatnorm"
  ) {
    return (
      <OstatNormReport
        data={data}
        dateTo={dateTo}
        departmentName={departmentName}
        locale={locale}
        fetchWithAuth={fetchWithAuth}
        t={t}
        onReload={onReload}
      />
    );
  }

  if (
    normalizedCode === "05.09" ||
    normalizedAction === "enterexit"
  ) {
    return (
      <EnterExitReport
        data={data}
        dateFrom={dateFrom}
        dateTo={dateTo}
        organizationName={reportOrganizationName}
        locale={locale}
        fetchWithAuth={fetchWithAuth}
        t={t}
        onReload={onReload}
      />
    );
  }

  if (
    normalizedCode === "05.07" ||
    normalizedAction === "oborotsvod"
  ) {
    return (
      <OborotSvodReport
        data={data}
        dateFrom={dateFrom}
        dateTo={dateTo}
        organizationName={reportOrganizationName}
        locale={locale}
        fetchWithAuth={fetchWithAuth}
        t={t}
        onReload={onReload}
      />
    );
  }

  if (normalizedCode === "05.06") {
    return (
      <Blank1ComplexReport
        data={data}
        dateFrom={dateFrom}
        departmentName={departmentName}
        locale={locale}
        fetchWithAuth={fetchWithAuth}
        t={t}
        onReload={onReload}
      />
    );
  }

  if (normalizedCode === "05.05" || normalizedAction === "blank1") {
    return (
      <Blank1Report
        data={data}
        departmentName={departmentName}
        organizationName={reportOrganizationName}
        locale={locale}
        fetchWithAuth={fetchWithAuth}
        t={t}
        onReload={onReload}
      />
    );
  }

  if (normalizedCode === "05.03" || normalizedAction === "oborot") {
    return (
      <OborotReport
        data={data}
        dateFrom={dateFrom}
        dateTo={dateTo}
        organizationName={reportOrganizationName}
        locale={locale}
        fetchWithAuth={fetchWithAuth}
        t={t}
        onReload={onReload}
      />
    );
  }

  if (normalizedCode === "05.02" || normalizedAction === "remain") {
    return (
      <RemainReport
        data={data}
        dateTo={dateTo}
        organizationName={reportOrganizationName}
        locale={locale}
        fetchWithAuth={fetchWithAuth}
        t={t}
        onReload={onReload}
      />
    );
  }

  if (normalizedCode === "05.01.14" || normalizedAction === "advance") {
    return (
      <AdvanceReport
        data={data}
        dateFrom={dateFrom}
        dateTo={dateTo}
        organizationName={reportOrganizationName}
        locale={locale}
        fetchWithAuth={fetchWithAuth}
        t={t}
        onReload={onReload}
      />
    );
  }

  if (normalizedCode === "05.01.16" || normalizedAction === "reestrexcise") {
    return (
      <ReestrExciseReport
        data={data}
        dateFrom={dateFrom}
        dateTo={dateTo}
        organizationName={reportOrganizationName}
        locale={locale}
        fetchWithAuth={fetchWithAuth}
        t={t}
        onReload={onReload}
      />
    );
  }

  if (normalizedCode === "05.01.10" || normalizedAction === "reestranul") {
    return (
      <ReestrAnulReport
        data={data}
        dateFrom={dateFrom}
        dateTo={dateTo}
        organizationName={reportOrganizationName}
        locale={locale}
        fetchWithAuth={fetchWithAuth}
        t={t}
        onReload={onReload}
      />
    );
  }

  if (normalizedCode === "05.01.09" || normalizedAction === "reestrreturn") {
    return (
      <ReestrReturnReport
        data={data}
        dateFrom={dateFrom}
        dateTo={dateTo}
        organizationName={reportOrganizationName}
        locale={locale}
        fetchWithAuth={fetchWithAuth}
        t={t}
        onReload={onReload}
      />
    );
  }

  if (normalizedCode === "05.01.08" || normalizedAction === "reestrbill") {
    return (
      <ReestrBillReport
        data={data}
        dateFrom={dateFrom}
        dateTo={dateTo}
        organizationName={reportOrganizationName}
        locale={locale}
        fetchWithAuth={fetchWithAuth}
        t={t}
        onReload={onReload}
      />
    );
  }

  if (normalizedCode === "05.01.07" || normalizedAction === "revenuedohod") {
    return (
      <RevenueDohodReport
        data={data}
        dateFrom={dateFrom}
        dateTo={dateTo}
        organizationName={reportOrganizationName}
        locale={locale}
        fetchWithAuth={fetchWithAuth}
        t={t}
        onReload={onReload}
      />
    );
  }

  if (normalizedCode === "05.01.06" || normalizedAction === "revenuelanch") {
    return (
      <RevenueLanchReport
        data={data}
        dateFrom={dateFrom}
        dateTo={dateTo}
        organizationName={reportOrganizationName}
        locale={locale}
        fetchWithAuth={fetchWithAuth}
        t={t}
        onReload={onReload}
      />
    );
  }

  if (normalizedCode === "05.01.05" || normalizedAction === "revenuehour") {
    return (
      <RevenueHourReport
        data={data}
        dateFrom={dateFrom}
        dateTo={dateTo}
        organizationName={reportOrganizationName}
        locale={locale}
        fetchWithAuth={fetchWithAuth}
        t={t}
        onReload={onReload}
      />
    );
  }

  if (normalizedCode === "05.01.03" || normalizedAction === "revenuedates") {
    return (
      <RevenueDatesReport
        data={data}
        all={all}
        dateFrom={dateFrom}
        dateTo={dateTo}
        organizationName={reportOrganizationName}
        departmentName={departmentName}
        locale={locale}
        fetchWithAuth={fetchWithAuth}
        t={t}
        onReload={onReload}
      />
    );
  }

  if (normalizedCode === "05.01.02") {
    return (
      <RevenueGraphReport
        data={data}
        dateFrom={dateFrom}
        dateTo={dateTo}
        organizationName={reportOrganizationName}
        locale={locale}
        onReload={onReload}
      />
    );
  }

  if (normalizedCode === "05.01.01" || normalizedAction === "revenue") {
    return (
      <RevenueReport
        data={data}
        dateFrom={dateFrom}
        dateTo={dateTo}
        organizationName={reportOrganizationName}
        locale={locale}
        onReload={onReload}
      />
    );
  }

  return (
    <div className="reports-page">
      <div className="report-toolbar">
        <button type="button" className="report-run-button" onClick={onReload}>
          Сформировать
        </button>
      </div>
      <pre className="json-view">{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
