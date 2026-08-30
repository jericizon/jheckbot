# QA Report: Conference Room Zoom, Seated Brainstorm, CEO Joins

**Date:** 20260829
**Task:** When agents are in the conference room, zoom the view into the room, render each agent seated on a chair visibly brainstorming/planning, and have the CEO join too.

## Summary

The office conference-room meeting now zooms the scene into the conference room, seats every participant (including the CEO) on a visible chair around the table, shows brainstorming/planning props (whiteboard, sticky notes, laptop) plus per-agent thought bubbles, and routes the CEO into the room to lead the discussion. The CEO leaves the corner office during the meeting and returns when it ends.

## Verification Results

### Automated Checks

| Command | Result |
|---|---|
| `pnpm --filter @jheckbot/api typecheck` | Passed |
| `pnpm --filter @jheckbot/api test` | 725 tests passed |
| `pnpm --filter @jheckbot/web typecheck` | Passed |
| `pnpm --filter @jheckbot/web test` | 86 tests passed |
| `pnpm --filter @jheckbot/web build` | Built successfully |

### What Changed

- `apps/api/src/services/orchestration/CEOService.ts`
  - `holdMeeting` now includes the CEO as a meeting participant: the CEO is set to `communicating`, joins the room, and is restored to `idle` afterwards alongside employees.
  - `buildMeetingDialogue` accepts the CEO separately; when present the CEO opens the brainstorm ("Team, we need to handle...") and closes it ("Let's get to work."), leading the meeting.

- `apps/web/app/components/office/OfficeMiniFigure.vue`
  - Added a `seated` prop. When seated, the figure renders a chair back + seat behind the body and shorter bent legs (sitting pose), and uses the gentle idle bob instead of the walk bounce.

- `apps/web/app/components/office/OfficeCharacter.vue`
  - Added `seated` and `brainstorming` props; `seated` is forwarded to the mini figure.
  - A brainstorming thought bubble (💭, pulsing) shows above agents who are in a meeting but not currently speaking, so planning is visibly in progress between speech lines.

- `apps/web/app/components/office/OfficeConferenceRoom.vue`
  - Rebuilt seating: the CEO is placed at the head of the table (top center); employees fill the remaining seats around the oval.
  - Each participant is rendered `seated` with `is-ceo` inferred from role, so the CEO keeps crown/tie in the room.
  - During an active meeting the table shows planning props (sticky notes, a laptop) and a "Brainstorm" whiteboard appears behind the table.
  - Removed the decorative chair circles; chairs are now attached to each seated figure so they always align.

- `apps/web/app/components/office/OfficeScene.vue`
  - `meetingParticipants` now includes the CEO when the CEO's status is `communicating`/`thinking`; the corner office shows an "Away" placeholder while the CEO is in the meeting.
  - Added a zoom transform: while a meeting is active the inner scene scales 2.4x and pans so the conference room centers in the panel, with a 700ms ease transition; it returns to normal when the meeting ends.

- `apps/api/tests/office-orchestration.test.ts`
  - Fixed `FakeOfficeAgentRepository.update` to mirror the real repository (keep existing values for fields not provided) — previously `Object.assign` overwrote `name`/`role` with `undefined` on status-only updates.
  - Added E2E test: "CEO joins the conference room meeting and speaks first, then returns to idle" — verifies the CEO is in `CEO_DELEGATING` agentIds, is set to `communicating`, emits the first `AGENT_MESSAGE`, and is restored to `idle` after.

### Manual / Code Review

- **Zoom:** While a meeting runs the scene transitions (700ms ease) into a 2.4x scale centered on the conference room; the `overflow-hidden` scene clips the rest of the office so the room fills the panel. Reverts smoothly when the meeting ends.
- **Seated visuals:** Each participant renders in a seated pose with an attached chair back/seat; the CEO sits at the head of the table and retains crown/tie.
- **Brainstorming visibility:** Active meetings show a whiteboard, sticky notes, and a laptop on the table; non-speaking participants show a pulsing 💭 thought bubble, and speech bubbles still appear for `AGENT_MESSAGE` lines.
- **CEO movement:** The CEO leaves the corner office (replaced by an "Away" placeholder) for the duration of the meeting and returns after.
- **Accessibility:** New thought/idea bubbles are `aria-hidden`; the conference room keeps `aria-label="Conference room"`; character buttons retain their descriptive aria-labels.
- **No regressions:** Existing office, cubicle-layout, and orchestration tests pass unchanged (apart from the fake-repo correctness fix).

### Known Limitations

- Zoom is a CSS scale/pan of the whole scene; very large offices may show adjacent cubicles at the edges of the zoomed view (clipped by `overflow-hidden`).
- Agent movement between cubicle and conference room remains teleport-on-status-change (no smooth walk animation), consistent with the prior implementation.
- The zoom scale (2.4x) is tuned for the default panel size; extremely narrow mobile viewports may want a smaller scale.

### Files Changed

- `apps/api/src/services/orchestration/CEOService.ts`
- `apps/web/app/components/office/OfficeMiniFigure.vue`
- `apps/web/app/components/office/OfficeCharacter.vue`
- `apps/web/app/components/office/OfficeConferenceRoom.vue`
- `apps/web/app/components/office/OfficeScene.vue`
- `apps/api/tests/office-orchestration.test.ts`
- `docs/superpowers/qa/20260829_conference_room_zoom_seated_brainstorm.md` (new)

## Conclusion

All typecheck, test, and build commands pass. The conference room now zooms into view during meetings, seats all participants (including the CEO) on visible chairs with brainstorming props and thought bubbles, and the CEO leads the discussion before returning to the corner office.
