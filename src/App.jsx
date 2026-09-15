import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Car,
  Database,
  DoorOpen,
  LogIn,
  RefreshCcw,
  LoaderCircle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CircleParking,
  Clock3,
  Layers3,
  LayoutDashboard,
  ListOrdered,
  MapPin,
  PanelTop,
  Plus,
  ReceiptText,
  House,
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

  const parked = useMemo(
    () => records.filter((record) => record.status === "Parked"),
    [records],
  );
  const waiting = useMemo(
    () =>
      records
        .filter((record) => record.status === "Waiting")
        .sort(
          (a, b) => Number(a.queue_number || 0) - Number(b.queue_number || 0),
        ),
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
    <div className="app-layout">
      <aside className="sidebar">
        <a className="brand" href="#home" aria-label="Parkspace home">
          <span className="brand-mark">
            <CircleParking size={25} aria-hidden="true" />
          </span>
          <span>
            parkspace<span className="brand-dot">.</span>
          </span>
        </a>
        <span className="sidebar-label">WORKSPACE</span>
        <nav aria-label="Main navigation">
          <a className="nav-link" href="#home">
            <House size={19} aria-hidden="true" /> Home
          </a>
          <a className="nav-link nav-primary" href="#overview">
            <LayoutDashboard size={19} aria-hidden="true" /> Overview{" "}
            <span className="nav-dot" />
          </a>
          <a className="nav-link" href="#parking">
            <MapPin size={19} aria-hidden="true" /> Parking slots
          </a>
          <a className="nav-link" href="#queue">
            <ListOrdered size={19} aria-hidden="true" /> Waiting queue{" "}
            <span className="nav-count">{waiting.length}</span>
          </a>
          <a className="nav-link" href="#records">
            <ReceiptText size={19} aria-hidden="true" /> Parking records
          </a>
        </nav>
        <div className="sidebar-note">
          <div className="sidebar-note-icon">
            <Car size={22} aria-hidden="true" />
          </div>
          <strong>A space for every arrival.</strong>
          <p>Keep your lot organized and your day moving.</p>
          <div className="sidebar-mini-slots" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className="sidebar-footer">
          <span className="location-mark">
            <MapPin size={17} aria-hidden="true" />
          </span>
          <div>
            <strong>Main parking lot</strong>
            <span>{TOTAL_SLOTS} managed spaces</span>
          </div>
        </div>
      </aside>
      <main className="shell" id="overview">
        <header className="app-header">
          <div className="breadcrumb">
            Workspace <span>/</span> <strong>Overview</strong>
          </div>
          <div
            className={`database-pill ${hasBackendConfig ? "connected" : ""}`}
          >
            <Database size={14} aria-hidden="true" />
            <span>
              {hasBackendConfig ? "Backend API" : "Backend not configured"}
            </span>
          </div>
        </header>

        <div className="page-heading">
          <div>
            <p className="eyebrow">PARKING LOT MANAGEMENT SYSTEM</p>
            <h1>A little order. A lot of space.</h1>
            <p className="page-description">
              Your parking lot at a glance. Every arrival, every space, all in
              one place.
            </p>
          </div>
          <a className="heading-link" href="#arrival">
            Register arrival <ArrowUpRight size={17} aria-hidden="true" />
          </a>
        </div>

        <section className="overview-grid" aria-label="Parking overview">
          <Metric
            label="Total slots"
            value={TOTAL_SLOTS}
            detail="Total parking capacity"
            icon={Layers3}
            tone="neutral"
          />
          <Metric
            label="Occupied"
            value={parked.length}
            detail="Vehicles currently parked"
            icon={Car}
            tone="blue"
          />
          <Metric
            label="Available"
            value={TOTAL_SLOTS - parked.length}
            detail="Spaces ready for arrival"
            icon={CircleParking}
            tone="green"
          />
          <Metric
            label="Waiting"
            value={waiting.length}
            detail="Vehicles in the queue"
            icon={Clock3}
            tone="amber"
          />
        </section>

        <section className="toolbar" aria-label="Status">
          <div className="notice">
            <span className={`notice-dot ${loading ? "is-loading" : ""}`} />
            <p role="status" aria-live="polite">
              {loading ? "Loading records..." : notice}
            </p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={refreshRecords}
            disabled={loading || !hasBackendConfig}
            title="Refresh records"
          >
            <RefreshCcw
              className={loading ? "spin-icon" : ""}
              size={14}
              aria-hidden="true"
            />
            <span>Refresh</span>
          </button>
        </section>

        <section className="main-grid">
          <div className="lot-column">
            <div className="slots-panel" id="parking">
              <div className="section-heading">
                <div>
                  <h2>Parking overview</h2>
                  <p>Find a space. Keep things moving.</p>
                </div>
                <span className="level-label">
                  <Layers3 size={14} aria-hidden="true" /> Main lot
                </span>
              </div>
              <div className="parking-deck">
                <div className="deck-heading">
                  <span>
                    <span className="deck-indicator" /> PARKING SLOTS
                  </span>
                  <span>{TOTAL_SLOTS} SPACES</span>
                </div>
                <div className="slots-grid">
                  {slotIds().map((slotId) => {
                    const carInSlot = slotMap.get(slotId);
                    return (
                      <article
                        key={slotId}
                        className={`slot-card ${carInSlot ? "occupied" : "available"}`}
                      >
                        <div className="slot-topline">
                          <strong>{slotId}</strong>
                        </div>
                        {carInSlot ? (
                          <>
                            <div
                              className="vehicle-illustration"
                              aria-hidden="true"
                            >
                              <span className="vehicle-windshield" />
                              <span className="vehicle-roof" />
                              <span className="vehicle-rear" />
                            </div>
                            <div className="slot-vehicle">
                              <div>
                                <strong title={carInSlot.plate_number}>
                                  {carInSlot.plate_number}
                                </strong>
                                <span title={carInSlot.owner_name}>
                                  {carInSlot.owner_name}
                                </span>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="slot-empty">
                            <span
                              className="empty-space-mark"
                              aria-hidden="true"
                            >
                              P
                            </span>
                            <span>Open space</span>
                          </div>
                        )}
                        <span className="slot-state">
                          <span />
                          {carInSlot ? "Occupied" : "Available"}
                        </span>
                      </article>
                    );
                  })}
                </div>
                <div className="driving-lane" aria-hidden="true">
                  <span>ENTRY</span>
                  <ArrowRight size={22} />
                  <div />
                  <ArrowRight size={22} />
                  <span>EXIT</span>
                </div>
              </div>
              <div className="lot-summary">
                <div className="lot-legend">
                  <span>
                    <i className="legend-available" />
                    Available
                  </span>
                  <span>
                    <i className="legend-occupied" />
                    Occupied
                  </span>
                </div>
                <span>
                  <strong>{parked.length}</strong> of {TOTAL_SLOTS} spaces
                  occupied
                </span>
              </div>
              <div
                className="occupancy-track"
                role="meter"
                aria-label="Occupied parking spaces"
                aria-valuemin={0}
                aria-valuemax={TOTAL_SLOTS}
                aria-valuenow={parked.length}
              >
                <span
                  style={{ width: `${(parked.length / TOTAL_SLOTS) * 100}%` }}
                />
              </div>
            </div>

            <TablePanel
              title="Waiting queue"
              subtitle="Next in line for an available space."
              icon={ListOrdered}
              count={waiting.length}
              id="queue"
            >
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
                      <td>
                        <span className="queue-position">
                          {record.queue_number}
                        </span>
                      </td>
                      <td className="plate-cell">{record.plate_number}</td>
                      <td>{record.owner_name}</td>
                      <td>{record.vehicle_type}</td>
                    </tr>
                  ))}
                  {waiting.length === 0 && (
                    <EmptyRow
                      columns={4}
                      text="All clear, no waiting vehicles"
                      detail="Vehicles waiting for a space will appear here."
                      icon={ListOrdered}
                    />
                  )}
                </tbody>
              </table>
            </TablePanel>
          </div>

          <div className="forms-panel">
            <form
              className="form-block arrival-form"
              id="arrival"
              onSubmit={handleArrival}
            >
              <div className="section-heading">
                <div className="form-title">
                  <span className="form-icon">
                    <ArrowDownLeft size={20} aria-hidden="true" />
                  </span>
                  <div>
                    <h2>Car arrival</h2>
                    <p>Check in and find a space.</p>
                  </div>
                </div>
                <Plus
                  size={17}
                  className="heading-decoration"
                  aria-hidden="true"
                />
              </div>
              <label>
                Plate Number
                <input
                  value={arrivalForm.plateNumber}
                  onChange={(event) =>
                    setArrivalForm((current) => ({
                      ...current,
                      plateNumber: event.target.value,
                    }))
                  }
                  placeholder="e.g. ABC123"
                />
              </label>
              <label>
                Owner Name
                <input
                  value={arrivalForm.ownerName}
                  onChange={(event) =>
                    setArrivalForm((current) => ({
                      ...current,
                      ownerName: event.target.value,
                    }))
                  }
                  placeholder="Enter owner's name"
                />
              </label>
              <div className="form-row">
                <label>
                  Vehicle Type
                  <select
                    value={arrivalForm.vehicleType}
                    onChange={(event) =>
                      setArrivalForm((current) => ({
                        ...current,
                        vehicleType: event.target.value,
                      }))
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
                      setArrivalForm((current) => ({
                        ...current,
                        slotId: event.target.value,
                      }))
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
              </div>
              <button
                type="submit"
                disabled={arrivalLoading || exitLoading || !hasBackendConfig}
              >
                {arrivalLoading ? (
                  <LoaderCircle
                    className="spin-icon"
                    size={18}
                    aria-hidden="true"
                  />
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

            <form className="form-block exit-form" onSubmit={handleExit}>
              <div className="section-heading">
                <div className="form-title">
                  <span className="form-icon">
                    <ArrowUpRight size={20} aria-hidden="true" />
                  </span>
                  <div>
                    <h2>Car exit</h2>
                    <p>Check out a parked vehicle.</p>
                  </div>
                </div>
              </div>
              <label>
                Plate Number
                <input
                  value={exitPlate}
                  onChange={(event) => setExitPlate(event.target.value)}
                  placeholder="Enter plate number"
                />
              </label>
              <button
                type="submit"
                disabled={arrivalLoading || exitLoading || !hasBackendConfig}
              >
                {exitLoading ? (
                  <LoaderCircle
                    className="spin-icon"
                    size={18}
                    aria-hidden="true"
                  />
                ) : (
                  <DoorOpen size={18} aria-hidden="true" />
                )}
                {exitLoading ? "Exiting..." : "Exit Parking Lot"}
              </button>
            </form>
          </div>
        </section>

        <section className="data-grid">
          <TablePanel
            title="Parking records"
            subtitle="A complete view of arrivals and departures."
            icon={ReceiptText}
            count={sortedRecords.length}
            id="records"
          >
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
                    <td className="plate-cell">{record.plate_number}</td>
                    <td>{record.slot_id || "-"}</td>
                    <td>
                      <span
                        className={`status-badge ${record.status.toLowerCase()}`}
                      >
                        {record.status}
                      </span>
                    </td>
                    <td>{record.entry_time || "-"}</td>
                    <td>{record.exit_time || "-"}</td>
                  </tr>
                ))}
                {sortedRecords.length === 0 && (
                  <EmptyRow
                    columns={6}
                    text="A fresh start for your parking lot"
                    detail="Your vehicle arrivals and departures will appear here."
                    icon={ReceiptText}
                  />
                )}
              </tbody>
            </table>
          </TablePanel>
        </section>

        <footer className="page-footer">
          <span>
            parkspace<span className="brand-dot">.</span>{" "}
            <span className="footer-divider">/</span> A smoother way to park.
          </span>
          <span>
            <PanelTop size={13} aria-hidden="true" /> Parking management
          </span>
        </footer>
      </main>
    </div>
  );
}

function Metric({ label, value, detail, icon: Icon, tone }) {
  return (
    <div className={`metric metric-${tone}`}>
      <div className="metric-topline">
        <span>{label}</span>
        <span className="metric-icon">
          <Icon size={19} aria-hidden="true" />
        </span>
      </div>
      <div className="metric-value">
        <strong>{String(value).padStart(2, "0")}</strong>
        <span className="metric-bars" aria-hidden="true">
          {Array.from({ length: 9 }, (_, index) => (
            <i key={index} />
          ))}
        </span>
      </div>
      <p>{detail}</p>
    </div>
  );
}

function TablePanel({ title, subtitle, icon: Icon, count, id, children }) {
  return (
    <div className="table-panel" id={id}>
      <div className="section-heading">
        <div className="table-title">
          <span className="table-heading-icon">
            <Icon size={19} aria-hidden="true" />
          </span>
          <div>
            <h2>
              {title} <span className="table-count">{count}</span>
            </h2>
            <p>{subtitle}</p>
          </div>
        </div>
      </div>
      <div className="table-scroll">{children}</div>
    </div>
  );
}

function EmptyRow({ columns, text, detail, icon: Icon }) {
  return (
    <tr>
      <td className="empty-row" colSpan={columns}>
        <div className="empty-content">
          <span className="empty-icon">
            <Icon size={23} aria-hidden="true" />
          </span>
          <strong>{text}</strong>
          <span>{detail}</span>
        </div>
      </td>
    </tr>
  );
}

export default App;
