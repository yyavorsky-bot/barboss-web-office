import { useEffect, useMemo, useRef, useState } from "react";
import "./tables.css";

const AREA_W_MM = 220;
const AREA_H_MM = 155;
const DEFAULT_TABLE_W = 15;
const DEFAULT_TABLE_H = 15;
const MIN_TABLE_W = 5;
const MIN_TABLE_H = 5;
const EPS = 0.0001;

function finiteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round3(value) {
  return Math.round((finiteNumber(value) + Number.EPSILON) * 1000) / 1000;
}

function parseBooleanFlag(value) {
  if (value === true || value === 1) return true;
  const text = String(value ?? "").trim().toLowerCase();
  return text === "1" || text === "true" || text === "yes";
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatMm(value) {
  return round3(value).toFixed(3);
}

function normalizeTable(row, fallbackCode = 0) {
  const code = finiteNumber(row?.Code ?? row?.ID ?? fallbackCode);
  const codeTable = finiteNumber(
    row?.CodeTable ??
      row?.TableCode ??
      row?.["Код"] ??
      row?.Kod ??
      0
  );

  return {
    Code: code,
    CodeTable: codeTable,
    Table: String(
      row?.Table ??
        row?.NameTable ??
        row?.Name ??
        codeTable ??
        ""
    ),
    X: round3(finiteNumber(row?.X, 0)),
    Y: round3(finiteNumber(row?.Y, 0)),
    H: round3(finiteNumber(row?.H, DEFAULT_TABLE_H) || DEFAULT_TABLE_H),
    W: round3(finiteNumber(row?.W, DEFAULT_TABLE_W) || DEFAULT_TABLE_W),
    ACTIV: parseBooleanFlag(row?.ACTIV ?? row?.Active ?? row?.IsActive ?? true)
  };
}

function normalizeHall(row, index) {
  const rawTables = Array.isArray(row?.Tables)
    ? row.Tables
    : Array.isArray(row?.tables)
      ? row.tables
      : [];

  return {
    Numb: finiteNumber(
      row?.Numb ?? row?.Code ?? row?.ID ?? index + 1,
      index + 1
    ),
    Name: String(
      row?.Name ??
        row?.NameZal ??
        row?.Zal ??
        `#${index + 1}`
    ),
    Tables: rawTables.map((table, tableIndex) =>
      normalizeTable(table, tableIndex + 1)
    )
  };
}

function looksLikeHall(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (value.Numb !== undefined || value.Name !== undefined) &&
      (Array.isArray(value.Tables) || Array.isArray(value.tables))
  );
}

function looksLikeBaseTable(value) {
  const row = tryParseNestedJson(value);

  if (!row || typeof row !== "object" || Array.isArray(row)) return false;

  const hasName =
    row.Table !== undefined ||
    row.TABLE !== undefined ||
    row.NameTable !== undefined ||
    row.Name !== undefined;

  const hasCode =
    row["Код"] !== undefined ||
    row["КОД"] !== undefined ||
    row.CodeTable !== undefined ||
    row.TableCode !== undefined ||
    row.KodTable !== undefined ||
    row.Kod !== undefined ||
    row.Code !== undefined ||
    row.ID !== undefined;

  const hasCoordinates =
    row.X !== undefined ||
    row.Y !== undefined ||
    row.H !== undefined ||
    row.W !== undefined;

  return hasName && hasCode && !hasCoordinates;
}

function tryParseNestedJson(value) {
  if (typeof value !== "string") {
    return value;
  }

  const text = value.trim();

  if (
    !text ||
    (!text.startsWith("[") && !text.startsWith("{"))
  ) {
    return value;
  }

  try {
    return JSON.parse(text);
  } catch {
    return value;
  }
}

function collectArrays(value, result = [], depth = 0) {
  if (depth > 8 || value === null || value === undefined) return result;

  const parsed = tryParseNestedJson(value);

  if (Array.isArray(parsed)) {
    result.push(parsed);
    parsed.forEach((item) => collectArrays(item, result, depth + 1));
    return result;
  }

  if (parsed && typeof parsed === "object") {
    Object.values(parsed).forEach((item) =>
      collectArrays(item, result, depth + 1)
    );
  }

  return result;
}

function extractHalls(payload) {
  if (Array.isArray(payload) && payload.some(looksLikeHall)) {
    return payload.filter(looksLikeHall).map(normalizeHall);
  }

  if (looksLikeHall(payload)) {
    return [normalizeHall(payload, 0)];
  }

  const arrays = collectArrays(payload);
  const candidate = arrays.find(
    (items) => items.length > 0 && items.some(looksLikeHall)
  );

  return candidate
    ? candidate.filter(looksLikeHall).map(normalizeHall)
    : [];
}

function normalizeBaseTable(value) {
  const row = tryParseNestedJson(value);

  return {
    CodeTable: finiteNumber(
      row?.["Код"] ??
        row?.["КОД"] ??
        row?.CodeTable ??
        row?.TableCode ??
        row?.KodTable ??
        row?.Kod ??
        row?.Code ??
        row?.ID ??
        0
    ),
    Table: String(
      row?.Table ??
        row?.TABLE ??
        row?.NameTable ??
        row?.Name ??
        row?.["Код"] ??
        row?.["КОД"] ??
        ""
    )
  };
}

function dedupeBaseTables(rows) {
  const map = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const normalized = normalizeBaseTable(row);
    if (!normalized.CodeTable) return;

    if (!map.has(normalized.CodeTable)) {
      map.set(normalized.CodeTable, normalized);
    }
  });

  return [...map.values()].sort((a, b) =>
    String(a.Table).localeCompare(String(b.Table), undefined, {
      numeric: true,
      sensitivity: "base"
    })
  );
}

function collectBaseTableRows(value, result = [], depth = 0) {
  if (depth > 10 || value === null || value === undefined) {
    return result;
  }

  const parsed = tryParseNestedJson(value);

  if (Array.isArray(parsed)) {
    parsed.forEach((item) =>
      collectBaseTableRows(item, result, depth + 1)
    );
    return result;
  }

  if (!parsed || typeof parsed !== "object") {
    return result;
  }

  if (looksLikeBaseTable(parsed)) {
    result.push(parsed);
    return result;
  }

  Object.values(parsed).forEach((item) =>
    collectBaseTableRows(item, result, depth + 1)
  );

  return result;
}

function extractBaseTables(payload) {
  return collectBaseTableRows(payload)
    .map(normalizeBaseTable)
    .filter((row) => Number(row.CodeTable || 0) !== 0)
    .sort((a, b) =>
      String(a.Table).localeCompare(String(b.Table), undefined, {
        numeric: true,
        sensitivity: "base"
      })
    );
}

function deriveBaseTablesFromHalls(halls) {
  return dedupeBaseTables(
    (Array.isArray(halls) ? halls : []).flatMap((hall) =>
      (Array.isArray(hall.Tables) ? hall.Tables : []).map((table) => ({
        CodeTable: table.CodeTable,
        Table: table.Table
      }))
    )
  );
}

function rectInsideArea(rect) {
  return (
    rect.X >= -EPS &&
    rect.Y >= -EPS &&
    rect.W >= MIN_TABLE_W - EPS &&
    rect.H >= MIN_TABLE_H - EPS &&
    rect.X + rect.W <= AREA_W_MM + EPS &&
    rect.Y + rect.H <= AREA_H_MM + EPS
  );
}

function rectsOverlap(a, b) {
  return !(
    a.X + a.W <= b.X + EPS ||
    b.X + b.W <= a.X + EPS ||
    a.Y + a.H <= b.Y + EPS ||
    b.Y + b.H <= a.Y + EPS
  );
}

function canPlace(candidate, rows, currentCode) {
  if (!rectInsideArea(candidate)) return false;
  if (!candidate.ACTIV) return true;

  return !(Array.isArray(rows) ? rows : []).some((row) => {
    if (Number(row.Code) === Number(currentCode)) return false;
    if (!row.ACTIV) return false;
    return rectsOverlap(candidate, row);
  });
}

function findFreePosition(rows, width = DEFAULT_TABLE_W, height = DEFAULT_TABLE_H) {
  const safeW = Math.max(MIN_TABLE_W, Math.min(width, AREA_W_MM));
  const safeH = Math.max(1, Math.min(height, AREA_H_MM));

  for (let y = 1; y + safeH <= AREA_H_MM; y += 2) {
    for (let x = 1; x + safeW <= AREA_W_MM; x += 2) {
      const candidate = {
        Code: Number.MIN_SAFE_INTEGER,
        X: round3(x),
        Y: round3(y),
        W: round3(safeW),
        H: round3(safeH),
        ACTIV: true
      };

      if (canPlace(candidate, rows, candidate.Code)) {
        return { X: candidate.X, Y: candidate.Y };
      }
    }
  }

  return null;
}

function nextNegativeCode(rows) {
  const negatives = (Array.isArray(rows) ? rows : [])
    .map((row) => Number(row.Code || 0))
    .filter((code) => code < 0);

  return negatives.length ? Math.min(...negatives) - 1 : -1;
}

function buildSaveTablesXml(hall, rows) {
  const items = (Array.isArray(rows) ? rows : [])
    .map(
      (row) =>
        `<Item Code="${Number(row.Code || 0)}"` +
        ` CodeTable="${Number(row.CodeTable || 0)}"` +
        ` Table="${escapeXml(row.Table)}"` +
        ` X="${formatMm(row.X)}"` +
        ` Y="${formatMm(row.Y)}"` +
        ` H="${formatMm(row.H)}"` +
        ` W="${formatMm(row.W)}"` +
        ` ACTIV="${row.ACTIV ? 1 : 0}" />`
    )
    .join("");

  return `<Tables Numb="${Number(hall?.Numb || 0)}"><Items>${items}</Items></Tables>`;
}

async function parseJsonResponse(response, fallbackMessage) {
  const text = await response.text();
  let data = null;

  if (text.trim()) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`${fallbackMessage}: ${text.substring(0, 400)}`);
    }
  }

  if (
    !response.ok ||
    (!Array.isArray(data) && data?.status === "error")
  ) {
    throw new Error(
      data?.error ||
        data?.message ||
        fallbackMessage
    );
  }

  return data;
}

export default function TablesPage({
  fetchWithAuth,
  readOnly = false,
  onDirtyChange,
  t = (key, fallback = "") => fallback
}) {
  const boardRef = useRef(null);
  const tablesRef = useRef([]);

  const [halls, setHalls] = useState([]);
  const [baseTables, setBaseTables] = useState([]);
  const [selectedHallNumb, setSelectedHallNumb] = useState("");
  const [tables, setTables] = useState([]);
  const [selectedCode, setSelectedCode] = useState(null);
  const [addCodeTable, setAddCodeTable] = useState("");

  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    tablesRef.current = tables;
  }, [tables]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    return () => onDirtyChange?.(false);
  }, [onDirtyChange]);

  const selectedHall = useMemo(
    () =>
      halls.find(
        (hall) => String(hall.Numb) === String(selectedHallNumb)
      ) ?? null,
    [halls, selectedHallNumb]
  );

  const availableBaseTables = useMemo(() => {
    const usedCodes = new Set(
      tables.map((row) => Number(row.CodeTable || 0))
    );

    return baseTables.filter(
      (row) => !usedCodes.has(Number(row.CodeTable || 0))
    );
  }, [baseTables, tables]);

  function markDirty() {
    setDirty(true);
    setMessage("");
  }

  function applyLoadedHall(hall) {
    const nextTables = (Array.isArray(hall?.Tables) ? hall.Tables : []).map(
      (row) => ({ ...row })
    );

    tablesRef.current = nextTables;
    setTables(nextTables);
    setSelectedCode(nextTables[0]?.Code ?? null);
    setDirty(false);
    setMessage("");
    setError("");
  }

  async function loadDirectoryAction(action) {
    const url = new URL(
      "https://webback.bar-boss.com/wf_Directory.php"
    );
    url.searchParams.set("Action", action);

    const response = await fetchWithAuth(url.toString(), {
      method: "GET"
    });

    return parseJsonResponse(
      response,
      t("Tables.LoadError", "Ошибка загрузки расстановки столов")
    );
  }

  async function loadData(preferredHallNumb = null) {
    setLoading(true);
    setError("");

    try {
      const [tableBaseResult, tablesResult, zalStolResult] =
        await Promise.allSettled([
          loadDirectoryAction("TableBase"),
          loadDirectoryAction("Tables"),
          loadDirectoryAction("ZalStol")
        ]);

      if (
        tablesResult.status !== "fulfilled" &&
        zalStolResult.status !== "fulfilled"
      ) {
        throw (
          tablesResult.reason ||
          zalStolResult.reason ||
          new Error(
            t("Tables.LoadError", "Ошибка загрузки расстановки столов")
          )
        );
      }

      const tableBasePayload =
        tableBaseResult.status === "fulfilled"
          ? tableBaseResult.value
          : null;

      const tablesPayload =
        tablesResult.status === "fulfilled"
          ? tablesResult.value
          : null;

      const zalStolPayload =
        zalStolResult.status === "fulfilled"
          ? zalStolResult.value
          : null;

      const hallsFromTables = extractHalls(tablesPayload);
      const hallsFromZalStol = extractHalls(zalStolPayload);

      const loadedHalls =
        hallsFromTables.length > 0
          ? hallsFromTables
          : hallsFromZalStol;

      const loadedBaseTables = extractBaseTables(tableBasePayload);

      setHalls(loadedHalls);
      setBaseTables(loadedBaseTables);

      const preferred = loadedHalls.find(
        (hall) => String(hall.Numb) === String(preferredHallNumb)
      );
      const nextHall = preferred ?? loadedHalls[0] ?? null;

      setSelectedHallNumb(nextHall ? String(nextHall.Numb) : "");
      applyLoadedHall(nextHall);
      onDirtyChange?.(false);
    } catch (err) {
      setError(
        err?.message ||
          t("Tables.LoadError", "Ошибка загрузки расстановки столов")
      );
      setHalls([]);
      setBaseTables([]);
      setSelectedHallNumb("");
      setTables([]);
      tablesRef.current = [];
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // fetchWithAuth стабилен в App; повторная загрузка нужна только при открытии страницы.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateRows(nextRows) {
    tablesRef.current = nextRows;
    setTables(nextRows);
    markDirty();
  }

  function updateTable(code, patch, { validateRect = false } = {}) {
    const currentRows = tablesRef.current;
    const current = currentRows.find(
      (row) => Number(row.Code) === Number(code)
    );

    if (!current) return false;

    const candidate = {
      ...current,
      ...patch
    };

    if (
      validateRect &&
      !canPlace(candidate, currentRows, current.Code)
    ) {
      return false;
    }

    const nextRows = currentRows.map((row) =>
      Number(row.Code) === Number(code)
        ? candidate
        : row
    );

    updateRows(nextRows);
    return true;
  }

  function handleHallChange(value) {
    if (String(value) === String(selectedHallNumb)) return;

    if (
      dirty &&
      !window.confirm(
        t(
          "Tables.UnsavedHallWarning",
          "В текущем зале есть несохранённые изменения. Перейти в другой зал без сохранения?"
        )
      )
    ) {
      return;
    }

    const nextHall = halls.find(
      (hall) => String(hall.Numb) === String(value)
    );

    setSelectedHallNumb(String(value));
    applyLoadedHall(nextHall);
    onDirtyChange?.(false);
  }

  function handlePointerDrag(event, row) {
    if (readOnly || !row.ACTIV || !boardRef.current) return;
    if (event.button !== undefined && event.button !== 0) return;

    event.preventDefault();
    setSelectedCode(row.Code);

    const rect = boardRef.current.getBoundingClientRect();
    const mmPerPxX = AREA_W_MM / rect.width;
    const mmPerPxY = AREA_H_MM / rect.height;
    const startClientX = event.clientX;
    const startClientY = event.clientY;
    const startRow = { ...row };
    let changed = false;

    function onMove(moveEvent) {
      const requestedX = round3(
        startRow.X +
          (moveEvent.clientX - startClientX) * mmPerPxX
      );
      const requestedY = round3(
        startRow.Y +
          (moveEvent.clientY - startClientY) * mmPerPxY
      );

      const nextX = round3(
        Math.max(
          0,
          Math.min(AREA_W_MM - startRow.W, requestedX)
        )
      );
      const nextY = round3(
        Math.max(
          0,
          Math.min(AREA_H_MM - startRow.H, requestedY)
        )
      );

      const currentRows = tablesRef.current;
      const current = currentRows.find(
        (item) => Number(item.Code) === Number(row.Code)
      );
      if (!current) return;

      const candidate = {
        ...current,
        X: nextX,
        Y: nextY
      };

      // Во время перемещения стол может проходить через другие столы.
      // Проверка пересечения выполняется только в финальной точке onUp.
      const nextRows = currentRows.map((item) =>
        Number(item.Code) === Number(row.Code)
          ? candidate
          : item
      );

      tablesRef.current = nextRows;
      setTables(nextRows);
      changed =
        Math.abs(nextX - startRow.X) > EPS ||
        Math.abs(nextY - startRow.Y) > EPS;
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);

      if (!changed) return;

      const currentRows = tablesRef.current;
      const finalRow = currentRows.find(
        (item) => Number(item.Code) === Number(row.Code)
      );

      if (
        !finalRow ||
        !canPlace(finalRow, currentRows, finalRow.Code)
      ) {
        const restoredRows = currentRows.map((item) =>
          Number(item.Code) === Number(row.Code)
            ? { ...startRow }
            : item
        );

        tablesRef.current = restoredRows;
        setTables(restoredRows);
        return;
      }

      markDirty();
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  }

  function handleResizePointerDown(event, row) {
    if (readOnly || !row.ACTIV || !boardRef.current) return;

    event.preventDefault();
    event.stopPropagation();
    setSelectedCode(row.Code);

    const rect = boardRef.current.getBoundingClientRect();
    const mmPerPxX = AREA_W_MM / rect.width;
    const mmPerPxY = AREA_H_MM / rect.height;
    const startClientX = event.clientX;
    const startClientY = event.clientY;
    const startW = row.W;
    const startH = row.H;
    let changed = false;

    function onMove(moveEvent) {
      const requestedW = round3(
        startW + (moveEvent.clientX - startClientX) * mmPerPxX
      );
      const requestedH = round3(
        startH + (moveEvent.clientY - startClientY) * mmPerPxY
      );

      const nextW = Math.max(MIN_TABLE_W, requestedW);
      const nextH = Math.max(MIN_TABLE_H, requestedH);

      const currentRows = tablesRef.current;
      const current = currentRows.find(
        (item) => Number(item.Code) === Number(row.Code)
      );
      if (!current) return;

      const candidate = {
        ...current,
        W: nextW,
        H: nextH
      };

      if (!canPlace(candidate, currentRows, current.Code)) return;

      const nextRows = currentRows.map((item) =>
        Number(item.Code) === Number(row.Code)
          ? candidate
          : item
      );

      tablesRef.current = nextRows;
      setTables(nextRows);
      changed = true;
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);

      if (changed) {
        markDirty();
      }
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  }

  function handleActiveChange(row, checked) {
    if (readOnly) return;

    if (!checked) {
      updateTable(row.Code, { ACTIV: false });
      return;
    }

    const currentRows = tablesRef.current;
    const candidate = { ...row, ACTIV: true };

    if (canPlace(candidate, currentRows, row.Code)) {
      updateTable(row.Code, { ACTIV: true });
      return;
    }

    const free = findFreePosition(currentRows, row.W, row.H);

    if (!free) {
      window.alert(
        t(
          "Tables.NoFreeSpace",
          "Нет свободного места для активации стола."
        )
      );
      return;
    }

    updateTable(
      row.Code,
      {
        ACTIV: true,
        X: free.X,
        Y: free.Y
      },
      { validateRect: true }
    );
  }

  function handleAddTable() {
    if (readOnly) return;

    const codeTable = Number(addCodeTable || 0);
    if (!codeTable) return;

    const baseTable = baseTables.find(
      (row) => Number(row.CodeTable) === codeTable
    );
    if (!baseTable) return;

    const existing = tablesRef.current.find(
      (row) => Number(row.CodeTable) === codeTable
    );

    if (existing) {
      if (!existing.ACTIV) {
        handleActiveChange(existing, true);
        setSelectedCode(existing.Code);
      }
      setAddCodeTable("");
      return;
    }

    const free = findFreePosition(
      tablesRef.current,
      DEFAULT_TABLE_W,
      DEFAULT_TABLE_H
    );

    if (!free) {
      window.alert(
        t(
          "Tables.NoFreeSpace",
          "Нет свободного места для нового стола."
        )
      );
      return;
    }

    const newRow = {
      Code: nextNegativeCode(tablesRef.current),
      CodeTable: codeTable,
      Table: baseTable.Table,
      X: free.X,
      Y: free.Y,
      H: DEFAULT_TABLE_H,
      W: DEFAULT_TABLE_W,
      ACTIV: true
    };

    updateRows([...tablesRef.current, newRow]);
    setSelectedCode(newRow.Code);
    setAddCodeTable("");
  }

  function handleResetDefault() {
    if (readOnly || saving || tablesRef.current.length === 0) return;

    if (
      !window.confirm(
        t(
          "Tables.ResetDefaultConfirm",
          "Сбросить расстановку столов по умолчанию?"
        )
      )
    ) {
      return;
    }

    const sourceRows = tablesRef.current.map((row) => ({ ...row }));
    const columns = 14;
    const rows = 10;
    const capacity = columns * rows;

    if (sourceRows.length > capacity) {
      window.alert(
        t(
          "Tables.NoFreeSpaceReset",
          "Недостаточно места для расстановки всех столов."
        )
      );
      return;
    }

    // Базовая сетка рассчитана ровно на 140 столов 15×15 мм:
    // 14 столов по ширине и 10 рядов по высоте.
    // Свободное место равномерно распределяем по краям и между столами.
    const gapX =
      (AREA_W_MM - columns * DEFAULT_TABLE_W) / (columns + 1);
    const gapY =
      (AREA_H_MM - rows * DEFAULT_TABLE_H) / (rows + 1);

    const placedRows = sourceRows.map((sourceRow, index) => {
      const columnIndex = index % columns;
      const rowIndex = Math.floor(index / columns);

      return {
        ...sourceRow,
        X: round3(
          gapX + columnIndex * (DEFAULT_TABLE_W + gapX)
        ),
        Y: round3(
          gapY + rowIndex * (DEFAULT_TABLE_H + gapY)
        ),
        W: DEFAULT_TABLE_W,
        H: DEFAULT_TABLE_H
      };
    });

    // Координаты получили все столы, включая неактивные.
    // Теперь восстанавливаем их исходную активность: неактивные снова скрыты.
    updateRows(
      placedRows.map((row, index) => ({
        ...row,
        ACTIV: sourceRows[index].ACTIV
      }))
    );

    setSelectedCode(
      placedRows.find((row) => row.ACTIV)?.Code ??
        placedRows[0]?.Code ??
        null
    );
  }

  async function handleSave() {
    if (readOnly || saving || !dirty || !selectedHall) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const xml = buildSaveTablesXml(selectedHall, tablesRef.current);
      const body = new URLSearchParams();
      body.set("Action", "SaveTables");
      body.set("xml", xml);

      const response = await fetchWithAuth(
        "https://webback.bar-boss.com/wf_RefSave.php",
        {
          method: "POST",
          body
        }
      );

      await parseJsonResponse(
        response,
        t("Tables.SaveError", "Ошибка сохранения расстановки столов")
      );

      const hallNumb = selectedHall.Numb;
      await loadData(hallNumb);
      setMessage(t("Tables.Saved", "Сохранено"));
    } catch (err) {
      setError(
        err?.message ||
          t("Tables.SaveError", "Ошибка сохранения расстановки столов")
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="tables-page">
        <div className="tables-status">
          {t("Tables.Loading", "Загрузка...")}
        </div>
      </div>
    );
  }

  return (
    <section className="tables-page">
      <div className="module-toolbar tables-toolbar">
        <div className="toolbar-left tables-toolbar-left">
          <label className="tables-hall-field">
            <span>{t("Tables.Hall", "Зал")}</span>
            <select
              value={selectedHallNumb}
              disabled={saving || halls.length === 0}
              onChange={(event) => handleHallChange(event.target.value)}
            >
              {halls.map((hall) => (
                <option key={hall.Numb} value={String(hall.Numb)}>
                  {hall.Name}
                </option>
              ))}
            </select>
          </label>

          <span className="tables-area-caption">
            {t("Tables.Area", "Рабочая область 220 × 155 мм")}
          </span>
        </div>

        <div className="toolbar-right">
          {message && <span className="tables-message">{message}</span>}

          <button
            type="button"
            className="toolbar-button"
            disabled={readOnly || saving || tables.length === 0}
            onClick={handleResetDefault}
          >
            {t("Tables.ResetDefault", "Сбросить по умолчанию")}
          </button>

          <button
            type="button"
            className="toolbar-button"
            disabled={saving || dirty}
            onClick={() => loadData(selectedHall?.Numb)}
          >
            {t("Tables.Reload", "Перечитать")}
          </button>

          <button
            type="button"
            className="toolbar-button primary"
            disabled={readOnly || saving || !dirty || !selectedHall}
            onClick={handleSave}
          >
            {saving
              ? t("Tables.Saving", "Сохранение...")
              : t("Tables.SaveHall", "Сохранить зал")}
          </button>
        </div>
      </div>

      {error && <div className="login-error tables-error">{error}</div>}

      <div className="tables-layout">
        <div className="tables-board-panel">
          <div
            ref={boardRef}
            className="tables-board"
            aria-label={t("Tables.Area", "Рабочая область 220 × 155 мм")}
          >
            {tables
              .filter((row) => row.ACTIV)
              .map((row) => {
                const selected =
                  Number(selectedCode) === Number(row.Code);

                return (
                  <div
                    key={row.Code}
                    className={`tables-table${selected ? " selected" : ""}`}
                    style={{
                      left: `${(row.X / AREA_W_MM) * 100}%`,
                      top: `${(row.Y / AREA_H_MM) * 100}%`,
                      width: `${(row.W / AREA_W_MM) * 100}%`,
                      height: `${(row.H / AREA_H_MM) * 100}%`
                    }}
                    title={`${row.Table} — X:${formatMm(row.X)} Y:${formatMm(
                      row.Y
                    )} W:${formatMm(row.W)} H:${formatMm(row.H)}`}
                    onPointerDown={(event) =>
                      handlePointerDrag(event, row)
                    }
                    onClick={() => setSelectedCode(row.Code)}
                  >
                    <span className="tables-table-name">{row.Table}</span>

                    {!readOnly && (
                      <button
                        type="button"
                        className="tables-resize-handle"
                        aria-label={t(
                          "Tables.Resize",
                          "Изменить размер"
                        )}
                        title={t("Tables.Resize", "Изменить размер")}
                        onPointerDown={(event) =>
                          handleResizePointerDown(event, row)
                        }
                      />
                    )}
                  </div>
                );
              })}
          </div>

          <div className="tables-board-hint">
            {t(
              "Tables.Hint",
              "Перетащите стол мышью. Маркер справа снизу меняет ширину и высоту. Пересечения и выход за границы запрещены."
            )}
          </div>
        </div>

        <aside className="tables-side-panel">
          <div className="tables-side-heading">
            <strong>{t("Tables.Tables", "Столы")}</strong>
            <span>{tables.length}</span>
          </div>

          {!readOnly && (
            <div className="tables-add-row">
              <select
                value={addCodeTable}
                onChange={(event) => setAddCodeTable(event.target.value)}
              >
                <option value="">
                  {t("Tables.AddTableSelect", "Добавить стол...")}
                </option>
                {availableBaseTables.map((row) => (
                  <option
                    key={row.CodeTable}
                    value={String(row.CodeTable)}
                  >
                    {row.Table}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="small-action-button"
                disabled={!addCodeTable}
                onClick={handleAddTable}
              >
                {t("Common.Add", "Добавить")}
              </button>
            </div>
          )}

          {baseTables.length === 0 && (
            <div className="tables-base-note">
              {t(
                "Tables.BaseUnavailable",
                "Базовый список столов не получен. Существующие столы можно редактировать."
              )}
            </div>
          )}

          <div className="tables-list">
            {tables.map((row) => {
              const selected =
                Number(selectedCode) === Number(row.Code);

              return (
                <div
                  key={row.Code}
                  className={`tables-list-row${selected ? " selected" : ""}${
                    !row.ACTIV ? " inactive" : ""
                  }`}
                  onClick={() => setSelectedCode(row.Code)}
                >
                  <label className="tables-active-cell">
                    <input
                      type="checkbox"
                      checked={row.ACTIV}
                      disabled={readOnly}
                      onChange={(event) =>
                        handleActiveChange(row, event.target.checked)
                      }
                    />
                    <span>{t("Tables.ActiveShort", "Акт.")}</span>
                  </label>

                  <div className="tables-name-cell">
                    <input
                      type="text"
                      value={row.Table}
                      disabled={readOnly}
                      onFocus={() => setSelectedCode(row.Code)}
                      onChange={(event) =>
                        updateTable(row.Code, {
                          Table: event.target.value
                        })
                      }
                    />
                  </div>
                </div>
              );
            })}

            {tables.length === 0 && (
              <div className="tables-empty">
                {t("Tables.NoTables", "В выбранном зале нет столов.")}
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
