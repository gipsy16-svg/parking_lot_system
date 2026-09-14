import csv
import os
import threading
import time
from datetime import datetime
import tkinter as tk
from tkinter import messagebox, ttk


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_FILE = os.path.join(BASE_DIR, "parking_lot.csv")
DB_FIELDS = [
    "record_id",
    "plate_number",
    "owner_name",
    "vehicle_type",
    "slot_id",
    "status",
    "queue_number",
    "entry_time",
    "exit_time",
]

TOTAL_SLOTS = 5
parking_lock = threading.Lock()


def now_text():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def ensure_database():
    if not os.path.exists(DB_FILE):
        write_rows([])


def read_rows():
    ensure_database()
    with open(DB_FILE, "r", newline="", encoding="utf-8") as file:
        return list(csv.DictReader(file))


def write_rows(rows):
    with open(DB_FILE, "w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=DB_FIELDS)
        writer.writeheader()
        writer.writerows(rows)


def next_record_id(rows):
    highest = 0
    for row in rows:
        value = row.get("record_id", "")
        if value.startswith("R"):
            try:
                highest = max(highest, int(value[1:]))
            except ValueError:
                pass
    return f"R{highest + 1:03}"


def slot_ids():
    return [f"P{i:03}" for i in range(1, TOTAL_SLOTS + 1)]


def active_row(rows, plate_number):
    plate_number = plate_number.strip().upper()
    for row in rows:
        if row["plate_number"].upper() == plate_number and row["status"] in ("Parked", "Waiting"):
            return row
    return None


def used_slots(rows):
    return {row["slot_id"] for row in rows if row["status"] == "Parked" and row["slot_id"]}


def first_available_slot(rows):
    occupied = used_slots(rows)
    for slot_id in slot_ids():
        if slot_id not in occupied:
            return slot_id
    return ""


def next_queue_number(rows):
    numbers = []
    for row in rows:
        if row["status"] == "Waiting" and row["queue_number"]:
            try:
                numbers.append(int(row["queue_number"]))
            except ValueError:
                pass
    return str(max(numbers, default=0) + 1)


def normalize_waiting_queue(rows):
    waiting = [row for row in rows if row["status"] == "Waiting"]
    waiting.sort(key=lambda row: int(row["queue_number"] or "0"))
    for index, row in enumerate(waiting, start=1):
        row["queue_number"] = str(index)


class ParkingLotApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Parking Lot Management System")
        self.root.geometry("1050x720")
        self.root.minsize(950, 650)

        self.status_var = tk.StringVar(value="Ready")
        self.overview_var = tk.StringVar(value="")
        self.plate_var = tk.StringVar()
        self.owner_var = tk.StringVar()
        self.type_var = tk.StringVar(value="Car")
        self.exit_plate_var = tk.StringVar()

        ensure_database()
        self.build_ui()
        self.refresh_all()

    def build_ui(self):
        self.root.configure(bg="#f4f6f8")

        header = tk.Frame(self.root, bg="#263238", padx=18, pady=14)
        header.pack(fill="x")
        tk.Label(header, text="Parking Lot Management System", bg="#263238", fg="white",
                 font=("Arial", 20, "bold")).pack(anchor="w")
        tk.Label(header, text="One CSV Database | Waiting Queue | Thread Synchronization Demo",
                 bg="#263238", fg="#cfd8dc", font=("Arial", 11)).pack(anchor="w")

        body = tk.Frame(self.root, bg="#f4f6f8", padx=16, pady=12)
        body.pack(fill="both", expand=True)

        overview = tk.LabelFrame(body, text="Parking Overview", bg="#f4f6f8", padx=10, pady=8)
        overview.pack(fill="x")
        tk.Label(overview, textvariable=self.overview_var, bg="#f4f6f8",
                 font=("Arial", 12, "bold")).pack(anchor="w")

        slots_frame = tk.LabelFrame(body, text="Parking Slots", bg="#f4f6f8", padx=10, pady=10)
        slots_frame.pack(fill="x", pady=8)
        self.slots_container = tk.Frame(slots_frame, bg="#f4f6f8")
        self.slots_container.pack(fill="x")

        controls = tk.Frame(body, bg="#f4f6f8")
        controls.pack(fill="x", pady=6)

        arrival = tk.LabelFrame(controls, text="Car Arrival", bg="#f4f6f8", padx=10, pady=8)
        arrival.pack(side="left", fill="both", expand=True, padx=(0, 8))
        self.form_entry(arrival, "Plate Number", self.plate_var)
        self.form_entry(arrival, "Owner Name", self.owner_var)
        self.form_combo(arrival, "Vehicle Type", self.type_var, ["Car", "Motorcycle", "Van", "Truck"])
        tk.Button(arrival, text="ENTER PARKING LOT", command=self.arrive_from_form,
                  width=22, pady=5).pack(anchor="w", pady=(8, 0))

        exit_box = tk.LabelFrame(controls, text="Car Exit", bg="#f4f6f8", padx=10, pady=8)
        exit_box.pack(side="left", fill="both", expand=True)
        self.form_entry(exit_box, "Plate Number", self.exit_plate_var)
        tk.Button(exit_box, text="EXIT PARKING LOT", command=self.exit_from_form,
                  width=22, pady=5).pack(anchor="w", pady=(8, 0))
        tk.Label(exit_box,
                 text="If cars are waiting, the next car automatically gets the freed slot.",
                 bg="#f4f6f8", fg="#455a64", wraplength=420, justify="left").pack(anchor="w", pady=10)

        middle = tk.Frame(body, bg="#f4f6f8")
        middle.pack(fill="both", expand=True, pady=6)

        queue_box = tk.LabelFrame(middle, text="Waiting Queue", bg="#f4f6f8", padx=8, pady=8)
        queue_box.pack(side="left", fill="both", expand=True, padx=(0, 8))
        self.queue_table = self.make_table(queue_box, ["Queue", "Plate", "Owner", "Type"], [70, 120, 170, 100])

        history_box = tk.LabelFrame(middle, text="Parking Records", bg="#f4f6f8", padx=8, pady=8)
        history_box.pack(side="left", fill="both", expand=True)
        self.history_table = self.make_table(
            history_box,
            ["Record", "Plate", "Slot", "Status", "Entry Time", "Exit Time"],
            [70, 110, 70, 85, 145, 145],
        )

        demos = tk.LabelFrame(body, text="Parallel and Distributed Systems Demonstrations",
                              bg="#f4f6f8", padx=10, pady=8)
        demos.pack(fill="x", pady=6)
        for text, command in [
            ("Concurrent Arrival", self.open_concurrent_demo),
            ("Race Condition", self.open_race_demo),
            ("Synchronization", self.open_sync_demo),
            ("Semaphore", self.open_semaphore_demo),
            ("Deadlock Demo", self.open_deadlock_demo),
            ("Deadlock Prevention", self.open_prevention_demo),
        ]:
            tk.Button(demos, text=text, command=command, width=18, pady=4).pack(side="left", padx=(0, 7), pady=3)

        status = tk.LabelFrame(body, text="Status", bg="#f4f6f8", padx=10, pady=8)
        status.pack(fill="x")
        tk.Label(status, textvariable=self.status_var, bg="#f4f6f8", fg="#1b5e20",
                 wraplength=950, justify="left").pack(anchor="w")

    def form_entry(self, parent, label, variable):
        tk.Label(parent, text=label, bg="#f4f6f8").pack(anchor="w", pady=(4, 0))
        tk.Entry(parent, textvariable=variable).pack(fill="x")

    def form_combo(self, parent, label, variable, values):
        tk.Label(parent, text=label, bg="#f4f6f8").pack(anchor="w", pady=(4, 0))
        ttk.Combobox(parent, textvariable=variable, values=values, state="readonly").pack(fill="x")

    def make_table(self, parent, headings, widths):
        table = ttk.Treeview(parent, columns=headings, show="headings", height=8)
        for heading, width in zip(headings, widths):
            table.heading(heading, text=heading)
            table.column(heading, width=width)
        table.pack(fill="both", expand=True)
        return table

    def refresh_all(self):
        rows = read_rows()
        self.refresh_slots(rows)
        self.refresh_queue(rows)
        self.refresh_history(rows)

    def refresh_slots(self, rows):
        for child in self.slots_container.winfo_children():
            child.destroy()

        parked = {row["slot_id"]: row for row in rows if row["status"] == "Parked"}
        available = TOTAL_SLOTS - len(parked)
        waiting = len([row for row in rows if row["status"] == "Waiting"])
        self.overview_var.set(
            f"Total Slots: {TOTAL_SLOTS}     Occupied: {len(parked)}     Available: {available}     Waiting: {waiting}"
        )

        for index, slot_id in enumerate(slot_ids()):
            car = parked.get(slot_id)
            is_free = car is None
            color = "#dff3e3" if is_free else "#ffe0df"
            border = "#2e7d32" if is_free else "#b71c1c"
            card = tk.Frame(self.slots_container, bg=color, highlightbackground=border,
                            highlightthickness=2, width=180, height=95)
            card.grid(row=index // 5, column=index % 5, padx=6, pady=5, sticky="nsew")
            card.grid_propagate(False)
            tk.Label(card, text=slot_id, bg=color, font=("Arial", 13, "bold")).pack(pady=(8, 1))
            tk.Label(card, text="Available" if is_free else "Occupied", bg=color, font=("Arial", 10)).pack()
            if car:
                tk.Label(card, text=car["plate_number"], bg=color, font=("Arial", 10, "bold")).pack()
                tk.Label(card, text=car["owner_name"], bg=color, font=("Arial", 8)).pack()

    def refresh_queue(self, rows):
        self.clear_table(self.queue_table)
        waiting = [row for row in rows if row["status"] == "Waiting"]
        waiting.sort(key=lambda row: int(row["queue_number"] or "0"))
        for row in waiting:
            self.queue_table.insert("", "end", values=(
                row["queue_number"], row["plate_number"], row["owner_name"], row["vehicle_type"]
            ))

    def refresh_history(self, rows):
        self.clear_table(self.history_table)
        for row in rows:
            self.history_table.insert("", "end", values=(
                row["record_id"], row["plate_number"], row["slot_id"], row["status"],
                row["entry_time"], row["exit_time"]
            ))

    def clear_table(self, table):
        for item in table.get_children():
            table.delete(item)

    def set_status(self, message):
        self.status_var.set(message)

    def ui(self, callback, *args):
        self.root.after(0, lambda: callback(*args))

    def arrive_from_form(self):
        ok, message = self.vehicle_arrival(self.plate_var.get(), self.owner_var.get(), self.type_var.get())
        self.refresh_all()
        self.set_status(message)
        messagebox.showinfo("Car Arrival" if ok else "Car Arrival Error", message)
        if ok:
            self.plate_var.set("")
            self.owner_var.set("")
            self.type_var.set("Car")

    def exit_from_form(self):
        ok, message = self.vehicle_exit(self.exit_plate_var.get())
        self.refresh_all()
        self.set_status(message)
        messagebox.showinfo("Car Exit" if ok else "Car Exit Error", message)
        if ok:
            self.exit_plate_var.set("")

    def vehicle_arrival(self, plate_number, owner_name, vehicle_type):
        plate_number = plate_number.strip().upper()
        owner_name = owner_name.strip()
        vehicle_type = vehicle_type.strip()
        if not plate_number or not owner_name or not vehicle_type:
            return False, "Plate number, owner name, and vehicle type are required."

        with parking_lock:
            # CRITICAL SECTION:
            # The slots and waiting queue are shared resources stored in one CSV.
            # The lock ensures only one thread checks slots, updates queue, and saves at a time.
            rows = read_rows()
            if active_row(rows, plate_number):
                return False, f"{plate_number} is already parked or waiting."

            free_slot = first_available_slot(rows)
            if free_slot:
                rows.append({
                    "record_id": next_record_id(rows),
                    "plate_number": plate_number,
                    "owner_name": owner_name,
                    "vehicle_type": vehicle_type,
                    "slot_id": free_slot,
                    "status": "Parked",
                    "queue_number": "",
                    "entry_time": now_text(),
                    "exit_time": "",
                })
                write_rows(rows)
                return True, f"{plate_number} parked in {free_slot}."

            queue_number = next_queue_number(rows)
            rows.append({
                "record_id": next_record_id(rows),
                "plate_number": plate_number,
                "owner_name": owner_name,
                "vehicle_type": vehicle_type,
                "slot_id": "",
                "status": "Waiting",
                "queue_number": queue_number,
                "entry_time": "",
                "exit_time": "",
            })
            write_rows(rows)
            return True, f"No slot available. {plate_number} is waiting in queue number {queue_number}."

    def vehicle_exit(self, plate_number):
        plate_number = plate_number.strip().upper()
        if not plate_number:
            return False, "Plate number is required."

        with parking_lock:
            rows = read_rows()
            exiting = None
            for row in rows:
                if row["plate_number"].upper() == plate_number and row["status"] == "Parked":
                    exiting = row
                    break
            if not exiting:
                return False, f"{plate_number} is not currently parked."

            freed_slot = exiting["slot_id"]
            exiting["status"] = "Exited"
            exiting["exit_time"] = now_text()

            waiting = [row for row in rows if row["status"] == "Waiting"]
            waiting.sort(key=lambda row: int(row["queue_number"] or "0"))
            if waiting:
                next_car = waiting[0]
                next_car["status"] = "Parked"
                next_car["slot_id"] = freed_slot
                next_car["queue_number"] = ""
                next_car["entry_time"] = now_text()
                promoted_message = f" {next_car['plate_number']} automatically moved from waiting queue into {freed_slot}."
            else:
                promoted_message = f" {freed_slot} is now available."

            normalize_waiting_queue(rows)
            write_rows(rows)
            return True, f"{plate_number} exited from {freed_slot}.{promoted_message}"

    def demo_window(self, title, explanation):
        window = tk.Toplevel(self.root)
        window.title(title)
        window.geometry("760x520")
        window.configure(padx=12, pady=12)
        tk.Label(window, text=title, font=("Arial", 15, "bold")).pack(anchor="w")
        text = tk.Text(window, height=5, wrap="word", bg="#eef3f7")
        text.pack(fill="x", pady=(8, 8))
        text.insert("1.0", explanation)
        text.config(state="disabled")
        output = tk.Text(window, height=21, wrap="word")
        output.pack(fill="both", expand=True)
        return window, output

    def log(self, output, message):
        def append():
            output.config(state="normal")
            output.insert(tk.END, message + "\n")
            output.see(tk.END)
            output.config(state="disabled")
        self.ui(append)

    def clear_output(self, output):
        output.config(state="normal")
        output.delete("1.0", tk.END)
        output.config(state="disabled")

    def open_concurrent_demo(self):
        window, output = self.demo_window(
            "Concurrent Arrival Demo",
            "Each arriving car is represented by a thread. The shared resource is the parking lot: slots and waiting queue stored in one CSV file."
        )
        tk.Button(window, text="Start Demo", command=lambda: self.start_concurrent_demo(output)).pack(pady=8)

    def start_concurrent_demo(self, output):
        self.clear_output(output)
        self.set_status("Running concurrent arrival demo...")
        demo_cars = [
            ("DEMO-001", "Demo Driver 1", "Car"),
            ("DEMO-002", "Demo Driver 2", "Car"),
            ("DEMO-003", "Demo Driver 3", "Car"),
            ("DEMO-004", "Demo Driver 4", "Car"),
            ("DEMO-005", "Demo Driver 5", "Car"),
            ("DEMO-006", "Demo Driver 6", "Car"),
            ("DEMO-007", "Demo Driver 7", "Car"),
        ]

        def worker(plate, owner, vehicle_type):
            self.log(output, f"{plate} -> arriving...")
            time.sleep(0.1)
            ok, message = self.vehicle_arrival(plate, owner, vehicle_type)
            self.log(output, f"{plate} -> {message}")

        threads = [threading.Thread(target=worker, args=car, daemon=True) for car in demo_cars]
        for thread in threads:
            thread.start()
        threading.Thread(target=self.finish_demo_threads, args=(threads, "Concurrent arrival demo completed."), daemon=True).start()

    def finish_demo_threads(self, threads, message):
        for thread in threads:
            thread.join()
        self.ui(self.refresh_all)
        self.ui(self.set_status, message)

    def open_race_demo(self):
        window, output = self.demo_window(
            "Race Condition Demo",
            "This uses temporary test data only. Without a lock, two threads can both see one slot as available before either one updates it."
        )
        tk.Button(window, text="Start Demo", command=lambda: self.start_race_demo(output)).pack(pady=8)

    def start_race_demo(self, output):
        self.clear_output(output)
        self.set_status("Running race condition demo...")
        threading.Thread(target=self.race_demo, args=(output,), daemon=True).start()

    def race_demo(self, output):
        temp_slot = {"slot_id": "P001", "status": "Available", "plate_number": ""}
        assignments = []

        def unsafe_worker(name):
            self.log(output, f"{name} -> checking P001 without lock")
            if temp_slot["status"] == "Available":
                self.log(output, f"{name} -> saw P001 as Available")
                time.sleep(0.4)
                temp_slot["status"] = "Occupied"
                temp_slot["plate_number"] = name
                assignments.append(name)
                self.log(output, f"{name} -> assigned P001")

        threads = [threading.Thread(target=unsafe_worker, args=(f"RACE-{i}",), daemon=True) for i in (1, 2)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()
        self.log(output, f"Result: {assignments}")
        self.log(output, "Both threads attempted to use the same slot because there was no synchronization.")
        self.log(output, "")
        self.log(output, "Synchronized version:")

        temp_slot = {"slot_id": "P001", "status": "Available", "plate_number": ""}
        test_lock = threading.Lock()

        def safe_worker(name):
            self.log(output, f"{name} -> waiting for lock")
            with test_lock:
                self.log(output, f"{name} -> inside critical section")
                if temp_slot["status"] == "Available":
                    time.sleep(0.2)
                    temp_slot["status"] = "Occupied"
                    temp_slot["plate_number"] = name
                    self.log(output, f"{name} -> assigned P001")
                else:
                    self.log(output, f"{name} -> no slot available")

        threads = [threading.Thread(target=safe_worker, args=(f"SYNC-{i}",), daemon=True) for i in (1, 2)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()
        self.log(output, "Synchronization prevented the race condition.")
        self.ui(self.set_status, "Race condition demo completed.")

    def open_sync_demo(self):
        window, output = self.demo_window(
            "Synchronization Demo",
            "threading.Lock provides mutual exclusion. Only one thread can enter the critical section that updates the single CSV database."
        )
        tk.Button(window, text="Start Demo", command=lambda: self.start_sync_demo(output)).pack(pady=8)

    def start_sync_demo(self, output):
        self.clear_output(output)
        self.set_status("Running synchronization demo...")
        threading.Thread(target=self.sync_demo, args=(output,), daemon=True).start()

    def sync_demo(self, output):
        demo_lock = threading.Lock()

        def worker(name):
            self.log(output, f"{name} -> Waiting")
            with demo_lock:
                self.log(output, f"{name} -> accessing parking data")
                time.sleep(0.5)
                self.log(output, f"{name} -> finished")

        threads = [threading.Thread(target=worker, args=(f"Thread {letter}",), daemon=True) for letter in "ABC"]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()
        self.log(output, "Only one thread accessed the critical section at a time.")
        self.ui(self.set_status, "Synchronization demo completed.")

    def open_semaphore_demo(self):
        window, output = self.demo_window(
            "Semaphore Demo",
            "Lock allows 1 thread. Semaphore(3) allows up to 3 threads to use a limited resource at the same time."
        )
        tk.Button(window, text="Start Demo", command=lambda: self.start_semaphore_demo(output)).pack(pady=8)

    def start_semaphore_demo(self, output):
        self.clear_output(output)
        self.set_status("Running semaphore demo...")
        threading.Thread(target=self.semaphore_demo, args=(output,), daemon=True).start()

    def semaphore_demo(self, output):
        gate = threading.Semaphore(3)

        def worker(name):
            self.log(output, f"{name} -> Waiting")
            with gate:
                self.log(output, f"{name} -> Access granted")
                time.sleep(0.7)
                self.log(output, f"{name} -> Released")

        threads = [threading.Thread(target=worker, args=(f"CAR-{i:03}",), daemon=True) for i in range(1, 7)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()
        self.ui(self.set_status, "Semaphore demo completed.")

    def open_deadlock_demo(self):
        window = tk.Toplevel(self.root)
        window.title("Deadlock Demonstration")
        window.geometry("820x620")
        window.configure(bg="#f4f6f8", padx=14, pady=12)

        tk.Label(window, text="DEADLOCK DEMONSTRATION", bg="#f4f6f8",
                 font=("Arial", 17, "bold")).pack(anchor="w")

        explanation = tk.LabelFrame(window, text="What is Deadlock?", bg="#f4f6f8", padx=10, pady=8)
        explanation.pack(fill="x", pady=(10, 8))
        tk.Label(
            explanation,
            text=(
                "Deadlock occurs when two or more threads are permanently waiting for resources held by each other, "
                "so none of them can continue.\n\n"
                "Vehicle A holds Gate Lock and needs Parking Slot Lock.\n"
                "Vehicle B holds Parking Slot Lock and needs Gate Lock.\n"
                "A waits for B, and B waits for A. This is circular wait."
            ),
            bg="#f4f6f8",
            justify="left",
            wraplength=760,
        ).pack(anchor="w")

        resources = tk.LabelFrame(window, text="Resource Status", bg="#f4f6f8", padx=10, pady=8)
        resources.pack(fill="x", pady=6)
        gate_owner = tk.StringVar(value="Gate Lock: Available")
        slot_owner = tk.StringVar(value="Parking Slot Lock: Available")
        tk.Label(resources, textvariable=gate_owner, bg="#f4f6f8", font=("Arial", 11, "bold")).pack(anchor="w")
        tk.Label(resources, textvariable=slot_owner, bg="#f4f6f8", font=("Arial", 11, "bold")).pack(anchor="w")

        statuses = tk.Frame(window, bg="#f4f6f8")
        statuses.pack(fill="x", pady=6)

        vehicle_a_box = tk.LabelFrame(statuses, text="Vehicle A", bg="#f4f6f8", padx=10, pady=8)
        vehicle_a_box.pack(side="left", fill="both", expand=True, padx=(0, 6))
        vehicle_b_box = tk.LabelFrame(statuses, text="Vehicle B", bg="#f4f6f8", padx=10, pady=8)
        vehicle_b_box.pack(side="left", fill="both", expand=True, padx=(6, 0))

        vehicle_a_status = tk.StringVar(value="Ready")
        vehicle_b_status = tk.StringVar(value="Ready")
        tk.Label(vehicle_a_box, textvariable=vehicle_a_status, bg="#f4f6f8",
                 justify="left", wraplength=350).pack(anchor="w")
        tk.Label(vehicle_b_box, textvariable=vehicle_b_status, bg="#f4f6f8",
                 justify="left", wraplength=350).pack(anchor="w")

        result_var = tk.StringVar(value="Status: Ready")
        tk.Label(window, textvariable=result_var, bg="#fff8e1", fg="#5d4037",
                 font=("Arial", 12, "bold"), padx=10, pady=8,
                 wraplength=760, justify="left").pack(fill="x", pady=8)

        output = tk.Text(window, height=11, wrap="word")
        output.pack(fill="both", expand=True, pady=(0, 8))
        output.config(state="disabled")

        controls = tk.Frame(window, bg="#f4f6f8")
        controls.pack(fill="x")
        start_button = tk.Button(controls, text="Start Deadlock Demo", width=20)
        prevention_button = tk.Button(controls, text="Run Prevention Demo", width=22)
        close_button = tk.Button(controls, text="Close", width=12, command=window.destroy)
        start_button.pack(side="left", padx=(0, 8))
        prevention_button.pack(side="left", padx=(0, 8))
        close_button.pack(side="right")

        demo_widgets = {
            "gate_owner": gate_owner,
            "slot_owner": slot_owner,
            "vehicle_a_status": vehicle_a_status,
            "vehicle_b_status": vehicle_b_status,
            "result": result_var,
            "output": output,
            "start_button": start_button,
            "prevention_button": prevention_button,
        }
        start_button.config(command=lambda: self.start_deadlock_demo(demo_widgets))
        prevention_button.config(command=lambda: self.start_prevention_demo(demo_widgets))

    def open_prevention_demo(self):
        self.open_deadlock_demo()

    def set_demo_value(self, variable, value):
        self.ui(variable.set, value)

    def set_demo_button_state(self, button, state):
        self.root.after(0, lambda: button.config(state=state))

    def reset_deadlock_demo_view(self, widgets, message):
        self.set_demo_value(widgets["gate_owner"], "Gate Lock: Available")
        self.set_demo_value(widgets["slot_owner"], "Parking Slot Lock: Available")
        self.set_demo_value(widgets["vehicle_a_status"], "Ready")
        self.set_demo_value(widgets["vehicle_b_status"], "Ready")
        self.set_demo_value(widgets["result"], message)

    def start_deadlock_demo(self, widgets):
        self.clear_output(widgets["output"])
        self.reset_deadlock_demo_view(widgets, "Status: Starting deadlock demo...")
        self.set_status("Running deadlock demo...")
        self.set_demo_button_state(widgets["start_button"], "disabled")
        self.set_demo_button_state(widgets["prevention_button"], "disabled")
        threading.Thread(target=self.deadlock_demo, args=(widgets,), daemon=True).start()

    def deadlock_demo(self, widgets):
        output = widgets["output"]

        # Lock representing access to the parking gate.
        gate_lock = threading.Lock()

        # Lock representing access to a parking slot.
        slot_lock = threading.Lock()
        release_barrier = threading.Barrier(2)

        def vehicle_a():
            acquired_gate = False
            acquired_slot = False
            try:
                # Vehicle A acquires Gate Lock first, then waits for Slot Lock.
                gate_lock.acquire()
                acquired_gate = True
                self.set_demo_value(widgets["gate_owner"], "Gate Lock: Vehicle A")
                self.set_demo_value(widgets["vehicle_a_status"], "Acquired Gate Lock")
                self.log(output, "Vehicle A: Acquired Gate Lock")
                time.sleep(0.5)

                self.set_demo_value(widgets["vehicle_a_status"], "Acquired Gate Lock\nWaiting for Parking Slot Lock...")
                self.log(output, "Vehicle A: Waiting for Parking Slot Lock")
                acquired_slot = slot_lock.acquire(timeout=1.2)
                if acquired_slot:
                    self.set_demo_value(widgets["slot_owner"], "Parking Slot Lock: Vehicle A")
                    self.log(output, "Vehicle A: Acquired Parking Slot Lock")
                else:
                    self.log(output, "Vehicle A: DEADLOCK DETECTED while waiting for Parking Slot Lock")
            finally:
                try:
                    release_barrier.wait(timeout=2)
                except threading.BrokenBarrierError:
                    pass
                if acquired_slot:
                    slot_lock.release()
                if acquired_gate:
                    gate_lock.release()

        def vehicle_b():
            acquired_slot = False
            acquired_gate = False
            try:
                # Vehicle B acquires Slot Lock first, then waits for Gate Lock.
                # This creates circular wait and demonstrates deadlock.
                slot_lock.acquire()
                acquired_slot = True
                self.set_demo_value(widgets["slot_owner"], "Parking Slot Lock: Vehicle B")
                self.set_demo_value(widgets["vehicle_b_status"], "Acquired Parking Slot Lock")
                self.log(output, "Vehicle B: Acquired Parking Slot Lock")
                time.sleep(0.5)

                self.set_demo_value(widgets["vehicle_b_status"], "Acquired Parking Slot Lock\nWaiting for Gate Lock...")
                self.log(output, "Vehicle B: Waiting for Gate Lock")
                acquired_gate = gate_lock.acquire(timeout=1.2)
                if acquired_gate:
                    self.set_demo_value(widgets["gate_owner"], "Gate Lock: Vehicle B")
                    self.log(output, "Vehicle B: Acquired Gate Lock")
                else:
                    self.log(output, "Vehicle B: DEADLOCK DETECTED while waiting for Gate Lock")
            finally:
                try:
                    release_barrier.wait(timeout=2)
                except threading.BrokenBarrierError:
                    pass
                if acquired_gate:
                    gate_lock.release()
                if acquired_slot:
                    slot_lock.release()

        threads = [
            threading.Thread(target=vehicle_a, daemon=True),
            threading.Thread(target=vehicle_b, daemon=True),
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        self.set_demo_value(
            widgets["result"],
            "DEADLOCK DETECTED\nBoth vehicles were waiting for resources held by each other. Locks were safely released.",
        )
        self.set_demo_value(widgets["gate_owner"], "Gate Lock: Released")
        self.set_demo_value(widgets["slot_owner"], "Parking Slot Lock: Released")
        self.log(output, "Deadlock detected and safely recovered. Demo threads finished.")
        self.set_demo_button_state(widgets["start_button"], "normal")
        self.set_demo_button_state(widgets["prevention_button"], "normal")
        self.ui(self.set_status, "Deadlock demo completed.")

    def start_prevention_demo(self, widgets):
        self.clear_output(widgets["output"])
        self.reset_deadlock_demo_view(widgets, "Status: Starting deadlock prevention demo...")
        self.set_status("Running deadlock prevention demo...")
        self.set_demo_button_state(widgets["start_button"], "disabled")
        self.set_demo_button_state(widgets["prevention_button"], "disabled")
        threading.Thread(target=self.prevention_demo, args=(widgets,), daemon=True).start()

    def prevention_demo(self, widgets):
        output = widgets["output"]

        # Deadlock prevention:
        # All threads acquire resources in the same order.
        # Gate Lock must always be acquired before Slot Lock.
        gate_lock = threading.Lock()
        slot_lock = threading.Lock()

        def vehicle_worker(name, status_var):
            self.set_demo_value(status_var, "Waiting for Gate Lock")
            self.log(output, f"{name}: Waiting for Gate Lock")
            with gate_lock:
                self.set_demo_value(widgets["gate_owner"], f"Gate Lock: {name}")
                self.set_demo_value(status_var, "Acquired Gate Lock\nWaiting for Parking Slot Lock")
                self.log(output, f"{name}: Acquired Gate Lock")
                time.sleep(0.3)
                with slot_lock:
                    self.set_demo_value(widgets["slot_owner"], f"Parking Slot Lock: {name}")
                    self.set_demo_value(status_var, "Acquired Gate Lock\nAcquired Parking Slot Lock\nCompleted")
                    self.log(output, f"{name}: Acquired Parking Slot Lock and completed")
                    time.sleep(0.4)
                    self.set_demo_value(widgets["slot_owner"], "Parking Slot Lock: Available")
                self.set_demo_value(widgets["gate_owner"], "Gate Lock: Available")

        threads = [
            threading.Thread(target=vehicle_worker, args=("Vehicle A", widgets["vehicle_a_status"]), daemon=True),
            threading.Thread(target=vehicle_worker, args=("Vehicle B", widgets["vehicle_b_status"]), daemon=True),
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        self.set_demo_value(
            widgets["result"],
            "DEADLOCK PREVENTION\nNo deadlock occurred because both vehicles acquired Gate Lock before Parking Slot Lock.",
        )
        self.log(output, "Deadlock prevention successful: consistent lock order removed circular wait.")
        self.set_demo_button_state(widgets["start_button"], "normal")
        self.set_demo_button_state(widgets["prevention_button"], "normal")
        self.ui(self.set_status, "Deadlock prevention demo completed.")


if __name__ == "__main__":
    ensure_database()
    root = tk.Tk()
    ParkingLotApp(root)
    root.mainloop()
