import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Car,
  Database,
  DoorOpen,
  LogIn,
  RefreshCcw,
  LoaderCircle,
} from "lucide-react";
import {
  arriveVehicle,
  exitVehicle,
  hasBackendConfig,
  listRecords,
  slotIds,
  sortRecords,
  TOTAL_SLOTS,
} from "./lib/parkingService";

const vehicleTypes = ["Car", "Motorcycle", "Van", "Truck"];
const AUTO_REFRESH_INTERVAL_MS = 5000;

function App() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [arrivalLoading, setArrivalLoading] = useState(false);
  const [exitLoading, setExitLoading] = useState(false);
  const [notice, setNotice] = useState("Ready");
  const [arrivalForm, setArrivalForm] = useState({
    plateNumber: "",
    ownerName: "",
    vehicleType: "Car",
    slotId: "",
  });
  const [exitPlate, setExitPlate] = useState("");

  const parked = useMemo(() => records.filter((record) => record.status === "Parked"), [records]);
  const waiting = useMemo(
    () =>
      records
        .filter((record) => record.status === "Waiting")
        .sort((a, b) => Number(a.queue_number || 0) - Number(b.queue_number || 0)),
    [records],
  );
  const sortedRecords = useMemo(() => sortRecords(records), [records]);
  const slotMap = useMemo(
    () => new Map(parked.map((record) => [record.slot_id, record])),
    [parked],
  );
  const availableSlots = useMemo(
    () => slotIds().filter((slotId) => !slotMap.has(slotId)),
    [slotMap],
  );

  const refreshRecords = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }

    try {
      const rows = await listRecords();
      setRecords(rows);
    } catch (error) {
      setNotice(error.message);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    refreshRecords();
  }, [refreshRecords]);

  useEffect(() => {
    if (!hasBackendConfig) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      refreshRecords({ silent: true });
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [refreshRecords]);

  useEffect(() => {
    setArrivalForm((current) => {
      if (availableSlots.includes(current.slotId)) {
        return current;
      }

      return { ...current, slotId: availableSlots[0] || "" };
    });
  }, [availableSlots]);

  async function handleArrival(event) {
    event.preventDefault();
    setArrivalLoading(true);
    try {
      const result = await arriveVehicle(arrivalForm);
      setNotice(result.message);
      if (result.ok) {
        setArrivalForm((current) => ({
          plateNumber: "",
          ownerName: "",
          vehicleType: "Car",
          slotId: current.slotId,
        }));
      }
      await refreshRecords();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setArrivalLoading(false);
    }
  }

  async function handleExit(event) {
    event.preventDefault();
    setExitLoading(true);
    try {
      const result = await exitVehicle(exitPlate);
      setNotice(result.message);
      if (result.ok) {
        setExitPlate("");
      }
      await refreshRecords();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setExitLoading(false);
    }
  }

  return (
    <main className="shell">
      <header className="app-header">
        <div>
          <h1>Parking Lot Management System</h1>
        </div>
        <div className={`database-pill ${hasBackendConfig ? "connected" : ""}`}>
          <Database size={18} aria-hidden="true" />
          <span>{hasBackendConfig ? "Backend API" : "Backend not configured"}</span>
        </div>
      </header>

      <section className="overview-grid" aria-label="Parking overview">
        <Metric label="Total Slots" value={TOTAL_SLOTS} />
        <Metric label="Occupied" value={parked.length} />
        <Metric label="Available" value={TOTAL_SLOTS - parked.length} />
        <Metric label="Waiting" value={waiting.length} />
      </section>

      <section className="toolbar" aria-label="Status">
        <p>{loading ? "Loading records..." : notice}</p>
        <button
          type="button"
          className="icon-button"
          onClick={refreshRecords}
          disabled={loading || !hasBackendConfig}
          title="Refresh records"
        >
          <RefreshCcw size={18} aria-hidden="true" />
        </button>
      </section>

      <section className="main-grid">
        <div className="slots-panel">
          <div className="section-heading">
            <h2>Parking Slots</h2>
          </div>
          <div className="slots-grid">
            {slotIds().map((slotId) => {
              const carInSlot = slotMap.get(slotId);
              return (
                <article key={slotId} className={`slot-card ${carInSlot ? "occupied" : "available"}`}>
                  <div className="slot-topline">
                    <strong>{slotId}</strong>
                    <span>{carInSlot ? "Occupied" : "Available"}</span>
                  </div>
                  {carInSlot ? (
                    <>
                      <div className="slot-vehicle">
                        <Car size={20} aria-hidden="true" />
                        <div>
                          <strong>{carInSlot.plate_number}</strong>
                          <span>{carInSlot.owner_name}</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="slot-empty">Open</div>
                  )}
                </article>
              );
            })}
          </div>
        </div>

        <div className="forms-panel">
          <form className="form-block" onSubmit={handleArrival}>
            <div className="section-heading">
              <h2>Car Arrival</h2>
            </div>
            <label>
              Plate Number
              <input
                value={arrivalForm.plateNumber}
                onChange={(event) =>
                  setArrivalForm((current) => ({ ...current, plateNumber: event.target.value }))
                }
                placeholder="ABC123"
              />
            </label>
            <label>
              Owner Name
              <input
                value={arrivalForm.ownerName}
                onChange={(event) =>
                  setArrivalForm((current) => ({ ...current, ownerName: event.target.value }))
                }
                placeholder="Owner"
              />
            </label>
            <label>
              Vehicle Type
              <select
                value={arrivalForm.vehicleType}
                onChange={(event) =>
                  setArrivalForm((current) => ({ ...current, vehicleType: event.target.value }))
                }
              >
                {vehicleTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            <label>
              Parking Slot
              <select
                value={arrivalForm.slotId}
                onChange={(event) =>
                  setArrivalForm((current) => ({ ...current, slotId: event.target.value }))
                }
                disabled={availableSlots.length === 0}
              >
                {availableSlots.length === 0 ? (
                  <option value="">No available slots</option>
                ) : (
                  availableSlots.map((slotId) => (
                    <option key={slotId} value={slotId}>
                      {slotId}
                    </option>
                  ))
                )}
              </select>
            </label>
            <button
              type="submit"
              disabled={arrivalLoading || exitLoading || !hasBackendConfig}
            >
              {arrivalLoading ? (
                <LoaderCircle className="spin-icon" size={18} aria-hidden="true" />
              ) : (
                <LogIn size={18} aria-hidden="true" />
              )}
              {arrivalLoading
                ? "Parking..."
                : availableSlots.length === 0
                  ? "Join Waiting Queue"
                  : "Enter Parking Lot"}
            </button>
          </form>

          <form className="form-block" onSubmit={handleExit}>
            <div className="section-heading">
              <h2>Car Exit</h2>
            </div>
            <label>
              Plate Number
              <input
                value={exitPlate}
                onChange={(event) => setExitPlate(event.target.value)}
                placeholder="ABC123"
              />
            </label>
            <button type="submit" disabled={arrivalLoading || exitLoading || !hasBackendConfig}>
              {exitLoading ? (
                <LoaderCircle className="spin-icon" size={18} aria-hidden="true" />
              ) : (
                <DoorOpen size={18} aria-hidden="true" />
              )}
              {exitLoading ? "Exiting..." : "Exit Parking Lot"}
            </button>
          </form>
        </div>
      </section>

      <section className="data-grid">
        <TablePanel title="Waiting Queue">
          <table>
            <thead>
              <tr>
                <th>Queue</th>
                <th>Plate</th>
                <th>Owner</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {waiting.map((record) => (
                <tr key={record.record_id}>
                  <td>{record.queue_number}</td>
                  <td>{record.plate_number}</td>
                  <td>{record.owner_name}</td>
                  <td>{record.vehicle_type}</td>
                </tr>
              ))}
              {waiting.length === 0 && <EmptyRow columns={4} text="No waiting vehicles" />}
            </tbody>
          </table>
        </TablePanel>

        <TablePanel title="Parking Records">
          <table>
            <thead>
              <tr>
                <th>Record</th>
                <th>Plate</th>
                <th>Slot</th>
                <th>Status</th>
                <th>Entry Time</th>
                <th>Exit Time</th>
              </tr>
            </thead>
            <tbody>
              {sortedRecords.map((record) => (
                <tr key={record.record_id}>
                  <td>{record.record_id}</td>
                  <td>{record.plate_number}</td>
                  <td>{record.slot_id || "-"}</td>
                  <td>
                    <span className={`status-badge ${record.status.toLowerCase()}`}>{record.status}</span>
                  </td>
                  <td>{record.entry_time || "-"}</td>
                  <td>{record.exit_time || "-"}</td>
                </tr>
              ))}
              {sortedRecords.length === 0 && <EmptyRow columns={6} text="No records yet" />}
            </tbody>
          </table>
        </TablePanel>
      </section>

    </main>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TablePanel({ title, children }) {
  return (
    <div className="table-panel">
      <div className="section-heading">
        <h2>{title}</h2>
      </div>
      <div className="table-scroll">{children}</div>
    </div>
  );
}

function EmptyRow({ columns, text }) {
  return (
    <tr>
      <td className="empty-row" colSpan={columns}>
        {text}
      </td>
    </tr>
  );
}

export default App;
