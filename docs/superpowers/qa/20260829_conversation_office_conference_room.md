# QA Report: CEO-Led Conference Room Workflow

**Spec:** `docs/superpowers/plans/20260829_conversation_office_conference_room.md`  
**Plan:** `docs/superpowers/plans/20260829_conversation_office_conference_room.md`  
**Date:** 20260829

## Summary

Conversation chat now routes through the project CEO. The CEO turns the request into a plan, calls idle agents into the conference room, the agents exchange short dialogue, and then the workflow dispatches tasks. The office visualizes this with a conference table, agents gathered around it, and speech bubbles during the meeting.

## Verification Results

### Automated Checks

| Command | Result |
|---|---|
| `pnpm --filter @jheckbot/web typecheck` | Passed |
| `pnpm --filter @jheckbot/web test` | 86 tests passed |
| `pnpm --filter @jheckbot/web build` | Built successfully |
| `pnpm --filter @jheckbot/api typecheck` | Passed |
| `pnpm --filter @jheckbot/api test` | 724 tests passed |

### What Changed

- `apps/web/app/components/office/OfficeConferenceRoom.vue`
  - Rebuilt as a conference room with a table, decorative chairs, and agents positioned around the table.
  - Always renders the table; shows participants when agents are in `communicating`/`thinking` status.
  - Supports an `messages` map so each participant can show a speech bubble.

- `apps/web/app/components/office/OfficeCharacter.vue`
  - Added an optional `message` prop.
  - When a message is provided, the speech bubble shows that text instead of a generic `...`/`💬`.
  - Bubble shape switched to `rounded-2xl` with wrapping so longer messages fit.

- `apps/web/app/components/office/OfficeCubicle.vue` / `OfficeCornerOffice.vue`
  - Pass through the `message` prop to `OfficeCharacter`.

- `apps/web/app/components/office/OfficeScene.vue`
  - Added `agentMessages` prop and forwards messages to cubicle/CEO characters and the conference room.
  - `meetingAgents` now uses only employees (not the CEO), so the CEO stays in the corner office.

- `apps/web/app/components/office/ConversationOfficePanel.vue`
  - Subscribes to office events and stores the latest `AGENT_MESSAGE` per agent in `agentMessages`.
  - Emits the loaded office to the parent conversation page.

- `apps/web/app/pages/conversations/[id].vue`
  - Sends the prompt to the project CEO instead of starting a Devin agent session.
  - Appends the user and CEO response to the chat, and shows the planned task list in the live output.
  - Placeholder text changed from "Message Devin..." to "Message CEO...".

- `apps/api/src/services/orchestration/CEOService.ts`
  - After creating a plan, `sendMessage` kicks off a background `holdMeeting`.
  - `holdMeeting` calls idle employees to the conference room (`communicating` status), emits `AGENT_MESSAGE` dialogue with short delays, returns agents to `idle`, then starts a `WorkflowEngine` run to dispatch tasks.

- `apps/api/src/app.ts`
  - Wired `WorkflowEngine`, `TaskDispatcher`, `AgentSelector`, and `WorkflowRunRepository`.
  - Passed `OfficeAgentService` and `WorkflowEngine` to `CEOService`.

### Manual / Code Review

- **Conference room:** A visible table and chairs now occupy the right mid-zone. Agents in `communicating` status appear seated around the table.
- **Agent dialogue:** `AGENT_MESSAGE` events appear as speech bubbles above the speaking agent, both in the conference room and at cubicles.
- **Conversation flow:** User messages are delivered to the CEO; the CEO responds with a plan and tasks.
- **Office live updates:** `AGENT_UPDATED` events trigger the `ConversationOfficePanel` to reload agents, so agents appear to move into and out of the conference room as their status changes.
- **Workflow dispatch:** After the meeting, the workflow engine dispatches tasks to selected agents and sets them to `working` status.
- **Accessibility:** Conference room has `aria-label="Conference room"`; speech bubbles are `aria-hidden` because the name tag and status already convey the agent state.
- **Dark mode / tokens:** All surfaces use existing semantic tokens.

### Known Limitations

- CEO messages in the conversation chat are not persisted as conversation messages; on full page refresh only the original Devin conversation history is loaded. New CEO messages are appended in-session.
- The conversation page does not yet listen to office workflow completion, so the "Processing" indicator stays active until the user navigates away or the page is refreshed.
- The stop-agent button still calls the Devin stop endpoint and does not stop the CEO workflow.
- Task completion is not automated; the workflow dispatches tasks but relies on external status updates to advance.
- Agent movement is teleport-based on status change, not smooth CSS walks.

### Files Changed

- `apps/web/app/pages/conversations/[id].vue`
- `apps/web/app/components/office/ConversationOfficePanel.vue`
- `apps/web/app/components/office/OfficeScene.vue`
- `apps/web/app/components/office/OfficeCharacter.vue`
- `apps/web/app/components/office/OfficeCubicle.vue`
- `apps/web/app/components/office/OfficeCornerOffice.vue`
- `apps/web/app/components/office/OfficeConferenceRoom.vue`
- `apps/api/src/services/orchestration/CEOService.ts`
- `apps/api/src/app.ts`
- `docs/superpowers/plans/20260829_conversation_office_conference_room.md` (new)
- `docs/superpowers/qa/20260829_conversation_office_conference_room.md` (new)

## Conclusion

All typecheck, test, and build commands pass. The conversation page now routes chat through the CEO, the office renders a conference room where agents gather and talk, and the backend orchestrates a meeting followed by task dispatch.
