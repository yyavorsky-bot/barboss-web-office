import { useEffect, useMemo, useRef, useState } from "react";

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

function calcPlusExpression(value) {
  const text = String(value || "").trim();

  if (!text.includes("+")) {
    return null;
  }

  const parts = text
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return null;
  }

  let sum = 0;

  for (const part of parts) {
    const n = Number(part.replace(",", "."));

    if (!Number.isFinite(n)) {
      return null;
    }

    sum += n;
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

function SearchableSelect({
  value,
  options,
  disabled,
  onChange,
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
  const [perChanged, setPerChanged] = useState(false);
  const [perLoading, setPerLoading] = useState(false);
  const [perError, setPerError] = useState("");
  const perInputRefs = useRef([]);

  const [pfRows, setPfRows] = useState([]);
  const [pfDeletedRows, setPfDeletedRows] = useState([]);
  const [dishOptions, setDishOptions] = useState([]);
  const [pfChanged, setPfChanged] = useState(false);
  const [pfLoading, setPfLoading] = useState(false);
  const [pfError, setPfError] = useState("");
  const [pfIdPer, setPfIdPer] = useState(null);

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
    setPerChanged(false);
    setPerError("");
    setPfRows([]);
    setPfDeletedRows([]);
    setPfChanged(false);
    setPfError("");
    setPfIdPer(null);

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
    setPerChanged(false);
    setPerError("");
  }

  function resetPfEditor() {
    setPfRows([]);
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
    if ((perChanged || pfChanged) && !confirmDiscardChanges(perChanged || pfChanged)) {
      return;
    }

    if (perChanged || pfChanged) {
      closeWorkEditors();
    }

    setHeaderDate(value);
  }

  function updateListRow(id, field, value) {
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
      return;
    }

    if (isAnotherRow) {
      closeWorkEditors();
    }

    setSelectedPerId(nextPerId);
    setHeaderDate(formatDateForInput(row.Date));
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

      setPfRows((Array.isArray(pfData) ? pfData : []).map((row) => ({
        ID: Number(row.ID || 0),
        IdDish: Number(row.IdDish || 0),
        Kolvo: numberToInput(row.Kolvo),
        _changed: false,
        _deleted: false
      })));

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

    setPfChanged(true);
  }

  function deletePfRow(row) {
    if (!window.confirm(t("Pereuchet.ConfirmDelete", "Вы уверены?"))) {
      return;
    }

    if (row.ID > 0) {
      setPfDeletedRows((prev) => [...prev, row]);
    }

    setPfRows((prev) => prev.filter((item) => item.ID !== row.ID));
    setPfChanged(true);
  }

  async function savePf() {
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

  async function openPer() {
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

      setPerRows((Array.isArray(result) ? result : []).map((row) => ({
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
      })));

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
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();

    const value = event.currentTarget.value;
    const result = calcPlusExpression(value);

    if (result !== null) {
      updatePerOnFact(index, result);
    }

    const nextInput = perInputRefs.current[index + 1];

    if (nextInput) {
      nextInput.focus();
      nextInput.select();
    }
  }

  async function savePer() {
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
              onChange={(event) => handleHeaderDateChange(event.target.value)}
            />
          </label>

          <button
            type="button"
            className="primary-button pereuchet-open-button"
            onClick={openPer}
            disabled={perLoading || saving}
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
        </div>

        <div className="toolbar-right">
          {listChanged && (
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
                {rows.map((row) => (
                  <tr
                    key={row.ID}
                    className={[
                      row._changed ? "changed-row" : "",
                      selectedPerRow?.ID === row.ID ? "selected-row" : ""
                    ].join(" ")}
                    onClick={() => selectPerListRow(row)}
                  >
                    <td>
                      <input
                        type="date"
                        className="table-input pereuchet-date-input"
                        value={formatDateForInput(row.Date)}
                        onClick={(event) => {
                          event.stopPropagation();
                          selectPerListRow(row);
                        }}
                        onFocus={() => selectPerListRow(row)}
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
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) =>
                          updateListRow(row.ID, "Zakr", event.target.checked)
                        }
                      />
                    </td>
                    <td className="action-column delete-column">
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

              {pfChanged && (
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
                    <tr key={row.ID} className={row._changed ? "changed-row" : ""}>
                      <td>
                        <SearchableSelect
                          value={row.IdDish}
                          options={dishOptions}
                          t={t}
                          onChange={(value) => updatePfRow(row.ID, "IdDish", value)}
                        />
                      </td>
                      <td>
                        <input
                          className="table-input text-right"
                          value={row.Kolvo}
                          onChange={(event) =>
                            updatePfRow(row.ID, "Kolvo", event.target.value)
                          }
                        />
                      </td>
                      <td className="action-column delete-column">
                        <button
                          type="button"
                          className="small-danger-button pereuchet-delete-button"
                        title={t("Pereuchet.DeleteRow", "Удалить строку")}
                        aria-label={t("Pereuchet.DeleteRow", "Удалить строку")}
                          onClick={() => deletePfRow(row)}
                        >
                          ×
                        </button>
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

              {perChanged && (
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
                    <tr key={row.ID} className={row._changed ? "changed-row" : ""}>
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