import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;
const frontendOrigin = process.env.FRONTEND_ORIGIN;

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

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

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    supabaseConfigured: Boolean(supabase),
    requiredEnv: supabase ? [] : ["SUPABASE_URL", "SUPABASE_ANON_KEY"],
  });
});

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
  const { plateNumber, ownerName, vehicleType } = request.body;

  const { data, error } = await client.rpc("arrive_vehicle", {
    plate_number: String(plateNumber || "").trim().toUpperCase(),
    owner_name: String(ownerName || "").trim(),
    vehicle_type: String(vehicleType || "").trim(),
  });

  if (error) {
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
  response.status(status).json({
    ok: false,
    message: error.message || "Backend error",
  });
});

app.listen(port, () => {
  console.log(`Backend API running at http://localhost:${port}`);
});

function requireSupabase() {
  if (!supabase) {
    const error = new Error(
      "Supabase backend is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY in .env, then restart npm run dev.",
    );
    error.status = 500;
    throw error;
  }

  return supabase;
}

function asyncHandler(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}
