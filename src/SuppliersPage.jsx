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
  t = (_, fallback = "") => fallback,
  locale = "ru-RU",
  data,
  org,
  readOnly,
  onAddSupplier,
  onSaveSupplier,
  onDirtyChange
}) {
  const [rows, setRows] = useState([]);
  const [changedRows, setChangedRows] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [addLoading, setAddLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState("");
  const [skrFilter, setSkrFilter] = useState("active");

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
          org:
            orgFromProp > 0
              ? orgFromProp
              : Number.isFinite(orgFromRow)
                ? orgFromRow
                : 0
        };

        const fieldsXml = fields
          .map(
            (field) =>
              `<${field}>${xmlValue(rowForXml[field])}</${field}>`
          )
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
      setError(err.message || t("Suppliers.ErrorAdd", "Ошибка добавления поставщика"));
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
      const changedItems = rows.filter((row) => changedRows[row.ID]);
      const xml = buildSupplierXml(changedItems);

      await onSaveSupplier(xml);

      setChangedRows({});
      onDirtyChange?.(false);
    } catch (err) {
      setError(err.message || t("Suppliers.ErrorSave", "Ошибка сохранения поставщиков"));
    } finally {
      setSaveLoading(false);
    }
  }

  return (
    <div className="suppliers-page">
      <div className="module-toolbar suppliers-toolbar">
        <div className="toolbar-left">

          <label className="filter-label">
            {t("Suppliers.Filter", "Фильтр")}:
            <select
              className="suppliers-filter-select"
              value={skrFilter}
              onChange={(e) => setSkrFilter(e.target.value)}
            >
              <option value="active">{t("Suppliers.Active", "Активные")}</option>
              <option value="all">{t("Suppliers.All", "Все")}</option>
              <option value="hidden">{t("Suppliers.Hidden", "Скрытые")}</option>
            </select>
          </label>

          {changedCount > 0 && (
            <span className="changed-info">
              {t("Suppliers.Changed", "Изменено")}: {changedCount}
            </span>
          )}
        </div>

        <div className="toolbar-right">
          {!readOnly && (
            <button
              type="button"
              className="toolbar-save-button suppliers-add-button"
              disabled={addLoading}
              onClick={addNewSupplier}
            >
              {addLoading ? t("Suppliers.Adding", "Добавление...") : t("Suppliers.Add", "Добавить")}
            </button>
          )}

          {!readOnly && (
            <button
              type="button"
              className="toolbar-save-button suppliers-save-button"
              disabled={changedCount === 0 || saveLoading}
              onClick={saveSupplier}
            >
              {saveLoading ? t("Suppliers.Saving", "Сохранение...") : t("Suppliers.Save", "Сохранить")}
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
        <div className="suppliers-empty">{t("Suppliers.Empty", "Список поставщиков пуст.")}</div>
      )}

      {rows.length > 0 && filteredRows.length === 0 && (
        <div className="suppliers-empty">{t("Suppliers.EmptyFilter", "По выбранному фильтру поставщиков нет.")}</div>
      )}

      {filteredRows.length > 0 && (
        <section className="suppliers-table-panel">
          <div className="table-wrap suppliers-table-wrap">
            <table className="data-table suppliers-table">
              <colgroup>
                <col className="suppliers-col-name" />
                <col className="suppliers-col-phone" />
                <col className="suppliers-col-debt" />
                <col className="suppliers-col-debt" />
                <col className="suppliers-col-flag" />
                <col className="suppliers-col-flag" />
              </colgroup>

              <thead>
              <tr>
                <th>{t("Suppliers.Supplier", "Поставщик")}</th>
                <th>{t("Suppliers.Phone", "Телефон")}</th>
                <th>{t("Suppliers.CashDebt", "Долг нал.")}</th>
                <th>{t("Suppliers.CashlessDebt", "Долг безнал.")}</th>
                <th>{t("Suppliers.HiddenAbbr", "Скр.")}</th>
                <th>{t("Suppliers.ServiceAbbr", "Служ.")}</th>
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
                      title={row.Name ?? ""}
                      disabled={readOnly}
                      onChange={(e) => updateField(row.ID, "Name", e.target.value)}
                    />
                  </td>

                  <td>
                    <input
                      className="table-input"
                      type="text"
                      value={row.Phone ?? ""}
                      title={row.Phone ?? ""}
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
        </section>
      )}
    </div>
  );
}