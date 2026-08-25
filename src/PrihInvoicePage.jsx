import { useEffect, useMemo, useRef, useState } from "react";
import "./prih-scan-match.css";

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function roundPrice(value) {
  return Math.round(Number(value || 0) * 1000000) / 1000000;
}

function roundQuantity(value) {
  return Math.round(Number(value || 0) * 1000) / 1000;
}

function formatEditableNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? String(number) : "0";
}

function evaluateArithmeticExpression(value) {
  const source = String(value ?? "")
    .trim()
    .replaceAll(",", ".")
    .replaceAll("×", "*")
    .replaceAll("÷", "/")
    .replace(/\s+/g, "");

  if (!source) {
    return 0;
  }

  let position = 0;

  function peek() {
    return source[position] ?? "";
  }

  function consume(char) {
    if (peek() !== char) {
      throw new Error("Unexpected character");
    }

    position += 1;
  }

  function parseNumber() {
    const start = position;
    let dots = 0;

    while (position < source.length) {
      const char = source[position];

      if (char >= "0" && char <= "9") {
        position += 1;
        continue;
      }

      if (char === ".") {
        dots += 1;

        if (dots > 1) {
          throw new Error("Invalid number");
        }

        position += 1;
        continue;
      }

      break;
    }

    if (start === position || source.slice(start, position) === ".") {
      throw new Error("Number expected");
    }

    const number = Number(source.slice(start, position));

    if (!Number.isFinite(number)) {
      throw new Error("Invalid number");
    }

    return number;
  }

  function parseFactor() {
    const char = peek();

    if (char === "+") {
      position += 1;
      return parseFactor();
    }

    if (char === "-") {
      position += 1;
      return -parseFactor();
    }

    if (char === "(") {
      consume("(");
      const value = parseExpression();
      consume(")");
      return value;
    }

    return parseNumber();
  }

  function parseTerm() {
    let value = parseFactor();

    while (peek() === "*" || peek() === "/") {
      const operator = peek();
      position += 1;
      const right = parseFactor();

      if (operator === "*") {
        value *= right;
      } else {
        if (right === 0) {
          throw new Error("Division by zero");
        }

        value /= right;
      }
    }

    return value;
  }

  function parseExpression() {
    let value = parseTerm();

    while (peek() === "+" || peek() === "-") {
      const operator = peek();
      position += 1;
      const right = parseTerm();

      value = operator === "+" ? value + right : value - right;
    }

    return value;
  }

  try {
    const result = parseExpression();

    if (position !== source.length || !Number.isFinite(result)) {
      return null;
    }

    return result;
  } catch {
    return null;
  }
}

function ExpressionNumberInput({
  value,
  cellIndex,
  onCommit,
  onEnterNext,
  className = "",
  title = "",
  disabled = false
}) {
  const [text, setText] = useState(formatEditableNumber(value));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setText(formatEditableNumber(value));
    setInvalid(false);
  }, [value]);

  function commit() {
    const result = evaluateArithmeticExpression(text);

    if (result === null) {
      setInvalid(true);
      return false;
    }

    const accepted = onCommit?.(result);

    if (accepted === false) {
      setInvalid(true);
      return false;
    }

    const committedValue =
      typeof accepted === "number" && Number.isFinite(accepted)
        ? accepted
        : result;

    setText(formatEditableNumber(committedValue));
    setInvalid(false);
    return true;
  }

  return (
    <input
      data-cell={cellIndex}
      type="text"
      inputMode="decimal"
      className={className}
      value={text}
      title={title}
      aria-invalid={invalid}
      disabled={disabled}
      style={invalid ? { borderColor: "#c62828", outlineColor: "#c62828" } : undefined}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => {
        setText(event.target.value);
        setInvalid(false);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          setText(formatEditableNumber(value));
          setInvalid(false);
          return;
        }

        if (event.key !== "Enter") {
          return;
        }

        event.preventDefault();

        if (commit()) {
          setTimeout(() => onEnterNext?.(cellIndex), 0);
        }
      }}
    />
  );
}


function WeightCorrectionInput({
  cellIndex,
  onApply,
  onEnterNext,
  title = "",
  disabled = false
}) {
  const [text, setText] = useState("");
  const [invalid, setInvalid] = useState(false);

  function clear() {
    setText("");
    setInvalid(false);
  }

  function apply() {
    const correctedWeight = evaluateArithmeticExpression(text);

    if (
      correctedWeight === null ||
      !Number.isFinite(correctedWeight) ||
      correctedWeight <= 0
    ) {
      setInvalid(true);
      return false;
    }

    const accepted = onApply?.(correctedWeight);

    if (accepted === false) {
      setInvalid(true);
      return false;
    }

    clear();
    return true;
  }

  return (
    <input
      data-cell={cellIndex}
      type="text"
      inputMode="decimal"
      className="table-input text-right prih-weight-correction-input"
      value={text}
      title={title}
      aria-invalid={invalid}
      placeholder=""
      disabled={disabled}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => {
        setText(event.target.value);
        setInvalid(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          clear();
          return;
        }

        if (event.key !== "Enter") {
          return;
        }

        event.preventDefault();

        if (apply()) {
          setTimeout(() => onEnterNext?.(cellIndex), 0);
        }
      }}
    />
  );
}

function makeTempId() {
  return -Date.now() - Math.floor(Math.random() * 1000);
}

function createEmptyInvoiceRow() {
  return {
    ID: makeTempId(),
    Tov: 0,
    Postup: 0,
    Price: 0,
    Summ: 0,
    Zach: false,
    Pf: false,
    CenaAvg: 0,
    VatTov: 0
  };
}

function isBlankInvoiceDraftRow(row) {
  return (
    Number(row?.ID || 0) < 0 &&
    Number(row?.Tov || 0) <= 0 &&
    Number(row?.Postup || 0) === 0 &&
    Number(row?.Price || 0) === 0 &&
    Number(row?.Summ || 0) === 0 &&
    Number(row?.VatTov || 0) === 0 &&
    !normalizeBooleanValue(row?.Zach) &&
    !normalizeBooleanValue(row?.Pf)
  );
}

function ensureTrailingInvoiceDraftRow(sourceRows) {
  const source = Array.isArray(sourceRows) ? sourceRows : [];
  const existingDraft = [...source]
    .reverse()
    .find(isBlankInvoiceDraftRow);
  const actualRows = source.filter(
    (row) => !isBlankInvoiceDraftRow(row)
  );

  return [
    ...actualRows,
    existingDraft || createEmptyInvoiceRow()
  ];
}

const UNSAVED_CHANGES_MESSAGE =
  "Внимание! Вы не сохранили измененные данные!\nУверены, что хотите уйти?";

function normalizeDate(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function formatReportDate(value, locale = "ru-RU") {
  if (!value) return "—";

  const normalized = normalizeDate(value);
  const parsed = new Date(`${normalized}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleDateString(locale);
}

function formatReportNumber(value, locale = "ru-RU", digits = 3) {
  const number = Number(value ?? 0);

  return Number(number || 0).toLocaleString(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function formatReportMoney(value, locale = "ru-RU") {
  return formatReportNumber(value, locale, 2);
}

function getWarehouseName(list, id) {
  const warehouse = (Array.isArray(list) ? list : []).find(
    (item) => Number(item?.ID || 0) === Number(id || 0)
  );

  return warehouse?.Name || "";
}

function normalizePrintReport(data, invoiceNumber, invoiceId) {
  const source = Array.isArray(data) ? data[0] ?? {} : data ?? {};
  const items = Array.isArray(source.items) ? source.items : [];

  return {
    IdNakl: Number(source.IdNakl ?? source.ID ?? invoiceId ?? 0),
    Invoice:
      source.Invoice ??
      source["Накладная"] ??
      invoiceNumber ??
      "",
    Supplier:
      source["Поставщик"] ??
      source.Postav ??
      source.Supplier ??
      "",
    Warehouse:
      source["СкладПрихода"] ??
      source.SkladPrihoda ??
      source.Sklad ??
      "",
    DateP: normalizeDate(source.DateP ?? source.Date ?? ""),
    items: items.map((item, index) => ({
      ID: Number(item.ID ?? index + 1),
      NameT: item.NameT ?? item.Name ?? item["Сырьё"] ?? "",
      Postup: Number(item.Postup ?? item.Quantity ?? 0),
      Price: Number(item.Price ?? 0),
      Summ: Number(item["Сумма"] ?? item.Summ ?? item.Amount ?? 0),
      Unit: item["ЕдИзм"] ?? item.EdIzm ?? item.Unit ?? ""
    }))
  };
}


function buildPrihExportReport(report, reportTitle, locale, t) {
  const items = Array.isArray(report?.items) ? report.items : [];
  const total = items.reduce(
    (sum, item) => sum + Number(item.Summ || 0),
    0
  );

  return {
    title: `${reportTitle}${report?.Invoice ? ` № ${report.Invoice}` : ""}`,
    fileName: `Prih_${String(report?.Invoice || report?.IdNakl || "report")}`,
    orientation: "portrait",
    locale,
    meta: [
      {
        label: t("PrihInvoice.Date", "Дата"),
        value: formatReportDate(report?.DateP, locale)
      },
      ...(report?.Kind === "move"
        ? [
            {
              label: t("PrihInvoice.SourceWarehouse", "Откуда перемещено"),
              value: report?.SourceWarehouse || "—"
            },
            {
              label: t("PrihInvoice.DestinationWarehouse", "Куда перемещено"),
              value: report?.DestinationWarehouse || "—"
            }
          ]
        : [
            {
              label: t("PrihInvoice.Supplier", "Поставщик"),
              value: report?.Supplier || "—"
            },
            {
              label: t("PrihInvoice.ReceiptWarehouse", "Склад прихода"),
              value: report?.Warehouse || "—"
            }
          ])
    ],
    columns: [
      {
        key: "No",
        title: "№",
        type: "integer",
        width: 6
      },
      {
        key: "NameT",
        title: t("PrihInvoice.RawMaterial", "Сырьё"),
        type: "text",
        width: 42
      },
      {
        key: "Unit",
        title: t("CardsSirya.UnitShort", "Ед."),
        type: "text",
        width: 10
      },
      {
        key: "Postup",
        title: t("PrihInvoice.Quantity", "Кол-во"),
        type: "number",
        decimals: 3,
        width: 14
      },
      {
        key: "Price",
        title: t("PrihInvoice.Price", "Цена"),
        type: "number",
        decimals: 2,
        width: 14
      },
      {
        key: "Summ",
        title: t("PrihInvoice.Amount", "Сумма"),
        type: "number",
        decimals: 2,
        width: 16
      }
    ],
    rows: items.map((item, index) => ({
      No: index + 1,
      NameT: item.NameT || "",
      Unit: item.Unit || "",
      Postup: Number(item.Postup || 0),
      Price: Number(item.Price || 0),
      Summ: Number(item.Summ || 0)
    })),
    footerRows: [
      {
        label: t("Common.Total", "Итого"),
        values: {
          Summ: total
        }
      }
    ]
  };
}

function getDownloadFileName(response, fallbackName) {
  const disposition = response.headers.get("Content-Disposition") || "";

  const utf8Match = disposition.match(/filename\\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const simpleMatch = disposition.match(/filename="?([^";]+)"?/i);
  return simpleMatch?.[1] || fallbackName;
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function normalizeInvoiceItem(row) {
  return {
    ID: Number(row.ID || 0),
    Tov: Number(row.Tov || 0),
    Postup: Number(row.Postup || 0),
    Price: Number(row.Price || 0),
    Summ: Number(row.Summ || 0),
    Zach: Boolean(row.Zach),
    Pf: Boolean(row.Pf),
    CenaAvg: Number(row.CenaAvg || 0),
    VatTov: Number(row.VatTov || 0)
  };
}

function normalizeInvoiceState(header, rows) {
  return {
    header: {
      ID: Number(header.ID || 0),
      Invoice: header.Invoice || "",
      DateP: normalizeDate(header.DateP),
      Rem: header.Rem || "",
      VAT: Boolean(header.VAT),
      ProcVat: Number(header.ProcVat || 0),
      IdSklPer: Number(header.IdSklPer || 0),
      IdSkl: Number(header.IdSkl || 0),
      Oplach: Boolean(header.Oplach),
      Post: Number(header.Post || 0),
      Form: Number(header.Form || 0),
      Bel: Boolean(header.Bel),
      Vozv: Boolean(header.Vozv),
      Moldova: Number(header.Moldova || 0),
      pf: normalizeBooleanValue(header.pf ?? header.Pf),
      zach: normalizeBooleanValue(header.zach ?? header.Zach)
    },
    items: rows
      .filter((row) => !isBlankInvoiceDraftRow(row))
      .map(normalizeInvoiceItem)
  };
}

function normalizeRawList(data) {
  const rows = Array.isArray(data) ? data : [];

  return rows
    .map((item) => ({
      ...item,
      ID: Number(item.ID ?? item.Товар ?? item.Tovar ?? item.Tov ?? 0),
      Name: item.Name ?? item.name ?? "",
      Price: Number(item.Price || 0)
    }))
    .filter((item) => Number(item.ID || 0) !== 0);
}

function normalizeBooleanValue(value) {
  if (value === true || value === 1) return true;
  const text = String(value ?? "").trim().toLowerCase();
  return text === "1" || text === "true" || text === "yes";
}

function normalizeZachGrossList(data) {
  const rows = Array.isArray(data) ? data : [];

  return rows
    .map((item) => {
      const unit =
        item["Едиз"] ??
        item["ЕдИз"] ??
        item.EdIz ??
        item.Unit ??
        "";

      const baseName = String(item.Name ?? item.name ?? "");

      return {
        ...item,
        ID: Number(item.ID ?? item.Товар ?? item.Tovar ?? item.Tov ?? 0),
        BaseName: baseName,
        Unit: String(unit ?? ""),
        Name: unit ? `${baseName} (${unit})` : baseName,
        Price: Number(item.Price || 0)
      };
    })
    .filter((item) => Number(item.ID || 0) > 0);
}

function resolveInvoiceKind(data, requestedKind = "prih") {
  if (requestedKind === "pf" || normalizeBooleanValue(data?.pf ?? data?.Pf)) {
    return "pf";
  }

  if (
    requestedKind === "zach" ||
    normalizeBooleanValue(data?.zach ?? data?.Zach)
  ) {
    return "zach";
  }

  return requestedKind === "move" ? "move" : "prih";
}

function ensureSpecialRow(sourceRows, kind) {
  const rows = Array.isArray(sourceRows)
    ? sourceRows.map((row) => ({ ...row }))
    : [];

  if (
    kind === "zach" &&
    !rows.some((row) => normalizeBooleanValue(row.Zach))
  ) {
    rows.unshift({
      ID: makeTempId(),
      Tov: 0,
      Postup: 0,
      Price: 0,
      Summ: 0,
      Zach: true,
      Pf: false,
      CenaAvg: 0,
      VatTov: 0
    });
  }

  return rows;
}

function SearchableSelect({
  value,
  options,
  placeholder,
  onChange,
  onEnterNext,
  onCreateOption,
  onCreateError,
  cellIndex,
  matchMode = "contains",
  maxOptions = 0,
  disabled = false,
  t = (key, fallback = "") => fallback
}) {
  const selected = options.find((item) => Number(item.ID) === Number(value));
  const [text, setText] = useState(selected?.Name || "");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const nextSelected = options.find((item) => Number(item.ID) === Number(value));
    setText(nextSelected?.Name || "");
  }, [value, options]);

  const filtered = useMemo(() => {
    const query = text.trim().toLowerCase();
    const source = query
      ? options.filter((item) => {
          const name = String(item.Name || "").toLowerCase();
          return matchMode === "startsWith"
            ? name.startsWith(query)
            : name.includes(query);
        })
      : options;

    return Number.isFinite(Number(maxOptions)) && Number(maxOptions) > 0
      ? source.slice(0, Number(maxOptions))
      : source;
  }, [text, options, matchMode, maxOptions]);

  const exactMatch = useMemo(() => {
    const query = normalizeSearchText(text);

    if (!query) {
      return null;
    }

    return (
      options.find(
        (item) => normalizeSearchText(item.Name) === query
      ) ?? null
    );
  }, [text, options]);

function normalizeSearchText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function choose(item) {
  if (disabled) return;
  onChange(Number(item.ID || 0));
  setText(item.Name || "");
  setOpen(false);

  setTimeout(() => onEnterNext?.(cellIndex), 0);
}

async function createMissingOption() {
  const newName = text.trim();

  if (disabled || !newName || !onCreateOption || creating) {
    return;
  }

  const confirmed = window.confirm(
    t(
      "PrihInvoice.AddMissingRawConfirm",
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
          "PrihInvoice.AddRawInvalidResponse",
          "Сервер не вернул добавленный товар"
        )
      );
    }

    choose(createdItem);
  } catch (err) {
    onCreateError?.(
      err instanceof Error
        ? err
        : new Error(
            t(
              "PrihInvoice.AddRawError",
              "Не удалось добавить товар в справочник"
            )
          )
    );
  } finally {
    setCreating(false);
  }
}

  return (
    <div className="searchable-select">
      <input
        data-cell={cellIndex}
        value={text}
        placeholder={placeholder}
        disabled={disabled || creating}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        onKeyDown={async (e) => {
          if (e.key === "Escape") {
            setOpen(false);
            return;
          }

          if (e.key !== "Enter") {
            return;
          }

          e.preventDefault();

          if (exactMatch) {
            choose(exactMatch);
            return;
          }

          if (filtered.length === 1) {
            choose(filtered[0]);
            return;
          }

          if (filtered.length === 0 && text.trim() && onCreateOption) {
            await createMissingOption();
            return;
          }

          onEnterNext?.(cellIndex);
        }}
      />

      {open && !disabled && (
        <div className="searchable-select-list">
          {filtered.length === 0 && (
            onCreateOption && text.trim() ? (
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
                  ? t("PrihInvoice.AddingRawMaterial", "Добавление...")
                  : `${t(
                      "PrihInvoice.AddRawMaterialPrefix",
                      "Добавить"
                    )} «${text.trim()}»`}
              </button>
            ) : (
              <div className="searchable-select-empty">
                {t("PrihInvoice.SearchNothingFound", "Ничего не найдено")}
              </div>
            )
          )}

          {filtered.map((item) => (
            <button
              key={item.ID}
              type="button"
              className="searchable-select-option"
              onMouseDown={(e) => {
                e.preventDefault();
                choose(item);
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

function normalizeSupplierSearch(value, locale) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase(locale);
}

function getInvoiceSupplierId(data) {
  return Number(
    data?.Post ??
      data?.IdPost ??
      data?.IDPost ??
      data?.PostID ??
      data?.IdPostav ??
      0
  );
}

function getInvoiceSupplierName(data) {
  const directName =
    data?.NamePost ??
    data?.["Поставщик"] ??
    data?.SupplierName ??
    data?.Supplier ??
    "";

  if (String(directName ?? "").trim()) {
    return String(directName).trim();
  }

  const postav = data?.Postav;

  if (
    typeof postav === "string" &&
    postav.trim() &&
    !/^\d+$/.test(postav.trim())
  ) {
    return postav.trim();
  }

  return "";
}

function getSupplierNameById(list, id) {
  const supplier = (Array.isArray(list) ? list : []).find(
    (item) => Number(item?.ID || 0) === Number(id || 0)
  );

  return String(supplier?.Name ?? "");
}

function getSupplierIdByName(list, name, locale = "ru-RU") {
  const normalizedName =
    normalizeSupplierSearch(name, locale);

  if (!normalizedName) {
    return 0;
  }

  const supplier = (Array.isArray(list) ? list : []).find(
    (item) =>
      normalizeSupplierSearch(
        item?.Name,
        locale
      ) === normalizedName
  );

  return Number(supplier?.ID || 0);
}

async function loadInvoiceSupplierOptions({
  supplierOptions,
  currentOrg,
  fetchWithAuth
}) {
  if (
    Array.isArray(supplierOptions) &&
    supplierOptions.length > 0
  ) {
    return supplierOptions;
  }

  const url = new URL(
    "https://webback.bar-boss.com/wf_Directory.php"
  );

  url.searchParams.set("Action", "Postav");
  url.searchParams.set(
    "org",
    String(Number(currentOrg || 0))
  );

  const response = await fetchWithAuth(
    url.toString(),
    { method: "GET" }
  );

  const text = await response.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      "Поставщики вернули не JSON: " +
        text.substring(0, 300)
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.error ||
        data?.message ||
        "Ошибка загрузки поставщиков"
    );
  }

  return Array.isArray(data) ? data : [];
}

function SupplierSearch({
  value,
  options,
  placeholder,
  fallbackText = "",
  disabled = false,
  onChange,
  t = (key, fallback = "") => fallback,
  locale = "ru-RU"
}) {
  const rootRef = useRef(null);
  const supplierList = Array.isArray(options) ? options : [];

  const selected = useMemo(
    () =>
      supplierList.find(
        (item) => Number(item.ID) === Number(value)
      ) ?? null,
    [supplierList, value]
  );

  const selectedText =
    selected?.Name ||
    String(fallbackText ?? "").trim();
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

  const query = normalizeSupplierSearch(text, locale);
  const selectedQuery = normalizeSupplierSearch(selectedText, locale);

  const prefix = query === selectedQuery ? "" : query;

  const filtered = useMemo(
    () =>
      [...supplierList]
        .filter((item) =>
          normalizeSupplierSearch(item.Name, locale).startsWith(prefix)
        )
        .sort((a, b) =>
          String(a.Name ?? "").localeCompare(
            String(b.Name ?? ""),
            locale
          )
        ),
    [supplierList, prefix, locale]
  );

  const showEmptyOption =
    prefix === "" ||
    normalizeSupplierSearch(t("PrihInvoice.SupplierNotSelected", "Не выбран"), locale).startsWith(prefix);

  function choose(item) {
    onChange?.(Number(item?.ID || 0));
    setText(item?.Name || "");
    setOpen(false);
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

    const exact = filtered.find(
      (item) =>
        normalizeSupplierSearch(item.Name, locale) === prefix
    );

    if (exact) {
      choose(exact);
      return;
    }

    if (filtered.length === 1) {
      choose(filtered[0]);
    }
  }

  return (
    <div
      className="searchable-select prih-invoice-supplier-search"
      ref={rootRef}
    >
      <input
        type="text"
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        onFocus={(event) => {
          if (disabled) return;

          setOpen(true);
          event.currentTarget.select();
        }}
        onChange={(event) => {
          setText(event.target.value);
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        aria-label={t("PrihInvoice.SupplierSearchAria", "Поиск поставщика")}
        aria-expanded={open}
      />

      {open && !disabled && (
        <div className="searchable-select-list">
          {showEmptyOption && (
            <button
              type="button"
              className="searchable-select-option muted"
              onMouseDown={(event) => {
                event.preventDefault();
                choose(null);
              }}
            >
              {t("PrihInvoice.SupplierNotSelected", "Не выбран")}
            </button>
          )}

          {filtered.map((item) => (
            <button
              key={item.ID}
              type="button"
              className="searchable-select-option"
              onMouseDown={(event) => {
                event.preventDefault();
                choose(item);
              }}
            >
              {item.Name}
            </button>
          ))}

          {!showEmptyOption && filtered.length === 0 && (
            <div className="searchable-select-empty">
              {t("PrihInvoice.SupplierNotFound", "Поставщик не найден")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PrihInvoicePrintReport({
  report,
  reportTitle,
  onBack,
  onExport,
  exportLoading,
  locale,
  t
}) {
  const items = Array.isArray(report?.items) ? report.items : [];
  const total = items.reduce(
    (sum, item) => sum + Number(item.Summ || 0),
    0
  );

  useEffect(() => {
    const styleElement = document.createElement("style");
    styleElement.dataset.prihInvoicePrintPage = "true";
    styleElement.textContent =
      "@media print { @page { size: A4 portrait; margin: 10mm; } }";
    document.head.appendChild(styleElement);

    return () => {
      styleElement.remove();
    };
  }, []);

  return (
    <div className="prih-invoice-print-page">
      <div className="module-toolbar prih-invoice-print-toolbar no-print">
        <div className="toolbar-left">
          <button type="button" className="toolbar-button" onClick={onBack}>
            {t("Common.Back", "Назад")}
          </button>
        </div>

        <div className="toolbar-right">
          <button
            type="button"
            className="toolbar-button"
            disabled={Boolean(exportLoading)}
            onClick={() => onExport?.("xlsx")}
          >
            {t("Common.Excel", "Excel")}
          </button>

          <button
            type="button"
            className="toolbar-button"
            disabled={Boolean(exportLoading)}
            onClick={() => onExport?.("docx")}
          >
            {t("Common.Word", "Word")}
          </button>

          <button
            type="button"
            className="toolbar-button primary"
            disabled={Boolean(exportLoading)}
            onClick={() => window.print()}
          >
            {t("Common.Print", "Печать")}
          </button>
        </div>
      </div>

      <article className="prih-invoice-print-sheet">
        <header className="prih-invoice-print-header">
          <div>
            <div className="prih-invoice-print-kicker">
              {reportTitle}
            </div>
            <h1>
              {reportTitle}
              {report?.Invoice ? ` № ${report.Invoice}` : ""}
            </h1>
            <div className="prih-invoice-print-date">
              {t("PrihInvoice.Date", "Дата")}: {formatReportDate(report?.DateP, locale)}
            </div>
          </div>

          <div className="prih-invoice-print-meta">
            {report?.Kind === "move" ? (
              <>
                <div>
                  <span>
                    {t("PrihInvoice.SourceWarehouse", "Откуда перемещено")}
                  </span>
                  <strong>{report?.SourceWarehouse || "—"}</strong>
                </div>
                <div>
                  <span>
                    {t("PrihInvoice.DestinationWarehouse", "Куда перемещено")}
                  </span>
                  <strong>{report?.DestinationWarehouse || "—"}</strong>
                </div>
              </>
            ) : (
              <>
                <div>
                  <span>{t("PrihInvoice.Supplier", "Поставщик")}</span>
                  <strong>{report?.Supplier || "—"}</strong>
                </div>
                <div>
                  <span>{t("PrihInvoice.ReceiptWarehouse", "Склад прихода")}</span>
                  <strong>{report?.Warehouse || "—"}</strong>
                </div>
              </>
            )}
          </div>
        </header>

        <div className="prih-invoice-print-table-wrap">
          <table className="prih-invoice-print-table">
            <colgroup>
              <col className="prih-invoice-print-col-index" />
              <col className="prih-invoice-print-col-name" />
              <col className="prih-invoice-print-col-unit" />
              <col className="prih-invoice-print-col-quantity" />
              <col className="prih-invoice-print-col-price" />
              <col className="prih-invoice-print-col-amount" />
            </colgroup>
            <thead>
              <tr>
                <th>№</th>
                <th>{t("PrihInvoice.RawMaterial", "Сырьё")}</th>
                <th>{t("CardsSirya.UnitShort", "Ед.")}</th>
                <th className="num">{t("PrihInvoice.Quantity", "Кол-во")}</th>
                <th className="num">{t("PrihInvoice.Price", "Цена")}</th>
                <th className="num">{t("PrihInvoice.Amount", "Сумма")}</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan="6" className="prih-invoice-print-empty">
                    {t("PrihInvoice.EmptyRows", "Строки не добавлены.")}
                  </td>
                </tr>
              ) : (
                items.map((item, index) => (
                  <tr key={`${item.ID || "item"}-${index}`}>
                    <td className="center">{index + 1}</td>
                    <td>{item.NameT || "—"}</td>
                    <td className="center">{item.Unit || "—"}</td>
                    <td className="num">
                      {formatReportNumber(item.Postup, locale)}
                    </td>
                    <td className="num">
                      {formatReportMoney(item.Price, locale)}
                    </td>
                    <td className="num">
                      {formatReportMoney(item.Summ, locale)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan="5">{t("Common.Total", "Итого")}</td>
                <td className="num">{formatReportMoney(total, locale)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </article>
    </div>
  );
}

export default function PrihInvoicePage({
  invoiceId,
  initialInvoice = null,
  invoiceListRow = null,
  mode = "edit",
  invoiceKind = "prih",
  currentSklad = "",
  currentOrg = 0,
  supplierOptions = [],
  login = "",
  fetchWithAuth,
  readOnly = false,
  onBack,
  onSaved,
  onDeletePFCompleted,
  onDirtyChange,
  t = (key, fallback = "") => fallback,
  locale = "ru-RU"
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [printLoading, setPrintLoading] = useState(false);
  const [printReport, setPrintReport] = useState(null);
  const [exportLoading, setExportLoading] = useState(false);

  const [execLoading, setExecLoading] = useState(false);
  const [execError, setExecError] = useState("");
  const [execDialog, setExecDialog] = useState("");
  const [execToSkl, setExecToSkl] = useState("");
  const [execDate, setExecDate] = useState("");

  const [sopostRow, setSopostRow] = useState(null);
  const [sopostTovId, setSopostTovId] = useState(0);
  const [sopostLoading, setSopostLoading] = useState(false);
  const [sopostError, setSopostError] = useState("");

  const [header, setHeader] = useState(null);
  const [rows, setRows] = useState([]);

  const [sklList, setSklList] = useState([]);
  const [postList, setPostList] = useState([]);
  const [formList, setFormList] = useState([]);
  const [rawList, setRawList] = useState([]);
  const [zachGrossList, setZachGrossList] = useState([]);

  const sopostRawList = useMemo(
    () => rawList.filter((item) => Number(item.ID || 0) > 0),
    [rawList]
  );

  const sopostScanName = sopostRow
    ? rawList.find(
        (item) => Number(item.ID) === Number(sopostRow.Tov)
      )?.Name || ""
    : "";

  const [deletedIds, setDeletedIds] = useState([]);
  const [originalState, setOriginalState] = useState(null);

  const effectiveKind = resolveInvoiceKind(header, invoiceKind);
  const isPfInvoice = effectiveKind === "pf";
  const isZachInvoice = effectiveKind === "zach";
  const isSpecialInvoice = isPfInvoice || isZachInvoice;
  const isMoldova = Number(header?.Moldova || 0) !== 0;
  const isMoveInvoice =
    !isSpecialInvoice &&
    (effectiveKind === "move" || Number(header?.IdSklPer || 0) !== 0);
  const isIncomingMoveView =
    isMoveInvoice && invoiceKind !== "move";
  const isNewMode = mode === "new";
  const usesTrailingDraftRow =
    !readOnly && !isSpecialInvoice && !isIncomingMoveView;
  const showWeightCorrection =
    !isNewMode && !isMoveInvoice && !isSpecialInvoice;
  
  const totalSumm = rows.reduce(
    (sum, row) => sum + Number(row.Summ || 0),
    0
  );

  const currentState = header
    ? normalizeInvoiceState(header, rows)
    : null;

  const isDirty = !readOnly && Boolean(
    deletedIds.length > 0 ||
      (
        originalState &&
        currentState &&
        JSON.stringify(currentState) !== JSON.stringify(originalState)
      )
  );

  const originalItemsById = new Map(
    (originalState?.items || []).map((row) => [Number(row.ID || 0), row])
  );

  const changedSpecialRows =
    !isNewMode && isSpecialInvoice
      ? rows.filter((row) => {
          const rowId = Number(row.ID || 0);
          const currentRow = normalizeInvoiceItem(row);

          if (rowId <= 0) {
            return (
              Number(currentRow.Tov || 0) > 0 ||
              Number(currentRow.Postup || 0) !== 0 ||
              Number(currentRow.Price || 0) !== 0
            );
          }

          const originalRow = originalItemsById.get(rowId);

          if (!originalRow) return true;

          return (
            Number(currentRow.Tov || 0) !== Number(originalRow.Tov || 0) ||
            Number(currentRow.Postup || 0) !== Number(originalRow.Postup || 0) ||
            Number(currentRow.Price || 0) !== Number(originalRow.Price || 0) ||
            Boolean(currentRow.Zach) !== Boolean(originalRow.Zach) ||
            Boolean(currentRow.Pf) !== Boolean(originalRow.Pf) ||
            Number(currentRow.VatTov || 0) !== Number(originalRow.VatTov || 0)
          );
        })
      : [];

  const hasSpecialDetailChanges =
    changedSpecialRows.length > 0 ||
    deletedIds.some((id) => Number(id || 0) > 0);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

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
  setPrintReport(null);

  if (initialInvoice) {
    loadFromInvoiceData(initialInvoice, mode === "new");
    return;
  }

  loadAll();

  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [invoiceId, initialInvoice, mode, readOnly]);

  async function loadAll() {
    if (!invoiceId) return;

    setLoading(true);
    setError("");

    try {
      const [invoiceResponse, sklResponse, formResponse] =
        await Promise.all([
          fetchWithAuth(
            `https://webback.bar-boss.com/wf_PrihProsm.php?ID=${encodeURIComponent(invoiceId)}`
          ),
          fetchWithAuth("https://webback.bar-boss.com/wf_Podrazd.php"),
          fetchWithAuth("https://webback.bar-boss.com/wf_Valuts.php")
        ]);

      const invoiceText = await invoiceResponse.text();

      let invoiceData;

      try {
        invoiceData = JSON.parse(invoiceText);
      } catch {
        throw new Error(t("PrihInvoice.InvoiceNonJsonPrefix", "Накладная вернула не JSON:") + " " + invoiceText.substring(0, 500));
      }

      if (Array.isArray(invoiceData)) {
        invoiceData = invoiceData[0] ?? {};
      }

      const sklData = await sklResponse.json();
      const formData = await formResponse.json();

      const normalizedHeader = {
        ...invoiceData,
        ID: Number(invoiceData.ID || 0),
        Invoice: invoiceData.Invoice || "",
        DateP: normalizeDate(invoiceData.DateP),
        Rem: invoiceData.Rem || "",
        VAT: Boolean(invoiceData.VAT),
        ProcVat: Number(invoiceData.ProcVat || 0),
        IdSklPer: Number(invoiceData.IdSklPer || 0),
        IdSkl: Number(invoiceData.IdSkl || 0),
        Oplach: Boolean(invoiceData.Oplach),
        Post:
          getInvoiceSupplierId(invoiceData) ||
          getInvoiceSupplierId(invoiceListRow),
        SupplierName:
          getInvoiceSupplierName(invoiceData) ||
          getInvoiceSupplierName(invoiceListRow),
        Form: Number(invoiceData.Form || 0),
        Bel: Boolean(invoiceData.Bel),
        Vozv: Boolean(Number(invoiceData.Vozv ?? 0)),
        Moldova: Number(invoiceData.Moldova || 0),
        pf: normalizeBooleanValue(invoiceData.pf ?? invoiceData.Pf),
        zach: normalizeBooleanValue(invoiceData.zach ?? invoiceData.Zach)
      };

      const loadedKind = resolveInvoiceKind(invoiceData, invoiceKind);
      const loadedRows = ensureSpecialRow(
        Array.isArray(invoiceData.items)
          ? invoiceData.items.map((row) => ({
              ID: Number(row.ID || 0),
              Tov: Number(row.Tov || 0),
              Postup: Number(row.Postup || 0),
              Price: Number(row.Price || 0),
              Summ: Number(row.Summ || 0),
              Zach: normalizeBooleanValue(row.Zach),
              Pf: normalizeBooleanValue(row.Pf),
              CenaAvg: Number(row.CenaAvg || 0),
              VatTov: Number(row.VatTov || 0)
            }))
          : [],
        loadedKind
      );

      const isLoadedMoveInvoice =
        loadedKind === "move" &&
        Number(normalizedHeader.IdSklPer || 0) !== 0;

      const hasLoadedMoveSource =
        Number(normalizedHeader.IdSklPer || 0) !== 0;

      const editorRows =
        !readOnly &&
        loadedKind !== "pf" &&
        loadedKind !== "zach" &&
        !(hasLoadedMoveSource && invoiceKind !== "move")
          ? ensureTrailingInvoiceDraftRow(loadedRows)
          : loadedRows;

      const sourceSklad =
        Number(normalizedHeader.IdSklPer || 0) ||
        Number(currentSklad || 0) ||
        Number(normalizedHeader.IdSkl || 0);

      const rawUrl =
        isLoadedMoveInvoice
          ? `https://webback.bar-boss.com/wf_SpisokTovNalich.php?Sklad=${encodeURIComponent(normalizedHeader.IdSklPer)}`
          : "https://webback.bar-boss.com/wf_SpisokTovarovCalc.php";

      const [rawResponse, zachGrossResponse] = await Promise.all([
        fetchWithAuth(rawUrl),
        Promise.resolve(null)
      ]);

      const rawData = await rawResponse.json();
      const zachGrossData = zachGrossResponse
        ? await zachGrossResponse.json()
        : [];

      let resolvedHeader = normalizedHeader;

      const loadedPostList =
        await loadInvoiceSupplierOptions({
          supplierOptions,
          currentOrg,
          fetchWithAuth
        });

      if (
        Number(resolvedHeader.Post || 0) <= 0 &&
        String(resolvedHeader.SupplierName ?? "").trim()
      ) {
        const supplierId = getSupplierIdByName(
          loadedPostList,
          resolvedHeader.SupplierName,
          locale
        );

        if (supplierId > 0) {
          resolvedHeader = {
            ...resolvedHeader,
            Post: supplierId
          };
        }
      }

      setHeader(resolvedHeader);
      setRows(editorRows);
      setSklList(Array.isArray(sklData) ? sklData : []);
      setFormList(Array.isArray(formData) ? formData : []);
      setRawList(normalizeRawList(rawData));
      setZachGrossList(normalizeZachGrossList(zachGrossData));
      setPostList(loadedPostList);
      setDeletedIds([]);

      setOriginalState(
        normalizeInvoiceState(
          resolvedHeader,
          editorRows
        )
      );
    } catch (err) {
      setError(err.message || t("PrihInvoice.LoadError", "Ошибка загрузки приходной накладной"));
    } finally {
      setLoading(false);
    }
  }

  async function loadFromInvoiceData(invoiceData, isNew = false) {
  setLoading(true);
  setError("");

  try {
const loadedKind = resolveInvoiceKind(invoiceData, invoiceKind);
const isMoveData =
  loadedKind === "move" && Number(invoiceData.IdSklPer || 0) !== 0;

const sourceSklad =
  isNew && loadedKind === "pf"
    ? Number(currentSklad || 0)
    : Number(invoiceData.IdSklPer || 0) ||
      Number(currentSklad || 0) ||
      Number(invoiceData.IdSkl || 0);

const rawUrl =
  isNew && loadedKind === "pf"
    ? `https://webback.bar-boss.com/wf_SpisokTovNalichPF.php?Sklad=${encodeURIComponent(sourceSklad)}`
    : isNew && loadedKind === "zach"
      ? `https://webback.bar-boss.com/wf_SpisokTovNalich.php?Sklad=${encodeURIComponent(sourceSklad)}`
      : isMoveData
        ? `https://webback.bar-boss.com/wf_SpisokTovNalich.php?Sklad=${encodeURIComponent(invoiceData.IdSklPer)}`
        : "https://webback.bar-boss.com/wf_SpisokTovarovCalc.php";

const [
  sklResponse,
  postData,
  formResponse,
  rawResponse,
  zachGrossResponse
] = await Promise.all([
  fetchWithAuth("https://webback.bar-boss.com/wf_Podrazd.php"),
  loadInvoiceSupplierOptions({
    supplierOptions,
    currentOrg,
    fetchWithAuth
  }),
  fetchWithAuth("https://webback.bar-boss.com/wf_Valuts.php"),
  fetchWithAuth(rawUrl),
  isNew && loadedKind === "zach"
    ? fetchWithAuth("https://webback.bar-boss.com/wf_SpisokTovarovZach.php")
    : Promise.resolve(null)
]);

    const sklData = await sklResponse.json();
    const formData = await formResponse.json();
    const rawData = await rawResponse.json();
    const zachGrossData = zachGrossResponse
      ? await zachGrossResponse.json()
      : [];


    let normalizedHeader = {
      ...invoiceData,
      ID: Number(invoiceData.ID || 0),
      Invoice: invoiceData.Invoice || "",
      DateP: normalizeDate(invoiceData.DateP),
      Rem: invoiceData.Rem || "",
      VAT: Boolean(invoiceData.VAT),
      ProcVat: Number(invoiceData.ProcVat || 0),
      IdSklPer: Number(invoiceData.IdSklPer || 0),
      IdSkl: Number(invoiceData.IdSkl || 0),
      Oplach: Boolean(invoiceData.Oplach),
      Post:
          getInvoiceSupplierId(invoiceData) ||
          getInvoiceSupplierId(invoiceListRow),
        SupplierName:
          getInvoiceSupplierName(invoiceData) ||
          getInvoiceSupplierName(invoiceListRow),
      Form: Number(invoiceData.Form || 0),
      Bel: Boolean(invoiceData.Bel),
      Vozv: Boolean(Number(invoiceData.Vozv ?? 0)),
      Moldova: Number(invoiceData.Moldova || 0),
      pf: normalizeBooleanValue(invoiceData.pf ?? invoiceData.Pf),
      zach: normalizeBooleanValue(invoiceData.zach ?? invoiceData.Zach)
    };

    if (
      isNew &&
      loadedKind === "prih" &&
      Number(normalizedHeader.Form || 0) <= 0
    ) {
      const cashForm = (Array.isArray(formData) ? formData : []).find(
        (item) =>
          String(item?.Name ?? "")
            .trim()
            .toLocaleLowerCase("ru-RU") === "наличные"
      );

      if (Number(cashForm?.ID || 0) > 0) {
        normalizedHeader = {
          ...normalizedHeader,
          Form: Number(cashForm.ID)
        };
      }
    }

    if (
      Number(normalizedHeader.Post || 0) <= 0 &&
      String(normalizedHeader.SupplierName ?? "").trim()
    ) {
      const supplierId = getSupplierIdByName(
        postData,
        normalizedHeader.SupplierName,
        locale
      );

      if (supplierId > 0) {
        normalizedHeader = {
          ...normalizedHeader,
          Post: supplierId
        };
      }
    }

    const loadedRows = ensureSpecialRow(
      Array.isArray(invoiceData.items)
        ? invoiceData.items.map((row) => ({
            ID: Number(row.ID || 0),
            Tov: Number(row.Tov || 0),
            Postup: Number(row.Postup || 0),
            Price: Number(row.Price || 0),
            Summ: Number(row.Summ || 0),
            Zach: normalizeBooleanValue(row.Zach),
            Pf: normalizeBooleanValue(row.Pf),
            CenaAvg: Number(row.CenaAvg || 0),
            VatTov: Number(row.VatTov || 0)
          }))
        : [],
      loadedKind
    );

    const editorRows =
      !readOnly &&
      loadedKind !== "pf" &&
      loadedKind !== "zach" &&
      !(isMoveData && invoiceKind !== "move")
        ? ensureTrailingInvoiceDraftRow(loadedRows)
        : loadedRows;

    setHeader(normalizedHeader);
    setRows(editorRows);
    setPostList(Array.isArray(postData) ? postData : []);
    setFormList(Array.isArray(formData) ? formData : []);
    setRawList(normalizeRawList(rawData));
    setZachGrossList(normalizeZachGrossList(zachGrossData));
    setSklList(Array.isArray(sklData) ? sklData : []);
    setDeletedIds([]);
    setOriginalState(normalizeInvoiceState(normalizedHeader, editorRows));
    
  } catch (err) {
    setError(err.message || t("PrihInvoice.LoadNewError", "Ошибка загрузки новой приходной накладной"));
  } finally {
    setLoading(false);
  }
}

  async function createRawMaterial(name) {
    if (readOnly) {
      throw new Error(
        t("PrihInvoice.ReadOnly", "Накладная доступна только для просмотра.")
      );
    }

    const normalizedName = String(name ?? "").trim();

    if (!normalizedName) {
      throw new Error(
        t("PrihInvoice.RawNameRequired", "Введите название товара")
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
          "PrihInvoice.AddRawNonJson",
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
            "PrihInvoice.AddRawError",
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
          "PrihInvoice.AddRawInvalidResponse",
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


  async function reloadSpecialRawList(skladValue) {
    const sklad = Number(skladValue || currentSklad || header?.IdSkl || 0);

    if (!sklad) {
      setRawList([]);
      return;
    }

    const endpoint = isPfInvoice
      ? "wf_SpisokTovNalichPF.php"
      : "wf_SpisokTovNalich.php";

    const response = await fetchWithAuth(
      `https://webback.bar-boss.com/${endpoint}?Sklad=${encodeURIComponent(sklad)}`
    );
    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        t(
          "PrihInvoice.SpecialRawNonJson",
          "Список сырья вернул не JSON:"
        ) +
          " " +
          text.substring(0, 300)
      );
    }

    if (!response.ok || data?.status === "error") {
      throw new Error(
        data?.error ||
          data?.message ||
          t(
            "PrihInvoice.SpecialRawLoadError",
            "Ошибка загрузки списка сырья"
          )
      );
    }

    setRawList(normalizeRawList(data));
  }

  async function changeProductionSource(value) {
    const sourceId = Number(value || 0);
    updateHeaderField("IdSklPer", sourceId);

    try {
      await reloadSpecialRawList(sourceId);
    } catch (err) {
      setError(
        err?.message ||
          t(
            "PrihInvoice.SpecialRawLoadError",
            "Ошибка загрузки списка сырья"
          )
      );
    }
  }

  function getSpecialRow(kind) {
    return rows.find((row) =>
      kind === "pf"
        ? normalizeBooleanValue(row.Pf)
        : normalizeBooleanValue(row.Zach)
    );
  }

  function getWorkingRows() {
    if (isPfInvoice) {
      return rows;
    }

    if (isZachInvoice) {
      return rows.filter((row) => !normalizeBooleanValue(row.Zach));
    }

    return rows;
  }

  function isInvoiceRowDirty(row) {
    if (isBlankInvoiceDraftRow(row)) return false;
    if (!originalState) return false;

    const originalRow = originalState.items.find(
      (item) => Number(item.ID) === Number(row.ID)
    );

    if (!originalRow) return true;

    return (
      JSON.stringify(normalizeInvoiceItem(row)) !==
      JSON.stringify(originalRow)
    );
  }

  function handleBackClick() {
    if (isDirty && !window.confirm(t("PrihInvoice.UnsavedChangesWarning", UNSAVED_CHANGES_MESSAGE))) {
      return;
    }

    onDirtyChange?.(false);
    onBack?.();
  }

  function updateHeaderField(field, value) {
    if (readOnly) return;
    setHeader((prev) => ({
      ...prev,
      [field]: value
    }));
  }

  function updateRow(rowId, patch) {
    if (readOnly) return;
    setRows((prevRows) => {
      const nextRows = prevRows.map((row) => {
        if (row.ID !== rowId) return row;

        const nextRow = {
          ...row,
          ...patch
        };

        if ("Postup" in patch) {
          nextRow.Postup = roundQuantity(nextRow.Postup);
        }

        if ("Postup" in patch || "Price" in patch) {
          nextRow.Summ = roundMoney(
            Number(nextRow.Postup || 0) * Number(nextRow.Price || 0)
          );
        }

        return nextRow;
      });

      return usesTrailingDraftRow
        ? ensureTrailingInvoiceDraftRow(nextRows)
        : nextRows;
    });
  }

  function addRow(options = {}) {
    if (readOnly) return null;

    if (usesTrailingDraftRow) {
      const existingDraft = [...rows]
        .reverse()
        .find(isBlankInvoiceDraftRow);

      if (existingDraft) {
        if (options.focusRaw) {
          window.setTimeout(() => {
            const input = document.querySelector(
              `[data-row-id="${existingDraft.ID}"] .searchable-select input`
            );

            input?.focus();
            input?.select?.();
          }, 0);
        }

        return existingDraft.ID;
      }
    }

    const newRow = createEmptyInvoiceRow();
    const rowId = newRow.ID;

    setRows((prevRows) =>
      usesTrailingDraftRow
        ? ensureTrailingInvoiceDraftRow([...prevRows, newRow])
        : [...prevRows, newRow]
    );

    if (options.focusRaw) {
      window.setTimeout(() => {
        const input = document.querySelector(
          `[data-row-id="${rowId}"] .searchable-select input`
        );

        input?.focus();
        input?.select?.();
      }, 0);
    }

    return rowId;
  }

  function addRowAndFocusRaw() {
    addRow({ focusRaw: true });
  }

  function deleteRow(rowId) {
    if (readOnly) return;

    const targetRow = rows.find((row) => row.ID === rowId);

    if (isBlankInvoiceDraftRow(targetRow)) {
      return;
    }

    const ok = window.confirm(t("PrihInvoice.DeleteConfirm", "Вы уверены?"));

    if (!ok) return;

    setRows((prevRows) => {
      const nextRows = prevRows.filter((row) => row.ID !== rowId);

      return usesTrailingDraftRow
        ? ensureTrailingInvoiceDraftRow(nextRows)
        : nextRows;
    });

    if (rowId > 0) {
      setDeletedIds((prev) => [...prev, rowId]);
    }
  }

  function focusNextCell(currentCell) {
    const current = Number(currentCell || 0);
    const next = document.querySelector(`[data-cell="${current + 1}"]`);

    if (next) {
      next.focus();
      if (typeof next.select === "function") {
        next.select();
      }
    }
  }

  function handleCellKeyDown(e) {
    if (e.key !== "Enter") return;

    e.preventDefault();
    focusNextCell(e.currentTarget.dataset.cell);
  }
function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

  function buildSaveXml() {
    const zachGrossRow = isZachInvoice ? getSpecialRow("zach") : null;
    const specialHeadAttrs = isZachInvoice
      ? ` Tov="${Number(zachGrossRow?.Tov || 0)}" Postup="${roundQuantity(zachGrossRow?.Postup || 0)}" Price="${Number(zachGrossRow?.Price || 0)}"`
      : "";

    const itemsXml = rows
      .filter(
        (row) =>
          Number(row.Tov || 0) > 0 &&
          (!isZachInvoice || !normalizeBooleanValue(row.Zach))
      )
      .map((row) => {
        return `    <Item ID="${Number(row.ID || 0)}" Tov="${Number(row.Tov || 0)}" Postup="${roundQuantity(row.Postup || 0)}" Price="${Number(row.Price || 0)}" Zach="${Number(Boolean(row.Zach))}" Pf="${Number(Boolean(row.Pf))}" VatTov="${Number(row.VatTov || 0)}" />`;
      })
      .join("\n");

    const deletedXml = deletedIds
      .filter((id) => Number(id) > 0)
      .map((id) => `    <Item ID="${Number(id)}" />`)
      .join("\n");

return `<Prih>
  <Head ID="${Number(header.ID || 0)}" Invoice="${escapeXml(header.Invoice || "")}" DateP="${escapeXml(header.DateP || "")}" IdSkl="${Number(header.IdSkl || 0)}" IdSklPer="${Number(header.IdSklPer || 0)}" Post="${Number(header.Post || 0)}" Form="${Number(header.Form || 0)}" Oplach="${Number(Boolean(header.Oplach))}" Bel="${Number(Boolean(header.Bel))}" Vozv="${Number(Boolean(header.Vozv))}" VAT="${Number(Boolean(header.VAT))}" ProcVat="${Number(header.ProcVat || 0)}" pf="${isPfInvoice ? 1 : 0}" zach="${isZachInvoice ? 1 : 0}"${specialHeadAttrs} />

  <Items>
${itemsXml}
  </Items>

  <Deleted>
${deletedXml}
  </Deleted>

  <Rem>${escapeXml(header.Rem || "")}</Rem>
</Prih>`;
  }

async function handleOpenPrintPreview() {
  const idNakl = Number(header?.ID || invoiceId || 0);

  if (idNakl <= 0 || printLoading) {
    return;
  }

  setPrintLoading(true);

  try {
    const response = await fetchWithAuth(
      `https://webback.bar-boss.com/wr_PrihNakl.php?IdNakl=${encodeURIComponent(idNakl)}`
    );
    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        t("PrihInvoice.InvoiceNonJsonPrefix", "Накладная вернула не JSON:") +
          " " +
          text.substring(0, 500)
      );
    }

    if (!response.ok || data?.status === "error") {
      throw new Error(
        data?.error ||
          t(
            "PrihInvoice.LoadError",
            "Ошибка загрузки приходной накладной"
          )
      );
    }

    const normalizedReport = normalizePrintReport(
      data,
      header?.Invoice || "",
      idNakl
    );

    if (!normalizedReport.Supplier) {
      normalizedReport.Supplier =
        getSupplierNameById(
          postList,
          header?.Post
        ) ||
        String(header?.SupplierName ?? "").trim() ||
        getInvoiceSupplierName(invoiceListRow);
    }

    if (isMoveInvoice) {
      normalizedReport.Kind = "move";
      normalizedReport.SourceWarehouse =
        getWarehouseName(sklList, header?.IdSklPer) ||
        String(header?.IdSklPer || "");
      normalizedReport.DestinationWarehouse =
        getWarehouseName(sklList, header?.IdSkl) ||
        normalizedReport.Warehouse ||
        String(header?.IdSkl || "");
    }

    setPrintReport(normalizedReport);
  } catch (err) {
    window.alert(
      err?.message ||
        t("PrihInvoice.LoadError", "Ошибка загрузки приходной накладной")
    );
  } finally {
    setPrintLoading(false);
  }
}

function buildRefExecXml(params = {}) {
  const orderedKeys = ["dat", "ID", "ToSkl", "login", "SklFrom"];

  const fields = orderedKeys
    .filter((key) => Object.prototype.hasOwnProperty.call(params, key))
    .map((key) => `<${key}>${escapeXml(params[key] ?? "")}</${key}>`)
    .join("");

  return `<Ref>${fields}</Ref>`;
}

async function runRefExecXml(action, xml) {
  if (!fetchWithAuth) {
    throw new Error(
      t("PrihInvoice.RefExecUnavailable", "Не удалось выполнить операцию.")
    );
  }

  const body = new URLSearchParams();
  body.set("Action", action);
  body.set("xml", xml);

  const response = await fetchWithAuth(
    "https://webback.bar-boss.com/wf_RefExec.php",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
      },
      body
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
          "PrihInvoice.RefExecInvalidResponse",
          "Сервер вернул некорректный ответ."
        )
      );
    }
  }

  const normalized = Array.isArray(data) ? data[0] : data;

  if (!response.ok || normalized?.status === "error") {
    throw new Error(
      normalized?.error ||
        normalized?.message ||
        t("PrihInvoice.RefExecError", "Ошибка выполнения операции.")
    );
  }

  return normalized;
}

async function runRefExec(action, params) {
  return runRefExecXml(action, buildRefExecXml(params));
}

function openSopostDialog(row) {
  if (
    readOnly ||
    isNewMode ||
    isMoveInvoice ||
    isSpecialInvoice ||
    Number(header?.ID || invoiceId || 0) <= 0 ||
    Number(row?.ID || 0) <= 0 ||
    Number(row?.Tov || 0) >= 0
  ) {
    return;
  }

  setSopostRow(row);
  setSopostTovId(0);
  setSopostError("");
}

function closeSopostDialog() {
  if (sopostLoading) return;

  setSopostRow(null);
  setSopostTovId(0);
  setSopostError("");
}

function buildSopostXml(row, typ, idTov = 0) {
  return `<Ref><IdPrih>${Number(
    header?.ID || invoiceId || 0
  )}</IdPrih><IdTovScan>${Number(
    row?.Tov || 0
  )}</IdTovScan><IdTov>${Number(
    idTov || 0
  )}</IdTov><Typ>${Number(typ || 0)}</Typ><CodePri>${Number(
    row?.ID || 0
  )}</CodePri></Ref>`;
}

async function handleSopost(typ) {
  if (readOnly || sopostLoading || !sopostRow) return;

  const normalizedTyp = Number(typ || 0);
  const targetTovId = normalizedTyp === 2 ? Number(sopostTovId || 0) : 0;

  if (normalizedTyp === 2 && targetTovId <= 0) {
    return;
  }

  if (normalizedTyp === 1) {
    const confirmed = window.confirm(
      t(
        "PrihInvoice.ScanAddConfirm",
        "Вы уверены, что хотите добавить этот товар в основной справочник?"
      )
    );

    if (!confirmed) return;
  }

  setSopostLoading(true);
  setSopostError("");

  try {
    await runRefExecXml(
      "Sopost",
      buildSopostXml(sopostRow, normalizedTyp, targetTovId)
    );

    setSopostRow(null);
    setSopostTovId(0);
    await loadAll();
    onSaved?.(Number(header?.ID || invoiceId || 0));
  } catch (err) {
    const message =
      err?.message ||
      t(
        "PrihInvoice.ScanMatchError",
        "Не удалось обработать нераспознанный товар."
      );

    setSopostError(message);
  } finally {
    setSopostLoading(false);
  }
}

function canRunReceiptAction() {
  if (isDirty) {
    window.alert(
      t(
        "PrihInvoice.SaveBeforeAction",
        "Сначала сохраните изменения в накладной."
      )
    );
    return false;
  }

  if (!String(login || "").trim()) {
    window.alert(
      t(
        "PrihInvoice.ActionLoginRequired",
        "Не определён пользователь для выполнения операции."
      )
    );
    return false;
  }

  return true;
}

async function handleRecalcCost() {
  if (readOnly || !canRunReceiptAction() || execLoading) return;

  const confirmed = window.confirm(
    t("PrihInvoice.ConfirmRecalcCost", "Вы уверены?")
  );

  if (!confirmed) return;

  setExecLoading(true);
  setExecError("");

  try {
    await runRefExec("SebestNakl", {
      dat: header.DateP || "",
      ID: Number(header.ID || invoiceId || 0),
      login: String(login || "").trim()
    });

    await loadAll();
  } catch (err) {
    const message =
      err?.message ||
      t(
        "PrihInvoice.RecalcCostError",
        "Ошибка пересчёта себестоимости."
      );

    setExecError(message);
    window.alert(message);
  } finally {
    setExecLoading(false);
  }
}

function openCopyDialog() {
  if (readOnly || !canRunReceiptAction() || execLoading) return;

  setExecError("");
  setExecDate(header.DateP || "");
  setExecToSkl(String(currentSklad || header.IdSkl || ""));
  setExecDialog("copy");
}

function openMoveAllDialog() {
  if (readOnly || !canRunReceiptAction() || execLoading) return;

  setExecError("");
  setExecDate(header.DateP || "");
  setExecToSkl("");
  setExecDialog("move");
}

function closeExecDialog() {
  if (execLoading) return;

  setExecDialog("");
  setExecError("");
}

async function submitExecDialog() {
  if (readOnly || !execDialog || execLoading) return;

  const toSkl = Number(execToSkl || 0);

  if (!toSkl) {
    setExecError(
      t(
        "PrihInvoice.ExecWarehouseRequired",
        "Выберите склад в поле «Куда»."
      )
    );
    return;
  }

  if (
    execDialog === "move" &&
    toSkl === Number(currentSklad || 0)
  ) {
    setExecError(
      t(
        "PrihInvoice.ExecMoveSameWarehouse",
        "Для перемещения выберите другой склад."
      )
    );
    return;
  }

  if (!execDate) {
    setExecError(
      t("PrihInvoice.ExecDateRequired", "Укажите дату.")
    );
    return;
  }

  setExecLoading(true);
  setExecError("");

  try {
    const commonParams = {
      dat: execDate,
      ID: Number(header.ID || invoiceId || 0),
      ToSkl: toSkl,
      login: String(login || "").trim()
    };

    if (execDialog === "copy") {
      await runRefExec("CopyNakl", commonParams);

      if (toSkl === Number(currentSklad || 0)) {
        onSaved?.();
      }
    } else {
      await runRefExec("MoveNakl", {
        ...commonParams,
        SklFrom: Number(currentSklad || 0)
      });
    }

    setExecDialog("");
    setExecError("");
  } catch (err) {
    setExecError(
      err?.message ||
        t("PrihInvoice.RefExecError", "Ошибка выполнения операции.")
    );
  } finally {
    setExecLoading(false);
  }
}


function buildSpecialRecalcXml() {
  const itemsXml = changedSpecialRows
    .filter((row) => Number(row.Tov || 0) > 0)
    .map(
      (row) =>
        `    <Item ID="${Number(row.ID || 0)}" Tov="${Number(row.Tov || 0)}" Postup="${Number(row.Postup || 0)}" Price="${Number(row.Price || 0)}" Zach="${Number(Boolean(row.Zach))}" Pf="${Number(Boolean(row.Pf))}" VatTov="${Number(row.VatTov || 0)}" />`
    )
    .join("\n");

  const deletedXml = deletedIds
    .filter((id) => Number(id || 0) > 0)
    .map((id) => `    <Item ID="${Number(id)}" />`)
    .join("\n");

  return `<Prih>
  <Head ID="${Number(header?.ID || invoiceId || 0)}" />

  <Items>
${itemsXml}
  </Items>

  <Deleted>
${deletedXml}
  </Deleted>
</Prih>`;
}

function buildDeletePfXml() {
  return `<Prih>
  <Head ID="${Number(header?.ID || invoiceId || 0)}" />
</Prih>`;
}

async function handleRecalcZach() {
  if (
    readOnly ||
    execLoading ||
    isNewMode ||
    !isZachInvoice ||
    !hasSpecialDetailChanges
  ) {
    return;
  }

  setExecLoading(true);
  setExecError("");

  try {
    await runRefExecXml("SaveZach", buildSpecialRecalcXml());
    await loadAll();
    onSaved?.();
  } catch (err) {
    const message =
      err?.message ||
      t(
        "PrihInvoice.RecalcZachError",
        "Ошибка пересчёта зачистки."
      );

    setExecError(message);
    window.alert(message);
  } finally {
    setExecLoading(false);
  }
}

async function handleRecalcPf() {
  if (
    readOnly ||
    execLoading ||
    isNewMode ||
    !isPfInvoice ||
    !hasSpecialDetailChanges
  ) {
    return;
  }

  setExecLoading(true);
  setExecError("");

  try {
    await runRefExecXml("SavePF", buildSpecialRecalcXml());
    await loadAll();
    onSaved?.();
  } catch (err) {
    const message =
      err?.message ||
      t(
        "PrihInvoice.RecalcPFError",
        "Ошибка пересчёта ПФ."
      );

    setExecError(message);
    window.alert(message);
  } finally {
    setExecLoading(false);
  }
}

async function handleDeletePf() {
  if (readOnly || execLoading || isNewMode || !isPfInvoice) return;

  const confirmed = window.confirm(
    t(
      "PrihInvoice.DeletePFConfirm",
      "Вы уверены, что хотите удалить ПФ?"
    )
  );

  if (!confirmed) return;

  setExecLoading(true);
  setExecError("");

  try {
    await runRefExecXml("DeletePF", buildDeletePfXml());
    setOriginalState(currentState);
    setDeletedIds([]);
    onSaved?.();
    onDirtyChange?.(false);

    window.alert(
      t("PrihInvoice.DeletePFSuccess", "ПФ удалён.")
    );

    if (onDeletePFCompleted) {
      await onDeletePFCompleted();
    } else {
      await onBack?.();
    }
  } catch (err) {
    const message =
      err?.message ||
      t(
        "PrihInvoice.DeletePFError",
        "Ошибка удаления ПФ."
      );

    setExecError(message);
    window.alert(message);
  } finally {
    setExecLoading(false);
  }
}

async function handleSave() {
  if (readOnly) return;

  if (
    !isMoveInvoice &&
    !isSpecialInvoice &&
    rows.some((row) => Number(row?.Tov || 0) < 0)
  ) {
    alert(
      t(
        "PrihInvoice.UnrecognizedItemsError",
        "Есть нераспознанные товары. Сначала сопоставьте их с основным справочником."
      )
    );
    return;
  }

  if (isMoveInvoice && Number(header?.IdSkl || 0) <= 0) {
    alert(t("PrihInvoice.DestinationWarehouseRequired", "!!! Выберите склад, куда перемещаем товар."));
    return;
  }

  if (isMoveInvoice && Number(header?.IdSkl || 0) === Number(header?.IdSklPer || 0)) {
    alert(t("PrihInvoice.SameWarehouseError", "!!! Склад назначения не должен совпадать со складом-источником."));
    return;
  }

  if (
    !isMoveInvoice &&
    !isSpecialInvoice &&
    Number(header?.Post || 0) <= 0
  ) {
    alert(t("PrihInvoice.SupplierRequired", "!!! Выберите поставщика перед сохранением накладной."));
    return;
  }

  if (isPfInvoice && Number(header?.IdSkl || 0) <= 0) {
    alert(
      t(
        "PrihInvoice.ProductionRecipientRequired",
        "Выберите получателя."
      )
    );
    return;
  }

  if (isZachInvoice) {
    const gross = getSpecialRow("zach");

    if (!gross || Number(gross.Tov || 0) <= 0) {
      alert(
        t(
          "PrihInvoice.ZachGrossRequired",
          "Выберите исходное сырьё (брутто)."
        )
      );
      return;
    }

    if (Number(gross.Postup || 0) <= 0) {
      alert(
        t(
          "PrihInvoice.ZachGrossQuantityRequired",
          "Укажите количество сырья-брутто."
        )
      );
      return;
    }

    if (Number(gross.Price || 0) <= 0) {
      alert(
        t(
          "PrihInvoice.ZachGrossPriceRequired",
          "Укажите цену сырья-брутто."
        )
      );
      return;
    }
  }

  const xml = buildSaveXml();

  try {
    const body = new URLSearchParams();

    body.set(
      "Action",
      isPfInvoice ? "SavePF" : isZachInvoice ? "SaveZach" : "SavePrih"
    );
    body.set("xml", xml);

    const response = await fetchWithAuth("https://webback.bar-boss.com/wf_RefSave.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
      },
      body
    });

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(t("PrihInvoice.ServerNonJsonPrefix", "Сервер вернул не JSON:") + " " + text.substring(0, 500));
    }

    const saveResult = Array.isArray(data) ? data[0] : data;

    if (!response.ok || saveResult?.status !== "success") {
      throw new Error(
        saveResult?.error ||
          saveResult?.message ||
          t("PrihInvoice.SaveError", "Ошибка сохранения приходной накладной")
      );
    }

    const savedInvoiceId = Number(
      saveResult?.ID ??
        saveResult?.IdNakl ??
        saveResult?.Id ??
        saveResult?.id ??
        (Number(header?.ID || 0) > 0 ? header.ID : 0)
    );

    const localNewInvoice =
      isNewMode && Number(header?.ID || invoiceId || 0) < 0;

    if (localNewInvoice) {
      if (savedInvoiceId <= 0) {
        throw new Error(
          t(
            "PrihInvoice.NewIdMissing",
            "Накладная сохранена, но сервер не вернул её новый ID."
          )
        );
      }

      setDeletedIds([]);
      onDirtyChange?.(false);
      onSaved?.(savedInvoiceId);
      return;
    }

    await loadAll();
    onSaved?.(savedInvoiceId > 0 ? savedInvoiceId : undefined);
  } catch (err) {
    alert(err.message || t("PrihInvoice.SaveError", "Ошибка сохранения приходной накладной"));
  }
}


  const currentReportTitle = isMoveInvoice
    ? t("PrihInvoice.MoveInvoiceTitle", "Накладная перемещения")
    : isPfInvoice
      ? t("PrihInvoice.ProductionTitle", "Накладная производства ПФ")
      : isZachInvoice
        ? t("PrihInvoice.ZachTitle", "Накладная зачистки")
        : t("PrihInvoice.ReceiptInvoiceTitle", "Накладная прихода");

  async function handleExportReport(format) {
    if (!printReport || exportLoading) {
      return;
    }

    const safeFormat = String(format || "").toLowerCase();

    if (safeFormat !== "xlsx" && safeFormat !== "docx") {
      return;
    }

    setExportLoading(true);

    try {
      const reportModel = buildPrihExportReport(
        printReport,
        currentReportTitle,
        locale,
        t
      );

      const body = new URLSearchParams();
      body.set("Format", safeFormat);
      body.set("Report", JSON.stringify(reportModel));

      const response = await fetchWithAuth(
        "https://webback.bar-boss.com/wr_Export.php",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
          },
          body
        }
      );

      if (!response.ok) {
        const errorText = await response.text();

        let errorData = null;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          // Оставляем текст как есть.
        }

        throw new Error(
          errorData?.error ||
            errorData?.message ||
            errorText ||
            t("Report.ExportError", "Ошибка экспорта отчёта.")
        );
      }

      const blob = await response.blob();
      const fallbackFileName =
        `${reportModel.fileName}.${safeFormat}`;

      downloadBlob(
        blob,
        getDownloadFileName(response, fallbackFileName)
      );
    } catch (err) {
      window.alert(
        err?.message ||
          t("Report.ExportError", "Ошибка экспорта отчёта.")
      );
    } finally {
      setExportLoading(false);
    }
  }

  if (printReport) {
    return (
      <PrihInvoicePrintReport
        report={printReport}
        reportTitle={currentReportTitle}
        onBack={() => setPrintReport(null)}
        onExport={handleExportReport}
        exportLoading={exportLoading}
        locale={locale}
        t={t}
      />
    );
  }

  if (loading) {
    return <p>{t("PrihInvoice.Loading", "Загрузка накладной...")}</p>;
  }

  if (error) {
    return <p className="error-text">{error}</p>;
  }

  if (!header) {
    return <p>{t("PrihInvoice.NotSelected", "Накладная не выбрана.")}</p>;
  }

  if (isSpecialInvoice && isNewMode) {
    let specialCellIndex = 1;
    const specialRow = isZachInvoice ? getSpecialRow("zach") : null;
    const workingRows = getWorkingRows();
    const title = isPfInvoice
      ? t("PrihInvoice.ProductionTitle", "Накладная производства ПФ")
      : t("PrihInvoice.ZachTitle", "Накладная зачистки");

    return (
      <div className="prih-page prih-invoice-page prih-special-invoice-page">
        <div className="form-header-panel prih-form-header prih-invoice-form-header prih-special-form-header">
          <div className="page-toolbar">
            <button
              type="button"
              className="back-to-list-button prih-back-button prih-invoice-back-button"
              onClick={handleBackClick}
            >
              ← {t("PrihInvoice.BackToList", "К списку накладных")}
            </button>

            <button
              type="button"
              className="primary-button prih-invoice-save-button"
              disabled={readOnly || !isDirty}
              onClick={handleSave}
            >
              {t("PrihInvoice.Save", "Сохранить")}
            </button>
          </div>

          <div className="prih-title prih-invoice-title">
            {title} № <strong>{header.Invoice}</strong>{" "}
            {t("PrihInvoice.DateSeparator", "от")}{" "}
            <strong>{header.DateP}</strong>
          </div>

          <div
            className={`prih-special-header-grid ${
              isPfInvoice
                ? "prih-production-header-grid"
                : "prih-zach-header-grid"
            }`}
          >
            <label className="calc-field">
              <span>{t("PrihInvoice.Number", "Номер")}</span>
              <input
                value={header.Invoice}
                disabled={readOnly}
                onChange={(event) =>
                  updateHeaderField("Invoice", event.target.value)
                }
              />
            </label>

            <label className="calc-field">
              <span>{t("PrihInvoice.Date", "Дата")}</span>
              <input
                type="date"
                value={header.DateP}
                disabled={readOnly}
                onChange={(event) =>
                  updateHeaderField("DateP", event.target.value)
                }
              />
            </label>

            {isPfInvoice && (
              <label className="calc-field">
                <span>
                  {t("PrihInvoice.ProductionRecipient", "Получатель")}
                </span>
                <select
                  value={Number(header.IdSkl || 0)}
                  disabled={readOnly}
                  onChange={(event) =>
                    updateHeaderField("IdSkl", Number(event.target.value || 0))
                  }
                >
                  <option value="0">
                    {t("PrihInvoice.SelectWarehouse", "Выберите склад...")}
                  </option>
                  {sklList.map((item) => (
                    <option key={item.ID} value={item.ID}>
                      {item.Name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {isZachInvoice && (
              <>
                <label className="calc-field prih-special-search-field prih-zach-gross-field">
                  <span>
                    {t(
                      "PrihInvoice.ZachGrossRaw",
                      "Исходное сырьё (брутто)"
                    )}
                  </span>
                  <SearchableSelect
                    value={Number(specialRow?.Tov || 0)}
                    options={zachGrossList}
                    placeholder={t(
                      "PrihInvoice.ZachGrossPlaceholder",
                      "Начните вводить сырьё..."
                    )}
                    disabled={readOnly}
                    t={t}
                    onChange={(value) => {
                      const selected = zachGrossList.find(
                        (item) => Number(item.ID) === Number(value)
                      );

                      if (!specialRow) return;

                      updateRow(specialRow.ID, {
                        Tov: Number(value || 0),
                        Price: Number(selected?.Price || 0),
                        Zach: true,
                        Pf: false
                      });
                    }}
                  />
                </label>

                <label className="calc-field prih-special-number-field">
                  <span>{t("PrihInvoice.Quantity", "Количество")}</span>
                  <ExpressionNumberInput
                    value={Number(specialRow?.Postup || 0)}
                    className="table-input text-right"
                    disabled={readOnly}
                    onCommit={(value) => {
                      if (!specialRow) return false;
                      const quantity = roundQuantity(value);
                      updateRow(specialRow.ID, { Postup: quantity });
                      return quantity;
                    }}
                  />
                </label>

                <label className="calc-field prih-special-number-field">
                  <span>{t("PrihInvoice.Price", "Цена")}</span>
                  <input
                    type="number"
                    step="0.000001"
                    value={Number(specialRow?.Price || 0)}
                    readOnly
                  />
                </label>
              </>
            )}
          </div>
        </div>

      <div className="calc-panel-title prih-items-title prih-invoice-items-title">
          <span>
            {isPfInvoice
              ? t(
                  "PrihInvoice.ProductionContents",
                  "Сырьё полуфабриката"
                )
              : t(
                  "PrihInvoice.ZachContents",
                  "Результат зачистки"
                )}
          </span>

          <button
            type="button"
            className="prih-add-row-button prih-invoice-add-row-button"
            disabled={readOnly}
            onClick={addRowAndFocusRaw}
          >
            + {t("PrihInvoice.AddRow", "строка")}
          </button>
        </div>

        <div className="table-wrap prih-table-wrap prih-invoice-table-wrap prih-special-table-wrap">
          {isPfInvoice ? (
            <table className="data-table prih-invoice-table prih-special-table prih-production-table">
              <colgroup>
                <col className="prih-special-col-raw" />
                <col className="prih-special-col-quantity" />
              </colgroup>
              <thead>
                <tr>
                  <th>
                    {t(
                      "PrihInvoice.ProductionRaw",
                      "Сырьё полуфабрикат"
                    )}
                  </th>
                  <th>{t("PrihInvoice.Quantity", "Количество")}</th>
                </tr>
              </thead>
              <tbody>
                {workingRows.length === 0 && (
                  <tr>
                    <td colSpan="2" className="prih-invoice-empty-row">
                      {t(
                        "PrihInvoice.EmptyRows",
                        "Строки не добавлены."
                      )}
                    </td>
                  </tr>
                )}

                {workingRows.map((row) => {
                  const rawCellIndex = specialCellIndex++;
                  const quantityCellIndex = specialCellIndex++;

                  return (
                    <tr
                      key={row.ID}
                      data-row-id={row.ID}
                      className={
                        isInvoiceRowDirty(row) ? "changed-row" : ""
                      }
                    >
                      <td>
                        <div className="prih-special-raw-cell">
                          <SearchableSelect
                            value={row.Tov}
                            options={rawList}
                            placeholder={t(
                              "PrihInvoice.SelectRawMaterial",
                              "Выберите сырьё..."
                            )}
                            cellIndex={rawCellIndex}
                            onEnterNext={focusNextCell}
                            disabled={readOnly}
                            t={t}
                            onChange={(value) => {
                              const selected = rawList.find(
                                (item) =>
                                  Number(item.ID) === Number(value)
                              );

                              updateRow(row.ID, {
                                Tov: Number(value || 0),
                                Price: Number(selected?.Price || 0),
                                Pf: false,
                                Zach: false
                              });
                            }}
                          />

                          <button
                            type="button"
                            className="small-danger-button prih-special-inline-delete"
                            title={t(
                              "PrihInvoice.DeleteRow",
                              "Удалить строку"
                            )}
                            disabled={readOnly}
                            onClick={() => deleteRow(row.ID)}
                          >
                            ×
                          </button>
                        </div>
                      </td>

                      <td>
                        <ExpressionNumberInput
                          value={row.Postup}
                          cellIndex={quantityCellIndex}
                          className="table-input text-right"
                          disabled={readOnly}
                          onEnterNext={addRowAndFocusRaw}
                          onCommit={(value) => {
                            const quantity = roundQuantity(value);
                            updateRow(row.ID, { Postup: quantity });
                            return quantity;
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <table className="data-table prih-invoice-table prih-special-table prih-zach-table">
              <colgroup>
                <col className="prih-special-col-raw" />
                <col className="prih-special-col-price" />
                <col className="prih-special-col-quantity" />
                <col className="prih-special-col-sum" />
              </colgroup>
              <thead>
                <tr>
                  <th>
                    {t(
                      "PrihInvoice.ZachRaw",
                      "Сырьё для зачистки"
                    )}
                  </th>
                  <th>{t("PrihInvoice.Price", "Цена")}</th>
                  <th>{t("PrihInvoice.Quantity", "Кол-во")}</th>
                  <th>{t("PrihInvoice.Amount", "Сумма")}</th>
                </tr>
              </thead>
              <tbody>
                {workingRows.length === 0 && (
                  <tr>
                    <td colSpan="4" className="prih-invoice-empty-row">
                      {t(
                        "PrihInvoice.EmptyRows",
                        "Строки не добавлены."
                      )}
                    </td>
                  </tr>
                )}

                {workingRows.map((row) => {
                  const rawCellIndex = specialCellIndex++;
                  const priceCellIndex = specialCellIndex++;
                  const quantityCellIndex = specialCellIndex++;

                  return (
                    <tr
                      key={row.ID}
                      data-row-id={row.ID}
                      className={
                        isInvoiceRowDirty(row) ? "changed-row" : ""
                      }
                    >
                      <td>
                        <div className="prih-special-raw-cell">
                          <SearchableSelect
                            value={row.Tov}
                            options={rawList}
                            placeholder={t(
                              "PrihInvoice.SelectRawMaterial",
                              "Выберите сырьё..."
                            )}
                            cellIndex={rawCellIndex}
                            onEnterNext={focusNextCell}
                            disabled={readOnly}
                            t={t}
                            onChange={(value) => {
                              const selected = rawList.find(
                                (item) =>
                                  Number(item.ID) === Number(value)
                              );

                              updateRow(row.ID, {
                                Tov: Number(value || 0),
                                Price: Number(selected?.Price || 0),
                                Pf: false,
                                Zach: false
                              });
                            }}
                          />

                          <button
                            type="button"
                            className="small-danger-button prih-special-inline-delete"
                            title={t(
                              "PrihInvoice.DeleteRow",
                              "Удалить строку"
                            )}
                            disabled={readOnly}
                            onClick={() => deleteRow(row.ID)}
                          >
                            ×
                          </button>
                        </div>
                      </td>

                      <td>
                        <input
                          data-cell={priceCellIndex}
                          type="number"
                          step="0.000001"
                          value={row.Price}
                          disabled={readOnly}
                          onKeyDown={handleCellKeyDown}
                          onChange={(event) =>
                            updateRow(row.ID, {
                              Price: Number(event.target.value || 0)
                            })
                          }
                        />
                      </td>

                      <td>
                        <ExpressionNumberInput
                          value={row.Postup}
                          cellIndex={quantityCellIndex}
                          className="table-input text-right"
                          disabled={readOnly}
                          onEnterNext={addRowAndFocusRaw}
                          onCommit={(value) => {
                            const quantity = roundQuantity(value);
                            updateRow(row.ID, { Postup: quantity });
                            return quantity;
                          }}
                        />
                      </td>

                      <td className="text-right">
                        {formatMoney(row.Summ)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  let cellIndex = 1;

  return (
    <div className={`prih-page prih-invoice-page${isMoldova ? " is-moldova" : ""}`}>
      <div className="form-header-panel prih-form-header prih-invoice-form-header">
        <div className="page-toolbar">
        <button
          type="button"
          className="back-to-list-button prih-back-button prih-invoice-back-button"
          onClick={handleBackClick}
        >
          ← {t("PrihInvoice.BackToList", "К списку накладных")}
        </button>

        {!isNewMode && Number(header.ID || invoiceId || 0) > 0 && (
          <button
            type="button"
            className="prih-invoice-print-button"
            disabled={printLoading}
            onClick={handleOpenPrintPreview}
          >
            {t("Common.Print", "Печать")}
          </button>
        )}

        {!isNewMode && !isMoveInvoice && !isSpecialInvoice && Number(header.ID || invoiceId || 0) > 0 && (
          <>
            <button
              type="button"
              className="toolbar-save-button prih-refexec-button"
              disabled={readOnly || execLoading}
              onClick={handleRecalcCost}
            >
              {t("PrihInvoice.RecalcCost", "Пересчитать себестоимость")}
            </button>

            <button
              type="button"
              className="toolbar-save-button prih-refexec-button"
              disabled={readOnly || execLoading}
              onClick={openCopyDialog}
            >
              {t("PrihInvoice.CopyInvoice", "Копировать")}
            </button>

            <button
              type="button"
              className="toolbar-save-button prih-refexec-button"
              disabled={readOnly || execLoading}
              onClick={openMoveAllDialog}
            >
              {t("PrihInvoice.MoveAll", "Переместить все")}
            </button>
          </>
        )}

        {!isNewMode && isZachInvoice && Number(header.ID || invoiceId || 0) > 0 && (
          <button
            type="button"
            className="toolbar-save-button prih-refexec-button"
            disabled={readOnly || execLoading || !hasSpecialDetailChanges}
            onClick={handleRecalcZach}
          >
            {t("PrihInvoice.RecalcZach", "Пересчитать зачистку")}
          </button>
        )}

        {!isNewMode && isPfInvoice && Number(header.ID || invoiceId || 0) > 0 && (
          <>
            <button
              type="button"
              className="toolbar-save-button prih-refexec-button"
              disabled={readOnly || execLoading || !hasSpecialDetailChanges}
              onClick={handleRecalcPf}
            >
              {t("PrihInvoice.RecalcPF", "Пересчитать ПФ")}
            </button>

            <button
              type="button"
              className="toolbar-save-button prih-refexec-button prih-refexec-danger"
              disabled={readOnly || execLoading}
              onClick={handleDeletePf}
            >
              {t("PrihInvoice.DeletePF", "Удалить ПФ")}
            </button>
          </>
        )}

        <button
          type="button"
          className="primary-button prih-invoice-save-button"
          disabled={readOnly || !isDirty}
          onClick={handleSave}
        >
          {t("PrihInvoice.Save", "Сохранить")}
        </button>
      </div>

      {execDialog && (
        <div
          className="prih-exec-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeExecDialog();
            }
          }}
        >
          <div
            className="prih-exec-modal"
            role="dialog"
            aria-modal="true"
            aria-label={
              execDialog === "copy"
                ? t("PrihInvoice.CopyDialogTitle", "Копирование накладной")
                : t("PrihInvoice.MoveDialogTitle", "Переместить все")
            }
          >
            <div className="prih-exec-modal-title">
              {execDialog === "copy"
                ? t("PrihInvoice.CopyDialogTitle", "Копирование накладной")
                : t("PrihInvoice.MoveDialogTitle", "Переместить все")}
            </div>

            <label className="calc-field">
              <span>{t("PrihInvoice.ExecToWarehouse", "Куда")}</span>
              <select
                value={execToSkl}
                disabled={readOnly || execLoading}
                onChange={(event) => {
                  setExecToSkl(event.target.value);
                  setExecError("");
                }}
              >
                <option value="">
                  {t("PrihInvoice.SelectWarehouse", "Выберите склад...")}
                </option>

                {sklList
                  .filter(
                    (item) =>
                      execDialog !== "move" ||
                      Number(item.ID || item.Code || 0) !==
                        Number(currentSklad || 0)
                  )
                  .map((item) => {
                    const id = item.ID ?? item.Code;
                    const name = item.Name ?? item.NameSkl ?? id;

                    return (
                      <option key={id} value={String(id)}>
                        {name}
                      </option>
                    );
                  })}
              </select>
            </label>

            <label className="calc-field">
              <span>{t("PrihInvoice.Date", "Дата")}</span>
              <input
                type="date"
                value={execDate}
                disabled={readOnly || execLoading}
                onChange={(event) => {
                  setExecDate(event.target.value);
                  setExecError("");
                }}
              />
            </label>

            {execError && (
              <div className="prih-exec-modal-error">{execError}</div>
            )}

            <div className="prih-exec-modal-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={execLoading}
                onClick={closeExecDialog}
              >
                {t("Common.Cancel", "Отмена")}
              </button>

              <button
                type="button"
                className="primary-button"
                disabled={readOnly || execLoading}
                onClick={submitExecDialog}
              >
                {execLoading
                  ? t("PrihInvoice.ExecRunning", "Выполнение...")
                  : execDialog === "copy"
                    ? t("PrihInvoice.CopyInvoice", "Копировать")
                    : t("PrihInvoice.MoveAction", "Переместить")}
              </button>
            </div>
          </div>
        </div>
      )}

      {sopostRow && (
        <div
          className="prih-exec-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeSopostDialog();
            }
          }}
        >
          <div
            className="prih-exec-modal prih-sopost-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t(
              "PrihInvoice.ScanMatchTitle",
              "Нераспознанный товар"
            )}
          >
            <button
              type="button"
              className="prih-sopost-close"
              disabled={sopostLoading}
              onClick={closeSopostDialog}
              aria-label={t("Common.Close", "Закрыть")}
              title={t("Common.Close", "Закрыть")}
            >
              ×
            </button>

            <div className="prih-exec-modal-title">
              {t("PrihInvoice.ScanMatchTitle", "Нераспознанный товар")}
            </div>

            <div className="prih-sopost-source">
              <span>{t("PrihInvoice.RawMaterial", "Сырьё")}</span>
              <strong>{sopostScanName || `ID ${Number(sopostRow.Tov || 0)}`}</strong>
            </div>

            <div className="prih-sopost-action prih-sopost-add-action">
              <button
                type="button"
                className="secondary-button prih-sopost-action-button"
                disabled={sopostLoading}
                onClick={() => handleSopost(1)}
              >
                {sopostLoading
                  ? t("PrihInvoice.ExecRunning", "Выполнение...")
                  : t(
                      "PrihInvoice.ScanAddToDirectory",
                      "Добавить в основной справочник"
                    )}
              </button>
            </div>

            <div className="prih-sopost-action prih-sopost-match-action">
              <button
                type="button"
                className="primary-button prih-sopost-action-button"
                disabled={sopostLoading || Number(sopostTovId || 0) <= 0}
                onClick={() => handleSopost(2)}
              >
                {t("PrihInvoice.ScanMatchWith", "Сопоставить с")}
              </button>

              <SearchableSelect
                value={sopostTovId}
                options={sopostRawList}
                maxOptions={0}
                placeholder={t(
                  "PrihInvoice.SelectRawMaterial",
                  "Выберите сырьё..."
                )}
                disabled={sopostLoading}
                t={t}
                onChange={(value) => {
                  setSopostTovId(Number(value || 0));
                  setSopostError("");
                }}
              />
            </div>

            {sopostError && (
              <div className="prih-exec-modal-error">{sopostError}</div>
            )}
          </div>
        </div>
      )}

      <div className="prih-title prih-invoice-title">
        {isMoveInvoice
          ? t("PrihInvoice.MoveInvoiceTitle", "Накладная перемещения")
          : isPfInvoice
            ? t("PrihInvoice.ProductionTitle", "Накладная производства ПФ")
            : isZachInvoice
              ? t("PrihInvoice.ZachTitle", "Накладная зачистки")
              : t("PrihInvoice.ReceiptInvoiceTitle", "Накладная прихода")} №{" "}
        <strong>{header.Invoice}</strong> {t("PrihInvoice.DateSeparator", "от")}{" "}
        <strong>{header.DateP}</strong>
      </div>

      <div className="prih-header-grid prih-invoice-header-grid">
        <label className="calc-field">
          <span>{t("PrihInvoice.Number", "Номер")}</span>
          <input
            value={header.Invoice}
            disabled={readOnly}
            onChange={(e) => updateHeaderField("Invoice", e.target.value)}
          />
        </label>

        <label className="calc-field">
          <span>{t("PrihInvoice.Date", "Дата")}</span>
          <input
            type="date"
            value={header.DateP}
            disabled={readOnly}
            onChange={(e) => updateHeaderField("DateP", e.target.value)}
          />
        </label>

{(!isNewMode || isMoveInvoice) && (
  isIncomingMoveView ? (
    <label className="calc-field">
      <span>
        {t("PrihInvoice.SourceWarehouse", "Откуда перемещено")}
      </span>
      <input
        value={
          getWarehouseName(sklList, header.IdSklPer) ||
          String(header.IdSklPer || "")
        }
        readOnly
      />
    </label>
  ) : (
    <label className="calc-field">
      <span>
        {isMoveInvoice
          ? t("PrihInvoice.DestinationWarehouse", "Куда перемещено")
          : t("PrihInvoice.ReceiptWarehouse", "Склад прихода")}
      </span>

      <select
        value={header.IdSkl}
        disabled={readOnly}
        onChange={(e) =>
          updateHeaderField("IdSkl", Number(e.target.value || 0))
        }
      >
        <option value="0">
          {t("PrihInvoice.SelectWarehouse", "Выберите склад...")}
        </option>

        {sklList.map((item) => (
          <option key={item.ID} value={item.ID}>
            {item.Name}
          </option>
        ))}
      </select>
    </label>
  )
)}
{!isNewMode && !isMoveInvoice && !isSpecialInvoice && (
  <label className="calc-field">
    <span>{t("PrihInvoice.TransferWarehouse", "Склад перемещения")}</span>
    <input value={header.IdSklPer || ""} readOnly />
  </label>
)}
{!isMoveInvoice && (
  <>
{!isSpecialInvoice && (
  <>
<label className="calc-field">
  <span>{t("PrihInvoice.Supplier", "Поставщик")}</span>

  <SupplierSearch
    value={Number(header.Post || 0)}
    options={postList}
    fallbackText={
      header.SupplierName ||
      getInvoiceSupplierName(invoiceListRow)
    }
    placeholder={
      isNewMode
        ? t("PrihInvoice.SupplierSearchPlaceholder", "Начните вводить поставщика...")
        : t("PrihInvoice.NoSupplier", "Нет поставщика")
    }
    t={t}
    locale={locale}
    disabled={readOnly}
    onChange={(value) => {
      const supplierId = Number(value || 0);

      updateHeaderField("Post", supplierId);
      updateHeaderField(
        "SupplierName",
        supplierId
          ? getSupplierNameById(
              postList,
              supplierId
            )
          : ""
      );
    }}
  />
</label>

        <label className="calc-field">
          <span>{t("PrihInvoice.PaymentForm", "Форма оплаты")}</span>
          <select
            value={header.Form}
            disabled={readOnly}
            onChange={(e) =>
              updateHeaderField("Form", Number(e.target.value || 0))
            }
          >
            <option value="0">{t("PrihInvoice.SelectOption", "Выберите...")}</option>
            {formList.map((item) => (
              <option key={item.ID} value={item.ID}>
                {item.Name}
              </option>
            ))}
          </select>
        </label>
  </>
)}

{!isSpecialInvoice && (
  <>
    {!isNewMode && (
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={Boolean(header.Oplach)}
          disabled={readOnly}
          onChange={(e) => updateHeaderField("Oplach", e.target.checked)}
        />
        <span>{t("PrihInvoice.Paid", "Оплачено")}</span>
      </label>
    )}

    <label className="checkbox-field">
      <input
        type="checkbox"
        checked={Boolean(header.Bel)}
        disabled={readOnly}
        onChange={(e) => updateHeaderField("Bel", e.target.checked)}
      />
      <span>{t("PrihInvoice.Bel", "Бел.")}</span>
    </label>

    <label className="checkbox-field">
      <input
        type="checkbox"
        checked={Boolean(header.Vozv)}
        disabled={readOnly}
        onChange={(e) => updateHeaderField("Vozv", e.target.checked)}
      />
      <span>{t("PrihInvoice.Return", "Возврат")}</span>
    </label>
  </>
)}
  </>
)}

        <div className="calc-info">
          <span>{t("PrihInvoice.AmountLabel", "Сумма:")}</span>
          <strong>{formatMoney(totalSumm)}</strong>
        </div>
      </div>
<label className="calc-field prih-rem-field prih-invoice-rem-field">

  <textarea
    value={header.Rem || ""}
    disabled={readOnly}
    onChange={(e) => updateHeaderField("Rem", e.target.value)}
  />
</label>
      </div>

      <div className="calc-panel-title prih-items-title prih-invoice-items-title">
        <span>{t("PrihInvoice.ContentsTitle", "Содержимое накладной")}</span>
      </div>

      <div className="table-wrap prih-table-wrap prih-invoice-table-wrap">
        <table className="data-table prih-table prih-invoice-table">
          <colgroup>
            <col className="prih-invoice-col-raw" />
            <col className="prih-invoice-col-quantity" />
            <col className="prih-invoice-col-price" />
            <col className="prih-invoice-col-sum" />
            {showWeightCorrection && (
              <col className="prih-invoice-col-weight-correction" />
            )}
            <col className="prih-invoice-col-average" />
            {isMoldova && <col className="prih-invoice-col-vat" />}
            <col className="prih-invoice-col-delete" />
          </colgroup>

          <thead>
            <tr>
              <th>{t("PrihInvoice.RawMaterial", "Сырьё")}</th>
              <th>{t("PrihInvoice.Quantity", "Кол-во")}</th>
              <th>{t("PrihInvoice.Price", "Цена")}</th>
              <th>{t("PrihInvoice.Amount", "Сумма")}</th>
              {showWeightCorrection && (
                <th
                  className="prih-weight-correction-head"
                  title={t(
                    "PrihInvoice.WeightCorrectionFull",
                    "Корректировка веса"
                  )}
                >
                  {t("PrihInvoice.WeightCorrection", "Корр. веса")}
                </th>
              )}
              <th>{t("PrihInvoice.AveragePrice", "Ср. цена")}</th>
              {isMoldova && <th>{t("PrihInvoice.Vat", "VAT")}</th>}
              <th></th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  className="prih-invoice-empty-row"
                  colSpan={
                    6 +
                    (isMoldova ? 1 : 0) +
                    (showWeightCorrection ? 1 : 0)
                  }
                >
                  {t("PrihInvoice.EmptyRows", "Строки не добавлены.")}
                </td>
              </tr>
            )}

            {rows.map((row) => {
              const rawCellIndex = cellIndex++;
              const quantityCellIndex = cellIndex++;
              const sumCellIndex = cellIndex++;
              const correctionCellIndex = showWeightCorrection
                ? cellIndex++
                : null;
              const priceCellIndex = cellIndex++;
              const vatCellIndex = isMoldova ? cellIndex++ : null;

              const selectedRaw = rawList.find(
                (item) => Number(item.ID) === Number(row.Tov)
              );
              const isUnrecognizedRow = Number(row.Tov || 0) < 0;

              return (
              <tr
                key={row.ID}
                data-row-id={row.ID}
                className={[
                  isInvoiceRowDirty(row) ? "changed-row" : "",
                  isBlankInvoiceDraftRow(row)
                    ? "prih-invoice-draft-row"
                    : "",
                  Number(row.Tov || 0) < 0
                    ? "prih-unrecognized-row"
                    : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
                title={
                  Number(row.Tov || 0) < 0 && !readOnly
                    ? t(
                        "PrihInvoice.ScanDoubleClickHint",
                        "Двойной клик — обработать нераспознанный товар"
                      )
                    : undefined
                }
                onDoubleClick={() => openSopostDialog(row)}
              >
                <td>
                  {isUnrecognizedRow ? (
                    <div className="searchable-select">
                      <input
                        data-cell={rawCellIndex}
                        value={
                          selectedRaw?.Name ||
                          `${t("PrihInvoice.UnrecognizedRaw", "Нераспознанный товар")} (${Number(row.Tov || 0)})`
                        }
                        readOnly
                        title={t(
                          "PrihInvoice.ScanDoubleClickHint",
                          "Двойной клик — обработать нераспознанный товар"
                        )}
                      />
                    </div>
                  ) : (
                    <SearchableSelect
                      value={row.Tov}
                      options={rawList}
                      placeholder={t("PrihInvoice.SelectRawMaterial", "Выберите сырьё...")}
                      cellIndex={rawCellIndex}
                      onEnterNext={focusNextCell}
                      disabled={readOnly}
                      onCreateOption={isMoveInvoice || readOnly ? undefined : createRawMaterial}
                      onCreateError={(err) =>
                        setError(
                          err?.message ||
                            t(
                              "PrihInvoice.AddRawError",
                              "Не удалось добавить товар в справочник"
                            )
                        )
                      }
                      t={t}
                      onChange={(value) => {
                        const nextSelectedRaw = rawList.find(
                          (item) => Number(item.ID) === Number(value)
                        );

                        updateRow(row.ID, {
                          Tov: value,
                          ...(isMoveInvoice && nextSelectedRaw
                            ? { Price: Number(nextSelectedRaw.Price || 0) }
                            : {})
                        });
                      }}
                    />
                  )}
                </td>

                <td>
                  <ExpressionNumberInput
                    value={row.Postup}
                    cellIndex={quantityCellIndex}
                    className="table-input text-right"
                    title={t(
                      "PrihInvoice.QuantityExpressionHint",
                      "Можно ввести выражение, например: 6*0,33 или 4,1+12*0,33"
                    )}
                    disabled={readOnly}
                    onEnterNext={(currentCell) => {
                      if (
                        usesTrailingDraftRow &&
                        (isMoveInvoice || Number(row.Price || 0) > 0)
                      ) {
                        addRowAndFocusRaw();
                        return;
                      }

                      focusNextCell(currentCell);
                    }}
                    onCommit={(value) => {
                      const quantity = roundQuantity(value);

                      updateRow(row.ID, {
                        Postup: quantity
                      });

                      return quantity;
                    }}
                  />
                </td>

                <td>
                  <input
                    data-cell={priceCellIndex}
                    type="number"
                    step="0.000001"
                    value={row.Price}
                    disabled={readOnly}
                    onKeyDown={handleCellKeyDown}
                    onChange={(e) =>
                      updateRow(row.ID, {
                        Price: Number(e.target.value || 0)
                      })
                    }
                  />
                </td>

                <td>
                  <ExpressionNumberInput
                    value={row.Summ}
                    cellIndex={sumCellIndex}
                    className="table-input text-right"
                    title={t(
                      "PrihInvoice.TotalToPriceHint",
                      "Введите общую сумму и нажмите Enter — цена будет рассчитана как сумма / количество"
                    )}
                    disabled={readOnly}
                    onEnterNext={focusNextCell}
                    onCommit={(value) => {
                      const quantity = Number(row.Postup || 0);

                      if (quantity === 0) {
                        window.alert(
                          t(
                            "PrihInvoice.QuantityRequiredForTotal",
                            "Сначала введите количество больше нуля."
                          )
                        );

                        return false;
                      }

                      updateRow(row.ID, {
                        Price: roundPrice(value / quantity)
                      });

                      return true;
                    }}
                  />
                </td>


                {showWeightCorrection && (
                  <td className="prih-weight-correction-cell">
                    <WeightCorrectionInput
                      cellIndex={correctionCellIndex}
                      disabled={readOnly}
                      onEnterNext={focusNextCell}
                      title={t(
                        "PrihInvoice.WeightCorrectionHint",
                        "Введите новый вес и нажмите Enter. Количество и цена будут пересчитаны с сохранением стоимости строки."
                      )}
                      onApply={(correctedWeight) => {
                        const oldQuantity = Number(row.Postup || 0);
                        const oldPrice = Number(row.Price || 0);

                        if (oldQuantity <= 0) {
                          window.alert(
                            t(
                              "PrihInvoice.WeightCorrectionQuantityRequired",
                              "Текущее количество должно быть больше нуля."
                            )
                          );

                          return false;
                        }

                        const correctedPrice = roundMoney(
                          (oldPrice * oldQuantity) / correctedWeight
                        );

                        updateRow(row.ID, {
                          Postup: roundQuantity(correctedWeight),
                          Price: correctedPrice
                        });

                        return true;
                      }}
                    />
                  </td>
                )}

                <td className="text-right">{formatMoney(row.CenaAvg)}</td>

                {isMoldova && (
                  <td>
                    <input
                      data-cell={vatCellIndex}
                      type="number"
                      step="0.01"
                      value={row.VatTov}
                      disabled={readOnly}
                      onKeyDown={handleCellKeyDown}
                      onChange={(e) =>
                        updateRow(row.ID, {
                          VatTov: Number(e.target.value || 0)
                        })
                      }
                    />
                  </td>
                )}

                <td>
                  {!readOnly && !isBlankInvoiceDraftRow(row) && (
                    <button
                      type="button"
                      className="small-danger-button prih-invoice-delete-button"
                      title={t("PrihInvoice.DeleteRow", "Удалить строку")}
                      aria-label={t("PrihInvoice.DeleteRow", "Удалить строку")}
                      onClick={() => deleteRow(row.ID)}
                    >
                      ×
                    </button>
                  )}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}