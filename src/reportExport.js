export function getDownloadFileName(response, fallbackName) {
  const disposition = response.headers.get("Content-Disposition") || "";

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const simpleMatch = disposition.match(/filename="?([^";]+)"?/i);
  return simpleMatch?.[1] || fallbackName;
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportReportFile({
  fetchWithAuth,
  reportModel,
  format,
  errorMessage = "Ошибка экспорта отчёта."
}) {
  if (!fetchWithAuth || !reportModel) {
    throw new Error(errorMessage);
  }

  const safeFormat = String(format || "").toLowerCase();

  if (safeFormat !== "xlsx" && safeFormat !== "docx") {
    throw new Error(errorMessage);
  }

  const body = new URLSearchParams();
  body.set("Format", safeFormat);
  body.set("Report", JSON.stringify(reportModel));

  const response = await fetchWithAuth(
    "https://webback.bar-boss.com/wr_Export.php",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
      },
      body
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    let errorData = null;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      // Сервер мог вернуть обычный текст ошибки.
    }

    throw new Error(
      errorData?.error ||
        errorData?.message ||
        errorText ||
        errorMessage
    );
  }

  const blob = await response.blob();
  const fallbackFileName =
    `${reportModel.fileName || "report"}.${safeFormat}`;

  downloadBlob(
    blob,
    getDownloadFileName(response, fallbackFileName)
  );
}
