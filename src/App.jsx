import { useState, useEffect, useMemo, useRef } from "react";
import {
  loginRequest,
  menuRequest,
  loadPodrazd,
  loadOrganizations,
  loadGroups,
  loadCeh,
  loadFop,
  loadTypDish,
  loadDishFilterGroups
} from "./api";
import LoginPage from "./LoginPage";
import {
  getInitialLanguage,
  getLanguageLocale,
  loadTranslations,
  normalizeLanguage,
  persistLanguage
} from "./i18n";
import HomePage from "./HomePage";
import barbossTitleIcon from "./assets/barboss-title-icon.png";
import DishesPage from "./DishesPage";
import PrihListPage from "./PrihListPage";
import CardsSiryaPage from "./CardsSiryaPage";
import SpisokTovarovPage from "./SpisokTovarovPage";
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
import OrderNewPage from "./OrderNewPage";
import DirectoryPage from "./DirectoryPage";
import SubdivisionsPage from "./SubdivisionsPage";
import ReportsPage from "./ReportsPage";
import NeraschPage from "./NeraschPage";
import SystemParametersPage from "./SystemParametersPage";
import UsersPage from "./UsersPage";
import SalaryParametersPage from "./SalaryParametersPage";
import TablesPage from "./TablesPage";
import "./styles.css";
import "./prih-invoice-report.css";
import "./side-menu-collapse.css";
import "./salary-parameters.css";
import "./browser-light-fix.css";

function normalizeMenuActionKey(action) {
  return String(action || "")
    .trim()
    .replace(/^https?:\/\/webback\.bar-boss\.com\//i, "")
    .replace(/^\/+/, "")
    .split("?")[0];
}

function normalizeMenuCode(value) {
  return String(value ?? "").trim();
}

function getSkladCode(sklad) {
  return String(
    sklad?.Code ?? sklad?.ID ?? ""
  );
}

function getSkladOrgCode(sklad) {
  return String(
    sklad?.Org ?? ""
  ).trim();
}

function filterSkladsByOrg(sklads, org) {
  const normalizedOrg = String(
    org ?? "0"
  ).trim();

  if (
    normalizedOrg === "" ||
    normalizedOrg === "0"
  ) {
    return Array.isArray(sklads)
      ? sklads
      : [];
  }

  return (Array.isArray(sklads)
    ? sklads
    : []
  ).filter(
    (sklad) =>
      getSkladOrgCode(sklad) ===
      normalizedOrg
  );
}

function getMenuChildren(item) {
  const children =
    item?.items ??
    item?.Items ??
    item?.Level3 ??
    item?.level3 ??
    [];

  return Array.isArray(children) ? children : [];
}

function isMenuItemHiddenForLanguage(item, language) {
  const code = normalizeMenuCode(item?.Code ?? item?.code);
  const normalizedLanguage = normalizeLanguage(language);

  if (
    code === "05.01.16" &&
    !["ru", "uk"].includes(normalizedLanguage)
  ) {
    return true;
  }

  const children = getMenuChildren(item);

  if (children.length === 0) {
    return false;
  }

  const hasVisibleChildren = children.some(
    (child) => !isMenuItemHiddenForLanguage(child, language)
  );

  const action = item?.action ?? item?.Action ?? "";

  return !hasVisibleChildren && !Boolean(action);
}

function menuItemMatchesSelection(item, selectedAction, selectedMenuCode) {
  const itemCode = normalizeMenuCode(item?.Code ?? item?.code);
  const targetCode = normalizeMenuCode(selectedMenuCode);

  // Code — основной внутренний идентификатор пункта меню. Это важно для
  // универсальных обработчиков (wbo_Directory, будущие отчёты), где один
  // action может использоваться несколькими пунктами.
  if (targetCode && itemCode) {
    return itemCode === targetCode;
  }

  const action = item?.action ?? item?.Action ?? "";

  return Boolean(action) &&
    normalizeMenuActionKey(action) === normalizeMenuActionKey(selectedAction);
}

function menuItemContainsSelection(item, selectedAction, selectedMenuCode) {
  const items = getMenuChildren(item);

  if (menuItemMatchesSelection(item, selectedAction, selectedMenuCode)) {
    return true;
  }

  return Array.isArray(items)
    ? items.some((child) =>
        menuItemContainsSelection(child, selectedAction, selectedMenuCode)
      )
    : false;
}

function resolveMenuIconKey(item) {
  const action = normalizeMenuActionKey(item?.action ?? item?.Action ?? "").toLowerCase();
  const code = normalizeMenuCode(item?.Code ?? item?.code);
  const name = String(item?.name ?? item?.Name ?? "").trim().toLowerCase();

  if (action === "wf_prihlist.php" || name.includes("приход")) {
    return "prihod";
  }

  if (action === "wf_peremlist.php" || name.includes("перемещ")) {
    return "transfer";
  }

  if (
    action === "wf_spisanbludlist.php" ||
    (name.includes("списан") && name.includes("блю"))
  ) {
    return "writeoffDish";
  }

  if (
    action === "wf_spisantovlist.php" ||
    (name.includes("списан") && (name.includes("сыр") || name.includes("тов")))
  ) {
    return "writeoff";
  }

  if (action === "wf_dishes.php" || name.includes("список блю")) {
    return "dishes";
  }

  if (
    action === "wf_spisoktovarov.php" ||
    name === "сырье" ||
    name.includes("список сыр") ||
    name.includes("сировин")
  ) {
    return "raw";
  }

  if (action === "wf_cardssirya.php" || name.includes("карточки сыр")) {
    return "rawCards";
  }

  if (action === "wf_pereuchet.php" || name.includes("переуч")) {
    return "inventory";
  }

  if (action === "wf_kassa.php" || name.includes("касс")) {
    return "cash";
  }

  if (action === "wf_spisokzakazov.php" || name.includes("счета за день") || name.includes("рахунк")) {
    return "orders";
  }

  if (
    action.startsWith("wr_") ||
    action === "reports" ||
    name.includes("отчет") ||
    name.includes("звіт")
  ) {
    return "reports";
  }

  if (
    action === "wbo_directory.php" ||
    code.startsWith("08") ||
    name.includes("справоч") ||
    name.includes("довідник")
  ) {
    return "directory";
  }

  if (name.includes("наклад")) {
    return "invoice";
  }

  if (name.includes("польз") || name.includes("корист")) {
    return "users";
  }

  if (name.includes("парамет") || name.includes("system") || name.includes("настрой")) {
    return "settings";
  }

  return "menu";
}

function MenuGlyph({ iconKey }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round"
  };

  switch (iconKey) {
    case "invoice":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M7 3.75h7.75L19 8v12.25a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.75a1 1 0 0 1 1-1Z" />
          <path {...common} d="M14.75 3.75V8H19" />
          <path {...common} d="M9 11h6M9 14.5h6M9 18h4.5" />
        </svg>
      );
    case "prihod":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M7 3.75h7.75L19 8v12.25a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.75a1 1 0 0 1 1-1Z" />
          <path {...common} d="M14.75 3.75V8H19" />
          <path {...common} d="M8.8 13.5h8.4" />
          <path {...common} d="m10.8 11.2-2.8 2.3 2.8 2.3" />
        </svg>
      );
    case "transfer":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="m5.25 9 4-2.5 4 2.5-4 2.5-4-2.5Zm0 0v4.5l4 2.5 4-2.5V9M14.75 7.75l4-2.5 4 2.5-4 2.5-4-2.5Zm0 0v4.5l4 2.5 4-2.5V7.75" transform="translate(-1.8,0.3) scale(0.88)" />
          <path {...common} d="M13.6 7.4h4.4" />
          <path {...common} d="m16.4 5.7 1.9 1.7-1.9 1.7" />
          <path {...common} d="M18.2 16.6H9.4" />
          <path {...common} d="m11.2 14.9-1.9 1.7 1.9 1.7" />
        </svg>
      );
    case "writeoff":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M7 3.75h7.75L19 8v12.25a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.75a1 1 0 0 1 1-1Z" />
          <path {...common} d="M14.75 3.75V8H19" />
          <path {...common} d="M9 12.25h6M9 15.75h4.5" />
          <circle {...common} cx="17.3" cy="17.2" r="3.2" />
          <path {...common} d="M15.8 17.2h3" />
        </svg>
      );
    case "writeoffDish":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M5 17.5h14" />
          <path {...common} d="M6.2 17.5c.2-4.5 2.8-7.5 5.8-7.5s5.6 3 5.8 7.5" />
          <path {...common} d="M12 6.5v1.8" />
          <path {...common} d="M9.3 8.1A4.8 4.8 0 0 1 12 7.3c1 0 1.9.3 2.7.8" />
          <circle {...common} cx="18.1" cy="7.1" r="2.9" />
          <path {...common} d="M16.8 7.1h2.6" />
        </svg>
      );
    case "dishes":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M5 17.5h14" />
          <path {...common} d="M6.1 17.5c.25-4.7 2.9-7.7 5.9-7.7s5.65 3 5.9 7.7" />
          <path {...common} d="M12 6.2V8" />
          <circle {...common} cx="12" cy="5" r="1.2" />
        </svg>
      );
    case "raw":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M4.2 9.5 12 4l7.8 5.5v9.1a1 1 0 0 1-1 1H5.2a1 1 0 0 1-1-1V9.5Z" />
          <path {...common} d="M9.1 19.6v-5.5h5.8v5.5" />
          <path {...common} d="M9.1 11h5.8" />
        </svg>
      );
    case "rawCards":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M4.5 7.25h5l1.4 1.5H19a1 1 0 0 1 1 1v8.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1Z" />
          <path {...common} d="M8 12h8M8 15.2h5" />
          <rect {...common} x="6.8" y="11" width="2" height="4.2" rx=".4" />
        </svg>
      );
    case "inventory":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect {...common} x="6" y="4.5" width="12" height="15" rx="1.2" />
          <path {...common} d="M9.2 4.5h5.6v2H9.2z" />
          <path {...common} d="m8.6 10.2 1.3 1.3 2-2.2M8.6 14.3l1.3 1.3 2-2.2" />
          <path {...common} d="M13.8 10.4h2.9M13.8 14.5h2.9" />
        </svg>
      );
    case "cash":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M5.5 9.5h13a1 1 0 0 1 1 1v6.8a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-6.8a1 1 0 0 1 1-1Z" />
          <path {...common} d="M7.5 9.5V6.8a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v2.7" />
          <path {...common} d="M8 12.2h3.3v2.6H8zM14.4 12.2h1.8M14.4 14.8h1.8" />
          <circle {...common} cx="12" cy="16.9" r=".55" />
        </svg>
      );
    case "orders":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M6.5 4.8h8.3a1 1 0 0 1 1 1v7.3l-3 2.8-3-2.8H6.5a1 1 0 0 1-1-1v-6.3a1 1 0 0 1 1-1Z" />
          <path {...common} d="M8.5 8.2h5M8.5 10.7h4.2" />
          <rect {...common} x="12.8" y="13" width="6" height="5.6" rx="1" />
          <path {...common} d="M14.1 11.8v1.2M17.5 11.8v1.2M12.8 14.9h6" />
        </svg>
      );
    case "reports":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M5.5 18.5h13" />
          <path {...common} d="M8 18.5v-5.2M12 18.5V9.2M16 18.5V6.2" />
          <path {...common} d="M6.5 11.8 10 9.6l2.8-2.2 3.7-2.3" />
          <path {...common} d="m15.7 5 1-.2-.3 1" />
        </svg>
      );
    case "directory":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect {...common} x="5" y="4.5" width="14" height="15" rx="1.4" />
          <circle {...common} cx="8.2" cy="9" r=".65" />
          <circle {...common} cx="8.2" cy="12.2" r=".65" />
          <circle {...common} cx="8.2" cy="15.4" r=".65" />
          <path {...common} d="M10.8 9h5M10.8 12.2h5M10.8 15.4h5" />
        </svg>
      );
    case "users":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle {...common} cx="12" cy="8.2" r="3.2" />
          <path {...common} d="M6.5 18.5c.6-3.1 2.7-4.8 5.5-4.8s4.9 1.7 5.5 4.8" />
        </svg>
      );
    case "settings":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M6 7.5h12M6 16.5h12" />
          <circle {...common} cx="9" cy="7.5" r="1.8" />
          <circle {...common} cx="15" cy="16.5" r="1.8" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect {...common} x="5" y="5" width="5.2" height="5.2" rx=".8" />
          <rect {...common} x="13.8" y="5" width="5.2" height="5.2" rx=".8" />
          <rect {...common} x="5" y="13.8" width="5.2" height="5.2" rx=".8" />
          <rect {...common} x="13.8" y="13.8" width="5.2" height="5.2" rx=".8" />
        </svg>
      );
  }
}

function MenuIcon({ item }) {
  const iconKey = resolveMenuIconKey(item);

  return (
    <span className={`menu-icon menu-icon-${iconKey}`} aria-hidden="true">
      <MenuGlyph iconKey={iconKey} />
    </span>
  );
}


function MenuItem({
  item,
  level = 0,
  onSelect,
  selectedAction,
  selectedMenuCode,
  language,
  collapsed = false
}) {
  const [isOpen, setIsOpen] = useState(false);

  const name = item.name ?? item.Name ?? "";
  const action = item.action ?? item.Action ?? "";
  const code = item.Code ?? item.code ?? "";
  const items = getMenuChildren(item).filter(
    (child) => !isMenuItemHiddenForLanguage(child, language)
  );

  const hasItems = Array.isArray(items) && items.length > 0;
  const hasAction = Boolean(action);

  const isSelected =
    hasAction && menuItemMatchesSelection(item, selectedAction, selectedMenuCode);

  const containsSelected =
    hasItems &&
    items.some((child) =>
      menuItemContainsSelection(child, selectedAction, selectedMenuCode)
    );

  useEffect(() => {
    if (containsSelected) {
      setIsOpen(true);
    }
  }, [containsSelected]);

  function handleClick() {
    if (hasItems) {
      setIsOpen((prev) => !prev);
      return;
    }

    if (hasAction) {
      onSelect({ ...item, name, action, Code: code });
    }
  }

  const className = [
    "menu-item",
    hasItems ? "group" : hasAction ? "active" : "disabled",
    isSelected ? "selected" : "",
    containsSelected ? "contains-selected" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="menu-node">
      <button
        type="button"
        className={className}
        style={{ paddingLeft: collapsed ? 0 : 14 + level * 17 }}
        disabled={!hasAction && !hasItems}
        onClick={handleClick}
        aria-expanded={hasItems ? isOpen : undefined}
        title={name}
      >
        <span
          className={`menu-arrow ${!hasItems ? "empty" : ""}`}
          aria-hidden="true"
        >
          {hasItems ? (isOpen ? "▾" : "▸") : ""}
        </span>

        <MenuIcon item={item} />

        <span className="menu-item-label">{name}</span>
      </button>

      {hasItems && isOpen && (
        <div className="menu-children">
          {items.map((child, index) => (
            <MenuItem
              key={`${child.Code ?? child.code ?? child.name ?? child.Name}-${index}`}
              item={child}
              level={level + 1}
              onSelect={onSelect}
              selectedAction={selectedAction}
              selectedMenuCode={selectedMenuCode}
              language={language}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const SIDE_MENU_CLOSE_DELAY_MS = 220;

function parseBooleanFlag(value) {
  if (value === true || value === 1) {
    return true;
  }

  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

const DIRECTORY_MENU_CONFIGS = {
  "08.01": {
    apiAction: "Personal",
    saveAction: "Personal",
    idField: "ID",
    canAdd: true,
    canDelete: false,
    wide: true,
    xmlRoot: "Personal",
    wrapInRef: false,
    xmlGroups: [
      {
        section: "CardsP",
        fields: [
          "ID",
          "Name",
          "Pass",
          "Skr",
          "Admin",
          "Upr",
          "Bil",
          "Nalog",
          "Dost",
          "Post",
          "Kli",
          "Kur",
          "Phone",
          "Bonus",
          "Bond"
        ]
      },
      {
        section: "CardsPDop",
        fields: [
          "ID",
          "email",
          "Rem",
          "ProcZP",
          "LoginMobile"
        ]
      }
    ],
    filter: {
      field: "Skr",
      defaultValue: "active",
      labelKey: "Personal.Filter",
      fallback: "Фильтр",
      emptyKey: "Personal.EmptyFilter",
      emptyFallback: "По выбранному фильтру сотрудников нет.",
      options: [
        {
          value: "active",
          labelKey: "Personal.Active",
          fallback: "Активные",
          mode: "boolean-false"
        },
        {
          value: "all",
          labelKey: "Personal.All",
          fallback: "Все",
          mode: "all"
        },
        {
          value: "hidden",
          labelKey: "Personal.Hidden",
          fallback: "Скрытые",
          mode: "boolean-true"
        }
      ]
    },
    columns: [
      {
                    field: "Name",
                    labelKey: "Personal.Name",
                    fallback: "Имя",
                    type: "text"
                  },
      {
                    field: "Pass",
                    labelKey: "Personal.Password",
                    fallback: "Пароль",
                    type: "text"
                  },
      {
                    field: "Phone",
                    labelKey: "Personal.Phone",
                    fallback: "Телефон",
                    type: "text"
                  },
      {
                    field: "ProcZP",
                    labelKey: "Personal.SalaryPercent",
                    fallback: "ЗП %",
                    type: "nullable-number",
                    step: "0.1",
                    min: 0,
                    max: 99
                  },
      {
                    field: "LoginMobile",
                    labelKey: "Personal.MobileLogin",
                    fallback: "Mobile login",
                    type: "text"
                  },
      {
                    field: "Skr",
                    labelKey: "Personal.HiddenAbbr",
                    fallback: "Скр.",
                    type: "boolean",
                    defaultValue: false
                  },
      {
                    field: "Admin",
                    labelKey: "Personal.Admin",
                    fallback: "Admin",
                    type: "boolean",
                    defaultValue: false
                  },
      {
                    field: "Upr",
                    labelKey: "Personal.ManagerAbbr",
                    fallback: "Упр.",
                    type: "boolean",
                    defaultValue: false
                  },
      {
                    field: "Bil",
                    labelKey: "Personal.BillingAbbr",
                    fallback: "Бил.",
                    type: "boolean",
                    defaultValue: false
                  },
      {
                    field: "Nalog",
                    labelKey: "Personal.Tax",
                    fallback: "Налог",
                    type: "boolean",
                    defaultValue: false
                  },
      {
                    field: "Dost",
                    labelKey: "Personal.DeliveryAbbr",
                    fallback: "Дост.",
                    type: "boolean",
                    defaultValue: false
                  },
      {
                    field: "Post",
                    labelKey: "Personal.SupplierAbbr",
                    fallback: "Пост.",
                    type: "boolean",
                    defaultValue: false
                  },
      {
                    field: "Kli",
                    labelKey: "Personal.ClientAbbr",
                    fallback: "Кли.",
                    type: "boolean",
                    defaultValue: false
                  },
      {
                    field: "Kur",
                    labelKey: "Personal.CourierAbbr",
                    fallback: "Кур.",
                    type: "boolean",
                    defaultValue: false
                  },
      {
                    field: "Bonus",
                    labelKey: "Directory.Bonus",
                    fallback: "Бонус",
                    type: "boolean",
                    defaultValue: false
                  },
      {
                    field: "Bond",
                    labelKey: "Personal.Bond",
                    fallback: "Бонд",
                    type: "boolean",
                    defaultValue: false
                  }
    ]
  },
  "08.02": {
    apiAction: "Clients",
    saveAction: "Customer",
    idField: "ID",
    canAdd: true,
    canDelete: false,
    wide: true,
    xmlRoot: "Ref",
    wrapInRef: false,
    xmlGroups: [
      {
        section: "CardsP",
        fields: [
          "ID",
          "Name",
          "NomCard",
          "Discount",
          "Phone",
          "Dolg",
          "Nom",
          "Nakop",
          "Post",
          "Slug",
          "Skr",
          "isBonus"
        ]
      },
      {
        section: "CardsPDop",
        fields: [
          "ID",
          "Dolg0",
          "Birtday",
          "email",
          "Rem",
          "BN"
        ]
      }
    ],
    filter: {
      field: "Skr",
      defaultValue: "active",
      labelKey: "Clients.Filter",
      fallback: "Фильтр",
      emptyKey: "Clients.EmptyFilter",
      emptyFallback: "По выбранному фильтру клиентов нет.",
      options: [
        {
          value: "active",
          labelKey: "Clients.Active",
          fallback: "Активные",
          mode: "boolean-false"
        },
        {
          value: "all",
          labelKey: "Clients.All",
          fallback: "Все",
          mode: "all"
        },
        {
          value: "hidden",
          labelKey: "Clients.Hidden",
          fallback: "Скрытые",
          mode: "boolean-true"
        }
      ]
    },
    columns: [
      {
              field: "NomCard",
              labelKey: "Clients.CardNumber",
              fallback: "№ Карты",
              type: "text"
            },
      {
              field: "Name",
              labelKey: "Clients.Name",
              fallback: "Имя",
              type: "text"
            },
      {
              field: "Phone",
              labelKey: "Clients.Phone",
              fallback: "Телефон",
              type: "text"
            },
      {
              field: "Discount",
              labelKey: "Clients.Discount",
              fallback: "Скидка",
              type: "select",
              optionsAction: "Discount",
              optionValueField: "ID",
              optionLabelField: "Name",
              defaultValue: 0,
              emptyOptionValue: 0,
              emptyOptionLabel: "—"
            },
      {
              field: "Dolg",
              labelKey: "Clients.Debt",
              fallback: "Долг",
              type: "boolean",
              defaultValue: false
            },
      {
              field: "Nom",
              labelKey: "Clients.CardCode",
              fallback: "Код карты",
              type: "text"
            },
      {
              field: "Dolg0",
              labelKey: "Clients.OpeningDebt",
              fallback: "Долг нач.",
              type: "number",
              step: "0.01"
            },
      {
              field: "Birtday",
              labelKey: "Clients.Birthday",
              fallback: "День рождения",
              type: "date"
            },
      {
              field: "email",
              labelKey: "Clients.Email",
              fallback: "Email",
              type: "text"
            },
      {
              field: "Rem",
              labelKey: "Clients.Note",
              fallback: "Примечание",
              type: "text"
            },
      {
              field: "Nakop",
              labelKey: "Clients.AccumAbbr",
              fallback: "Накоп.",
              type: "boolean",
              defaultValue: false
            },
      {
              field: "Post",
              labelKey: "Clients.PermanentAbbr",
              fallback: "Пост.",
              type: "boolean",
              defaultValue: false
            },
      {
              field: "Slug",
              labelKey: "Clients.ServiceAbbr",
              fallback: "Служ.",
              type: "boolean",
              defaultValue: false
            },
      {
              field: "Skr",
              labelKey: "Clients.HiddenAbbr",
              fallback: "Скр.",
              type: "boolean",
              defaultValue: false
            },
      {
              field: "BN",
              labelKey: "Clients.CashlessAbbr",
              fallback: "БН",
              type: "boolean",
              defaultValue: false
            },
      {
              field: "isBonus",
              labelKey: "Clients.IsBonus",
              fallback: "Бонусная",
              type: "boolean",
              defaultValue: false,
              hidden: ({ context }) => !Boolean(context?.bonusEnabled)
            }
    ]
  },
  "08.03": {
    apiAction: "Postav",
    saveAction: "Supplier",
    idField: "ID",
    canAdd: true,
    canDelete: false,
    wide: true,
    includeCurrentOrg: true,
    tableClass: "suppliers-table",
    tableWrapClass: "suppliers-table-wrap",
    xmlRoot: "Ref",
    wrapInRef: false,
    xmlGroups: [
      {
        section: "CardsP",
        fields: [
          "ID",
          "Name",
          "Phone",
          "Skr",
          "Slug"
        ]
      },
      {
        section: "CardsSald",
        fields: [
          "ID",
          "org",
          "Dolg1",
          "Dolg2"
        ]
      }
    ],
    filter: {
      field: "Skr",
      defaultValue: "regular",
      labelKey: "Suppliers.Filter",
      fallback: "Фильтр",
      emptyKey: "Suppliers.EmptyFilter",
      emptyFallback: "По выбранному фильтру поставщиков нет.",
      options: [
        {
          value: "regular",
          labelKey: "Suppliers.Regular",
          fallback: "Обычные",
          mode: "boolean-false",
          excludeTrueField: "Slug"
        },
        {
          value: "hidden",
          labelKey: "Suppliers.Hidden",
          fallback: "Скрытые",
          mode: "boolean-true"
        },
        {
          value: "service",
          labelKey: "Suppliers.Service",
          fallback: "Служебные",
          mode: "boolean-true-field",
          field: "Slug"
        }
      ]
    },
    columns: [
      {
        field: "Name",
        labelKey: "Suppliers.Supplier",
        fallback: "Поставщик",
        type: "text"
      },
      {
        field: "Phone",
        labelKey: "Suppliers.Phone",
        fallback: "Телефон",
        type: "text"
      },
      {
        field: "Dolg1",
        labelKey: "Suppliers.CashDebt",
        fallback: "Долг нал.",
        type: "nullable-number",
        step: "0.01",
        defaultValue: null,
        editable: ({ context }) => Number(context?.currentOrg ?? 0) !== 0
      },
      {
        field: "Dolg2",
        labelKey: "Suppliers.CashlessDebt",
        fallback: "Долг безнал.",
        type: "nullable-number",
        step: "0.01",
        defaultValue: null,
        editable: ({ context }) => Number(context?.currentOrg ?? 0) !== 0
      },
      {
        field: "Skr",
        labelKey: "Suppliers.HiddenAbbr",
        fallback: "Скр.",
        type: "boolean",
        defaultValue: false
      },
      {
        field: "Slug",
        labelKey: "Suppliers.ServiceAbbr",
        fallback: "Служ.",
        type: "boolean",
        defaultValue: false
      },
      {
        field: "org",
        type: "number",
        hidden: true,
        defaultFromContext: "currentOrg"
      }
    ]
  },
  "08.04": {
    apiAction: "Groups",
    saveAction: "Groups",
    xmlSection: "Groups",
    idField: "ID",
    canAdd: true,
    canDelete: false,
    wide: true,
    tableClass: "groups-table",
    tableWrapClass: "groups-table-wrap",
    lookups: [
      {
        key: "discounts",
        apiAction: "Discount"
      }
    ],
    xmlFields: [
      "ID",
      "Name",
      "Ind",
      "Sk01",
      "Sk02",
      "Sk03",
      "Sk04",
      "Sk05",
      "Sk06",
      "Sk07",
      "Sk08",
      "Sk09",
      "Sk10",
      "Sk11",
      "Sk12",
      "Sk13",
      "Sk14",
      "Sk15",
      "IdGroup"
    ],
    columns: [
      {
        field: "Name",
        labelKey: "Groups.Name",
        fallback: "Название",
        type: "text"
      },
      {
        field: "Ind",
        labelKey: "Groups.SortIndex",
        fallback: "Индекс сортировки",
        type: "nullable-number",
        step: "1",
        defaultValue: null
      },
      {
        field: "IdGroup",
        labelKey: "Groups.ParentGroup",
        fallback: "Родительская группа",
        type: "select",
        optionsFromRows: true,
        optionValueField: "ID",
        optionLabelField: "Name",
        defaultValue: 0,
        emptyOptionValue: 0,
        emptyOptionLabel: "",
        excludeCurrentId: true
      },
      {
        field: "Sk01",
        labelKey: "Groups.Sk01",
        fallback: "Sk01",
        type: "nullable-number",
        step: "0.01",
        defaultValue: null,
        headerClass: "sk-head",
        cellClass: "sk-cell",
        inputClass: "groups-sk-input",
        headerLookupKey: "discounts",
        headerLookupValue: 1,
        headerLookupValueField: "ID",
        headerLookupLabelField: "Name",
        headerLookupSecondaryField: "Discount",
        headerLookupBonusField: "isBon",
        headerBonusClass: "discount-bonus-head"
      },
      {
        field: "Sk02",
        labelKey: "Groups.Sk02",
        fallback: "Sk02",
        type: "nullable-number",
        step: "0.01",
        defaultValue: null,
        headerClass: "sk-head",
        cellClass: "sk-cell",
        inputClass: "groups-sk-input",
        headerLookupKey: "discounts",
        headerLookupValue: 2,
        headerLookupValueField: "ID",
        headerLookupLabelField: "Name",
        headerLookupSecondaryField: "Discount",
        headerLookupBonusField: "isBon",
        headerBonusClass: "discount-bonus-head"
      },
      {
        field: "Sk03",
        labelKey: "Groups.Sk03",
        fallback: "Sk03",
        type: "nullable-number",
        step: "0.01",
        defaultValue: null,
        headerClass: "sk-head",
        cellClass: "sk-cell",
        inputClass: "groups-sk-input",
        headerLookupKey: "discounts",
        headerLookupValue: 3,
        headerLookupValueField: "ID",
        headerLookupLabelField: "Name",
        headerLookupSecondaryField: "Discount",
        headerLookupBonusField: "isBon",
        headerBonusClass: "discount-bonus-head"
      },
      {
        field: "Sk04",
        labelKey: "Groups.Sk04",
        fallback: "Sk04",
        type: "nullable-number",
        step: "0.01",
        defaultValue: null,
        headerClass: "sk-head",
        cellClass: "sk-cell",
        inputClass: "groups-sk-input",
        headerLookupKey: "discounts",
        headerLookupValue: 4,
        headerLookupValueField: "ID",
        headerLookupLabelField: "Name",
        headerLookupSecondaryField: "Discount",
        headerLookupBonusField: "isBon",
        headerBonusClass: "discount-bonus-head"
      },
      {
        field: "Sk05",
        labelKey: "Groups.Sk05",
        fallback: "Sk05",
        type: "nullable-number",
        step: "0.01",
        defaultValue: null,
        headerClass: "sk-head",
        cellClass: "sk-cell",
        inputClass: "groups-sk-input",
        headerLookupKey: "discounts",
        headerLookupValue: 5,
        headerLookupValueField: "ID",
        headerLookupLabelField: "Name",
        headerLookupSecondaryField: "Discount",
        headerLookupBonusField: "isBon",
        headerBonusClass: "discount-bonus-head"
      },
      {
        field: "Sk06",
        labelKey: "Groups.Sk06",
        fallback: "Sk06",
        type: "nullable-number",
        step: "0.01",
        defaultValue: null,
        headerClass: "sk-head",
        cellClass: "sk-cell",
        inputClass: "groups-sk-input",
        headerLookupKey: "discounts",
        headerLookupValue: 6,
        headerLookupValueField: "ID",
        headerLookupLabelField: "Name",
        headerLookupSecondaryField: "Discount",
        headerLookupBonusField: "isBon",
        headerBonusClass: "discount-bonus-head"
      },
      {
        field: "Sk07",
        labelKey: "Groups.Sk07",
        fallback: "Sk07",
        type: "nullable-number",
        step: "0.01",
        defaultValue: null,
        headerClass: "sk-head",
        cellClass: "sk-cell",
        inputClass: "groups-sk-input",
        headerLookupKey: "discounts",
        headerLookupValue: 7,
        headerLookupValueField: "ID",
        headerLookupLabelField: "Name",
        headerLookupSecondaryField: "Discount",
        headerLookupBonusField: "isBon",
        headerBonusClass: "discount-bonus-head"
      },
      {
        field: "Sk08",
        labelKey: "Groups.Sk08",
        fallback: "Sk08",
        type: "nullable-number",
        step: "0.01",
        defaultValue: null,
        headerClass: "sk-head",
        cellClass: "sk-cell",
        inputClass: "groups-sk-input",
        headerLookupKey: "discounts",
        headerLookupValue: 8,
        headerLookupValueField: "ID",
        headerLookupLabelField: "Name",
        headerLookupSecondaryField: "Discount",
        headerLookupBonusField: "isBon",
        headerBonusClass: "discount-bonus-head"
      },
      {
        field: "Sk09",
        labelKey: "Groups.Sk09",
        fallback: "Sk09",
        type: "nullable-number",
        step: "0.01",
        defaultValue: null,
        headerClass: "sk-head",
        cellClass: "sk-cell",
        inputClass: "groups-sk-input",
        headerLookupKey: "discounts",
        headerLookupValue: 9,
        headerLookupValueField: "ID",
        headerLookupLabelField: "Name",
        headerLookupSecondaryField: "Discount",
        headerLookupBonusField: "isBon",
        headerBonusClass: "discount-bonus-head"
      },
      {
        field: "Sk10",
        labelKey: "Groups.Sk10",
        fallback: "Sk10",
        type: "nullable-number",
        step: "0.01",
        defaultValue: null,
        headerClass: "sk-head",
        cellClass: "sk-cell",
        inputClass: "groups-sk-input",
        headerLookupKey: "discounts",
        headerLookupValue: 10,
        headerLookupValueField: "ID",
        headerLookupLabelField: "Name",
        headerLookupSecondaryField: "Discount",
        headerLookupBonusField: "isBon",
        headerBonusClass: "discount-bonus-head"
      },
      {
        field: "Sk11",
        labelKey: "Groups.Sk11",
        fallback: "Sk11",
        type: "nullable-number",
        step: "0.01",
        defaultValue: null,
        headerClass: "sk-head",
        cellClass: "sk-cell",
        inputClass: "groups-sk-input",
        headerLookupKey: "discounts",
        headerLookupValue: 11,
        headerLookupValueField: "ID",
        headerLookupLabelField: "Name",
        headerLookupSecondaryField: "Discount",
        headerLookupBonusField: "isBon",
        headerBonusClass: "discount-bonus-head"
      },
      {
        field: "Sk12",
        labelKey: "Groups.Sk12",
        fallback: "Sk12",
        type: "nullable-number",
        step: "0.01",
        defaultValue: null,
        headerClass: "sk-head",
        cellClass: "sk-cell",
        inputClass: "groups-sk-input",
        headerLookupKey: "discounts",
        headerLookupValue: 12,
        headerLookupValueField: "ID",
        headerLookupLabelField: "Name",
        headerLookupSecondaryField: "Discount",
        headerLookupBonusField: "isBon",
        headerBonusClass: "discount-bonus-head"
      },
      {
        field: "Sk13",
        labelKey: "Groups.Sk13",
        fallback: "Sk13",
        type: "nullable-number",
        step: "0.01",
        defaultValue: null,
        headerClass: "sk-head",
        cellClass: "sk-cell",
        inputClass: "groups-sk-input",
        headerLookupKey: "discounts",
        headerLookupValue: 13,
        headerLookupValueField: "ID",
        headerLookupLabelField: "Name",
        headerLookupSecondaryField: "Discount",
        headerLookupBonusField: "isBon",
        headerBonusClass: "discount-bonus-head"
      },
      {
        field: "Sk14",
        labelKey: "Groups.Sk14",
        fallback: "Sk14",
        type: "nullable-number",
        step: "0.01",
        defaultValue: null,
        headerClass: "sk-head",
        cellClass: "sk-cell",
        inputClass: "groups-sk-input",
        headerLookupKey: "discounts",
        headerLookupValue: 14,
        headerLookupValueField: "ID",
        headerLookupLabelField: "Name",
        headerLookupSecondaryField: "Discount",
        headerLookupBonusField: "isBon",
        headerBonusClass: "discount-bonus-head"
      },
      {
        field: "Sk15",
        labelKey: "Groups.Sk15",
        fallback: "Sk15",
        type: "nullable-number",
        step: "0.01",
        defaultValue: null,
        headerClass: "sk-head",
        cellClass: "sk-cell",
        inputClass: "groups-sk-input",
        headerLookupKey: "discounts",
        headerLookupValue: 15,
        headerLookupValueField: "ID",
        headerLookupLabelField: "Name",
        headerLookupSecondaryField: "Discount",
        headerLookupBonusField: "isBon",
        headerBonusClass: "discount-bonus-head"
      }
    ]
  },
  "08.05": {
    apiAction: "Categor",
    xmlSection: "Categor",
    deletedSection: "Deleted",
    idField: "ID",
    canAdd: true,
    canDelete: true,
    columns: [
      {
        field: "Name",
        labelKey: "Directory.Name",
        fallback: "Наименование",
        type: "text"
      }
    ]
  },
  "08.11": {
    apiAction: "Discount",
    xmlSection: "Discount",
    deletedSection: "Deleted",
    idField: "ID",
    canAdd: false,
    canDelete: false,
    columns: [
      {
        field: "Name",
        labelKey: "Directory.Name",
        fallback: "Название",
        type: "text"
      },
      {
        field: "Discount",
        labelKey: "Directory.DiscountPercent",
        fallback: "Скидка, %",
        type: "number",
        step: "any"
      },
      {
        field: "isBon",
        labelKey: "Directory.Bonus",
        fallback: "Бонусная",
        type: "boolean",
        defaultValue: false
      }
    ]
  },
  "08.12": {
    apiAction: "Fop",
    saveAction: "Tax",
    xmlSection: "Tax",
    deletedSection: "Deleted",
    idField: "ID",
    canAdd: true,
    canDelete: true,
    columns: [
      {
        field: "Name",
        labelKey: "Directory.Name",
        fallback: "Наименование",
        type: "text"
      },
      {
        field: "TaxGroup",
        labelKey: "Directory.TaxGroup",
        fallback: "Налоговая группа",
        type: "select",
        options: [
          { ID: 1, Name: "А" },
          { ID: 2, Name: "Б" },
          { ID: 3, Name: "В" },
          { ID: 4, Name: "Г" },
          { ID: 5, Name: "Д" },
          { ID: 6, Name: "Е" },
          { ID: 7, Name: "Ж" },
          { ID: 8, Name: "З" }
        ],
        optionValueField: "ID",
        optionLabelField: "Name",
        defaultValue: 0,
        emptyOptionValue: 0,
        emptyOptionLabel: "нет"
      },
      {
        field: "IfNoSelect",
        labelKey: "Directory.Default",
        fallback: "По умолчанию",
        type: "boolean",
        defaultValue: false
      }
    ]
  },
  "08.07": {
    apiAction: "ZatrSpis",
    xmlSection: "ZatrSpis",
    deletedSection: "Deleted",
    idField: "ID",
    canAdd: true,
    canDelete: true,
    columns: [
      {
        field: "NameZatr",
        labelKey: "Directory.Name",
        fallback: "Наименование",
        type: "text"
      },
      {
        field: "Bel",
        labelKey: "Directory.Bel",
        fallback: "Bel",
        type: "boolean"
      }
    ]
  },
  "08.08": {
    apiAction: "ZatrKass",
    xmlSection: "ZatrKass",
    deletedSection: "Deleted",
    idField: "ID",
    canAdd: true,
    canDelete: true,
    columns: [
      {
        field: "NameZatr",
        labelKey: "Directory.Name",
        fallback: "Наименование",
        type: "text"
      },
      {
        field: "IdRazdel",
        labelKey: "Directory.Section",
        fallback: "Раздел",
        type: "select",
        optionsAction: "ZatrKassRazd",
        optionValueField: "ID",
        optionLabelField: "NameRazd"
      },
      {
        field: "Nach",
        labelKey: "Directory.Nach",
        fallback: "Начисление",
        type: "boolean"
      }
    ]
  },
  "08.09": {
    apiAction: "DohodKass",
    xmlSection: "DohodKass",
    deletedSection: "Deleted",
    idField: "ID",
    canAdd: true,
    canDelete: true,
    columns: [
      {
        field: "NameDohod",
        labelKey: "Directory.Name",
        fallback: "Наименование",
        type: "text"
      },
      {
        field: "VidD",
        labelKey: "Directory.ActivityType",
        fallback: "Вид деятельности",
        type: "select",
        optionsAction: "DohodKassRazd",
        optionValueField: "ID",
        optionLabelField: "NameVidI"
      },
      {
        field: "Dohod",
        labelKey: "Directory.Income",
        fallback: "Доход",
        type: "boolean"
      }
    ]
  },
  "08.10": {
    kind: "subdivisions"
  },
  "08.13": {
    apiAction: "ValutsKup",
    xmlSection: "ValutsKup",
    deletedSection: "Deleted",
    idField: "ID",
    canAdd: true,
    canDelete: true,
    columns: [
      {
        field: "Name",
        labelKey: "Directory.Name",
        fallback: "Наименование",
        type: "text"
      },
      {
        field: "Rate",
        labelKey: "Directory.Rate",
        fallback: "Курс",
        type: "number",
        step: "0.01"
      }
    ]
  },
  "08.14": {
    apiAction: "PrichV",
    xmlSection: "PrichV",
    deletedSection: "Deleted",
    idField: "ID",
    canAdd: true,
    canDelete: true,
    columns: [
      {
        field: "Prichina",
        labelKey: "Directory.ReturnReason",
        fallback: "Причина возврата",
        type: "text"
      },
      {
        field: "Spis",
        labelKey: "Directory.WriteOff",
        fallback: "Списывать",
        type: "boolean"
      },
      {
        field: "Zatr",
        labelKey: "Directory.WriteOffExpense",
        fallback: "Затраты для списания",
        type: "select",
        optionsAction: "ZatrSpis",
        optionValueField: "ID",
        optionLabelField: "NameZatr",
        defaultValue: 0,
        emptyOptionValue: 0,
        emptyOptionLabel: "—"
      }
    ]
  },
  "08.15": {
    apiAction: "Konsum",
    xmlSection: "Konsum",
    deletedSection: "Deleted",
    idField: "ID",
    canAdd: true,
    canDelete: true,
    columns: [
      {
        field: "Consum",
        labelKey: "Directory.Name",
        fallback: "Наименование",
        type: "text"
      },
      {
        field: "Perc",
        labelKey: "Directory.Percent",
        fallback: "Процент",
        type: "number",
        step: "any"
      },
      {
        field: "Skr",
        labelKey: "Directory.Hidden",
        fallback: "Скрыт",
        type: "boolean"
      }
    ]
  },
  "08.16": {
    apiAction: "TypDish",
    xmlSection: "TypDish",
    deletedSection: "Deleted",
    idField: "ID",
    canAdd: true,
    canDelete: true,
    columns: [
      {
        field: "Name",
        labelKey: "Directory.Name",
        fallback: "Наименование",
        type: "text"
      }
    ]
  },
  "08.17": {
    apiAction: "Act",
    xmlSection: "Act",
    deletedSection: "Deleted",
    idField: "ID",
    canAdd: true,
    canDelete: true,
    wide: true,
    columns: [
      {
        field: "Name",
        labelKey: "Directory.Name",
        fallback: "Наименование",
        type: "text"
      },
      {
        field: "Counter",
        labelKey: "Directory.Quantity",
        fallback: "Количество",
        type: "number",
        step: "1"
      },
      {
        field: "Skr",
        labelKey: "Directory.Hidden",
        fallback: "Скрыт",
        type: "boolean"
      },
      {
        field: "IDGroup",
        labelKey: "Directory.ActionGroup",
        fallback: "Группа акции",
        type: "search-select",
        optionsUrl: "wf_GroupsDish.php",
        optionValueField: "ID",
        optionLabelField: "Name",
        defaultValue: 0,
        emptyOptionValue: 0,
        emptyOptionLabel: "—"
      },
      {
        field: "IDTov",
        labelKey: "Directory.Dish",
        fallback: "Блюдо",
        type: "search-select",
        optionsUrl: "wf_DishesAll.php",
        optionValueField: "ID",
        optionLabelField: "Name",
        optionSecondaryField: "SkladName",
        defaultValue: 0,
        emptyOptionValue: 0,
        emptyOptionLabel: "—"
      },
      {
        field: "MinSumm",
        labelKey: "Directory.MinAmount",
        fallback: "Мин. сумма",
        type: "number",
        step: "0.01"
      },
      {
        field: "Price",
        labelKey: "Directory.Price",
        fallback: "Цена",
        type: "number",
        step: "0.01"
      }
    ]
  },
  "08.18": {
    apiAction: "Divin",
    xmlSection: "Divin",
    deletedSection: "Deleted",
    idField: "ID",
    canAdd: true,
    canDelete: true,
    columns: [
      {
        field: "Divination",
        labelKey: "Directory.Divination",
        fallback: "Предсказание",
        type: "text"
      }
    ]
  },
  "08.19": {
    apiAction: "Shtraf",
    xmlSection: "Shtraf",
    deletedSection: "Deleted",
    idField: "ID",
    canAdd: true,
    canDelete: true,
    columns: [
      {
        field: "NameShtr",
        labelKey: "Directory.Name",
        fallback: "Наименование",
        type: "text"
      },
      {
        field: "Summ",
        labelKey: "Directory.Amount",
        fallback: "Сумма",
        type: "number",
        step: "0.01"
      }
    ]
  },
  "08.20": {
    apiAction: "Zal",
    xmlSection: "Zal",
    deletedSection: "Deleted",
    idField: "ID",
    canAdd: true,
    canDelete: true,
    columns: [
      {
        field: "Name",
        labelKey: "Directory.Name",
        fallback: "Наименование",
        type: "text"
      },
      {
        field: "Numb",
        labelKey: "Directory.Number",
        fallback: "Номер",
        type: "number",
        step: "1"
      }
    ]
  }
};

function getDirectoryMenuConfig(code) {
  return DIRECTORY_MENU_CONFIGS[normalizeMenuCode(code)] ?? null;
}

function isTenantMultiPoint(tenantInfo) {
  return parseBooleanFlag(
    tenantInfo?.MultiPoint ?? tenantInfo?.multiPoint ?? tenantInfo?.multipoint
  );
}

function isTenantBonusEnabled(tenantInfo) {
  return parseBooleanFlag(
    tenantInfo?.Bon ?? tenantInfo?.bon
  );
}

function createLocalDate(year, month, day) {
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  date.setHours(0, 0, 0, 0);
  return date;
}

function parseLicenseDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return createLocalDate(
      value.getFullYear(),
      value.getMonth() + 1,
      value.getDate()
    );
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = Math.abs(value) < 1_000_000_000_000
      ? value * 1000
      : value;

    const date = new Date(milliseconds);

    if (!Number.isNaN(date.getTime())) {
      return createLocalDate(
        date.getFullYear(),
        date.getMonth() + 1,
        date.getDate()
      );
    }
  }

  const textValue = String(value ?? "").trim();

  if (!textValue) {
    return null;
  }

  let match = textValue.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (match) {
    return createLocalDate(
      Number(match[1]),
      Number(match[2]),
      Number(match[3])
    );
  }

  match = textValue.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);

  if (match) {
    return createLocalDate(
      Number(match[3]),
      Number(match[2]),
      Number(match[1])
    );
  }

  const fallbackDate = new Date(textValue);

  if (Number.isNaN(fallbackDate.getTime())) {
    return null;
  }

  return createLocalDate(
    fallbackDate.getFullYear(),
    fallbackDate.getMonth() + 1,
    fallbackDate.getDate()
  );
}

function getLocalToday() {
  const now = new Date();

  return createLocalDate(
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate()
  );
}

function getLicenseStatus(licenseInfo) {
  if (!licenseInfo || typeof licenseInfo !== "object") {
    return {
      validUntil: "",
      validUntilDate: null,
      daysLeft: null,
      isExpired: false,
      shouldWarn: false
    };
  }

  const validUntil =
    licenseInfo.validUntil ??
    licenseInfo.ValidUntil ??
    licenseInfo.dateEnd ??
    licenseInfo.DateEnd ??
    licenseInfo.endDate ??
    "";

  const validUntilDate = parseLicenseDate(validUntil);
  const today = getLocalToday();

  let daysLeft = null;

  if (validUntilDate && today) {
    const validUntilDay = Date.UTC(
      validUntilDate.getFullYear(),
      validUntilDate.getMonth(),
      validUntilDate.getDate()
    );

    const todayDay = Date.UTC(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );

    daysLeft = Math.round(
      (validUntilDay - todayDay) / MILLISECONDS_PER_DAY
    );
  } else {
    const rawServerDaysLeft = licenseInfo.daysLeft;

    if (
      rawServerDaysLeft !== null &&
      rawServerDaysLeft !== undefined &&
      String(rawServerDaysLeft).trim() !== ""
    ) {
      const serverDaysLeft = Number(rawServerDaysLeft);

      if (Number.isFinite(serverDaysLeft)) {
        daysLeft = Math.trunc(serverDaysLeft);
      }
    }
  }

  const isExpired =
    parseBooleanFlag(licenseInfo.isExpired) ||
    (daysLeft !== null && daysLeft < 0);

  return {
    validUntil: String(validUntil || ""),
    validUntilDate,
    daysLeft,
    isExpired,
    shouldWarn:
      !isExpired &&
      daysLeft !== null &&
      daysLeft >= 0 &&
      daysLeft < 3
  };
}

function formatLicenseDate(date, fallback = "") {
  if (!date) {
    return String(fallback || "");
  }

  return new Intl.DateTimeFormat("ru-RU").format(date);
}

function buildLicenseExpiredMessage(status) {
  const dateText = formatLicenseDate(
    status.validUntilDate,
    status.validUntil
  );

  return dateText
    ? `Срок действия лицензии закончился ${dateText}. Вход в BarBo$$ Web Office невозможен.`
    : "Срок действия лицензии закончился. Вход в BarBo$$ Web Office невозможен.";
}

function buildLicenseWarningMessage(status) {
  const dateText = formatLicenseDate(
    status.validUntilDate,
    status.validUntil
  );

  if (status.daysLeft === 0) {
    return dateText
      ? `Внимание! Срок действия лицензии заканчивается сегодня, ${dateText}.`
      : "Внимание! Срок действия лицензии заканчивается сегодня.";
  }

  if (status.daysLeft === 1) {
    return dateText
      ? `Внимание! Срок действия лицензии заканчивается завтра, ${dateText}.`
      : "Внимание! До окончания лицензии остался 1 день.";
  }

  return dateText
    ? `Внимание! До окончания лицензии осталось ${status.daysLeft} дня. Лицензия действует до ${dateText}.`
    : `Внимание! До окончания лицензии осталось ${status.daysLeft} дня.`;
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

function resolvePrihListPeriod(data, requestDate1, requestDate2, items) {
  const periodValue =
    data?.period ??
    data?.Period ??
    {};

  const source = Array.isArray(periodValue)
    ? periodValue[0] ?? {}
    : periodValue;

  const itemDates = (Array.isArray(items) ? items : [])
    .map((row) =>
      normalizeDateInputValue(
        row?.DateP ??
        row?.dateP ??
        row?.Date ??
        row?.date
      )
    )
    .filter(Boolean)
    .sort();

  const requestedDate1 = normalizeDateInputValue(requestDate1);
  const requestedDate2 = normalizeDateInputValue(requestDate2);

  const date1 =
    normalizeDateInputValue(
      source.Date1 ??
      source.date1 ??
      source.FromDate ??
      source.fromDate ??
      data?.Date1 ??
      data?.date1 ??
      data?.FromDate ??
      data?.fromDate
    ) ||
    requestedDate1 ||
    itemDates[0] ||
    "";

  const date2 =
    normalizeDateInputValue(
      source.Date2 ??
      source.date2 ??
      source.ToDate ??
      source.toDate ??
      data?.Date2 ??
      data?.date2 ??
      data?.ToDate ??
      data?.toDate
    ) ||
    requestedDate2 ||
    itemDates[itemDates.length - 1] ||
    date1;

  return {
    Date1: date1,
    Date2: date2
  };
}

export default function App() {
  const [accessToken, setAccessToken] = useState("");
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [moldovaMode, setMoldovaMode] = useState(false);
  const [license, setLicense] = useState(null);
  const [menu, setMenu] = useState([]);
  const [sideMenuCollapsed, setSideMenuCollapsed] = useState(true);
  const sideMenuCloseTimerRef = useRef(null);
  const [selectedAction, setSelectedAction] = useState("");
  const [selectedMenuCode, setSelectedMenuCode] = useState("");
  const [selectedApiAction, setSelectedApiAction] = useState("");
  const [reportAll, setReportAll] = useState(1);
  const [loading, setLoading] = useState(false);
  const [workData, setWorkData] = useState(null);
  const [workTitle, setWorkTitle] = useState("");
  const [workLoading, setWorkLoading] = useState(false);
  const [reportGenerationSeconds, setReportGenerationSeconds] = useState(0);
  const [workError, setWorkError] = useState("");
  const [sklads, setSklads] = useState([]);
  const [currentSklad, setCurrentSklad] = useState("");
  const [organizations, setOrganizations] = useState([]);
  const [currentOrg, setCurrentOrg] = useState("");
  const [points, setPoints] = useState([]);
  const [currentPoint, setCurrentPoint] = useState("");
  const [directoryLookups, setDirectoryLookups] = useState({});
  const [selectedDirectoryGroupId, setSelectedDirectoryGroupId] = useState(null);
  const [groupsDirectoryDirty, setGroupsDirectoryDirty] = useState(false);
  const [groupsHappyDirty, setGroupsHappyDirty] = useState(false);
  const [groupsHappyOpen, setGroupsHappyOpen] = useState(false);
  const [groupsHappyRows, setGroupsHappyRows] = useState([]);
  const [groupsHappyLoading, setGroupsHappyLoading] = useState(false);
  const [groupsHappyError, setGroupsHappyError] = useState("");
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
  const [prihPfMode, setPrihPfMode] = useState(false);
  const [siryaCategories, setSiryaCategories] = useState([]);
  const [siryaCat, setSiryaCat] = useState("0");
  const [spisokTovarovCat, setSpisokTovarovCat] = useState("0");
  const [spisokTovarovSkr, setSpisokTovarovSkr] = useState(0);
  const [dishCalcId, setDishCalcId] = useState(null);
  const [dishSelectedId, setDishSelectedId] = useState(null);
  const [prihInvoiceId, setPrihInvoiceId] = useState(null);
  const [prihSelectedInvoiceId, setPrihSelectedInvoiceId] = useState(null);
  const [peremSelectedInvoiceId, setPeremSelectedInvoiceId] = useState(null);
  const [spisanTovSelectedInvoiceId, setSpisanTovSelectedInvoiceId] = useState(null);
  const [spisanBludSelectedInvoiceId, setSpisanBludSelectedInvoiceId] = useState(null);
  const [prihInitialData, setPrihInitialData] = useState(null);
  const [prihListRowHint, setPrihListRowHint] = useState(null);
  const [prihMode, setPrihMode] = useState("edit");
  const [prihWasSaved, setPrihWasSaved] = useState(false);
  const [invoiceKind, setInvoiceKind] = useState("prih");
  const [spisanInitialData, setSpisanInitialData] = useState(null);
  const [spisanBludInitialData, setSpisanBludInitialData] = useState(null);
  const today = new Date().toISOString().slice(0, 10);
  const [reportDateFrom, setReportDateFrom] = useState(today);
  const [reportDateTo, setReportDateTo] = useState(today);
  const [kassaDate, setKassaDate] = useState(today);
  const [currentValut, setCurrentValut] = useState(1);
  const [ordersDate, setOrdersDate] = useState(new Date().toISOString().slice(0, 10));
  const [viewOrderId, setViewOrderId] = useState(null);
  const [viewSourceOrder, setViewSourceOrder] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isPrihPrintPreviewOpen, setIsPrihPrintPreviewOpen] = useState(false);
  const [language, setLanguage] = useState(getInitialLanguage);
  const [translations, setTranslations] = useState({});

  const locale = useMemo(() => getLanguageLocale(language), [language]);

  const t = useMemo(() => {
    return (key, fallback = "") => translations[key] ?? fallback;
  }, [translations]);

  useEffect(() => {
    const isHeavyReport =
      selectedAction.toLowerCase() === "wbr_reports" &&
      ["05.03", "05.04", "05.07", "05.19", "05.08.10", "05.14.05"].includes(
        normalizeMenuCode(selectedMenuCode)
      );

    if (!workLoading || !isHeavyReport) {
      setReportGenerationSeconds(0);
      return undefined;
    }

    const startedAt = Date.now();
    setReportGenerationSeconds(0);

    const timerId = window.setInterval(() => {
      setReportGenerationSeconds(
        Math.floor((Date.now() - startedAt) / 1000)
      );
    }, 250);

    return () => {
      window.clearInterval(timerId);
    };
  }, [workLoading, selectedAction, selectedMenuCode]);

  const groupsHappyDayOptions = useMemo(
    () => [
      { ID: 0, Name: t("HappyHours.AllDays", "Все дни") },
      { ID: 1, Name: t("HappyHours.Monday", "Понедельник") },
      { ID: 2, Name: t("HappyHours.Tuesday", "Вторник") },
      { ID: 3, Name: t("HappyHours.Wednesday", "Среда") },
      { ID: 4, Name: t("HappyHours.Thursday", "Четверг") },
      { ID: 5, Name: t("HappyHours.Friday", "Пятница") },
      { ID: 6, Name: t("HappyHours.Saturday", "Суббота") },
      { ID: 7, Name: t("HappyHours.Sunday", "Воскресенье") }
    ],
    [t]
  );

  const groupsHappyConfig = useMemo(
    () => ({
      apiAction: "HHgrup",
      xmlSection: "HHgrup",
      deletedSection: "Deleted",
      idField: "ID",
      canAdd: true,
      canDelete: true,
      deletedFields: [
        {
          field: "IdGrup",
          type: "number",
          value: Number(selectedDirectoryGroupId || 0)
        }
      ],
      columns: [
        {
          field: "IdGrup",
          type: "number",
          hidden: true,
          defaultValue: Number(selectedDirectoryGroupId || 0)
        },
        {
          field: "Beg",
          labelKey: "HappyHours.Begin",
          fallback: "Начало",
          type: "time",
          defaultValue: ""
        },
        {
          field: "Endd",
          labelKey: "HappyHours.End",
          fallback: "Конец",
          type: "time",
          defaultValue: ""
        },
        {
          field: "Skid",
          labelKey: "HappyHours.Discount",
          fallback: "Скидка %",
          type: "number",
          step: "0.01",
          defaultValue: 0
        },
        {
          field: "DayN",
          labelKey: "HappyHours.Day",
          fallback: "День",
          type: "select",
          options: groupsHappyDayOptions,
          optionValueField: "ID",
          optionLabelField: "Name",
          defaultValue: 0
        },
        {
          field: "isActive",
          labelKey: "HappyHours.Active",
          fallback: "Активно",
          type: "boolean",
          defaultValue: true
        }
      ]
    }),
    [selectedDirectoryGroupId, groupsHappyDayOptions]
  );

  const selectedDirectoryGroup = useMemo(() => {
    if (normalizeMenuCode(selectedMenuCode) !== "08.04" || !Array.isArray(workData)) {
      return null;
    }

    return (
      workData.find(
        (row) => String(row?.ID ?? "") === String(selectedDirectoryGroupId ?? "")
      ) ?? null
    );
  }, [selectedMenuCode, selectedDirectoryGroupId, workData]);

  useEffect(() => {
    if (
      selectedAction.toLowerCase() === "wbo_directory" &&
      normalizeMenuCode(selectedMenuCode) === "08.04"
    ) {
      setHasUnsavedChanges(Boolean(groupsDirectoryDirty || groupsHappyDirty));
    }
  }, [selectedAction, selectedMenuCode, groupsDirectoryDirty, groupsHappyDirty]);


  function cancelSideMenuClose() {
    if (sideMenuCloseTimerRef.current !== null) {
      window.clearTimeout(sideMenuCloseTimerRef.current);
      sideMenuCloseTimerRef.current = null;
    }
  }

  function openSideMenu() {
    cancelSideMenuClose();
    setSideMenuCollapsed(false);
  }

  function scheduleSideMenuClose() {
    cancelSideMenuClose();

    sideMenuCloseTimerRef.current = window.setTimeout(() => {
      setSideMenuCollapsed(true);
      sideMenuCloseTimerRef.current = null;
    }, SIDE_MENU_CLOSE_DELAY_MS);
  }

  function handleSideMenuSelect(item) {
    cancelSideMenuClose();
    setSideMenuCollapsed(true);
    openAction(item);
  }

  useEffect(() => {
    return () => {
      if (sideMenuCloseTimerRef.current !== null) {
        window.clearTimeout(sideMenuCloseTimerRef.current);
      }
    };
  }, []);

  const currentMenuTitle = useMemo(() => {
    const menuItem = findMenuItemByAction(
      menu,
      selectedAction,
      selectedMenuCode
    );

    return menuItem?.name ?? menuItem?.Name ?? "";
  }, [menu, selectedAction, selectedMenuCode]);

  const displayedWorkTitle =
    currentMenuTitle ||
    workTitle ||
    t("App.WorkArea", "Рабочая область");

  const userReadOnlyMode = parseBooleanFlag(
    user?.readOnly ?? user?.readonly
  );

  const unsavedChangesMessage = t(
    "App.UnsavedChangesWarning",
    "Внимание! Вы не сохранили измененные данные!\nУверены, что хотите уйти?"
  );

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
  const actionName = normalizeMenuActionKey(selectedAction).toLowerCase();

  if (actionName === "wf_kassa.php" && accessToken) {
    loadKassaPage(kassaDate);
  }

  // 08.03 (Поставщики) зависит от выбранной организации: Dolg1/Dolg2
  // могут отличаться для одного и того же поставщика в разных Org.
  // Поэтому здесь намеренно проверяем только стабильный Code пункта меню,
  // а не action — wbo_Directory может иметь разное написание/расширение.
  if (
    normalizeMenuCode(selectedMenuCode) === "08.03" &&
    accessToken
  ) {
    setWorkLoading(true);
    setWorkError("");

    loadDirectoryByMenuCode("08.03")
      .then((data) => {
        if (Array.isArray(data)) {
          setPostavList(data);
        }
      })
      .catch((err) => {
        setWorkError(err?.message || "Ошибка загрузки списка поставщиков");
      })
      .finally(() => {
        setWorkLoading(false);
      });
  }

  // Здесь намеренно реагируем только на смену организации.
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [currentOrg]);

useEffect(() => {
  const actionName = normalizeMenuActionKey(selectedAction).toLowerCase();

  if (
    actionName !== "wf_prihlist.php" ||
    !currentSklad ||
    !accessToken
  ) {
    return;
  }

  console.log("[language] reload prih list", {
    language,
    selectedAction,
    sklad: currentSklad,
    post: prihPost,
    d1: prihDate1 || 0,
    d2: prihDate2 || 0
  });

  loadPrihList({
    sklad: currentSklad,
    post: prihPost,
    d1: prihDate1 || 0,
    d2: prihDate2 || 0,
    lang: language,
    pf: prihPfMode ? 1 : 0
  });
  // Перезагрузка нужна только при фактическом изменении языка.
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [language]);

async function applyLanguage(nextLanguage, request = fetchWithAuth) {
  const safeLanguage = normalizeLanguage(nextLanguage);
  const translationMap = await loadTranslations(safeLanguage, request);

  setTranslations(translationMap);
  setLanguage(safeLanguage);
  persistLanguage(safeLanguage);
}

async function handleAppLanguageChange(event) {
  const nextLanguage = normalizeLanguage(event.target.value);

  if (nextLanguage === language) {
    return;
  }

  try {
    // Сначала загружаем оба набора данных. Язык переключаем только после
    // успешной загрузки переводов формы и локализованного левого меню.
    console.log("[language] change", {
      from: language,
      to: nextLanguage
    });

    const [translationMap, menuData] = await Promise.all([
      loadTranslations(nextLanguage, fetchWithAuth),
      menuRequest(accessToken, nextLanguage)
    ]);

    console.log("[language] applying menu", {
      language: nextLanguage,
      isArray: Array.isArray(menuData),
      count: Array.isArray(menuData)
        ? menuData.length
        : Array.isArray(menuData?.menu)
          ? menuData.menu.length
          : 0
    });

    setTranslations(translationMap);
    setMenu(Array.isArray(menuData?.menu) ? menuData.menu : menuData);
    setLanguage(nextLanguage);
    persistLanguage(nextLanguage);

  } catch (err) {
    window.alert(
      err.message ||
        t("App.TranslationLoadError", "Ошибка загрузки переводов")
    );
  }
}

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
  setPrihWasSaved(false);
  setPeremSelectedInvoiceId(Number(nakl.ID));
  setPrihInvoiceId(Number(nakl.ID));
  setPrihInitialData(null);
  setPrihMode("edit");
  setSelectedAction("prih-invoice-card");
  setWorkTitle("Накладная перемещения");
  setWorkError("");
}

async function createPrihInvoice() {
  if (!currentSklad) {
    setWorkError("Не выбран склад для приходной накладной");
    return;
  }

  try {
    // wf_PrihNew больше ничего не создаёт в SQL: только выдаёт следующий
    // номер накладной и признак Moldova для локального draft-документа.
    const response = await fetchWithAuth(
      "https://webback.bar-boss.com/wf_PrihNew.php",
      { method: "GET" }
    );
    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        "Номер новой накладной вернул не JSON: " + text.substring(0, 500)
      );
    }

    const info = Array.isArray(data) ? data[0] : data;

    if (!response.ok || info?.status === "error") {
      throw new Error(
        info?.error ||
          info?.message ||
          "Ошибка получения номера новой приходной накладной"
      );
    }

    const nomNakl = Number(info?.NomNakl || 0);

    if (nomNakl <= 0) {
      throw new Error("Сервер не вернул NomNakl новой приходной накладной");
    }

    // Web-native draft: до первого Save в SQL самой накладной не существует.
    const draftId = -Date.now();
    const draftInvoice = {
      ID: draftId,
      Invoice: nomNakl,
      DateP: today,
      Rem: "",
      VAT: false,
      ProcVat: 0,
      IdSklPer: 0,
      IdSkl: Number(currentSklad || 0),
      Oplach: false,
      Post: 0,
      SupplierName: "",
      Form: 0,
      Bel: false,
      Vozv: false,
      Moldova: Number(info?.Moldova || 0),
      pf: false,
      zach: false,
      items: []
    };

    setInvoiceKind("prih");
    setPrihWasSaved(false);
    setPrihInvoiceId(draftId);
    setPrihInitialData(draftInvoice);
    setPrihListRowHint(null);
    setPrihMode("new");
    setSelectedAction("prih-invoice-card");
    setWorkTitle("Новая приходная накладная");
    setWorkError("");
  } catch (err) {
    alert(
      err?.message ||
        "Ошибка получения номера новой приходной накладной"
    );
  }
}

async function createPrihSpecialInvoice(kind) {
  const isPf = kind === "pf";
  const isZach = kind === "zach";

  try {
    const url = new URL("https://webback.bar-boss.com/wf_PrihNew.php");
    url.searchParams.set("Sklad", String(currentSklad || ""));
    url.searchParams.set("pf", isPf ? "1" : "0");
    url.searchParams.set("zach", isZach ? "1" : "0");

    const response = await fetchWithAuth(url.toString(), { method: "GET" });
    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        (isPf ? "Новая накладная производства" : "Новая зачистка") +
          " вернула не JSON: " +
          text.substring(0, 500)
      );
    }

    if (!response.ok || data?.status === "error") {
      throw new Error(
        data?.error ||
          data?.message ||
          (isPf
            ? "Ошибка создания накладной производства"
            : "Ошибка создания накладной зачистки")
      );
    }

    const invoice = Array.isArray(data) ? data[0] : data;

    if (!invoice || !invoice.ID) {
      throw new Error("Сервер не вернул ID новой накладной");
    }

    setInvoiceKind(isPf ? "pf" : "zach");
    setPrihWasSaved(false);
    setPrihInvoiceId(Number(invoice.ID));
    setPrihSelectedInvoiceId(Number(invoice.ID));
    setPrihInitialData({
      ...invoice,
      pf: isPf,
      zach: isZach
    });
    setPrihListRowHint(null);
    setPrihMode("new");
    setSelectedAction("prih-invoice-card");
    setWorkTitle(
      isPf ? "Новая накладная производства ПФ" : "Новая накладная зачистки"
    );
    setWorkError("");
  } catch (err) {
    alert(
      err.message ||
        (isPf
          ? "Ошибка создания накладной производства"
          : "Ошибка создания накладной зачистки")
    );
  }
}

function openSpisanTovInvoice(spisan) {
  if (!spisan?.ID) {
    setWorkError("Не найден ID накладной списания");
    return;
  }

  setSpisanTovSelectedInvoiceId(Number(spisan.ID));
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

// NEW ORDER FIX 2026-08-24: single guarded transition to the new-order screen.
function openNewOrder() {
  if (userReadOnlyMode) {
    return;
  }

  setViewOrderId(null);
  setViewSourceOrder(null);
  setSelectedAction("order-new");
  setWorkTitle(t("OrderNew.Title", "Новый заказ"));
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


async function loadClientReportsNavigator() {
  setWorkLoading(true);
  setWorkError("");
  setWorkData(null);

  try {
    const response = await fetchWithAuth(
      "https://webback.bar-boss.com/wf_CliKass.php"
    );

    const text = await response.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        "Список клиентов вернул не JSON: " +
          text.substring(0, 500)
      );
    }

    if (
      !response.ok ||
      data?.status === "error"
    ) {
      throw new Error(
        data?.error ||
          data?.message ||
          "Ошибка загрузки списка клиентов"
      );
    }

    setWorkData({
      report: "ClientReportsNavigator",
      data: {
        Clients: Array.isArray(data)
          ? data
          : []
      }
    });

    return data;
  } catch (error) {
    setWorkError(
      error?.message ||
        "Ошибка загрузки списка клиентов"
    );
    return null;
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
        `https://webback.bar-boss.com/wf_KassaRashod.php?Date=${apiDate}&Org=${encodeURIComponent(String(getCurrentOrgCode()))}`
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
    // Как и обычный приход, новое перемещение до Save существует только
    // на frontend. wf_PrihNew теперь нужен лишь для номера и Moldova.
    const response = await fetchWithAuth(
      "https://webback.bar-boss.com/wf_PrihNew.php",
      { method: "GET" }
    );
    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        "Номер нового перемещения вернул не JSON: " + text.substring(0, 500)
      );
    }

    const info = Array.isArray(data) ? data[0] : data;

    if (!response.ok || info?.status === "error") {
      throw new Error(
        info?.error ||
          info?.message ||
          "Ошибка получения номера нового перемещения"
      );
    }

    const nomNakl = Number(info?.NomNakl || 0);

    if (nomNakl <= 0) {
      throw new Error("Сервер не вернул NomNakl нового перемещения");
    }

    const draftId = -Date.now();
    const moveInvoice = {
      ID: draftId,
      Invoice: nomNakl,
      DateP: today,
      Rem: "",
      VAT: false,
      ProcVat: 0,

      // Склад, ОТКУДА уходит товар.
      IdSklPer: Number(currentSklad),

      // Склад назначения пользователь выберет в форме.
      IdSkl: 0,

      Post: 0,
      SupplierName: "",
      Form: 0,
      Oplach: false,
      Bel: false,
      Vozv: false,
      Moldova: Number(info?.Moldova || 0),
      pf: false,
      zach: false,
      items: []
    };

    setInvoiceKind("move");
    setPrihWasSaved(false);
    setPrihInvoiceId(draftId);
    setPrihInitialData(moveInvoice);
    setPrihListRowHint(null);
    setPrihMode("new");
    setSelectedAction("prih-invoice-card");
    setWorkTitle("Новая накладная перемещения");
    setWorkError("");
  } catch (err) {
    alert(err?.message || "Ошибка получения номера нового перемещения");
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

    setSpisanTovSelectedInvoiceId(Number(invoice.ID));
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

  setSpisanBludSelectedInvoiceId(Number(spisan.ID));
  setSpisanBludInitialData(spisan);
  setSelectedAction("spisan-blud-invoice-card");
  setWorkTitle("Накладная списания блюд");
  setWorkError("");
}
function backToSpisanBludList() {
  setSpisanBludInitialData(null);
  loadSpisanBludList();
}
function createSpisanBludInvoice() {
  const localId = -Date.now();

  // Новое списание живёт только во frontend до нажатия «Сохранить».
  // Никаких INSERT/служебных вызовов при открытии карточки больше нет.
  setSpisanBludSelectedInvoiceId(null);
  setSpisanBludInitialData({
    ID: localId,
    Nakl: "",
    DateP: "",
    CodSpis: 0,
    NazvSpisania: "",
    Rem: "",
    items: []
  });
  setSelectedAction("spisan-blud-invoice-card");
  setWorkTitle("Новое списание блюд");
  setWorkError("");
}

function openPrihInvoice(invoiceOrId) {
  const row =
    invoiceOrId && typeof invoiceOrId === "object"
      ? invoiceOrId
      : null;
  const invoiceId = Number(row?.ID ?? invoiceOrId ?? 0);

  if (!invoiceId) {
    setWorkError("Не найден ID приходной накладной");
    return;
  }

  const rowSupplierName =
    String(
      row?.NamePost ??
        row?.SupplierName ??
        ""
    ).trim();

  const rowSupplierId = Number(
    row?.Post ??
      row?.IdPost ??
      row?.IDPost ??
      row?.PostID ??
      row?.IdPostav ??
      0
  );

  const supplierByName =
    !rowSupplierId && rowSupplierName
      ? (Array.isArray(postavList) ? postavList : []).find(
          (item) =>
            String(item?.Name ?? "")
              .trim()
              .toLocaleLowerCase() ===
            rowSupplierName.toLocaleLowerCase()
        )
      : null;

  const resolvedSupplierId =
    rowSupplierId ||
    Number(supplierByName?.ID || 0);

  const rowHint = row
    ? {
        ...row,
        Post: resolvedSupplierId,
        NamePost:
          rowSupplierName ||
          String(supplierByName?.Name ?? "")
      }
    : null;

  const isPf = parseBooleanFlag(row?.pf ?? row?.Pf ?? 0);
  const isZach = parseBooleanFlag(row?.zach ?? row?.Zach ?? 0);
  const kind = isPf ? "pf" : isZach ? "zach" : "prih";

  setInvoiceKind(kind);
  setPrihWasSaved(false);
  setPrihSelectedInvoiceId(invoiceId);
  setPrihInvoiceId(invoiceId);
  setPrihInitialData(null);
  setPrihListRowHint(rowHint);
  setPrihMode("edit");
  setSelectedAction("prih-invoice-card");
  setWorkTitle(
    kind === "pf"
      ? "Накладная производства ПФ"
      : kind === "zach"
        ? "Накладная зачистки"
        : "Приходная накладная"
  );
  setWorkError("");
}

function findMenuItemByAction(items, targetAction, targetCode = "") {
  const normalizedTargetCode = normalizeMenuCode(targetCode);

  for (const item of Array.isArray(items) ? items : []) {
    const itemCode = normalizeMenuCode(item?.Code ?? item?.code);
    const action = item?.action ?? item?.Action ?? "";

    if (normalizedTargetCode && itemCode === normalizedTargetCode) {
      return item;
    }

    if (
      !normalizedTargetCode &&
      action &&
      normalizeMenuActionKey(action) === normalizeMenuActionKey(targetAction)
    ) {
      return item;
    }

    const children = getMenuChildren(item);
    const found = findMenuItemByAction(
      children,
      targetAction,
      normalizedTargetCode
    );

    if (found) {
      return found;
    }
  }

  return null;
}

async function backToPrihList(forceReload = false) {
  const menuItem = findMenuItemByAction(
    menu,
    "wf_PrihList.php"
  );

  const shouldReload =
    Boolean(forceReload) ||
    prihWasSaved ||
    (prihMode === "new" && invoiceKind !== "prih");

  setSelectedAction("wf_PrihList.php");
  setWorkTitle(
    menuItem?.name ??
    menuItem?.Name ??
    t("PrihList.Title", "Приходные накладные")
  );

  setPrihInvoiceId(null);
  setPrihInitialData(null);
  setPrihMode("edit");
  setPrihWasSaved(false);
  setWorkError("");

  // При простом просмотре существующей накладной workData уже актуален —
  // лишний запрос не нужен. Новую или реально сохранённую накладную
  // перечитываем, чтобы список сразу отражал изменения базы.
  if (!shouldReload) {
    return;
  }

  await loadPrihList({
    sklad: currentSklad,
    post: prihPost,
    d1: prihDate1 || 0,
    d2: prihDate2 || 0,
    pf: prihPfMode ? 1 : 0,
    lang: language
  });
}

async function backToInvoiceList() {
  if (invoiceKind === "move") {
    await loadPeremList({
      sklad: currentSklad
    });
    return;
  }

  await backToPrihList();
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

  setDishSelectedId(Number(dishId));
  setDishCalcId(Number(dishId));
  setSelectedAction("dish-calc");
  setWorkTitle("Калькуляционная карта");
  setWorkError("");
}



function getCurrentOrgCode() {
  const n = Number(currentOrg);
  return Number.isFinite(n) ? n : 0;
}

function escapeReportXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildReportXml({
  date1,
  date2,
  org,
  all,
  skl,
  idPost,
  idKli = 0
}) {
  const idPostXml =
    idPost === null ||
    idPost === undefined ||
    idPost === ""
      ? ""
      : `<IdPost>${escapeReportXml(idPost)}</IdPost>`;

  return `<Report><Date1>${escapeReportXml(date1)}</Date1><Date2>${escapeReportXml(date2)}</Date2><Org>${escapeReportXml(org)}</Org><All>${escapeReportXml(all)}</All><Skl>${escapeReportXml(skl)}</Skl><IdKli>${escapeReportXml(idKli ?? 0)}</IdKli>${idPostXml}</Report>`;
}

async function loadReport({
  apiAction,
  date1 = reportDateFrom,
  date2 = reportDateTo,
  org = getCurrentOrgCode(),
  all = 1,
  skl = currentSklad,
  idPost,
  idKli = 0
}) {
  const reportAction = String(apiAction ?? "").trim();

  if (!reportAction) {
    setWorkData(null);
    setWorkError("Для отчёта не задан apiAction");
    return null;
  }

  setWorkLoading(true);
  setWorkError("");
  setWorkData(null);

  try {
    const xml = buildReportXml({
      date1,
      date2,
      org,
      all,
      skl,
      idPost,
      idKli
    });

    const url = new URL("https://webback.bar-boss.com/wr_Reports.php");
    url.searchParams.set("Action", reportAction);

    const response = await fetchWithAuth(url.toString(), {
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
      throw new Error(
        "Отчёт вернул не JSON: " + text.substring(0, 500)
      );
    }

    if (!response.ok || data?.status === "error") {
      throw new Error(
        data?.error ||
        data?.message ||
        "Ошибка формирования отчёта"
      );
    }

    setWorkData(data);
    return data;
  } catch (err) {
    setWorkError(err?.message || "Ошибка формирования отчёта");
    return null;
  } finally {
    setWorkLoading(false);
  }
}


async function runReport({
  apiAction,
  date1 = reportDateFrom,
  date2 = reportDateTo,
  org = getCurrentOrgCode(),
  all: requestedAll,
  idPost,
  idKli = 0
}) {
  const normalizedReportAction = String(apiAction ?? "").trim().toLowerCase();
  const hasRequestedAll =
    requestedAll === 0 ||
    requestedAll === 1 ||
    requestedAll === "0" ||
    requestedAll === "1";
  let all = hasRequestedAll
    ? Number(requestedAll)
    : ["spistov", "spisblud"].includes(
        normalizedReportAction
      )
      ? 0
      : 1;

  if (
    !hasRequestedAll &&
    normalizedReportAction === "revenuedates"
  ) {
    all = window.confirm(
      t("RevenueDates.AllDepartmentsQuestion", "По всем подразделениям?")
    )
      ? 1
      : 0;

    if (all === 0 && !currentSklad) {
      window.alert(
        t("RevenueDates.DepartmentRequired", "Не выбрано подразделение.")
      );
      setWorkLoading(false);
      return null;
    }
  }

  if (
    ["spistov", "spisblud"].includes(
      normalizedReportAction
    ) &&
    all === 0 &&
    !currentSklad
  ) {
    window.alert(
      t(
        normalizedReportAction === "spisblud"
          ? "SpisBlud.WarehouseRequired"
          : "SpisTov.WarehouseRequired",
        "Не выбран склад."
      )
    );
    setWorkLoading(false);
    return null;
  }

  setReportAll(all);

  const requestAll =
    ["spistov", "spisblud"].includes(
      normalizedReportAction
    )
      ? 1
      : all;

  return loadReport({
    apiAction,
    date1,
    date2,
    org,
    all: requestAll,
    skl: currentSklad,
    idPost,
    idKli
  });
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

async function normalizeApiResult(result) {
  return result instanceof Response
    ? await result.json()
    : result;
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
      throw new Error(t("App.WarehouseRequired", "Не выбран склад / подразделение"));
    }
    setSelectedAction("wf_Dishes.php");
    setWorkTitle("Список блюд");
    setWorkLoading(true);
    setWorkError("");
    setWorkData(null);

    try {
      const [groupsData, cehData, fopData, typDishData] = await Promise.all([
        loadDirectoryData("Groups"),
        loadDirectoryData("Ceh"),
        loadDirectoryData("Fop"),
        loadDirectoryData("TypDish")
      ]);

      setDishGroups(groupsData);
      setCehList(cehData);
      setFopList(fopData);
      setTypDishList(typDishData);

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
      setWorkError(err.message || t("Dishes.LoadError", "Ошибка загрузки списка блюд"));
    } finally {
      setWorkLoading(false);
    }
  }

async function loadPrihList({
  sklad = currentSklad,
  post = "%",
  d1 = 0,
  d2 = 0,
  lang = language,
  pf = prihPfMode ? 1 : 0
} = {}) {
  if (!sklad) {
    throw new Error("Не выбран склад / подразделение");
  }

  setSelectedAction("wf_PrihList.php");
  setWorkLoading(true);
  setWorkError("");
  setWorkData(null);

  try {
   const postavUrl = new URL(
  "https://webback.bar-boss.com/wf_Directory.php"
);
postavUrl.searchParams.set("Action", "Postav");
postavUrl.searchParams.set("org", String(getCurrentOrgCode()));

const postavResponse = await fetchWithAuth(postavUrl.toString(), {
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
    url.searchParams.set("pf", String(Number(pf) ? 1 : 0));
    url.searchParams.set("lang", normalizeLanguage(lang));

    console.log("[prih-list] request", url.toString());
    url.searchParams.set("lang", normalizeLanguage(lang));

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

    const items = Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data)
        ? data
        : [];

    const period = resolvePrihListPeriod(
      data,
      d1,
      d2,
      items
    );

    setPrihPost(post);
    setPrihPfMode(Boolean(Number(pf)));
    setPrihPeriod(period);
    setPrihDate1(period.Date1);
    setPrihDate2(period.Date2);
    setWorkData(items);

  } catch (err) {
    setWorkError(err.message || "Ошибка загрузки приходных накладных");
  } finally {
    setWorkLoading(false);
  }
}

async function importPrihFile(file) {
  if (!file) {
    return;
  }

  if (!currentSklad) {
    window.alert(
      t("PrihList.ImportWarehouseRequired", "Не выбран склад / подразделение.")
    );
    return;
  }

  const formData = new FormData();
  formData.set("Action", "PrihImport");
  formData.set("skl", String(currentSklad));
  formData.set("login", String(user?.id ?? ""));
  formData.set("file", file);

  try {
    const response = await fetchWithAuth(
      "https://webback.bar-boss.com/wf_RefExec.php",
      {
        method: "POST",
        body: formData
      }
    );

    const responseText = await response.text();
    let data = null;

    if (responseText.trim()) {
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(
          t(
            "PrihList.ImportInvalidResponse",
            "Сервер вернул некорректный ответ при загрузке файла."
          ) +
            " " +
            responseText.substring(0, 300)
        );
      }
    }

    const normalized = Array.isArray(data) ? data[0] : data;

    if (!response.ok || normalized?.status === "error") {
      throw new Error(
        normalized?.details ||
          normalized?.error ||
          normalized?.message ||
          t(
            "PrihList.ImportError",
            "Ошибка загрузки приходных накладных из файла."
          )
      );
    }

    await loadPrihList({
      sklad: currentSklad,
      post: prihPost,
      d1: prihDate1 || 0,
      d2: prihDate2 || 0,
      pf: prihPfMode ? 1 : 0
    });
  } catch (err) {
    window.alert(
      err?.message ||
        t(
          "PrihList.ImportError",
          "Ошибка загрузки приходных накладных из файла."
        )
    );
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
    const categorResponse = await fetchWithAuth("https://webback.bar-boss.com/wf_Directory.php?Action=Categor", {
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
    const categorResponse = await fetchWithAuth("https://webback.bar-boss.com/wf_Directory.php?Action=Categor", {
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

async function startSebestRecalc({ date, otobr = 0 } = {}) {
  const userId = String(user?.id ?? "").trim();
  const startDate = String(date ?? "").trim();

  if (!userId) {
    throw new Error(
      t("SpisokTovarov.RecalcUserMissing", "Не определён пользователь для запуска пересчёта")
    );
  }

  if (!startDate) {
    throw new Error(
      t("SpisokTovarov.RecalcDateMissing", "Не указана дата начала пересчёта")
    );
  }

  const response = await fetchWithAuth(
    "https://webback.bar-boss.com/wr_Sebest.php",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        User: userId,
        Date: startDate,
        Otobr: otobr ? 1 : 0
      })
    }
  );

  const text = await response.text();
  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      t("SpisokTovarov.RecalcInvalidJson", "Запуск пересчёта вернул не JSON: {details}")
        .replace("{details}", text.substring(0, 300))
    );
  }

  if (!response.ok || data?.status !== "success") {
    throw new Error(
      data?.error ||
        t("SpisokTovarov.RecalcStartError", "Не удалось запустить пересчёт себестоимости")
    );
  }

  return data;
}

async function checkSebestRecalc() {
  const response = await fetchWithAuth(
    "https://webback.bar-boss.com/wr_SebestCheck.php",
    {
      method: "GET"
    }
  );

  const text = await response.text();
  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      t("SpisokTovarov.RecalcCheckInvalidJson", "Проверка пересчёта вернула не JSON: {details}")
        .replace("{details}", text.substring(0, 300))
    );
  }

  if (!response.ok || data?.status !== "success") {
    throw new Error(
      data?.error ||
        t("SpisokTovarov.RecalcCheckError", "Не удалось проверить состояние пересчёта")
    );
  }

  return data;
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
  async function loadDirectoryData(
    apiAction,
    request = fetchWithAuth,
    requestParams = {}
  ) {
    const url = new URL("https://webback.bar-boss.com/wf_Directory.php");
    url.searchParams.set("Action", String(apiAction || ""));

    Object.entries(requestParams || {}).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "") return;
      url.searchParams.set(String(key), String(value));
    });

    const response = await request(url.toString(), { method: "GET" });
    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        `Справочник ${apiAction} вернул не JSON: ${text.substring(0, 300)}`
      );
    }

    const normalized = Array.isArray(data) ? data[0] : data;

    if (
      !response.ok ||
      (!Array.isArray(data) && normalized?.status === "error")
    ) {
      throw new Error(
        normalized?.error ||
          normalized?.message ||
          `Ошибка загрузки справочника ${apiAction}`
      );
    }

    return Array.isArray(data) ? data : [];
  }

  async function loadDirectoryByMenuCode(menuCode) {
    const config = getDirectoryMenuConfig(menuCode);

    if (!config) {
      throw new Error(`Не настроен справочник для пункта меню ${menuCode}`);
    }

    if (config.kind === "subdivisions") {
      const [skladsData, cehsData] = await Promise.all([
        loadDirectoryData("Sklad"),
        loadDirectoryData("Ceh")
      ]);

      setDirectoryLookups({});
      setWorkData({
        kind: "subdivisions",
        sklads: skladsData,
        cehs: cehsData
      });
      return;
    }

    const lookupColumns = (Array.isArray(config.columns) ? config.columns : [])
      .filter(
        (column) =>
          (column?.type === "select" || column?.type === "search-select") &&
          (column?.optionsAction || column?.optionsUrl)
      );

    const configLookups = (Array.isArray(config.lookups) ? config.lookups : [])
      .filter((lookup) => lookup?.key && (lookup?.apiAction || lookup?.url));

    async function loadLookupSource({ apiAction, url, label }) {
      if (apiAction) {
        return await loadDirectoryData(apiAction);
      }

      const source = String(url || "").trim();
      const lookupUrl = /^https?:\/\//i.test(source)
        ? source
        : `https://webback.bar-boss.com/${source.replace(/^\/+/, "")}`;

      const response = await fetchWithAuth(lookupUrl, { method: "GET" });
      const text = await response.text();

      let lookupData;
      try {
        lookupData = JSON.parse(text);
      } catch {
        throw new Error(
          `Список ${label || ""} вернул не JSON: ${text.substring(0, 300)}`
        );
      }

      const normalized = Array.isArray(lookupData) ? lookupData[0] : lookupData;

      if (
        !response.ok ||
        (!Array.isArray(lookupData) && normalized?.status === "error")
      ) {
        throw new Error(
          normalized?.error ||
            normalized?.message ||
            `Ошибка загрузки списка ${label || ""}`
        );
      }

      return Array.isArray(lookupData) ? lookupData : [];
    }

    const lookupPromises = [
      ...lookupColumns.map((column) =>
        loadLookupSource({
          apiAction: column.optionsAction,
          url: column.optionsUrl,
          label: column.field
        })
      ),
      ...configLookups.map((lookup) =>
        loadLookupSource({
          apiAction: lookup.apiAction,
          url: lookup.url,
          label: lookup.key
        })
      )
    ];

    const mainRequestParams = config.includeCurrentOrg
      ? { org: getCurrentOrgCode() }
      : {};

    const [data, ...lookupLists] = await Promise.all([
      loadDirectoryData(
        config.apiAction,
        fetchWithAuth,
        mainRequestParams
      ),
      ...lookupPromises
    ]);

    const nextLookups = {};

    lookupColumns.forEach((column, index) => {
      nextLookups[column.field] = Array.isArray(lookupLists[index])
        ? lookupLists[index]
        : [];
    });

    const configLookupOffset = lookupColumns.length;

    configLookups.forEach((lookup, index) => {
      nextLookups[lookup.key] = Array.isArray(
        lookupLists[configLookupOffset + index]
      )
        ? lookupLists[configLookupOffset + index]
        : [];
    });

    setDirectoryLookups(nextLookups);
    setWorkData(data);
    return data;
  }

  async function loadGroupsHappyHours(groupId = selectedDirectoryGroupId) {
    const id = Number(groupId || 0);

    if (id <= 0) {
      throw new Error(
        t(
          "Directory.SaveGroupBeforeHappyHours",
          "Сначала сохраните группу блюд"
        )
      );
    }

    setGroupsHappyLoading(true);
    setGroupsHappyError("");

    try {
      const allRows = await loadDirectoryData("HHgrup");
      const rows = allRows.filter(
        (row) => Number(row?.IdGrup ?? 0) === id
      );

      setGroupsHappyRows(rows);
      setGroupsHappyDirty(false);
      return rows;
    } finally {
      setGroupsHappyLoading(false);
    }
  }

  async function openGroupsHappyHours() {
    const id = Number(selectedDirectoryGroupId || 0);

    if (id <= 0) {
      window.alert(
        t(
          "Directory.SaveGroupBeforeHappyHours",
          "Сначала сохраните группу блюд"
        )
      );
      return;
    }

    setGroupsHappyOpen(true);
    setGroupsHappyRows([]);
    setGroupsHappyError("");
    setGroupsHappyDirty(false);

    try {
      await loadGroupsHappyHours(id);
    } catch (error) {
      setGroupsHappyError(
        error?.message ||
          t("HappyHours.LoadError", "Ошибка загрузки счастливых часов")
      );
    }
  }

  function closeGroupsHappyHours() {
    if (
      groupsHappyDirty &&
      !window.confirm(
        t(
          "App.UnsavedChangesWarning",
          "Внимание! Вы не сохранили измененные данные!\nУверены, что хотите уйти?"
        )
      )
    ) {
      return;
    }

    setGroupsHappyOpen(false);
    setGroupsHappyRows([]);
    setGroupsHappyError("");
    setGroupsHappyDirty(false);
  }

  async function saveGroupsHappyHours(xml) {
    const response = await saveRefItem("HHgrup", xml);
    const text = await response.text();
    let result = null;

    if (text.trim()) {
      try {
        result = JSON.parse(text);
      } catch {
        if (!response.ok) {
          throw new Error(
            `Сохранение счастливых часов вернуло не JSON: ${text.substring(0, 300)}`
          );
        }
      }
    }

    if (!response.ok || result?.status === "error") {
      throw new Error(
        result?.error ||
          result?.message ||
          t("Directory.SaveError", "Ошибка сохранения справочника")
      );
    }

    return result;
  }

  async function openAction(item) {
    if (!item.action) {
    console.log("NO ACTION IN ITEM:", item);
    return;
  }

  const actionName = normalizeMenuAction(item.action);
  const menuCode = normalizeMenuCode(item.Code ?? item.code);
  const apiAction = String(
    item.apiAction ?? item.ApiAction ?? item.APIAction ?? ""
  ).trim();

  if (hasUnsavedChanges) {
    const ok = window.confirm(unsavedChangesMessage);

    if (!ok) {
      return;
    }

    setHasUnsavedChanges(false);
  }

  const url = buildMenuActionUrl(item.action);

  setSelectedDirectoryGroupId(null);
  setGroupsDirectoryDirty(false);
  setGroupsHappyDirty(false);
  setGroupsHappyOpen(false);
  setGroupsHappyRows([]);
  setGroupsHappyError("");

  setSelectedMenuCode(menuCode);
  setSelectedAction(actionName);
  setSelectedApiAction(
    actionName.toLowerCase() === "wbr_reports" ? apiAction : ""
  );
  setWorkTitle(item.name);
  setWorkLoading(true);
  setWorkError("");
  setWorkData(null);

  try {

    if (menuCode === "09.01") {
      const neraschData = await loadDirectoryData("Nerasch");
      setWorkData(neraschData);
      return;
    }

    if (menuCode === "09.02") {
      const paramsData = await loadDirectoryData("Params");
      setWorkData(paramsData);
      return;
    }

    if (menuCode === "09.03") {
      const salaryParamsData = await loadDirectoryData("ForZP");
      setWorkData(salaryParamsData);
      return;
    }

    if (menuCode === "09.06") {
      const usersData = await loadDirectoryData("Users");
      setWorkData(usersData);
      return;
    }

    if (
      menuCode === "09.07" ||
      actionName.toLowerCase() === "tables"
    ) {
      setWorkData({ kind: "tables" });
      return;
    }

    if (
      actionName.toLowerCase() === "wbr_reports" &&
      menuCode === "05.12"
    ) {
      await loadClientReportsNavigator();
      return;
    }

    if (actionName.toLowerCase() === "wbr_reports") {
      await runReport({
        apiAction,
        date1: reportDateFrom,
        date2: reportDateTo,
        org: getCurrentOrgCode()
      });
      return;
    }

    if (actionName.toLowerCase() === "wbo_directory") {
      await loadDirectoryByMenuCode(menuCode);
      return;
    }

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
  if (actionName === "wf_PrihList.php") {
  setPrihPfMode(false);
  await loadPrihList({
    sklad: currentSklad,
    post: "%",
    d1: 0,
    d2: 0,
    pf: 0
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
  if (actionName === "wf_SpisokZakazov.php") {
  await loadOrdersDay();
  return;
  }
  if (actionName === "wf_SpisokTovarov.php") {
    await loadSpisokTovarov({
      cat: "0",
      skr: 0
    });
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
      const loginLicenseStatus = getLicenseStatus(loginData.license);

      if (loginLicenseStatus.isExpired) {
        handleLogout();
        window.alert(buildLicenseExpiredMessage(loginLicenseStatus));
        return;
      }

      setAccessToken(loginData.accessToken);
      setUser(loginData.user);
      setTenant(loginData.tenant);
      setLicense(loginData.license);

      // Признак Moldova нужен не только накладным, но и общим справочникам/
      // карточкам, например для набора налоговых групп. wf_PrihNew.php ничего
      // не создаёт в SQL и уже возвращает этот признак, поэтому читаем его
      // один раз после авторизации как общий режим текущей базы.
      try {
        const modeResponse = await fetch(
          "https://webback.bar-boss.com/wf_PrihNew.php",
          {
            method: "GET",
            credentials: "include",
            headers: {
              Authorization: `Bearer ${loginData.accessToken}`
            }
          }
        );
        const modeText = await modeResponse.text();
        const modeData = JSON.parse(modeText);
        const modeInfo = Array.isArray(modeData) ? modeData[0] : modeData;

        if (!modeResponse.ok || modeInfo?.status === "error") {
          throw new Error(
            modeInfo?.error ||
              modeInfo?.message ||
              "Не удалось определить режим Moldova"
          );
        }

        setMoldovaMode(parseBooleanFlag(modeInfo?.Moldova ?? 0));
      } catch (modeError) {
        console.error("Moldova mode loading error", modeError);
        setMoldovaMode(false);
      }

      if (isTenantMultiPoint(loginData.tenant)) {
        const authenticatedRequest = (url, options = {}) =>
          fetch(url, {
            ...options,
            credentials: "include",
            headers: {
              ...(options.headers || {}),
              Authorization: `Bearer ${loginData.accessToken}`
            }
          });

        const pointsData = await loadDirectoryData(
          "Points",
          authenticatedRequest
        );

        setPoints(pointsData);

        const defaultPoint =
          pointsData.find((point) => Number(point?.ID) === 1) ??
          pointsData[0] ??
          null;

        setCurrentPoint(defaultPoint ? String(defaultPoint.ID) : "");
      } else {
        setPoints([]);
        setCurrentPoint("");
      }

      const preferredLanguage = normalizeLanguage(
        loginData.user?.lang ||
          loginData.tenant?.defaultLang ||
          getInitialLanguage()
      );

      try {
        await applyLanguage(
          preferredLanguage,
          (url, options = {}) =>
            fetch(url, {
              ...options,
              credentials: "include",
              headers: {
                ...(options.headers || {}),
                Authorization: `Bearer ${loginData.accessToken}`
              }
            })
        );
      } catch (translationError) {
        console.error("Translation loading error", translationError);
      }

      const menuData = await menuRequest(loginData.accessToken, preferredLanguage);
      setMenu(menuData);

      const skladsData = await loadPodrazd(loginData.accessToken);
      setSklads(skladsData);

      if (Array.isArray(skladsData) && skladsData.length > 0) {
        const firstSklad = skladsData[0];
        const firstCode = firstSklad.ID;

        setCurrentSklad(String(firstCode));
      }

      const orgData = await loadOrganizations(loginData.accessToken);
      setOrganizations(orgData);

      let initialOrg = "0";

      if (!loginData.tenant?.multiOrg) {
        initialOrg = "1";
      } else if (Array.isArray(orgData) && orgData.length > 0) {
        initialOrg = String(orgData[0].ID);
      }

      setCurrentOrg(initialOrg);

      if (Array.isArray(skladsData) && skladsData.length > 0) {
        const initialSklads =
          filterSkladsByOrg(
            skladsData,
            initialOrg
          );

        const currentInitialSklad =
          String(
            skladsData[0]?.ID ?? ""
          );

        const currentIsAllowed =
          initialSklads.some(
            (sklad) =>
              getSkladCode(sklad) ===
              currentInitialSklad
          );

        if (!currentIsAllowed) {
          setCurrentSklad(
            initialSklads[0]
              ? getSkladCode(
                  initialSklads[0]
                )
              : ""
          );
        }
      }

      const [groupsData, cehData, fopData, typDishData] =
        await Promise.all([
          loadGroups(loginData.accessToken),
          loadCeh(loginData.accessToken),
          loadFop(loginData.accessToken),
          loadTypDish(loginData.accessToken)
        ]);

      setDishGroups(groupsData);
      setCehList(cehData);
      setFopList(fopData);
      setTypDishList(typDishData);

      if (loginLicenseStatus.shouldWarn) {
        window.alert(buildLicenseWarningMessage(loginLicenseStatus));
      }
    } finally {
      setLoading(false);
    }
  }

  function handleLogoutClick() {
    if (hasUnsavedChanges) {
      const ok = window.confirm(unsavedChangesMessage);

      if (!ok) {
        return;
      }

      setHasUnsavedChanges(false);
    }

    handleLogout();
  }

  function handleLogout() {
  setAccessToken("");
  setUser(null);
  setTenant(null);
  setMoldovaMode(false);
  setLicense(null);
  setMenu([]);
  setTranslations({});

  setSelectedAction("");
  setSelectedMenuCode("");
  setWorkData(null);
  setWorkTitle("");
  setWorkLoading(false);
  setWorkError("");

  setSklads([]);
  setCurrentSklad("");
  setOrganizations([]);
  setCurrentOrg("");
  setPoints([]);
  setCurrentPoint("");
  setDirectoryLookups({});

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

  useEffect(() => {
    if (!accessToken || !license) {
      return undefined;
    }

    function checkLicenseExpiration() {
      const currentLicenseStatus = getLicenseStatus(license);

      if (!currentLicenseStatus.isExpired) {
        return;
      }

      window.alert(buildLicenseExpiredMessage(currentLicenseStatus));
      handleLogout();
    }

    checkLicenseExpiration();

    const intervalId = window.setInterval(
      checkLicenseExpiration,
      60 * 1000
    );

    return () => {
      window.clearInterval(intervalId);
    };
  }, [accessToken, license]);

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

  function openHome() {
    if (hasUnsavedChanges) {
      const ok = window.confirm(unsavedChangesMessage);

      if (!ok) {
        return;
      }

      setHasUnsavedChanges(false);
    }

    setSelectedAction("");
    setSelectedMenuCode("");
    setSelectedApiAction("");
    setWorkTitle("");
    setWorkData(null);
    setWorkLoading(false);
    setWorkError("");

    setDishCalcId(null);
    setPrihInvoiceId(null);
    setPrihInitialData(null);
    setSpisanInitialData(null);
    setSpisanBludInitialData(null);
    setViewOrderId(null);
    setViewSourceOrder(null);
    setDirectoryLookups({});
  }

  const visibleSklads =
    filterSkladsByOrg(
      sklads,
      currentOrg
    );

  function applyCurrentSklad(nextSklad) {
    setCurrentSklad(nextSklad);

    if (
      normalizeMenuActionKey(selectedAction).toLowerCase() ===
      "wf_dishes.php"
    ) {
      loadDishes({
        sklad: nextSklad,
        skr: dishSkr,
        group: dishGroup,
        modif: dishModif
      });
    }

    if (
      normalizeMenuActionKey(selectedAction).toLowerCase() ===
      "wf_prihlist.php"
    ) {
      loadPrihList({
        sklad: nextSklad,
        post: prihPost,
        d1: prihDate1 || 0,
        d2: prihDate2 || 0,
        pf: prihPfMode ? 1 : 0
      });
    }

    if (
      normalizeMenuActionKey(selectedAction).toLowerCase() ===
      "wf_peremlist.php"
    ) {
      setPeremSelectedInvoiceId(null);
      loadPeremList({
        sklad: nextSklad
      });
    }

    if (
      normalizeMenuActionKey(selectedAction).toLowerCase() ===
      "wf_spisantovlist.php"
    ) {
      setSpisanTovSelectedInvoiceId(null);
      loadSpisanTovList({
        sklad: nextSklad
      });
    }
  }

  const currentOrganizationName =
    organizations.find((org) => String(org.ID) === String(currentOrg))?.Name || "";

  const currentSkladName =
    sklads.find((sklad) =>
      String(sklad.Code ?? sklad.ID) === String(currentSklad)
    )?.Name ??
    sklads.find((sklad) =>
      String(sklad.Code ?? sklad.ID) === String(currentSklad)
    )?.NameSkl ??
    "";

  const licenseStatus = useMemo(
    () => getLicenseStatus(license),
    [license]
  );

  const displayedLicense = license
    ? {
        ...license,
        validUntil:
          formatLicenseDate(
            licenseStatus.validUntilDate,
            licenseStatus.validUntil
          ) || license.validUntil,
        daysLeft: licenseStatus.daysLeft,
        isExpired: licenseStatus.isExpired,
        warn: licenseStatus.shouldWarn
      }
    : null;

  if (!accessToken) {
    return <LoginPage onLogin={handleLogin} loading={loading} />;
  }

  return (
    <div className="app-shell">
<header className="top-bar">
  <div className="top-left">
    <button
      type="button"
      className={[
        "brand-home-button",
        normalizeLanguage(language) === "uk" && !moldovaMode
          ? "brand-home-button-ukraine"
          : ""
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={openHome}
      title={t("App.Home", "На главную")}
    >
      <img src={barbossTitleIcon} alt="" />
      <span>BarBo$$ Web Office</span>
    </button>

    <div className="top-period" aria-label={t("App.ReportsPeriod", "Период отчётов")}>
      <label className="top-field top-date-field">
        <span>{t("App.From", "С")}</span>
        <input
          type="date"
          value={reportDateFrom}
          onChange={(e) => {
            const nextDate = e.target.value;
            setReportDateFrom(nextDate);

            if (reportDateTo && nextDate > reportDateTo) {
              setReportDateTo(nextDate);
            }
          }}
          title={t("App.StartDateTitle", "Начальная дата периода")}
        />
      </label>

      <label className="top-field top-date-field">
        <span>{t("App.To", "По")}</span>
        <input
          type="date"
          value={reportDateTo}
          min={reportDateFrom || undefined}
          onChange={(e) => setReportDateTo(e.target.value)}
          title={t("App.EndDateTitle", "Конечная дата периода")}
        />
      </label>
    </div>
  </div>

  <div className="top-right">
    {isTenantMultiPoint(tenant) && points.length > 0 && (
      <label className="top-field top-select-field top-point-field">
        <span>{t("App.PointShort", "Поинт:")}</span>
        <select
          value={currentPoint}
          onChange={(e) => {
            const nextPoint = e.target.value;

            if (nextPoint === currentPoint) {
              return;
            }

            if (hasUnsavedChanges) {
              const ok = window.confirm(unsavedChangesMessage);

              if (!ok) {
                return;
              }

              setHasUnsavedChanges(false);
            }

            setCurrentPoint(nextPoint);
          }}
          title={t("App.Point", "Торговая точка")}
        >
          {points.map((point) => (
            <option key={point.ID} value={String(point.ID)}>
              {point.NamePoint ?? point.Name ?? `Point ${point.ID}`}
            </option>
          ))}
        </select>
      </label>
    )}

    {tenant?.multiOrg && organizations.length > 0 && (
      <label className="top-field top-select-field">
        <span>{t("App.OrganizationShort", "Орг:")}</span>
        <select
          value={currentOrg}
          onChange={(e) => {
            const nextOrg = e.target.value;

            if (nextOrg === currentOrg) {
              return;
            }

            if (hasUnsavedChanges) {
              const ok = window.confirm(unsavedChangesMessage);

              if (!ok) {
                return;
              }

              setHasUnsavedChanges(false);
            }

            const nextVisibleSklads =
              filterSkladsByOrg(
                sklads,
                nextOrg
              );

            const currentSkladIsVisible =
              nextVisibleSklads.some(
                (sklad) =>
                  getSkladCode(sklad) ===
                  String(currentSklad)
              );

            setCurrentOrg(nextOrg);

            if (!currentSkladIsVisible) {
              const firstVisibleSklad =
                nextVisibleSklads[0];

              applyCurrentSklad(
                firstVisibleSklad
                  ? getSkladCode(
                      firstVisibleSklad
                    )
                  : ""
              );
            }
          }}
          title={t("App.Organization", "Организация")}
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
      </label>
    )}

    {sklads.length > 0 && (
      <label className="top-field top-select-field">
        <span>{t("App.Warehouse", "Склад:")}</span>
        <select
          value={currentSklad}
          onChange={(e) => {
            const nextSklad = e.target.value;

            if (nextSklad === currentSklad) {
              return;
            }

            if (hasUnsavedChanges) {
              const ok = window.confirm(unsavedChangesMessage);

              if (!ok) {
                return;
              }

              setHasUnsavedChanges(false);
            }

            applyCurrentSklad(
              nextSklad
            );
          }}
          title={t("App.WarehouseTitle", "Склад / подразделение")}
        >
          {visibleSklads.map((sklad) => {
            const code = getSkladCode(sklad);
            const name = sklad.Name ?? sklad.NameSkl;

            return (
              <option key={code} value={code}>
                {name}
              </option>
            );
          })}
        </select>
      </label>
    )}

    <select
      className="top-language-select"
      value={language}
      onChange={handleAppLanguageChange}
      title={t("App.Language", "Язык")}
    >
      <option value="uk">UK</option>
      <option value="ru">RU</option>
      <option value="ro">RO</option>
      <option value="en">EN</option>
    </select>

    {displayedLicense && (
      <span
        className={
          displayedLicense.warn ? "license-warn" : "license-ok"
        }
        title={
          displayedLicense.daysLeft !== null
            ? String(displayedLicense.daysLeft)
            : undefined
        }
      >
        {t("App.LicenseUntil", "Лицензия до")}{" "}
        {displayedLicense.validUntil}
      </span>
    )}

    <span className="top-user">{user?.id}</span>

    <button className="top-logout-button" onClick={handleLogoutClick}>
      {t("App.Logout", "Выход")}
    </button>
  </div>
</header>
      <div className="app-body">
<aside
  className={`side-menu${sideMenuCollapsed ? " side-menu-collapsed" : ""}`}
  onMouseEnter={openSideMenu}
  onMouseLeave={scheduleSideMenuClose}
  onFocusCapture={openSideMenu}
  onBlurCapture={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      scheduleSideMenuClose();
    }
  }}
>
  <div className="side-menu-heading">
    <span className="side-menu-heading-mark" aria-hidden="true" />
    <span className="side-menu-heading-text">{t("App.Menu", "Меню")}</span>
    <span
      className="side-menu-auto-hint"
      aria-hidden="true"
      title={t("App.MenuAutoExpand", "Меню раскрывается при наведении")}
    >
      ‹›
    </span>
  </div>

  <nav className="side-menu-scroll" aria-label={t("App.MainMenuAria", "Главное меню")}>
    {menu
      .filter(
        (item) => !isMenuItemHiddenForLanguage(item, language)
      )
      .map((item, index) => (
        <MenuItem
          key={`${item.Code ?? item.code ?? item.name ?? item.Name}-${index}`}
          item={item}
          onSelect={handleSideMenuSelect}
          selectedAction={selectedAction}
          selectedMenuCode={selectedMenuCode}
          language={language}
          collapsed={sideMenuCollapsed}
        />
      ))}
  </nav>
</aside>

<main
  className={`work-area${isPrihPrintPreviewOpen ? " prih-invoice-report-active" : ""}`}
>
  {selectedAction &&
    selectedAction !== "prih-invoice-card" &&
    selectedAction !== "spisan-tov-invoice-card" &&
    selectedAction !== "spisan-blud-invoice-card" &&
    selectedAction !== "dish-calc" &&
    selectedAction !== "wf_Kassa.php" &&
    selectedAction !== "wf_SpisanBludList.php" &&
    selectedAction !== "wf_SpisokZakazov.php" &&
    selectedAction !== "wf_SchetView.php" &&
    selectedAction !== "order-new" && (
      <h2 className="work-area-title">{displayedWorkTitle}</h2>
    )}
  {!selectedAction && !workLoading && !workError && (
<HomePage
  menu={menu}
  onOpen={openAction}
  multiOrg={Boolean(tenant?.multiOrg)}
  organizationName={currentOrganizationName}
  skladName={currentSkladName}
  license={displayedLicense}
  t={t}
/>
  )}

  {workLoading &&
    !(
      selectedAction.toLowerCase() === "wbr_reports" &&
      ["05.03", "05.04", "05.07", "05.19", "05.08.10", "05.14.05"].includes(
        normalizeMenuCode(selectedMenuCode)
      )
    ) && <p>{t("App.Loading", "Загрузка...")}</p>}

  {workLoading &&
    selectedAction.toLowerCase() === "wbr_reports" &&
    ["05.03", "05.04", "05.07", "05.19", "05.08.10", "05.14.05"].includes(
      normalizeMenuCode(selectedMenuCode)
    ) && (
      <div
        className="oborot-generation-busy"
        role="status"
        aria-live="polite"
      >
        <div className="oborot-generation-busy-panel">
          <div className="oborot-generation-spinner" />
          <div>
            {t(
              "Oborot.Calculating",
              "ФОРМИРУЕМ…"
            )}{" "}
            {reportGenerationSeconds}{" "}
            {t(
              "Common.SecondsShort",
              "сек."
            )}
          </div>
        </div>
      </div>
    )}

  {workError && (
    <div className="login-error">
      {workError}
    </div>
  )}

  {!workLoading &&
    !workError &&
    workData &&
    selectedAction.toLowerCase() === "wbr_reports" && (
      <ReportsPage
        code={selectedMenuCode}
        apiAction={selectedApiAction}
        data={workData}
        dateFrom={reportDateFrom}
        dateTo={reportDateTo}
        organizationName={currentOrganizationName}
        organizationId={getCurrentOrgCode()}
        departmentName={currentSkladName}
        departmentId={currentSklad}
        all={reportAll}
        locale={locale}
        fetchWithAuth={fetchWithAuth}
        bonusEnabled={isTenantBonusEnabled(tenant)}
        multiOrg={Boolean(tenant?.multiOrg)}
        t={t}
        onReload={(options = {}) =>
          runReport({
            apiAction: selectedApiAction,
            date1: reportDateFrom,
            date2: reportDateTo,
            org: getCurrentOrgCode(),
            all: options?.all
          })
        }
      />
    )}

  {!workLoading &&
    !workError &&
    workData &&
    normalizeMenuCode(selectedMenuCode) === "09.02" && (
      <SystemParametersPage
        data={workData}
        fetchWithAuth={fetchWithAuth}
        readOnly={Boolean(user?.readOnly)}
        sklads={sklads}
        onDirtyChange={setHasUnsavedChanges}
        t={t}
      />
    )}

  {!workLoading &&
    !workError &&
    Array.isArray(workData) &&
    normalizeMenuCode(selectedMenuCode) === "09.03" && (
      <SalaryParametersPage
        data={workData}
        sklads={sklads}
        readOnly={Boolean(user?.readOnly)}
        onDirtyChange={setHasUnsavedChanges}
        onSave={async (xml) => {
          const response = await saveRefItem("SaveForZP", xml);
          const text = await response.text();
          let result = null;

          if (text.trim()) {
            try {
              result = JSON.parse(text);
            } catch {
              if (!response.ok) {
                throw new Error(
                  `Сохранение параметров зарплаты вернуло не JSON: ${text.substring(0, 300)}`
                );
              }
            }
          }

          if (!response.ok || result?.status === "error") {
            throw new Error(
              result?.error ||
                result?.message ||
                t(
                  "SalaryParams.SaveError",
                  "Ошибка сохранения параметров зарплаты"
                )
            );
          }

          const reloadedData = await loadDirectoryData("ForZP");
          setWorkData(reloadedData);
          return result;
        }}
        t={t}
      />
    )}

  {!workLoading &&
    !workError &&
    Array.isArray(workData) &&
    normalizeMenuCode(selectedMenuCode) === "09.06" && (
      <UsersPage
        data={workData}
        fetchWithAuth={fetchWithAuth}
        readOnly={Boolean(user?.readOnly)}
        onDirtyChange={setHasUnsavedChanges}
        t={t}
      />
    )}

  {!workLoading &&
    !workError &&
    normalizeMenuCode(selectedMenuCode) === "09.07" &&
    String(selectedAction || "").toLowerCase() === "tables" && (
      <TablesPage
        fetchWithAuth={fetchWithAuth}
        readOnly={Boolean(user?.readOnly)}
        onDirtyChange={setHasUnsavedChanges}
        t={t}
      />
    )}

  {!workLoading &&
    !workError &&
    Array.isArray(workData) &&
    normalizeMenuCode(selectedMenuCode) === "09.01" && (
      <NeraschPage
        data={workData}
        dateFrom={reportDateFrom}
        dateTo={reportDateTo}
        organizationId={getCurrentOrgCode()}
        departmentId={currentSklad}
        all={reportAll}
        fetchWithAuth={fetchWithAuth}
        locale={locale}
        t={t}
      />
    )}

  {!workLoading &&
    !workError &&
    selectedAction.toLowerCase() === "wbo_directory" &&
    normalizeMenuCode(selectedMenuCode) === "08.10" &&
    workData?.kind === "subdivisions" && (
      <SubdivisionsPage
        data={workData}
        organizations={organizations}
        points={points}
        multiOrg={Boolean(tenant?.multiOrg)}
        multiPoint={isTenantMultiPoint(tenant)}
        currentOrg={currentOrg}
        currentPoint={currentPoint}
        readOnly={Boolean(user?.readOnly)}
        fetchWithAuth={fetchWithAuth}
        onSkladsChanged={(rows) => {
          const nextRows = Array.isArray(rows) ? rows : [];
          setSklads(nextRows);

          if (
            !nextRows.some(
              (row) =>
                String(row?.ID ?? row?.Code ?? "") === String(currentSklad)
            )
          ) {
            setCurrentSklad(
              nextRows[0]
                ? String(nextRows[0].ID ?? nextRows[0].Code ?? "")
                : ""
            );
          }
        }}
        onCehsChanged={(rows) => setCehList(Array.isArray(rows) ? rows : [])}
        onDirtyChange={setHasUnsavedChanges}
        t={t}
      />
    )}

  {!workLoading &&
    !workError &&
    Array.isArray(workData) &&
    selectedAction.toLowerCase() === "wbo_directory" &&
    normalizeMenuCode(selectedMenuCode) !== "09.01" &&
    normalizeMenuCode(selectedMenuCode) !== "09.02" &&
    normalizeMenuCode(selectedMenuCode) !== "09.03" &&
    normalizeMenuCode(selectedMenuCode) !== "09.06" && (
      <DirectoryPage
        data={workData}
        config={getDirectoryMenuConfig(selectedMenuCode)}
        lookupData={directoryLookups}
        context={{
          currentOrg: getCurrentOrgCode(),
          bonusEnabled: isTenantBonusEnabled(tenant)
        }}
        readOnly={Boolean(user?.readOnly)}
        selectedId={
          normalizeMenuCode(selectedMenuCode) === "08.04"
            ? selectedDirectoryGroupId
            : null
        }
        onSelectedIdChange={
          normalizeMenuCode(selectedMenuCode) === "08.04"
            ? (id) => setSelectedDirectoryGroupId(id)
            : undefined
        }
        toolbarActions={
          normalizeMenuCode(selectedMenuCode) === "08.04"
            ? [
                {
                  key: "groups-happy-hours",
                  labelKey: "HappyHours.Title",
                  fallback: "Счастливые часы",
                  disabled: Number(selectedDirectoryGroupId || 0) <= 0,
                  onClick: openGroupsHappyHours
                }
              ]
            : []
        }
        onDirtyChange={
          normalizeMenuCode(selectedMenuCode) === "08.04"
            ? setGroupsDirectoryDirty
            : setHasUnsavedChanges
        }
        onSave={async (xml) => {
          const config = getDirectoryMenuConfig(selectedMenuCode);

          if (!config) {
            throw new Error(`Не настроен справочник для пункта меню ${selectedMenuCode}`);
          }

          const saveAction = config.saveAction || config.apiAction;
          const response = await saveRefItem(saveAction, xml);
          const text = await response.text();
          let result = null;

          if (text.trim()) {
            try {
              result = JSON.parse(text);
            } catch {
              if (!response.ok) {
                throw new Error(`Сохранение справочника вернуло не JSON: ${text.substring(0, 300)}`);
              }
            }
          }

          if (!response.ok || result?.status === "error") {
            throw new Error(
              result?.error || result?.message || "Ошибка сохранения справочника"
            );
          }

          const reloadedData = await loadDirectoryByMenuCode(selectedMenuCode);

          if (config.apiAction === "Fop" && Array.isArray(reloadedData)) {
            setFopList(reloadedData);
          }

          if (config.apiAction === "Postav" && Array.isArray(reloadedData)) {
            setPostavList(reloadedData);
          }

          return result;
        }}
        t={t}
      />
    )}

  {groupsHappyOpen &&
    normalizeMenuCode(selectedMenuCode) === "08.04" && (
      <div
        className="subdivisions-happy-overlay"
        role="dialog"
        aria-modal="true"
        aria-label={t("HappyHours.Title", "Счастливые часы")}
      >
        <div className="subdivisions-happy-dialog">
          <div className="subdivisions-happy-heading">
            <div>
              <strong>{t("HappyHours.Title", "Счастливые часы")}</strong>
              {selectedDirectoryGroup?.Name && (
                <span> — {selectedDirectoryGroup.Name}</span>
              )}
            </div>

            <div className="subdivisions-happy-heading-actions">
              <button
                type="button"
                className="small-action-button"
                disabled={groupsHappyLoading}
                onClick={() => {
                  loadGroupsHappyHours().catch((error) => {
                    setGroupsHappyError(
                      error?.message ||
                        t(
                          "HappyHours.LoadError",
                          "Ошибка загрузки счастливых часов"
                        )
                    );
                  });
                }}
              >
                {t("DishesPF.Refresh", "Обновить")}
              </button>

              <button
                type="button"
                className="small-action-button"
                onClick={closeGroupsHappyHours}
              >
                {t("HappyHours.Back", "Вернуться")}
              </button>
            </div>
          </div>

          {groupsHappyError && (
            <div className="login-error subdivisions-happy-error">
              {groupsHappyError}
            </div>
          )}

          {groupsHappyLoading ? (
            <div className="subdivisions-happy-loading">
              {t("HappyHours.Loading", "Загрузка...")}
            </div>
          ) : (
            <DirectoryPage
              data={groupsHappyRows}
              config={groupsHappyConfig}
              readOnly={Boolean(user?.readOnly)}
              onDirtyChange={setGroupsHappyDirty}
              onSave={async (xml) => {
                await saveGroupsHappyHours(xml);
                await loadGroupsHappyHours();
              }}
              t={t}
            />
          )}
        </div>
      </div>
    )}

  {!workLoading && !workError && workData && selectedAction === "wf_Dishes.php" && (
    <DishesPage
      data={workData}
      selectedDishId={dishSelectedId}
      login={user?.id ?? ""}
      moldova={moldovaMode}
  currentSklad={currentSklad}
      podrazd={sklads}
      fetchWithAuth={fetchWithAuth}
      dateFrom={reportDateFrom}
      dateTo={reportDateTo}
      onOpenCalc={openDishCalc}
      t={t}
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
      onDirtyChange={setHasUnsavedChanges}
    />
  )}

 {selectedAction === "wf_SchetView.php" && viewOrderId && (
  <SchetViewPage
    codeR={viewOrderId}
    sourceOrder={viewSourceOrder}
    waiterOptions={ordersWaiterOptions}
    fetchWithAuth={fetchWithAuth}
    t={t}
    locale={locale}
    onBack={() => {
      setSelectedAction("wf_SpisokZakazov.php");
      setViewOrderId(null);
      setViewSourceOrder(null);
    }}
    onDirtyChange={setHasUnsavedChanges}
    readOnly={Boolean(user?.readOnly)}
  />
)}

{selectedAction === "order-new" && (
  <OrderNewPage
    ordersDate={ordersDate}
    waiterOptions={ordersWaiterOptions}
    login={String(user?.id ?? "")}
    fetchWithAuth={fetchWithAuth}
    t={t}
    locale={locale}
    readOnly={userReadOnlyMode}
    onDirtyChange={setHasUnsavedChanges}
    onBack={() => {
      setSelectedAction("wf_SpisokZakazov.php");
      setWorkTitle("Просмотр заказов за день");
      setWorkError("");
    }}
    onSaved={async () => {
      setHasUnsavedChanges(false);
      await loadOrdersDay(ordersDate);
    }}
  />
)}
 
{!workLoading && !workError && selectedAction === "dish-calc" && dishCalcId && (
  <DishCalcPage
    dishId={dishCalcId}
    currentSklad={currentSklad}
    fetchWithAuth={fetchWithAuth}
    moldova={moldovaMode}
    t={t}
    onBack={() => {
      setSelectedAction("wf_Dishes.php");
      setWorkTitle("Список блюд");
      setDishCalcId(null);
      setWorkError("");
    }}
    onDirtyChange={setHasUnsavedChanges}
    readOnly={Boolean(user?.readOnly)}
  />
)}
  {!workLoading && !workError && workData && selectedAction === "wf_PrihList.php" && (
    <PrihListPage
      data={workData}
      period={prihPeriod}
      posts={postavList}
      filterPost={prihPost}
      date1={prihDate1}
      date2={prihDate2}
      pfMode={prihPfMode}
      readOnly={Boolean(user?.readOnly)}
      selectedInvoiceId={prihSelectedInvoiceId}
      onSelectInvoice={setPrihSelectedInvoiceId}
onChangePost={async (nextPost) => {
    const postValue = String(nextPost ?? "%");

    setPrihPost(postValue);

    await loadPrihList({
      sklad: currentSklad,
      post: postValue,
      d1: prihDate1 || 0,
      d2: prihDate2 || 0,
      pf: prihPfMode ? 1 : 0
    });
  }}
      onChangeDate1={setPrihDate1}
      onChangeDate2={setPrihDate2}
      onChangePf={async (checked) => {
        const nextPf = Boolean(checked);
        setPrihPfMode(nextPf);

        await loadPrihList({
          sklad: currentSklad,
          post: prihPost,
          d1: prihDate1 || 0,
          d2: prihDate2 || 0,
          pf: nextPf ? 1 : 0
        });
      }}
      onOpenInvoice={openPrihInvoice}
      onCreateInvoice={createPrihInvoice}
      onImportFile={importPrihFile}
      onCreateProduction={() => createPrihSpecialInvoice("pf")}
      onCreateZach={() => createPrihSpecialInvoice("zach")}
      t={t}
      locale={locale}
      onApply={async () => {
        await loadPrihList({
          sklad: currentSklad,
          post: prihPost,
          d1: prihDate1 || 0,
          d2: prihDate2 || 0,
          pf: prihPfMode ? 1 : 0
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
      dateFrom={reportDateFrom}
      dateTo={reportDateTo}
      language={language}
      fetchWithAuth={fetchWithAuth}
      onDateChange={handleKassaDateChange}
      onValutChange={handleKassaValutChange}
      onSave={saveKassaPage}
      onReload={() => loadKassaPage(kassaDate)}
      onReceiveRevenue={receiveKassaRevenue}
      onLoadSupplierInvoices={loadSupplierInvoices}
      onDirtyChange={setHasUnsavedChanges}
      t={t}
      locale={locale}
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
      onAddOrder={openNewOrder}
      readOnly={userReadOnlyMode}
      t={t}
      locale={locale}
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
      onDirtyChange={setHasUnsavedChanges}
      t={t}
      locale={locale}
    />
  )}

{!workLoading && !workError && selectedAction === "prih-invoice-card" && prihInvoiceId && (
<PrihInvoicePage
  invoiceId={prihInvoiceId}
  initialInvoice={prihInitialData}
  invoiceListRow={prihListRowHint}
  mode={prihMode}
  invoiceKind={invoiceKind}
  currentSklad={currentSklad}
  currentOrg={getCurrentOrgCode()}
  supplierOptions={postavList}
  login={String(user?.id ?? "")}
  fetchWithAuth={fetchWithAuth}
  onBack={backToInvoiceList}
  onSaved={(savedInvoiceId) => {
    setPrihWasSaved(true);

    const realInvoiceId = Number(savedInvoiceId || 0);

    if (
      realInvoiceId > 0 &&
      prihMode === "new" &&
      (invoiceKind === "prih" || invoiceKind === "move")
    ) {
      setPrihInvoiceId(realInvoiceId);

      if (invoiceKind === "move") {
        setPeremSelectedInvoiceId(realInvoiceId);
      } else {
        setPrihSelectedInvoiceId(realInvoiceId);
      }

      setPrihInitialData(null);
      setPrihListRowHint(null);
      setPrihMode("edit");
      setWorkTitle(
        invoiceKind === "move"
          ? "Накладная перемещения"
          : "Приходная накладная"
      );
    }
  }}
  onDeletePFCompleted={() => backToPrihList(true)}
  onDirtyChange={setHasUnsavedChanges}
  onPrintPreviewChange={setIsPrihPrintPreviewOpen}
  t={t}
  locale={locale}
/>
)}

{!workLoading &&
  !workError &&
  workData &&
  selectedAction === "wf_CardsSirya.php" && (
    <CardsSiryaPage
      data={workData}
      categories={siryaCategories}
      filterCat={siryaCat}
      onChangeCat={setSiryaCat}
      onApply={async (selectedCategory) => {
        await loadCardsSirya({
          sklad: currentSklad,
          cat: selectedCategory || "0"
        });
      }}
      fetchWithAuth={fetchWithAuth}
      accessToken={accessToken}
      sklad={currentSklad}
      org={getCurrentOrgCode()}
      dateFrom={reportDateFrom}
      dateTo={reportDateTo}
      language={language}
      locale={locale}
      t={t}
    />
  )}

{!workLoading && !workError && workData && selectedAction === "wf_SpisanTovList.php" && (
  <SpisanTovListPage
    data={workData}
    selectedInvoiceId={spisanTovSelectedInvoiceId}
    onOpen={openSpisanTovInvoice}
  onNew={createSpisanTovInvoice}
  t={t}
  locale={locale}
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
      onDirtyChange={setHasUnsavedChanges}
      t={t}
    />
  )}


{!workLoading && !workError && workData && selectedAction === "wf_SpisanBludList.php" && (
<SpisanBludListPage
  data={workData}
  selectedInvoiceId={spisanBludSelectedInvoiceId}
  onOpen={openSpisanBludInvoice}
  onNew={createSpisanBludInvoice}
  t={t}
  locale={locale}
/>)}
{!workLoading && !workError && workData && selectedAction === "wf_PeremList.php" && (
<PeremListPage
  data={workData}
  selectedInvoiceId={peremSelectedInvoiceId}
  onOpen={openMoveInvoice}
  onNew={createMoveInvoice}
  t={t}
  locale={locale}
/>
)}





{!workLoading && !workError && workData && selectedAction === "wf_SpisokTovarov.php" && (
  <SpisokTovarovPage
    data={workData}
    categories={siryaCategories}
    filterCat={spisokTovarovCat}
    filterSkr={spisokTovarovSkr}
    recalcDate={reportDateFrom}
    onStartSebest={startSebestRecalc}
    onCheckSebest={checkSebestRecalc}
    fetchWithAuth={fetchWithAuth}
    readOnly={Boolean(user?.readOnly)}
    onDirtyChange={setHasUnsavedChanges}
    t={t}
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
        throw new Error(
          t("SpisokTovarov.ServerInvalidJson", "Сервер вернул не JSON: {details}")
            .replace("{details}", text.substring(0, 300))
        );
      }

      if (!response.ok || data.status !== "success") {
        throw new Error(data.error || t("SpisokTovarov.SaveListError", "Ошибка сохранения списка сырья"));
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
      onDirtyChange={setHasUnsavedChanges}
      t={t}
    />
  )}

{!workLoading &&
  !workError &&
  workData &&
  selectedAction !== "wf_Dishes.php" &&
  selectedAction !== "wf_PrihList.php" &&
  selectedAction !== "wf_CardsSirya.php" &&
  selectedAction !== "wf_SpisanBludList.php" &&
  selectedAction !== "wf_SpisanTovList.php" &&
  selectedAction !== "prih-invoice-card" &&
  selectedAction !== "prih-invoice" &&
  selectedAction !== "wf_SchetView.php" &&
  selectedAction !== "order-new" &&
  selectedAction !== "wf_SpisokPer.php" &&
  normalizeMenuAction(selectedAction) !== "wf_SpisokPer.php" &&
  selectedAction !== "wf_Kassa.php" &&
  selectedAction !== "spisan-tov-invoice-card" &&
  selectedAction !== "wf_PeremList.php" &&
  selectedAction !== "dish-calc" &&
  selectedAction !== "spisan-blud-invoice-card" &&
  selectedAction !== "wf_SpisokTovarov.php" &&
  selectedAction !== "wf_SpisokZakazov.php" &&
  normalizeMenuCode(selectedMenuCode) !== "09.01" &&
  normalizeMenuCode(selectedMenuCode) !== "09.02" &&
  normalizeMenuCode(selectedMenuCode) !== "09.03" &&
  normalizeMenuCode(selectedMenuCode) !== "09.06" &&
  normalizeMenuCode(selectedMenuCode) !== "09.07" &&
  selectedAction.toLowerCase() !== "tables" &&
  selectedAction.toLowerCase() !== "wbo_directory" &&
  selectedAction.toLowerCase() !== "wbr_reports" && (
    <pre className="json-view">
      {JSON.stringify(workData, null, 2)}
    </pre>
  )}

  {!workLoading &&
    !workError &&
    !workData &&
    selectedAction &&
    selectedAction !== "order-new" &&
    normalizeMenuCode(selectedMenuCode) !== "09.07" &&
    selectedAction.toLowerCase() !== "tables" && (
      <p>{t("App.NoData", "Для выбранного раздела пока нет данных.")}</p>
    )}
</main>
     </div>
    </div>
  );
}