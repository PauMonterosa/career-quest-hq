# Career Quest HQ

A local, original pixel-art academic planning office. Five deterministic AI-agent characters read imported planning data, run one safe skill each, and save inspectable audit results.

## Current product

Included: FastAPI, SQLite, defensive read-only Excel import, five agents, local and official-source skills, Phaser HQ, clickable agents, task movement/status feedback, a responsive desktop shell, Agent Inspector, semantic state badges, compact result toast and collapsible result drawer.

Protected by design: no automatic email sending, workbook writes or unapproved external actions.

## Prerequisites

- Python 3.11+
- Node.js 20+

## Data setup

Copy your original workbook to:

`data/pla_master_tfg_jan_2026_2027.xlsx`

The importer opens it read-only and never writes to it. On first backend startup, supported sheets are imported if the database does not already contain master rows. Delete `data/career_quest.db` manually only when you intentionally want a clean local re-import.

## Run the backend

```powershell
Set-Location "C:\Users\Usuario\Documents\Pla d'estudis\career-quest-hq\backend"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
python -m uvicorn app.main:app --reload --port 8000
```

API docs: `http://localhost:8000/docs`

## Run the frontend

In a second terminal:

```powershell
Set-Location "C:\Users\Usuario\Documents\Pla d'estudis\career-quest-hq\frontend"
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:5173`.

## Use it on your phone

The phone and computer must be connected to the same Wi-Fi network.

Start the backend so it accepts network connections:

```powershell
Set-Location "C:\Users\Usuario\Documents\Pla d'estudis\career-quest-hq\backend"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Start the frontend:

```powershell
Set-Location "C:\Users\Usuario\Documents\Pla d'estudis\career-quest-hq\frontend"
npm.cmd run dev
```

Vite will print a `Network` address such as `http://192.168.1.25:5173`. Open that address on the phone. Do not use `localhost` on the phone: it refers to the phone itself.

The frontend includes a PWA manifest, service worker and mobile icons. Installation from the home screen requires a secure HTTPS origin in normal browsers. Local Wi-Fi access works as a browser application; a public production installation also requires deploying the FastAPI backend over HTTPS.

## Tests and production build

```powershell
Set-Location "C:\Users\Usuario\Documents\Pla d'estudis\career-quest-hq\backend"
.\.venv\Scripts\python.exe -m pytest
Set-Location "..\frontend"
npm.cmd run build
```

`npm run build` runs the TypeScript project build before Vite. A dedicated lint tool is not installed yet.

## Responsive behavior

- Desktop: HQ-first grid with a clamp-based Agent Inspector.
- Compact tablet: the inspector moves below the HQ without compressing the scene.
- Mobile foundation: horizontal accessible agent navigation, 44px controls and compact result feedback.
- The dedicated draggable mobile bottom sheet is specified in `docs/mobile-interaction-model.md` and intentionally deferred until the Phase 2 design review.

## UI documentation

- `docs/ui-redesign-audit.md`
- `docs/design-system.md`
- `docs/mobile-interaction-model.md`
- `docs/ui-redesign-changelog.md`

## API

- `GET /health`
- `GET /agents`
- `GET /agents/{id}`
- `GET /masters`
- `GET /tfg-opportunities`
- `GET /tasks`
- `GET /emails`
- `POST /agents/{id}/tasks` with `{ "skill": "<allow-listed skill>" }`

See `docs/` for architecture, mapping, roles, safety, and roadmap.

## Live agent radar

The published PWA is not limited to reorganising the imported workbook:

- **ATLAS** reads a daily feed generated from official master-programme sources and discovers relevant pages on the same official domains.
- **NOVA** monitors research centres for projects, people, publications and possible TFG signals.
- **CHRONOS** combines private workbook tasks with deadline signals found by the radar and exports calendar events.
- **ECHO** prepares an actionable Gmail draft, while the user remains responsible for reviewing and sending it.
- **PIXEL** queries the public GitHub API at run time and audits the user's current repositories.

The scheduled workflow `.github/workflows/refresh-intelligence.yml` runs every day and stores only public-source evidence in `frontend/public/data/intelligence.json`. Private workbook data stays in the browser and is never committed.

Run the radar manually:

```powershell
Set-Location backend
.\.venv\Scripts\python.exe scripts\refresh_intelligence.py
```

Every web finding includes its source URL. External messages and calendar changes require an explicit user action.
