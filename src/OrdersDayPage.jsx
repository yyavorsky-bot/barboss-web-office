import { useEffect, useMemo, useRef, useState } from "react";
import "./orders-day-row-visual-fix.css";

function formatDateForInput(value) {
  if (!value) return "";
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const dot = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (dot) return `${dot[3]}-${dot[2]}-${dot[1]}`;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDateForApi(value) {
  if (!value) return "";
  const text = String(value).trim();
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(text)) return text;
  const [year, month, day] = text.split("-");
  if (!year || !month || !day) return text;
  return `${day}.${month}.${year}`;
}

function addDays(value, delta) {
  const input = formatDateForInput(value) || new Date().toISOString().slice(0, 10);
  const [year, month, day] = input.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + delta);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatTime(value) {
  if (!value) return "";
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2} /.test(text)) return text.split(" ")[1]?.slice(0, 5) || "";
  return text;
}

function formatDateTime(value) {
  if (!value) return "";
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2} /.test(text)) {
    const [datePart, timePart = ""] = text.split(" ");
    const [year, month, day] = datePart.split("-");
    return `${day}.${month}.${year} ${timePart.slice(0, 5)}`;
  }
  return text;
}

function formatNumber(value, locale = "ru-RU", digits = 2) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function normalizeFilterValue(value) {
  if (value === null || value === undefined || value === "") return "";
  return String(value);
}

function getKassLabel(value, t) {
  const text = normalizeFilterValue(value);
  return text || t("OrdersDay.NotSpecified", "Не указана");
}

function uniqueOptions(items, locale = "ru-RU") {
  const map = new Map();
  for (const item of items) {
    if (!map.has(item.value)) map.set(item.value, item);
  }
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, locale));
}

// NEW ORDER FIX 2026-08-24: direct add-order click + visible inline button color.
export default function OrdersDayPage({
  data,
  ordersDate,
  onDateChange,
  onReload,
  onViewOrder,
  onAddOrder,
  readOnly = false,
  t = (key, fallback = "") => fallback,
  locale = "ru-RU"
}) {
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [ofFilter, setOfFilter] = useState("%");
  const [kassFilter, setKassFilter] = useState("%");
  const ordersDateInputRef = useRef(null);
  const ordersListWrapRef = useRef(null);
  const dateChangeHandlerRef = useRef(onDateChange);

  useEffect(() => {
    dateChangeHandlerRef.current = onDateChange;
  }, [onDateChange]);

  useEffect(() => {
    const input = ordersDateInputRef.current;
    if (!input) return undefined;

    // Edge/Chromium: React onChange для input[type=date] может срабатывать
    // при навигации по месяцам внутри popup. Нативный change приходит после
    // фактического выбора даты, поэтому форма не перерисовывается раньше времени.
    const handleNativeChange = () => {
      dateChangeHandlerRef.current?.(input.value);
    };

    input.addEventListener("change", handleNativeChange);

    return () => {
      input.removeEventListener("change", handleNativeChange);
    };
  }, []);

  useEffect(() => {
    const input = ordersDateInputRef.current;
    if (!input) return;

    const nextValue = formatDateForInput(ordersDate);
    if (input.value !== nextValue) {
      input.value = nextValue;
    }
  }, [ordersDate]);

  useEffect(() => {
    const list = Array.isArray(data) ? data : [];
    setOrders(list);
    setSelectedOrderId(list.length > 0 ? Number(list[0].ID || 0) : null);
    setOfFilter("%");
    setKassFilter("%");
  }, [data]);

  const ofOptions = useMemo(
    () =>
      uniqueOptions(
        orders
          .filter((order) => order.NameOf)
          .map((order) => ({ value: String(order.NameOf), label: String(order.NameOf) })),
        locale
      ),
    [orders, locale]
  );

  const kassOptions = useMemo(
    () =>
      uniqueOptions(
        orders
          .filter((order) => normalizeFilterValue(order.Kass))
          .map((order) => ({
            value: normalizeFilterValue(order.Kass),
            label: getKassLabel(order.Kass, t)
          })),
        locale
      ),
    [orders, t, locale]
  );

  const visibleOrders = useMemo(() => {
    return orders.filter((order) => {
      const ofOk = ofFilter === "%" || String(order.NameOf || "") === ofFilter;
      const kassOk = kassFilter === "%" || normalizeFilterValue(order.Kass) === kassFilter;
      return ofOk && kassOk;
    });
  }, [orders, ofFilter, kassFilter]);

  useEffect(() => {
    if (visibleOrders.length === 0) {
      setSelectedOrderId(null);
      return;
    }

    const exists = visibleOrders.some((order) => Number(order.ID) === Number(selectedOrderId));
    if (!exists) setSelectedOrderId(Number(visibleOrders[0].ID || 0));
  }, [visibleOrders, selectedOrderId]);

  const selectedOrder = useMemo(
    () => visibleOrders.find((order) => Number(order.ID) === Number(selectedOrderId)) || null,
    [visibleOrders, selectedOrderId]
  );

  const totals = useMemo(() => {
    return visibleOrders.reduce(
      (acc, order) => {
        acc.count += 1;
        acc.summ += Number(order.Summ || 0);
        acc.summSk += Number(order.SummSk || 0);
        acc.cash += Number(order.Cash || 0);
        acc.dolg += Number(order.SummDolg || 0);
        acc.kred += Number(order.SumKred || 0);
        acc.bon += Number(order.SumBon || 0);
        acc.mono += Number(order.SumMono || 0);
        acc.tallons += Number(order.Tallons || 0);
        return acc;
      },
      { count: 0, summ: 0, summSk: 0, cash: 0, dolg: 0, kred: 0, bon: 0, mono: 0, tallons: 0 }
    );
  }, [visibleOrders]);

  function focusOrderRow(orderId) {
    window.requestAnimationFrame(() => {
      const row = ordersListWrapRef.current?.querySelector(
        `[data-order-id="${Number(orderId || 0)}"]`
      );

      if (!(row instanceof HTMLElement)) return;

      row.focus({ preventScroll: true });
      row.scrollIntoView({
        block: "nearest",
        inline: "nearest"
      });
    });
  }

  function handleOrderRowKeyDown(event, orderId) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    const currentIndex = visibleOrders.findIndex(
      (order) => Number(order.ID) === Number(orderId)
    );

    if (currentIndex < 0) return;

    // Стрелки работают только по видимому после фильтров списку заказов.
    event.preventDefault();

    const direction = event.key === "ArrowDown" ? 1 : -1;
    const nextOrder = visibleOrders[currentIndex + direction];

    if (!nextOrder) return;

    setSelectedOrderId(Number(nextOrder.ID || 0));
    focusOrderRow(nextOrder.ID);
  }

  function shiftDate(delta) {
    onDateChange?.(addDays(ordersDate, delta));
  }

  return (
    <div className="orders-day-page orders-day-view-page">
      <div className="module-toolbar orders-day-toolbar orders-day-main-toolbar">
        <div className="toolbar-left">
          <button type="button" className="small-action-button orders-day-date-nav-button" onClick={() => shiftDate(-1)} title={t("OrdersDay.PreviousDay", "Предыдущий день")}>
            ←
          </button>

          <label className="toolbar-field">
            {t("OrdersDay.Date", "Дата")}
            <input
              ref={ordersDateInputRef}
              type="date"
              className="toolbar-date orders-day-date-input"
              defaultValue={formatDateForInput(ordersDate)}
              onKeyDown={(event) => {
                if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                  event.preventDefault();
                }
              }}
            />
          </label>

          <button type="button" className="small-action-button orders-day-date-nav-button" onClick={() => shiftDate(1)} title={t("OrdersDay.NextDay", "Следующий день")}>
            →
          </button>

          <label className="toolbar-field">
            {t("OrdersDay.Waiter", "Официант")}
            <select className="orders-day-filter-select" value={ofFilter} onChange={(event) => setOfFilter(event.target.value)}>
              <option value="%">{t("OrdersDay.All", "Все")}</option>
              {ofOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="toolbar-field">
            {t("OrdersDay.CashRegister", "Касса")}
            <select className="orders-day-filter-select" value={kassFilter} onChange={(event) => setKassFilter(event.target.value)}>
              <option value="%">{t("OrdersDay.All", "Все")}</option>
              {kassOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <button type="button" className="small-action-button orders-day-refresh-button" onClick={onReload}>
            {t("OrdersDay.Refresh", "Обновить")}
          </button>

          {!readOnly && (
            <button
              type="button"
              className="small-action-button orders-day-view-button orders-day-add-button"
              style={{
                background: "linear-gradient(135deg, #72b0a8 0%, #4f8a83 100%)",
                boxShadow: "0 5px 12px rgba(46, 102, 95, 0.18)"
              }}
              onClick={onAddOrder}
            >
              {t("OrdersDay.AddOrder", "Добавить заказ")}
            </button>
          )}

          <button
            type="button"
            className="primary-button orders-day-view-button"
            disabled={!selectedOrder}
            title={selectedOrder ? t("OrdersDay.OpenOrderHint", "Открыть просмотр заказа") : t("OrdersDay.SelectOrderHint", "Выберите заказ")}
            onClick={() => {
              if (selectedOrder) {
                onViewOrder?.(selectedOrder);
              }
            }}
          >
            {t("OrdersDay.View", "Просмотр")}
          </button>
        </div>

        <div className="toolbar-right orders-day-summary">
          <span>{t("OrdersDay.Orders", "Заказов")}: {totals.count}</span>
          <span>{t("OrdersDay.Amount", "Сумма")}: {formatNumber(totals.summ, locale)}</span>
          <span>{t("OrdersDay.AmountWithDiscount", "С уч. скидки")}: {formatNumber(totals.summSk, locale)}</span>
        </div>
      </div>

      <div className="orders-day-layout">
        <section className="orders-day-list-panel orders-day-panel">
          <div className="table-wrap orders-day-list-wrap" ref={ordersListWrapRef}>
            <table className="data-table orders-day-table">
              <colgroup>
                <col className="orders-col-time" />
                <col className="orders-col-table" />
                <col className="orders-col-number" />
                <col className="orders-col-client" />
                <col className="orders-col-discount" />
                <col className="orders-col-sum" />
                <col className="orders-col-sumsk" />
                <col className="orders-col-avans" />
                <col className="orders-col-waiter" />
                <col className="orders-col-guests" />
                <col className="orders-col-kass" />
                <col className="orders-col-cash" />
                <col className="orders-col-debt" />
                <col className="orders-col-kred" />
                <col className="orders-col-bon" />
                <col className="orders-col-mono" />
                <col className="orders-col-tallons" />
                <col className="orders-col-updt" />
              </colgroup>

              <thead>
                <tr>
                  <th>{t("OrdersDay.Time", "Время")}</th>
                  <th>{t("OrdersDay.Table", "Стол")}</th>
                  <th>{t("OrdersDay.Number", "№")}</th>
                  <th>{t("OrdersDay.Client", "Клиент")}</th>
                  <th>{t("OrdersDay.Discount", "Скидка")}</th>
                  <th>{t("OrdersDay.Amount", "Сумма")}</th>
                  <th>{t("OrdersDay.AmountWithDiscount", "С уч. скидки")}</th>
                  <th>{t("OrdersDay.Advance", "Аванс")}</th>
                  <th>{t("OrdersDay.Waiter", "Официант")}</th>
                  <th>{t("OrdersDay.Guests", "Гости")}</th>
                  <th>{t("OrdersDay.CashRegister", "Касса")}</th>
                  <th>{t("OrdersDay.Cash", "Нал.")}</th>
                  <th>{t("OrdersDay.Debt", "Долг")}</th>
                  <th>{t("OrdersDay.Credit", "Кред.")}</th>
                  <th>{t("OrdersDay.Bonus", "Бон.")}</th>
                  <th>Mono</th>
                  <th>{t("OrdersDay.Coupons", "Талоны")}</th>
                  <th>{t("OrdersDay.Updated", "Обн.")}</th>
                </tr>
              </thead>

              <tbody>
                {visibleOrders.map((order) => (
                  <tr
                    key={order.ID}
                    data-order-id={Number(order.ID || 0)}
                    className={Number(order.ID) === Number(selectedOrderId) ? "selected-row" : ""}
                    tabIndex={Number(order.ID) === Number(selectedOrderId) ? 0 : -1}
                    onKeyDown={(event) => handleOrderRowKeyDown(event, order.ID)}
                    onClick={(event) => {
                      setSelectedOrderId(Number(order.ID || 0));
                      event.currentTarget.focus({ preventScroll: true });
                    }}
                  >
                    <td>{formatTime(order.DatOp)}</td>
                    <td>{order.Table || ""}</td>
                    <td className="text-right">{order.Number || ""}</td>
                    <td title={order.Klient || ""}>{order.Klient || ""}</td>
                    <td>{order.Discount || ""}</td>
                    <td className="text-right">{formatNumber(order.Summ, locale)}</td>
                    <td className="text-right">{formatNumber(order.SummSk, locale)}</td>
                    <td className="text-right">{formatNumber(order.Avans, locale)}</td>
                    <td title={order.NameOf || ""}>{order.NameOf || ""}</td>
                    <td className="text-right">{order.Guests || ""}</td>
                    <td title={getKassLabel(order.Kass, t)}>{getKassLabel(order.Kass, t)}</td>
                    <td className="text-right">{formatNumber(order.Cash, locale)}</td>
                    <td className="text-right">{formatNumber(order.SummDolg, locale)}</td>
                    <td className="text-right">{formatNumber(order.SumKred, locale)}</td>
                    <td className="text-right">{formatNumber(order.SumBon, locale)}</td>
                    <td className="text-right">{formatNumber(order.SumMono, locale)}</td>
                    <td className="text-right">{formatNumber(order.Tallons, locale)}</td>
                    <td title={order.Updt || ""}>{order.Updt || ""}</td>
                  </tr>
                ))}

                {visibleOrders.length === 0 && (
                  <tr>
                    <td colSpan="18" className="empty-cell orders-day-empty-row">
                      {t("OrdersDay.NoOrders", "Заказов за выбранный день нет")}
                    </td>
                  </tr>
                )}
              </tbody>

              {visibleOrders.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan="5">{t("OrdersDay.Total", "Итого")}</td>
                    <td className="text-right">{formatNumber(totals.summ, locale)}</td>
                    <td className="text-right">{formatNumber(totals.summSk, locale)}</td>
                    <td></td>
                    <td></td>
                    <td className="text-right">{totals.count}</td>
                    <td></td>
                    <td className="text-right">{formatNumber(totals.cash, locale)}</td>
                    <td className="text-right">{formatNumber(totals.dolg, locale)}</td>
                    <td className="text-right">{formatNumber(totals.kred, locale)}</td>
                    <td className="text-right">{formatNumber(totals.bon, locale)}</td>
                    <td className="text-right">{formatNumber(totals.mono, locale)}</td>
                    <td className="text-right">{formatNumber(totals.tallons, locale)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>

        <section className="orders-day-items-panel orders-day-panel">
          <div className="orders-day-items-title">
            <strong>{t("OrdersDay.OrderComposition", "Состав заказа (первые 5 блюд)")}{selectedOrder ? ` №${selectedOrder.Number || ""}` : ""}</strong>

          </div>

          <div className="table-wrap orders-day-items-wrap">
            <table className="data-table orders-day-items-table">
              <colgroup>
                <col className="orders-items-col-dish" />
                <col className="orders-items-col-department" />
                <col className="orders-items-col-qty" />
                <col className="orders-items-col-price" />
                <col className="orders-items-col-amount" />
                <col className="orders-items-col-check" />
                <col className="orders-items-col-check" />
                <col className="orders-items-col-check" />
                <col className="orders-items-col-time" />
              </colgroup>

              <thead>
                <tr>
                  <th>{t("OrdersDay.Dish", "Блюдо")}</th>
                  <th>{t("OrdersDay.Department", "Подразд.")}</th>
                  <th>{t("OrdersDay.Quantity", "Кол-во")}</th>
                  <th>{t("OrdersDay.Price", "Цена")}</th>
                  <th>{t("OrdersDay.Amount", "Сумма")}</th>
                  <th>{t("OrdersDay.BelAbbr", "Бел.")}</th>
                  <th>{t("OrdersDay.AnulAbbr", "Анн.")}</th>
                  <th>{t("OrdersDay.PerebrAbbr", "Перебр.")}</th>
                  <th>{t("OrdersDay.Time", "Время")}</th>
                </tr>
              </thead>

              <tbody>
                {(selectedOrder?.Items || []).map((item, index) => (
                  <tr key={`${selectedOrder.ID}-${index}`}>
                    <td title={item.NameB || ""}>{item.NameB || ""}</td>
                    <td title={item.Podrazd || ""}>{item.Podrazd || ""}</td>
                    <td className="text-right">{formatNumber(item.Kolv, locale)}</td>
                    <td className="text-right">{formatNumber(item.Cena, locale)}</td>
                    <td className="text-right">{formatNumber(item.Summ, locale)}</td>
                    <td className="center">
                      <input type="checkbox" checked={Boolean(item.Bel)} readOnly />
                    </td>
                    <td className="center">
                      <input type="checkbox" checked={Boolean(item.Anul)} readOnly />
                    </td>
                    <td className="center">
                      <input type="checkbox" checked={Boolean(item.Perebr)} readOnly />
                    </td>
                    <td>{formatTime(item.DatBeg)}</td>
                  </tr>
                ))}

                {(!selectedOrder || !Array.isArray(selectedOrder.Items) || selectedOrder.Items.length === 0) && (
                  <tr>
                    <td colSpan="9" className="empty-cell orders-day-empty-row">
                      {t("OrdersDay.SelectOrderInList", "Выберите заказ в списке")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}