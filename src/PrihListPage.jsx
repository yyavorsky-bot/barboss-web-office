import { useEffect, useMemo, useRef, useState } from "react";

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
  onChange
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
      ? "Все"
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
    normalizeSearchText("Все").startsWith(prefix);

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

    if (showAllOption && prefix === normalizeSearchText("Все")) {
      choose("%", "Все");
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
        placeholder="Начните вводить поставщика"
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
        aria-label="Поиск поставщика"
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
                choose("%", "Все");
              }}
            >
              Все
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
              Поставщик не найден
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
  onApply,
  t = (key, fallback = "") => fallback
}) {
  const rows = Array.isArray(data) ? data : [];
  const listRootRef = useRef(null);
  const [selectedId, setSelectedId] = useState(
    Number(selectedInvoiceId || 0) || null
  );

  const displayDate1 = normalizeDateInputValue(
    date1 || period?.Date1
  );
  const displayDate2 = normalizeDateInputValue(
    date2 || period?.Date2
  );

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

  return (
    <div className="prih-list-page" ref={listRootRef}>
      <div className="module-toolbar prih-list-toolbar">
        <div className="toolbar-left">
          <label className="toolbar-field prih-post-field">
            <span>Поставщик</span>

            <SupplierSearch
              posts={posts}
              value={String(filterPost ?? "%")}
              onChange={onChangePost}
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
            <span>с</span>
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
            <span>по</span>
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
            title="Применить выбранный интервал дат"
          >
            Применить
          </button>

          {!pfMode && onCreateInvoice && (
            <button
              type="button"
              className="prih-create-button"
              onClick={onCreateInvoice}
            >
              + Новая накладная
            </button>
          )}

          {pfMode && (
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
        <p className="prih-list-empty">Приходные накладные не найдены.</p>
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
              <col className="prih-col-action" />
            </colgroup>
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
                  data-invoice-id={Number(row.ID || 0)}
                  className={
                    Number(selectedId) === Number(row.ID)
                      ? "selected-row"
                      : ""
                  }
                  onClick={() => selectInvoice(row.ID)}
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
                  <td className="center">
                    <button
                      type="button"
                      className="small-action-button prih-open-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        selectInvoice(row.ID);
                        onOpenInvoice?.(row);
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