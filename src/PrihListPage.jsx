import { useState } from "react";

export default function PrihListPage({
  data,
  period,
  posts,
  filterPost,
  date1,
  date2,
  onChangePost,
  onChangeDate1,
  onChangeDate2,
  onOpenInvoice,
  onCreateInvoice,
  onApply
}) {
  const rows = Array.isArray(data) ? data : [];
  const postList = Array.isArray(posts) ? posts : [];
  const [selectedId, setSelectedId] = useState(null);
  
  return (
    <div>
      <div className="module-toolbar">
        <div className="toolbar-left">
          <label className="toolbar-field">
            <span>Поставщик</span>

            <select
              className="toolbar-select"
              value={String(filterPost ?? "%")}
              onChange={(e) => onChangePost(e.target.value)}
            >
              <option value="%">Все</option>

              {postList.map((post) => (
                <option key={post.ID} value={String(post.ID)}>
                  {post.Name}
                </option>
              ))}
            </select>
          </label>

          <label className="toolbar-field">
            <span>с</span>
            <input
              className="toolbar-date"
              type="date"
              value={date1 || period?.Date1 || ""}
              onChange={(e) => onChangeDate1(e.target.value)}
            />
          </label>

          <label className="toolbar-field">
            <span>по</span>
            <input
              className="toolbar-date"
              type="date"
              value={date2 || period?.Date2 || ""}
              onChange={(e) => onChangeDate2(e.target.value)}
            />
          </label>
        </div>

        <div className="toolbar-right">
          <button
            type="button"
            className="toolbar-save-button"
            onClick={onApply}
          >
            Применить
          </button>
          <button type="button" onClick={onCreateInvoice}>
            + Новая накладная
          </button>
        </div>
      </div>

      {rows.length === 0 && (
        <p>Приходные накладные не найдены.</p>
      )}

      {rows.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Номер</th>
                <th>Дата</th>
                <th>Сумма</th>
                <th>Поставщик</th>
                <th>Оплата</th>
                <th>Создал</th>
                <th>Изменил</th>
                <th>Оплачено</th>
                <th>Возврат</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                  <tr
                    key={row.ID}
                    className={selectedId === row.ID ? "selected-row" : ""}
                    onClick={() => setSelectedId(row.ID)}
                  >
                  <td>{row.Invoice}</td>
                  <td>{row.DateP}</td>
                  <td className="num">
                    {Number(row.Summ ?? 0).toFixed(2)}
                  </td>
                  <td>{row.NamePost}</td>
                  <td>{row.FormaOpl}</td>
                  <td>{row.Created}</td>
                  <td>{row.Updt}</td>
                  <td className="center">
                    {row.Oplach ? "✓" : ""}
                  </td>
                  <td className="center">
                    {row.Vozv ? "✓" : ""}
                  </td>
<td className="center">
  <button
    type="button"
    className="small-action-button"
    onClick={(e) => {
      e.stopPropagation();
      onOpenInvoice?.(row.ID);
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
  );
}