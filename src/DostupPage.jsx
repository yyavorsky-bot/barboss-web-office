import { useEffect, useMemo, useState } from "react";
import "./dostup.css";

const USER_COUNT = 15;

function userField(index) {
  return `User${index}`;
}

function cloneRows(rows) {
  return JSON.parse(JSON.stringify(Array.isArray(rows) ? rows : []));
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function isAllowed(value) {
  return String(value ?? "").trim() === "1";
}

function getLoginRow(rows) {
  return (Array.isArray(rows) ? rows : []).find(
    (row) => Number(row?.CodU) === 1
  ) ?? null;
}

function getInitialUserNo(rows) {
  const loginRow = getLoginRow(rows);

  for (let index = 1; index <= USER_COUNT; index += 1) {
    if (String(loginRow?.[userField(index)] ?? "").trim()) {
      return index;
    }
  }

  return 1;
}

function buildDostupXml(rows) {
  const source = Array.isArray(rows) ? rows : [];

  const userFieldsXml = (row) => {
    let xml = "";

    for (let index = 1; index <= USER_COUNT; index += 1) {
      const field = userField(index);
      xml += `<${field}>${escapeXml(row?.[field])}</${field}>`;
    }

    return xml;
  };

  let level1 = "";
  let level2 = "";
  let level3 = "";

  source.forEach((row) => {
    level1 +=
      `<row><CodU>${Number(row?.CodU || 0)}</CodU>` +
      userFieldsXml(row) +
      "</row>";

    (Array.isArray(row?.Level2) ? row.Level2 : []).forEach((row2) => {
      level2 +=
        `<row><CodU>${Number(row?.CodU || 0)}</CodU>` +
        `<CodD>${Number(row2?.CodD || 0)}</CodD>` +
        userFieldsXml(row2) +
        "</row>";

      (Array.isArray(row2?.Level3) ? row2.Level3 : []).forEach((row3) => {
        level3 +=
          `<row><CodU>${Number(row?.CodU || 0)}</CodU>` +
          `<CodD>${Number(row2?.CodD || 0)}</CodD>` +
          `<CodDD>${Number(row3?.CodDD || 0)}</CodDD>` +
          userFieldsXml(row3) +
          "</row>";
      });
    });
  });

  return (
    "<Ref><Dostup>" +
    `<Level1>${level1}</Level1>` +
    `<Level2>${level2}</Level2>` +
    `<Level3>${level3}</Level3>` +
    "</Dostup></Ref>"
  );
}

function patchPermission(rows, path, field, checked) {
  const nextRows = cloneRows(rows);
  const [level1Index, level2Index, level3Index] = path;

  if (level1Index === undefined || !nextRows[level1Index]) {
    return nextRows;
  }

  if (level2Index === undefined) {
    nextRows[level1Index][field] = checked ? "1" : "0";
    return nextRows;
  }

  const level2 = nextRows[level1Index]?.Level2;
  if (!Array.isArray(level2) || !level2[level2Index]) {
    return nextRows;
  }

  if (level3Index === undefined) {
    level2[level2Index][field] = checked ? "1" : "0";
    return nextRows;
  }

  const level3 = level2[level2Index]?.Level3;
  if (!Array.isArray(level3) || !level3[level3Index]) {
    return nextRows;
  }

  level3[level3Index][field] = checked ? "1" : "0";
  return nextRows;
}

function PermissionRow({
  row,
  level,
  path,
  field,
  readOnly,
  onChange
}) {
  const name = String(row?.Name ?? "").trim();

  if (!name) {
    return null;
  }

  return (
    <div className={`dostup-right-row level-${level}`}>
      <label className="dostup-right-label">
        <input
          type="checkbox"
          checked={isAllowed(row?.[field])}
          disabled={readOnly}
          onChange={(event) => onChange(path, event.target.checked)}
        />
        <span>{name}</span>
      </label>
    </div>
  );
}

export default function DostupPage({
  data,
  readOnly = false,
  onDirtyChange,
  onSave,
  t = (key, fallback = "") => fallback
}) {
  const [rows, setRows] = useState(() => cloneRows(data));
  const [selectedUserNo, setSelectedUserNo] = useState(() =>
    getInitialUserNo(data)
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const nextRows = cloneRows(data);
    setRows(nextRows);
    setSelectedUserNo((current) => {
      if (current >= 1 && current <= USER_COUNT) {
        return current;
      }
      return getInitialUserNo(nextRows);
    });
    setDirty(false);
    setMessage("");
    setError("");
  }, [data]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    return () => onDirtyChange?.(false);
  }, [onDirtyChange]);

  const loginRow = useMemo(() => getLoginRow(rows), [rows]);
  const selectedField = userField(selectedUserNo);
  const selectedLogin = String(loginRow?.[selectedField] ?? "");

  const users = useMemo(() => {
    return Array.from({ length: USER_COUNT }, (_, offset) => {
      const number = offset + 1;
      const login = String(loginRow?.[userField(number)] ?? "").trim();
      return { number, login };
    });
  }, [loginRow]);

  function markChanged(nextRows) {
    setRows(nextRows);
    setDirty(true);
    setMessage("");
    setError("");
  }

  function handleLoginChange(value) {
    if (readOnly || !loginRow) return;

    const nextRows = cloneRows(rows);
    const rowIndex = nextRows.findIndex((row) => Number(row?.CodU) === 1);

    if (rowIndex < 0) return;

    nextRows[rowIndex][selectedField] = value;
    markChanged(nextRows);
  }

  function handlePermissionChange(path, checked) {
    if (readOnly) return;

    markChanged(
      patchPermission(rows, path, selectedField, checked)
    );
  }

  async function handleSave() {
    if (readOnly || saving || !dirty || typeof onSave !== "function") {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const xml = buildDostupXml(rows);
      const reloaded = await onSave(xml);

      if (Array.isArray(reloaded)) {
        setRows(cloneRows(reloaded));
      }

      setDirty(false);
      setMessage(t("Dostup.Saved", "Сохранено"));
    } catch (err) {
      setError(
        err?.message ||
          t("Dostup.SaveError", "Ошибка сохранения прав доступа")
      );
    } finally {
      setSaving(false);
    }
  }

  if (!loginRow) {
    return (
      <div className="dostup-page">
        <div className="login-error">
          {t("Dostup.NoData", "Матрица прав доступа не получена.")}
        </div>
      </div>
    );
  }

  return (
    <section className="dostup-page">
      <div className="module-toolbar dostup-toolbar">
        <div className="toolbar-left dostup-toolbar-left">
          <label className="dostup-user-field">
            <span>{t("Dostup.User", "Пользователь")}</span>
            <select
              value={selectedUserNo}
              disabled={saving}
              onChange={(event) =>
                setSelectedUserNo(Number(event.target.value))
              }
            >
              {users.map((user) => (
                <option key={user.number} value={user.number}>
                  {user.login ||
                    `${t("Dostup.FreeSlot", "Свободный слот")} ${user.number}`}
                </option>
              ))}
            </select>
          </label>

          <label className="dostup-login-field">
            <span>{t("Dostup.Login", "Логин")}</span>
            <input
              type="text"
              value={selectedLogin}
              disabled={readOnly || saving}
              onChange={(event) => handleLoginChange(event.target.value)}
            />
          </label>
        </div>

        <div className="toolbar-right">
          {message && <span className="dostup-message">{message}</span>}
          {error && <span className="dostup-inline-error">{error}</span>}

          <button
            type="button"
            className="save-button save-button-active"
            disabled={readOnly || saving || !dirty}
            onClick={handleSave}
          >
            {saving
              ? t("Common.Saving", "Сохранение...")
              : t("Common.Save", "Сохранить")}
          </button>
        </div>
      </div>

      <div className="dostup-card">
        <div className="dostup-card-heading">
          <strong>{t("Dostup.AccessRights", "Права доступа")}</strong>
          <span>{selectedLogin || `${t("Dostup.FreeSlot", "Свободный слот")} ${selectedUserNo}`}</span>
        </div>

        <div className="dostup-tree">
          {rows.map((row, level1Index) => {
            const name = String(row?.Name ?? "").trim();
            if (!name) return null;

            const level2Rows = Array.isArray(row?.Level2) ? row.Level2 : [];

            return (
              <div className="dostup-group" key={`u-${row?.CodU ?? level1Index}`}>
                <PermissionRow
                  row={row}
                  level={1}
                  path={[level1Index]}
                  field={selectedField}
                  readOnly={readOnly}
                  onChange={handlePermissionChange}
                />

                {level2Rows.map((row2, level2Index) => {
                  const level2Name = String(row2?.Name ?? "").trim();
                  if (!level2Name) return null;

                  const level3Rows = Array.isArray(row2?.Level3)
                    ? row2.Level3
                    : [];

                  return (
                    <div
                      className="dostup-subgroup"
                      key={`d-${row?.CodU ?? level1Index}-${row2?.CodD ?? level2Index}`}
                    >
                      <PermissionRow
                        row={row2}
                        level={2}
                        path={[level1Index, level2Index]}
                        field={selectedField}
                        readOnly={readOnly}
                        onChange={handlePermissionChange}
                      />

                      {level3Rows.map((row3, level3Index) => (
                        <PermissionRow
                          key={`dd-${row?.CodU ?? level1Index}-${row2?.CodD ?? level2Index}-${row3?.CodDD ?? level3Index}`}
                          row={row3}
                          level={3}
                          path={[level1Index, level2Index, level3Index]}
                          field={selectedField}
                          readOnly={readOnly}
                          onChange={handlePermissionChange}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export { buildDostupXml };
