import { useEffect, useMemo, useRef, useState } from "react";
import "./prih-scan-match.css";

function normalizeSearchText(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("ru-RU");
}


function normalizeDateInputValue(value) {
  const text = String(value ?? "").trim();

  if (!text || text === "0") {
    return "";
  }

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const localMatch = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);

  if (localMatch) {
    return `${localMatch[3]}-${String(localMatch[2]).padStart(2, "0")}-${String(localMatch[1]).padStart(2, "0")}`;
  }

  return "";
}

function SupplierSearch({
  posts,
  value,
  onChange,
  t = (key, fallback = "") => fallback
}) {
  const rootRef = useRef(null);
  const postList = Array.isArray(posts) ? posts : [];

  const selectedPost = useMemo(
    () =>
      postList.find(
        (post) => String(post.ID) === String(value)
      ) ?? null,
    [postList, value]
  );

  const selectedText =
    String(value ?? "%") === "%"
      ? t("Common.All", "Все")
      : selectedPost?.Name ?? "";

  const [text, setText] = useState(selectedText);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setText(selectedText);
  }, [selectedText]);

  useEffect(() => {
    function handleDocumentMouseDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
        setText(selectedText);
      }
    }

    document.addEventListener("mousedown", handleDocumentMouseDown);

    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
    };
  }, [selectedText]);

  const searchText = normalizeSearchText(text);
  const selectedSearchText = normalizeSearchText(selectedText);

  // Пока в поле находится полное название выбранного поставщика,
  // при открытии показываем весь список. После ввода букв фильтруем с начала строки.
  const prefix =
    searchText === selectedSearchText
      ? ""
      : searchText;

  const filteredPosts = useMemo(() => {
    return [...postList]
      .filter((post) =>
        normalizeSearchText(post.Name).startsWith(prefix)
      )
      .sort((a, b) =>
        String(a.Name ?? "").localeCompare(
          String(b.Name ?? ""),
          "ru"
        )
      );
  }, [postList, prefix]);

  const showAllOption =
    prefix === "" ||
    normalizeSearchText(t("Common.All", "Все")).startsWith(prefix);

  function choose(postValue, postName) {
    setText(postName);
    setOpen(false);
    onChange?.(String(postValue));
  }

  function restoreSelection() {
    setText(selectedText);
    setOpen(false);
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      restoreSelection();
      return;
    }

    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();

    if (showAllOption && prefix === normalizeSearchText(t("Common.All", "Все"))) {
      choose("%", t("Common.All", "Все"));
      return;
    }

    const exactPost = filteredPosts.find(
      (post) =>
        normalizeSearchText(post.Name) === prefix
    );

    if (exactPost) {
      choose(exactPost.ID, exactPost.Name);
      return;
    }

    if (filteredPosts.length === 1) {
      choose(filteredPosts[0].ID, filteredPosts[0].Name);
    }
  }

  return (
    <div
      className="searchable-select prih-post-search"
      ref={rootRef}
    >
      <input
        type="text"
        value={text}
        placeholder={t("PrihList.SupplierSearchPlaceholder", "Начните вводить поставщика")}
        autoComplete="off"
        onFocus={(event) => {
          setOpen(true);
          event.currentTarget.select();
        }}
        onChange={(event) => {
          setText(event.target.value);
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        aria-label={t("PrihList.SupplierSearchAria", "Поиск поставщика")}
        aria-expanded={open}
      />

      {open && (
        <div className="searchable-select-list">
          {showAllOption && (
            <button
              type="button"
              className="searchable-select-option muted"
              onMouseDown={(event) => {
                event.preventDefault();
                choose("%", t("Common.All", "Все"));
              }}
            >
              {t("Common.All", "Все")}
            </button>
          )}

          {filteredPosts.map((post) => (
            <button
              key={post.ID}
              type="button"
              className="searchable-select-option"
              onMouseDown={(event) => {
                event.preventDefault();
                choose(post.ID, post.Name);
              }}
            >
              {post.Name}
            </button>
          ))}

          {!showAllOption && filteredPosts.length === 0 && (
            <div className="searchable-select-empty">
              {t("PrihList.SupplierNotFound", "Поставщик не найден")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PrihListPage({
  data,
  period,
  posts,
  filterPost,
  date1,
  date2,
  pfMode = false,
  readOnly = false,
  selectedInvoiceId,
  onSelectInvoice,
  onChangePost,
  onChangeDate1,
  onChangeDate2,
  onChangePf,
  onOpenInvoice,
  onCreateInvoice,
  onCreateProduction,
  onCreateZach,
  onImportFile,
  onApply,
  t = (key, fallback = "") => fallback
}) {
  const rows = Array.isArray(data) ? data : [];
  const listRootRef = useRef(null);
  const fileInputRef = useRef(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(
    Number(selectedInvoiceId || 0) || null
  );

  const displayDate1 = normalizeDateInputValue(
    date1 || period?.Date1
  );
  const displayDate2 = normalizeDateInputValue(
    date2 || period?.Date2
  );

  const selectedRow =
    rows.find(
      (row) => Number(row.ID) === Number(selectedId)
    ) ?? null;

  function openSelectedInvoice() {
    if (!selectedRow) return;
    onOpenInvoice?.(selectedRow);
  }

  useEffect(() => {
    const targetId = Number(selectedInvoiceId || 0);

    if (!targetId) {
      return;
    }

    setSelectedId(targetId);

    const frameId = window.requestAnimationFrame(() => {
      const row = listRootRef.current?.querySelector(
        `[data-invoice-id="${targetId}"]`
      );

      row?.scrollIntoView({
        block: "nearest",
        inline: "nearest"
      });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [selectedInvoiceId, rows]);

  function selectInvoice(invoiceId) {
    const numericId = Number(invoiceId || 0) || null;

    setSelectedId(numericId);
    onSelectInvoice?.(numericId);
  }

  function focusInvoiceRow(invoiceId) {
    window.requestAnimationFrame(() => {
      const row = listRootRef.current?.querySelector(
        `[data-invoice-id="${Number(invoiceId || 0)}"]`
      );

      if (!(row instanceof HTMLElement)) return;

      row.focus({ preventScroll: true });
      row.scrollIntoView({
        block: "nearest",
        inline: "nearest"
      });
    });
  }

  function handleInvoiceRowKeyDown(event, invoiceId) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    const currentIndex = rows.findIndex(
      (row) => Number(row.ID) === Number(invoiceId)
    );

    if (currentIndex < 0) return;

    // На первой/последней строке стрелку браузеру не отдаём.
    event.preventDefault();

    const direction = event.key === "ArrowDown" ? 1 : -1;
    const nextRow = rows[currentIndex + direction];

    if (!nextRow) return;

    selectInvoice(nextRow.ID);
    focusInvoiceRow(nextRow.ID);
  }

  async function handleImportFileChange(event) {
    const file = event.target.files?.[0] ?? null;

    // Разрешаем повторно выбрать тот же самый файл.
    event.target.value = "";

    if (!file || !onImportFile || fileLoading) {
      return;
    }

    setFileLoading(true);

    try {
      await onImportFile(file);
    } finally {
      setFileLoading(false);
    }
  }

  function chooseImportFile() {
    if (fileLoading) return;
    fileInputRef.current?.click();
  }

  return (
    <div className="prih-list-page" ref={listRootRef}>
      <div className="module-toolbar prih-list-toolbar">
        <div className="toolbar-left">
          <label className="toolbar-field prih-post-field">
            <span>{t("Common.Supplier", "Поставщик")}</span>

            <SupplierSearch
              posts={posts}
              value={String(filterPost ?? "%")}
              onChange={onChangePost}
              t={t}
            />
          </label>

          <label className="toolbar-check prih-pf-toggle">
            <input
              type="checkbox"
              checked={Boolean(pfMode)}
              onChange={(event) => onChangePf?.(event.target.checked)}
            />
            <span>
              {t("PrihList.PfModeLine1", "Зачистки и")}
              <br />
              {t("PrihList.PfModeLine2", "производство")}
            </span>
          </label>

          <label className="toolbar-field">
            <span>{t("Common.DateFrom", "с")}</span>
            <input
              className="toolbar-date"
              type="date"
              value={displayDate1}
              onChange={(event) =>
                onChangeDate1?.(event.target.value)
              }
            />
          </label>

          <label className="toolbar-field">
            <span>{t("Common.DateTo", "по")}</span>
            <input
              className="toolbar-date"
              type="date"
              value={displayDate2}
              min={displayDate1 || undefined}
              onChange={(event) =>
                onChangeDate2?.(event.target.value)
              }
            />
          </label>
        </div>

        <div className="toolbar-right">
          <button
            type="button"
            className="toolbar-save-button prih-apply-button"
            onClick={onApply}
            title={t("PrihList.ApplyDateRangeTitle", "Применить выбранный интервал дат")}
          >
            {t("Common.Apply", "Применить")}
          </button>

          {onOpenInvoice && (
            <button
              type="button"
              className="prih-open-button prih-open-selected-button"
              disabled={!selectedRow}
              onClick={openSelectedInvoice}
              title={t("PrihList.OpenSelectedTitle", "Открыть выбранную накладную")}
            >
              {t("Common.Open", "Открыть")}
            </button>
          )}

          {!readOnly && !pfMode && onImportFile && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xls,.xlsx,.xlsm,.xlsb,.xml"
                hidden
                onChange={handleImportFileChange}
              />

              <button
                type="button"
                className="prih-create-button prih-load-file-button"
                disabled={fileLoading}
                onClick={chooseImportFile}
                title={t(
                  "PrihList.LoadFromFileTitle",
                  "Загрузить приходные накладные из файла"
                )}
              >
                {fileLoading
                  ? t("PrihList.LoadingFile", "Загрузка...")
                  : t("PrihList.LoadFromFile", "Загрузить из файла")}
              </button>
            </>
          )}

          {!readOnly && !pfMode && onCreateInvoice && (
            <button
              type="button"
              className="prih-create-button"
              onClick={onCreateInvoice}
            >
              + {t("PrihList.NewInvoice", "Новая накладная")}
            </button>
          )}

          {!readOnly && pfMode && (
            <>
              <button
                type="button"
                className="prih-create-button prih-create-special-button"
                onClick={onCreateProduction}
              >
                {t("PrihList.NewProductionLine1", "Новая накл.")}
                <br />
                {t("PrihList.NewProductionLine2", "производства")}
              </button>

              <button
                type="button"
                className="prih-create-button prih-create-special-button"
                onClick={onCreateZach}
              >
                {t("PrihList.NewZachLine1", "Новая")}
                <br />
                {t("PrihList.NewZachLine2", "зачистка")}
              </button>
            </>
          )}
        </div>
      </div>

      {rows.length === 0 && (
        <p className="prih-list-empty">{t("PrihList.EmptyMessage", "Приходные накладные не найдены.")}</p>
      )}

      {rows.length > 0 && (
        <div className="table-wrap prih-list-table-wrap">
          <table className="data-table prih-list-table">
            <colgroup>
              <col className="prih-col-invoice" />
              <col className="prih-col-date" />
              <col className="prih-col-sum" />
              <col className="prih-col-supplier" />
              <col className="prih-col-payment" />
              <col className="prih-col-created" />
              <col className="prih-col-updated" />
              <col className="prih-col-paid" />
              <col className="prih-col-return" />
            </colgroup>
            <thead>
              <tr>
                <th>{t("Common.InvoiceNumber", "Номер")}</th>
                <th>{t("Common.Date", "Дата")}</th>
                <th>{t("Common.Amount", "Сумма")}</th>
                <th>{t("Common.Supplier", "Поставщик")}</th>
                <th>{t("PrihList.Payment", "Оплата")}</th>
                <th>{t("PrihList.CreatedBy", "Создал")}</th>
                <th>{t("PrihList.UpdatedBy", "Изменил")}</th>
                <th>{t("PrihList.Paid", "Оплачено")}</th>
                <th>{t("PrihList.Return", "Возврат")}</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.ID}
                  data-invoice-id={Number(row.ID || 0)}
                  className={[
                    Number(selectedId) === Number(row.ID)
                      ? "selected-row"
                      : "",
                    Number(row.Nerasp || 0) > 0
                      ? "prih-has-unrecognized"
                      : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  title={
                    Number(row.Nerasp || 0) > 0
                      ? `${t(
                          "PrihList.UnrecognizedItems",
                          "Нераспознанных товаров"
                        )}: ${Number(row.Nerasp || 0)}`
                      : undefined
                  }
                  tabIndex={
                    Number(selectedId) === Number(row.ID) ? 0 : -1
                  }
                  onKeyDown={(event) =>
                    handleInvoiceRowKeyDown(event, row.ID)
                  }
                  onClick={(event) => {
                    selectInvoice(row.ID);
                    event.currentTarget.focus({ preventScroll: true });
                  }}
                  onDoubleClick={() => {
                    selectInvoice(row.ID);
                    onOpenInvoice?.(row);
                  }}
                >
                  <td>{row.Invoice}</td>
                  <td>{row.DateP}</td>
                  <td className="num">
                    {Number(row.Summ ?? 0).toFixed(2)}
                  </td>
                  <td title={row.NamePost ?? ""}>{row.NamePost}</td>
                  <td title={row.FormaOpl ?? ""}>{row.FormaOpl}</td>
                  <td title={row.Created ?? ""}>{row.Created}</td>
                  <td title={row.Updt ?? ""}>{row.Updt}</td>
                  <td className="center">
                    {row.Oplach ? "✓" : ""}
                  </td>
                  <td className="center">
                    {row.Vozv ? "✓" : ""}
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