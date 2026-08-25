import { useEffect, useRef, useState } from "react";
import "./perem-row-visual-fix.css";

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

export default function PeremListPage({
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
        `[data-move-id="${Number(invoiceId || 0)}"]`
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

    // Стрелки работают только в главном списке перемещений.
    event.preventDefault();

    const direction = event.key === "ArrowDown" ? 1 : -1;
    const nextRow = rows[currentIndex + direction];

    if (!nextRow) return;

    setSelectedId(Number(nextRow.ID));
    focusMainRow(nextRow.ID);
  }

  return (
    <div className="move-list-page">
      <div className="move-list-layout">
        <section className="move-list-panel">
          <div className="move-panel-title move-list-header">
            <span>{t("PeremList.Title", "Накладные перемещения")}</span>

            {!readOnly && onNew && (
              <button
                type="button"
                className="move-new-button"
                onClick={onNew}
              >
                + {t("PeremList.NewMove", "Новое перемещение")}
              </button>
            )}
          </div>

          {rows.length === 0 && (
            <div className="move-empty">
              {t("PeremList.EmptyList", "Накладные перемещения не найдены.")}
            </div>
          )}

          {rows.length > 0 && (
            <div className="table-wrap move-list-wrap" ref={listWrapRef}>
              <table className="data-table move-list-table">
                <colgroup>
                  <col className="move-col-date" />
                  <col className="move-col-number" />
                  <col className="move-col-destination" />
                  <col className="move-col-amount" />
                  <col className="move-col-action" />
                </colgroup>

                <thead>
                  <tr>
                    <th>{t("PeremList.Date", "Дата")}</th>
                    <th>{t("PeremList.Number", "№")}</th>
                    <th>{t("PeremList.Destination", "Куда перемещено")}</th>
                    <th>{t("PeremList.Amount", "Сумма")}</th>
                    <th>{t("PeremList.View", "Просмотр")}</th>
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
                      data-move-id={Number(row.ID || 0)}
                      className={
                        Number(row.ID) === Number(selectedNakl?.ID)
                          ? "selected-row"
                          : ""
                      }
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
                      <td>{formatDate(row.DatP, locale)}</td>
                      <td>{row.Nakl}</td>
                      <td title={row.Name ?? ""}>{row.Name}</td>
                      <td className="text-right">
                        {formatMoney(row.Summ)}
                      </td>
                      <td className="center">
                        <button
                          type="button"
                          className="move-open-button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openRow(row);
                          }}
                        >
                          {t("PeremList.Open", "Открыть")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="move-items-panel">
          <div className="move-panel-title move-content-header">
            <span>
              {t("PeremList.ContentsTitle", "Содержимое накладной №")} {" "}
              {selectedNakl?.Nakl ?? ""}
            </span>
          </div>

          {selectedNakl ? (
            <>
              <div className="move-info">
                <span>
                  {t("PeremList.DateLabel", "Дата:")} {formatDate(selectedNakl.DatP, locale)}
                </span>
                <span>
                  {t("PeremList.DestinationLabel", "Куда:")} {selectedNakl.Name ?? ""}
                </span>
                <span>
                  {t("PeremList.AmountLabel", "Сумма:")} {formatMoney(selectedNakl.Summ)}
                </span>
              </div>

              <div className="table-wrap move-items-wrap">
                <table className="data-table move-items-table">
                  <colgroup>
                    <col className="move-item-col-name" />
                    <col className="move-item-col-qty" />
                    <col className="move-item-col-price" />
                    <col className="move-item-col-amount" />
                  </colgroup>

                  <thead>
                    <tr>
                      <th>{t("PeremList.Name", "Наименование")}</th>
                      <th>{t("PeremList.Quantity", "Кол-во")}</th>
                      <th>{t("PeremList.Price", "Цена")}</th>
                      <th>{t("PeremList.Amount", "Сумма")}</th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.length === 0 && (
                      <tr>
                        <td className="move-empty-row" colSpan="4">
                          {t("PeremList.EmptyContents", "Содержимое накладной пустое.")}
                        </td>
                      </tr>
                    )}

                    {items.map((item, index) => (
                      <tr
                        key={`${selectedNakl.ID}-${index}`}
                      >
                        <td title={item.Name ?? ""}>{item.Name}</td>
                        <td className="text-right">
                          {formatQty(item.Postup)}
                        </td>
                        <td className="text-right">
                          {formatMoney(item.Price)}
                        </td>
                        <td className="text-right">
                          {formatMoney(item.Summ)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="move-empty">
              {t("PeremList.SelectInvoice", "Выберите накладную перемещения.")}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}