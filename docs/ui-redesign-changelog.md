# UI redesign changelog — Phase 1 and Phase 2

## What changed

- Added centralized visual, typography, spacing, motion, state, room and agent tokens.
- Replaced the prototype header with a restrained product header and workspace indicators.
- Refactored the global layout into an HQ-first responsive grid.
- Refactored the right panel into an accent-aware Agent Inspector.
- Extracted reusable `ActionCard` and `AgentStatusBadge` components.
- Replaced persistent duplicate results with a compact completion toast and collapsible result drawer.
- Added readable loading, empty, error and approval presentations.
- Improved focus visibility, accessible labels and touch target sizing.
- Corrected user-facing encoding problems in the refactored React UI.

## Why

The previous interface gave similar visual weight to the world, panel and result. The new hierarchy keeps the HQ dominant while actions and outputs remain inspectable. Reusable tokens and components prevent state colors and surface rules from drifting.

## Preserved behavior

- Backend request and response contracts.
- Agent selection through both canvas and navigation.
- Phaser movement, station actions, speech bubbles and character feedback.
- Approval requirements and safe no-send behavior.
- Existing Excel import and research evidence.

## Deferred after Phase 2

- Unified Phaser room glow and advanced state effects.
- Draggable three-state mobile bottom sheet and mobile navigation.
- Presentation/demo mode.
- Result detail modal and approval mutations.
- Visual regression screenshot matrix.
- Bundle splitting, asset compression and formal performance measurements.
- ESLint setup and dedicated frontend component tests.

