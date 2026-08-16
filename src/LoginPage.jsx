import { useEffect, useMemo, useState } from "react";
import barbossLogo from "./assets/barboss-logo.png";

const SUPPORTED_LANGUAGES = ["uk", "ru", "ro", "en"];
const DEFAULT_LANGUAGE = "uk";
const LANGUAGE_STORAGE_KEY = "barboss.loginLang";

const LANGUAGE_OPTIONS = [
  { code: "uk", name: "Українська" },
  { code: "ru", name: "Русский" },
  { code: "ro", name: "Română" },
  { code: "en", name: "English" }
];

const FALLBACK_TRANSLATIONS = {
  "Login.RequiredFieldsError": "Введіть аліас, логін і пароль",
  "Login.LoginError": "Помилка входу",
  "Login.Version": "Версія 1.4 © Юрій Яворський 2026 р.",
  "Login.IntroDescription":
    "Робочий простір для каси, складу, замовлень і довідників ресторану.",
  "Login.MainSectionsAriaLabel": "Основні розділи",
  "Login.Cash": "Каса",
  "Login.Warehouse": "Склад",
  "Login.Orders": "Замовлення",
  "Login.References": "Довідники",
  "Login.Title": "Вхід до Web Office",
  "Login.Subtitle": "Введіть дані вашого закладу",
  "Login.AliasLabel": "Аліас закладу",
  "Login.AliasPlaceholder": "Наприклад: demo",
  "Login.LoginLabel": "Логін",
  "Login.PasswordLabel": "Пароль",
  "Login.LoggingIn": "Виконується вхід...",
  "Login.LoginButton": "Увійти"
};

function normalizeLanguage(value) {
  const language = String(value || "").trim().toLowerCase();
  return SUPPORTED_LANGUAGES.includes(language)
    ? language
    : DEFAULT_LANGUAGE;
}

function getInitialLanguage() {
  const queryLanguage = new URLSearchParams(window.location.search).get("lang");

  const pathParts = window.location.pathname
    .split("/")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  const pathLanguage = pathParts.find((part) =>
    SUPPORTED_LANGUAGES.includes(part)
  );

  let savedLanguage = "";

  try {
    savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY) || "";
  } catch {
    // localStorage может быть недоступен в приватном режиме браузера.
  }

  return normalizeLanguage(
    queryLanguage || pathLanguage || savedLanguage || DEFAULT_LANGUAGE
  );
}

function normalizeTranslationData(data) {
  const source = data?.translations ?? data;

  if (Array.isArray(source)) {
    return Object.fromEntries(
      source
        .filter((item) => item && item.TextKey)
        .map((item) => {
          const moduleName = item.Module || "Login";
          return [`${moduleName}.${item.TextKey}`, item.text ?? item.Text ?? ""];
        })
    );
  }

  if (source && typeof source === "object") {
    return source;
  }

  return {};
}

export async function loadLoginTranslations(lang) {
  const safeLang = normalizeLanguage(lang);
  const response = await fetch(
    `${import.meta.env.BASE_URL}i18n/login/${safeLang}.json`,
    { cache: "no-cache" }
  );

  if (!response.ok) {
    throw new Error(`Login translations error: ${response.status}`);
  }

  const data = await response.json();
  return normalizeTranslationData(data);
}

export default function LoginPage({ onLogin, loading }) {
  const [alias, setAlias] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [language, setLanguage] = useState(getInitialLanguage);
  const [translations, setTranslations] = useState(FALLBACK_TRANSLATIONS);

  const t = useMemo(() => {
    return (textKey, fallback = "") =>
      translations[`Login.${textKey}`] ??
      FALLBACK_TRANSLATIONS[`Login.${textKey}`] ??
      fallback;
  }, [translations]);

  useEffect(() => {
    let cancelled = false;

    async function loadTranslations() {
      try {
        const loadedTranslations = await loadLoginTranslations(language);

        if (!cancelled) {
          setTranslations({
            ...FALLBACK_TRANSLATIONS,
            ...loadedTranslations
          });
        }
      } catch (err) {
        console.error(err);

        if (!cancelled) {
          setTranslations(FALLBACK_TRANSLATIONS);
        }
      }
    }

    loadTranslations();

    document.documentElement.lang = language;

    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // Работа страницы не должна зависеть от доступности localStorage.
    }

    const url = new URL(window.location.href);
    url.searchParams.set("lang", language);
    window.history.replaceState({}, "", url.toString());

    return () => {
      cancelled = true;
    };
  }, [language]);

  function translateLoginError(message) {
    const knownErrors = {
      "Неверный алиас, логин или пароль":
        translations["Login.InvalidCredentials"] || t("LoginError"),
      "Сервер вернул не JSON. Проверьте wf_Login.php.":
        translations["Login.ServerNonJson"] || message
    };

    return knownErrors[message] || message || t("LoginError", "Ошибка входа");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!alias.trim() || !login.trim() || !password) {
      setError(
        t("RequiredFieldsError", "Введите алиас, логин и пароль")
      );
      return;
    }

    try {
      await onLogin({
        alias: alias.trim(),
        login: login.trim(),
        password
      });
    } catch (err) {
      setError(translateLoginError(err?.message));
    }
  }

  function handleLanguageChange(event) {
    setError("");
    setLanguage(normalizeLanguage(event.target.value));
  }

  return (
    <main className="login-page" lang={language}>
      <div className="login-version">
        {t("Version", "Версия 1.2 © Юрий Яворский 2026 г")}
      </div>

      <div className="login-language-switcher">
        <select
          className="login-language-select"
          value={language}
          onChange={handleLanguageChange}
          aria-label="Language"
          title="Language"
          disabled={loading}
        >
          {LANGUAGE_OPTIONS.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name}
            </option>
          ))}
        </select>
      </div>

      <div
        className="login-decoration login-decoration-one"
        aria-hidden="true"
      />
      <div
        className="login-decoration login-decoration-two"
        aria-hidden="true"
      />

      <section className="login-shell">
        <div className="login-intro">
          <div className="login-eyebrow">BARBO$$</div>
          <h1>Web Office</h1>
          <p>{t("IntroDescription")}</p>

          <div
            className="login-feature-list"
            aria-label={t("MainSectionsAriaLabel")}
          >
            <span>{t("Cash")}</span>
            <span>{t("Warehouse")}</span>
            <span>{t("Orders")}</span>
            <span>{t("References")}</span>
          </div>
        </div>

        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-card-heading">
            <div className="login-title">{t("Title")}</div>
            <div className="login-subtitle">{t("Subtitle")}</div>
          </div>

          <label>
            {t("AliasLabel")}
            <input
              value={alias}
              onChange={(event) => setAlias(event.target.value)}
              placeholder={t("AliasPlaceholder")}
              autoFocus
              disabled={loading}
            />
          </label>

          <label>
            {t("LoginLabel")}
            <input
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              placeholder={t("LoginLabel")}
              autoComplete="username"
              disabled={loading}
            />
          </label>

          <label>
            {t("PasswordLabel")}
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t("PasswordLabel")}
              autoComplete="current-password"
              disabled={loading}
            />
          </label>

          {error && (
            <div className="login-error" role="alert" aria-live="polite">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}>
            {loading ? t("LoggingIn") : t("LoginButton")}
          </button>
        </form>
      </section>

      <img
        className="login-corner-logo"
        src={barbossLogo}
        alt="BarBo$$"
      />
    </main>
  );
}