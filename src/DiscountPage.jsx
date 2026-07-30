import { useEffect, useState } from "react";

const discountFields = [
  "ID",
  "Name",
  "Discount",
  "isBon"
];

export default function DiscountPage({
  data,
  readOnly,
  onSaveDiscount
}) {
  const [rows, setRows] = useState([]);
  const [changedRows, setChangedRows] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);

  useEffect(() => {
    setRows(Array.isArray(data) ? data : []);
    setChangedRows({});
    setSelectedId(null);
    setError("");
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

  function buildRowsXml(sourceRows, fields) {
    return sourceRows
      .map((row) => {
        const fieldsXml = fields
          .map((field) => `<${field}>${xmlValue(row[field])}</${field}>`)
          .join("");

        return `<row>${fieldsXml}</row>`;
      })
      .join("");
  }

  function buildDiscountXml(sourceRows) {
    const rowsXml = buildRowsXml(sourceRows, discountFields);

    return `<Ref><Discount>${rowsXml}</Discount></Ref>`;
  }

  async function saveDiscount() {
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

      const xml = buildDiscountXml(changedItems);

      await onSaveDiscount(xml);

      setChangedRows({});
    } catch (err) {
      setError(err.message || "Ошибка сохранения скидок");
    } finally {
      setSaveLoading(false);
    }
  }

  return (
    <div className="discount-page">
      <div className="module-toolbar discount-toolbar">
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
              className="toolbar-save-button discount-save-button"
              disabled={Object.keys(changedRows).length === 0 || saveLoading}
              onClick={saveDiscount}
            >
              {saveLoading ? "Сохранение..." : "Сохранить изменения"}
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
        <div className="perem-empty discount-empty">Список скидок пуст.</div>
      )}

      {rows.length > 0 && (
          <div className="table-wrap discount-table-wrap">
            <table className="data-table compact-table discount-table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Скидка, %</th>
                <th>Бонусная</th>
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

                  <td>
                    <input
                      className="table-input text-right"
                      type="number"
                      value={row.Discount ?? ""}
                      disabled={readOnly}
                      onChange={(e) => updateField(row.ID, "Discount", e.target.value)}
                    />  
                  </td>
                  <td className="center">
                    <input
                      type="checkbox"
                      checked={Boolean(row.isBon)}
                      disabled={readOnly}
                      onChange={(e) => updateField(row.ID, "isBon", e.target.checked)}
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