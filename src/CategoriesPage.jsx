import { useEffect, useState } from "react";

const categoryFields = [
  "ID",
  "Name"
];

export default function CategoriesPage({
  data,
  readOnly,
  onAddCategory,
  onSaveCategory
}) {
  const [rows, setRows] = useState([]);
  const [changedRows, setChangedRows] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [addLoading, setAddLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState("");

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

  function buildCategoryXml(sourceRows) {
    const rowsXml = sourceRows
      .map((row) => {
        const fieldsXml = categoryFields
          .map((field) => `<${field}>${xmlValue(row[field])}</${field}>`)
          .join("");

        return `<row>${fieldsXml}</row>`;
      })
      .join("");

    return `<Ref><Categories>${rowsXml}</Categories></Ref>`;
  }

  async function addNewCategory() {
    if (readOnly) return;

    setAddLoading(true);
    setError("");

    try {
      const newItem = await onAddCategory();

      setRows((prevRows) => [newItem, ...prevRows]);

      setChangedRows((prev) => ({
        ...prev,
        [newItem.ID]: true
      }));

      setSelectedId(newItem.ID);
    } catch (err) {
      setError(err.message || "Ошибка добавления категории");
    } finally {
      setAddLoading(false);
    }
  }

  async function saveCategory() {
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

      const xml = buildCategoryXml(changedItems);

      await onSaveCategory(xml);

      setChangedRows({});
    } catch (err) {
      setError(err.message || "Ошибка сохранения категорий");
    } finally {
      setSaveLoading(false);
    }
  }

  return (
    <div>
      <div className="module-toolbar">
        <div className="toolbar-left">
          {Object.keys(changedRows).length > 0 && (
            <span className="changed-info">
              Изменено: {Object.keys(changedRows).length}
            </span>
          )}
        </div>

        <div className="toolbar-right">
          {!readOnly && (
            <button
              type="button"
              className="toolbar-save-button"
              disabled={addLoading}
              onClick={addNewCategory}
            >
              {addLoading ? "Добавление..." : "Добавить"}
            </button>
          )}

          {!readOnly && (
            <button
              type="button"
              className="toolbar-save-button"
              disabled={Object.keys(changedRows).length === 0 || saveLoading}
              onClick={saveCategory}
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
        <p>Список категорий пуст.</p>
      )}

      {rows.length > 0 && (
        <div className="table-wrap table-wrap-xnarrow">
          <table className="data-table compact-table">
            <thead>
              <tr>
                <th>Категория</th>
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
                      disabled={readOnly}
                      onChange={(e) => updateField(row.ID, "Name", e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}