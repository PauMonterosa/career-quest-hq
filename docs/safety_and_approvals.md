# Safety and approvals

- The source workbook is never saved or overwritten.
- Skills are allow-listed per agent; arbitrary tool names are rejected.
- External integrations, sending, scraping, secrets, and autonomous loops are absent.
- ECHO drafts text only and finishes in `waiting_approval`.
- No approval endpoint is included in Milestone 1 because there is no external action to approve.
- Each run stores observe context, selected plan, structured output, timestamps, mock flag, and approval requirement.

