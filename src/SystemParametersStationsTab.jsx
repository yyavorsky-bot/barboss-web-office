import { useEffect, useMemo, useRef, useState } from "react";

const BASE_URL = "https://webback.bar-boss.com/";

const MAIN_FIELDS = [
  "IdStation",
  "NameStation",
  "Rejim",
  "PrintBill",
  "NomKass",
  "CloseReal",
  "Point"
];

const BLOCKS = [
  "Station",
  "Sklads",
  "Cehs",
  "Fiscal",
  "Items",
  "BankTerm",
  "Zal"
];

const BLOCK_KEY_FIELDS = {
  Sklads: "CodeS",
  Cehs: "CodeC",
  Fiscal: "CodeFP",
  BankTerm: "CodeBT",
  Zal: "CodeZ"
};

const BLOCK_FIELDS = {
  Station: MAIN_FIELDS,
  Sklads: ["CodeSkl", "CodeS", "CodeSt", "Multi"],
  Cehs: ["CodeC", "CodeSt", "CodeCeh"],
  Fiscal: [
    "CodeFP",
    "CodeSt",
    "FPwork",
    "FPlocal",
    "PortFP",
    "FPtype",
    "CodeFOP",
    "FPmask",
    "Perekl",
    "NomFP"
  ],
  Items: [
    "LangF",
    "ShKod",
    "Cl",
    "HappyH",
    "NameKass",
    "A_Guests",
    "A_KassServ",
    "A_Deliv",
    "MonoServ",
    "CallCentre",
    "A_Elorder",
    "A_Vhod",
    "A_Resize",
    "A_CopySch",
    "A_SkrBan",
    "A_QuitAll",
    "A_ViruchkaKass",
    "VhV",
    "DublBeg"
  ],
  BankTerm: [
    "CodeBT",
    "sIP",
    "sPort",
    "Port",
    "BaudRate",
    "Typ",
    "TypTerm",
    "UseBT",
    "MerchId",
    "CodeFOP"
  ],
  Zal: ["CodeZ"]
};

const BOOLEAN_FIELDS = new Set([
  "PrintBill",
  "CloseReal",
  "Multi",
  "FPwork",
  "FPlocal",
  "FPmask",
  "Perekl",
  "ShKod",
  "Cl",
  "HappyH",
  "A_Guests",
  "A_KassServ",
  "A_Deliv",
  "MonoServ",
  "CallCentre",
  "A_Elorder",
  "A_Vhod",
  "A_Resize",
  "A_CopySch",
  "A_SkrBan",
  "A_QuitAll",
  "A_ViruchkaKass",
  "VhV",
  "DublBeg",
  "UseBT"
]);

const SPEED_OPTIONS = [
  9600,
  19200,
  38400,
  57600,
  115200
];

const CONNECTION_TYPES = [
  { id: 1, Name: "Ethernet" },
  { id: 2, Name: "COM" }
];

const PROTOCOL_TYPES = [
  { id: 1, Name: "BPOS1 протокол" },
  { id: 2, Name: "Printec PosAPI" },
  { id: 3, Name: "Checkbox PayLink" }
];

function n(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function normalizeRows(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeParams2(data) {
  const source =
    data && typeof data === "object" && !Array.isArray(data)
      ? data
      : {};

  return {
    ListRejim:
      source.ListRejim &&
      typeof source.ListRejim === "object" &&
      !Array.isArray(source.ListRejim)
        ? source.ListRejim
        : {},
    ListPoint: normalizeRows(source.ListPoint),
    ListFOP: normalizeRows(source.ListFOP),
    ListZal: normalizeRows(source.ListZal),
    ListCeh: normalizeRows(source.ListCeh),
    ListTipFP: normalizeRows(source.ListTipFP),
    ListLang: normalizeRows(source.ListLang),
    ListKass: normalizeRows(source.ListKass),
    Station: normalizeRows(source.Station).map((station) => ({
      ...station,
      Sklads: normalizeRows(station?.Sklads),
      Cehs: normalizeRows(station?.Cehs),
      Fiscal: normalizeRows(station?.Fiscal),
      Items:
        station?.Items &&
        typeof station.Items === "object" &&
        !Array.isArray(station.Items)
          ? { ...station.Items }
          : {},
      BankTerm: normalizeRows(station?.BankTerm),
      Zal: normalizeRows(station?.Zal)
    }))
  };
}

function pickFields(source, fields) {
  const result = {};

  for (const field of fields) {
    result[field] = source?.[field] ?? null;
  }

  return result;
}

function comparableBlock(station, block) {
  if (!station) return null;

  if (block === "Station") {
    return pickFields(station, BLOCK_FIELDS.Station);
  }

  if (block === "Items") {
    return pickFields(
      station.Items ?? {},
      BLOCK_FIELDS.Items
    );
  }

  const rows = normalizeRows(station?.[block]);

  return rows.map((row) =>
    pickFields(row, BLOCK_FIELDS[block])
  );
}

function getDeletedRows(originalStation, currentStation, block) {
  const keyField = BLOCK_KEY_FIELDS[block];

  if (
    !keyField ||
    !originalStation ||
    !currentStation
  ) {
    return [];
  }

  const currentKeys = new Set(
    normalizeRows(currentStation?.[block]).map(
      (row) => String(row?.[keyField] ?? "")
    )
  );

  return normalizeRows(originalStation?.[block]).filter(
    (row) => {
      const key = row?.[keyField];

      if (key === null || key === undefined || key === "") {
        return false;
      }

      return !currentKeys.has(String(key));
    }
  );
}

function isSame(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function remapStationId(station, newId) {
  return {
    ...station,
    IdStation: newId,
    Sklads: normalizeRows(station?.Sklads).map((row) => ({
      ...row,
      CodeSt: newId
    })),
    Cehs: normalizeRows(station?.Cehs).map((row) => ({
      ...row,
      CodeSt: newId
    })),
    Fiscal: normalizeRows(station?.Fiscal).map((row) => ({
      ...row,
      CodeSt: newId
    }))
  };
}

function extractStationIdMap(result, rawText = "") {
  let source = Array.isArray(result)
    ? result[0] ?? {}
    : result ?? {};

  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      source = {};
    }
  }

  let ids = source?.Ids ?? source?.ids ?? [];

  if (typeof ids === "string") {
    try {
      ids = JSON.parse(ids);
    } catch {
      ids = [];
    }
  }

  if (!Array.isArray(ids) && rawText) {
    try {
      const parsed = JSON.parse(rawText);
      ids = parsed?.Ids ?? parsed?.ids ?? [];

      if (typeof ids === "string") {
        ids = JSON.parse(ids);
      }
    } catch {
      ids = [];
    }
  }

  const map = new Map();

  for (const item of Array.isArray(ids) ? ids : []) {
    const tempId = n(
      item?.TempId ??
        item?.tempId ??
        item?.TempID ??
        item?.tempID
    );

    const idStation = n(
      item?.IdStation ??
        item?.idStation ??
        item?.ID ??
        item?.Id ??
        item?.id ??
        item?.CodeSt
    );

    if (tempId < 0 && idStation > 0) {
      map.set(tempId, idStation);
    }
  }

  return map;
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function xmlField(name, value) {
  const normalized = BOOLEAN_FIELDS.has(name)
    ? value
      ? 1
      : 0
    : value ?? "";

  return `<${name}>${escapeXml(normalized)}</${name}>`;
}

function buildParams2BlockXml(
  station,
  block,
  deletedRows = []
) {
  const stationId = n(station?.IdStation);
  const fields = BLOCK_FIELDS[block];

  let rows;

  if (block === "Station") {
    rows = [station];
  } else if (block === "Items") {
    rows = [station?.Items ?? {}];
  } else {
    rows = normalizeRows(station?.[block]);
  }

  const rowXml = rows
    .map(
      (row) =>
        `<row>${fields
          .map((field) => xmlField(field, row?.[field]))
          .join("")}</row>`
    )
    .join("");

  const deletedXml =
    normalizeRows(deletedRows).length > 0
      ? `<Deleted>${normalizeRows(deletedRows)
          .map(
            (row) =>
              `<row>${fields
                .map((field) =>
                  xmlField(field, row?.[field])
                )
                .join("")}</row>`
          )
          .join("")}</Deleted>`
      : "";

  return (
    "<Ref><Params2>" +
    `<IdStation>${stationId}</IdStation>` +
    `<Block>${escapeXml(block)}</Block>` +
    `<${block}>${rowXml}</${block}>` +
    deletedXml +
    "</Params2></Ref>"
  );
}


function buildParams2StationXml(stations) {
  const rowXml = normalizeRows(stations)
    .map(
      (station) =>
        `<row>${BLOCK_FIELDS.Station
          .map((field) =>
            xmlField(field, station?.[field])
          )
          .join("")}</row>`
    )
    .join("");

  return (
    "<Ref><Params2>" +
    "<Block>Station</Block>" +
    `<Station>${rowXml}</Station>` +
    "</Params2></Ref>"
  );
}

async function readJsonResponse(response, fallbackMessage) {
  const text = await response.text();
  let data;

  try {
    data = text.trim() ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      `${fallbackMessage}: ${text.substring(0, 300)}`
    );
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

function optionValue(item) {
  return n(
    item?.ID ??
      item?.Id ??
      item?.id ??
      item?.Code ??
      item?.CodeSt ??
      item?.NomFP ??
      item?.value
  );
}

function optionLabel(item) {
  return String(
    item?.Name ??
      item?.NAME ??
      item?.NameKass ??
      item?.NameSt ??
      item?.Label ??
      item?.label ??
      optionValue(item)
  );
}

function Check({
  label,
  checked,
  disabled,
  onChange
}) {
  return (
    <label className="system-param-check">
      <input
        type="checkbox"
        checked={Boolean(checked)}
        disabled={disabled}
        onChange={(event) =>
          onChange?.(event.target.checked)
        }
      />
      <span>{label}</span>
    </label>
  );
}

function Modal({
  title,
  onClose,
  children
}) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose?.();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () =>
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
  }, [onClose]);

  return (
    <div
      className="system-param-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div className="system-param-modal">
        <div className="system-param-modal-header">
          <h3>{title}</h3>
          <button
            type="button"
            className="system-param-modal-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="system-param-modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function SystemParametersStationsTab({
  fetchWithAuth,
  readOnly = false,
  sklads = [],
  multiPoint = false,
  hidden = false,
  onDirtyChange,
  t = (key, fallback = "") => fallback
}) {
  const [data, setData] = useState(null);
  const [original, setOriginal] = useState(null);
  const [selectedStationId, setSelectedStationId] =
    useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveState, setSaveState] = useState("idle");
  const [bankTermOpen, setBankTermOpen] = useState(false);
  const [zalOpen, setZalOpen] = useState(false);
  const [fiscalKuda, setFiscalKuda] = useState({});
  const [fiscalKudaLoading, setFiscalKudaLoading] =
    useState({});
  const tempIdRef = useRef(-1);

  async function loadParams2() {
    setLoading(true);
    setLoadError("");

    try {
      const response = await fetchWithAuth(
        `${BASE_URL}wf_Directory.php?Action=Params2`
      );

      const result = await readJsonResponse(
        response,
        t(
          "SystemParameters.Params2LoadError",
          "Ошибка загрузки параметров станций"
        )
      );

      const normalized = normalizeParams2(result);
      setData(normalized);
      setOriginal(deepClone(normalized));

      setSelectedStationId((current) => {
        if (
          normalized.Station.some(
            (item) =>
              n(item?.IdStation) === n(current)
          )
        ) {
          return current;
        }

        return normalized.Station[0]?.IdStation ?? null;
      });
    } catch (error) {
      setLoadError(
        error?.message ||
          t(
            "SystemParameters.Params2LoadError",
            "Ошибка загрузки параметров станций"
          )
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadParams2();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedStation = useMemo(
    () =>
      data?.Station?.find(
        (item) =>
          n(item?.IdStation) ===
          n(selectedStationId)
      ) ?? null,
    [data, selectedStationId]
  );

  const dirtyBlocks = useMemo(() => {
    if (!data || !original) {
      return [];
    }

    const originalById = new Map(
      normalizeRows(original.Station).map((station) => [
        n(station?.IdStation),
        station
      ])
    );

    const result = [];

    for (const station of normalizeRows(data.Station)) {
      const stationId = n(station?.IdStation);
      const originalStation =
        originalById.get(stationId);

      if (!originalStation) {
        result.push({
          stationId,
          block: "Station"
        });

        result.push({
          stationId,
          block: "Items"
        });

        for (const block of [
          "Sklads",
          "Cehs",
          "Fiscal",
          "BankTerm",
          "Zal"
        ]) {
          if (normalizeRows(station?.[block]).length > 0) {
            result.push({
              stationId,
              block
            });
          }
        }

        continue;
      }

      for (const block of BLOCKS) {
        if (
          !isSame(
            comparableBlock(station, block),
            comparableBlock(originalStation, block)
          )
        ) {
          result.push({
            stationId,
            block
          });
        }
      }
    }

    return result;
  }, [data, original]);

  const dirtyKeySet = useMemo(
    () =>
      new Set(
        dirtyBlocks.map(
          (item) => `${item.stationId}:${item.block}`
        )
      ),
    [dirtyBlocks]
  );

  const isDirty = dirtyBlocks.length > 0;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    return () => {
      onDirtyChange?.(false);
    };
  }, [onDirtyChange]);

  function nextTempId() {
    const value = tempIdRef.current;
    tempIdRef.current -= 1;
    return value;
  }

  function updateStation(stationId, updater) {
    if (readOnly) return;

    setData((current) => {
      if (!current) return current;

      return {
        ...current,
        Station: current.Station.map((station) =>
          n(station?.IdStation) === n(stationId)
            ? updater(station)
            : station
        )
      };
    });

    setSaveState("idle");
    setSaveError("");
  }

  function changeMain(field, value) {
    if (!selectedStation) return;

    updateStation(
      selectedStation.IdStation,
      (station) => ({
        ...station,
        [field]: value
      })
    );
  }

  function changeItems(field, value) {
    if (!selectedStation) return;

    updateStation(
      selectedStation.IdStation,
      (station) => ({
        ...station,
        Items: {
          ...(station.Items ?? {}),
          [field]: value
        }
      })
    );
  }

  function changeRow(block, rowIndex, field, value) {
    if (!selectedStation) return;

    updateStation(
      selectedStation.IdStation,
      (station) => ({
        ...station,
        [block]: normalizeRows(station?.[block]).map(
          (row, index) =>
            index === rowIndex
              ? {
                  ...row,
                  [field]: value
                }
              : row
        )
      })
    );
  }

  function addStation() {
    if (readOnly || !data) return;

    const tempId = nextTempId();
    const firstPoint = n(data?.ListPoint?.[0]?.IdP, 1);
    const firstLanguage = n(data?.ListLang?.[0]?.id, 1);

    const station = {
      IdStation: tempId,
      NameStation: "",
      Rejim: 0,
      PrintBill: true,
      NomKass: 1,
      CloseReal: false,
      Point: firstPoint,
      Sklads: [],
      Cehs: [],
      Fiscal: [],
      Items: {
        LangF: firstLanguage,
        ShKod: false,
        Cl: false,
        HappyH: true,
        NameKass: null,
        A_Guests: false,
        A_KassServ: false,
        A_Deliv: false,
        MonoServ: false,
        CallCentre: false,
        A_Elorder: false,
        A_Vhod: false,
        A_Resize: false,
        A_CopySch: false,
        A_SkrBan: false,
        A_QuitAll: false,
        A_ViruchkaKass: false,
        VhV: false,
        DublBeg: false
      },
      BankTerm: [],
      Zal: []
    };

    setData((current) => ({
      ...current,
      Station: [
        ...normalizeRows(current?.Station),
        station
      ]
    }));

    setSelectedStationId(tempId);
    setBankTermOpen(false);
    setZalOpen(false);
    setSaveState("idle");
    setSaveError("");
  }

  function discardNewStation() {
    if (
      readOnly ||
      !data ||
      !selectedStation ||
      n(selectedStation.IdStation) >= 0
    ) {
      return;
    }

    const tempId = n(selectedStation.IdStation);
    const remaining = data.Station.filter(
      (station) =>
        n(station?.IdStation) !== tempId
    );

    setData((current) => ({
      ...current,
      Station: normalizeRows(current?.Station).filter(
        (station) =>
          n(station?.IdStation) !== tempId
      )
    }));

    setSelectedStationId(
      remaining[0]?.IdStation ?? null
    );
    setBankTermOpen(false);
    setZalOpen(false);
    setSaveState("idle");
    setSaveError("");
  }

  function addSklad() {
    if (!selectedStation) return;

    const used = new Set(
      normalizeRows(selectedStation.Sklads).map((row) =>
        n(row?.CodeSkl)
      )
    );

    const candidate = normalizeRows(sklads).find(
      (item) =>
        !used.has(n(item?.ID ?? item?.Code))
    );

    updateStation(
      selectedStation.IdStation,
      (station) => ({
        ...station,
        Sklads: [
          ...normalizeRows(station.Sklads),
          {
            CodeSkl: n(
              candidate?.ID ?? candidate?.Code
            ),
            CodeS: nextTempId(),
            CodeSt: n(station.IdStation),
            Multi: false
          }
        ]
      })
    );
  }

  function addCeh() {
    if (!selectedStation) return;

    const used = new Set(
      normalizeRows(selectedStation.Cehs).map((row) =>
        n(row?.CodeCeh)
      )
    );

    const candidate = normalizeRows(data?.ListCeh).find(
      (item) => !used.has(n(item?.ID))
    );

    updateStation(
      selectedStation.IdStation,
      (station) => ({
        ...station,
        Cehs: [
          ...normalizeRows(station.Cehs),
          {
            CodeC: nextTempId(),
            CodeSt: n(station.IdStation),
            CodeCeh: n(candidate?.ID)
          }
        ]
      })
    );
  }

  function addFiscal() {
    if (!selectedStation) return;

    updateStation(
      selectedStation.IdStation,
      (station) => ({
        ...station,
        Fiscal: [
          ...normalizeRows(station.Fiscal),
          {
            CodeFP: nextTempId(),
            CodeSt: n(station.IdStation),
            FPwork: false,
            FPlocal: false,
            PortFP: "",
            FPtype: 200,
            CodeFOP: n(data?.ListFOP?.[0]?.ID),
            FPmask: false,
            Perekl: false,
            NomFP: 0
          }
        ]
      })
    );
  }

  function addBankTerm() {
    if (!selectedStation) return;

    updateStation(
      selectedStation.IdStation,
      (station) => ({
        ...station,
        BankTerm: [
          ...normalizeRows(station.BankTerm),
          {
            CodeBT: nextTempId(),
            sIP: "",
            sPort: null,
            Port: 1,
            BaudRate: 115200,
            Typ: 1,
            TypTerm: 1,
            UseBT: false,
            MerchId: "",
            CodeFOP: n(data?.ListFOP?.[0]?.ID)
          }
        ]
      })
    );
  }

  function addZal() {
    if (!selectedStation) return;

    const used = new Set(
      normalizeRows(selectedStation.Zal).map((row) =>
        n(row?.CodeZ)
      )
    );

    const candidate = normalizeRows(data?.ListZal).find(
      (item) => !used.has(n(item?.Code))
    );

    if (!candidate) return;

    updateStation(
      selectedStation.IdStation,
      (station) => ({
        ...station,
        Zal: [
          ...normalizeRows(station.Zal),
          {
            CodeZ: n(candidate.Code)
          }
        ]
      })
    );
  }

  function removeRow(block, rowIndex) {
    if (!selectedStation || readOnly) return;

    const message = t(
      "SystemParameters.DeleteRowConfirm",
      "Удалить строку?"
    );

    if (!window.confirm(message)) {
      return;
    }

    updateStation(
      selectedStation.IdStation,
      (station) => ({
        ...station,
        [block]: normalizeRows(station?.[block]).filter(
          (_, index) => index !== rowIndex
        )
      })
    );
  }

  async function loadFiscalKuda(localValue) {
    const key = localValue ? "1" : "0";

    if (
      fiscalKuda[key] ||
      fiscalKudaLoading[key]
    ) {
      return;
    }

    setFiscalKudaLoading((current) => ({
      ...current,
      [key]: true
    }));

    try {
      const value = localValue ? 1 : 0;
      const response = await fetchWithAuth(
        `${BASE_URL}wf_Directory.php?Action=FiscalKuda&Local=${value}&FPlocal=${value}`
      );

      const result = await readJsonResponse(
        response,
        t(
          "SystemParameters.FiscalKudaLoadError",
          "Ошибка загрузки списка «Куда»"
        )
      );

      setFiscalKuda((current) => ({
        ...current,
        [key]: Array.isArray(result) ? result : []
      }));
    } catch (error) {
      setSaveError(
        error?.message ||
          t(
            "SystemParameters.FiscalKudaLoadError",
            "Ошибка загрузки списка «Куда»"
          )
      );
    } finally {
      setFiscalKudaLoading((current) => ({
        ...current,
        [key]: false
      }));
    }
  }

  useEffect(() => {
    if (!selectedStation) return;

    const values = new Set(
      normalizeRows(selectedStation.Fiscal).map(
        (row) => Boolean(row?.FPlocal)
      )
    );

    for (const value of values) {
      loadFiscalKuda(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStationId]);

  async function postParams2Xml(xml) {
    const body = new URLSearchParams();
    body.set("Action", "Params2");
    body.set("xml", xml);

    const response = await fetchWithAuth(
      `${BASE_URL}wf_RefSave.php`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded;charset=UTF-8"
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
        if (!response.ok) {
          throw new Error(
            `${t(
              "SystemParameters.Params2SaveError",
              "Ошибка сохранения параметров станции"
            )}: ${text.substring(0, 300)}`
          );
        }
      }
    }

    if (
      !response.ok ||
      result?.status === "error"
    ) {
      throw new Error(
        result?.error ||
          result?.message ||
          t(
            "SystemParameters.Params2SaveError",
            "Ошибка сохранения параметров станции"
          )
      );
    }

    return {
      result,
      text
    };
  }

  async function postParams2Block(
    station,
    block,
    deletedRows = []
  ) {
    return postParams2Xml(
      buildParams2BlockXml(
        station,
        block,
        deletedRows
      )
    );
  }

  async function saveChangedBlocks() {
    if (
      readOnly ||
      !data ||
      dirtyBlocks.length === 0 ||
      saveState === "saving"
    ) {
      return;
    }

    setSaveState("saving");
    setSaveError("");

    try {
      const blocksByStation = new Map();

      for (const item of dirtyBlocks) {
        const stationId = n(item.stationId);

        if (!blocksByStation.has(stationId)) {
          blocksByStation.set(stationId, new Set());
        }

        blocksByStation
          .get(stationId)
          .add(item.block);
      }

      /*
       * Station сохраняем ОДНИМ массивом.
       * Это важно, если пользователь добавил сразу несколько
       * локальных станций с IdStation -1, -2, ...
       */
      const stationsToSave = [];

      for (const [stationId, blockSet] of blocksByStation) {
        if (!blockSet.has("Station")) {
          continue;
        }

        const station = data.Station.find(
          (row) =>
            n(row?.IdStation) === n(stationId)
        );

        if (!station) {
          continue;
        }

        if (
          n(station.IdStation) < 0 &&
          !String(station.NameStation ?? "").trim()
        ) {
          setSelectedStationId(station.IdStation);

          throw new Error(
            t(
              "SystemParameters.StationNameRequired",
              "Для новой станции укажите имя."
            )
          );
        }

        stationsToSave.push(station);
      }

      const savedIdMap = new Map();

      if (stationsToSave.length > 0) {
        const stationSave = await postParams2Xml(
          buildParams2StationXml(stationsToSave)
        );

        const returnedIds = extractStationIdMap(
          stationSave.result,
          stationSave.text
        );

        for (const station of stationsToSave) {
          const tempId = n(station.IdStation);

          if (tempId >= 0) {
            continue;
          }

          const newId = returnedIds.get(tempId);

          if (!newId) {
            setSelectedStationId(tempId);

            throw new Error(
              t(
                "SystemParameters.NewStationIdRequired",
                "Новая станция создана, но сервер не вернул соответствие TempId → IdStation."
              )
            );
          }

          savedIdMap.set(tempId, newId);
        }
      }

      /*
       * После получения реальных IdStation сохраняем только
       * изменённые дочерние блоки. Для новых станций CodeSt
       * подменяется на реальный IdStation перед отправкой.
       */
      for (const [tempOrRealId, blockSet] of blocksByStation) {
        const sourceStation = data.Station.find(
          (row) =>
            n(row?.IdStation) === n(tempOrRealId)
        );

        if (!sourceStation) {
          continue;
        }

        const realId =
          savedIdMap.get(n(tempOrRealId)) ??
          n(tempOrRealId);

        const station =
          realId !== n(sourceStation.IdStation)
            ? remapStationId(
                deepClone(sourceStation),
                realId
              )
            : deepClone(sourceStation);

        const originalStation =
          normalizeRows(original?.Station).find(
            (row) =>
              n(row?.IdStation) ===
              n(tempOrRealId)
          ) ?? null;

        for (const block of BLOCKS) {
          if (
            block === "Station" ||
            !blockSet.has(block)
          ) {
            continue;
          }

          const deletedRows = getDeletedRows(
            originalStation,
            sourceStation,
            block
          );

          await postParams2Block(
            station,
            block,
            deletedRows
          );
        }
      }

      /*
       * После всех SAVE перечитываем Params2 целиком.
       * Так frontend получает окончательное состояние SQL.
       */
      const selectedBeforeReload =
        savedIdMap.get(n(selectedStationId)) ??
        selectedStationId;

      const response = await fetchWithAuth(
        `${BASE_URL}wf_Directory.php?Action=Params2`
      );

      const result = await readJsonResponse(
        response,
        t(
          "SystemParameters.Params2ReloadError",
          "Параметры сохранены, но не удалось перечитать данные"
        )
      );

      const normalized = normalizeParams2(result);
      setData(normalized);
      setOriginal(deepClone(normalized));

      setSelectedStationId(
        normalized.Station.some(
          (row) =>
            n(row?.IdStation) ===
            n(selectedBeforeReload)
        )
          ? selectedBeforeReload
          : normalized.Station[0]?.IdStation ?? null
      );

      setSaveState("saved");

      window.setTimeout(() => {
        setSaveState((current) =>
          current === "saved" ? "idle" : current
        );
      }, 2500);
    } catch (error) {
      setSaveState("idle");
      setSaveError(
        error?.message ||
          t(
            "SystemParameters.Params2SaveError",
            "Ошибка сохранения параметров станции"
          )
      );
    }
  }

  const selectedDirtyBlocks = useMemo(() => {
    if (!selectedStation) return [];

    return BLOCKS.filter((block) =>
      dirtyKeySet.has(
        `${n(selectedStation.IdStation)}:${block}`
      )
    );
  }, [dirtyKeySet, selectedStation]);

  const stationOptions = normalizeRows(data?.Station);
  const rejimOptions = Object.entries(
    data?.ListRejim ?? {}
  );

  const fiscalRows =
    normalizeRows(selectedStation?.Fiscal);
  const skladRows =
    normalizeRows(selectedStation?.Sklads);
  const cehRows =
    normalizeRows(selectedStation?.Cehs);

  if (loading) {
    return (
      <div
        className={[
          "system-params2",
          hidden ? "is-hidden" : ""
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="system-params2-loading">
          {t(
            "SystemParameters.Params2Loading",
            "Загрузка параметров станций..."
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={[
        "system-params2",
        hidden ? "is-hidden" : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {loadError && (
        <div className="login-error">
          {loadError}
        </div>
      )}

      {saveError && (
        <div className="login-error">
          {saveError}
        </div>
      )}

      {!loadError && (
        <>
          <div className="system-params2-toolbar">
            <div className="system-params2-station-tools">
              <label className="system-params2-station-select">
                <span>
                  {t(
                    "SystemParameters.Station",
                    "Станция"
                  )}
                </span>
                <select
                  value={String(
                    selectedStationId ?? ""
                  )}
                  onChange={(event) =>
                    setSelectedStationId(
                      n(event.target.value)
                    )
                  }
                >
                  {stationOptions.map((station) => (
                    <option
                      key={String(
                        station.IdStation
                      )}
                      value={String(
                        station.IdStation
                      )}
                    >
                      {station.NameStation ||
                        (n(station.IdStation) < 0
                          ? t(
                              "SystemParameters.NewStation",
                              "Новая станция"
                            )
                          : `#${station.IdStation}`)}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                className="system-param-mini-button system-param-add-station"
                disabled={readOnly}
                onClick={addStation}
              >
                +{" "}
                {t(
                  "SystemParameters.AddStation",
                  "Станция"
                )}
              </button>

              {n(selectedStation?.IdStation) < 0 && (
                <button
                  type="button"
                  className="system-param-cancel-new-station"
                  disabled={readOnly}
                  onClick={discardNewStation}
                >
                  {t(
                    "SystemParameters.CancelNewStation",
                    "Отменить новую"
                  )}
                </button>
              )}
            </div>

            <div className="system-params2-toolbar-right">
              {selectedDirtyBlocks.length > 0 && (
                <span className="system-params2-dirty-label">
                  {t(
                    "SystemParameters.ChangedBlocks",
                    "Изменено блоков"
                  )}
                  : {selectedDirtyBlocks.length}
                </span>
              )}

              <button
                type="button"
                className="primary-button system-parameters-save"
                disabled={
                  readOnly ||
                  !isDirty ||
                  saveState === "saving"
                }
                onClick={saveChangedBlocks}
              >
                {saveState === "saving"
                  ? t(
                      "SystemParameters.Saving",
                      "Сохранение..."
                    )
                  : t(
                      "SystemParameters.Save",
                      "Сохранить"
                    )}
              </button>

              {saveState === "saved" && (
                <span className="system-parameters-saved">
                  ✓{" "}
                  {t(
                    "Common.Saved",
                    "Сохранено"
                  )}
                </span>
              )}
            </div>
          </div>

          {readOnly && (
            <div className="system-parameters-readonly">
              {t(
                "SystemParameters.ReadOnly",
                "Параметры доступны только для просмотра."
              )}
            </div>
          )}

          {selectedStation ? (
            <div className="system-params2-layout">
              <section className="system-parameters-card system-params2-card-main">
                <h3>
                  {t(
                    "SystemParameters.StationMain",
                    "Основные параметры станции"
                  )}
                </h3>

                <div className="system-params2-main-grid">
                  <label className="system-params2-field">
                    <span>
                      {t(
                        "SystemParameters.StationName",
                        "Имя станции"
                      )}
                    </span>
                    <input
                      type="text"
                      value={
                        selectedStation.NameStation ??
                        ""
                      }
                      disabled={readOnly}
                      onChange={(event) =>
                        changeMain(
                          "NameStation",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label className="system-params2-field">
                    <span>
                      {t(
                        "SystemParameters.Mode",
                        "Режим"
                      )}
                    </span>
                    <select
                      value={String(
                        selectedStation.Rejim ?? 0
                      )}
                      disabled={readOnly}
                      onChange={(event) =>
                        changeMain(
                          "Rejim",
                          n(event.target.value)
                        )
                      }
                    >
                      {rejimOptions.map(
                        ([name, value]) => (
                          <option
                            key={String(value)}
                            value={String(value)}
                          >
                            {name}
                          </option>
                        )
                      )}
                    </select>
                  </label>

                  <label className="system-params2-field">
                    <span>
                      {t(
                        "SystemParameters.CashDesk",
                        "Касса"
                      )}
                    </span>
                    <select
                      value={String(
                        selectedStation.NomKass ??
                        ""
                      )}
                      disabled={readOnly}
                      onChange={(event) =>
                        changeMain(
                          "NomKass",
                          n(event.target.value)
                        )
                      }
                    >
                      {!normalizeRows(
                        data?.ListKass
                      ).some(
                        (item) =>
                          n(item?.CodeSt) ===
                          n(
                            selectedStation.NomKass
                          )
                      ) && (
                        <option
                          value={String(
                            selectedStation.NomKass ??
                              ""
                          )}
                        >
                          #{selectedStation.NomKass}
                        </option>
                      )}

                      {normalizeRows(
                        data?.ListKass
                      ).map((item) => (
                        <option
                          key={String(item.CodeSt)}
                          value={String(item.CodeSt)}
                        >
                          {item.NameKass ||
                            item.NameSt ||
                            `#${item.CodeSt}`}
                        </option>
                      ))}
                    </select>
                  </label>

                  {multiPoint && (
                    <label className="system-params2-field">
                      <span>Point</span>
                      <select
                        value={String(
                          selectedStation.Point ?? 0
                        )}
                        disabled={readOnly}
                        onChange={(event) =>
                          changeMain(
                            "Point",
                            n(event.target.value)
                          )
                        }
                      >
                        {normalizeRows(
                          data?.ListPoint
                        ).map((item) => (
                          <option
                            key={String(item.IdP)}
                            value={String(item.IdP)}
                          >
                            {item.NamePoint}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>

                <div className="system-params2-main-checks">
                  <Check
                    label={t(
                      "SystemParameters.PrintBill",
                      "Печать счета"
                    )}
                    checked={
                      selectedStation.PrintBill
                    }
                    disabled={readOnly}
                    onChange={(value) =>
                      changeMain(
                        "PrintBill",
                        value
                      )
                    }
                  />

                  <Check
                    label={t(
                      "SystemParameters.CloseReal",
                      "Закр"
                    )}
                    checked={
                      selectedStation.CloseReal
                    }
                    disabled={readOnly}
                    onChange={(value) =>
                      changeMain(
                        "CloseReal",
                        value
                      )
                    }
                  />
                </div>
              </section>

              <section className="system-parameters-card system-params2-card">
                <div className="system-params2-section-title">
                  <h3>
                    {t(
                      "SystemParameters.Departments",
                      "Подразделения"
                    )}
                  </h3>
                  <button
                    type="button"
                    className="system-param-mini-button"
                    disabled={readOnly}
                    onClick={addSklad}
                  >
                    +{" "}
                    {t(
                      "Common.Row",
                      "Строка"
                    )}
                  </button>
                </div>

                <div className="system-params2-table-wrap">
                  <table className="system-params2-table">
                    <thead>
                      <tr>
                        <th>
                          {t(
                            "SystemParameters.Department",
                            "Подразделение"
                          )}
                        </th>
                        <th className="check-col">
                          {t(
                            "SystemParameters.Selection",
                            "Выбор"
                          )}
                        </th>
                        <th className="action-col"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {skladRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan="3"
                            className="empty-cell"
                          >
                            —
                          </td>
                        </tr>
                      ) : (
                        skladRows.map((row, index) => (
                          <tr
                            key={String(
                              row.CodeS ??
                                `${row.CodeSkl}-${index}`
                            )}
                          >
                            <td>
                              <select
                                value={String(
                                  row.CodeSkl ?? 0
                                )}
                                disabled={readOnly}
                                onChange={(event) =>
                                  changeRow(
                                    "Sklads",
                                    index,
                                    "CodeSkl",
                                    n(
                                      event.target
                                        .value
                                    )
                                  )
                                }
                              >
                                {normalizeRows(
                                  sklads
                                ).map((item) => {
                                  const code = n(
                                    item?.ID ??
                                      item?.Code
                                  );

                                  return (
                                    <option
                                      key={String(code)}
                                      value={String(code)}
                                    >
                                      {item?.Name ??
                                        item?.NameSkl ??
                                        `#${code}`}
                                    </option>
                                  );
                                })}
                              </select>
                            </td>
                            <td className="center-cell">
                              <input
                                type="checkbox"
                                checked={Boolean(
                                  row.Multi
                                )}
                                disabled={readOnly}
                                onChange={(event) =>
                                  changeRow(
                                    "Sklads",
                                    index,
                                    "Multi",
                                    event.target
                                      .checked
                                  )
                                }
                              />
                            </td>
                            <td className="action-col">
                              <button
                                type="button"
                                className="system-param-delete-button"
                                disabled={readOnly}
                                onClick={() =>
                                  removeRow(
                                    "Sklads",
                                    index
                                  )
                                }
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="system-parameters-card system-params2-card">
                <div className="system-params2-section-title">
                  <h3>
                    {t(
                      "SystemParameters.Workshops",
                      "Цеха"
                    )}
                  </h3>
                  <button
                    type="button"
                    className="system-param-mini-button"
                    disabled={readOnly}
                    onClick={addCeh}
                  >
                    +{" "}
                    {t(
                      "Common.Row",
                      "Строка"
                    )}
                  </button>
                </div>

                <div className="system-params2-table-wrap">
                  <table className="system-params2-table">
                    <thead>
                      <tr>
                        <th>
                          {t(
                            "SystemParameters.Workshop",
                            "Цех"
                          )}
                        </th>
                        <th className="action-col"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {cehRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan="2"
                            className="empty-cell"
                          >
                            —
                          </td>
                        </tr>
                      ) : (
                        cehRows.map((row, index) => (
                          <tr
                            key={String(
                              row.CodeC ??
                                `${row.CodeCeh}-${index}`
                            )}
                          >
                            <td>
                              <select
                                value={String(
                                  row.CodeCeh ?? 0
                                )}
                                disabled={readOnly}
                                onChange={(event) =>
                                  changeRow(
                                    "Cehs",
                                    index,
                                    "CodeCeh",
                                    n(
                                      event.target
                                        .value
                                    )
                                  )
                                }
                              >
                                {normalizeRows(
                                  data?.ListCeh
                                ).map((item) => (
                                  <option
                                    key={String(
                                      item.ID
                                    )}
                                    value={String(
                                      item.ID
                                    )}
                                  >
                                    {item.Name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="action-col">
                              <button
                                type="button"
                                className="system-param-delete-button"
                                disabled={readOnly}
                                onClick={() =>
                                  removeRow(
                                    "Cehs",
                                    index
                                  )
                                }
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="system-parameters-card system-params2-card-fiscal">
                <div className="system-params2-section-title">
                  <h3>
                    {t(
                      "SystemParameters.FiscalPrinter",
                      "Для фискального принтера"
                    )}
                  </h3>
                  <button
                    type="button"
                    className="system-param-mini-button"
                    disabled={readOnly}
                    onClick={addFiscal}
                  >
                    +{" "}
                    {t(
                      "Common.Row",
                      "Строка"
                    )}
                  </button>
                </div>

                <div className="system-params2-table-wrap">
                  <table className="system-params2-table fiscal">
                    <thead>
                      <tr>
                        <th>
                          {t(
                            "SystemParameters.Company",
                            "Предприятие"
                          )}
                        </th>
                        <th className="check-col">
                          {t(
                            "SystemParameters.Switch",
                            "Перекл"
                          )}
                        </th>
                        <th className="check-col">
                          Local
                        </th>
                        <th>
                          {t(
                            "SystemParameters.Port",
                            "Порт"
                          )}
                        </th>
                        <th>
                          {t(
                            "SystemParameters.Destination",
                            "Куда"
                          )}
                        </th>
                        <th>
                          {t(
                            "SystemParameters.Type",
                            "Тип"
                          )}
                        </th>
                        <th className="action-col"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {fiscalRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan="7"
                            className="empty-cell"
                          >
                            —
                          </td>
                        </tr>
                      ) : (
                        fiscalRows.map((row, index) => {
                          const localKey =
                            row.FPlocal ? "1" : "0";
                          const kudaOptions =
                            fiscalKuda[localKey] ?? [];
                          const currentKuda =
                            n(row.NomFP);
                          const hasCurrent =
                            kudaOptions.some(
                              (item) =>
                                optionValue(item) ===
                                currentKuda
                            );

                          return (
                            <tr
                              key={String(
                                row.CodeFP ?? index
                              )}
                            >
                              <td>
                                <select
                                  value={String(
                                    row.CodeFOP ?? 0
                                  )}
                                  disabled={readOnly}
                                  onChange={(event) =>
                                    changeRow(
                                      "Fiscal",
                                      index,
                                      "CodeFOP",
                                      n(
                                        event.target
                                          .value
                                      )
                                    )
                                  }
                                >
                                  {normalizeRows(
                                    data?.ListFOP
                                  ).map((item) => (
                                    <option
                                      key={String(
                                        item.ID
                                      )}
                                      value={String(
                                        item.ID
                                      )}
                                    >
                                      {item.NAME}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              <td className="center-cell">
                                <input
                                  type="checkbox"
                                  checked={Boolean(
                                    row.Perekl
                                  )}
                                  disabled={readOnly}
                                  onChange={(event) =>
                                    changeRow(
                                      "Fiscal",
                                      index,
                                      "Perekl",
                                      event.target
                                        .checked
                                    )
                                  }
                                />
                              </td>

                              <td className="center-cell">
                                <input
                                  type="checkbox"
                                  checked={Boolean(
                                    row.FPlocal
                                  )}
                                  disabled={readOnly}
                                  onChange={(event) => {
                                    const value =
                                      event.target
                                        .checked;
                                    changeRow(
                                      "Fiscal",
                                      index,
                                      "FPlocal",
                                      value
                                    );
                                    changeRow(
                                      "Fiscal",
                                      index,
                                      "NomFP",
                                      0
                                    );
                                    loadFiscalKuda(
                                      value
                                    );
                                  }}
                                />
                              </td>

                              <td>
                                <input
                                  type="text"
                                  value={
                                    row.PortFP ?? ""
                                  }
                                  disabled={readOnly}
                                  onChange={(event) =>
                                    changeRow(
                                      "Fiscal",
                                      index,
                                      "PortFP",
                                      event.target
                                        .value
                                    )
                                  }
                                />
                              </td>

                              <td>
                                <select
                                  value={String(
                                    currentKuda
                                  )}
                                  disabled={
                                    readOnly ||
                                    Boolean(
                                      fiscalKudaLoading[
                                        localKey
                                      ]
                                    )
                                  }
                                  onFocus={() =>
                                    loadFiscalKuda(
                                      Boolean(
                                        row.FPlocal
                                      )
                                    )
                                  }
                                  onChange={(event) =>
                                    changeRow(
                                      "Fiscal",
                                      index,
                                      "NomFP",
                                      n(
                                        event.target
                                          .value
                                      )
                                    )
                                  }
                                >
                                  {!hasCurrent &&
                                    currentKuda !== 0 && (
                                      <option
                                        value={String(
                                          currentKuda
                                        )}
                                      >
                                        #{currentKuda}
                                      </option>
                                    )}

                                  <option value="0">
                                    —
                                  </option>

                                  {kudaOptions.map(
                                    (item, optionIndex) => {
                                      const value =
                                        optionValue(
                                          item
                                        );

                                      return (
                                        <option
                                          key={`${value}-${optionIndex}`}
                                          value={String(
                                            value
                                          )}
                                        >
                                          {optionLabel(
                                            item
                                          )}
                                        </option>
                                      );
                                    }
                                  )}
                                </select>
                              </td>

                              <td>
                                <select
                                  value={String(
                                    row.FPtype ?? 200
                                  )}
                                  disabled={readOnly}
                                  onChange={(event) =>
                                    changeRow(
                                      "Fiscal",
                                      index,
                                      "FPtype",
                                      n(
                                        event.target
                                          .value
                                      )
                                    )
                                  }
                                >
                                  {normalizeRows(
                                    data?.ListTipFP
                                  ).map((item) => (
                                    <option
                                      key={String(
                                        item.FPtype
                                      )}
                                      value={String(
                                        item.FPtype
                                      )}
                                    >
                                      {item.Name}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              <td className="action-col">
                                <button
                                  type="button"
                                  className="system-param-delete-button"
                                  disabled={readOnly}
                                  onClick={() =>
                                    removeRow(
                                      "Fiscal",
                                      index
                                    )
                                  }
                                >
                                  ×
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="system-parameters-card system-params2-card-items">
                <h3>
                  {t(
                    "SystemParameters.StationParameters",
                    "Параметры станции"
                  )}
                </h3>

                <div className="system-params2-items-top">
                  <label className="system-params2-field">
                    <span>
                      {t(
                        "SystemParameters.FrontOfficeLanguage",
                        "Язык фронтофиса"
                      )}
                    </span>
                    <select
                      value={String(
                        selectedStation.Items
                          ?.LangF ?? 1
                      )}
                      disabled={readOnly}
                      onChange={(event) =>
                        changeItems(
                          "LangF",
                          n(event.target.value)
                        )
                      }
                    >
                      {normalizeRows(
                        data?.ListLang
                      ).map((item) => (
                        <option
                          key={String(item.id)}
                          value={String(item.id)}
                        >
                          {item.Name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="system-params2-field">
                    <span>
                      {t(
                        "SystemParameters.CashDeskName",
                        "Имя кассы"
                      )}
                    </span>
                    <input
                      type="text"
                      value={
                        selectedStation.Items
                          ?.NameKass ?? ""
                      }
                      disabled={readOnly}
                      onChange={(event) =>
                        changeItems(
                          "NameKass",
                          event.target.value
                        )
                      }
                    />
                  </label>
                </div>

                <div className="system-params2-items-checks">
                  {[
                    [
                      "VhV",
                      t(
                        "SystemParameters.EntryExit",
                        "Вход/вых"
                      )
                    ],
                    [
                      "ShKod",
                      t(
                        "SystemParameters.Barcode",
                        "Штрих-код"
                      )
                    ],
                    ["Cl", "Cloud"],
                    [
                      "HappyH",
                      t(
                        "SystemParameters.HourlyBill",
                        "Сч.часы"
                      )
                    ],
                    [
                      "A_Guests",
                      t(
                        "SystemParameters.GuestRequest",
                        "Запрос гостей"
                      )
                    ],
                    [
                      "A_KassServ",
                      t(
                        "SystemParameters.MobilePrintServer",
                        "Моб.сервер печати"
                      )
                    ],
                    [
                      "A_Deliv",
                      t(
                        "SystemParameters.DeliveryApi",
                        "Доставка API"
                      )
                    ],
                    ["MonoServ", "Mono Server"],
                    ["CallCentre", "Call centre"],
                    [
                      "A_Elorder",
                      t(
                        "SystemParameters.KitchenScreen",
                        "Кух.экран"
                      )
                    ],
                    [
                      "A_Resize",
                      t(
                        "SystemParameters.Scaling",
                        "Масштабир."
                      )
                    ],
                    [
                      "A_CopySch",
                      t(
                        "SystemParameters.BillCopy",
                        "Копия счета"
                      )
                    ],
                    [
                      "A_SkrBan",
                      t(
                        "SystemParameters.HideBanquet",
                        "Скр.банкет"
                      )
                    ],
                    [
                      "A_Vhod",
                      t(
                        "SystemParameters.GuestPhoto",
                        "Фото гостя"
                      )
                    ],
                    [
                      "A_QuitAll",
                      t(
                        "SystemParameters.ExitSystem",
                        "Выход в сист."
                      )
                    ],
                    [
                      "A_ViruchkaKass",
                      t(
                        "SystemParameters.CurrentCashRevenue",
                        "Выручка текущ.кассы"
                      )
                    ],
                    [
                      "DublBeg",
                      t(
                        "SystemParameters.RunnerCopy",
                        "Копия бегунка"
                      )
                    ]
                  ].map(([field, label]) => (
                    <Check
                      key={field}
                      label={label}
                      checked={
                        selectedStation.Items?.[
                          field
                        ]
                      }
                      disabled={readOnly}
                      onChange={(value) =>
                        changeItems(field, value)
                      }
                    />
                  ))}
                </div>
              </section>

              <section className="system-parameters-card system-params2-card-actions">
                <h3>
                  {t(
                    "SystemParameters.Additional",
                    "Дополнительно"
                  )}
                </h3>

                <div className="system-params2-action-buttons">
                  <button
                    type="button"
                    className="system-param-action-button"
                    onClick={() =>
                      setBankTermOpen(true)
                    }
                  >
                    {t(
                      "SystemParameters.BankTerminals",
                      "Банковские терминалы"
                    )}
                    <span>
                      {normalizeRows(
                        selectedStation.BankTerm
                      ).length}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="system-param-action-button"
                    onClick={() => setZalOpen(true)}
                  >
                    {t(
                      "SystemParameters.AvailableHalls",
                      "Доступные залы"
                    )}
                    <span>
                      {normalizeRows(
                        selectedStation.Zal
                      ).length}
                    </span>
                  </button>
                </div>
              </section>
            </div>
          ) : (
            <div className="system-params2-empty">
              {t(
                "SystemParameters.NoStations",
                "Станции отсутствуют."
              )}
            </div>
          )}
        </>
      )}

      {bankTermOpen && selectedStation && (
        <Modal
          title={t(
            "SystemParameters.BankTerminals",
            "Банковские терминалы"
          )}
          onClose={() =>
            setBankTermOpen(false)
          }
        >
          <div className="system-param-modal-toolbar">
            <button
              type="button"
              className="system-param-mini-button"
              disabled={readOnly}
              onClick={addBankTerm}
            >
              +{" "}
              {t(
                "Common.Row",
                "Строка"
              )}
            </button>
          </div>

          <div className="system-params2-table-wrap modal-table">
            <table className="system-params2-table bank-term">
              <thead>
                <tr>
                  <th>
                    {t(
                      "SystemParameters.Company",
                      "Предприятие"
                    )}
                  </th>
                  <th>Typ conn.</th>
                  <th>IP or ID</th>
                  <th>Port</th>
                  <th>COM port</th>
                  <th>Speed</th>
                  <th>Protocol</th>
                  <th>Merch ID</th>
                  <th className="check-col">
                    {t(
                      "SystemParameters.Use",
                      "Исп."
                    )}
                  </th>
                  <th className="action-col"></th>
                </tr>
              </thead>
              <tbody>
                {normalizeRows(
                  selectedStation.BankTerm
                ).length === 0 ? (
                  <tr>
                    <td
                      colSpan="10"
                      className="empty-cell"
                    >
                      —
                    </td>
                  </tr>
                ) : (
                  normalizeRows(
                    selectedStation.BankTerm
                  ).map((row, index) => (
                    <tr
                      key={String(
                        row.CodeBT ?? index
                      )}
                    >
                      <td>
                        <select
                          value={String(
                            row.CodeFOP ?? 0
                          )}
                          disabled={readOnly}
                          onChange={(event) =>
                            changeRow(
                              "BankTerm",
                              index,
                              "CodeFOP",
                              n(
                                event.target.value
                              )
                            )
                          }
                        >
                          {normalizeRows(
                            data?.ListFOP
                          ).map((item) => (
                            <option
                              key={String(item.ID)}
                              value={String(item.ID)}
                            >
                              {item.NAME}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td>
                        <select
                          value={String(
                            row.Typ ?? 1
                          )}
                          disabled={readOnly}
                          onChange={(event) =>
                            changeRow(
                              "BankTerm",
                              index,
                              "Typ",
                              n(
                                event.target.value
                              )
                            )
                          }
                        >
                          {CONNECTION_TYPES.map(
                            (item) => (
                              <option
                                key={item.id}
                                value={item.id}
                              >
                                {item.Name}
                              </option>
                            )
                          )}
                        </select>
                      </td>

                      <td>
                        <input
                          type="text"
                          value={row.sIP ?? ""}
                          disabled={readOnly}
                          onChange={(event) =>
                            changeRow(
                              "BankTerm",
                              index,
                              "sIP",
                              event.target.value
                            )
                          }
                        />
                      </td>

                      <td>
                        <input
                          type="text"
                          value={row.sPort ?? ""}
                          disabled={readOnly}
                          onChange={(event) =>
                            changeRow(
                              "BankTerm",
                              index,
                              "sPort",
                              event.target.value
                            )
                          }
                        />
                      </td>

                      <td>
                        <input
                          type="number"
                          value={row.Port ?? 0}
                          disabled={readOnly}
                          onChange={(event) =>
                            changeRow(
                              "BankTerm",
                              index,
                              "Port",
                              n(
                                event.target.value
                              )
                            )
                          }
                        />
                      </td>

                      <td>
                        <select
                          value={String(
                            row.BaudRate ??
                              115200
                          )}
                          disabled={readOnly}
                          onChange={(event) =>
                            changeRow(
                              "BankTerm",
                              index,
                              "BaudRate",
                              n(
                                event.target.value
                              )
                            )
                          }
                        >
                          {SPEED_OPTIONS.map(
                            (speed) => (
                              <option
                                key={speed}
                                value={speed}
                              >
                                {speed}
                              </option>
                            )
                          )}
                        </select>
                      </td>

                      <td>
                        <select
                          value={String(
                            row.TypTerm ?? 1
                          )}
                          disabled={readOnly}
                          onChange={(event) =>
                            changeRow(
                              "BankTerm",
                              index,
                              "TypTerm",
                              n(
                                event.target.value
                              )
                            )
                          }
                        >
                          {PROTOCOL_TYPES.map(
                            (item) => (
                              <option
                                key={item.id}
                                value={item.id}
                              >
                                {item.Name}
                              </option>
                            )
                          )}
                        </select>
                      </td>

                      <td>
                        <input
                          type="text"
                          value={
                            row.MerchId ?? ""
                          }
                          disabled={readOnly}
                          onChange={(event) =>
                            changeRow(
                              "BankTerm",
                              index,
                              "MerchId",
                              event.target.value
                            )
                          }
                        />
                      </td>

                      <td className="center-cell">
                        <input
                          type="checkbox"
                          checked={Boolean(
                            row.UseBT
                          )}
                          disabled={readOnly}
                          onChange={(event) =>
                            changeRow(
                              "BankTerm",
                              index,
                              "UseBT",
                              event.target.checked
                            )
                          }
                        />
                      </td>

                      <td className="action-col">
                        <button
                          type="button"
                          className="system-param-delete-button"
                          disabled={readOnly}
                          onClick={() =>
                            removeRow(
                              "BankTerm",
                              index
                            )
                          }
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {zalOpen && selectedStation && (
        <Modal
          title={t(
            "SystemParameters.AvailableHalls",
            "Доступные залы"
          )}
          onClose={() => setZalOpen(false)}
        >
          <div className="system-param-modal-toolbar">
            <button
              type="button"
              className="system-param-mini-button"
              disabled={readOnly}
              onClick={addZal}
            >
              +{" "}
              {t(
                "Common.Row",
                "Строка"
              )}
            </button>
          </div>

          <div className="system-param-zal-list">
            {normalizeRows(
              selectedStation.Zal
            ).length === 0 ? (
              <div className="system-params2-empty">
                —
              </div>
            ) : (
              normalizeRows(
                selectedStation.Zal
              ).map((row, index) => (
                <div
                  className="system-param-zal-row"
                  key={`${row.CodeZ}-${index}`}
                >
                  <select
                    value={String(
                      row.CodeZ ?? 0
                    )}
                    disabled={readOnly}
                    onChange={(event) =>
                      changeRow(
                        "Zal",
                        index,
                        "CodeZ",
                        n(event.target.value)
                      )
                    }
                  >
                    {normalizeRows(
                      data?.ListZal
                    ).map((item) => (
                      <option
                        key={String(item.Code)}
                        value={String(
                          item.Code
                        )}
                      >
                        {item.Name}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    className="system-param-delete-button"
                    disabled={readOnly}
                    onClick={() =>
                      removeRow(
                        "Zal",
                        index
                      )
                    }
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
