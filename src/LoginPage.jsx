import { useState } from "react";

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
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-title">BarBoss Web Office</div>

        <label>
          Алиас заведения
          <input
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="Например: demo"
          />
        </label>

        <label>
          Логин
          <input
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            placeholder="Логин"
          />
        </label>

        <label>
          Пароль
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль"
          />
        </label>

        {error && <div className="login-error">{error}</div>}

        <button type="submit" disabled={loading}>
          {loading ? "Вход..." : "Войти"}
        </button>
      </form>
    </div>
  );
}