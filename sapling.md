## Product frame

Build the frontend around **task runs** (what a non-technical person understands), not “agents” (implementation detail).

A run is: **intent → plan → work → checks → deliverables → saved record**.

This maps cleanly onto Claude’s common agent loop: **gather context → take action → verify work → repeat**. ([anthropic.com][1])

Your existing `agent-sdk-boilerplate` already aligns with this product shape: it's a TypeScript orchestration layer for running Claude agents inside **isolated E2B sandboxes** with **real-time streaming** (SSE + WebSocket) and Next.js-friendly patterns. ([GitHub][2])

---

## MVP Scope Decisions

> **Design Decision:** Both reviewers agreed the plan oscillates between deployment models without committing. These decisions must be explicit before implementation.

**Choose explicitly for MVP:**

| Decision | Option A | Option B |
|----------|----------|----------|
| **Deployment** | Desktop shell (Tauri) with direct vault access | Web app with sync agent |
| **Storage** | Local ledger DB (SQLite) | Remote shared DB |
| **User model** | Single-user per vault | Multi-user workspaces |

**Recommendation for MVP:** Pick ONE path. Do NOT ship hybrid simultaneously—that's a V2 optimization after the core loop is validated.

- **Choose Desktop** if: local vault access is non-negotiable, you're building primarily for yourself first
- **Choose Web** if: you want fast iteration, plan to test with multiple users, okay with "sync later" for vault integration

Document chosen defaults and explicitly defer the other options.

---

## The non-technical mental model

Replace “spin up an agent” with:

* **Start a task**
* **Assign a helper** (optional; defaults to “Auto”)
* **Watch progress**
* **Approve important actions**
* **Review deliverables**
* **Save / export**

Internally, “helper” = agent template + permissions + tools.

---

## Core objects

These objects let the UI stay simple while you keep full traceability.

### 1) Templates (what users pick)

A template is a “job role”:

* Name (Email Assistant, Calendar Scheduler, GitHub Issue Triage, Knowledge Organizer)
* What it can do (capabilities)
* What it cannot do (guardrails)
* Inputs it needs (accounts, repos, folders)
* Outputs it produces (draft email, calendar proposal, PR plan, Obsidian note)
* Default approval policy (see below)

Claude Agent SDK supports “skills”, “memory”, “plugins”, and project configuration patterns you can package into these templates. ([Claude][3])

### 2) Runs (what users do)

A run is one execution of a template against a конкрет task.

* Run ID, status, timestamps
* Goal (user’s request)
* Scope (what data sources it can read/write)
* Event stream (timeline)
* Artifacts (deliverables)
* Approvals + audit (who approved what)

### 3) Events (what users watch)

A run emits structured events to power the UI:

* `RunStarted`, `StepStarted`, `ToolCallStart`, `ToolCallEnd`, `RunFinished`, `RunError`
* “State deltas” for live previews (draft evolving)

This is exactly the problem AG‑UI formalizes: client POSTs once, then listens to a unified event stream with types like `TEXT_MESSAGE_CONTENT`, `TOOL_CALL_START`, `STATE_DELTA`. ([CopilotKit][4])
Adopting a standard event vocabulary prevents your UI from being hard-coupled to one agent runtime.

### 4) Artifacts (what users keep)

Artifacts are “things a user recognizes”:

* Draft email (To/Subject/Body)
* Calendar event proposal
* GitHub comment/issue update/PR summary
* Obsidian note / knowledge card
* Report / checklist / table / chart

E2B can stream both **stdout/stderr** and higher-level **results** (charts, tables, text) during execution, which is ideal for live previews without exposing a filesystem. ([E2B][5])

### 5) Approvals (how you keep trust)

Approvals are first-class:

* Requested action (send email, create calendar event, push commit)
* Rationale (short)
* Preview (what will change)
* Approve / Reject / Edit (optional)
* Resume run

Claude Agent SDK surfaces **Permissions** and **Hooks** specifically to control what an agent can do and when it needs approval. ([Claude][6])

---

## Primary UI surfaces

Design for non-technical: few screens, single “happy path”, details available but not required.

### A) Home: “Tasks”

* Primary CTA: **New Task**
* List: Active / Recently completed
* Each card shows: template icon, goal, progress, “needs approval” badge

### B) New Task (wizard, not chat)

Step 1: “What do you want done?” (single text box)
Step 2: “Choose helper” (recommended template + alternatives)
Step 3: “Where should it work?” (connectors + scope)
Step 4: “Confirm plan + permissions” (one-page contract)

The “contract” is non-negotiable for trust:

* It will do X
* It will not do Y
* It can access A/B/C
* Actions requiring approval: list

### C) Run Monitor (the core screen)

Three-pane layout works if simplified:

**Left:** run timeline (human-readable steps)
**Center:** “Now doing” + streaming narration (not chain-of-thought; just operational updates)
**Right:** live preview panel (draft email, proposed event, report building)

Timeline steps should be coarse and consistent:

1. Collecting info
2. Doing the work
3. Checking work
4. Preparing results
   (derived from Claude's loop) ([anthropic.com][1])

> **Design Decision:** Phases are derived from event types and contract milestones, not model prose. Human-readable updates are produced by labeling normalized events; no separate narration engine required.

**Phase mapping rules:**
- `phase.changed` events drive the timeline
- Each tool call type maps to a friendly label (e.g., `github.list_issues` → "Checking GitHub issues")
- Streaming narration = live labels on events, not chain-of-thought

Your boilerplate already supports real-time streaming (SSE + WebSocket) and even includes an SSE streaming API example with a web UI pattern you can lift. ([GitHub][2])

### D) Review Results

At completion, do not dump logs. Show:

* **Deliverables** (primary)
* **What changed** (secondary)
* **Receipt** (audit trail)

“Receipt” example:

* Read: 14 files, 2 emails, 1 calendar
* Wrote: 1 note, 0 external actions
* Proposed (not executed): 1 email send

### E) Library: “Saved Results”

Non-technical users need retrieval:

* Search by: topic, date, template, person, system (Gmail/GCal/GitHub)
* Openable artifacts with previews
* “Export to Obsidian / PDF / Share link” (implementation-specific)

### F) Connections

Simple connector cards:

* Gmail, Calendar, GitHub, Obsidian Vault, etc.
  Each card shows:
* Connected as…
* Allowed scopes
* Last used

### Connector Authentication UX

> **Design Decision:** The plan depends on Gmail/GCal/GitHub connectors but didn't specify how tokens are stored or scoped. This is a security and architecture blocker.

**Connection screen:**
- List of available connectors with "Connect" buttons
- Each shows: last connected, scopes granted, linked account

**OAuth flow:**
- Standard OAuth 2.0 redirect flow
- After auth, store tokens securely (encrypted at rest)
- Refresh tokens automatically; surface errors if refresh fails

**Scope management:**
- Show exactly what scopes were granted
- Allow users to disconnect and reconnect with different scopes
- Warn if a template requires scopes not yet granted

**Credential storage:**
- For web: store in backend, never expose to frontend
- For desktop: use OS keychain (Tauri supports this)
- For agents: inject credentials via orchestrator, never in prompts

**Security rules:**
- OAuth tokens are stored encrypted in the control plane, scoped per workspace
- Short-lived access tokens are injected into tool calls at execution time
- The sandbox never stores long-lived credentials
- Revocation and scope changes are audited in the run ledger

---

## How "monitoring" stays intuitive without showing code

You do not need to show the E2B filesystem. You need to show **operational intent + observable progress**.

Implement a translation layer:

### Raw sources

* Claude Agent SDK messages + tool calls (plus hooks/permissions) ([Claude][3])
* E2B streaming stdout/stderr + results ([E2B][5])
* Your orchestrator lifecycle events (sandbox created, restarted, timed out)

### Normalized events

Emit a small, stable schema (AG‑UI-like):

* `STEP_STARTED {label}`
* `TOOL_RUNNING {name, friendlyLabel}`
* `PREVIEW_UPDATED {artifactId, delta}`
* `APPROVAL_REQUIRED {actionType, preview}`
* `CHECK_PASSED {checkType}` / `CHECK_FAILED {reason}`
* `RUN_FINISHED {summary, artifacts[]}`

This lets the UI be high-quality without being brittle. ([CopilotKit][4])

---

## Where results get saved

Treat E2B as compute, not storage. Persist everything outside the sandbox.

Use a **three-layer persistence model**:

### 1) Run DB (system of record)

Store:

* Run metadata (goal, template, scopes)
* Event log (append-only)
* Approval decisions
* Links to artifacts

If you want reactive UI “for free”, Convex is explicitly designed for long-running agent workflows with persistent message history and live updates to clients. ([Convex Developer Hub][7])

### 2) Artifact store (binary + large outputs)

Object storage (S3/R2/etc) for:

* PDFs, images, attachments, bundles
* Final “run export zip”

### 3) Obsidian vault export (human-readable archive)

Write a clean, user-facing record into the vault, e.g.:

```
/Sapling/
  /Runs/2026-01-20/
    run-<id>/
      00-summary.md
      01-deliverables/
        email-draft.md
        meeting-proposal.md
        report.md
      02-evidence/
        sources.md
      03-receipt/
        receipt.md
      04-events/
        events.jsonl
      attachments/
```

Frontmatter in `00-summary.md`:

* run_id
* template
* started_at / finished_at
* systems touched (gmail/calendar/github/vault)
* artifact index

Non-technical benefit: they can find everything in one place without understanding agent internals.

---

## “Doing exactly what it’s supposed to” as a UI feature

Make correctness visible via **checks**, not via logs.

### Add a "Checks" panel per run

Examples:

* "All promised deliverables produced"
* "No external actions executed without approval"
* "Email tone matches template"
* "Calendar conflicts checked"
* "GitHub links validated"

### Hard vs Soft Checks

> **Design Decision:** LLM-based reviewer checks are not reliable enough to gate completion. Deterministic checks should control run status, with configurable overrides.

| Check Type | Examples | Default Behavior | Override |
|------------|----------|------------------|----------|
| **Hard checks** (deterministic) | Schema validation, link checks, conflict checks, required deliverables exist | Block completion | Can be demoted to warn |
| **Soft checks** (LLM review) | "Email tone matches template", "PR description is complete" | Warn only | Can be promoted to block |

**Configuration:**
- Per-template: define which checks are hard vs soft
- Per-run: user can override at launch time
- If LLM reviewer determines agent completely ignored the goal, user should have the option to configure this as blocking

Under the hood you can implement:

* deterministic validators (schema validation, link checks, conflict checks)
* a second "reviewer" agent that verifies outputs against the run contract (kept invisible; surfaced as pass/fail)

### Put approvals where harm is possible

Default policy:

* Read-only actions: auto
* Write to vault: auto + undo history
* External side effects (send email, create meeting, push changes): approval required

Claude Agent SDK's permissions + hooks are built for this exact pattern. ([Claude][6])

### Cost Tracking and Limits

> **Design Decision:** Agent systems that run up surprise bills destroy user trust immediately. Even a rough cost estimate changes user behavior. This should be in MVP, not deferred.

**Track costs at the run level:**

Every run accumulates costs from:
- E2B compute time (billed per second)
- Claude API tokens (input + output)
- External API calls (GitHub API, etc., if metered)

Display in the Run Monitor:
- "Cost so far: $0.12"
- Breakdown on hover: "E2B: $0.08 | Claude: $0.04"

**Budget caps:**

Contracts can include `max_cost_cents`. When the run approaches the limit:
- At 80%: warning event emitted
- At 100%: run pauses with `budget_limit_reached` state
- User can: increase budget and resume, or cancel

**Workspace-level budgets:**

Set monthly/daily limits per workspace:
- "This workspace can spend up to $50/month"
- When approaching limit, new runs are blocked until reset or limit raised

**Cost estimation before run:**

Before starting, show estimate based on template averages:
- "Runs of this type typically cost $0.10 - $0.50"
- "Estimated time: 2-5 minutes"

This sets expectations and prevents surprise bills.

---

## Operational model for long-running and resumable runs

Non-technical users will close tabs. Runs must survive that.

Minimum:

* Every event appended to DB
* UI can reconnect to stream by run_id
* “Resume” uses stored session state

Anthropic explicitly discusses harnessing long-running agents across context windows by leaving clear artifacts and using an initializer + incremental worker approach. That pattern matches your "agents produce artifacts; UI shows artifacts; system resumes later" goal. ([anthropic.com][8])

---

## Error Handling and Recovery

> **Design Decision:** The plan's happy path is extensive, but agents fail, networks fail, E2B sandboxes crash, and API limits get hit. Without explicit error handling, the product will feel unreliable.

### Error Categories

| Category | Examples | Recovery Strategy |
|----------|----------|-------------------|
| Transient | Network timeout, rate limit, E2B hiccup | Auto-retry with backoff |
| Tool failure | API returned error, file not found | Log and continue (or fail based on severity) |
| Agent error | Infinite loop, wrong output format | Pause, notify user, offer manual intervention |
| Sandbox crash | OOM, segfault, E2B infrastructure | Checkpoint and retry from last known good state |
| Contract violation | Blocked tool called, constraint breached | Immediate stop, flag as `failed:policy_violation` |
| Timeout | Exceeded `max_duration_seconds` | Stop, save partial results, flag as `timeout` |
| Approval timeout | No response within window | Apply `auto_action_on_timeout` from approval rule |
| Stalled | No progress for N minutes | Flag as `stalled`, trigger retry or fail |

### Auto-Retry Policy

Transient errors trigger automatic retry with exponential backoff:
- First retry: 2 seconds
- Second retry: 4 seconds
- Third retry: 8 seconds
- After 3 retries: surface error to user

Retries are transparent to the user unless all attempts fail.

### Checkpointing (MVP)

> **Design Decision:** Full sandbox filesystem snapshots at every tool call are too expensive for MVP. Start with phase boundary checkpoints only.

Orchestrator saves lightweight checkpoints at:
- Each phase transition
- Before external side effects (email send, PR create, calendar write)

Checkpoint contains:
- Run state
- Agent conversation history (serializable)
- List of artifacts produced so far

Sandbox filesystem snapshots are **not** part of MVP. If the sandbox crashes:
- Resume from last phase boundary
- Agent re-executes from that point (idempotent tool design assumed)

### Partial Results

Runs that fail should still save whatever was produced:
- Artifacts created before failure → written to vault with `status: partial` frontmatter
- Events logged → always persisted
- Trace → written with failure details

User sees: "Run failed at Execute phase. 2 of 3 deliverables were produced. [View partial results] [Retry from checkpoint]"

### User-Facing Error Messages

Never show raw stack traces. Map errors to human-readable messages:

| Internal Error | User Message |
|----------------|--------------|
| `E2B_SANDBOX_TIMEOUT` | "The task took longer than expected and was stopped. You can retry or adjust the time limit." |
| `TOOL_RATE_LIMITED` | "GitHub is temporarily limiting requests. The task will automatically retry in a few seconds." |
| `APPROVAL_TIMEOUT` | "The approval request expired without a response. The task has been cancelled." |
| `CONTRACT_VIOLATION` | "The assistant tried to do something outside its allowed actions and was stopped." |
| `SANDBOX_CRASH` | "Something unexpected happened. We've saved your progress and you can retry from where it left off." |

---

## Concurrent Runs and Resource Conflicts

> **Design Decision:** For MVP, prevent conflicts via contract scoping rather than building complex conflict detection. This is simpler and sufficient for single-user validation.

### MVP Approach: Scope Blocking

Runs declare `exclusive_scopes` (e.g., "github:owner/repo", "vault:brain/entities/*").

Orchestrator blocks new runs with overlapping scopes until the first completes:
- User sees: "Another run is using this scope. Wait or cancel the other run."

### Future: Advisory Locks + Conflict Detection (Post-MVP)

When multi-user or overlapping tasks are needed:
1. At run start, declare resources that may be accessed
2. Check for conflicts with other active runs
3. If conflict found, warn user: "Another run is already working with repo X. Start anyway?"
4. Before external writes, check for changes since run started
5. If resource was modified by another run, pause with conflict event
6. User resolves: "Use mine" / "Use theirs" / "Merge" / "Cancel"

---

## Concrete MVP cut

### MVP 1: Task → stream → artifact → save

* New Task wizard
* Single Run Monitor with event timeline + preview pane
* End screen with deliverables + receipt
* Save to vault + store artifacts

Leverage your existing streaming foundation (SSE/WebSocket, Next.js-ready patterns). ([GitHub][2])

### MVP 2: Approvals + connectors

* Gmail/GCal/GitHub connectors
* Approval queue
* Action previews (email/calendar/github) with “apply” gating

### MVP 3: Template library + history

* Template catalog (curated)
* Library search + filters
* Project/workspace grouping

### MVP 4: Multi-agent orchestration (optional)

* “Specialists” appear as roles in the timeline (not as technical subagents)
* Handoffs logged as events, not exposed as code

---

## The UI structure “like Cursor” without being for coders

Cursor’s winning shape is: **left list + central working view + right contextual panel**. Keep the shape, change the semantics:

* Left: Tasks + History
* Center: Run progress + narrative
* Right: Previews + Approvals

No editor. No repo tree. No terminal. Only outcomes and controlled actions.

[1]: https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk "Building agents with the Claude Agent SDK \ Anthropic"
[2]: https://github.com/hwells4/agent-sdk-boilerplate "GitHub - hwells4/agent-sdk-boilerplate: Launch enterprise-grade agents on the Claude Agent SDK with a few lines of code."
[3]: https://platform.claude.com/docs/en/agent-sdk/overview "Agent SDK overview - Claude Docs"
[4]: https://www.copilotkit.ai/blog/introducing-ag-ui-the-protocol-where-agents-meet-users "Introducing AG-UI: The Protocol Where Agents Meet Users | Blog | CopilotKit"
[5]: https://e2b.dev/docs/code-interpreting/streaming "Documentation - E2B"
[6]: https://platform.claude.com/docs/en/agent-sdk/quickstart "Quickstart - Claude Docs"
[7]: https://docs.convex.dev/agents "AI Agents | Convex Developer Hub"
[8]: https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents "Effective harnesses for long-running agents \ Anthropic"



## What “frontend for SaplingOS” actually is

SaplingOS already has the core OS primitives:

* `/task` = execute work with decision tracing
* `/calibrate` = review traces and improve the system over time ([GitHub][1])
* A durable knowledge base structured as an Obsidian-compatible vault (`brain/…`) with explicit buckets for `outputs/` and `traces/` ([GitHub][1])

A frontend that matches your intent is not “an IDE.” It is a **control plane**:

* Launch agents (single or multi-agent jobs) into isolated runtimes (E2B sandboxes)
* Observe whether they are staying inside the task contract
* Gate risky actions behind approvals
* Collect the outputs into your vault + record a trace that can be calibrated

The Cursor analogy is useful for layout familiarity, but the product center-of-gravity changes from “edit code” to “manage runs.”

## Product principles that force a good agent UI

These principles prevent you from building another chat box with chrome.

### 1) Contract-first, not transcript-first

Every run starts from a structured contract, not a freeform prompt.

Contract includes:

* Goal
* Success criteria
* Deliverables (types + destinations)
* Constraints (what must not happen)
* Allowed tools/integrations
* Approval rules (what requires human OK)

UI consequence: the primary screen shows **contract compliance**, not token streaming.

### 2) Trace-first storage

If SaplingOS improves via calibration, then traces are first-class artifacts, not debug logs.

UI consequence: every run must end with:

* A short outcome summary
* A normalized trace written to `brain/traces/…` (or linked there) ([GitHub][1])
* Pointers to outputs written to `brain/outputs/…` (or linked there) ([GitHub][1])

### 3) Evidence over narration

Agents lie accidentally. UI needs evidence primitives:

* tool call records
* file diffs / patches
* external side effects previews (email draft, PR diff, calendar event payload)
* checks (tests, lint, schema validation)

UI consequence: “what happened” is shown as **verifiable events**, not prose.

### 4) Approvals are a core interaction, not a modal

If you’re serious about “managed well,” approvals become the main loop:

* queued approvals
* scoped review surfaces
* one-click accept/reject with audit logging

UI consequence: an “Approvals inbox” is always one click away.

## Domain model: the objects your UI manipulates

You will keep rewriting the UI until these objects are explicit.

### Workspace

A workspace maps to one Obsidian vault (Sapling’s `brain/…`) + associated integrations.

### Agent Template

A reusable definition:

* name, description
* default contract schema
* default tool policy
* default output mapping rules (where files go in the vault)
* optional sub-agent topology

### Run

An instance of work:

* `run_id`
* agent template version
* contract snapshot
* execution environment (E2B sandbox id, template id)
* status + timestamps
* event stream reference
* produced artifacts

### Contract Schema

> **Design Decision:** "Contract-first" is a core principle, but the schema must be explicit for validation, UI rendering, and policy checks to work.

Every run starts with a contract. This is immutable once the run begins.

```typescript
interface RunContract {
  // Identity
  contract_version: "1.0";
  template_id: string;
  template_version: string;

  // Goal
  goal: string;                          // User's request in plain language
  success_criteria: SuccessCriterion[];  // Measurable outcomes

  // Deliverables
  deliverables: DeliverableSpec[];       // What must be produced

  // Constraints
  constraints: Constraint[];             // What must NOT happen

  // Permissions
  tool_policy: ToolPolicy;               // Allowed/blocked tools
  integration_scopes: IntegrationScope[]; // What external systems can be accessed
  approval_rules: ApprovalRule[];        // What requires human OK

  // Limits
  max_duration_seconds: number;
  max_cost_cents?: number;               // Optional budget cap

  // Context
  input_files: string[];                 // Vault paths to mount
  output_destinations: OutputDestination[];
}

interface SuccessCriterion {
  id: string;
  description: string;
  evidence_type: "file_exists" | "api_response" | "test_passed" | "manual_check";
  evidence_spec?: Record<string, unknown>;
}

interface DeliverableSpec {
  id: string;
  type: "markdown" | "email_draft" | "calendar_event" | "pr_diff" | "json_data";
  destination: string;                   // Vault path pattern with variables
  required: boolean;
}

interface Constraint {
  id: string;
  description: string;
  rule_type: "tool_blocked" | "path_blocked" | "pattern_blocked" | "custom";
  rule_spec: Record<string, unknown>;
}

interface ApprovalRule {
  action_type: string;                   // "send_email", "create_pr", "write_entity", etc.
  condition: "always" | "first_time" | "if_external" | "never";
  timeout_seconds: number;
  auto_action_on_timeout: "approve" | "reject";
}
```

Contract validation happens at two points:
1. **Before run starts**: Orchestrator validates contract is well-formed and permissions are granted
2. **During run**: Orchestrator validates each tool call against `tool_policy` and `constraints`

### Event (append-only)

The atomic unit of observability.

> **Design Decision:** Reconnect/resume, pagination, and idempotency require stable event ids and ordering semantics. The `seq`-based cursor is essential for replay.

**Event envelope (versioned):**

```typescript
interface Event {
  event_id: string;        // UUID
  run_id: string;
  seq: number;             // Monotonic per run - critical for replay
  ts: string;              // ISO 8601 UTC
  type: EventType;
  phase: Phase;
  severity: "info" | "warning" | "error";
  payload: Record<string, unknown>;
}

type EventType =
  | "run.started"
  | "phase.changed"
  | "tool.called"
  | "tool.result"
  | "file.changed"
  | "artifact.created"
  | "checkpoint.requested"
  | "checkpoint.approved"
  | "checkpoint.rejected"
  | "checkpoint.timeout"
  | "drift.detected"
  | "run.completed"
  | "run.failed";

type Phase = "pending" | "planning" | "executing" | "verifying" | "packaging" | "completed" | "failed";
```

**Replay semantics:** Events are append-only, ordered by `seq`. The UI can request events after a `seq` cursor for reconnection. Example: `GET /runs/{run_id}/events?after_seq=42`

Your `agent-sdk-boilerplate` already emphasizes real-time streaming (SSE/WebSocket) and isolated E2B execution, which aligns with event streaming into a frontend. ([GitHub][2])

### Run Lifecycle State Machine

> **Design Decision:** Without explicit states, UI developers guess what "running" means, error handling is inconsistent, and resume logic is ad-hoc. The state machine costs almost nothing to write and prevents significant implementation bugs.

**States:**

| State | Description | Valid User Actions |
|-------|-------------|-------------------|
| `pending` | Contract submitted, sandbox not yet created | Cancel |
| `initializing` | E2B sandbox being created | Cancel |
| `planning` | Agent is in Plan phase | Pause, Cancel |
| `executing` | Agent is doing work | Pause, Cancel |
| `verifying` | Agent is checking results | Pause, Cancel |
| `packaging` | Agent is writing artifacts | Cancel (with idempotency) |
| `awaiting_approval` | Blocked on human approval | Approve, Reject, Cancel |
| `paused` | User-initiated pause | Resume, Cancel |
| `completed` | Run finished successfully | None |
| `failed` | Run terminated with error | Retry, View Logs |
| `cancelled` | User cancelled | Retry |
| `timeout` | Exceeded time limit | Retry |

**Transitions:**

```
pending → initializing (on sandbox request)
initializing → planning (on sandbox ready)
initializing → failed (on sandbox creation error)

planning → executing (on plan phase complete)
planning → awaiting_approval (on checkpoint.requested)
planning → failed (on unrecoverable error)
planning → paused (on user pause)

executing → verifying (on execute phase complete)
executing → awaiting_approval (on checkpoint.requested)
executing → failed (on unrecoverable error)
executing → paused (on user pause)

verifying → packaging (on verify phase complete)
verifying → executing (on verification failure requiring retry)
verifying → failed (on unrecoverable error)

packaging → completed (on artifacts written)
packaging → failed (on write error)

awaiting_approval → {previous_state} (on approval granted)
awaiting_approval → cancelled (on approval rejected with user_cancelled reason)
awaiting_approval → paused (on approval rejected with needs_edit reason)
awaiting_approval → failed (on approval rejected with policy_violation reason)
awaiting_approval → timeout (on approval timeout)

paused → {previous_state} (on user resume)
paused → cancelled (on user cancel)

Any state → cancelled (on user cancel)
Any state → failed (on sandbox crash, network failure, etc.)
```

**Phase enforcement:** The orchestrator (not the agent) owns phase transitions. Agents emit `phase.complete` events; orchestrator validates and transitions. If an agent emits tool calls inconsistent with its current phase (e.g., writing files during Plan), the orchestrator logs a `drift.detected` event.

**Packaging idempotency:** Artifacts are written atomically (write to temp, then rename). Cancel during packaging waits for current atomic write to complete. Partial runs still produce valid partial artifacts.

### Artifact

A durable output:

* markdown/doc output (goes to vault)
* patch set / PR link
* JSON payload for email/calendar
* zipped sandbox snapshot (optional)
* trace bundle

### Artifact Manifest

> **Design Decision:** The UI needs stable artifact ids, preview hints, and checksums to render and export correctly without parsing file contents.

```typescript
interface ArtifactManifest {
  artifact_id: string;
  type: "markdown" | "email_draft" | "calendar_event" | "pr_diff" | "json_data" | "pdf" | "image";
  mime_type: string;
  preview_type: "email" | "calendar" | "markdown" | "diff" | "json" | "binary";
  destination_path: string;
  checksum: string;           // SHA256
  size_bytes: number;
  created_at: string;         // ISO 8601
  status: "draft" | "final" | "partial";
}
```

Emit `artifact.created` event with the manifest so the UI can render without parsing files.

## UI architecture that fits E2B execution

You need two planes.

### Data plane: agent execution

* Orchestrator starts a run in E2B
* Agent produces events continuously
* Agent writes intermediate files inside sandbox FS
* Agent packages final artifacts

Your repo is already built around “TypeScript orchestration → Python-based agents in E2B” and streaming results back. ([GitHub][2])

### Control plane: frontend + run ledger

* Stores run metadata + event log (append-only)
* Serves realtime updates to UI
* Enforces approval gates (the agent cannot cross without a signed approval token)

If you do this right, the control plane is “thin” and mostly event storage + policy enforcement.

## Cursor-like layout, but agent-native

A layout that matches your “spin up agents + monitor” goal:

### Left sidebar: Work + Library

* Workspaces (vaults)
* Active runs
* Recent runs
* Agent templates (“Issue triage”, “Email drafter”, “Calendar scheduler”, “PR builder”)
* Approvals inbox (badge count)

### Center: Run canvas (primary surface)

Shows in order:

1. Contract header (goal, success criteria, deliverables)
2. Current phase + progress
3. Timeline of events (collapsible by phase/tool)
4. Live previews of artifacts as they emerge (draft email, PR diff summary, generated doc)

### Right inspector: Compliance + Controls

* Tool policy (allowed/blocked)
* Constraint violations (hard red)
* External side effects pending
* Resource telemetry (sandbox alive, time, failures)
* Controls: pause / stop / retry from checkpoint (not “chat more”)

## How to make “monitoring” actually useful

Monitoring fails when it is just logs.

Build three monitoring layers:

### Layer A: Phase + checkpoints

Force the agent loop into phases:

* Plan
* Execute
* Verify
* Package

Then define checkpoint types:

* “Approval required to send email”
* “Approval required to push branch / open PR”
* “Approval required to write into `brain/context/…`”
* “Approval required to edit existing entity note”

### Layer B: Contract compliance dashboard

Render contract items as checkboxes the system fills with evidence:

* Success criterion: “PR opened” → evidence = GitHub PR link + diff summary
* Constraint: “No direct email send without approval” → evidence = approval event id exists

### Layer C: Drift detection

Detect when the agent starts doing something outside the contract:

* tool calls not in allowlist
* file writes outside allowed paths
* new external integration usage
* repeated failures / loops

UI shows drift as a “stoplight” indicator + reason.

## Results review: the minimum review surface that works

A run review should have a fixed structure:

1. Outcome summary (human-readable)
2. Deliverables list (each with:

   * preview
   * destination path
   * “accepted” state)
3. Side effects list (GitHub issues touched, emails drafted/sent, calendar events created)
4. Trace link (for calibration)
5. Reproducibility link (sandbox snapshot hash or run replay inputs)

The key: **review is artifact-first**, not conversation-first.

## Where things get saved

You need a deterministic rule-set so nothing “floats.”

### 1) Obsidian vault is the human-facing durable store

Sapling already gives you the folders that matter: `brain/context/`, `brain/entities/`, `brain/outputs/`, `brain/traces/`. ([GitHub][1])

Use them as the canonical destinations.

Concrete mapping rules:

* User-facing deliverables → `brain/outputs/YYYY/MM/<run_id>_<slug>.md`
* Decision trace bundle → `brain/traces/YYYY/MM/<run_id>.md` (or `.json` + `.md` wrapper)
* New/updated people/companies → `brain/entities/<entity_type>/<name>.md`
* System calibrations / learned prefs → keep them in a dedicated calibration area (still inside vault, but not mixed into outputs)

### 2) Control-plane DB stores indexing + event stream

Store:

* run metadata
* event log (append-only)
* artifact pointers (paths in vault + object store URIs)
* approvals (who approved what, when)

This DB is not your “knowledge.” It is your ledger.

### 3) Sandbox artifacts are optional, but powerful

Since agents run in E2B, store either:

* a zipped snapshot of relevant files, or
* just patches/diffs + final outputs

Default: store only diffs + final outputs, not entire sandboxes, unless debugging requires it.

## How they get saved (mechanics)

### Write path: agent → artifact packager → storage adapters

At the end of a run, force a packaging step:

* Normalize filenames
* Add YAML frontmatter linking run ids and metadata
* Write into vault paths
* Emit `artifact.created` events with stable pointers

Example frontmatter for an output:

```yaml
---
run_id: run_2026_01_20_123456
agent: github_issue_agent@v3
source: "github:owner/repo#issue_81"
created_at: 2026-01-20T18:03:12Z
status: draft
---
```

### Trace writing is non-negotiable

A run is not "complete" until the trace exists. Sapling's calibration loop depends on this. ([GitHub][1])

> **Design Decision:** Before implementing a new trace schema, audit existing Sapling trace files in `brain/traces/` to understand current conventions. Extend, don't replace.

**Pre-implementation check:**
1. Understand current naming conventions
2. Identify required frontmatter fields
3. Check if JSONL companion files already exist

**Trace schema (extends existing Sapling conventions):**

Each trace is a JSONL file with a markdown wrapper for human readability.

`brain/traces/YYYY/MM/{run_id}.md`:
```markdown
---
run_id: run_2026_01_20_123456
template: github_issue_agent@v3
goal: "Triage new issues in repo X"
started_at: 2026-01-20T18:00:00Z
finished_at: 2026-01-20T18:03:12Z
outcome: completed
cost_cents: 42
---

# Trace: GitHub Issue Triage

## Contract Summary
[Rendered contract in human-readable form]

## Outcome
- Triaged 12 issues
- 3 marked high priority
- 9 marked low priority
- 0 errors

## Decisions Log
[see trace.jsonl for full details]

## Calibration Notes
- Issue #45 was incorrectly marked low priority (actually a P1 bug)
- Consider: add rule "issues mentioning 'data loss' are always high priority"
```

`brain/traces/YYYY/MM/{run_id}.jsonl`:
```jsonl
{"type":"contract","data":{"goal":"...","success_criteria":[...]}}
{"type":"phase_start","phase":"plan","timestamp":"2026-01-20T18:00:01Z"}
{"type":"decision","phase":"plan","action":"read_issues","rationale":"Need to see all open issues"}
{"type":"tool_call","tool":"github.list_issues","input":{"repo":"owner/repo"},"output_summary":"12 issues"}
{"type":"phase_end","phase":"plan","timestamp":"2026-01-20T18:00:15Z"}
{"type":"run_complete","outcome":"completed","deliverables":["triage_report.md"]}
```

Trace file contains:

* contract snapshot
* phase summary
* decisions + rationale
* tool calls summary
* errors + recoveries
* what to improve next time (seed for calibration)

## Agent launch UX: what "agent-first intuitive" looks like

### Launch should be a form, not a chat

A launch panel with:

* Template selector
* Goal (one field)
* Deliverables (multi-select + destinations)
* Integrations toggles (GitHub/email/calendar)
* Risk level preset (tightens approval gates)
* Context pack selector (which vault folders/files get mounted)

Then “Start run.”

### Templates carry most complexity

Your users (you) should not rebuild the world every time.

Templates include:

* tool allowlists
* output destinations
* default success criteria
* preflight checks

### Template Versioning

> **Design Decision:** Calibration should not mutate templates retroactively. Runs must pin to a template version for reproducibility.

**Versioning rules:**
- Templates are immutable once published
- Calibration produces a new version with a changelog and diff from the prior version
- Runs store `template_name` + `template_version`
- Old runs reference old versions (reproducibility maintained)

**Dashboard shows:**
- "Template improved 3 times based on your feedback"
- Version history with diffs
- Which runs used which version

## Approvals: the critical UI primitive

Treat every high-risk side effect as a structured approval request:

* Draft email: preview rendered + recipients locked + subject/body diffable
* GitHub: show patch summary + files changed + tests status
* Calendar: show title/time/attendees + conflict check evidence

### Approval Flow Mechanics

> **Design Decision:** Both reviewers agreed enforcement must be real, not just UI decoration. The orchestrator—not the agent—handles all validation. Agents are untrusted compute environments and should never validate tokens themselves.

**Enforcement model (choose for MVP):**

| Option | How it works | When to use |
|--------|--------------|-------------|
| **A: Control-plane only (simpler)** | Control plane is the only executor of side effects; sandbox can only request. | MVP default |
| **B: Token-gated (distributed)** | Signed approval token bound to run_id + action hash + TTL; orchestrator validates before executing. | When side effects execute outside control plane |

**The approval flow:**

1. **Agent yields**: Agent emits `checkpoint.requested` event with:
   - `checkpoint_id`: unique identifier
   - `action_type`: what's being requested (send_email, create_pr, etc.)
   - `preview`: structured payload of what will happen
   - `timeout_seconds`: how long until auto-action (default: 3600)

2. **Orchestrator blocks**: Orchestrator intercepts this event and:
   - Persists the checkpoint to the run ledger
   - Notifies the frontend via the event stream
   - Puts the agent into `awaiting_approval` state (E2B sandbox stays alive but idle)

3. **User acts**: Frontend shows the approval request. User clicks Approve/Reject/Edit.

4. **Orchestrator resumes**: On approval, orchestrator:
   - Records `checkpoint.approved` with approver identity and timestamp
   - Validates the action is still safe (nothing changed while waiting)
   - Resumes the agent process with a simple "proceed" signal
   - The orchestrator—not the agent—gates the subsequent tool call

5. **Agent proceeds**: Agent only knows "I can proceed" or "I must stop." It never sees or validates tokens.

**Timeout behavior:**
- Default: auto-reject with `checkpoint.timeout`
- Configurable per-template: auto-approve for low-risk actions

**Rejection routing:**
- User cancellation → `cancelled` state
- Needs edit → `paused` state
- Policy violation → `failed` state

**Bulk approvals**: For runs with many similar checkpoints (e.g., "send 50 emails"), support:
- "Approve all of type X for this run"
- "Approve all matching pattern Y"

## Calibration UX: turn `/calibrate` into a UI workflow

Sapling's core claim is "improve over time." The UI needs to make calibration fast and specific. ([GitHub][1])

> **Design Decision:** Traces exist to enable calibration, but the UI must close the loop by showing how traces feed back into templates and policies.

### Quick Feedback Controls (After Run Completes)

On the results screen:
1. **Rate this run**: thumbs up/down
2. **Flag a mistake**: point-and-click on specific decisions in the trace
3. **Add a note**: freeform text for what should have happened differently

### Calibration Queue

Traces with feedback accumulate in a review queue:
- Accessible from: Settings → Calibration → Review Pending
- Each item shows: run summary, flagged mistakes, user notes
- Sortable by: "regret", "manual edits after run", "failures", "time spent"

### Rule Extraction

From flagged mistakes, suggest rules:
- "When X, always Y"
- User approves/edits rules
- Rules attach to templates or workspace-wide policies

Example rules:
- "When writing emails, always include…"
- "Never schedule meetings without…"
- "Issues mentioning 'data loss' are always high priority"

### Commit Calibrated Rules Into:

* agent template versions (creates new version, maintains reproducibility)
* skill definitions
* policy presets

Dashboard shows: "Template improved 3 times based on your feedback"

This is where the frontend becomes more valuable than Cursor.

## MVP build: minimum set that proves the concept

Build only what creates a tight loop:

1. Agent template library (even if it’s 3 templates)
2. Run launcher (contract form)
3. Live run monitor (events stream + phase view)
4. Approvals inbox + approval execution
5. Results review (artifacts list + accept)
6. Vault writer (outputs + trace written into Sapling structure)

Everything else is noise until this works.

## Implementation sketch aligned to your existing repo direction

Your `agent-sdk-boilerplate` is positioned as:

* TypeScript-first orchestration
* Agents run in isolated E2B sandboxes
* Streaming via SSE/WebSockets ([GitHub][2])

That points to:

* Frontend: Next.js app
* Backend: Next.js route handlers or separate API service
* Realtime: WebSocket/SSE stream of run events
* Storage adapters:

  * Local vault writer (desktop) or remote vault sync (server)
  * DB for run ledger

If you want the vault to stay local (Obsidian-native), a desktop shell (Tauri/Electron) becomes the cleanest path because it can write directly to the vault while still using web UI components.

## Identity and Access Control

> **Design Decision:** Even for single-user MVP, establish identity primitives. Retrofitting auth is expensive, and audit trails need identity even for one user.

**Approval identity:**
Every `checkpoint.approved` event records:
- `approver_id`: unique user/device identifier
- `approved_from`: "web" | "desktop" | "mobile"
- `timestamp`: ISO 8601

**Workspace isolation (for future multi-user):**
- Workspaces are the unit of access control
- Users are invited to workspaces with roles: owner, operator, viewer
- Runs inherit workspace permissions

For MVP, hardcode a single user/workspace. But design the schema to accommodate multi-user later.

---

## Testing Strategy

> **Design Decision:** For a system with this much async behavior and external dependencies, testability should be designed in, not bolted on.

**Event stream replay tests:**
- Record event streams from real runs
- Replay for deterministic regression testing
- Verify UI renders correctly for known sequences

**Approval gating tests:**
- Mock connectors and tool calls
- Verify approval flow blocks and resumes correctly
- Test timeout and rejection paths

**Contract schema validation:**
- Validate contracts against schema on startup
- Test migration path for schema changes
- Ensure old contracts remain parseable

**End-to-end smoke:**
- Stubbed agents that produce predictable outputs
- Stubbed sandbox adapter
- Verify full flow: launch → events → artifacts → trace

---

## Offline Behavior

> **Design Decision:** If it's local-first, define explicit behavior when connectors are unavailable.

**When connectors are unavailable:**

| Scenario | Behavior | User sees |
|----------|----------|-----------|
| Gmail/GCal/GitHub unreachable | Queue or fail (configurable) | "Gmail is unavailable. Queue email for later?" |
| E2B unreachable | Fail with retry option | "Can't start sandbox. Check your internet connection." |
| Partial connectivity | Run what's possible | "GitHub unavailable. Skipping PR creation." |

**Local-only runs:**
- Runs that only use vault and local files can proceed without external connectors
- Clearly mark runs as "local-only" when no external scopes are requested

**Resume and reconcile:**
- Once connectivity returns, resume queued actions
- Define cache TTL for connector state (e.g., GitHub issue list cached for 5 minutes)

---

## Non-negotiables that keep quality high

* Event schema is stable and versioned.
* Runs are replayable from contract + inputs.
* Approvals are first-class and audited.
* Outputs always land in deterministic vault paths.
* Traces always exist and are easy to calibrate.
* Tool policies are visible and enforced (not "prompted").

([GitHub][1])

[1]: https://github.com/hwells4/Sapling "GitHub - hwells4/Sapling: A context engineering system for Claude Code + Obsidian that evolves to your preferences over time."
[2]: https://github.com/hwells4/agent-sdk-boilerplate "GitHub - hwells4/agent-sdk-boilerplate: Launch enterprise-grade agents on the Claude Agent SDK with a few lines of code."
