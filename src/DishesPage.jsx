import { useEffect, useState } from "react";

const dishFields = [
  "CodeBl",
  "Shk",
  "Name1",
  "Price",
  "Ves",
  "Price2",
  "EdVes",
  "Grupp",
  "Sklad",
  "Nep",
  "Skr",
  "Akc",
  "Ceh",
  "Typ",
  "CodePr",
  "PLU",
  "Peresch",
  "Kit",
  "Konsum",
  "Deliv",
  "UKT",
  "Modif",
  "Tall",
  "Wlist",
  "Minuts"
];

export default function DishesPage({
  data,
  onOpenCalc,
  groups,
  filterGroups,
  cehs,
  fops,
  types,
  readOnly,
  filterSkr,
  filterModif,
  filterGroup,
  onChangeSkr,
  onChangeModif,
  onChangeGroup,
  onAddDish,
  onSaveDishes
}) {
  const [rows, setRows] = useState([]);
  const [changedRows, setChangedRows] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [addLoading, setAddLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState("");

  const toolbarGroups = Array.isArray(filterGroups) ? filterGroups : [];

  useEffect(() => {
    setRows(Array.isArray(data) ? data : []);
    setChangedRows({});
    setSelectedId(null);
    setError("");
    setAddLoading(false);
    setSaveLoading(false);
  }, [data]);

  function updateField(codeBl, field, value) {
    if (readOnly) return;

    setRows((prevRows) =>
      prevRows.map((row) =>
        row.CodeBl === codeBl
          ? {
              ...row,
              [field]: value
            }
          : row
      )
    );

    setChangedRows((prev) => ({
      ...prev,
      [codeBl]: true
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

function buildDishesXml(sourceRows) {
  const rowsXml = sourceRows
    .map((row) => {
      const fieldsXml = dishFields
        .map((field) => `<${field}>${xmlValue(row[field])}</${field}>`)
        .join("");

      return `<Dish>${fieldsXml}</Dish>`;
    })
    .join("");

  return `<Dishes>${rowsXml}</Dishes>`;
}

  async function addNewDish() {
    if (readOnly || !onAddDish) return;

    setAddLoading(true);
    setError("");

    try {
      const newDish = await onAddDish();

      setRows((prevRows) => [newDish, ...prevRows]);

      setChangedRows((prev) => ({
        ...prev,
        [newDish.CodeBl]: true
      }));

      setSelectedId(newDish.CodeBl);
    } catch (err) {
      setError(err.message || "Ошибка добавления блюда");
    } finally {
      setAddLoading(false);
    }
  }

  async function saveDishes() {
    if (readOnly || !onSaveDishes) return;

    const changedIds = Object.keys(changedRows);

    if (changedIds.length === 0) {
      return;
    }

    setSaveLoading(true);
    setError("");

    try {
      const changedItems = rows.filter((row) =>
        changedRows[row.CodeBl]
      );

      const xml = buildDishesXml(changedItems);

      const result = await onSaveDishes(xml);

    setChangedRows({});
    } catch (err) {
      setError(err.message || "Ошибка сохранения блюд");
    } finally {
      setSaveLoading(false);
    }
  }

  return (
    <div className="dishes-page">
      <DishesToolbar
        groups={toolbarGroups}
        filterSkr={filterSkr}
        filterModif={filterModif}
        filterGroup={filterGroup}
        onChangeSkr={onChangeSkr}
        onChangeModif={onChangeModif}
        onChangeGroup={onChangeGroup}
        readOnly={readOnly}
        changedCount={Object.keys(changedRows).length}
        addLoading={addLoading}
        saveLoading={saveLoading}
        onAddDish={addNewDish}
        onSaveDishes={saveDishes}
      />

      {error && (
        <div className="login-error">
          {error}
        </div>
      )}

      {rows.length === 0 && (
        <p></p>
      )}

      {rows.length > 0 && (
        <div className="table-wrap">
          <table className="data-table dishes-table">
            <thead>
              <tr>
                <th className="dishes-calc-column">Кальк.</th>
                <th>Штрихкод</th>
                <th>Название</th>
                <th>Цена</th>
                <th>Вес</th>
                <th>Ед.</th>
                <th>НеП.</th>
                <th>Скр.</th>
                <th>Группа</th>
                <th>Цех</th>
                <th>Орг.</th>
                <th>Тип</th>
                <th>ФП</th>
                <th>УКТЗ.</th>
                <th>Дост.</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((dish) => (
                <tr
                  key={dish.CodeBl}
                  className={[
                    selectedId === dish.CodeBl ? "selected-row" : "",
                    changedRows[dish.CodeBl] ? "changed-row" : ""
                  ].join(" ")}
                  onClick={() => setSelectedId(dish.CodeBl)}
                >
                  <td className="dishes-calc-column">
                    <button
                      type="button"
                      className="dishes-calc-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenCalc?.(dish.CodeBl);
                      }}
                    >
                      Кальк.
                    </button>
                  </td>

                  <td>
                    <input
                      className="table-input small-input"
                      type="number"
                      value={dish.Shk ?? ""}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateField(dish.CodeBl, "Shk", e.target.value === "" ? "" : Number(e.target.value))
                      }
                    />
                  </td>

                  <td>
                    <input
                      className="table-input dish-name-input"
                      type="text"
                      value={dish.Name1 ?? ""}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateField(dish.CodeBl, "Name1", e.target.value)
                      }
                    />
                  </td>

                  <td>
                    <input
                      className="table-input text-right price-input"
                      type="number"
                      step="0.01"
                      value={dish.Price ?? ""}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateField(dish.CodeBl, "Price", e.target.value)
                      }
                    />
                  </td>

                  <td>
                    <input
                      className="table-input text-right small-input"
                      type="number"
                      step="0.001"
                      value={dish.Ves ?? ""}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateField(dish.CodeBl, "Ves", e.target.value)
                      }
                    />
                  </td>

                  <td>
                    <input
                      className="table-input unit-input"
                      type="text"
                      value={dish.EdVes ?? ""}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateField(dish.CodeBl, "EdVes", e.target.value)
                      }
                    />
                  </td>

                  <td className="center">
                    <input
                      type="checkbox"
                      checked={Boolean(dish.Nep)}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateField(dish.CodeBl, "Nep", e.target.checked)
                      }
                    />
                  </td>

                  <td className="center">
                    <input
                      type="checkbox"
                      checked={Boolean(dish.Skr)}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateField(dish.CodeBl, "Skr", e.target.checked)
                      }
                    />
                  </td>

                  <td>
                    <LookupSelect
                      value={dish.Grupp}
                      items={groups}
                      disabled={readOnly}
                      onChange={(value) =>
                        updateField(dish.CodeBl, "Grupp", Number(value))
                      }
                    />
                  </td>

                  <td>
                    <LookupSelect
                      value={dish.Ceh}
                      items={cehs}
                      disabled={readOnly}
                      onChange={(value) =>
                        updateField(dish.CodeBl, "Ceh", Number(value))
                      }
                    />
                  </td>

                  <td>
                    <LookupSelect
                      value={dish.CodePr}
                      items={fops}
                      disabled={readOnly}
                      onChange={(value) =>
                        updateField(dish.CodeBl, "CodePr", Number(value))
                      }
                    />
                  </td>

                  <td>
                    <LookupSelect
                      value={dish.Typ}
                      items={types}
                      disabled={readOnly}
                      onChange={(value) =>
                        updateField(dish.CodeBl, "Typ", Number(value))
                      }
                    />
                  </td>

                  <td className="center">
                    <input
                      type="checkbox"
                      checked={Boolean(dish.Akc)}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateField(dish.CodeBl, "Akc", e.target.checked)
                      }
                    />
                  </td>

                  <td>
                    <input
                      className="table-input ukt-input"
                      type="text"
                      value={dish.UKT ?? ""}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateField(dish.CodeBl, "UKT", e.target.value)
                      }
                    />
                  </td>

                  <td className="center">
                    <input
                      type="checkbox"
                      checked={Boolean(dish.Deliv)}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateField(dish.CodeBl, "Deliv", e.target.checked)
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

function LookupSelect({ value, items, disabled, onChange }) {
  const safeItems = Array.isArray(items) ? items : [];
  const currentValue = String(value ?? "0");

  return (
    <select
      className="table-select"
      value={currentValue}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="0"></option>

      {safeItems.map((item) => (
        <option key={item.ID} value={String(item.ID)}>
          {item.Name}
        </option>
      ))}
    </select>
  );
}

function DishesToolbar({
  groups,
  filterSkr,
  filterModif,
  filterGroup,
  onChangeSkr,
  onChangeModif,
  onChangeGroup,
  readOnly,
  changedCount,
  addLoading,
  saveLoading,
  onAddDish,
  onSaveDishes
}) {
  return (
    <div className="module-toolbar dishes-toolbar">
      <div className="toolbar-left">
        <label className="toolbar-check">
          <input
            type="checkbox"
            checked={Boolean(filterSkr)}
            onChange={(e) => onChangeSkr(e.target.checked)}
          />
          Скрытые
        </label>

        <label className="toolbar-check">
          <input
            type="checkbox"
            checked={Boolean(filterModif)}
            onChange={(e) => onChangeModif(e.target.checked)}
          />
          Модификаторы
        </label>

        <label className="toolbar-field">
          <span>Группа</span>

          <select
            className="toolbar-select"
            value={String(filterGroup ?? "%")}
            onChange={(e) => onChangeGroup(e.target.value)}
          >
            <option value="%">Все</option>

            {Array.isArray(groups) &&
              groups.map((group) => (
                <option key={group.ID} value={String(group.ID)}>
                  {group.Name}
                </option>
              ))}
          </select>
        </label>

        {changedCount > 0 && (
          <span className="changed-info">
            Изменено: {changedCount}
          </span>
        )}
      </div>

      <div className="toolbar-right">
        {!readOnly && (
          <button
            type="button"
            className="toolbar-save-button dishes-add-button"
            disabled={addLoading}
            onClick={onAddDish}
          >
            {addLoading ? "Добавление..." : "Добавить"}
          </button>
        )}

        {!readOnly && (
          <button
            type="button"
            className="toolbar-save-button dishes-save-button"
            disabled={changedCount === 0 || saveLoading}
            onClick={onSaveDishes}
          >
            {saveLoading ? "Сохранение..." : "Сохранить"}
          </button>
        )}
      </div>
    </div>
  );
}