import { useEffect, useState } from "react";

function formatDateTime(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("ru-RU", {
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
  onNew
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
  <div className="perem-page">
    <div className="perem-layout">
      <div className="perem-left">
<div className="perem-panel-title perem-list-header">
  <span>Накладные списания блюд</span>

  <button
    type="button"
    className="perem-new-button"
    onClick={() => onNew?.()}
  >
    + Новое списание
  </button>
</div>

        {rows.length === 0 && (
          <div className="perem-empty">
            Накладные списания блюд не найдены.
          </div>
        )}

        {rows.length > 0 && (
        <div className="table-wrap perem-list-wrap">
          <table className="data-table spisan-blud-list-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Статья затрат</th>
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
                  <td>{formatDateTime(row.DateP)}</td>
                  <td>{row.NazvSpisania}</td>
   <td className="action-column center">
  <button
    type="button"
    className="perem-open-button"
    onClick={(event) => {
      event.stopPropagation();
      onOpen?.(row);
    }}
  >
    Открыть
  </button>
</td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>

      <div className="perem-right">
        <div className="perem-panel-title">
          Содержимое списания блюд
        </div>

        <div className="perem-info">
          <span>Дата: {formatDateTime(selectedNakl?.DateP)}</span>
          <span>Статья затрат: {selectedNakl?.NazvSpisania ?? ""}</span>
        </div>

        <div className="table-wrap perem-items-wrap">
          <table className="data-table spisan-blud-items-table">
            <thead>
              <tr>
                <th>Блюдо</th>
                <th>Кол-во</th>
                <th>Склад</th>
              </tr>
            </thead>

            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan="3">
                    Содержимое накладной пустое.
                  </td>
                </tr>
              )}

              {items.map((item, index) => (
                <tr key={`${selectedNakl?.ID}-${index}`}>
                  <td>{item.Name}</td>
                  <td className="text-right">{formatQty(item.Kolvo)}</td>
                  <td>{item.SkladName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
);
}