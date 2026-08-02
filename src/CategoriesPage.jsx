import { useEffect, useState } from "react";


const categoryFields = [
  "ID",
  "Name"
];

export default function CategoriesPage({
  t = (_, fallback = "") => fallback,
  locale = "ru-RU",
  data,
  readOnly,
  onAddCategory,
  onSaveCategory,
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
      setError(err.message || t("Categories.ErrorAdd", "Ошибка добавления категории"));
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
      onDirtyChange?.(false);
    } catch (err) {
      setError(err.message || t("Categories.ErrorSave", "Ошибка сохранения категорий"));
    } finally {
      setSaveLoading(false);
    }
  }

  return (
    <div className="categories-page">
      <div className="module-toolbar categories-toolbar">
        <div className="toolbar-left">
          {changedCount > 0 && (
            <span className="changed-info">
              {t("Categories.Changed", "Изменено")}: {changedCount}
            </span>
          )}
        </div>

        <div className="toolbar-right">
          {!readOnly && (
            <button
              type="button"
              className="toolbar-save-button categories-add-button"
              disabled={addLoading}
              onClick={addNewCategory}
            >
              {addLoading ? t("Categories.Adding", "Добавление...") : t("Categories.Add", "Добавить")}
            </button>
          )}

          {!readOnly && (
            <button
              type="button"
              className="toolbar-save-button categories-save-button"
              disabled={changedCount === 0 || saveLoading}
              onClick={saveCategory}
            >
              {saveLoading ? t("Categories.Saving", "Сохранение...") : t("Categories.Save", "Сохранить")}
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
        <div className="categories-empty">{t("Categories.Empty", "Список категорий пуст.")}</div>
      )}

      {rows.length > 0 && (
        <section className="categories-table-panel">
          <div className="table-wrap categories-table-wrap">
            <table className="data-table categories-table">
              <colgroup>
                <col className="categories-col-name" />
              </colgroup>

              <thead>
              <tr>
                <th>{t("Categories.Category", "Категория")}</th>
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