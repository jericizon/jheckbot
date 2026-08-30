# Plan: CEO-Led Conference Room Workflow

## Overview

Make conversation chat route through the CEO. The CEO turns the request into a plan, gathers available agents in the conference room, and they discuss the plan before tasks are dispatched. The office visualizes this as agents moving into the conference room, talking, and then returning to work.

## Slices

### Slice 1: Conference room scene (done)
- `OfficeConferenceRoom.vue` now renders a table, decorative chairs, and places participants around it.
- `OfficeScene.vue` keeps `meetingAgents` as employees with `communicating`/`thinking` status.

### Slice 2: Route conversation messages to CEO
- Change `pages/conversations/[id].vue` to send the prompt to the project office's CEO endpoint (`/api/offices/{officeId}/ceo/messages`) instead of the Devin `sendMessage` endpoint.
- Load the project office in the conversation page (reuse `useOffices().getOrCreateByProject`).
- Display CEO/user chat in the right-side chat panel.

### Slice 3: CEO calls agents to the conference room
- Extend `CEOService.sendMessage` to:
  - Set selected idle agents to `communicating` status.
  - Emit `AGENT_UPDATED` events so the office re-renders.
  - Emit a short sequence of `AGENT_MESSAGE` events (agent-to-agent dialogue) while in the conference room.
  - Create tasks and a workflow run as it already does.
- Emit `CEO_DELEGATING` event when the meeting starts and `CEO_WAITING` when it ends.

### Slice 4: Animate agents walking and talking
- Add CSS transitions so agents visually move from their cubicle positions to the conference room seats.
- Use `AGENT_MESSAGE` events to populate speech bubbles above specific agents (`OfficeCharacter`).
- When the meeting ends, transition agents back to their cubicles.

### Slice 5: Dispatch and monitor tasks
- Wire `WorkflowEngine`/`TaskDispatcher` in `CEOService` (or a new orchestration endpoint) to assign tasks to agents.
- Update agent statuses to `working` as tasks start, `completed`/`failed` as they finish.
- The office shows agents back at their cubicles working with live status.

## Files likely touched
- `apps/web/app/pages/conversations/[id].vue`
- `apps/web/app/components/office/OfficeConferenceRoom.vue` (done)
- `apps/web/app/components/office/OfficeScene.vue`
- `apps/web/app/components/office/OfficeCharacter.vue`
- `apps/web/app/composables/useConversations.ts`
- `apps/web/app/composables/useCEOChat.ts`
- `apps/api/src/services/orchestration/CEOService.ts`
- `apps/api/src/services/orchestration/CEOPlanner.ts`
- `apps/api/src/services/orchestration/WorkflowEngine.ts`
- `apps/api/src/services/orchestration/TaskDispatcher.ts`
- `apps/api/src/controllers/ConversationController.ts`
- `apps/api/src/routes/conversation.routes.ts`

## Verification
- `pnpm --filter @jheckbot/web typecheck`
- `pnpm --filter @jheckbot/web test`
- `pnpm --filter @jheckbot/web build`
- `pnpm --filter @jheckbot/api typecheck`
- `pnpm --filter @jheckbot/api test`
