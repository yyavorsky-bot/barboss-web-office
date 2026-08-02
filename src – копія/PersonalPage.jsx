import { useEffect, useState } from "react";

const UNSAVED_CHANGES_MESSAGE =
  "Внимание! Вы не сохранили измененные данные!\nУверены, что хотите уйти?";

const checkboxFields = [
  "Skr",
  "Admin",
  "Upr",
  "Bil",
  "Nalog",
  "Dost",
  "Post",
  "Kli",
  "Kur",
  "Bond"
];

export default function PersonalPage({
  data,
  readOnly,
  onAddPersonal,
  onSavePersonal,
  onDirtyChange
}) {
  const [rows, setRows] = useState([]);
  const [changedRows, setChangedRows] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [addLoading, setAddLoading] = useState(false);
  const [error, setError] = useState("");

  // active = показываем только НЕ скрытых
  // all = показываем всех
  // hidden = показываем только скрытых
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
  }, [data]);

  const filteredRows = rows.filter((row) => {
    if (skrFilter === "all") return true;
    if (skrFilter === "hidden") return Boolean(row.Skr);

    return !Boolean(row.Skr);
  });
const cardsPFields = [
  "ID",
  "Name",
  "Pass",
  "Skr",
  "Admin",
  "Upr",
  "Bil",
  "Nalog",
  "Dost",
  "Post",
  "Kli",
  "Kur",
  "Phone",
  "Bond"
];

const cardsPDopFields = [
  "ID",
  "email",
  "Rem",
  "LoginMobile"
];

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

function buildPersonalXml(sourceRows) {
  const cardsPXml = buildRowsXml(sourceRows, cardsPFields);
  const cardsPDopXml = buildRowsXml(sourceRows, cardsPDopFields);

  return `<Personal><CardsP>${cardsPXml}</CardsP><CardsPDop>${cardsPDopXml}</CardsPDop></Personal>`;
}
async function saveRefItem(action, xml) {
  const body = new URLSearchParams();

  body.set("Action", action);
  body.set("xml", xml);

  return await fetchWithAuth("https://webback.bar-boss.com/wf_RefSave.php", {
    method: "POST",
    body
  });
}
async function savePersonal() {
  if (readOnly) return;

  const changedIds = Object.keys(changedRows);

  if (changedIds.length === 0) {
    return;
  }

  setError("");

  try {
    const changedItems = rows.filter((row) =>
      changedRows[row.ID]
    );

    const xml = buildPersonalXml(changedItems);

    await onSavePersonal(xml);

    setChangedRows({});
    onDirtyChange?.(false);
  } catch (err) {
    setError(err.message || "Ошибка сохранения сотрудников");
  }
}
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

  async function addNewPersonal() {
    if (readOnly) return;

    setAddLoading(true);
    setError("");

    try {
      const newItem = await onAddPersonal();

      setRows((prevRows) => [newItem, ...prevRows]);

      setChangedRows((prev) => ({
        ...prev,
        [newItem.ID]: true
      }));

      setSelectedId(newItem.ID);

      // Если новый сотрудник не скрытый, сразу показываем активных
      if (!Boolean(newItem.Skr)) {
        setSkrFilter("active");
      }
    } catch (err) {
      setError(err.message || "Ошибка добавления сотрудника");
    } finally {
      setAddLoading(false);
    }
  }

  return (
    <div className="personal-page">
      <div className="module-toolbar personal-toolbar">
        <div className="toolbar-left">
 
          <label className="filter-label">
            Фильтр : 
            <select
              className="personal-filter-select"
              value={skrFilter}
              onChange={(e) => setSkrFilter(e.target.value)}
            >
              <option value="active">Активные</option>
              <option value="all">Все</option>
              <option value="hidden">Скрытые</option>
            </select>
          </label>
        </div>

        <div className="toolbar-right">
          {!readOnly && (
            <button
              type="button"
              className="toolbar-save-button personal-add-button"
              disabled={addLoading}
              onClick={addNewPersonal}
            >
              {addLoading ? "Добавление..." : "Добавить сотрудника"}
            </button>
          )}

          {!readOnly && (
            <button
              type="button"
              className="toolbar-save-button personal-save-button"
              disabled={changedCount === 0}
              onClick={savePersonal}
            >
              Сохранить изменения
            </button>
          )}
          {changedCount > 0 && (
            <span className="changed-info">
              Изменено: {changedCount}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="login-error">
          {error}
        </div>
      )}

      {rows.length === 0 && (
        <div className="personal-empty">Список персонала пуст.</div>
      )}

      {rows.length > 0 && filteredRows.length === 0 && (
        <div className="personal-empty">По выбранному фильтру сотрудников нет.</div>
      )}

      {filteredRows.length > 0 && (
        <section className="personal-table-panel">
          <div className="table-wrap personal-table-wrap">
            <table className="data-table personal-table">
              <colgroup>
                <col className="personal-col-name" />
                <col className="personal-col-password" />
                <col className="personal-col-phone" />
                <col className="personal-col-email" />
                <col className="personal-col-note" />
                <col className="personal-col-mobile-login" />
                <col className="personal-col-flag" />
                <col className="personal-col-flag" />
                <col className="personal-col-flag" />
                <col className="personal-col-flag" />
                <col className="personal-col-flag" />
                <col className="personal-col-flag" />
                <col className="personal-col-flag" />
                <col className="personal-col-flag" />
                <col className="personal-col-flag" />
                <col className="personal-col-flag" />
              </colgroup>

              <thead>
              <tr>
                <th>Имя</th>
                <th>Пароль</th>
                <th>Телефон</th>
                <th>Email</th>
                <th>Примечание</th>
                <th>Mobile login</th>
                <th>Скр.</th>
                <th>Admin</th>
                <th>Упр.</th>
                <th>Бил.</th>
                <th>Налог</th>
                <th>Дост.</th>
                <th>Пост.</th>
                <th>Кли.</th>
                <th>Кур.</th>
                <th>Бонд</th>
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
                      value={row.Pass ?? ""}
                      disabled={readOnly}
                      onChange={(e) => updateField(row.ID, "Pass", e.target.value)}
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

                  <td>
                    <input
                      className="table-input"
                      type="text"
                      value={row.LoginMobile ?? ""}
                      title={row.LoginMobile ?? ""}
                      disabled={readOnly}
                      onChange={(e) => updateField(row.ID, "LoginMobile", e.target.value)}
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