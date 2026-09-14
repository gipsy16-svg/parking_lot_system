import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Car,
  CheckCircle2,
  Clock3,
  Database,
  DoorOpen,
  LogIn,
  Play,
  RefreshCcw,
  LoaderCircle,
  ShieldCheck,
  TriangleAlert,
  UsersRound,
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

const demos = {
  concurrent: {
    label: "Concurrent Arrival",
    icon: UsersRound,
    lines: [
      "DEMO-001 -> arriving",
      "DEMO-002 -> arriving",
      "DEMO-003 -> arriving",
      "DEMO-004 -> arriving",
      "DEMO-005 -> arriving",
      "DEMO-006 -> no slot available, added to queue",
      "DEMO-007 -> no slot available, added to queue",
      "All arrivals finished with one shared parking state.",
    ],
  },
  race: {
    label: "Race Condition",
    icon: TriangleAlert,
    lines: [
      "RACE-1 -> checked P001 without lock",
      "RACE-2 -> checked P001 without lock",
      "RACE-1 -> saw P001 as available",
      "RACE-2 -> also saw P001 as available",
      "Both workers attempted to assign the same slot.",
    ],
  },
  sync: {
    label: "Synchronization",
    icon: ShieldCheck,
    lines: [
      "Thread A -> waiting",
      "Thread A -> entered critical section",
      "Thread A -> finished",
      "Thread B -> entered critical section",
      "Thread C -> entered critical section",
      "Only one worker changed parking data at a time.",
    ],
  },
  semaphore: {
    label: "Semaphore",
    icon: Activity,
    lines: [
      "CAR-001 -> access granted",
      "CAR-002 -> access granted",
      "CAR-003 -> access granted",
      "CAR-004 -> waiting",
      "CAR-005 -> waiting",
      "CAR-006 -> waiting",
      "Three cars used the limited resource together.",
    ],
  },
  deadlock: {
    label: "Deadlock Demo",
    icon: Clock3,
    lines: [
      "Vehicle A -> acquired Gate Lock",
      "Vehicle B -> acquired Parking Slot Lock",
      "Vehicle A -> waiting for Parking Slot Lock",
      "Vehicle B -> waiting for Gate Lock",
      "Deadlock detected: circular waiting.",
    ],
  },
  prevention: {
    label: "Deadlock Prevention",
    icon: CheckCircle2,
    lines: [
      "Vehicle A -> acquired Gate Lock",
      "Vehicle A -> acquired Parking Slot Lock",
      "Vehicle A -> completed",
      "Vehicle B -> acquired Gate Lock",
      "Vehicle B -> acquired Parking Slot Lock",
      "Consistent lock order prevented deadlock.",
    ],
  },
};

function App() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [arrivalLoading, setArrivalLoading] = useState(false);
  const [exitLoading, setExitLoading] = useState(false);
  const [notice, setNotice] = useState("Ready");
  const [activeDemo, setActiveDemo] = useState("concurrent");
  const [demoOutput, setDemoOutput] = useState([]);
  const [arrivalForm, setArrivalForm] = useState({
    plateNumber: "",
    ownerName: "",
    vehicleType: "Car",
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

  async function refreshRecords() {
    setLoading(true);
    try {
      const rows = await listRecords();
      setRecords(rows);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshRecords();
  }, []);

  async function handleArrival(event) {
    event.preventDefault();
    setArrivalLoading(true);
    try {
      const result = await arriveVehicle(arrivalForm);
      setNotice(result.message);
      if (result.ok) {
        setArrivalForm({ plateNumber: "", ownerName: "", vehicleType: "Car" });
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

  function runDemo(key) {
    setActiveDemo(key);
    setDemoOutput([]);
    demos[key].lines.forEach((line, index) => {
      window.setTimeout(() => {
        setDemoOutput((current) => [...current, line]);
      }, index * 260);
    });
  }

  return (
    <main className="shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">React + Supabase</p>
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
                    <div className="slot-vehicle">
                      <Car size={20} aria-hidden="true" />
                      <div>
                        <strong>{carInSlot.plate_number}</strong>
                        <span>{carInSlot.owner_name}</span>
                      </div>
                    </div>
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
            <button type="submit" disabled={arrivalLoading || exitLoading || !hasBackendConfig}>
              {arrivalLoading ? (
                <LoaderCircle className="spin-icon" size={18} aria-hidden="true" />
              ) : (
                <LogIn size={18} aria-hidden="true" />
              )}
              {arrivalLoading ? "Parking..." : "Enter Parking Lot"}
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

      <section className="demo-section">
        <div className="section-heading">
          <h2>Parallel Systems Demos</h2>
        </div>
        <div className="demo-layout">
          <div className="demo-buttons">
            {Object.entries(demos).map(([key, demo]) => {
              const Icon = demo.icon;
              return (
                <button
                  key={key}
                  type="button"
                  className={activeDemo === key ? "selected" : ""}
                  onClick={() => runDemo(key)}
                >
                  <Icon size={18} aria-hidden="true" />
                  {demo.label}
                </button>
              );
            })}
          </div>
          <div className="demo-output" aria-live="polite">
            <div className="demo-output-header">
              <Play size={16} aria-hidden="true" />
              <strong>{demos[activeDemo].label}</strong>
            </div>
            {demoOutput.length === 0 ? (
              <p className="demo-muted">Press a demo control to start.</p>
            ) : (
              demoOutput.map((line, index) => <p key={`${line}-${index}`}>{line}</p>)
            )}
          </div>
        </div>
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
