export const TOTAL_SLOTS = 5;

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export const hasBackendConfig = true;

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
  return apiRequest("/api/records");
}

export async function arriveVehicle({ plateNumber, ownerName, vehicleType }) {
  return apiRequest("/api/arrive", {
    method: "POST",
    body: JSON.stringify({ plateNumber, ownerName, vehicleType }),
  });
}

export async function exitVehicle(plateNumber) {
  return apiRequest("/api/exit", {
    method: "POST",
    body: JSON.stringify({ plateNumber }),
  });
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.message || "Backend API request failed.");
  }

  return payload;
}
