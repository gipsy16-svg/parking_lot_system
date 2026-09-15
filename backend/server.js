import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseKey =
  supabaseServiceRoleKey ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;
const frontendOrigin = process.env.FRONTEND_ORIGIN;
const hasValidSupabaseUrl =
  Boolean(supabaseUrl) &&
  !supabaseUrl.includes("your-project-ref") &&
  safeHost(supabaseUrl) !== "Invalid SUPABASE_URL";

const supabase = hasValidSupabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

app.use(
  cors({
    origin:
      !frontendOrigin || frontendOrigin === "*"
        ? true
        : frontendOrigin.split(",").map((origin) => origin.trim()),
  }),
);
app.use(express.json());

app.get("/", (_request, response) => {
  response.json({
    ok: true,
    service: "Parking Lot Backend API",
    health: "/api/health",
  });
});

app.get("/api/health", asyncHandler(async (_request, response) => {
  const supabaseStatus = await checkSupabaseConnection();

  response.json({
    ok: true,
    supabaseConfigured: Boolean(supabase),
    supabaseReachable: supabaseStatus.ok,
    supabaseHost: supabaseUrl ? safeHost(supabaseUrl) : null,
    supabaseError: supabaseStatus.error,
    requiredEnv: supabase ? [] : ["SUPABASE_URL", "SUPABASE_ANON_KEY"],
  });
}));

app.get("/api/records", asyncHandler(async (_request, response) => {
  const client = requireSupabase();
  const { data, error } = await client
    .from("parking_records")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  response.json(data);
}));

app.post("/api/arrive", asyncHandler(async (request, response) => {
  const client = requireSupabase();
  const { plateNumber, ownerName, vehicleType, slotId } = request.body;

  const { data, error } = await client.rpc("arrive_vehicle", {
    plate_number: String(plateNumber || "").trim().toUpperCase(),
    owner_name: String(ownerName || "").trim(),
    vehicle_type: String(vehicleType || "").trim(),
    requested_slot: String(slotId || "").trim().toUpperCase(),
  });

  if (error) {
    throw error;
  }

  response.json(data);
}));

app.post("/api/update", asyncHandler(async (request, response) => {
  const client = requireSupabase();
  const updateArgs = buildUpdateVehicleArgs(request.body);

  const { data, error } = await client.rpc("update_vehicle", {
    target_record_id: updateArgs.recordId,
    plate_number: updateArgs.plateNumber,
    owner_name: updateArgs.ownerName,
    vehicle_type: updateArgs.vehicleType,
    requested_slot: updateArgs.slotId,
  });

  if (error) {
    if (isMissingUpdateVehicleFunction(error)) {
      if (supabaseServiceRoleKey) {
        response.json(await updateVehicleWithoutRpc(client, updateArgs));
        return;
      }

      const setupError = new Error(
        "Supabase update_vehicle function is missing. Run supabase/add_update_vehicle.sql in the Supabase SQL Editor, then try Save Update again.",
      );
      setupError.status = 500;
      throw setupError;
    }

    throw error;
  }

  response.json(data);
}));

app.post("/api/exit", asyncHandler(async (request, response) => {
  const client = requireSupabase();
  const { plateNumber } = request.body;

  const { data, error } = await client.rpc("exit_vehicle", {
    plate_number: String(plateNumber || "").trim().toUpperCase(),
  });

  if (error) {
    throw error;
  }

  response.json(data);
}));

app.use((error, _request, response, _next) => {
  const status = error.status || 500;
  const message =
    String(error.message || "").includes("fetch failed")
      ? "Backend cannot reach Supabase. Check SUPABASE_URL and SUPABASE_ANON_KEY in Render, then redeploy."
      : error.message || "Backend error";

  response.status(status).json({
    ok: false,
    message,
  });
});

app.listen(port, () => {
  console.log(`Backend API running at http://localhost:${port}`);
});

function requireSupabase() {
  if (!supabase) {
    const error = new Error(
      "Supabase backend is not configured. Add your real SUPABASE_URL and SUPABASE_ANON_KEY in Render, then redeploy.",
    );
    error.status = 500;
    throw error;
  }

  return supabase;
}

function buildUpdateVehicleArgs({ recordId, plateNumber, ownerName, vehicleType, slotId }) {
  return {
    recordId: String(recordId || "").trim(),
    plateNumber: String(plateNumber || "").trim().toUpperCase(),
    ownerName: String(ownerName || "").trim(),
    vehicleType: String(vehicleType || "").trim(),
    slotId: String(slotId || "").trim().toUpperCase(),
  };
}

function validateUpdateVehicleArgs({ recordId, plateNumber, ownerName, vehicleType, slotId }) {
  const validVehicleTypes = new Set(["Car", "Motorcycle", "Van", "Truck"]);
  const validSlots = new Set(["P001", "P002", "P003", "P004", "P005"]);

  if (!recordId) {
    return "Record ID is required.";
  }

  if (!plateNumber || !ownerName || !vehicleType) {
    return "Plate number, owner name, and vehicle type are required.";
  }

  if (!validVehicleTypes.has(vehicleType)) {
    return "Vehicle type is invalid.";
  }

  if (!validSlots.has(slotId)) {
    return "Parking slot is invalid.";
  }

  return null;
}

async function updateVehicleWithoutRpc(client, updateArgs) {
  const validationMessage = validateUpdateVehicleArgs(updateArgs);

  if (validationMessage) {
    return { ok: false, message: validationMessage };
  }

  const { data: activeRecords, error: activeRecordsError } = await client
    .from("parking_records")
    .select("id, record_id, plate_number, status, slot_id")
    .in("status", ["Parked", "Waiting"]);

  if (activeRecordsError) {
    throw activeRecordsError;
  }

  const target = activeRecords.find((record) => record.record_id === updateArgs.recordId);

  if (!target) {
    return {
      ok: false,
      message: `${updateArgs.recordId} is not an active parking record.`,
    };
  }

  const duplicatePlate = activeRecords.some(
    (record) =>
      record.id !== target.id &&
      String(record.plate_number || "").toUpperCase() === updateArgs.plateNumber,
  );

  if (duplicatePlate) {
    return {
      ok: false,
      message: `${updateArgs.plateNumber} is already parked or waiting.`,
    };
  }

  const occupiedSlot = activeRecords.some(
    (record) =>
      record.id !== target.id &&
      record.status === "Parked" &&
      record.slot_id === updateArgs.slotId,
  );

  if (occupiedSlot) {
    return {
      ok: false,
      message: `${updateArgs.slotId} is already occupied.`,
    };
  }

  const { error: updateError } = await client
    .from("parking_records")
    .update({
      plate_number: updateArgs.plateNumber,
      owner_name: updateArgs.ownerName,
      vehicle_type: updateArgs.vehicleType,
      slot_id: target.status === "Parked" ? updateArgs.slotId : null,
    })
    .eq("id", target.id);

  if (updateError) {
    throw updateError;
  }

  return {
    ok: true,
    message: `${updateArgs.plateNumber} updated successfully.`,
  };
}

function isMissingUpdateVehicleFunction(error) {
  return (
    error?.code === "PGRST202" ||
    String(error?.message || "").includes("Could not find the function public.update_vehicle")
  );
}

async function checkSupabaseConnection() {
  if (!supabase) {
    return {
      ok: false,
      error: hasValidSupabaseUrl
        ? "Missing SUPABASE_ANON_KEY."
        : "SUPABASE_URL is missing, invalid, or still uses the placeholder your-project-ref.supabase.co.",
    };
  }

  try {
    const { error } = await supabase.from("parking_records").select("record_id", { count: "exact", head: true });
    return error ? { ok: false, error: error.message } : { ok: true, error: null };
  } catch (error) {
    return {
      ok: false,
      error:
        error.name === "TypeError" && error.message === "fetch failed"
          ? "Cannot connect to Supabase. Verify the Render SUPABASE_URL value points to your Supabase project URL."
          : error.message || "Supabase connection failed.",
    };
  }
}

function safeHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return "Invalid SUPABASE_URL";
  }
}

function asyncHandler(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}
