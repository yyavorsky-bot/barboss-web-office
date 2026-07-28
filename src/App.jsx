import { useState, useEffect, useMemo } from "react";
import {
  loginRequest,
  menuRequest,
  loadPodrazd,
  loadOrganizations,
  loadGroups,
  loadCeh,
  loadFop,
  loadTypDish,
  loadDishFilterGroups,
  loadPostav,
  loadCategor
} from "./api";
import LoginPage from "./LoginPage";
import DishesPage from "./DishesPage";
import PrihListPage from "./PrihListPage";
import CardsSiryaPage from "./CardsSiryaPage";
import SpisokTovarovPage from "./SpisokTovarovPage";
import PersonalPage from "./PersonalPage";
import DiscountPage from "./DiscountPage";
import ClientsPage from "./ClientsPage";
import CategoriesPage from "./CategoriesPage";
import FopsPage from "./FopsPage";
import SuppliersPage from "./SuppliersPage";
import GroupsPage from "./GroupsPage";
import PeremListPage from "./PeremListPage";
import SpisanTovListPage from "./SpisanTovListPage";
import SpisanBludListPage from "./SpisanBludListPage";
import DishCalcPage from "./DishCalcPage";
import PrihInvoicePage from "./PrihInvoicePage";
import SpisanTovInvoicePage from "./SpisanTovInvoicePage";
import SpisanBludInvoicePage from "./SpisanBludInvoicePage";
import KassaPage from "./KassaPage";
import PereuchetPage from "./PereuchetPage";
import OrdersDayPage from "./OrdersDayPage";
import SchetViewPage from "./SchetViewPage";
import "./styles.css";

function MenuItem({ item, level = 0, onSelect }) {
  const [isOpen, setIsOpen] = useState(false);

  const name = item.name ?? item.Name ?? "";
  const action = item.action ?? item.Action ?? "";
  const items = item.items ?? item.Items ?? [];

  const hasItems = Array.isArray(items) && items.length > 0;
  const hasAction = Boolean(action);

  function handleClick() {
    if (hasItems) {
      setIsOpen((prev) => !prev);
      return;
    }

    if (hasAction) {
      onSelect({ ...item, name, action });
    }
  }

  return (
    <div>
      <button
        className={
          hasItems
            ? "menu-item group"
            : hasAction
              ? "menu-item active"
              : "menu-item disabled"
        }
        style={{ paddingLeft: 12 + level * 18 }}
        disabled={!hasAction && !hasItems}
        onClick={handleClick}
      >
        {hasItems && (
          <span className="menu-arrow">
            {isOpen ? "▾" : "▸"}
          </span>
        )}

        {!hasItems && (
          <span className="menu-arrow empty">
            {" "}
          </span>
        )}

        <span>{name}</span>
      </button>

      {hasItems && isOpen &&
        items.map((child, index) => (
          <MenuItem
            key={`${child.name ?? child.Name}-${index}`}
            item={child}
            level={level + 1}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}
export default function App() {
  const [accessToken, setAccessToken] = useState("");
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [license, setLicense] = useState(null);
  const [menu, setMenu] = useState([]);
  const [selectedAction, setSelectedAction] = useState("");
  const [loading, setLoading] = useState(false);
  const [workData, setWorkData] = useState(null);
  const [workTitle, setWorkTitle] = useState("");
  const [workLoading, setWorkLoading] = useState(false);
  const [workError, setWorkError] = useState("");
  const [sklads, setSklads] = useState([]);
  const [currentSklad, setCurrentSklad] = useState("");
  const [organizations, setOrganizations] = useState([]);
  const [currentOrg, setCurrentOrg] = useState("");
  const [dishGroups, setDishGroups] = useState([]);
  const [cehList, setCehList] = useState([]);
  const [fopList, setFopList] = useState([]);
  const [typDishList, setTypDishList] = useState([]);
  const [dishSkr, setDishSkr] = useState(0);
  const [dishModif, setDishModif] = useState(0);
  const [dishGroup, setDishGroup] = useState("%");
  const [dishFilterGroups, setDishFilterGroups] = useState([]);
  const [postavList, setPostavList] = useState([]);
  const [prihPost, setPrihPost] = useState("%");
  const [prihDate1, setPrihDate1] = useState("");
  const [prihDate2, setPrihDate2] = useState("");
  const [prihPeriod, setPrihPeriod] = useState(null);
  const [siryaCategories, setSiryaCategories] = useState([]);
  const [siryaCat, setSiryaCat] = useState("0");
  const [spisokTovarovCat, setSpisokTovarovCat] = useState("0");
  const [spisokTovarovSkr, setSpisokTovarovSkr] = useState(0);
  const [dishCalcId, setDishCalcId] = useState(null);
  const [prihInvoiceId, setPrihInvoiceId] = useState(null);
  const [discountOptions, setDiscountOptions] = useState([]);
  const [prihInitialData, setPrihInitialData] = useState(null);
  const [prihMode, setPrihMode] = useState("edit");
  const [invoiceKind, setInvoiceKind] = useState("prih");
  const [spisanInitialData, setSpisanInitialData] = useState(null);
  const [spisanBludInitialData, setSpisanBludInitialData] = useState(null);
  const today = new Date().toISOString().slice(0, 10);
  const [kassaDate, setKassaDate] = useState(today);
  const [currentValut, setCurrentValut] = useState(1);
  const [ordersDate, setOrdersDate] = useState(new Date().toISOString().slice(0, 10));
  const [viewOrderId, setViewOrderId] = useState(null);
  const [viewSourceOrder, setViewSourceOrder] = useState(null);

  const ordersWaiterOptions = useMemo(() => {
    const map = new Map();

    if (Array.isArray(workData)) {
      for (const row of workData) {
        const id = Number(row.IdOfic ?? row.IdOf ?? 0);
        const name = row.NameOf || "";

        if (id && name && !map.has(id)) {
          map.set(id, {
            ID: id,
            Name: name
          });
        }
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      a.Name.localeCompare(b.Name, "ru")
    );
  }, [workData]);


useEffect(() => {
}, [currentOrg]);

async function loadGroupsForDishFilter({
  sklad = currentSklad,
  skr = dishSkr,
  modif = dishModif
} = {}) {
  if (!sklad) {
    return;
  }

  const url = new URL("https://webback.bar-boss.com/wf_DishFilterGroups.php");

  url.searchParams.set("Sklad", String(sklad));
  url.searchParams.set("Skr", String(skr));
  url.searchParams.set("Modif", String(modif));

  const response = await fetchWithAuth(url.toString(), {
    method: "GET"
  });

  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      "Группы фильтра блюд вернули не JSON: " + text.substring(0, 300)
    );
  }

  if (!response.ok) {
    throw new Error(data.error || "Ошибка загрузки групп фильтра блюд");
  }

  setDishFilterGroups(Array.isArray(data) ? data : []);
}

function openMoveInvoice(nakl) {
  if (!nakl?.ID) {
    setWorkError("Не найден ID накладной перемещения");
    return;
  }

  setInvoiceKind("move");
  setPrihInvoiceId(Number(nakl.ID));
  setPrihInitialData(null);
  setPrihMode("edit");
  setSelectedAction("prih-invoice-card");
  setWorkTitle("Накладная перемещения");
  setWorkError("");
}

async function createPrihInvoice() {
  try {
    const response = await fetchWithAuth(
      `https://webback.bar-boss.com/wf_PrihNew.php?Sklad=${encodeURIComponent(currentSklad)}`
    );

    const text = await response.text();

    console.log("Pereuchet list response status", response.status);
    console.log("Pereuchet list response url", response.url);
    console.log("Pereuchet list response preview", text.slice(0, 200));

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Новая накладная вернула не JSON: " + text.substring(0, 500));
    }

    const invoice = Array.isArray(data) ? data[0] : data;

    if (!invoice || !invoice.ID) {
      throw new Error("Сервер не вернул ID новой накладной");
    }

    setPrihInvoiceId(Number(invoice.ID));
    setPrihInitialData(invoice);
    setPrihMode("new");
    setSelectedAction("prih-invoice-card");
    setWorkTitle("Новая приходная накладная");
    setWorkError("");  } catch (err) {
    alert(err.message || "Ошибка создания приходной накладной");
  }
}
function openSpisanTovInvoice(spisan) {
  if (!spisan?.ID) {
    setWorkError("Не найден ID накладной списания");
    return;
  }

  setSpisanInitialData(spisan);
  setSelectedAction("spisan-tov-invoice-card");
  setWorkTitle("Накладная списания");
  setWorkError("");
}
async function loadOrdersDay(dateValue = ordersDate) {
  const apiDate = formatDateForApi(dateValue);

  const url =
    `https://webback.bar-boss.com/wf_SpisokZakazov.php` +
    `?Of=%25` +
    `&Dat=${encodeURIComponent(apiDate)}` +
    `&Kass=%25`;

  setSelectedAction("wf_SpisokZakazov.php");
  setWorkTitle("Просмотр заказов за день");
  setWorkLoading(true);
  setWorkError("");
  setWorkData(null);

  try {
    const response = await fetchWithAuth(url, { method: "GET" });
    const text = await response.text();

    let json;

    try {
      json = JSON.parse(text);
    } catch {
      throw new Error("Список заказов вернул не JSON: " + text.substring(0, 500));
    }

    if (!response.ok || json.status === "error") {
      throw new Error(json.message || json.error || "Ошибка загрузки заказов");
    }

    setWorkData(Array.isArray(json) ? json : []);
  } catch (err) {
    setWorkError(err.message || "Ошибка загрузки заказов");
  } finally {
    setWorkLoading(false);
  }
}
function handleOrdersDateChange(newDate) {
  setOrdersDate(newDate);
  loadOrdersDay(newDate);
}

function formatDateForApi(dateValue) {
  if (!dateValue) return "";

  const [year, month, day] = String(dateValue).split("-");

  if (!year || !month || !day) {
    return dateValue;
  }

  return `${day}.${month}.${year}`;
}

function normalizeMenuAction(action) {
  return String(action || "")
    .trim()
    .replace(/^https?:\/\/webback\.bar-boss\.com\//i, "")
    .replace(/^\/+/, "")
    .split("?")[0];
}

function openSchetView(order) {
  if (!order?.ID) {
    setWorkError("Не найден ID заказа для просмотра");
    return;
  }

  setViewOrderId(Number(order.ID));
  setViewSourceOrder(order);
  setSelectedAction("wf_SchetView.php");
  setWorkTitle("Просмотр заказа");
  setWorkLoading(false);
  setWorkError("");
}

function buildMenuActionUrl(action) {
  const text = String(action || "").trim();

  if (/^https?:\/\//i.test(text)) {
    return text;
  }

  return `https://webback.bar-boss.com/${text.replace(/^\/+/, "")}`;
}
async function loadPereuchetList(options = {}) {
  const sklad = options.sklad ?? currentSklad;

  setSelectedAction("wf_SpisokPer.php");
  setWorkTitle("Переучет сырья");
  setWorkLoading(true);
  setWorkError("");
  setWorkData(null);

  try {
    const params = new URLSearchParams({
      Sklad: String(sklad || 1)
    });

    const response = await fetchWithAuth(
      `https://webback.bar-boss.com/wf_SpisokPer.php?${params.toString()}`,
      { method: "GET" }
    );

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      if (text.toLowerCase().includes("<html") || text.toLowerCase().includes("<!doctype")) {
        throw new Error("Список переучетов вернул HTML вместо JSON. Проверьте, что пункт меню обрабатывается через fetchWithAuth и что сессия активна.");
      }

      throw new Error("Список переучетов вернул не JSON: " + text.substring(0, 500));
    }

    if (!response.ok || data.status === "error") {
      throw new Error(data.message || data.error || "Ошибка загрузки списка переучетов");
    }

    setWorkData(Array.isArray(data) ? data : []);
  } catch (err) {
    setWorkError(err.message || "Ошибка загрузки списка переучетов");
  } finally {
    setWorkLoading(false);
  }
}

async function loadKassaPage(date = kassaDate) {
  setSelectedAction("wf_Kassa.php");
  setWorkTitle("Касса");
  setWorkLoading(true);
  setWorkError("");

  try {
    const apiDate = formatDateForApi(date);

    const [
      prihResponse,
      rashodResponse,
      valutsResponse,
      cliKassResponse,
      prihZatrResponse,
      postavKassResponse,
      rashodZatrResponse
    ] = await Promise.all([
      fetchWithAuth(
        `https://webback.bar-boss.com/wf_KassaPrih.php?Date=${apiDate}`
      ),
      fetchWithAuth(
        `https://webback.bar-boss.com/wf_KassaRashod.php?Date=${apiDate}`
      ),
      fetchWithAuth("https://webback.bar-boss.com/wf_Valuts.php"),
      fetchWithAuth("https://webback.bar-boss.com/wf_CliKass.php"),
      fetchWithAuth("https://webback.bar-boss.com/wf_KassPrihZatr.php"),
      fetchWithAuth("https://webback.bar-boss.com/wf_PostavKass.php"),
      fetchWithAuth("https://webback.bar-boss.com/wf_KassRashodZatr.php")
    ]);

    const [
      prihData,
      rashodData,
      valutsData,
      cliKassData,
      prihZatrData,
      postavKassData,
      rashodZatrData
    ] = await Promise.all([
      prihResponse.json(),
      rashodResponse.json(),
      valutsResponse.json(),
      cliKassResponse.json(),
      prihZatrResponse.json(),
      postavKassResponse.json(),
      rashodZatrResponse.json()
    ]);

    setWorkData({
      prih: Array.isArray(prihData) ? prihData : [],
      rashod: rashodData || null,
      valuts: Array.isArray(valutsData) ? valutsData : [],
      cliKass: Array.isArray(cliKassData) ? cliKassData : [],
      prihZatr: Array.isArray(prihZatrData) ? prihZatrData : [],
      postavKass: Array.isArray(postavKassData) ? postavKassData : [],
      rashodZatr: Array.isArray(rashodZatrData) ? rashodZatrData : []
    });
  } catch (err) {
    setWorkError(err.message || "Ошибка загрузки кассы");
  } finally {
    setWorkLoading(false);
  }
}

async function saveKassaPage(payload) {
  console.log("saveKassaPage payload", payload);

  const body = new URLSearchParams();

  body.set("Action", "Kassa");
  body.set("xml", payload.Xml || "");

  const response = await fetchWithAuth(
    "https://webback.bar-boss.com/wf_RefSave.php",
    {
      method: "POST",
      body
    }
  );

  const text = await response.text();

  console.log("Kassa save response status", response.status);
  console.log("Kassa save response text", text);

  let result;

  try {
    result = JSON.parse(text);
  } catch {
    throw new Error(`Сервер вернул не JSON: ${text.slice(0, 500)}`);
  }

  if (!response.ok || result.status === "error") {
    throw new Error(result.message || result.error || "Ошибка сохранения кассы");
  }

  await loadKassaPage(kassaDate);
}

async function receiveKassaRevenue({ Org, Date }) {
  const url =
    `https://webback.bar-boss.com/wf_ReciveM.php` +
    `?Org=${encodeURIComponent(Org)}` +
    `&Date=${encodeURIComponent(Date)}`;

  const response = await fetchWithAuth(url, {
    method: "GET"
  });

  const text = await response.text();

  console.log("Receive revenue response status", response.status);
  console.log("Receive revenue response text", text);

  let result;

  try {
    result = JSON.parse(text);
  } catch {
    throw new Error(`Сервер вернул не JSON: ${text.slice(0, 500)}`);
  }

  if (!response.ok || result.status === "error") {
    throw new Error(result.message || result.error || "Ошибка приема выручки");
  }

  return result;
}

async function loadSupplierInvoices({ IdPost, Val }) {
  const url =
    `https://webback.bar-boss.com/wf_PrihPost.php` +
    `?IdPost=${encodeURIComponent(IdPost)}` +
    `&Val=${encodeURIComponent(Val)}`;

  const response = await fetchWithAuth(url, {
    method: "GET"
  });

  const text = await response.text();

  console.log("Supplier invoices response status", response.status);
  console.log("Supplier invoices response text", text);

  let result;

  try {
    result = JSON.parse(text);
  } catch {
    throw new Error(`Сервер вернул не JSON: ${text.slice(0, 500)}`);
  }

  if (!response.ok || result.status === "error") {
    throw new Error(result.message || result.error || "Ошибка загрузки накладных");
  }

  if (Array.isArray(result)) {
    return result;
  }

  if (Array.isArray(result?.items)) {
    return result.items;
  }

  if (Array.isArray(result?.Items)) {
    return result.Items;
  }

  if (Array.isArray(result?.data)) {
    return result.data;
  }

  if (result && result.ID) {
    return [result];
  }

  return [];
}

async function createMoveInvoice() {
  if (!currentSklad) {
    setWorkError("Не выбран склад, с которого выполняется перемещение");
    return;
  }

  try {
    const response = await fetchWithAuth(
      `https://webback.bar-boss.com/wf_PrihNew.php?Sklad=${encodeURIComponent(currentSklad)}`
    );

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Новая накладная перемещения вернула не JSON: " + text.substring(0, 500));
    }

    const invoice = Array.isArray(data) ? data[0] : data;

    if (!invoice || !invoice.ID) {
      throw new Error("Сервер не вернул ID новой накладной перемещения");
    }

    const moveInvoice = {
      ...invoice,

      // Склад, ОТКУДА уходит товар
      IdSklPer: Number(currentSklad),

      // Склад, КУДА перемещено — выберем в форме
      IdSkl: 0,

      // Для перемещения эти поля не нужны
      Post: 0,
      Form: 0,
      Oplach: false,
      Bel: false,
      Vozv: false,

      items: []
    };

    setInvoiceKind("move");
    setPrihInvoiceId(Number(invoice.ID));
    setPrihInitialData(moveInvoice);
    setPrihMode("new");
    setSelectedAction("prih-invoice-card");
    setWorkTitle("Новая накладная перемещения");
    setWorkError("");
  } catch (err) {
    alert(err.message || "Ошибка создания накладной перемещения");
  }
}

async function createSpisanTovInvoice() {
  if (!currentSklad) {
    setWorkError("Не выбран склад для списания сырья");
    return;
  }

  try {
    const response = await fetchWithAuth(
      `https://webback.bar-boss.com/wf_SpisTovNew.php?Sklad=${encodeURIComponent(currentSklad)}`
    );

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Новая накладная списания вернула не JSON: " + text.substring(0, 500));
    }

    const invoice = Array.isArray(data) ? data[0] : data;

    if (!invoice || !invoice.ID) {
      throw new Error("Сервер не вернул ID новой накладной списания");
    }

    const normalizedInvoice = {
      ...invoice,
      IDzatr: Number(invoice.IDzatr ?? invoice.IdZatr ?? 0),
      Sklad: Number(currentSklad || 0),
      items: Array.isArray(invoice.items) ? invoice.items : []
    };

    setSpisanInitialData(normalizedInvoice);
    setSelectedAction("spisan-tov-invoice-card");
    setWorkTitle("Новое списание сырья");
    setWorkError("");
  } catch (err) {
    alert(err.message || "Ошибка создания накладной списания");
  }
}

function backToSpisanTovList() {
  setSpisanInitialData(null);

  loadSpisanTovList({
    sklad: currentSklad
  });
}

function openSpisanBludInvoice(spisan) {
  if (!spisan?.ID) {
    setWorkError("Не найден ID накладной списания блюд");
    return;
  }

  setSpisanBludInitialData(spisan);
  setSelectedAction("spisan-blud-invoice-card");
  setWorkTitle("Накладная списания блюд");
  setWorkError("");
}
function backToSpisanBludList() {
  setSpisanBludInitialData(null);
  loadSpisanBludList();
}
async function createSpisanBludInvoice() {
  try {
    const response = await fetchWithAuth(
      "https://webback.bar-boss.com/wf_SpisBludNew.php"
    );

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        "Новая накладная списания блюд вернула не JSON: " +
          text.substring(0, 500)
      );
    }

    const invoice = Array.isArray(data) ? data[0] : data;

    if (!invoice || !invoice.ID) {
      throw new Error("Сервер не вернул ID новой накладной списания блюд");
    }

    const normalizedInvoice = {
      ...invoice,
      CodSpis: Number(invoice.CodSpis || 0),
      Rem: invoice.Rem || "",
      items: Array.isArray(invoice.items) ? invoice.items : []
    };

    setSpisanBludInitialData(normalizedInvoice);
    setSelectedAction("spisan-blud-invoice-card");
    setWorkTitle("Новое списание блюд");
    setWorkError("");
  } catch (err) {
    alert(err.message || "Ошибка создания накладной списания блюд");
  }
}

function openPrihInvoice(invoiceId) {

  if (!invoiceId) {
    setWorkError("Не найден ID приходной накладной");
    return;
  }

  setInvoiceKind("prih");
  setPrihInvoiceId(Number(invoiceId));
  setPrihInitialData(null);
  setPrihMode("edit");
  setSelectedAction("prih-invoice-card");
  setWorkTitle("Приходная накладная");
  setWorkError("");
}

async function loadCategories() {
  setWorkLoading(true);
  setWorkError("");
  setWorkData(null);

  try {
    const result = await fetchWithAuth("https://webback.bar-boss.com/wf_Categor.php");

    const data = result instanceof Response
      ? await result.json()
      : result;

    setSelectedAction("wf_Categor.php");
    setWorkTitle("Категории сырья");
    setWorkData(data);
  } catch (err) {
    setWorkError(err.message || "Ошибка загрузки категорий сырья");
  } finally {
    setWorkLoading(false);
  }
}

function backToPrihList() {
  setSelectedAction("wf_PrihList.php");
  setWorkTitle("Приходные накладные");
  setPrihInvoiceId(null);
  setPrihInitialData(null);
  setPrihMode("edit");
  setWorkError("");
}

function backToInvoiceList() {
  if (invoiceKind === "move") {
    loadPeremList({
      sklad: currentSklad
    });
    return;
  }

  backToPrihList();
}

async function loadPeremList(options = {}) {
  const sklad = options.sklad ?? currentSklad;

  setWorkLoading(true);
  setWorkError("");
  setWorkData(null);

  try {
    const params = new URLSearchParams({
      Sklad: String(sklad || 1)
    });

    const response = await fetchWithAuth(
      `https://webback.bar-boss.com/wf_PeremList.php?${params.toString()}`
    );

    const data = await response.json();
    setSelectedAction("wf_PeremList.php");
    setWorkTitle("Накладные перемещения");
    setWorkData(Array.isArray(data) ? data : []);
  } catch (err) {
    setWorkError(err.message || "Ошибка загрузки накладных перемещения");
  } finally {
    setWorkLoading(false);
  }
}

function openDishCalc(dishId) {
  if (!dishId) {
    setWorkError("Не найден код блюда для открытия калькуляционной карты");
    return;
  }

  setDishCalcId(dishId);
  setSelectedAction("dish-calc");
  setWorkTitle("Калькуляционная карта");
  setWorkError("");
}


async function loadPersonal() {
  setSelectedAction("wf_Personal.php");
  setWorkTitle("Персонал");
  setWorkLoading(true);
  setWorkError("");
  setWorkData(null);

  try {
    const response = await fetchWithAuth("https://webback.bar-boss.com/wf_Personal.php", {
      method: "GET"
    });

    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Персонал вернул не JSON: " + text.substring(0, 300));
    }

    if (!response.ok) {
      throw new Error(data.error || "Ошибка загрузки персонала");
    }

    setWorkData(Array.isArray(data) ? data : []);
  } catch (err) {
    setWorkError(err.message || "Ошибка загрузки персонала");
  } finally {
    setWorkLoading(false);
  }
}

function getCurrentOrgCode() {
  const n = Number(currentOrg);
  return Number.isFinite(n) ? n : 0;
}

async function loadSpisanBludList(options = {}) {
  const sklad = options.sklad ?? currentSklad;

  setWorkLoading(true);
  setWorkError("");
  setWorkData(null);

  try {
    const params = new URLSearchParams({
      Sklad: String(sklad || 1)
    });

    const response = await fetchWithAuth(
      `https://webback.bar-boss.com/wf_SpisanBludList.php?${params.toString()}`
    );

    const data = await response.json();

    setSelectedAction("wf_SpisanBludList.php");
    setWorkTitle("Накладные списания блюд");
    setWorkData(Array.isArray(data) ? data : data ? [data] : []);
  } catch (err) {
    setWorkError(err.message || "Ошибка загрузки накладных списания блюд");
  } finally {
    setWorkLoading(false);
  }
}

async function loadSpisanTovList(options = {}) {
  const sklad = options.sklad ?? currentSklad;

  setWorkLoading(true);
  setWorkError("");
  setWorkData(null);

  try {
    const params = new URLSearchParams({
      Sklad: String(sklad || 1)
    });

    const response = await fetchWithAuth(
      `https://webback.bar-boss.com/wf_SpisanTovList.php?${params.toString()}`
    );

    const data = await response.json();

    setSelectedAction("wf_SpisanTovList.php");
    setWorkTitle("Накладные списания сырья");
    setWorkData(Array.isArray(data) ? data : data ? [data] : []);
  } catch (err) {
    setWorkError(err.message || "Ошибка загрузки накладных списания сырья");
  } finally {
    setWorkLoading(false);
  }
}

async function loadSuppliers() {
  setWorkLoading(true);
  setWorkError("");
  setWorkData(null);

  try {
    
    const orgCode = getCurrentOrgCode();

    const url = new URL("https://webback.bar-boss.com/wf_Postav.php");
    url.searchParams.set("org", String(orgCode));

    const result = await fetchWithAuth(url.toString());

    const data = result instanceof Response
      ? await result.json()
      : result;

    setSelectedAction("wf_Postav.php");
    setWorkTitle("Список поставщиков");
    setWorkData(data);
  } catch (err) {
    setWorkError(err.message || "Ошибка загрузки списка поставщиков");
  } finally {
    setWorkLoading(false);
  }
}

async function loadFops() {
  setWorkLoading(true);
  setWorkError("");
  setWorkData(null);

  try {
    const result = await fetchWithAuth("https://webback.bar-boss.com/wf_Fops.php");

    const data = result instanceof Response
      ? await result.json()
      : result;

    setSelectedAction("wf_Fops.php");
    setWorkTitle("Список предприятий");
    setWorkData(data);
  } catch (err) {
    setWorkError(err.message || "Ошибка загрузки списка предприятий");
  } finally {
    setWorkLoading(false);
  }
}

async function loadDiscount() {
  setWorkLoading(true);
  setWorkError("");
  setWorkData(null);

  try {
    const result = await fetchWithAuth("https://webback.bar-boss.com/wf_Discount.php");

    const data = result instanceof Response
      ? await result.json()
      : result;

    setSelectedAction("wf_Discount.php");
    setWorkTitle("Список скидок");
    setWorkData(data);
  } catch (err) {
    setWorkError(err.message || "Ошибка загрузки списка скидок");
  } finally {
    setWorkLoading(false);
  }
}

async function loadGroupsEdit() {
  setWorkLoading(true);
  setWorkError("");
  setWorkData(null);

  try {
    const groupsResult = await fetchWithAuth("https://webback.bar-boss.com/wf_GroupsEdit.php");
    const groupsData = groupsResult instanceof Response
      ? await groupsResult.json()
      : groupsResult;

    const discountsResult = await fetchWithAuth("https://webback.bar-boss.com/wf_Discount.php");
    const discountsData = discountsResult instanceof Response
      ? await discountsResult.json()
      : discountsResult;

    setDiscountOptions(Array.isArray(discountsData) ? discountsData : []);

    setSelectedAction("wf_GroupsEdit.php");
    setWorkTitle("Группы блюд");
    setWorkData(Array.isArray(groupsData) ? groupsData : []);
  } catch (err) {
    setWorkError(err.message || "Ошибка загрузки групп блюд");
  } finally {
    setWorkLoading(false);
  }
}

async function addRefItem(action) {
  const url = new URL("https://webback.bar-boss.com/wf_RefAdd.php");

  url.searchParams.set("Action", action);

  const response = await fetchWithAuth(url.toString(), {
    method: "GET"
  });

  const text = await response.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Новая строка справочника вернулась не JSON: " + text.substring(0, 300));
  }

  if (!response.ok) {
    throw new Error(data.error || "Ошибка добавления строки справочника");
  }

  const newItem = Array.isArray(data) ? data[0] : data.item;

  if (!newItem?.ID) {
    throw new Error("Сервер не вернул новую строку справочника");
  }

  return newItem;
}
async function normalizeApiResult(result) {
  return result instanceof Response
    ? await result.json()
    : result;
}
async function loadClients() {
  setWorkLoading(true);
  setWorkError("");
  setWorkData(null);

  try {
    const clientsResult = await fetchWithAuth("https://webback.bar-boss.com/wf_Clients.php");
    const clientsData = await normalizeApiResult(clientsResult);

    const discountsResult = await fetchWithAuth("https://webback.bar-boss.com/wf_Discount.php");
    const discountsData = await normalizeApiResult(discountsResult);

    setDiscountOptions(Array.isArray(discountsData) ? discountsData : []);

    setSelectedAction("wf_Clients.php");
    setWorkTitle("Список клиентов");
    setWorkData(clientsData);
  } catch (err) {
    setWorkError(err.message || "Ошибка загрузки списка клиентов");
  } finally {
    setWorkLoading(false);
  }
}

async function savePersonalRef({ CardsP, CardsPDop }) {

  body.set("Action", action);
  body.set("xml", xml);

  return await fetchWithAuth("https://webback.bar-boss.com/wf_RefSave.php", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
    },
    body
  });
}

async function saveRefItem(action, xml) {
  const body = new URLSearchParams();

  body.set("Action", action);
  body.set("xml", xml);

  return await fetchWithAuth("https://webback.bar-boss.com/wf_RefSave.php", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
    },
    body
  });
}
async function loadDishes({
    sklad = currentSklad,
    skr = dishSkr,
    group = dishGroup,
    modif = dishModif
  } = {}) {
    if (!sklad) {
      throw new Error("Не выбран склад / подразделение");
    }
    setSelectedAction("wf_Dishes.php");
    setWorkTitle("Список блюд");
    setWorkLoading(true);
    setWorkError("");
    setWorkData(null);

    try {
  await loadGroupsForDishFilter({
    sklad,
    skr,
    modif
  });
      const url = new URL("https://webback.bar-boss.com/wf_Dishes.php");

      url.searchParams.set("Sklad", sklad);
      url.searchParams.set("Skr", String(skr));
      url.searchParams.set("Ceh", "%");
      url.searchParams.set("Group", group);
      url.searchParams.set("Modif", String(modif));

      const response = await fetchWithAuth(url.toString(), {
        method: "GET"
      });

      const text = await response.text();
      const data = JSON.parse(text);

      if (!response.ok) {
        throw new Error(data.error || "Ошибка загрузки списка блюд");
      }

      setWorkData(data);
    } catch (err) {
      setWorkError(err.message || "Ошибка загрузки списка блюд");
    } finally {
      setWorkLoading(false);
    }
  }

async function loadPrihList({
  sklad = currentSklad,
  post = "%",
  d1 = 0,
  d2 = 0
} = {}) {
  if (!sklad) {
    throw new Error("Не выбран склад / подразделение");
  }

  setSelectedAction("wf_PrihList.php");
  setWorkTitle("Приходные накладные");
  setWorkLoading(true);
  setWorkError("");
  setWorkData(null);

  try {
   const postavResponse = await fetchWithAuth("https://webback.bar-boss.com/wf_Postav.php", {
  method: "GET"
});

const postavText = await postavResponse.text();

let postavData;
try {
  postavData = JSON.parse(postavText);
} catch {
  throw new Error("Поставщики вернули не JSON: " + postavText.substring(0, 300));
}

if (!postavResponse.ok) {
  throw new Error(postavData.error || "Ошибка загрузки поставщиков");
}

setPostavList(Array.isArray(postavData) ? postavData : []);

    const url = new URL("https://webback.bar-boss.com/wf_PrihList.php");

    url.searchParams.set("Sklad", sklad);
    url.searchParams.set("Post", post);
    url.searchParams.set("d1", d1);
    url.searchParams.set("d2", d2);

    const response = await fetchWithAuth(url.toString(), {
      method: "GET"
    });

    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Приходные вернули не JSON: " + text.substring(0, 300));
    }

    if (!response.ok) {
      throw new Error(data.error || "Ошибка загрузки приходных накладных");
    }

    setPrihPost(post);
    setPrihPeriod(data.period ?? null);
    setPrihDate1(data.period?.Date1 ?? "");
    setPrihDate2(data.period?.Date2 ?? "");
    setWorkData(Array.isArray(data.items) ? data.items : []);

  } catch (err) {
    setWorkError(err.message || "Ошибка загрузки приходных накладных");
  } finally {
    setWorkLoading(false);
  }
}

async function loadCardsSirya({
  sklad = currentSklad,
  cat = siryaCat
} = {}) {
  if (!sklad) {
    throw new Error("Не выбран склад / подразделение");
  }

  setSelectedAction("wf_CardsSirya.php");
  setWorkTitle("Карточки сырья");
  setWorkLoading(true);
  setWorkError("");
  setWorkData(null);

  try {
    const categorResponse = await fetchWithAuth("https://webback.bar-boss.com/wf_Categor.php", {
      method: "GET"
    });

    const categorText = await categorResponse.text();

    let categorData;
    try {
      categorData = JSON.parse(categorText);
    } catch {
      throw new Error("Категории вернули не JSON: " + categorText.substring(0, 300));
    }

    if (!categorResponse.ok) {
      throw new Error(categorData.error || "Ошибка загрузки категорий сырья");
    }

    setSiryaCategories(Array.isArray(categorData) ? categorData : []);

    const url = new URL("https://webback.bar-boss.com/wf_CardsSirya.php");

    url.searchParams.set("Sklad", sklad);
    url.searchParams.set("cat", cat || "0");

    const response = await fetchWithAuth(url.toString(), {
      method: "GET"
    });

    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Карточки сырья вернули не JSON: " + text.substring(0, 300));
    }

    if (!response.ok) {
      throw new Error(data.error || "Ошибка загрузки карточек сырья");
    }

    setSiryaCat(String(cat || "0"));
    setWorkData(Array.isArray(data) ? data : []);
  } catch (err) {
    setWorkError(err.message || "Ошибка загрузки карточек сырья");
  } finally {
    setWorkLoading(false);
  }
}

async function loadSpisokTovarov({
  cat = spisokTovarovCat,
  skr = spisokTovarovSkr
} = {}) {
  setSelectedAction("wf_SpisokTovarov.php");
  setWorkTitle("Список сырья");
  setWorkLoading(true);
  setWorkError("");
  setWorkData(null);

  try {
    const categorResponse = await fetchWithAuth("https://webback.bar-boss.com/wf_Categor.php", {
      method: "GET"
    });

    const categorText = await categorResponse.text();

    let categorData;
    try {
      categorData = JSON.parse(categorText);
    } catch {
      throw new Error("Категории вернули не JSON: " + categorText.substring(0, 300));
    }

    if (!categorResponse.ok) {
      throw new Error(categorData.error || "Ошибка загрузки категорий сырья");
    }

    setSiryaCategories(Array.isArray(categorData) ? categorData : []);

    const url = new URL("https://webback.bar-boss.com/wf_SpisokTovarov.php");

    url.searchParams.set("cat", cat || "0");
    url.searchParams.set("skr", String(skr || 0));
    const response = await fetchWithAuth(url.toString(), {
      method: "GET"
    });

    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Список сырья вернул не JSON: " + text.substring(0, 300));
    }

    if (!response.ok) {
      throw new Error(data.error || "Ошибка загрузки списка сырья");
    }

    setSpisokTovarovCat(String(cat || "0"));
    setSpisokTovarovSkr(skr ? 1 : 0);
    setWorkData(Array.isArray(data) ? data : []);
  } catch (err) {
    setWorkError(err.message || "Ошибка загрузки списка сырья");
  } finally {
    setWorkLoading(false);
  }
}
async function addSpisokTovarov({
  cat = spisokTovarovCat
} = {}) {
  const url = new URL("https://webback.bar-boss.com/wf_SpisokTovarovAdd.php");

  url.searchParams.set("cat", cat || "0");

  const response = await fetchWithAuth(url.toString(), {
    method: "GET"
  });

  const text = await response.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Новый товар вернулся не JSON: " + text.substring(0, 300));
  }

  if (!response.ok) {
    throw new Error(data.error || "Ошибка добавления товара");
  }

  const newItem = Array.isArray(data) ? data[0] : data.item;

  if (!newItem?.ID) {
    throw new Error("Сервер не вернул новую строку товара");
  }

  return newItem;
}

async function fetchWithAuth(url, options = {}) {
  let response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (response.status !== 401) {
    return response;
  }

  // Access token истёк — пробуем обновить
  const refreshResponse = await fetch("https://webback.bar-boss.com/wf_Refresh.php", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    }
  });

  const refreshText = await refreshResponse.text();
  let refreshData;

  try {
    refreshData = JSON.parse(refreshText);
  } catch {
    throw new Error("Refresh вернул не JSON: " + refreshText.substring(0, 300));
  }

  if (!refreshResponse.ok || refreshData.status !== "success") {
    throw new Error(refreshData.error || "Сессия истекла. Выполните вход заново.");
  }

  const newAccessToken = refreshData.accessToken;

  setAccessToken(newAccessToken);

  // Повторяем исходный запрос уже с новым access token
  response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${newAccessToken}`
    }
  });

  return response;
}

function handleKassaDateChange(newDate) {
  setKassaDate(newDate);
  loadKassaPage(newDate);
}

function handleKassaValutChange(newValut) {
  setCurrentValut(Number(newValut || 0));
}

async function addDish({ sklad, group }) {
  if (!sklad) {
    throw new Error("Не выбран склад / подразделение");
  }

  const url = new URL("https://webback.bar-boss.com/wf_DishAdd.php");

  url.searchParams.set("Sklad", sklad);
  url.searchParams.set("Group", group === "%" ? "0" : group);

  const response = await fetchWithAuth(url.toString(), {
    method: "GET"
  });

  const text = await response.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Сервер вернул не JSON: " + text.substring(0, 300));
  }

  if (!response.ok) {
    throw new Error(data.error || "Ошибка добавления блюда");
  }

  const newDish = Array.isArray(data) ? data[0] : data.dish;

  if (!newDish?.CodeBl) {
    throw new Error("Сервер не вернул новую строку блюда");
  }

  return newDish;
}
  async function openAction(item) {
    if (!item.action) {
    console.log("NO ACTION IN ITEM:", item);
    return;
  }

  const actionName = normalizeMenuAction(item.action);
  const url = buildMenuActionUrl(item.action);

  setSelectedAction(actionName);
  setWorkTitle(item.name);
  setWorkLoading(true);
  setWorkError("");
  setWorkData(null);

  try {

    if (actionName === "wf_Kassa.php") {
      loadKassaPage(kassaDate);
      return;
    }

    if (actionName === "wf_SpisokPer.php") {
      await loadPereuchetList({
        sklad: currentSklad
      });
      return;
    }

  if (actionName === "wf_Dishes.php") {
    await loadDishes();
    return;
  }
  
  if (actionName === "wf_SpisanBludList.php") {
    await loadSpisanBludList({
      sklad: currentSklad
    });
    return;
  }

  if (actionName === "wf_PeremList.php") {
    await loadPeremList({
      sklad: currentSklad
    });
    return;
  }
  if (actionName === "wf_SpisanTovList.php") {
    await loadSpisanTovList({
      sklad: currentSklad
    });
    return;
  }
  if (actionName === "wf_GroupsEdit.php") {
  await loadGroupsEdit();
  return;
  }

  if (actionName === "wf_Clients.php") {
  await loadClients();
  return;
  }

  if (actionName === "wf_PrihList.php") {
  await loadPrihList({
    Sklad:currentSklad,
    post: "%",
    d1: 0,
    d2: 0
  });
  return;
  }
  
  if (actionName === "wf_CardsSirya.php") {
  await loadCardsSirya({
    sklad: currentSklad,
    cat: "0"
  });
  return;
  }
  if (actionName === "wf_Fops.php") {
    await loadFops();
    return;
  }
  
  if (actionName === "wf_SpisokZakazov.php") {
  await loadOrdersDay();
  return;
  }
  
  if (actionName === "wf_Postav.php") {
    await loadSuppliers();
    return;
  }

  if (actionName === "wf_SpisokTovarov.php") {
    await loadSpisokTovarov({
      cat: "0",
      skr: 0
    });
    return;
  }
  
  if (actionName === "wf_Personal.php") {
    await loadPersonal();
    return;
  }
  
  if (actionName === "wf_Discount.php") {
    await loadDiscount();
    return;
  }
  
  if (actionName === "wf_Categor.php") {
    await loadCategories();
    return;
  }
  const response = await fetchWithAuth(url, {
    method: "GET"
  });
    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Модуль вернул не JSON: " + text.substring(0, 300));
    }

    if (!response.ok) {
      throw new Error(data.error || "Ошибка загрузки модуля");
    }

    setWorkData(data);
  } catch (err) {
    setWorkError(err.message || "Ошибка загрузки");
  } finally {
    setWorkLoading(false);
  }
}
  async function handleLogin(formData) {
  setLoading(true);

  try {
    const loginData = await loginRequest(formData);

    setAccessToken(loginData.accessToken);
    setUser(loginData.user);
    setTenant(loginData.tenant);
    setLicense(loginData.license);

    const menuData = await menuRequest(loginData.accessToken);
    setMenu(menuData);

    const skladsData = await loadPodrazd(loginData.accessToken);
    setSklads(skladsData);

    if (Array.isArray(skladsData) && skladsData.length > 0) {
  const firstSklad = skladsData[0];
  const firstCode = firstSklad.ID ;

  setCurrentSklad(String(firstCode));
}
  const orgData = await loadOrganizations(loginData.accessToken);
setOrganizations(orgData);

if (!loginData.tenant?.multiOrg) {
  setCurrentOrg("1");
} else if (Array.isArray(orgData) && orgData.length > 0) {
  setCurrentOrg(String(orgData[0].ID));
} else {
  setCurrentOrg("0");
}
const [groupsData, cehData, fopData, typDishData] = await Promise.all([
  loadGroups(loginData.accessToken),
  loadCeh(loginData.accessToken),
  loadFop(loginData.accessToken),
  loadTypDish(loginData.accessToken)
]);

setDishGroups(groupsData);
setCehList(cehData);
setFopList(fopData);
setTypDishList(typDishData);

} finally {
    setLoading(false);
  }
}

  function handleLogout() {
  setAccessToken("");
  setUser(null);
  setTenant(null);
  setLicense(null);
  setMenu([]);

  setSelectedAction("");
  setWorkData(null);
  setWorkTitle("");
  setWorkLoading(false);
  setWorkError("");

  setSklads([]);
  setCurrentSklad("");
  setOrganizations([]);
  setCurrentOrg("");

  setDishGroups([]);
  setCehList([]);
  setFopList([]);
  setTypDishList([]);

  setDishSkr(0);
  setDishModif(0);
  setDishGroup("%");
  setDishFilterGroups([]);
  
  setPostavList([]);
  setPrihPost("%");
  setPrihDate1("");
  setPrihDate2("");
  
  setSiryaCategories([]);
  setSiryaCat("0");
  
  setSpisokTovarovCat("0");
  setSpisokTovarovSkr(0);

}
async function saveDishes(xml) {

  const response = await fetchWithAuth("https://webback.bar-boss.com/wf_DishesSave.php", {
    method: "POST",
    headers: {
      "Content-Type": "application/xml; charset=utf-8"
    },
    body: xml
  });

  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Сервер вернул не JSON: " + text.substring(0, 500));
  }

  if (!response.ok || data.status !== "success") {
    throw new Error(data.error || "Ошибка сохранения блюд");
  }

  return data;
}
  if (!accessToken) {
    return <LoginPage onLogin={handleLogin} loading={loading} />;
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="top-left">
          <strong>BarBo$$ Web Office</strong>
        </div>

        <div className="top-right">
 {tenant?.multiOrg && organizations.length > 0 && (
  <select
    value={currentOrg}
  onChange={(e) => {

  setCurrentOrg(e.target.value);
}}
  title="Организация"
  >
{organizations.map((org) => {
  const code = org.ID;
  const name = org.Name;

  return (
    <option key={code} value={String(code)}>
      {name}
    </option>
  );
})}
  </select>
)}
{sklads.length > 0 && (
  <select
    value={currentSklad}
    onChange={(e) => setCurrentSklad(e.target.value)}
    title="Склад / подразделение"
  >
    {sklads.map((sklad) => {
      const code = sklad.Code ?? sklad.ID;
      const name = sklad.Name ?? sklad.NameSkl;
      const org  = sklad.Org  ?? sklad.Org;

      return (
        <option key={code} value={code}>
          {name}
        </option>
      );
    })}
  </select>
)}
          <select defaultValue="RU">
            <option value="RU">RU</option>
            <option value="UA">UA</option>
            <option value="EN">EN</option>
          </select>

          {license && (
            <span className={license.warn ? "license-warn" : "license-ok"}>
              Лицензия до {license.validUntil}
            </span>
          )}

          <span>{user?.id}</span>

          <button onClick={handleLogout}>Выход</button>
        </div>
      </header>

      <div className="app-body">
        <aside className="side-menu">
          {menu.map((item, index) => (
            <MenuItem
              key={`${item.name}-${index}`}
              item={item}
              onSelect={openAction}
            />
          ))}
        </aside>

<main className="work-area">
  <h2>{workTitle || "Рабочая область"}</h2>

  {workLoading && <p>Загрузка...</p>}

  {workError && (
    <div className="login-error">
      {workError}
    </div>
  )}

  {!workLoading && !workError && workData && selectedAction === "wf_Dishes.php" && (
    <DishesPage
      data={workData}
      onOpenCalc={openDishCalc}
      groups={dishGroups}
      filterGroups={dishFilterGroups}
      cehs={cehList}
      fops={fopList}
      types={typDishList}
      readOnly={Boolean(user?.readOnly)}
      filterSkr={dishSkr}
      filterModif={dishModif}
      filterGroup={dishGroup}
      onChangeSkr={async (value) => {
        const nextValue = value ? 1 : 0;

        setDishSkr(nextValue);
        setDishGroup("%");

        await loadDishes({
          skr: nextValue,
          group: "%"
        });
      }}
      onChangeModif={async (value) => {
        const nextValue = value ? 1 : 0;

        setDishModif(nextValue);
        setDishGroup("%");

        await loadDishes({
          modif: nextValue,
          group: "%"
        });
      }}
      onChangeGroup={async (value) => {
        setDishGroup(value);

        await loadDishes({
          group: value
        });
      }}
      onAddDish={async () => {
        return addDish({
          sklad: currentSklad,
          group: dishGroup
        });
      }}
      onSaveDishes={saveDishes}
    />
  )}

 {selectedAction === "wf_SchetView.php" && viewOrderId && (
  <SchetViewPage
    codeR={viewOrderId}
    sourceOrder={viewSourceOrder}
    waiterOptions={ordersWaiterOptions}
    fetchWithAuth={fetchWithAuth}
    onBack={() => {
      setSelectedAction("wf_SpisokZakazov.php");
      setViewOrderId(null);
      setViewSourceOrder(null);
    }}
  />
)}
 
{!workLoading && !workError && selectedAction === "dish-calc" && dishCalcId && (
  <>
    <div className="page-toolbar">
      <button
        type="button"
        className="back-to-list-button"
        onClick={() => {
          setSelectedAction("wf_Dishes.php");
          setWorkTitle("Список блюд");
          setDishCalcId(null);
          setWorkError("");
        }}
      >
        ← К списку блюд
      </button>
    </div>

    <DishCalcPage
      dishId={dishCalcId}
      currentSklad={currentSklad}
      fetchWithAuth={fetchWithAuth}
    />
  </>
)}
  {!workLoading && !workError && workData && selectedAction === "wf_PrihList.php" && (
    <PrihListPage
      data={workData}
      period={prihPeriod}
      posts={postavList}
      filterPost={prihPost}
      date1={prihDate1}
      date2={prihDate2}
      onChangePost={setPrihPost}
      onChangeDate1={setPrihDate1}
      onChangeDate2={setPrihDate2}
      onOpenInvoice={openPrihInvoice}
      onCreateInvoice={createPrihInvoice}
      onApply={async () => {
        await loadPrihList({
          sklad: currentSklad,
          post: prihPost,
          d1: prihDate1 || 0,
          d2: prihDate2 || 0
        });
      }}
    />
  )}

{!workLoading &&
  !workError &&
  selectedAction === "wf_Kassa.php" &&
  workData && (
    <KassaPage
      data={workData}
      currentOrg={currentOrg}
      kassaDate={kassaDate}
      currentValut={currentValut}
      onDateChange={handleKassaDateChange}
      onValutChange={handleKassaValutChange}
      onSave={saveKassaPage}
      onReload={() => loadKassaPage(kassaDate)}
      onReceiveRevenue={receiveKassaRevenue}
      onLoadSupplierInvoices={loadSupplierInvoices}
    />
  )}

{!workLoading &&
  !workError &&
  selectedAction === "wf_SpisokZakazov.php" &&
  workData && (
    <OrdersDayPage
      data={workData}
      ordersDate={ordersDate}
      onDateChange={handleOrdersDateChange}
      onReload={() => loadOrdersDay(ordersDate)}
      onViewOrder={openSchetView}
    />
)}

{!workLoading &&
  !workError &&
  selectedAction === "wf_SpisokPer.php" &&
  workData && (
    <PereuchetPage
      data={workData}
      currentSklad={currentSklad}
      fetchWithAuth={fetchWithAuth}
      onReload={() => loadPereuchetList({ sklad: currentSklad })}
    />
  )}

{!workLoading && !workError && selectedAction === "prih-invoice-card" && prihInvoiceId && (
<PrihInvoicePage
  invoiceId={prihInvoiceId}
  initialInvoice={prihInitialData}
  mode={prihMode}
  invoiceKind={invoiceKind}
  fetchWithAuth={fetchWithAuth}
  onBack={backToInvoiceList}
/>
)}
{!workLoading &&
  !workError &&
  workData &&
  selectedAction === "wf_Postav.php" && (
    <SuppliersPage
      data={workData}
      org={currentOrg}
      readOnly={Boolean(user?.readOnly)}
      onAddSupplier={() => addRefItem("Supplier")}
      onSaveSupplier={(xml) => saveRefItem("Supplier", xml)}
    />
)}
  {!workLoading && !workError && workData && selectedAction === "wf_CardsSirya.php" && (
    <CardsSiryaPage
      data={workData}
      categories={siryaCategories}
      filterCat={siryaCat}
      onChangeCat={setSiryaCat}
      onApply={async () => {
        await loadCardsSirya({
          sklad: currentSklad,
          cat: siryaCat || "0"
        });
     }}
    /> 
  )}

{!workLoading && !workError && workData && selectedAction === "wf_SpisanTovList.php" && (
  <SpisanTovListPage
    data={workData}
    onOpen={openSpisanTovInvoice}
  onNew={createSpisanTovInvoice}
/>
)}

{!workLoading &&
  !workError &&
  selectedAction === "spisan-tov-invoice-card" &&
  spisanInitialData && (
    <SpisanTovInvoicePage
      initialData={spisanInitialData}
      currentSklad={currentSklad}
      fetchWithAuth={fetchWithAuth}
      onBack={backToSpisanTovList}
    />
  )}

{!workLoading && !workError && workData && selectedAction === "wf_Personal.php" && (
<PersonalPage
  data={workData}
  readOnly={Boolean(user?.readOnly)}
  onAddPersonal={() => addRefItem("Personal")}
  onSavePersonal={(xml) => saveRefItem("Personal", xml)}
/>
)}

{!workLoading && !workError && workData && selectedAction === "wf_SpisanBludList.php" && (
<SpisanBludListPage
  data={workData}
  onOpen={openSpisanBludInvoice}
  onNew={createSpisanBludInvoice}
/>)}
{!workLoading && !workError && workData && selectedAction === "wf_PeremList.php" && (
<PeremListPage
  data={workData}
  onOpen={openMoveInvoice}
  onNew={createMoveInvoice}
/>
)}

{!workLoading && !workError && workData && selectedAction === "wf_Discount.php" && (
  <DiscountPage
    data={workData}
    readOnly={Boolean(user?.readOnly)}
    onSaveDiscount={(xml) => saveRefItem("Discount", xml)}
  />
)}
{!workLoading && !workError && workData && selectedAction === "wf_Clients.php" && (
  <ClientsPage
    data={workData}
    discounts={discountOptions}
    readOnly={Boolean(user?.readOnly)}
    onAddCustomer={() => addRefItem("Customer")}
    onSaveCustomer={(xml) => saveRefItem("Customer", xml)}
  />
)}

{!workLoading && !workError && workData && selectedAction === "wf_Categor.php" && (
  <CategoriesPage
    data={workData}
    readOnly={Boolean(user?.readOnly)}
    onAddCategory={() => addRefItem("Categories")}
    onSaveCategory={(xml) => saveRefItem("Categories", xml)}
  />
)}

{!workLoading && !workError && workData && selectedAction === "wf_Fops.php" && (
  <FopsPage
    data={workData}
    readOnly={Boolean(user?.readOnly)}
    onAddFop={() => addRefItem("Tax")}
    onSaveFop={(xml) => saveRefItem("Tax", xml)}
  />
)}

{!workLoading && !workError && workData && selectedAction === "wf_GroupsEdit.php" && (
  <GroupsPage
    data={workData}
    discounts={discountOptions}
    readOnly={Boolean(user?.readOnly)}
    onAddGroup={() => addRefItem("Groups")}
    onSaveGroup={(xml) => saveRefItem("Groups", xml)}
  />
)}

{!workLoading && !workError && workData && selectedAction === "wf_SpisokTovarov.php" && (
  <SpisokTovarovPage
    data={workData}
    categories={siryaCategories}
    filterCat={spisokTovarovCat}
    filterSkr={spisokTovarovSkr}
    readOnly={Boolean(user?.readOnly)}
    onChangeCat={setSpisokTovarovCat}
    onChangeSkr={setSpisokTovarovSkr}
    onAddTovar={async () => {
     return await addSpisokTovarov({
       cat: spisokTovarovCat || "0"
      });
    }}
 onApply={async ({ cat, skr }) => {
  await loadSpisokTovarov({
    cat: cat || "0",
    skr: skr ? 1 : 0
  });
}}

    onSaveTovarov={async (xml) => {
      const response = await fetchWithAuth("https://webback.bar-boss.com/wf_SpisokTovarovSave.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/xml; charset=utf-8"
        },
        body: xml
      });

      const text = await response.text();

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Сервер вернул не JSON: " + text.substring(0, 300));
      }

      if (!response.ok || data.status !== "success") {
        throw new Error(data.error || "Ошибка сохранения списка сырья");
      }

      return data;
    }}
  />
)}

{!workLoading &&
  !workError &&
  selectedAction === "spisan-blud-invoice-card" &&
  spisanBludInitialData && (
    <SpisanBludInvoicePage
      initialData={spisanBludInitialData}
      fetchWithAuth={fetchWithAuth}
      onBack={backToSpisanBludList}
    />
  )}

{!workLoading &&
  !workError &&
  workData &&
  selectedAction !== "wf_Dishes.php" &&
  selectedAction !== "wf_PrihList.php" &&
  selectedAction !== "wf_Discount.php" &&
  selectedAction !== "wf_CardsSirya.php" &&
  selectedAction !== "wf_Fops.php" &&
  selectedAction !== "wf_GroupsEdit.php" &&
  selectedAction !== "wf_SpisanBludList.php" &&
  selectedAction !== "wf_SpisanTovList.php" &&
  selectedAction !== "wf_Postav.php" &&
  selectedAction !== "wf_Clients.php" &&
  selectedAction !== "prih-invoice-card" &&
  selectedAction !== "prih-invoice" &&
  selectedAction !== "wf_SpisokPer.php" &&
  normalizeMenuAction(selectedAction) !== "wf_SpisokPer.php" &&
  selectedAction !== "wf_Kassa.php" &&
  selectedAction !== "spisan-tov-invoice-card" &&
  selectedAction !== "wf_PeremList.php" &&
  selectedAction !== "dish-calc" &&
  selectedAction !== "spisan-blud-invoice-card" &&
  selectedAction !== "wf_Categor.php" && 
  selectedAction !== "wf_SpisokTovarov.php" &&
  selectedAction !== "wf_SpisokZakazov.php" &&
  selectedAction !== "wf_Personal.php" && (
    <pre className="json-view">
      {JSON.stringify(workData, null, 2)}
    </pre>
  )}

  {!workLoading && !workError && !workData && (
    <p>Выберите пункт меню слева.</p>
  )}
</main>
     </div>
    </div>
  );
}