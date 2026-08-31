import { useEffect, useRef, useState } from "react";
import "./spisan-blud-row-visual-fix.css";

function formatDateTime(value, locale) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatQty(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "";
  }

  return numberValue.toFixed(2);
}

export default function SpisanBludListPage({
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
        `[data-spisan-blud-id="${Number(invoiceId || 0)}"]`
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

    // Стрелки работают только в главном списке списаний блюд.
    event.preventDefault();

    const direction = event.key === "ArrowDown" ? 1 : -1;
    const nextRow = rows[currentIndex + direction];

    if (!nextRow) return;

    setSelectedId(Number(nextRow.ID));
    focusMainRow(nextRow.ID);
  }

  return (
  <div className="spisan-blud-list-page">
    <div className="spisan-blud-list-layout">
      <section className="spisan-blud-list-panel">
<div className="spisan-blud-panel-title spisan-blud-list-header">
  <span>{t("SpisanBludList.Title", "Накладные списания блюд")}</span>

  {!readOnly && onNew && (
    <button
      type="button"
      className="spisan-blud-new-button"
      onClick={() => onNew?.()}
    >
      + {t("SpisanBludList.NewWriteoff", "Новое списание")}
    </button>
  )}
</div>

        {rows.length === 0 && (
          <div className="spisan-blud-empty">
            {t("SpisanBludList.EmptyList", "Накладные списания блюд не найдены.")}
          </div>
        )}

        {rows.length > 0 && (
        <div className="table-wrap spisan-blud-list-wrap" ref={listWrapRef}>
          <table className="data-table spisan-blud-list-table">
            <colgroup>
              <col className="spisan-blud-col-date" />
              <col className="spisan-blud-col-expense" />
              <col className="spisan-blud-col-action" />
            </colgroup>

            <thead>
              <tr>
                <th>{t("SpisanBludList.Date", "Дата")}</th>
                <th>{t("SpisanBludList.ExpenseItem", "Статья затрат")}</th>
                <th className="action-column"></th>
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
                  data-spisan-blud-id={Number(row.ID || 0)}
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
                  onDoubleClick={() => openRow(row)}
                >
                  <td>{formatDateTime(row.DateP, locale)}</td>
                  <td title={row.NazvSpisania ?? ""}>{row.NazvSpisania}</td>
   <td className="action-column center">
  <button
    type="button"
    className="spisan-blud-open-button"
    onClick={(event) => {
      event.stopPropagation();
      openRow(row);
    }}
  >
    {t("SpisanBludList.Open", "Открыть")}
  </button>
</td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </section>

      <section className="spisan-blud-items-panel">
        <div className="spisan-blud-panel-title spisan-blud-content-header">
          {t("SpisanBludList.ContentsTitle", "Содержимое списания блюд")}
        </div>

        <div className="spisan-blud-info">
          <span>{t("SpisanBludList.DateLabel", "Дата:")} {formatDateTime(selectedNakl?.DateP, locale)}</span>
          <span>{t("SpisanBludList.ExpenseItemLabel", "Статья затрат:")} {selectedNakl?.NazvSpisania ?? ""}</span>
        </div>

        <div className="table-wrap spisan-blud-items-wrap">
          <table className="data-table spisan-blud-items-table">
            <colgroup>
              <col className="spisan-blud-item-col-name" />
              <col className="spisan-blud-item-col-qty" />
              <col className="spisan-blud-item-col-warehouse" />
            </colgroup>

            <thead>
              <tr>
                <th>{t("SpisanBludList.Dish", "Блюдо")}</th>
                <th>{t("SpisanBludList.Quantity", "Кол-во")}</th>
                <th>{t("SpisanBludList.Warehouse", "Склад")}</th>
              </tr>
            </thead>

            <tbody>
              {items.length === 0 && (
                <tr>
                  <td className="spisan-blud-empty-row" colSpan="3">
                    {t("SpisanBludList.EmptyContents", "Содержимое накладной пустое.")}
                  </td>
                </tr>
              )}

              {items.map((item, index) => (
                <tr key={`${selectedNakl?.ID}-${index}`}>
                  <td title={item.Name ?? ""}>{item.Name}</td>
                  <td className="text-right">{formatQty(item.Kolvo)}</td>
                  <td title={item.SkladName ?? ""}>{item.SkladName}</td>
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