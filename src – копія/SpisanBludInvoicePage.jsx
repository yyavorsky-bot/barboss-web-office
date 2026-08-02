import { useEffect, useMemo, useState } from "react";

function normalizeDate(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function formatQty(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "";
  }

  return numberValue.toFixed(2);
}

function makeTempId() {
  return -Date.now() - Math.floor(Math.random() * 1000);
}

const UNSAVED_CHANGES_MESSAGE =
  "Внимание! Вы не сохранили измененные данные!\nУверены, что хотите уйти?";

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function normalizeDishList(data) {
  const rows = Array.isArray(data) ? data : [];

  return rows
    .map((item) => ({
      ...item,
      ID: Number(item.ID || 0),
      Name: item.Name || "",
      SkladName: item.SkladName || ""
    }))
    .filter((item) => Number(item.ID || 0) > 0);
}

function normalizeItem(row) {
  return {
    ID: Number(row.ID || 0),
    CodeBluda: Number(row.CodeBluda || 0),
    Kolvo: Number(row.Kolvo || 0)
  };
}

function normalizeState(header, rows) {
  return {
    header: {
      ID: Number(header.ID || 0),
      Nakl: header.Nakl || "",
      DateP: normalizeDate(header.DateP),
      CodSpis: Number(header.CodSpis || 0),
      Rem: header.Rem || ""
    },

    items: rows.map(normalizeItem)
  };
}

function SearchableSelect({
  value,
  options,
  placeholder,
  onChange,
  onEnterNext,
  cellIndex
}) {
  const selected = options.find((item) => Number(item.ID) === Number(value));
  const [text, setText] = useState(selected?.Name || "");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const nextSelected = options.find(
      (item) => Number(item.ID) === Number(value)
    );

    setText(nextSelected?.Name || "");
  }, [value, options]);

  const filtered = useMemo(() => {
    const query = text.trim().toLowerCase();

    if (!query) {
      return options.slice(0, 80);
    }

    return options
      .filter((item) =>
        `${item.Name || ""} ${item.SkladName || ""}`
          .toLowerCase()
          .includes(query)
      )
      .slice(0, 80);
  }, [text, options]);

  function choose(item) {
    onChange(Number(item.ID || 0));
    setText(item.Name || "");
    setOpen(false);

    setTimeout(() => {
      onEnterNext?.(cellIndex);
    }, 0);
  }

  return (
    <div className="searchable-select spisan-blud-invoice-dish-search">
      <input
        data-cell={cellIndex}
        value={text}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            return;
          }

          if (e.key === "Enter") {
            e.preventDefault();

            if (filtered.length === 1) {
              choose(filtered[0]);
              return;
            }

            onEnterNext?.(cellIndex);
          }
        }}
      />

      {open && (
        <div className="searchable-select-list">
          {filtered.length === 0 && (
            <div className="searchable-select-empty">
              Ничего не найдено
            </div>
          )}

          {filtered.map((item) => (
            <button
              key={item.ID}
              type="button"
              className="searchable-select-option"
              onMouseDown={(e) => {
                e.preventDefault();
                choose(item);
              }}
            >
              <span>{item.Name}</span>

              {item.SkladName && (
                <small className="spisan-blud-invoice-search-warehouse">
                  {item.SkladName}
                </small>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SpisanBludInvoicePage({
  initialData,
  fetchWithAuth,
  onBack,
  onDirtyChange
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [header, setHeader] = useState(null);
  const [rows, setRows] = useState([]);

  const [zatrList, setZatrList] = useState([]);
  const [dishList, setDishList] = useState([]);

  const [deletedIds, setDeletedIds] = useState([]);
  const [originalState, setOriginalState] = useState(null);

  const totalQty = rows.reduce(
    (sum, row) => sum + Number(row.Kolvo || 0),
    0
  );

  const currentState = header ? normalizeState(header, rows) : null;

  const isDirty = Boolean(
    deletedIds.length > 0 ||
      (
        originalState &&
        currentState &&
        JSON.stringify(currentState) !== JSON.stringify(originalState)
      )
  );

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
    loadData();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData]);

  async function loadData() {
    if (!initialData) return;

    setLoading(true);
    setError("");

    try {
      const [zatrResponse, dishResponse] = await Promise.all([
        fetchWithAuth("https://webback.bar-boss.com/wf_ZatrSpis.php"),
        fetchWithAuth("https://webback.bar-boss.com/wf_DishesAll.php")
      ]);

      const zatrData = await zatrResponse.json();
      const dishData = await dishResponse.json();

      const normalizedHeader = {
        ID: Number(initialData.ID || 0),
        Nakl: initialData.Nakl || "",
        DateP: normalizeDate(initialData.DateP),
        CodSpis: Number(initialData.CodSpis || 0),
        NazvSpisania: initialData.NazvSpisania || "",
        Rem: initialData.Rem || ""
      };

const loadedRows = Array.isArray(initialData.items)
  ? initialData.items.map((row) => ({
      ID: Number(row.ID || makeTempId()),
      CodeBluda: Number(row.CodeBluda || 0),
      Name: row.Name || "",
      SkladName: row.SkladName || "",
      Kolvo: Number(row.Kolvo || 0)
    }))
  : [];

      setHeader(normalizedHeader);
      setRows(loadedRows);
      setZatrList(Array.isArray(zatrData) ? zatrData : []);
      setDishList(normalizeDishList(dishData));
      setDeletedIds([]);
      setOriginalState(normalizeState(normalizedHeader, loadedRows));
    } catch (err) {
      setError(err.message || "Ошибка загрузки накладной списания блюд");
    } finally {
      setLoading(false);
    }
  }

  function isRowDirty(row) {
    if (!originalState) return false;

    const originalRow = originalState.items.find(
      (item) => Number(item.ID) === Number(row.ID)
    );

    if (!originalRow) return true;

    return (
      JSON.stringify(normalizeItem(row)) !==
      JSON.stringify(originalRow)
    );
  }

  function handleBackClick() {
    if (isDirty && !window.confirm(UNSAVED_CHANGES_MESSAGE)) {
      return;
    }

    onDirtyChange?.(false);
    onBack?.();
  }

  function updateHeaderField(field, value) {
    setHeader((prev) => ({
      ...prev,
      [field]: value
    }));
  }

  function updateRow(rowId, patch) {
    setRows((prevRows) =>
      prevRows.map((row) => {
        if (row.ID !== rowId) return row;
        return {
          ...row,
          ...patch
        };
      })
    );
  }

  function addRow() {
    setRows((prevRows) => [
      ...prevRows,
      {
        ID: makeTempId(),
        CodeBluda: 0,
        Name: "",
        SkladName: "",
        Kolvo: 0
      }
    ]);
  }

  function deleteRow(rowId) {
    const ok = window.confirm("Удалить строку?");
    if (!ok) return;

    setRows((prevRows) => prevRows.filter((row) => row.ID !== rowId));

    if (rowId > 0) {
      setDeletedIds((prev) => [...prev, rowId]);
    }
  }

  function focusNextCell(currentCell) {
    const current = Number(currentCell || 0);
    const next = document.querySelector(`[data-cell="${current + 1}"]`);

    if (next) {
      next.focus();

      if (typeof next.select === "function") {
        next.select();
      }
    }
  }

  function handleCellKeyDown(e) {
    if (e.key !== "Enter") return;

    e.preventDefault();
    focusNextCell(e.currentTarget.dataset.cell);
  }

  function buildSaveXml() {
    const itemsXml = rows
      .filter((row) => Number(row.CodeBluda || 0) > 0)
      .map((row) => {
return `    <Item ID="${Number(row.ID || 0)}" CodeBluda="${Number(
  row.CodeBluda || 0
)}" Kolvo="${Number(row.Kolvo || 0)}" />`;
      })
      .join("\n");

    const deletedXml = deletedIds
      .filter((id) => Number(id) > 0)
      .map((id) => `    <Item ID="${Number(id)}" />`)
      .join("\n");

    return `<SpisanBlud>
<Head ID="${Number(header.ID || 0)}" DateP="${escapeXml(
  header.DateP || ""
)}" CodSpis="${Number(header.CodSpis || 0)}" Rem="${escapeXml(
  header.Rem || ""
)}" />


  <Items>
${itemsXml}
  </Items>

  <Deleted>
${deletedXml}
  </Deleted>
</SpisanBlud>`;
  }

  async function handleSave() {
    if (Number(header?.CodSpis || 0) <= 0) {
      alert("!!! Выберите статью затрат.");
      return;
    }

    const xml = buildSaveXml();

    try {
      const body = new URLSearchParams();

      body.set("Action", "SaveSpisanBlud");
      body.set("xml", xml);

      const response = await fetchWithAuth(
        "https://webback.bar-boss.com/wf_RefSave.php",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
          },
          body
        }
      );

      const text = await response.text();

      let data;

      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Сервер вернул не JSON: " + text.substring(0, 500));
      }

      if (!response.ok || data.status !== "success") {
        throw new Error(data.error || "Ошибка сохранения накладной списания блюд");
      }

      onDirtyChange?.(false);
      onBack?.();
    } catch (err) {
      alert(err.message || "Ошибка сохранения накладной списания блюд");
    }
  }

  if (loading) {
    return <p>Загрузка накладной...</p>;
  }

  if (error) {
    return <p className="error-text">{error}</p>;
  }

  if (!header) {
    return <p>Накладная не выбрана.</p>;
  }

  let cellIndex = 1;

  return (
    <div className="prih-page spisan-blud-invoice-page">
      <div className="form-header-panel prih-form-header spisan-blud-invoice-form-header">
        <div className="page-toolbar">
        <button
          type="button"
          className="back-to-list-button prih-back-button spisan-blud-invoice-back-button"
          onClick={handleBackClick}
        >
          ← К списку списаний блюд
        </button>

        <button
          type="button"
          className="primary-button spisan-blud-invoice-save-button"
          disabled={!isDirty}
          onClick={handleSave}
        >
          Сохранить
        </button>
      </div>

      <div className="prih-title spisan-blud-invoice-title">
        Накладная списания блюд{" "}
        {header.Nakl ? (
          <>
            № <strong>{header.Nakl}</strong>{" "}
          </>
        ) : null}
        от <strong>{header.DateP}</strong>
      </div>

      <div className="prih-header-grid spisan-blud-invoice-header-grid">

        <label className="calc-field">
          <span>Дата</span>

          <input
            type="date"
            value={header.DateP}
            onChange={(e) => updateHeaderField("DateP", e.target.value)}
          />
        </label>

        <label className="calc-field">
          <span>Затраты</span>

          <select
            value={header.CodSpis}
            onChange={(e) =>
              updateHeaderField("CodSpis", Number(e.target.value || 0))
            }
          >
            <option value="0">Выберите затраты...</option>

            {zatrList.map((item) => (
              <option key={item.ID} value={item.ID}>
                {item.Name}
              </option>
            ))}
          </select>
        </label>

         <label className="calc-field calc-field-wide spisan-blud-invoice-rem-field">
          <span>Примечание</span>

          <input
            value={header.Rem || ""}
            onChange={(e) => updateHeaderField("Rem", e.target.value)}
          />
        </label>
      </div>
      </div>

      <div className="calc-panel-title prih-items-title spisan-blud-invoice-items-title">
        <span>Содержимое списания блюд</span>

        <button
          type="button"
          className="prih-add-row-button spisan-blud-invoice-add-row-button"
          onClick={addRow}
        >
          + строка
        </button>
      </div>

      <div className="table-wrap prih-table-wrap spisan-blud-invoice-table-wrap">
        <table className="data-table prih-table spisan-blud-invoice-table">
          <colgroup>
            <col className="spisan-blud-invoice-col-dish" />
            <col className="spisan-blud-invoice-col-warehouse" />
            <col className="spisan-blud-invoice-col-qty" />
            <col className="spisan-blud-invoice-col-delete" />
          </colgroup>

          <thead>
            <tr>
              <th>Блюдо</th>
              <th>Склад</th>
              <th>Кол-во</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="spisan-blud-invoice-empty-row" colSpan={4}>Строки не добавлены.</td>
              </tr>
            )}

            {rows.map((row) => (
              <tr
                key={row.ID}
                className={isRowDirty(row) ? "changed-row" : ""}
              >
                <td>
                  <SearchableSelect
                    value={row.CodeBluda}
                    options={dishList}
                    placeholder="Выберите блюдо..."
                    cellIndex={cellIndex++}
                    onEnterNext={focusNextCell}
                    onChange={(value) => {
                      const selectedDish = dishList.find(
                        (item) => Number(item.ID) === Number(value)
                      );

                      updateRow(row.ID, {
                        CodeBluda: value,
                        Name: selectedDish?.Name || "",
                        SkladName: selectedDish?.SkladName || ""
                      });
                    }}
                  />
                </td>

                <td title={row.SkladName || ""}>{row.SkladName || ""}</td>

                <td>
                  <input
                    data-cell={cellIndex++}
                    type="number"
                    step="0.001"
                    value={row.Kolvo}
                    onKeyDown={handleCellKeyDown}
                    onChange={(e) =>
                      updateRow(row.ID, {
                        Kolvo: Number(e.target.value || 0)
                      })
                    }
                  />
                </td>

                <td>
                  <button
                    type="button"
                    className="small-danger-button spisan-blud-invoice-delete-button"
                    title="Удалить строку"
                    aria-label="Удалить строку"
                    onClick={() => deleteRow(row.ID)}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}