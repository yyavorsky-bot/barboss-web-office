import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./order-new.css";

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeNumber(value) {
  const text = String(value ?? "")
    .replace(/\s/g, "")
    .replace(",", ".")
    .trim();

  if (!text) return "0";

  const number = Number(text);
  return Number.isFinite(number) ? String(number) : "0";
}

function parseNumber(value) {
  const number = Number(normalizeNumber(value));
  return Number.isFinite(number) ? number : 0;
}

function numberToInput(value, digits = 2, locale = "ru-RU") {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) return "";

  const decimalSeparator =
    new Intl.NumberFormat(locale)
      .formatToParts(1.1)
      .find((part) => part.type === "decimal")?.value ?? ".";

  return number.toFixed(digits).replace(".", decimalSeparator);
}

function formatNumber(value, locale = "ru-RU", digits = 2) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) return "";

  return number.toLocaleString(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function makeDateTimeForSave(dateValue) {
  const now = new Date();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(dateValue || ""))
    ? String(dateValue)
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
  return `${date} ${time}`;
}

function normalizeList(json, keys = []) {
  if (Array.isArray(json)) return json;

  for (const key of keys) {
    if (Array.isArray(json?.[key])) return json[key];
  }

  return [];
}

function makeDraftRow(id) {
  return {
    ID: id,
    IdTov: 0,
    Name: "",
    SkladName: "",
    Kolvo: "",
    Price: "",
    Summ: 0
  };
}

function SearchableSelect({
  value,
  options = [],
  disabled = false,
  placeholder = "",
  displayField = "Name",
  secondaryField = "",
  onChange,
  onSelectComplete,
  inputRef,
  allowClear = false,
  emptyText = ""
}) {
  const selected = useMemo(
    () => options.find((item) => Number(item?.ID || 0) === Number(value || 0)) || null,
    [options, value]
  );

  const [text, setText] = useState(selected?.[displayField] || "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuStyle, setMenuStyle] = useState(null);
  const innerInputRef = useRef(null);
  const closeTimerRef = useRef(null);

  useEffect(() => {
    setText(selected?.[displayField] || "");
  }, [selected, displayField]);

  const filtered = useMemo(() => {
    const query = text.trim().toLocaleLowerCase();

    const result = query
      ? options.filter((item) => {
          const primary = String(item?.[displayField] ?? "").toLocaleLowerCase();
          const secondary = secondaryField
            ? String(item?.[secondaryField] ?? "").toLocaleLowerCase()
            : "";
          return primary.includes(query) || secondary.includes(query);
        })
      : options;

    return result.slice(0, 100);
  }, [options, text, displayField, secondaryField]);

  useEffect(() => {
    setActiveIndex(0);
  }, [text, open]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  function setRefs(node) {
    innerInputRef.current = node;

    if (typeof inputRef === "function") {
      inputRef(node);
    } else if (inputRef && typeof inputRef === "object") {
      inputRef.current = node;
    }
  }

  function updateMenuPosition() {
    const input = innerInputRef.current;
    if (!input) return;

    const rect = input.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const desiredWidth = Math.max(rect.width, 360);
    const width = Math.min(desiredWidth, Math.max(240, viewportWidth - 16));
    const left = Math.min(
      Math.max(8, rect.left),
      Math.max(8, viewportWidth - width - 8)
    );
    const spaceBelow = viewportHeight - rect.bottom - 10;
    const spaceAbove = rect.top - 10;
    const openAbove = spaceBelow < 190 && spaceAbove > spaceBelow;
    const availableSpace = openAbove ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(130, Math.min(300, availableSpace - 4));

    setMenuStyle({
      position: "fixed",
      zIndex: 10000,
      left,
      width,
      maxHeight,
      ...(openAbove
        ? { top: "auto", bottom: viewportHeight - rect.top + 3 }
        : { top: rect.bottom + 3, bottom: "auto" })
    });
  }

  useEffect(() => {
    if (!open) return undefined;

    updateMenuPosition();
    const handleViewportChange = () => updateMenuPosition();
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open]);

  function choose(item) {
    if (!item) return;

    onChange?.(item);
    setText(String(item?.[displayField] ?? ""));
    setOpen(false);
    onSelectComplete?.(item);
  }

  function restoreSelected() {
    setText(selected?.[displayField] || "");
    setOpen(false);
  }

  const dropdown =
    open &&
    !disabled &&
    menuStyle &&
    typeof document !== "undefined"
      ? createPortal(
          <div
            className="order-new-search-list"
            style={menuStyle}
            onMouseDown={(event) => event.preventDefault()}
          >
            {filtered.map((item, index) => (
              <button
                key={`${String(item?.ID ?? "")}:${index}`}
                type="button"
                className={`order-new-search-option${index === activeIndex ? " active" : ""}`}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(item)}
              >
                <span className="order-new-search-option-name">
                  {String(item?.[displayField] ?? "")}
                </span>
                {secondaryField &&
                  item?.[secondaryField] !== undefined &&
                  String(item?.[secondaryField] ?? "") !== "" && (
                    <small className="order-new-search-option-secondary">
                      {String(item?.[secondaryField] ?? "")}
                    </small>
                  )}
              </button>
            ))}

            {filtered.length === 0 && (
              <div className="order-new-search-empty">{emptyText}</div>
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div className="order-new-search-select">
        <input
          ref={setRefs}
          type="text"
          value={open ? text : selected?.[displayField] || ""}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          onFocus={(event) => {
            setText("");
            setOpen(true);
            window.requestAnimationFrame(updateMenuPosition);
            event.currentTarget.select();
          }}
          onChange={(event) => {
            setText(event.target.value);
            setOpen(true);
            window.requestAnimationFrame(updateMenuPosition);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              if (!open) setOpen(true);
              setActiveIndex((current) =>
                filtered.length === 0 ? 0 : Math.min(current + 1, filtered.length - 1)
              );
              return;
            }

            if (event.key === "ArrowUp") {
              event.preventDefault();
              if (!open) setOpen(true);
              setActiveIndex((current) => Math.max(current - 1, 0));
              return;
            }

            if (event.key === "Enter" && open && filtered.length > 0) {
              event.preventDefault();
              choose(filtered[Math.min(activeIndex, filtered.length - 1)]);
              return;
            }

            if (
              allowClear &&
              (event.key === "Backspace" || event.key === "Delete") &&
              text === "" &&
              selected
            ) {
              event.preventDefault();
              onChange?.(null);
              setText("");
              setOpen(true);
              return;
            }

            if (event.key === "Escape") {
              event.preventDefault();
              restoreSelected();
              event.currentTarget.blur();
            }
          }}
          onBlur={() => {
            closeTimerRef.current = window.setTimeout(restoreSelected, 120);
          }}
        />
      </div>
      {dropdown}
    </>
  );
}

export default function OrderNewPage({
  ordersDate,
  waiterOptions = [],
  login = "",
  fetchWithAuth,
  onBack,
  onSaved,
  onDirtyChange,
  readOnly = false,
  t = (_key, fallback = "") => fallback,
  locale = "ru-RU"
}) {
  const [idOf, setIdOf] = useState(0);
  const [table, setTable] = useState("");
  const [idKlient, setIdKlient] = useState(0);
  const [rem, setRem] = useState("");
  const [clients, setClients] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [dishes, setDishes] = useState([]);
  const [rows, setRows] = useState(() => [makeDraftRow(-1)]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const nextRowIdRef = useRef(-1);
  const dishRefs = useRef({});
  const qtyRefs = useRef({});
  const priceRefs = useRef({});

  const normalizedWaiters = useMemo(() => {
    const map = new Map();
    const source = personnel.length > 0
      ? personnel
      : Array.isArray(waiterOptions)
        ? waiterOptions
        : [];

    for (const item of source) {
      const id = Number(item?.ID ?? item?.IdOfic ?? item?.IdOf ?? item?.id ?? 0);
      const name = String(item?.Name ?? item?.NameOf ?? item?.name ?? "").trim();
      if (id && name && !map.has(id)) map.set(id, { ID: id, Name: name });
    }

    return Array.from(map.values()).sort((a, b) =>
      a.Name.localeCompare(b.Name, locale)
    );
  }, [personnel, waiterOptions, locale]);

  const realRows = useMemo(
    () => rows.filter((row) => Number(row.IdTov || 0) > 0),
    [rows]
  );

  const total = useMemo(
    () => realRows.reduce((sum, row) => sum + Number(row.Summ || 0), 0),
    [realRows]
  );

  const isDirty = useMemo(
    () =>
      !readOnly &&
      Boolean(
        Number(idOf || 0) > 0 ||
          table.trim() ||
          Number(idKlient || 0) > 0 ||
          rem.trim() ||
          realRows.length > 0
      ),
    [readOnly, idOf, table, idKlient, rem, realRows.length]
  );

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    return () => onDirtyChange?.(false);
  }, [onDirtyChange]);

  useEffect(() => {
    function handleBeforeUnload(event) {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    let cancelled = false;

    async function loadJson(url) {
      const response = await fetchWithAuth(url, { method: "GET" });
      const text = await response.text();
      let json;

      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(
          t("OrderNew.ServerNotJson", "Сервер вернул не JSON: ") + text.substring(0, 400)
        );
      }

      if (!response.ok || json?.status === "error") {
        throw new Error(
          json?.message ||
            json?.error ||
            t("OrderNew.LoadReferencesError", "Ошибка загрузки справочников")
        );
      }

      return json;
    }

    async function loadReferenceLists() {
      setLoadingLists(true);
      setError("");

      try {
        const personnelUrl = new URL("https://webback.bar-boss.com/wf_Directory.php");
        personnelUrl.searchParams.set("Action", "Personal");
        personnelUrl.searchParams.set("login", String(login ?? ""));

        const [clientsJson, personnelJson, dishesJson] = await Promise.all([
          loadJson("https://webback.bar-boss.com/wf_CliKass.php"),
          loadJson(personnelUrl.toString()),
          loadJson("https://webback.bar-boss.com/wf_DishesAll.php")
        ]);

        if (cancelled) return;

        setClients(normalizeList(clientsJson, ["Clients", "clients", "data", "items", "Rows", "rows"]));
        setPersonnel(normalizeList(personnelJson, ["Personal", "personal", "data", "items", "Rows", "rows"]));
        setDishes(normalizeList(dishesJson, ["Dishes", "dishes", "data", "items", "Rows", "rows"]));
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError?.message ||
              t("OrderNew.LoadReferencesError", "Ошибка загрузки справочников")
          );
        }
      } finally {
        if (!cancelled) setLoadingLists(false);
      }
    }

    loadReferenceLists();
    return () => {
      cancelled = true;
    };
  }, [fetchWithAuth, login, t]);

  function confirmDiscardChanges() {
    if (!isDirty) return true;

    return window.confirm(
      t(
        "OrderNew.UnsavedChangesWarning",
        "Внимание! Вы не сохранили новый заказ!\nУверены, что хотите уйти?"
      )
    );
  }

  function handleBack() {
    if (!confirmDiscardChanges()) return;
    onDirtyChange?.(false);
    onBack?.();
  }

  function focusRef(refMap, rowId) {
    window.setTimeout(() => {
      const input = refMap.current[rowId];
      input?.focus();
      input?.select?.();
    }, 0);
  }

  function ensureBlankDraft(nextRows) {
    const lastRow = nextRows[nextRows.length - 1];
    if (lastRow && Number(lastRow.IdTov || 0) === 0) return nextRows;

    nextRowIdRef.current -= 1;
    return [...nextRows, makeDraftRow(nextRowIdRef.current)];
  }

  function selectDish(rowId, dish) {
    if (readOnly || !dish) return;

    setRows((previousRows) => {
      const nextRows = previousRows.map((row) => {
        if (Number(row.ID) !== Number(rowId)) return row;

        const price = numberToInput(dish.Price ?? 0, 2, locale);
        const quantity = row.Kolvo;

        return {
          ...row,
          IdTov: Number(dish.ID || 0),
          Name: String(dish.Name || ""),
          SkladName: String(dish.SkladName || ""),
          Price: price,
          Summ: parseNumber(quantity) * parseNumber(price)
        };
      });

      return ensureBlankDraft(nextRows);
    });

    focusRef(qtyRefs, rowId);
  }

  function updateRow(rowId, field, value) {
    if (readOnly) return;

    setRows((previousRows) =>
      previousRows.map((row) => {
        if (Number(row.ID) !== Number(rowId)) return row;
        const next = { ...row, [field]: value };

        if (field === "Kolvo" || field === "Price") {
          next.Summ = parseNumber(next.Kolvo) * parseNumber(next.Price);
        }

        return next;
      })
    );
  }

  function focusNextDish(rowId) {
    const currentIndex = rows.findIndex((row) => Number(row.ID) === Number(rowId));
    if (currentIndex < 0) return;

    const nextRow = rows[currentIndex + 1];
    if (nextRow) focusRef(dishRefs, nextRow.ID);
  }

  function buildSaveXml() {
    const items = realRows
      .map(
        (row) =>
          `<Item ID="${Number(row.ID || 0)}" IdTov="${Number(row.IdTov || 0)}" Kolvo="${escapeXml(normalizeNumber(row.Kolvo))}" Price="${escapeXml(normalizeNumber(row.Price))}" Summ="${escapeXml(normalizeNumber(row.Summ))}" Discount="0" Bel="0" Anul="0" />`
      )
      .join("");

    return (
      `<Zakaz ID="0">` +
      `<Header IdOf="${Number(idOf || 0)}" DatOp="${escapeXml(makeDateTimeForSave(ordersDate))}" IdSkid="0" IdKlient="${Number(idKlient || 0)}" Table="${escapeXml(table.trim())}" Rem="${escapeXml(rem.trim())}" ProcObsl="0" Dolg="0" Anul="0" />` +
      `<Items>${items}</Items>` +
      `</Zakaz>`
    );
  }

  function validateBeforeSave() {
    if (!Number(idOf || 0)) {
      return t("OrderNew.WaiterRequired", "Выберите официанта");
    }

    if (!table.trim()) {
      return t("OrderNew.TableRequired", "Укажите стол");
    }

    if (realRows.length === 0) {
      return t("OrderNew.ItemsRequired", "Добавьте хотя бы одно блюдо");
    }

    for (const row of realRows) {
      if (parseNumber(row.Kolvo) <= 0) {
        return t("OrderNew.QuantityRequired", "Количество блюда должно быть больше нуля");
      }

      if (!String(row.Price ?? "").trim()) {
        return t("OrderNew.PriceRequired", "Укажите цену блюда");
      }
    }

    return "";
  }

  async function saveOrder() {
    if (readOnly || saving) return;

    const validationError = validateBeforeSave();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");

    try {
      const body = new URLSearchParams();
      body.set("Action", "SaveZakazNew");
      body.set("xml", buildSaveXml());

      const response = await fetchWithAuth(
        "https://webback.bar-boss.com/wf_RefSave.php",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
          },
          body
        }
      );

      const text = await response.text();
      let json = null;

      try {
        json = JSON.parse(text);
      } catch {}

      if (!response.ok || json?.status === "error") {
        throw new Error(
          json?.message ||
            json?.error ||
            text ||
            t("OrderNew.SaveError", "Ошибка сохранения нового заказа")
        );
      }

      onDirtyChange?.(false);
      await onSaved?.(json || text);
    } catch (saveError) {
      setError(
        saveError?.message ||
          t("OrderNew.SaveError", "Ошибка сохранения нового заказа")
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="order-new-page">
      <div className="order-new-topbar form-header-panel">
        <button
          type="button"
          className="back-to-list-button prih-back-button"
          onClick={handleBack}
        >
          {t("OrderNew.BackToOrders", "← К списку заказов")}
        </button>

        <div className="order-new-title">
          <strong>{t("OrderNew.Title", "Новый заказ")}</strong>
        </div>

        {!readOnly && (
          <button
            type="button"
            className="save-button save-button-active order-new-save-button"
            disabled={saving || loadingLists}
            onClick={saveOrder}
          >
            {saving
              ? t("OrderNew.Saving", "Сохранение...")
              : t("OrderNew.Save", "Сохранить")}
          </button>
        )}
      </div>

      {readOnly && (
        <div className="readonly-notice">
          {t("OrderNew.ReadOnlyNotice", "Режим только чтение: создание заказа недоступно.")}
        </div>
      )}

      {loadingLists && (
        <div className="order-new-hint">
          {t("OrderNew.LoadingReferences", "Загрузка справочников...")}
        </div>
      )}

      {error && <div className="form-error order-new-error">{error}</div>}

      <section className="order-new-header-card">
        <div className="order-new-header-grid">
          <label className="order-new-field">
            <span>{t("OrderNew.Waiter", "Официант")} *</span>
            <select
              value={idOf}
              disabled={readOnly}
              onChange={(event) => setIdOf(Number(event.target.value || 0))}
            >
              <option value="0">{t("OrderNew.NotSelected", "Не выбран")}</option>
              {normalizedWaiters.map((item) => (
                <option key={item.ID} value={item.ID}>
                  {item.Name}
                </option>
              ))}
            </select>
          </label>

          <label className="order-new-field order-new-table-field">
            <span>{t("OrderNew.Table", "Стол")} *</span>
            <input
              value={table}
              disabled={readOnly}
              onChange={(event) => setTable(event.target.value)}
            />
          </label>

          <label className="order-new-field order-new-client-field">
            <span>{t("OrderNew.Client", "Клиент")}</span>
            <SearchableSelect
              value={idKlient}
              options={clients}
              disabled={readOnly}
              placeholder={t("OrderNew.SearchClient", "Начните вводить клиента...")}
              allowClear
              onChange={(item) => setIdKlient(Number(item?.ID || 0))}
              emptyText={t("OrderNew.NothingFound", "Ничего не найдено")}
            />
          </label>

          <label className="order-new-field order-new-note-field">
            <span>{t("OrderNew.Note", "Примечание")}</span>
            <input
              value={rem}
              disabled={readOnly}
              onChange={(event) => setRem(event.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="order-new-body-card">
        <div className="order-new-body-title">
          <strong>{t("OrderNew.Realization", "Реализация")}</strong>
          <span>
            {t("OrderNew.Total", "Итого")}: {formatNumber(total, locale)}
          </span>
        </div>

        <div className="table-wrap order-new-table-wrap">
          <table className="data-table order-new-table">
            <colgroup>
              <col className="order-new-col-dish" />
              <col className="order-new-col-qty" />
              <col className="order-new-col-price" />
              <col className="order-new-col-sum" />
            </colgroup>
            <thead>
              <tr>
                <th>{t("OrderNew.DishName", "Наименование блюда")}</th>
                <th>{t("OrderNew.Quantity", "Количество")}</th>
                <th>{t("OrderNew.Price", "Цена")}</th>
                <th>{t("OrderNew.Amount", "Сумма")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isDraft = Number(row.IdTov || 0) === 0;

                return (
                  <tr key={row.ID} className={!isDraft ? "changed-row" : "order-new-draft-row"}>
                    <td>
                      <SearchableSelect
                        value={row.IdTov}
                        options={dishes}
                        disabled={readOnly}
                        placeholder={t("OrderNew.SearchDish", "Начните вводить блюдо...")}
                        secondaryField="SkladName"
                        inputRef={(input) => {
                          if (input) dishRefs.current[row.ID] = input;
                          else delete dishRefs.current[row.ID];
                        }}
                        onChange={(dish) => selectDish(row.ID, dish)}
                        emptyText={t("OrderNew.NothingFound", "Ничего не найдено")}
                      />
                    </td>
                    <td>
                      <input
                        ref={(input) => {
                          if (input) qtyRefs.current[row.ID] = input;
                          else delete qtyRefs.current[row.ID];
                        }}
                        className="table-input text-right"
                        value={row.Kolvo}
                        disabled={readOnly || isDraft}
                        inputMode="decimal"
                        onChange={(event) => updateRow(row.ID, "Kolvo", event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            focusRef(priceRefs, row.ID);
                          }
                        }}
                      />
                    </td>
                    <td>
                      <input
                        ref={(input) => {
                          if (input) priceRefs.current[row.ID] = input;
                          else delete priceRefs.current[row.ID];
                        }}
                        className="table-input text-right"
                        value={row.Price}
                        disabled={readOnly || isDraft}
                        inputMode="decimal"
                        onChange={(event) => updateRow(row.ID, "Price", event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            focusNextDish(row.ID);
                          }
                        }}
                      />
                    </td>
                    <td className="text-right">
                      {isDraft ? "" : formatNumber(row.Summ, locale)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {realRows.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan="3">{t("OrderNew.Total", "Итого")}</td>
                  <td className="text-right">{formatNumber(total, locale)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </div>
  );
}
