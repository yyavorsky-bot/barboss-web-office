import { useEffect, useState } from "react";

const UNSAVED_CHANGES_MESSAGE =
  "Внимание! Вы не сохранили измененные данные!\nУверены, что хотите уйти?";

export default function SpisokTovarovPage({
  data,
  categories,
  filterCat,
  filterSkr,
  onChangeCat,
  onChangeSkr,
  onApply,
  onAddTovar,
  onSaveTovarov,
  readOnly,
  onDirtyChange
}) {
  const categoryList = Array.isArray(categories) ? categories : [];

  const [rows, setRows] = useState([]);
  const [changedRows, setChangedRows] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [addLoading, setAddLoading] = useState(false);

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
    setSaveError("");
  }, [data]);

  function confirmDiscardChanges() {
    if (!isDirty) return true;

    return window.confirm(UNSAVED_CHANGES_MESSAGE);
  }

  async function applyFilters(nextCategory, nextSkr) {
    const normalizedCategory = String(nextCategory ?? "0");
    const normalizedSkr = nextSkr ? 1 : 0;

    const currentCategory = String(filterCat ?? "0");
    const currentSkr = filterSkr ? 1 : 0;

    if (
      normalizedCategory === currentCategory &&
      normalizedSkr === currentSkr
    ) {
      return;
    }

    if (!confirmDiscardChanges()) {
      return;
    }

    if (isDirty) {
      setChangedRows({});
      onDirtyChange?.(false);
    }

    onChangeCat?.(normalizedCategory);
    onChangeSkr?.(normalizedSkr);

    await onApply?.({
      cat: normalizedCategory,
      skr: normalizedSkr
    });
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

  async function saveChanges() {
    if (readOnly) return;

    const changed = rows.filter((row) => changedRows[row.ID]);

    if (changed.length === 0) {
      return;
    }

    const xml = buildTovarovXml(changed);

    setSaveLoading(true);
    setSaveError("");

    try {
      await onSaveTovarov(xml);
      setChangedRows({});
    } catch (err) {
      setSaveError(err.message || "Ошибка сохранения");
    } finally {
      setSaveLoading(false);
    }
  }

  async function addNewTovar() {
    if (readOnly) return;

    setAddLoading(true);
    setSaveError("");

    try {
      const newItem = await onAddTovar();

      setRows((prevRows) => [newItem, ...prevRows]);

      setChangedRows((prev) => ({
        ...prev,
        [newItem.ID]: true
      }));

      setSelectedId(newItem.ID);
    } catch (err) {
      setSaveError(err.message || "Ошибка добавления товара");
    } finally {
      setAddLoading(false);
    }
  }
  return (
    <div className="spisok-tovarov-page">
      <div className="module-toolbar spisok-tovarov-toolbar">
        <div className="toolbar-left">
          <label className="toolbar-check">
            <input
              type="checkbox"
              checked={Boolean(filterSkr)}
              onChange={(e) => {
                applyFilters(filterCat || "0", e.target.checked ? 1 : 0);
              }}
            />
            Скрытые
          </label>

          <label className="toolbar-field">
            <span>Категория</span>

            <select
              className="toolbar-select"
              value={String(filterCat ?? "0")}
              onChange={(e) => {
                applyFilters(e.target.value || "0", filterSkr ? 1 : 0);
              }}
            >
              <option value="0">Все</option>

              {categoryList.map((cat) => (
                <option key={cat.ID} value={String(cat.ID)}>
                  {cat.Name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="toolbar-right">
          {!readOnly && (
            <button
              type="button"
              className="toolbar-save-button spisok-tovarov-add-button"
              disabled={addLoading || saveLoading}
              onClick={addNewTovar}
            >
              {addLoading ? "Добавление..." : "Добавить товар"}
            </button>
          )}

          {!readOnly && (
            <>
              <button
                type="button"
                className="toolbar-save-button spisok-tovarov-save-button"
                disabled={changedCount === 0 || saveLoading}
                onClick={saveChanges}
              >
                {saveLoading ? "Сохранение..." : "Сохранить изменения"}
              </button>

              {changedCount > 0 && (
                <span className="changed-info">
                  Изменено: {changedCount}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {saveError && (
        <div className="login-error">
          {saveError}
        </div>
      )}

      {rows.length === 0 && (
        <div className="spisok-tovarov-empty">
          Загрузка...
        </div>
      )}

      {rows.length > 0 && (
        <div className="table-wrap spisok-tovarov-table-wrap">
          <table className="data-table spisok-tovarov-table">
            <colgroup>
              <col className="spisok-tovarov-col-name" />
              <col className="spisok-tovarov-col-price" />
              <col className="spisok-tovarov-col-check" />
              <col className="spisok-tovarov-col-check" />
              <col className="spisok-tovarov-col-kcal" />
              <col className="spisok-tovarov-col-category" />
              <col className="spisok-tovarov-col-check" />
              <col className="spisok-tovarov-col-number" />
              <col className="spisok-tovarov-col-number" />
              <col className="spisok-tovarov-col-weight" />
              <col className="spisok-tovarov-col-barcode" />
              <col className="spisok-tovarov-col-check" />
              <col className="spisok-tovarov-col-capacity" />
            </colgroup>

            <thead>
              <tr>
                <th>Наименование</th>
                <th>Цена</th>
                <th>Зач.</th>
                <th>Скр.</th>
                <th>Ккал</th>
                <th>Категория</th>
                <th>Отбор</th>
                <th>Норма</th>
                <th>Тара</th>
                <th>Вес/Литр</th>
                <th>ШК</th>
                <th>Марка</th>
                <th>Ёмкость</th>
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
                      className="table-input spisok-tovarov-name-input"
                      type="text"
                      title={row.Name ?? ""}
                      value={row.Name ?? ""}
                      disabled={readOnly}
                      onChange={(e) => updateField(row.ID, "Name", e.target.value)}
                    />
                  </td>

                  <td className="num">
                    <input
                      className="table-input table-input-num"
                      type="number"
                      value={row.Price ?? ""}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateField(row.ID, "Price", e.target.value === "" ? 0 : Number(e.target.value))
                      }
                    />
                  </td>

                  <td className="center">
                    <input
                      type="checkbox"
                      checked={Boolean(row.Zach)}
                      disabled={readOnly}
                      onChange={(e) => updateField(row.ID, "Zach", e.target.checked)}
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

                  <td className="num">
                    <input
                      className="table-input table-input-num"
                      type="number"
                      value={row.KKal ?? ""}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateField(row.ID, "KKal", e.target.value === "" ? 0 : Number(e.target.value))
                      }
                    />
                  </td>

                  <td>
                    <select
                      className="table-select"
                      value={String(row.Grup ?? 0)}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateField(row.ID, "Grup", Number(e.target.value))
                      }
                    >
                      <option value="0"></option>

                      {categoryList.map((cat) => (
                        <option key={cat.ID} value={String(cat.ID)}>
                          {cat.Name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="center">
                    <input
                      type="checkbox"
                      checked={Boolean(row.Otbor)}
                      disabled={readOnly}
                      onChange={(e) => updateField(row.ID, "Otbor", e.target.checked)}
                    />
                  </td>

                  <td className="num">
                    <input
                      className="table-input table-input-num"
                      type="number"
                      value={row.NormaZ ?? ""}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateField(row.ID, "NormaZ", e.target.value === "" ? 0 : Number(e.target.value))
                      }
                    />
                  </td>

                  <td className="num">
                    <input
                      className="table-input table-input-num"
                      type="number"
                      value={row.Tara ?? ""}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateField(row.ID, "Tara", e.target.value === "" ? 0 : Number(e.target.value))
                      }
                    />
                  </td>

                  <td className="num">
                    <input
                      className="table-input table-input-num"
                      type="number"
                      value={row.VesLitr ?? ""}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateField(row.ID, "VesLitr", e.target.value === "" ? 0 : Number(e.target.value))
                      }
                    />
                  </td>

                  <td className="num">
                    <input
                      className="table-input table-input-num"
                      type="number"
                      value={row.Shk ?? ""}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateField(row.ID, "Shk", e.target.value === "" ? 0 : Number(e.target.value))
                      }
                    />
                  </td>

                  <td className="center">
                    <input
                      type="checkbox"
                      checked={Boolean(row.Marka)}
                      disabled={readOnly}
                      onChange={(e) => updateField(row.ID, "Marka", e.target.checked)}
                    />
                  </td>

                  <td className="num">
                    <input
                      className="table-input table-input-num"
                      type="number"
                      value={row.Capacity ?? ""}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateField(row.ID, "Capacity", e.target.value === "" ? 0 : Number(e.target.value))
                      }
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

function buildTovarovXml(rows) {
  const items = rows
    .map((row) => {
      return `<Tovar
        ID="${escapeXml(row.ID)}"
        Name="${escapeXml(row.Name)}"
        Price="${escapeXml(row.Price)}"
        Zach="${boolToInt(row.Zach)}"
        Skr="${boolToInt(row.Skr)}"
        KKal="${escapeXml(row.KKal)}"
        Grup="${escapeXml(row.Grup)}"
        Otbor="${boolToInt(row.Otbor)}"
        NormaZ="${escapeXml(row.NormaZ)}"
        Tara="${escapeXml(row.Tara)}"
        VesLitr="${escapeXml(row.VesLitr)}"
        Shk="${escapeXml(row.Shk)}"
        Marka="${boolToInt(row.Marka)}"
        Capacity="${escapeXml(row.Capacity)}"
      />`;
    })
    .join("");

  return `<Tovars>${items}</Tovars>`;
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function boolToInt(value) {
  return value ? 1 : 0;
}