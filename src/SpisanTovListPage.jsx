import { useEffect, useRef, useState } from "react";
import "./spisan-tov-row-visual-fix.css";

function formatDate(value, locale) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(locale);
}

function formatMoney(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "";
  }

  return numberValue.toFixed(2);
}

function formatQty(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "";
  }

  return numberValue.toFixed(2);
}

export default function SpisanTovListPage({
  data,
  selectedInvoiceId = null,
  onOpen,
  onNew,
  readOnly = false,
  t = (key, fallback = "") => fallback,
  locale = "ru-RU"
}) {
  const [selectedId, setSelectedId] = useState(null);
  const listWrapRef = useRef(null);
  const selectedRowRef = useRef(null);

  const rows = Array.isArray(data) ? data : [];

  useEffect(() => {
    if (rows.length === 0) {
      setSelectedId(null);
      return;
    }

    const restoredId = selectedInvoiceId
      ? Number(selectedInvoiceId)
      : null;

    setSelectedId((prevSelectedId) => {
      if (
        restoredId !== null &&
        rows.some((row) => Number(row.ID) === restoredId)
      ) {
        return restoredId;
      }

      const previousId = prevSelectedId
        ? Number(prevSelectedId)
        : null;

      if (
        previousId !== null &&
        rows.some((row) => Number(row.ID) === previousId)
      ) {
        return previousId;
      }

      return Number(rows[0].ID);
    });
  }, [data, selectedInvoiceId]);

  useEffect(() => {
    if (
      !selectedInvoiceId ||
      Number(selectedId) !== Number(selectedInvoiceId)
    ) {
      return;
    }

    let secondFrame = 0;

    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        const row = selectedRowRef.current;
        const tableWrap = listWrapRef.current;

        if (!row || !tableWrap) {
          return;
        }

        const rowRect = row.getBoundingClientRect();
        const wrapRect = tableWrap.getBoundingClientRect();
        const centeredTop =
          tableWrap.scrollTop +
          (rowRect.top - wrapRect.top) -
          (tableWrap.clientHeight - rowRect.height) / 2;

        tableWrap.scrollTop = Math.max(0, centeredTop);
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);

      if (secondFrame) {
        window.cancelAnimationFrame(secondFrame);
      }
    };
  }, [data, selectedInvoiceId, selectedId]);

  const selectedNakl =
    rows.find((row) => Number(row.ID) === Number(selectedId)) ??
    rows[0] ??
    null;

  const items = Array.isArray(selectedNakl?.items)
    ? selectedNakl.items
    : [];

  function openRow(row) {
    if (!row) return;

    setSelectedId(Number(row.ID));
    onOpen?.(row);
  }

  function focusMainRow(invoiceId) {
    window.requestAnimationFrame(() => {
      const row = listWrapRef.current?.querySelector(
        `[data-spisan-tov-id="${Number(invoiceId || 0)}"]`
      );

      if (!(row instanceof HTMLElement)) return;

      row.focus({ preventScroll: true });
      row.scrollIntoView({
        block: "nearest",
        inline: "nearest"
      });
    });
  }

  function handleMainRowKeyDown(event, invoiceId) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    const currentIndex = rows.findIndex(
      (row) => Number(row.ID) === Number(invoiceId)
    );

    if (currentIndex < 0) return;

    // Стрелки работают только в главном списке списаний сырья.
    event.preventDefault();

    const direction = event.key === "ArrowDown" ? 1 : -1;
    const nextRow = rows[currentIndex + direction];

    if (!nextRow) return;

    setSelectedId(Number(nextRow.ID));
    focusMainRow(nextRow.ID);
  }

  return (
  <div className="spisan-tov-list-page">
    <div className="spisan-tov-list-layout">
      <section className="spisan-tov-list-panel">
        <div className="spisan-tov-panel-title spisan-tov-list-header">
          <span>{t("SpisanTovList.Title", "Накладные списания сырья")}</span>

          {!readOnly && onNew && (
            <button
              type="button"
              className="spisan-tov-new-button"
              onClick={onNew}
            >
              + {t("SpisanTovList.NewWriteoff", "Новое списание")}
            </button>
          )}
        </div>

        {rows.length === 0 && (
          <div className="spisan-tov-empty">
            {t("SpisanTovList.EmptyList", "Накладные списания сырья не найдены.")}
          </div>
        )}

        {rows.length > 0 && (
        <div className="table-wrap spisan-tov-list-wrap" ref={listWrapRef}>
          <table className="data-table spisan-tov-list-table">
            <colgroup>
              <col className="spisan-tov-col-date" />
              <col className="spisan-tov-col-number" />
              <col className="spisan-tov-col-expense" />
              <col className="spisan-tov-col-amount" />
              <col className="spisan-tov-col-action" />
            </colgroup>

            <thead>
              <tr>
                <th>{t("SpisanTovList.Date", "Дата")}</th>
                <th>{t("SpisanTovList.Number", "№")}</th>
                <th>{t("SpisanTovList.ExpenseItem", "Статья затрат")}</th>
                <th>{t("SpisanTovList.Amount", "Сумма")}</th>
                <th>{t("SpisanTovList.View", "Просмотр")}</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.ID}
                  ref={
                    Number(row.ID) === Number(selectedId)
                      ? selectedRowRef
                      : null
                  }
                  data-spisan-tov-id={Number(row.ID || 0)}
                  className={Number(row.ID) === Number(selectedNakl?.ID) ? "selected-row" : ""}
                  tabIndex={
                    Number(selectedId) === Number(row.ID) ? 0 : -1
                  }
                  onKeyDown={(event) =>
                    handleMainRowKeyDown(event, row.ID)
                  }
                  onClick={(event) => {
                    setSelectedId(Number(row.ID));
                    event.currentTarget.focus({ preventScroll: true });
                  }}
                >
                  <td>{formatDate(row.DatP, locale)}</td>
                  <td>{row.Nakl}</td>
                  <td title={row.Name ?? ""}>{row.Name}</td>
                  <td className="text-right">{formatMoney(row.Summ)}</td>
                  <td className="center">
                    <button
                      type="button"
                      className="spisan-tov-open-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openRow(row);
                      }}
                    >
                      {t("SpisanTovList.Open", "Открыть")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </section>

      <section className="spisan-tov-items-panel">
        <div className="spisan-tov-panel-title spisan-tov-content-header">
          {t("SpisanTovList.ContentsTitle", "Содержимое накладной №")} {selectedNakl?.Nakl ?? ""}
        </div>

        <div className="spisan-tov-info">
          <span>{t("SpisanTovList.DateLabel", "Дата:")} {formatDate(selectedNakl?.DatP, locale)}</span>
          <span>{t("SpisanTovList.ExpenseItemLabel", "Статья затрат:")} {selectedNakl?.Name ?? ""}</span>
          <span>{t("SpisanTovList.AmountLabel", "Сумма:")} {formatMoney(selectedNakl?.Summ)}</span>
        </div>

        <div className="table-wrap spisan-tov-items-wrap">
          <table className="data-table spisan-tov-items-table">
            <colgroup>
              <col className="spisan-tov-item-col-name" />
              <col className="spisan-tov-item-col-qty" />
              <col className="spisan-tov-item-col-price" />
              <col className="spisan-tov-item-col-amount" />
            </colgroup>

            <thead>
              <tr>
                <th>{t("SpisanTovList.Name", "Наименование")}</th>
                <th>{t("SpisanTovList.Quantity", "Кол-во")}</th>
                <th>{t("SpisanTovList.Price", "Цена")}</th>
                <th>{t("SpisanTovList.Amount", "Сумма")}</th>
              </tr>
            </thead>

            <tbody>
              {items.length === 0 && (
                <tr>
                  <td className="spisan-tov-empty-row" colSpan="4">
                    {t("SpisanTovList.EmptyContents", "Содержимое накладной пустое.")}
                  </td>
                </tr>
              )}

              {items.map((item, index) => (
                <tr key={`${selectedNakl?.ID}-${index}`}>
                  <td title={item.Name ?? ""}>{item.Name}</td>
                  <td className="text-right">{formatQty(item.Kolvo)}</td>
                  <td className="text-right">{formatMoney(item.Price)}</td>
                  <td className="text-right">{formatMoney(item.Summ)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </div>
);
}