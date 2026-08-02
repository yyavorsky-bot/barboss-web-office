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
    <div className="cards-sirya-page">
      <div className="module-toolbar cards-sirya-toolbar">
        <div className="toolbar-left">
          <label className="toolbar-field">
            <span>Категория</span>

            <select
              className="toolbar-select"
              value={String(filterCat ?? "0")}
              onChange={(e) => {
                const nextCategory = e.target.value;

                onChangeCat?.(nextCategory);
                onApply?.(nextCategory);
              }}
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

      </div>

      {rows.length === 0 && (
        <div className="cards-sirya-empty">
          Карточки сырья не найдены.
        </div>
      )}

      {rows.length > 0 && (
        <section className="cards-sirya-table-panel">
          <div className="table-wrap cards-sirya-table-wrap">
            <table className="data-table cards-sirya-table">
              <colgroup>
                <col className="cards-sirya-col-name" />
                <col className="cards-sirya-col-unit" />
                <col className="cards-sirya-col-price" />
                <col className="cards-sirya-col-last-price" />
                <col className="cards-sirya-col-category" />
              </colgroup>

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
              <td title={row.Name ?? ""}>{row.Name}</td>
              <td>{row.Ediz}</td>
              <td className="num">
                {Number(row.Price ?? 0).toFixed(2)}
              </td>
              <td className="num">
                {Number(row.PriceLast ?? 0).toFixed(2)}
              </td>
              <td title={row.Categor ?? ""}>{row.Categor}</td>
            </tr>
          ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}