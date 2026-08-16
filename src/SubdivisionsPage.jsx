import { useEffect, useMemo, useState } from "react";
import DirectoryPage from "./DirectoryPage";

function parseBooleanFlag(value) {
  if (value === true || value === 1) return true;
  const text = String(value ?? "").trim().toLowerCase();
  return text === "1" || text === "true" || text === "yes";
}

async function parseJsonResponse(response, fallbackMessage) {
  const text = await response.text();
  let data = null;

  if (text.trim()) {
    try {
      data = JSON.parse(text);
    } catch {
      if (!response.ok) {
        throw new Error(`${fallbackMessage}: ${text.substring(0, 300)}`);
      }
    }
  }

  const normalized = Array.isArray(data) ? data[0] : data;

  if (
    !response.ok ||
    (!Array.isArray(data) && normalized?.status === "error")
  ) {
    throw new Error(
      normalized?.error ||
        normalized?.message ||
        fallbackMessage
    );
  }

  return data;
}

export default function SubdivisionsPage({
  data,
  organizations = [],
  points = [],
  multiOrg = false,
  multiPoint = false,
  currentOrg = "1",
  currentPoint = "1",
  readOnly = false,
  fetchWithAuth,
  onSkladsChanged,
  onCehsChanged,
  onDirtyChange,
  t = (key, fallback = "") => fallback
}) {
  const [skladRows, setSkladRows] = useState([]);
  const [cehRows, setCehRows] = useState([]);
  const [selectedSkladId, setSelectedSkladId] = useState(null);

  const [skladDirty, setSkladDirty] = useState(false);
  const [cehDirty, setCehDirty] = useState(false);
  const [happyDirty, setHappyDirty] = useState(false);

  const [happyOpen, setHappyOpen] = useState(false);
  const [happyRows, setHappyRows] = useState([]);
  const [happyLoading, setHappyLoading] = useState(false);
  const [happyError, setHappyError] = useState("");

  useEffect(() => {
    const nextSklads = Array.isArray(data?.sklads) ? data.sklads : [];
    const nextCehs = Array.isArray(data?.cehs) ? data.cehs : [];

    setSkladRows(nextSklads);
    setCehRows(nextCehs);
    setSkladDirty(false);
    setCehDirty(false);

    setSelectedSkladId((current) => {
      if (
        current !== null &&
        nextSklads.some((row) => String(row?.ID) === String(current))
      ) {
        return current;
      }

      return nextSklads[0]?.ID ?? null;
    });
  }, [data]);

  useEffect(() => {
    onDirtyChange?.(Boolean(skladDirty || cehDirty || happyDirty));
  }, [skladDirty, cehDirty, happyDirty, onDirtyChange]);

  useEffect(() => {
    return () => onDirtyChange?.(false);
  }, [onDirtyChange]);

  const selectedSklad = useMemo(
    () =>
      skladRows.find(
        (row) => String(row?.ID) === String(selectedSkladId)
      ) ?? null,
    [skladRows, selectedSkladId]
  );

  const skladLookupData = useMemo(
    () => ({
      Org: (Array.isArray(organizations) ? organizations : []).filter(
        (item) => Number(item?.ID ?? item?.Code ?? 0) !== 0
      ),
      Point: Array.isArray(points) ? points : []
    }),
    [organizations, points]
  );

  const skladConfig = useMemo(
    () => ({
      apiAction: "Sklad",
      xmlSection: "Sklad",
      deletedSection: "Deleted",
      idField: "ID",
      canAdd: true,
      canDelete: true,
      wide: true,
      columns: [
        {
          field: "Name",
          labelKey: "Directory.Name",
          fallback: "Наименование",
          type: "text"
        },
        {
          field: "Kass",
          labelKey: "Directory.CashRegister",
          fallback: "Касса",
          type: "boolean"
        },
        {
          field: "Svod",
          labelKey: "Directory.Summary",
          fallback: "Свод",
          type: "boolean"
        },
        {
          field: "Org",
          labelKey: "App.Organization",
          fallback: "Организация",
          type: "select",
          optionValueField: "ID",
          optionLabelField: "Name",
          defaultValue: 1,
          hidden: !multiOrg
        },
        {
          field: "Point",
          labelKey: "App.Point",
          fallback: "Торговая точка",
          type: "select",
          optionValueField: "ID",
          optionLabelField: "NamePoint",
          defaultValue: multiPoint
            ? Number(currentPoint || 1)
            : 1,
          hidden: !multiPoint
        }
      ]
    }),
    [currentOrg, currentPoint, multiOrg, multiPoint]
  );

  const cehConfig = useMemo(
    () => ({
      apiAction: "Ceh",
      xmlSection: "Ceh",
      deletedSection: "Deleted",
      idField: "ID",
      canAdd: true,
      canDelete: true,
      columns: [
        {
          field: "Name",
          labelKey: "Directory.Name",
          fallback: "Наименование",
          type: "text"
        }
      ]
    }),
    []
  );

  const dayOptions = useMemo(
    () => [
      { ID: 0, Name: t("HappyHours.AllDays", "Все дни") },
      { ID: 1, Name: t("HappyHours.Monday", "Понедельник") },
      { ID: 2, Name: t("HappyHours.Tuesday", "Вторник") },
      { ID: 3, Name: t("HappyHours.Wednesday", "Среда") },
      { ID: 4, Name: t("HappyHours.Thursday", "Четверг") },
      { ID: 5, Name: t("HappyHours.Friday", "Пятница") },
      { ID: 6, Name: t("HappyHours.Saturday", "Суббота") },
      { ID: 7, Name: t("HappyHours.Sunday", "Воскресенье") }
    ],
    [t]
  );

  const happyConfig = useMemo(
    () => ({
      apiAction: "HHskl",
      xmlSection: "HHskl",
      deletedSection: "Deleted",
      idField: "ID",
      canAdd: true,
      canDelete: true,
      deletedFields: [
        {
          field: "Skl",
          type: "number",
          value: Number(selectedSkladId || 0)
        }
      ],
      columns: [
        {
          field: "Skl",
          type: "number",
          hidden: true,
          defaultValue: Number(selectedSkladId || 0)
        },
        {
          field: "Beg",
          labelKey: "HappyHours.Begin",
          fallback: "Начало",
          type: "time",
          defaultValue: ""
        },
        {
          field: "Endd",
          labelKey: "HappyHours.End",
          fallback: "Конец",
          type: "time",
          defaultValue: ""
        },
        {
          field: "Skid",
          labelKey: "HappyHours.Discount",
          fallback: "Скидка %",
          type: "number",
          step: "0.01",
          defaultValue: 0
        },
        {
          field: "DayN",
          labelKey: "HappyHours.Day",
          fallback: "День",
          type: "select",
          options: dayOptions,
          optionValueField: "ID",
          optionLabelField: "Name",
          defaultValue: 0
        },
        {
          field: "isActive",
          labelKey: "HappyHours.Active",
          fallback: "Активно",
          type: "boolean",
          defaultValue: true
        }
      ]
    }),
    [selectedSkladId, dayOptions]
  );

  async function loadDirectory(action, params = {}) {
    const url = new URL("https://webback.bar-boss.com/wf_Directory.php");
    url.searchParams.set("Action", action);

    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, String(value ?? ""));
    });

    const response = await fetchWithAuth(url.toString(), { method: "GET" });
    const data = await parseJsonResponse(
      response,
      t("Directory.LoadError", "Ошибка загрузки справочника")
    );

    return Array.isArray(data) ? data : [];
  }

  async function saveRef(action, xml) {
    const body = new URLSearchParams();
    body.set("Action", action);
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

    return await parseJsonResponse(
      response,
      t("Directory.SaveError", "Ошибка сохранения справочника")
    );
  }

  async function reloadSklads() {
    const rows = await loadDirectory("Sklad");
    setSkladRows(rows);
    onSkladsChanged?.(rows);

    setSelectedSkladId((current) => {
      if (
        current !== null &&
        rows.some((row) => String(row?.ID) === String(current))
      ) {
        return current;
      }

      return rows[0]?.ID ?? null;
    });

    return rows;
  }

  async function reloadCehs() {
    const rows = await loadDirectory("Ceh");
    setCehRows(rows);
    onCehsChanged?.(rows);
    return rows;
  }

  async function loadHappyHours(skladId = selectedSkladId) {
    const id = Number(skladId || 0);

    if (id <= 0) {
      throw new Error(
        t(
          "Directory.SaveWarehouseBeforeHappyHours",
          "Сначала сохраните подразделение"
        )
      );
    }

    setHappyLoading(true);
    setHappyError("");

    try {
      const rows = await loadDirectory("HHskl", { Skl: id });
      setHappyRows(rows);
      setHappyDirty(false);
      return rows;
    } finally {
      setHappyLoading(false);
    }
  }

  async function openHappyHours() {
    const id = Number(selectedSkladId || 0);

    if (id <= 0) {
      window.alert(
        t(
          "Directory.SaveWarehouseBeforeHappyHours",
          "Сначала сохраните подразделение"
        )
      );
      return;
    }

    setHappyOpen(true);
    setHappyRows([]);
    setHappyError("");
    setHappyDirty(false);

    try {
      await loadHappyHours(id);
    } catch (error) {
      setHappyError(
        error?.message ||
          t("HappyHours.LoadError", "Ошибка загрузки счастливых часов")
      );
    }
  }

  function closeHappyHours() {
    if (
      happyDirty &&
      !window.confirm(
        t(
          "App.UnsavedChangesWarning",
          "Внимание! Вы не сохранили измененные данные!\nУверены, что хотите уйти?"
        )
      )
    ) {
      return;
    }

    setHappyOpen(false);
    setHappyRows([]);
    setHappyError("");
    setHappyDirty(false);
  }

  return (
    <div className="subdivisions-page">
      <section className="subdivisions-section subdivisions-sklad-section">
        <div className="subdivisions-section-heading">
          <strong>{t("Directory.Warehouses", "Склады")}</strong>

          <button
            type="button"
            className="small-action-button subdivisions-happy-button"
            onClick={openHappyHours}
            disabled={Number(selectedSkladId || 0) <= 0}
          >
            {t("HappyHours.Title", "Счастливые часы")}
          </button>
        </div>

        <DirectoryPage
          data={skladRows}
          config={skladConfig}
          lookupData={skladLookupData}
          readOnly={readOnly}
          selectedId={selectedSkladId}
          onSelectedIdChange={(id) => setSelectedSkladId(id)}
          onDirtyChange={setSkladDirty}
          onSave={async (xml) => {
            await saveRef("Sklad", xml);
            await reloadSklads();
          }}
          t={t}
        />
      </section>

      <section className="subdivisions-section subdivisions-ceh-section">
        <div className="subdivisions-section-heading">
          <strong>{t("Directory.Workshops", "Цеха")}</strong>
        </div>

        <DirectoryPage
          data={cehRows}
          config={cehConfig}
          readOnly={readOnly}
          onDirtyChange={setCehDirty}
          onSave={async (xml) => {
            await saveRef("Ceh", xml);
            await reloadCehs();
          }}
          t={t}
        />
      </section>

      {happyOpen && (
        <div
          className="subdivisions-happy-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={t("HappyHours.Title", "Счастливые часы")}
        >
          <div className="subdivisions-happy-dialog">
            <div className="subdivisions-happy-heading">
              <div>
                <strong>{t("HappyHours.Title", "Счастливые часы")}</strong>
                {selectedSklad?.Name && (
                  <span> — {selectedSklad.Name}</span>
                )}
              </div>

              <div className="subdivisions-happy-heading-actions">
                <button
                  type="button"
                  className="small-action-button"
                  disabled={happyLoading}
                  onClick={() => {
                    loadHappyHours().catch((error) => {
                      setHappyError(
                        error?.message ||
                          t(
                            "HappyHours.LoadError",
                            "Ошибка загрузки счастливых часов"
                          )
                      );
                    });
                  }}
                >
                  {t("DishesPF.Refresh", "Обновить")}
                </button>

                <button
                  type="button"
                  className="small-action-button"
                  onClick={closeHappyHours}
                >
                  {t("HappyHours.Back", "Вернуться")}
                </button>
              </div>
            </div>

            {happyError && (
              <div className="login-error subdivisions-happy-error">
                {happyError}
              </div>
            )}

            {happyLoading ? (
              <div className="subdivisions-happy-loading">
                {t("HappyHours.Loading", "Загрузка...")}
              </div>
            ) : (
              <DirectoryPage
                data={happyRows}
                config={happyConfig}
                readOnly={readOnly}
                onDirtyChange={setHappyDirty}
                onSave={async (xml) => {
                  await saveRef("HHskl", xml);
                  await loadHappyHours();
                }}
                t={t}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
