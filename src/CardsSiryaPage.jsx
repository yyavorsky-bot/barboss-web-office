import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { exportReportFile } from "./reportExport.js";
import "./cards-sirya-report.css";
import "./sirya-row-visual-fix.css";

const DEFAULT_API_BASE_URL = "https://webback.bar-boss.com";

function normalizeApiBaseUrl(value) {
  return String(value || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}

function formatDateForApi(value) {
  const text = String(value ?? "").trim();

  if (!text) return "";
  if (/^\d{2}\.\d{2}\.\d{2,4}$/.test(text)) return text;

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${day}.${month}.${year.slice(-2)}`;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;

  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = String(parsed.getFullYear()).slice(-2);

  return `${day}.${month}.${year}`;
}

function formatDate(value, locale = "ru-RU", withTime = false) {
  if (!value) return "";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);

  const date = parsed.toLocaleDateString(locale);
  if (!withTime) return date;

  return `${date} ${parsed.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit"
  })}`;
}

function formatTime(value, locale = "ru-RU") {
  if (!value) return "";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);

  return parsed.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatNumber(value, locale = "ru-RU", digits = 3) {
  const number = Number(value ?? 0);

  if (!Number.isFinite(number)) return "0";

  return number.toLocaleString(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function formatMoney(value, locale = "ru-RU") {
  const number = Number(value ?? 0);

  if (!Number.isFinite(number)) return "0,00";

  return number.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function sumBy(rows, field) {
  return rows.reduce((sum, row) => sum + Number(row?.[field] ?? 0), 0);
}

function reportDateTimestamp(value) {
  if (!value) return Number.POSITIVE_INFINITY;

  const parsed = new Date(value);
  const timestamp = parsed.getTime();

  return Number.isNaN(timestamp)
    ? Number.POSITIVE_INFINITY
    : timestamp;
}

function compareReportDates(leftValue, rightValue) {
  return reportDateTimestamp(leftValue) - reportDateTimestamp(rightValue);
}


function safeReportFilePart(value, fallback = "report") {
  const text = String(value ?? "").trim();

  if (!text) return fallback;

  return text
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 80);
}

function buildCardsSiryaCardExportModel(report, isSummary, t, locale) {
  const prihod = (Array.isArray(report?.Prihod) ? report.Prihod : [])
    .slice()
    .sort((left, right) => compareReportDates(left?.DateP, right?.DateP));
  const rashod = (Array.isArray(report?.Rashod) ? report.Rashod : [])
    .slice()
    .sort((left, right) =>
      compareReportDates(left?.DateReal, right?.DateReal)
    );
  const spisanie = (Array.isArray(report?.Spisanie) ? report.Spisanie : [])
    .slice()
    .sort((left, right) =>
      compareReportDates(left?.DateSpis, right?.DateSpis)
    );

  const title = isSummary
    ? t("CardsSirya.SummaryCard", "Карточка сводная")
    : t("CardsSirya.Report.RawMaterialCard", "Карточка сырья");

  const rows = [
    ...prihod.map((row) => ({
      Section: t("CardsSirya.Report.Receipts", "Приходные накладные"),
      Date: formatDate(row.DateP, locale),
      Party: row.SkladFrom || row.Postav || "",
      Document: row.Invoice || row.IdInvoice || "",
      Description: "",
      Quantity: Number(row.Postup || 0),
      Price: Number(row.Price || 0),
      AveragePrice: Number(row.PriceAvg || 0),
      Payment: row.Valut || row.Valuts || ""
    })),
    ...rashod.map((row) => ({
      Section: t("CardsSirya.Report.Consumption", "Расход сырья через блюда"),
      Date: formatDate(row.DateReal, locale, true),
      Party: row.Waiter || "",
      Document: row.InvCode || "",
      Description: row.NameDish || "",
      Quantity: Number(row.Kolvo || 0),
      Price: "",
      AveragePrice: "",
      Payment: ""
    })),
    ...spisanie.map((row) => ({
      Section: t("CardsSirya.Report.WriteOffs", "Прямые списания сырья"),
      Date: formatDate(row.DateSpis, locale),
      Party: "",
      Document: "",
      Description: row.Name || "",
      Quantity: Number(row["Списано"] || 0),
      Price: "",
      AveragePrice: "",
      Payment: ""
    }))
  ];

  return {
    title: `${title}: ${report?.["Товар"] || ""}`.replace(/:\s*$/, ""),
    fileName: `${
      isSummary ? "CardsSirya_Summary" : "CardsSirya_Card"
    }_${safeReportFilePart(report?.["Товар"], "raw")}`,
    orientation: "landscape",
    locale,
    meta: [
      {
        label: t("Common.Period", "Период"),
        value:
          `${formatDate(report?.Date1, locale)} — ` +
          `${formatDate(report?.Date2, locale)}`
      },
      ...(
        isSummary
          ? []
          : [
              {
                label: t("Common.Warehouse", "Склад"),
                value: report?.["Склад"] || "—"
              },
              {
                label: t(
                  "CardsSirya.Report.OpeningBalance",
                  "Сальдо на начало"
                ),
                value: formatNumber(report?.Saldo, locale)
              },
              {
                label: t(
                  "CardsSirya.Report.ClosingBalance",
                  "Сальдо на конец"
                ),
                value: formatNumber(report?.Rest, locale)
              }
            ]
      )
    ],
    columns: [
      {
        key: "Section",
        title: t("CardsSirya.Report.Section", "Раздел"),
        type: "text",
        width: 28
      },
      {
        key: "Date",
        title: t("Common.Date", "Дата"),
        type: "text",
        width: 19
      },
      {
        key: "Party",
        title: t(
          "CardsSirya.Report.PartyOrEmployee",
          "Поставщик / склад / сотрудник"
        ),
        type: "text",
        width: 28
      },
      {
        key: "Document",
        title: t("CardsSirya.Report.Document", "Документ"),
        type: "text",
        width: 16
      },
      {
        key: "Description",
        title: t("CardsSirya.Report.Description", "Наименование"),
        type: "text",
        width: 34
      },
      {
        key: "Quantity",
        title: t("Common.Quantity", "Количество"),
        type: "number",
        decimals: 3,
        width: 14
      },
      {
        key: "Price",
        title: t("Common.Price", "Цена"),
        type: "number",
        decimals: 2,
        width: 13
      },
      {
        key: "AveragePrice",
        title: t("CardsSirya.Report.AveragePrice", "Ср. цена"),
        type: "number",
        decimals: 2,
        width: 13
      },
      {
        key: "Payment",
        title: t("CardsSirya.Report.Payment", "Оплата"),
        type: "text",
        width: 16
      }
    ],
    rows,
    footerRows: []
  };
}

function buildCardsSiryaTurnoverExportModel(report, t, locale) {
  const oborot = Array.isArray(report?.Oborot) ? report.Oborot : [];
  const sortedRows = [...oborot].sort((left, right) =>
    compareReportDates(
      left?.DateAndTime ?? left?.Smena,
      right?.DateAndTime ?? right?.Smena
    )
  );

  const exportRows = sortedRows.map((row) => ({
    Shift: formatDate(row?.Smena || row?.DateAndTime, locale),
    Time: formatTime(row?.DateAndTime, locale),
    Document: row?.Nomer || "",
    Operation: row?.Waiter || "",
    Description: row?.Name || "",
    Quantity: Number(row?.Kolvo || 0)
  }));

  return {
    title: `${t(
      "CardsSirya.Report.RawMaterialTurnover",
      "Обороты сырья"
    )}: ${report?.["Товар"] || ""}`.replace(/:\s*$/, ""),
    fileName:
      `CardsSirya_Turnover_${safeReportFilePart(
        report?.["Товар"],
        "raw"
      )}`,
    orientation: "landscape",
    locale,
    meta: [
      {
        label: t("Common.Period", "Период"),
        value:
          `${formatDate(report?.Date1, locale)} — ` +
          `${formatDate(report?.Date2, locale)}`
      },
      {
        label: t("Common.Warehouse", "Склад"),
        value: report?.["Склад"] || "—"
      },
      {
        label: t(
          "CardsSirya.Report.OpeningBalance",
          "Сальдо на начало"
        ),
        value: formatNumber(report?.Saldo, locale)
      },
      {
        label: t(
          "CardsSirya.Report.ClosingBalance",
          "Сальдо на конец"
        ),
        value: formatNumber(report?.Rest, locale)
      }
    ],
    columns: [
      {
        key: "Shift",
        title: t("CardsSirya.Report.Shift", "Смена"),
        type: "text",
        width: 15
      },
      {
        key: "Time",
        title: t("Common.Time", "Время"),
        type: "text",
        width: 10
      },
      {
        key: "Document",
        title: t("CardsSirya.Report.Document", "Документ"),
        type: "text",
        width: 16
      },
      {
        key: "Operation",
        title: t(
          "CardsSirya.Report.Operation",
          "Операция / сотрудник"
        ),
        type: "text",
        width: 26
      },
      {
        key: "Description",
        title: t("CardsSirya.Report.Description", "Наименование"),
        type: "text",
        width: 38
      },
      {
        key: "Quantity",
        title: t("Common.Quantity", "Количество"),
        type: "number",
        decimals: 3,
        width: 15
      }
    ],
    rows: exportRows,
    footerRows: [
      {
        label: t(
          "CardsSirya.Report.PeriodTotal",
          "Итого за период"
        ),
        values: {
          Quantity: sumBy(oborot, "Kolvo")
        }
      }
    ]
  };
}

function buildCardsSiryaInDishesExportModel(report, t, locale) {
  const simpleDishes = Array.isArray(report?.Prostie)
    ? report.Prostie
    : [];
  const complexDishes = Array.isArray(report?.Slognie)
    ? report.Slognie
    : [];

  return {
    layout: "twoColumns",
    title: `${t(
      "CardsSirya.RawInDishes",
      "Сырье в блюдах"
    )}: ${report?.["Товар"] || ""}`.replace(/:\s*$/, ""),
    fileName:
      `CardsSirya_InDishes_${safeReportFilePart(
        report?.["Товар"],
        "raw"
      )}`,
    orientation: "landscape",
    locale,
    meta: [],
    groups: [
      {
        title: "",
        left: {
          title: t(
            "CardsSirya.Report.SimpleDishes",
            "Простые блюда"
          ),
          columns: [
            {
              key: "Dish",
              title: t("CardsSirya.Report.Dish", "Блюдо"),
              type: "text",
              width: 38
            },
            {
              key: "Group",
              title: t("CardsSirya.Report.DishGroup", "Группа"),
              type: "text",
              width: 26
            },
            {
              key: "Warehouse",
              title: t("Common.Warehouse", "Склад"),
              type: "text",
              width: 22
            },
            {
              key: "Quantity",
              title: t("Common.Quantity", "Количество"),
              type: "number",
              decimals: 3,
              width: 15
            }
          ],
          rows: simpleDishes.map((row) => ({
            Dish: row.NameDish || "",
            Group: row.NazvGroup || "",
            Warehouse: row.Sklad || "",
            Quantity: Number(row.Kolvo || 0)
          })),
          footerRows: []
        },
        right: {
          title: t(
            "CardsSirya.Report.ComplexDishes",
            "Сложные блюда (через полуфабрикат)"
          ),
          columns: [
            {
              key: "Dish",
              title: t("CardsSirya.Report.Dish", "Блюдо"),
              type: "text",
              width: 42
            },
            {
              key: "Warehouse",
              title: t("Common.Warehouse", "Склад"),
              type: "text",
              width: 25
            },
            {
              key: "Quantity",
              title: t("Common.Quantity", "Количество"),
              type: "number",
              decimals: 3,
              width: 15
            },
            {
              key: "Hidden",
              title: t("CardsSirya.Report.Hidden", "Скрыто"),
              type: "text",
              width: 12
            }
          ],
          rows: complexDishes.map((row) => ({
            Dish: row.MameDish || row.NameDish || "",
            Warehouse: row.Sklad || "",
            Quantity: Number(row.Kolvo || 0),
            Hidden: row.Skr
              ? t("Common.Yes", "Да")
              : t("Common.No", "Нет")
          })),
          footerRows: []
        },
        summary: []
      }
    ]
  };
}

function buildCardsSiryaExportModel(
  report,
  reportType,
  t,
  locale
) {
  if (reportType === "turnover") {
    return buildCardsSiryaTurnoverExportModel(report, t, locale);
  }

  if (reportType === "inDishes") {
    return buildCardsSiryaInDishesExportModel(report, t, locale);
  }

  return buildCardsSiryaCardExportModel(
    report,
    reportType === "summary",
    t,
    locale
  );
}

function EmptyReportSection({ children }) {
  return <div className="cards-sirya-report-empty">{children}</div>;
}

function ReportSection({ title, children }) {
  return (
    <section className="cards-sirya-report-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function CardsSiryaReport({
  report,
  onBack,
  onOpenIncomingInvoice,
  onOpenSaleInvoice,
  onExport,
  exportLoading,
  locale,
  isSummary = false,
  t
}) {
  const prihod = useMemo(
    () =>
      (Array.isArray(report?.Prihod) ? report.Prihod : [])
        .slice()
        .sort((left, right) =>
          compareReportDates(left?.DateP, right?.DateP)
        ),
    [report?.Prihod]
  );
  const rashod = useMemo(
    () =>
      (Array.isArray(report?.Rashod) ? report.Rashod : [])
        .slice()
        .sort((left, right) =>
          compareReportDates(left?.DateReal, right?.DateReal)
        ),
    [report?.Rashod]
  );
  const spisanie = useMemo(
    () =>
      (Array.isArray(report?.Spisanie) ? report.Spisanie : [])
        .slice()
        .sort((left, right) =>
          compareReportDates(left?.DateSpis, right?.DateSpis)
        ),
    [report?.Spisanie]
  );

  const prihodTotal = useMemo(() => sumBy(prihod, "Postup"), [prihod]);
  const rashodTotal = useMemo(() => sumBy(rashod, "Kolvo"), [rashod]);
  const spisanieTotal = useMemo(
    () => sumBy(spisanie, "Списано"),
    [spisanie]
  );

  return (
    <div className="cards-sirya-report-page">
      <div className="module-toolbar cards-sirya-report-toolbar no-print">
        <div className="toolbar-left">
          <button type="button" className="toolbar-button" onClick={onBack}>
            {t("Common.Back", "Назад")}
          </button>
        </div>

        <div className="toolbar-right cards-sirya-report-actions">
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

      <article className="cards-sirya-report-sheet">
        <header
          className="cards-sirya-report-header"
          style={isSummary ? { gridTemplateColumns: "1fr" } : undefined}
        >
          <div>
            <div className="cards-sirya-report-kicker">
              {isSummary
                ? t("CardsSirya.SummaryCard", "Карточка сводная")
                : t("CardsSirya.Report.RawMaterialCard", "Карточка сырья")}
            </div>
            <h1>{report?.["Товар"] || "—"}</h1>
            <div className="cards-sirya-report-period">
              {t("Common.Period", "Период")}: {formatDate(report?.Date1, locale)} — {formatDate(report?.Date2, locale)}
            </div>
          </div>

          {!isSummary && (
            <div className="cards-sirya-report-meta">
              <div>
                <span>{t("Common.Warehouse", "Склад")}</span>
                <strong>{report?.["Склад"] || "—"}</strong>
              </div>
              <div>
                <span>{t("CardsSirya.Report.OpeningBalance", "Сальдо на начало")}</span>
                <strong>{formatNumber(report?.Saldo, locale)}</strong>
              </div>
              <div>
                <span>{t("CardsSirya.Report.ClosingBalance", "Сальдо на конец")}</span>
                <strong>{formatNumber(report?.Rest, locale)}</strong>
              </div>
            </div>
          )}
        </header>

        <ReportSection title={t("CardsSirya.Report.Receipts", "Приходные накладные")}>
          {prihod.length === 0 ? (
            <EmptyReportSection>
              {t("CardsSirya.Report.NoReceipts", "За выбранный период приходов не было.")}
            </EmptyReportSection>
          ) : (
            <div className="cards-sirya-report-table-wrap">
              <table className="cards-sirya-report-table cards-sirya-report-table-prihod">
                <thead>
                  <tr>
                    <th>{t("Common.Date", "Дата")}</th>
                    <th>{t("CardsSirya.Report.Supplier", "Поставщик / склад")}</th>
                    <th>{t("CardsSirya.Report.Invoice", "Накладная")}</th>
                    <th className="num">{t("Common.Quantity", "Количество")}</th>
                    <th className="num">{t("Common.Price", "Цена")}</th>
                    <th className="num">{t("CardsSirya.Report.AveragePrice", "Ср. цена")}</th>
                    <th>{t("CardsSirya.Report.Payment", "Оплата")}</th>
                  </tr>
                </thead>
                <tbody>
                  {prihod.map((row, index) => {
                    const canOpen = typeof onOpenIncomingInvoice === "function" && row.IdInvoice;

                    return (
                      <tr
                        key={`${row.IdInvoice ?? "prihod"}-${index}`}
                        className={canOpen ? "report-link-row" : ""}
                        onDoubleClick={
                          canOpen
                            ? () => onOpenIncomingInvoice(row.IdInvoice, row)
                            : undefined
                        }
                        title={
                          canOpen
                            ? t("CardsSirya.Report.OpenInvoiceHint", "Двойной щелчок — открыть накладную")
                            : undefined
                        }
                      >
                        <td>{formatDate(row.DateP, locale)}</td>
                        <td>{row.SkladFrom || row.Postav || "—"}</td>
                        <td>
                          {canOpen ? (
                            <button
                              type="button"
                              className="report-document-link no-print"
                              onClick={() => onOpenIncomingInvoice(row.IdInvoice, row)}
                            >
                              {row.Invoice || row.IdInvoice}
                            </button>
                          ) : (
                            row.Invoice || "—"
                          )}
                          {canOpen && (
                            <span className="print-only">{row.Invoice || row.IdInvoice}</span>
                          )}
                        </td>
                        <td className="num">{formatNumber(row.Postup, locale)}</td>
                        <td className="num">{formatMoney(row.Price, locale)}</td>
                        <td className="num">{formatMoney(row.PriceAvg, locale)}</td>
                        <td>{row.Valut || row.Valuts || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan="3">{t("Common.Total", "Итого")}</td>
                    <td className="num">{formatNumber(prihodTotal, locale)}</td>
                    <td colSpan="3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </ReportSection>

        <ReportSection title={t("CardsSirya.Report.Consumption", "Расход сырья через блюда")}>
          {rashod.length === 0 ? (
            <EmptyReportSection>
              {t("CardsSirya.Report.NoConsumption", "За выбранный период расхода через блюда не было.")}
            </EmptyReportSection>
          ) : (
            <div className="cards-sirya-report-table-wrap">
              <table className="cards-sirya-report-table cards-sirya-report-table-rashod">
                <thead>
                  <tr>
                    <th>{t("Common.DateTime", "Дата и время")}</th>
                    <th>{t("CardsSirya.Report.Waiter", "Официант")}</th>
                    <th>{t("CardsSirya.Report.Dish", "Блюдо")}</th>
                    <th className="num">{t("CardsSirya.Report.DishQuantity", "Продано блюд")}</th>
                    <th className="num">{t("CardsSirya.Report.RawQuantity", "Расход сырья")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rashod.map((row, index) => {
                    const canOpen = typeof onOpenSaleInvoice === "function" && row.InvCode;

                    return (
                      <tr
                        key={`${row.InvCode ?? "rashod"}-${index}`}
                        className={canOpen ? "report-link-row" : ""}
                        onDoubleClick={
                          canOpen
                            ? () => onOpenSaleInvoice(row.InvCode, row)
                            : undefined
                        }
                        title={
                          canOpen
                            ? t("CardsSirya.Report.OpenSaleHint", "Двойной щелчок — открыть реализацию")
                            : undefined
                        }
                      >
                        <td>{formatDate(row.DateReal, locale, true)}</td>
                        <td>{row.Waiter || "—"}</td>
                        <td>{row.NameDish || "—"}</td>
                        <td className="num">{formatNumber(row.Qty, locale, 2)}</td>
                        <td className="num">{formatNumber(row.Kolvo, locale)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan="4">{t("Common.Total", "Итого")}</td>
                    <td className="num">{formatNumber(rashodTotal, locale)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </ReportSection>

        <ReportSection title={t("CardsSirya.Report.WriteOffs", "Прямые списания сырья")}>
          {spisanie.length === 0 ? (
            <EmptyReportSection>
              {t("CardsSirya.Report.NoWriteOffs", "За выбранный период прямых списаний не было.")}
            </EmptyReportSection>
          ) : (
            <div className="cards-sirya-report-table-wrap cards-sirya-report-table-wrap-small">
              <table className="cards-sirya-report-table cards-sirya-report-table-spisanie">
                <thead>
                  <tr>
                    <th>{t("Common.Date", "Дата")}</th>
                    <th>{t("CardsSirya.Report.Reason", "Причина")}</th>
                    <th className="num">{t("CardsSirya.Report.WrittenOff", "Списано")}</th>
                  </tr>
                </thead>
                <tbody>
                  {spisanie.map((row, index) => (
                    <tr key={`${row.IDtov ?? "spisanie"}-${row.DateSpis ?? index}-${index}`}>
                      <td>{formatDate(row.DateSpis, locale)}</td>
                      <td>{row.Name || "—"}</td>
                      <td className="num">{formatNumber(row["Списано"], locale)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan="2">{t("Common.Total", "Итого")}</td>
                    <td className="num">{formatNumber(spisanieTotal, locale)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </ReportSection>
      </article>
    </div>
  );
}

function CardsSiryaTurnoverReport({
  report,
  onBack,
  onOpenTurnoverDocument,
  onExport,
  exportLoading,
  locale,
  t
}) {
  const oborot = Array.isArray(report?.Oborot) ? report.Oborot : [];

  const dayGroups = useMemo(() => {
    const sortedRows = [...oborot].sort((left, right) =>
      compareReportDates(
        left?.DateAndTime ?? left?.Smena,
        right?.DateAndTime ?? right?.Smena
      )
    );

    const groups = [];
    let runningBalance = Number(report?.Saldo ?? 0);

    for (const row of sortedRows) {
      const dayKey = String(row?.Smena ?? "").slice(0, 10) || "unknown";
      let group = groups[groups.length - 1];

      if (!group || group.key !== dayKey) {
        group = {
          key: dayKey,
          date: row?.Smena || row?.DateAndTime || "",
          rows: [],
          total: 0,
          closingBalance: runningBalance
        };
        groups.push(group);
      }

      const quantity = Number(row?.Kolvo ?? 0);
      group.rows.push(row);
      group.total += Number.isFinite(quantity) ? quantity : 0;
    }

    for (const group of groups) {
      runningBalance += group.total;
      group.closingBalance = runningBalance;
    }

    return groups;
  }, [oborot, report?.Saldo]);

  const periodTotal = useMemo(
    () => dayGroups.reduce((sum, group) => sum + group.total, 0),
    [dayGroups]
  );

  const calculatedRest = Number(report?.Saldo ?? 0) + periodTotal;

  return (
    <div className="cards-sirya-report-page">
      <div className="module-toolbar cards-sirya-report-toolbar no-print">
        <div className="toolbar-left">
          <button type="button" className="toolbar-button" onClick={onBack}>
            {t("Common.Back", "Назад")}
          </button>
        </div>

        <div className="toolbar-right cards-sirya-report-actions">
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

      <article className="cards-sirya-report-sheet">
        <header className="cards-sirya-report-header">
          <div>
            <div className="cards-sirya-report-kicker">
              {t("CardsSirya.Report.RawMaterialTurnover", "Обороты сырья")}
            </div>
            <h1>{report?.["Товар"] || "—"}</h1>
            <div className="cards-sirya-report-period">
              {t("Common.Period", "Период")}: {formatDate(report?.Date1, locale)} — {formatDate(report?.Date2, locale)}
            </div>
          </div>

          <div className="cards-sirya-report-meta">
            <div>
              <span>{t("Common.Warehouse", "Склад")}</span>
              <strong>{report?.["Склад"] || "—"}</strong>
            </div>
            <div>
              <span>{t("CardsSirya.Report.OpeningBalance", "Сальдо на начало")}</span>
              <strong>{formatNumber(report?.Saldo, locale)}</strong>
            </div>
            <div>
              <span>{t("CardsSirya.Report.ClosingBalance", "Сальдо на конец")}</span>
              <strong>{formatNumber(report?.Rest, locale)}</strong>
            </div>
          </div>
        </header>

        <ReportSection title={t("CardsSirya.Report.TurnoverMovements", "Движение сырья")}> 
          {oborot.length === 0 ? (
            <EmptyReportSection>
              {t("CardsSirya.Report.NoTurnover", "За выбранный период движений не было.")}
            </EmptyReportSection>
          ) : (
            <div className="cards-sirya-report-table-wrap">
              <table className="cards-sirya-report-table cards-sirya-report-table-oborot">
                <thead>
                  <tr>
                    <th>{t("Common.Time", "Время")}</th>
                    <th>{t("CardsSirya.Report.Document", "Документ")}</th>
                    <th>{t("CardsSirya.Report.Operation", "Операция / сотрудник")}</th>
                    <th>{t("CardsSirya.Report.Description", "Наименование")}</th>
                    <th className="num">{t("Common.Quantity", "Количество")}</th>
                    <th className="num">{t("CardsSirya.Report.Balance", "Остаток")}</th>
                  </tr>
                </thead>

                <tbody>
                  <tr className="cards-sirya-report-opening-row">
                    <td colSpan="5">
                      {t("CardsSirya.Report.OpeningBalance", "Сальдо на начало")}
                    </td>
                    <td className="num">{formatNumber(report?.Saldo, locale)}</td>
                  </tr>

                  {dayGroups.map((group) => (
                    <Fragment key={group.key}>
                      <tr className="cards-sirya-report-day-header" key={`${group.key}-header`}>
                        <td colSpan="6">
                          {t("CardsSirya.Report.Shift", "Смена")}: {formatDate(group.date, locale)}
                        </td>
                      </tr>

                      {group.rows.map((row, index) => {
                        const canOpen =
                          typeof onOpenTurnoverDocument === "function" &&
                          row.IdReal;

                        return (
                          <tr
                            key={`${group.key}-${row.IdReal ?? row.Nomer ?? index}-${index}`}
                            className={canOpen ? "report-link-row" : ""}
                            onDoubleClick={
                              canOpen
                                ? () => onOpenTurnoverDocument(row.IdReal, row)
                                : undefined
                            }
                          >
                            <td>{formatTime(row.DateAndTime, locale)}</td>
                            <td>{row.Nomer || "—"}</td>
                            <td>{row.Waiter || "—"}</td>
                            <td>{row.Name || "—"}</td>
                            <td className="num">{formatNumber(row.Kolvo, locale)}</td>
                            <td className="num" />
                          </tr>
                        );
                      })}

                      <tr className="cards-sirya-report-day-total" key={`${group.key}-total`}>
                        <td colSpan="4">
                          {t("CardsSirya.Report.DayTotal", "Итого за день")}
                        </td>
                        <td className="num">{formatNumber(group.total, locale)}</td>
                        <td className="num">{formatNumber(group.closingBalance, locale)}</td>
                      </tr>
                    </Fragment>
                  ))}

                  <tr className="cards-sirya-report-period-total">
                    <td colSpan="4">{t("CardsSirya.Report.PeriodTotal", "Итого за период")}</td>
                    <td className="num">{formatNumber(periodTotal, locale)}</td>
                    <td className="num">{formatNumber(calculatedRest, locale)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </ReportSection>
      </article>
    </div>
  );
}


function CardsSiryaInDishesReport({
  report,
  onBack,
  onExport,
  exportLoading,
  locale,
  t
}) {
  const simpleDishes = Array.isArray(report?.Prostie) ? report.Prostie : [];
  const complexDishes = Array.isArray(report?.Slognie) ? report.Slognie : [];

  return (
    <div className="cards-sirya-report-page">
      <div className="module-toolbar cards-sirya-report-toolbar no-print">
        <div className="toolbar-left">
          <button type="button" className="toolbar-button" onClick={onBack}>
            {t("Common.Back", "Назад")}
          </button>
        </div>

        <div className="toolbar-right cards-sirya-report-actions">
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

      <article className="cards-sirya-report-sheet cards-sirya-in-dishes-sheet">
        <header className="cards-sirya-report-header cards-sirya-report-header-simple">
          <div>
            <div className="cards-sirya-report-kicker">
              {t("CardsSirya.RawInDishes", "Сырье в блюдах")}
            </div>
            <h1>{report?.["Товар"] || "—"}</h1>
          </div>
        </header>

        <div className="cards-sirya-in-dishes-columns">
          <ReportSection
            title={t("CardsSirya.Report.SimpleDishes", "Простые блюда")}
          >
            {simpleDishes.length === 0 ? (
              <EmptyReportSection>
                {t(
                  "CardsSirya.Report.NoSimpleDishes",
                  "Сырье не входит напрямую ни в одно блюдо."
                )}
              </EmptyReportSection>
            ) : (
              <div className="cards-sirya-report-table-wrap">
                <table className="cards-sirya-report-table cards-sirya-report-table-in-dishes">
                  <thead>
                    <tr>
                      <th>{t("CardsSirya.Report.Dish", "Блюдо")}</th>
                      <th>{t("CardsSirya.Report.DishGroup", "Группа")}</th>
                      <th>{t("Common.Warehouse", "Склад")}</th>
                      <th className="num">{t("Common.Quantity", "Количество")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {simpleDishes.map((row, index) => (
                      <tr key={`${row.IdCalc ?? "simple"}-${index}`}>
                        <td>{row.NameDish || "—"}</td>
                        <td>{row.NazvGroup || "—"}</td>
                        <td>{row.Sklad || "—"}</td>
                        <td className="num">
                          {formatNumber(row.Kolvo, locale)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ReportSection>

          <ReportSection
            title={t(
              "CardsSirya.Report.ComplexDishes",
              "Сложные блюда (через полуфабрикат)"
            )}
          >
            {complexDishes.length === 0 ? (
              <EmptyReportSection>
                {t(
                  "CardsSirya.Report.NoComplexDishes",
                  "Сырье не входит в блюда через полуфабрикаты."
                )}
              </EmptyReportSection>
            ) : (
              <div className="cards-sirya-report-table-wrap">
                <table className="cards-sirya-report-table cards-sirya-report-table-in-dishes cards-sirya-report-table-in-dishes-complex">
                  <thead>
                    <tr>
                      <th>{t("CardsSirya.Report.Dish", "Блюдо")}</th>
                      <th>{t("Common.Warehouse", "Склад")}</th>
                      <th className="num">{t("Common.Quantity", "Количество")}</th>
                      <th className="checkbox-cell">
                        {t("CardsSirya.Report.Hidden", "Скрыто")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {complexDishes.map((row, index) => (
                      <tr key={`${row.IdCalc ?? "complex"}-${index}`}>
                        <td>{row.MameDish || row.NameDish || "—"}</td>
                        <td>{row.Sklad || "—"}</td>
                        <td className="num">
                          {formatNumber(row.Kolvo, locale)}
                        </td>
                        <td className="checkbox-cell">
                          <input
                            type="checkbox"
                            className="cards-sirya-report-checkbox"
                            checked={Boolean(row.Skr)}
                            readOnly
                            tabIndex={-1}
                            aria-label={t("CardsSirya.Report.Hidden", "Скрыто")}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ReportSection>
        </div>
      </article>
    </div>
  );
}

export default function CardsSiryaPage({
  data,
  categories,
  filterCat,
  onChangeCat,
  onApply,
  fetchWithAuth,
  accessToken,
  apiBaseUrl = DEFAULT_API_BASE_URL,
  sklad,
  org,
  dateFrom,
  dateTo,
  language = "ru",
  locale = "ru-RU",
  onOpenIncomingInvoice,
  onOpenSaleInvoice,
  onOpenTurnoverDocument,
  t = (key, fallback = "") => fallback
}) {
  const rows = Array.isArray(data) ? data : [];
  const categoryList = Array.isArray(categories) ? categories : [];

  const [selectedId, setSelectedId] = useState(null);
  const [report, setReport] = useState(null);
  const [reportType, setReportType] = useState("");
  const [reportLoadingType, setReportLoadingType] = useState("");
  const [reportError, setReportError] = useState("");
  const [reportExportLoading, setReportExportLoading] = useState(false);

  const tableWrapRef = useRef(null);
  const selectedRowRef = useRef(null);
  const restoreSelectionAfterReportRef = useRef(false);

  const reportLoading = Boolean(reportLoadingType);

  const selectedRow = useMemo(
    () => rows.find((row) => String(row.ID) === String(selectedId)) ?? null,
    [rows, selectedId]
  );

  useEffect(() => {
    if (
      report ||
      !selectedId ||
      !restoreSelectionAfterReportRef.current
    ) {
      return;
    }

    const selectedExists = rows.some(
      (row) => String(row.ID) === String(selectedId)
    );

    if (!selectedExists) {
      restoreSelectionAfterReportRef.current = false;
      return;
    }

    let firstFrame = 0;
    let secondFrame = 0;

    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        const tableWrap = tableWrapRef.current;
        const selectedRowElement = selectedRowRef.current;

        if (tableWrap && selectedRowElement) {
          const targetScrollTop =
            selectedRowElement.offsetTop -
            (tableWrap.clientHeight - selectedRowElement.offsetHeight) / 2;

          tableWrap.scrollTop = Math.max(0, targetScrollTop);
        }

        restoreSelectionAfterReportRef.current = false;
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [report, rows, selectedId]);

  // Обе активные кнопки доступны только после выбора строки
  // и блокируются на время выполнения любого отчётного запроса.
  const canOpenSelectedReport = Boolean(selectedRow) && !reportLoading;

  function focusRawMaterialRow(rawMaterialId) {
    window.requestAnimationFrame(() => {
      const row = tableWrapRef.current?.querySelector(
        `[data-raw-material-id="${String(rawMaterialId ?? "")}"]`
      );

      if (!(row instanceof HTMLElement)) return;

      row.focus({ preventScroll: true });
      row.scrollIntoView({
        block: "nearest",
        inline: "nearest"
      });
    });
  }

  function handleRawMaterialRowKeyDown(event, rawMaterialId) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    const currentIndex = rows.findIndex(
      (row) => String(row.ID) === String(rawMaterialId)
    );

    if (currentIndex < 0) return;

    // Стрелки работают по основному списку карточек сырья.
    // На границе списка не отдаём событие браузеру, чтобы не прокручивать экран.
    event.preventDefault();

    const direction = event.key === "ArrowDown" ? 1 : -1;
    const nextRow = rows[currentIndex + direction];

    if (!nextRow) return;

    setSelectedId(nextRow.ID);
    setReportError("");
    focusRawMaterialRow(nextRow.ID);
  }

  async function openReport(
    endpoint,
    nextReportType,
    {
      includeSklad = true,
      includePeriod = true,
      includeLanguage = true,
      includeOrganization = false
    } = {}
  ) {
    if (!selectedRow || reportLoading) return;

    const rawMaterialId = selectedRow.ID;
    const d1 = formatDateForApi(dateFrom);
    const d2 = formatDateForApi(dateTo);

    if (!rawMaterialId) {
      setReportError(
        t("CardsSirya.Report.RawMaterialRequired", "Не выбрана строка сырья.")
      );
      return;
    }

    if (includeSklad && !sklad) {
      setReportError(
        t("CardsSirya.Report.WarehouseRequired", "Не выбран склад.")
      );
      return;
    }

    if (includePeriod && (!d1 || !d2)) {
      setReportError(
        t("CardsSirya.Report.PeriodRequired", "Не выбран период отчёта.")
      );
      return;
    }

    const url = new URL(
      `${normalizeApiBaseUrl(apiBaseUrl)}/${endpoint}`
    );

    if (includeSklad) {
      url.searchParams.set("Sklad", String(sklad));
    }

    if (includePeriod) {
      url.searchParams.set("d1", d1);
      url.searchParams.set("d2", d2);
    }

    if (includeLanguage) {
      url.searchParams.set("Lang", String(language || "ru"));
    }

    if (includeOrganization) {
      // Org = 0 означает выборку по всем организациям.
      url.searchParams.set("Org", String(org ?? 0));
    }

    url.searchParams.set("Tov", String(rawMaterialId));

    setReportLoadingType(nextReportType);
    setReportError("");

    try {
      const requestOptions = {
        method: "GET",
        headers: {
          Accept: "application/json"
        }
      };

      const response = typeof fetchWithAuth === "function"
        ? await fetchWithAuth(url.toString(), requestOptions)
        : await fetch(url.toString(), {
            ...requestOptions,
            credentials: "include",
            headers: {
              ...requestOptions.headers,
              ...(accessToken
                ? { Authorization: `Bearer ${accessToken}` }
                : {})
            }
          });

      const responseText = await response.text();
      let payload;

      try {
        payload = responseText ? JSON.parse(responseText) : null;
      } catch {
        throw new Error(
          responseText ||
            t("Common.InvalidServerResponse", "Сервер вернул некорректный ответ.")
        );
      }

      if (!response.ok) {
        throw new Error(
          payload?.message ||
            payload?.error ||
            `${t("Common.ServerError", "Ошибка сервера")}: ${response.status}`
        );
      }

      const reportObject = Array.isArray(payload) ? payload[0] : payload;

      if (!reportObject || typeof reportObject !== "object") {
        throw new Error(
          t("CardsSirya.Report.EmptyResponse", "Отчёт не вернул данные.")
        );
      }

      const normalizedReport = {
        ...reportObject,
        // Некоторые сводные методы не возвращают название сырья.
        // В таком случае берём его из выбранной строки карточек.
        "Товар": reportObject["Товар"] || selectedRow.Name || ""
      };

      setReportType(nextReportType);
      setReport(normalizedReport);
    } catch (error) {
      setReportError(
        error instanceof Error
          ? error.message
          : t("Common.LoadError", "Не удалось загрузить отчёт.")
      );
    } finally {
      setReportLoadingType("");
    }
  }

  function openCardReport() {
    return openReport("wr_CardsSirya.php", "card");
  }

  function openTurnoverReport() {
    return openReport("wr_CardsOborot.php", "turnover");
  }

  function openInDishesReport() {
    return openReport("wr_CardsInDish.php", "inDishes", {
      includeSklad: false,
      includePeriod: false,
      includeLanguage: false,
      includeOrganization: true
    });
  }

  function openSummaryReport() {
    return openReport("wr_CardsSvod.php", "summary", {
      includeSklad: false,
      includePeriod: true,
      includeLanguage: false,
      includeOrganization: false
    });
  }


  async function exportCurrentReport(format) {
    if (
      !report ||
      !reportType ||
      reportExportLoading ||
      reportLoading
    ) {
      return;
    }

    const reportModel = buildCardsSiryaExportModel(
      report,
      reportType,
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
    } catch (error) {
      window.alert(
        error?.message ||
          t("Report.ExportError", "Ошибка экспорта отчёта.")
      );
    } finally {
      setReportExportLoading(false);
    }
  }

  if (report) {
    const handleBackFromReport = () => {
      restoreSelectionAfterReportRef.current = true;
      setReport(null);
      setReportType("");
      setReportExportLoading(false);
    };

    if (reportType === "turnover") {
      return (
        <CardsSiryaTurnoverReport
          report={report}
          onBack={handleBackFromReport}
          onOpenTurnoverDocument={onOpenTurnoverDocument}
          onExport={exportCurrentReport}
          exportLoading={reportExportLoading}
          locale={locale}
          t={t}
        />
      );
    }

    if (reportType === "inDishes") {
      return (
        <CardsSiryaInDishesReport
          report={report}
          onBack={handleBackFromReport}
          onExport={exportCurrentReport}
          exportLoading={reportExportLoading}
          locale={locale}
          t={t}
        />
      );
    }

    return (
      <CardsSiryaReport
        report={report}
        onBack={handleBackFromReport}
        onOpenIncomingInvoice={onOpenIncomingInvoice}
        onOpenSaleInvoice={onOpenSaleInvoice}
        onExport={exportCurrentReport}
        exportLoading={reportExportLoading}
        locale={locale}
        isSummary={reportType === "summary"}
        t={t}
      />
    );
  }

  return (
    <div className="cards-sirya-page">
      <div className="module-toolbar cards-sirya-toolbar">
        <div className="toolbar-left">
          <label className="toolbar-field">
            <span>{t("CardsSirya.Category", "Категория")}</span>

            <select
              className="toolbar-select"
              value={String(filterCat ?? "0")}
              onChange={(event) => {
                const nextCategory = event.target.value;

                onChangeCat?.(nextCategory);
                onApply?.(nextCategory);
              }}
            >
              <option value="0">{t("CardsSirya.All", "Все")}</option>

              {categoryList.map((category) => (
                <option key={category.ID} value={String(category.ID)}>
                  {category.Name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="toolbar-right cards-sirya-report-buttons">
          <button
            type="button"
            className="toolbar-button primary"
            disabled={!canOpenSelectedReport}
            onClick={openCardReport}
          >
            {reportLoadingType === "card"
              ? t("Common.Loading", "Загрузка…")
              : t("CardsSirya.Card", "Карточка")}
          </button>

          <button
            type="button"
            className="toolbar-button"
            disabled={!canOpenSelectedReport}
            onClick={openTurnoverReport}
          >
            {reportLoadingType === "turnover"
              ? t("Common.Loading", "Загрузка…")
              : t("CardsSirya.Turnover", "Обороты")}
          </button>

          <button
            type="button"
            className="toolbar-button"
            disabled={!canOpenSelectedReport}
            onClick={openInDishesReport}
          >
            {reportLoadingType === "inDishes"
              ? t("Common.Loading", "Загрузка…")
              : t("CardsSirya.RawInDishes", "Сырье в блюдах")}
          </button>

          <button
            type="button"
            className="toolbar-button"
            disabled={!canOpenSelectedReport}
            onClick={openSummaryReport}
          >
            {reportLoadingType === "summary"
              ? t("Common.Loading", "Загрузка…")
              : t("CardsSirya.SummaryCard", "Карточка сводная")}
          </button>
        </div>
      </div>

      {reportError && (
        <div className="cards-sirya-report-error">{reportError}</div>
      )}

      {rows.length === 0 && (
        <div className="cards-sirya-empty">
          {t("CardsSirya.EmptyList", "Карточки сырья не найдены.")}
        </div>
      )}

      {rows.length > 0 && (
        <section className="cards-sirya-table-panel">
          <div
              ref={tableWrapRef}
              className="table-wrap cards-sirya-table-wrap"
            >
            <table className="data-table cards-sirya-table">
              <colgroup>
                <col className="cards-sirya-col-name" />
                <col className="cards-sirya-col-unit" />
                <col className="cards-sirya-col-price" />
                <col className="cards-sirya-col-last-price" />
                <col className="cards-sirya-col-category" />
              </colgroup>

              <thead>
                <tr>
                  <th>{t("CardsSirya.Name", "Наименование")}</th>
                  <th>{t("CardsSirya.UnitShort", "Ед.")}</th>
                  <th>{t("CardsSirya.Price", "Цена")}</th>
                  <th>{t("CardsSirya.LastPrice", "Последняя цена")}</th>
                  <th>{t("CardsSirya.Category", "Категория")}</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.ID}
                    ref={
                      String(selectedId) === String(row.ID)
                        ? selectedRowRef
                        : null
                    }
                    data-raw-material-id={String(row.ID ?? "")}
                    className={
                      String(selectedId) === String(row.ID) ? "selected-row" : ""
                    }
                    tabIndex={
                      String(selectedId) === String(row.ID) ? 0 : -1
                    }
                    onKeyDown={(event) =>
                      handleRawMaterialRowKeyDown(event, row.ID)
                    }
                    onClick={(event) => {
                      setSelectedId(row.ID);
                      setReportError("");
                      event.currentTarget.focus({ preventScroll: true });
                    }}
                    onDoubleClick={() => {
                      setSelectedId(row.ID);
                    }}
                  >
                    <td title={row.Name ?? ""}>{row.Name}</td>
                    <td>{row.Ediz}</td>
                    <td className="num">{formatMoney(row.Price, locale)}</td>
                    <td className="num">{formatMoney(row.PriceLast)}</td>
                    <td title={row.Categor ?? ""}>{row.Categor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}