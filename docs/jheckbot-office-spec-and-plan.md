# JheckBot Office — Product Specification & Implementation Plan

**Status:** Proposed / Architecture Planning  
**Target:** Office Alpha  
**Repository:** `jericizon/jheckbot`

---

## 1. Executive Summary

JheckBot is being reimagined from a mobile-first AI coding chat interface into a **virtual software-development office**.

The office is a visual representation of a real multi-agent development system. The user primarily interacts with one special agent — the **CEO** — who understands requests, plans work, decomposes features into tasks, delegates to specialized employees, coordinates communication, requests QA/review/testing, handles failures, and reports results.

Employees are configurable AI agents. Users can:

- Create agents
- Name agents
- Assign roles/job titles
- Define responsibilities
- Define behavioral instructions
- Select provider/model
- Assign skills/tools
- Configure project access
- Eventually provide persistent memory and project knowledge

The office uses a simple **2D, 1990s-inspired virtual-office aesthetic**. Characters, cubicles, desks, computers, and office objects represent actual backend agent state.

The office is **not merely decoration**. It is a live operational dashboard for the orchestration system.

---

# 2. Product Vision

> Make software development feel like managing a small virtual engineering company where AI employees collaborate to build, test, review, and ship software.

The intended experience:

```text
USER
  |
  v
CEO
  |
  +--> understand request
  +--> create plan
  +--> create tasks
  +--> select employees
  +--> monitor work
  +--> coordinate agents
  +--> QA/review/test
  +--> recover failures
  |
  v
RESULT
```

The user should normally be able to say:

> "CEO, add Google login to this project."

and let the virtual team handle the workflow.

---

# 3. Product Principles

## 3.1 The office is the interface

The 2D office should expose the state of the real orchestration system.

Examples:

- Agent running → character appears busy
- Agent waiting → character appears idle
- Agent communicating → speech indicator
- QA failure → warning state
- Task completed → success state
- CEO planning → CEO activity state

Do not create fake activity unrelated to backend state.

## 3.2 CEO-first interaction

The primary interaction is with the CEO.

Users may inspect and manually interact with employees, but normal development requests flow through the CEO.

## 3.3 Agents are workers, not independent applications

Agents are controlled by JheckBot's orchestration layer.

Underlying providers remain responsible for actual coding execution.

Potential providers:

- Devin
- Claude Code
- Codex
- Gemini CLI
- Future providers

## 3.4 JheckBot remains the control plane

JheckBot owns:

- Projects
- Offices
- Employees
- Tasks
- Agent communication
- Workflow state
- Permissions
- History
- Events
- Notifications
- Orchestration

The provider owns:

- Code modification
- Shell commands
- Tests
- Browser automation
- Provider-specific work

## 3.5 Security before convenience

An AI coding agent capable of executing commands on the host is effectively a remote execution mechanism.

Existing project isolation and path validation must remain hard security boundaries.

---

# 4. Current Architecture to Preserve

The current JheckBot codebase already provides important foundations:

- Nuxt/Vue frontend
- Express API
- PostgreSQL
- Persistent conversations
- AgentManager
- AgentAdapter abstraction
- DevinAdapter
- tmux-based persistent sessions
- SSE event streaming
- Project path validation
- Authentication
- PWA/mobile support
- Push notification infrastructure
- Media support
- Git-related UI
- Provider abstraction

The Office project should **extend these systems rather than replace them**.

Current conceptual flow:

```text
User
  |
  v
Web UI
  |
  v
API
  |
  v
AgentManager
  |
  v
AgentAdapter
  |
  v
Provider
  |
  v
Project
```

Target flow:

```text
User
  |
  v
Office UI
  |
  v
CEO Conversation
  |
  v
CEO Orchestrator
  |
  +--> Requirement Analyzer
  +--> Task Planner
  +--> Agent Selector
  +--> Task Dispatcher
  +--> Workflow Engine
  +--> Recovery Manager
  |
  v
AgentManager
  |
  +--> DevinAdapter
  +--> CodexAdapter
  +--> ClaudeCodeAdapter
  +--> Future adapters
  |
  v
Project
```

---

# 5. Core Domain Model

Recommended hierarchy:

```text
User
 |
 +-- Offices
      |
      +-- Office
           |
           +-- Project
           +-- CEO
           +-- Employees
           +-- Tasks
           +-- Conversations
           +-- Events
```

For Office Alpha, an office may map closely to one project to reduce complexity.

---

# 6. CEO

## Purpose

The CEO is the primary orchestrator.

It should not perform most coding itself. Its primary job is:

> Understand, plan, delegate, monitor, verify, recover, and report.

## Responsibilities

### Requirements analysis

Convert user input into:

- Goal
- Requirements
- Constraints
- Acceptance criteria
- Unknowns

### Planning

Generate a structured implementation plan.

### Delegation

Determine:

- Required tasks
- Appropriate employee
- Dependencies
- Priority
- Parallelizable work

### Coordination

Monitor progress and coordinate employee communication.

### QA/review/testing

Ensure appropriate verification happens.

### Failure recovery

Handle:

- Agent failure
- Test failure
- Review rejection
- QA rejection
- Blocked tasks
- Conflicting results

### User escalation

Ask the user when:

- Requirements are ambiguous
- A destructive operation requires approval
- Credentials are needed
- Agents disagree
- Work is blocked
- An important architectural decision cannot safely be inferred

---

# 7. CEO Workflow

Standard lifecycle:

```text
USER REQUEST
     |
     v
UNDERSTAND
     |
     v
PLAN
     |
     v
CREATE TASKS
     |
     v
ASSIGN EMPLOYEES
     |
     v
EXECUTE
     |
     v
MONITOR
     |
     +------ failure ------+
     |                     |
     v                     |
REVIEW <-------------------+
     |
     v
QA
     |
     v
TEST
     |
     v
VERIFY
     |
     v
COMPLETE
     |
     v
REPORT TO USER
```

Not every request needs every stage.

---

# 8. Task Complexity

## Simple

Examples:

- Fix typo
- Rename variable
- Small CSS change

Possible flow:

```text
CEO -> Developer -> Test -> Done
```

## Medium

Examples:

- Add API endpoint
- Add UI feature
- Modify business behavior

Possible flow:

```text
CEO -> Developer -> QA -> Reviewer -> Done
```

## Complex

Examples:

- Authentication
- Payment integration
- Major architecture changes

Possible flow:

```text
CEO
 -> Research
 -> Planning
 -> Backend
 -> Frontend
 -> QA
 -> Security Review
 -> Integration Test
 -> Final Review
 -> Done
```

---

# 9. Employee / Agent Model

Each employee should have a configurable profile.

Recommended fields:

```text
Agent
├── id
├── officeId
├── name
├── role
├── description
├── avatar
├── personality
├── systemInstructions
├── responsibilities
├── capabilities
├── skills
├── tools
├── provider
├── model
├── permissions
├── projectAccess
├── status
├── enabled
├── createdAt
└── updatedAt
```

---

# 10. Agent Roles

Roles should be configurable rather than hardcoded.

Examples:

- Senior Backend Developer
- Frontend Developer
- Full-Stack Developer
- QA Engineer
- Security Reviewer
- Code Reviewer
- DevOps Engineer
- UI/UX Designer
- Database Specialist
- Technical Writer
- Researcher
- Product Manager

Example:

```text
Name: Alfred
Role: Senior Laravel Developer
```

---

# 11. Agent Training

The UI can call this **Train Employee**.

Initially, "training" means configurable context/instructions, not model fine-tuning.

Training/context consists of:

```text
Role
+
Responsibilities
+
Behavior
+
Rules
+
Project Knowledge
+
Examples
+
Skills
+
Tool permissions
+
Memory
```

Example:

```text
Employee: Alfred

Role:
Senior Backend Developer

Responsibilities:
- Implement Laravel APIs
- Write PHPUnit tests
- Review database queries
- Maintain backend architecture

Rules:
- Use TDD whenever practical
- Follow existing project conventions
- Do not introduce libraries without justification
- Never remove tests to make a build pass
- Report blockers instead of guessing

Personality:
Methodical and conservative
```

---

# 12. Agent Personality

Personality should influence communication style but must not override technical/security instructions.

Examples:

### Alfred

```text
Senior Backend Developer
Methodical
Test-first
Conservative
```

### Alice

```text
QA Engineer
Skeptical
Detail-oriented
Edge-case focused
```

### Bob

```text
Code Reviewer
Strict
Security-conscious
Architecture-focused
```

### Charlie

```text
Frontend Developer
Fast
Creative
UI-focused
```

---

# 13. Agent Capabilities

Capabilities are machine-readable skills used by the CEO.

Example:

```text
Alfred:
- PHP
- Laravel
- PostgreSQL
- REST
- PHPUnit

Alice:
- QA
- Playwright
- API testing
- Browser testing

Bob:
- Security
- Architecture
- Code review
```

Selection should consider:

```text
task requirements
+
capabilities
+
availability
+
project access
+
provider availability
```

Future ranking may include:

```text
historical success
task duration
workload
specialization
project familiarity
```

---

# 14. Agent Memory

Implement memory incrementally.

## V1

Task-local context.

## V2

Project knowledge.

Example:

```text
LunchOnline uses Sequelize, not Prisma.
Authentication uses session cookies.
API conventions use REST.
```

## V3

Persistent agent memory.

Example:

```text
Alfred previously discovered:
"Payment webhooks require idempotency checks."
```

Memory should be scoped:

```text
Global
Project
Agent
Task
```

---

# 15. Agent-to-Agent Communication

Agents should communicate through JheckBot.

Correct:

```text
Agent A
  |
  v
JheckBot Communication Layer
  |
  v
Agent B
```

Benefits:

- Auditability
- Permissions
- Persistence
- Event tracking
- Loop prevention
- Notifications
- CEO oversight

Avoid direct agent-to-agent process invocation.

---

# 16. Communication Model

Recommended structure:

```json
{
  "id": "message-id",
  "taskId": "task-id",
  "fromAgentId": "agent-a",
  "toAgentId": "agent-b",
  "type": "QUESTION",
  "content": "Should the endpoint return 404 or 403?",
  "metadata": {},
  "createdAt": "..."
}
```

Initial message types:

```text
TASK_ASSIGNED
TASK_STARTED
QUESTION
ANSWER
PROGRESS
HANDOFF
REVIEW_REQUESTED
REVIEW_RESULT
QA_REQUESTED
QA_RESULT
BLOCKED
ESCALATION
TASK_COMPLETED
TASK_FAILED
```

---

# 17. Tasks

Tasks are first-class entities.

Recommended fields:

```text
Task
├── id
├── officeId
├── projectId
├── parentTaskId
├── title
├── description
├── acceptanceCriteria
├── status
├── priority
├── assignedAgentId
├── createdBy
├── workflowType
├── metadata
├── startedAt
├── completedAt
├── createdAt
└── updatedAt
```

---

# 18. Task Statuses

```text
BACKLOG
PLANNING
READY
ASSIGNED
WORKING
BLOCKED
REVIEW
QA
TESTING
COMPLETED
FAILED
CANCELLED
```

Transitions must be validated by the backend.

---

# 19. Task Dependencies

Example:

```text
Task A
Database changes
   |
   v
Task B
Backend API
   |
   v
Task C
Frontend
   |
   v
Task D
QA
```

Model:

```text
task_dependencies
------------------
task_id
depends_on_task_id
```

A task must not be dispatched until required dependencies are satisfied.

---

# 20. Agent Selection

Initial algorithm:

```text
1. Determine required capabilities
2. Find enabled agents
3. Filter by project access
4. Filter by capability match
5. Filter unavailable agents
6. Rank candidates
7. Select best candidate
```

Keep the selection algorithm replaceable.

---

# 21. Orchestration Engine

Recommended modules:

```text
CEOOrchestrator
├── RequirementAnalyzer
├── TaskPlanner
├── AgentSelector
├── TaskDispatcher
├── WorkflowEngine
├── TaskMonitor
├── RecoveryManager
└── EscalationManager
```

Avoid one giant CEO service.

---

# 22. Workflow Engine

Example:

```text
Developer completes
        |
        v
Requires review?
   /          \
 yes           no
 |              |
 v              v
Reviewer       QA/Test
 |
 v
Approved?
 /      \
no       yes
|         |
v         v
Developer QA
          |
          v
         Done
```

The workflow should be data/state driven rather than hardcoded to one agent.

---

# 23. Failure Handling

## Agent failure

```text
Agent fails
   |
   v
CEO notified
   |
   +--> Retry
   |
   +--> Reassign
   |
   +--> Ask user
```

## QA failure

```text
QA fails
   |
   v
Create fix task
   |
   v
Developer
   |
   v
QA again
```

## Review rejection

```text
Reviewer rejects
   |
   v
Feedback sent to developer
   |
   v
Developer fixes
   |
   v
Review again
```

---

# 24. Loop Protection

Prevent autonomous infinite loops.

Controls:

```text
max task retries
max review cycles
max QA cycles
max workflow duration
max agent-to-agent messages per task
```

When thresholds are exceeded:

```text
ESCALATE_TO_USER
```

---

# 25. Human Approval Gates

Support explicit approval for risky operations.

Examples:

- Production deployment
- Destructive database operations
- Large-scale deletion
- Credential changes
- Billing changes
- Force push
- Destructive Git actions

The user should see a clear approval dialog.

Example:

```text
CEO:

The current payment library conflicts with the proposed implementation.

I recommend replacing it.

This affects 12 files.

[ Approve ]
[ Reject ]
[ Give CEO instructions ]
```

---

# 26. Virtual Office Concept

The office should feel like an original nostalgic 1990s/early-2000s PC game.

Visual categories:

- Pixel-art inspired characters
- Cubicles
- CRT monitors
- Desks
- Chairs
- Filing cabinets
- Plants
- Whiteboards
- Coffee machine
- Windows
- Doors
- Office carpet
- Small status indicators

Do not copy copyrighted game assets.

---

# 27. Visual Direction

Initial style:

- 2D
- Pixel-art inspired
- Small sprites
- Limited animation
- Nostalgic office atmosphere
- Simple readable UI
- Modern interaction patterns around retro visuals

The retro style should make coding feel fun without sacrificing usability.

---

# 28. Office Asset System

Initial assets:

```text
tiles/
  floor
  wall
  carpet
  window
  door

furniture/
  desk
  chair
  computer
  monitor
  cabinet
  plant
  whiteboard
  coffee-machine

characters/
  ceo
  developer
  qa
  reviewer
  devops
  designer

effects/
  speech-bubble
  notification
  thinking
  working
  success
  warning
  error
```

Assets should be replaceable without changing business logic.

---

# 29. Rendering Strategy

## Office Alpha

Do not introduce a full game engine immediately.

Start with:

```text
Nuxt
Vue
CSS
SVG
HTML
```

This is sufficient for:

- Fixed office layout
- Clickable employees
- Basic animations
- Speech bubbles
- Status indicators
- Panels
- Zoom

## Future

If requirements expand to:

- Tile maps
- Character movement
- Pathfinding
- Collision
- Advanced animation
- Interactive objects

consider Phaser.

Recommended progression:

```text
Alpha:
Vue + SVG/CSS

Beta:
Vue + Phaser
```

---

# 30. Office State

Office visuals must consume backend state.

Agent states:

```text
idle
thinking
working
communicating
reviewing
testing
blocked
error
completed
```

Mapping:

```text
WORKING
  -> typing animation

COMMUNICATING
  -> speech bubble

BLOCKED
  -> warning indicator

ERROR
  -> error animation

IDLE
  -> idle sprite

COMPLETED
  -> success animation
```

---

# 31. Office Interaction

Clicking the CEO:

- Opens CEO conversation

Clicking an employee:

- Opens profile
- Shows current task
- Shows status
- Shows recent activity
- Opens employee conversation if permitted

Clicking a task:

- Opens task details
- Shows dependencies
- Shows assigned employee
- Shows timeline
- Shows result

Clicking a warning:

- Opens blocker/error details

---

# 32. CEO UI

Example:

```text
+-------------------------------------------+
| 👔 CEO                                    |
|                                           |
| CEO: What should we build?                |
|                                           |
| User: Add Google login                    |
|                                           |
| CEO:                                      |
| I'll assign this to the authentication    |
| developer and have QA verify the flow.    |
|                                           |
+-------------------------------------------+
| [ Type a request...                  ]    |
+-------------------------------------------+
```

The current conversation architecture can be reused.

---

# 33. Activity Feed

Example:

```text
21:42 👔 CEO created implementation plan
21:43 👔 CEO assigned authentication to Alfred
21:44 🧑‍💻 Alfred started work
21:51 🧑‍💻 Alfred completed implementation
21:52 🧪 Alice started QA
21:55 🧪 Alice found 2 issues
21:57 🧑‍💻 Alfred received QA feedback
22:03 🧪 Alice approved
22:04 🔍 Bob started review
22:07 🔍 Bob approved
22:08 👔 CEO completed task
```

The feed must be backed by real events.

---

# 34. Office Dashboard

Desktop:

```text
+------------------------------------------------------+
| JHECKBOT       PROJECT: LUNCHONLINE       🔔 ⚙      |
+------------------------------------------------------+
|                                                      |
|                 VIRTUAL OFFICE                       |
|                                                      |
|                     👔 CEO                           |
|                                                      |
|  +------+      +------+      +------+                |
|  | DEV  |      | DEV  |      |  QA  |                |
|  +------+      +------+      +------+                |
|                                                      |
|  +------+                    +------+                |
|  |REVIEW|                    |DEVOPS|                |
|  +------+                    +------+                |
|                                                      |
+----------------------+-------------------------------+
| Active Tasks         | Activity                      |
|                      |                               |
| Auth       72%       | CEO assigned task             |
| Payment    34%       | Alfred started coding        |
| Dashboard queued     | Alice started QA             |
+----------------------+-------------------------------+
| 👔 Talk to CEO                                      |
+------------------------------------------------------+
```

---

# 35. Mobile Office

Mobile remains a primary experience.

```text
+-----------------------+
| JHECKBOT       🔔     |
+-----------------------+
|                       |
|        👔             |
|        CEO            |
|                       |
|   🧑‍💻       🧪        |
|   DEV       QA        |
|                       |
|        🔍             |
|      REVIEW           |
|                       |
+-----------------------+
| Active tasks: 3      |
+-----------------------+
| 💬 Talk to CEO       |
+-----------------------+
```

Future interactions:

- Pinch to zoom
- Pan around office
- Tap employee
- Tap task
- Tap CEO
- Swipe activity panel

---

# 36. Project Context

Each project should provide context to the CEO and employees.

Possible project knowledge:

```text
Project
├── repository path
├── stack
├── architecture notes
├── development rules
├── testing rules
├── deployment notes
├── environment notes
└── project memory
```

Projects remain outside the JheckBot repository.

---

# 37. Existing Project Isolation

Keep the existing allowed-root model.

Correct:

```text
Browser
  -> project ID
  -> backend resolves project
  -> PathValidator
  -> validated repository
  -> AgentManager
```

Never:

```text
Browser
  -> arbitrary filesystem path
  -> shell
```

---

# 38. Provider Architecture

Keep the existing provider abstraction.

Target:

```text
AgentManager
     |
     v
AgentProviderRegistry
     |
     +---- DevinAdapter
     +---- ClaudeCodeAdapter
     +---- CodexAdapter
     +---- GeminiAdapter
```

Agents specify:

```text
provider
model
```

The orchestration layer should not contain provider-specific CLI commands.

---

# 39. Devin Integration

The current Devin adapter should remain.

Orchestration should call generic interfaces:

```text
AgentManager.run(task)
```

rather than:

```text
CEOOrchestrator -> Devin CLI directly
```

This preserves provider independence.

---

# 40. Event Architecture

Events are central to the office.

```text
Agent
  |
  v
AgentManager
  |
  v
AgentEventService
  |
  +--> PostgreSQL
  +--> SSE
  +--> Push notifications
  +--> Office UI
```

---

# 41. Event Types

Initial events:

```text
OFFICE_CREATED

CEO_THINKING
CEO_PLANNING
CEO_DELEGATING
CEO_WAITING

TASK_CREATED
TASK_ASSIGNED
TASK_STARTED
TASK_BLOCKED
TASK_COMPLETED
TASK_FAILED

AGENT_STARTED
AGENT_PROGRESS
AGENT_MESSAGE
AGENT_COMPLETED
AGENT_FAILED

REVIEW_STARTED
REVIEW_APPROVED
REVIEW_REJECTED

QA_STARTED
QA_PASSED
QA_FAILED

WORKFLOW_COMPLETED
WORKFLOW_FAILED
USER_ACTION_REQUIRED
```

---

# 42. SSE

Extend existing SSE instead of replacing it.

Clients should be able to subscribe to:

```text
office events
task events
agent events
conversation events
```

Use event IDs and reconnection handling so mobile disconnects do not lose state.

---

# 43. Push Notifications

Use push notifications for important events only.

Examples:

```text
"CEO finished your task."

"QA found an issue."

"CEO needs your approval."

"Agent failed and needs attention."

"Deployment is ready for approval."
```

Do not notify for every low-level event.

---

# 44. Database Evolution

Recommended new tables:

```text
offices

agents

agent_capabilities

agent_memories

tasks

task_dependencies

agent_messages

workflow_runs

workflow_steps
```

Reuse existing tables where appropriate:

```text
projects
conversations
messages
agent_events
users
sessions
```

Do not duplicate existing concepts without a clear reason.

---

# 45. Suggested Agent Table

```text
agents
------
id
office_id
name
role
description
avatar
personality
instructions
provider
model
status
enabled
created_at
updated_at
```

---

# 46. Suggested Task Table

```text
tasks
-----
id
office_id
project_id
parent_task_id
title
description
acceptance_criteria
status
priority
assigned_agent_id
workflow_type
created_by
metadata
started_at
completed_at
created_at
updated_at
```

---

# 47. Suggested Communication Table

```text
agent_messages
--------------
id
office_id
task_id
from_agent_id
to_agent_id
type
content
metadata
created_at
```

---

# 48. Suggested Memory Table

```text
agent_memories
--------------
id
agent_id
project_id
scope
memory_type
content
importance
created_at
updated_at
```

Scopes:

```text
global
project
task
```

---

# 49. Workflow Tables

Potential model:

```text
workflow_runs
-------------
id
office_id
root_task_id
status
started_at
completed_at
metadata

workflow_steps
--------------
id
workflow_run_id
task_id
step_type
status
sequence
metadata
started_at
completed_at
```

Keep the first implementation simple and evolve the schema based on real workflow requirements.

---

# 50. API Direction

## Offices

```text
GET    /api/offices
POST   /api/offices
GET    /api/offices/:id
PATCH  /api/offices/:id
DELETE /api/offices/:id
```

## Agents

```text
GET    /api/offices/:id/agents
POST   /api/offices/:id/agents
GET    /api/agents/:id
PATCH  /api/agents/:id
DELETE /api/agents/:id
```

## Tasks

```text
GET    /api/offices/:id/tasks
POST   /api/offices/:id/tasks
GET    /api/tasks/:id
PATCH  /api/tasks/:id
POST   /api/tasks/:id/cancel
POST   /api/tasks/:id/retry
```

## CEO

```text
POST /api/offices/:id/ceo/messages
GET  /api/offices/:id/ceo/events
```

## Task/agent communication

```text
GET /api/tasks/:id/messages
```

## Office events

```text
GET /api/offices/:id/events
```

Adapt these to existing JheckBot API conventions rather than blindly replacing current routes.

---

# 51. Frontend Architecture

Recommended additions:

```text
apps/web/app/

components/
  office/
    OfficeView.vue
    OfficeMap.vue
    OfficeTile.vue
    OfficeFurniture.vue
    OfficeCharacter.vue
    OfficeSpeechBubble.vue
    OfficeStatusIndicator.vue

  agents/
    AgentCard.vue
    AgentProfile.vue
    AgentEditor.vue
    AgentTraining.vue
    AgentCapabilities.vue

  tasks/
    TaskPanel.vue
    TaskCard.vue
    TaskTimeline.vue
    TaskDependencyGraph.vue

  ceo/
    CEOChat.vue
    CEOStatus.vue
    CEOPlan.vue

  activity/
    ActivityFeed.vue
    ActivityItem.vue

composables/
  useOffice.ts
  useOfficeEvents.ts
  useAgents.ts
  useTasks.ts
  useCEO.ts
  useAgentCommunication.ts
```

---

# 52. Frontend State

The backend remains the source of truth.

```text
Initial API state
       |
       v
Office state
       |
       +---- agents
       +---- tasks
       +---- CEO
       +---- events
       |
       v
SSE updates
       |
       v
Reactive UI
```

---

# 53. Office Visual State Mapping

```text
backend state       visual state

idle                idle animation
thinking            thinking animation
working             typing animation
communicating       speech bubble
reviewing           reading/document animation
testing             testing indicator
blocked             warning icon
error               error state
completed           success animation
```

Make this mapping data-driven.

---

# 54. Agent Creation Experience

User flow:

```text
Office
  |
  v
+ Add Employee
  |
  v
Choose avatar
  |
  v
Name employee
  |
  v
Define role
  |
  v
Define responsibilities
  |
  v
Add instructions
  |
  v
Select provider/model
  |
  v
Select capabilities
  |
  v
Save
```

---

# 55. Agent Training UI

Recommended tabs:

```text
[Profile]
[Role]
[Instructions]
[Skills]
[Tools]
[Memory]
[Permissions]
```

Example:

```text
TRAIN ALFRED

Role
[ Senior Backend Developer ]

Responsibilities
+ Laravel development
+ API development
+ Database work
+ Automated testing

Instructions
[ ... ]

Skills
[ Laravel ] [ PHP ] [ PostgreSQL ]

Provider
[ Devin ]

Model
[ ... ]

Permissions
[ Project workspace ]
```

---

# 56. CEO Configuration

CEO can have configurable personality and behavior.

Settings:

```text
CEO Name
CEO Avatar
Personality
Planning style
Risk tolerance
Approval policy
Maximum parallel agents
Maximum retries
Default QA requirement
Default review requirement
```

Core security controls must not be disabled by ordinary personality/configuration settings.

---

# 57. Parallel Execution

Support parallel tasks when dependencies allow.

Example:

```text
             CEO
              |
          Auth feature
              |
      +-------+-------+
      |               |
      v               v
 Backend API       Frontend UI
      |               |
      +-------+-------+
              |
              v
              QA
```

Respect office/provider concurrency limits.

---

# 58. Concurrency

Initial target:

```text
maxConcurrentAgents = 3
```

This should build on existing concurrency controls.

Later:

```text
Office setting:
Maximum concurrent agents: 1-10
```

---

# 59. Agent Workload

CEO should know:

```text
Alfred:
2 active tasks

Alice:
1 active task

Bob:
idle
```

Future scheduling can consider workload.

---

# 60. Results and Artifacts

Completed tasks should expose structured results:

```text
Task Result

Summary
Implemented Google OAuth login.

Files changed
12

Tests
42 passed
0 failed

Review
Approved

QA
Passed

Git
3 commits

Warnings
None
```

Reuse existing Git/media functionality where possible.

---

# 61. Git Workflow

Potential workflow:

```text
Agent
 ↓
changes
 ↓
tests
 ↓
review
 ↓
Git diff
 ↓
optional commit
 ↓
optional push
```

Dangerous Git actions require explicit permission according to configured policy.

---

# 62. QA Workflow

QA should be a real workflow role.

```text
Developer:
Implementation complete

CEO:
Assign QA

QA:
- Reads acceptance criteria
- Reviews changes
- Runs tests
- Tests edge cases
- Reports defects

CEO:
If failed -> Developer
If passed -> Review/Complete
```

---

# 63. Testing Strategy

JheckBot orchestration features should use TDD.

## Unit tests

- Agent selection
- Task transitions
- Dependency resolution
- Retry policy
- Workflow decisions
- Message validation
- Escalation logic

## Integration tests

- CEO -> task creation
- Task -> agent assignment
- Agent completion -> workflow progression
- QA failure -> fix workflow
- Review rejection -> retry workflow

## API tests

- Authentication
- Office CRUD
- Agent CRUD
- Task CRUD
- SSE/events

## End-to-end

At least one complete flow:

```text
User request
 -> CEO
 -> Developer
 -> QA
 -> completion
```

Use mocked agent adapters for deterministic tests.

---

# 64. Agent Provider Testing

Do not make orchestration tests depend on a real Devin account.

Create:

```text
FakeAgentAdapter
```

for deterministic tests.

Provider adapters can have separate integration tests.

---

# 65. Migration Strategy

Do not rewrite JheckBot.

Migrate incrementally.

## Step 1

Keep current:

```text
Conversation
Message
AgentManager
DevinAdapter
SSE
Project
```

working.

## Step 2

Add:

```text
Agent profiles
Tasks
Agent messages
CEO orchestration
```

## Step 3

Add office UI.

## Step 4

Connect office visuals to live events.

## Step 5

Make CEO the default entry point.

## Step 6

Keep direct agent/conversation access as an advanced feature.

---

# 66. Compatibility Requirement

The existing chat system must continue working during migration.

The new office should initially be another interface over the existing agent infrastructure.

This allows rollback and incremental testing.

---

# 67. Recommended Repository Evolution

Backend:

```text
apps/api/src/

agent/
  AgentAdapter.ts
  AgentManager.ts
  AgentProviderRegistry.ts
  DevinAdapter.ts

orchestration/
  CEOOrchestrator.ts
  RequirementAnalyzer.ts
  TaskPlanner.ts
  TaskDispatcher.ts
  AgentSelector.ts
  WorkflowEngine.ts
  RecoveryManager.ts
  EscalationManager.ts

agents/
  AgentService.ts
  AgentRepository.ts
  AgentMemoryService.ts
  AgentCapabilityService.ts

tasks/
  TaskService.ts
  TaskRepository.ts
  TaskDependencyService.ts

communications/
  AgentMessageService.ts

events/
  OfficeEventService.ts

office/
  OfficeService.ts
  OfficeRepository.ts

projects/
conversations/
media/
git/
auth/
```

Frontend:

```text
apps/web/app/

components/
  office/
  agents/
  tasks/
  ceo/
  activity/
  git/

pages/
  office/
  agents/
  tasks/

composables/
  useOffice.ts
  useOfficeEvents.ts
  useCEO.ts
  useAgents.ts
  useTasks.ts
```

---

# 68. Implementation Roadmap

## Phase 0 — Specification

Deliver:

```text
docs/office/product-spec.md
docs/office/architecture.md
docs/office/domain-model.md
docs/office/orchestration.md
docs/office/agent-system.md
docs/office/communication.md
docs/office/events.md
docs/office/ui.md
docs/office/roadmap.md
```

No major implementation changes yet.

---

## Phase 1 — Agent Profiles

Implement:

- Agent CRUD
- Names
- Roles
- Avatars
- Instructions
- Personality
- Provider
- Model
- Capabilities
- Enable/disable

Do not implement the visual office yet.

---

## Phase 2 — Task Engine

Implement:

- Task CRUD
- Status transitions
- Assignment
- Dependencies
- Priority
- Acceptance criteria
- Task history

Test every transition.

---

## Phase 3 — Agent Communication

Implement:

- Agent messages
- Message types
- Persistence
- Authorization
- Event emission
- Message history

---

## Phase 4 — CEO Orchestrator

Implement:

```text
CEO request
 -> plan
 -> tasks
 -> assignments
 -> execution
 -> monitoring
 -> QA
 -> review
 -> completion
```

Start with deterministic/simple orchestration rules.

---

## Phase 5 — Office UI Prototype

Build:

- Fixed 2D office
- Retro assets
- CEO
- 3 employees
- Clickable characters
- Basic animations
- Status indicators

Mock state is acceptable during this phase.

---

## Phase 6 — Live Office

Connect:

```text
AgentManager
 -> Events
 -> SSE
 -> Office UI
```

Now visual activity represents real agent activity.

---

## Phase 7 — CEO UI

Make CEO the main interaction point.

User sends:

```text
"Implement feature X"
```

CEO creates the workflow.

The office visualizes it.

---

## Phase 8 — QA and Review Automation

Add:

- QA agent
- Review agent
- Test gates
- Review gates
- Retry behavior
- Escalation

---

## Phase 9 — Notifications

Connect important events to push notifications.

---

## Phase 10 — Visual Polish

Only after orchestration is stable:

- Better sprites
- Better animations
- Office ambience
- Sound effects
- Character movement
- Zoom
- Furniture
- Themes
- Mobile polish

---

# 69. Office Alpha Scope

Keep Office Alpha deliberately small.

### Required

- 1 CEO
- 3–5 employees
- 1 project at a time
- 1–3 concurrent agents
- Basic task dependencies
- Basic QA
- Basic review
- Devin provider
- Simple 2D office
- Employee profiles
- CEO chat
- CEO planning
- Agent assignment
- Agent communication
- Live status
- Activity feed
- Existing project isolation
- Existing authentication
- Existing SSE
- Existing conversation persistence

### Do not build yet

- 3D
- Multiplayer
- Complex AI memory
- Fine-tuning
- XP/economy systems
- Procedural offices
- Advanced pathfinding
- Autonomous hiring
- SaaS multi-tenancy
- Dozens of agent types

---

# 70. Example End-to-End Scenario

User:

> CEO, add password reset to my application.

CEO:

```text
I'll break this into:

1. Analyze current authentication
2. Implement password reset API
3. Add email/token flow
4. Add frontend screens
5. Add automated tests
6. Run QA
7. Perform security review
```

Office:

```text
CEO -> Researcher
CEO -> Backend Developer
CEO -> Frontend Developer
```

Backend:

```text
working...
```

Frontend:

```text
working...
```

Researcher:

```text
completed
```

Backend and frontend finish.

CEO assigns QA.

QA reports:

```text
Expired tokens are still accepted.
```

CEO sends feedback to backend.

Backend fixes it.

QA passes.

Reviewer checks security.

Reviewer approves.

CEO reports:

```text
Password reset is complete.

Backend:
✓ Implemented

Frontend:
✓ Implemented

Tests:
✓ Passed

QA:
✓ Passed

Security review:
✓ Approved
```

The office should visually represent these events.

---

# 71. Long-Term Vision

Eventually JheckBot can support:

## Hiring

User:

> I need a PostgreSQL specialist.

CEO:

> I'll create one.

## Specialization

Employees become specialized.

## Project knowledge

Employees understand project architecture.

## Memory

Employees remember decisions.

## Multiple providers

Different employees use different AI providers.

## Multiple projects

An office can manage several projects.

## Remote workers

Agents can execute on remote machines.

## Visual simulation

Agents can move around the office and interact with objects.

## Office customization

Users customize:

- Office layout
- Furniture
- Characters
- Names
- Departments
- Themes

---

# 72. Open Source Positioning

Potential positioning:

> **JheckBot — Your virtual AI software development office.**

Core differentiators:

- Self-hosted
- Local-first
- Provider-agnostic
- Mobile-first
- Visual agent office
- Human-controlled
- Project filesystem isolation
- Persistent agent sessions
- Multi-agent orchestration

The retro office can become the product's recognizable identity.

---

# 73. Long-Term Architecture

```text
                           JHECKBOT
                              |
                    +---------+---------+
                    |                   |
                  Office             Projects
                    |                   |
              +-----+-----+             |
              |           |             |
             CEO       Employees        |
              |           |             |
              +-----+-----+             |
                    |                   |
              Orchestration             |
                    |                   |
       +------------+-------------+     |
       |            |             |     |
     Tasks      Communication   Memory  |
       |            |             |     |
       +------------+-------------+     |
                    |                   |
                AgentManager            |
                    |                   |
       +------------+-------------+     |
       |            |             |     |
     Devin        Codex        Claude    |
       |            |             |     |
       +------------+-------------+     |
                    |                   |
                 Git Repo <-------------+
```

---

# 74. Coding-Agent Implementation Rules

When using an AI coding agent to implement this project:

1. Read the relevant Office specification before coding.
2. Inspect existing architecture first.
3. Do not rewrite working subsystems unnecessarily.
4. Preserve project isolation.
5. Preserve AgentManager as the provider execution boundary.
6. Keep provider-specific logic inside provider adapters.
7. Use TDD for new orchestration behavior.
8. Keep migrations incremental.
9. Preserve backwards compatibility where practical.
10. Implement one milestone at a time.
11. Use fake/mock agent adapters for orchestration tests.
12. Do not replace the current chat system until Office Alpha is stable.
13. Document architectural decisions.
14. Avoid speculative features outside the assigned milestone.
15. Do not generate unnecessary schema code if the current task does not require it.

---

# 75. Recommended Coding-Agent Task Sequence

Do not give an AI agent the entire Office project as one implementation request.

Use:

```text
01 - Domain model
02 - Agent profile backend
03 - Agent profile API tests
04 - Agent profile UI
05 - Task domain model
06 - Task API
07 - Task tests
08 - Agent communication
09 - CEO planner
10 - Agent selector
11 - Task dispatcher
12 - Workflow engine
13 - Failure recovery
14 - QA workflow
15 - Review workflow
16 - Office UI prototype
17 - Live office event integration
18 - CEO UI
19 - Mobile office UX
20 - End-to-end orchestration tests
21 - Notifications
22 - Visual polish
```

Each task should be independently testable.

---

# 76. Office Alpha Definition of Done

Office Alpha is complete when:

- User can create an office/project
- User can create employees
- User can configure roles/instructions
- CEO is available
- User can talk to CEO
- CEO can create a plan
- CEO can create tasks
- CEO can assign tasks
- Employees can execute through existing agent infrastructure
- Employees can communicate through JheckBot
- Tasks have validated states
- Dependencies work
- QA can approve/reject work
- Review can approve/reject work
- CEO can recover from common failures
- Office UI reflects actual agent state
- SSE reconnect works
- Existing project isolation remains enforced
- Existing authentication remains enforced
- Existing chat remains usable
- Tests cover orchestration behavior

---

# 77. Success Criteria

JheckBot should eventually make the user feel:

> **"I have my own little software company running on my machine."**

The user should be able to open JheckBot from a phone, see the office, talk to the CEO, and watch a real virtual development team execute work.

The visual layer creates engagement.

The orchestration engine provides actual value.

The combination is the product.

---

# 78. Guiding Principle

> **Do not build a game that happens to control AI agents. Build a real AI orchestration system that happens to look like a game.**

If the office is visually fun but orchestration is fake, JheckBot becomes a gimmick.

If orchestration is powerful but the office is merely decorative, JheckBot becomes another AI coding dashboard.

The goal is both:

**A real autonomous development team presented as a living virtual office.**
