import { useEffect, useMemo, useRef, useState } from "react";
import SystemParametersStationsTab from "./SystemParametersStationsTab";
import "./system-parameters.css";

const BASE_URL = "https://webback.bar-boss.com/";

const EDITABLE_FIELDS = [
  "Peresm",
  "CodVir",
  "StatVir",
  "CodZach",
  "CodePF",
  "CodeProizv",
  "CodeOst",
  "CodeHotel",
  "StatAvans",
  "CodeDep",
  "CodeAv",
  "PathXLS",
  "SchetAkc",
  "TextPech",
  "PLUpath",
  "PLUtype",
  "Sklad0",
  "HeadlineBB",
  "SchAdm",
  "NomPrint",
  "Koreshok",
  "UdNerasp",
  "Ceha",
  "BanketSkr",
  "SlojGramm",
  "Obed",
  "Ujin",
  "Lang",
  "PrichV",
  "Ch_Print",
  "StopLQty",
  "Mono",
  "Divin",
  "DualBill",
  "MultiOrg",
  "Moldova",
  "Talons",
  "AgentSeb",
  "Ob1",
  "Ob2",
  "Ob3",
  "Ob4",
  "Ob5",
  "ObFP",
  "ObAdm",
  "ObInKass",
  "Bon",
  "ID_Zav",
  "BonusLive"
];

const BOOLEAN_FIELDS = new Set([
  "SchetAkc",
  "SchAdm",
  "NomPrint",
  "Koreshok",
  "UdNerasp",
  "Ceha",
  "BanketSkr",
  "SlojGramm",
  "PrichV",
  "Ch_Print",
  "StopLQty",
  "Mono",
  "Divin",
  "DualBill",
  "MultiOrg",
  "Moldova",
  "Talons",
  "AgentSeb",
  "ObFP",
  "ObAdm",
  "ObInKass",
  "Bon"
]);

const NUMBER_FIELDS = new Set([
  "CodVir",
  "StatVir",
  "CodZach",
  "CodePF",
  "CodeProizv",
  "CodeOst",
  "CodeHotel",
  "StatAvans",
  "CodeDep",
  "CodeAv",
  "Sklad0",
  "Lang",
  "Ob1",
  "Ob2",
  "Ob3",
  "Ob4",
  "Ob5",
  "ID_Zav",
  "BonusLive"
]);

function n(value) {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function timeOnly(value) {
  const text = String(value ?? "").trim();

  if (!text) {
    return "";
  }

  const match = text.match(
    /(?:T)?(\d{2}):(\d{2})(?::(\d{2}))?/
  );

  if (!match) {
    return "";
  }

  return `${match[1]}:${match[2]}`;
}

function withSqlTime(value) {
  const text = String(value ?? "").trim();

  if (!text) {
    return "";
  }

  return `1900-01-01T${text}:00`;
}

function withClockSeconds(value) {
  const text = String(value ?? "").trim();

  if (!text) {
    return "";
  }

  return `${text}:00`;
}

function normalizeParamsData(data) {
  const source = Array.isArray(data)
    ? data[0] ?? {}
    : data ?? {};

  const result = {
    ...source
  };

  for (const field of BOOLEAN_FIELDS) {
    result[field] = Boolean(source?.[field]);
  }

  for (const field of NUMBER_FIELDS) {
    result[field] = n(source?.[field]);
  }

  result.LangList = Array.isArray(source?.LangList)
    ? source.LangList
    : [];

  return result;
}

function snapshotEditable(params) {
  const snapshot = {};

  for (const field of EDITABLE_FIELDS) {
    snapshot[field] = params?.[field] ?? "";
  }

  return snapshot;
}

function buildParamsXml(params) {
  let xml = "<Ref><Params><row>";

  for (const field of EDITABLE_FIELDS) {
    let value = params?.[field];

    if (BOOLEAN_FIELDS.has(field)) {
      value = value ? 1 : 0;
    } else if (NUMBER_FIELDS.has(field)) {
      value = n(value);
    }

    xml += `<${field}>${escapeXml(value)}</${field}>`;
  }

  xml += "</row></Params></Ref>";
  return xml;
}

async function readJsonResponse(response, fallbackMessage) {
  const text = await response.text();
  let data;

  try {
    data = text.trim() ? JSON.parse(text) : [];
  } catch {
    throw new Error(
      `${fallbackMessage}: ${text.substring(0, 300)}`
    );
  }

  if (
    !response.ok ||
    (!Array.isArray(data) && data?.status === "error")
  ) {
    throw new Error(
      data?.error ||
        data?.message ||
        fallbackMessage
    );
  }

  return data;
}

function LookupSelect({
  value,
  options,
  valueField = "ID",
  labelField = "Name",
  placeholder,
  disabled,
  onChange
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const closeTimerRef = useRef(null);

  const selected = useMemo(
    () =>
      options.find(
        (item) =>
          n(item?.[valueField]) === n(value)
      ) ?? null,
    [options, value, valueField]
  );

  const filtered = useMemo(() => {
    const normalized = String(query ?? "")
      .trim()
      .toLocaleLowerCase();

    const source = normalized
      ? options.filter((item) =>
          String(item?.[labelField] ?? "")
            .toLocaleLowerCase()
            .includes(normalized)
        )
      : options;

    return source.slice(0, 80);
  }, [options, query, labelField]);

  function choose(item) {
    onChange?.(n(item?.[valueField]));
    setQuery("");
    setOpen(false);
  }

  function handleBlur() {
    closeTimerRef.current = window.setTimeout(
      () => setOpen(false),
      140
    );
  }

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="system-param-search">
      <input
        type="text"
        value={
          open
            ? query
            : String(selected?.[labelField] ?? "")
        }
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
            return;
          }

          if (event.key === "Enter") {
            event.preventDefault();

            if (filtered.length > 0) {
              choose(filtered[0]);
            }
          }
        }}
        onBlur={handleBlur}
      />

      {open && !disabled && (
        <div className="system-param-search-list">
          <button
            type="button"
            className="system-param-search-option muted"
            onMouseDown={(event) => {
              event.preventDefault();
              onChange?.(0);
              setQuery("");
              setOpen(false);
            }}
          >
            —
          </button>

          {filtered.length === 0 ? (
            <div className="system-param-search-empty">
              Ничего не найдено
            </div>
          ) : (
            filtered.map((item) => (
              <button
                key={String(item?.[valueField] ?? "")}
                type="button"
                className="system-param-search-option"
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(item);
                }}
              >
                {String(item?.[labelField] ?? "")}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  className = ""
}) {
  return (
    <label
      className={[
        "system-param-field",
        className
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span>{label}</span>
      {children}
    </label>
  );
}

function Check({
  label,
  checked,
  disabled,
  onChange
}) {
  return (
    <label className="system-param-check">
      <input
        type="checkbox"
        checked={Boolean(checked)}
        disabled={disabled}
        onChange={(event) =>
          onChange?.(event.target.checked)
        }
      />
      <span>{label}</span>
    </label>
  );
}

export default function SystemParametersPage({
  data,
  fetchWithAuth,
  readOnly = false,
  sklads = [],
  onDirtyChange,
  t = (key, fallback = "") => fallback
}) {
  const initialParams = useMemo(
    () => normalizeParamsData(data),
    [data]
  );

  const [params, setParams] = useState(initialParams);
  const [original, setOriginal] = useState(
    snapshotEditable(initialParams)
  );

  const [lookups, setLookups] = useState({
    cliKass: [],
    dohodKass: [],
    postavKass: [],
    zatrSpis: [],
    dishes: [],
    podrazd: []
  });

  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [saveState, setSaveState] = useState("idle");
  const [saveError, setSaveError] = useState("");
  const [activeTab, setActiveTab] = useState("main");
  const [stationsOpened, setStationsOpened] = useState(false);
  const [params2Dirty, setParams2Dirty] = useState(false);

  useEffect(() => {
    const normalized = normalizeParamsData(data);
    setParams(normalized);
    setOriginal(snapshotEditable(normalized));
    setSaveState("idle");
    setSaveError("");
  }, [data]);

  const currentSnapshot = useMemo(
    () => snapshotEditable(params),
    [params]
  );

  const isDirty =
    JSON.stringify(currentSnapshot) !==
    JSON.stringify(original);

  useEffect(() => {
    onDirtyChange?.(isDirty || params2Dirty);
  }, [isDirty, params2Dirty, onDirtyChange]);

  useEffect(() => {
    return () => {
      onDirtyChange?.(false);
    };
  }, [onDirtyChange]);

  useEffect(() => {
    function handleBeforeUnload(event) {
      if (!isDirty && !params2Dirty) return;

      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener(
      "beforeunload",
      handleBeforeUnload
    );

    return () => {
      window.removeEventListener(
        "beforeunload",
        handleBeforeUnload
      );
    };
  }, [isDirty, params2Dirty]);

  useEffect(() => {
    let cancelled = false;

    async function loadLookups() {
      setLookupLoading(true);
      setLookupError("");

      try {
        const requests = [
          fetchWithAuth(`${BASE_URL}wf_CliKass.php`),
          fetchWithAuth(
            `${BASE_URL}wf_Directory.php?Action=DohodKass`
          ),
          fetchWithAuth(`${BASE_URL}wf_PostavKass.php`),
          fetchWithAuth(
            `${BASE_URL}wf_Directory.php?Action=ZatrSpis`
          ),
          fetchWithAuth(`${BASE_URL}wf_DishesAll.php`),
          fetchWithAuth(`${BASE_URL}wf_Podrazd.php`)
        ];

        const responses = await Promise.all(requests);

        const [
          cliKass,
          dohodKass,
          postavKass,
          zatrSpis,
          dishes,
          podrazd
        ] = await Promise.all(
          responses.map((response) =>
            readJsonResponse(
              response,
              t(
                "SystemParameters.LookupLoadError",
                "Ошибка загрузки справочников"
              )
            )
          )
        );

        if (cancelled) return;

        setLookups({
          cliKass: Array.isArray(cliKass) ? cliKass : [],
          dohodKass: Array.isArray(dohodKass)
            ? dohodKass
            : [],
          postavKass: Array.isArray(postavKass)
            ? postavKass
            : [],
          zatrSpis: Array.isArray(zatrSpis)
            ? zatrSpis
            : [],
          dishes: Array.isArray(dishes) ? dishes : [],
          podrazd: Array.isArray(podrazd)
            ? podrazd
            : []
        });
      } catch (error) {
        if (!cancelled) {
          setLookupError(
            error?.message ||
              t(
                "SystemParameters.LookupLoadError",
                "Ошибка загрузки справочников"
              )
          );
        }
      } finally {
        if (!cancelled) {
          setLookupLoading(false);
        }
      }
    }

    loadLookups();

    return () => {
      cancelled = true;
    };
  }, [fetchWithAuth, t]);

  function change(field, value) {
    if (readOnly) return;

    setParams((current) => ({
      ...current,
      [field]: value
    }));

    setSaveState("idle");
    setSaveError("");
  }

  async function save() {
    if (
      readOnly ||
      !isDirty ||
      saveState === "saving"
    ) {
      return;
    }

    setSaveState("saving");
    setSaveError("");

    try {
      const body = new URLSearchParams();
      body.set("Action", "Params");
      body.set("xml", buildParamsXml(params));

      const response = await fetchWithAuth(
        `${BASE_URL}wf_RefSave.php`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded;charset=UTF-8"
          },
          body
        }
      );

      const text = await response.text();
      let result = null;

      if (text.trim()) {
        try {
          result = JSON.parse(text);
        } catch {
          if (!response.ok) {
            throw new Error(
              `${t(
                "SystemParameters.SaveError",
                "Ошибка сохранения параметров"
              )}: ${text.substring(0, 300)}`
            );
          }
        }
      }

      if (
        !response.ok ||
        result?.status === "error"
      ) {
        throw new Error(
          result?.error ||
            result?.message ||
            t(
              "SystemParameters.SaveError",
              "Ошибка сохранения параметров"
            )
        );
      }

      const reloadResponse = await fetchWithAuth(
        `${BASE_URL}wf_Directory.php?Action=Params`
      );

      const reloadedData = await readJsonResponse(
        reloadResponse,
        t(
          "SystemParameters.ReloadError",
          "Параметры сохранены, но не удалось перечитать данные"
        )
      );

      const normalized =
        normalizeParamsData(reloadedData);

      setParams(normalized);
      setOriginal(snapshotEditable(normalized));
      setSaveState("saved");

      window.setTimeout(() => {
        setSaveState((current) =>
          current === "saved" ? "idle" : current
        );
      }, 2500);
    } catch (error) {
      setSaveState("idle");
      setSaveError(
        error?.message ||
          t(
            "SystemParameters.SaveError",
            "Ошибка сохранения параметров"
          )
      );
    }
  }

  const disabled = readOnly || lookupLoading;

  return (
    <div className="system-parameters-page">
      <div className="system-parameters-header">
        <div>
          <h2>
            {t(
              "SystemParameters.Title",
              "Параметры системы"
            )}
          </h2>
          <div className="system-parameters-tabs">
            <button
              type="button"
              className={[
                "system-parameters-tab",
                activeTab === "main" ? "active" : ""
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setActiveTab("main")}
            >
              {t(
                "SystemParameters.MainTab",
                "Основные"
              )}
            </button>

            <button
              type="button"
              className={[
                "system-parameters-tab",
                activeTab === "stations" ? "active" : ""
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => {
                setStationsOpened(true);
                setActiveTab("stations");
              }}
            >
              {t(
                "SystemParameters.StationsTab",
                "Станции"
              )}
            </button>
          </div>
        </div>

        {activeTab === "main" && (
          <div className="system-parameters-save-area">
            <button
              type="button"
              className="primary-button system-parameters-save"
              disabled={
                readOnly ||
                !isDirty ||
                saveState === "saving"
              }
              onClick={save}
            >
              {saveState === "saving"
                ? t(
                    "SystemParameters.Saving",
                    "Сохранение..."
                  )
                : t(
                    "SystemParameters.Save",
                    "Сохранить"
                  )}
            </button>

            {saveState === "saved" && (
              <span
                className="system-parameters-saved"
                role="status"
              >
                ✓{" "}
                {t(
                  "Common.Saved",
                  "Сохранено"
                )}
              </span>
            )}
          </div>
        )}
      </div>

      <div
        className={
          activeTab === "main"
            ? "system-parameters-tab-body"
            : "system-parameters-tab-body is-hidden"
        }
      >
        {lookupError && (
        <div className="login-error">
          {lookupError}
        </div>
      )}

      {saveError && (
        <div className="login-error">
          {saveError}
        </div>
      )}

      {readOnly && (
        <div className="system-parameters-readonly">
          {t(
            "SystemParameters.ReadOnly",
            "Параметры доступны только для просмотра."
          )}
        </div>
      )}

      <div className="system-parameters-grid">
        <section className="system-parameters-card">
          <h3>
            {t(
              "SystemParameters.MainSettings",
              "Основные параметры"
            )}
          </h3>

          <div className="system-parameters-fields">
            <Field
              label={t(
                "SystemParameters.ShiftChange",
                "Пересменка"
              )}
            >
              <input
                type="time"
                step="60"
                value={timeOnly(params.Peresm)}
                disabled={readOnly}
                onChange={(event) =>
                  change(
                    "Peresm",
                    withClockSeconds(event.target.value)
                  )
                }
              />
            </Field>

            <Field
              label={t(
                "SystemParameters.RevenueAccount",
                "Выручка"
              )}
            >
              <LookupSelect
                value={params.CodVir}
                options={lookups.cliKass}
                labelField="Name"
                disabled={disabled}
                placeholder={t(
                  "SystemParameters.SelectValue",
                  "Выберите значение"
                )}
                onChange={(value) =>
                  change("CodVir", value)
                }
              />
            </Field>

            <Field
              label={t(
                "SystemParameters.RevenueIncomeArticle",
                "Статья прихода для выручки"
              )}
            >
              <LookupSelect
                value={params.StatVir}
                options={lookups.dohodKass}
                labelField="NameDohod"
                disabled={disabled}
                placeholder={t(
                  "SystemParameters.SelectValue",
                  "Выберите значение"
                )}
                onChange={(value) =>
                  change("StatVir", value)
                }
              />
            </Field>

            <Field
              label={t(
                "SystemParameters.Cleanup",
                "Зачистка"
              )}
            >
              <LookupSelect
                value={params.CodZach}
                options={lookups.postavKass}
                labelField="Name"
                disabled={disabled}
                placeholder={t(
                  "SystemParameters.SelectValue",
                  "Выберите значение"
                )}
                onChange={(value) =>
                  change("CodZach", value)
                }
              />
            </Field>

            <Field
              label={t(
                "SystemParameters.ForSemiFinished",
                "Для п/ф"
              )}
            >
              <LookupSelect
                value={params.CodePF}
                options={lookups.postavKass}
                labelField="Name"
                disabled={disabled}
                placeholder={t(
                  "SystemParameters.SelectValue",
                  "Выберите значение"
                )}
                onChange={(value) =>
                  change("CodePF", value)
                }
              />
            </Field>

            <Field
              label={t(
                "SystemParameters.PfCosts",
                "Затраты для ПФ"
              )}
            >
              <LookupSelect
                value={params.CodeProizv}
                options={lookups.zatrSpis}
                labelField="NameZatr"
                disabled={disabled}
                placeholder={t(
                  "SystemParameters.SelectValue",
                  "Выберите значение"
                )}
                onChange={(value) =>
                  change("CodeProizv", value)
                }
              />
            </Field>

            <Field
              label={t(
                "SystemParameters.Remains",
                "Остатки"
              )}
            >
              <LookupSelect
                value={params.CodeOst}
                options={lookups.postavKass}
                labelField="Name"
                disabled={disabled}
                placeholder={t(
                  "SystemParameters.SelectValue",
                  "Выберите значение"
                )}
                onChange={(value) =>
                  change("CodeOst", value)
                }
              />
            </Field>

            <Field
              label={t(
                "SystemParameters.RoomAccount",
                "Счет в номер"
              )}
            >
              <LookupSelect
                value={params.CodeHotel}
                options={lookups.cliKass}
                labelField="Name"
                disabled={disabled}
                placeholder={t(
                  "SystemParameters.SelectValue",
                  "Выберите значение"
                )}
                onChange={(value) =>
                  change("CodeHotel", value)
                }
              />
            </Field>

            <Field
              label={t(
                "SystemParameters.BanquetAdvanceArticle",
                "Статья прихода для авансов за банкет"
              )}
            >
              <LookupSelect
                value={params.StatAvans}
                options={lookups.dohodKass}
                labelField="NameDohod"
                disabled={disabled}
                placeholder={t(
                  "SystemParameters.SelectValue",
                  "Выберите значение"
                )}
                onChange={(value) =>
                  change("StatAvans", value)
                }
              />
            </Field>

            <Field
              label={t(
                "SystemParameters.DepositRemains",
                "Остатки депозита"
              )}
            >
              <LookupSelect
                value={params.CodeDep}
                options={lookups.dishes}
                labelField="Name"
                disabled={disabled}
                placeholder={t(
                  "SystemParameters.SelectValue",
                  "Выберите значение"
                )}
                onChange={(value) =>
                  change("CodeDep", value)
                }
              />
            </Field>

            <Field
              label={t(
                "SystemParameters.BanquetAdvanceTremol",
                "Аванс за банкет (только Tremol MD)"
              )}
            >
              <LookupSelect
                value={params.CodeAv}
                options={lookups.dishes}
                labelField="Name"
                disabled={disabled}
                placeholder={t(
                  "SystemParameters.SelectValue",
                  "Выберите значение"
                )}
                onChange={(value) =>
                  change("CodeAv", value)
                }
              />
            </Field>

            <Field
              label={t(
                "SystemParameters.XlsPath",
                "Путь для выгрузки в Xls"
              )}
            >
              <input
                type="text"
                value={params.PathXLS ?? ""}
                disabled={readOnly}
                onChange={(event) =>
                  change(
                    "PathXLS",
                    event.target.value
                  )
                }
              />
            </Field>

            <Field
              label={t(
                "SystemParameters.PluPath",
                "Путь к PLU"
              )}
            >
              <input
                type="text"
                value={params.PLUpath ?? ""}
                disabled={readOnly}
                onChange={(event) =>
                  change(
                    "PLUpath",
                    event.target.value
                  )
                }
              />
            </Field>

            <Field
              label={t(
                "SystemParameters.PluType",
                "PLU тип"
              )}
            >
              <select
                value={params.PLUtype ?? "CAS"}
                disabled={readOnly}
                onChange={(event) =>
                  change(
                    "PLUtype",
                    event.target.value
                  )
                }
              >
                <option value="CAS">CAS</option>
                <option value="SHTRIH">
                  SHTRIH
                </option>
                <option value="METTLER">
                  Mettler Toledo
                </option>
              </select>
            </Field>
          </div>

          <div className="system-parameters-check-grid compact">
            <Check
              label={t(
                "SystemParameters.MultiCompanyBill",
                "Счет на несколько предприятий"
              )}
              checked={params.SchetAkc}
              disabled={readOnly}
              onChange={(value) =>
                change("SchetAkc", value)
              }
            />
          </div>

          <Field
            className="system-param-field-wide"
            label={t(
              "SystemParameters.BillNote",
              "Примечание в счете"
            )}
          >
            <textarea
              rows={4}
              value={params.TextPech ?? ""}
              disabled={readOnly}
              onChange={(event) =>
                change(
                  "TextPech",
                  event.target.value
                )
              }
            />
          </Field>
        </section>

        <section className="system-parameters-card">
          <h3>
            {t(
              "SystemParameters.Operation",
              "Работа системы"
            )}
          </h3>

          <div className="system-parameters-fields">
            <Field
              label={t(
                "SystemParameters.DefaultDepartment",
                "Подразделение по умолчанию"
              )}
            >
              <LookupSelect
                value={params.Sklad0}
                options={lookups.podrazd}
                labelField="Name"
                disabled={disabled}
                placeholder={t(
                  "SystemParameters.SelectValue",
                  "Выберите значение"
                )}
                onChange={(value) =>
                  change("Sklad0", value)
                }
              />
            </Field>

            <Field
              label={t(
                "SystemParameters.Headline",
                "HeadLine"
              )}
            >
              <input
                type="text"
                value={params.HeadlineBB ?? ""}
                disabled={readOnly}
                onChange={(event) =>
                  change(
                    "HeadlineBB",
                    event.target.value
                  )
                }
              />
            </Field>

            <Field
              label={t(
                "SystemParameters.LunchStart",
                "Начало обеда"
              )}
            >
              <input
                type="time"
                value={timeOnly(params.Obed)}
                disabled={readOnly}
                onChange={(event) =>
                  change(
                    "Obed",
                    withSqlTime(event.target.value)
                  )
                }
              />
            </Field>

            <Field
              label={t(
                "SystemParameters.DinnerStart",
                "Начало ужина"
              )}
            >
              <input
                type="time"
                value={timeOnly(params.Ujin)}
                disabled={readOnly}
                onChange={(event) =>
                  change(
                    "Ujin",
                    withSqlTime(event.target.value)
                  )
                }
              />
            </Field>

            <Field
              label={t(
                "SystemParameters.SystemLanguage",
                "Language"
              )}
            >
              <select
                value={String(params.Lang ?? 0)}
                disabled={readOnly}
                onChange={(event) =>
                  change(
                    "Lang",
                    n(event.target.value)
                  )
                }
              >
                {params.LangList.map((item) => (
                  <option
                    key={String(item?.id ?? "")}
                    value={String(item?.id ?? 0)}
                  >
                    {String(item?.Name ?? "")}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="system-parameters-check-grid">
            <Check
              label={t(
                "SystemParameters.AdminBills",
                "Админы - счета"
              )}
              checked={params.SchAdm}
              disabled={readOnly}
              onChange={(value) =>
                change("SchAdm", value)
              }
            />

            <Check
              label={t(
                "SystemParameters.PrintBillNumber",
                "Печать номера счета"
              )}
              checked={params.NomPrint}
              disabled={readOnly}
              onChange={(value) =>
                change("NomPrint", value)
              }
            />

            <Check
              label={t(
                "SystemParameters.BillStub",
                "Корешок на счете"
              )}
              checked={params.Koreshok}
              disabled={readOnly}
              onChange={(value) =>
                change("Koreshok", value)
              }
            />

            <Check
              label={t(
                "SystemParameters.DeleteUnprinted",
                "Удаление нераспечатанных"
              )}
              checked={params.UdNerasp}
              disabled={readOnly}
              onChange={(value) =>
                change("UdNerasp", value)
              }
            />

            <Check
              label={t(
                "SystemParameters.Workshops",
                "Цеха"
              )}
              checked={params.Ceha}
              disabled={readOnly}
              onChange={(value) =>
                change("Ceha", value)
              }
            />

            <Check
              label={t(
                "SystemParameters.HideBanquets",
                "Скрывать банкеты"
              )}
              checked={params.BanketSkr}
              disabled={readOnly}
              onChange={(value) =>
                change("BanketSkr", value)
              }
            />

            <Check
              label={t(
                "SystemParameters.ComplexDishesGrams",
                "Сложные блюда в граммах"
              )}
              checked={params.SlojGramm}
              disabled={readOnly}
              onChange={(value) =>
                change("SlojGramm", value)
              }
            />

            <Check
              label={t(
                "SystemParameters.ReturnReasons",
                "Причины возврата"
              )}
              checked={params.PrichV}
              disabled={readOnly}
              onChange={(value) =>
                change("PrichV", value)
              }
            />

            <Check
              label="CheckBox Print"
              checked={params.Ch_Print}
              disabled={readOnly}
              onChange={(value) =>
                change("Ch_Print", value)
              }
            />

            <Check
              label={t(
                "SystemParameters.StopListQty",
                "Стоп лист Количество"
              )}
              checked={params.StopLQty}
              disabled={readOnly}
              onChange={(value) =>
                change("StopLQty", value)
              }
            />

            <Check
              label="Mono Expirenza"
              checked={params.Mono}
              disabled={readOnly}
              onChange={(value) =>
                change("Mono", value)
              }
            />

            <Check
              label={t(
                "SystemParameters.Predictions",
                "Предсказания"
              )}
              checked={params.Divin}
              disabled={readOnly}
              onChange={(value) =>
                change("Divin", value)
              }
            />

            <Check
              label={t(
                "SystemParameters.DualLanguageBill",
                "Счет на 2х языках"
              )}
              checked={params.DualBill}
              disabled={readOnly}
              onChange={(value) =>
                change("DualBill", value)
              }
            />

            <Check
              label="МультиОрг"
              checked={params.MultiOrg}
              disabled={readOnly}
              onChange={(value) =>
                change("MultiOrg", value)
              }
            />

            <Check
              label="Moldova"
              checked={params.Moldova}
              disabled={readOnly}
              onChange={(value) =>
                change("Moldova", value)
              }
            />

            <Check
              label={t(
                "SystemParameters.Talons",
                "Талоны"
              )}
              checked={params.Talons}
              disabled={readOnly}
              onChange={(value) =>
                change("Talons", value)
              }
            />

            <Check
              label={t(
                "SystemParameters.CostInJob",
                "Себестоимость в Job"
              )}
              checked={params.AgentSeb}
              disabled={readOnly}
              onChange={(value) =>
                change("AgentSeb", value)
              }
            />
          </div>
        </section>

        <section className="system-parameters-card system-parameters-card-wide">
          <h3>
            {t(
              "SystemParameters.Service",
              "Обслуживание"
            )}
          </h3>

          <div className="system-parameters-service-row">
            {[1, 2, 3, 4, 5].map((index) => (
              <Field
                key={index}
                label={String(index)}
                className="system-param-service-number"
              >
                <input
                  type="number"
                  value={params[`Ob${index}`] ?? 0}
                  disabled={readOnly}
                  onChange={(event) =>
                    change(
                      `Ob${index}`,
                      n(event.target.value)
                    )
                  }
                />
              </Field>
            ))}
          </div>

          <div className="system-parameters-check-grid service">
            <Check
              label={t(
                "SystemParameters.CreditFp",
                "Кред. ФП"
              )}
              checked={params.ObFP}
              disabled={readOnly}
              onChange={(value) =>
                change("ObFP", value)
              }
            />
            <Check
              label={t(
                "SystemParameters.Admin",
                "Админ"
              )}
              checked={params.ObAdm}
              disabled={readOnly}
              onChange={(value) =>
                change("ObAdm", value)
              }
            />
            <Check
              label={t(
                "SystemParameters.ToCashDesk",
                "В кассу"
              )}
              checked={params.ObInKass}
              disabled={readOnly}
              onChange={(value) =>
                change("ObInKass", value)
              }
            />
          </div>
        </section>

        <section className="system-parameters-card system-parameters-card-wide">
          <h3>Bonuses</h3>

          <div className="system-parameters-bonus-row">
            <Check
              label="Bonuses"
              checked={params.Bon}
              disabled={readOnly}
              onChange={(value) =>
                change("Bon", value)
              }
            />

            <Field label="ID">
              <input
                type="number"
                value={params.ID_Zav ?? 0}
                disabled={readOnly}
                onChange={(event) =>
                  change(
                    "ID_Zav",
                    n(event.target.value)
                  )
                }
              />
            </Field>

            <Field
              label={t(
                "SystemParameters.BonusLifetime",
                "Срок действия бонусов"
              )}
            >
              <div className="system-param-inline-help">
                <input
                  type="number"
                  min="0"
                  value={params.BonusLive ?? 0}
                  disabled={readOnly}
                  onChange={(event) =>
                    change(
                      "BonusLive",
                      n(event.target.value)
                    )
                  }
                />
                <span>
                  {t(
                    "SystemParameters.BonusLifetimeHint",
                    "(дней). 0 - бессрочно"
                  )}
                </span>
              </div>
            </Field>
          </div>
        </section>
      </div>
      </div>

      {stationsOpened && (
        <SystemParametersStationsTab
          fetchWithAuth={fetchWithAuth}
          readOnly={readOnly}
          sklads={sklads}
          multiPoint={Boolean(params.MultiPoint)}
          hidden={activeTab !== "stations"}
          onDirtyChange={setParams2Dirty}
          t={t}
        />
      )}
    </div>
  );
}
