import { useEffect, useState } from "react";


const groupFields = [
  "ID",
  "Name",
  "Ind",
  "Sk01",
  "Sk02",
  "Sk03",
  "Sk04",
  "Sk05",
  "Sk06",
  "Sk07",
  "Sk08",
  "Sk09",
  "Sk10",
  "Sk11",
  "Sk12",
  "Sk13",
  "Sk14",
  "Sk15",
  "IdGroup"
];

const skFields = [
  "Sk01",
  "Sk02",
  "Sk03",
  "Sk04",
  "Sk05",
  "Sk06",
  "Sk07",
  "Sk08",
  "Sk09",
  "Sk10",
  "Sk11",
  "Sk12",
  "Sk13",
  "Sk14",
  "Sk15"
];

export default function GroupsPage({
  t = (_, fallback = "") => fallback,
  locale = "ru-RU",
  data,
  discounts,
  readOnly,
  onAddGroup,
  onSaveGroup,
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
    setAddLoading(false);
    setSaveLoading(false);
    setError("");
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

  function buildGroupsXml(sourceRows) {
    const rowsXml = sourceRows
      .map((row) => {
        const fieldsXml = groupFields
          .map((field) => `<${field}>${xmlValue(row[field])}</${field}>`)
          .join("");

        return `<row>${fieldsXml}</row>`;
      })
      .join("");

    return `<Ref><Groups>${rowsXml}</Groups></Ref>`;
  }

  function getDiscountBySkField(field) {
    const id = Number(field.replace("Sk", ""));
    const safeDiscounts = Array.isArray(discounts) ? discounts : [];

    return safeDiscounts.find((item) => Number(item.ID) === id) ?? null;
  }

  function formatDiscountValue(discount) {
    if (!discount) return "";

    if (discount.Discount === null || discount.Discount === undefined) {
      return "";
    }

    return String(discount.Discount);
  }

  async function addNewGroup() {
    if (readOnly || !onAddGroup) return;

    setAddLoading(true);
    setError("");

    try {
      const newGroup = await onAddGroup();

      setRows((prevRows) => [newGroup, ...prevRows]);

      setChangedRows((prev) => ({
        ...prev,
        [newGroup.ID]: true
      }));

      setSelectedId(newGroup.ID);
    } catch (err) {
      setError(err.message || t("Groups.ErrorAdd", "Ошибка добавления группы блюд"));
    } finally {
      setAddLoading(false);
    }
  }

  async function saveGroups() {
    if (readOnly || !onSaveGroup) return;

    const changedIds = Object.keys(changedRows);

    if (changedIds.length === 0) {
      return;
    }

    setSaveLoading(true);
    setError("");

    try {
      const changedItems = rows.filter((row) => changedRows[row.ID]);

      const xml = buildGroupsXml(changedItems);


      await onSaveGroup(xml);

      setChangedRows({});
      onDirtyChange?.(false);
    } catch (err) {
      setError(err.message || t("Groups.ErrorSave", "Ошибка сохранения групп блюд"));
    } finally {
      setSaveLoading(false);
    }
  }

  return (
    <div className="groups-page">
      <div className="module-toolbar groups-toolbar">
        <div className="toolbar-left">
          {changedCount > 0 && (
            <span className="changed-info">
              {t("Groups.Changed", "Изменено")}: {changedCount}
            </span>
          )}
        </div>

        <div className="toolbar-right">
          {!readOnly && (
            <button
              type="button"
              className="toolbar-save-button groups-add-button"
              disabled={addLoading}
              onClick={addNewGroup}
            >
              {addLoading ? t("Groups.Adding", "Добавление...") : t("Groups.Add", "Добавить")}
            </button>
          )}

          {!readOnly && (
            <button
              type="button"
              className="toolbar-save-button groups-save-button"
              disabled={changedCount === 0 || saveLoading}
              onClick={saveGroups}
            >
              {saveLoading ? t("Groups.Saving", "Сохранение...") : t("Groups.Save", "Сохранить")}
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
        <div className="groups-empty">{t("Groups.Empty", "Список групп блюд пуст.")}</div>
      )}

      {rows.length > 0 && (
        <section className="groups-table-panel">
          <div className="table-wrap groups-table-wrap">
            <table className="data-table groups-table">
              <colgroup>
                <col className="col-group-name" />
                <col className="col-group-ind" />
                <col className="col-group-parent" />

                {skFields.map((field) => (
                  <col key={field} className="col-sk" />
                ))}
              </colgroup>

              <thead>
                <tr>
                  <th>{t("Groups.Name", "Название")}</th>
                  <th>{t("Groups.SortIndex", "Индекс сортировки")}</th>
                  <th>{t("Groups.ParentGroup", "Родительская группа")}</th>

                  {skFields.map((field) => {
                    const discount = getDiscountBySkField(field);
                    const isBonus = discount?.isBon === true;

                    return (
                      <th
                        key={field}
                        className={`sk-head ${
                          isBonus ? "discount-bonus-head" : ""
                        }`}
                        title={discount?.Name ?? field}
                      >
                        <div className="discount-head-cell">
                          <div className="discount-head-name">
                            {discount?.Name ?? field}
                          </div>

                          <div className="discount-head-value">
                            {discount?.Discount ?? ""}
                          </div>
                        </div>
                      </th>
                    );
                  })}
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
                      className="table-input group-name-input"
                      type="text"
                      value={row.Name ?? ""}
                      title={row.Name ?? ""}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateField(row.ID, "Name", e.target.value)
                      }
                    />
                  </td>

                  <td>
                    <input
                      className="table-input text-right index-input"
                      type="number"
                      value={row.Ind ?? ""}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateField(
                          row.ID,
                          "Ind",
                          e.target.value === "" ? null : Number(e.target.value)
                        )
                      }
                    />
                  </td>

                  <td>
                    <select
                      className="table-select group-parent-select"
                      value={String(row.IdGroup ?? 0)}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateField(row.ID, "IdGroup", Number(e.target.value))
                      }
                    >
                      <option value="0"></option>

                      {rows
                        .filter((item) => item.ID !== row.ID)
                        .map((item) => (
                          <option key={item.ID} value={String(item.ID)}>
                            {item.Name}
                          </option>
                        ))}
                    </select>
                  </td>

                  {skFields.map((field) => (
                    <td key={`${row.ID}-${field}`} className="sk-cell">
                      <input
                        className="groups-sk-input"
                        type="number"
                        step="0.01"
                        value={row[field] ?? ""}
                        disabled={readOnly}
                        onChange={(e) =>
                          updateField(
                            row.ID,
                            field,
                            e.target.value === ""
                              ? null
                              : Number(e.target.value)
                          )
                        }
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