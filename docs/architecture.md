# Architecture

Career Quest HQ is a local two-process MVP. A React/TypeScript client renders the office with Phaser 3 and calls a FastAPI service. FastAPI owns validation, SQLAlchemy persistence, Excel ingestion, agent skill allow-lists, and audit records. SQLite is the local system of record; the source workbook remains read-only.

The UI deliberately animates a task before calling the synchronous API. The backend remains authoritative for the final task status and structured result.

