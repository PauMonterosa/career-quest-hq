# Career Quest HQ design system

## Principles

The HQ is the primary surface. UI chrome is quieter, functional and derived from the selected agent. Retro typography is reserved for branding and game labels; Inter handles operational content.

## Foundations

- Surfaces: background, scene frame, panel, raised card and overlay.
- Accent: selected agent color, used sparingly for focus, status and primary action.
- Spacing: 4px base scale exposed as `--space-*`.
- Radius: 8–18px for product UI; pixel-art assets remain crisp.
- Motion: 140ms fast, 220ms standard, 360ms scene transition.
- Focus: a visible two-ring outline that does not rely on color alone.

## Semantic agent states

| State | Color | Icon | Meaning |
| --- | --- | --- | --- |
| Idle | Neutral | ○ | Available |
| Walking | Blue | → | Moving to a station |
| Working | Gold | ◌ | Executing a task |
| Waiting approval | Violet | ! | User decision required |
| Completed | Green | ✓ | Result is available |
| Error | Red | × | Task needs attention |

The React badge and Phaser scene use the same labels. Animation is supplementary and disabled when reduced motion is requested.

## Component materials

- `PanelSurface`: low-contrast border, deep opaque fill, one ambient shadow.
- `CardSurface`: subtle inset highlight, no stacked heavy frame.
- `OverlaySurface`: high contrast, reserved for results and approval.
- `ActionButton`: verb-first label, 44px minimum target, visible focus.
- `GameLabel`: compact display font and uppercase only for metadata.

## Type scale

Tokens range from `--font-size-xs` through `--font-size-display` using `clamp()` for major headings. Body copy uses Inter with 1.45–1.6 line height.

## Phase boundary

Phase 2 establishes desktop and compact-tablet behavior. The documented mobile bottom sheet, advanced motion, presentation mode and screenshot matrix remain intentionally deferred until review.

