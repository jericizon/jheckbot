# Spec: Conversation Office Panel

## Objective

Add a persistent, live office panel to the right side of the conversation page (`/conversations/:id`) so users can see the project's agent characters moving while a conversation is running.

The office panel reuses the existing project-office workspace and `OfficeScene` components. It is a desktop-first split view; mobile keeps the existing full-width chat for the first version.

## User stories

- As a user in a conversation, I see the project office beside the chat so I can watch sub-agents at a glance.
- As a user waiting for a response, I see the characters bob, walk, and talk so the running process feels alive.
- As a user on a small screen, the chat remains usable (office panel hidden).

## Acceptance criteria

1. On `/conversations/:id` at `xl:` breakpoint and up, the layout is split: chat on the left, office panel on the right.
2. The office panel fetches the project office via existing `GET /api/projects/:projectId/office`.
3. The panel displays the CEO in the corner office and employees in cubicles using existing `OfficeScene`.
4. Characters always have a subtle idle bob so the office feels alive.
5. When an agent status is `working`, `thinking`, `communicating`, `reviewing`, or `testing`, the character walks/bobs with a speech bubble.
6. When the conversation is `agentRunning` or `agentStarting`, the whole office shows a subtle busy pulse (faster bob, CEO thinking bubble) as visual feedback.
7. Mobile (`< xl:`) shows the existing full-width chat and no panel.
8. All existing tests pass; typecheck passes.

## Tech Stack

- Vue 3, Nuxt 4, TypeScript, Tailwind CSS
- Reuse: `OfficeScene`, `OfficeCharacter`, `OfficeMiniFigure`, `OfficeCubicle`, `useOffices`, `useOfficeEvents`

## Files

### New

- `apps/web/app/components/office/ConversationOfficePanel.vue`
- `apps/web/tests/conversation-office-panel.test.ts`
- `apps/web/app/components/office/AgentSpeechBubble.vue` (optional, can inline)

### Modified

- `apps/web/app/pages/conversations/[id].vue` — split layout, pass `busy` state
- `apps/web/app/components/office/OfficeScene.vue` — add `compact` and `busy` props
- `apps/web/app/components/office/OfficeCharacter.vue` — add talking/walking animations and speech bubble
- `apps/web/app/components/office/OfficeCubicle.vue` — forward `busy`
- `apps/web/app/components/office/OfficeMiniFigure.vue` — talking mouth animation, busy pulse
- `apps/web/tailwind.config.js` — new `talk` and `busy-bob` keyframes

## Boundaries

### In scope

- Conversation page side panel
- Character liveliness (idle bob, walk-bounce, speech bubble)
- Conversation busy state visual feedback

### Out of scope

- Office panel on project/home/agents pages
- Mobile drawer/toggle for the office panel
- Backend changes
- Real task assignment from conversation (uses existing office status)
- Animated walking between cubicles

## Design notes

- Right panel width: `w-72` on `lg:`, `w-80` on `xl:`.
- Panel is `hidden xl:flex` for the first version; `lg:` expansion can come later.
- Speech bubble is a small `...` or `💬` badge above the character head; `aria-hidden` since it is decorative.
- Busy pulse does not mutate agent data; it is a UI-only overlay that nudges animation speed when the main assistant is running.
