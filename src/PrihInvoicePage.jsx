import { useEffect, useMemo, useState } from "react";

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function makeTempId() {
  return -Date.now() - Math.floor(Math.random() * 1000);
}

function normalizeDate(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function normalizeInvoiceState(header, rows) {
  return {
    header: {
      ID: Number(header.ID || 0),
      Invoice: header.Invoice || "",
      DateP: normalizeDate(header.DateP),
      Rem: header.Rem || "",
      VAT: Boolean(header.VAT),
      ProcVat: Number(header.ProcVat || 0),
      IdSklPer: Number(header.IdSklPer || 0),
      IdSkl: Number(header.IdSkl || 0),
      Oplach: Boolean(header.Oplach),
      Post: Number(header.Post || 0),
      Form: Number(header.Form || 0),
      Bel: Boolean(header.Bel),
      Vozv: Boolean(header.Vozv),
      Moldova: Number(header.Moldova || 0)
    },
    items: rows.map((row) => ({
      ID: Number(row.ID || 0),
      Tov: Number(row.Tov || 0),
      Postup: Number(row.Postup || 0),
      Price: Number(row.Price || 0),
      Summ: Number(row.Summ || 0),
      Zach: Boolean(row.Zach),
      Pf: Boolean(row.Pf),
      CenaAvg: Number(row.CenaAvg || 0),
      VatTov: Number(row.VatTov || 0)
    }))
  };
}

function normalizeRawList(data) {
  const rows = Array.isArray(data) ? data : [];

  return rows
    .map((item) => ({
      ...item,
      ID: Number(item.ID ?? item.Товар ?? item.Tovar ?? item.Tov ?? 0),
      Name: item.Name ?? item.name ?? "",
      Price: Number(item.Price || 0)
    }))
    .filter((item) => Number(item.ID || 0) > 0);
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
    const nextSelected = options.find((item) => Number(item.ID) === Number(value));
    setText(nextSelected?.Name || "");
  }, [value, options]);

  const filtered = useMemo(() => {
    const query = text.trim().toLowerCase();

    if (!query) {
      return options.slice(0, 80);
    }

    return options
      .filter((item) => String(item.Name || "").toLowerCase().includes(query))
      .slice(0, 80);
  }, [text, options]);

function choose(item) {
  onChange(Number(item.ID || 0));
  setText(item.Name || "");
  setOpen(false);

  setTimeout(() => onEnterNext?.(cellIndex), 0);
}

  return (
    <div className="searchable-select">
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
            <div className="searchable-select-empty">Ничего не найдено</div>
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
              {item.Name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PrihInvoicePage({
  invoiceId,
  initialInvoice = null,
  mode = "edit",
  invoiceKind = "prih",
  fetchWithAuth,
  onBack
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [header, setHeader] = useState(null);
  const [rows, setRows] = useState([]);

  const [sklList, setSklList] = useState([]);
  const [postList, setPostList] = useState([]);
  const [formList, setFormList] = useState([]);
  const [rawList, setRawList] = useState([]);

  const [deletedIds, setDeletedIds] = useState([]);
  const [originalState, setOriginalState] = useState(null);

  const isMoldova = Number(header?.Moldova || 0) !== 0;
  const isMoveInvoice =
  invoiceKind === "move" || Number(header?.IdSklPer || 0) !== 0;
  const isNewMode = mode === "new";
  
  const totalSumm = rows.reduce(
    (sum, row) => sum + Number(row.Summ || 0),
    0
  );

  const currentState = header
    ? normalizeInvoiceState(header, rows)
    : null;

  const isDirty =
    originalState &&
    currentState &&
    JSON.stringify(currentState) !== JSON.stringify(originalState);

useEffect(() => {
  if (initialInvoice) {
    loadFromInvoiceData(initialInvoice, mode === "new");
    return;
  }

  loadAll();

  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [invoiceId, initialInvoice, mode]);

  async function loadAll() {
    if (!invoiceId) return;

    setLoading(true);
    setError("");

    try {
      const [invoiceResponse, sklResponse, formResponse] =
        await Promise.all([
          fetchWithAuth(
            `https://webback.bar-boss.com/wf_PrihProsm.php?ID=${encodeURIComponent(invoiceId)}`
          ),
          fetchWithAuth("https://webback.bar-boss.com/wf_Podrazd.php"),
          fetchWithAuth("https://webback.bar-boss.com/wf_Valuts.php")
        ]);

      const invoiceText = await invoiceResponse.text();

      let invoiceData;

      try {
        invoiceData = JSON.parse(invoiceText);
      } catch {
        throw new Error("Накладная вернула не JSON: " + invoiceText.substring(0, 500));
      }

      if (Array.isArray(invoiceData)) {
        invoiceData = invoiceData[0] ?? {};
      }

      const sklData = await sklResponse.json();
      const formData = await formResponse.json();

      const normalizedHeader = {
        ...invoiceData,
        ID: Number(invoiceData.ID || 0),
        Invoice: invoiceData.Invoice || "",
        DateP: normalizeDate(invoiceData.DateP),
        Rem: invoiceData.Rem || "",
        VAT: Boolean(invoiceData.VAT),
        ProcVat: Number(invoiceData.ProcVat || 0),
        IdSklPer: Number(invoiceData.IdSklPer || 0),
        IdSkl: Number(invoiceData.IdSkl || 0),
        Oplach: Boolean(invoiceData.Oplach),
        Post: Number(invoiceData.Post || 0),
        Form: Number(invoiceData.Form || 0),
        Bel: Boolean(invoiceData.Bel),
        Vozv: Boolean(Number(invoiceData.Vozv ?? 0)),
        Moldova: Number(invoiceData.Moldova || 0)
      };

      const loadedRows = Array.isArray(invoiceData.items)
        ? invoiceData.items.map((row) => ({
            ID: Number(row.ID || 0),
            Tov: Number(row.Tov || 0),
            Postup: Number(row.Postup || 0),
            Price: Number(row.Price || 0),
            Summ: Number(row.Summ || 0),
            Zach: Boolean(row.Zach),
            Pf: Boolean(row.Pf),
            CenaAvg: Number(row.CenaAvg || 0),
            VatTov: Number(row.VatTov || 0)
          }))
        : [];

      const isLoadedMoveInvoice = Number(normalizedHeader.IdSklPer || 0) !== 0;
      const rawUrl = isLoadedMoveInvoice
        ? `https://webback.bar-boss.com/wf_SpisokTovNalich.php?Sklad=${encodeURIComponent(normalizedHeader.IdSklPer)}`
        : "https://webback.bar-boss.com/wf_SpisokTovarovCalc.php";

      const rawResponse = await fetchWithAuth(rawUrl);
      const rawData = await rawResponse.json();

      setHeader(normalizedHeader);
      setRows(loadedRows);
      setSklList(Array.isArray(sklData) ? sklData : []);
      setFormList(Array.isArray(formData) ? formData : []);
      setRawList(normalizeRawList(rawData));
      setDeletedIds([]);

      setOriginalState(normalizeInvoiceState(normalizedHeader, loadedRows));

      if (Number(normalizedHeader.Post || 0) > 0) {
        const postResponse = await fetchWithAuth(
          "https://webback.bar-boss.com/wf_Postav.php?org=0"
        );

        const postData = await postResponse.json();

        setPostList(Array.isArray(postData) ? postData : []);
      }
    } catch (err) {
      setError(err.message || "Ошибка загрузки приходной накладной");
    } finally {
      setLoading(false);
    }
  }

  async function loadFromInvoiceData(invoiceData, isNew = false) {
  setLoading(true);
  setError("");

  try {
const isMoveData = Number(invoiceData.IdSklPer || 0) !== 0;

const rawUrl = isMoveData
  ? `https://webback.bar-boss.com/wf_SpisokTovNalich.php?Sklad=${encodeURIComponent(invoiceData.IdSklPer)}`
  : "https://webback.bar-boss.com/wf_SpisokTovarovCalc.php";

const [sklResponse, postResponse, formResponse, rawResponse] = await Promise.all([
  fetchWithAuth("https://webback.bar-boss.com/wf_Podrazd.php"),
  fetchWithAuth("https://webback.bar-boss.com/wf_Postav.php?org=0"),
  fetchWithAuth("https://webback.bar-boss.com/wf_Valuts.php"),
  fetchWithAuth(rawUrl)
]);

    const sklData = await sklResponse.json();
    const postData = await postResponse.json();
    const formData = await formResponse.json();
    const rawData = await rawResponse.json();


    const normalizedHeader = {
      ...invoiceData,
      ID: Number(invoiceData.ID || 0),
      Invoice: invoiceData.Invoice || "",
      DateP: normalizeDate(invoiceData.DateP),
      Rem: invoiceData.Rem || "",
      VAT: Boolean(invoiceData.VAT),
      ProcVat: Number(invoiceData.ProcVat || 0),
      IdSklPer: Number(invoiceData.IdSklPer || 0),
      IdSkl: Number(invoiceData.IdSkl || 0),
      Oplach: Boolean(invoiceData.Oplach),
      Post: Number(invoiceData.Post || 0),
      Form: Number(invoiceData.Form || 0),
      Bel: Boolean(invoiceData.Bel),
      Vozv: Boolean(Number(invoiceData.Vozv ?? 0)),
      Moldova: Number(invoiceData.Moldova || 0)
    };

    const loadedRows = Array.isArray(invoiceData.items)
      ? invoiceData.items.map((row) => ({
          ID: Number(row.ID || 0),
          Tov: Number(row.Tov || 0),
          Postup: Number(row.Postup || 0),
          Price: Number(row.Price || 0),
          Summ: Number(row.Summ || 0),
          Zach: Boolean(row.Zach),
          Pf: Boolean(row.Pf),
          CenaAvg: Number(row.CenaAvg || 0),
          VatTov: Number(row.VatTov || 0)
        }))
      : [];

    setHeader(normalizedHeader);
    setRows(loadedRows);
    setPostList(Array.isArray(postData) ? postData : []);
    setFormList(Array.isArray(formData) ? formData : []);
    setRawList(normalizeRawList(rawData));
    setSklList(Array.isArray(sklData) ? sklData : []);
    setDeletedIds([]);
    setOriginalState(normalizeInvoiceState(normalizedHeader, loadedRows));
    
  } catch (err) {
    setError(err.message || "Ошибка загрузки новой приходной накладной");
  } finally {
    setLoading(false);
  }
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

        const nextRow = {
          ...row,
          ...patch
        };

        if ("Postup" in patch || "Price" in patch) {
          nextRow.Summ = roundMoney(
            Number(nextRow.Postup || 0) * Number(nextRow.Price || 0)
          );
        }

        return nextRow;
      })
    );
  }

  function addRow() {
    setRows((prevRows) => [
      ...prevRows,
      {
        ID: makeTempId(),
        Tov: 0,
        Postup: 0,
        Price: 0,
        Summ: 0,
        Zach: false,
        Pf: false,
        CenaAvg: 0,
        VatTov: 0
      }
    ]);
  }

  function deleteRow(rowId) {
    const ok = window.confirm("Вы уверены?");

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
function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

  function buildSaveXml() {
    const itemsXml = rows
      .filter((row) => Number(row.Tov || 0) > 0)
      .map((row) => {
        return `    <Item ID="${Number(row.ID || 0)}" Tov="${Number(row.Tov || 0)}" Postup="${Number(row.Postup || 0)}" Price="${Number(row.Price || 0)}" Zach="${Number(Boolean(row.Zach))}" Pf="${Number(Boolean(row.Pf))}" VatTov="${Number(row.VatTov || 0)}" />`;
      })
      .join("\n");

    const deletedXml = deletedIds
      .filter((id) => Number(id) > 0)
      .map((id) => `    <Item ID="${Number(id)}" />`)
      .join("\n");

return `<Prih>
  <Head ID="${Number(header.ID || 0)}" Invoice="${escapeXml(header.Invoice || "")}" DateP="${escapeXml(header.DateP || "")}" IdSkl="${Number(header.IdSkl || 0)}" IdSklPer="${Number(header.IdSklPer || 0)}" Post="${Number(header.Post || 0)}" Form="${Number(header.Form || 0)}" Oplach="${Number(Boolean(header.Oplach))}" Bel="${Number(Boolean(header.Bel))}" Vozv="${Number(Boolean(header.Vozv))}" VAT="${Number(Boolean(header.VAT))}" ProcVat="${Number(header.ProcVat || 0)}" />

  <Items>
${itemsXml}
  </Items>

  <Deleted>
${deletedXml}
  </Deleted>

  <Rem>${escapeXml(header.Rem || "")}</Rem>
</Prih>`;
  }

async function handleSave() {
  if (isMoveInvoice && Number(header?.IdSkl || 0) <= 0) {
    alert("!!! Выберите склад, куда перемещаем товар.");
    return;
  }

  if (isMoveInvoice && Number(header?.IdSkl || 0) === Number(header?.IdSklPer || 0)) {
    alert("!!! Склад назначения не должен совпадать со складом-источником.");
    return;
  }

  if (!isMoveInvoice && Number(header?.Post || 0) <= 0) {
    alert("!!! Выберите поставщика перед сохранением накладной.");
    return;
  }

  const xml = buildSaveXml();

  try {
    const body = new URLSearchParams();

    body.set("Action", "SavePrih");
    body.set("xml", xml);

    const response = await fetchWithAuth("https://webback.bar-boss.com/wf_RefSave.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
      },
      body
    });

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Сервер вернул не JSON: " + text.substring(0, 500));
    }

    if (!response.ok || data.status !== "success") {
      throw new Error(data.error || "Ошибка сохранения приходной накладной");
    }

    await loadAll();
  } catch (err) {
    alert(err.message || "Ошибка сохранения приходной накладной");
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
    <div className="prih-page">
      <div className="page-toolbar">
        <button
          type="button"
          className="back-to-list-button"
          onClick={onBack}
        >
          ← К списку накладных
        </button>

        <button
          type="button"
          className="primary-button"
          disabled={!isDirty}
          onClick={handleSave}
        >
          Сохранить
        </button>
      </div>

      <div className="prih-title">
        {isMoveInvoice ? "Накладная перемещения" : "Накладная прихода"} №{" "}
        <strong>{header.Invoice}</strong> от{" "}
        <strong>{header.DateP}</strong>
      </div>

      <div className="prih-header-grid">
        <label className="calc-field">
          <span>Номер</span>
          <input
            value={header.Invoice}
            onChange={(e) => updateHeaderField("Invoice", e.target.value)}
          />
        </label>

        <label className="calc-field">
          <span>Дата</span>
          <input
            type="date"
            value={header.DateP}
            onChange={(e) => updateHeaderField("DateP", e.target.value)}
          />
        </label>

{(!isNewMode || isMoveInvoice) && (
  <label className="calc-field">
    <span>{isMoveInvoice ? "Куда перемещено" : "Склад прихода"}</span>

    <select
      value={header.IdSkl}
      onChange={(e) =>
        updateHeaderField("IdSkl", Number(e.target.value || 0))
      }
    >
      <option value="0">Выберите склад...</option>

      {sklList.map((item) => (
        <option key={item.ID} value={item.ID}>
          {item.Name}
        </option>
      ))}
    </select>
  </label>
)}
{!isNewMode && !isMoveInvoice && (
  <label className="calc-field">
    <span>Склад перемещения</span>
    <input value={header.IdSklPer || ""} readOnly />
  </label>
)}
{!isMoveInvoice && (
  <>
<label className="calc-field">
  <span>Поставщик</span>

  <select
    value={Number(header.Post || 0)}
    disabled={!isNewMode && Number(header.Post || 0) === 0}
    onChange={(e) =>
      updateHeaderField("Post", Number(e.target.value || 0))
    }
  >
    <option value="0">
      {isNewMode ? "Выберите поставщика..." : "Нет поставщика"}
    </option>

    {postList.map((item) => (
      <option key={item.ID} value={item.ID}>
        {item.Name}
      </option>
    ))}
  </select>
</label>

        <label className="calc-field">
          <span>Форма оплаты</span>
          <select
            value={header.Form}
            onChange={(e) =>
              updateHeaderField("Form", Number(e.target.value || 0))
            }
          >
            <option value="0">Выберите...</option>
            {formList.map((item) => (
              <option key={item.ID} value={item.ID}>
                {item.Name}
              </option>
            ))}
          </select>
        </label>

{!isNewMode && (
  <label className="checkbox-field">
    <input
      type="checkbox"
      checked={Boolean(header.Oplach)}
      onChange={(e) => updateHeaderField("Oplach", e.target.checked)}
    />
    <span>Оплачено</span>
  </label>
)}
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={Boolean(header.Bel)}
            onChange={(e) => updateHeaderField("Bel", e.target.checked)}
          />
          <span>Бел.</span>
        </label>

        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={Boolean(header.Vozv)}
            onChange={(e) => updateHeaderField("Vozv", e.target.checked)}
          />
          <span>Возврат</span>
        </label>
  </>
)}

        <div className="calc-info">
          <span>Сумма:</span>
          <strong>{formatMoney(totalSumm)}</strong>
        </div>
      </div>
<label className="calc-field prih-rem-field">

  <textarea
    value={header.Rem || ""}
    onChange={(e) => updateHeaderField("Rem", e.target.value)}
  />
</label>

      <div className="calc-panel-title prih-items-title">
        <span>Содержимое накладной</span>
        <button type="button" onClick={addRow}>
          + строка
        </button>
      </div>

      <div className="table-wrap prih-table-wrap">
        <table className="data-table prih-table">
          <thead>
            <tr>
              <th>Сырьё</th>
              <th>Кол-во</th>
              <th>Цена</th>
              <th>Сумма</th>
              <th>Ср. цена</th>
              {isMoldova && <th>VAT</th>}
              <th></th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={isMoldova ? 9 : 8}>Строки не добавлены.</td>
              </tr>
            )}

            {rows.map((row) => (
              <tr key={row.ID}>
                <td>
<SearchableSelect
  value={row.Tov}
  options={rawList}
  placeholder="Выберите сырьё..."
  cellIndex={cellIndex++}
  onEnterNext={focusNextCell}
  onChange={(value) => {
    const selectedRaw = rawList.find((item) => Number(item.ID) === Number(value));

    updateRow(row.ID, {
      Tov: value,
      ...(isMoveInvoice && selectedRaw
        ? { Price: Number(selectedRaw.Price || 0) }
        : {})
    });
  }}
/>
                </td>

                <td>
                  <input
                    data-cell={cellIndex++}
                    type="number"
                    step="0.001"
                    value={row.Postup}
                    onKeyDown={handleCellKeyDown}
                    onChange={(e) =>
                      updateRow(row.ID, {
                        Postup: Number(e.target.value || 0)
                      })
                    }
                  />
                </td>

                <td>
                  <input
                    data-cell={cellIndex++}
                    type="number"
                    step="0.01"
                    value={row.Price}
                    onKeyDown={handleCellKeyDown}
                    onChange={(e) =>
                      updateRow(row.ID, {
                        Price: Number(e.target.value || 0)
                      })
                    }
                  />
                </td>

                <td className="text-right">{formatMoney(row.Summ)}</td>


                <td className="text-right">{formatMoney(row.CenaAvg)}</td>

                {isMoldova && (
                  <td>
                    <input
                      data-cell={cellIndex++}
                      type="number"
                      step="0.01"
                      value={row.VatTov}
                      onKeyDown={handleCellKeyDown}
                      onChange={(e) =>
                        updateRow(row.ID, {
                          VatTov: Number(e.target.value || 0)
                        })
                      }
                    />
                  </td>
                )}

                <td>
                  <button
                    type="button"
                    className="small-danger-button"
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