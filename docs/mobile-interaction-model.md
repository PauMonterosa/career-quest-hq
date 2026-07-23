# Mobile interaction model proposal

Phase 4 will use a scene-first model rather than shrinking the desktop inspector.

## Structure

1. Compact 52–60px product header.
2. HQ viewport preserving its 900:620 ratio.
3. Agent bottom sheet with collapsed, half and full snap points.
4. Bottom navigation for HQ, Tasks, Agents, Results and Documents.

## Selection flow

Tapping an agent highlights the character and room, shows a short speech bubble, and opens the collapsed sheet. The collapsed state exposes avatar, name, semantic status and one recommended action. Half height adds quick actions and result summary. Full height contains all capabilities, approval queue and history.

## Accessibility

The agent list remains an equivalent non-canvas route. Targets are at least 44px. Sheet controls are buttons with explicit expanded state. Escape minimizes the sheet when a keyboard is present. Motion respects reduced-motion preferences.

## Deferred implementation

Drag physics, snap points, mobile bottom navigation, camera assistance and full mobile result sheets are intentionally deferred until after Phase 2 review.

