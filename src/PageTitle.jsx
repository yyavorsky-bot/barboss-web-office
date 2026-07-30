import { useState } from "react";
import barbossLogo from "./assets/barboss-logo.png";

export default function LoginPage({ onLogin, loading }) {
  const [alias, setAlias] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!alias.trim() || !login.trim() || !password) {
      setError("Введите алиас, логин и пароль");
      return;
    }

    try {
      await onLogin({
        alias: alias.trim(),
        login: login.trim(),
        password
      });
    } catch (err) {
      setError(err.message || "Ошибка входа");
    }
  }

  return (
    <main className="login-page">
      <div className="login-decoration login-decoration-one" aria-hidden="true" />
      <div className="login-decoration login-decoration-two" aria-hidden="true" />

      <section className="login-shell">
        <div className="login-intro">
          <div className="login-eyebrow">BARBO$$</div>
          <h1>Web Office</h1>
          <p>
            Рабочее пространство для кассы, склада, заказов
            и справочников ресторана.
          </p>

          <div className="login-feature-list" aria-label="Основные разделы">
            <span>Касса</span>
            <span>Склад</span>
            <span>Заказы</span>
            <span>Справочники</span>
          </div>
        </div>

        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-card-heading">
            <div className="login-title">Вход в Web Office</div>
            <div className="login-subtitle">
              Введите данные вашего заведения
            </div>
          </div>

          <label>
            Алиас заведения
            <input
              value={alias}
              onChange={(event) => setAlias(event.target.value)}
              placeholder="Например: demo"
              autoFocus
              disabled={loading}
            />
          </label>

          <label>
            Логин
            <input
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              placeholder="Логин"
              autoComplete="username"
              disabled={loading}
            />
          </label>

          <label>
            Пароль
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Пароль"
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
            {loading ? "Выполняется вход..." : "Войти"}
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