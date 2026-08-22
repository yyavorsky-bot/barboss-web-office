import { useEffect, useMemo, useState } from "react";
import { exportReportFile } from "./reportExport.js";
import "./nerasch.css";

const REPORT_ACTIONS = {
  raw: "SirInBill",
  rawPeriod: "TovBanketDates",
  bankets: "Bankets",
  dishes: "BankesBluda"
};

function n(value) {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function money(value, locale = "ru-RU") {
  try {
    return new Intl.NumberFormat(locale || "ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(n(value));
  } catch {
    return n(value).toFixed(2);
  }
}

function qty(value, locale = "ru-RU") {
  try {
    return new Intl.NumberFormat(locale || "ru-RU", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3
    }).format(n(value));
  } catch {
    return String(n(value));
  }
}

function dateOnly(value) {
  const text = String(value ?? "").trim();
  const m = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : text || "—";
}

function dateTime(value) {
  const text = String(value ?? "").trim();
  const m = text.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/
  );
  return m
    ? `${m[3]}.${m[2]}.${m[1]} ${m[4]}:${m[5]}`
    : text || "—";
}

function timeOnly(value) {
  const text = String(value ?? "").trim();
  const m = text.match(/T(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : text || "—";
}

function sum(rows, field) {
  return rows.reduce(
    (total, row) => total + n(row?.[field]),
    0
  );
}

function escXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function escHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function filePart(value) {
  return String(value ?? "")
    .trim()
    .replace(/[^\p{L}\p{N}._-]+/gu, "_")
    .slice(0, 60) || "report";
}

function responseRows(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.Data)) return value.Data;
  if (Array.isArray(value?.rows)) return value.rows;
  if (Array.isArray(value?.Rows)) return value.Rows;
  if (Array.isArray(value?.result)) return value.result;
  return [];
}

function groupBankets(rows) {
  const sorted = [...rows].sort((a, b) => {
    const d = String(a?.DateBank ?? "").localeCompare(
      String(b?.DateBank ?? "")
    );
    if (d) return d;

    const t = String(a?.TimeBank ?? "").localeCompare(
      String(b?.TimeBank ?? "")
    );
    if (t) return t;

    return String(a?.Table ?? "").localeCompare(
      String(b?.Table ?? ""),
      undefined,
      { numeric: true }
    );
  });

  const map = new Map();

  for (const row of sorted) {
    const key =
      String(row?.DateBank ?? "").slice(0, 10) || "—";

    if (!map.has(key)) {
      map.set(key, []);
    }

    map.get(key).push(row);
  }

  return [...map.entries()].map(([date, items]) => ({
    date,
    items
  }));
}

function groupDishes(rows) {
  const sorted = [...rows].sort((a, b) => {
    const ceh = n(a?.Ceh) - n(b?.Ceh);
    if (ceh) return ceh;

    const warehouse = String(a?.NameSkl ?? "").localeCompare(
      String(b?.NameSkl ?? ""),
      undefined,
      { sensitivity: "base" }
    );
    if (warehouse) return warehouse;

    return String(a?.NameDish ?? "").localeCompare(
      String(b?.NameDish ?? ""),
      undefined,
      { sensitivity: "base" }
    );
  });

  const groups = [];
  let lastKey = "";

  for (const row of sorted) {
    const key = `${n(row?.Ceh)}|${String(
      row?.NameSkl ?? ""
    ).trim()}`;

    if (key !== lastKey) {
      groups.push({
        key,
        name: String(row?.NameSkl ?? "").trim() || "—",
        items: []
      });
      lastKey = key;
    }

    groups[groups.length - 1].items.push(row);
  }

  return groups;
}

function closePrintWindowAfterPrint(printWindow) {
  if (!printWindow) return;

  const closeWindow = () => {
    if (!printWindow.closed) {
      printWindow.close();
    }
    window.focus();
  };

  printWindow.addEventListener(
    "afterprint",
    () => {
      printWindow.addEventListener(
        "focus",
        closeWindow,
        { once: true }
      );
      closeWindow();
    },
    { once: true }
  );
}

function printModel(model) {
  if (!model) return;

  const w = window.open(
    "",
    "_blank",
    "width=1000,height=780"
  );

  if (!w) return;

  const meta = (model.meta || [])
    .filter((item) => String(item?.value ?? "").trim())
    .map(
      (item) =>
        `<div class="meta"><span>${escHtml(
          item.label
        )}:</span> <strong>${escHtml(item.value)}</strong></div>`
    )
    .join("");

  const head = (model.columns || [])
    .map((column) => `<th>${escHtml(column.title)}</th>`)
    .join("");

  const body = (model.rows || [])
    .map(
      (row) =>
        `<tr>${(model.columns || [])
          .map((column) => {
            const cls =
              column.type === "number" ||
              column.type === "integer"
                ? "num"
                : "";
            return `<td class="${cls}">${escHtml(
              row?.[column.key] ?? ""
            )}</td>`;
          })
          .join("")}</tr>`
    )
    .join("");

  const foot = (model.footerRows || [])
    .map(
      (footer) =>
        `<tr class="foot">${(model.columns || [])
          .map((column, index) => {
            if (index === 0) {
              return `<td>${escHtml(footer.label || "")}</td>`;
            }

            const cls =
              column.type === "number" ||
              column.type === "integer"
                ? "num"
                : "";

            return `<td class="${cls}">${escHtml(
              footer?.values?.[column.key] ?? ""
            )}</td>`;
          })
          .join("")}</tr>`
    )
    .join("");

  w.document.open();
  w.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escHtml(model.title || "")}</title>
<style>
@page{size:A4 portrait;margin:12mm}
body{font-family:Arial,sans-serif;font-size:11px;color:#111;margin:0}
h1{text-align:center;font-size:16px;margin:0 0 10px}
.meta{margin:2px 0}.meta span{display:inline-block;min-width:110px;color:#555}
table{width:100%;border-collapse:collapse;margin-top:10px}
th,td{border:1px solid #888;padding:4px 6px;vertical-align:top}
th{background:#eee}.num{text-align:right}.foot td{font-weight:700;background:#f7f7f7}
</style>
</head>
<body>
<h1>${escHtml(model.title || "")}</h1>
${meta}
<table>
<thead><tr>${head}</tr></thead>
<tbody>${body}</tbody>
<tfoot>${foot}</tfoot>
</table>
</body>
</html>`);
  w.document.close();

  w.addEventListener(
    "load",
    () => {
      closePrintWindowAfterPrint(w);
      w.focus();
      w.print();
    },
    { once: true }
  );
}

function ReportToolbar({
  model,
  onBack,
  onExport,
  exportLoading,
  t
}) {
  return (
    <div className="report-toolbar nerasch-report-toolbar">
      <button
        type="button"
        className="report-action-button"
        onClick={onBack}
      >
        {t("Common.Back", "Назад")}
      </button>

      <div className="nerasch-toolbar-spacer" />

      <button
        type="button"
        className="report-action-button report-print-button"
        disabled={!model}
        onClick={() => printModel(model)}
      >
        {t("Common.Print", "Печать")}
      </button>

      <button
        type="button"
        className="report-action-button report-excel-button"
        disabled={!model || exportLoading}
        onClick={() => onExport("xlsx")}
      >
        {t("Common.Excel", "Excel")}
      </button>

      <button
        type="button"
        className="report-action-button report-word-button"
        disabled={!model || exportLoading}
        onClick={() => onExport("docx")}
      >
        {t("Common.Word", "Word")}
      </button>
    </div>
  );
}

export default function NeraschPage({
  data,
  dateFrom,
  dateTo,
  organizationId = 0,
  departmentId = 0,
  all = 1,
  fetchWithAuth,
  locale = "ru-RU",
  t = (key, fallback = "") => fallback
}) {
  const rows = Array.isArray(data) ? data : [];

  const [selectedId, setSelectedId] = useState(null);
  const [reportKind, setReportKind] = useState("");
  const [reportRows, setReportRows] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    setSelectedId((current) => {
      const exists = rows.some(
        (row) => n(row?.IdVS) === n(current)
      );

      return exists
        ? current
        : n(rows[0]?.IdVS) || null;
    });
  }, [rows]);

  const selected = useMemo(
    () =>
      rows.find(
        (row) => n(row?.IdVS) === n(selectedId)
      ) ??
      rows[0] ??
      null,
    [rows, selectedId]
  );

  const bills = Array.isArray(selected?.Bills)
    ? selected.Bills
    : [];

  const client =
    bills
      .map((row) => String(row?.Client ?? "").trim())
      .find(Boolean) || "";

  function openPreview() {
    if (!selected) return;

    setReportKind("preview");
    setReportRows([]);
    setReportError("");
  }

  async function openServerReport(kind) {
    const action = REPORT_ACTIONS[kind];
    if (!action) return;
    if (kind === "raw" && !selected?.IdVS) return;

    setReportKind(kind);
    setReportRows([]);
    setReportError("");
    setReportLoading(true);

    try {
      const url = new URL(
        "https://webback.bar-boss.com/wr_Reports.php"
      );
      url.searchParams.set("Action", action);

      const idBillXml =
        kind === "raw"
          ? `<IdBill>${escXml(selected.IdVS)}</IdBill>`
          : "";

      const xml = `<Report><Date1>${escXml(
        dateFrom
      )}</Date1><Date2>${escXml(
        dateTo
      )}</Date2><Org>${escXml(
        organizationId
      )}</Org><All>${escXml(
        all
      )}</All><Skl>${escXml(
        departmentId
      )}</Skl><IdKli>0</IdKli>${idBillXml}</Report>`;

      const response = await fetchWithAuth(
        url.toString(),
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/xml; charset=utf-8"
          },
          body: xml
        }
      );

      const text = await response.text();
      let result;

      try {
        result = text.trim()
          ? JSON.parse(text)
          : [];
      } catch {
        throw new Error(
          t(
            "Nerasch.ReportInvalidResponse",
            "Отчёт вернул некорректный ответ"
          )
        );
      }

      if (
        !response.ok ||
        (!Array.isArray(result) &&
          result?.status === "error")
      ) {
        throw new Error(
          result?.error ||
            result?.message ||
            t(
              "Nerasch.ReportLoadError",
              "Ошибка загрузки отчёта"
            )
        );
      }

      setReportRows(responseRows(result));
    } catch (err) {
      setReportError(
        err?.message ||
          t(
            "Nerasch.ReportLoadError",
            "Ошибка загрузки отчёта"
          )
      );
    } finally {
      setReportLoading(false);
    }
  }

  function closeReport() {
    setReportKind("");
    setReportRows([]);
    setReportError("");
  }

  const model = useMemo(() => {
    if (!reportKind) return null;

    if (reportKind === "preview") {
      const total = sum(bills, "SummItog");
      const discountSum = sum(bills, "SummDisc");
      const discount =
        bills
          .map((row) => n(row?.Discount))
          .find((value) => value !== 0) || 0;

      const footerRows = [
        {
          label: t("Common.Total", "Итого"),
          values: {
            Amount: money(total, locale)
          }
        }
      ];

      if (discount || discountSum) {
        footerRows.push({
          label: `${t(
            "Nerasch.Discount",
            "Скидка"
          )}${discount ? ` ${qty(discount, locale)}%` : ""}`,
          values: {
            Amount: money(discountSum, locale)
          }
        });
      }

      footerRows.push({
        label: t(
          "Nerasch.ToPay",
          "Итого к оплате"
        ),
        values: {
          Amount: money(
            selected?.Summ ?? total,
            locale
          )
        }
      });

      return {
        title: t(
          "Nerasch.ViewTitle",
          "Просмотр счёта"
        ),
        fileName: `Bill_${filePart(selected?.IdVS)}`,
        orientation: "portrait",
        locale,
        meta: [
          {
            label: t(
              "Nerasch.Created",
              "Дата создания"
            ),
            value: dateTime(selected?.DateSozd)
          },
          {
            label: t("Nerasch.Table", "Стол"),
            value: selected?.Table ?? ""
          },
          {
            label: t(
              "Nerasch.Waiter",
              "Официант"
            ),
            value: selected?.Waiter ?? ""
          },
          ...(client
            ? [
                {
                  label: t(
                    "Nerasch.Client",
                    "Клиент"
                  ),
                  value: client
                }
              ]
            : [])
        ],
        columns: [
          {
            key: "Dish",
            title: t("Nerasch.Dish", "Блюдо"),
            type: "text",
            width: 48
          },
          {
            key: "Quantity",
            title: t(
              "Nerasch.Quantity",
              "Кол-во"
            ),
            type: "number",
            width: 14
          },
          {
            key: "Price",
            title: t("Nerasch.Price", "Цена"),
            type: "number",
            width: 17
          },
          {
            key: "Amount",
            title: t(
              "Nerasch.Amount",
              "Сумма"
            ),
            type: "number",
            width: 18
          }
        ],
        rows: bills.map((row) => ({
          Dish: row?.NameDish ?? "",
          Quantity: qty(row?.Kolvo, locale),
          Price: money(row?.Price, locale),
          Amount: money(row?.SummItog, locale)
        })),
        footerRows
      };
    }

    if (
      reportKind === "raw" ||
      reportKind === "rawPeriod"
    ) {
      return {
        title: t(
          "Nerasch.RawOrderTitle",
          "Заказ сырья предварительный"
        ),
        fileName:
          reportKind === "raw"
            ? `Raw_${filePart(selected?.IdVS)}`
            : `Raw_${filePart(dateFrom)}_${filePart(
                dateTo
              )}`,
        orientation: "portrait",
        locale,
        meta: [
          {
            label:
              reportKind === "raw"
                ? t(
                    "Nerasch.ForBanquet",
                    "На банкет"
                  )
                : t(
                    "Nerasch.ForBanquets",
                    "На банкеты"
                  ),
            value:
              reportKind === "raw"
                ? dateTime(selected?.DateBanket)
                : `${dateOnly(
                    dateFrom
                  )} — ${dateOnly(dateTo)}`
          }
        ],
        columns: [
          {
            key: "Name",
            title: t(
              "Nerasch.RawMaterial",
              "Сырьё"
            ),
            type: "text",
            width: 48
          },
          {
            key: "Quantity",
            title: t(
              "Nerasch.Quantity",
              "Кол-во"
            ),
            type: "number",
            width: 16
          },
          {
            key: "Price",
            title: t(
              "Nerasch.AvgPrice",
              "Ср. цена"
            ),
            type: "number",
            width: 17
          },
          {
            key: "Amount",
            title: t(
              "Nerasch.Amount",
              "Сумма"
            ),
            type: "number",
            width: 17
          }
        ],
        rows: reportRows.map((row) => ({
          Name: row?.NameTov ?? "",
          Quantity: qty(row?.Kolvo, locale),
          Price: money(row?.PriceAvg, locale),
          Amount: money(row?.SummAvg, locale)
        })),
        footerRows: [
          {
            label: t("Common.Total", "Итого"),
            values: {
              Amount: money(
                sum(reportRows, "SummAvg"),
                locale
              )
            }
          }
        ]
      };
    }

    if (reportKind === "bankets") {
      const exportRows = [];

      for (const group of groupBankets(reportRows)) {
        for (const row of group.items) {
          exportRows.push({
            Date: dateOnly(row?.DateBank),
            Time: timeOnly(row?.TimeBank),
            Table: row?.Table ?? "",
            Amount: money(
              row?.["Сумма"],
              locale
            ),
            Advance: money(
              row?.SummAdv,
              locale
            )
          });
        }

        exportRows.push({
          Date: dateOnly(group.date),
          Time: "",
          Table: t(
            "Nerasch.DateSubtotal",
            "Итого за дату"
          ),
          Amount: money(
            sum(group.items, "Сумма"),
            locale
          ),
          Advance: money(
            sum(group.items, "SummAdv"),
            locale
          )
        });
      }

      return {
        title: t(
          "Nerasch.BanketsScheduleTitle",
          "Расписание банкетов"
        ),
        fileName: `Bankets_${filePart(
          dateFrom
        )}_${filePart(dateTo)}`,
        orientation: "portrait",
        locale,
        meta: [
          {
            label: t(
              "Nerasch.Period",
              "Период"
            ),
            value: `${dateOnly(
              dateFrom
            )} — ${dateOnly(dateTo)}`
          }
        ],
        columns: [
          {
            key: "Date",
            title: t(
              "Nerasch.BanquetDate",
              "Дата банкета"
            ),
            type: "text",
            width: 20
          },
          {
            key: "Time",
            title: t(
              "Nerasch.Time",
              "Время"
            ),
            type: "text",
            width: 13
          },
          {
            key: "Table",
            title: t(
              "Nerasch.Table",
              "Стол"
            ),
            type: "text",
            width: 20
          },
          {
            key: "Amount",
            title: t(
              "Nerasch.Amount",
              "Сумма"
            ),
            type: "number",
            width: 22
          },
          {
            key: "Advance",
            title: t(
              "Nerasch.Advance",
              "Аванс"
            ),
            type: "number",
            width: 22
          }
        ],
        rows: exportRows,
        footerRows: [
          {
            label: t("Common.Total", "Итого"),
            values: {
              Amount: money(
                sum(reportRows, "Сумма"),
                locale
              ),
              Advance: money(
                sum(reportRows, "SummAdv"),
                locale
              )
            }
          }
        ]
      };
    }

    if (reportKind === "dishes") {
      const exportRows = [];

      for (const group of groupDishes(reportRows)) {
        for (const row of group.items) {
          exportRows.push({
            Warehouse: group.name,
            Dish: row?.NameDish ?? "",
            Quantity: qty(
              row?.Kolvo,
              locale
            )
          });
        }

        exportRows.push({
          Warehouse: group.name,
          Dish: t(
            "Nerasch.GroupSubtotal",
            "Итого"
          ),
          Quantity: qty(
            sum(group.items, "Kolvo"),
            locale
          )
        });
      }

      return {
        title: t(
          "Nerasch.DishesOrderTitle",
          "Заказ блюд предварительный"
        ),
        fileName: `Dishes_${filePart(
          dateFrom
        )}_${filePart(dateTo)}`,
        orientation: "portrait",
        locale,
        meta: [
          {
            label: t(
              "Nerasch.ForBanquets",
              "На банкеты"
            ),
            value: `${dateOnly(
              dateFrom
            )} — ${dateOnly(dateTo)}`
          }
        ],
        columns: [
          {
            key: "Warehouse",
            title: t(
              "Nerasch.Warehouse",
              "Склад"
            ),
            type: "text",
            width: 30
          },
          {
            key: "Dish",
            title: t(
              "Nerasch.Dish",
              "Блюдо"
            ),
            type: "text",
            width: 52
          },
          {
            key: "Quantity",
            title: t(
              "Nerasch.Quantity",
              "Кол-во"
            ),
            type: "number",
            width: 18
          }
        ],
        rows: exportRows,
        footerRows: []
      };
    }

    return null;
  }, [
    reportKind,
    reportRows,
    selected,
    bills,
    client,
    dateFrom,
    dateTo,
    locale,
    t
  ]);

  async function doExport(format) {
    if (!model || exportLoading) return;

    setExportLoading(true);

    try {
      await exportReportFile({
        fetchWithAuth,
        reportModel: model,
        format,
        errorMessage: t(
          "Nerasch.ExportError",
          "Ошибка экспорта отчёта."
        )
      });
    } catch (err) {
      window.alert(
        err?.message ||
          t(
            "Nerasch.ExportError",
            "Ошибка экспорта отчёта."
          )
      );
    } finally {
      setExportLoading(false);
    }
  }

  if (reportKind) {
    return (
      <div className="nerasch-page nerasch-report-page">
        <ReportToolbar
          model={
            reportLoading || reportError
              ? null
              : model
          }
          onBack={closeReport}
          onExport={doExport}
          exportLoading={exportLoading}
          t={t}
        />

        {reportLoading && (
          <div className="nerasch-report-state">
            {t(
              "Nerasch.LoadingReport",
              "Формируем отчёт..."
            )}
          </div>
        )}

        {reportError && (
          <div className="login-error">
            {reportError}
          </div>
        )}

        {!reportLoading &&
          !reportError &&
          model && (
            <article className="nerasch-report-sheet">
              <header className="nerasch-report-heading">
                <h2>{model.title}</h2>

                {(model.meta || []).map((item) => (
                  <div
                    className="nerasch-report-meta"
                    key={`${item.label}-${item.value}`}
                  >
                    <span>{item.label}:</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </header>

              {reportKind === "preview" && (
                <>
                  <div className="nerasch-report-table-wrap">
                    <table className="nerasch-report-table">
                      <thead>
                        <tr>
                          <th>
                            {t(
                              "Nerasch.Dish",
                              "Блюдо"
                            )}
                          </th>
                          <th className="num">
                            {t(
                              "Nerasch.Quantity",
                              "Кол-во"
                            )}
                          </th>
                          <th className="num">
                            {t(
                              "Nerasch.Price",
                              "Цена"
                            )}
                          </th>
                          <th className="num">
                            {t(
                              "Nerasch.Amount",
                              "Сумма"
                            )}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {bills.map((row, index) => (
                          <tr
                            key={`${row?.NameDish ?? ""}-${index}`}
                          >
                            <td>
                              {row?.NameDish ?? ""}
                            </td>
                            <td className="num">
                              {qty(
                                row?.Kolvo,
                                locale
                              )}
                            </td>
                            <td className="num">
                              {money(
                                row?.Price,
                                locale
                              )}
                            </td>
                            <td className="num">
                              {money(
                                row?.SummItog,
                                locale
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="nerasch-bill-totals">
                    <div>
                      <span>
                        {t(
                          "Common.Total",
                          "Итого"
                        )}
                      </span>
                      <strong>
                        {money(
                          sum(
                            bills,
                            "SummItog"
                          ),
                          locale
                        )}
                      </strong>
                    </div>

                    {(sum(
                      bills,
                      "SummDisc"
                    ) !== 0 ||
                      bills.some(
                        (row) =>
                          n(
                            row?.Discount
                          ) !== 0
                      )) && (
                      <div>
                        <span>
                          {t(
                            "Nerasch.Discount",
                            "Скидка"
                          )}
                          {bills
                            .map((row) =>
                              n(
                                row?.Discount
                              )
                            )
                            .find(
                              (value) =>
                                value !== 0
                            )
                            ? `, ${qty(
                                bills
                                  .map(
                                    (row) =>
                                      n(
                                        row?.Discount
                                      )
                                  )
                                  .find(
                                    (value) =>
                                      value !==
                                      0
                                  ),
                                locale
                              )}%`
                            : ""}
                        </span>
                        <strong>
                          {money(
                            sum(
                              bills,
                              "SummDisc"
                            ),
                            locale
                          )}
                        </strong>
                      </div>
                    )}

                    <div className="grand">
                      <span>
                        {t(
                          "Nerasch.ToPay",
                          "Итого к оплате"
                        )}
                      </span>
                      <strong>
                        {money(
                          selected?.Summ ??
                            sum(
                              bills,
                              "SummItog"
                            ),
                          locale
                        )}
                      </strong>
                    </div>
                  </div>

                  <div className="nerasch-bill-parties">
                    <div>
                      <span>
                        {t(
                          "Nerasch.Waiter",
                          "Официант"
                        )}
                        :
                      </span>
                      <strong>
                        {selected?.Waiter ??
                          "—"}
                      </strong>
                    </div>

                    {client && (
                      <div>
                        <span>
                          {t(
                            "Nerasch.Client",
                            "Клиент"
                          )}
                          :
                        </span>
                        <strong>
                          {client}
                        </strong>
                      </div>
                    )}
                  </div>
                </>
              )}

              {(reportKind === "raw" ||
                reportKind ===
                  "rawPeriod") && (
                <>
                  <div className="nerasch-report-table-wrap">
                    <table className="nerasch-report-table">
                      <thead>
                        <tr>
                          <th>
                            {t(
                              "Nerasch.RawMaterial",
                              "Сырьё"
                            )}
                          </th>
                          <th className="num">
                            {t(
                              "Nerasch.Quantity",
                              "Кол-во"
                            )}
                          </th>
                          <th className="num">
                            {t(
                              "Nerasch.AvgPrice",
                              "Ср. цена"
                            )}
                          </th>
                          <th className="num">
                            {t(
                              "Nerasch.Amount",
                              "Сумма"
                            )}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportRows.map(
                          (row, index) => (
                            <tr
                              key={`${row?.IdTov ?? index}-${row?.NameTov ?? ""}`}
                            >
                              <td>
                                {row?.NameTov ??
                                  ""}
                              </td>
                              <td className="num">
                                {qty(
                                  row?.Kolvo,
                                  locale
                                )}
                              </td>
                              <td className="num">
                                {money(
                                  row?.PriceAvg,
                                  locale
                                )}
                              </td>
                              <td className="num">
                                {money(
                                  row?.SummAvg,
                                  locale
                                )}
                              </td>
                            </tr>
                          )
                        )}

                        {reportRows.length >
                          0 && (
                          <tr className="nerasch-subtotal-row">
                            <td colSpan="3">
                              {t(
                                "Common.Total",
                                "Итого"
                              )}
                            </td>
                            <td className="num">
                              {money(
                                sum(
                                  reportRows,
                                  "SummAvg"
                                ),
                                locale
                              )}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {reportRows.length ===
                    0 && (
                    <div className="report-empty">
                      {t(
                        "Nerasch.NoData",
                        "Нет данных."
                      )}
                    </div>
                  )}
                </>
              )}

              {reportKind ===
                "bankets" && (
                <>
                  {groupBankets(
                    reportRows
                  ).map((group) => (
                    <section
                      className="nerasch-group"
                      key={group.date}
                    >
                      <div className="nerasch-group-title">
                        {dateOnly(
                          group.date
                        )}
                      </div>

                      <div className="nerasch-report-table-wrap">
                        <table className="nerasch-report-table">
                          <thead>
                            <tr>
                              <th>
                                {t(
                                  "Nerasch.Time",
                                  "Время"
                                )}
                              </th>
                              <th>
                                {t(
                                  "Nerasch.Table",
                                  "Стол"
                                )}
                              </th>
                              <th className="num">
                                {t(
                                  "Nerasch.Amount",
                                  "Сумма"
                                )}
                              </th>
                              <th className="num">
                                {t(
                                  "Nerasch.Advance",
                                  "Аванс"
                                )}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.items.map(
                              (
                                row,
                                index
                              ) => (
                                <tr
                                  key={`${group.date}-${row?.Table ?? ""}-${index}`}
                                >
                                  <td>
                                    {timeOnly(
                                      row?.TimeBank
                                    )}
                                  </td>
                                  <td>
                                    {row?.Table ??
                                      ""}
                                  </td>
                                  <td className="num">
                                    {money(
                                      row?.[
                                        "Сумма"
                                      ],
                                      locale
                                    )}
                                  </td>
                                  <td className="num">
                                    {money(
                                      row?.SummAdv,
                                      locale
                                    )}
                                  </td>
                                </tr>
                              )
                            )}

                            <tr className="nerasch-subtotal-row">
                              <td colSpan="2">
                                {t(
                                  "Nerasch.DateSubtotal",
                                  "Итого за дату"
                                )}
                              </td>
                              <td className="num">
                                {money(
                                  sum(
                                    group.items,
                                    "Сумма"
                                  ),
                                  locale
                                )}
                              </td>
                              <td className="num">
                                {money(
                                  sum(
                                    group.items,
                                    "SummAdv"
                                  ),
                                  locale
                                )}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </section>
                  ))}

                  {reportRows.length >
                    0 && (
                    <div className="nerasch-grand-total">
                      <strong>
                        {t(
                          "Common.Total",
                          "Итого"
                        )}
                      </strong>
                      <span>
                        {t(
                          "Nerasch.Amount",
                          "Сумма"
                        )}
                        :{" "}
                        <strong>
                          {money(
                            sum(
                              reportRows,
                              "Сумма"
                            ),
                            locale
                          )}
                        </strong>
                      </span>
                      <span>
                        {t(
                          "Nerasch.Advance",
                          "Аванс"
                        )}
                        :{" "}
                        <strong>
                          {money(
                            sum(
                              reportRows,
                              "SummAdv"
                            ),
                            locale
                          )}
                        </strong>
                      </span>
                    </div>
                  )}

                  {reportRows.length ===
                    0 && (
                    <div className="report-empty">
                      {t(
                        "Nerasch.NoData",
                        "Нет данных."
                      )}
                    </div>
                  )}
                </>
              )}

              {reportKind ===
                "dishes" && (
                <>
                  {groupDishes(
                    reportRows
                  ).map((group) => (
                    <section
                      className="nerasch-group"
                      key={group.key}
                    >
                      <div className="nerasch-group-title">
                        {group.name}
                      </div>

                      <div className="nerasch-report-table-wrap">
                        <table className="nerasch-report-table">
                          <thead>
                            <tr>
                              <th>
                                {t(
                                  "Nerasch.Dish",
                                  "Блюдо"
                                )}
                              </th>
                              <th className="num">
                                {t(
                                  "Nerasch.Quantity",
                                  "Кол-во"
                                )}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.items.map(
                              (
                                row,
                                index
                              ) => (
                                <tr
                                  key={`${group.key}-${row?.NameDish ?? ""}-${index}`}
                                >
                                  <td>
                                    {row?.NameDish ??
                                      ""}
                                  </td>
                                  <td className="num">
                                    {qty(
                                      row?.Kolvo,
                                      locale
                                    )}
                                  </td>
                                </tr>
                              )
                            )}

                            <tr className="nerasch-subtotal-row">
                              <td>
                                {t(
                                  "Nerasch.GroupSubtotal",
                                  "Итого"
                                )}
                              </td>
                              <td className="num">
                                {qty(
                                  sum(
                                    group.items,
                                    "Kolvo"
                                  ),
                                  locale
                                )}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </section>
                  ))}

                  {reportRows.length ===
                    0 && (
                    <div className="report-empty">
                      {t(
                        "Nerasch.NoData",
                        "Нет данных."
                      )}
                    </div>
                  )}
                </>
              )}
            </article>
          )}
      </div>
    );
  }

  return (
    <div className="nerasch-page">
      <div className="module-toolbar nerasch-toolbar">
        <div className="toolbar-left">
          <button
            type="button"
            className="toolbar-save-button nerasch-action-button"
            disabled={!selected}
            onClick={openPreview}
          >
            {t(
              "Nerasch.View",
              "Просмотр"
            )}
          </button>

          <button
            type="button"
            className="toolbar-save-button nerasch-action-button"
            disabled={!selected}
            onClick={() =>
              openServerReport("raw")
            }
          >
            {t("Nerasch.Raw", "Сырьё")}
          </button>

          <button
            type="button"
            className="toolbar-save-button nerasch-action-button"
            onClick={() =>
              openServerReport(
                "rawPeriod"
              )
            }
          >
            {t(
              "Nerasch.RawPeriod",
              "Сырьё за период"
            )}
          </button>

          <button
            type="button"
            className="toolbar-save-button nerasch-action-button"
            onClick={() =>
              openServerReport(
                "bankets"
              )
            }
          >
            {t(
              "Nerasch.BanketsSchedule",
              "Расписание банкетов"
            )}
          </button>

          <button
            type="button"
            className="toolbar-save-button nerasch-action-button"
            onClick={() =>
              openServerReport(
                "dishes"
              )
            }
          >
            {t(
              "Nerasch.DishesPeriod",
              "Блюда за период"
            )}
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="nerasch-empty">
          {t(
            "Nerasch.Empty",
            "Нерасчитанных столов нет."
          )}
        </div>
      ) : (
        <div className="table-wrap nerasch-table-wrap">
          <table className="data-table nerasch-table">
            <thead>
              <tr>
                <th>
                  {t(
                    "Nerasch.Waiter",
                    "Официант"
                  )}
                </th>
                <th>
                  {t(
                    "Nerasch.Table",
                    "Стол"
                  )}
                </th>
                <th className="num">
                  {t(
                    "Nerasch.Amount",
                    "Сумма"
                  )}
                </th>
                <th>
                  {t(
                    "Nerasch.Created",
                    "Дата создания"
                  )}
                </th>
                <th className="num">
                  {t(
                    "Nerasch.Advance",
                    "Аванс"
                  )}
                </th>
                <th>
                  {t(
                    "Nerasch.CashDesk",
                    "Касса"
                  )}
                </th>
                <th>
                  {t(
                    "Nerasch.BanquetDate",
                    "Дата банкета"
                  )}
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => {
                const id = n(row?.IdVS);

                return (
                  <tr
                    key={id}
                    className={
                      id ===
                      n(selected?.IdVS)
                        ? "selected-row"
                        : ""
                    }
                    onClick={() =>
                      setSelectedId(id)
                    }
                    onDoubleClick={
                      openPreview
                    }
                  >
                    <td>
                      {row?.Waiter ?? ""}
                    </td>
                    <td>
                      {row?.Table ?? ""}
                    </td>
                    <td className="num">
                      {money(
                        row?.Summ,
                        locale
                      )}
                    </td>
                    <td>
                      {dateTime(
                        row?.DateSozd
                      )}
                    </td>
                    <td className="num">
                      {money(
                        row?.SummAdv,
                        locale
                      )}
                    </td>
                    <td>
                      {String(
                        row?.UKass ?? ""
                      ).trim() || "—"}
                    </td>
                    <td>
                      {row?.DateBanket
                        ? dateTime(
                            row.DateBanket
                          )
                        : "—"}
                    </td>
                  </tr>
                );
              })}

              <tr className="nerasch-main-total-row">
                <td colSpan="2">
                  {t("Common.Total", "Итого")}
                </td>
                <td className="num">
                  {money(
                    sum(rows, "Summ"),
                    locale
                  )}
                </td>
                <td></td>
                <td className="num">
                  {money(
                    sum(rows, "SummAdv"),
                    locale
                  )}
                </td>
                <td colSpan="2"></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
