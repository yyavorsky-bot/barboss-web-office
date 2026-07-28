import { useEffect, useState } from "react";

const cardsPFields = [
  "ID",
  "Name",
  "Phone",
  "Skr",
  "Slug"
];

const cardsSaldFields = [
  "ID",
  "org",
  "Dolg1",
  "Dolg2"
];

export default function SuppliersPage({
  data,
  org,
  readOnly,
  onAddSupplier,
  onSaveSupplier
}) {
  const [rows, setRows] = useState([]);
  const [changedRows, setChangedRows] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [addLoading, setAddLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState("");
  const [skrFilter, setSkrFilter] = useState("active");
  useEffect(() => {
    setRows(Array.isArray(data) ? data : []);
    setChangedRows({});
    setSelectedId(null);
    setError("");
    setAddLoading(false);
    setSaveLoading(false);
  }, [data]);
  
  function getOrgCode() {
  if (!org) return 0;

  if (typeof org === "object") {
    const n = Number(org.ID ?? org.id ?? 0);
    return Number.isFinite(n) ? n : 0;
  }

  const n = Number(org);
  return Number.isFinite(n) ? n : 0;
}

  const filteredRows = rows.filter((row) => {
    if (skrFilter === "all") return true;
    if (skrFilter === "hidden") return Boolean(row.Skr);

    return !Boolean(row.Skr);
  });

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
      const orgFromProp = getOrgCode();
      const orgFromRow = Number(row.org);

      const rowForXml = {
        ...row,
        org: orgFromProp > 0
          ? orgFromProp
          : Number.isFinite(orgFromRow)
            ? orgFromRow
            : 0
      };

      const fieldsXml = fields
        .map((field) => `<${field}>${xmlValue(rowForXml[field])}</${field}>`)
        .join("");

      return `<row>${fieldsXml}</row>`;
    })
    .join("");
}
  function buildSupplierXml(sourceRows) {
    const cardsPXml = buildRowsXml(sourceRows, cardsPFields);
    const cardsSaldXml = buildRowsXml(sourceRows, cardsSaldFields);

    return `<Ref><CardsP>${cardsPXml}</CardsP><CardsSald>${cardsSaldXml}</CardsSald></Ref>`;
  }

  async function addNewSupplier() {
    if (readOnly) return;

    setAddLoading(true);
    setError("");

    try {
      const newItem = await onAddSupplier();

      const newRow = {
        ...newItem,
        org: getOrgCode()
      };
      setRows((prevRows) => [newRow, ...prevRows]);

      setChangedRows((prev) => ({
        ...prev,
        [newRow.ID]: true
      }));

      setSelectedId(newRow.ID);

      if (!Boolean(newRow.Skr)) {
        setSkrFilter("active");
      }
    } catch (err) {
      setError(err.message || "Ошибка добавления поставщика");
    } finally {
      setAddLoading(false);
    }
  }

  async function saveSupplier() {
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

 const xml = buildSupplierXml(changedItems);

await onSaveSupplier(xml);

setChangedRows({});    } catch (err) {
      setError(err.message || "Ошибка сохранения поставщиков");
    } finally {
      setSaveLoading(false);
    }
  }

  return (
    <div>
      <div className="module-toolbar">
        <div className="toolbar-left">

          <label className="filter-label">
            Фильтр:
            <select
              value={skrFilter}
              onChange={(e) => setSkrFilter(e.target.value)}
            >
              <option value="active">Активные</option>
              <option value="all">Все</option>
              <option value="hidden">Скрытые</option>
            </select>
          </label>

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
              onClick={addNewSupplier}
            >
              {addLoading ? "Добавление..." : "Добавить"}
            </button>
          )}

          {!readOnly && (
            <button
              type="button"
              className="toolbar-save-button"
              disabled={Object.keys(changedRows).length === 0 || saveLoading}
              onClick={saveSupplier}
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
        <p>Список поставщиков пуст.</p>
      )}

      {rows.length > 0 && filteredRows.length === 0 && (
        <p>По выбранному фильтру поставщиков нет.</p>
      )}

      {filteredRows.length > 0 && (
        <div className="table-wrap table-wrap-suppliers">
          <table className="data-table compact-table">
            <thead>
              <tr>
                <th>Поставщик</th>
                <th>Телефон</th>
                <th>Долг нал.</th>
                <th>Долг безнал.</th>
                <th>Скр.</th>
                <th>Служ.</th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.map((row) => (
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
                      className="table-input"
                      type="text"
                      value={row.Phone ?? ""}
                      disabled={readOnly}
                      onChange={(e) => updateField(row.ID, "Phone", e.target.value)}
                    />
                  </td>

                  <td>
                    <input
                      className="table-input text-right"
                      type="number"
                      value={row.Dolg1 ?? ""}
                      disabled={readOnly}
                      onChange={(e) => updateField(row.ID, "Dolg1", e.target.value)}
                    />
                  </td>

                  <td>
                    <input
                      className="table-input text-right"
                      type="number"
                      value={row.Dolg2 ?? ""}
                      disabled={readOnly}
                      onChange={(e) => updateField(row.ID, "Dolg2", e.target.value)}
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

                  <td className="center">
                    <input
                      type="checkbox"
                      checked={Boolean(row.Slug)}
                      disabled={readOnly}
                      onChange={(e) => updateField(row.ID, "Slug", e.target.checked)}
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