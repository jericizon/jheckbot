# JheckBot — Virtual AI Software Office

## Visual Recreation & Simulation Specification

You are building the visual environment for **JheckBot**, an original local-first multi-agent coding assistant.

The goal is to create a highly polished **2D top-down pixel-art virtual software office** where AI coding agents appear as employees working inside a persistent office.

The office is not merely decorative.

It is a visual representation of an underlying multi-agent system. Agents should visibly move, work, communicate, wait, review, collaborate, and complete tasks.

The visual experience should feel like a small living software company rather than a conventional dashboard.

---

# 1. IMPORTANT CREATIVE DIRECTION

Create an ORIGINAL visual identity.

The project may take inspiration from:

* classic SNES-era RPGs
* classic life simulation games
* top-down pixel-art office games
* cozy 1990s/early-2000s game interfaces
* Animal Crossing-style warmth
* EarthBound-style chunky UI
* classic pixel simulation games

However:

DO NOT copy:

* The Office characters
* Dunder Mifflin
* Munder Difflin branding
* copyrighted character sprites
* logos
* exact artwork
* exact office floor layout
* proprietary assets
* recognizable characters
* exact UI assets

JheckBot must have its own original characters, office, furniture, colors, logo, terminology and visual identity.

The target is the SAME CATEGORY and EXPERIENCE of a living pixel-art software office, not a copy of another project's artwork.

---

# 2. CORE EXPERIENCE

The user should feel like they are looking into a small AI software company.

Example:

The user sends:

"Add authentication to my application."

JheckBot's CEO receives the task.

The CEO evaluates the task.

The CEO delegates it to the Backend Developer.

The Backend Developer walks from their desk to the work area.

The Backend Developer begins working.

A QA agent later receives a review request.

An envelope visually travels between the agents.

The QA agent reviews the implementation.

If there is a problem, the QA agent sends a message back.

The CEO coordinates the correction.

Eventually the task becomes complete.

The user can watch this entire process visually.

The office therefore acts as a real-time visualization of the agent system.

---

# 3. CAMERA

Use a fixed top-down / slightly elevated orthographic-style camera.

The environment should look like a classic 2D simulation game.

Do NOT create:

* a first-person perspective
* a 3D office
* photorealism
* modern SaaS dashboard styling
* excessive gradients
* glassmorphism

The camera should clearly show:

* walls
* floor
* desks
* furniture
* characters
* workstations
* meeting areas
* corridors
* decorative objects

The camera should support:

* pan
* zoom
* optional reset-to-office
* smooth but subtle movement

Pixel artwork must remain crisp when zoomed.

NEVER blur pixel art.

---

# 4. PIXEL ART STYLE

Use a deliberate pixel-art aesthetic.

Characteristics:

* hard pixel edges
* nearest-neighbor scaling
* no anti-aliasing on pixel artwork
* no CSS blur
* no unnecessary shadows
* no smooth vector illustrations
* chunky silhouettes
* small color palette
* readable sprites
* clear separation between objects

The world should feel authored rather than procedurally generated.

Avoid making every object a generic rectangle.

Furniture should have personality.

---

# 5. GRID SYSTEM

Build the world using a consistent logical grid.

Use a tile-based coordinate system.

Recommended:

* logical tile size: 16x16 or 24x24 pixels
* world coordinates aligned to the tile grid
* characters positioned on the same logical grid
* furniture snapped to grid
* walls snapped to grid
* navigation paths snapped to grid

Never allow arbitrary floating positions for static objects.

The world should remain visually aligned.

---

# 6. OFFICE FLOOR

Create a complete small software-company office.

Suggested layout:

```text
┌──────────────────────────────────────────────────────────────┐
│                     JHECKBOT HQ                              │
│                                                              │
│   ┌─────────────┐                  ┌────────────────────┐    │
│   │ CEO OFFICE  │                  │ ENGINEERING        │    │
│   │             │                  │                    │    │
│   │   🧑‍💼      │                  │ 💻 Dev 1           │    │
│   │             │                  │ 💻 Dev 2           │    │
│   └─────────────┘                  │ 💻 Dev 3           │    │
│                                    └────────────────────┘    │
│                                                              │
│            ┌───────────────────────────────┐                 │
│            │        COLLABORATION          │                 │
│            │          AREA                 │                 │
│            │                               │                 │
│            │       meeting table           │                 │
│            └───────────────────────────────┘                 │
│                                                              │
│   ┌─────────────────┐             ┌──────────────────────┐   │
│   │ QA DEPARTMENT   │             │ DESIGN / FRONTEND    │   │
│   │                 │             │                      │   │
│   │ 🧪 QA           │             │ 🎨 Designer          │   │
│   │ 🧪 QA           │             │ 💻 Frontend          │   │
│   └─────────────────┘             └──────────────────────┘   │
│                                                              │
│   ┌───────────────┐                 ┌───────────────────┐    │
│   │ SERVER ROOM   │                 │ BREAK AREA        │    │
│   │               │                 │                   │    │
│   │ 🖥 servers    │                 │ ☕ coffee         │    │
│   └───────────────┘                 └───────────────────┘    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

This is only a conceptual layout.

Design a visually pleasing original office rather than literally reproducing this ASCII arrangement.

---

# 7. ROOMS

Include:

### CEO / Command Room

Contains:

* CEO desk
* computer
* chair
* bookshelf
* task board
* small plants
* communication monitor
* decorative objects

The CEO should feel visually important without becoming oversized.

---

### Engineering

Contains several developer desks.

Each workstation should contain:

* desk
* monitor
* keyboard
* chair
* small accessories
* optional desk lamp
* optional plant
* cable details

Each developer can have a slightly different desk arrangement.

---

### QA

Contains:

* QA desks
* test monitors
* bug board
* testing station
* small filing cabinet

---

### Design / Frontend

Contains:

* monitors
* design board
* color samples
* sketches
* frontend workstation

---

### Collaboration Room

Contains:

* large meeting table
* chairs
* whiteboard
* planning board

Agents should be able to walk here for meetings.

---

### Server Room

Contains:

* server racks
* blinking indicators
* cables
* cooling equipment

This room should have subtle animated effects.

---

### Break Area

Contains:

* coffee machine
* refrigerator
* table
* chairs
* snacks
* plants

Agents can occasionally visit this area when idle.

---

# 8. WALLS AND ENVIRONMENT

Create visually detailed walls.

Include:

* doors
* windows
* wall decorations
* signs
* shelves
* posters
* plants
* clocks
* lights

Windows can show a subtle outside environment.

Do not make the entire office flat.

Use small details to create depth.

---

# 9. FLOOR

Use multiple floor variations.

Possible materials:

* carpet
* wooden floor
* tile
* server-room flooring

Different rooms may have subtly different flooring.

Use a limited palette.

Avoid gradients.

---

# 10. CHARACTERS

Each AI agent is represented by a small original pixel-art employee.

Characters should have:

* head
* hair
* face
* body
* clothing
* legs
* directional movement
* idle animation
* walking animation
* working animation

Characters must be visually distinct.

For example:

CEO:

* formal clothing
* distinctive hairstyle
* slightly more authoritative appearance

Backend Developer:

* casual developer clothing

Frontend Developer:

* visually distinct clothing

QA:

* testing-oriented visual identity

Designer:

* creative clothing

DevOps:

* infrastructure-oriented appearance

Do NOT use existing fictional characters.

---

# 11. SPRITE DIRECTIONS

Each character should support at minimum:

* down
* up
* left
* right

Preferably:

* down-left
* down-right
* up-left
* up-right

Animations:

### Idle

Subtle breathing / tiny movement.

### Walking

2–6 frame walk cycle.

### Working

Character sits at desk and interacts with computer.

### Thinking

Character temporarily pauses.

### Talking

Small animation while communicating.

### Success

Small positive animation.

### Error

Small frustrated / alert animation.

---

# 12. AGENT STATES

Every agent must have a visual state.

Possible states:

```text
IDLE
WALKING
WORKING
THINKING
READING
CODING
TESTING
REVIEWING
COMMUNICATING
MEETING
WAITING
BLOCKED
SUCCESS
ERROR
OFFLINE
```

The sprite animation should reflect the state.

Example:

```text
CODING
→ character seated at computer
→ monitor glow
→ typing animation
→ small status indicator
```

---

# 13. AGENT MOVEMENT

Agents should not teleport unless explicitly required.

Agents should navigate through the office.

Example:

```text
CEO
 ↓
leave office
 ↓
walk through corridor
 ↓
reach Developer desk
 ↓
talk
 ↓
return to CEO office
```

Movement should use pathfinding.

Use a walkable/non-walkable navigation grid.

Furniture and walls must act as obstacles.

Characters must not walk through:

* walls
* desks
* chairs
* furniture
* other blocked objects

Use smooth interpolation between grid points while maintaining pixel-art appearance.

---

# 14. COMMUNICATION VISUALIZATION

This is one of the most important parts.

When Agent A sends a message to Agent B:

1. Agent A changes to COMMUNICATING.
2. A message/envelope icon appears.
3. The envelope travels from A to B.
4. B receives the envelope.
5. B briefly changes to an "incoming message" state.
6. A message notification appears.
7. B begins processing the message.
8. The envelope disappears.

Example:

```text
Developer
   │
   │ ✉
   ├──────────────→
   │                │
   │                ↓
   │              QA
   │
```

Messages should have different visual types:

* normal request
* task assignment
* question
* response
* warning
* error
* success
* approval request

Use different small icons or effects.

Do not make the message system look like a conventional chat UI.

The office itself should communicate the message.

---

# 15. CEO / ORCHESTRATOR

The CEO is the central orchestrator.

The CEO receives user tasks.

The CEO decides:

* which agent should work
* what task should be assigned
* when another agent should review
* when agents should communicate
* when work is blocked
* when the user needs approval

The CEO should physically move through the office.

Example:

```text
USER
 ↓
CEO
 ↓
analyzes task
 ↓
walks to Backend Developer
 ↓
assigns task
 ↓
Backend Developer works
 ↓
Developer sends completion message
 ↓
CEO
 ↓
walks to QA
 ↓
assigns review
```

This should be visible in the simulation.

---

# 16. MEETINGS

When multiple agents need to collaborate:

1. CEO sends meeting request.
2. Agents stop current non-critical activities.
3. Agents walk toward the meeting room.
4. Agents sit around the meeting table.
5. Meeting indicator appears.
6. Message exchanges happen.
7. Agents leave individually.
8. Work resumes.

This makes the office feel alive.

---

# 17. TASK VISUALIZATION

Tasks should exist independently from agents.

Each task has:

```ts
{
  id,
  title,
  description,
  status,
  priority,
  assignedAgent,
  createdAt,
  updatedAt
}
```

Statuses:

```text
QUEUED
PLANNING
ASSIGNED
IN_PROGRESS
REVIEW
BLOCKED
COMPLETED
FAILED
```

The office visualization should react to these states.

---

# 18. WORKSTATIONS

Each workstation should have a clear purpose.

When an agent is working:

* character walks to workstation
* sits down
* computer activates
* monitor animation begins
* status changes
* optional tiny particles appear
* agent remains there until task state changes

Do not randomly move agents constantly.

Movement should have meaning.

---

# 19. OFFICE LIFE

When agents have no active tasks, the office should remain alive.

Possible idle behaviors:

* walking to coffee machine
* looking at whiteboard
* visiting another desk
* sitting in break area
* reading
* standing
* organizing desk
* checking server room
* short conversation

These behaviors must be subtle.

Do not create chaotic random movement.

---

# 20. UI OVERLAY

The office should occupy most of the screen.

Use a small amount of interface around it.

Avoid turning the app into a dashboard.

Possible UI:

### Top bar

```text
JHECKBOT
● 6 Agents Online
● 3 Tasks Running
```

### Bottom/side controls

* Zoom
* Center Office
* Agents
* Tasks
* Activity
* Settings

### Selected agent panel

When clicking an agent:

```text
┌──────────────────────────┐
│ Developer                 │
│ Backend Engineer          │
│                          │
│ ● Working                 │
│                          │
│ Current task:             │
│ Implement authentication  │
│                          │
│ Provider: Claude          │
│ Model: ...                │
│                          │
│ [Open Terminal]           │
│ [View Tasks]              │
└──────────────────────────┘
```

The panel should feel like a game information panel, not a modern enterprise dashboard.

---

# 21. PIXEL UI STYLE

UI must follow the same pixel-art language.

Rules:

* hard borders
* square corners
* chunky buttons
* pixel fonts where appropriate
* no glassmorphism
* no excessive rounded cards
* no gradients
* no giant modern SaaS cards
* no excessive shadows
* limited palette

Buttons should feel like they belong in a 1990s/2000s game.

---

# 22. COLOR SYSTEM

Use a limited palette.

The entire environment should have a coherent color language.

Suggested conceptual palette:

* warm cream
* muted green
* brown
* dark charcoal
* muted blue
* soft orange
* muted red
* accent yellow

Do not use every color everywhere.

Each room should have a small controlled palette.

Characters should use even fewer colors.

---

# 23. LIGHTING

Do NOT use realistic lighting.

Use pixel-art lighting.

Examples:

* small lamp glow represented by a few pixel clusters
* monitor glow
* server indicators
* window brightness
* subtle nighttime palette

Lighting should never blur the artwork.

---

# 24. ANIMATIONS

Animations should be subtle.

Examples:

* character walking
* monitor flicker
* server lights
* coffee steam
* plant movement
* clock movement
* envelope movement
* notification bounce
* typing
* meeting indicator

Avoid excessive animations.

The goal is:

"alive"

not:

"busy".

---

# 25. VISUAL HIERARCHY

The user should immediately understand:

1. This is an office.
2. These are AI employees.
3. They are doing work.
4. The CEO coordinates them.
5. Messages travel between them.
6. Something is currently happening.

Do not overwhelm the user with UI.

The agents themselves should tell the story.

---

# 26. TECHNICAL RENDERING

Preferred renderer:

Pixi.js.

Use:

* Sprite
* Container
* Texture
* AnimatedSprite
* Graphics only when appropriate
* ticker/update loop
* viewport/camera abstraction

Use nearest-neighbor texture scaling.

Keep the game world independent from DOM UI.

Recommended architecture:

```text
VirtualOffice
│
├── OfficeWorld
│   ├── TileMap
│   ├── Walls
│   ├── Furniture
│   ├── Decorations
│   └── NavigationGrid
│
├── AgentLayer
│   ├── AgentSprite
│   ├── AgentAnimation
│   ├── AgentMovement
│   └── AgentState
│
├── EffectsLayer
│   ├── MessageEnvelope
│   ├── Notifications
│   ├── Particles
│   └── StatusEffects
│
└── Camera
    ├── Zoom
    ├── Pan
    └── Focus
```

---

# 27. EVENT-DRIVEN DESIGN

The renderer should NOT contain the AI logic.

The visual layer listens to events.

Example:

```ts
agent.created
agent.started
agent.walking
agent.arrived
agent.working
agent.thinking
agent.message.sent
agent.message.received
agent.task.assigned
agent.task.completed
agent.task.failed
agent.meeting.started
agent.meeting.ended
agent.offline
```

Example:

```ts
{
  type: "agent.message.sent",
  from: "backend",
  to: "qa",
  messageId: "msg_123"
}
```

The office then decides how to visually represent that event.

---

# 28. SEPARATE SIMULATION FROM REAL AI

The office must work even with mock agents.

Create a simulation layer:

```text
Agent Runtime
      ↓
Event Bus
      ↓
Office Simulation
      ↓
Pixi Renderer
```

This allows the visual environment to be developed independently.

Create mock events such as:

```text
CEO assigns task
Developer starts working
Developer sends message
QA receives message
QA reviews
QA finds issue
Developer fixes
QA approves
CEO reports completion
```

The entire office should be demonstrable without connecting to an LLM.

---

# 29. DETERMINISTIC DEMO MODE

Create a demo mode.

When activated:

The office runs a scripted realistic workflow.

Example:

```text
00:00 CEO receives task
00:03 CEO thinks
00:05 CEO walks to developer
00:08 task assigned
00:10 developer walks to desk
00:12 developer starts coding
00:20 developer sends QA message
00:23 envelope reaches QA
00:25 QA starts review
00:35 QA finds issue
00:38 QA sends message
00:42 developer receives message
00:45 developer fixes issue
00:55 QA approves
01:00 CEO receives success
```

This should feel like watching a tiny software company work.

---

# 30. IMPORTANT: DO NOT FAKE THE OFFICE WITH A STATIC IMAGE

Do NOT implement the office as:

```text
background.png
+
characters positioned over it
```

Instead implement:

```text
tile map
+
objects
+
collision
+
navigation
+
sprites
+
state machine
+
effects
```

The world must be interactive.

---

# 31. RESPONSIVENESS

The desktop experience should be primary.

However, design the renderer so that it can eventually support:

* desktop
* tablet
* mobile

On mobile:

* allow pinch zoom
* pan the office
* tap agents
* show compact agent information
* retain the office as the primary experience

Do not turn mobile into a completely different dashboard.

---

# 32. AUDIO — OPTIONAL

Leave hooks for:

* footsteps
* typing
* notification sounds
* envelope delivery
* meeting sounds
* subtle ambient office sound

Do not implement loud background music by default.

Audio should be optional.

---

# 33. PERFORMANCE

The office should comfortably support:

* 5 agents
* 10 agents
* 20 agents
* potentially 50+ agents

Use:

* sprite reuse
* texture atlases
* object pooling where necessary
* efficient pathfinding
* event-driven updates
* avoid unnecessary React re-renders
* keep Pixi rendering separate from React state

---

# 34. IMPLEMENTATION PHASES

Do NOT attempt to implement everything simultaneously.

Build in this exact sequence.

## Phase 1 — World

Create:

* tile grid
* walls
* floors
* rooms
* doors
* furniture
* collision

Deliverable:

A beautiful empty office.

---

## Phase 2 — One Agent

Create:

* one original character
* idle animation
* walking animation
* workstation
* pathfinding

Deliverable:

Character can walk around and sit at desk.

---

## Phase 3 — Multiple Agents

Create:

* CEO
* developer
* QA
* designer

Deliverable:

Multiple agents independently occupy the office.

---

## Phase 4 — Agent State Machine

Implement:

* idle
* walking
* working
* thinking
* waiting
* communicating
* success
* error

---

## Phase 5 — Communication

Implement:

* message event
* envelope
* sender animation
* receiver animation
* message delivery
* visual notification

---

## Phase 6 — Task System

Implement:

* task assignment
* task status
* agent assignment
* task completion
* task failure

---

## Phase 7 — Orchestrator

Implement CEO behavior.

---

## Phase 8 — Real Agent Runtime

Connect the visual events to actual AI agent processes.

---

## Phase 9 — Terminal

Selected agent can expose its real terminal session.

---

## Phase 10 — Mobile

Expose JheckBot remotely through the mobile interface.

---

# 35. QUALITY BAR

Do not settle for:

* generic pixel art
* random furniture
* static characters
* disconnected animations
* random agent movement
* generic React cards
* flat background
* emoji characters
* placeholder rectangles

The result should feel like a professionally designed indie simulation game.

The user should be able to stare at the office for several minutes and naturally understand what is happening.

---

# 36. ACCEPTANCE TEST

Before considering the visual environment complete, demonstrate:

1. Open office.
2. Four agents are present.
3. CEO receives a task.
4. CEO changes state.
5. CEO walks to developer.
6. CEO sends task.
7. Developer receives it.
8. Developer walks to workstation.
9. Developer starts working.
10. Developer sends QA request.
11. Envelope visibly travels across the office.
12. QA receives it.
13. QA walks to workstation.
14. QA reviews.
15. QA sends result.
16. CEO receives result.
17. Agents return to normal activities.

The entire workflow must be understandable WITHOUT reading a log.

---

# 37. FINAL PRODUCT FEEL

The final result should feel like:

> "I have a tiny AI software company living inside my computer."

Not:

> "I have a dashboard showing my AI agents."

That distinction is extremely important.

The office is the product experience.

The agents are characters.

The tasks are the story.

The communication is the activity.

The CEO is the orchestrator.

The AI runtime is the engine underneath.

Build the system so these layers remain independent but visually synchronized.
