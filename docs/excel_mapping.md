# Excel mapping

The importer opens the workbook with `read_only=True` and `data_only=True`. It normalizes accents, spaces, and punctuation in sheet names and headers.

| Source sheet | Entity | Representative fields |
|---|---|---|
| Mapa màsters | `MasterProgramme` | Programa, Universitat / consorci, País / mobilitat, Puntuació ponderada, Estat, Finestra orientativa, Punt clau / risc |
| TFG Barcelona | `TFGOpportunity` | Possible TFG, Centre / grup, Línia, Estat; priority and subject-fit scores remain in `source_data` |
| Pla d'acció | `ActionTask` | Tasca, Fase, Prioritat, Data límit, Estat, Notes |
| Correus | `EmailDraft` | Assumpte, Destinatari, Cos del correu, Estat, Seguiment, approval required |
| Documents | `ApplicationDocument` | Document, Estat, Observacions; format, target date and version remain in `source_data` |
| Dashboard | Not imported directly | Derived dashboard source for later milestones |

Every imported record retains `source_sheet`, `source_row`, and a JSON snapshot of normalized source values. Empty cells become `null`; unknown sheets are ignored; row failures are logged in the import summary.
