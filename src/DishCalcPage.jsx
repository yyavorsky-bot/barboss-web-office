import { useEffect, useMemo, useRef, useState } from "react";
import { exportReportFile } from "./reportExport.js";
import "./dish-calc-reports.css";

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

function formatQty(value) {
  return Number(value || 0).toFixed(3);
}

function normalizeDate(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function getUniqueDatesDesc(items) {
  const dates = Array.from(
    new Set(
      items
        .map((row) => normalizeDate(row.Date))
        .filter(Boolean)
    )
  );

  return dates.sort((a, b) => b.localeCompare(a));
}

function formatDisplayDate(value) {
  if (!value) return "";

  const [year, month, day] = String(value).slice(0, 10).split("-");

  if (!year || !month || !day) return value;

  return `${day}.${month}.${year.slice(2)}`;
}

function makeTempId() {
  return -Date.now() - Math.floor(Math.random() * 1000);
}

function normalizeCalcItem(row) {
  return {
    ID: Number(row.ID || 0),
    CodeTov: Number(row.CodeTov || 0),
    CodeDish: Number(row.CodeDish || 0),
    Kolvo: Number(row.Kolvo || 0),
    Netto: Number(row.Netto || 0),
    Price: Number(row.Price || 0),
    SumSeb: Number(row.SumSeb || 0),
    Kind: row.Kind || ""
  };
}

function normalizeCalcState(calcDate, rem, rows, deletedIds = []) {
  return {
    Date: calcDate || "",
    Rem: rem || "",
    items: rows.map(normalizeCalcItem),
    deletedIds: deletedIds.map(Number)
  };
}

function normalizeSearchText(value) {
  return String(value ?? "").trim().toLowerCase();
}


function formatApiDate(value) {
  const normalized = normalizeDate(value);
  if (!normalized) return "";

  const [year, month, day] = normalized.split("-");
  if (!year || !month || !day) return "";

  return `${day}.${month}.${year}`;
}

function normalizeCalcCardReport(data) {
  const source = Array.isArray(data) ? data[0] ?? {} : data ?? {};
  const items = Array.isArray(source.items)
    ? source.items
    : Array.isArray(source.Items)
      ? source.Items
      : [];

  return {
    IdDish: Number(source.IdDish ?? source.ID ?? 0),
    NameDish: String(source.NameDish ?? source.Name ?? ""),
    PriceDish: Number(source.PriceDish ?? source.Price ?? 0),
    VesDish: Number(source.VesDish ?? source.Ves ?? 0),
    EdVesDish: String(source.EdVesDish ?? source.EdVes ?? ""),
    Technology:
      source.Technology === null || source.Technology === undefined
        ? ""
        : String(source.Technology),
    items: items.map((item, index) => ({
      ...item,
      _rowNo: index + 1,
      NameTov: String(item.NameTov ?? item.Name ?? ""),
      Brutto: Number(item.Brutto ?? item.Kolvo ?? 0),
      Netto: Number(item.Netto ?? 0),
      PriceTov: Number(item.PriceTov ?? item.AvgPrice ?? item.Price ?? 0),
      Summ: Number(item.Summ ?? item.AvgSum ?? 0),
      Kolvo: Number(item.Kolvo ?? item.Brutto ?? 0),
      AvgPrice: Number(item.AvgPrice ?? item.PriceTov ?? item.Price ?? 0),
      AvgSum: Number(item.AvgSum ?? item.Summ ?? 0)
    }))
  };
}

function cleanCalcProductName(value) {
  return String(value ?? "").replace(/^\(pf\)\s*/i, "");
}

function calcReportNumber(value, locale = "ru-RU", digits = 2, fixed = true) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) return "";

  return number.toLocaleString(locale, {
    minimumFractionDigits: fixed ? digits : 0,
    maximumFractionDigits: digits
  });
}

function calcReportOutputLabel(report, t) {
  const unit = String(report?.EdVesDish ?? "").trim();

  return unit
    ? `${t(
        "DishCalc.Report.FinishedOutput",
        "Выход в готовом виде готового продукта"
      )}, ${unit}:`
    : `${t(
        "DishCalc.Report.FinishedOutput",
        "Выход в готовом виде готового продукта"
      )}:`;
}

function getCalcCardTitle(kind, t) {
  if (kind === "technology") {
    return t("DishCalc.Report.TechnologyTitle", "Технологическая карточка");
  }

  return t("DishCalc.Report.CostTitle", "Калькуляционная карточка");
}

function getCalcCardFileSuffix(kind) {
  if (kind === "technology") return "Technology";
  if (kind === "expandedCost") return "ExpandedCost";
  return "Cost";
}

function buildCalcCardExportModel(kind, report, reportDate, locale, t) {
  const safeReport = report ?? {};
  const items = Array.isArray(safeReport.items) ? safeReport.items : [];
  const title = getCalcCardTitle(kind, t);
  const outputLabel = calcReportOutputLabel(safeReport, t);
  const fileName = `CalcCard_${safeReport.IdDish || "dish"}_${getCalcCardFileSuffix(kind)}`;

  if (kind === "technology") {
    return {
      title,
      fileName,
      orientation: "portrait",
      locale,
      meta: [
        {
          label: t("DishCalc.Report.DishName", "Наименование блюда"),
          value: safeReport.NameDish || ""
        },
        {
          label: t("DishCalc.Report.Date", "Дата"),
          value: reportDate || ""
        }
      ],
      columns: [
        { key: "No", title: "№", type: "integer", width: 6 },
        {
          key: "NameTov",
          title: t("DishCalc.Report.ProductName", "Наименование продуктов"),
          type: "text",
          width: 48
        },
        {
          key: "Brutto",
          title: t("DishCalc.Report.GrossNorm", "Норма Брутто"),
          type: "number",
          decimals: 3,
          width: 15
        },
        {
          key: "Netto",
          title: t("DishCalc.Report.NetNorm", "Норма Нетто"),
          type: "number",
          decimals: 3,
          width: 15
        }
      ],
      rows: items.map((item, index) => ({
        No: index + 1,
        NameTov: cleanCalcProductName(item.NameTov),
        Brutto: Number(item.Brutto || 0),
        Netto: Number(item.Netto || 0)
      })),
      footerRows: [
        {
          label: t("DishCalc.Report.Technology", "Технология приготовления"),
          values: { NameTov: safeReport.Technology || "" }
        },
        {
          label: outputLabel,
          values: {
            NameTov: `${calcReportNumber(
              safeReport.VesDish,
              locale,
              3,
              false
            )} ${safeReport.EdVesDish || ""}`.trim()
          }
        },
        {
          label: t(
            "DishCalc.Report.TechnologyPreparedBy",
            "Технологическую карту составил"
          ),
          values: { NameTov: "_________________________" }
        }
      ]
    };
  }

  const isExpanded = kind === "expandedCost";
  const total = items.reduce(
    (sum, item) =>
      sum + Number(isExpanded ? item.AvgSum ?? 0 : item.Summ ?? 0),
    0
  );

  const columns = isExpanded
    ? [
        { key: "No", title: "№", type: "integer", width: 6 },
        {
          key: "NameTov",
          title: t("DishCalc.Report.ProductName", "Наименование продуктов"),
          type: "text",
          width: 43
        },
        {
          key: "Kolvo",
          title: t("DishCalc.Report.GrossNorm", "Норма Брутто"),
          type: "number",
          decimals: 4,
          width: 15
        },
        {
          key: "Price",
          title: t("DishCalc.Report.Price", "Цена"),
          type: "number",
          decimals: 2,
          width: 15
        },
        {
          key: "Summ",
          title: t("DishCalc.Report.Amount", "Сумма"),
          type: "number",
          decimals: 2,
          width: 15
        }
      ]
    : [
        { key: "No", title: "№", type: "integer", width: 6 },
        {
          key: "NameTov",
          title: t("DishCalc.Report.ProductName", "Наименование продуктов"),
          type: "text",
          width: 38
        },
        {
          key: "Brutto",
          title: t("DishCalc.Report.GrossNorm", "Норма Брутто"),
          type: "number",
          decimals: 3,
          width: 13
        },
        {
          key: "Netto",
          title: t("DishCalc.Report.NetNorm", "Норма Нетто"),
          type: "number",
          decimals: 3,
          width: 13
        },
        {
          key: "Price",
          title: t("DishCalc.Report.Price", "Цена"),
          type: "number",
          decimals: 2,
          width: 13
        },
        {
          key: "Summ",
          title: t("DishCalc.Report.Amount", "Сумма"),
          type: "number",
          decimals: 2,
          width: 13
        }
      ];

  const rows = items.map((item, index) =>
    isExpanded
      ? {
          No: index + 1,
          NameTov: cleanCalcProductName(item.NameTov),
          Kolvo: Number(item.Kolvo || 0),
          Price: Number(item.AvgPrice || 0),
          Summ: Number(item.AvgSum || 0)
        }
      : {
          No: index + 1,
          NameTov: cleanCalcProductName(item.NameTov),
          Brutto: Number(item.Brutto || 0),
          Netto: Number(item.Netto || 0),
          Price: Number(item.PriceTov || 0),
          Summ: Number(item.Summ || 0)
        }
  );

  return {
    title,
    fileName,
    orientation: "portrait",
    locale,
    meta: [
      {
        label: t("DishCalc.Report.DishName", "Наименование блюда"),
        value: safeReport.NameDish || ""
      },
      {
        label: t("DishCalc.Report.Date", "Дата"),
        value: reportDate || ""
      }
    ],
    columns,
    rows,
    footerRows: [
      {
        label: t(
          "DishCalc.Report.RawSetCost",
          "Стоимость сырьевого набора на 1 блюдо"
        ),
        values: { Summ: total }
      },
      {
        label: t(
          "DishCalc.Report.SellingPrice",
          "Продажная цена одного блюда"
        ),
        values: { Summ: Number(safeReport.PriceDish || 0) }
      },
      {
        label: outputLabel,
        values: {
          NameTov: `${calcReportNumber(
            safeReport.VesDish,
            locale,
            3,
            false
          )} ${safeReport.EdVesDish || ""}`.trim()
        }
      },
      {
        label: t("DishCalc.Report.PreparedBy", "Калькуляцию составил"),
        values: { NameTov: "_________________________" }
      },
      {
        label: `${t("DishCalc.Report.Approved", "Утверждаю")}  ${t(
          "DishCalc.Report.Director",
          "Директор"
        )}`,
        values: { NameTov: "_________________________" }
      }
    ]
  };
}

function CalcCardReportPage({
  kind,
  report,
  reportDate,
  loading,
  error,
  onBack,
  onExport,
  exportLoading,
  locale,
  t
}) {
  const title = getCalcCardTitle(kind, t);
  const items = Array.isArray(report?.items) ? report.items : [];
  const isTechnology = kind === "technology";
  const isExpanded = kind === "expandedCost";
  const total = items.reduce(
    (sum, item) =>
      sum + Number(isExpanded ? item.AvgSum ?? 0 : item.Summ ?? 0),
    0
  );
  const outputLabel = calcReportOutputLabel(report, t);

  return (
    <div className="calc-card-report-page">
      <div className="module-toolbar calc-card-report-toolbar no-print">
        <div className="toolbar-left">
          <button type="button" className="toolbar-button" onClick={onBack}>
            {t("Common.Back", "Назад")}
          </button>
        </div>

        <div className="toolbar-right calc-card-report-actions">
          <button
            type="button"
            className="toolbar-button"
            disabled={Boolean(exportLoading) || loading || !report}
            onClick={() => onExport?.("xlsx")}
          >
            {t("Common.Excel", "Excel")}
          </button>
          <button
            type="button"
            className="toolbar-button"
            disabled={Boolean(exportLoading) || loading || !report}
            onClick={() => onExport?.("docx")}
          >
            {t("Common.Word", "Word")}
          </button>
          <button
            type="button"
            className="toolbar-button primary"
            disabled={Boolean(exportLoading) || loading || !report}
            onClick={() => window.print()}
          >
            {t("Common.Print", "Печать")}
          </button>
        </div>
      </div>

      {error && <div className="login-error calc-card-report-error">{error}</div>}

      {loading ? (
        <div className="calc-card-report-loading">
          {t("DishCalc.Report.Loading", "Загрузка отчёта...")}
        </div>
      ) : (
        report && (
          <article className="calc-card-report-sheet">
            <h1>
              {title} №<span className="calc-card-report-line">_________</span>
            </h1>

            <div className="calc-card-report-dish-line">
              <span>{t("DishCalc.Report.DishName", "Наименование блюда")}:</span>
              <strong>{report.NameDish || "—"}</strong>
              <strong className="calc-card-report-date">{reportDate || ""}</strong>
            </div>

            {isTechnology ? (
              <table className="calc-card-report-table calc-card-report-table-tech">
                <thead>
                  <tr>
                    <th className="calc-card-col-no">
                      №<br />п/п
                    </th>
                    <th>{t("DishCalc.Report.ProductName", "Наименование продуктов")}</th>
                    <th className="num">
                      {t("DishCalc.Report.Norm", "Норма")}<br />
                      {t("DishCalc.Report.Gross", "Брутто")}
                    </th>
                    <th className="num">
                      {t("DishCalc.Report.Norm", "Норма")}<br />
                      {t("DishCalc.Report.Net", "Нетто")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={`${item._rowNo || index}-${item.NameTov}`}>
                      <td className="num">{index + 1}</td>
                      <td>{cleanCalcProductName(item.NameTov)}</td>
                      <td className="num">
                        {calcReportNumber(item.Brutto, locale, 3, true)}
                      </td>
                      <td className="num">
                        {calcReportNumber(item.Netto, locale, 3, true)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table
                className={`calc-card-report-table ${
                  isExpanded
                    ? "calc-card-report-table-expanded"
                    : "calc-card-report-table-cost"
                }`}
              >
                <thead>
                  <tr className="calc-card-approval-head">
                    <th rowSpan="3" className="calc-card-col-no">
                      №<br />п/п
                    </th>
                    <th rowSpan="3">
                      {t("DishCalc.Report.ProductName", "Наименование продуктов")}
                    </th>
                    <th colSpan={isExpanded ? 3 : 4}>
                      {t(
                        "DishCalc.Report.CalculationApproval",
                        "№ калькуляции и дата утверждения"
                      )}
                    </th>
                  </tr>
                  <tr className="calc-card-approval-line">
                    <th colSpan={isExpanded ? 3 : 4}>
                      № ______ &nbsp;&nbsp;&nbsp; "____" __________ 20___
                    </th>
                  </tr>
                  <tr>
                    <th className="num">
                      {t("DishCalc.Report.Norm", "Норма")}<br />
                      {t("DishCalc.Report.Gross", "Брутто")}
                    </th>
                    {!isExpanded && (
                      <th className="num">
                        {t("DishCalc.Report.Norm", "Норма")}<br />
                        {t("DishCalc.Report.Net", "Нетто")}
                      </th>
                    )}
                    <th className="num">{t("DishCalc.Report.Price", "Цена")}</th>
                    <th className="num">{t("DishCalc.Report.Amount", "Сумма")}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={`${item._rowNo || index}-${item.NameTov}`}>
                      <td className="num">{index + 1}</td>
                      <td>{cleanCalcProductName(item.NameTov)}</td>
                      <td className="num">
                        {calcReportNumber(
                          isExpanded ? item.Kolvo : item.Brutto,
                          locale,
                          isExpanded ? 4 : 3,
                          false
                        )}
                      </td>
                      {!isExpanded && (
                        <td className="num">
                          {calcReportNumber(item.Netto, locale, 3, false)}
                        </td>
                      )}
                      <td className="num">
                        {calcReportNumber(
                          isExpanded ? item.AvgPrice : item.PriceTov,
                          locale,
                          2,
                          true
                        )}
                      </td>
                      <td className="num">
                        {calcReportNumber(
                          isExpanded ? item.AvgSum : item.Summ,
                          locale,
                          2,
                          true
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {isTechnology ? (
              <>
                <div className="calc-card-technology-text">
                  {String(report.Technology || "")
                    .split(/\r?\n/)
                    .map((line, index) => (
                      <div key={`${index}-${line}`}>{line || "\u00A0"}</div>
                    ))}
                </div>

                <div className="calc-card-report-summary">
                  <div>
                    <span>{outputLabel}</span>
                    <strong>
                      {calcReportNumber(report.VesDish, locale, 3, false)}
                    </strong>
                  </div>
                </div>

                <div className="calc-card-report-signature calc-card-report-signature-tech">
                  <span>
                    {t(
                      "DishCalc.Report.TechnologyPreparedBy",
                      "Технологическую карту составил"
                    )}:
                  </span>
                  <span className="calc-card-sign-line">_________________________</span>
                </div>
              </>
            ) : (
              <>
                <div className="calc-card-report-summary">
                  <div>
                    <span>
                      {t(
                        "DishCalc.Report.RawSetCost",
                        "Стоимость сырьевого набора на 1 блюдо"
                      )}:
                    </span>
                    <strong>{calcReportNumber(total, locale, 2, true)}</strong>
                  </div>
                  <div>
                    <span>
                      {t(
                        "DishCalc.Report.SellingPrice",
                        "Продажная цена одного блюда"
                      )}:
                    </span>
                    <strong>
                      {calcReportNumber(report.PriceDish, locale, 2, true)}
                    </strong>
                  </div>
                  <div>
                    <span>{outputLabel}</span>
                    <strong>
                      {calcReportNumber(report.VesDish, locale, 3, false)}
                    </strong>
                  </div>
                </div>

                <div className="calc-card-report-signature">
                  <span>{t("DishCalc.Report.PreparedBy", "Калькуляцию составил")}:</span>
                  <span className="calc-card-sign-line">_________________________</span>
                </div>

                <div className="calc-card-report-approval">
                  <span>{t("DishCalc.Report.Approved", "Утверждаю")}</span>
                  <span>{t("DishCalc.Report.Director", "Директор")}</span>
                  <span className="calc-card-sign-line">_________________________</span>
                </div>
              </>
            )}
          </article>
        )
      )}
    </div>
  );
}

function SearchableSelect({
  value,
  options,
  placeholder,
  onChange,
  onCreateOption,
  onCreateError,
  onEnterNext,
  t
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [creating, setCreating] = useState(false);

  const selectedItem = useMemo(() => {
    const numericValue = Number(value || 0);
    return options.find((item) => Number(item.ID) === numericValue) || null;
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    const query = normalizeSearchText(searchText);

    const result = query
      ? options.filter((item) =>
          normalizeSearchText(item.Name).includes(query)
        )
      : options;

    return result.slice(0, 80);
  }, [options, searchText]);

  const exactMatch = useMemo(() => {
    const query = normalizeSearchText(searchText);

    if (!query) {
      return null;
    }

    return (
      options.find(
        (item) => normalizeSearchText(item.Name) === query
      ) || null
    );
  }, [options, searchText]);

  const inputValue = isOpen
    ? searchText
    : selectedItem?.Name || "";

  function closeList() {
    setIsOpen(false);
    setSearchText("");
  }

  function chooseItem(item, moveNext = false) {
    onChange?.(Number(item.ID || 0));
    closeList();

    if (moveNext) {
      window.requestAnimationFrame(() => {
        onEnterNext?.();
      });
    }
  }

  function clearValue() {
    onChange?.(0);
    closeList();
  }

  async function createMissingOption(moveNext = false) {
    const newName = searchText.trim();

    if (!newName || !onCreateOption || creating) {
      return;
    }

    const confirmed = window.confirm(
      t(
        "DishCalc.AddMissingRawConfirm",
        "Такого товара нет в справочнике. Хотите его добавить?"
      )
    );

    if (!confirmed) {
      return;
    }

    setCreating(true);

    try {
      const createdItem = await onCreateOption(newName);

      if (!createdItem?.ID) {
        throw new Error(
          t(
            "DishCalc.AddRawInvalidResponse",
            "Сервер не вернул добавленный товар"
          )
        );
      }

      chooseItem(createdItem, moveNext);
    } catch (err) {
      onCreateError?.(
        err instanceof Error
          ? err
          : new Error(
              t(
                "DishCalc.AddRawError",
                "Не удалось добавить товар в справочник"
              )
            )
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="searchable-select dish-calc-search">
      <input
        type="text"
        value={inputValue}
        placeholder={placeholder}
        disabled={creating}
        autoComplete="off"
        onFocus={() => {
          setIsOpen(true);
          setSearchText("");
        }}
        onChange={(e) => {
          setSearchText(e.target.value);
          setIsOpen(true);
        }}
        onKeyDown={async (e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            closeList();
            return;
          }

          if (e.key !== "Enter") {
            return;
          }

          e.preventDefault();

          if (exactMatch) {
            chooseItem(exactMatch, true);
            return;
          }

          if (filteredOptions.length === 1) {
            chooseItem(filteredOptions[0], true);
            return;
          }

          if (
            filteredOptions.length === 0 &&
            searchText.trim() &&
            onCreateOption
          ) {
            await createMissingOption(true);
          }
        }}
        onBlur={() => {
          window.setTimeout(closeList, 150);
        }}
      />

      {isOpen && (
        <div className="searchable-select-list">
          {Number(value || 0) > 0 && (
            <button
              type="button"
              className="searchable-select-option muted"
              onMouseDown={(e) => {
                e.preventDefault();
                clearValue();
              }}
            >
              {t("DishCalc.ClearSelection", "Очистить выбор")}
            </button>
          )}

          {filteredOptions.length === 0 && (
            onCreateOption && searchText.trim() ? (
              <button
                type="button"
                className="searchable-select-option muted"
                disabled={creating}
                onMouseDown={(e) => {
                  e.preventDefault();
                  createMissingOption();
                }}
              >
                {creating
                  ? t("DishCalc.AddingRawMaterial", "Добавление...")
                  : `${t(
                      "DishCalc.AddRawMaterialPrefix",
                      "Добавить"
                    )} «${searchText.trim()}»`}
              </button>
            ) : (
              <div className="searchable-select-empty">
                {t("DishCalc.NothingFound", "Ничего не найдено")}
              </div>
            )
          )}

          {filteredOptions.map((item) => (
            <button
              key={item.ID}
              type="button"
              className="searchable-select-option"
              onMouseDown={(e) => {
                e.preventDefault();
                chooseItem(item);
              }}
            >
              {item.Name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DishCalcPage({
  dishId,
  currentSklad,
  fetchWithAuth,
  onBack,
  onDirtyChange,
  t = (key, fallback = "") => fallback,
  locale = "ru-RU"
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [rawList, setRawList] = useState([]);
  const [dishList, setDishList] = useState([]);

  const [allRows, setAllRows] = useState([]);
  const [calcDates, setCalcDates] = useState([]);
  const [rows, setRows] = useState([]);
  const [rem, setRem] = useState("");
  const [sebestDish, setSebestDish] = useState(0);
  const [dishName, setDishName] = useState("");
  const [sourceDate, setSourceDate] = useState("");
  const [calcDate, setCalcDate] = useState("");

  const [deletedIds, setDeletedIds] = useState([]);
  const [originalState, setOriginalState] = useState(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const saveSuccessTimerRef = useRef(null);

  const [printMenuOpen, setPrintMenuOpen] = useState(false);
  const [printMenuLoading, setPrintMenuLoading] = useState(false);
  const [printMenuError, setPrintMenuError] = useState("");
  const [printBaseData, setPrintBaseData] = useState(null);

  const [reportKind, setReportKind] = useState("");
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportExportLoading, setReportExportLoading] = useState(false);

  const unsavedChangesMessage = t(
    "DishCalc.UnsavedChangesWarning",
    "Внимание! Вы не сохранили измененные данные!\nУверены, что хотите уйти?"
  );

  const rawById = useMemo(() => {
    return new Map(rawList.map((item) => [Number(item.ID), item]));
  }, [rawList]);

  const dishById = useMemo(() => {
    return new Map(dishList.map((item) => [Number(item.ID), item]));
  }, [dishList]);

  const rawRows = rows.filter((row) => row.Kind === "raw");
  const dishRows = rows.filter((row) => row.Kind === "dish");

  const totalSeb = rows.reduce(
    (sum, row) => sum + Number(row.SumSeb || 0),
    0
  );

  const currentState = normalizeCalcState(calcDate, rem, rows, deletedIds);

  const isDirty = Boolean(
    originalState &&
      JSON.stringify(currentState) !== JSON.stringify(originalState)
  );

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    if (isDirty) {
      setSaveSuccess(false);
    }
  }, [isDirty]);

  useEffect(() => {
    return () => {
      onDirtyChange?.(false);
    };
  }, [onDirtyChange]);

  useEffect(() => {
    return () => {
      if (saveSuccessTimerRef.current) {
        window.clearTimeout(saveSuccessTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    function handleBeforeUnload(event) {
      if (!isDirty) return;

      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dishId, currentSklad]);

  async function loadAll() {
    if (!dishId) return;

    setLoading(true);
    setError("");

    setPrintMenuOpen(false);
    setPrintMenuError("");
    setPrintBaseData(null);
    setReportKind("");
    setReportData(null);
    setReportError("");

    try {
      const [calcResponse, rawResponse, dishResponse] = await Promise.all([
        fetchWithAuth(
          `https://webback.bar-boss.com/wf_DishCalc.php?ID=${encodeURIComponent(dishId)}`
        ),
        fetchWithAuth("https://webback.bar-boss.com/wf_SpisokTovarovCalc.php"),
        fetchWithAuth(
          `https://webback.bar-boss.com/wf_DishPF.php?Sklad=${encodeURIComponent(currentSklad || 1)}`
        )
      ]);

      const calcDataRaw = await calcResponse.json();
      const rawData = await rawResponse.json();
      const dishData = await dishResponse.json();

      console.log("wf_DishCalc dishId:", dishId);
      console.log("wf_DishCalc raw response:", calcDataRaw);

      const calcData = Array.isArray(calcDataRaw)
        ? calcDataRaw[0] || {}
        : calcDataRaw || {};

      const items = Array.isArray(calcData.items)
        ? calcData.items
        : Array.isArray(calcData.Items)
          ? calcData.Items
          : [];

      console.log("wf_DishCalc normalized:", calcData);
      console.log("wf_DishCalc items:", items);

      const loadedAllRows = items.map((row) => ({
        ...row,
        ID: Number(row.ID || 0),
        CodeTov: Number(row.CodeTov || 0),
        CodeDish: Number(row.CodeDish || 0),
        Kolvo: Number(row.Kolvo || 0),
        Netto: Number(row.Netto || 0),
        Price: Number(row.Price || 0),
        SumSeb: Number(row.SumSeb || 0),
        Date: normalizeDate(row.Date),
        Kind: Number(row.CodeDish || 0) > 0 ? "dish" : "raw"
      }));

      const dates = getUniqueDatesDesc(loadedAllRows);
      const loadedDate = dates[0] || "";
      const visibleRows = loadedAllRows.filter(
        (row) => normalizeDate(row.Date) === loadedDate
      );

      setRawList(Array.isArray(rawData) ? rawData : []);
      setDishList(Array.isArray(dishData) ? dishData : []);

      setAllRows(loadedAllRows);
      setCalcDates(dates);
      setRows(visibleRows);
      setDishName(calcData.Name ?? "");
      setRem(calcData.Rem ?? "");
      setSebestDish(Number(calcData.SebestDish || 0));

      setSourceDate(loadedDate);
      setCalcDate(loadedDate);
      setDeletedIds([]);

      setOriginalState(
        normalizeCalcState(
          loadedDate,
          calcData.Rem ?? "",
          visibleRows,
          []
        )
      );
    } catch (err) {
      setError(err.message || t("DishCalc.LoadError", "Ошибка загрузки калькуляционной карты"));
    } finally {
      setLoading(false);
    }
  }

  function isRowDirty(row) {
    if (!originalState) return false;

    const originalRow = originalState.items.find(
      (item) => Number(item.ID) === Number(row.ID)
    );

    if (!originalRow) return true;

    return (
      JSON.stringify(normalizeCalcItem(row)) !==
      JSON.stringify(originalRow)
    );
  }

  function handleBackClick() {
    if (isDirty && !window.confirm(unsavedChangesMessage)) {
      return;
    }

    onDirtyChange?.(false);
    onBack?.();
  }

  function handleSourceDateChange(value) {
    const selectedDate = normalizeDate(value);

    if (selectedDate === sourceDate) {
      return;
    }

    if (isDirty && !window.confirm(unsavedChangesMessage)) {
      return;
    }

    onDirtyChange?.(false);

    const visibleRows = allRows.filter(
      (row) => normalizeDate(row.Date) === selectedDate
    );
    const restoredRem = originalState?.Rem ?? rem;

    setSourceDate(selectedDate);
    setCalcDate(selectedDate);
    setRows(visibleRows);
    setRem(restoredRem);
    setDeletedIds([]);

    setOriginalState(
      normalizeCalcState(
        selectedDate,
        restoredRem,
        visibleRows,
        []
      )
    );

    setPrintMenuOpen(false);
    setPrintMenuError("");
    setPrintBaseData(null);
  }

  async function createRawMaterial(name) {
    const normalizedName = String(name ?? "").trim();

    if (!normalizedName) {
      throw new Error(
        t("DishCalc.RawNameRequired", "Введите название товара")
      );
    }

    setError("");

    const url = new URL("https://webback.bar-boss.com/wf_RefAdd.php");
    url.searchParams.set("Action", "Tovar");
    url.searchParams.set("txt", normalizedName);

    const response = await fetchWithAuth(url.toString(), {
      method: "GET"
    });

    const responseText = await response.text();

    let data;

    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error(
        t(
          "DishCalc.AddRawNonJson",
          "Добавление товара вернуло не JSON:"
        ) +
          " " +
          responseText.substring(0, 300)
      );
    }

    if (!response.ok) {
      throw new Error(
        data?.error ||
          data?.message ||
          t(
            "DishCalc.AddRawError",
            "Не удалось добавить товар в справочник"
          )
      );
    }

    const created = Array.isArray(data) ? data[0] : data;
    const createdItem = {
      ID: Number(created?.ID || 0),
      Name: String(created?.Name ?? normalizedName),
      Price: Number(created?.Price || 0)
    };

    if (!createdItem.ID) {
      throw new Error(
        t(
          "DishCalc.AddRawInvalidResponse",
          "Сервер не вернул добавленный товар"
        )
      );
    }

    setRawList((prev) => {
      const exists = prev.some(
        (item) => Number(item.ID) === createdItem.ID
      );

      return exists ? prev : [...prev, createdItem];
    });

    return createdItem;
  }

  async function loadRawPrice(codeTov) {
    if (!codeTov) return 0;

    const response = await fetchWithAuth(
      `https://webback.bar-boss.com/wf_SebTov.php?ID=${encodeURIComponent(codeTov)}`
    );

    const data = await response.json();
    const row = Array.isArray(data) ? data[0] : data;

    return Number(row?.Price || 0);
  }

  async function loadDishPfSeb(codeDish, netto) {
    if (!codeDish) {
      return {
        Price: 0,
        SumSeb: 0
      };
    }

    const response = await fetchWithAuth(
      `https://webback.bar-boss.com/wf_DishPFseb.php?ID=${encodeURIComponent(codeDish)}&Netto=${encodeURIComponent(netto || 0)}`
    );

    const data = await response.json();
    const row = Array.isArray(data) ? data[0] : data;

    return {
      Price: Number(row?.Price || 0),
      SumSeb: Number(row?.SumSeb || 0)
    };
  }

  function roundMoney(value) {
    return Math.round(Number(value || 0) * 100) / 100;
  }

  function updateRow(rowId, patch) {
    setRows((prevRows) =>
      prevRows.map((row) =>
        row.ID === rowId ? { ...row, ...patch } : row
      )
    );
  }

  function getCalcTableRow(kind, rowId) {
    const table = document.querySelector(
      kind === "dish"
        ? ".dish-calc-pf-table"
        : ".dish-calc-raw-table"
    );

    if (!table) return null;

    return (
      Array.from(
        table.querySelectorAll("tbody tr[data-calc-row-id]")
      ).find(
        (rowElement) =>
          String(rowElement.dataset.calcRowId) === String(rowId)
      ) ?? null
    );
  }

  function focusCalcRowField(kind, rowId, field) {
    window.requestAnimationFrame(() => {
      const rowElement = getCalcTableRow(kind, rowId);
      const input = rowElement?.querySelector(
        `[data-calc-field="${field}"]`
      );

      if (!input) return;

      input.focus();
      input.select?.();
    });
  }

  function focusNextCalcRowItem(kind, rowId) {
    window.requestAnimationFrame(() => {
      const currentRow = getCalcTableRow(kind, rowId);
      const nextRow = currentRow?.nextElementSibling ?? null;
      const input = nextRow?.querySelector(".dish-calc-search input");

      if (!input) return;

      input.focus();
      input.select?.();
    });
  }

  function handleCalcEnter(event, callback) {
    if (event.key !== "Enter") return;

    event.preventDefault();
    callback?.();
  }

  async function handleRawSelect(rowId, codeTov) {
    const value = Number(codeTov || 0);
    const price = await loadRawPrice(value);

    setRows((prevRows) =>
      prevRows.map((row) => {
        if (row.ID !== rowId) return row;

        const kolvo = Number(row.Kolvo || 0);

        return {
          ...row,
          CodeTov: value,
          CodeDish: 0,
          Price: price,
          SumSeb: roundMoney(price * kolvo)
        };
      })
    );
  }

  function handleRawKolvoChange(rowId, value) {
    const kolvo = Number(value || 0);

    setRows((prevRows) =>
      prevRows.map((row) => {
        if (row.ID !== rowId) return row;

        const price = Number(row.Price || 0);

        return {
          ...row,
          Kolvo: kolvo,
          SumSeb: roundMoney(price * kolvo)
        };
      })
    );
  }

  async function handleDishSelect(rowId, codeDish) {
    const value = Number(codeDish || 0);

    const currentRow = rows.find((row) => row.ID === rowId);
    const netto = Number(currentRow?.Netto || currentRow?.Kolvo || 0);

    const sebData = await loadDishPfSeb(value, netto);

    setRows((prevRows) =>
      prevRows.map((row) =>
        row.ID === rowId
          ? {
              ...row,
              CodeTov: 0,
              CodeDish: value,
              Price: sebData.Price,
              SumSeb: sebData.SumSeb
            }
          : row
      )
    );
  }

  async function handleDishNettoChange(rowId, value) {
    const netto = Number(value || 0);
    const currentRow = rows.find((row) => row.ID === rowId);

    if (!currentRow) return;

    const codeDish = Number(currentRow.CodeDish || 0);
    const sebData = await loadDishPfSeb(codeDish, netto);

    setRows((prevRows) =>
      prevRows.map((row) =>
        row.ID === rowId
          ? {
              ...row,
              Netto: netto,
              Kolvo: netto,
              Price: sebData.Price,
              SumSeb: sebData.SumSeb
            }
          : row
      )
    );
  }

  function addRawRow() {
    setRows((prevRows) => [
      ...prevRows,
      {
        ID: makeTempId(),
        Kind: "raw",
        CodeTov: 0,
        CodeDish: 0,
        Kolvo: 0,
        Netto: 0,
        Price: 0,
        SumSeb: 0
      }
    ]);
  }

  function addDishRow() {
    setRows((prevRows) => [
      ...prevRows,
      {
        ID: makeTempId(),
        Kind: "dish",
        CodeTov: 0,
        CodeDish: 0,
        Kolvo: 0,
        Netto: 0,
        Price: 0,
        SumSeb: 0
      }
    ]);
  }

  function deleteRow(rowId) {
    const ok = window.confirm(t("DishCalc.DeleteConfirm", "Удалить строку?"));
    if (!ok) return;

    setRows((prevRows) => prevRows.filter((row) => row.ID !== rowId));

    if (rowId > 0) {
      setDeletedIds((prev) => [...prev, rowId]);
    }
  }

  function buildSavePayload() {
    return {
      IDinDish: dishId,
      SourceDate: sourceDate,
      Date: calcDate,
      Rem: rem,
      items: rows.map((row) => ({
        ID: Number(row.ID || 0),
        CodeTov: Number(row.CodeTov || 0),
        CodeDish: Number(row.CodeDish || 0),
        Kolvo: Number(row.Kolvo || 0),
        Netto: Number(row.Netto || 0)
      })),
      deletedIds
    };
  }
function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function xmlNum(value) {
  return String(Number(value || 0)).replace(",", ".");
}

function buildSaveXml() {
  const itemsXml = rows
    .filter((row) => Number(row.CodeTov || 0) > 0 || Number(row.CodeDish || 0) > 0)
    .map((row) => {
      return `    <Item ID="${Number(row.ID || 0)}" CodeTov="${Number(row.CodeTov || 0)}" CodeDish="${Number(row.CodeDish || 0)}" Kolvo="${xmlNum(row.Kolvo)}" Netto="${xmlNum(row.Netto)}" />`;
    })
    .join("\n");

  const deletedXml = deletedIds
    .filter((id) => Number(id) > 0)
    .map((id) => `    <Item ID="${Number(id)}" />`)
    .join("\n");

  return `<Calc>
  <Head IDinDish="${Number(dishId || 0)}" SourceDate="${escapeXml(sourceDate)}" Date="${escapeXml(calcDate)}" />

  <Items>
${itemsXml}
  </Items>

  <Deleted>
${deletedXml}
  </Deleted>

  <Rem>${escapeXml(rem)}</Rem>
</Calc>`;
}

async function handleSave() {
  if (saveLoading || !isDirty) return;

  const xml = buildSaveXml();

  setSaveLoading(true);
  setSaveSuccess(false);

  if (saveSuccessTimerRef.current) {
    window.clearTimeout(saveSuccessTimerRef.current);
    saveSuccessTimerRef.current = null;
  }

  try {
    const response = await fetchWithAuth(
      "https://webback.bar-boss.com/wf_DishCalcSave.php",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/xml; charset=utf-8"
        },
        body: xml
      }
    );

    const data = await response.json();

    if (data.status !== "ok") {
      alert(data.error || t("DishCalc.SaveError", "Ошибка сохранения калькуляционной карты"));
      return;
    }

    await loadAll();
    onDirtyChange?.(false);
    setSaveSuccess(true);

    saveSuccessTimerRef.current = window.setTimeout(() => {
      setSaveSuccess(false);
      saveSuccessTimerRef.current = null;
    }, 2800);
  } catch (err) {
    alert(err.message || t("DishCalc.SaveError", "Ошибка сохранения калькуляционной карты"));
  } finally {
    setSaveLoading(false);
  }
}

  async function fetchCalcCardReport(typ) {
    const reportDate = sourceDate || calcDate;
    const apiDate = formatApiDate(reportDate);

    if (!dishId || !apiDate) {
      throw new Error(
        t(
          "DishCalc.Report.DateRequired",
          "Не выбрана дата калькуляции для отчёта"
        )
      );
    }

    const url = new URL("https://webback.bar-boss.com/wr_CalkCard.php");
    url.searchParams.set("Id", String(dishId));
    url.searchParams.set("Dat", apiDate);
    url.searchParams.set("Typ", String(typ));

    const response = await fetchWithAuth(url.toString(), { method: "GET" });
    const responseText = await response.text();

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error(
        `${t(
          "DishCalc.Report.NonJson",
          "Отчёт вернул не JSON:"
        )} ${responseText.substring(0, 400)}`
      );
    }

    if (!response.ok) {
      throw new Error(
        data?.error ||
          data?.message ||
          t("DishCalc.Report.LoadError", "Не удалось загрузить отчёт")
      );
    }

    return normalizeCalcCardReport(data);
  }

  async function handleTogglePrintMenu() {
    if (printMenuOpen) {
      setPrintMenuOpen(false);
      setPrintMenuError("");
      return;
    }

    if (isDirty) {
      setPrintMenuError(
        t(
          "DishCalc.Report.SaveBeforePrint",
          "Сначала сохраните изменения калькуляции"
        )
      );
      setPrintMenuOpen(true);
      return;
    }

    setPrintMenuOpen(true);
    setPrintMenuError("");

    if (printBaseData) return;

    setPrintMenuLoading(true);

    try {
      const data = await fetchCalcCardReport(1);
      setPrintBaseData(data);
    } catch (err) {
      setPrintMenuError(
        err?.message ||
          t("DishCalc.Report.LoadError", "Не удалось загрузить отчёт")
      );
    } finally {
      setPrintMenuLoading(false);
    }
  }

  async function openCalcCardReport(kind) {
    if (isDirty) {
      setPrintMenuError(
        t(
          "DishCalc.Report.SaveBeforePrint",
          "Сначала сохраните изменения калькуляции"
        )
      );
      return;
    }

    setPrintMenuOpen(false);
    setReportKind(kind);
    setReportData(null);
    setReportError("");
    setReportLoading(true);

    try {
      const typ = kind === "expandedCost" ? 2 : 1;
      const data =
        typ === 1 && printBaseData
          ? printBaseData
          : await fetchCalcCardReport(typ);

      if (
        kind === "technology" &&
        !String(data?.Technology ?? "").trim()
      ) {
        throw new Error(
          t(
            "DishCalc.Report.TechnologyEmpty",
            "Для блюда не заполнена технология приготовления"
          )
        );
      }

      if (typ === 1) {
        setPrintBaseData(data);
      }

      setReportData(data);
    } catch (err) {
      setReportError(
        err?.message ||
          t("DishCalc.Report.LoadError", "Не удалось загрузить отчёт")
      );
    } finally {
      setReportLoading(false);
    }
  }

  function backFromCalcCardReport() {
    setReportKind("");
    setReportData(null);
    setReportError("");
    setReportLoading(false);
  }

  async function exportCurrentCalcCard(format) {
    if (!reportData || !reportKind) return;

    const reportDate = formatApiDate(sourceDate || calcDate);

    setReportExportLoading(true);

    try {
      const reportModel = buildCalcCardExportModel(
        reportKind,
        reportData,
        reportDate,
        locale,
        t
      );

      await exportReportFile({
        fetchWithAuth,
        reportModel,
        format,
        errorMessage: t(
          "DishCalc.Report.ExportError",
          "Не удалось экспортировать отчёт"
        )
      });
    } finally {
      setReportExportLoading(false);
    }
  }

  if (reportKind) {
    return (
      <CalcCardReportPage
        kind={reportKind}
        report={reportData}
        reportDate={formatApiDate(sourceDate || calcDate)}
        loading={reportLoading}
        error={reportError}
        onBack={backFromCalcCardReport}
        onExport={exportCurrentCalcCard}
        exportLoading={reportExportLoading}
        locale={locale}
        t={t}
      />
    );
  }

  return (
    <div className="dish-calc-page dish-calc-editor-page">
      <div className="form-header-panel dish-calc-form-header dish-calc-editor-header">
        <div className="dish-calc-editor-title-block">
          <button
            type="button"
            className="back-to-list-button dish-calc-back-button"
            onClick={handleBackClick}
          >
            {t("DishCalc.BackToDishes", "← К списку блюд")}
          </button>

          <div className="calc-dish-title dish-calc-title dish-calc-editor-title">
            <span>{t("DishCalc.TitlePrefix", "Калькуляционная карта:")}</span>
            <strong>{dishName || `ID ${dishId}`}</strong>
          </div>
        </div>

        <div className="calc-header dish-calc-header dish-calc-editor-controls">
        <div className="calc-field">
          <span>{t("DishCalc.LoadDate", "Дата загрузки")}</span>
          <select
            value={sourceDate}
            onChange={(e) => handleSourceDateChange(e.target.value)}
          >
            {calcDates.length === 0 && (
              <option value="">{t("DishCalc.NoCalculations", "Нет калькуляций")}</option>
            )}

            {calcDates.map((date) => (
              <option key={date} value={date}>
                {formatDisplayDate(date)}
              </option>
            ))}
          </select>
        </div>

        <div className="calc-field">
          <span>{t("DishCalc.SaveDate", "Дата сохранения")}</span>
          <input
            type="date"
            value={calcDate}
            onChange={(e) => setCalcDate(e.target.value)}
          />
        </div>

        <div className="calc-info">
          <span>{t("DishCalc.DishCost", "Себестоимость блюда:")}</span>
          <strong>{formatMoney(sebestDish)}</strong>
        </div>

        <div className="dish-calc-save-status-cell">
          <button
            type="button"
            className="primary-button dish-calc-save-button"
            disabled={!isDirty || saveLoading}
            onClick={handleSave}
          >
            {saveLoading
              ? t("Dishes.Saving", "Сохранение...")
              : t("DishCalc.Save", "Сохранить")}
          </button>

          {saveSuccess && (
            <span className="save-success-message" role="status" aria-live="polite">
              ✓ {t("Common.Saved", "Сохранено")}
            </span>
          )}
        </div>

        <button
          type="button"
          className={`primary-button dish-calc-print-button ${
            printMenuOpen ? "is-active" : ""
          }`}
          disabled={loading || saveLoading || !sourceDate}
          onClick={handleTogglePrintMenu}
        >
          {t("DishCalc.Print", "Печать")}
        </button>
        </div>
      </div>

      {printMenuOpen && (
        <div className="dish-calc-print-menu">
          <button
            type="button"
            onClick={() => openCalcCardReport("cost")}
            disabled={printMenuLoading || isDirty || !printBaseData}
          >
            {t("DishCalc.Report.Cost", "По себестоимости")}
          </button>

          <button
            type="button"
            onClick={() => openCalcCardReport("technology")}
            disabled={
              printMenuLoading ||
              isDirty ||
              !printBaseData ||
              !String(printBaseData?.Technology ?? "").trim()
            }
            title={
              printBaseData &&
              !String(printBaseData?.Technology ?? "").trim()
                ? t(
                    "DishCalc.Report.TechnologyEmpty",
                    "Для блюда не заполнена технология приготовления"
                  )
                : ""
            }
          >
            {t("DishCalc.Report.TechnologyCard", "Технологическая карта")}
          </button>

          <button
            type="button"
            onClick={() => openCalcCardReport("expandedCost")}
            disabled={printMenuLoading || isDirty}
          >
            {t(
              "DishCalc.Report.ExpandedCost",
              "По себестоимости развернуто"
            )}
          </button>

          {printMenuLoading && (
            <span className="dish-calc-print-menu-status">
              {t("DishCalc.Report.MenuLoading", "Загрузка...")}
            </span>
          )}

          {printMenuError && (
            <span className="dish-calc-print-menu-error">
              {printMenuError}
            </span>
          )}
        </div>
      )}

      <div className="calc-layout dish-calc-editor-layout">
        <section className="calc-panel dish-calc-editor-panel">
          <div className="calc-panel-title dish-calc-panel-title">
            <span>{t("DishCalc.RawMaterials", "Сырьё")}</span>
            <button
              type="button"
              className="dish-calc-add-row-button"
              onClick={addRawRow}
            >
              + {t("DishCalc.AddRow", "Строка")}
            </button>
          </div>

          <div className="table-wrap calc-table-wrap dish-calc-table-wrap">
            <table className="data-table calc-table dish-calc-table dish-calc-raw-table">
              <colgroup>
                <col className="dish-calc-col-item" />
                <col className="dish-calc-col-qty" />
                <col className="dish-calc-col-netto" />
                <col className="dish-calc-col-price" />
                <col className="dish-calc-col-amount" />
                <col className="dish-calc-col-delete" />
              </colgroup>

              <thead>
                <tr>
                  <th>{t("DishCalc.RawMaterials", "Сырьё")}</th>
                  <th>{t("DishCalc.Quantity", "Кол-во")}</th>
                  <th>{t("DishCalc.Net", "Нетто")}</th>
                  <th>{t("DishCalc.Price", "Цена")}</th>
                  <th>{t("DishCalc.Amount", "Сумма")}</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {rawRows.length === 0 && (
                  <tr>
                    <td className="dish-calc-empty-row" colSpan="6">
                      {t("DishCalc.RawEmpty", "Сырьё не добавлено.")}
                    </td>
                  </tr>
                )}

                {rawRows.map((row) => (
                  <tr
                    key={row.ID}
                    data-calc-row-id={row.ID}
                    className={isRowDirty(row) ? "changed-row" : ""}
                  >
                    <td>
                      <SearchableSelect
                        value={row.CodeTov}
                        options={rawList}
                        placeholder={t("DishCalc.RawSearchPlaceholder", "Найти сырьё...")}
                        onCreateOption={createRawMaterial}
                        onCreateError={(err) =>
                          setError(
                            err?.message ||
                              t(
                                "DishCalc.AddRawError",
                                "Не удалось добавить товар в справочник"
                              )
                          )
                        }
                        onChange={(value) => handleRawSelect(row.ID, value)}
                        onEnterNext={() =>
                          focusCalcRowField("raw", row.ID, "qty")
                        }
                        t={t}
                      />
                    </td>

                    <td>
                      <input
                        type="number"
                        step="0.001"
                        data-calc-field="qty"
                        value={row.Kolvo}
                        onChange={(e) =>
                          handleRawKolvoChange(row.ID, e.target.value)
                        }
                        onKeyDown={(e) =>
                          handleCalcEnter(e, () =>
                            focusCalcRowField("raw", row.ID, "netto")
                          )
                        }
                      />
                    </td>

                    <td>
                      <input
                        type="number"
                        step="0.001"
                        data-calc-field="netto"
                        value={row.Netto}
                        onChange={(e) =>
                          updateRow(row.ID, {
                            Netto: Number(e.target.value || 0)
                          })
                        }
                        onKeyDown={(e) =>
                          handleCalcEnter(e, () =>
                            focusNextCalcRowItem("raw", row.ID)
                          )
                        }
                      />
                    </td>

                    <td className="text-right">
                      {formatMoney(row.Price)}
                    </td>

                    <td className="text-right">
                      {formatMoney(row.SumSeb)}
                    </td>

                    <td>
                      <button
                        type="button"
                        className="small-danger-button dish-calc-delete-button"
                        title={t("DishCalc.DeleteRow", "Удалить строку")}
                        aria-label={t("DishCalc.DeleteRow", "Удалить строку")}
                        onClick={() => deleteRow(row.ID)}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="calc-panel dish-calc-editor-panel">
          <div className="calc-panel-title dish-calc-panel-title">
            <span>{t("DishCalc.DishesSemiFinished", "Блюда / полуфабрикаты")}</span>
            <button
              type="button"
              className="dish-calc-add-row-button"
              onClick={addDishRow}
            >
              + {t("DishCalc.AddRow", "Строка")}
            </button>
          </div>

          <div className="table-wrap calc-table-wrap dish-calc-table-wrap">
            <table className="data-table calc-table dish-calc-table dish-calc-pf-table">
              <colgroup>
                <col className="dish-calc-col-item" />
                <col className="dish-calc-col-qty" />
                <col className="dish-calc-col-netto" />
                <col className="dish-calc-col-price" />
                <col className="dish-calc-col-amount" />
                <col className="dish-calc-col-delete" />
              </colgroup>

              <thead>
                <tr>
                  <th>{t("DishCalc.DishSemiFinished", "Блюдо / ПФ")}</th>
                  <th>{t("DishCalc.Quantity", "Кол-во")}</th>
                  <th>{t("DishCalc.Net", "Нетто")}</th>
                  <th>{t("DishCalc.Price", "Цена")}</th>
                  <th>{t("DishCalc.Amount", "Сумма")}</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {dishRows.length === 0 && (
                  <tr>
                    <td className="dish-calc-empty-row" colSpan="6">
                      {t("DishCalc.SemiFinishedEmpty", "Полуфабрикаты не добавлены.")}
                    </td>
                  </tr>
                )}

                {dishRows.map((row) => (
                  <tr
                    key={row.ID}
                    data-calc-row-id={row.ID}
                    className={isRowDirty(row) ? "changed-row" : ""}
                  >
                    <td>
                      <SearchableSelect
                        value={row.CodeDish}
                        options={dishList}
                        placeholder={t("DishCalc.DishSearchPlaceholder", "Найти блюдо / ПФ...")}
                        onChange={(value) => handleDishSelect(row.ID, value)}
                        onEnterNext={() =>
                          focusCalcRowField("dish", row.ID, "qty")
                        }
                        t={t}
                      />
                    </td>

                    <td>
                      <input
                        type="number"
                        step="0.001"
                        data-calc-field="qty"
                        value={row.Kolvo}
                        onChange={(e) =>
                          updateRow(row.ID, {
                            Kolvo: Number(e.target.value || 0)
                          })
                        }
                        onKeyDown={(e) =>
                          handleCalcEnter(e, () =>
                            focusCalcRowField("dish", row.ID, "netto")
                          )
                        }
                      />
                    </td>

                    <td>
                      <input
                        type="number"
                        step="0.001"
                        data-calc-field="netto"
                        value={row.Netto}
                        onChange={(e) =>
                          handleDishNettoChange(row.ID, e.target.value)
                        }
                        onKeyDown={(e) =>
                          handleCalcEnter(e, () =>
                            focusNextCalcRowItem("dish", row.ID)
                          )
                        }
                      />
                    </td>

                    <td className="text-right">
                      {formatMoney(row.Price)}
                    </td>

                    <td className="text-right">
                      {formatMoney(row.SumSeb)}
                    </td>

                    <td>
                      <button
                        type="button"
                        className="small-danger-button dish-calc-delete-button"
                        title={t("DishCalc.DeleteRow", "Удалить строку")}
                        aria-label={t("DishCalc.DeleteRow", "Удалить строку")}
                        onClick={() => deleteRow(row.ID)}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="calc-rem-block dish-calc-rem-block dish-calc-editor-rem-block">
        <label>
          <span>{t("DishCalc.Technology", "Технология приготовления")}</span>
          <textarea
            value={rem}
            onChange={(e) => setRem(e.target.value)}
            rows={5}
          />
        </label>
      </div>
    </div>
  );
}