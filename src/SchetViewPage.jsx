import { useEffect, useMemo, useRef, useState } from "react";

const PAYMENT_LOCKED_NOTICE_STYLE = {
  color: "#b42318",
  backgroundColor: "#fff1f0",
  border: "1px solid #f0a8a0",
  fontWeight: 700,
  padding: "10px 14px",
  borderRadius: "6px"
};

function formatDateTimeValue(value, locale = "ru-RU") {
  if (!value) return "";

  const text = String(value).trim();
  const match = text.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/
  );

  if (!match) {
    return text;
  }

  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5])
  );

  if (Number.isNaN(date.getTime())) {
    return text;
  }

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatDateTimeInput(value) {
  if (!value) return "";
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2} /.test(text)) return text.replace(" ", "T").slice(0, 16);
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) return text.slice(0, 16);
  return "";
}

function dateTimeInputToApi(value) {
  if (!value) return "";
  return String(value).replace("T", " ");
}

function formatNumberValue(value, digits = 2, locale = "ru-RU") {
  const n = Number(value || 0);

  if (!Number.isFinite(n)) {
    return "";
  }

  return n.toLocaleString(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function numberToInput(value, digits = 2, locale = "ru-RU") {
  const n = Number(value || 0);

  if (!Number.isFinite(n)) {
    return "";
  }

  const decimalSeparator = new Intl.NumberFormat(locale)
    .formatToParts(1.1)
    .find((part) => part.type === "decimal")?.value ?? ".";

  return n.toFixed(digits).replace(".", decimalSeparator);
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === "") return "0";
  const text = String(value).replace(",", ".").trim();
  const n = Number(text);
  if (!Number.isFinite(n)) return "0";
  return String(n);
}

function parseNumber(value) {
  const n = Number(normalizeNumber(value));
  return Number.isFinite(n) ? n : 0;
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function boolToXml(value) {
  return value ? "1" : "0";
}

function findById(options, value) {
  return options.find((item) => Number(item.ID) === Number(value)) || null;
}

function SearchableSelect({
  value,
  options,
  disabled,
  onChange,
  onSelectComplete,
  placeholder,
  displayField = "Name",
  t
}) {
  const selected = findById(options, value);
  const [text, setText] = useState(selected?.[displayField] || "");
  const [open, setOpen] = useState(false);
  const restoreTextRef = useRef(selected?.[displayField] || "");

  useEffect(() => {
    const item = findById(options, value);
    const name = item?.[displayField] || "";
    setText(name);
    restoreTextRef.current = name;
  }, [value, options, displayField]);

  const filtered = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (!q) return options.slice(0, 80);
    return options.filter((item) => String(item[displayField] || "").toLowerCase().includes(q)).slice(0, 80);
  }, [text, options, displayField]);

  function restoreSelectedText() {
    const item = findById(options, value);
    const name = item?.[displayField] || restoreTextRef.current || "";
    setText(name);
    restoreTextRef.current = name;
    setOpen(false);
  }

  return (
    <div className="searchable-select schet-search">
      <input
        value={text}
        disabled={disabled}
        placeholder={placeholder || t("SchetView.Select", "Выберите...")}
        onFocus={() => {
          restoreTextRef.current = selected?.[displayField] || "";
          setText("");
          setOpen(true);
        }}
        onChange={(event) => {
          setText(event.target.value);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            restoreSelectedText();
          }
        }}
        onBlur={() => setTimeout(() => restoreSelectedText(), 150)}
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
                setText(item[displayField] || "");
                restoreTextRef.current = item[displayField] || "";
                setOpen(false);
                onSelectComplete?.();
              }}
            >
              {item[displayField]}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="searchable-select-empty">
              {t("SchetView.NothingFound", "Ничего не найдено")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SchetViewPage({
  codeR,
  sourceOrder,
  waiterOptions = [],
  fetchWithAuth,
  onBack,
  onDirtyChange,
  readOnly = false,
  t = (_key, fallback = "") => fallback,
  locale = "ru-RU"
}) {
  const [header, setHeader] = useState(null);
  const [bodyRows, setBodyRows] = useState([]);
  const [clients, setClients] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingLists, setLoadingLists] = useState(false);
  const [error, setError] = useState("");
  const [headerChanged, setHeaderChanged] = useState(false);
  const [bodyChanged, setBodyChanged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [activePanel, setActivePanel] = useState("");
  const [advances, setAdvances] = useState([]);
  const [advanceChange, setAdvanceChange] = useState(null);
  const [advanceInputs, setAdvanceInputs] = useState({ Cash: "", SumKred: "", SumBon: "", Expirenza: "" });
  const [advanceError, setAdvanceError] = useState("");
  const qtyRefs = useRef({});

  const formatNumber = (value, digits = 2) =>
    formatNumberValue(value, digits, locale);

  const formatDateTime = (value) =>
    formatDateTimeValue(value, locale);

  const paymentLocked = Number(sourceOrder?.SumKred || 0) > 0;
  const canSaveZakaz = Boolean(!readOnly && (headerChanged || bodyChanged));
  const advanceChanged = useMemo(
    () =>
      Object.values(advanceInputs).some(
        (value) => String(value ?? "").trim() !== ""
      ),
    [advanceInputs]
  );
  const isDirty = Boolean(!readOnly && (canSaveZakaz || advanceChanged));

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
    loadAll();
    loadReferenceLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeR]);

  async function loadJson(url) {
    const response = await fetchWithAuth(url, { method: "GET" });
    const text = await response.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(t("SchetView.ServerNotJson", "Сервер вернул не JSON: ") + text.substring(0, 500));
    }
    if (!response.ok || json.status === "error") {
      throw new Error(json.message || json.error || t("SchetView.LoadDataError", "Ошибка загрузки данных"));
    }
    return json;
  }

  async function loadAll() {
    if (!codeR) return;
    setLoading(true);
    setError("");
    setSaveError("");
    setActivePanel("");
    try {
      const [headJson, bodyJson] = await Promise.all([
        loadJson(`https://webback.bar-boss.com/wf_SchetView.php?CodeR=${encodeURIComponent(codeR)}`),
        loadJson(`https://webback.bar-boss.com/wf_SchetViewBody.php?CodeR=${encodeURIComponent(codeR)}`)
      ]);
      const head = Array.isArray(headJson) ? headJson[0] : headJson;
      const body = Array.isArray(bodyJson) ? bodyJson : head?.Items || [];
      setHeader(normalizeHeader(head || {}));
      setBodyRows(body.map(normalizeBodyRow));
      setHeaderChanged(false);
      setBodyChanged(false);
      setAdvanceChange(null);
      setAdvanceInputs({
        Cash: "",
        SumKred: "",
        SumBon: "",
        Expirenza: ""
      });
      setAdvanceError("");
      onDirtyChange?.(false);
    } catch (err) {
      setError(err.message || t("SchetView.LoadBillError", "Ошибка загрузки счета"));
    } finally {
      setLoading(false);
    }
  }

  async function loadReferenceLists() {
    setLoadingLists(true);
    try {
      const [cliJson, discountJson, dishesJson] = await Promise.all([
        loadJson("https://webback.bar-boss.com/wf_CliKass.php"),
        loadJson("https://webback.bar-boss.com/wf_Directory.php?Action=Discount"),
        loadJson("https://webback.bar-boss.com/wf_DishesAll.php")
      ]);
      setClients(Array.isArray(cliJson) ? cliJson : []);
      setDiscounts(Array.isArray(discountJson) ? discountJson : []);
      setDishes(Array.isArray(dishesJson) ? dishesJson : []);
    } catch (err) {
      setSaveError(err.message || t("SchetView.LoadReferencesError", "Ошибка загрузки справочников"));
    } finally {
      setLoadingLists(false);
    }
  }

  function normalizeHeader(row) {
    return {
      ID: Number(row.ID || 0),
      Number: row.Number ?? "",
      IdOf: Number(row.IdOf || 0),
      DatOp: formatDateTimeInput(row.DatOp),
      IdSkid: Number(row.IdSkid || 0),
      IdKlient: Number(row.IdKlient || 0),
      Rem: row.Rem || "",
      Guest: Number(row.Guest || row.Guests || 0),
      Anul: Boolean(row.Anul),
      Bel: Boolean(row.Bel),
      DateSch0: row.DateSch0 || "",
      KolvoSch: Number(row.KolvoSch || 0),
      DateSozd: row.DateSozd || "",
      DateRasch: row.DateRasch || "",
      ProcObsl: Number(row.ProcObsl || 0),
      Dep: Boolean(row.Dep),
      Dolg: Boolean(row.Dolg),
      Dost: Boolean(row.Dost),
      Table: row.Table || "",
      AdmOf: row.AdmOf || "",
      AdmKass: row.AdmKass || "",
      AdmB: row.AdmB || "",
      Addrr: row.Addrr || "",
      Mono: Boolean(row.Mono),
      ZalName: row.ZalName || ""
    };
  }

  function normalizeBodyRow(row) {
    return {
      ID: Number(row.ID || row.CodeReal || 0),
      IdTov: Number(row.IdTov || 0),
      Sklad: row.Sklad || "",
      Kolvo: numberToInput(row.Kolvo, 2, locale),
      Price: numberToInput(row.Price, 2, locale),
      Summ: Number(row.Summ || 0),
      Discount: numberToInput(row.Discount, 0, locale),
      SummSkid: Number(row.SummSkid || 0),
      Bel: Boolean(row.Bel),
      Anul: Boolean(row.Anul),
      Perebr: Boolean(row.Perebr),
      HapH: Boolean(row.HapH ?? row.HappyHours),
      DatBeg: row.DatBeg || "",
      Seb: Number(row.Seb ?? row.Sebest ?? 0),
      SummSeb: Number(row.SummSeb || 0),
      AdmVozv: row.AdmVozv || "",
      Modif: Boolean(row.Modif),
      Fsort: row.Fsort ?? "",
      _changed: false
    };
  }

  function confirmDiscardChanges(condition = isDirty) {
    if (!condition) return true;

    return window.confirm(
      t(
        "SchetView.UnsavedChangesWarning",
        "Внимание! Вы не сохранили измененные данные!\nУверены, что хотите уйти?"
      )
    );
  }

  function resetAdvanceDraft() {
    setAdvanceInputs({
      Cash: "",
      SumKred: "",
      SumBon: "",
      Expirenza: ""
    });
    setAdvanceError("");
  }

  function handleBackClick() {
    if (!confirmDiscardChanges()) {
      return;
    }

    onDirtyChange?.(false);
    onBack?.();
  }

  function hideActivePanel() {
    if (advanceChanged && !confirmDiscardChanges(advanceChanged)) {
      return;
    }

    if (advanceChanged) {
      resetAdvanceDraft();
    }

    setActivePanel("");
  }

  function updateHeader(field, value) {
    if (readOnly) return;

    setHeader((prev) => ({ ...prev, [field]: value }));
    setHeaderChanged(true);
  }

  function canEditHeader(field) {
    if (readOnly) return false;
    if (!paymentLocked) return true;
    return field === "Anul";
  }

  function updateBodyRow(rowId, field, value) {
    if (readOnly) return;

    setBodyRows((prev) =>
      prev.map((row) => {
        if (Number(row.ID) !== Number(rowId)) return row;
        const next = { ...row, [field]: value, _changed: true };
        if (field === "Kolvo" || field === "Price") next.Summ = parseNumber(next.Kolvo) * parseNumber(next.Price);
        return next;
      })
    );
    setBodyChanged(true);
  }

  function focusQty(rowId) {
    setTimeout(() => {
      const input = qtyRefs.current[rowId];
      if (input) {
        input.focus();
        input.select();
      }
    }, 0);
  }

  function buildSaveZakazXml() {
    const h = header || {};
    const items = bodyRows
      .filter((row) => row._changed)
      .map((row) =>
        `<Item ID="${row.ID}" IdTov="${Number(row.IdTov || 0)}" Kolvo="${escapeXml(normalizeNumber(row.Kolvo))}" Price="${escapeXml(normalizeNumber(row.Price))}" Summ="${escapeXml(normalizeNumber(row.Summ))}" Discount="${escapeXml(normalizeNumber(row.Discount))}" Bel="${boolToXml(row.Bel)}" Anul="${boolToXml(row.Anul)}" />`
      )
      .join("");

    return (
      `<Zakaz ID="${h.ID}">` +
      `<Header IdOf="${Number(h.IdOf || 0)}" DatOp="${escapeXml(dateTimeInputToApi(h.DatOp))}" IdSkid="${Number(h.IdSkid || 0)}" IdKlient="${Number(h.IdKlient || 0)}" Rem="${escapeXml(h.Rem || "")}" ProcObsl="${Number(h.ProcObsl || 0)}" Dolg="${boolToXml(h.Dolg)}" Anul="${boolToXml(h.Anul)}" />` +
      `<Items>${items}</Items>` +
      `</Zakaz>`
    );
  }

  async function saveAction(action, xml) {
    const body = new URLSearchParams();
    body.set("Action", action);
    body.set("xml", xml);
    const response = await fetchWithAuth("https://webback.bar-boss.com/wf_RefSave.php", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body
    });
    const text = await response.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}
    if (!response.ok || json?.status === "error") throw new Error(json?.message || json?.error || text || t("SchetView.SaveError", "Ошибка сохранения"));
    return json || text;
  }

  async function saveZakaz() {
    if (readOnly || !header) return;

    if (advanceChanged && !confirmDiscardChanges(advanceChanged)) {
      return;
    }

    if (advanceChanged) {
      resetAdvanceDraft();
    }

    setSaving(true);
    setSaveError("");
    try {
      await saveAction("SaveZakaz", buildSaveZakazXml());
      await loadAll();
    } catch (err) {
      setSaveError(err.message || t("SchetView.SaveBillError", "Ошибка сохранения счета"));
    } finally {
      setSaving(false);
    }
  }

  async function loadAdvances() {
    if (!header?.ID) return;

    if (advanceChanged && !confirmDiscardChanges(advanceChanged)) {
      return;
    }

    if (advanceChanged) {
      resetAdvanceDraft();
    }

    setActivePanel("advances");
    setAdvanceError("");
    try {
      const json = await loadJson(`https://webback.bar-boss.com/wf_Advance.php?ID=${encodeURIComponent(header.ID)}`);
      setAdvances(Array.isArray(json) ? json : []);
    } catch (err) {
      setAdvanceError(err.message || t("SchetView.LoadAdvancesError", "Ошибка загрузки авансов/оплат"));
    }
  }

  async function loadAdvanceChange() {
    if (!header?.ID) return;

    if (activePanel === "advanceChange") {
      return;
    }

    if (advanceChanged && !confirmDiscardChanges(advanceChanged)) {
      return;
    }

    if (advanceChanged) {
      resetAdvanceDraft();
    }

    setActivePanel("advanceChange");
    setAdvanceError("");
    try {
      const json = await loadJson(`https://webback.bar-boss.com/wf_AdvanceChange.php?ID=${encodeURIComponent(header.ID)}`);
      const row = Array.isArray(json) ? json[0] : json;
      setAdvanceChange(row || null);
      setAdvanceInputs({ Cash: "", SumKred: "", SumBon: "", Expirenza: "" });
    } catch (err) {
      setAdvanceError(err.message || t("SchetView.LoadPaymentFormError", "Ошибка загрузки формы оплаты"));
    }
  }

  function updateAdvanceInput(field, value) {
    if (readOnly) return;

    setAdvanceInputs((prev) => ({ ...prev, [field]: value }));
  }

  function buildSaveAdvXml() {
    return (
      `<AdvanceChange ID="${header.ID}">` +
      `<Payments Cash="${escapeXml(normalizeNumber(advanceInputs.Cash))}" SumKred="${escapeXml(normalizeNumber(advanceInputs.SumKred))}" SumBon="${escapeXml(normalizeNumber(advanceInputs.SumBon))}" Expirenza="${escapeXml(normalizeNumber(advanceInputs.Expirenza))}" />` +
      `</AdvanceChange>`
    );
  }

  async function saveAdvanceChange() {
    if (readOnly || !advanceChange) return;

    if (canSaveZakaz && !confirmDiscardChanges(canSaveZakaz)) {
      return;
    }

    const total = Number(advanceChange.Total || 0);
    const entered = parseNumber(advanceInputs.Cash) + parseNumber(advanceInputs.SumKred) + parseNumber(advanceInputs.SumBon) + parseNumber(advanceInputs.Expirenza);
    if (Math.abs(total - entered) > 0.005) {
      setAdvanceError(
        `${t("SchetView.PaymentSumMismatchStart", "Сумма введенных оплат")} ${formatNumber(entered)} ` +
          `${t("SchetView.PaymentSumMismatchEnd", "не равна Total")} ${formatNumber(total)}`
      );
      return;
    }
    setSaving(true);
    setAdvanceError("");
    try {
      await saveAction("SaveAdv", buildSaveAdvXml());
      await loadAll();
      await loadAdvanceChange();
      onDirtyChange?.(false);
    } catch (err) {
      setAdvanceError(err.message || t("SchetView.SavePaymentFormError", "Ошибка сохранения формы оплаты"));
    } finally {
      setSaving(false);
    }
  }

  const bodyTotals = useMemo(() => {
    return bodyRows.reduce((acc, row) => {
      acc.summ += Number(row.Summ || 0);
      acc.summSkid += Number(row.SummSkid || 0);
      acc.seb += Number(row.SummSeb || 0);
      return acc;
    }, { summ: 0, summSkid: 0, seb: 0 });
  }, [bodyRows]);

  const selectedWaiterOptions = useMemo(() => {
    const map = new Map();

    if (Array.isArray(waiterOptions)) {
      for (const item of waiterOptions) {
        const id = Number(item.ID ?? item.IdOfic ?? item.IdOf ?? item.id ?? 0);
        const name = item.Name ?? item.NameOf ?? item.name ?? "";

        if (id && name && !map.has(id)) {
          map.set(id, {
            ID: id,
            Name: name
          });
        }
      }
    }

    const sourceId = Number(
      sourceOrder?.IdOfic ??
      sourceOrder?.IdOf ??
      sourceOrder?.IDOf ??
      sourceOrder?.idOf ??
      0
    );
    const sourceName = sourceOrder?.NameOf ?? sourceOrder?.Name ?? "";

    if (sourceId && sourceName && !map.has(sourceId)) {
      map.set(sourceId, {
        ID: sourceId,
        Name: sourceName
      });
    }

    if (header?.IdOf && !map.has(Number(header.IdOf))) {
      map.set(Number(header.IdOf), {
        ID: Number(header.IdOf),
        Name: `${t("SchetView.Waiter", "Официант")} ${header.IdOf}`
      });
    }

    return Array.from(map.values()).sort((a, b) =>
      String(a.Name).localeCompare(String(b.Name), "ru")
    );
  }, [waiterOptions, sourceOrder, header?.IdOf]);

  if (loading) return <div className="schet-view-page schet-editor-page">{t("SchetView.LoadingBill", "Загрузка счета...")}</div>;

  if (error) {
    return (
      <div className="schet-view-page schet-editor-page">
        <button type="button" className="back-to-list-button prih-back-button schet-back-button" onClick={handleBackClick}>{t("SchetView.BackToOrders", "← К списку заказов")}</button>
        <div className="form-error">{error}</div>
      </div>
    );
  }

  if (!header) {
    return (
      <div className="schet-view-page schet-editor-page">
        <button type="button" className="back-to-list-button prih-back-button schet-back-button" onClick={handleBackClick}>{t("SchetView.BackToOrders", "← К списку заказов")}</button>
        <div className="empty-cell">{t("SchetView.BillNotSelected", "Счет не выбран")}</div>
      </div>
    );
  }

  return (
    <div className="schet-view-page schet-editor-page">
      <div className="schet-view-topbar form-header-panel schet-view-form-header">
        <button type="button" className="back-to-list-button prih-back-button schet-back-button" onClick={handleBackClick}>{t("SchetView.BackToOrders", "← К списку заказов")}</button>
        <div className="schet-view-title">
          <strong>{t("SchetView.ViewOrder", "Просмотр заказа №")}{header.Number}</strong>
          <span>ID {header.ID}</span>
          {canSaveZakaz && (
            <span className="schet-save-warning">
              {t("SchetView.ChangesWarning", "Внимание! Результаты изменений в накладной будут отражены после сохранения!")}
            </span>
          )}
        </div>
        {!readOnly && (
          <button type="button" className={`save-button schet-view-save-button ${canSaveZakaz ? "save-button-active" : ""}`} disabled={!canSaveZakaz || saving} onClick={saveZakaz}>{t("SchetView.Save", "Сохранить")}</button>
        )}
      </div>

      {readOnly && (
        <div className="readonly-notice">
          {t("SchetView.ReadOnlyNotice", "Режим только чтение: изменения счета недоступны.")}
        </div>
      )}

      {!readOnly && paymentLocked && (
        <div
          className="readonly-notice schet-payment-locked-notice"
          style={PAYMENT_LOCKED_NOTICE_STYLE}
          role="alert"
        >
          {t(
            "SchetView.PaymentLocked",
            "Счет с безналичными формами оплаты! Коррекция возможна только после изменения формы на наличную!"
          )}
        </div>
      )}
      {loadingLists && <div className="schet-hint">{t("SchetView.LoadingReferences", "Загрузка справочников...")}</div>}
      {saveError && <div className="form-error">{saveError}</div>}

      <section
        className={`schet-header-card schet-main-card ${
          headerChanged ? "schet-header-changed" : ""
        }`}
      >
        <div className="schet-header-grid">
          <label className="schet-field"><span>{t("SchetView.WaiterLabel", "Официант:")}</span><select value={header.IdOf} disabled={!canEditHeader("IdOf")} onChange={(event) => updateHeader("IdOf", Number(event.target.value))}><option value="0">{t("SchetView.NotSelected", "Не выбран")}</option>{selectedWaiterOptions.map((item) => <option key={item.ID} value={item.ID}>{item.Name || item.NameOf}</option>)}</select></label>
          <label className="schet-field"><span>{t("SchetView.BillNumber", "Номер счета:")}</span><input value={header.Number} disabled /></label>
          <label className="schet-field"><span>{t("SchetView.CloseDate", "Дата закрытия:")}</span><input type="datetime-local" value={header.DatOp} disabled={!canEditHeader("DatOp")} onChange={(event) => updateHeader("DatOp", event.target.value)} /></label>
          <label className="schet-field schet-field-wide"><span>{t("SchetView.Note", "Примечание:")}</span><input value={header.Rem} disabled={!canEditHeader("Rem")} onChange={(event) => updateHeader("Rem", event.target.value)} /></label>
          <label className="schet-field"><span>{t("SchetView.Client", "Клиент:")}</span><SearchableSelect value={header.IdKlient} options={clients} disabled={!canEditHeader("IdKlient")} onChange={(value) => updateHeader("IdKlient", Number(value))} t={t} /></label>
          <label className="schet-field"><span>{t("SchetView.Discount", "Скидка:")}</span><select value={header.IdSkid} disabled={!canEditHeader("IdSkid")} onChange={(event) => updateHeader("IdSkid", Number(event.target.value))}><option value="0">{t("SchetView.NoDiscount", "Без скидки")}</option>{discounts.map((item) => <option key={item.ID} value={item.ID}>{item.Name || item.NameSk || item.Naim || `${t("SchetView.DiscountFallback", "Скидка")} ${item.ID}`}</option>)}</select></label>
          <label className="schet-field"><span>{t("SchetView.Guests", "Гостей:")}</span><input value={header.Guest} disabled /></label>
          <label className="schet-field"><span>{t("SchetView.ServicePercent", "% обслуживания:")}</span><input type="number" step="1" value={header.ProcObsl} disabled={!canEditHeader("ProcObsl")} onChange={(event) => updateHeader("ProcObsl", Number(event.target.value || 0))} /></label>
          <label className="schet-field"><span>{t("SchetView.Table", "Стол:")}</span><input value={header.Table} disabled /></label>
          <label className="schet-field"><span>{t("SchetView.Hall", "Зал:")}</span><input value={header.ZalName} disabled /></label>
          <label className="checkbox-field"><input type="checkbox" checked={header.Dolg} disabled={!canEditHeader("Dolg")} onChange={(event) => updateHeader("Dolg", event.target.checked)} />{t("SchetView.Debt", "Долг")}</label>
          <label className="checkbox-field"><input type="checkbox" checked={header.Dep} disabled />{t("SchetView.Deposit", "Депозит")}</label>
          <label className="schet-field"><span>{t("SchetView.BillCopies", "Копий счета:")}</span><input value={header.KolvoSch} disabled /></label>
          <label className="checkbox-field"><input type="checkbox" checked={header.Anul} disabled={!canEditHeader("Anul")} onChange={(event) => updateHeader("Anul", event.target.checked)} />{t("SchetView.Cancelled", "Аннулирован")}</label>
          <label className="schet-field"><span>{t("SchetView.Created", "Создание:")}</span><input value={formatDateTime(header.DateSozd)} disabled /></label>
          <label className="schet-field"><span>{t("SchetView.Settlement", "Расчет:")}</span><input value={formatDateTime(header.DateRasch)} disabled /></label>
          <label className="schet-field"><span>{t("SchetView.FirstBill", "Первый счет:")}</span><input value={formatDateTime(header.DateSch0)} disabled /></label>
          <label className="schet-field"><span>{t("SchetView.AdminCredit1", "Админ кред1:")}</span><input value={header.AdmOf} disabled /></label>
          <label className="schet-field"><span>{t("SchetView.AdminCredit2", "Админ кред2:")}</span><input value={header.AdmKass} disabled /></label>
          <label className="schet-field"><span>{t("SchetView.BanquetAdmin", "Админ банкета:")}</span><input value={header.AdmB} disabled /></label>
          {header.Dost && <label className="schet-field schet-field-wide"><span>{t("SchetView.DeliveryAddress", "Адрес доставки:")}</span><input value={header.Addrr} disabled /></label>}
        </div>
        <div className="schet-panel-buttons">
          <button type="button" className="small-action-button schet-panel-button schet-gold-button" onClick={loadAdvances}>{t("SchetView.AdvancesPayments", "Авансы/оплаты")}</button>
          {!readOnly && (
            <button type="button" className="small-action-button schet-panel-button schet-gold-button" onClick={loadAdvanceChange}>{t("SchetView.ChangePaymentForm", "Изменение формы оплаты")}</button>
          )}
        </div>
      </section>

      {activePanel === "advances" && (
        <section className="schet-subpanel schet-styled-subpanel">
          <div className="schet-subpanel-title schet-styled-title">
            <strong>{t("SchetView.AdvancesPayments", "Авансы/оплаты")}</strong>
            <button
              type="button"
              className="small-action-button schet-hide-button"
              onClick={hideActivePanel}
            >
              {t("SchetView.Hide", "Скрыть")}
            </button>
          </div>

          {advanceError && <div className="form-error">{advanceError}</div>}

          <div className="table-wrap schet-adv-wrap">
            <table className="data-table schet-adv-table">
              <colgroup>
                <col className="schet-adv-col-date" />
                <col className="schet-adv-col-type" />
                <col className="schet-adv-col-amount" />
                <col className="schet-adv-col-check" />
                <col className="schet-adv-col-check" />
              </colgroup>

              <thead>
                <tr>
                  <th>{t("SchetView.Date", "Дата")}</th>
                  <th>{t("SchetView.Type", "Тип")}</th>
                  <th>{t("SchetView.Amount", "Сумма")}</th>
                  <th>{t("SchetView.Advance", "Аванс")}</th>
                  <th>{t("SchetView.ServiceAbbr", "Обсл.")}</th>
                </tr>
              </thead>

              <tbody>
                {advances.map((row, index) => (
                  <tr key={index}>
                    <td>{formatDateTime(row.DateAdv)}</td>
                    <td title={row.Typ || ""}>{row.Typ || ""}</td>
                    <td className="text-right">{formatNumber(row.SumAdv)}</td>
                    <td className="center">
                      <input type="checkbox" checked={Boolean(row.Adv)} readOnly />
                    </td>
                    <td className="center">
                      <input type="checkbox" checked={Boolean(row.Obsl)} readOnly />
                    </td>
                  </tr>
                ))}

                {advances.length === 0 && (
                  <tr>
                    <td colSpan="5" className="empty-cell schet-empty-row">
                      {t("SchetView.NoRecords", "Нет записей")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activePanel === "advanceChange" && (
        <section className="schet-subpanel schet-styled-subpanel">
          <div className="schet-subpanel-title schet-styled-title">
            <strong>{t("SchetView.ChangePaymentForm", "Изменение формы оплаты")}</strong>
            <button
              type="button"
              className="small-action-button schet-hide-button"
              onClick={hideActivePanel}
            >
              {t("SchetView.Hide", "Скрыть")}
            </button>
          </div>

          {advanceError && <div className="form-error">{advanceError}</div>}

          <div className="table-wrap schet-pay-wrap">
            <table className="data-table schet-pay-table">
              <colgroup>
                <col className="schet-pay-col-form" />
                <col className="schet-pay-col-current" />
                <col className="schet-pay-col-new" />
              </colgroup>

              <thead>
                <tr>
                  <th>{t("SchetView.Form", "Форма")}</th>
                  <th>{t("SchetView.Current", "Сейчас")}</th>
                  <th>{t("SchetView.NewAmount", "Новая сумма")}</th>
                </tr>
              </thead>

              <tbody>
                <tr>
                  <td>Total</td>
                  <td className="text-right">
                    {formatNumber(advanceChange?.Total)}
                  </td>
                  <td></td>
                </tr>

                {["Cash", "SumKred", "SumBon", "Expirenza"].map((field) => (
                  <tr
                    key={field}
                    className={
                      String(advanceInputs[field] ?? "").trim() !== ""
                        ? "changed-row"
                        : ""
                    }
                  >
                    <td>{field}</td>
                    <td className="text-right">
                      {formatNumber(advanceChange?.[field])}
                    </td>
                    <td>
                      <input
                        className="table-input text-right"
                        value={advanceInputs[field]}
                        disabled={readOnly}
                        onChange={(event) =>
                          updateAdvanceInput(field, event.target.value)
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="schet-pay-actions">
            <span>
              {t("SchetView.Entered", "Введено:")}{" "}
              {formatNumber(
                parseNumber(advanceInputs.Cash) +
                  parseNumber(advanceInputs.SumKred) +
                  parseNumber(advanceInputs.SumBon) +
                  parseNumber(advanceInputs.Expirenza)
              )}
            </span>
            {!readOnly && (
              <button
                type="button"
                className="primary-button schet-payment-save-button"
                disabled={saving}
                onClick={saveAdvanceChange}
              >
                {t("SchetView.SavePaymentForm", "Сохранить форму оплаты")}
              </button>
            )}
          </div>
        </section>
      )}

      <section className="schet-body-section schet-body-panel">
        <div className="schet-body-title schet-styled-title">
          <strong>{t("SchetView.SoldDishes", "Проданные блюда")}</strong>
          <span>{t("SchetView.AmountLabel", "Сумма:")} {formatNumber(bodyTotals.summ)}</span>
          <span>
            {t("SchetView.DiscountedAmount", "Сумма с учетом скидки:")} {formatNumber(bodyTotals.summSkid)}
          </span>
          <span>{t("SchetView.CostAmount", "Сумма себестоимости:")} {formatNumber(bodyTotals.seb)}</span>
        </div>

        <div className="table-wrap schet-body-wrap">
          <table className="data-table schet-body-table">
            <colgroup>
              <col className="schet-body-col-dish" />
              <col className="schet-body-col-warehouse" />
              <col className="schet-body-col-qty" />
              <col className="schet-body-col-price" />
              <col className="schet-body-col-amount" />
              <col className="schet-body-col-discount" />
              <col className="schet-body-col-check" />
              <col className="schet-body-col-check" />
              <col className="schet-body-col-check" />
              <col className="schet-body-col-check" />
              <col className="schet-body-col-time" />
              <col className="schet-body-col-cost" />
              <col className="schet-body-col-cost-sum" />
              <col className="schet-body-col-admin" />
            </colgroup>

            <thead>
              <tr>
                <th>{t("SchetView.Dish", "Блюдо")}</th>
                <th>{t("SchetView.Warehouse", "Склад")}</th>
                <th>{t("SchetView.Quantity", "Кол-во")}</th>
                <th>{t("SchetView.Price", "Цена")}</th>
                <th>{t("SchetView.Amount", "Сумма")}</th>
                <th>{t("SchetView.DiscountColumn", "Скидка")}</th>
                <th>{t("SchetView.WhiteAbbr", "Бел.")}</th>
                <th>{t("SchetView.CancelledAbbr", "Анн.")}</th>
                <th>{t("SchetView.TransferredAbbr", "Перебр.")}</th>
                <th>HapH</th>
                <th>{t("SchetView.Time", "Время")}</th>
                <th>{t("SchetView.CostAbbr", "Себ.")}</th>
                <th>{t("SchetView.CostSumAbbr", "Сум. себ.")}</th>
                <th>{t("SchetView.ReturnAdminAbbr", "Адм. возв.")}</th>
              </tr>
            </thead>

            <tbody>
              {bodyRows.map((row) => (
                <tr
                  key={row.ID}
                  className={row._changed ? "changed-row" : ""}
                >
                  <td className={row.Modif ? "schet-modif-cell" : ""}>
                    <SearchableSelect
                      value={row.IdTov}
                      options={dishes}
                      disabled={readOnly || paymentLocked || row.Modif}
                      onChange={(value) =>
                        updateBodyRow(row.ID, "IdTov", Number(value))
                      }
                      onSelectComplete={() => focusQty(row.ID)}
                      t={t}
                    />
                  </td>
                  <td title={row.Sklad || ""}>{row.Sklad}</td>
                  <td>
                    <input
                      ref={(input) => {
                        if (input) qtyRefs.current[row.ID] = input;
                      }}
                      className="table-input text-right"
                      value={row.Kolvo}
                      disabled={readOnly || paymentLocked}
                      onChange={(event) =>
                        updateBodyRow(row.ID, "Kolvo", event.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      className="table-input text-right"
                      value={row.Price}
                      disabled={readOnly || paymentLocked}
                      onChange={(event) =>
                        updateBodyRow(row.ID, "Price", event.target.value)
                      }
                    />
                  </td>
                  <td className="text-right">{formatNumber(row.Summ)}</td>
                  <td>
                    <input
                      className="table-input text-right"
                      value={row.Discount}
                      disabled={readOnly || paymentLocked}
                      onChange={(event) =>
                        updateBodyRow(row.ID, "Discount", event.target.value)
                      }
                    />
                  </td>
                  <td className="center">
                    <input
                      type="checkbox"
                      checked={row.Bel}
                      disabled={readOnly || paymentLocked}
                      onChange={(event) =>
                        updateBodyRow(row.ID, "Bel", event.target.checked)
                      }
                    />
                  </td>
                  <td className="center">
                    <input
                      type="checkbox"
                      checked={row.Anul}
                      disabled={readOnly || paymentLocked}
                      onChange={(event) =>
                        updateBodyRow(row.ID, "Anul", event.target.checked)
                      }
                    />
                  </td>
                  <td className="center">
                    <input type="checkbox" checked={row.Perebr} readOnly />
                  </td>
                  <td className="center">
                    <input type="checkbox" checked={row.HapH} readOnly />
                  </td>
                  <td>{formatDateTime(row.DatBeg)}</td>
                  <td className="text-right">{formatNumber(row.Seb)}</td>
                  <td className="text-right">{formatNumber(row.SummSeb)}</td>
                  <td title={row.AdmVozv || ""}>{row.AdmVozv}</td>
                </tr>
              ))}

              {bodyRows.length === 0 && (
                <tr>
                  <td colSpan="14" className="empty-cell schet-empty-row">
                    {t("SchetView.NoBillRows", "Нет строк счета")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}