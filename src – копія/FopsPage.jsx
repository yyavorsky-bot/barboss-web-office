import { useEffect, useState } from "react";

const UNSAVED_CHANGES_MESSAGE =
  "Внимание! Вы не сохранили измененные данные!\nУверены, что хотите уйти?";

const fopFields = [
  "ID",
  "Name",
  "TaxGroup",
  "IfNoSelect"
];

const taxGroupOptions = [
  { value: 0, label: "нет" },
  { value: 1, label: "А" },
  { value: 2, label: "Б" },
  { value: 3, label: "В" },
  { value: 4, label: "Г" },
  { value: 5, label: "Д" },
  { value: 6, label: "Е" },
  { value: 7, label: "Ж" },
  { value: 8, label: "З" }
];

export default function FopsPage({
  data,
  readOnly,
  onAddFop,
  onSaveFop,
  onDirtyChange
}) {
  const [rows, setRows] = useState([]);
  const [changedRows, setChangedRows] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [addLoading, setAddLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState("");

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
    setError("");
    setAddLoading(false);
    setSaveLoading(false);
  }, [data]);

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

  function escapeXml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;");
  }

  function xmlValue(value) {
    if (typeof value === "boolean") {
      return value ? "1" : "0";
    }

    if (value === null || value === undefined) {
      return "";
    }

    return escapeXml(value);
  }

  function buildFopXml(sourceRows) {
    const rowsXml = sourceRows
      .map((row) => {
        const fieldsXml = fopFields
          .map((field) => `<${field}>${xmlValue(row[field])}</${field}>`)
          .join("");

        return `<row>${fieldsXml}</row>`;
      })
      .join("");

    return `<Ref><Tax>${rowsXml}</Tax></Ref>`;
  }

  async function addNewFop() {
    if (readOnly) return;

    setAddLoading(true);
    setError("");

    try {
      const newItem = await onAddFop();

      setRows((prevRows) => [newItem, ...prevRows]);

      setChangedRows((prev) => ({
        ...prev,
        [newItem.ID]: true
      }));

      setSelectedId(newItem.ID);
    } catch (err) {
      setError(err.message || "Ошибка добавления предприятия");
    } finally {
      setAddLoading(false);
    }
  }

  async function saveFop() {
    if (readOnly) return;

    const changedIds = Object.keys(changedRows);

    if (changedIds.length === 0) {
      return;
    }

    setSaveLoading(true);
    setError("");

    try {
      const changedItems = rows.filter((row) =>
        changedRows[row.ID]
      );

      const xml = buildFopXml(changedItems);

      await onSaveFop(xml);

      setChangedRows({});
      onDirtyChange?.(false);
    } catch (err) {
      setError(err.message || "Ошибка сохранения предприятий");
    } finally {
      setSaveLoading(false);
    }
  }

  return (
    <div className="fops-page">
      <div className="module-toolbar fops-toolbar">
        <div className="toolbar-left">
           {changedCount > 0 && (
            <span className="changed-info">
              Изменено: {changedCount}
            </span>
          )}
        </div>

        <div className="toolbar-right">
          {!readOnly && (
            <button
              type="button"
              className="toolbar-save-button fops-add-button"
              disabled={addLoading}
              onClick={addNewFop}
            >
              {addLoading ? "Добавление..." : "Добавить"}
            </button>
          )}

          {!readOnly && (
            <button
              type="button"
              className="toolbar-save-button fops-save-button"
              disabled={changedCount === 0 || saveLoading}
              onClick={saveFop}
            >
              {saveLoading ? "Сохранение..." : "Сохранить"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="login-error">
          {error}
        </div>
      )}

      {rows.length === 0 && (
        <div className="fops-empty">Список предприятий пуст.</div>
      )}

      {rows.length > 0 && (
        <section className="fops-table-panel">
          <div className="table-wrap fops-table-wrap">
            <table className="data-table fops-table">
              <colgroup>
                <col className="fops-col-name" />
                <col className="fops-col-tax-group" />
                <col className="fops-col-default" />
              </colgroup>

              <thead>
              <tr>
                <th>Предприятие</th>
                <th>Налоговая группа</th>
                <th>По умолчанию</th>
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
                      className="table-input"
                      type="text"
                      value={row.Name ?? ""}
                      title={row.Name ?? ""}
                      disabled={readOnly}
                      onChange={(e) => updateField(row.ID, "Name", e.target.value)}
                    />
                  </td>

                  <td>
                    <select
                      className="table-input"
                      value={row.TaxGroup ?? 0}
                      disabled={readOnly}
                      onChange={(e) => updateField(row.ID, "TaxGroup", Number(e.target.value))}
                    >
                      {taxGroupOptions.map((item) => (
                        <option
                          key={item.value}
                          value={item.value}
                        >
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="center">
                    <input
                      type="checkbox"
                      checked={Boolean(row.IfNoSelect)}
                      disabled={readOnly}
                      onChange={(e) => updateField(row.ID, "IfNoSelect", e.target.checked)}
                    />
                  </td>
                </tr>
              ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}