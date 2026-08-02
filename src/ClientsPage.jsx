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
  t = (_, fallback = "") => fallback,
  locale = "ru-RU",
  data,
  discounts,
  readOnly,
  onAddCustomer,
  onSaveCustomer,
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
      setError(err.message || t("Clients.ErrorAdd", "Ошибка добавления клиента"));
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
      onDirtyChange?.(false);
    } catch (err) {
      setError(err.message || t("Clients.ErrorSave", "Ошибка сохранения клиентов"));
    } finally {
      setSaveLoading(false);
    }
  }

  return (
    <div className="clients-page">
      <div className="module-toolbar clients-toolbar">
        <div className="toolbar-left">

          <label className="filter-label">
            {t("Clients.Filter", "Фильтр")}:
            <select
              className="clients-filter-select"
              value={skrFilter}
              onChange={(e) => setSkrFilter(e.target.value)}
            >
              <option value="active">{t("Clients.Active", "Активные")}</option>
              <option value="all">{t("Clients.All", "Все")}</option>
              <option value="hidden">{t("Clients.Hidden", "Скрытые")}</option>
            </select>
          </label>

          {changedCount > 0 && (
            <span className="changed-info">
              {t("Clients.Changed", "Изменено")}: {changedCount}
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
              {addLoading ? t("Clients.Adding", "Добавление...") : t("Clients.AddClient", "Добавить клиента")}
            </button>
          )}

          {!readOnly && (
            <button
              type="button"
              className="toolbar-save-button clients-save-button"
              disabled={changedCount === 0 || saveLoading}
              onClick={saveCustomer}
            >
              {saveLoading ? t("Clients.Saving", "Сохранение...") : t("Clients.SaveChanges", "Сохранить изменения")}
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
        <div className="clients-empty">{t("Clients.Empty", "Список клиентов пуст.")}</div>
      )}

      {rows.length > 0 && filteredRows.length === 0 && (
        <div className="clients-empty">{t("Clients.EmptyFilter", "По выбранному фильтру клиентов нет.")}</div>
      )}

      {filteredRows.length > 0 && (
        <section className="clients-table-panel">
          <div className="table-wrap clients-table-wrap">
            <table className="data-table clients-table">
              <colgroup>
                <col className="clients-col-name" />
                <col className="clients-col-card-number" />
                <col className="clients-col-discount" />
                <col className="clients-col-phone" />
                <col className="clients-col-card-code" />
                <col className="clients-col-bonus" />
                <col className="clients-col-opening-debt" />
                <col className="clients-col-birthday" />
                <col className="clients-col-email" />
                <col className="clients-col-note" />
                <col className="clients-col-flag" />
                <col className="clients-col-flag" />
                <col className="clients-col-flag" />
                <col className="clients-col-flag" />
                <col className="clients-col-flag" />
                <col className="clients-col-flag" />
              </colgroup>

              <thead>
              <tr>
                <th>{t("Clients.Name", "Имя")}</th>
                <th>{t("Clients.CardNumber", "№ Карты")}</th>
                <th>{t("Clients.Discount", "Скидка")}</th>
                <th>{t("Clients.Phone", "Телефон")}</th>
                <th>{t("Clients.CardCode", "Код карты")}</th>
                <th>{t("Clients.Bonus", "Бонус")}</th>
                <th>{t("Clients.OpeningDebt", "Долг нач.")}</th>
                <th>{t("Clients.Birthday", "День рождения")}</th>
                <th>{t("Clients.Email", "Email")}</th>
                <th>{t("Clients.Note", "Примечание")}</th>

                <th>{t("Clients.Debt", "Долг")}</th>
                <th>{t("Clients.AccumAbbr", "Накоп.")}</th>
                <th>{t("Clients.PermanentAbbr", "Пост.")}</th>
                <th>{t("Clients.ServiceAbbr", "Служ.")}</th>
                <th>{t("Clients.HiddenAbbr", "Скр.")}</th>
                <th>{t("Clients.CashlessAbbr", "БН")}</th>
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
                      value={row.NomCard ?? ""}
                      title={row.NomCard ?? ""}
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
                      title={row.Phone ?? ""}
                      disabled={readOnly}
                      onChange={(e) => updateField(row.ID, "Phone", e.target.value)}
                    />
                  </td>

                  <td>
                    <input
                      className="table-input"
                      type="text"
                      value={row.Nom ?? ""}
                      title={row.Nom ?? ""}
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
                      title={row.email ?? ""}
                      disabled={readOnly}
                      onChange={(e) => updateField(row.ID, "email", e.target.value)}
                    />
                  </td>

                  <td>
                    <input
                      className="table-input"
                      type="text"
                      value={row.Rem ?? ""}
                      title={row.Rem ?? ""}
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
        </section>
      )}
    </div>
  );
}