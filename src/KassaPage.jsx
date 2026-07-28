import { useEffect, useMemo, useState } from "react";

function formatMoney(value) {
  const num = Number(value || 0);

  return num.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDateForInput(value) {
  if (!value) return "";

  const text = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const match = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);

  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateDisplay(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("ru-RU");
}

function formatDateForApi(value) {
  if (!value) return "";

  const text = String(value).trim();

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(text)) {
    return text;
  }

  const inputDate = formatDateForInput(text);

  if (!inputDate) {
    return text;
  }

  const [year, month, day] = inputDate.split("-");
  return `${day}.${month}.${year}`;
}

function getNameById(list, id) {
  const found = list.find((item) => Number(item.ID) === Number(id));
  return found?.Name || id || "";
}

function normalizeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function normalizeText(value) {
  return value == null ? "" : String(value);
}
function xmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function attrsToXml(attrs) {
  return Object.entries(attrs)
    .map(([key, value]) => `${key}="${xmlEscape(value)}"`)
    .join(" ");
}

export default function KassaPage({
  data,
  currentOrg = 0,
  kassaDate,
  currentValut,
  onDateChange,
  onValutChange,
  onReload,
  onSave,
  onReceiveRevenue,
  onLoadSupplierInvoices
}) {
  const [selectedPrihId, setSelectedPrihId] = useState(null);
  const [selectedRashodId, setSelectedRashodId] = useState(null);
  const [editPrihRows, setEditPrihRows] = useState([]);
  const [editRashodRows, setEditRashodRows] = useState([]);
  const [nextTempId, setNextTempId] = useState(-1);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [receivingRevenue, setReceivingRevenue] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceRows, setInvoiceRows] = useState([]);
  const [invoiceSupplier, setInvoiceSupplier] = useState(null);
  const [invoiceTargetRowId, setInvoiceTargetRowId] = useState(null);
  const [saveError, setSaveError] = useState("");

  const orgId = Number(currentOrg || 0);
  const valutId = Number(currentValut || 0);
  const readOnly = orgId === 0;
  const canEdit = orgId > 0;

  const prihRows = Array.isArray(data?.prih) ? data.prih : [];

  const rashodBlocks = Array.isArray(data?.rashod)
    ? data.rashod
    : data?.rashod
      ? [data.rashod]
      : [];

  const activeRashodBlocks =
    orgId === 0
      ? rashodBlocks
      : rashodBlocks.filter((block) => Number(block?.Org || 0) === orgId);

  const rashodRowsRaw = activeRashodBlocks.flatMap((block) => {
    const blockOrg = Number(block?.Org || 0);

    if (!Array.isArray(block?.Items)) {
      return [];
    }

    return block.Items.map((row) => ({
      ...row,
      Org: Number(row.Org ?? blockOrg)
    }));
  });

  const rashodRows = Array.from(
    new Map(rashodRowsRaw.map((row) => [Number(row.ID || 0), row])).values()
  );

  const saldRows = rashodBlocks.flatMap((block) =>
    Array.isArray(block?.Sald) ? block.Sald : []
  );

  const valuts = Array.isArray(data?.valuts) ? data.valuts : [];
  const cliKass = Array.isArray(data?.cliKass) ? data.cliKass : [];
  const prihZatr = Array.isArray(data?.prihZatr) ? data.prihZatr : [];
  const postavKass = Array.isArray(data?.postavKass) ? data.postavKass : [];
  const rashodZatr = Array.isArray(data?.rashodZatr) ? data.rashodZatr : [];

  const filteredPrihRows = useMemo(() => {
    return prihRows.filter((row) => {
      const orgOk = orgId === 0 || Number(row.Org || 0) === orgId;
      const valutOk = valutId === 0 || Number(row.Valuts || 0) === valutId;
      return orgOk && valutOk;
    });
  }, [prihRows, orgId, valutId]);

  const filteredRashodRows = useMemo(() => {
    return rashodRows.filter((row) => {
      const orgOk = orgId === 0 || Number(row.Org || 0) === orgId;
      const valutOk = valutId === 0 || Number(row.Valuts || 0) === valutId;
      return orgOk && valutOk;
    });
  }, [rashodRows, orgId, valutId]);

  useEffect(() => {
    setEditPrihRows(
      filteredPrihRows.map((row) => ({
        ID: Number(row.ID || 0),
        Dat: formatDateForInput(row.Dat || kassaDate),
        Org: Number(row.Org || orgId || 0),
        Valuts: Number(row.Valuts || valutId || 0),
        Summa: normalizeNumber(row.Summa),
        KodKl: normalizeNumber(row.KodKl),
        KodZatrat: normalizeNumber(row.KodZatrat),
        Rem: normalizeText(row.Rem),
        Deleted: 0
      }))
    );

    setEditRashodRows(
      filteredRashodRows.map((row) => ({
        ID: Number(row.ID || 0),
        Dat: formatDateForInput(row.Dat || kassaDate),
        Org: Number(row.Org || orgId || 0),
        Valuts: Number(row.Valuts || valutId || 0),
        Summa: normalizeNumber(row.Summa),
        KodPost: normalizeNumber(row.KodPost),
        KodZatrat: normalizeNumber(row.KodZatrat),
        Rem: normalizeText(row.Rem),
        Deleted: 0
      }))
    );

    setSelectedPrihId(null);
    setSelectedRashodId(null);
    setHasChanges(false);
    setSaveError("");
    setNextTempId(-1);
    setInvoiceRows([]);
    setInvoiceSupplier(null);
    setInvoiceTargetRowId(null);
    }, [data, kassaDate, orgId, valutId]);

  const visiblePrihRows = useMemo(
    () => editPrihRows.filter((row) => Number(row.Deleted || 0) !== 1),
    [editPrihRows]
  );

  const visibleRashodRows = useMemo(
    () => editRashodRows.filter((row) => Number(row.Deleted || 0) !== 1),
    [editRashodRows]
  );

  const sald0 = useMemo(() => {
    const row = saldRows.find((item) => Number(item.Valuts || 0) === valutId);
    return Number(row?.Sald0 || 0);
  }, [saldRows, valutId]);

  const prihSum = useMemo(() => {
    return visiblePrihRows.reduce((sum, row) => sum + Number(row.Summa || 0), 0);
  }, [visiblePrihRows]);

  const rashodSum = useMemo(() => {
    return visibleRashodRows.reduce(
      (sum, row) => sum + Number(row.Summa || 0),
      0
    );
  }, [visibleRashodRows]);

  const saldEnd = sald0 + prihSum - rashodSum;

  function shiftDate(days) {
    if (!kassaDate) return;

    const date = new Date(kassaDate);

    if (Number.isNaN(date.getTime())) return;

    date.setDate(date.getDate() + days);

    onDateChange?.(date.toISOString().slice(0, 10));
  }

  function makeTempId() {
    const id = nextTempId;
    setNextTempId((value) => value - 1);
    return id;
  }

  function markChanged() {
    setHasChanges(true);
    setSaveError("");
  }

  function updatePrihRow(id, field, value) {
    setEditPrihRows((rows) =>
      rows.map((row) =>
        Number(row.ID) === Number(id)
          ? {
              ...row,
              [field]: ["Summa", "KodKl", "KodZatrat"].includes(field)
                ? normalizeNumber(value)
                : normalizeText(value)
            }
          : row
      )
    );
    markChanged();
  }

  function updateRashodRow(id, field, value) {
    setEditRashodRows((rows) =>
      rows.map((row) =>
        Number(row.ID) === Number(id)
          ? {
              ...row,
              [field]: ["Summa", "KodPost", "KodZatrat"].includes(field)
                ? normalizeNumber(value)
                : normalizeText(value)
            }
          : row
      )
    );
    markChanged();
  }

  function addPrihRow() {
    if (!canEdit) return;

    const id = makeTempId();

    setEditPrihRows((rows) => [
      ...rows,
      {
        ID: id,
        Dat: kassaDate || "",
        Org: orgId,
        Valuts: valutId,
        Summa: 0,
        KodKl: 0,
        KodZatrat: 0,
        Rem: "",
        Deleted: 0
      }
    ]);

    setSelectedPrihId(id);
    markChanged();
  }

  function addRashodRow() {
    if (!canEdit) return;

    const id = makeTempId();

    setEditRashodRows((rows) => [
      ...rows,
      {
        ID: id,
        Dat: kassaDate || "",
        Org: orgId,
        Valuts: valutId,
        Summa: 0,
        KodPost: 0,
        KodZatrat: 0,
        Rem: "",
        Deleted: 0
      }
    ]);

    setSelectedRashodId(id);
    markChanged();
  }

  function deletePrihRow(id) {
    if (!canEdit) return;

    setEditPrihRows((rows) =>
      rows
        .filter((row) => !(Number(row.ID) < 0 && Number(row.ID) === Number(id)))
        .map((row) =>
          Number(row.ID) === Number(id) ? { ...row, Deleted: 1 } : row
        )
    );

    setSelectedPrihId(null);
    markChanged();
  }

  function deleteRashodRow(id) {
    if (!canEdit) return;

    setEditRashodRows((rows) =>
      rows
        .filter((row) => !(Number(row.ID) < 0 && Number(row.ID) === Number(id)))
        .map((row) =>
          Number(row.ID) === Number(id) ? { ...row, Deleted: 1 } : row
        )
    );

    setSelectedRashodId(null);
    markChanged();
  }

  function cleanPrihRow(row) {
    return {
      ID: Number(row.ID || 0),
      Dat: formatDateForApi(row.Dat || kassaDate),
      Org: orgId,
      Valuts: Number(row.Valuts || valutId || 0),
      Summa: normalizeNumber(row.Summa),
      KodKl: normalizeNumber(row.KodKl),
      KodZatrat: normalizeNumber(row.KodZatrat),
      Rem: normalizeText(row.Rem),
      Deleted: Number(row.Deleted || 0)
    };
  }

  function cleanRashodRow(row) {
    return {
      ID: Number(row.ID || 0),
      Dat: formatDateForApi(row.Dat || kassaDate),
      Org: orgId,
      Valuts: Number(row.Valuts || valutId || 0),
      Summa: normalizeNumber(row.Summa),
      KodPost: normalizeNumber(row.KodPost),
      KodZatrat: normalizeNumber(row.KodZatrat),
      Rem: normalizeText(row.Rem),
      Deleted: Number(row.Deleted || 0)
    };
  }
function buildKassaXml() {
  const prihRows = editPrihRows.map(cleanPrihRow);
  const rashodRows = editRashodRows.map(cleanRashodRow);

  const activePrihXml = prihRows
    .filter((row) => Number(row.Deleted || 0) !== 1)
    .map((row) =>
      `    <Item ${attrsToXml({
        ID: row.ID,
        Dat: row.Dat,
        Org: row.Org,
        Valuts: row.Valuts,
        Summa: row.Summa,
        KodKl: row.KodKl,
        KodZatrat: row.KodZatrat,
        Rem: row.Rem
      })}/>`
    )
    .join("\n");

  const deletedPrihXml = prihRows
    .filter((row) => Number(row.Deleted || 0) === 1 && Number(row.ID || 0) > 0)
    .map((row) => `    <Item ID="${xmlEscape(row.ID)}"/>`)
    .join("\n");

  const activeRashodXml = rashodRows
    .filter((row) => Number(row.Deleted || 0) !== 1)
    .map((row) =>
      `    <Item ${attrsToXml({
        ID: row.ID,
        Dat: row.Dat,
        Org: row.Org,
        Valuts: row.Valuts,
        Summa: row.Summa,
        KodPost: row.KodPost,
        KodZatrat: row.KodZatrat,
        Rem: row.Rem
      })}/>`
    )
    .join("\n");

  const deletedRashodXml = rashodRows
    .filter((row) => Number(row.Deleted || 0) === 1 && Number(row.ID || 0) > 0)
    .map((row) => `    <Item ID="${xmlEscape(row.ID)}"/>`)
    .join("\n");

  return [
    `<Kassa Date="${xmlEscape(formatDateForApi(kassaDate))}" Org="${orgId}">`,
    `  <Prih>`,
    `    <Items>`,
    activePrihXml,
    `    </Items>`,
    `    <Deleted>`,
    deletedPrihXml,
    `    </Deleted>`,
    `  </Prih>`,
    `  <Rashod>`,
    `    <Items>`,
    activeRashodXml,
    `    </Items>`,
    `    <Deleted>`,
    deletedRashodXml,
    `    </Deleted>`,
    `  </Rashod>`,
    `</Kassa>`
  ].join("\n");
}


  async function receiveRevenue() {
    if (hasChanges || saving || receivingRevenue) return;

    try {
      setReceivingRevenue(true);
      setSaveError("");

      if (onReceiveRevenue) {
        await onReceiveRevenue({
          Date: formatDateForApi(kassaDate),
          Org: orgId
        });
      }

      await onReload?.();
    } catch (err) {
      setSaveError(err.message || "Ошибка приема выручки");
    } finally {
      setReceivingRevenue(false);
    }
  }

  async function openSupplierInvoices(row) {
    if (!row || Number(row.KodPost || 0) === 0) return;
    if (invoiceLoading || saving || receivingRevenue) return;

    const supplier = postavKass.find(
      (item) => Number(item.ID) === Number(row.KodPost)
    );

    try {
      setInvoiceLoading(true);
      setSaveError("");

      const result = onLoadSupplierInvoices
        ? await onLoadSupplierInvoices({
            IdPost: Number(row.KodPost),
            Val: valutId
          })
        : [];

      setInvoiceRows(Array.isArray(result) ? result : result ? [result] : []);
      setInvoiceSupplier({
        ID: Number(row.KodPost),
        Name: supplier?.Name || getNameById(postavKass, row.KodPost)
      });
      setInvoiceTargetRowId(row.ID);
    } catch (err) {
      setSaveError(err.message || "Ошибка загрузки накладных поставщика");
    } finally {
      setInvoiceLoading(false);
    }
  }

  function closeSupplierInvoices() {
    setInvoiceRows([]);
    setInvoiceSupplier(null);
    setInvoiceTargetRowId(null);
  }

  function applyInvoiceDebt(invoice) {
    if (invoiceTargetRowId === null || invoiceTargetRowId === undefined) return;

    updateRashodRow(invoiceTargetRowId, "Summa", invoice.Dolg);
    closeSupplierInvoices();
  }

async function saveChanges() {
  if (!canEdit || !hasChanges || saving) return;

  const xml = buildKassaXml();

  const payload = {
    Date: formatDateForApi(kassaDate),
    Org: orgId,
    Xml: xml
  };

  try {
    setSaving(true);
    setSaveError("");

    if (onSave) {
      await onSave(payload);
    } else {
      console.log("Kassa save XML", xml);
    }

    setHasChanges(false);
  } catch (err) {
    setSaveError(err.message || "Ошибка сохранения кассы");
  } finally {
    setSaving(false);
  }
}
  return (
    <div className="kassa-page">
      <div className="kassa-toolbar">
        <div className="kassa-date-panel">
          <button type="button" onClick={() => shiftDate(-1)}>
            ←
          </button>

          <input
            type="date"
            value={kassaDate || ""}
            onChange={(event) => onDateChange?.(event.target.value)}
            disabled={hasChanges}
            title={hasChanges ? "Сначала сохраните или обновите данные" : ""}
          />

          <button type="button" onClick={() => shiftDate(1)} disabled={hasChanges}>
            →
          </button>

          <button type="button" onClick={() => onReload?.()} disabled={saving}>
            Обновить
          </button>

          <button
            type="button"
            className={`save-button ${hasChanges ? "save-button-active" : ""}`}
            onClick={saveChanges}
            disabled={!canEdit || !hasChanges || saving}
          >
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>

        <div className="kassa-valut-panel">
          <button
            type="button"
            className="small-action-button receive-revenue-button"
            onClick={receiveRevenue}
            disabled={hasChanges || saving || receivingRevenue}
            title={hasChanges ? "Сначала сохраните или обновите данные" : ""}
          >
            {receivingRevenue ? "Прием..." : "Прием выручки"}
          </button>

          <span>Тип оплаты</span>

          <select
            value={currentValut || ""}
            onChange={(event) => onValutChange?.(Number(event.target.value))}
            disabled={hasChanges}
            title={hasChanges ? "Сначала сохраните или обновите данные" : ""}
          >
            {valuts.map((item) => (
              <option key={item.ID} value={item.ID}>
                {item.Name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {readOnly && (
        <div className="readonly-notice">
          Режим просмотра: выберите конкретную организацию для добавления и
          редактирования кассовых операций.
        </div>
      )}

      {saveError && <div className="error-box">{saveError}</div>}

      <div className="kassa-summary">
        <div>
          <span>Сальдо начальное</span>
          <strong>{formatMoney(sald0)}</strong>
        </div>

        <div>
          <span>Приход</span>
          <strong>{formatMoney(prihSum)}</strong>
        </div>

        <div>
          <span>Расход</span>
          <strong>{formatMoney(rashodSum)}</strong>
        </div>

        <div>
          <span>Сальдо конечное</span>
          <strong>{formatMoney(saldEnd)}</strong>
        </div>
      </div>

      {invoiceSupplier && (
        <div className="invoice-panel">
          <div className="invoice-panel-header">
            <div>
              <strong>Неоплаченные накладные</strong>
              <span>{invoiceSupplier.Name}</span>
            </div>

            <button
              type="button"
              className="small-action-button"
              onClick={closeSupplierInvoices}
            >
              Вернуться к кассе
            </button>
          </div>

          <div className="invoice-table-wrap">
            <table className="data-table invoice-table">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Дата</th>
                  <th>Склад</th>
                  <th>Сумма</th>
                  <th>Оплачено</th>
                  <th>Dolg</th>
                  <th>Состав</th>
                </tr>
              </thead>

              <tbody>
                {invoiceRows.map((invoice) => (
                  <tr key={invoice.ID}>
                    <td>{invoice.Invoice}</td>
                    <td>{formatDateDisplay(invoice.Date)}</td>
                    <td>{invoice.NameSkl}</td>
                    <td className="text-right">{formatMoney(invoice.SumNakl)}</td>
                    <td className="text-right">{formatMoney(invoice.Oplach)}</td>
                    <td
                      className="text-right invoice-debt-cell"
                      title="Двойной клик: поставить сумму в расход"
                      onDoubleClick={() => applyInvoiceDebt(invoice)}
                    >
                      {formatMoney(invoice.Dolg)}
                    </td>
                    <td>{invoice.Sostav}</td>
                  </tr>
                ))}

                {invoiceRows.length === 0 && (
                  <tr>
                    <td colSpan="7" className="empty-cell">
                      Неоплаченных накладных нет
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="kassa-columns">
        <section className="kassa-panel">
          <div className="perem-panel-title">
            <span>Приход в кассу</span>

            <button type="button" disabled={!canEdit} onClick={addPrihRow}>
              + Добавить
            </button>
          </div>

          <div className="kassa-table-wrap">
            <table className="data-table kassa-table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Сумма</th>
                  <th>Клиент</th>
                  <th>Статья</th>
                  <th>Примечание</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {visiblePrihRows.map((row) => (
                  <tr
                    key={`prih-${row.ID}`}
                    className={row.ID === selectedPrihId ? "selected-row" : ""}
                    onClick={() => setSelectedPrihId(row.ID)}
                  >
                    <td>
                      {canEdit ? (
                        <input
                          className="table-input kassa-date-input"
                          type="date"
                          value={formatDateForInput(row.Dat)}
                          onChange={(event) =>
                            updatePrihRow(row.ID, "Dat", event.target.value)
                          }
                        />
                      ) : (
                        formatDateDisplay(row.Dat)
                      )}
                    </td>
                    <td className="text-right">
                      {canEdit ? (
                        <input
                          className="table-input text-right"
                          type="number"
                          step="0.01"
                          value={row.Summa}
                          onChange={(event) =>
                            updatePrihRow(row.ID, "Summa", event.target.value)
                          }
                        />
                      ) : (
                        formatMoney(row.Summa)
                      )}
                    </td>
                    <td title={`KodKl: ${row.KodKl}`}>
                      {canEdit ? (
                        <select
                          className="table-select"
                          value={row.KodKl || 0}
                          onChange={(event) =>
                            updatePrihRow(row.ID, "KodKl", event.target.value)
                          }
                        >
                          <option value={0}>—</option>
                          {cliKass.map((item) => (
                            <option key={item.ID} value={item.ID}>
                              {item.Name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        getNameById(cliKass, row.KodKl)
                      )}
                    </td>
                    <td title={`KodZatrat: ${row.KodZatrat}`}>
                      {canEdit ? (
                        <select
                          className="table-select"
                          value={row.KodZatrat || 0}
                          onChange={(event) =>
                            updatePrihRow(row.ID, "KodZatrat", event.target.value)
                          }
                        >
                          <option value={0}>—</option>
                          {prihZatr.map((item) => (
                            <option key={item.ID} value={item.ID}>
                              {item.Name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        getNameById(prihZatr, row.KodZatrat)
                      )}
                    </td>
                    <td>
                      {canEdit ? (
                        <input
                          className="table-input"
                          type="text"
                          value={row.Rem || ""}
                          onChange={(event) =>
                            updatePrihRow(row.ID, "Rem", event.target.value)
                          }
                        />
                      ) : (
                        row.Rem || ""
                      )}
                    </td>
                    <td className="action-column">
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={(event) => {
                          event.stopPropagation();
                          deletePrihRow(row.ID);
                        }}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}

                {visiblePrihRows.length === 0 && (
                  <tr>
                    <td colSpan="6" className="empty-cell">
                      Нет приходов за выбранную дату
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="kassa-panel">
          <div className="perem-panel-title">
            <span>Расход из кассы</span>

            <button type="button" disabled={!canEdit} onClick={addRashodRow}>
              + Добавить
            </button>
          </div>

          <div className="kassa-table-wrap">
            <table className="data-table kassa-table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Сумма</th>
                  <th>Поставщик</th>
                  <th>Статья</th>
                  <th>Примечание</th>
                  <th>Invoice</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {visibleRashodRows.map((row) => (
                  <tr
                    key={`rashod-${row.ID}`}
                    className={
                      row.ID === selectedRashodId ? "selected-row" : ""
                    }
                    onClick={() => setSelectedRashodId(row.ID)}
                  >
                    <td>
                      {canEdit ? (
                        <input
                          className="table-input kassa-date-input"
                          type="date"
                          value={formatDateForInput(row.Dat)}
                          onChange={(event) =>
                            updateRashodRow(row.ID, "Dat", event.target.value)
                          }
                        />
                      ) : (
                        formatDateDisplay(row.Dat)
                      )}
                    </td>
                    <td className="text-right">
                      {canEdit ? (
                        <input
                          className="table-input text-right"
                          type="number"
                          step="0.01"
                          value={row.Summa}
                          onChange={(event) =>
                            updateRashodRow(row.ID, "Summa", event.target.value)
                          }
                        />
                      ) : (
                        formatMoney(row.Summa)
                      )}
                    </td>
                    <td title={`KodPost: ${row.KodPost}`}>
                      {canEdit ? (
                        <select
                          className="table-select"
                          value={row.KodPost || 0}
                          onChange={(event) =>
                            updateRashodRow(row.ID, "KodPost", event.target.value)
                          }
                        >
                          <option value={0}>—</option>
                          {postavKass.map((item) => (
                            <option key={item.ID} value={item.ID}>
                              {item.Name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        getNameById(postavKass, row.KodPost)
                      )}
                    </td>
                    <td title={`KodZatrat: ${row.KodZatrat}`}>
                      {canEdit ? (
                        <select
                          className="table-select"
                          value={row.KodZatrat || 0}
                          onChange={(event) =>
                            updateRashodRow(
                              row.ID,
                              "KodZatrat",
                              event.target.value
                            )
                          }
                        >
                          <option value={0}>—</option>
                          {rashodZatr.map((item) => (
                            <option key={item.ID} value={item.ID}>
                              {item.Name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        getNameById(rashodZatr, row.KodZatrat)
                      )}
                    </td>
                    <td>
                      {canEdit ? (
                        <input
                          className="table-input"
                          type="text"
                          value={row.Rem || ""}
                          onChange={(event) =>
                            updateRashodRow(row.ID, "Rem", event.target.value)
                          }
                        />
                      ) : (
                        row.Rem || ""
                      )}
                    </td>
                    <td className="action-column">
                      <button
                        type="button"
                        className="small-action-button"
                        disabled={Number(row.KodPost || 0) === 0 || invoiceLoading}
                        onClick={(event) => {
                          event.stopPropagation();
                          openSupplierInvoices(row);
                        }}
                      >
                        Invoice
                      </button>
                    </td>
                    <td className="action-column">
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteRashodRow(row.ID);
                        }}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}

                {visibleRashodRows.length === 0 && (
                  <tr>
                    <td colSpan="7" className="empty-cell">
                      Нет расходов за выбранную дату
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}