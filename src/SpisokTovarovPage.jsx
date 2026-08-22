import { useEffect, useState } from "react";

export default function SpisokTovarovPage({
  data,
  categories,
  filterCat,
  filterSkr,
  onChangeCat,
  onChangeSkr,
  onApply,
  onAddTovar,
  onSaveTovarov,
  recalcDate,
  onStartSebest,
  onCheckSebest,
  fetchWithAuth,
  readOnly,
  onDirtyChange,
  t = (key, fallback = "") => fallback
}) {
  const categoryList = Array.isArray(categories) ? categories : [];

  const [rows, setRows] = useState([]);
  const [changedRows, setChangedRows] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [onlySelected, setOnlySelected] = useState(false);
  const [recalcStarting, setRecalcStarting] = useState(false);
  const [recalcRunning, setRecalcRunning] = useState(false);
  const [recalcStatus, setRecalcStatus] = useState("");
  const [recalcError, setRecalcError] = useState("");

  const [auditOpen, setAuditOpen] = useState(false);
  const [auditRows, setAuditRows] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState("");
  const [selectedAuditId, setSelectedAuditId] = useState(null);

  const changedCount = Object.keys(changedRows).length;
  const isDirty = !readOnly && changedCount > 0;

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
    setRows(Array.isArray(data) ? data : []);
    setChangedRows({});
    setSelectedId(null);
    setSaveError("");
  }, [data]);

  useEffect(() => {
    let cancelled = false;

    async function detectRunningRecalc() {
      if (typeof onCheckSebest !== "function") return;

      try {
        const result = await onCheckSebest();
        const state = String(result?.result ?? "").trim().toLowerCase();

        if (!cancelled && state === "in process") {
          setRecalcRunning(true);
          setRecalcStatus(
            t("SpisokTovarov.RecalcInProcess", "Пересчёт себестоимости выполняется...")
          );
        }
      } catch {
        // При открытии формы отсутствие статуса не мешает работе со списком.
      }
    }

    detectRunningRecalc();

    return () => {
      cancelled = true;
    };
  }, [onCheckSebest, t]);

  useEffect(() => {
    if (!recalcRunning || typeof onCheckSebest !== "function") {
      return undefined;
    }

    let cancelled = false;
    let timerId = null;

    async function checkStatus() {
      try {
        const result = await onCheckSebest();

        if (cancelled) return;

        const state = String(result?.result ?? "").trim().toLowerCase();

        if (state === "end") {
          setRecalcRunning(false);
          setRecalcStatus(
            t("SpisokTovarov.RecalcFinished", "Пересчёт себестоимости завершён")
          );
          setRecalcError("");
          window.alert(
            t("SpisokTovarov.RecalcFinishedMessage", "Пересчёт себестоимости завершён.")
          );
          return;
        }

        if (state !== "in process") {
          throw new Error(
            t("SpisokTovarov.RecalcUnknownStatus", "Сервер вернул неизвестное состояние пересчёта")
          );
        }

        setRecalcStatus(
          t("SpisokTovarov.RecalcInProcess", "Пересчёт себестоимости выполняется...")
        );
        setRecalcError("");
      } catch (err) {
        if (cancelled) return;

        setRecalcError(
          err.message ||
            t("SpisokTovarov.RecalcCheckError", "Ошибка проверки состояния пересчёта")
        );
      }

      if (!cancelled) {
        timerId = window.setTimeout(checkStatus, 15000);
      }
    }

    timerId = window.setTimeout(checkStatus, 15000);

    return () => {
      cancelled = true;

      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
    };
  }, [recalcRunning, onCheckSebest, t]);

  const selectedAudit =
    auditRows.find(
      (row) =>
        Number(row?.CodeSebList || 0) ===
        Number(selectedAuditId || 0)
    ) ??
    auditRows[0] ??
    null;

  const selectedAuditList = Array.isArray(
    selectedAudit?.List
  )
    ? selectedAudit.List
    : [];

  useEffect(() => {
    if (!auditOpen) {
      return undefined;
    }

    function handleAuditEscape(event) {
      if (event.key === "Escape") {
        setAuditOpen(false);
      }
    }

    window.addEventListener(
      "keydown",
      handleAuditEscape
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleAuditEscape
      );
    };
  }, [auditOpen]);

  async function openAudit() {
    if (auditLoading || !fetchWithAuth) {
      return;
    }

    setAuditOpen(true);
    setAuditLoading(true);
    setAuditError("");
    setAuditRows([]);
    setSelectedAuditId(null);

    try {
      const url = new URL(
        "https://webback.bar-boss.com/wf_Directory.php"
      );
      url.searchParams.set("Action", "Audit");

      const response = await fetchWithAuth(
        url.toString(),
        {
          method: "GET"
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
            "SpisokTovarov.AuditInvalidResponse",
            "Сервер вернул некорректный ответ аудита"
          )
        );
      }

      const statusItem =
        !Array.isArray(result) &&
        result &&
        typeof result === "object"
          ? result
          : null;

      if (
        !response.ok ||
        statusItem?.status === "error"
      ) {
        throw new Error(
          statusItem?.error ||
            statusItem?.message ||
            t(
              "SpisokTovarov.AuditLoadError",
              "Ошибка загрузки аудита пересчёта себестоимости"
            )
        );
      }

      const normalizedRows =
        Array.isArray(result)
          ? result
          : Array.isArray(result?.data)
            ? result.data
            : Array.isArray(result?.Data)
              ? result.Data
              : Array.isArray(result?.result)
                ? result.result
                : [];

      setAuditRows(normalizedRows);

      if (normalizedRows.length > 0) {
        setSelectedAuditId(
          Number(
            normalizedRows[0]?.CodeSebList || 0
          ) || null
        );
      }
    } catch (err) {
      setAuditError(
        err?.message ||
          t(
            "SpisokTovarov.AuditLoadError",
            "Ошибка загрузки аудита пересчёта себестоимости"
          )
      );
    } finally {
      setAuditLoading(false);
    }
  }

  function closeAudit() {
    setAuditOpen(false);
  }

  function confirmDiscardChanges() {
    if (!isDirty) return true;

    return window.confirm(t("SpisokTovarov.UnsavedChangesWarning", "Внимание! Вы не сохранили измененные данные!\nУверены, что хотите уйти?"));
  }

  async function applyFilters(nextCategory, nextSkr) {
    const normalizedCategory = String(nextCategory ?? "0");
    const normalizedSkr = nextSkr ? 1 : 0;

    const currentCategory = String(filterCat ?? "0");
    const currentSkr = filterSkr ? 1 : 0;

    if (
      normalizedCategory === currentCategory &&
      normalizedSkr === currentSkr
    ) {
      return;
    }

    if (!confirmDiscardChanges()) {
      return;
    }

    if (isDirty) {
      setChangedRows({});
      onDirtyChange?.(false);
    }

    onChangeCat?.(normalizedCategory);
    onChangeSkr?.(normalizedSkr);

    await onApply?.({
      cat: normalizedCategory,
      skr: normalizedSkr
    });
  }

  function updateField(id, field, value) {
    if (readOnly) return;

    setRows((prevRows) =>
      prevRows.map((row) =>
        row.ID === id
          ? {
              ...row,
              [field]: value
            }
          : row
      )
    );

    setChangedRows((prev) => ({
      ...prev,
      [id]: true
    }));
  }

  async function saveChanges() {
    if (readOnly) return;

    const changed = rows.filter((row) => changedRows[row.ID]);

    if (changed.length === 0) {
      return;
    }

    const xml = buildTovarovXml(changed);

    setSaveLoading(true);
    setSaveError("");

    try {
      await onSaveTovarov(xml);
      setChangedRows({});
    } catch (err) {
      setSaveError(err.message || t("SpisokTovarov.SaveError", "Ошибка сохранения"));
    } finally {
      setSaveLoading(false);
    }
  }

  async function addNewTovar() {
    if (readOnly) return;

    setAddLoading(true);
    setSaveError("");

    try {
      const newItem = await onAddTovar();

      setRows((prevRows) => [newItem, ...prevRows]);

      setChangedRows((prev) => ({
        ...prev,
        [newItem.ID]: true
      }));

      setSelectedId(newItem.ID);
    } catch (err) {
      setSaveError(err.message || t("SpisokTovarov.AddError", "Ошибка добавления товара"));
    } finally {
      setAddLoading(false);
    }
  }

  async function startRecalc() {
    if (readOnly || recalcStarting || recalcRunning) return;

    if (isDirty) {
      setRecalcError(
        t(
          "SpisokTovarov.RecalcSaveFirst",
          "Перед пересчётом сохраните изменения списка сырья"
        )
      );
      return;
    }

    if (!recalcDate) {
      setRecalcError(
        t(
          "SpisokTovarov.RecalcDateMissing",
          "В верхнем меню не указана дата «С»"
        )
      );
      return;
    }

    setRecalcStarting(true);
    setRecalcError("");
    setRecalcStatus("");

    try {
      await onStartSebest?.({
        date: recalcDate,
        otobr: onlySelected ? 1 : 0
      });

      setRecalcRunning(true);
      setRecalcStatus(
        t("SpisokTovarov.RecalcInProcess", "Пересчёт себестоимости выполняется...")
      );
    } catch (err) {
      setRecalcError(
        err.message ||
          t("SpisokTovarov.RecalcStartError", "Ошибка запуска пересчёта себестоимости")
      );
    } finally {
      setRecalcStarting(false);
    }
  }

  return (
    <div className="spisok-tovarov-page">
      <div className="module-toolbar spisok-tovarov-toolbar">
        <div className="toolbar-left">
          <label className="toolbar-check">
            <input
              type="checkbox"
              checked={Boolean(filterSkr)}
              onChange={(e) => {
                applyFilters(filterCat || "0", e.target.checked ? 1 : 0);
              }}
            />
            {t("SpisokTovarov.Hidden", "Скрытые")}
          </label>

          <label className="toolbar-field">
            <span>{t("SpisokTovarov.Category", "Категория")}</span>

            <select
              className="toolbar-select"
              value={String(filterCat ?? "0")}
              onChange={(e) => {
                applyFilters(e.target.value || "0", filterSkr ? 1 : 0);
              }}
            >
              <option value="0">{t("SpisokTovarov.All", "Все")}</option>

              {categoryList.map((cat) => (
                <option key={cat.ID} value={String(cat.ID)}>
                  {cat.Name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="toolbar-right">
          <button
            type="button"
            className="toolbar-save-button spisok-tovarov-audit-button"
            onClick={openAudit}
            disabled={auditLoading || !fetchWithAuth}
          >
            {auditLoading
              ? t("SpisokTovarov.AuditLoading", "Аудит...")
              : t("SpisokTovarov.AuditButton", "Аудит пересчёта")}
          </button>

          {!readOnly && (
            <div className="spisok-tovarov-recalc-controls">
              <label className="spisok-tovarov-recalc-check">
                <input
                  type="checkbox"
                  checked={onlySelected}
                  disabled={recalcStarting || recalcRunning}
                  onChange={(e) => setOnlySelected(e.target.checked)}
                />
                <span>
                  {t("SpisokTovarov.RecalcOnlyFor", "Только для")}
                  <br />
                  {t("SpisokTovarov.RecalcSelected", "отобранных")}
                </span>
              </label>

              <button
                type="button"
                className="toolbar-save-button spisok-tovarov-recalc-button"
                disabled={recalcStarting || recalcRunning || !recalcDate}
                onClick={startRecalc}
                title={
                  recalcDate
                    ? t("SpisokTovarov.RecalcDateTitle", "Дата начала пересчёта: {date}")
                        .replace("{date}", recalcDate)
                    : t("SpisokTovarov.RecalcDateMissing", "В верхнем меню не указана дата «С»")
                }
              >
                {recalcStarting
                  ? t("SpisokTovarov.RecalcStarting", "Запуск...")
                  : recalcRunning
                    ? t("SpisokTovarov.RecalcRunning", "Пересчёт выполняется")
                    : t("SpisokTovarov.RecalcFromDate", "Пересчёт с даты")}
              </button>
            </div>
          )}

          {!readOnly && (
            <button
              type="button"
              className="toolbar-save-button spisok-tovarov-add-button"
              disabled={addLoading || saveLoading}
              onClick={addNewTovar}
            >
              {addLoading ? t("SpisokTovarov.Adding", "Добавление...") : t("SpisokTovarov.AddItem", "Добавить товар")}
            </button>
          )}

          {!readOnly && (
            <>
              <button
                type="button"
                className="toolbar-save-button spisok-tovarov-save-button"
                disabled={changedCount === 0 || saveLoading}
                onClick={saveChanges}
              >
                {saveLoading ? t("SpisokTovarov.Saving", "Сохранение...") : t("SpisokTovarov.SaveChanges", "Сохранить изменения")}
              </button>

              {changedCount > 0 && (
                <span className="changed-info">
                  {t("SpisokTovarov.ChangedCountPrefix", "Изменено:")} {changedCount}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {(recalcStatus || recalcError) && (
        <div
          className={`spisok-tovarov-recalc-status ${
            recalcError ? "error" : recalcRunning ? "running" : "done"
          }`}
          role={recalcError ? "alert" : "status"}
        >
          {recalcError || recalcStatus}
        </div>
      )}

      {saveError && (
        <div className="login-error">
          {saveError}
        </div>
      )}

      {rows.length === 0 && (
        <div className="spisok-tovarov-empty">
          {t("SpisokTovarov.Loading", "Загрузка...")}
        </div>
      )}

      {rows.length > 0 && (
        <div className="table-wrap spisok-tovarov-table-wrap">
          <table className="data-table spisok-tovarov-table">
            <colgroup>
              <col className="spisok-tovarov-col-name" />
              <col className="spisok-tovarov-col-price" />
              <col className="spisok-tovarov-col-check" />
              <col className="spisok-tovarov-col-check" />
              <col className="spisok-tovarov-col-kcal" />
              <col className="spisok-tovarov-col-category" />
              <col className="spisok-tovarov-col-check" />
              <col className="spisok-tovarov-col-number" />
              <col className="spisok-tovarov-col-number" />
              <col className="spisok-tovarov-col-weight" />
              <col className="spisok-tovarov-col-barcode" />
              <col className="spisok-tovarov-col-check" />
              <col className="spisok-tovarov-col-capacity" />
            </colgroup>

            <thead>
              <tr>
                <th>{t("SpisokTovarov.Name", "Наименование")}</th>
                <th>{t("SpisokTovarov.Price", "Цена")}</th>
                <th>{t("SpisokTovarov.CreditShort", "Зач.")}</th>
                <th>{t("SpisokTovarov.HiddenShort", "Скр.")}</th>
                <th>{t("SpisokTovarov.Kcal", "Ккал")}</th>
                <th>{t("SpisokTovarov.Category", "Категория")}</th>
                <th>{t("SpisokTovarov.Selection", "Отбор")}</th>
                <th>{t("SpisokTovarov.Norm", "Норма")}</th>
                <th>{t("SpisokTovarov.Tare", "Тара")}</th>
                <th>{t("SpisokTovarov.WeightPerLiter", "Вес/Литр")}</th>
                <th>{t("SpisokTovarov.BarcodeShort", "ШК")}</th>
                <th>{t("SpisokTovarov.Brand", "Марка")}</th>
                <th>{t("SpisokTovarov.Capacity", "Ёмкость")}</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.ID}
                  className={[
                    selectedId === row.ID ? "selected-row" : "",
                    changedRows[row.ID] ? "changed-row" : ""
                  ].join(" ")}
                  onClick={() => setSelectedId(row.ID)}
                >
                  <td>
                    <input
                      className="table-input spisok-tovarov-name-input"
                      type="text"
                      title={row.Name ?? ""}
                      value={row.Name ?? ""}
                      disabled={readOnly}
                      onChange={(e) => updateField(row.ID, "Name", e.target.value)}
                    />
                  </td>

                  <td className="num">
                    <input
                      className="table-input table-input-num"
                      type="number"
                      value={row.Price ?? ""}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateField(row.ID, "Price", e.target.value === "" ? 0 : Number(e.target.value))
                      }
                    />
                  </td>

                  <td className="center">
                    <input
                      type="checkbox"
                      checked={Boolean(row.Zach)}
                      disabled={readOnly}
                      onChange={(e) => updateField(row.ID, "Zach", e.target.checked)}
                    />
                  </td>

                  <td className="center">
                    <input
                      type="checkbox"
                      checked={Boolean(row.Skr)}
                      disabled={readOnly}
                      onChange={(e) => updateField(row.ID, "Skr", e.target.checked)}
                    />
                  </td>

                  <td className="num">
                    <input
                      className="table-input table-input-num"
                      type="number"
                      value={row.KKal ?? ""}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateField(row.ID, "KKal", e.target.value === "" ? 0 : Number(e.target.value))
                      }
                    />
                  </td>

                  <td>
                    <select
                      className="table-select"
                      value={String(row.Grup ?? 0)}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateField(row.ID, "Grup", Number(e.target.value))
                      }
                    >
                      <option value="0"></option>

                      {categoryList.map((cat) => (
                        <option key={cat.ID} value={String(cat.ID)}>
                          {cat.Name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="center">
                    <input
                      type="checkbox"
                      checked={Boolean(row.Otbor)}
                      disabled={readOnly}
                      onChange={(e) => updateField(row.ID, "Otbor", e.target.checked)}
                    />
                  </td>

                  <td className="num">
                    <input
                      className="table-input table-input-num"
                      type="number"
                      value={row.NormaZ ?? ""}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateField(row.ID, "NormaZ", e.target.value === "" ? 0 : Number(e.target.value))
                      }
                    />
                  </td>

                  <td className="num">
                    <input
                      className="table-input table-input-num"
                      type="number"
                      value={row.Tara ?? ""}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateField(row.ID, "Tara", e.target.value === "" ? 0 : Number(e.target.value))
                      }
                    />
                  </td>

                  <td className="num">
                    <input
                      className="table-input table-input-num"
                      type="number"
                      value={row.VesLitr ?? ""}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateField(row.ID, "VesLitr", e.target.value === "" ? 0 : Number(e.target.value))
                      }
                    />
                  </td>

                  <td className="num">
                    <input
                      className="table-input table-input-num"
                      type="number"
                      value={row.Shk ?? ""}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateField(row.ID, "Shk", e.target.value === "" ? 0 : Number(e.target.value))
                      }
                    />
                  </td>

                  <td className="center">
                    <input
                      type="checkbox"
                      checked={Boolean(row.Marka)}
                      disabled={readOnly}
                      onChange={(e) => updateField(row.ID, "Marka", e.target.checked)}
                    />
                  </td>

                  <td className="num">
                    <input
                      className="table-input table-input-num"
                      type="number"
                      value={row.Capacity ?? ""}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateField(row.ID, "Capacity", e.target.value === "" ? 0 : Number(e.target.value))
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {auditOpen && (
        <div
          className="spisok-tovarov-audit-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeAudit();
            }
          }}
        >
          <section
            className="spisok-tovarov-audit-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="spisok-tovarov-audit-title"
          >
            <div className="spisok-tovarov-audit-header">
              <div>
                <h3 id="spisok-tovarov-audit-title">
                  {t(
                    "SpisokTovarov.AuditTitle",
                    "Аудит пересчёта себестоимости"
                  )}
                </h3>
                <div className="spisok-tovarov-audit-subtitle">
                  {t(
                    "SpisokTovarov.AuditSubtitle",
                    "История запусков пересчёта себестоимости"
                  )}
                </div>
              </div>

              <button
                type="button"
                className="spisok-tovarov-audit-close"
                onClick={closeAudit}
              >
                {t(
                  "SpisokTovarov.AuditClose",
                  "Закрыть"
                )}
              </button>
            </div>

            {auditLoading && (
              <div className="spisok-tovarov-audit-loading">
                {t(
                  "SpisokTovarov.AuditLoadingText",
                  "Загружаем аудит..."
                )}
              </div>
            )}

            {auditError && (
              <div className="spisok-tovarov-audit-error">
                {auditError}
              </div>
            )}

            {!auditLoading &&
              !auditError &&
              auditRows.length === 0 && (
                <div className="spisok-tovarov-audit-empty">
                  {t(
                    "SpisokTovarov.AuditEmpty",
                    "Записей аудита нет."
                  )}
                </div>
              )}

            {!auditLoading &&
              !auditError &&
              auditRows.length > 0 && (
                <>
                  <div className="spisok-tovarov-audit-table-wrap">
                    <table className="spisok-tovarov-audit-table">
                      <thead>
                        <tr>
                          <th>
                            {t(
                              "SpisokTovarov.AuditCostDate",
                              "Себестоимость с"
                            )}
                          </th>
                          <th>
                            {t(
                              "SpisokTovarov.AuditMode",
                              "Пересчёт"
                            )}
                          </th>
                          <th>
                            {t(
                              "SpisokTovarov.AuditStarted",
                              "Запуск"
                            )}
                          </th>
                          <th>
                            {t(
                              "SpisokTovarov.AuditFinishedAt",
                              "Завершение"
                            )}
                          </th>
                          <th className="num">
                            {t(
                              "SpisokTovarov.AuditDuration",
                              "Время"
                            )}
                          </th>
                          <th>
                            {t(
                              "SpisokTovarov.AuditUser",
                              "Пользователь"
                            )}
                          </th>
                          <th className="num">
                            {t(
                              "SpisokTovarov.AuditDishes",
                              "Блюд"
                            )}
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {auditRows.map((row) => {
                          const id = Number(
                            row?.CodeSebList || 0
                          );
                          const detailList =
                            Array.isArray(row?.List)
                              ? row.List
                              : [];
                          const isSelected =
                            id ===
                            Number(
                              selectedAudit?.CodeSebList ||
                                0
                            );

                          return (
                            <tr
                              key={
                                id ||
                                `${row?.dat ?? ""}-${row?.UserName ?? ""}`
                              }
                              className={
                                isSelected
                                  ? "selected-row"
                                  : ""
                              }
                              onClick={() =>
                                setSelectedAuditId(
                                  id || null
                                )
                              }
                            >
                              <td>
                                {formatAuditDate(
                                  row?.DateSeb
                                )}
                              </td>
                              <td>
                                {row?.CalkList
                                  ? t(
                                      "SpisokTovarov.AuditSelectedMode",
                                      "Отобранные блюда"
                                    )
                                  : t(
                                      "SpisokTovarov.AuditFullMode",
                                      "Полный"
                                    )}
                              </td>
                              <td>
                                {formatAuditDateTime(
                                  row?.dat
                                )}
                              </td>
                              <td>
                                {formatAuditDateTime(
                                  row?.EndOK
                                )}
                              </td>
                              <td className="num">
                                {formatAuditDuration(
                                  row?.TimeR
                                )}
                              </td>
                              <td>
                                {String(
                                  row?.UserName ?? ""
                                ).trim() || "—"}
                              </td>
                              <td className="num">
                                {row?.CalkList
                                  ? detailList.length
                                  : ""}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {selectedAudit?.CalkList && (
                    <div className="spisok-tovarov-audit-details">
                      <div className="spisok-tovarov-audit-details-title">
                        {t(
                          "SpisokTovarov.AuditSelectedDishes",
                          "Отобранные блюда"
                        )}
                        : {selectedAuditList.length}
                      </div>

                      {selectedAuditList.length > 0 ? (
                        <div className="spisok-tovarov-audit-details-wrap">
                          <table className="spisok-tovarov-audit-details-table">
                            <thead>
                              <tr>
                                <th>
                                  {t(
                                    "SpisokTovarov.AuditDishName",
                                    "Наименование"
                                  )}
                                </th>
                                <th>
                                  {t(
                                    "SpisokTovarov.AuditWarehouse",
                                    "Склад"
                                  )}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedAuditList.map(
                                (item, index) => (
                                  <tr
                                    key={`${selectedAudit?.CodeSebList ?? "audit"}-${index}-${item?.["Наименование"] ?? ""}`}
                                  >
                                    <td>
                                      {String(
                                        item?.["Наименование"] ??
                                          ""
                                      ).trim() || "—"}
                                    </td>
                                    <td>
                                      {String(
                                        item?.["Склад"] ??
                                          ""
                                      ).trim() || "—"}
                                    </td>
                                  </tr>
                                )
                              )}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="spisok-tovarov-audit-empty-details">
                          {t(
                            "SpisokTovarov.AuditNoSelectedDishes",
                            "Список отобранных блюд пуст."
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
          </section>
        </div>
      )}
    </div>
  );
}

function formatAuditDate(value) {
  const text = String(value ?? "").trim();

  if (!text) {
    return "—";
  }

  const match = text.match(
    /^(\d{4})-(\d{2})-(\d{2})/
  );

  if (!match) {
    return text;
  }

  return `${match[3]}.${match[2]}.${match[1]}`;
}

function formatAuditDateTime(value) {
  const text = String(value ?? "").trim();

  if (!text) {
    return "—";
  }

  const match = text.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/
  );

  if (!match) {
    return text;
  }

  return `${match[3]}.${match[2]}.${match[1]} ${match[4]}:${match[5]}:${match[6]}`;
}

function formatAuditDuration(value) {
  const text = String(value ?? "").trim();

  if (!text) {
    return "—";
  }

  const match = text.match(
    /^(\d+):(\d{2}):(\d{2})(?:\.(\d+))?$/
  );

  if (!match) {
    return text;
  }

  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  const fraction = Number(`0.${match[4] || "0"}`);

  const roundedTotalSeconds = Math.round(
    hours * 3600 +
      minutes * 60 +
      seconds +
      fraction
  );

  const roundedHours = Math.floor(
    roundedTotalSeconds / 3600
  );
  const roundedMinutes = Math.floor(
    (roundedTotalSeconds % 3600) / 60
  );
  const roundedSeconds =
    roundedTotalSeconds % 60;

  return [
    String(roundedHours).padStart(2, "0"),
    String(roundedMinutes).padStart(2, "0"),
    String(roundedSeconds).padStart(2, "0")
  ].join(":");
}

function buildTovarovXml(rows) {
  const items = rows
    .map((row) => {
      return `<Tovar
        ID="${escapeXml(row.ID)}"
        Name="${escapeXml(row.Name)}"
        Price="${escapeXml(row.Price)}"
        Zach="${boolToInt(row.Zach)}"
        Skr="${boolToInt(row.Skr)}"
        KKal="${escapeXml(row.KKal)}"
        Grup="${escapeXml(row.Grup)}"
        Otbor="${boolToInt(row.Otbor)}"
        NormaZ="${escapeXml(row.NormaZ)}"
        Tara="${escapeXml(row.Tara)}"
        VesLitr="${escapeXml(row.VesLitr)}"
        Shk="${escapeXml(row.Shk)}"
        Marka="${boolToInt(row.Marka)}"
        Capacity="${escapeXml(row.Capacity)}"
      />`;
    })
    .join("");

  return `<Tovars>${items}</Tovars>`;
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function boolToInt(value) {
  return value ? 1 : 0;
}