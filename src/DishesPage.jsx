import { useEffect, useMemo, useRef, useState } from "react";
import { exportReportFile } from "./reportExport.js";
import DishCalcPage from "./DishCalcPage.jsx";
import "./dishes-menu-reports.css";
import "./dishes-card-happy.css";

const dishFields = [
  "CodeBl",
  "Shk",
  "Name1",
  "Name2",
  "NameForFP",
  "Price",
  "Ves",
  "Price2",
  "EdVes",
  "Grupp",
  "Sklad",
  "Nep",
  "Skr",
  "Akc",
  "Ceh",
  "Typ",
  "GruppNal",
  "CodePr",
  "PLU",
  "Peresch",
  "Kit",
  "Konsum",
  "Deliv",
  "UKT",
  "Modif",
  "Tall",
  "Wlist",
  "Minuts",
  "Rem",
  "Otobr"
];

export default function DishesPage({
  data,
  selectedDishId = null,
  currentSklad = "",
  podrazd = [],
  fetchWithAuth,
  dateFrom = "",
  dateTo = "",
  onOpenCalc,
  groups,
  filterGroups,
  cehs,
  fops,
  types,
  login = "",
  moldova = false,
  readOnly,
  filterSkr,
  filterModif,
  filterGroup,
  onChangeSkr,
  onChangeModif,
  onChangeGroup,
  onAddDish,
  onSaveDishes,
  onDirtyChange,
  t = (key, fallback = "") => fallback
}) {
  const [rows, setRows] = useState([]);
  const [changedRows, setChangedRows] = useState({});
  const [selectedId, setSelectedId] = useState(
    selectedDishId ? Number(selectedDishId) : null
  );
  const selectedRowRef = useRef(null);
  const tableWrapRef = useRef(null);
  const [newDishDraft, setNewDishDraft] = useState(null);
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const saveSuccessTimerRef = useRef(null);
  const [error, setError] = useState("");
  const [extraNameMode, setExtraNameMode] = useState("");
  const [dishNameFilter, setDishNameFilter] = useState("");

  const [copyOpen, setCopyOpen] = useState(false);
  const [copyTarget, setCopyTarget] = useState("");
  const [copyAll, setCopyAll] = useState(false);
  const [copySelected, setCopySelected] = useState(false);
  const [copyLoading, setCopyLoading] = useState(false);
  const [copyError, setCopyError] = useState("");

  const [viewMode, setViewMode] = useState("list");
  const [pfRows, setPfRows] = useState([]);
  const [pfRawItems, setPfRawItems] = useState([]);
  const [pfChangedRows, setPfChangedRows] = useState({});
  const [pfLoading, setPfLoading] = useState(false);
  const [pfSaving, setPfSaving] = useState(false);
  const [pfError, setPfError] = useState("");

  const [printMenuOpen, setPrintMenuOpen] = useState(false);
  const [menuReportKind, setMenuReportKind] = useState("");
  const [menuReportRows, setMenuReportRows] = useState([]);
  const [menuReportLoading, setMenuReportLoading] = useState(false);
  const [menuReportError, setMenuReportError] = useState("");
  const [reportExportLoading, setReportExportLoading] = useState(false);

  const [dishCardData, setDishCardData] = useState(null);
  const [dishCardLoading, setDishCardLoading] = useState(false);
  const [dishCardError, setDishCardError] = useState("");
  const [dishInPfRows, setDishInPfRows] = useState([]);
  const [dishInPfLoading, setDishInPfLoading] = useState(false);
  const [dishInPfError, setDishInPfError] = useState("");

  const [happyRows, setHappyRows] = useState([]);
  const [happyChangedRows, setHappyChangedRows] = useState({});
  const [happyDeletedIds, setHappyDeletedIds] = useState([]);
  const [happyLoading, setHappyLoading] = useState(false);
  const [happySaving, setHappySaving] = useState(false);
  const [happyAdding, setHappyAdding] = useState(false);
  const [happyError, setHappyError] = useState("");

  const toolbarGroups = Array.isArray(filterGroups) ? filterGroups : [];
  const safePodrazd = Array.isArray(podrazd) ? podrazd : [];
  const normalizedDishNameFilter = String(dishNameFilter || "").trim().toLocaleLowerCase();
  const visibleRows = useMemo(() => {
    if (!normalizedDishNameFilter) return rows;

    return rows.filter((row) =>
      String(row?.Name1 ?? "").toLocaleLowerCase().includes(normalizedDishNameFilter)
    );
  }, [rows, normalizedDishNameFilter]);
  const selectedCalcDishId = Number(
    visibleRows.find((row) => Number(row?.CodeBl) === Number(selectedId))?.CodeBl || 0
  );
  const changedCount = Object.keys(changedRows).length;
  const pfChangedCount = Object.keys(pfChangedRows).length;
  const happyChangedCount =
    Object.keys(happyChangedRows).length + happyDeletedIds.length;
  const isDirty =
    !readOnly &&
    (changedCount > 0 || pfChangedCount > 0 || happyChangedCount > 0);
  const copyAllDisabled =
    Number(copyTarget || 0) > 0 &&
    Number(copyTarget || 0) === Number(currentSklad || 0);
  const unsavedChangesMessage = t(
    "Dishes.UnsavedChangesWarning",
    "Внимание! Вы не сохранили измененные данные!\nУверены, что хотите уйти?"
  );

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

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
    setRows(Array.isArray(data) ? data : []);
    setChangedRows({});
    setError("");
    setQuickAddLoading(false);
    setSaveLoading(false);
    setCopyOpen(false);
    setCopyError("");
    setCopyLoading(false);
    setViewMode("list");
    setNewDishDraft(null);
    setPfRows([]);
    setPfRawItems([]);
    setPfChangedRows({});
    setPfLoading(false);
    setPfSaving(false);
    setPfError("");
    setPrintMenuOpen(false);
    setMenuReportKind("");
    setMenuReportRows([]);
    setMenuReportLoading(false);
    setMenuReportError("");
    setReportExportLoading(false);
    setDishCardData(null);
    setDishCardLoading(false);
    setDishCardError("");
    setDishInPfRows([]);
    setDishInPfLoading(false);
    setDishInPfError("");
    setHappyRows([]);
    setHappyChangedRows({});
    setHappyDeletedIds([]);
    setHappyLoading(false);
    setHappySaving(false);
    setHappyAdding(false);
    setHappyError("");
  }, [data]);

  useEffect(() => {
    if (copyAllDisabled && copyAll) {
      setCopyAll(false);
    }
  }, [copyAllDisabled, copyAll]);

  useEffect(() => {
    const nextSelectedId = selectedDishId ? Number(selectedDishId) : null;
    const sourceRows = Array.isArray(data) ? data : [];

    if (nextSelectedId === null) {
      return;
    }

    const exists = sourceRows.some(
      (row) => Number(row.CodeBl) === nextSelectedId
    );

    if (!exists) {
      return;
    }

    setSelectedId(nextSelectedId);
  }, [data, selectedDishId]);

  useEffect(() => {
    if (
      !selectedDishId ||
      Number(selectedId) !== Number(selectedDishId)
    ) {
      return;
    }

    let secondFrame = 0;

    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        const row = selectedRowRef.current;
        const tableWrap = tableWrapRef.current;

        if (!row || !tableWrap) {
          return;
        }

        const rowRect = row.getBoundingClientRect();
        const wrapRect = tableWrap.getBoundingClientRect();
        const centeredTop =
          tableWrap.scrollTop +
          (rowRect.top - wrapRect.top) -
          (tableWrap.clientHeight - rowRect.height) / 2;

        tableWrap.scrollTop = Math.max(0, centeredTop);
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);

      if (secondFrame) {
        window.cancelAnimationFrame(secondFrame);
      }
    };
  }, [data, selectedDishId, selectedId]);


  function selectDish(codeBl) {
    setSelectedId(Number(codeBl));
  }

  function handleDishRowArrowNavigation(event) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    const target = event.target;

    if (!(target instanceof HTMLElement)) return;
    if (!target.matches("input, select, textarea")) return;

    const currentRow = event.currentTarget;
    const currentCell = target.closest("td");
    const tbody = currentRow?.parentElement;

    if (!currentCell || !tbody) return;

    const tableRows = Array.from(tbody.children).filter(
      (element) => element instanceof HTMLTableRowElement
    );
    const currentRowIndex = tableRows.indexOf(currentRow);
    const currentCellIndex = Array.from(currentRow.children).indexOf(currentCell);

    if (currentRowIndex < 0 || currentCellIndex < 0) return;

    const direction = event.key === "ArrowDown" ? 1 : -1;
    const nextRow = tableRows[currentRowIndex + direction];

    // Даже на первой/последней строке не отдаём стрелку браузеру:
    // иначе number/select начнут менять значение вместо перемещения по записям.
    event.preventDefault();

    if (!nextRow) return;

    const nextCell = nextRow.children[currentCellIndex];

    if (!(nextCell instanceof HTMLTableCellElement)) return;

    const nextControl = nextCell.querySelector(
      "input:not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled)"
    );

    if (!(nextControl instanceof HTMLElement)) return;

    nextControl.focus();

    const nextDishId = Number(nextRow.dataset.dishId || 0);

    if (nextDishId) {
      selectDish(nextDishId);
    }
  }

  function focusDishTableControl(control) {
    if (!(control instanceof HTMLElement)) return;

    control.focus({ preventScroll: true });
    control.scrollIntoView({ block: "nearest", inline: "nearest" });

    if (typeof control.select === "function") {
      control.select();
    }
  }

  function handleDishRowEnterNavigation(event) {
    if (event.key !== "Enter") return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

    const target = event.target;

    if (!(target instanceof HTMLElement)) return;
    if (!target.matches("input, select, textarea")) return;

    const currentRow = event.currentTarget;
    const currentCell = target.closest("td");
    const tbody = currentRow?.parentElement;

    if (!currentCell || !tbody) return;

    const cells = Array.from(currentRow.children).filter(
      (element) => element instanceof HTMLTableCellElement
    );
    const currentCellIndex = cells.indexOf(currentCell);

    if (currentCellIndex < 0) return;

    event.preventDefault();

    for (let index = currentCellIndex + 1; index < cells.length; index += 1) {
      const nextControl = cells[index].querySelector(
        "input:not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled)"
      );

      if (nextControl instanceof HTMLElement) {
        focusDishTableControl(nextControl);
        return;
      }
    }

    const tableRows = Array.from(tbody.children).filter(
      (element) => element instanceof HTMLTableRowElement
    );
    const currentRowIndex = tableRows.indexOf(currentRow);
    const nextRow = tableRows[currentRowIndex + 1];

    if (!(nextRow instanceof HTMLTableRowElement)) return;

    const nextNameControl = nextRow.querySelector(
      ".dish-name-input:not(:disabled)"
    );

    if (!(nextNameControl instanceof HTMLElement)) return;

    const nextDishId = Number(nextRow.dataset.dishId || 0);

    if (nextDishId) {
      selectDish(nextDishId);
    }

    focusDishTableControl(nextNameControl);
  }

  function handleDishRowKeyDown(event) {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      handleDishRowArrowNavigation(event);
      return;
    }

    if (event.key === "Enter") {
      handleDishRowEnterNavigation(event);
    }
  }

  function clearSaveSuccess() {
    setSaveSuccess(false);

    if (saveSuccessTimerRef.current) {
      window.clearTimeout(saveSuccessTimerRef.current);
      saveSuccessTimerRef.current = null;
    }
  }

  function showSaveSuccess() {
    clearSaveSuccess();
    setSaveSuccess(true);

    saveSuccessTimerRef.current = window.setTimeout(() => {
      setSaveSuccess(false);
      saveSuccessTimerRef.current = null;
    }, 2800);
  }

  function confirmDiscardChanges() {
    if (!isDirty) return true;

    return window.confirm(unsavedChangesMessage);
  }

  function discardLocalChanges() {
    setChangedRows({});
    setPfChangedRows({});
    setHappyChangedRows({});
    onDirtyChange?.(false);
  }

  async function handleProtectedFilterChange(callback, value) {
    if (!confirmDiscardChanges()) {
      return;
    }

    discardLocalChanges();
    await callback?.(value);
  }

  function handleOpenCalc(codeBl) {
    if (!confirmDiscardChanges()) {
      return;
    }

    discardLocalChanges();
    onOpenCalc?.(codeBl);
  }

  function updateField(codeBl, field, value) {
    if (readOnly) return;

    clearSaveSuccess();

    setRows((prevRows) =>
      prevRows.map((row) =>
        row.CodeBl === codeBl
          ? {
              ...row,
              [field]: value
            }
          : row
      )
    );

    setChangedRows((prev) => ({
      ...prev,
      [codeBl]: true
    }));
  }

  function escapeXml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;");
  }

  function xmlValue(value) {
    if (typeof value === "boolean") {
      return value ? "1" : "0";
    }

    if (value === null || value === undefined) {
      return "";
    }

    return escapeXml(value);
  }

function buildDishesXml(sourceRows) {
  const rowsXml = sourceRows
    .map((row) => {
      const fieldsXml = dishFields
        .map((field) => `<${field}>${xmlValue(row[field])}</${field}>`)
        .join("");

      return `<Dish><Login>${xmlValue(login)}</Login>${fieldsXml}</Dish>`;
    })
    .join("");

  return `<Dishes>${rowsXml}</Dishes>`;
}

  function createLocalDishDraft() {
    const tempId = -Date.now() - Math.floor(Math.random() * 1000);
    const defaultGroup =
      String(filterGroup ?? "%") === "%"
        ? 0
        : Number(filterGroup || 0);

    return {
      CodeBl: tempId,
      Shk: "",
      Name1: "",
      Name2: "",
      NameForFP: "",
      Price: 0,
      Ves: 0,
      Price2: 0,
      EdVes: "",
      Grupp: defaultGroup,
      Sklad: Number(currentSklad || 0),
      Nep: false,
      Skr: false,
      Akc: false,
      Ceh: 0,
      Typ: 0,
      GruppNal: 0,
      CodePr: 0,
      PLU: 0,
      Peresch: 0,
      Kit: 0,
      Konsum: 0,
      Deliv: false,
      UKT: "",
      Modif: 0,
      Tall: 0,
      Wlist: 0,
      Minuts: 0,
      Rem: "",
      Otobr: false
    };
  }

  function addNewDish() {
    if (readOnly) return;

    if (!currentSklad) {
      setError(
        t("DishesPF.WarehouseRequired", "Не выбран склад / подразделение")
      );
      return;
    }

    if (!confirmDiscardChanges()) {
      return;
    }

    discardLocalChanges();
    clearSaveSuccess();
    setError("");
    setDishNameFilter("");
    setCopyOpen(false);
    setPrintMenuOpen(false);

    const draft = createLocalDishDraft();
    setNewDishDraft(draft);
    setViewMode("newDishCalc");
  }

  async function addQuickDishRow() {
    if (readOnly || quickAddLoading || !onAddDish) return;

    clearSaveSuccess();
    setQuickAddLoading(true);
    setError("");
    setDishNameFilter("");

    try {
      const newDish = await onAddDish();
      const newDishId = Number(newDish?.CodeBl || 0);

      if (!newDishId) {
        throw new Error(
          t("Dishes.AddError", "Ошибка добавления блюда")
        );
      }

      setRows((prevRows) => [newDish, ...prevRows]);
      setChangedRows((prev) => ({
        ...prev,
        [newDishId]: true
      }));
      selectDish(newDishId);
      onDirtyChange?.(true);
    } catch (err) {
      setError(
        err?.message || t("Dishes.AddError", "Ошибка добавления блюда")
      );
    } finally {
      setQuickAddLoading(false);
    }
  }

  async function saveNewDishFromCalc(dish) {
    if (readOnly || !onSaveDishes) {
      throw new Error(
        t("Dishes.SaveError", "Ошибка сохранения блюд")
      );
    }

    return await onSaveDishes(buildDishesXml([dish]));
  }

  function finishNewDishCreation(realId, savedDish) {
    const numericId = Number(realId || 0);

    if (!numericId) return;

    const normalizedDish = {
      ...(savedDish || newDishDraft || {}),
      CodeBl: numericId
    };

    setRows((prevRows) => [
      normalizedDish,
      ...prevRows.filter(
        (row) => Number(row.CodeBl || 0) !== numericId
      )
    ]);
    setSelectedId(numericId);
    setNewDishDraft(null);
    setViewMode("list");
    setError("");
    onDirtyChange?.(false);
    showSaveSuccess();
  }

  async function saveDishes(options = {}) {
    if (readOnly || !onSaveDishes) return false;

    const reloadAfterSave = options?.reloadAfterSave !== false;
    const changedIds = Object.keys(changedRows);

    if (changedIds.length === 0) {
      return true;
    }

    clearSaveSuccess();
    setSaveLoading(true);
    setError("");

    try {
      const changedItems = rows.filter((row) =>
        changedRows[row.CodeBl]
      );

      const xml = buildDishesXml(changedItems);

      await onSaveDishes(xml);

      setChangedRows({});
      onDirtyChange?.(false);
      showSaveSuccess();

      // После обычного сохранения перечитываем список с сервера с текущими
      // фильтрами. Это важно, например, для флага «Скрыть»: запись должна
      // сразу исчезнуть из списка, если показ скрытых блюд выключен.
      if (reloadAfterSave && onChangeGroup) {
        await onChangeGroup(filterGroup);
      }

      return true;
    } catch (err) {
      setError(err.message || t("Dishes.SaveError", "Ошибка сохранения блюд"));
      return false;
    } finally {
      setSaveLoading(false);
    }
  }

  function setNameMode(nextMode) {
    setExtraNameMode((current) => (current === nextMode ? "" : nextMode));
  }

  async function copyCalculation() {
    if (readOnly || copyLoading || !fetchWithAuth) return;

    const skl = Number(currentSklad || 0);
    const sklto = Number(copyTarget || 0);
    const useAll = Boolean(copyAll && !copyAllDisabled);
    const useSelected = Boolean(copySelected);
    const id = useAll || useSelected ? 0 : Number(selectedId || 0);

    if (!sklto) {
      setCopyError(t("Dishes.CopyTargetRequired", "Выберите подразделение в поле «Куда?»"));
      return;
    }

    if (!useAll && !useSelected && !id) {
      setCopyError(t("Dishes.CopyDishRequired", "Выберите блюдо для копирования калькуляции"));
      return;
    }

    if (
      useAll &&
      !window.confirm(
        t(
          "Dishes.CopyAllConfirm",
          "Вы уверены что хотите скопировать все калькуляции?"
        )
      )
    ) {
      return;
    }

    setCopyLoading(true);
    setCopyError("");

    try {
      // Перед копированием обязательно сохраняем текущий список блюд.
      // Это особенно важно для поля Otobr: процедура копирования читает
      // отбор из базы, а не из локального состояния React.
      const saved = await saveDishes({ reloadAfterSave: false });

      if (!saved) {
        setCopyError(
          t(
            "Dishes.CopySaveRequiredError",
            "Не удалось сохранить список блюд перед копированием"
          )
        );
        return;
      }

      const url = new URL("https://webback.bar-boss.com/wf_DishCalcCopy.php");
      url.searchParams.set("skl", String(skl));
      url.searchParams.set("sklto", String(sklto));
      url.searchParams.set("otobr", useSelected ? "1" : "0");
      url.searchParams.set("all", useAll ? "1" : "0");
      url.searchParams.set("ID", String(id));

      const response = await fetchWithAuth(url.toString(), { method: "GET" });
      const text = await response.text();
      let data;

      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          t("Dishes.CopyInvalidResponse", "Сервер вернул некорректный ответ")
        );
      }

      const result = Array.isArray(data) ? data[0] : data;

      if (!response.ok || result?.status !== "success") {
        throw new Error(
          result?.error ||
            result?.message ||
            t("Dishes.CopyError", "Ошибка копирования калькуляции")
        );
      }

      setCopyOpen(false);
      setCopyTarget("");
      setCopyAll(false);
      setCopySelected(false);

      // Сервер после копирования снимает отметки Otobr.
      // Повторно загружаем текущий список, чтобы экран сразу отражал базу.
      if (onChangeGroup) {
        await onChangeGroup(filterGroup);
      }

      window.alert(t("Dishes.CopySuccess", "ОК"));
    } catch (err) {
      setCopyError(
        err?.message || t("Dishes.CopyError", "Ошибка копирования калькуляции")
      );
    } finally {
      setCopyLoading(false);
    }
  }

  async function loadProductionData() {
    if (!fetchWithAuth) {
      throw new Error(t("DishesPF.LoadError", "Ошибка загрузки данных для производства"));
    }

    if (!currentSklad) {
      throw new Error(t("DishesPF.WarehouseRequired", "Не выбран склад / подразделение"));
    }

    setPfLoading(true);
    setPfError("");

    try {
      const listUrl = new URL("https://webback.bar-boss.com/wf_DishPFList.php");
      listUrl.searchParams.set("Sklad", String(currentSklad));
      listUrl.searchParams.set("Grup", String(filterGroup ?? "%"));
      listUrl.searchParams.set("Ceh", "%");

      const rawUrl = new URL("https://webback.bar-boss.com/wf_SpisokTovarovPF.php");
      rawUrl.searchParams.set("Sklad", String(currentSklad));

      const [listResponse, rawResponse] = await Promise.all([
        fetchWithAuth(listUrl.toString(), { method: "GET" }),
        fetchWithAuth(rawUrl.toString(), { method: "GET" })
      ]);

      const [listText, rawText] = await Promise.all([
        listResponse.text(),
        rawResponse.text()
      ]);

      let listData;
      let rawData;

      try {
        listData = JSON.parse(listText);
      } catch {
        throw new Error(
          t("DishesPF.ListInvalidResponse", "Список блюд для производства вернул не JSON")
        );
      }

      try {
        rawData = JSON.parse(rawText);
      } catch {
        throw new Error(
          t("DishesPF.RawInvalidResponse", "Список производимого сырья вернул не JSON")
        );
      }

      if (!listResponse.ok || listData?.status === "error") {
        throw new Error(
          listData?.error ||
            listData?.message ||
            t("DishesPF.LoadError", "Ошибка загрузки данных для производства")
        );
      }

      if (!rawResponse.ok || rawData?.status === "error") {
        throw new Error(
          rawData?.error ||
            rawData?.message ||
            t("DishesPF.RawLoadError", "Ошибка загрузки списка производимого сырья")
        );
      }

      setPfRows(Array.isArray(listData) ? listData : []);
      setPfRawItems(Array.isArray(rawData) ? rawData : []);
      setPfChangedRows({});
    } finally {
      setPfLoading(false);
    }
  }

  async function openProduction() {
    if (!confirmDiscardChanges()) return;

    if (changedCount > 0) {
      setRows(Array.isArray(data) ? data : []);
      discardLocalChanges();
    }

    setCopyOpen(false);
    setPfRows([]);
    setPfRawItems([]);
    setPfChangedRows({});
    setPfError("");
    setViewMode("pf");

    try {
      await loadProductionData();
    } catch (err) {
      setPfError(
        err?.message || t("DishesPF.LoadError", "Ошибка загрузки данных для производства")
      );
    }
  }

  function backFromProduction() {
    if (!confirmDiscardChanges()) return;

    setPfChangedRows({});
    setPfError("");
    setViewMode("list");
    onDirtyChange?.(false);
  }

  function updateProductionRaw(codeBl, value) {
    if (readOnly) return;

    const nextValue = Number(value || 0);

    setPfRows((prevRows) =>
      prevRows.map((row) =>
        Number(row.CodeBl) === Number(codeBl)
          ? { ...row, TovPF: nextValue }
          : row
      )
    );

    setPfChangedRows((prev) => ({
      ...prev,
      [codeBl]: true
    }));
  }

  function buildDishPfXml(sourceRows) {
    const rowsXml = sourceRows
      .map(
        (row) =>
          `<row><CodeBl>${xmlValue(Number(row.CodeBl || 0))}</CodeBl><TovPF>${xmlValue(
            Number(row.TovPF || 0)
          )}</TovPF></row>`
      )
      .join("");

    return `<Ref><DishPF>${rowsXml}</DishPF></Ref>`;
  }

  async function saveProduction() {
    if (readOnly || pfSaving || !fetchWithAuth) return;

    const changedItems = pfRows.filter((row) => pfChangedRows[row.CodeBl]);

    if (changedItems.length === 0) return;

    setPfSaving(true);
    setPfError("");

    try {
      const body = new URLSearchParams();
      body.set("Action", "DishPF");
      body.set("xml", buildDishPfXml(changedItems));

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
      let result = null;

      if (text.trim()) {
        try {
          result = JSON.parse(text);
        } catch {
          throw new Error(
            t("DishesPF.SaveInvalidResponse", "Сервер вернул некорректный ответ")
          );
        }
      }

      const normalized = Array.isArray(result) ? result[0] : result;

      if (!response.ok || normalized?.status === "error") {
        throw new Error(
          normalized?.error ||
            normalized?.message ||
            t("DishesPF.SaveError", "Ошибка сохранения производимого сырья")
        );
      }

      setPfChangedRows({});
      onDirtyChange?.(false);
    } catch (err) {
      setPfError(
        err?.message || t("DishesPF.SaveError", "Ошибка сохранения производимого сырья")
      );
    } finally {
      setPfSaving(false);
    }
  }


  async function loadDishInPfReport(dishId) {
    if (!fetchWithAuth || !dishId) return;

    setDishInPfRows([]);
    setDishInPfError("");
    setDishInPfLoading(true);

    try {
      const xml =
        `<Report>` +
        `<Date1>${escapeXml(dateFrom)}</Date1>` +
        `<Date2>${escapeXml(dateTo)}</Date2>` +
        `<Org>0</Org>` +
        `<All>1</All>` +
        `<Skl>${escapeXml(currentSklad || 0)}</Skl>` +
        `<IdKli>0</IdKli>` +
        `<IdDish>${escapeXml(dishId)}</IdDish>` +
        `</Report>`;

      const url = new URL("https://webback.bar-boss.com/wr_Reports.php");
      url.searchParams.set("Action", "BludaInPF");

      const response = await fetchWithAuth(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/xml; charset=utf-8"
        },
        body: xml
      });

      const text = await response.text();
      let result;

      try {
        result = JSON.parse(text);
      } catch {
        throw new Error(
          t(
            "DishCard.InDishesInvalidResponse",
            "Отчет «Входит в блюда» вернул некорректный ответ"
          )
        );
      }

      const normalizedStatus = Array.isArray(result) ? result[0] : result;

      if (
        !response.ok ||
        (!Array.isArray(result) && normalizedStatus?.status === "error")
      ) {
        throw new Error(
          normalizedStatus?.error ||
            normalizedStatus?.message ||
            t(
              "DishCard.InDishesLoadError",
              "Ошибка загрузки отчета «Входит в блюда»"
            )
        );
      }

      setDishInPfRows(normalizeReportRows(result));
    } catch (err) {
      setDishInPfError(
        err?.message ||
          t(
            "DishCard.InDishesLoadError",
            "Ошибка загрузки отчета «Входит в блюда»"
          )
      );
    } finally {
      setDishInPfLoading(false);
    }
  }


  async function openDishCardReport() {
    if (!fetchWithAuth) return;

    const dishId = Number(selectedId || 0);

    if (!dishId) {
      setError(
        t("DishCard.SelectDishRequired", "Выберите блюдо для карточки блюда")
      );
      return;
    }

    const d1 = formatApiDateForRequest(dateFrom);
    const d2 = formatApiDateForRequest(dateTo);

    if (!d1 || !d2) {
      setError(
        t("DishCard.PeriodRequired", "Укажите период в верхнем меню")
      );
      return;
    }

    setCopyOpen(false);
    setPrintMenuOpen(false);
    setError("");
    setDishCardData(null);
    setDishCardError("");
    setDishCardLoading(true);
    setDishInPfRows([]);
    setDishInPfError("");
    setViewMode("dishCard");

    void loadDishInPfReport(dishId);

    try {
      const url = new URL("https://webback.bar-boss.com/wr_CardsDish.php");
      url.searchParams.set("IdDish", String(dishId));
      url.searchParams.set("d1", d1);
      url.searchParams.set("d2", d2);

      const response = await fetchWithAuth(url.toString(), { method: "GET" });
      const text = await response.text();
      let result;

      try {
        result = JSON.parse(text);
      } catch {
        throw new Error(
          t("DishCard.InvalidResponse", "Карточка блюда вернула некорректный ответ")
        );
      }

      const normalized = Array.isArray(result) ? result[0] : result;

      if (!response.ok || normalized?.status === "error") {
        throw new Error(
          normalized?.error ||
            normalized?.message ||
            t("DishCard.LoadError", "Ошибка загрузки карточки блюда")
        );
      }

      setDishCardData(normalized && typeof normalized === "object" ? normalized : {});
    } catch (err) {
      setDishCardError(
        err?.message || t("DishCard.LoadError", "Ошибка загрузки карточки блюда")
      );
    } finally {
      setDishCardLoading(false);
    }
  }

  function backFromDishCard() {
    setDishCardData(null);
    setDishCardError("");
    setDishCardLoading(false);
    setDishInPfRows([]);
    setDishInPfError("");
    setDishInPfLoading(false);
    setViewMode("list");
  }

  function normalizeHappyRows(value) {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.result)) return value.result;
    if (Array.isArray(value?.items)) return value.items;
    if (Array.isArray(value?.Items)) return value.Items;
    return [];
  }

  async function loadHappyHoursData() {
    if (!fetchWithAuth) {
      throw new Error(
        t("HappyHours.LoadError", "Ошибка загрузки счастливых часов")
      );
    }

    const dishId = Number(selectedId || 0);

    if (!currentSklad) {
      throw new Error(
        t("DishesPF.WarehouseRequired", "Не выбран склад / подразделение")
      );
    }

    if (!dishId) {
      throw new Error(
        t("HappyHours.SelectDishRequired", "Выберите блюдо")
      );
    }

    setHappyLoading(true);
    setHappyError("");

    try {
      const url = new URL("https://webback.bar-boss.com/wf_HappyOursDish.php");
      url.searchParams.set("Sklad", String(currentSklad));
      url.searchParams.set("IdDish", String(dishId));

      const response = await fetchWithAuth(url.toString(), { method: "GET" });
      const text = await response.text();
      let result;

      try {
        result = JSON.parse(text);
      } catch {
        throw new Error(
          t("HappyHours.InvalidResponse", "Счастливые часы вернули некорректный ответ")
        );
      }

      const normalizedStatus = Array.isArray(result) ? result[0] : result;

      if (
        !response.ok ||
        (!Array.isArray(result) && normalizedStatus?.status === "error")
      ) {
        throw new Error(
          normalizedStatus?.error ||
            normalizedStatus?.message ||
            t("HappyHours.LoadError", "Ошибка загрузки счастливых часов")
        );
      }

      setHappyRows(normalizeHappyRows(result));
      setHappyChangedRows({});
      setHappyDeletedIds([]);
    } finally {
      setHappyLoading(false);
    }
  }

  async function openHappyHours() {
    if (!currentSklad) {
      setError(
        t("DishesPF.WarehouseRequired", "Не выбран склад / подразделение")
      );
      return;
    }

    if (!Number(selectedId || 0)) {
      setError(
        t("HappyHours.SelectDishRequired", "Выберите блюдо")
      );
      return;
    }

    if (!confirmDiscardChanges()) return;

    if (changedCount > 0) {
      setRows(Array.isArray(data) ? data : []);
      discardLocalChanges();
    }

    setCopyOpen(false);
    setPrintMenuOpen(false);
    setHappyRows([]);
    setHappyChangedRows({});
    setHappyDeletedIds([]);
    setHappyError("");
    setHappySaving(false);
    setHappyAdding(false);
    setViewMode("happy");

    try {
      await loadHappyHoursData();
    } catch (err) {
      setHappyError(
        err?.message || t("HappyHours.LoadError", "Ошибка загрузки счастливых часов")
      );
    }
  }

  function backFromHappyHours() {
    if (!confirmDiscardChanges()) return;

    setHappyRows([]);
    setHappyChangedRows({});
    setHappyDeletedIds([]);
    setHappyError("");
    setHappyLoading(false);
    setHappySaving(false);
    setHappyAdding(false);
    setViewMode("list");
    onDirtyChange?.(false);
  }

  function updateHappyField(id, field, value) {
    if (readOnly) return;

    setHappyRows((prevRows) =>
      prevRows.map((row) =>
        Number(row.ID) === Number(id)
          ? {
              ...row,
              [field]: value
            }
          : row
      )
    );

    setHappyChangedRows((prev) => ({
      ...prev,
      [id]: true
    }));
  }

  function deleteHappyHour(id) {
    if (readOnly || happySaving) return;

    const numericId = Number(id || 0);
    if (!numericId) return;

    setHappyRows((prevRows) =>
      prevRows.filter((row) => Number(row.ID || 0) !== numericId)
    );

    setHappyChangedRows((prev) => {
      const next = { ...prev };
      delete next[numericId];
      return next;
    });

    setHappyDeletedIds((prev) =>
      prev.includes(numericId) ? prev : [...prev, numericId]
    );

    setHappyError("");
  }

  function buildHappyHoursXml(sourceRows, deletedIds, dishId) {
    const rowsXml = sourceRows
      .map(
        (row) =>
          `<row><ID>${xmlValue(Number(row.ID || 0))}</ID>` +
          `<IdDish>${xmlValue(Number(dishId || 0))}</IdDish>` +
          `<Begin>${xmlValue(normalizeTimeForServer(row.Begin))}</Begin>` +
          `<End>${xmlValue(normalizeTimeForServer(row.End))}</End>` +
          `<Discount>${xmlValue(row.Discount ?? 0)}</Discount>` +
          `<Price>${xmlValue(row.Price ?? 0)}</Price>` +
          `<DayN>${xmlValue(Number(row.DayN || 0))}</DayN>` +
          `<Active>${xmlValue(normalizeBooleanFlag(row.Active))}</Active></row>`
      )
      .join("");

    const deletedXml = (Array.isArray(deletedIds) ? deletedIds : [])
      .filter((id) => Number(id || 0) > 0)
      .map(
        (id) =>
          `<row><ID>${xmlValue(Number(id || 0))}</ID></row>`
      )
      .join("");

    return `<Ref><HappyH>${rowsXml}</HappyH><Deleted>${deletedXml}</Deleted></Ref>`;
  }

  async function addHappyHour() {
    if (readOnly || happyAdding || !fetchWithAuth) return;

    const dishId = Number(selectedId || 0);
    if (!dishId) {
      setHappyError(
        t("HappyHours.SelectDishRequired", "Выберите блюдо")
      );
      return;
    }

    setHappyAdding(true);
    setHappyError("");

    try {
      const url = new URL("https://webback.bar-boss.com/wf_RefAdd.php");
      url.searchParams.set("Action", "HappyH");
      url.searchParams.set("txt", String(dishId));

      const response = await fetchWithAuth(url.toString(), { method: "GET" });
      const text = await response.text();
      let result;

      try {
        result = JSON.parse(text);
      } catch {
        throw new Error(
          t("HappyHours.AddInvalidResponse", "Добавление строки вернуло некорректный ответ")
        );
      }

      const normalized = Array.isArray(result) ? result[0] : result;

      if (
        !response.ok ||
        (!Array.isArray(result) && normalized?.status === "error")
      ) {
        throw new Error(
          normalized?.error ||
            normalized?.message ||
            t("HappyHours.AddError", "Ошибка добавления счастливых часов")
        );
      }

      const returnedRows = normalizeHappyRows(result).filter(
        (row) => !happyDeletedIds.includes(Number(row.ID || 0))
      );

      if (returnedRows.length === 0) {
        throw new Error(
          t("HappyHours.AddError", "Сервер не вернул добавленную строку")
        );
      }

      setHappyRows((prevRows) => {
        const serverById = new Map(
          returnedRows.map((row) => [Number(row.ID || 0), row])
        );
        const merged = prevRows.map((row) => {
          const id = Number(row.ID || 0);

          if (happyChangedRows[id]) {
            return row;
          }

          return serverById.get(id) ?? row;
        });

        const existingIds = new Set(
          prevRows.map((row) => Number(row.ID || 0))
        );

        for (const row of returnedRows) {
          const id = Number(row.ID || 0);

          if (!existingIds.has(id)) {
            merged.push(row);
          }
        }

        return merged;
      });
    } catch (err) {
      setHappyError(
        err?.message || t("HappyHours.AddError", "Ошибка добавления счастливых часов")
      );
    } finally {
      setHappyAdding(false);
    }
  }

  async function saveHappyHours() {
    if (readOnly || happySaving || !fetchWithAuth) return;

    const dishId = Number(selectedId || 0);
    if (!dishId) {
      setHappyError(
        t("HappyHours.SelectDishRequired", "Выберите блюдо")
      );
      return;
    }

    const changedItems = happyRows.filter((row) => happyChangedRows[row.ID]);
    if (changedItems.length === 0 && happyDeletedIds.length === 0) return;

    setHappySaving(true);
    setHappyError("");

    try {
      const body = new URLSearchParams();
      body.set("Action", "HappyH");
      body.set(
        "xml",
        buildHappyHoursXml(changedItems, happyDeletedIds, dishId)
      );

      console.log("[HappyH] save XML", buildHappyHoursXml(changedItems, happyDeletedIds, dishId));

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
      let result = null;

      if (text.trim()) {
        try {
          result = JSON.parse(text);
        } catch {
          throw new Error(
            t("HappyHours.SaveInvalidResponse", "Сервер вернул некорректный ответ")
          );
        }
      }

      const normalized = Array.isArray(result) ? result[0] : result;

      if (!response.ok || normalized?.status === "error") {
        throw new Error(
          normalized?.error ||
            normalized?.message ||
            t("HappyHours.SaveError", "Ошибка сохранения счастливых часов")
        );
      }

      setHappyChangedRows({});
      setHappyDeletedIds([]);
      onDirtyChange?.(false);
    } catch (err) {
      setHappyError(
        err?.message || t("HappyHours.SaveError", "Ошибка сохранения счастливых часов")
      );
    } finally {
      setHappySaving(false);
    }
  }

  function normalizeReportRows(value) {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.result)) return value.result;
    if (Array.isArray(value?.items)) return value.items;
    if (Array.isArray(value?.Items)) return value.Items;
    if (Array.isArray(value?.data)) return value.data;
    if (value && typeof value === "object" && value.status !== "success") {
      return [value];
    }
    return [];
  }

  async function openMenuReport(kind) {
    if (!fetchWithAuth || !currentSklad) {
      setMenuReportError(
        t("DishesReport.WarehouseRequired", "Не выбран склад / подразделение")
      );
      return;
    }

    const definitions = {
      expandedAverage: {
        endpoint: "wr_DishesMenuRazv.php",
        useGroup: true
      },
      shortCurrent: {
        endpoint: "wr_DishesMenuKratkoe.php",
        useGroup: true
      },
      shortAverage: {
        endpoint: "wr_DishesMenuKratkoeSred.php",
        useGroup: true
      },
      dates: {
        endpoint: "wr_DishesDatesChange.php",
        useGroup: false
      },
      pf: {
        endpoint: "wr_DishesMenuPF.php",
        useGroup: false
      }
    };

    const definition = definitions[kind];
    if (!definition) return;

    setCopyOpen(false);
    setPrintMenuOpen(false);
    setMenuReportKind(kind);
    setMenuReportRows([]);
    setMenuReportError("");
    setMenuReportLoading(true);
    setViewMode("report");

    try {
      const url = new URL(
        `https://webback.bar-boss.com/${definition.endpoint}`
      );
      url.searchParams.set("Sklad", String(currentSklad));

      if (definition.useGroup) {
        url.searchParams.set("Group", String(filterGroup ?? "%"));
      }

      const response = await fetchWithAuth(url.toString(), { method: "GET" });
      const text = await response.text();
      let data;

      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          t("DishesReport.InvalidResponse", "Отчет вернул некорректный ответ")
        );
      }

      const normalizedStatus = Array.isArray(data) ? data[0] : data;
      if (
        !response.ok ||
        (!Array.isArray(data) && normalizedStatus?.status === "error")
      ) {
        throw new Error(
          normalizedStatus?.error ||
            normalizedStatus?.message ||
            t("DishesReport.LoadError", "Ошибка загрузки отчета")
        );
      }

      setMenuReportRows(normalizeReportRows(data));
    } catch (err) {
      setMenuReportError(
        err?.message || t("DishesReport.LoadError", "Ошибка загрузки отчета")
      );
    } finally {
      setMenuReportLoading(false);
    }
  }


  async function exportCurrentMenuReport(format) {
    if (
      reportExportLoading ||
      menuReportLoading ||
      menuReportError ||
      !menuReportKind
    ) {
      return;
    }

    const reportModel = buildDishesMenuExportModel(
      menuReportKind,
      menuReportRows,
      t
    );

    if (!reportModel) {
      return;
    }

    setReportExportLoading(true);

    try {
      await exportReportFile({
        fetchWithAuth,
        reportModel,
        format,
        errorMessage: t("Report.ExportError", "Ошибка экспорта отчёта.")
      });
    } catch (err) {
      window.alert(
        err?.message ||
          t("Report.ExportError", "Ошибка экспорта отчёта.")
      );
    } finally {
      setReportExportLoading(false);
    }
  }

  async function exportCurrentDishCard(format) {
    if (
      reportExportLoading ||
      dishCardLoading ||
      dishCardError ||
      !dishCardData
    ) {
      return;
    }

    const reportModel = buildDishCardExportModel(dishCardData, t);

    setReportExportLoading(true);

    try {
      await exportReportFile({
        fetchWithAuth,
        reportModel,
        format,
        errorMessage: t("Report.ExportError", "Ошибка экспорта отчёта.")
      });
    } catch (err) {
      window.alert(
        err?.message ||
          t("Report.ExportError", "Ошибка экспорта отчёта.")
      );
    } finally {
      setReportExportLoading(false);
    }
  }

  function backFromMenuReport() {
    setMenuReportKind("");
    setMenuReportRows([]);
    setMenuReportError("");
    setMenuReportLoading(false);
    setViewMode("list");
  }

  if (viewMode === "newDishCalc" && newDishDraft) {
    return (
      <DishCalcPage
        dishId={newDishDraft.CodeBl}
        currentSklad={currentSklad}
        fetchWithAuth={fetchWithAuth}
        newDish={newDishDraft}
        dishGroups={groups}
        dishCehs={cehs}
        dishFops={fops}
        dishTypes={types}
        moldova={moldova}
        onSaveNewDish={saveNewDishFromCalc}
        onNewDishCreated={finishNewDishCreation}
        onBack={() => {
          setNewDishDraft(null);
          setViewMode("list");
          setError("");
          onDirtyChange?.(false);
        }}
        onDirtyChange={onDirtyChange}
        readOnly={false}
        t={t}
      />
    );
  }

  if (viewMode === "dishCard") {
    return (
      <DishCardReportPage
        data={dishCardData}
        loading={dishCardLoading}
        error={dishCardError}
        onBack={backFromDishCard}
        onPrint={() => window.print()}
        onExport={exportCurrentDishCard}
        exportLoading={reportExportLoading}
        inPfRows={dishInPfRows}
        inPfLoading={dishInPfLoading}
        inPfError={dishInPfError}
        t={t}
      />
    );
  }

  if (viewMode === "happy") {
    const selectedDishName =
      rows.find((row) => Number(row.CodeBl) === Number(selectedId))?.Name1 || "";

    return (
      <DishHappyHoursPage
        rows={happyRows}
        changedRows={happyChangedRows}
        deletedCount={happyDeletedIds.length}
        loading={happyLoading}
        saving={happySaving}
        adding={happyAdding}
        error={happyError}
        readOnly={readOnly}
        dishName={selectedDishName}
        onBack={backFromHappyHours}
        onReload={async () => {
          if (!confirmDiscardChanges()) return;
          setHappyChangedRows({});
          setHappyDeletedIds([]);
          onDirtyChange?.(false);

          try {
            await loadHappyHoursData();
          } catch (err) {
            setHappyError(
              err?.message ||
                t("HappyHours.LoadError", "Ошибка загрузки счастливых часов")
            );
          }
        }}
        onAdd={addHappyHour}
        onSave={saveHappyHours}
        onChange={updateHappyField}
        onDelete={deleteHappyHour}
        t={t}
      />
    );
  }

  if (viewMode === "report") {
    return (
      <DishesMenuReportPage
        kind={menuReportKind}
        rows={menuReportRows}
        loading={menuReportLoading}
        error={menuReportError}
        onBack={backFromMenuReport}
        onPrint={() => window.print()}
        onExport={exportCurrentMenuReport}
        exportLoading={reportExportLoading}
        t={t}
      />
    );
  }

  if (viewMode === "pf") {
    return (
      <DishProductionPage
        rows={pfRows}
        rawItems={pfRawItems}
        changedRows={pfChangedRows}
        loading={pfLoading}
        saving={pfSaving}
        error={pfError}
        readOnly={readOnly}
        onBack={backFromProduction}
        onReload={async () => {
          if (!confirmDiscardChanges()) return;
          setPfChangedRows({});
          onDirtyChange?.(false);

          try {
            await loadProductionData();
          } catch (err) {
            setPfError(
              err?.message ||
                t("DishesPF.LoadError", "Ошибка загрузки данных для производства")
            );
          }
        }}
        onChangeTovPF={updateProductionRaw}
        onSave={saveProduction}
        t={t}
      />
    );
  }

  return (
    <div className="dishes-page">
      <DishesToolbar
        groups={toolbarGroups}
        filterSkr={filterSkr}
        filterModif={filterModif}
        filterGroup={filterGroup}
        onChangeSkr={(value) =>
          handleProtectedFilterChange(onChangeSkr, value)
        }
        onChangeModif={(value) =>
          handleProtectedFilterChange(onChangeModif, value)
        }
        onChangeGroup={(value) =>
          handleProtectedFilterChange(onChangeGroup, value)
        }
        readOnly={readOnly}
        changedCount={changedCount}
        saveLoading={saveLoading}
        saveSuccess={saveSuccess}
        dishNameFilter={dishNameFilter}
        onDishNameFilterChange={setDishNameFilter}
        onAddDish={addNewDish}
        onAddQuickRow={addQuickDishRow}
        quickAddLoading={quickAddLoading}
        onSaveDishes={saveDishes}
        extraNameMode={extraNameMode}
        onToggleNameMode={setNameMode}
        copyOpen={copyOpen}
        onToggleCopy={() => {
          setPrintMenuOpen(false);
          setCopyOpen((value) => !value);
          setCopyError("");
        }}
        printMenuOpen={printMenuOpen}
        onTogglePrintMenu={() => {
          setCopyOpen(false);
          setCopyError("");
          setPrintMenuOpen((value) => !value);
        }}
        selectedDishId={selectedCalcDishId}
        onOpenCalculation={() => handleOpenCalc(selectedCalcDishId)}
        onOpenDishCard={openDishCardReport}
        onOpenHappyHours={openHappyHours}
        onOpenProduction={openProduction}
        t={t}
      />

      {printMenuOpen && (
        <div className="dishes-print-menu-panel">
          <button
            type="button"
            className="dishes-print-menu-option"
            onClick={() => openMenuReport("expandedAverage")}
          >
            {t("DishesReport.ExpandedAverage", "Развернутое средние цены")}
          </button>
          <button
            type="button"
            className="dishes-print-menu-option"
            onClick={() => openMenuReport("shortCurrent")}
          >
            {t("DishesReport.ShortCurrent", "Краткое текущие цены")}
          </button>
          <button
            type="button"
            className="dishes-print-menu-option"
            onClick={() => openMenuReport("shortAverage")}
          >
            {t("DishesReport.ShortAverage", "Краткое средние цены")}
          </button>
          <button
            type="button"
            className="dishes-print-menu-option"
            onClick={() => openMenuReport("dates")}
          >
            {t("DishesReport.Dates", "Даты изменения калькуляций")}
          </button>
          <button
            type="button"
            className="dishes-print-menu-option"
            onClick={() => openMenuReport("pf")}
          >
            {t("DishesReport.WithPf", "Блюда с полуфабрикатами")}
          </button>
        </div>
      )}

      {copyOpen && !readOnly && (
        <div className="dishes-copy-panel">
          <label className="dishes-copy-target">
            <span>{t("Dishes.CopyTo", "Куда?")}</span>
            <select
              value={copyTarget}
              onChange={(e) => {
                setCopyTarget(e.target.value);
                setCopyError("");
              }}
              disabled={copyLoading}
            >
              <option value=""></option>
              {safePodrazd.map((item) => {
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

          <label className="toolbar-check">
            <input
              type="checkbox"
              checked={copyAll}
              disabled={copyLoading || copyAllDisabled}
              onChange={(e) => setCopyAll(e.target.checked)}
            />
            {t("Dishes.CopyAll", "Все")}
          </label>

          <label className="toolbar-check">
            <input
              type="checkbox"
              checked={copySelected}
              disabled={copyLoading}
              onChange={(e) => setCopySelected(e.target.checked)}
            />
            {t("Dishes.CopySelected", "Отобранные")}
          </label>

          <button
            type="button"
            className="toolbar-save-button dishes-copy-execute-button"
            onClick={copyCalculation}
            disabled={copyLoading || !copyTarget}
          >
            {copyLoading
              ? t("Dishes.Copying", "Копирование...")
              : t("Dishes.Copy", "Копировать")}
          </button>

          {copyError && <span className="dishes-copy-error">{copyError}</span>}
        </div>
      )}

      {error && (
        <div className="login-error">
          {error}
        </div>
      )}

      {rows.length === 0 && (
        <p></p>
      )}

      {rows.length > 0 && visibleRows.length === 0 && (
        <div className="dishes-filter-empty">
          {t("Dishes.NothingFound", "Ничего не найдено")}
        </div>
      )}

      {visibleRows.length > 0 && (
        <div className="table-wrap" ref={tableWrapRef}>
          <table
            className={[
              "data-table",
              "dishes-table",
              copyOpen ? "dishes-table-copy-selection" : ""
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <thead>
              <tr>
                <th>{t("Dishes.Barcode", "Штрихкод")}</th>
                <th className="dishes-name-column">{t("Dishes.Name", "Название")}</th>
                <th>{t("Dishes.Group", "Группа")}</th>
                {extraNameMode === "eng" && (
                  <th>{t("Dishes.EnglishName", "Eng")}</th>
                )}
                {extraNameMode === "fp" && (
                  <th>{t("Dishes.FpName", "Для ФП")}</th>
                )}
                <th>{t("Dishes.Price", "Цена")}</th>
                <th>{t("Dishes.Weight", "Вес")}</th>
                <th>{t("Dishes.Unit", "Ед.")}</th>
                <th>{t("Dishes.NonProduct", "НеП.")}</th>
                <th>{t("Dishes.HiddenShort", "Скр.")}</th>
                <th>{t("Dishes.Workshop", "Цех")}</th>
                <th>{t("Dishes.Organization", "Предпр.")}</th>
                <th>{t("Dishes.Type", "Тип")}</th>
                <th className="dishes-tax-group-column">
                  {t("Dishes.TaxGroupShort", "Группа налогов")}
                </th>
                <th>{t("Dishes.FiscalPrint", "ФП")}</th>
                <th>{t("Dishes.Uktzed", "УКТЗ.")}</th>
                <th>{t("Dishes.Delivery", "Дост.")}</th>
                <th className="dishes-selection-column">{t("Dishes.Selection", "Отбор")}</th>
              </tr>
            </thead>

            <tbody>
              {visibleRows.map((dish) => (
                <tr
                  key={dish.CodeBl}
                  ref={
                    Number(selectedId) === Number(dish.CodeBl)
                      ? selectedRowRef
                      : null
                  }
                  className={[
                    Number(selectedId) === Number(dish.CodeBl)
                      ? "selected-row"
                      : "",
                    changedRows[dish.CodeBl] ? "changed-row" : ""
                  ].join(" ")}
                  data-dish-id={dish.CodeBl}
                  onClick={() => selectDish(dish.CodeBl)}
                  onDoubleClick={() => {
                    selectDish(dish.CodeBl);
                    handleOpenCalc(dish.CodeBl);
                  }}
                  onKeyDown={handleDishRowKeyDown}
                >
                  <td>
                    <input
                      className="table-input small-input"
                      type="number"
                      value={dish.Shk ?? ""}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateField(dish.CodeBl, "Shk", e.target.value === "" ? "" : Number(e.target.value))
                      }
                    />
                  </td>

                  <td className="dishes-name-column">
                    <input
                      className="table-input dish-name-input"
                      type="text"
                      value={dish.Name1 ?? ""}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateField(dish.CodeBl, "Name1", e.target.value)
                      }
                    />
                  </td>

                  <td>
                    <LookupSelect
                      value={dish.Grupp}
                      items={groups}
                      disabled={readOnly}
                      onChange={(value) =>
                        updateField(dish.CodeBl, "Grupp", Number(value))
                      }
                    />
                  </td>

                  {extraNameMode === "eng" && (
                    <td>
                      <input
                        className="table-input dish-extra-name-input"
                        type="text"
                        value={dish.Name2 ?? ""}
                        disabled={readOnly}
                        onChange={(e) =>
                          updateField(dish.CodeBl, "Name2", e.target.value)
                        }
                      />
                    </td>
                  )}

                  {extraNameMode === "fp" && (
                    <td>
                      <input
                        className="table-input dish-extra-name-input"
                        type="text"
                        value={dish.NameForFP ?? ""}
                        disabled={readOnly}
                        onChange={(e) =>
                          updateField(dish.CodeBl, "NameForFP", e.target.value)
                        }
                      />
                    </td>
                  )}

                  <td>
                    <input
                      className="table-input text-right price-input"
                      type="number"
                      step="0.01"
                      value={dish.Price ?? ""}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateField(dish.CodeBl, "Price", e.target.value)
                      }
                    />
                  </td>

                  <td>
                    <input
                      className="table-input text-right small-input"
                      type="number"
                      step="0.001"
                      value={dish.Ves ?? ""}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateField(dish.CodeBl, "Ves", e.target.value)
                      }
                    />
                  </td>

                  <td>
                    <input
                      className="table-input unit-input"
                      type="text"
                      value={dish.EdVes ?? ""}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateField(dish.CodeBl, "EdVes", e.target.value)
                      }
                    />
                  </td>

                  <td className="center">
                    <input
                      type="checkbox"
                      checked={Boolean(dish.Nep)}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateField(dish.CodeBl, "Nep", e.target.checked)
                      }
                    />
                  </td>

                  <td className="center">
                    <input
                      type="checkbox"
                      checked={Boolean(dish.Skr)}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateField(dish.CodeBl, "Skr", e.target.checked)
                      }
                    />
                  </td>

                  <td>
                    <LookupSelect
                      value={dish.Ceh}
                      items={cehs}
                      disabled={readOnly}
                      onChange={(value) =>
                        updateField(dish.CodeBl, "Ceh", Number(value))
                      }
                    />
                  </td>

                  <td>
                    <LookupSelect
                      value={dish.CodePr}
                      items={fops}
                      disabled={readOnly}
                      onChange={(value) =>
                        updateField(dish.CodeBl, "CodePr", Number(value))
                      }
                    />
                  </td>

                  <td>
                    <LookupSelect
                      value={dish.Typ}
                      items={types}
                      disabled={readOnly}
                      onChange={(value) =>
                        updateField(dish.CodeBl, "Typ", Number(value))
                      }
                    />
                  </td>

                  <td className="dishes-tax-group-column">
                    <TaxGroupSelect
                      value={dish.GruppNal}
                      moldova={moldova}
                      disabled={readOnly}
                      onChange={(value) =>
                        updateField(dish.CodeBl, "GruppNal", Number(value))
                      }
                    />
                  </td>

                  <td className="center">
                    <input
                      type="checkbox"
                      checked={Boolean(dish.Akc)}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateField(dish.CodeBl, "Akc", e.target.checked)
                      }
                    />
                  </td>

                  <td>
                    <input
                      className="table-input ukt-input"
                      type="text"
                      value={dish.UKT ?? ""}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateField(dish.CodeBl, "UKT", e.target.value)
                      }
                    />
                  </td>

                  <td className="center">
                    <input
                      type="checkbox"
                      checked={Boolean(dish.Deliv)}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateField(dish.CodeBl, "Deliv", e.target.checked)
                      }
                    />
                  </td>

                  <td className="center dishes-selection-column">
                    <input
                      type="checkbox"
                      checked={Boolean(dish.Otobr)}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateField(dish.CodeBl, "Otobr", e.target.checked)
                      }
                    />
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

function parseDishesBooleanFlag(value) {
  if (value === true || value === 1) return true;

  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function getDishTaxGroupOptions(moldova) {
  const letters = parseDishesBooleanFlag(moldova)
    ? ["A", "B", "C", "D", "E"]
    : ["А", "Б", "В", "Г", "Д", "Е", "Ж", "З"];

  return [
    { value: 0, label: "" },
    ...letters.map((label, index) => ({
      value: index + 1,
      label
    }))
  ];
}

function TaxGroupSelect({ value, moldova, disabled, onChange }) {
  const options = getDishTaxGroupOptions(moldova);
  const numericValue = Number(value || 0);
  const allowedValue = options.some((item) => item.value === numericValue)
    ? numericValue
    : 0;

  return (
    <select
      className="table-select dishes-tax-group-select"
      value={String(allowedValue)}
      disabled={disabled}
      onChange={(event) => onChange?.(Number(event.target.value || 0))}
    >
      {options.map((item) => (
        <option key={item.value} value={String(item.value)}>
          {item.label}
        </option>
      ))}
    </select>
  );
}

function LookupSelect({ value, items, disabled, onChange }) {
  const safeItems = Array.isArray(items) ? items : [];
  const currentValue = String(value ?? "0");

  return (
    <select
      className="table-select"
      value={currentValue}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="0"></option>

      {safeItems.map((item) => (
        <option key={item.ID} value={String(item.ID)}>
          {item.Name}
        </option>
      ))}
    </select>
  );
}

function normalizeDishesSearchText(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("ru-RU");
}

function DishesGroupSearchSelect({ value, groups, onChange, t }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const safeGroups = Array.isArray(groups) ? groups : [];
  const currentValue = String(value ?? "%");

  const selectedGroup = useMemo(() => {
    if (currentValue === "%") return null;

    return (
      safeGroups.find((group) => String(group.ID) === currentValue) || null
    );
  }, [safeGroups, currentValue]);

  const filteredGroups = useMemo(() => {
    const query = normalizeDishesSearchText(searchText);

    if (!query) {
      return safeGroups.slice(0, 100);
    }

    return safeGroups
      .filter((group) =>
        normalizeDishesSearchText(group.Name).includes(query)
      )
      .slice(0, 100);
  }, [safeGroups, searchText]);

  const exactMatch = useMemo(() => {
    const query = normalizeDishesSearchText(searchText);
    if (!query) return null;

    return (
      safeGroups.find(
        (group) => normalizeDishesSearchText(group.Name) === query
      ) || null
    );
  }, [safeGroups, searchText]);

  const closedValue =
    currentValue === "%"
      ? t("Dishes.AllGroups", "Все")
      : selectedGroup?.Name || "";
  const inputValue = isOpen ? searchText : closedValue;

  function closeList() {
    setIsOpen(false);
    setSearchText("");
  }

  function chooseValue(nextValue) {
    onChange?.(String(nextValue));
    closeList();
  }

  return (
    <div className="dishes-group-search">
      <input
        type="text"
        className="toolbar-select dishes-group-search-input"
        value={inputValue}
        placeholder={t("Dishes.GroupSearchPlaceholder", "Поиск группы...")}
        autoComplete="off"
        onFocus={() => {
          setIsOpen(true);
          setSearchText("");
        }}
        onChange={(event) => {
          setSearchText(event.target.value);
          setIsOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            closeList();
            return;
          }

          if (event.key !== "Enter") return;

          event.preventDefault();

          if (exactMatch) {
            chooseValue(exactMatch.ID);
            return;
          }

          if (filteredGroups.length === 1) {
            chooseValue(filteredGroups[0].ID);
          }
        }}
        onBlur={() => {
          window.setTimeout(closeList, 150);
        }}
      />

      {isOpen && (
        <div className="dishes-group-search-list">
          {!searchText.trim() && (
            <button
              type="button"
              className="dishes-group-search-option muted"
              onMouseDown={(event) => {
                event.preventDefault();
                chooseValue("%");
              }}
            >
              {t("Dishes.AllGroups", "Все")}
            </button>
          )}

          {filteredGroups.length === 0 ? (
            <div className="dishes-group-search-empty">
              {t("Dishes.NothingFound", "Ничего не найдено")}
            </div>
          ) : (
            filteredGroups.map((group) => (
              <button
                key={group.ID}
                type="button"
                className="dishes-group-search-option"
                onMouseDown={(event) => {
                  event.preventDefault();
                  chooseValue(group.ID);
                }}
              >
                {group.Name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function DishesToolbar({
  groups,
  filterSkr,
  filterModif,
  filterGroup,
  onChangeSkr,
  onChangeModif,
  onChangeGroup,
  readOnly,
  changedCount,
  saveLoading,
  saveSuccess,
  dishNameFilter,
  onDishNameFilterChange,
  onAddDish,
  onAddQuickRow,
  quickAddLoading,
  onSaveDishes,
  extraNameMode,
  onToggleNameMode,
  copyOpen,
  onToggleCopy,
  printMenuOpen,
  onTogglePrintMenu,
  selectedDishId,
  onOpenCalculation,
  onOpenDishCard,
  onOpenHappyHours,
  onOpenProduction,
  t
}) {
  return (
    <div className="module-toolbar dishes-toolbar dishes-main-toolbar">
      <div className="toolbar-right dishes-toolbar-actions-row">
        <button
          type="button"
          className="toolbar-save-button dishes-calculation-button"
          disabled={!selectedDishId}
          onClick={onOpenCalculation}
          style={{
            height: "32px",
            padding: "0 15px",
            border: selectedDishId ? "1px solid #6d28d9" : "1px solid #d1d5db",
            borderRadius: "9px",
            background: selectedDishId
              ? "linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)"
              : "#e5e7eb",
            color: selectedDishId ? "#ffffff" : "#9ca3af",
            fontSize: "13px",
            fontWeight: 700,
            boxShadow: selectedDishId
              ? "0 5px 12px rgba(91, 33, 182, 0.22)"
              : "none"
          }}
        >
          {t("Dishes.Calculation", "Калькуляция")}
        </button>

        <button
          type="button"
          className={`toolbar-save-button dishes-print-menu-button ${
            printMenuOpen ? "is-active" : ""
          }`}
          onClick={onTogglePrintMenu}
        >
          {t("DishesReport.PrintMenu", "Печать меню")}
        </button>

        <button
          type="button"
          className="toolbar-save-button dishes-dish-card-button dishes-toolbar-multiline-button"
          onClick={onOpenDishCard}
        >
          <TwoLineButtonLabel text={t("DishCard.Button", "Карточка блюда")} />
        </button>

        <button
          type="button"
          className="toolbar-save-button dishes-happy-button dishes-toolbar-multiline-button"
          onClick={onOpenHappyHours}
        >
          <TwoLineButtonLabel text={t("HappyHours.Button", "Счастливые часы")} />
        </button>

        {!readOnly && (
          <button
            type="button"
            className={`toolbar-save-button dishes-copy-button dishes-toolbar-multiline-button ${
              copyOpen ? "is-active" : ""
            }`}
            onClick={onToggleCopy}
          >
            <TwoLineButtonLabel
              text={t("Dishes.CopyCalculation", "Копировать калькуляцию")}
            />
          </button>
        )}

        <button
          type="button"
          className="toolbar-save-button dishes-production-button"
          onClick={onOpenProduction}
        >
          {t("Dishes.ForProduction", "Для производства")}
        </button>

        {!readOnly && (
          <button
            type="button"
            className="toolbar-save-button dishes-add-button"
            onClick={onAddDish}
          >
            {t("Dishes.Add", "Добавить")}
          </button>
        )}

        {!readOnly && (
          <button
            type="button"
            className="toolbar-save-button dishes-add-button dishes-quick-row-button"
            disabled={quickAddLoading}
            onClick={onAddQuickRow}
          >
            {quickAddLoading
              ? t("Dishes.Adding", "Добавление...")
              : t("Dishes.AddRow", "+Строка")}
          </button>
        )}

        {!readOnly && (
          <button
            type="button"
            className="toolbar-save-button dishes-save-button"
            disabled={changedCount === 0 || saveLoading}
            onClick={onSaveDishes}
          >
            {saveLoading
              ? t("Dishes.Saving", "Сохранение...")
              : t("Dishes.Save", "Сохранить")}
          </button>
        )}

        {saveSuccess && (
          <span className="save-success-message" role="status" aria-live="polite">
            ✓ {t("Common.Saved", "Сохранено")}
          </span>
        )}
      </div>

      <div className="toolbar-left dishes-toolbar-filters-row">
        <label className="toolbar-check">
          <input
            type="checkbox"
            checked={Boolean(filterSkr)}
            onChange={(e) => onChangeSkr(e.target.checked)}
          />
          {t("Dishes.ShowHidden", "Скрытые")}
        </label>

        <label className="toolbar-check">
          <input
            type="checkbox"
            checked={Boolean(filterModif)}
            onChange={(e) => onChangeModif(e.target.checked)}
          />
          {t("Dishes.ShowModifiers", "Модификаторы")}
        </label>

        <label className="toolbar-field">
          <span>{t("Dishes.Group", "Группа")}</span>

          <DishesGroupSearchSelect
            value={filterGroup}
            groups={groups}
            onChange={onChangeGroup}
            t={t}
          />
        </label>

        <label className="toolbar-field dishes-name-filter-field">
          <span>{t("Dishes.NameFilter", "Поиск")}</span>
          <input
            type="search"
            className="dishes-name-filter-input"
            value={dishNameFilter}
            placeholder={t("Dishes.NameFilterPlaceholder", "Фильтр по названию...")}
            onChange={(e) => onDishNameFilterChange?.(e.target.value)}
          />
        </label>

        <label className="toolbar-check dishes-name-mode-check">
          <input
            type="checkbox"
            checked={extraNameMode === "eng"}
            onChange={() => onToggleNameMode?.("eng")}
          />
          {t("Dishes.EnglishName", "Eng")}
        </label>

        <label className="toolbar-check dishes-name-mode-check">
          <input
            type="checkbox"
            checked={extraNameMode === "fp"}
            onChange={() => onToggleNameMode?.("fp")}
          />
          {t("Dishes.FpName", "Для ФП")}
        </label>

        {changedCount > 0 && (
          <span className="changed-info">
            {t("Dishes.ChangedCountPrefix", "Изменено:")} {changedCount}
          </span>
        )}
      </div>
    </div>
  );
}

function TwoLineButtonLabel({ text }) {
  const words = String(text ?? "").trim().split(/\s+/).filter(Boolean);

  if (words.length <= 1) {
    return <span>{text}</span>;
  }

  return (
    <span className="dishes-toolbar-two-line">
      <span>{words[0]}</span>
      <span>{words.slice(1).join(" ")}</span>
    </span>
  );
}


function reportText(value) {
  return String(value ?? "").trim();
}

function compareReportText(a, b) {
  return reportText(a).localeCompare(reportText(b), "ru", {
    sensitivity: "base",
    numeric: true
  });
}

function formatReportNumber(value, digits = 2) {
  if (value === null || value === undefined || value === "") return "";
  const number = Number(value);
  if (!Number.isFinite(number)) return reportText(value);

  return number.toLocaleString("ru-RU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function formatReportDate(value) {
  const text = reportText(value);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : text;
}

function groupMenuReportRows(rows, groupField, nameField) {
  const safeRows = Array.isArray(rows) ? [...rows] : [];

  safeRows.sort((a, b) => {
    const groupCompare = compareReportText(a?.[groupField], b?.[groupField]);
    if (groupCompare !== 0) return groupCompare;
    return compareReportText(a?.[nameField], b?.[nameField]);
  });

  const groups = [];

  for (const row of safeRows) {
    const groupName = reportText(row?.[groupField]);
    let group = groups[groups.length - 1];

    if (!group || group.name !== groupName) {
      group = { name: groupName, rows: [] };
      groups.push(group);
    }

    group.rows.push(row);
  }

  return groups;
}


function getDishesReportTitle(kind, t) {
  const titles = {
    expandedAverage: t(
      "DishesReport.ExpandedAverage",
      "Развернутое средние цены"
    ),
    shortCurrent: t("DishesReport.ShortCurrent", "Краткое текущие цены"),
    shortAverage: t("DishesReport.ShortAverage", "Краткое средние цены"),
    dates: t("DishesReport.Dates", "Даты изменения калькуляций"),
    pf: t("DishesReport.WithPf", "Блюда с полуфабрикатами")
  };

  return titles[kind] || t("DishesReport.Title", "Отчет");
}

function reportFileSuffix(kind) {
  const suffixes = {
    expandedAverage: "ExpandedAverage",
    shortCurrent: "ShortCurrent",
    shortAverage: "ShortAverage",
    dates: "Dates",
    pf: "PF"
  };

  return suffixes[kind] || "Report";
}

function buildDishesMenuExportModel(kind, rows, t) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const title = getDishesReportTitle(kind, t);

  if (kind === "expandedAverage") {
    const groups = groupMenuReportRows(safeRows, "NameGroup", "NameDish");
    const exportRows = [];

    for (const group of groups) {
      for (const dish of group.rows) {
        const items = Array.isArray(dish.Items) ? dish.Items : [];

        if (items.length === 0) {
          exportRows.push({
            Group: group.name || "",
            Dish: dish.NameDish ?? "",
            Price: Number(dish.Price || 0),
            Weight: Number(dish.Ves || 0),
            DishCost: Number(dish.SebestDish || 0),
            Component: "",
            ComponentQty: "",
            ComponentCost: ""
          });
          continue;
        }

        for (const item of items) {
          exportRows.push({
            Group: group.name || "",
            Dish: dish.NameDish ?? "",
            Price: Number(dish.Price || 0),
            Weight: Number(dish.Ves || 0),
            DishCost: Number(dish.SebestDish || 0),
            Component: item.Name ?? "",
            ComponentQty: Number(item.Kolvo || 0),
            ComponentCost: Number(item.Sebest || 0)
          });
        }
      }
    }

    return {
      title,
      fileName: `Dishes_${reportFileSuffix(kind)}`,
      orientation: "landscape",
      locale: "ru-RU",
      meta: [],
      columns: [
        {
          key: "Group",
          title: t("Dishes.Group", "Группа"),
          type: "text",
          width: 24
        },
        {
          key: "Dish",
          title: t("Dishes.Name", "Название"),
          type: "text",
          width: 34
        },
        {
          key: "Price",
          title: t("Dishes.Price", "Цена"),
          type: "number",
          decimals: 2,
          width: 12
        },
        {
          key: "Weight",
          title: t("Dishes.Weight", "Вес"),
          type: "number",
          decimals: 3,
          width: 12
        },
        {
          key: "DishCost",
          title: t("DishesReport.Cost", "Себестоимость"),
          type: "number",
          decimals: 2,
          width: 16
        },
        {
          key: "Component",
          title: t("DishesReport.Composition", "Состав"),
          type: "text",
          width: 34
        },
        {
          key: "ComponentQty",
          title: t("DishesReport.Quantity", "Количество"),
          type: "number",
          decimals: 3,
          width: 14
        },
        {
          key: "ComponentCost",
          title: t("DishesReport.Cost", "Себестоимость"),
          type: "number",
          decimals: 2,
          width: 16
        }
      ],
      rows: exportRows,
      footerRows: []
    };
  }

  if (kind === "shortCurrent" || kind === "shortAverage") {
    const isCurrent = kind === "shortCurrent";
    const groupField = isCurrent ? "GroupName" : "NameGrupp";
    const costField = isCurrent ? "SumSeb" : "Sebest";
    const groups = groupMenuReportRows(safeRows, groupField, "NameDish");
    const exportRows = [];

    for (const group of groups) {
      for (const dish of group.rows) {
        exportRows.push({
          Group: group.name || "",
          Dish: dish.NameDish ?? "",
          Price: Number(dish.PriceDish || 0),
          Cost: Number(dish[costField] || 0),
          Coefficient: Number(dish.Koef || 0)
        });
      }
    }

    return {
      title,
      fileName: `Dishes_${reportFileSuffix(kind)}`,
      orientation: "portrait",
      locale: "ru-RU",
      meta: [],
      columns: [
        {
          key: "Group",
          title: t("Dishes.Group", "Группа"),
          type: "text",
          width: 26
        },
        {
          key: "Dish",
          title: t("Dishes.Name", "Название"),
          type: "text",
          width: 38
        },
        {
          key: "Price",
          title: t("Dishes.Price", "Цена"),
          type: "number",
          decimals: 2,
          width: 14
        },
        {
          key: "Cost",
          title: t("DishesReport.CostShort", "Себест."),
          type: "number",
          decimals: 2,
          width: 14
        },
        {
          key: "Coefficient",
          title: t("DishesReport.Coefficient", "Коэф."),
          type: "number",
          decimals: 2,
          width: 12
        }
      ],
      rows: exportRows,
      footerRows: []
    };
  }

  if (kind === "dates") {
    const groups = groupMenuReportRows(safeRows, "Название", "Наименование");
    const exportRows = [];

    for (const group of groups) {
      for (const dish of group.rows) {
        exportRows.push({
          Group: group.name || "",
          Dish: dish["Наименование"] ?? "",
          Price: Number(dish.PriceDish || 0),
          Dates: (Array.isArray(dish.Dates) ? dish.Dates : [])
            .map((item) => formatReportDate(item.Dat))
            .filter(Boolean)
            .join("; ")
        });
      }
    }

    return {
      title,
      fileName: `Dishes_${reportFileSuffix(kind)}`,
      orientation: "portrait",
      locale: "ru-RU",
      meta: [],
      columns: [
        {
          key: "Group",
          title: t("Dishes.Group", "Группа"),
          type: "text",
          width: 28
        },
        {
          key: "Dish",
          title: t("Dishes.Name", "Название"),
          type: "text",
          width: 38
        },
        {
          key: "Price",
          title: t("Dishes.Price", "Цена"),
          type: "number",
          decimals: 2,
          width: 14
        },
        {
          key: "Dates",
          title: t("DishesReport.ChangeDates", "Даты изменения"),
          type: "text",
          width: 36
        }
      ],
      rows: exportRows,
      footerRows: []
    };
  }

  if (kind === "pf") {
    const groups = groupMenuReportRows(safeRows, "NameGroup", "Наименование");
    const exportRows = [];

    for (const group of groups) {
      for (const dish of group.rows) {
        exportRows.push({
          Group: group.name || "",
          Dish: dish["Наименование"] ?? "",
          SemiFinished: (Array.isArray(dish.items) ? dish.items : [])
            .map((item) => reportText(item.SostavPF))
            .filter(Boolean)
            .join("; ")
        });
      }
    }

    return {
      title,
      fileName: `Dishes_${reportFileSuffix(kind)}`,
      orientation: "portrait",
      locale: "ru-RU",
      meta: [],
      columns: [
        {
          key: "Group",
          title: t("Dishes.Group", "Группа"),
          type: "text",
          width: 30
        },
        {
          key: "Dish",
          title: t("Dishes.Name", "Название"),
          type: "text",
          width: 42
        },
        {
          key: "SemiFinished",
          title: t("DishesReport.SemiFinished", "Полуфабрикаты"),
          type: "text",
          width: 44
        }
      ],
      rows: exportRows,
      footerRows: []
    };
  }

  return null;
}

function DishesMenuReportPage({
  kind,
  rows,
  loading,
  error,
  onBack,
  onPrint,
  onExport,
  exportLoading,
  t
}) {
  const title = getDishesReportTitle(kind, t);

  return (
    <div className="dishes-menu-report-page">
      <div className="dishes-menu-report-toolbar">
        <button type="button" onClick={onBack}>
          {t("DishesReport.Back", "Вернуться к списку блюд")}
        </button>
        <strong>{title}</strong>

        <div className="dishes-menu-report-actions">
          <button
            type="button"
            onClick={() => onExport?.("xlsx")}
            disabled={loading || Boolean(error) || Boolean(exportLoading)}
          >
            {t("Common.Excel", "Excel")}
          </button>

          <button
            type="button"
            onClick={() => onExport?.("docx")}
            disabled={loading || Boolean(error) || Boolean(exportLoading)}
          >
            {t("Common.Word", "Word")}
          </button>

          <button
            type="button"
            onClick={onPrint}
            disabled={loading || Boolean(error) || Boolean(exportLoading)}
          >
            {t("DishesReport.Print", "Печать")}
          </button>
        </div>
      </div>

      <div className="dishes-menu-report-scroll">
        {error && <div className="login-error dishes-menu-report-error">{error}</div>}

        {loading ? (
          <div className="dishes-menu-report-loading">
            {t("DishesReport.Loading", "Загрузка...")}
          </div>
        ) : (
          <div className="dishes-menu-report-sheet">
            <h1>{title}</h1>
            <DishesMenuReportContent kind={kind} rows={rows} t={t} />
          </div>
        )}
      </div>
    </div>
  );
}

function DishesMenuReportContent({ kind, rows, t }) {
  const safeRows = Array.isArray(rows) ? rows : [];

  if (safeRows.length === 0) {
    return <div className="dishes-menu-report-empty">{t("DishesReport.NoData", "Нет данных")}</div>;
  }

  if (kind === "expandedAverage") {
    const groups = groupMenuReportRows(safeRows, "NameGroup", "NameDish");

    return (
      <div className="dishes-menu-report-expanded-groups">
        {groups.map((group, groupIndex) => (
          <section
            className="dishes-menu-report-group dishes-menu-report-expanded-group"
            key={`${group.name}-${groupIndex}`}
          >
            <h2>{group.name || t("DishesReport.NoGroup", "Без группы")}</h2>
            <div className="dishes-menu-report-expanded-grid">
              {group.rows.map((dish, dishIndex) => (
                <article className="dishes-menu-report-expanded-dish" key={dish.ID ?? `${groupIndex}-${dishIndex}`}>
                <table className="dishes-menu-report-table dishes-menu-report-dish-head">
                  <thead>
                    <tr>
                      <th>{t("Dishes.Name", "Название")}</th>
                      <th className="num">{t("Dishes.Price", "Цена")}</th>
                      <th className="num">{t("Dishes.Weight", "Вес")}</th>
                      <th className="num">{t("DishesReport.Cost", "Себестоимость")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{dish.NameDish ?? ""}</td>
                      <td className="num">{formatReportNumber(dish.Price, 2)}</td>
                      <td className="num">{formatReportNumber(dish.Ves, 3)}</td>
                      <td className="num">{formatReportNumber(dish.SebestDish, 2)}</td>
                    </tr>
                  </tbody>
                </table>

                <table className="dishes-menu-report-table dishes-menu-report-composition">
                  <thead>
                    <tr>
                      <th>{t("DishesReport.Composition", "Состав")}</th>
                      <th className="num">{t("DishesReport.Quantity", "Количество")}</th>
                      <th className="num">{t("DishesReport.Cost", "Себестоимость")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Array.isArray(dish.Items) ? dish.Items : []).map((item, itemIndex) => (
                      <tr key={`${dish.ID ?? dishIndex}-item-${itemIndex}`}>
                        <td>{item.Name ?? ""}</td>
                        <td className="num">{formatReportNumber(item.Kolvo, 3)}</td>
                        <td className="num">{formatReportNumber(item.Sebest, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  if (kind === "shortCurrent" || kind === "shortAverage") {
    const isCurrent = kind === "shortCurrent";
    const groupField = isCurrent ? "GroupName" : "NameGrupp";
    const costField = isCurrent ? "SumSeb" : "Sebest";
    const groups = groupMenuReportRows(safeRows, groupField, "NameDish");

    return groups.map((group, groupIndex) => {
      const splitIndex = Math.ceil(group.rows.length / 2);
      const columns = [
        group.rows.slice(0, splitIndex),
        group.rows.slice(splitIndex)
      ];

      return (
        <section className="dishes-menu-report-group" key={`${group.name}-${groupIndex}`}>
          <h2>{group.name || t("DishesReport.NoGroup", "Без группы")}</h2>
          <div className="dishes-menu-report-short-grid">
            {columns.map((columnRows, columnIndex) => (
              <table
                className="dishes-menu-report-table dishes-menu-report-short-table"
                key={`${groupIndex}-column-${columnIndex}`}
              >
                <thead>
                  <tr>
                    <th>{t("Dishes.Name", "Название")}</th>
                    <th className="num">{t("Dishes.Price", "Цена")}</th>
                    <th className="num">{t("DishesReport.CostShort", "Себест.")}</th>
                    <th className="num">{t("DishesReport.Coefficient", "Коэф.")}</th>
                  </tr>
                </thead>
                <tbody>
                  {columnRows.map((dish, dishIndex) => (
                    <tr key={dish.ID ?? `${groupIndex}-${columnIndex}-${dishIndex}`}>
                      <td>{dish.NameDish ?? ""}</td>
                      <td className="num">{formatReportNumber(dish.PriceDish, 2)}</td>
                      <td className="num">{formatReportNumber(dish[costField], 2)}</td>
                      <td className="num">{formatReportNumber(dish.Koef, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
          </div>
        </section>
      );
    });
  }

  if (kind === "dates") {
    const groups = groupMenuReportRows(safeRows, "Название", "Наименование");

    return groups.map((group, groupIndex) => (
      <section className="dishes-menu-report-group" key={`${group.name}-${groupIndex}`}>
        <h2>{group.name || t("DishesReport.NoGroup", "Без группы")}</h2>
        <table className="dishes-menu-report-table dishes-menu-report-dates-table">
          <thead>
            <tr>
              <th>{t("Dishes.Name", "Название")}</th>
              <th className="num">{t("Dishes.Price", "Цена")}</th>
              <th>{t("DishesReport.ChangeDates", "Даты изменения")}</th>
            </tr>
          </thead>
          <tbody>
            {group.rows.map((dish, dishIndex) => (
              <tr key={dish["КодБлюда"] ?? `${groupIndex}-${dishIndex}`}>
                <td>{dish["Наименование"] ?? ""}</td>
                <td className="num">{formatReportNumber(dish.PriceDish, 2)}</td>
                <td>
                  <div className="dishes-menu-report-date-list">
                    {(Array.isArray(dish.Dates) ? dish.Dates : []).map((item, dateIndex) => (
                      <span key={`${dish["КодБлюда"] ?? dishIndex}-date-${dateIndex}`}>
                        {formatReportDate(item.Dat)}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    ));
  }

  if (kind === "pf") {
    const groups = groupMenuReportRows(safeRows, "NameGroup", "Наименование");

    return groups.map((group, groupIndex) => (
      <section className="dishes-menu-report-group" key={`${group.name}-${groupIndex}`}>
        <h2>{group.name || t("DishesReport.NoGroup", "Без группы")}</h2>
        <table className="dishes-menu-report-table dishes-menu-report-pf-table">
          <thead>
            <tr>
              <th>{t("Dishes.Name", "Название")}</th>
              <th>{t("DishesReport.SemiFinished", "Полуфабрикаты")}</th>
            </tr>
          </thead>
          <tbody>
            {group.rows.map((dish, dishIndex) => (
              <tr key={dish["КодБлюда"] ?? `${groupIndex}-${dishIndex}`}>
                <td>{dish["Наименование"] ?? ""}</td>
                <td>
                  <div className="dishes-menu-report-pf-list">
                    {(Array.isArray(dish.items) ? dish.items : []).map((item, itemIndex) => (
                      <span key={`${dish["КодБлюда"] ?? dishIndex}-pf-${item.IdPF ?? itemIndex}`}>
                        {item.SostavPF ?? ""}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    ));
  }

  return null;
}


function formatApiDateForRequest(value) {
  const text = String(value ?? "").trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (iso) {
    return `${iso[3]}.${iso[2]}.${iso[1]}`;
  }

  const local = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);

  if (local) {
    return `${String(local[1]).padStart(2, "0")}.${String(local[2]).padStart(
      2,
      "0"
    )}.${local[3]}`;
  }

  return "";
}

function normalizeTimeForInput(value) {
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{1,2}):(\d{2})/);

  if (!match) return "";

  return `${String(match[1]).padStart(2, "0")}:${match[2]}`;
}

function normalizeTimeForServer(value) {
  const input = normalizeTimeForInput(value);
  return input ? `${input}:00` : "";
}

function normalizeBooleanFlag(value) {
  if (value === true || value === 1) return true;

  const text = String(value ?? "").trim().toLowerCase();
  return text === "1" || text === "true" || text === "yes";
}

function dishCardDateKey(value) {
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

function dishCardTime(value) {
  const text = String(value ?? "").trim();
  const match = text.match(/[T ](\d{2}):(\d{2})/);

  return match ? `${match[1]}:${match[2]}` : "";
}

function groupDishCardRows(rows) {
  const safeRows = Array.isArray(rows) ? [...rows] : [];

  safeRows.sort((a, b) =>
    String(a?.DateP ?? "").localeCompare(String(b?.DateP ?? ""))
  );

  const result = [];

  for (const row of safeRows) {
    const dayKey = dishCardDateKey(row?.DateP) || "0";
    let day = result[result.length - 1];

    if (!day || day.key !== dayKey) {
      day = {
        key: dayKey,
        rows: [],
        quantity: 0,
        sum: 0
      };
      result.push(day);
    }

    day.rows.push(row);
    day.quantity += Number(row?.["Ушло"] || 0);
    day.sum += Number(row?.["Сум"] || 0);
  }

  return result;
}


function buildDishCardExportModel(data, t) {
  const realiz = Array.isArray(data?.Realiz) ? data.Realiz : [];
  const days = groupDishCardRows(realiz);
  const title = data?.NameDish || t("DishCard.Title", "Карточка блюда");
  const periodText = [
    formatReportDate(data?.Date1),
    formatReportDate(data?.Date2)
  ]
    .filter(Boolean)
    .join(" — ");

  let totalQuantity = 0;
  let totalSum = 0;
  const rows = [];

  for (const day of days) {
    totalQuantity += Number(day.quantity || 0);
    totalSum += Number(day.sum || 0);

    for (const row of day.rows) {
      rows.push({
        Date: day.key === "0" ? "" : formatReportDate(day.key),
        Time: dishCardTime(row.DateP),
        Waiter: row.Waiter ?? "",
        Client: row.Client ?? "",
        Quantity: Number(row["Ушло"] || 0),
        Price: Number(row.Price || 0),
        Discount:
          row.Discount === null ||
          row.Discount === undefined ||
          row.Discount === ""
            ? ""
            : Number(row.Discount),
        Sum: Number(row["Сум"] || 0)
      });
    }
  }

  return {
    title,
    fileName: `DishCard_${String(data?.IdDish || data?.ID || "report")}`,
    orientation: "landscape",
    locale: "ru-RU",
    meta: periodText
      ? [
          {
            label: t("DishCard.Period", "Период"),
            value: periodText
          }
        ]
      : [],
    columns: [
      {
        key: "Date",
        title: t("DishesReport.Date", "Дата"),
        type: "text",
        width: 14
      },
      {
        key: "Time",
        title: t("DishCard.Time", "Время"),
        type: "text",
        width: 10
      },
      {
        key: "Waiter",
        title: t("DishCard.Waiter", "Официант"),
        type: "text",
        width: 20
      },
      {
        key: "Client",
        title: t("DishCard.Client", "Клиент"),
        type: "text",
        width: 28
      },
      {
        key: "Quantity",
        title: t("DishCard.Quantity", "Кол-во"),
        type: "number",
        decimals: 2,
        width: 12
      },
      {
        key: "Price",
        title: t("Dishes.Price", "Цена"),
        type: "number",
        decimals: 2,
        width: 12
      },
      {
        key: "Discount",
        title: t("DishCard.Discount", "Скидка"),
        type: "number",
        decimals: 2,
        width: 12
      },
      {
        key: "Sum",
        title: t("DishCard.Sum", "Сумма"),
        type: "number",
        decimals: 2,
        width: 14
      }
    ],
    rows,
    footerRows: [
      {
        label: t("Common.Total", "Итого"),
        values: {
          Quantity: totalQuantity,
          Sum: totalSum
        }
      }
    ]
  };
}

function DishCardReportPage({
  data,
  loading,
  error,
  onBack,
  onPrint,
  onExport,
  exportLoading,
  inPfRows,
  inPfLoading,
  inPfError,
  t
}) {
  const realiz = Array.isArray(data?.Realiz) ? data.Realiz : [];
  const safeInPfRows = Array.isArray(inPfRows) ? inPfRows : [];
  const days = groupDishCardRows(realiz);
  const nameDish = data?.NameDish ?? "";
  const periodText = [formatReportDate(data?.Date1), formatReportDate(data?.Date2)]
    .filter(Boolean)
    .join(" — ");

  return (
    <div className="dish-card-report-page">
      <div className="dish-card-report-toolbar">
        <button type="button" onClick={onBack}>
          {t("DishCard.Back", "Вернуться к списку блюд")}
        </button>

        <strong>{t("DishCard.Title", "Карточка блюда")}</strong>

        <div className="dish-card-report-actions">
          <button
            type="button"
            onClick={() => onExport?.("xlsx")}
            disabled={loading || Boolean(error) || Boolean(exportLoading)}
          >
            {t("Common.Excel", "Excel")}
          </button>

          <button
            type="button"
            onClick={() => onExport?.("docx")}
            disabled={loading || Boolean(error) || Boolean(exportLoading)}
          >
            {t("Common.Word", "Word")}
          </button>

          <button
            type="button"
            onClick={onPrint}
            disabled={loading || Boolean(error) || Boolean(exportLoading)}
          >
            {t("DishesReport.Print", "Печать")}
          </button>
        </div>
      </div>

      {error && <div className="login-error dish-card-report-error">{error}</div>}

      {loading ? (
        <div className="dish-card-report-loading">
          {t("DishCard.Loading", "Загрузка...")}
        </div>
      ) : (
        <div className="dish-card-report-sheet">
          <h1>{nameDish || t("DishCard.Title", "Карточка блюда")}</h1>

          {periodText && (
            <div className="dish-card-report-period">
              {t("DishCard.Period", "Период")}: {periodText}
            </div>
          )}

          {days.length === 0 ? (
            <div className="dish-card-report-empty">
              {t("DishCard.NoData", "Нет данных")}
            </div>
          ) : (
            days.map((day) => (
              <section className="dish-card-report-day" key={day.key}>
                <h2>
                  {day.key === "0"
                    ? t("DishCard.NoDate", "Без даты")
                    : formatReportDate(day.key)}
                </h2>

                <div className="dish-card-report-table-wrap">
                  <table className="dish-card-report-table">
                    <thead>
                      <tr>
                        <th>{t("DishCard.Time", "Время")}</th>
                        <th>{t("DishCard.Waiter", "Официант")}</th>
                        <th>{t("DishCard.Client", "Клиент")}</th>
                        <th className="num">{t("DishCard.Quantity", "Кол-во")}</th>
                        <th className="num">{t("Dishes.Price", "Цена")}</th>
                        <th className="num">{t("DishCard.Discount", "Скидка")}</th>
                        <th className="num">{t("DishCard.Sum", "Сумма")}</th>
                      </tr>
                    </thead>

                    <tbody>
                      {day.rows.map((row, rowIndex) => (
                        <tr key={row.ID ?? `${day.key}-${rowIndex}`}>
                          <td>{dishCardTime(row.DateP)}</td>
                          <td>{row.Waiter ?? ""}</td>
                          <td>{row.Client ?? ""}</td>
                          <td className="num">
                            {formatReportNumber(row["Ушло"], 2)}
                          </td>
                          <td className="num">
                            {formatReportNumber(row.Price, 2)}
                          </td>
                          <td className="num">
                            {row.Discount === null ||
                            row.Discount === undefined ||
                            row.Discount === ""
                              ? ""
                              : formatReportNumber(row.Discount, 2)}
                          </td>
                          <td className="num">
                            {formatReportNumber(row["Сум"], 2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>

                    <tfoot>
                      <tr>
                        <td colSpan="3">
                          {t("DishCard.DayTotal", "Итого за день")}
                        </td>
                        <td className="num">
                          {formatReportNumber(day.quantity, 2)}
                        </td>
                        <td></td>
                        <td></td>
                        <td className="num">
                          {formatReportNumber(day.sum, 2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>
            ))
          )}

          <section className="dish-card-in-pf-section">
            <h2>{t("DishCard.InDishesTitle", "Входит в блюда:")}</h2>

            {inPfError && (
              <div className="login-error dish-card-in-pf-error">{inPfError}</div>
            )}

            {inPfLoading ? (
              <div className="dish-card-in-pf-loading">
                {t("DishCard.Loading", "Загрузка...")}
              </div>
            ) : safeInPfRows.length > 0 ? (
              <div className="dish-card-report-table-wrap dish-card-in-pf-table-wrap">
                <table className="dish-card-report-table dish-card-in-pf-table">
                  <thead>
                    <tr>
                      <th>{t("DishCard.InDishesName", "Наименование")}</th>
                      <th className="num">{t("DishCard.InDishesNetto", "Нетто")}</th>
                      <th className="center">{t("DishCard.InDishesHidden", "Скрыть")}</th>
                    </tr>
                  </thead>

                  <tbody>
                    {safeInPfRows.map((row, rowIndex) => (
                      <tr key={row.ID ?? `${row.Name ?? "dish"}-${rowIndex}`}>
                        <td>{row.Name ?? ""}</td>
                        <td className="num">{formatReportNumber(row.Netto, 3)}</td>
                        <td className="center">
                          <input
                            type="checkbox"
                            checked={normalizeBooleanFlag(row.Skr)}
                            disabled
                            aria-label={t("DishCard.InDishesHidden", "Скрыть")}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}

function DishHappyHoursPage({
  rows,
  changedRows,
  deletedCount,
  loading,
  saving,
  adding,
  error,
  readOnly,
  dishName,
  onBack,
  onReload,
  onAdd,
  onSave,
  onChange,
  onDelete,
  t
}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const changedCount =
    Object.keys(changedRows || {}).length + Number(deletedCount || 0);

  const dayOptions = [
    [0, t("HappyHours.AllDays", "Все дни")],
    [1, t("HappyHours.Monday", "Понедельник")],
    [2, t("HappyHours.Tuesday", "Вторник")],
    [3, t("HappyHours.Wednesday", "Среда")],
    [4, t("HappyHours.Thursday", "Четверг")],
    [5, t("HappyHours.Friday", "Пятница")],
    [6, t("HappyHours.Saturday", "Суббота")],
    [7, t("HappyHours.Sunday", "Воскресенье")]
  ];

  return (
    <div className="dishes-happy-page">
      <div className="dishes-happy-toolbar">
        <div className="dishes-happy-toolbar-left">
          <button
            type="button"
            className="dishes-happy-back-button"
            onClick={onBack}
            disabled={saving || adding}
          >
            {t("HappyHours.Back", "Вернуться к списку блюд")}
          </button>

          <strong>
            {t("HappyHours.Title", "Счастливые часы")}
            {dishName ? ` — ${dishName}` : ""}
          </strong>

          {changedCount > 0 && (
            <span className="changed-info">
              {t("Dishes.ChangedCountPrefix", "Изменено:")} {changedCount}
            </span>
          )}
        </div>

        <div className="dishes-happy-toolbar-right">
          <button
            type="button"
            className="dishes-happy-reload-button"
            onClick={onReload}
            disabled={loading || saving || adding}
          >
            {t("DishesPF.Refresh", "Обновить")}
          </button>

          {!readOnly && (
            <button
              type="button"
              className="dishes-happy-add-button"
              onClick={onAdd}
              disabled={loading || saving || adding}
              title={t("HappyHours.Add", "Добавить строку")}
            >
              {adding ? "..." : "+"}
            </button>
          )}

          {!readOnly && (
            <button
              type="button"
              className="dishes-happy-save-button"
              onClick={onSave}
              disabled={changedCount === 0 || loading || saving || adding}
            >
              {saving
                ? t("Dishes.Saving", "Сохранение...")
                : t("Dishes.Save", "Сохранить")}
            </button>
          )}
        </div>
      </div>

      {error && <div className="login-error dishes-happy-error">{error}</div>}

      {loading ? (
        <div className="dishes-happy-loading">
          {t("HappyHours.Loading", "Загрузка...")}
        </div>
      ) : (
        <div className="dishes-happy-card">
          <table className="dishes-happy-table">
            <thead>
              <tr>
                <th>{t("HappyHours.Begin", "Начало")}</th>
                <th>{t("HappyHours.End", "Конец")}</th>
                <th>{t("HappyHours.Day", "День")}</th>
                <th>{t("HappyHours.Discount", "Скидка %")}</th>
                <th>{t("Dishes.Price", "Цена")}</th>
                <th>{t("HappyHours.Active", "Активно")}</th>
                {!readOnly && <th className="dishes-happy-delete-head"></th>}
              </tr>
            </thead>

            <tbody>
              {safeRows.map((row) => (
                <tr
                  key={row.ID}
                  className={changedRows?.[row.ID] ? "changed-row" : ""}
                >
                  <td>
                    <input
                      type="time"
                      value={normalizeTimeForInput(row.Begin)}
                      disabled={readOnly || saving}
                      onChange={(event) =>
                        onChange?.(
                          row.ID,
                          "Begin",
                          normalizeTimeForServer(event.target.value)
                        )
                      }
                    />
                  </td>

                  <td>
                    <input
                      type="time"
                      value={normalizeTimeForInput(row.End)}
                      disabled={readOnly || saving}
                      onChange={(event) =>
                        onChange?.(
                          row.ID,
                          "End",
                          normalizeTimeForServer(event.target.value)
                        )
                      }
                    />
                  </td>

                  <td>
                    <select
                      value={String(row.DayN ?? 0)}
                      disabled={readOnly || saving}
                      onChange={(event) =>
                        onChange?.(row.ID, "DayN", Number(event.target.value))
                      }
                    >
                      {dayOptions.map(([value, label]) => (
                        <option key={value} value={String(value)}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td>
                    <input
                      type="number"
                      step="0.01"
                      value={row.Discount ?? 0}
                      disabled={readOnly || saving}
                      onChange={(event) =>
                        onChange?.(
                          row.ID,
                          "Discount",
                          event.target.value === ""
                            ? ""
                            : Number(event.target.value)
                        )
                      }
                    />
                  </td>

                  <td>
                    <input
                      type="number"
                      step="0.01"
                      value={row.Price ?? 0}
                      disabled={readOnly || saving}
                      onChange={(event) =>
                        onChange?.(
                          row.ID,
                          "Price",
                          event.target.value === ""
                            ? ""
                            : Number(event.target.value)
                        )
                      }
                    />
                  </td>

                  <td className="center">
                    <input
                      type="checkbox"
                      checked={normalizeBooleanFlag(row.Active)}
                      disabled={readOnly || saving}
                      onChange={(event) =>
                        onChange?.(row.ID, "Active", event.target.checked)
                      }
                    />
                  </td>

                  {!readOnly && (
                    <td className="dishes-happy-delete-cell">
                      <button
                        type="button"
                        className="dishes-happy-delete-button"
                        onClick={() => onDelete?.(row.ID)}
                        disabled={saving}
                        title={t("HappyHours.Delete", "Удалить")}
                      >
                        ×
                      </button>
                    </td>
                  )}
                </tr>
              ))}

              {safeRows.length === 0 && (
                <tr>
                  <td colSpan={readOnly ? 6 : 7} className="dishes-happy-empty">
                    {t("HappyHours.NoData", "Нет данных")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


function DishProductionPage({
  rows,
  rawItems,
  changedRows,
  loading,
  saving,
  error,
  readOnly,
  onBack,
  onReload,
  onChangeTovPF,
  onSave,
  t
}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const changedCount = Object.keys(changedRows || {}).length;

  return (
    <div className="dishes-page dishes-pf-page">
      <div className="module-toolbar dishes-toolbar dishes-pf-toolbar">
        <div className="toolbar-left">
          <button
            type="button"
            className="toolbar-save-button dishes-pf-back-button"
            onClick={onBack}
            disabled={saving}
          >
            {t("DishesPF.Back", "Вернуться к списку блюд")}
          </button>

          <strong className="dishes-pf-title">
            {t("Dishes.ForProduction", "Для производства")}
          </strong>

          {changedCount > 0 && (
            <span className="changed-info">
              {t("Dishes.ChangedCountPrefix", "Изменено:")} {changedCount}
            </span>
          )}
        </div>

        <div className="toolbar-right">
          <button
            type="button"
            className="toolbar-save-button dishes-pf-reload-button"
            onClick={onReload}
            disabled={loading || saving}
          >
            {t("DishesPF.Refresh", "Обновить")}
          </button>

          {!readOnly && (
            <button
              type="button"
              className="toolbar-save-button dishes-save-button"
              onClick={onSave}
              disabled={changedCount === 0 || saving || loading}
            >
              {saving
                ? t("Dishes.Saving", "Сохранение...")
                : t("Dishes.Save", "Сохранить")}
            </button>
          )}
        </div>
      </div>

      {error && <div className="login-error">{error}</div>}

      {loading ? (
        <p>{t("DishesPF.Loading", "Загрузка...")}</p>
      ) : (
        <div className="table-wrap dishes-pf-table-wrap">
          <table className="data-table dishes-pf-table">
            <thead>
              <tr>
                <th>{t("Dishes.Name", "Название")}</th>
                <th>{t("Dishes.Price", "Цена")}</th>
                <th>{t("Dishes.Weight", "Вес")}</th>
                <th>{t("Dishes.Unit", "Ед.")}</th>
                <th>{t("Dishes.Group", "Группа")}</th>
                <th>{t("DishesPF.ProducedRaw", "Производимое сырье")}</th>
              </tr>
            </thead>
            <tbody>
              {safeRows.map((row) => (
                <tr
                  key={row.CodeBl}
                  className={changedRows?.[row.CodeBl] ? "changed-row" : ""}
                >
                  <td>{row.Name1 ?? ""}</td>
                  <td className="text-right">{row.Price ?? ""}</td>
                  <td className="text-right">{row.Ves ?? ""}</td>
                  <td>{row.EdVes ?? ""}</td>
                  <td>{row.Groupp ?? ""}</td>
                  <td className="dishes-pf-raw-cell">
                    <SearchablePfSelect
                      value={row.TovPF}
                      items={rawItems}
                      disabled={readOnly || saving}
                      onChange={(value) => onChangeTovPF?.(row.CodeBl, value)}
                      t={t}
                    />
                  </td>
                </tr>
              ))}

              {safeRows.length === 0 && (
                <tr>
                  <td colSpan="6" className="empty-cell">
                    {t("DishesPF.NoData", "Нет данных")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SearchablePfSelect({ value, items, disabled, onChange, t }) {
  const wrapperRef = useRef(null);
  const safeItems = Array.isArray(items) ? items : [];
  const selectedItem = safeItems.find(
    (item) => Number(item.ID || 0) === Number(value || 0)
  );
  const [query, setQuery] = useState(selectedItem?.Name || "");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery(selectedItem?.Name || "");
    }
  }, [selectedItem?.ID, selectedItem?.Name, open]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!wrapperRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();

    if (!needle) {
      return safeItems;
    }

    return safeItems.filter((item) =>
      String(item.Name || "")
        .toLocaleLowerCase()
        .includes(needle)
    );
  }, [safeItems, query]);

  function choose(item) {
    onChange?.(item ? Number(item.ID || 0) : 0);
    setQuery(item?.Name || "");
    setOpen(false);
  }

  return (
    <div className="dishes-pf-search" ref={wrapperRef}>
      <input
        type="text"
        className="table-input dishes-pf-search-input"
        value={query}
        disabled={disabled}
        placeholder={t("DishesPF.SearchPlaceholder", "Поиск...")}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
          }

          if (event.key === "Enter" && open && filteredItems.length > 0) {
            event.preventDefault();
            choose(filteredItems[0]);
          }
        }}
      />

      {open && !disabled && (
        <div className="dishes-pf-search-list">
          <button
            type="button"
            className="dishes-pf-search-option muted"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(null)}
          >
            —
          </button>

          {filteredItems.map((item) => (
            <button
              type="button"
              key={item.ID}
              className="dishes-pf-search-option"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(item)}
            >
              {item.Name}
            </button>
          ))}

          {filteredItems.length === 0 && (
            <div className="dishes-pf-search-empty">
              {t("DishesPF.NothingFound", "Ничего не найдено")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}