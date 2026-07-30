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

export default function PeremListPage({
  data,
  onOpen,
  onNew
}) {
  const [selectedId, setSelectedId] = useState(null);

  const rows = Array.isArray(data) ? data : [];

  useEffect(() => {
    if (rows.length > 0) {
      setSelectedId((prevSelectedId) => {
        const exists = rows.some(
          (row) => row.ID === prevSelectedId
        );

        return exists
          ? prevSelectedId
          : rows[0].ID;
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
    <div className="perem-page">
      <div className="perem-layout">
        <div className="perem-left">
          <div className="perem-panel-title perem-list-header">
            <span>Накладные перемещения</span>

            {onNew && (
              <button
                type="button"
                className="perem-new-button"
                onClick={onNew}
              >
                + Новое перемещение
              </button>
            )}
          </div>

          {rows.length === 0 && (
            <div className="perem-empty">
              Накладные перемещения не найдены.
            </div>
          )}

          {rows.length > 0 && (
            <div className="table-wrap perem-list-wrap">
              <table className="data-table perem-list-table">
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>№</th>
                    <th>Куда перемещено</th>
                    <th>Сумма</th>
                    <th>Просмотр</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.ID}
                      className={
                        row.ID === selectedNakl?.ID
                          ? "selected-row"
                          : ""
                      }
                      onClick={() => setSelectedId(row.ID)}
                      onDoubleClick={() => openRow(row)}
                    >
                      <td>{formatDate(row.DatP)}</td>
                      <td>{row.Nakl}</td>
                      <td>{row.Name}</td>
                      <td className="text-right">
                        {formatMoney(row.Summ)}
                      </td>
                      <td className="center">
                        <button
                          type="button"
                          className="perem-open-button"
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
        </div>

        <div className="perem-right">
          <div className="perem-panel-title perem-content-header">
            <span>
              Содержимое накладной №{" "}
              {selectedNakl?.Nakl ?? ""}
            </span>
          </div>

          {selectedNakl ? (
            <>
              <div className="perem-info">
                <span>
                  Дата: {formatDate(selectedNakl.DatP)}
                </span>
                <span>
                  Куда: {selectedNakl.Name ?? ""}
                </span>
                <span>
                  Сумма: {formatMoney(selectedNakl.Summ)}
                </span>
              </div>

              <div className="table-wrap perem-items-wrap">
                <table className="data-table perem-items-table">
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
                        <td colSpan="4">
                          Содержимое накладной пустое.
                        </td>
                      </tr>
                    )}

                    {items.map((item, index) => (
                      <tr
                        key={`${selectedNakl.ID}-${index}`}
                      >
                        <td>{item.Name}</td>
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
            <div className="perem-empty">
              Выберите накладную перемещения.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}