import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

function normalizeBoolean(value) {
  if (value === true || value === 1) return true;

  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function serializeFieldValue(value, type) {
  if (type === "boolean") {
    return normalizeBoolean(value) ? "1" : "0";
  }

  return String(value ?? "");
}

function comparableValue(value, type) {
  if (type === "boolean") {
    return normalizeBoolean(value);
  }

  return String(value ?? "");
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

function getColumnOptions(column, lookupData, sourceRows = []) {
  if (column?.optionsFromRows) {
    return Array.isArray(sourceRows) ? sourceRows : [];
  }

  if (Array.isArray(column?.options)) {
    return column.options;
  }

  return Array.isArray(lookupData?.[column?.field])
    ? lookupData[column.field]
    : [];
}

function makeStoredKey(id, index) {
  return `stored:${String(id ?? "")}:${index}`;
}

function DirectorySearchSelect({
  value,
  options = [],
  column,
  editable,
  onChange,
  onFocusRow,
  t
}) {
  const valueField = column.optionValueField || "ID";
  const labelField = column.optionLabelField || "Name";
  const secondaryField = column.optionSecondaryField || "";
  const hasEmptyOption =
    column.emptyOptionValue !== undefined &&
    column.emptyOptionValue !== null;
  const emptyValue = hasEmptyOption ? String(column.emptyOptionValue) : "";
  const emptyLabel =
    column.emptyOptionLabel ??
    t(column.emptyOptionLabelKey, "");

  const normalizedOptions = useMemo(() => {
    const source = Array.isArray(options) ? options : [];

    if (
      hasEmptyOption &&
      !source.some(
        (option) => String(option?.[valueField] ?? "") === emptyValue
      )
    ) {
      return [
        {
          [valueField]: column.emptyOptionValue,
          [labelField]: emptyLabel
        },
        ...source
      ];
    }

    return source;
  }, [
    options,
    hasEmptyOption,
    emptyValue,
    emptyLabel,
    valueField,
    labelField,
    column.emptyOptionValue
  ]);

  const currentValue = String(value ?? "");
  const selectedOption = normalizedOptions.find(
    (option) => String(option?.[valueField] ?? "") === currentValue
  );
  const selectedLabel = String(
    selectedOption?.[labelField] ??
      (hasEmptyOption ? emptyLabel : "")
  );

  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [menuStyle, setMenuStyle] = useState(null);

  const inputRef = useRef(null);
  const closeTimerRef = useRef(null);

  const filteredOptions = useMemo(() => {
    const needle = searchText.trim().toLocaleLowerCase();

    const filtered = needle
      ? normalizedOptions.filter((option) => {
          const label = String(option?.[labelField] ?? "").toLocaleLowerCase();
          const secondary = secondaryField
            ? String(option?.[secondaryField] ?? "").toLocaleLowerCase()
            : "";

          return label.includes(needle) || secondary.includes(needle);
        })
      : normalizedOptions;

    return filtered.slice(0, 80);
  }, [normalizedOptions, searchText, labelField, secondaryField]);

  function updateMenuPosition() {
    const input = inputRef.current;

    if (!input) {
      return;
    }

    const rect = input.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const desiredWidth = Math.max(rect.width, 320);
    const width = Math.min(desiredWidth, Math.max(220, viewportWidth - 16));
    const left = Math.min(
      Math.max(8, rect.left),
      Math.max(8, viewportWidth - width - 8)
    );

    const spaceBelow = viewportHeight - rect.bottom - 10;
    const spaceAbove = rect.top - 10;
    const openAbove = spaceBelow < 170 && spaceAbove > spaceBelow;
    const availableSpace = openAbove ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(120, Math.min(280, availableSpace - 4));

    setMenuStyle({
      position: "fixed",
      zIndex: 10000,
      left,
      width,
      maxHeight,
      ...(openAbove
        ? {
            top: "auto",
            bottom: viewportHeight - rect.top + 3
          }
        : {
            top: rect.bottom + 3,
            bottom: "auto"
          })
    });
  }

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    updateMenuPosition();

    const handleViewportChange = () => updateMenuPosition();

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  if (!editable) {
    if (!selectedOption) {
      return selectedLabel;
    }

    const secondary = secondaryField
      ? String(selectedOption?.[secondaryField] ?? "")
      : "";

    return (
      <span className="directory-search-readonly">
        <span>{selectedLabel}</span>
        {secondary && (
          <span className="directory-search-secondary"> · {secondary}</span>
        )}
      </span>
    );
  }

  function selectOption(option) {
    const nextValue = option?.[valueField] ?? "";
    onChange(String(nextValue));
    setSearchText("");
    setIsOpen(false);
  }

  const dropdown =
    isOpen &&
    menuStyle &&
    typeof document !== "undefined"
      ? createPortal(
          <div
            className="directory-search-list directory-search-list-portal"
            style={menuStyle}
            onMouseDown={(event) => event.preventDefault()}
          >
            {filteredOptions.length === 0 ? (
              <div className="directory-search-empty">
                {t("Directory.NothingFound", "Ничего не найдено")}
              </div>
            ) : (
              filteredOptions.map((option, optionIndex) => {
                const optionValue = option?.[valueField] ?? "";
                const optionLabel = String(option?.[labelField] ?? optionValue);
                const optionSecondary = secondaryField
                  ? String(option?.[secondaryField] ?? "")
                  : "";
                const isCurrent =
                  String(optionValue) === String(currentValue);

                return (
                  <button
                    type="button"
                    key={`${String(optionValue)}:${optionIndex}`}
                    className={`directory-search-option${isCurrent ? " selected" : ""}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectOption(option)}
                  >
                    <span className="directory-search-option-name">
                      {optionLabel}
                    </span>
                    {optionSecondary && (
                      <span className="directory-search-option-secondary">
                        {optionSecondary}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div
        className="directory-search-select"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="text"
          className="directory-search-input"
          value={isOpen ? searchText : selectedLabel}
          placeholder={t("Directory.Search", "Поиск...")}
          onFocus={(event) => {
            onFocusRow?.();
            setSearchText("");
            setIsOpen(true);
            window.requestAnimationFrame(updateMenuPosition);
            event.currentTarget.select();
          }}
          onChange={(event) => {
            setSearchText(event.target.value);
            setIsOpen(true);
            window.requestAnimationFrame(updateMenuPosition);
          }}
          onBlur={() => {
            closeTimerRef.current = window.setTimeout(() => {
              setIsOpen(false);
              setSearchText("");
            }, 140);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setIsOpen(false);
              setSearchText("");
              event.currentTarget.blur();
            }
          }}
        />
      </div>

      {dropdown}
    </>
  );
}

export default function DirectoryPage({
  data,
  config,
  lookupData = {},
  context = {},
  readOnly = true,
  selectedId = null,
  onSelectedIdChange,
  toolbarActions = [],
  onSave,
  onDirtyChange,
  t = (key, fallback = "") => fallback
}) {
  const idField = config?.idField || "ID";
  const columns = useMemo(
    () => (Array.isArray(config?.columns) ? config.columns.filter((column) => column?.field) : []),
    [config]
  );

  const visibleColumns = useMemo(
    () =>
      columns.filter((column) => {
        if (typeof column?.hidden === "function") {
          return !column.hidden({ context });
        }

        return !column.hidden;
      }),
    [columns, context]
  );

  const normalizedToolbarActions = Array.isArray(toolbarActions)
    ? toolbarActions.filter(Boolean)
    : [];

  function isColumnEditable(column, row) {
    if (readOnly) return false;

    if (typeof column?.editable === "function") {
      return column.editable({ row, context }) !== false;
    }

    return column?.editable !== false;
  }

  function getColumnDefaultValue(column) {
    if (column?.defaultFromContext) {
      const contextValue = context?.[column.defaultFromContext];

      if (contextValue !== null && contextValue !== undefined) {
        return contextValue;
      }
    }

    return column?.defaultValue;
  }

  const [rows, setRows] = useState([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [changedKeys, setChangedKeys] = useState(() => new Set());
  const [deletedIds, setDeletedIds] = useState([]);
  const [saveState, setSaveState] = useState("idle");
  const [filterValue, setFilterValue] = useState(
    config?.filter?.defaultValue ?? ""
  );

  const originalRowsRef = useRef(new Map());
  const newRowCounterRef = useRef(0);
  const firstEditableInputRef = useRef(null);
  const savedTimerRef = useRef(null);

  useEffect(() => {
    const sourceRows = Array.isArray(data) ? data : [];
    const originals = new Map();

    const nextRows = sourceRows.map((row, index) => {
      const rowKey = makeStoredKey(row?.[idField], index);
      const normalizedRow = {
        ...row,
        __rowKey: rowKey,
        __isNew: false
      };

      originals.set(rowKey, { ...row });
      return normalizedRow;
    });

    originalRowsRef.current = originals;
    setRows(nextRows);

    const requestedId =
      selectedId === null || selectedId === undefined
        ? ""
        : String(selectedId);
    const requestedRow = requestedId
      ? nextRows.find(
          (row) => String(row?.[idField] ?? "") === requestedId
        )
      : null;

    setSelectedKey(requestedRow?.__rowKey ?? "");
    setChangedKeys(new Set());
    setDeletedIds([]);
    setSaveState("idle");
    newRowCounterRef.current = 0;
  }, [data, idField]);

  useEffect(() => {
    setFilterValue(config?.filter?.defaultValue ?? "");
  }, [config?.apiAction]);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) {
        window.clearTimeout(savedTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (selectedId === null || selectedId === undefined || selectedId === "") {
      return;
    }

    const selectedRow = rows.find(
      (row) => String(row?.[idField] ?? "") === String(selectedId)
    );

    if (selectedRow && selectedRow.__rowKey !== selectedKey) {
      setSelectedKey(selectedRow.__rowKey);
    }
  }, [selectedId, rows, idField, selectedKey]);

  const hasChanges = useMemo(
    () => rows.some((row) => row.__isNew) || changedKeys.size > 0 || deletedIds.length > 0,
    [rows, changedKeys, deletedIds]
  );

  const displayedRows = useMemo(() => {
    const filter = config?.filter;

    if (!filter?.field || !Array.isArray(filter.options)) {
      return rows;
    }

    const selectedOption = filter.options.find(
      (option) => String(option?.value ?? "") === String(filterValue ?? "")
    );

    if (!selectedOption || selectedOption.mode === "all") {
      return rows;
    }

    if (selectedOption.mode === "boolean-true") {
      return rows.filter((row) => normalizeBoolean(row?.[filter.field]));
    }

    if (selectedOption.mode === "boolean-false") {
      return rows.filter((row) => !normalizeBoolean(row?.[filter.field]));
    }

    return rows;
  }, [rows, config, filterValue]);

  useEffect(() => {
    onDirtyChange?.(hasChanges);

    if (hasChanges && saveState === "saved") {
      setSaveState("idle");
    }
  }, [hasChanges, onDirtyChange, saveState]);

  function isRowChanged(row) {
    if (row.__isNew) return true;

    const original = originalRowsRef.current.get(row.__rowKey);
    if (!original) return true;

    return columns.some((column) => {
      return (
        comparableValue(row?.[column.field], column.type) !==
        comparableValue(original?.[column.field], column.type)
      );
    });
  }

  function updateRow(rowKey, field, value) {
    const currentRow = rows.find((row) => row.__rowKey === rowKey);

    if (!currentRow) return;

    const nextRow = { ...currentRow, [field]: value };

    setRows((prevRows) =>
      prevRows.map((row) => (row.__rowKey === rowKey ? nextRow : row))
    );

    setChangedKeys((prevKeys) => {
      const nextKeys = new Set(prevKeys);

      if (nextRow.__isNew || isRowChanged(nextRow)) {
        nextKeys.add(rowKey);
      } else {
        nextKeys.delete(rowKey);
      }

      return nextKeys;
    });
  }

  function addRow() {
    if (readOnly || config?.canAdd === false) return;

    newRowCounterRef.current += 1;
    const temporaryId = -newRowCounterRef.current;
    const rowKey = `new:${temporaryId}`;
    const newRow = {
      [idField]: temporaryId,
      __rowKey: rowKey,
      __isNew: true
    };

    columns.forEach((column) => {
      if (column.type === "boolean") {
        newRow[column.field] = getColumnDefaultValue(column) ?? false;
        return;
      }

      if (column.type === "select" || column.type === "search-select") {
        const options = getColumnOptions(column, lookupData, rows);
        const valueField = column.optionValueField || "ID";

        newRow[column.field] =
          getColumnDefaultValue(column) ??
          column.emptyOptionValue ??
          options[0]?.[valueField] ??
          "";
        return;
      }

      if (column.type === "nullable-number") {
        const defaultValue = getColumnDefaultValue(column);
        newRow[column.field] =
          defaultValue === undefined ? null : defaultValue;
        return;
      }

      if (
        column.type === "number" ||
        column.type === "time" ||
        column.type === "date"
      ) {
        newRow[column.field] = getColumnDefaultValue(column) ?? "";
        return;
      }

      newRow[column.field] = getColumnDefaultValue(column) ?? "";
    });

    setRows((prevRows) => [newRow, ...prevRows]);
    setChangedKeys((prevKeys) => {
      const nextKeys = new Set(prevKeys);
      nextKeys.add(rowKey);
      return nextKeys;
    });
    setSelectedKey(rowKey);
    onSelectedIdChange?.(temporaryId, newRow);
    setSaveState("idle");

    window.setTimeout(() => {
      firstEditableInputRef.current?.focus();
      firstEditableInputRef.current?.select?.();
    }, 0);
  }

  function deleteRow(row) {
    if (readOnly || config?.canDelete === false) return;

    const rowKey = row.__rowKey;

    if (!row.__isNew) {
      const id = row?.[idField];

      if (id !== null && id !== undefined && String(id) !== "") {
        setDeletedIds((prevIds) => {
          const value = String(id);
          return prevIds.some((item) => String(item) === value)
            ? prevIds
            : [...prevIds, id];
        });
      }
    }

    setRows((prevRows) => prevRows.filter((item) => item.__rowKey !== rowKey));
    setChangedKeys((prevKeys) => {
      const nextKeys = new Set(prevKeys);
      nextKeys.delete(rowKey);
      return nextKeys;
    });

    if (selectedKey === rowKey) {
      setSelectedKey("");
      onSelectedIdChange?.(null, null);
    }

    setSaveState("idle");
  }

  function buildSaveXml() {
    const deletedSection = config?.deletedSection || "Deleted";
    const changedRows = rows.filter(
      (row) => row.__isNew || changedKeys.has(row.__rowKey)
    );

    function serializeRowField(row, fieldName) {
      if (fieldName === idField) {
        return escapeXml(row?.[idField]);
      }

      const column = columns.find((item) => item.field === fieldName);
      const defaultValue = getColumnDefaultValue(column);
      const rawValue =
        row?.[fieldName] !== null && row?.[fieldName] !== undefined
          ? row[fieldName]
          : defaultValue ?? "";
      const value = serializeFieldValue(rawValue, column?.type);
      return escapeXml(value);
    }

    const xmlGroups = Array.isArray(config?.xmlGroups)
      ? config.xmlGroups.filter(
          (group) => group?.section && Array.isArray(group.fields)
        )
      : [];

    if (xmlGroups.length > 0) {
      const xmlRoot = config?.xmlRoot || config?.apiAction || "Directory";
      const normalizedApiAction = String(config?.apiAction ?? "")
        .trim()
        .toLowerCase();

      const optionalSupplementalSections =
        ["personal", "clients", "postav"].includes(normalizedApiAction)
          ? new Set(["cardspdop", "cardssald"])
          : new Set();

      function getSupplementalContentFields(group) {
        const section = String(group?.section ?? "")
          .trim()
          .toLowerCase();

        if (!optionalSupplementalSections.has(section)) {
          return null;
        }

        return group.fields.filter((fieldName) => {
          if (fieldName === idField) {
            return false;
          }

          // CardsSald: org identifies the organization, but by itself
          // does not mean that a supplemental row has useful data.
          if (section === "cardssald" && fieldName === "org") {
            return false;
          }

          return true;
        });
      }

      function isSupplementalFieldEmpty(row, fieldName) {
        const column = columns.find((item) => item.field === fieldName);
        const defaultValue = getColumnDefaultValue(column);
        const rawValue =
          row?.[fieldName] !== null && row?.[fieldName] !== undefined
            ? row[fieldName]
            : defaultValue ?? "";

        if (column?.type === "boolean") {
          return !normalizeBoolean(rawValue);
        }

        if (column?.type === "nullable-number") {
          return (
            rawValue === null ||
            rawValue === undefined ||
            String(rawValue).trim() === ""
          );
        }

        return String(rawValue ?? "").trim() === "";
      }

      function supplementalFieldChanged(row, fieldName) {
        if (row.__isNew) {
          return false;
        }

        const original = originalRowsRef.current.get(row.__rowKey);

        if (!original) {
          return false;
        }

        const column = columns.find((item) => item.field === fieldName);

        return (
          comparableValue(row?.[fieldName], column?.type) !==
          comparableValue(original?.[fieldName], column?.type)
        );
      }

      function shouldSerializeGroupRow(row, group) {
        const contentFields = getSupplementalContentFields(group);

        // Main sections and all other directory sections keep the old behavior.
        if (!contentFields) {
          return true;
        }

        // A supplemental row is needed when it currently contains real data.
        if (
          contentFields.some(
            (fieldName) => !isSupplementalFieldEmpty(row, fieldName)
          )
        ) {
          return true;
        }

        // Existing rows must still be sent when a user cleared supplemental
        // fields, otherwise the old values would remain in SQL Server.
        if (
          !row.__isNew &&
          contentFields.some((fieldName) =>
            supplementalFieldChanged(row, fieldName)
          )
        ) {
          return true;
        }

        // New row + completely empty supplemental data:
        // do not send CardsPDop/CardsSald with a temporary negative ID.
        return false;
      }

      let body = `<${xmlRoot}>`;

      xmlGroups.forEach((group) => {
        const groupRows = changedRows.filter((row) =>
          shouldSerializeGroupRow(row, group)
        );

        // If an optional supplemental block has no rows, omit the whole block.
        if (groupRows.length === 0) {
          return;
        }

        body += `<${group.section}>`;

        groupRows.forEach((row) => {
          body += "<row>";

          group.fields.forEach((fieldName) => {
            body += `<${fieldName}>${serializeRowField(
              row,
              fieldName
            )}</${fieldName}>`;
          });

          body += "</row>";
        });

        body += `</${group.section}>`;
      });

      body += `</${xmlRoot}>`;

      if (config?.wrapInRef === false) {
        return body;
      }

      return `<Ref>${body}</Ref>`;
    }

    const xmlSection = config?.xmlSection || config?.apiAction || "Directory";
    let xml = `<Ref><${xmlSection}>`;

    const xmlFields =
      Array.isArray(config?.xmlFields) && config.xmlFields.length > 0
        ? config.xmlFields
        : [
            idField,
            ...columns
              .map((column) => column.field)
              .filter((fieldName) => fieldName && fieldName !== idField)
          ];

    changedRows.forEach((row) => {
      xml += "<row>";

      xmlFields.forEach((fieldName) => {
        xml += `<${fieldName}>${serializeRowField(
          row,
          fieldName
        )}</${fieldName}>`;
      });

      xml += "</row>";
    });

    xml += `</${xmlSection}>`;

    if (deletedIds.length > 0) {
      xml += `<${deletedSection}>`;

      deletedIds.forEach((id) => {
        xml += "<row>";
        xml += `<${idField}>${escapeXml(id)}</${idField}>`;

        const deletedFields = Array.isArray(config?.deletedFields)
          ? config.deletedFields
          : [];

        deletedFields.forEach((field) => {
          if (!field?.field || field.field === idField) return;

          const value =
            typeof field.value === "function"
              ? field.value(id)
              : field.value ?? "";

          xml += `<${field.field}>${escapeXml(
            serializeFieldValue(value, field.type)
          )}</${field.field}>`;
        });

        xml += "</row>";
      });

      xml += `</${deletedSection}>`;
    }

    xml += "</Ref>";
    return xml;
  }

  async function saveChanges() {
    if (readOnly || !hasChanges || typeof onSave !== "function") return;

    const xml = buildSaveXml();
    console.log(`[Directory:${config?.apiAction || ""}] save XML`, xml);

    setSaveState("saving");

    try {
      await onSave(xml);
      setSaveState("saved");

      if (savedTimerRef.current) {
        window.clearTimeout(savedTimerRef.current);
      }

      savedTimerRef.current = window.setTimeout(() => {
        setSaveState("idle");
      }, 2500);
    } catch (error) {
      setSaveState("idle");
      throw error;
    }
  }

  if (!config) {
    return (
      <div className="directory-page">
        <div className="login-error">
          {t(
            "Directory.ConfigMissing",
            "Для выбранного справочника не задана конфигурация"
          )}
        </div>
      </div>
    );
  }

  const canAdd = !readOnly && config.canAdd !== false;
  const canDelete = !readOnly && config.canDelete !== false;
  const filterConfig = config?.filter;
  const showToolbar =
    !readOnly || Boolean(filterConfig) || normalizedToolbarActions.length > 0;

  return (
    <div
      className={[
        "directory-page",
        config?.wide ? "directory-page-wide" : "",
        config?.apiAction
          ? `directory-page-${String(config.apiAction).toLowerCase()}`
          : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {showToolbar && (
        <div className="module-toolbar directory-toolbar">
          <div className="toolbar-left">
            {filterConfig?.field && Array.isArray(filterConfig.options) && (
              <label className="directory-filter-label">
                <span>
                  {t(
                    filterConfig.labelKey,
                    filterConfig.fallback || "Фильтр"
                  )}
                </span>
                <select
                  className="directory-filter-select"
                  value={String(filterValue ?? "")}
                  onChange={(event) => setFilterValue(event.target.value)}
                >
                  {filterConfig.options.map((option) => (
                    <option
                      key={String(option.value)}
                      value={String(option.value)}
                    >
                      {t(
                        option.labelKey,
                        option.fallback || String(option.value)
                      )}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {canAdd && (
              <button type="button" className="small-action-button" onClick={addRow}>
                {t("Directory.Add", "Добавить")}
              </button>
            )}

            {normalizedToolbarActions.map((action, actionIndex) => {
              if (action?.hidden) return null;

              return (
                <button
                  key={action.key || `directory-action-${actionIndex}`}
                  type="button"
                  className={["small-action-button", action.className || ""]
                    .filter(Boolean)
                    .join(" ")}
                  disabled={Boolean(action.disabled)}
                  onClick={action.onClick}
                >
                  {t(action.labelKey, action.fallback || action.label || "")}
                </button>
              );
            })}
          </div>

          {!readOnly && (
            <div className="toolbar-right">
              <button
                type="button"
                className="save-button save-button-active"
                disabled={!hasChanges || saveState === "saving"}
                onClick={() => {
                  saveChanges().catch((error) => {
                    window.alert(error?.message || t("Directory.SaveError", "Ошибка сохранения справочника"));
                  });
                }}
              >
                {saveState === "saving"
                  ? t("Directory.Saving", "Сохранение...")
                  : saveState === "saved"
                    ? t("Directory.Saved", "✓ Сохранено")
                    : t("Directory.Save", "Сохранить")}
              </button>
            </div>
          )}
        </div>
      )}

      <div
        className={[
          "directory-table-wrap",
          config?.tableWrapClass || ""
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <table
          className={[
            "data-table",
            "directory-table",
            config?.tableClass || ""
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <thead>
            <tr>
              {visibleColumns.map((column) => {
                const headerLookupKey = column?.headerLookupKey;
                const headerLookupRows = headerLookupKey
                  ? lookupData?.[headerLookupKey]
                  : null;
                const headerLookupValueField =
                  column?.headerLookupValueField || "ID";
                const headerLookupLabelField =
                  column?.headerLookupLabelField || "Name";
                const headerLookupSecondaryField =
                  column?.headerLookupSecondaryField || "";
                const headerLookupBonusField =
                  column?.headerLookupBonusField || "";
                const headerLookupValue = column?.headerLookupValue;
                const headerLookupItem =
                  Array.isArray(headerLookupRows) &&
                  headerLookupValue !== undefined
                    ? headerLookupRows.find(
                        (item) =>
                          String(item?.[headerLookupValueField] ?? "") ===
                          String(headerLookupValue)
                      )
                    : null;
                const headerIsBonus =
                  headerLookupBonusField &&
                  normalizeBoolean(
                    headerLookupItem?.[headerLookupBonusField]
                  );

                return (
                  <th
                    key={column.field}
                    title={
                      headerLookupItem
                        ? String(
                            headerLookupItem?.[headerLookupLabelField] ??
                              column.fallback ??
                              column.field
                          )
                        : undefined
                    }
                    className={[
                      `directory-field-${column.field}`,
                      column.headerClass || "",
                      headerIsBonus ? column.headerBonusClass || "" : "",
                      column.type === "boolean"
                        ? "directory-boolean-column"
                        : column.type === "number" ||
                            column.type === "nullable-number"
                          ? "directory-number-column"
                          : column.type === "time"
                            ? "directory-time-column"
                            : column.type === "date"
                              ? "directory-date-column"
                              : column.type === "search-select"
                                ? "directory-search-column"
                                : ""
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {headerLookupKey ? (
                      <div className="discount-head-cell">
                        <div className="discount-head-name">
                          {String(
                            headerLookupItem?.[headerLookupLabelField] ??
                              column.fallback ??
                              column.field
                          )}
                        </div>
                        <div className="discount-head-value">
                          {headerLookupSecondaryField
                            ? String(
                                headerLookupItem?.[
                                  headerLookupSecondaryField
                                ] ?? ""
                              )
                            : ""}
                        </div>
                      </div>
                    ) : (
                      t(column.labelKey, column.fallback || column.field)
                    )}
                  </th>
                );
              })}
              {canDelete && <th className="directory-delete-column" />}
            </tr>
          </thead>

          <tbody>
            {displayedRows.map((row) => {
              const rowKey = row.__rowKey;
              const rowChanged = row.__isNew || changedKeys.has(rowKey);
              let firstEditableAssigned = false;

              return (
                <tr
                  key={rowKey}
                  className={[
                    String(selectedKey) === String(rowKey) ? "selected-row" : "",
                    rowChanged ? "changed-row" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => {
                    setSelectedKey(rowKey);
                    onSelectedIdChange?.(row?.[idField], row);
                  }}
                >
                  {visibleColumns.map((column) => {
                    const editable = isColumnEditable(column, row);
                    const shouldAssignFirstEditableRef =
                      row.__isNew &&
                      rowKey === selectedKey &&
                      editable &&
                      (
                        column.type === "text" ||
                        column.type === "number" ||
                        column.type === "nullable-number" ||
                        column.type === "time" ||
                        column.type === "date"
                      ) &&
                      !firstEditableAssigned;

                    if (shouldAssignFirstEditableRef) {
                      firstEditableAssigned = true;
                    }

                    return (
                      <td
                        key={column.field}
                        className={[
                          `directory-field-${column.field}`,
                          column.cellClass || "",
                          column.type === "boolean"
                            ? "center directory-boolean-column"
                            : column.type === "number" ||
                                column.type === "nullable-number"
                              ? "directory-number-column"
                              : column.type === "time"
                                ? "directory-time-column"
                                : column.type === "date"
                                  ? "directory-date-column"
                                  : column.type === "search-select"
                                    ? "directory-search-column"
                                    : ""
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {column.type === "boolean" ? (
                          <input
                            type="checkbox"
                            checked={normalizeBoolean(row?.[column.field])}
                            disabled={!editable}
                            onChange={(event) =>
                              updateRow(rowKey, column.field, event.target.checked)
                            }
                            onClick={(event) => event.stopPropagation()}
                          />
                        ) : column.type === "search-select" ? (
                          <DirectorySearchSelect
                            value={row?.[column.field]}
                            options={getColumnOptions(column, lookupData, rows)}
                            column={column}
                            editable={editable}
                            onChange={(nextValue) =>
                              updateRow(rowKey, column.field, nextValue)
                            }
                            onFocusRow={() => {
                              setSelectedKey(rowKey);
                              onSelectedIdChange?.(row?.[idField], row);
                            }}
                            t={t}
                          />
                        ) : column.type === "select" ? (
                          (() => {
                            let sourceOptions = getColumnOptions(
                              column,
                              lookupData,
                              rows
                            );

                            if (column.excludeCurrentId) {
                              sourceOptions = sourceOptions.filter(
                                (option) =>
                                  String(option?.[idField] ?? "") !==
                                  String(row?.[idField] ?? "")
                              );
                            }
                            const valueField = column.optionValueField || "ID";
                            const labelField = column.optionLabelField || "Name";
                            const hasEmptyOption =
                              column.emptyOptionValue !== undefined &&
                              column.emptyOptionValue !== null;
                            const emptyOptionValue = hasEmptyOption
                              ? String(column.emptyOptionValue)
                              : "";
                            const emptyOptionLabel =
                              column.emptyOptionLabel ??
                              t(column.emptyOptionLabelKey, "");
                            const options = hasEmptyOption &&
                              !sourceOptions.some(
                                (option) =>
                                  String(option?.[valueField] ?? "") === emptyOptionValue
                              )
                              ? [
                                  {
                                    [valueField]: column.emptyOptionValue,
                                    [labelField]: emptyOptionLabel
                                  },
                                  ...sourceOptions
                                ]
                              : sourceOptions;
                            const currentValue = String(row?.[column.field] ?? "");

                            if (!editable) {
                              const selectedOption = options.find(
                                (option) =>
                                  String(option?.[valueField] ?? "") === currentValue
                              );

                              return String(
                                selectedOption?.[labelField] ?? row?.[column.field] ?? ""
                              );
                            }

                            return (
                              <select
                                className="table-select directory-select"
                                value={currentValue}
                                onChange={(event) =>
                                  updateRow(rowKey, column.field, event.target.value)
                                }
                                onFocus={() => {
                                  setSelectedKey(rowKey);
                                  onSelectedIdChange?.(row?.[idField], row);
                                }}
                                onClick={(event) => event.stopPropagation()}
                              >
                                {options.length === 0 && <option value="" />}
                                {options.map((option, optionIndex) => {
                                  const optionValue = option?.[valueField] ?? "";
                                  const optionLabel = option?.[labelField] ?? optionValue;

                                  return (
                                    <option
                                      key={`${String(optionValue)}:${optionIndex}`}
                                      value={String(optionValue)}
                                    >
                                      {String(optionLabel)}
                                    </option>
                                  );
                                })}
                              </select>
                            );
                          })()
                        ) : column.type === "date" ? (
                          editable ? (
                            <input
                              ref={shouldAssignFirstEditableRef ? firstEditableInputRef : undefined}
                              type="date"
                              className="table-input directory-date-input"
                              value={String(row?.[column.field] ?? "").slice(0, 10)}
                              onChange={(event) =>
                                updateRow(rowKey, column.field, event.target.value)
                              }
                              onFocus={() => {
                                setSelectedKey(rowKey);
                                onSelectedIdChange?.(row?.[idField], row);
                              }}
                            />
                          ) : (
                            String(row?.[column.field] ?? "").slice(0, 10)
                          )
                        ) : column.type === "time" ? (
                          editable ? (
                            <input
                              ref={shouldAssignFirstEditableRef ? firstEditableInputRef : undefined}
                              type="time"
                              className="directory-time-input"
                              value={normalizeTimeForInput(row?.[column.field])}
                              onChange={(event) =>
                                updateRow(
                                  rowKey,
                                  column.field,
                                  normalizeTimeForServer(event.target.value)
                                )
                              }
                              onFocus={() => {
                                setSelectedKey(rowKey);
                                onSelectedIdChange?.(row?.[idField], row);
                              }}
                            />
                          ) : (
                            normalizeTimeForInput(row?.[column.field])
                          )
                        ) : column.type === "nullable-number" && editable ? (
                          <input
                            ref={shouldAssignFirstEditableRef ? firstEditableInputRef : undefined}
                            type="number"
                            step={column.step || "any"}
                            className={[
                              "table-input",
                              "table-input-num",
                              "directory-number-input",
                              column.inputClass || ""
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            value={
                              row?.[column.field] === null ||
                              row?.[column.field] === undefined
                                ? ""
                                : String(row[column.field])
                            }
                            onChange={(event) =>
                              updateRow(
                                rowKey,
                                column.field,
                                event.target.value === ""
                                  ? null
                                  : Number(event.target.value)
                              )
                            }
                            onFocus={() => {
                              setSelectedKey(rowKey);
                              onSelectedIdChange?.(row?.[idField], row);
                            }}
                          />
                        ) : column.type === "number" && editable ? (
                          <input
                            ref={shouldAssignFirstEditableRef ? firstEditableInputRef : undefined}
                            type="number"
                            step={column.step || "any"}
                            className={[
                              "table-input",
                              "table-input-num",
                              "directory-number-input",
                              column.inputClass || ""
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            value={String(row?.[column.field] ?? "")}
                            onChange={(event) =>
                              updateRow(rowKey, column.field, event.target.value)
                            }
                            onFocus={() => {
                              setSelectedKey(rowKey);
                              onSelectedIdChange?.(row?.[idField], row);
                            }}
                          />
                        ) : editable ? (
                          <input
                            ref={shouldAssignFirstEditableRef ? firstEditableInputRef : undefined}
                            type="text"
                            className="table-input directory-text-input"
                            value={String(row?.[column.field] ?? "")}
                            onChange={(event) =>
                              updateRow(rowKey, column.field, event.target.value)
                            }
                            onFocus={() => {
                              setSelectedKey(rowKey);
                              onSelectedIdChange?.(row?.[idField], row);
                            }}
                          />
                        ) : (
                          column.type === "number"
                            ? String(row?.[column.field] ?? "")
                            : String(row?.[column.field] ?? "")
                        )}
                      </td>
                    );
                  })}

                  {canDelete && (
                    <td className="directory-delete-column">
                      <button
                        type="button"
                        className="small-danger-button"
                        title={t("Directory.Delete", "Удалить")}
                        aria-label={t("Directory.Delete", "Удалить")}
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteRow(row);
                        }}
                      >
                        ×
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}

            {displayedRows.length === 0 && (
              <tr>
                <td
                  className="directory-empty-cell"
                  colSpan={Math.max(1, visibleColumns.length + (canDelete ? 1 : 0))}
                >
                  {rows.length === 0
                    ? t("Directory.Empty", "Нет данных")
                    : t(
                        filterConfig?.emptyKey,
                        filterConfig?.emptyFallback ||
                          "По выбранному фильтру нет данных."
                      )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
