import { useEffect, useMemo, useRef, useState } from "react";
import { exportReportFile } from "./reportExport.js";
import "./kassa-report.css";

function formatMoney(value, locale = "ru-RU") {
  const num = Number(value || 0);

  return num.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDateForInput(value) {
  if (!value) return "";

  const text = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const match = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);

  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
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

function formatDateDisplay(value, locale = "ru-RU") {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(locale);
}

function formatDateForApi(value) {
  if (!value) return "";

  const text = String(value).trim();

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(text)) {
    return text;
  }

  const inputDate = formatDateForInput(text);

  if (!inputDate) {
    return text;
  }

  const [year, month, day] = inputDate.split("-");
  return `${day}.${month}.${year}`;
}

function getNameById(list, id) {
  const found = list.find((item) => Number(item.ID) === Number(id));
  return found?.Name || id || "";
}

function normalizeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function normalizeText(value) {
  return value == null ? "" : String(value);
}
function xmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function attrsToXml(attrs) {
  return Object.entries(attrs)
    .map(([key, value]) => `${key}="${xmlEscape(value)}"`)
    .join(" ");
}

function formatReportDateParam(value) {
  const inputDate = formatDateForInput(value);
  if (!inputDate) return String(value || "");

  const [year, month, day] = inputDate.split("-");
  return `${day}.${month}.${year.slice(-2)}`;
}

function formatReportDateDisplay(value, locale = "ru-RU") {
  const inputDate = formatDateForInput(value);
  if (!inputDate) return String(value || "");

  const [year, month, day] = inputDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat(locale).format(date);
}

function sumReportRows(rows) {
  return (Array.isArray(rows) ? rows : []).reduce(
    (sum, row) => sum + Number(row?.Summ || 0),
    0
  );
}

function ReportTable({
  rows,
  columns,
  totalLabel,
  emptyLabel,
  locale
}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const total = sumReportRows(safeRows);

  return (
    <div className="kassa-report-table-wrap">
      <table className="kassa-report-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={column.numeric ? "num" : ""}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {safeRows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="kassa-report-empty">
                {emptyLabel}
              </td>
            </tr>
          ) : (
            safeRows.map((row, index) => (
              <tr key={`${index}-${row?.Summ ?? ""}`}>
                {columns.map((column) => {
                  const value = column.render
                    ? column.render(row)
                    : row?.[column.key];

                  return (
                    <td
                      key={column.key}
                      className={column.numeric ? "num" : ""}
                    >
                      {column.numeric
                        ? formatMoney(value, locale)
                        : value == null || value === ""
                          ? "—"
                          : value}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={Math.max(columns.length - 1, 1)}>{totalLabel}</td>
            <td className="num">{formatMoney(total, locale)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function KassaReportHeader({ title, report, locale, t, extraMeta = null }) {
  return (
    <header className="kassa-report-header">
      <div className="kassa-report-heading">
        <div className="kassa-report-kicker">
          {t("KassaReport.CashReport", "Отчёт по кассе")}
        </div>
        <h1>{title}</h1>
      </div>

      <div className="kassa-report-meta">
        <div>
          <span>{t("KassaReport.Period", "Период")}</span>
          <strong>
            {formatReportDateDisplay(report?.FromDate, locale) || "—"}
            {" — "}
            {formatReportDateDisplay(report?.ToDate, locale) || "—"}
          </strong>
        </div>
        <div>
          <span>{t("KassaReport.PaymentType", "Тип оплаты")}</span>
          <strong>{report?.TipOpl || "—"}</strong>
        </div>
        {extraMeta}
      </div>
    </header>
  );
}

function KassaBriefReport({ report, locale, t, byArticles = false }) {
  const prih = Array.isArray(report?.Prihod) ? report.Prihod : [];
  const rashod = Array.isArray(report?.Rashod) ? report.Rashod : [];

  const prihColumns = byArticles
    ? [
        {
          key: "NamePrih",
          label: t("KassaReport.Category", "Статья"),
          render: (row) =>
            row?.NamePrih || t("KassaReport.Uncategorized", "Без статьи")
        },
        {
          key: "Summ",
          label: t("KassaReport.Amount", "Сумма"),
          numeric: true
        }
      ]
    : [
        {
          key: "NameFrom",
          label: t("KassaReport.Source", "От кого")
        },
        {
          key: "Summ",
          label: t("KassaReport.Amount", "Сумма"),
          numeric: true
        }
      ];

  const rashodColumns = byArticles
    ? [
        {
          key: "NameZatr",
          label: t("KassaReport.Category", "Статья"),
          render: (row) =>
            row?.NameZatr || t("KassaReport.Uncategorized", "Без статьи")
        },
        {
          key: "Summ",
          label: t("KassaReport.Amount", "Сумма"),
          numeric: true
        }
      ]
    : [
        {
          key: "NameTo",
          label: t("KassaReport.Recipient", "Кому")
        },
        {
          key: "Summ",
          label: t("KassaReport.Amount", "Сумма"),
          numeric: true
        }
      ];

  return (
    <>
      <KassaReportHeader
        title={
          byArticles
            ? t("KassaReport.BriefByArticlesTitle", "Касса — кратко по статьям")
            : t("KassaReport.BriefTitle", "Касса — кратко")
        }
        report={report}
        locale={locale}
        t={t}
      />

      <div className="kassa-report-two-columns">
        <section className="kassa-report-section">
          <h2>{t("KassaReport.Income", "Приход")}</h2>
          <ReportTable
            rows={prih}
            columns={prihColumns}
            totalLabel={t("KassaReport.Total", "Итого")}
            emptyLabel={t("KassaReport.NoData", "Нет данных")}
            locale={locale}
          />
        </section>

        <section className="kassa-report-section">
          <h2>{t("KassaReport.Expense", "Расход")}</h2>
          <ReportTable
            rows={rashod}
            columns={rashodColumns}
            totalLabel={t("KassaReport.Total", "Итого")}
            emptyLabel={t("KassaReport.NoData", "Нет данных")}
            locale={locale}
          />
        </section>
      </div>
    </>
  );
}

function KassaDaysReport({ report, locale, t }) {
  const dates = Array.isArray(report?.Dates) ? report.Dates : [];

  const daySummaries = useMemo(() => {
    let openingBalance = Number(report?.Sald0 || 0);

    return dates.map((day) => {
      const prihod = Array.isArray(day?.prihod) ? day.prihod : [];
      const rashod = Array.isArray(day?.rashod) ? day.rashod : [];
      const prihodTotal = sumReportRows(prihod);
      const rashodTotal = sumReportRows(rashod);
      const closingBalance = openingBalance + prihodTotal - rashodTotal;

      const summary = {
        day,
        prihod,
        rashod,
        openingBalance,
        prihodTotal,
        rashodTotal,
        closingBalance
      };

      openingBalance = closingBalance;
      return summary;
    });
  }, [dates, report?.Sald0]);

  return (
    <>
      <KassaReportHeader
        title={t("KassaReport.ByDaysTitle", "Касса — по дням")}
        report={report}
        locale={locale}
        t={t}
        extraMeta={
          <div>
            <span>{t("KassaReport.InitialBalance", "Сальдо начальное")}</span>
            <strong>{formatMoney(report?.Sald0, locale)}</strong>
          </div>
        }
      />

      <div className="kassa-report-days">
        {dates.length === 0 ? (
          <div className="kassa-report-empty-card">
            {t("KassaReport.NoData", "Нет данных")}
          </div>
        ) : (
          daySummaries.map((summary, dayIndex) => {
            const {
              day,
              prihod,
              rashod,
              openingBalance,
              closingBalance
            } = summary;

            return (
              <section
                className="kassa-report-day"
                key={`${day?.Date || "day"}-${dayIndex}`}
              >
                <h2>{formatReportDateDisplay(day?.Date, locale)}</h2>

                <div className="kassa-report-day-columns">
                  <div className="kassa-report-day-section">
                    <h3>{t("KassaReport.Income", "Приход")}</h3>
                    <ReportTable
                      rows={prihod}
                      columns={[
                        {
                          key: "Name",
                          label: t("KassaReport.Source", "От кого")
                        },
                        {
                          key: "StatyaPrih",
                          label: t("KassaReport.Category", "Статья"),
                          render: (row) =>
                            row?.StatyaPrih ||
                            t("KassaReport.Uncategorized", "Без статьи")
                        },
                        {
                          key: "Rem",
                          label: t("KassaReport.Note", "Примечание")
                        },
                        {
                          key: "Summ",
                          label: t("KassaReport.Amount", "Сумма"),
                          numeric: true
                        }
                      ]}
                      totalLabel={t("KassaReport.Total", "Итого")}
                      emptyLabel={t("KassaReport.NoData", "Нет данных")}
                      locale={locale}
                    />
                  </div>

                  <div className="kassa-report-day-section">
                    <h3>{t("KassaReport.Expense", "Расход")}</h3>
                    <ReportTable
                      rows={rashod}
                      columns={[
                        {
                          key: "Komu",
                          label: t("KassaReport.Recipient", "Кому")
                        },
                        {
                          key: "StatyaZatr",
                          label: t("KassaReport.Category", "Статья"),
                          render: (row) =>
                            row?.StatyaZatr ||
                            t("KassaReport.Uncategorized", "Без статьи")
                        },
                        {
                          key: "Rem",
                          label: t("KassaReport.Note", "Примечание")
                        },
                        {
                          key: "Summ",
                          label: t("KassaReport.Amount", "Сумма"),
                          numeric: true
                        }
                      ]}
                      totalLabel={t("KassaReport.Total", "Итого")}
                      emptyLabel={t("KassaReport.NoData", "Нет данных")}
                      locale={locale}
                    />
                  </div>
                </div>

                <div className="kassa-report-day-summary">
                  <div>
                    <span>{t("KassaReport.InitialBalance", "Сальдо на начало")}</span>
                    <strong>{formatMoney(openingBalance, locale)}</strong>
                  </div>
                  <div className="kassa-report-day-total">
                    <span>{t("KassaReport.DayTotal", "Итог дня")}</span>
                    <strong>{formatMoney(closingBalance, locale)}</strong>
                  </div>
                </div>
              </section>
            );
          })
        )}
      </div>
    </>
  );
}


function buildKassaBriefExportModel(report, kind, t, locale) {
  const prihod = Array.isArray(report?.Prihod) ? report.Prihod : [];
  const rashod = Array.isArray(report?.Rashod) ? report.Rashod : [];
  const byArticles = kind === "articles";

  const title = byArticles
    ? t(
        "KassaReport.BriefByArticlesTitle",
        "Касса — кратко по статьям"
      )
    : t("KassaReport.BriefTitle", "Касса — кратко");

  const leftNameTitle = byArticles
    ? t("KassaReport.Category", "Статья")
    : t("KassaReport.Source", "От кого");

  const rightNameTitle = byArticles
    ? t("KassaReport.Category", "Статья")
    : t("KassaReport.Recipient", "Кому");

  const leftRows = prihod.map((row) => ({
    Name: byArticles
      ? row?.NamePrih ||
        t("KassaReport.Uncategorized", "Без статьи")
      : row?.NameFrom || "",
    Amount: Number(row?.Summ || 0)
  }));

  const rightRows = rashod.map((row) => ({
    Name: byArticles
      ? row?.NameZatr ||
        t("KassaReport.Uncategorized", "Без статьи")
      : row?.NameTo || "",
    Amount: Number(row?.Summ || 0)
  }));

  return {
    layout: "twoColumns",
    title,
    fileName: `Kassa_${
      byArticles ? "BriefByArticles" : "Brief"
    }_${formatDateForInput(report?.FromDate) || "report"}_${
      formatDateForInput(report?.ToDate) || "report"
    }`,
    orientation: "portrait",
    locale,
    meta: [
      {
        label: t("KassaReport.Period", "Период"),
        value:
          `${formatReportDateDisplay(report?.FromDate, locale)} — ` +
          `${formatReportDateDisplay(report?.ToDate, locale)}`
      },
      {
        label: t("KassaReport.PaymentType", "Тип оплаты"),
        value: report?.TipOpl || "—"
      }
    ],
    groups: [
      {
        title: "",
        left: {
          title: t("KassaReport.Income", "Приход"),
          columns: [
            {
              key: "Name",
              title: leftNameTitle,
              type: "text",
              width: 38
            },
            {
              key: "Amount",
              title: t("KassaReport.Amount", "Сумма"),
              type: "number",
              decimals: 2,
              width: 16
            }
          ],
          rows: leftRows,
          footerRows: [
            {
              label: t("KassaReport.Total", "Итого"),
              values: {
                Amount: sumReportRows(prihod)
              }
            }
          ]
        },
        right: {
          title: t("KassaReport.Expense", "Расход"),
          columns: [
            {
              key: "Name",
              title: rightNameTitle,
              type: "text",
              width: 38
            },
            {
              key: "Amount",
              title: t("KassaReport.Amount", "Сумма"),
              type: "number",
              decimals: 2,
              width: 16
            }
          ],
          rows: rightRows,
          footerRows: [
            {
              label: t("KassaReport.Total", "Итого"),
              values: {
                Amount: sumReportRows(rashod)
              }
            }
          ]
        },
        summary: []
      }
    ]
  };
}

function buildKassaDaysExportModel(report, t, locale) {
  const dates = Array.isArray(report?.Dates) ? report.Dates : [];
  const groups = [];

  let openingBalance = Number(report?.Sald0 || 0);

  for (const day of dates) {
    const prihod = Array.isArray(day?.prihod) ? day.prihod : [];
    const rashod = Array.isArray(day?.rashod) ? day.rashod : [];

    const prihodTotal = sumReportRows(prihod);
    const rashodTotal = sumReportRows(rashod);
    const closingBalance =
      openingBalance + prihodTotal - rashodTotal;

    groups.push({
      title: formatReportDateDisplay(day?.Date, locale),
      left: {
        title: t("KassaReport.Income", "Приход"),
        columns: [
          {
            key: "Name",
            title: t("KassaReport.Source", "От кого"),
            type: "text",
            width: 26
          },
          {
            key: "Category",
            title: t("KassaReport.Category", "Статья"),
            type: "text",
            width: 24
          },
          {
            key: "Note",
            title: t("KassaReport.Note", "Примечание"),
            type: "text",
            width: 30
          },
          {
            key: "Amount",
            title: t("KassaReport.Amount", "Сумма"),
            type: "number",
            decimals: 2,
            width: 15
          }
        ],
        rows: prihod.map((row) => ({
          Name: row?.Name || "",
          Category:
            row?.StatyaPrih ||
            t("KassaReport.Uncategorized", "Без статьи"),
          Note: row?.Rem || "",
          Amount: Number(row?.Summ || 0)
        })),
        footerRows: [
          {
            label: t("KassaReport.Total", "Итого"),
            values: {
              Amount: prihodTotal
            }
          }
        ]
      },
      right: {
        title: t("KassaReport.Expense", "Расход"),
        columns: [
          {
            key: "Name",
            title: t("KassaReport.Recipient", "Кому"),
            type: "text",
            width: 26
          },
          {
            key: "Category",
            title: t("KassaReport.Category", "Статья"),
            type: "text",
            width: 24
          },
          {
            key: "Note",
            title: t("KassaReport.Note", "Примечание"),
            type: "text",
            width: 30
          },
          {
            key: "Amount",
            title: t("KassaReport.Amount", "Сумма"),
            type: "number",
            decimals: 2,
            width: 15
          }
        ],
        rows: rashod.map((row) => ({
          Name: row?.Komu || "",
          Category:
            row?.StatyaZatr ||
            t("KassaReport.Uncategorized", "Без статьи"),
          Note: row?.Rem || "",
          Amount: Number(row?.Summ || 0)
        })),
        footerRows: [
          {
            label: t("KassaReport.Total", "Итого"),
            values: {
              Amount: rashodTotal
            }
          }
        ]
      },
      summary: [
        {
          label: t(
            "KassaReport.InitialBalance",
            "Сальдо на начало"
          ),
          value: openingBalance,
          type: "number",
          decimals: 2
        },
        {
          label: t("KassaReport.DayTotal", "Итог дня"),
          value: closingBalance,
          type: "number",
          decimals: 2
        }
      ]
    });

    openingBalance = closingBalance;
  }

  return {
    layout: "twoColumns",
    title: t("KassaReport.ByDaysTitle", "Касса — по дням"),
    fileName:
      `Kassa_ByDays_${formatDateForInput(report?.FromDate) || "report"}_` +
      `${formatDateForInput(report?.ToDate) || "report"}`,
    orientation: "portrait",
    locale,
    meta: [
      {
        label: t("KassaReport.Period", "Период"),
        value:
          `${formatReportDateDisplay(report?.FromDate, locale)} — ` +
          `${formatReportDateDisplay(report?.ToDate, locale)}`
      },
      {
        label: t("KassaReport.PaymentType", "Тип оплаты"),
        value: report?.TipOpl || "—"
      },
      {
        label: t(
          "KassaReport.InitialBalance",
          "Сальдо начальное"
        ),
        value: formatMoney(report?.Sald0, locale)
      }
    ],
    groups
  };
}

function buildKassaExportModel(report, kind, t, locale) {
  if (kind === "days") {
    return buildKassaDaysExportModel(report, t, locale);
  }

  return buildKassaBriefExportModel(
    report,
    kind,
    t,
    locale
  );
}

function KassaReportView({
  kind,
  report,
  loading,
  error,
  onBack,
  onExport,
  exportLoading,
  locale,
  t
}) {
  useEffect(() => {
    const styleElement = document.createElement("style");
    styleElement.dataset.kassaReportPrintPage = "true";
    styleElement.textContent =
      "@media print { @page { size: A4 portrait; margin: 8mm; } }";
    document.head.appendChild(styleElement);

    return () => {
      styleElement.remove();
    };
  }, []);

  return (
    <div className="kassa-report-page">
      <div className="module-toolbar kassa-report-toolbar no-print">
        <div className="toolbar-left">
          <button type="button" className="toolbar-button" onClick={onBack}>
            {t("KassaReport.Back", "Назад")}
          </button>
        </div>

        <div className="toolbar-right kassa-report-actions">
          <button
            type="button"
            className="toolbar-button"
            onClick={() => onExport?.("xlsx")}
            disabled={
              loading ||
              Boolean(error) ||
              !report ||
              Boolean(exportLoading)
            }
          >
            {t("Common.Excel", "Excel")}
          </button>

          <button
            type="button"
            className="toolbar-button"
            onClick={() => onExport?.("docx")}
            disabled={
              loading ||
              Boolean(error) ||
              !report ||
              Boolean(exportLoading)
            }
          >
            {t("Common.Word", "Word")}
          </button>

          <button
            type="button"
            className="toolbar-button primary"
            onClick={() => window.print()}
            disabled={
              loading ||
              Boolean(error) ||
              !report ||
              Boolean(exportLoading)
            }
          >
            {t("KassaReport.Print", "Печать")}
          </button>
        </div>
      </div>

      <div className="kassa-report-scroll">
        {loading ? (
          <div className="kassa-report-status">
            {t("KassaReport.Loading", "Загрузка отчёта...")}
          </div>
        ) : error ? (
          <div className="kassa-report-status error-box">{error}</div>
        ) : report ? (
          <article className="kassa-report-sheet">
            {kind === "brief" && (
              <KassaBriefReport report={report} locale={locale} t={t} />
            )}
            {kind === "articles" && (
              <KassaBriefReport
                report={report}
                locale={locale}
                t={t}
                byArticles
              />
            )}
            {kind === "days" && (
              <KassaDaysReport report={report} locale={locale} t={t} />
            )}
          </article>
        ) : null}
      </div>
    </div>
  );
}

export default function KassaPage({
  data,
  currentOrg = 0,
  kassaDate,
  currentValut,
  dateFrom,
  dateTo,
  language = "ru",
  fetchWithAuth,
  onReportViewChange,
  onDateChange,
  onValutChange,
  onReload,
  onSave,
  onReceiveRevenue,
  onLoadSupplierInvoices,
  onDirtyChange,
  readOnly = false,
  t = (key, fallback = "") => fallback,
  locale = "ru-RU"
}) {
  const [selectedPrihId, setSelectedPrihId] = useState(null);
  const [selectedRashodId, setSelectedRashodId] = useState(null);
  const [editPrihRows, setEditPrihRows] = useState([]);
  const [editRashodRows, setEditRashodRows] = useState([]);
  const nextTempIdRef = useRef(-1);
  const kassaDateInputRef = useRef(null);
  const protectedDateChangeRef = useRef(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [receivingRevenue, setReceivingRevenue] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceRows, setInvoiceRows] = useState([]);
  const [invoiceSupplier, setInvoiceSupplier] = useState(null);
  const [invoiceTargetRowId, setInvoiceTargetRowId] = useState(null);
  const [saveError, setSaveError] = useState("");
  const [reportKind, setReportKind] = useState("");
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportExportLoading, setReportExportLoading] = useState(false);

  const orgId = Number(currentOrg || 0);
  const valutId = Number(currentValut || 0);
  const organizationReadOnly = orgId === 0;
  const canEdit = orgId > 0 && !readOnly;
  const isReadOnly = Boolean(readOnly || organizationReadOnly);
  const isDirty = Boolean(canEdit && hasChanges);

  protectedDateChangeRef.current = handleProtectedDateChange;

  useEffect(() => {
    const styleElement = document.createElement("style");
    styleElement.dataset.kassaEditorPolish = "true";
    styleElement.textContent = `
      .kassa-page .kassa-report-open-button {
        min-height: 34px !important;
        padding: 0 14px !important;
        border: 1px solid #aebdcb !important;
        border-radius: 8px !important;
        background: #e3eaf1 !important;
        color: #30485f !important;
        font-weight: 700 !important;
        box-shadow: 0 1px 2px rgba(36, 58, 78, 0.08) !important;
      }
      .kassa-page .kassa-report-open-button:not(:disabled):hover {
        background: #d5e0ea !important;
        border-color: #8fa5b8 !important;
        color: #213a50 !important;
      }
      .kassa-page .kassa-revenue-button {
        min-height: 34px !important;
        padding: 0 15px !important;
        border: 1px solid #83aa98 !important;
        border-radius: 8px !important;
        background: #d6e9df !important;
        color: #24513f !important;
        font-weight: 700 !important;
        box-shadow: 0 1px 2px rgba(36, 81, 63, 0.10) !important;
      }
      .kassa-page .kassa-revenue-button:not(:disabled):hover {
        background: #c2decf !important;
        border-color: #648f7b !important;
        color: #173f30 !important;
        box-shadow: 0 2px 5px rgba(36, 81, 63, 0.14) !important;
      }
      .kassa-page .kassa-report-open-button:disabled,
      .kassa-page .kassa-revenue-button:disabled {
        opacity: 0.55 !important;
      }
    `;
    document.head.appendChild(styleElement);

    return () => {
      styleElement.remove();
    };
  }, []);

  useEffect(() => {
    if (reportKind) return undefined;

    const input = kassaDateInputRef.current;
    if (!input) return undefined;

    const handleNativeChange = () => {
      protectedDateChangeRef.current?.(input.value);
    };

    input.addEventListener("change", handleNativeChange);

    return () => {
      input.removeEventListener("change", handleNativeChange);
    };
  }, [reportKind]);

  useEffect(() => {
    if (reportKind) return;

    const input = kassaDateInputRef.current;
    if (!input) return;

    const nextValue = formatDateForInput(kassaDate);
    if (input.value !== nextValue) {
      input.value = nextValue;
    }
  }, [kassaDate, reportKind]);

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


  useEffect(() => {
    onReportViewChange?.(Boolean(reportKind));
  }, [reportKind, onReportViewChange]);

  useEffect(() => {
    return () => {
      onReportViewChange?.(false);
    };
  }, [onReportViewChange]);

  const prihRows = Array.isArray(data?.prih) ? data.prih : [];

  const rashodBlocks = Array.isArray(data?.rashod)
    ? data.rashod
    : data?.rashod
      ? [data.rashod]
      : [];

  const activeRashodBlocks =
    orgId === 0
      ? rashodBlocks
      : rashodBlocks.filter((block) => Number(block?.Org || 0) === orgId);

  const rashodRowsRaw = activeRashodBlocks.flatMap((block) => {
    const blockOrg = Number(block?.Org || 0);

    if (!Array.isArray(block?.Items)) {
      return [];
    }

    return block.Items.map((row) => ({
      ...row,
      Org: Number(row.Org ?? blockOrg)
    }));
  });

  const rashodRows = Array.from(
    new Map(rashodRowsRaw.map((row) => [Number(row.ID || 0), row])).values()
  );

  const saldRows = rashodBlocks.flatMap((block) =>
    Array.isArray(block?.Sald) ? block.Sald : []
  );

  const valuts = Array.isArray(data?.valuts) ? data.valuts : [];
  const cliKass = Array.isArray(data?.cliKass) ? data.cliKass : [];
  const prihZatr = Array.isArray(data?.prihZatr) ? data.prihZatr : [];
  const postavKass = Array.isArray(data?.postavKass) ? data.postavKass : [];
  const rashodZatr = Array.isArray(data?.rashodZatr) ? data.rashodZatr : [];

  const filteredPrihRows = useMemo(() => {
    return prihRows.filter((row) => {
      const orgOk = orgId === 0 || Number(row.Org || 0) === orgId;
      const valutOk = valutId === 0 || Number(row.Valuts || 0) === valutId;
      return orgOk && valutOk;
    });
  }, [prihRows, orgId, valutId]);

  const filteredRashodRows = useMemo(() => {
    return rashodRows.filter((row) => {
      const orgOk = orgId === 0 || Number(row.Org || 0) === orgId;
      const valutOk = valutId === 0 || Number(row.Valuts || 0) === valutId;
      return orgOk && valutOk;
    });
  }, [rashodRows, orgId, valutId]);

  useEffect(() => {
    nextTempIdRef.current = -1;

    const nextPrihRows = filteredPrihRows.map((row) => ({
      ID: Number(row.ID || 0),
      Dat: formatDateForInput(row.Dat || kassaDate),
      Org: Number(row.Org || orgId || 0),
      Valuts: Number(row.Valuts || valutId || 0),
      Summa: normalizeNumber(row.Summa),
      KodKl: normalizeNumber(row.KodKl),
      KodZatrat: normalizeNumber(row.KodZatrat),
      Rem: normalizeText(row.Rem),
      Deleted: 0,
      _changed: false,
      _isDraft: false
    }));

    const nextRashodRows = filteredRashodRows.map((row) => ({
      ID: Number(row.ID || 0),
      Dat: formatDateForInput(row.Dat || kassaDate),
      Org: Number(row.Org || orgId || 0),
      Valuts: Number(row.Valuts || valutId || 0),
      Summa: normalizeNumber(row.Summa),
      KodPost: normalizeNumber(row.KodPost),
      KodZatrat: normalizeNumber(row.KodZatrat),
      Rem: normalizeText(row.Rem),
      Deleted: 0,
      _changed: false,
      _isDraft: false
    }));

    if (canEdit) {
      nextPrihRows.push(createPrihDraftRow());
      nextRashodRows.push(createRashodDraftRow());
    }

    setEditPrihRows(nextPrihRows);
    setEditRashodRows(nextRashodRows);

    setSelectedPrihId(null);
    setSelectedRashodId(null);
    setHasChanges(false);
    setSaveError("");
    setInvoiceRows([]);
    setInvoiceSupplier(null);
    setInvoiceTargetRowId(null);
  }, [data, kassaDate, orgId, valutId]);

  const visiblePrihRows = useMemo(
    () => editPrihRows.filter((row) => Number(row.Deleted || 0) !== 1),
    [editPrihRows]
  );

  const visibleRashodRows = useMemo(
    () => editRashodRows.filter((row) => Number(row.Deleted || 0) !== 1),
    [editRashodRows]
  );

  const sald0 = useMemo(() => {
    const row = saldRows.find((item) => Number(item.Valuts || 0) === valutId);
    return Number(row?.Sald0 || 0);
  }, [saldRows, valutId]);

  const prihSum = useMemo(() => {
    return visiblePrihRows.reduce((sum, row) => sum + Number(row.Summa || 0), 0);
  }, [visiblePrihRows]);

  const rashodSum = useMemo(() => {
    return visibleRashodRows.reduce(
      (sum, row) => sum + Number(row.Summa || 0),
      0
    );
  }, [visibleRashodRows]);

  const saldEnd = sald0 + prihSum - rashodSum;

  function confirmDiscardChanges() {
    if (!isDirty) return true;

    return window.confirm(
      t(
        "Kassa.UnsavedChangesWarning",
        "Внимание! Вы не сохранили измененные данные!\nУверены, что хотите уйти?"
      )
    );
  }

  function discardLocalChanges() {
    setHasChanges(false);
    onDirtyChange?.(false);
  }

  async function handleProtectedDateChange(nextDate) {
    const normalizedDate = formatDateForInput(nextDate);

    if (!normalizedDate || normalizedDate === formatDateForInput(kassaDate)) {
      return;
    }

    if (!confirmDiscardChanges()) {
      return;
    }

    if (isDirty) {
      discardLocalChanges();
    }

    await onDateChange?.(normalizedDate);
  }

  async function handleProtectedValutChange(nextValut) {
    const normalizedValut = Number(nextValut || 0);

    if (normalizedValut === valutId) {
      return;
    }

    if (!confirmDiscardChanges()) {
      return;
    }

    if (isDirty) {
      discardLocalChanges();
    }

    await onValutChange?.(normalizedValut);
  }

  async function handleProtectedReload() {
    if (!confirmDiscardChanges()) {
      return;
    }

    if (isDirty) {
      discardLocalChanges();
    }

    await onReload?.();
  }

  function shiftDate(days) {
    if (!kassaDate) return;

    const date = new Date(kassaDate);

    if (Number.isNaN(date.getTime())) return;

    date.setDate(date.getDate() + days);

    handleProtectedDateChange(date.toISOString().slice(0, 10));
  }

  function makeTempId() {
    const id = nextTempIdRef.current;
    nextTempIdRef.current -= 1;
    return id;
  }

  function createPrihDraftRow() {
    return {
      ID: makeTempId(),
      Dat: formatDateForInput(kassaDate),
      Org: orgId,
      Valuts: valutId,
      Summa: 0,
      KodKl: 0,
      KodZatrat: 0,
      Rem: "",
      Deleted: 0,
      _changed: false,
      _isDraft: true
    };
  }

  function createRashodDraftRow() {
    return {
      ID: makeTempId(),
      Dat: formatDateForInput(kassaDate),
      Org: orgId,
      Valuts: valutId,
      Summa: 0,
      KodPost: 0,
      KodZatrat: 0,
      Rem: "",
      Deleted: 0,
      _changed: false,
      _isDraft: true
    };
  }

  function isPrihRowMeaningful(row) {
    if (!row) return false;

    return (
      Number(row.Summa || 0) !== 0 ||
      Number(row.KodKl || 0) !== 0 ||
      Number(row.KodZatrat || 0) !== 0 ||
      normalizeText(row.Rem).trim() !== "" ||
      formatDateForInput(row.Dat) !== formatDateForInput(kassaDate)
    );
  }

  function isRashodRowMeaningful(row) {
    if (!row) return false;

    return (
      Number(row.Summa || 0) !== 0 ||
      Number(row.KodPost || 0) !== 0 ||
      Number(row.KodZatrat || 0) !== 0 ||
      normalizeText(row.Rem).trim() !== "" ||
      formatDateForInput(row.Dat) !== formatDateForInput(kassaDate)
    );
  }

  function ensureTrailingPrihDraftRow(sourceRows) {
    if (!canEdit) {
      return sourceRows.filter((row) => !row._isDraft);
    }

    let blankDraft = null;
    const rowsWithoutBlankDrafts = [];

    for (const row of sourceRows) {
      if (row._isDraft && !isPrihRowMeaningful(row)) {
        if (!blankDraft) blankDraft = row;
        continue;
      }

      rowsWithoutBlankDrafts.push(row);
    }

    return [...rowsWithoutBlankDrafts, blankDraft || createPrihDraftRow()];
  }

  function ensureTrailingRashodDraftRow(sourceRows) {
    if (!canEdit) {
      return sourceRows.filter((row) => !row._isDraft);
    }

    let blankDraft = null;
    const rowsWithoutBlankDrafts = [];

    for (const row of sourceRows) {
      if (row._isDraft && !isRashodRowMeaningful(row)) {
        if (!blankDraft) blankDraft = row;
        continue;
      }

      rowsWithoutBlankDrafts.push(row);
    }

    return [...rowsWithoutBlankDrafts, blankDraft || createRashodDraftRow()];
  }

  function markChanged() {
    if (!canEdit) return;

    setHasChanges(true);
    setSaveError("");
  }

  function updatePrihRow(id, field, value) {
    if (!canEdit) return;

    const nextValue = ["Summa", "KodKl", "KodZatrat"].includes(field)
      ? normalizeNumber(value)
      : normalizeText(value);

    const currentRow = editPrihRows.find(
      (row) => Number(row.ID) === Number(id)
    );
    const candidate = currentRow
      ? { ...currentRow, [field]: nextValue }
      : null;
    const shouldMark =
      Boolean(currentRow && !currentRow._isDraft) ||
      isPrihRowMeaningful(candidate);

    setEditPrihRows((rows) => {
      const nextRows = rows.map((row) => {
        if (Number(row.ID) !== Number(id)) return row;

        const nextRow = { ...row, [field]: nextValue };
        const meaningful = isPrihRowMeaningful(nextRow);
        const isNew = Number(nextRow.ID) < 0;

        return {
          ...nextRow,
          _changed: row._isDraft ? meaningful : true,
          _isDraft: isNew ? !meaningful : false
        };
      });

      return ensureTrailingPrihDraftRow(nextRows);
    });

    if (shouldMark) {
      markChanged();
    }
  }

  function updateRashodRow(id, field, value) {
    if (!canEdit) return;

    const nextValue = ["Summa", "KodPost", "KodZatrat"].includes(field)
      ? normalizeNumber(value)
      : normalizeText(value);

    const currentRow = editRashodRows.find(
      (row) => Number(row.ID) === Number(id)
    );
    const candidate = currentRow
      ? { ...currentRow, [field]: nextValue }
      : null;
    const shouldMark =
      Boolean(currentRow && !currentRow._isDraft) ||
      isRashodRowMeaningful(candidate);

    setEditRashodRows((rows) => {
      const nextRows = rows.map((row) => {
        if (Number(row.ID) !== Number(id)) return row;

        const nextRow = { ...row, [field]: nextValue };
        const meaningful = isRashodRowMeaningful(nextRow);
        const isNew = Number(nextRow.ID) < 0;

        return {
          ...nextRow,
          _changed: row._isDraft ? meaningful : true,
          _isDraft: isNew ? !meaningful : false
        };
      });

      return ensureTrailingRashodDraftRow(nextRows);
    });

    if (shouldMark) {
      markChanged();
    }
  }

  function getKassaTableRow(kind, rowId) {
    const table = document.querySelector(
      kind === "prih" ? ".kassa-prih-table" : ".kassa-rashod-table"
    );

    if (!table) return null;

    return (
      Array.from(table.querySelectorAll("tbody tr[data-kassa-row-id]")).find(
        (rowElement) =>
          String(rowElement.dataset.kassaRowId) === String(rowId)
      ) || null
    );
  }

  function focusKassaField(kind, rowId, field) {
    window.requestAnimationFrame(() => {
      const rowElement = getKassaTableRow(kind, rowId);
      const control = rowElement?.querySelector(
        `[data-kassa-field="${field}"]`
      );

      if (!control) return;

      control.focus();
      control.select?.();
    });
  }

  function focusNextKassaRow(kind, rowId) {
    window.requestAnimationFrame(() => {
      const rowElement = getKassaTableRow(kind, rowId);
      const nextRow = rowElement?.nextElementSibling || null;
      const control = nextRow?.querySelector('[data-kassa-field="date"]');

      if (!control) return;

      control.focus();
      control.select?.();
    });
  }

  function handleKassaEnter(event, callback) {
    if (event.key !== "Enter") return;

    event.preventDefault();
    event.stopPropagation();
    callback?.();
  }

  function deletePrihRow(id) {
    if (!canEdit) return;

    if (!window.confirm(t("Kassa.DeleteRowConfirm", "Удалить строку?"))) {
      return;
    }

    setEditPrihRows((rows) =>
      rows
        .filter((row) => !(Number(row.ID) < 0 && Number(row.ID) === Number(id)))
        .map((row) =>
          Number(row.ID) === Number(id) ? { ...row, Deleted: 1 } : row
        )
    );

    setSelectedPrihId(null);
    markChanged();
  }

  function deleteRashodRow(id) {
    if (!canEdit) return;

    if (!window.confirm(t("Kassa.DeleteRowConfirm", "Удалить строку?"))) {
      return;
    }

    setEditRashodRows((rows) =>
      rows
        .filter((row) => !(Number(row.ID) < 0 && Number(row.ID) === Number(id)))
        .map((row) =>
          Number(row.ID) === Number(id) ? { ...row, Deleted: 1 } : row
        )
    );

    setSelectedRashodId(null);
    markChanged();
  }

  function cleanPrihRow(row) {
    return {
      ID: Number(row.ID || 0),
      Dat: formatDateForApi(row.Dat || kassaDate),
      Org: orgId,
      Valuts: Number(row.Valuts || valutId || 0),
      Summa: normalizeNumber(row.Summa),
      KodKl: normalizeNumber(row.KodKl),
      KodZatrat: normalizeNumber(row.KodZatrat),
      Rem: normalizeText(row.Rem),
      Deleted: Number(row.Deleted || 0)
    };
  }

  function cleanRashodRow(row) {
    return {
      ID: Number(row.ID || 0),
      Dat: formatDateForApi(row.Dat || kassaDate),
      Org: orgId,
      Valuts: Number(row.Valuts || valutId || 0),
      Summa: normalizeNumber(row.Summa),
      KodPost: normalizeNumber(row.KodPost),
      KodZatrat: normalizeNumber(row.KodZatrat),
      Rem: normalizeText(row.Rem),
      Deleted: Number(row.Deleted || 0)
    };
  }
function buildKassaXml() {
  const prihRows = editPrihRows
    .filter((row) => !row._isDraft)
    .map(cleanPrihRow);
  const rashodRows = editRashodRows
    .filter((row) => !row._isDraft)
    .map(cleanRashodRow);

  const activePrihXml = prihRows
    .filter((row) => Number(row.Deleted || 0) !== 1)
    .map((row) =>
      `    <Item ${attrsToXml({
        ID: row.ID,
        Dat: row.Dat,
        Org: row.Org,
        Valuts: row.Valuts,
        Summa: row.Summa,
        KodKl: row.KodKl,
        KodZatrat: row.KodZatrat,
        Rem: row.Rem
      })}/>`
    )
    .join("\n");

  const deletedPrihXml = prihRows
    .filter((row) => Number(row.Deleted || 0) === 1 && Number(row.ID || 0) > 0)
    .map((row) => `    <Item ID="${xmlEscape(row.ID)}"/>`)
    .join("\n");

  const activeRashodXml = rashodRows
    .filter((row) => Number(row.Deleted || 0) !== 1)
    .map((row) =>
      `    <Item ${attrsToXml({
        ID: row.ID,
        Dat: row.Dat,
        Org: row.Org,
        Valuts: row.Valuts,
        Summa: row.Summa,
        KodPost: row.KodPost,
        KodZatrat: row.KodZatrat,
        Rem: row.Rem
      })}/>`
    )
    .join("\n");

  const deletedRashodXml = rashodRows
    .filter((row) => Number(row.Deleted || 0) === 1 && Number(row.ID || 0) > 0)
    .map((row) => `    <Item ID="${xmlEscape(row.ID)}"/>`)
    .join("\n");

  return [
    `<Kassa Date="${xmlEscape(formatDateForApi(kassaDate))}" Org="${orgId}">`,
    `  <Prih>`,
    `    <Items>`,
    activePrihXml,
    `    </Items>`,
    `    <Deleted>`,
    deletedPrihXml,
    `    </Deleted>`,
    `  </Prih>`,
    `  <Rashod>`,
    `    <Items>`,
    activeRashodXml,
    `    </Items>`,
    `    <Deleted>`,
    deletedRashodXml,
    `    </Deleted>`,
    `  </Rashod>`,
    `</Kassa>`
  ].join("\n");
}


  async function receiveRevenue() {
    if (!canEdit || hasChanges || saving || receivingRevenue) return;

    try {
      setReceivingRevenue(true);
      setSaveError("");

      if (onReceiveRevenue) {
        await onReceiveRevenue({
          Date: formatDateForApi(kassaDate),
          Org: orgId
        });
      }

      await onReload?.();
    } catch (err) {
      setSaveError(err.message || t("Kassa.ReceiveRevenueError", "Ошибка приема выручки"));
    } finally {
      setReceivingRevenue(false);
    }
  }

  async function openSupplierInvoices(row) {
    if (!row || Number(row.KodPost || 0) === 0) return;
    if (invoiceLoading || saving || receivingRevenue) return;

    const supplier = postavKass.find(
      (item) => Number(item.ID) === Number(row.KodPost)
    );

    try {
      setInvoiceLoading(true);
      setSaveError("");

      const result = onLoadSupplierInvoices
        ? await onLoadSupplierInvoices({
            IdPost: Number(row.KodPost),
            Val: valutId
          })
        : [];

      setInvoiceRows(Array.isArray(result) ? result : result ? [result] : []);
      setInvoiceSupplier({
        ID: Number(row.KodPost),
        Name: supplier?.Name || getNameById(postavKass, row.KodPost)
      });
      setInvoiceTargetRowId(row.ID);
    } catch (err) {
      setSaveError(err.message || t("Kassa.SupplierInvoicesLoadError", "Ошибка загрузки накладных поставщика"));
    } finally {
      setInvoiceLoading(false);
    }
  }

  function closeSupplierInvoices() {
    setInvoiceRows([]);
    setInvoiceSupplier(null);
    setInvoiceTargetRowId(null);
  }

  function applyInvoiceDebt(invoice) {
    if (!canEdit) return;
    if (invoiceTargetRowId === null || invoiceTargetRowId === undefined) return;

    updateRashodRow(invoiceTargetRowId, "Summa", invoice.Dolg);
    closeSupplierInvoices();
  }

async function openKassaReport(kind) {
  if (reportLoading) return;

  const endpoints = {
    brief: "wr_KassKratko.php",
    articles: "wr_KassKratkoPoStatyam.php",
    days: "wr_KassPoDnyam.php"
  };

  const endpoint = endpoints[kind];
  if (!endpoint) return;

  const d1 = formatReportDateParam(dateFrom);
  const d2 = formatReportDateParam(dateTo);

  if (!d1 || !d2) {
    setReportKind(kind);
    setReportData(null);
    setReportError(
      t("KassaReport.PeriodRequired", "Укажите период отчёта")
    );
    return;
  }

  setReportKind(kind);
  setReportData(null);
  setReportError("");
  setReportLoading(true);

  try {
    const url = new URL(`https://webback.bar-boss.com/${endpoint}`);
    url.searchParams.set("Org", String(orgId));
    url.searchParams.set("d1", d1);
    url.searchParams.set("d2", d2);
    url.searchParams.set("Lang", String(language || "ru"));
    url.searchParams.set("Valut", String(valutId));

    console.log("[KassaReport] request", {
      kind,
      dateFrom,
      dateTo,
      d1,
      d2,
      orgId,
      valutId,
      language,
      url: url.toString()
    });

    const response = fetchWithAuth
      ? await fetchWithAuth(url.toString(), { method: "GET" })
      : await fetch(url.toString(), { method: "GET", credentials: "include" });

    const text = await response.text();
    let json;

    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(
        t("KassaReport.InvalidResponse", "Сервер вернул некорректный ответ отчёта")
      );
    }

    if (!response.ok || json?.status === "error") {
      throw new Error(
        json?.message ||
          json?.error ||
          t("KassaReport.LoadError", "Ошибка загрузки отчёта")
      );
    }

    const reportObject = Array.isArray(json) ? json[0] : json;

    if (!reportObject || typeof reportObject !== "object") {
      throw new Error(
        t("KassaReport.LoadError", "Ошибка загрузки отчёта")
      );
    }

    setReportData(reportObject);
  } catch (err) {
    setReportError(
      err?.message || t("KassaReport.LoadError", "Ошибка загрузки отчёта")
    );
  } finally {
    setReportLoading(false);
  }
}


async function exportKassaReport(format) {
  if (
    !reportData ||
    !reportKind ||
    reportLoading ||
    reportExportLoading
  ) {
    return;
  }

  const reportModel = buildKassaExportModel(
    reportData,
    reportKind,
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

function closeKassaReport() {
  setReportKind("");
  setReportData(null);
  setReportError("");
  setReportLoading(false);
  setReportExportLoading(false);
}

async function saveChanges() {
  if (!canEdit || !hasChanges || saving) return;

  const xml = buildKassaXml();

  const payload = {
    Date: formatDateForApi(kassaDate),
    Org: orgId,
    Xml: xml
  };

  try {
    setSaving(true);
    setSaveError("");

    if (onSave) {
      await onSave(payload);
    } else {
      console.log("Kassa save XML", xml);
    }

    setEditPrihRows((rows) =>
      rows.map((row) => ({ ...row, _changed: false }))
    );
    setEditRashodRows((rows) =>
      rows.map((row) => ({ ...row, _changed: false }))
    );
    setHasChanges(false);
    onDirtyChange?.(false);
  } catch (err) {
    setSaveError(err.message || t("Kassa.SaveError", "Ошибка сохранения кассы"));
  } finally {
    setSaving(false);
  }
}
  if (reportKind) {
    return (
      <KassaReportView
        kind={reportKind}
        report={reportData}
        loading={reportLoading}
        error={reportError}
        onBack={closeKassaReport}
        onExport={exportKassaReport}
        exportLoading={reportExportLoading}
        t={t}
        locale={locale}
      />
    );
  }

  return (
    <div className="kassa-page kassa-editor-page">
      <div className="kassa-toolbar kassa-main-toolbar">
        <div className="kassa-date-panel">
          <button
            type="button"
            className="kassa-date-nav-button"
            onClick={() => shiftDate(-1)}
            disabled={saving || receivingRevenue}
          >
            ←
          </button>

          <input
            ref={kassaDateInputRef}
            type="date"
            className="kassa-main-date-input"
            defaultValue={formatDateForInput(kassaDate)}
            onKeyDown={(event) => {
              if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                event.preventDefault();
              }
            }}
            disabled={saving || receivingRevenue}
          />

          <button
            type="button"
            className="kassa-date-nav-button"
            onClick={() => shiftDate(1)}
            disabled={saving || receivingRevenue}
          >
            →
          </button>

          <button
            type="button"
            className="kassa-refresh-button"
            onClick={handleProtectedReload}
            disabled={saving || receivingRevenue}
          >
            {t("Kassa.Refresh", "Обновить")}
          </button>

          {canEdit && (
            <button
              type="button"
              className={`save-button kassa-save-button ${hasChanges ? "save-button-active" : ""}`}
              onClick={saveChanges}
              disabled={!hasChanges || saving}
            >
              {saving ? t("Kassa.Saving", "Сохранение...") : t("Kassa.Save", "Сохранить")}
            </button>
          )}
        </div>

        <div className="kassa-report-buttons" role="group" aria-label={t("KassaReport.Reports", "Отчёты кассы")}>
          <button
            type="button"
            className="small-action-button kassa-report-open-button"
            onClick={() => openKassaReport("brief")}
            disabled={saving || receivingRevenue || reportLoading}
          >
            {t("KassaReport.BriefButton", "Кратко")}
          </button>

          <button
            type="button"
            className="small-action-button kassa-report-open-button"
            onClick={() => openKassaReport("articles")}
            disabled={saving || receivingRevenue || reportLoading}
          >
            {t("KassaReport.BriefByArticlesButton", "Кратко по статьям")}
          </button>

          <button
            type="button"
            className="small-action-button kassa-report-open-button"
            onClick={() => openKassaReport("days")}
            disabled={saving || receivingRevenue || reportLoading}
          >
            {t("KassaReport.ByDaysButton", "По дням")}
          </button>
        </div>

        <div className="kassa-valut-panel">
          {canEdit && (
            <button
              type="button"
              className="small-action-button receive-revenue-button kassa-revenue-button"
              onClick={receiveRevenue}
              disabled={hasChanges || saving || receivingRevenue}
              title={hasChanges ? t("Kassa.SaveFirstHint", "Сначала сохраните или обновите данные") : ""}
            >
              {receivingRevenue ? t("Kassa.Receiving", "Прием...") : t("Kassa.ReceiveRevenue", "Прием выручки")}
            </button>
          )}

          <span>{t("Kassa.PaymentType", "Тип оплаты")}</span>

          <select
            value={currentValut || ""}
            onChange={(event) => handleProtectedValutChange(event.target.value)}
            disabled={saving || receivingRevenue}
          >
            {valuts.map((item) => (
              <option key={item.ID} value={item.ID}>
                {item.Name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isReadOnly && (
        <div className="readonly-notice">
          {readOnly
            ? t(
                "Kassa.UserReadOnlyNotice",
                "Касса доступна только для просмотра."
              )
            : t(
                "Kassa.ReadOnlyNotice",
                "Режим просмотра: выберите конкретную организацию для добавления и редактирования кассовых операций."
              )}
        </div>
      )}

      {saveError && <div className="error-box">{saveError}</div>}

      <div className="kassa-summary kassa-summary-panel">
        <div>
          <span>{t("Kassa.InitialBalance", "Сальдо начальное")}:</span>
          <strong>{formatMoney(sald0, locale)}</strong>
        </div>

        <div>
          <span>{t("Kassa.Income", "Приход")}:</span>
          <strong>{formatMoney(prihSum, locale)}</strong>
        </div>

        <div>
          <span>{t("Kassa.Expense", "Расход")}:</span>
          <strong>{formatMoney(rashodSum, locale)}</strong>
        </div>

        <div>
          <span>{t("Kassa.FinalBalance", "Сальдо конечное")}:</span>
          <strong>{formatMoney(saldEnd, locale)}</strong>
        </div>
      </div>

      {invoiceSupplier && (
        <section className="kassa-invoice-panel">
          <div className="kassa-invoice-header">
            <div>
              <strong>{t("Kassa.UnpaidInvoices", "Неоплаченные накладные")}</strong>
              <span
                className="kassa-invoice-supplier"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  width: "fit-content",
                  marginTop: "4px",
                  padding: "3px 10px",
                  border: "1px solid #b9cdec",
                  borderRadius: "999px",
                  background: "#eaf2ff",
                  color: "#174f96",
                  fontWeight: 700
                }}
              >
                {invoiceSupplier.Name}
              </span>
            </div>

            <button
              type="button"
              className="small-action-button kassa-invoice-back-button"
              onClick={closeSupplierInvoices}
            >
              {t("Kassa.BackToCash", "Вернуться к кассе")}
            </button>
          </div>

          <div className="table-wrap kassa-invoice-table-wrap">
            <table className="data-table kassa-invoice-table">
              <colgroup>
                <col className="kassa-invoice-col-number" />
                <col className="kassa-invoice-col-date" />
                <col className="kassa-invoice-col-warehouse" />
                <col className="kassa-invoice-col-money" />
                <col className="kassa-invoice-col-money" />
                <col className="kassa-invoice-col-money" />
                <col className="kassa-invoice-col-composition" />
              </colgroup>

              <thead>
                <tr>
                  <th>{t("Kassa.Number", "№")}</th>
                  <th>{t("Kassa.Date", "Дата")}</th>
                  <th>{t("Kassa.Warehouse", "Склад")}</th>
                  <th>{t("Kassa.Amount", "Сумма")}</th>
                  <th>{t("Kassa.Paid", "Оплачено")}</th>
                  <th>{t("Kassa.Debt", "Долг")}</th>
                  <th>{t("Kassa.Composition", "Состав")}</th>
                </tr>
              </thead>

              <tbody>
                {invoiceRows.map((invoice) => (
                  <tr key={invoice.ID}>
                    <td>{invoice.Invoice}</td>
                    <td>{formatDateDisplay(invoice.Date, locale)}</td>
                    <td>{invoice.NameSkl}</td>
                    <td className="text-right">{formatMoney(invoice.SumNakl, locale)}</td>
                    <td className="text-right">{formatMoney(invoice.Oplach, locale)}</td>
                    <td
                      className="text-right invoice-debt-cell"
                      title={
                        canEdit
                          ? t("Kassa.ApplyDebtHint", "Двойной клик: поставить сумму в расход")
                          : ""
                      }
                      onDoubleClick={canEdit ? () => applyInvoiceDebt(invoice) : undefined}
                    >
                      {formatMoney(invoice.Dolg, locale)}
                    </td>
                    <td>{invoice.Sostav}</td>
                  </tr>
                ))}

                {invoiceRows.length === 0 && (
                  <tr>
                    <td colSpan="7" className="empty-cell kassa-empty-row">
                      {t("Kassa.NoUnpaidInvoices", "Неоплаченных накладных нет")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="kassa-columns kassa-main-columns">
        <section className="kassa-panel kassa-operation-panel">
          <div className="kassa-panel-title">
            <span>{t("Kassa.CashIncome", "Приход в кассу")}</span>

          </div>

          <div className="kassa-table-wrap">
            <table className="data-table kassa-table kassa-prih-table">
              <colgroup>
                <col className="kassa-col-date" />
                <col className="kassa-col-amount" />
                <col className="kassa-col-party" />
                <col className="kassa-col-expense" />
                <col className="kassa-col-note" />
                <col className="kassa-col-delete" />
              </colgroup>

              <thead>
                <tr>
                  <th>{t("Kassa.Date", "Дата")}</th>
                  <th>{t("Kassa.Amount", "Сумма")}</th>
                  <th>{t("Kassa.Client", "Клиент")}</th>
                  <th>{t("Kassa.Category", "Статья")}</th>
                  <th>{t("Kassa.Note", "Примечание")}</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {visiblePrihRows.map((row) => (
                  <tr
                    key={`prih-${row.ID}`}
                    data-kassa-row-id={row.ID}
                    className={[
                      row.ID === selectedPrihId ? "selected-row" : "",
                      row._changed ? "changed-row" : ""
                    ].join(" ")}
                    onClick={() => setSelectedPrihId(row.ID)}
                  >
                    <td>
                      {canEdit ? (
                        <input
                          className="table-input kassa-date-input"
                          type="date"
                          data-kassa-field="date"
                          value={formatDateForInput(row.Dat)}
                          onChange={(event) =>
                            updatePrihRow(row.ID, "Dat", event.target.value)
                          }
                          onKeyDown={(event) =>
                            handleKassaEnter(event, () =>
                              focusKassaField("prih", row.ID, "amount")
                            )
                          }
                        />
                      ) : (
                        formatDateDisplay(row.Dat, locale)
                      )}
                    </td>
                    <td className="text-right">
                      {canEdit ? (
                        <input
                          className="table-input text-right"
                          type="number"
                          step="0.01"
                          data-kassa-field="amount"
                          value={row.Summa}
                          onChange={(event) =>
                            updatePrihRow(row.ID, "Summa", event.target.value)
                          }
                          onKeyDown={(event) =>
                            handleKassaEnter(event, () =>
                              focusKassaField("prih", row.ID, "party")
                            )
                          }
                        />
                      ) : (
                        formatMoney(row.Summa, locale)
                      )}
                    </td>
                    <td title={`KodKl: ${row.KodKl}`}>
                      {canEdit ? (
                        <select
                          className="table-select"
                          data-kassa-field="party"
                          value={row.KodKl || 0}
                          onChange={(event) =>
                            updatePrihRow(row.ID, "KodKl", event.target.value)
                          }
                          onKeyDown={(event) =>
                            handleKassaEnter(event, () =>
                              focusKassaField("prih", row.ID, "category")
                            )
                          }
                        >
                          <option value={0}>—</option>
                          {cliKass.map((item) => (
                            <option key={item.ID} value={item.ID}>
                              {item.Name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        getNameById(cliKass, row.KodKl)
                      )}
                    </td>
                    <td title={`KodZatrat: ${row.KodZatrat}`}>
                      {canEdit ? (
                        <select
                          className="table-select"
                          data-kassa-field="category"
                          value={row.KodZatrat || 0}
                          onChange={(event) =>
                            updatePrihRow(row.ID, "KodZatrat", event.target.value)
                          }
                          onKeyDown={(event) =>
                            handleKassaEnter(event, () =>
                              focusKassaField("prih", row.ID, "note")
                            )
                          }
                        >
                          <option value={0}>—</option>
                          {prihZatr.map((item) => (
                            <option key={item.ID} value={item.ID}>
                              {item.Name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        getNameById(prihZatr, row.KodZatrat)
                      )}
                    </td>
                    <td>
                      {canEdit ? (
                        <input
                          className="table-input"
                          type="text"
                          data-kassa-field="note"
                          value={row.Rem || ""}
                          onChange={(event) =>
                            updatePrihRow(row.ID, "Rem", event.target.value)
                          }
                          onKeyDown={(event) =>
                            handleKassaEnter(event, () =>
                              focusNextKassaRow("prih", row.ID)
                            )
                          }
                        />
                      ) : (
                        row.Rem || ""
                      )}
                    </td>
                    <td className="action-column">
                      {canEdit && !row._isDraft && (
                        <button
                          type="button"
                          className="small-danger-button kassa-delete-button"
                          title={t("Kassa.DeleteRow", "Удалить строку")}
                          aria-label={t("Kassa.DeleteRow", "Удалить строку")}
                          onClick={(event) => {
                            event.stopPropagation();
                            deletePrihRow(row.ID);
                          }}
                        >
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                ))}

                {visiblePrihRows.length === 0 && (
                  <tr>
                    <td colSpan="6" className="empty-cell kassa-empty-row">
                      {t("Kassa.NoIncome", "Нет приходов за выбранную дату")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="kassa-panel kassa-operation-panel">
          <div className="kassa-panel-title">
            <span>{t("Kassa.CashExpense", "Расход из кассы")}</span>

          </div>

          <div className="kassa-table-wrap">
            <table className="data-table kassa-table kassa-rashod-table">
              <colgroup>
                <col className="kassa-col-date" />
                <col className="kassa-col-amount" />
                <col className="kassa-col-party" />
                <col className="kassa-col-expense" />
                <col className="kassa-col-note" />
                <col className="kassa-col-invoice" />
                <col className="kassa-col-delete" />
              </colgroup>

              <thead>
                <tr>
                  <th>{t("Kassa.Date", "Дата")}</th>
                  <th>{t("Kassa.Amount", "Сумма")}</th>
                  <th>{t("Kassa.Supplier", "Поставщик")}</th>
                  <th>{t("Kassa.Category", "Статья")}</th>
                  <th>{t("Kassa.Note", "Примечание")}</th>
                  <th>{t("Kassa.Invoices", "Накладные")}</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {visibleRashodRows.map((row) => (
                  <tr
                    key={`rashod-${row.ID}`}
                    data-kassa-row-id={row.ID}
                    className={[
                      row.ID === selectedRashodId ? "selected-row" : "",
                      row._changed ? "changed-row" : ""
                    ].join(" ")}
                    onClick={() => setSelectedRashodId(row.ID)}
                  >
                    <td>
                      {canEdit ? (
                        <input
                          className="table-input kassa-date-input"
                          type="date"
                          data-kassa-field="date"
                          value={formatDateForInput(row.Dat)}
                          onChange={(event) =>
                            updateRashodRow(row.ID, "Dat", event.target.value)
                          }
                          onKeyDown={(event) =>
                            handleKassaEnter(event, () =>
                              focusKassaField("rashod", row.ID, "amount")
                            )
                          }
                        />
                      ) : (
                        formatDateDisplay(row.Dat, locale)
                      )}
                    </td>
                    <td className="text-right">
                      {canEdit ? (
                        <input
                          className="table-input text-right"
                          type="number"
                          step="0.01"
                          data-kassa-field="amount"
                          value={row.Summa}
                          onChange={(event) =>
                            updateRashodRow(row.ID, "Summa", event.target.value)
                          }
                          onKeyDown={(event) =>
                            handleKassaEnter(event, () =>
                              focusKassaField("rashod", row.ID, "party")
                            )
                          }
                        />
                      ) : (
                        formatMoney(row.Summa, locale)
                      )}
                    </td>
                    <td title={`KodPost: ${row.KodPost}`}>
                      {canEdit ? (
                        <select
                          className="table-select"
                          data-kassa-field="party"
                          value={row.KodPost || 0}
                          onChange={(event) =>
                            updateRashodRow(row.ID, "KodPost", event.target.value)
                          }
                          onKeyDown={(event) =>
                            handleKassaEnter(event, () =>
                              focusKassaField("rashod", row.ID, "category")
                            )
                          }
                        >
                          <option value={0}>—</option>
                          {postavKass.map((item) => (
                            <option key={item.ID} value={item.ID}>
                              {item.Name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        getNameById(postavKass, row.KodPost)
                      )}
                    </td>
                    <td title={`KodZatrat: ${row.KodZatrat}`}>
                      {canEdit ? (
                        <select
                          className="table-select"
                          data-kassa-field="category"
                          value={row.KodZatrat || 0}
                          onChange={(event) =>
                            updateRashodRow(
                              row.ID,
                              "KodZatrat",
                              event.target.value
                            )
                          }
                          onKeyDown={(event) =>
                            handleKassaEnter(event, () =>
                              focusKassaField("rashod", row.ID, "note")
                            )
                          }
                        >
                          <option value={0}>—</option>
                          {rashodZatr.map((item) => (
                            <option key={item.ID} value={item.ID}>
                              {item.Name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        getNameById(rashodZatr, row.KodZatrat)
                      )}
                    </td>
                    <td>
                      {canEdit ? (
                        <input
                          className="table-input"
                          type="text"
                          data-kassa-field="note"
                          value={row.Rem || ""}
                          onChange={(event) =>
                            updateRashodRow(row.ID, "Rem", event.target.value)
                          }
                          onKeyDown={(event) =>
                            handleKassaEnter(event, () =>
                              focusNextKassaRow("rashod", row.ID)
                            )
                          }
                        />
                      ) : (
                        row.Rem || ""
                      )}
                    </td>
                    <td className="action-column">
                      <button
                        type="button"
                        className="small-action-button kassa-invoice-button"
                        disabled={Number(row.KodPost || 0) === 0 || invoiceLoading}
                        onClick={(event) => {
                          event.stopPropagation();
                          openSupplierInvoices(row);
                        }}
                      >
                        {t("Kassa.Invoices", "Накладные")}
                      </button>
                    </td>
                    <td className="action-column">
                      {canEdit && !row._isDraft && (
                        <button
                          type="button"
                          className="small-danger-button kassa-delete-button"
                          title={t("Kassa.DeleteRow", "Удалить строку")}
                          aria-label={t("Kassa.DeleteRow", "Удалить строку")}
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteRashodRow(row.ID);
                          }}
                        >
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                ))}

                {visibleRashodRows.length === 0 && (
                  <tr>
                    <td colSpan="7" className="empty-cell kassa-empty-row">
                      {t("Kassa.NoExpenses", "Нет расходов за выбранную дату")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}