import { useEffect, useMemo, useState } from "react";

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

export default function KassaPage({
  data,
  currentOrg = 0,
  kassaDate,
  currentValut,
  onDateChange,
  onValutChange,
  onReload,
  onSave,
  onReceiveRevenue,
  onLoadSupplierInvoices,
  onDirtyChange,
  t = (key, fallback = "") => fallback,
  locale = "ru-RU"
}) {
  const [selectedPrihId, setSelectedPrihId] = useState(null);
  const [selectedRashodId, setSelectedRashodId] = useState(null);
  const [editPrihRows, setEditPrihRows] = useState([]);
  const [editRashodRows, setEditRashodRows] = useState([]);
  const [nextTempId, setNextTempId] = useState(-1);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [receivingRevenue, setReceivingRevenue] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceRows, setInvoiceRows] = useState([]);
  const [invoiceSupplier, setInvoiceSupplier] = useState(null);
  const [invoiceTargetRowId, setInvoiceTargetRowId] = useState(null);
  const [saveError, setSaveError] = useState("");

  const orgId = Number(currentOrg || 0);
  const valutId = Number(currentValut || 0);
  const readOnly = orgId === 0;
  const canEdit = orgId > 0;
  const isDirty = Boolean(canEdit && hasChanges);

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
    setEditPrihRows(
      filteredPrihRows.map((row) => ({
        ID: Number(row.ID || 0),
        Dat: formatDateForInput(row.Dat || kassaDate),
        Org: Number(row.Org || orgId || 0),
        Valuts: Number(row.Valuts || valutId || 0),
        Summa: normalizeNumber(row.Summa),
        KodKl: normalizeNumber(row.KodKl),
        KodZatrat: normalizeNumber(row.KodZatrat),
        Rem: normalizeText(row.Rem),
        Deleted: 0,
        _changed: false
      }))
    );

    setEditRashodRows(
      filteredRashodRows.map((row) => ({
        ID: Number(row.ID || 0),
        Dat: formatDateForInput(row.Dat || kassaDate),
        Org: Number(row.Org || orgId || 0),
        Valuts: Number(row.Valuts || valutId || 0),
        Summa: normalizeNumber(row.Summa),
        KodPost: normalizeNumber(row.KodPost),
        KodZatrat: normalizeNumber(row.KodZatrat),
        Rem: normalizeText(row.Rem),
        Deleted: 0,
        _changed: false
      }))
    );

    setSelectedPrihId(null);
    setSelectedRashodId(null);
    setHasChanges(false);
    setSaveError("");
    setNextTempId(-1);
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
    const id = nextTempId;
    setNextTempId((value) => value - 1);
    return id;
  }

  function markChanged() {
    setHasChanges(true);
    setSaveError("");
  }

  function updatePrihRow(id, field, value) {
    setEditPrihRows((rows) =>
      rows.map((row) =>
        Number(row.ID) === Number(id)
          ? {
              ...row,
              [field]: ["Summa", "KodKl", "KodZatrat"].includes(field)
                ? normalizeNumber(value)
                : normalizeText(value),
              _changed: true
            }
          : row
      )
    );
    markChanged();
  }

  function updateRashodRow(id, field, value) {
    setEditRashodRows((rows) =>
      rows.map((row) =>
        Number(row.ID) === Number(id)
          ? {
              ...row,
              [field]: ["Summa", "KodPost", "KodZatrat"].includes(field)
                ? normalizeNumber(value)
                : normalizeText(value),
              _changed: true
            }
          : row
      )
    );
    markChanged();
  }

  function addPrihRow() {
    if (!canEdit) return;

    const id = makeTempId();

    setEditPrihRows((rows) => [
      ...rows,
      {
        ID: id,
        Dat: kassaDate || "",
        Org: orgId,
        Valuts: valutId,
        Summa: 0,
        KodKl: 0,
        KodZatrat: 0,
        Rem: "",
        Deleted: 0,
        _changed: true
      }
    ]);

    setSelectedPrihId(id);
    markChanged();
  }

  function addRashodRow() {
    if (!canEdit) return;

    const id = makeTempId();

    setEditRashodRows((rows) => [
      ...rows,
      {
        ID: id,
        Dat: kassaDate || "",
        Org: orgId,
        Valuts: valutId,
        Summa: 0,
        KodPost: 0,
        KodZatrat: 0,
        Rem: "",
        Deleted: 0,
        _changed: true
      }
    ]);

    setSelectedRashodId(id);
    markChanged();
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
  const prihRows = editPrihRows.map(cleanPrihRow);
  const rashodRows = editRashodRows.map(cleanRashodRow);

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
    if (hasChanges || saving || receivingRevenue) return;

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
    if (invoiceTargetRowId === null || invoiceTargetRowId === undefined) return;

    updateRashodRow(invoiceTargetRowId, "Summa", invoice.Dolg);
    closeSupplierInvoices();
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
            type="date"
            className="kassa-main-date-input"
            value={kassaDate || ""}
            onChange={(event) => handleProtectedDateChange(event.target.value)}
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

          <button
            type="button"
            className={`save-button kassa-save-button ${hasChanges ? "save-button-active" : ""}`}
            onClick={saveChanges}
            disabled={!canEdit || !hasChanges || saving}
          >
            {saving ? t("Kassa.Saving", "Сохранение...") : t("Kassa.Save", "Сохранить")}
          </button>
        </div>

        <div className="kassa-valut-panel">
          <button
            type="button"
            className="small-action-button receive-revenue-button kassa-revenue-button"
            onClick={receiveRevenue}
            disabled={hasChanges || saving || receivingRevenue}
            title={hasChanges ? t("Kassa.SaveFirstHint", "Сначала сохраните или обновите данные") : ""}
          >
            {receivingRevenue ? t("Kassa.Receiving", "Прием...") : t("Kassa.ReceiveRevenue", "Прием выручки")}
          </button>

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

      {readOnly && (
        <div className="readonly-notice">
          {t(
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
              <span>{invoiceSupplier.Name}</span>
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
                      title={t("Kassa.ApplyDebtHint", "Двойной клик: поставить сумму в расход")}
                      onDoubleClick={() => applyInvoiceDebt(invoice)}
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

            <button type="button" className="kassa-add-button" disabled={!canEdit} onClick={addPrihRow}>
              + {t("Kassa.Add", "Добавить")}
            </button>
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
                          value={formatDateForInput(row.Dat)}
                          onChange={(event) =>
                            updatePrihRow(row.ID, "Dat", event.target.value)
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
                          value={row.Summa}
                          onChange={(event) =>
                            updatePrihRow(row.ID, "Summa", event.target.value)
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
                          value={row.KodKl || 0}
                          onChange={(event) =>
                            updatePrihRow(row.ID, "KodKl", event.target.value)
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
                          value={row.KodZatrat || 0}
                          onChange={(event) =>
                            updatePrihRow(row.ID, "KodZatrat", event.target.value)
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
                          value={row.Rem || ""}
                          onChange={(event) =>
                            updatePrihRow(row.ID, "Rem", event.target.value)
                          }
                        />
                      ) : (
                        row.Rem || ""
                      )}
                    </td>
                    <td className="action-column">
                      <button
                        type="button"
                        className="small-danger-button kassa-delete-button"
                        title={t("Kassa.DeleteRow", "Удалить строку")}
                        aria-label={t("Kassa.DeleteRow", "Удалить строку")}
                        disabled={!canEdit}
                        onClick={(event) => {
                          event.stopPropagation();
                          deletePrihRow(row.ID);
                        }}
                      >
                        ×
                      </button>
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

            <button type="button" className="kassa-add-button" disabled={!canEdit} onClick={addRashodRow}>
              + {t("Kassa.Add", "Добавить")}
            </button>
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
                          value={formatDateForInput(row.Dat)}
                          onChange={(event) =>
                            updateRashodRow(row.ID, "Dat", event.target.value)
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
                          value={row.Summa}
                          onChange={(event) =>
                            updateRashodRow(row.ID, "Summa", event.target.value)
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
                          value={row.KodPost || 0}
                          onChange={(event) =>
                            updateRashodRow(row.ID, "KodPost", event.target.value)
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
                          value={row.KodZatrat || 0}
                          onChange={(event) =>
                            updateRashodRow(
                              row.ID,
                              "KodZatrat",
                              event.target.value
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
                          value={row.Rem || ""}
                          onChange={(event) =>
                            updateRashodRow(row.ID, "Rem", event.target.value)
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
                      <button
                        type="button"
                        className="small-danger-button kassa-delete-button"
                        title={t("Kassa.DeleteRow", "Удалить строку")}
                        aria-label={t("Kassa.DeleteRow", "Удалить строку")}
                        disabled={!canEdit}
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteRashodRow(row.ID);
                        }}
                      >
                        ×
                      </button>
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