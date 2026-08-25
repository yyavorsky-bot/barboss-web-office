import { useEffect, useMemo, useState } from "react";
import { exportReportFile } from "./reportExport.js";
import "./spisan-blud-report.css";

function normalizeDate(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function formatQty(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "";
  }

  return numberValue.toFixed(2);
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

function getCurrentLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createEmptySpisanBludRow() {
  return {
    ID: makeTempId(),
    CodeBluda: 0,
    Name: "",
    SkladName: "",
    Kolvo: 0
  };
}

function isBlankSpisanBludDraftRow(row) {
  return (
    Number(row?.ID || 0) < 0 &&
    Number(row?.CodeBluda || 0) <= 0 &&
    Number(row?.Kolvo || 0) === 0 &&
    !String(row?.Name || "").trim() &&
    !String(row?.SkladName || "").trim()
  );
}

function ensureTrailingSpisanBludDraftRow(sourceRows) {
  const source = Array.isArray(sourceRows) ? sourceRows : [];
  const existingDraft = [...source]
    .reverse()
    .find(isBlankSpisanBludDraftRow);
  const actualRows = source.filter(
    (row) => !isBlankSpisanBludDraftRow(row)
  );

  return [
    ...actualRows,
    existingDraft || createEmptySpisanBludRow()
  ];
}

const UNSAVED_CHANGES_MESSAGE =
  "Внимание! Вы не сохранили измененные данные!\nУверены, что хотите уйти?";

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function normalizeDishList(data) {
  const rows = Array.isArray(data) ? data : [];

  return rows
    .map((item) => ({
      ...item,
      ID: Number(item.ID || 0),
      Name: item.Name || "",
      SkladName: item.SkladName || ""
    }))
    .filter((item) => Number(item.ID || 0) > 0);
}

function normalizeItem(row) {
  return {
    ID: Number(row.ID || 0),
    CodeBluda: Number(row.CodeBluda || 0),
    Kolvo: Number(row.Kolvo || 0)
  };
}

function normalizeState(header, rows) {
  return {
    header: {
      ID: Number(header.ID || 0),
      Nakl: header.Nakl || "",
      DateP: normalizeDate(header.DateP),
      CodSpis: Number(header.CodSpis || 0),
      Rem: header.Rem || ""
    },

    items: rows
      .filter((row) => !isBlankSpisanBludDraftRow(row))
      .map(normalizeItem)
  };
}

function SearchableSelect({
  value,
  options,
  placeholder,
  onChange,
  onEnterNext,
  onArrowNavigate,
  cellIndex,
  disabled = false,
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
      .filter((item) =>
        `${item.Name || ""} ${item.SkladName || ""}`
          .toLowerCase()
          .includes(query)
      )
      .slice(0, 80);
  }, [text, options]);

  function choose(item) {
    if (disabled) return;
    onChange(Number(item.ID || 0));
    setText(item.Name || "");
    setOpen(false);

    setTimeout(() => {
      onEnterNext?.(cellIndex);
    }, 0);
  }

  return (
    <div className="searchable-select spisan-blud-invoice-dish-search">
      <input
        data-cell={cellIndex}
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            onArrowNavigate?.(e);

            if (e.defaultPrevented) {
              setOpen(false);
              return;
            }
          }

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

      {open && !disabled && (
        <div className="searchable-select-list">
          {filtered.length === 0 && (
            <div className="searchable-select-empty">
              {t("SpisanBludInvoice.SearchNothingFound", "Ничего не найдено")}
            </div>
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
              <span>{item.Name}</span>

              {item.SkladName && (
                <small className="spisan-blud-invoice-search-warehouse">
                  {item.SkladName}
                </small>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


function SpisanBludPrintReport({
  report,
  onBack,
  onExport,
  exportLoading,
  locale,
  t
}) {
  const rows = Array.isArray(report?.rows) ? report.rows : [];

  return (
    <div className="spisan-blud-report-page">
      <div className="spisan-blud-report-toolbar no-print">
        <button
          type="button"
          className="spisan-blud-report-button"
          onClick={onBack}
        >
          {t("Common.Back", "Назад")}
        </button>

        <div className="spisan-blud-report-toolbar-right">
          <button
            type="button"
            className="spisan-blud-report-button"
            disabled={Boolean(exportLoading)}
            onClick={() => onExport?.("xlsx")}
          >
            {t("Common.Excel", "Excel")}
          </button>

          <button
            type="button"
            className="spisan-blud-report-button"
            disabled={Boolean(exportLoading)}
            onClick={() => onExport?.("docx")}
          >
            {t("Common.Word", "Word")}
          </button>

          <button
            type="button"
            className="spisan-blud-report-button primary"
            disabled={Boolean(exportLoading)}
            onClick={() => window.print()}
          >
            {t("Common.Print", "Печать")}
          </button>
        </div>
      </div>

      <article className="spisan-blud-report-sheet">
        <header className="spisan-blud-report-header">
          <h1>{report?.title || t("SpisanBludInvoice.Title", "Накладная списания блюд")}</h1>

          <div className="spisan-blud-report-meta">
            <div>
              <span>{t("SpisanBludInvoice.Date", "Дата")}</span>
              <strong>{formatReportDate(report?.date, locale)}</strong>
            </div>

            <div>
              <span>{t("SpisanBludInvoice.Expenses", "Затраты")}</span>
              <strong>{report?.expense || "—"}</strong>
            </div>

            {report?.note ? (
              <div className="wide">
                <span>{t("SpisanBludInvoice.Note", "Примечание")}</span>
                <strong>{report.note}</strong>
              </div>
            ) : null}
          </div>
        </header>

        <div className="spisan-blud-report-table-wrap">
          <table className="spisan-blud-report-table">
            <colgroup>
              <col className="col-index" />
              <col className="col-dish" />
              <col className="col-warehouse" />
              <col className="col-qty" />
            </colgroup>

            <thead>
              <tr>
                <th>№</th>
                <th>{t("SpisanBludInvoice.Dish", "Блюдо")}</th>
                <th>{t("SpisanBludInvoice.Warehouse", "Склад")}</th>
                <th className="num">{t("SpisanBludInvoice.Quantity", "Кол-во")}</th>
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan="4" className="empty">
                    {t("SpisanBludInvoice.EmptyRows", "Строки не добавлены.")}
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr key={`${row.ID || "row"}-${index}`}>
                    <td className="center">{index + 1}</td>
                    <td>{row.Name || "—"}</td>
                    <td>{row.SkladName || "—"}</td>
                    <td className="num">
                      {formatReportNumber(row.Kolvo, locale, 3)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}

export default function SpisanBludInvoicePage({
  initialData,
  fetchWithAuth,
  readOnly = false,
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
  const [dishList, setDishList] = useState([]);

  const [deletedIds, setDeletedIds] = useState([]);
  const [originalState, setOriginalState] = useState(null);

  const totalQty = rows.reduce(
    (sum, row) => sum + Number(row.Kolvo || 0),
    0
  );

  const currentState = header ? normalizeState(header, rows) : null;

  const isDirty = !readOnly && Boolean(
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
  }, [initialData, readOnly]);

  async function loadData() {
    if (!initialData) return;

    setLoading(true);
    setError("");

    try {
      const [zatrResponse, dishResponse] = await Promise.all([
        fetchWithAuth("https://webback.bar-boss.com/wf_ZatrSpis.php"),
        fetchWithAuth("https://webback.bar-boss.com/wf_DishesAll.php")
      ]);

      const zatrData = await zatrResponse.json();
      const dishData = await dishResponse.json();

      const normalizedHeader = {
        ID: Number(initialData.ID || 0),
        Nakl: initialData.Nakl || "",
        DateP: normalizeDate(initialData.DateP) || getCurrentLocalDate(),
        CodSpis: Number(initialData.CodSpis || 0),
        NazvSpisania: initialData.NazvSpisania || "",
        Rem: initialData.Rem || ""
      };

const loadedRows = Array.isArray(initialData.items)
  ? initialData.items.map((row) => ({
      ID: Number(row.ID || makeTempId()),
      CodeBluda: Number(row.CodeBluda || 0),
      Name: row.Name || "",
      SkladName: row.SkladName || "",
      Kolvo: Number(row.Kolvo || 0)
    }))
  : [];

      setHeader(normalizedHeader);
      setRows(
        readOnly
          ? loadedRows
          : ensureTrailingSpisanBludDraftRow(loadedRows)
      );
      setZatrList(Array.isArray(zatrData) ? zatrData : []);
      setDishList(normalizeDishList(dishData));
      setDeletedIds([]);
      setOriginalState(normalizeState(normalizedHeader, loadedRows));
    } catch (err) {
      setError(err.message || t("SpisanBludInvoice.LoadError", "Ошибка загрузки накладной списания блюд"));
    } finally {
      setLoading(false);
    }
  }

  function isRowDirty(row) {
    if (isBlankSpisanBludDraftRow(row)) return false;
    if (!originalState) return false;

    const originalRow = originalState.items.find(
      (item) => Number(item.ID) === Number(row.ID)
    );

    if (!originalRow) return true;

    return (
      JSON.stringify(normalizeItem(row)) !==
      JSON.stringify(originalRow)
    );
  }

  function handleBackClick() {
    if (isDirty && !window.confirm(t("SpisanBludInvoice.UnsavedChangesWarning", UNSAVED_CHANGES_MESSAGE))) {
      return;
    }

    onDirtyChange?.(false);
    onBack?.();
  }

  function updateHeaderField(field, value) {
    if (readOnly) return;
    setHeader((prev) => ({
      ...prev,
      [field]: value
    }));
  }

  function updateRow(rowId, patch) {
    if (readOnly) return;
    setRows((prevRows) => {
      const nextRows = prevRows.map((row) => {
        if (row.ID !== rowId) return row;

        return {
          ...row,
          ...patch
        };
      });

      return ensureTrailingSpisanBludDraftRow(nextRows);
    });
  }

  function deleteRow(rowId) {
    if (readOnly) return;
    const rowToDelete = rows.find(
      (row) => Number(row.ID) === Number(rowId)
    );

    if (!rowToDelete || isBlankSpisanBludDraftRow(rowToDelete)) {
      return;
    }

    const ok = window.confirm(t("SpisanBludInvoice.DeleteRowConfirm", "Удалить строку?"));
    if (!ok) return;

    setRows((prevRows) =>
      ensureTrailingSpisanBludDraftRow(
        prevRows.filter((row) => row.ID !== rowId)
      )
    );

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

  function handleInvoiceCellArrowNavigation(event) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    const target = event.currentTarget;

    if (!(target instanceof HTMLElement)) return;

    const currentRow = target.closest("tr");
    const currentCell = target.closest("td");
    const tbody = currentRow?.parentElement;

    if (!currentRow || !currentCell || !tbody) return;

    const tableRows = Array.from(tbody.children).filter(
      (element) => element instanceof HTMLTableRowElement
    );
    const currentRowIndex = tableRows.indexOf(currentRow);
    const currentCellIndex = Array.from(currentRow.children).indexOf(currentCell);

    if (currentRowIndex < 0 || currentCellIndex < 0) return;

    // Перехватываем стрелку всегда, в том числе на первой/последней строке:
    // браузер не должен менять number или прокручивать рабочую область.
    event.preventDefault();

    const direction = event.key === "ArrowDown" ? 1 : -1;
    const nextRow = tableRows[currentRowIndex + direction];

    if (!nextRow) return;

    const nextCell = nextRow.children[currentCellIndex];

    if (!(nextCell instanceof HTMLTableCellElement)) return;

    const nextControl = nextCell.querySelector(
      "input:not(:disabled), select:not(:disabled), textarea:not(:disabled)"
    );

    if (!(nextControl instanceof HTMLElement)) return;

    nextControl.focus();

    if (typeof nextControl.select === "function") {
      nextControl.select();
    }
  }

  function handleInvoiceCellKeyDown(event) {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      handleInvoiceCellArrowNavigation(event);
      return;
    }

    handleCellKeyDown(event);
  }

  function buildSaveXml() {
    const itemsXml = rows
      .filter((row) => Number(row.CodeBluda || 0) > 0)
      .map((row) => {
return `    <Item ID="${Number(row.ID || 0)}" CodeBluda="${Number(
  row.CodeBluda || 0
)}" Kolvo="${Number(row.Kolvo || 0)}" />`;
      })
      .join("\n");

    const deletedXml = deletedIds
      .filter((id) => Number(id) > 0)
      .map((id) => `    <Item ID="${Number(id)}" />`)
      .join("\n");

    return `<SpisanBlud>
<Head ID="${Number(header.ID || 0)}" DateP="${escapeXml(
  header.DateP || ""
)}" CodSpis="${Number(header.CodSpis || 0)}" Rem="${escapeXml(
  header.Rem || ""
)}" />


  <Items>
${itemsXml}
  </Items>

  <Deleted>
${deletedXml}
  </Deleted>
</SpisanBlud>`;
  }


  function getExpenseName() {
    const expense = zatrList.find(
      (item) => Number(item.ID || 0) === Number(header?.CodSpis || 0)
    );

    return expense?.Name || header?.NazvSpisania || "";
  }

  function buildPrintReport() {
    const reportTitle = t(
      "SpisanBludInvoice.Title",
      "Накладная списания блюд"
    );

    return {
      title: `${reportTitle}${header?.Nakl ? ` № ${header.Nakl}` : ""}`,
      date: header?.DateP || "",
      expense: getExpenseName(),
      note: header?.Rem || "",
      rows: rows
        .filter((row) => !isBlankSpisanBludDraftRow(row))
        .map((row) => ({
          ID: Number(row.ID || 0),
          Name: row.Name || "",
          SkladName: row.SkladName || "",
          Kolvo: Number(row.Kolvo || 0)
        }))
    };
  }

  function buildExportReport(report) {
    return {
      title: report.title,
      fileName: `SpisanBlud_${String(header?.Nakl || header?.ID || "report")}`,
      orientation: "portrait",
      locale,
      meta: [
        {
          label: t("SpisanBludInvoice.Date", "Дата"),
          value: formatReportDate(report.date, locale)
        },
        {
          label: t("SpisanBludInvoice.Expenses", "Затраты"),
          value: report.expense || "—"
        },
        ...(report.note
          ? [
              {
                label: t("SpisanBludInvoice.Note", "Примечание"),
                value: report.note
              }
            ]
          : [])
      ],
      columns: [
        { key: "No", title: "№", type: "integer", width: 6 },
        {
          key: "Name",
          title: t("SpisanBludInvoice.Dish", "Блюдо"),
          type: "text",
          width: 44
        },
        {
          key: "SkladName",
          title: t("SpisanBludInvoice.Warehouse", "Склад"),
          type: "text",
          width: 26
        },
        {
          key: "Kolvo",
          title: t("SpisanBludInvoice.Quantity", "Кол-во"),
          type: "number",
          decimals: 3,
          width: 14
        }
      ],
      rows: report.rows.map((row, index) => ({
        No: index + 1,
        Name: row.Name,
        SkladName: row.SkladName,
        Kolvo: row.Kolvo
      })),
      footerRows: []
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
    if (readOnly) return;

    if (Number(header?.CodSpis || 0) <= 0) {
      alert(t("SpisanBludInvoice.ExpenseRequired", "!!! Выберите статью затрат."));
      return;
    }

    const xml = buildSaveXml();

    try {
      const body = new URLSearchParams();

      body.set("Action", "SaveSpisanBlud");
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
        throw new Error(t("SpisanBludInvoice.ServerNonJsonPrefix", "Сервер вернул не JSON:") + " " + text.substring(0, 500));
      }

      if (!response.ok || data.status !== "success") {
        throw new Error(data.error || t("SpisanBludInvoice.SaveError", "Ошибка сохранения накладной списания блюд"));
      }

      onDirtyChange?.(false);
      onBack?.();
    } catch (err) {
      alert(err.message || t("SpisanBludInvoice.SaveError", "Ошибка сохранения накладной списания блюд"));
    }
  }


  if (printReport) {
    return (
      <SpisanBludPrintReport
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
    return <p>{t("SpisanBludInvoice.Loading", "Загрузка накладной...")}</p>;
  }

  if (error) {
    return <p className="error-text">{error}</p>;
  }

  if (!header) {
    return <p>{t("SpisanBludInvoice.NotSelected", "Накладная не выбрана.")}</p>;
  }

  let cellIndex = 1;

  return (
    <div className="prih-page spisan-blud-invoice-page">
      <div className="form-header-panel prih-form-header spisan-blud-invoice-form-header">
        <div className="page-toolbar">
        <button
          type="button"
          className="back-to-list-button prih-back-button spisan-blud-invoice-back-button"
          onClick={handleBackClick}
        >
          ← {t("SpisanBludInvoice.BackToList", "К списку списаний блюд")}
        </button>

        <button
          type="button"
          className="primary-button spisan-blud-invoice-save-button"
          disabled={readOnly || !isDirty}
          onClick={handleSave}
        >
          {t("SpisanBludInvoice.Save", "Сохранить")}
        </button>

        <button
          type="button"
          className="toolbar-button"
          disabled={
            isDirty ||
            !rows.some((row) => !isBlankSpisanBludDraftRow(row))
          }
          onClick={handleOpenPrintPreview}
        >
          {t("Common.Print", "Печать")}
        </button>
      </div>

      <div className="prih-title spisan-blud-invoice-title">
        {t("SpisanBludInvoice.Title", "Накладная списания блюд")}{" "}
        {header.Nakl ? (
          <>
            {t("SpisanBludInvoice.NumberPrefix", "№")} <strong>{header.Nakl}</strong>{" "}
          </>
        ) : null}
        {t("SpisanBludInvoice.DateSeparator", "от")} <strong>{header.DateP}</strong>
      </div>

      <div className="prih-header-grid spisan-blud-invoice-header-grid">

        <label className="calc-field">
          <span>{t("SpisanBludInvoice.Date", "Дата")}</span>

          <input
            type="date"
            value={header.DateP}
            disabled={readOnly}
            onChange={(e) => updateHeaderField("DateP", e.target.value)}
          />
        </label>

        <label className="calc-field">
          <span>{t("SpisanBludInvoice.Expenses", "Затраты")}</span>

          <select
            value={header.CodSpis}
            disabled={readOnly}
            onChange={(e) =>
              updateHeaderField("CodSpis", Number(e.target.value || 0))
            }
          >
            <option value="0">{t("SpisanBludInvoice.SelectExpenses", "Выберите затраты...")}</option>

            {zatrList.map((item) => (
              <option key={item.ID} value={item.ID}>
                {item.Name}
              </option>
            ))}
          </select>
        </label>

         <label className="calc-field calc-field-wide spisan-blud-invoice-rem-field">
          <span>{t("SpisanBludInvoice.Note", "Примечание")}</span>

          <input
            value={header.Rem || ""}
            disabled={readOnly}
            onChange={(e) => updateHeaderField("Rem", e.target.value)}
          />
        </label>
      </div>
      </div>

      <div className="calc-panel-title prih-items-title spisan-blud-invoice-items-title">
        <span>{t("SpisanBludInvoice.ContentsTitle", "Содержимое списания блюд")}</span>
      </div>

      <div className="table-wrap prih-table-wrap spisan-blud-invoice-table-wrap">
        <table className="data-table prih-table spisan-blud-invoice-table">
          <colgroup>
            <col className="spisan-blud-invoice-col-dish" />
            <col className="spisan-blud-invoice-col-warehouse" />
            <col className="spisan-blud-invoice-col-qty" />
            <col className="spisan-blud-invoice-col-delete" />
          </colgroup>

          <thead>
            <tr>
              <th>{t("SpisanBludInvoice.Dish", "Блюдо")}</th>
              <th>{t("SpisanBludInvoice.Warehouse", "Склад")}</th>
              <th>{t("SpisanBludInvoice.Quantity", "Кол-во")}</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr
                key={row.ID}
                className={isRowDirty(row) ? "changed-row" : ""}
              >
                <td>
                  <SearchableSelect
                    value={row.CodeBluda}
                    options={dishList}
                    placeholder={t("SpisanBludInvoice.SelectDish", "Выберите блюдо...")}
                    cellIndex={cellIndex++}
                    onEnterNext={focusNextCell}
                    onArrowNavigate={handleInvoiceCellArrowNavigation}
                    disabled={readOnly}
                    t={t}
                    onChange={(value) => {
                      const selectedDish = dishList.find(
                        (item) => Number(item.ID) === Number(value)
                      );

                      updateRow(row.ID, {
                        CodeBluda: value,
                        Name: selectedDish?.Name || "",
                        SkladName: selectedDish?.SkladName || ""
                      });
                    }}
                  />
                </td>

                <td title={row.SkladName || ""}>{row.SkladName || ""}</td>

                <td>
                  <input
                    data-cell={cellIndex++}
                    type="number"
                    step="0.001"
                    value={row.Kolvo}
                    disabled={readOnly}
                    onKeyDown={handleInvoiceCellKeyDown}
                    onChange={(e) =>
                      updateRow(row.ID, {
                        Kolvo: Number(e.target.value || 0)
                      })
                    }
                  />
                </td>

                <td>
                  {!readOnly && !isBlankSpisanBludDraftRow(row) && (
                    <button
                      type="button"
                      className="small-danger-button spisan-blud-invoice-delete-button"
                      title={t("SpisanBludInvoice.DeleteRow", "Удалить строку")}
                      aria-label={t("SpisanBludInvoice.DeleteRow", "Удалить строку")}
                      onClick={() => deleteRow(row.ID)}
                    >
                      ×
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}