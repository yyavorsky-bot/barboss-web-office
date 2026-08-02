import { useEffect, useState } from "react";

function formatDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("ru-RU");
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

  function openRow(row) {
    if (!row) return;

    setSelectedId(row.ID);
    onOpen?.(row);
  }

  return (
  <div className="spisan-tov-list-page">
    <div className="spisan-tov-list-layout">
      <section className="spisan-tov-list-panel">
        <div className="spisan-tov-panel-title spisan-tov-list-header">
          <span>Накладные списания сырья</span>

          {onNew && (
            <button
              type="button"
              className="spisan-tov-new-button"
              onClick={onNew}
            >
              + Новое списание
            </button>
          )}
        </div>

        {rows.length === 0 && (
          <div className="spisan-tov-empty">
            Накладные списания сырья не найдены.
          </div>
        )}

        {rows.length > 0 && (
        <div className="table-wrap spisan-tov-list-wrap">
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
                <th>Дата</th>
                <th>№</th>
                <th>Статья затрат</th>
                <th>Сумма</th>
                <th>Просмотр</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.ID}
                  className={row.ID === selectedNakl?.ID ? "selected-row" : ""}
                  onClick={() => setSelectedId(row.ID)}
                >
                  <td>{formatDate(row.DatP)}</td>
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
                      Открыть
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
          Содержимое накладной № {selectedNakl?.Nakl ?? ""}
        </div>

        <div className="spisan-tov-info">
          <span>Дата: {formatDate(selectedNakl?.DatP)}</span>
          <span>Статья затрат: {selectedNakl?.Name ?? ""}</span>
          <span>Сумма: {formatMoney(selectedNakl?.Summ)}</span>
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
                <th>Наименование</th>
                <th>Кол-во</th>
                <th>Цена</th>
                <th>Сумма</th>
              </tr>
            </thead>

            <tbody>
              {items.length === 0 && (
                <tr>
                  <td className="spisan-tov-empty-row" colSpan="4">
                    Содержимое накладной пустое.
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