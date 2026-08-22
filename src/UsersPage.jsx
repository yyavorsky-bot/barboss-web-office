import { useEffect, useMemo, useRef, useState } from "react";
import "./users.css";

const BASE_URL = "https://webback.bar-boss.com/";

function n(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function normalizeUsers(data) {
  return (Array.isArray(data) ? data : []).map((row) => ({
    Idus: n(row?.Idus),
    Login: String(row?.Login ?? ""),
    // Никогда не переносим пароль, пришедший с сервера, в форму.
    Pass: "",
    RO: Boolean(row?.RO)
  }));
}

function snapshot(rows) {
  return rows.map((row) => ({
    Idus: n(row?.Idus),
    Login: String(row?.Login ?? ""),
    Pass: String(row?.Pass ?? ""),
    RO: Boolean(row?.RO)
  }));
}

function buildUsersXml(rows, deletedIds) {
  const rowsXml = rows.map((row) =>
    "<row>" +
    `<Idus>${n(row.Idus)}</Idus>` +
    `<Login>${escapeXml(row.Login)}</Login>` +
    `<Pass>${escapeXml(row.Pass)}</Pass>` +
    `<RO>${row.RO ? 1 : 0}</RO>` +
    "</row>"
  ).join("");

  const deletedXml = deletedIds.length
    ? "<Deleted>" + deletedIds.map((id) =>
        `<row><Idus>${n(id)}</Idus></row>`
      ).join("") + "</Deleted>"
    : "";

  return `<Ref><Users>${rowsXml}</Users>${deletedXml}</Ref>`;
}

async function readJsonResponse(response, fallback) {
  const text = await response.text();
  let data = null;
  try {
    data = text.trim() ? JSON.parse(text) : null;
  } catch {
    if (!response.ok) {
      throw new Error(`${fallback}: ${text.substring(0, 300)}`);
    }
  }

  if (!response.ok || data?.status === "error") {
    throw new Error(data?.error || data?.message || fallback);
  }
  return data;
}

export default function UsersPage({
  data,
  fetchWithAuth,
  readOnly = false,
  onDirtyChange,
  t = (key, fallback = "") => fallback
}) {
  const initialRows = useMemo(() => normalizeUsers(data), [data]);
  const [rows, setRows] = useState(initialRows);
  const [original, setOriginal] = useState(snapshot(initialRows));
  const [deletedIds, setDeletedIds] = useState([]);
  const [selectedId, setSelectedId] = useState(initialRows[0]?.Idus ?? null);
  const [saveState, setSaveState] = useState("idle");
  const [error, setError] = useState("");
  const tempIdRef = useRef(-1);

  useEffect(() => {
    const normalized = normalizeUsers(data);
    setRows(normalized);
    setOriginal(snapshot(normalized));
    setDeletedIds([]);
    setSelectedId((current) =>
      normalized.some((row) => n(row.Idus) === n(current))
        ? current
        : normalized[0]?.Idus ?? null
    );
    setSaveState("idle");
    setError("");
  }, [data]);

  const isDirty =
    JSON.stringify(snapshot(rows)) !== JSON.stringify(original) ||
    deletedIds.length > 0;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  useEffect(() => {
    const beforeUnload = (event) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [isDirty]);

  function nextTempId() {
    const id = tempIdRef.current;
    tempIdRef.current -= 1;
    return id;
  }

  function addUser() {
    if (readOnly) return;
    const id = nextTempId();
    setRows((current) => [
      ...current,
      { Idus: id, Login: "", Pass: "", RO: false }
    ]);
    setSelectedId(id);
    setError("");
    setSaveState("idle");
    requestAnimationFrame(() => {
      document.querySelector(
        `[data-user-id="${id}"] input[data-user-field="login"]`
      )?.focus();
    });
  }

  function changeRow(id, field, value) {
    if (readOnly) return;
    setRows((current) => current.map((row) =>
      n(row.Idus) === n(id) ? { ...row, [field]: value } : row
    ));
    setSelectedId(id);
    setError("");
    setSaveState("idle");
  }

  function removeUser(id) {
    if (readOnly) return;
    const row = rows.find((item) => n(item.Idus) === n(id));
    if (!row) return;

    if (!window.confirm(t("Users.DeleteConfirm", "Удалить пользователя?"))) {
      return;
    }

    const remaining = rows.filter((item) => n(item.Idus) !== n(id));
    setRows(remaining);
    if (n(id) > 0) {
      setDeletedIds((current) => current.includes(n(id))
        ? current
        : [...current, n(id)]
      );
    }
    if (n(selectedId) === n(id)) {
      setSelectedId(remaining[0]?.Idus ?? null);
    }
    setError("");
    setSaveState("idle");
  }

  function validate() {
    const logins = new Set();
    for (const row of rows) {
      const login = String(row.Login ?? "").trim();
      if (!login) {
        setSelectedId(row.Idus);
        return t("Users.LoginRequired", "Укажите логин пользователя.");
      }

      const normalized = login.toLocaleLowerCase();
      if (logins.has(normalized)) {
        setSelectedId(row.Idus);
        return t("Users.LoginDuplicate", "Логин пользователя должен быть уникальным.");
      }
      logins.add(normalized);

      if (n(row.Idus) < 0 && !String(row.Pass ?? "")) {
        setSelectedId(row.Idus);
        return t("Users.PasswordRequired", "Для нового пользователя укажите пароль.");
      }
    }
    return "";
  }

  async function save() {
    if (readOnly || !isDirty || saveState === "saving") return;

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaveState("saving");
    setError("");

    try {
      const body = new URLSearchParams();
      body.set("Action", "Users");
      body.set("xml", buildUsersXml(rows, deletedIds));

      const response = await fetchWithAuth(`${BASE_URL}wf_RefSave.php`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
        },
        body
      });

      await readJsonResponse(
        response,
        t("Users.SaveError", "Ошибка сохранения пользователей")
      );

      const reloadResponse = await fetchWithAuth(
        `${BASE_URL}wf_Directory.php?Action=Users`
      );
      const reloaded = await readJsonResponse(
        reloadResponse,
        t("Users.ReloadError", "Пользователи сохранены, но не удалось перечитать список")
      );

      const normalized = normalizeUsers(reloaded);
      setRows(normalized);
      setOriginal(snapshot(normalized));
      setDeletedIds([]);
      setSelectedId(normalized[0]?.Idus ?? null);
      setSaveState("saved");
      window.setTimeout(() => {
        setSaveState((current) => current === "saved" ? "idle" : current);
      }, 2500);
    } catch (saveError) {
      setSaveState("idle");
      setError(saveError?.message || t("Users.SaveError", "Ошибка сохранения пользователей"));
    }
  }

  return (
    <div className="users-page">
      <div className="users-header">
        <div>
          <h2>{t("Users.Title", "Пользователи")}</h2>
          <div className="users-subtitle">
            {t("Users.PasswordHint", "Для существующего пользователя пустое поле пароля означает: пароль не менять.")}
          </div>
        </div>

        <div className="users-toolbar">
          <button type="button" className="users-add-button" disabled={readOnly} onClick={addUser}>
            + {t("Users.Add", "Пользователь")}
          </button>
          <button
            type="button"
            className="primary-button users-save-button"
            disabled={readOnly || !isDirty || saveState === "saving"}
            onClick={save}
          >
            {saveState === "saving" ? t("Users.Saving", "Сохранение...") : t("Users.Save", "Сохранить")}
          </button>
          {saveState === "saved" && (
            <span className="users-saved">✓ {t("Common.Saved", "Сохранено")}</span>
          )}
        </div>
      </div>

      {error && <div className="login-error">{error}</div>}
      {readOnly && (
        <div className="users-readonly">
          {t("Users.ReadOnly", "Пользователи доступны только для просмотра.")}
        </div>
      )}

      <div className="users-table-wrap">
        <table className="users-table">
          <thead>
            <tr>
              <th>{t("Users.Login", "Пользователь")}</th>
              <th>{t("Users.Password", "Новый пароль")}</th>
              <th className="users-ro-col">{t("Users.RO", "Только чтение")}</th>
              <th className="users-action-col"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan="4" className="users-empty">{t("Users.Empty", "Пользователей нет.")}</td></tr>
            ) : rows.map((row) => (
              <tr
                key={String(row.Idus)}
                data-user-id={row.Idus}
                className={n(selectedId) === n(row.Idus) ? "selected-row" : ""}
                onClick={() => setSelectedId(row.Idus)}
              >
                <td>
                  <input
                    data-user-field="login"
                    type="text"
                    value={row.Login}
                    disabled={readOnly}
                    autoComplete="off"
                    onChange={(event) => changeRow(row.Idus, "Login", event.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="password"
                    value={row.Pass}
                    disabled={readOnly}
                    autoComplete="new-password"
                    placeholder={n(row.Idus) > 0 ? "••••••••" : t("Users.NewPassword", "Введите пароль")}
                    onChange={(event) => changeRow(row.Idus, "Pass", event.target.value)}
                  />
                </td>
                <td className="users-ro-col">
                  <input
                    type="checkbox"
                    checked={Boolean(row.RO)}
                    disabled={readOnly}
                    onChange={(event) => changeRow(row.Idus, "RO", event.target.checked)}
                  />
                </td>
                <td className="users-action-col">
                  <button
                    type="button"
                    className="users-delete-button"
                    disabled={readOnly}
                    title={t("Users.Delete", "Удалить")}
                    onClick={(event) => {
                      event.stopPropagation();
                      removeUser(row.Idus);
                    }}
                  >×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
