const API_BASE = "https://webback.bar-boss.com";

export async function loginRequest({ alias, login, password }) {
  const response = await fetch("https://webback.bar-boss.com/wf_Login.php", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      Alias: alias,
      Login: login,
      Passw: password
    })
  });

  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    console.log("LOGIN RAW RESPONSE:", text);
    throw new Error("Сервер вернул не JSON. Проверьте wf_Login.php.");
  }

  if (!response.ok) {
    throw new Error(data.error || "Ошибка входа");
  }

  if (data.status !== "success") {
    throw new Error(data.error || "Неверный алиас, логин или пароль");
  }

  return data;
}

export async function menuRequest(accessToken) {
  const response = await fetch(`${API_BASE}/wf_Menu.php`, {
    method: "POST",
    credentials: "include",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    }
  });

  const text = await response.text();
  const data = JSON.parse(text);

  if (!response.ok) {
    throw new Error(data.error || "Ошибка загрузки меню");
  }

  return data;
}

export async function apiGet(endpoint, accessToken, params = {}) {
  const url = new URL(`${API_BASE}/${endpoint}`);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString(), {
    method: "GET",
    credentials: "include",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

   const text = await response.text();
   const data = JSON.parse(text);

  if (!response.ok) {
    throw new Error(data.error || "Ошибка запроса");
  }

  return data;
}

export async function loadPodrazd(accessToken) {
  return apiGet("wf_Podrazd.php", accessToken);
}

export async function loadOrganizations(accessToken) {
  return apiGet("wf_Orgs.php", accessToken);
}
export async function loadGroups(accessToken) {
  return apiGet("wf_GroupsDish.php", accessToken);
}

export async function loadCeh(accessToken) {
  return apiGet("wf_Cehs.php", accessToken);
}

export async function loadFop(accessToken) {
  return apiGet("wf_Fops.php", accessToken);
}

export async function loadTypDish(accessToken) {
  return apiGet("wf_TypDishes.php", accessToken);
}
export async function loadDishFilterGroups(accessToken, { sklad }) {
  return apiGet("wf_DishFilterGroups.php", accessToken, {
    Sklad: sklad
  });
}

export async function loadPostav(accessToken) {
  return apiGet("wf_Postav.php", accessToken);
}

export async function loadCategor(accessToken) {
  return apiGet("wf_Categor.php", accessToken);
}
