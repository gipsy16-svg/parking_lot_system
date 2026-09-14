export const TOTAL_SLOTS = 5;

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const needsConfiguredBackend = import.meta.env.PROD && !API_BASE_URL;

export const hasBackendConfig = !needsConfiguredBackend;

export function slotIds() {
  return Array.from({ length: TOTAL_SLOTS }, (_, index) => `P${String(index + 1).padStart(3, "0")}`);
}

export function sortRecords(rows) {
  return [...rows].sort((a, b) => {
    const aNumber = Number(String(a.record_id || "").replace("R", "")) || 0;
    const bNumber = Number(String(b.record_id || "").replace("R", "")) || 0;
    return aNumber - bNumber;
  });
}

export async function listRecords() {
  const records = await apiRequest("/api/records");
  return Array.isArray(records) ? records : [];
}

export async function arriveVehicle({ plateNumber, ownerName, vehicleType, slotId }) {
  return apiRequest("/api/arrive", {
    method: "POST",
    body: JSON.stringify({ plateNumber, ownerName, vehicleType, slotId }),
  });
}

export async function exitVehicle(plateNumber) {
  return apiRequest("/api/exit", {
    method: "POST",
    body: JSON.stringify({ plateNumber }),
  });
}

async function apiRequest(path, options = {}) {
  if (needsConfiguredBackend) {
    throw new Error(
      "Frontend backend URL is missing. Add VITE_API_BASE_URL in Vercel, then redeploy.",
    );
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) {
    throw new Error(payload?.message || "Backend API request failed.");
  }

  if (!payload) {
    throw new Error(
      "Backend API did not return JSON. Check VITE_API_BASE_URL and your Render backend URL.",
    );
  }

  return payload;
}
