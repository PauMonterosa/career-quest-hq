# Career Quest HQ — UI redesign audit

## Current strengths

- The five-room isometric HQ is distinctive and already connected to live agent state.
- Phaser provides working selection, pathfinding, task animation and contextual dialogue.
- Backend contracts are small and stable: agent selection and allow-listed skills are sufficient for the redesign.
- Results are structured rather than raw text, so they can support cards, sources and approval states.
- Agents remain accessible through the navigation strip when the canvas is not practical.

## Current hierarchy problems

- The scene, large inspector, in-scene result HUD and full result inside the inspector can compete simultaneously.
- The inspector mixes identity, actions and long results in one uninterrupted column.
- Branding occupies more vertical space than operational context.
- Repeated borders and uppercase labels give every surface similar visual weight.
- Selection, room, task and result are logically linked but do not share one consistent accent system.

## Responsive problems

- The global `360px` inspector column is rigid.
- The canvas uses a correct aspect ratio, but the surrounding shell does not allocate height responsively.
- Below 980px the inspector merely stacks under the scene; this is not yet the intended scene-first bottom-sheet model.
- Small text inside Phaser cannot respond to browser text settings.
- Several controls do not consistently meet a 44px touch target.

## Accessibility risks

- Canvas characters are pointer-accessible but not independently keyboard-focusable; the agent strip is the necessary equivalent route.
- Status is sometimes communicated by color without a reusable semantic label.
- Icon-like header controls previously had no accessible name.
- Motion did not consistently respect `prefers-reduced-motion`.
- Raw backend errors could be exposed without a user-focused recovery message.

## Components to preserve

- `OfficeScene`: navigation graph, agent sprites, room stations and task lifecycle.
- `GameCanvas` and `CareerQuestGame`: stable Phaser host boundary.
- `api/client`: current backend contract.
- Structured result renderers and safe approval messaging.

## Components to refactor

- `App` becomes an application shell and orchestration layer.
- `AgentPanel` becomes `AgentInspector`, with reusable hero, status and action cards.
- Action definitions move out of the inspector.
- Results move into a compact toast and collapsible drawer.
- Global state, room and agent colors move into central tokens.
- Header becomes a restrained product header with operational context.

## Migration plan

1. Introduce design tokens and shared state metadata without changing behavior.
2. Refactor header, layout, inspector and action cards.
3. Move result content into toast/drawer while retaining map feedback.
4. In later phases, add unified scene effects and the dedicated mobile bottom sheet.
5. Add presentation mode, advanced motion and visual regression screenshots after Phase 2 review.

