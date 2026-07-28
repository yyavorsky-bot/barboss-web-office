import { useState } from "react";

export default function CardsSiryaPage({
  data,
  categories,
  filterCat,
  onChangeCat,
  onApply
}) {
  const rows = Array.isArray(data) ? data : [];
  const categoryList = Array.isArray(categories) ? categories : [];

  const [selectedId, setSelectedId] = useState(null);

  return (
    <div>
      <div className="module-toolbar">
        <div className="toolbar-left">
          <label className="toolbar-field">
            <span>Категория</span>

            <select
              className="toolbar-select"
              value={String(filterCat ?? "0")}
              onChange={(e) => onChangeCat(e.target.value)}
            >
              <option value="0">Все</option>

              {categoryList.map((cat) => (
                <option key={cat.ID} value={String(cat.ID)}>
                  {cat.Name}
                </option>
              ))}
            </select>
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
        </div>
      </div>

      {rows.length === 0 && (
        <p>Карточки сырья не найдены.</p>
      )}

      {rows.length > 0 && (
  <div className="raw-cards-page">
    <div className="table-wrap">
      <table className="data-table raw-cards-table">
        <thead>
          <tr>
            <th>Наименование</th>
            <th>Ед.</th>
            <th>Цена</th>
            <th>Последняя цена</th>
            <th>Категория</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr
              key={row.ID}
              className={selectedId === row.ID ? "selected-row" : ""}
              onClick={() => setSelectedId(row.ID)}
            >
              <td>{row.Name}</td>
              <td>{row.Ediz}</td>
              <td className="num">
                {Number(row.Price ?? 0).toFixed(2)}
              </td>
              <td className="num">
                {Number(row.PriceLast ?? 0).toFixed(2)}
              </td>
              <td>{row.Categor}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
)}
    </div>
  );
}