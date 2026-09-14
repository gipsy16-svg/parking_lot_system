# Parking Lot Management System

React version of the parking lot system with an Express backend and Supabase database support.

The original Python/Tkinter implementation is still available in `main.py`. The new app runs in the browser and keeps the same core behavior:

- 5 parking slots: `P001` to `P005`
- car arrival with automatic slot assignment
- waiting queue when the parking lot is full
- automatic promotion from the queue when a parked car exits
- parking records table
- two computer thread/data race simulation
- parallel and distributed systems demo panel

## Run The App

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

This starts:

- React frontend: `http://127.0.0.1:5173`
- Express backend: `http://localhost:3001`

If port `3001` is already busy, the dev script automatically uses the next open backend port, such as `3002`, and connects the frontend to it.

## Supabase Setup

1. Create a Supabase project.
2. Open the Supabase SQL Editor.
3. Run the SQL in `supabase/schema.sql`.
4. Copy `.env.example` to `.env`.
5. Add your Supabase project URL and anon key:

```text
PORT=3001
FRONTEND_ORIGIN=*
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key
VITE_API_BASE_URL=
```

Restart the dev server after changing `.env`.

The app uses the backend as its data source. The backend talks to Supabase. If `.env` is not configured, parking records will not load.

## Deploy Backend To Render

Deploy the backend first because the Vercel frontend needs the backend URL.

1. Push this project to GitHub.
2. Open Render.
3. Click `New` > `Web Service`.
4. Connect your GitHub repository.
5. Use these settings:

```text
Name: parking-lot-backend
Runtime: Node
Build Command: npm install
Start Command: npm run start:server
```

6. Add these Render environment variables:

```text
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-or-publishable-key
FRONTEND_ORIGIN=*
```

7. Click `Deploy Web Service`.
8. Copy the Render URL after deploy, for example:

```text
https://parking-lot-backend.onrender.com
```

Test the backend:

```text
https://parking-lot-backend.onrender.com/api/health
```

It should show `supabaseConfigured: true`.

## Deploy Frontend To Vercel

Deploy the frontend after Render.

1. Open Vercel.
2. Click `Add New` > `Project`.
3. Import the same GitHub repository.
4. Use these settings:

```text
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
```

5. Add this Vercel environment variable:

```text
VITE_API_BASE_URL=https://your-render-backend-url.onrender.com
```

6. Click `Deploy`.

After Vercel gives you a frontend URL, you can go back to Render and replace:

```text
FRONTEND_ORIGIN=*
```

with your Vercel URL, for example:

```text
FRONTEND_ORIGIN=https://your-vercel-app.vercel.app
```

Then redeploy the Render backend.

## Two Computer Simulation

The React app includes a simulation for two computers using one shared parking slot:

- `Run Race Condition` shows both computers reading `P001` as available before either one saves. The last write wins, which means one computer overwrites the other.
- `Run With Synchronization` shows the database lock behavior. One computer enters the critical section first, parks in `P001`, then the second computer sees the slot is already occupied and goes to the queue.

For a real two-computer test, run one backend connected to the same Supabase project, then open the frontend network URL from both computers. During local dev, Vite proxies `/api` to the backend automatically.

When both users click arrival at almost the same time, the backend calls the Supabase RPC function, and that function locks `parking_records`, so only one request can assign a slot first.

## Database Table

`parking_records`

| Column | Meaning |
| ------ | ------- |
| `record_id` | Unique record number |
| `plate_number` | Vehicle plate number |
| `owner_name` | Vehicle owner |
| `vehicle_type` | Car, Motorcycle, Van, or Truck |
| `slot_id` | Parking slot if parked |
| `status` | Parked, Waiting, or Exited |
| `queue_number` | Waiting position |
| `entry_time` | Time the car got a parking slot |
| `exit_time` | Time the car exited |

## Supabase Functions

The backend calls two PostgreSQL functions through Supabase RPC:

- `arrive_vehicle(plate_number, owner_name, vehicle_type)`
- `exit_vehicle(plate_number)`

Those functions lock the parking table while they assign slots, update queue positions, and promote waiting cars. This keeps the shared parking state consistent when multiple users submit actions at the same time.

## Original Python App

The desktop version can still be run with:

```bash
python main.py
```
