import barbossLogo from "./assets/barboss-logo.png";

function normalizeItem(item) {
  return {
    ...item,
    name: item?.name ?? item?.Name ?? "",
    action: item?.action ?? item?.Action ?? "",
    items: item?.items ?? item?.Items ?? []
  };
}

function collectActions(item, result = []) {
  const normalized = normalizeItem(item);

  if (normalized.action) {
    result.push(normalized);
  }

  if (Array.isArray(normalized.items)) {
    normalized.items.forEach((child) => collectActions(child, result));
  }

  return result;
}

export default function HomePage({
  menu,
  onOpen,
  multiOrg = false,
  organizationName,
  skladName,
  license,
  t = (key, fallback = "") => fallback
}) {
  const sections = (Array.isArray(menu) ? menu : [])
    .map((item, index) => {
      const normalized = normalizeItem(item);

      return {
        id: `${normalized.name}-${index}`,
        name: normalized.name || t("Home.SectionFallback", "Раздел"),
        actions: collectActions(normalized)
      };
    })
    .filter((section) => section.actions.length > 0);


  return (
    <section className="home-dashboard">
      <div className="home-hero">
        <div className="home-hero-content">


          <p>
            {t(
              "Home.IntroDescription",
              "Выберите рабочий раздел в меню слева или используйте быстрые переходы ниже."
            )}
          </p>

          <div className="home-context">
            {multiOrg && organizationName && (
              <div className="home-context-item">
                <span>{t("Home.Organization", "Организация")}</span>
                <strong>{organizationName}</strong>
              </div>
            )}

            {skladName && (
              <div className="home-context-item">
                <span>{t("Home.Department", "Подразделение")}</span>
                <strong>{skladName}</strong>
              </div>
            )}

            {license?.validUntil && (
              <div
                className={`home-context-item ${
                  license.warn ? "warning" : ""
                }`}
              >
                <span>{t("Home.License", "Лицензия")}</span>
                <strong>{t("Home.ValidUntilPrefix", "до")} {license.validUntil}</strong>
              </div>
            )}
          </div>
        </div>

        <div className="home-hero-logo" aria-hidden="true">
          <img src={barbossLogo} alt="" />
        </div>
      </div>

      {sections.length > 0 && (
        <div className="home-sections">
          {sections.map((section) => {
            const visibleActions = section.actions.slice(0, 7);
            const hiddenCount = section.actions.length - visibleActions.length;

            return (
              <article className="home-section-card" key={section.id}>
                <div className="home-section-heading">
                  <h2>{section.name}</h2>
                  <span>{section.actions.length}</span>
                </div>

                <div className="home-action-list">
                  {visibleActions.map((action, index) => (
                    <button
                      type="button"
                      className="home-action-button"
                      key={`${action.action}-${index}`}
                      onClick={() => onOpen(action)}
                    >
                      <span>{action.name}</span>
                      <span className="home-action-arrow">→</span>
                    </button>
                  ))}
                </div>

                {hiddenCount > 0 && (
                  <div className="home-more-note">
                    {t("Home.MoreSectionsPrefix", "Ещё разделов:")} {hiddenCount}.{" "}
                    {t("Home.MoreSectionsSuffix", "Они доступны в меню слева.")}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}