import { useEffect, useMemo, useState } from "react";

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

function formatQty(value) {
  return Number(value || 0).toFixed(3);
}

function normalizeDate(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function getUniqueDatesDesc(items) {
  const dates = Array.from(
    new Set(
      items
        .map((row) => normalizeDate(row.Date))
        .filter(Boolean)
    )
  );

  return dates.sort((a, b) => b.localeCompare(a));
}

function formatDisplayDate(value) {
  if (!value) return "";

  const [year, month, day] = String(value).slice(0, 10).split("-");

  if (!year || !month || !day) return value;

  return `${day}.${month}.${year.slice(2)}`;
}

function makeTempId() {
  return -Date.now() - Math.floor(Math.random() * 1000);
}

const UNSAVED_CHANGES_MESSAGE =
  "Внимание! Вы не сохранили измененные данные!\nУверены, что хотите уйти?";

function normalizeCalcItem(row) {
  return {
    ID: Number(row.ID || 0),
    CodeTov: Number(row.CodeTov || 0),
    CodeDish: Number(row.CodeDish || 0),
    Kolvo: Number(row.Kolvo || 0),
    Netto: Number(row.Netto || 0),
    Price: Number(row.Price || 0),
    SumSeb: Number(row.SumSeb || 0),
    Kind: row.Kind || ""
  };
}

function normalizeCalcState(calcDate, rem, rows, deletedIds = []) {
  return {
    Date: calcDate || "",
    Rem: rem || "",
    items: rows.map(normalizeCalcItem),
    deletedIds: deletedIds.map(Number)
  };
}

function SearchableSelect({
  value,
  options,
  placeholder,
  onChange
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState("");

  const selectedItem = useMemo(() => {
    const numericValue = Number(value || 0);
    return options.find((item) => Number(item.ID) === numericValue) || null;
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    const result = query
      ? options.filter((item) =>
          String(item.Name || "").toLowerCase().includes(query)
        )
      : options;

    return result.slice(0, 80);
  }, [options, searchText]);

  const inputValue = isOpen
    ? searchText
    : selectedItem?.Name || "";

  function closeList() {
    setIsOpen(false);
    setSearchText("");
  }

  function chooseItem(item) {
    onChange?.(Number(item.ID || 0));
    closeList();
  }

  function clearValue() {
    onChange?.(0);
    closeList();
  }

  return (
    <div className="searchable-select dish-calc-search">
      <input
        type="text"
        value={inputValue}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => {
          setIsOpen(true);
          setSearchText("");
        }}
        onChange={(e) => {
          setSearchText(e.target.value);
          setIsOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            closeList();
          }

          if (e.key === "Enter" && filteredOptions.length === 1) {
            e.preventDefault();
            chooseItem(filteredOptions[0]);
          }
        }}
        onBlur={() => {
          window.setTimeout(closeList, 150);
        }}
      />

      {isOpen && (
        <div className="searchable-select-list">
          {Number(value || 0) > 0 && (
            <button
              type="button"
              className="searchable-select-option muted"
              onMouseDown={(e) => {
                e.preventDefault();
                clearValue();
              }}
            >
              Очистить выбор
            </button>
          )}

          {filteredOptions.length === 0 && (
            <div className="searchable-select-empty">
              Ничего не найдено
            </div>
          )}

          {filteredOptions.map((item) => (
            <button
              key={item.ID}
              type="button"
              className="searchable-select-option"
              onMouseDown={(e) => {
                e.preventDefault();
                chooseItem(item);
              }}
            >
              {item.Name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DishCalcPage({
  dishId,
  currentSklad,
  fetchWithAuth,
  onBack,
  onDirtyChange
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [rawList, setRawList] = useState([]);
  const [dishList, setDishList] = useState([]);

  const [allRows, setAllRows] = useState([]);
  const [calcDates, setCalcDates] = useState([]);
  const [rows, setRows] = useState([]);
  const [rem, setRem] = useState("");
  const [sebestDish, setSebestDish] = useState(0);
  const [dishName, setDishName] = useState("");
  const [sourceDate, setSourceDate] = useState("");
  const [calcDate, setCalcDate] = useState("");

  const [deletedIds, setDeletedIds] = useState([]);
  const [originalState, setOriginalState] = useState(null);

  const rawById = useMemo(() => {
    return new Map(rawList.map((item) => [Number(item.ID), item]));
  }, [rawList]);

  const dishById = useMemo(() => {
    return new Map(dishList.map((item) => [Number(item.ID), item]));
  }, [dishList]);

  const rawRows = rows.filter((row) => row.Kind === "raw");
  const dishRows = rows.filter((row) => row.Kind === "dish");

  const totalSeb = rows.reduce(
    (sum, row) => sum + Number(row.SumSeb || 0),
    0
  );

  const currentState = normalizeCalcState(calcDate, rem, rows, deletedIds);

  const isDirty = Boolean(
    originalState &&
      JSON.stringify(currentState) !== JSON.stringify(originalState)
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
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dishId, currentSklad]);

  async function loadAll() {
    if (!dishId) return;

    setLoading(true);
    setError("");

    try {
      const [calcResponse, rawResponse, dishResponse] = await Promise.all([
        fetchWithAuth(
          `https://webback.bar-boss.com/wf_DishCalc.php?ID=${encodeURIComponent(dishId)}`
        ),
        fetchWithAuth("https://webback.bar-boss.com/wf_SpisokTovarovCalc.php"),
        fetchWithAuth(
          `https://webback.bar-boss.com/wf_DishPF.php?Sklad=${encodeURIComponent(currentSklad || 1)}`
        )
      ]);

      const calcDataRaw = await calcResponse.json();
      const rawData = await rawResponse.json();
      const dishData = await dishResponse.json();

      console.log("wf_DishCalc dishId:", dishId);
      console.log("wf_DishCalc raw response:", calcDataRaw);

      const calcData = Array.isArray(calcDataRaw)
        ? calcDataRaw[0] || {}
        : calcDataRaw || {};

      const items = Array.isArray(calcData.items)
        ? calcData.items
        : Array.isArray(calcData.Items)
          ? calcData.Items
          : [];

      console.log("wf_DishCalc normalized:", calcData);
      console.log("wf_DishCalc items:", items);

      const loadedAllRows = items.map((row) => ({
        ...row,
        ID: Number(row.ID || 0),
        CodeTov: Number(row.CodeTov || 0),
        CodeDish: Number(row.CodeDish || 0),
        Kolvo: Number(row.Kolvo || 0),
        Netto: Number(row.Netto || 0),
        Price: Number(row.Price || 0),
        SumSeb: Number(row.SumSeb || 0),
        Date: normalizeDate(row.Date),
        Kind: Number(row.CodeDish || 0) > 0 ? "dish" : "raw"
      }));

      const dates = getUniqueDatesDesc(loadedAllRows);
      const loadedDate = dates[0] || "";
      const visibleRows = loadedAllRows.filter(
        (row) => normalizeDate(row.Date) === loadedDate
      );

      setRawList(Array.isArray(rawData) ? rawData : []);
      setDishList(Array.isArray(dishData) ? dishData : []);

      setAllRows(loadedAllRows);
      setCalcDates(dates);
      setRows(visibleRows);
      setDishName(calcData.Name ?? "");
      setRem(calcData.Rem ?? "");
      setSebestDish(Number(calcData.SebestDish || 0));

      setSourceDate(loadedDate);
      setCalcDate(loadedDate);
      setDeletedIds([]);

      setOriginalState(
        normalizeCalcState(
          loadedDate,
          calcData.Rem ?? "",
          visibleRows,
          []
        )
      );
    } catch (err) {
      setError(err.message || "Ошибка загрузки калькуляционной карты");
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
      JSON.stringify(normalizeCalcItem(row)) !==
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

  function handleSourceDateChange(value) {
    const selectedDate = normalizeDate(value);

    if (selectedDate === sourceDate) {
      return;
    }

    if (isDirty && !window.confirm(UNSAVED_CHANGES_MESSAGE)) {
      return;
    }

    onDirtyChange?.(false);

    const visibleRows = allRows.filter(
      (row) => normalizeDate(row.Date) === selectedDate
    );
    const restoredRem = originalState?.Rem ?? rem;

    setSourceDate(selectedDate);
    setCalcDate(selectedDate);
    setRows(visibleRows);
    setRem(restoredRem);
    setDeletedIds([]);

    setOriginalState(
      normalizeCalcState(
        selectedDate,
        restoredRem,
        visibleRows,
        []
      )
    );
  }

  async function loadRawPrice(codeTov) {
    if (!codeTov) return 0;

    const response = await fetchWithAuth(
      `https://webback.bar-boss.com/wf_SebTov.php?ID=${encodeURIComponent(codeTov)}`
    );

    const data = await response.json();
    const row = Array.isArray(data) ? data[0] : data;

    return Number(row?.Price || 0);
  }

  async function loadDishPfSeb(codeDish, netto) {
    if (!codeDish) {
      return {
        Price: 0,
        SumSeb: 0
      };
    }

    const response = await fetchWithAuth(
      `https://webback.bar-boss.com/wf_DishPFseb.php?ID=${encodeURIComponent(codeDish)}&Netto=${encodeURIComponent(netto || 0)}`
    );

    const data = await response.json();
    const row = Array.isArray(data) ? data[0] : data;

    return {
      Price: Number(row?.Price || 0),
      SumSeb: Number(row?.SumSeb || 0)
    };
  }

  function roundMoney(value) {
    return Math.round(Number(value || 0) * 100) / 100;
  }

  function updateRow(rowId, patch) {
    setRows((prevRows) =>
      prevRows.map((row) =>
        row.ID === rowId ? { ...row, ...patch } : row
      )
    );
  }

  async function handleRawSelect(rowId, codeTov) {
    const value = Number(codeTov || 0);
    const price = await loadRawPrice(value);

    setRows((prevRows) =>
      prevRows.map((row) => {
        if (row.ID !== rowId) return row;

        const kolvo = Number(row.Kolvo || 0);

        return {
          ...row,
          CodeTov: value,
          CodeDish: 0,
          Price: price,
          SumSeb: roundMoney(price * kolvo)
        };
      })
    );
  }

  function handleRawKolvoChange(rowId, value) {
    const kolvo = Number(value || 0);

    setRows((prevRows) =>
      prevRows.map((row) => {
        if (row.ID !== rowId) return row;

        const price = Number(row.Price || 0);

        return {
          ...row,
          Kolvo: kolvo,
          SumSeb: roundMoney(price * kolvo)
        };
      })
    );
  }

  async function handleDishSelect(rowId, codeDish) {
    const value = Number(codeDish || 0);

    const currentRow = rows.find((row) => row.ID === rowId);
    const netto = Number(currentRow?.Netto || currentRow?.Kolvo || 0);

    const sebData = await loadDishPfSeb(value, netto);

    setRows((prevRows) =>
      prevRows.map((row) =>
        row.ID === rowId
          ? {
              ...row,
              CodeTov: 0,
              CodeDish: value,
              Price: sebData.Price,
              SumSeb: sebData.SumSeb
            }
          : row
      )
    );
  }

  async function handleDishNettoChange(rowId, value) {
    const netto = Number(value || 0);
    const currentRow = rows.find((row) => row.ID === rowId);

    if (!currentRow) return;

    const codeDish = Number(currentRow.CodeDish || 0);
    const sebData = await loadDishPfSeb(codeDish, netto);

    setRows((prevRows) =>
      prevRows.map((row) =>
        row.ID === rowId
          ? {
              ...row,
              Netto: netto,
              Kolvo: netto,
              Price: sebData.Price,
              SumSeb: sebData.SumSeb
            }
          : row
      )
    );
  }

  function addRawRow() {
    setRows((prevRows) => [
      ...prevRows,
      {
        ID: makeTempId(),
        Kind: "raw",
        CodeTov: 0,
        CodeDish: 0,
        Kolvo: 0,
        Netto: 0,
        Price: 0,
        SumSeb: 0
      }
    ]);
  }

  function addDishRow() {
    setRows((prevRows) => [
      ...prevRows,
      {
        ID: makeTempId(),
        Kind: "dish",
        CodeTov: 0,
        CodeDish: 0,
        Kolvo: 0,
        Netto: 0,
        Price: 0,
        SumSeb: 0
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

  function buildSavePayload() {
    return {
      IDinDish: dishId,
      SourceDate: sourceDate,
      Date: calcDate,
      Rem: rem,
      items: rows.map((row) => ({
        ID: Number(row.ID || 0),
        CodeTov: Number(row.CodeTov || 0),
        CodeDish: Number(row.CodeDish || 0),
        Kolvo: Number(row.Kolvo || 0),
        Netto: Number(row.Netto || 0)
      })),
      deletedIds
    };
  }
function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function xmlNum(value) {
  return String(Number(value || 0)).replace(",", ".");
}

function buildSaveXml() {
  const itemsXml = rows
    .filter((row) => Number(row.CodeTov || 0) > 0 || Number(row.CodeDish || 0) > 0)
    .map((row) => {
      return `    <Item ID="${Number(row.ID || 0)}" CodeTov="${Number(row.CodeTov || 0)}" CodeDish="${Number(row.CodeDish || 0)}" Kolvo="${xmlNum(row.Kolvo)}" Netto="${xmlNum(row.Netto)}" />`;
    })
    .join("\n");

  const deletedXml = deletedIds
    .filter((id) => Number(id) > 0)
    .map((id) => `    <Item ID="${Number(id)}" />`)
    .join("\n");

  return `<Calc>
  <Head IDinDish="${Number(dishId || 0)}" SourceDate="${escapeXml(sourceDate)}" Date="${escapeXml(calcDate)}" />

  <Items>
${itemsXml}
  </Items>

  <Deleted>
${deletedXml}
  </Deleted>

  <Rem>${escapeXml(rem)}</Rem>
</Calc>`;
}

async function handleSave() {
  const xml = buildSaveXml();

  try {
    const response = await fetchWithAuth(
      "https://webback.bar-boss.com/wf_DishCalcSave.php",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/xml; charset=utf-8"
        },
        body: xml
      }
    );

    const data = await response.json();

    if (data.status !== "ok") {
      alert(data.error || "Ошибка сохранения калькуляционной карты");
      return;
    }

    await loadAll();
    onDirtyChange?.(false);
  } catch (err) {
    alert(err.message || "Ошибка сохранения калькуляционной карты");
  }
}
  return (
    <div className="dish-calc-page dish-calc-editor-page">
      <div className="form-header-panel dish-calc-form-header dish-calc-editor-header">
        <div className="dish-calc-editor-title-block">
          <button
            type="button"
            className="back-to-list-button dish-calc-back-button"
            onClick={handleBackClick}
          >
            ← К списку блюд
          </button>

          <div className="calc-dish-title dish-calc-title dish-calc-editor-title">
            <span>Калькуляционная карта:</span>
            <strong>{dishName || `ID ${dishId}`}</strong>
          </div>
        </div>

        <div className="calc-header dish-calc-header dish-calc-editor-controls">
        <div className="calc-field">
          <span>Дата загрузки</span>
          <select
            value={sourceDate}
            onChange={(e) => handleSourceDateChange(e.target.value)}
          >
            {calcDates.length === 0 && (
              <option value="">Нет калькуляций</option>
            )}

            {calcDates.map((date) => (
              <option key={date} value={date}>
                {formatDisplayDate(date)}
              </option>
            ))}
          </select>
        </div>

        <div className="calc-field">
          <span>Дата сохранения</span>
          <input
            type="date"
            value={calcDate}
            onChange={(e) => setCalcDate(e.target.value)}
          />
        </div>

        <div className="calc-info">
          <span>Себестоимость блюда:</span>
          <strong>{formatMoney(sebestDish)}</strong>
        </div>

        <button
          type="button"
          className="primary-button dish-calc-save-button"
          disabled={!isDirty}
          onClick={handleSave}
        >
          Сохранить
        </button>
        </div>
      </div>

      <div className="calc-layout dish-calc-editor-layout">
        <section className="calc-panel dish-calc-editor-panel">
          <div className="calc-panel-title dish-calc-panel-title">
            <span>Сырьё</span>
            <button
              type="button"
              className="dish-calc-add-row-button"
              onClick={addRawRow}
            >
              + строка
            </button>
          </div>

          <div className="table-wrap calc-table-wrap dish-calc-table-wrap">
            <table className="data-table calc-table dish-calc-table dish-calc-raw-table">
              <colgroup>
                <col className="dish-calc-col-item" />
                <col className="dish-calc-col-qty" />
                <col className="dish-calc-col-netto" />
                <col className="dish-calc-col-price" />
                <col className="dish-calc-col-amount" />
                <col className="dish-calc-col-delete" />
              </colgroup>

              <thead>
                <tr>
                  <th>Сырьё</th>
                  <th>Кол-во</th>
                  <th>Нетто</th>
                  <th>Цена</th>
                  <th>Сумма</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {rawRows.length === 0 && (
                  <tr>
                    <td className="dish-calc-empty-row" colSpan="6">Сырьё не добавлено.</td>
                  </tr>
                )}

                {rawRows.map((row) => (
                  <tr
                    key={row.ID}
                    className={isRowDirty(row) ? "changed-row" : ""}
                  >
                    <td>
                      <SearchableSelect
                        value={row.CodeTov}
                        options={rawList}
                        placeholder="Найти сырьё..."
                        onChange={(value) => handleRawSelect(row.ID, value)}
                      />
                    </td>

                    <td>
                      <input
                        type="number"
                        step="0.001"
                        value={row.Kolvo}
                        onChange={(e) =>
                          handleRawKolvoChange(row.ID, e.target.value)
                        }
                      />
                    </td>

                    <td>
                      <input
                        type="number"
                        step="0.001"
                        value={row.Netto}
                        onChange={(e) =>
                          updateRow(row.ID, {
                            Netto: Number(e.target.value || 0)
                          })
                        }
                      />
                    </td>

                    <td className="text-right">
                      {formatMoney(row.Price)}
                    </td>

                    <td className="text-right">
                      {formatMoney(row.SumSeb)}
                    </td>

                    <td>
                      <button
                        type="button"
                        className="small-danger-button dish-calc-delete-button"
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
        </section>

        <section className="calc-panel dish-calc-editor-panel">
          <div className="calc-panel-title dish-calc-panel-title">
            <span>Блюда / полуфабрикаты</span>
            <button
              type="button"
              className="dish-calc-add-row-button"
              onClick={addDishRow}
            >
              + строка
            </button>
          </div>

          <div className="table-wrap calc-table-wrap dish-calc-table-wrap">
            <table className="data-table calc-table dish-calc-table dish-calc-pf-table">
              <colgroup>
                <col className="dish-calc-col-item" />
                <col className="dish-calc-col-qty" />
                <col className="dish-calc-col-netto" />
                <col className="dish-calc-col-price" />
                <col className="dish-calc-col-amount" />
                <col className="dish-calc-col-delete" />
              </colgroup>

              <thead>
                <tr>
                  <th>Блюдо / ПФ</th>
                  <th>Кол-во</th>
                  <th>Нетто</th>
                  <th>Цена</th>
                  <th>Сумма</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {dishRows.length === 0 && (
                  <tr>
                    <td className="dish-calc-empty-row" colSpan="6">Полуфабрикаты не добавлены.</td>
                  </tr>
                )}

                {dishRows.map((row) => (
                  <tr
                    key={row.ID}
                    className={isRowDirty(row) ? "changed-row" : ""}
                  >
                    <td>
                      <SearchableSelect
                        value={row.CodeDish}
                        options={dishList}
                        placeholder="Найти блюдо / ПФ..."
                        onChange={(value) => handleDishSelect(row.ID, value)}
                      />
                    </td>

                    <td>
                      <input
                        type="number"
                        step="0.001"
                        value={row.Kolvo}
                        onChange={(e) =>
                          updateRow(row.ID, {
                            Kolvo: Number(e.target.value || 0)
                          })
                        }
                      />
                    </td>

                    <td>
                      <input
                        type="number"
                        step="0.001"
                        value={row.Netto}
                        onChange={(e) =>
                          handleDishNettoChange(row.ID, e.target.value)
                        }
                      />
                    </td>

                    <td className="text-right">
                      {formatMoney(row.Price)}
                    </td>

                    <td className="text-right">
                      {formatMoney(row.SumSeb)}
                    </td>

                    <td>
                      <button
                        type="button"
                        className="small-danger-button dish-calc-delete-button"
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
        </section>
      </div>

      <div className="calc-rem-block dish-calc-rem-block dish-calc-editor-rem-block">
        <label>
          <span>Технология приготовления</span>
          <textarea
            value={rem}
            onChange={(e) => setRem(e.target.value)}
            rows={5}
          />
        </label>
      </div>
    </div>
  );
}