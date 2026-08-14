import { useEffect, useMemo, useState } from "react";
import { exportReportFile } from "./reportExport.js";
import "./spisan-tov-report.css";

function normalizeDate(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function formatMoney(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "";
  }

  return numberValue.toFixed(2);
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}


function formatReportDate(value, locale = "ru-RU") {
  if (!value) return "";

  const parts = String(value).slice(0, 10).split("-");
  if (parts.length !== 3) return String(value);

  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);

  const date = new Date(year, month - 1, day);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString(locale);
}

function formatReportNumber(value, locale = "ru-RU", digits = 3) {
  const number = Number(value ?? 0);

  return Number(number || 0).toLocaleString(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function formatReportMoney(value, locale = "ru-RU") {
  return formatReportNumber(value, locale, 2);
}

function makeTempId() {
  return -Date.now() - Math.floor(Math.random() * 1000);
}

const UNSAVED_CHANGES_MESSAGE =
  "Внимание! Вы не сохранили измененные данные!\\nУверены, что хотите уйти?";

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function normalizeRawList(data) {
  const rows = Array.isArray(data) ? data : [];

  return rows
    .map((item) => ({
      ...item,
      ID: Number(item.ID ?? item.Товар ?? item.Tovar ?? item.Tov ?? 0),
      Name: item.Name ?? item.name ?? "",
      Price: Number(item.Price || 0)
    }))
    .filter((item) => Number(item.ID || 0) > 0);
}

function normalizeItem(row) {
  return {
    CodeSpi: Number(row.CodeSpi || 0),
    CodeTov: Number(row.CodeTov || 0),
    Kolvo: Number(row.Kolvo || 0),
    Price: Number(row.Price || 0),
    Summ: Number(row.Summ || 0)
  };
}

function normalizeState(header, rows) {
  return {
    header: {
      ID: Number(header.ID || 0),
      IDzatr: Number(header.IDzatr || 0),
      Nakl: header.Nakl || "",
      DatP: normalizeDate(header.DatP),
      Rem: header.Rem || ""
    },
    items: rows.map(normalizeItem)
  };
}

function SearchableSelect({
  value,
  options,
  placeholder,
  onChange,
  onEnterNext,
  cellIndex,
  t = (key, fallback = "") => fallback
}) {
  const selected = options.find((item) => Number(item.ID) === Number(value));
  const [text, setText] = useState(selected?.Name || "");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const nextSelected = options.find(
      (item) => Number(item.ID) === Number(value)
    );

    setText(nextSelected?.Name || "");
  }, [value, options]);

  const filtered = useMemo(() => {
    const query = text.trim().toLowerCase();

    if (!query) {
      return options.slice(0, 80);
    }

    return options
      .filter((item) => String(item.Name || "").toLowerCase().includes(query))
      .slice(0, 80);
  }, [text, options]);

  function choose(item) {
    onChange(Number(item.ID || 0));
    setText(item.Name || "");
    setOpen(false);

    setTimeout(() => {
      onEnterNext?.(cellIndex);
    }, 0);
  }

  return (
    <div className="searchable-select spisan-tov-invoice-raw-search">
      <input
        data-cell={cellIndex}
        value={text}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            return;
          }

          if (e.key === "Enter") {
            e.preventDefault();

            if (filtered.length === 1) {
              choose(filtered[0]);
              return;
            }

            onEnterNext?.(cellIndex);
          }
        }}
      />

      {open && (
        <div className="searchable-select-list">
          {filtered.length === 0 && (
            <div className="searchable-select-empty">{t("SpisanTovInvoice.SearchNothingFound", "Ничего не найдено")}</div>
          )}

          {filtered.map((item) => (
            <button
              key={item.ID}
              type="button"
              className="searchable-select-option"
              onMouseDown={(e) => {
                e.preventDefault();
                choose(item);
              }}
            >
              {item.Name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


function SpisanTovPrintReport({
  report,
  onBack,
  onExport,
  exportLoading,
  locale,
  t
}) {
  const rows = Array.isArray(report?.rows) ? report.rows : [];

  return (
    <div className="spisan-tov-report-page">
      <div className="spisan-tov-report-toolbar no-print">
        <button
          type="button"
          className="spisan-tov-report-button"
          onClick={onBack}
        >
          {t("Common.Back", "Назад")}
        </button>

        <div className="spisan-tov-report-toolbar-right">
          <button
            type="button"
            className="spisan-tov-report-button"
            disabled={Boolean(exportLoading)}
            onClick={() => onExport?.("xlsx")}
          >
            {t("Common.Excel", "Excel")}
          </button>

          <button
            type="button"
            className="spisan-tov-report-button"
            disabled={Boolean(exportLoading)}
            onClick={() => onExport?.("docx")}
          >
            {t("Common.Word", "Word")}
          </button>

          <button
            type="button"
            className="spisan-tov-report-button primary"
            disabled={Boolean(exportLoading)}
            onClick={() => window.print()}
          >
            {t("Common.Print", "Печать")}
          </button>
        </div>
      </div>

      <article className="spisan-tov-report-sheet">
        <header className="spisan-tov-report-header">
          <h1>
            {report?.title || t("SpisanTovInvoice.ReportTitle", "Накладная списания сырья")}
          </h1>

          <div className="spisan-tov-report-meta">
            <div>
              <span>{t("SpisanTovInvoice.Date", "Дата")}</span>
              <strong>{formatReportDate(report?.date, locale)}</strong>
            </div>

            <div>
              <span>{t("SpisanTovInvoice.Expenses", "Затраты")}</span>
              <strong>{report?.expense || "—"}</strong>
            </div>

            {report?.note ? (
              <div className="wide">
                <span>{t("SpisanTovInvoice.Note", "Примечание")}</span>
                <strong>{report.note}</strong>
              </div>
            ) : null}
          </div>
        </header>

        <div className="spisan-tov-report-table-wrap">
          <table className="spisan-tov-report-table">
            <colgroup>
              <col className="col-index" />
              <col className="col-name" />
              <col className="col-qty" />
              <col className="col-price" />
              <col className="col-sum" />
            </colgroup>

            <thead>
              <tr>
                <th>№</th>
                <th>{t("SpisanTovInvoice.RawMaterial", "Сырьё")}</th>
                <th className="num">{t("SpisanTovInvoice.Quantity", "Кол-во")}</th>
                <th className="num">{t("SpisanTovInvoice.Price", "Цена")}</th>
                <th className="num">{t("SpisanTovInvoice.Amount", "Сумма")}</th>
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan="5" className="empty">
                    {t("SpisanTovInvoice.EmptyRows", "Строки не добавлены.")}
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr key={`${row.ID || "row"}-${index}`}>
                    <td className="center">{index + 1}</td>
                    <td>{row.Name || "—"}</td>
                    <td className="num">
                      {formatReportNumber(row.Kolvo, locale, 3)}
                    </td>
                    <td className="num">
                      {formatReportMoney(row.Price, locale)}
                    </td>
                    <td className="num">
                      {formatReportMoney(row.Summ, locale)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            <tfoot>
              <tr>
                <td colSpan="4">{t("Common.Total", "Итого")}</td>
                <td className="num">
                  {formatReportMoney(report?.total, locale)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </article>
    </div>
  );
}

export default function SpisanTovInvoicePage({
  initialData,
  currentSklad,
  fetchWithAuth,
  onBack,
  onDirtyChange,
  t = (key, fallback = "") => fallback,
  locale = "ru-RU"
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [printReport, setPrintReport] = useState(null);
  const [exportLoading, setExportLoading] = useState(false);

  const [header, setHeader] = useState(null);
  const [rows, setRows] = useState([]);

  const [zatrList, setZatrList] = useState([]);
  const [rawList, setRawList] = useState([]);

  const [deletedIds, setDeletedIds] = useState([]);
  const [originalState, setOriginalState] = useState(null);

  const totalSumm = rows.reduce(
    (sum, row) => sum + Number(row.Summ || 0),
    0
  );

  const currentState = header ? normalizeState(header, rows) : null;

  const isDirty = Boolean(
    deletedIds.length > 0 ||
      (
        originalState &&
        currentState &&
        JSON.stringify(currentState) !== JSON.stringify(originalState)
      )
  );

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
    loadData();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData, currentSklad]);

  async function loadData() {
    if (!initialData) return;

    setLoading(true);
    setError("");

    try {
      const [zatrResponse, rawResponse] = await Promise.all([
        fetchWithAuth("https://webback.bar-boss.com/wf_ZatrSpis.php"),
        fetchWithAuth(
          `https://webback.bar-boss.com/wf_SpisokTovNalich.php?Sklad=${encodeURIComponent(
            currentSklad
          )}`
        )
      ]);

      const zatrData = await zatrResponse.json();
      const rawData = await rawResponse.json();

const normalizedHeader = {
  ID: Number(initialData.ID || 0),
  IDzatr: Number(initialData.IDzatr || 0),
  Nakl: initialData.Nakl || "",
  DatP: normalizeDate(initialData.DatP),
  Sklad: Number(currentSklad || 0),
  Summ: Number(initialData.Summ || 0),
  Rem: initialData.Rem || ""
};

      const loadedRows = Array.isArray(initialData.items)
        ? initialData.items.map((row) => ({
            CodeSpi: Number(row.CodeSpi || 0),
            CodeTov: Number(row.CodeTov || 0),
            Kolvo: Number(row.Kolvo || 0),
            Price: Number(row.Price || 0),
            Summ: Number(row.Summ || 0),
            Name: row.Name || ""
          }))
        : [];

      setHeader(normalizedHeader);
      setRows(loadedRows);
      setZatrList(Array.isArray(zatrData) ? zatrData : []);
      setRawList(normalizeRawList(rawData));
      setDeletedIds([]);
      setOriginalState(normalizeState(normalizedHeader, loadedRows));
    } catch (err) {
      setError(err.message || t("SpisanTovInvoice.LoadError", "Ошибка загрузки накладной списания"));
    } finally {
      setLoading(false);
    }
  }

  function isRowDirty(row) {
    if (!originalState) return false;

    const originalRow = originalState.items.find(
      (item) => Number(item.CodeSpi) === Number(row.CodeSpi)
    );

    if (!originalRow) return true;

    return (
      JSON.stringify(normalizeItem(row)) !==
      JSON.stringify(originalRow)
    );
  }

  function handleBackClick() {
    if (isDirty && !window.confirm(t("SpisanTovInvoice.UnsavedChangesWarning", UNSAVED_CHANGES_MESSAGE))) {
      return;
    }

    onDirtyChange?.(false);
    onBack?.();
  }

  function updateHeaderField(field, value) {
    setHeader((prev) => ({
      ...prev,
      [field]: value
    }));
  }

  function updateRow(rowId, patch) {
    setRows((prevRows) =>
      prevRows.map((row) => {
        if (row.CodeSpi !== rowId) return row;

        const nextRow = {
          ...row,
          ...patch
        };

        if ("Kolvo" in patch || "Price" in patch) {
          nextRow.Summ = roundMoney(
            Number(nextRow.Kolvo || 0) * Number(nextRow.Price || 0)
          );
        }

        return nextRow;
      })
    );
  }

  function addRow() {
    setRows((prevRows) => [
      ...prevRows,
      {
        CodeSpi: makeTempId(),
        CodeTov: 0,
        Kolvo: 0,
        Price: 0,
        Summ: 0,
        Name: ""
      }
    ]);
  }

  function deleteRow(rowId) {
    const ok = window.confirm(t("SpisanTovInvoice.DeleteRowConfirm", "Удалить строку?"));
    if (!ok) return;

    setRows((prevRows) => prevRows.filter((row) => row.CodeSpi !== rowId));

    if (rowId > 0) {
      setDeletedIds((prev) => [...prev, rowId]);
    }
  }

  function focusNextCell(currentCell) {
    const current = Number(currentCell || 0);
    const next = document.querySelector(`[data-cell="${current + 1}"]`);

    if (next) {
      next.focus();

      if (typeof next.select === "function") {
        next.select();
      }
    }
  }

  function handleCellKeyDown(e) {
    if (e.key !== "Enter") return;

    e.preventDefault();
    focusNextCell(e.currentTarget.dataset.cell);
  }

  function buildSaveXml() {
    const itemsXml = rows
      .filter((row) => Number(row.CodeTov || 0) > 0)
      .map((row) => {
        return `    <Item ID="${Number(row.CodeSpi || 0)}" Tov="${Number(
          row.CodeTov || 0
        )}" Kolvo="${Number(row.Kolvo || 0)}" Price="${Number(
          row.Price || 0
        )}" />`;
      })
      .join("\n");

    const deletedXml = deletedIds
      .filter((id) => Number(id) > 0)
      .map((id) => `    <Item ID="${Number(id)}" />`)
      .join("\n");

 return `<SpisanTov>
  <Head ID="${Number(header.ID || 0)}" Nakl="${escapeXml(
      header.Nakl || ""
    )}" DatP="${escapeXml(header.DatP || "")}" Sklad="${Number(
      header.Sklad || 0
    )}" IDzatr="${Number(header.IDzatr || 0)}" Rem="${escapeXml(
      header.Rem || ""
    )}" />

  <Items>
${itemsXml}
  </Items>

  <Deleted>
${deletedXml}
  </Deleted>
</SpisanTov>`;
  }


  function getExpenseName() {
    const expense = zatrList.find(
      (item) => Number(item.ID || 0) === Number(header?.IDzatr || 0)
    );

    return expense?.Name || "";
  }

  function buildPrintReport() {
    const reportTitle = t(
      "SpisanTovInvoice.ReportTitle",
      "Накладная списания сырья"
    );

    return {
      title: `${reportTitle}${header?.Nakl ? ` № ${header.Nakl}` : ""}`,
      date: header?.DatP || "",
      expense: getExpenseName(),
      note: header?.Rem || "",
      total: totalSumm,
      rows: rows.map((row) => ({
        ID: Number(row.CodeSpi || 0),
        Name: row.Name || "",
        Kolvo: Number(row.Kolvo || 0),
        Price: Number(row.Price || 0),
        Summ: Number(row.Summ || 0)
      }))
    };
  }

  function buildExportReport(report) {
    return {
      title: report.title,
      fileName: `SpisanTov_${String(header?.Nakl || header?.ID || "report")}`,
      orientation: "portrait",
      locale,
      meta: [
        {
          label: t("SpisanTovInvoice.Date", "Дата"),
          value: formatReportDate(report.date, locale)
        },
        {
          label: t("SpisanTovInvoice.Expenses", "Затраты"),
          value: report.expense || "—"
        },
        ...(report.note
          ? [
              {
                label: t("SpisanTovInvoice.Note", "Примечание"),
                value: report.note
              }
            ]
          : [])
      ],
      columns: [
        { key: "No", title: "№", type: "integer", width: 6 },
        {
          key: "Name",
          title: t("SpisanTovInvoice.RawMaterial", "Сырьё"),
          type: "text",
          width: 44
        },
        {
          key: "Kolvo",
          title: t("SpisanTovInvoice.Quantity", "Кол-во"),
          type: "number",
          decimals: 3,
          width: 14
        },
        {
          key: "Price",
          title: t("SpisanTovInvoice.Price", "Цена"),
          type: "number",
          decimals: 2,
          width: 14
        },
        {
          key: "Summ",
          title: t("SpisanTovInvoice.Amount", "Сумма"),
          type: "number",
          decimals: 2,
          width: 16
        }
      ],
      rows: report.rows.map((row, index) => ({
        No: index + 1,
        Name: row.Name,
        Kolvo: row.Kolvo,
        Price: row.Price,
        Summ: row.Summ
      })),
      footerRows: [
        {
          label: t("Common.Total", "Итого"),
          values: {
            Summ: Number(report.total || 0)
          }
        }
      ]
    };
  }

  function handleOpenPrintPreview() {
    setPrintReport(buildPrintReport());
  }

  async function handleExport(format) {
    if (!printReport || exportLoading) return;

    setExportLoading(true);

    try {
      await exportReportFile({
        fetchWithAuth,
        reportModel: buildExportReport(printReport),
        format,
        errorMessage: t("Report.ExportError", "Ошибка экспорта отчёта.")
      });
    } catch (err) {
      window.alert(
        err?.message ||
          t("Report.ExportError", "Ошибка экспорта отчёта.")
      );
    } finally {
      setExportLoading(false);
    }
  }

  async function handleSave() {
    if (Number(header?.IDzatr || 0) <= 0) {
      alert(t("SpisanTovInvoice.ExpenseRequired", "!!! Выберите статью затрат."));
      return;
    }

    const xml = buildSaveXml();

    try {
      const body = new URLSearchParams();

      body.set("Action", "SaveSpisanTov");
      body.set("xml", xml);

      const response = await fetchWithAuth(
        "https://webback.bar-boss.com/wf_RefSave.php",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
          },
          body
        }
      );

      const text = await response.text();

      let data;

      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(t("SpisanTovInvoice.ServerNonJsonPrefix", "Сервер вернул не JSON:") + " " + text.substring(0, 500));
      }

      if (!response.ok || data.status !== "success") {
        throw new Error(data.error || t("SpisanTovInvoice.SaveError", "Ошибка сохранения накладной списания"));
      }

      onDirtyChange?.(false);
      onBack?.();
    } catch (err) {
      alert(err.message || t("SpisanTovInvoice.SaveError", "Ошибка сохранения накладной списания"));
    }
  }


  if (printReport) {
    return (
      <SpisanTovPrintReport
        report={printReport}
        onBack={() => setPrintReport(null)}
        onExport={handleExport}
        exportLoading={exportLoading}
        locale={locale}
        t={t}
      />
    );
  }

  if (loading) {
    return <p>{t("SpisanTovInvoice.Loading", "Загрузка накладной...")}</p>;
  }

  if (error) {
    return <p className="error-text">{error}</p>;
  }

  if (!header) {
    return <p>{t("SpisanTovInvoice.NotSelected", "Накладная не выбрана.")}</p>;
  }

  let cellIndex = 1;

  return (
    <div className="prih-page spisan-tov-invoice-page">
      <div className="form-header-panel prih-form-header spisan-tov-invoice-form-header">
        <div className="page-toolbar">
        <button
          type="button"
          className="back-to-list-button prih-back-button spisan-tov-invoice-back-button"
          onClick={handleBackClick}
        >
          ← {t("SpisanTovInvoice.BackToList", "К списку списаний")}
        </button>

        <button
          type="button"
          className="primary-button spisan-tov-invoice-save-button"
          disabled={!isDirty}
          onClick={handleSave}
        >
          {t("SpisanTovInvoice.Save", "Сохранить")}
        </button>

        <button
          type="button"
          className="toolbar-button"
          disabled={isDirty || rows.length === 0}
          onClick={handleOpenPrintPreview}
        >
          {t("Common.Print", "Печать")}
        </button>
      </div>

      <div className="prih-title spisan-tov-invoice-title">
        {t("SpisanTovInvoice.Title", "Накладная списания")} № <strong>{header.Nakl}</strong> {t("SpisanTovInvoice.DateSeparator", "от")}{" "}
        <strong>{header.DatP}</strong>
      </div>

      <div className="prih-header-grid spisan-tov-invoice-header-grid">
        <label className="calc-field">
          <span>{t("SpisanTovInvoice.Number", "Номер")}</span>
          <input
            value={header.Nakl}
            onChange={(e) => updateHeaderField("Nakl", e.target.value)}
          />
        </label>

        <label className="calc-field">
          <span>{t("SpisanTovInvoice.Date", "Дата")}</span>
          <input
            type="date"
            value={header.DatP}
            onChange={(e) => updateHeaderField("DatP", e.target.value)}
          />
        </label>

        <label className="calc-field">
          <span>{t("SpisanTovInvoice.Expenses", "Затраты")}</span>

          <select
            value={header.IDzatr}
            onChange={(e) =>
              updateHeaderField("IDzatr", Number(e.target.value || 0))
            }
          >
            <option value="0">{t("SpisanTovInvoice.SelectExpenses", "Выберите затраты...")}</option>

            {zatrList.map((item) => (
              <option key={item.ID} value={item.ID}>
                {item.Name}
              </option>
            ))}
          </select>
        </label>

<label className="calc-field calc-field-wide spisan-tov-invoice-rem-field">
  <span>{t("SpisanTovInvoice.Note", "Примечание")}</span>

  <input
    value={header.Rem || ""}
    onChange={(e) => updateHeaderField("Rem", e.target.value)}
  />
</label>

        <div className="calc-info">
          <span>{t("SpisanTovInvoice.AmountLabel", "Сумма:")}</span>
          <strong>{formatMoney(totalSumm)}</strong>
        </div>
      </div>
      </div>

      <div className="calc-panel-title prih-items-title spisan-tov-invoice-items-title">
        <span>{t("SpisanTovInvoice.ContentsTitle", "Содержимое списания")}</span>

        <button
          type="button"
          className="prih-add-row-button spisan-tov-invoice-add-row-button"
          onClick={addRow}
        >
          + {t("SpisanTovInvoice.AddRow", "строка")}
        </button>
      </div>

      <div className="table-wrap prih-table-wrap spisan-tov-invoice-table-wrap">
        <table className="data-table prih-table spisan-tov-invoice-table">
          <colgroup>
            <col className="spisan-tov-invoice-col-raw" />
            <col className="spisan-tov-invoice-col-qty" />
            <col className="spisan-tov-invoice-col-price" />
            <col className="spisan-tov-invoice-col-amount" />
            <col className="spisan-tov-invoice-col-delete" />
          </colgroup>

          <thead>
            <tr>
              <th>{t("SpisanTovInvoice.RawMaterial", "Сырьё")}</th>
              <th>{t("SpisanTovInvoice.Quantity", "Кол-во")}</th>
              <th>{t("SpisanTovInvoice.Price", "Цена")}</th>
              <th>{t("SpisanTovInvoice.Amount", "Сумма")}</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="spisan-tov-invoice-empty-row" colSpan={5}>{t("SpisanTovInvoice.EmptyRows", "Строки не добавлены.")}</td>
              </tr>
            )}

            {rows.map((row) => (
              <tr
                key={row.CodeSpi}
                className={isRowDirty(row) ? "changed-row" : ""}
              >
                <td>
                  <SearchableSelect
                    value={row.CodeTov}
                    options={rawList}
                    placeholder={t("SpisanTovInvoice.SelectRawMaterial", "Выберите сырьё...")}
                    cellIndex={cellIndex++}
                    onEnterNext={focusNextCell}
                    t={t}
                    onChange={(value) => {
                      const selectedRaw = rawList.find(
                        (item) => Number(item.ID) === Number(value)
                      );

                      updateRow(row.CodeSpi, {
                        CodeTov: value,
                        ...(selectedRaw
                          ? {
                              Price: Number(selectedRaw.Price || 0),
                              Name: selectedRaw.Name || ""
                            }
                          : {})
                      });
                    }}
                  />
                </td>

                <td>
                  <input
                    data-cell={cellIndex++}
                    type="number"
                    step="0.001"
                    value={row.Kolvo}
                    onKeyDown={handleCellKeyDown}
                    onChange={(e) =>
                      updateRow(row.CodeSpi, {
                        Kolvo: Number(e.target.value || 0)
                      })
                    }
                  />
                </td>

                <td>
                  <input
                    data-cell={cellIndex++}
                    type="number"
                    step="0.01"
                    value={row.Price}
                    onKeyDown={handleCellKeyDown}
                    onChange={(e) =>
                      updateRow(row.CodeSpi, {
                        Price: Number(e.target.value || 0)
                      })
                    }
                  />
                </td>

                <td className="text-right">{formatMoney(row.Summ)}</td>

                <td>
                  <button
                    type="button"
                    className="small-danger-button spisan-tov-invoice-delete-button"
                    title={t("SpisanTovInvoice.DeleteRow", "Удалить строку")}
                    aria-label={t("SpisanTovInvoice.DeleteRow", "Удалить строку")}
                    onClick={() => deleteRow(row.CodeSpi)}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}