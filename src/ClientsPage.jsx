import { useEffect, useState } from "react";

const cardsPFields = [
  "ID",
  "Name",
  "NomCard",
  "Discount",
  "Phone",
  "Dolg",
  "Nom",
  "Nakop",
  "Post",
  "Slug",
  "Skr",
  "isBonus",
  "Bonus"
];

const cardsPDopFields = [
  "ID",
  "Dolg0",
  "Birtday",
  "email",
  "Rem",
  "BN"
];

const checkboxFields = [
  "Dolg",
  "Nakop",
  "Post",
  "Slug",
  "Skr",
  "BN"
];

export default function ClientsPage({
  data,
  discounts,
  readOnly,
  onAddCustomer,
  onSaveCustomer
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

  const discountRows = Array.isArray(discounts) ? discounts : [];

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
        const fieldsXml = fields
          .map((field) => `<${field}>${xmlValue(row[field])}</${field}>`)
          .join("");

        return `<row>${fieldsXml}</row>`;
      })
      .join("");
  }

  function buildCustomerXml(sourceRows) {
    const cardsPXml = buildRowsXml(sourceRows, cardsPFields);
    const cardsPDopXml = buildRowsXml(sourceRows, cardsPDopFields);

    return `<Ref><CardsP>${cardsPXml}</CardsP><CardsPDop>${cardsPDopXml}</CardsPDop></Ref>`;
  }

  async function addNewCustomer() {
    if (readOnly) return;

    setAddLoading(true);
    setError("");

    try {
      const newItem = await onAddCustomer();

      setRows((prevRows) => [newItem, ...prevRows]);

      setChangedRows((prev) => ({
        ...prev,
        [newItem.ID]: true
      }));

      setSelectedId(newItem.ID);

      if (!Boolean(newItem.Skr)) {
        setSkrFilter("active");
      }
    } catch (err) {
      setError(err.message || "Ошибка добавления клиента");
    } finally {
      setAddLoading(false);
    }
  }

  async function saveCustomer() {
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

      const xml = buildCustomerXml(changedItems);

      await onSaveCustomer(xml);

      setChangedRows({});
    } catch (err) {
      setError(err.message || "Ошибка сохранения клиентов");
    } finally {
      setSaveLoading(false);
    }
  }

  return (
    <div className="clients-page">
      <div className="module-toolbar clients-toolbar">
        <div className="toolbar-left">

          <label className="filter-label">
            Фильтр:
            <select
              className="clients-filter-select"
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
              className="toolbar-save-button clients-add-button"
              disabled={addLoading}
              onClick={addNewCustomer}
            >
              {addLoading ? "Добавление..." : "Добавить клиента"}
            </button>
          )}

          {!readOnly && (
            <button
              type="button"
              className="toolbar-save-button clients-save-button"
              disabled={Object.keys(changedRows).length === 0 || saveLoading}
              onClick={saveCustomer}
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
        <div className="perem-empty clients-empty">Список клиентов пуст.</div>
      )}

      {rows.length > 0 && filteredRows.length === 0 && (
        <div className="perem-empty clients-empty">По выбранному фильтру клиентов нет.</div>
      )}

      {filteredRows.length > 0 && (
        <div className="table-wrap clients-table-wrap">
            <table className="data-table clients-table">
              <thead>
              <tr>
                <th>Имя</th>
                <th>№ Карты</th>
                <th>Скидка</th>
                <th>Телефон</th>
                <th>Код карты</th>
                <th>Бонус</th>
                <th>Долг нач.</th>
                <th>День рождения</th>
                <th>Email</th>
                <th>Примечание</th>

                <th>Долг</th>
                <th>Накоп.</th>
                <th>Пост.</th>
                <th>Служ.</th>
                <th>Скр.</th>
                <th>БН</th>
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
                      value={row.NomCard ?? ""}
                      disabled={readOnly}
                      onChange={(e) => updateField(row.ID, "NomCard", e.target.value)}
                    />
                  </td>

                  <td>
                    <select
                      className="table-input"
                      value={row.Discount ?? 0}
                      disabled={readOnly}
                      onChange={(e) => updateField(row.ID, "Discount", Number(e.target.value))}
                    >
                      {discountRows.map((discount) => (
                        <option
                          key={discount.ID}
                          value={discount.ID}
                        >
                          {discount.Name}
                        </option>
                      ))}
                    </select>
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
                      className="table-input"
                      type="text"
                      value={row.Nom ?? ""}
                      disabled={readOnly}
                      onChange={(e) => updateField(row.ID, "Nom", e.target.value)}
                    />
                  </td>

                  <td>
                    <input
                      className="table-input text-right"
                      type="number"
                      value={row.Bonus ?? ""}
                      disabled={readOnly}
                      onChange={(e) => updateField(row.ID, "Bonus", e.target.value)}
                    />
                  </td>

                  <td>
                    <input
                      className="table-input text-right"
                      type="number"
                      value={row.Dolg0 ?? ""}
                      disabled={readOnly}
                      onChange={(e) => updateField(row.ID, "Dolg0", e.target.value)}
                    />
                  </td>

                  <td>
                    <input
                      className="table-input"
                      type="date"
                      value={row.Birtday ?? ""}
                      disabled={readOnly}
                      onChange={(e) => updateField(row.ID, "Birtday", e.target.value)}
                    />
                  </td>

                  <td>
                    <input
                      className="table-input"
                      type="text"
                      value={row.email ?? ""}
                      disabled={readOnly}
                      onChange={(e) => updateField(row.ID, "email", e.target.value)}
                    />
                  </td>

                  <td>
                    <input
                      className="table-input"
                      type="text"
                      value={row.Rem ?? ""}
                      disabled={readOnly}
                      onChange={(e) => updateField(row.ID, "Rem", e.target.value)}
                    />
                  </td>

                  {checkboxFields.map((field) => (
                    <td className="center" key={field}>
                      <input
                        type="checkbox"
                        checked={Boolean(row[field])}
                        disabled={readOnly}
                        onChange={(e) => updateField(row.ID, field, e.target.checked)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}