import { useEffect, useMemo, useRef, useState } from "react";

function normalizeBoolean(value) {
  if (value === true || value === 1) return true;
  const text = String(value ?? "").trim().toLowerCase();
  return text === "true" || text === "1" || text === "yes";
}

function normalizeNullableNumber(value) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }

  const normalized = String(value).replace(",", ".");
  const numberValue = Number(normalized);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getRowId(row) {
  return Number(row?.Id ?? row?.ID ?? 0);
}

function getSkladId(row) {
  return Number(row?.ID ?? row?.Code ?? row?.Id ?? 0);
}

function getSkladName(row) {
  return String(
    row?.Name ??
      row?.NameSkl ??
      row?.NamePodr ??
      row?.NameCeh ??
      row?.Code ??
      row?.ID ??
      ""
  );
}

function normalizeRows(data) {
  const source = Array.isArray(data) ? data : [];

  return source.map((row) => ({
    Id: getRowId(row),
    NamePodr: String(row?.NamePodr ?? ""),
    ProcZP: normalizeNullableNumber(row?.ProcZP),
    VklDolg: normalizeBoolean(row?.VklDolg),
    items: (Array.isArray(row?.items) ? row.items : []).map((item) => ({
      Id: getRowId(item),
      IdSkl: Number(item?.IdSkl ?? 0),
      Vkl: normalizeBoolean(item?.Vkl)
    }))
  }));
}

function snapshotRows(rows) {
  return JSON.stringify(
    rows.map((row) => ({
      Id: Number(row.Id || 0),
      NamePodr: String(row.NamePodr ?? ""),
      ProcZP: normalizeNullableNumber(row.ProcZP),
      VklDolg: Boolean(row.VklDolg),
      items: (Array.isArray(row.items) ? row.items : []).map((item) => ({
        Id: Number(item.Id || 0),
        IdSkl: Number(item.IdSkl || 0),
        Vkl: Boolean(item.Vkl)
      }))
    }))
  );
}

function buildSaveXml(rows) {
  const body = rows
    .map((row) => {
      const itemsXml = (Array.isArray(row.items) ? row.items : [])
        .map(
          (item) =>
            `<row><Id>${escapeXml(item.Id)}</Id><IdSkl>${escapeXml(
              item.IdSkl
            )}</IdSkl><Vkl>${item.Vkl ? 1 : 0}</Vkl></row>`
        )
        .join("");

      return `<row><Id>${escapeXml(row.Id)}</Id><NamePodr>${escapeXml(
        row.NamePodr
      )}</NamePodr><ProcZP>${escapeXml(
        row.ProcZP === null || row.ProcZP === undefined ? "" : row.ProcZP
      )}</ProcZP><VklDolg>${row.VklDolg ? 1 : 0}</VklDolg><items>${itemsXml}</items></row>`;
    })
    .join("");

  return `<ForZP>${body}</ForZP>`;
}

export default function SalaryParametersPage({
  data,
  sklads = [],
  readOnly = false,
  onDirtyChange,
  onSave,
  t = (key, fallback = "") => fallback
}) {
  const [rows, setRows] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [saveState, setSaveState] = useState("idle");
  const [error, setError] = useState("");

  const originalSnapshotRef = useRef("[]");
  const nextRowIdRef = useRef(-1);
  const nextItemIdRef = useRef(-1);
  const savedTimerRef = useRef(null);

  useEffect(() => {
    const normalized = normalizeRows(data);
    const negativeIds = [];

    normalized.forEach((row) => {
      if (row.Id < 0) negativeIds.push(row.Id);
      row.items.forEach((item) => {
        if (item.Id < 0) negativeIds.push(item.Id);
      });
    });

    const nextNegative = negativeIds.length > 0 ? Math.min(...negativeIds) - 1 : -1;
    nextRowIdRef.current = nextNegative;
    nextItemIdRef.current = nextNegative - 100000;

    setRows(normalized);
    originalSnapshotRef.current = snapshotRows(normalized);
    setSelectedId((previousId) => {
      if (
        previousId !== null &&
        normalized.some((row) => Number(row.Id) === Number(previousId))
      ) {
        return Number(previousId);
      }

      return normalized[0] ? Number(normalized[0].Id) : null;
    });
    setError("");
  }, [data]);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) {
        window.clearTimeout(savedTimerRef.current);
      }
    };
  }, []);

  const isDirty = useMemo(
    () => snapshotRows(rows) !== originalSnapshotRef.current,
    [rows]
  );

  useEffect(() => {
    onDirtyChange?.(isDirty);

    if (isDirty && saveState === "saved") {
      setSaveState("idle");
    }
  }, [isDirty, onDirtyChange, saveState]);

  const selectedRow = useMemo(
    () =>
      rows.find((row) => Number(row.Id) === Number(selectedId)) ??
      rows[0] ??
      null,
    [rows, selectedId]
  );

  const skladOptions = useMemo(
    () =>
      (Array.isArray(sklads) ? sklads : [])
        .map((row) => ({
          id: getSkladId(row),
          name: getSkladName(row)
        }))
        .filter((row) => row.id > 0),
    [sklads]
  );

  function updateParent(id, field, value) {
    if (readOnly) return;

    setRows((currentRows) =>
      currentRows.map((row) =>
        Number(row.Id) === Number(id) ? { ...row, [field]: value } : row
      )
    );
  }

  function addParent() {
    if (readOnly) return;

    const id = nextRowIdRef.current;
    nextRowIdRef.current -= 1;

    const newRow = {
      Id: id,
      NamePodr: "",
      ProcZP: null,
      VklDolg: false,
      items: []
    };

    setRows((currentRows) => [newRow, ...currentRows]);
    setSelectedId(id);
    setError("");
  }

  function deleteParent(id) {
    if (readOnly) return;

    setRows((currentRows) => {
      const index = currentRows.findIndex(
        (row) => Number(row.Id) === Number(id)
      );
      const nextRows = currentRows.filter(
        (row) => Number(row.Id) !== Number(id)
      );

      if (Number(selectedId) === Number(id)) {
        const nextSelected =
          nextRows[Math.min(Math.max(index, 0), Math.max(nextRows.length - 1, 0))] ??
          null;
        setSelectedId(nextSelected ? Number(nextSelected.Id) : null);
      }

      return nextRows;
    });
  }

  function availableSkladsForRow(parentRow, currentItemId = null) {
    const used = new Set(
      (Array.isArray(parentRow?.items) ? parentRow.items : [])
        .filter((item) => Number(item.Id) !== Number(currentItemId))
        .map((item) => Number(item.IdSkl || 0))
        .filter((id) => id > 0)
    );

    return skladOptions.filter((option) => !used.has(option.id));
  }

  function addItem() {
    if (readOnly || !selectedRow) return;

    const available = availableSkladsForRow(selectedRow);

    if (available.length === 0) {
      window.alert(
        t(
          "SalaryParams.AllDepartmentsAdded",
          "Все подразделения уже добавлены."
        )
      );
      return;
    }

    const id = nextItemIdRef.current;
    nextItemIdRef.current -= 1;

    const newItem = {
      Id: id,
      IdSkl: available[0].id,
      Vkl: true
    };

    setRows((currentRows) =>
      currentRows.map((row) =>
        Number(row.Id) === Number(selectedRow.Id)
          ? { ...row, items: [...row.items, newItem] }
          : row
      )
    );
  }

  function updateItem(itemId, field, value) {
    if (readOnly || !selectedRow) return;

    setRows((currentRows) =>
      currentRows.map((row) => {
        if (Number(row.Id) !== Number(selectedRow.Id)) return row;

        return {
          ...row,
          items: row.items.map((item) =>
            Number(item.Id) === Number(itemId)
              ? { ...item, [field]: value }
              : item
          )
        };
      })
    );
  }

  function deleteItem(itemId) {
    if (readOnly || !selectedRow) return;

    setRows((currentRows) =>
      currentRows.map((row) =>
        Number(row.Id) === Number(selectedRow.Id)
          ? {
              ...row,
              items: row.items.filter(
                (item) => Number(item.Id) !== Number(itemId)
              )
            }
          : row
      )
    );
  }

  async function save() {
    if (readOnly || !isDirty || typeof onSave !== "function") return;

    setSaveState("saving");
    setError("");

    try {
      await onSave(buildSaveXml(rows));
      originalSnapshotRef.current = snapshotRows(rows);
      setSaveState("saved");
      onDirtyChange?.(false);

      if (savedTimerRef.current) {
        window.clearTimeout(savedTimerRef.current);
      }

      savedTimerRef.current = window.setTimeout(() => {
        setSaveState((current) => (current === "saved" ? "idle" : current));
      }, 2500);
    } catch (saveError) {
      setSaveState("idle");
      setError(
        saveError?.message ||
          t("SalaryParams.SaveError", "Ошибка сохранения параметров зарплаты")
      );
    }
  }

  return (
    <div className="salary-params-page">
      <div className="module-toolbar salary-params-toolbar">
        <div className="toolbar-left">
          {!readOnly && (
            <button
              type="button"
              className="small-action-button"
              onClick={addParent}
            >
              {t("Directory.Add", "Добавить")}
            </button>
          )}
        </div>

        {!readOnly && (
          <div className="toolbar-right salary-params-save-area">
            {saveState === "saved" && (
              <span className="salary-params-saved">
                ✓ {t("Common.Saved", "Сохранено")}
              </span>
            )}
            <button
              type="button"
              className="save-button save-button-active"
              disabled={!isDirty || saveState === "saving"}
              onClick={save}
            >
              {saveState === "saving"
                ? t("Directory.Saving", "Сохранение...")
                : t("Directory.Save", "Сохранить")}
            </button>
          </div>
        )}
      </div>

      {error && <div className="login-error salary-params-error">{error}</div>}

      <section className="salary-params-panel salary-params-master-panel">
        <div className="salary-params-table-wrap">
          <table className="data-table salary-params-table salary-params-master-table">
            <thead>
              <tr>
                <th>{t("Directory.Name", "Наименование")}</th>
                <th className="salary-params-percent-col">
                  {t("Personal.SalaryPercent", "ЗП %")}
                </th>
                <th className="salary-params-check-col salary-params-debt-col">
                  {t("SalaryParams.IncludeDebt", "Включая долговые")}
                </th>
                {!readOnly && <th className="salary-params-delete-col" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const selected = Number(row.Id) === Number(selectedRow?.Id);

                return (
                  <tr
                    key={row.Id}
                    className={selected ? "selected-row" : ""}
                    onClick={() => setSelectedId(Number(row.Id))}
                  >
                    <td>
                      {readOnly ? (
                        row.NamePodr
                      ) : (
                        <input
                          type="text"
                          className="table-input salary-params-name-input"
                          value={row.NamePodr}
                          onFocus={() => setSelectedId(Number(row.Id))}
                          onChange={(event) =>
                            updateParent(row.Id, "NamePodr", event.target.value)
                          }
                        />
                      )}
                    </td>
                    <td className="salary-params-percent-col">
                      {readOnly ? (
                        row.ProcZP ?? ""
                      ) : (
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="99"
                          className="table-input table-input-num salary-params-percent-input"
                          value={row.ProcZP ?? ""}
                          onFocus={() => setSelectedId(Number(row.Id))}
                          onChange={(event) =>
                            updateParent(
                              row.Id,
                              "ProcZP",
                              event.target.value === ""
                                ? null
                                : normalizeNullableNumber(event.target.value)
                            )
                          }
                        />
                      )}
                    </td>
                    <td className="salary-params-check-col salary-params-debt-col">
                      <input
                        type="checkbox"
                        checked={Boolean(row.VklDolg)}
                        disabled={readOnly}
                        onFocus={() => setSelectedId(Number(row.Id))}
                        onChange={(event) =>
                          updateParent(row.Id, "VklDolg", event.target.checked)
                        }
                        onClick={(event) => event.stopPropagation()}
                      />
                    </td>
                    {!readOnly && (
                      <td className="salary-params-delete-col">
                        <button
                          type="button"
                          className="small-danger-button"
                          title={t("Directory.Delete", "Удалить")}
                          aria-label={t("Directory.Delete", "Удалить")}
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteParent(row.Id);
                          }}
                        >
                          ×
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}

              {rows.length === 0 && (
                <tr>
                  <td
                    className="salary-params-empty"
                    colSpan={readOnly ? 3 : 4}
                  >
                    {t("SalaryParams.Empty", "Параметры зарплаты не заданы.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="salary-params-panel salary-params-detail-panel">
        <div className="salary-params-detail-heading">
          <strong>{t("SalaryParams.Departments", "Подразделения")}</strong>
          {selectedRow?.NamePodr && <span> — {selectedRow.NamePodr}</span>}
          {!readOnly && selectedRow && (
            <button
              type="button"
              className="small-action-button"
              onClick={addItem}
            >
              {t("SalaryParams.AddDepartment", "Добавить подразделение")}
            </button>
          )}
        </div>

        {selectedRow ? (
          <div className="salary-params-table-wrap salary-params-detail-wrap">
            <table className="data-table salary-params-table salary-params-detail-table">
              <thead>
                <tr>
                  <th>{t("SalaryParams.Department", "Подразделение")}</th>
                  <th className="salary-params-check-col">
                    {t("SalaryParams.Enabled", "Вкл.")}
                  </th>
                  {!readOnly && <th className="salary-params-delete-col" />}
                </tr>
              </thead>
              <tbody>
                {selectedRow.items.map((item) => {
                  const available = availableSkladsForRow(selectedRow, item.Id);
                  const hasCurrent = available.some(
                    (option) => Number(option.id) === Number(item.IdSkl)
                  );
                  const options = hasCurrent
                    ? available
                    : [
                        {
                          id: Number(item.IdSkl || 0),
                          name: `ID ${Number(item.IdSkl || 0)}`
                        },
                        ...available
                      ];

                  return (
                    <tr key={item.Id}>
                      <td>
                        {readOnly ? (
                          options.find(
                            (option) => Number(option.id) === Number(item.IdSkl)
                          )?.name || `ID ${item.IdSkl}`
                        ) : (
                          <select
                            className="table-select salary-params-sklad-select"
                            value={String(item.IdSkl || "")}
                            onChange={(event) =>
                              updateItem(item.Id, "IdSkl", Number(event.target.value))
                            }
                          >
                            {options.map((option) => (
                              <option key={option.id} value={String(option.id)}>
                                {option.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="salary-params-check-col">
                        <input
                          type="checkbox"
                          checked={Boolean(item.Vkl)}
                          disabled={readOnly}
                          onChange={(event) =>
                            updateItem(item.Id, "Vkl", event.target.checked)
                          }
                        />
                      </td>
                      {!readOnly && (
                        <td className="salary-params-delete-col">
                          <button
                            type="button"
                            className="small-danger-button"
                            title={t("Directory.Delete", "Удалить")}
                            aria-label={t("Directory.Delete", "Удалить")}
                            onClick={() => deleteItem(item.Id)}
                          >
                            ×
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}

                {selectedRow.items.length === 0 && (
                  <tr>
                    <td
                      className="salary-params-empty"
                      colSpan={readOnly ? 2 : 3}
                    >
                      {t(
                        "SalaryParams.NoDepartments",
                        "Для выбранной строки подразделения не заданы."
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="salary-params-empty salary-params-select-hint">
            {t(
              "SalaryParams.SelectRow",
              "Выберите строку параметров зарплаты."
            )}
          </div>
        )}
      </section>
    </div>
  );
}
