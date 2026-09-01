# JheckBot — Character & Animation Differentiation Pass

The current virtual office is functional, but the characters and animations still feel too generic and too similar to the reference implementation.

Perform a major **character, animation, personality, and visual behavior redesign**.

Do NOT simply recolor the existing sprites.

Do NOT make superficial changes such as:

* different shirts
* different hair colors
* different furniture
* different idle frame counts

Instead, redesign the characters as a completely original cast of AI software employees with their own silhouettes, personalities, movement patterns, work behaviors, and interactions.

The office should feel like an original animated software studio.

---

# 1. CORE PRINCIPLE

Every agent must feel like a different character.

A viewer should be able to identify an agent from:

* silhouette
* walking style
* idle behavior
* working behavior
* movement speed
* posture
* communication style
* workstation behavior
* reaction to events

WITHOUT reading the agent's name.

Do not use one generic sprite template for all agents.

---

# 2. CREATE DISTINCT CHARACTER ARCHETYPES

Create at least 6 visually and behaviorally different characters.

## CEO / ORCHESTRATOR

Personality:

* calm
* deliberate
* organized
* constantly monitoring the office

Visual characteristics:

* distinctive silhouette
* formal but approachable clothing
* recognizable hairstyle/accessory
* slightly more upright posture

Behavior:

When idle:

* occasionally checks task board
* walks around office
* pauses near windows
* observes other agents
* occasionally visits workstations

When receiving an important event:

* pauses
* turns toward the source
* reacts
* walks decisively to the appropriate agent

Movement:

* deliberate
* moderate speed
* minimal unnecessary movement

---

# 3. BACKEND DEVELOPER

Personality:

* focused
* introverted
* highly concentrated

Visual:

* casual clothing
* hoodie/jacket or distinctive silhouette
* headphones or another original accessory

Behavior:

Idle:

* sits at computer
* occasionally leans back
* checks another monitor
* stretches

Working:

* rapid typing
* monitor interaction
* occasional thinking pause
* looks at secondary monitor

When debugging:

* stops typing
* looks around briefly
* resumes work

When successful:

* small celebration
* leans back
* returns to work

Walking:

* slightly faster than CEO
* somewhat hunched posture

---

# 4. FRONTEND / DESIGNER

Personality:

* energetic
* creative
* visually expressive

Visual:

* bright but controlled clothing
* unique hair
* recognizable accessory

Behavior:

Idle:

* moves around workstation
* examines design board
* stands and looks at monitor
* occasionally rearranges desk objects

Working:

* rapid switching between screens
* points toward design board
* stands up to inspect something
* returns to computer

Success:

* visible excitement
* small jump or arm movement

Walking:

* faster
* slightly exaggerated animation
* more expressive turning

---

# 5. QA ENGINEER

Personality:

* methodical
* observant
* suspicious of everything

Visual:

* distinctive glasses/accessory
* clipboard/tablet or QA-related object

Behavior:

Idle:

* checks testing board
* walks around looking at workstations
* observes other agents
* occasionally stops beside a developer

Testing:

* rapid interaction with workstation
* pauses
* examines result
* repeats test

Bug found:

* stops
* looks surprised/frustrated
* displays warning indicator
* immediately sends a report

Bug fixed:

* carefully verifies again
* eventually gives approval animation

Walking:

* medium speed
* frequent stops
* slightly cautious movement

---

# 6. DEVOPS / INFRASTRUCTURE AGENT

Personality:

* calm
* technical
* constantly monitoring infrastructure

Visual:

* workwear-inspired clothing
* distinctive tool/accessory
* recognizable silhouette

Behavior:

Frequently visits:

* server room
* monitoring station
* infrastructure workstation

Working:

* checks monitors
* moves between server racks
* examines infrastructure

Server alert:

* immediately stops
* turns toward server room
* walks quickly
* investigates

Success:

* checks monitor
* nods
* returns to workstation

Walking:

* purposeful
* faster when responding to incidents

---

# 7. DOCUMENTATION / RESEARCH AGENT

Personality:

* quiet
* thoughtful
* curious

Visual:

* different silhouette from developers
* notebook/tablet/book accessory

Behavior:

* reads
* writes
* visits whiteboard
* researches
* occasionally talks to other agents

Thinking:

* stands still
* looks upward/sideways
* pauses before continuing

Walking:

* slow and relaxed

---

# 8. NO IDENTICAL IDLE ANIMATIONS

This is extremely important.

Do NOT give every agent:

```text
idle_1
idle_2
idle_3
```

with the same timing.

Each agent needs a unique idle behavior tree.

Example:

CEO:

```text
idle
 ↓
check_task_board
 ↓
look_around
 ↓
walk
 ↓
observe
 ↓
idle
```

Developer:

```text
idle
 ↓
type
 ↓
pause
 ↓
stretch
 ↓
type
```

Designer:

```text
idle
 ↓
stand
 ↓
inspect_board
 ↓
sit
 ↓
type
```

QA:

```text
idle
 ↓
look_at_monitor
 ↓
stand
 ↓
inspect
 ↓
return
```

DevOps:

```text
idle
 ↓
check_monitor
 ↓
walk_to_server
 ↓
inspect
 ↓
return
```

Research:

```text
idle
 ↓
read
 ↓
write
 ↓
think
 ↓
read
```

---

# 9. UNIQUE WALKING ANIMATIONS

Do not use one universal walking cycle.

Create different movement characteristics.

Example:

```text
CEO
speed = 1.0
stride = controlled
bounce = low

Developer
speed = 1.15
stride = short
bounce = medium

Designer
speed = 1.25
stride = energetic
bounce = high

QA
speed = 0.9
stride = cautious
bounce = low

DevOps
speed = 1.3
stride = purposeful
bounce = medium

Research
speed = 0.8
stride = relaxed
bounce = low
```

These differences should be visible even at small sprite sizes.

---

# 10. CHARACTER SILHOUETTES

Silhouette is more important than facial detail.

Make characters recognizable as dark silhouettes before adding colors.

Use differences in:

* height
* head shape
* hair
* clothing
* accessories
* shoulder width
* body proportions
* posture

Avoid six characters that look like:

```text
   O
  /|\
  / \
```

with different colors.

---

# 11. CHARACTER SCALE VARIATION

Introduce subtle size differences.

Example:

```text
Researcher: 90%
Developer: 100%
QA: 96%
Designer: 102%
DevOps: 105%
CEO: 110%
```

Do not make this exaggerated.

The purpose is to create a believable cast.

---

# 12. PERSONALITY THROUGH MOVEMENT

Movement should communicate personality.

Do not rely entirely on text.

Example:

CEO sees a failed task:

BAD:

```text
status = ERROR
```

BETTER:

```text
CEO stops
→ turns toward developer
→ pauses
→ walks quickly
→ communicates
```

Developer receives criticism:

```text
typing
→ stops
→ looks toward CEO
→ pauses
→ returns to workstation
→ starts debugging
```

QA discovers a bug:

```text
testing
→ freezes
→ looks at monitor
→ slight reaction
→ warning indicator
→ walks toward developer
```

---

# 13. AGENT-TO-AGENT INTERACTION ANIMATIONS

Messages should not always use the same envelope animation.

Create different communication behaviors.

## Normal message

Small floating message icon.

## Urgent message

Fast-moving message icon with subtle pulse.

## Bug report

Warning icon travels between agents.

## Approval

Small checkmark travels between agents.

## Meeting request

Calendar/document icon travels to recipient.

## Emergency

Agent physically walks to the recipient instead of sending a remote message.

---

# 14. PHYSICAL CONVERSATIONS

When two agents communicate face-to-face:

1. Sender walks toward recipient.
2. Recipient notices sender.
3. Both turn toward each other.
4. Both stop.
5. Small speech/message indicators appear.
6. Conversation lasts several seconds.
7. Sender leaves.
8. Recipient resumes previous task.

Do NOT make agents stand perfectly still facing each other.

Add subtle:

* head movement
* body movement
* gesture
* reaction
* pauses

---

# 15. GROUP MEETINGS

Group meetings should feel different from normal conversations.

CEO:

```text
walks into meeting room
```

Other agents:

```text
receive meeting request
→ leave workstation
→ walk to meeting room
→ enter
→ find available seat
```

Once seated:

* agents face different directions
* subtle idle animations continue
* speaker changes
* speaking agent gets a small indicator
* other agents react

Avoid making everyone perform the exact same animation.

---

# 16. WORKSTATION ANIMATIONS

Every department should have different work behavior.

Developer:

```text
typing
monitor interaction
thinking
typing
```

Designer:

```text
drawing
mouse movement
standing
checking board
```

QA:

```text
testing
checking result
retesting
```

DevOps:

```text
monitoring
checking server
walking
```

Research:

```text
reading
writing
thinking
```

CEO:

```text
monitoring
reading task board
communicating
```

---

# 17. MICRO-ANIMATIONS

Add small environmental animations.

Examples:

* coffee steam
* monitor flicker
* server LEDs
* clock movement
* plant movement
* papers shifting
* chair movement
* keyboard interaction
* subtle light changes
* notification bounce
* door opening
* drawer opening
* whiteboard interaction

These should be subtle.

The goal is to make the environment feel alive.

---

# 18. CONTEXTUAL ANIMATIONS

Agents should react to what is happening around them.

Example:

Developer is coding.

A nearby server alert happens.

Developer briefly looks toward the server room.

QA walks past.

Developer briefly looks at QA.

CEO enters.

Developer stops typing and looks toward CEO.

These tiny reactions make the world feel simulated instead of animated.

---

# 19. INTERRUPT SYSTEM

Agents should have interrupt priorities.

Example:

```text
LOW
idle activity

MEDIUM
normal message

HIGH
task assignment

CRITICAL
production/server failure
```

A critical event can interrupt an agent's current animation.

Example:

```text
Developer typing
        ↓
server failure
        ↓
typing stops
        ↓
developer turns
        ↓
notification
        ↓
walks toward server room
```

---

# 20. RETURN-TO-TASK BEHAVIOR

Agents must remember what they were doing.

Example:

```text
Developer
    ↓
coding
    ↓
message received
    ↓
communicate
    ↓
return to workstation
    ↓
resume coding
```

Do not reset agents to generic idle states after every interaction.

---

# 21. ANIMATION STATE MACHINE

Implement a real state machine.

Example:

```ts
type AgentState =
  | "idle"
  | "walking"
  | "working"
  | "thinking"
  | "communicating"
  | "meeting"
  | "reviewing"
  | "blocked"
  | "success"
  | "error"
  | "offline";
```

But also track the current activity:

```ts
{
  state: "working",
  activity: "coding",
  previousState: "working",
  interruptedBy: null
}
```

This allows agents to resume their previous activity.

---

# 22. ANIMATION RANDOMIZATION

Do not make animation timing deterministic in an obvious way.

Introduce controlled variation.

For example:

```text
typing duration:
3.2s – 7.8s

idle pause:
2s – 8s

look-around:
1s – 3s

stretch:
random interval

walk speed:
±5%
```

However:

DO NOT use pure randomness.

Use weighted behaviors.

Example:

```text
typing: 60%
thinking: 15%
monitor: 10%
stretch: 5%
look around: 10%
```

This creates believable behavior.

---

# 23. DO NOT RANDOMLY WANDER

Agents should have goals.

BAD:

```text
random point
→ walk
→ random point
→ walk
```

GOOD:

```text
idle
→ coffee
→ return

or

working
→ receive message
→ visit QA
→ return

or

idle
→ check task board
→ return
```

Movement must have context.

---

# 24. CHARACTER EXPRESSIONS

At the pixel scale, expressions should be communicated through:

* head movement
* posture
* sprite frame
* body orientation
* small particles/icons

Examples:

SUCCESS:

```text
small bounce
+ sparkle/check
```

ERROR:

```text
pause
+ warning icon
```

THINKING:

```text
head orientation
+ subtle thought indicator
```

IMPORTANT:

Do not rely on large emoji bubbles.

Keep the visual language integrated into the pixel-art world.

---

# 25. AGENT STATUS EFFECTS

Create tiny visual indicators.

Examples:

Working:

```text
small animated monitor indicator
```

Thinking:

```text
small subtle thought effect
```

Blocked:

```text
small warning marker
```

Success:

```text
small sparkle/check
```

Error:

```text
small red/orange warning pulse
```

Offline:

```text
dimmed sprite
```

These should remain subtle.

---

# 26. CHARACTER INTRODUCTION

When an agent joins the office:

Do not simply spawn the sprite.

Instead:

```text
door opens
→ character enters
→ looks around
→ walks toward assigned workstation
→ places bag/object
→ sits down
→ computer activates
```

This creates personality immediately.

---

# 27. AGENT LEAVING

When an agent goes offline:

```text
finishes current task
→ saves work
→ stands
→ leaves workstation
→ walks toward exit
→ exits office
→ sprite disappears
```

If the agent unexpectedly crashes:

```text
working
→ freezes
→ status indicator changes
→ lights turn off
→ agent becomes inactive
```

---

# 28. VISUAL ORIGINALITY REQUIREMENT

Before implementation, create a character design sheet containing all agents.

For every character document:

```text
Name
Role
Silhouette
Height
Clothing
Primary colors
Accessory
Personality
Walking style
Idle behavior
Working behavior
Communication behavior
Success behavior
Error behavior
```

Do not begin coding the final sprite system until the six characters are visually differentiated.

---

# 29. ORIGINAL ASSET REQUIREMENT

If assets are generated:

Create original assets specifically for JheckBot.

Do not reuse:

* Munder Difflin sprites
* Dunder Mifflin assets
* The Office characters
* copied tilesets
* copied furniture
* copied UI assets

The art direction should belong to JheckBot.

---

# 30. FINAL VISUAL GOAL

The result should look like an animated pixel-art software company.

The viewer should think:

> "These are different AI employees with different personalities."

NOT:

> "These are six copies of the same sprite."

And:

> "They are actually doing something."

NOT:

> "The characters are randomly walking around."

And:

> "Something is happening inside this office."

NOT:

> "This is a static game background."

---

# 31. DEMONSTRATION SCENARIO

After implementation, create a 2–3 minute automated demonstration.

Sequence:

1. Office starts normally.
2. Agents perform individual activities.
3. CEO receives new task.
4. CEO reads task.
5. CEO walks to Backend Developer.
6. Developer stops working.
7. CEO assigns task.
8. Developer returns to workstation.
9. Developer starts coding.
10. Designer continues independent work.
11. QA independently performs testing.
12. Developer sends QA a review request.
13. QA receives the message.
14. QA walks to Developer.
15. QA identifies a problem.
16. QA sends bug report.
17. Developer reacts.
18. Developer debugs.
19. DevOps receives infrastructure event.
20. DevOps moves to server room.
21. Developer completes fix.
22. QA verifies fix.
23. QA approves.
24. CEO receives completion notification.
25. CEO returns to command area.
26. All agents gradually return to their normal activities.

The sequence must demonstrate that every character behaves differently.

---

# 32. ACCEPTANCE CRITERIA

The redesign is successful only if:

* no two characters have the same silhouette
* no two characters have identical idle behavior
* walking styles differ
* working animations differ
* communication behaviors differ
* agents react to events
* agents remember previous activities
* agents do not randomly wander
* agents physically navigate the office
* meetings feel different from normal communication
* success/error reactions differ
* the office remains alive when no task is running
* animations communicate personality without text
* the visual identity is clearly original

Do not consider changing colors sufficient.

This is a **behavioral animation redesign**, not a skinning pass.
