import { useEffect, useState } from "react";

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
  readOnly
}) {
  const categoryList = Array.isArray(categories) ? categories : [];

  const [rows, setRows] = useState([]);
  const [changedRows, setChangedRows] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  useEffect(() => {
    setRows(Array.isArray(data) ? data : []);
    setChangedRows({});
    setSelectedId(null);
    setSaveError("");
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
    <div>
      <div className="module-toolbar">
        <div className="toolbar-left">
          <label className="toolbar-check">
            <input
              type="checkbox"
              checked={Boolean(filterSkr)}
              onChange={(e) => onChangeSkr(e.target.checked ? 1 : 0)}
            />
            Скрытые
          </label>

          <label className="toolbar-field">
            <span>Категория</span>

            <select
              className="toolbar-select"
              value={String(filterCat ?? "0")}
              onChange={(e) => onChangeCat(e.target.value)}
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
 <button
  type="button"
  className="toolbar-save-button"
  onClick={() => {
    onApply({
      cat: filterCat || "0",
      skr: filterSkr ? 1 : 0
    });
  }}
>
  Применить
</button>
{!readOnly && (
  <button
    type="button"
    className="toolbar-save-button"
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
                className="toolbar-save-button"
                disabled={Object.keys(changedRows).length === 0 || saveLoading}
                onClick={saveChanges}
              >
                {saveLoading ? "Сохранение..." : "Сохранить изменения"}
              </button>

              {Object.keys(changedRows).length > 0 && (
                <span className="changed-info">
                  Изменено: {Object.keys(changedRows).length}
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
        <p>Загрузка...</p>
      )}

      {rows.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
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
                      className="table-input"
                      type="text"
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
    onChange={(e) => updateField(row.ID, "Grup", Number(e.target.value))}
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