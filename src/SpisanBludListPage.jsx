import { useEffect, useState } from "react";

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
  onOpen,
  onNew,
  t = (key, fallback = "") => fallback,
  locale = "ru-RU"
}) {
  const [selectedId, setSelectedId] = useState(null);

  const rows = Array.isArray(data) ? data : [];

  useEffect(() => {
    if (rows.length > 0) {
      setSelectedId((prevSelectedId) => {
        const exists = rows.some((row) => row.ID === prevSelectedId);

        return exists ? prevSelectedId : rows[0].ID;
      });
    } else {
      setSelectedId(null);
    }
  }, [data]);

  const selectedNakl =
    rows.find((row) => row.ID === selectedId) ??
    rows[0] ??
    null;

  const items = Array.isArray(selectedNakl?.items)
    ? selectedNakl.items
    : [];

  return (
  <div className="spisan-blud-list-page">
    <div className="spisan-blud-list-layout">
      <section className="spisan-blud-list-panel">
<div className="spisan-blud-panel-title spisan-blud-list-header">
  <span>{t("SpisanBludList.Title", "Накладные списания блюд")}</span>

  <button
    type="button"
    className="spisan-blud-new-button"
    onClick={() => onNew?.()}
  >
    + {t("SpisanBludList.NewWriteoff", "Новое списание")}
  </button>
</div>

        {rows.length === 0 && (
          <div className="spisan-blud-empty">
            {t("SpisanBludList.EmptyList", "Накладные списания блюд не найдены.")}
          </div>
        )}

        {rows.length > 0 && (
        <div className="table-wrap spisan-blud-list-wrap">
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
                  className={row.ID === selectedNakl?.ID ? "selected-row" : ""}
                  onClick={() => setSelectedId(row.ID)}
                >
                  <td>{formatDateTime(row.DateP, locale)}</td>
                  <td title={row.NazvSpisania ?? ""}>{row.NazvSpisania}</td>
   <td className="action-column center">
  <button
    type="button"
    className="spisan-blud-open-button"
    onClick={(event) => {
      event.stopPropagation();
      onOpen?.(row);
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