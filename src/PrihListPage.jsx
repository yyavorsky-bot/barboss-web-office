import { useEffect, useMemo, useRef, useState } from "react";

function normalizeSearchText(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("ru-RU");
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
  onChangePost,
  onChangeDate1,
  onChangeDate2,
  onOpenInvoice,
  onCreateInvoice,
  onApply
}) {
  const rows = Array.isArray(data) ? data : [];
  const [selectedId, setSelectedId] = useState(null);

  return (
    <div className="prih-list-page">
      <div className="module-toolbar">
        <div className="toolbar-left">
          <label className="toolbar-field prih-post-field">
            <span>Поставщик</span>

            <SupplierSearch
              posts={posts}
              value={String(filterPost ?? "%")}
              onChange={onChangePost}
            />
          </label>

          <label className="toolbar-field">
            <span>с</span>
            <input
              className="toolbar-date"
              type="date"
              value={date1 || period?.Date1 || ""}
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
              value={date2 || period?.Date2 || ""}
              min={date1 || period?.Date1 || undefined}
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

          {onCreateInvoice && (
            <button
              type="button"
              className="prih-create-button"
              onClick={onCreateInvoice}
            >
              + Новая накладная
            </button>
          )}
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
                  className={
                    selectedId === row.ID
                      ? "selected-row"
                      : ""
                  }
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
                      className="small-action-button prih-open-button"
                      onClick={(event) => {
                        event.stopPropagation();
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