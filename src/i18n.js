export const SUPPORTED_LANGUAGES = ["uk", "ru", "ro", "en"];
export const DEFAULT_LANGUAGE = "uk";
export const LANGUAGE_STORAGE_KEY = "barboss.loginLang";

const LANGUAGE_LOCALES = {
  uk: "uk-UA",
  ru: "ru-RU",
  ro: "ro-RO",
  en: "en-US"
};

export function normalizeLanguage(value) {
  const normalized = String(value || "").trim().toLowerCase();

  const aliases = {
    ua: "uk",
    ukr: "uk",
    rus: "ru",
    rum: "ro",
    ron: "ro"
  };

  const resolved = aliases[normalized] || normalized;

  return SUPPORTED_LANGUAGES.includes(resolved)
    ? resolved
    : DEFAULT_LANGUAGE;
}

export function getLanguageLocale(language) {
  return (
    LANGUAGE_LOCALES[normalizeLanguage(language)] ||
    LANGUAGE_LOCALES[DEFAULT_LANGUAGE]
  );
}

export function getInitialLanguage() {
  let urlLanguage = "";
  let savedLanguage = "";

  try {
    urlLanguage =
      new URL(window.location.href).searchParams.get("lang") || "";
  } catch {
    // URL недоступен.
  }

  try {
    savedLanguage =
      window.localStorage.getItem(LANGUAGE_STORAGE_KEY) || "";
  } catch {
    // localStorage недоступен.
  }

  return normalizeLanguage(
    urlLanguage || savedLanguage || DEFAULT_LANGUAGE
  );
}

export function persistLanguage(language) {
  const safeLanguage = normalizeLanguage(language);

  try {
    window.localStorage.setItem(
      LANGUAGE_STORAGE_KEY,
      safeLanguage
    );
  } catch {
    // localStorage недоступен.
  }

  try {
    const url = new URL(window.location.href);
    url.searchParams.set("lang", safeLanguage);
    window.history.replaceState({}, "", url.toString());
  } catch {
    // URL недоступен.
  }
}

function parsePossibleJson(value) {
  let result = value;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (typeof result !== "string") {
      break;
    }

    const text = result.trim();

    if (!text) {
      return [];
    }

    if (
      !text.startsWith("{") &&
      !text.startsWith("[") &&
      !text.startsWith('"')
    ) {
      break;
    }

    try {
      result = JSON.parse(text);
    } catch {
      break;
    }
  }

  return result;
}

function unwrapTranslationEnvelope(value) {
  let result = parsePossibleJson(value);

  // SQL/PHP сейчас возвращает:
  // [
  //   {
  //     language: "uk",
  //     translations: [...]
  //   }
  // ]
  if (
    Array.isArray(result) &&
    result.length === 1 &&
    result[0] &&
    typeof result[0] === "object" &&
    !Array.isArray(result[0]) &&
    (
      Object.prototype.hasOwnProperty.call(result[0], "translations") ||
      Object.prototype.hasOwnProperty.call(result[0], "Translations")
    )
  ) {
    result = result[0];
  }

  return result;
}

export function normalizeTranslationData(data) {
  const envelope = unwrapTranslationEnvelope(data);

  let source =
    envelope?.translations ??
    envelope?.Translations ??
    envelope;

  source = parsePossibleJson(source);

  if (Array.isArray(source)) {
    const entries = [];

    for (const item of source) {
      const moduleName =
        item?.Module ??
        item?.module ??
        item?.MODULE ??
        "";

      const textKey =
        item?.TextKey ??
        item?.textKey ??
        item?.TEXTKEY ??
        item?.key ??
        "";

      const text =
        item?.text ??
        item?.Text ??
        item?.TEXT ??
        item?.translation ??
        item?.Translation ??
        item?.value ??
        item?.Value ??
        "";

      if (!moduleName || !textKey) {
        continue;
      }

      entries.push([
        `${String(moduleName).trim()}.${String(textKey).trim()}`,
        String(text ?? "")
      ]);
    }

    return Object.fromEntries(entries);
  }

  if (source && typeof source === "object") {
    return Object.fromEntries(
      Object.entries(source)
        .filter(([key]) => key !== "language" && key !== "status")
        .map(([key, value]) => [key, String(value ?? "")])
    );
  }

  return {};
}

export async function loadTranslations(
  language,
  request = fetch
) {
  const safeLanguage = normalizeLanguage(language);

  const url = new URL(
    "https://webback.bar-boss.com/wf_Translate.php"
  );

  url.searchParams.set("lang", safeLanguage);

  const response = await request(url.toString(), {
    method: "GET",
    credentials: "include",
    cache: "no-store"
  });

  const responseText = await response.text();

  let data;

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      "wf_Translate.php returned invalid JSON: " +
        responseText.substring(0, 500)
    );
  }

  if (!response.ok || data?.status === "error") {
    throw new Error(
      data?.error ||
        data?.message ||
        `Translation loading error: HTTP ${response.status}`
    );
  }

  const translationMap = normalizeTranslationData(data);
  const keys = Object.keys(translationMap);

  console.info(
    `[i18n] language=${safeLanguage}; keys=${keys.length}`,
    {
      sampleKeys: keys.slice(0, 10),
      homeOrganization:
        translationMap["Home.Organization"],
      appLogout:
        translationMap["App.Logout"]
    }
  );

  if (keys.length === 0) {
    throw new Error(
      `wf_Translate.php returned no translation keys for "${safeLanguage}".`
    );
  }

  return translationMap;
}