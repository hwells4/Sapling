## Product frame

Build the frontend around **task runs** (what a non-technical person understands), not “agents” (implementation detail).

A run is: **intent → plan → work → checks → deliverables → saved record**.

This maps cleanly onto Claude’s common agent loop: **gather context → take action → verify work → repeat**. ([anthropic.com][1])

Your existing `agent-sdk-boilerplate` already aligns with this product shape: it’s a TypeScript orchestration layer for running Claude agents inside **isolated E2B sandboxes** with **real-time streaming** (SSE + WebSocket) and Next.js-friendly patterns. ([GitHub][2])

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
   (derived from Claude’s loop) ([anthropic.com][1])

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

---

## How “monitoring” stays intuitive without showing code

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

### Add a “Checks” panel per run

Examples:

* “All promised deliverables produced”
* “No external actions executed without approval”
* “Email tone matches template”
* “Calendar conflicts checked”
* “GitHub links validated”

Under the hood you can implement:

* deterministic validators (schema validation, link checks, conflict checks)
* a second “reviewer” agent that verifies outputs against the run contract (kept invisible; surfaced as pass/fail)

### Put approvals where harm is possible

Default policy:

* Read-only actions: auto
* Write to vault: auto + undo history
* External side effects (send email, create meeting, push changes): approval required

Claude Agent SDK’s permissions + hooks are built for this exact pattern. ([Claude][6])

---

## Operational model for long-running and resumable runs

Non-technical users will close tabs. Runs must survive that.

Minimum:

* Every event appended to DB
* UI can reconnect to stream by run_id
* “Resume” uses stored session state

Anthropic explicitly discusses harnessing long-running agents across context windows by leaving clear artifacts and using an initializer + incremental worker approach. That pattern matches your “agents produce artifacts; UI shows artifacts; system resumes later” goal. ([anthropic.com][8])

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

### Event (append-only)

The atomic unit of observability.

Minimum event types:

* `run.started`
* `phase.changed` (plan → execute → verify → package)
* `tool.called` / `tool.result`
* `file.changed` (with diff/patch)
* `artifact.created`
* `checkpoint.requested` (approval needed)
* `run.completed` / `run.failed`

Your `agent-sdk-boilerplate` already emphasizes real-time streaming (SSE/WebSocket) and isolated E2B execution, which aligns with event streaming into a frontend. ([GitHub][2])

### Artifact

A durable output:

* markdown/doc output (goes to vault)
* patch set / PR link
* JSON payload for email/calendar
* zipped sandbox snapshot (optional)
* trace bundle

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

A run is not “complete” until the trace exists. Sapling’s calibration loop depends on this. ([GitHub][1])

Trace file contains:

* contract snapshot
* phase summary
* decisions + rationale
* tool calls summary
* errors + recoveries
* what to improve next time (seed for calibration)

## Agent launch UX: what “agent-first intuitive” looks like

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

## Approvals: the critical UI primitive

Treat every high-risk side effect as a structured approval request:

* Draft email: preview rendered + recipients locked + subject/body diffable
* GitHub: show patch summary + files changed + tests status
* Calendar: show title/time/attendees + conflict check evidence

Approvals produce signed events:

* `checkpoint.approved`
* `checkpoint.rejected`

Agent resumes only with an approval token.

## Calibration UX: turn `/calibrate` into a UI workflow

Sapling’s core claim is “improve over time.” The UI needs to make calibration fast and specific. ([GitHub][1])

Calibration screen:

* List traces (sortable by “regret”, “manual edits after run”, “failures”, “time spent”)
* Trace detail with:

  * decisions timeline
  * “what should have happened” annotations
  * extraction of reusable rules (“when writing emails, always include…”, “never schedule meetings without…”)
* Commit calibrated rules into:

  * agent template versions
  * skill definitions
  * policy presets

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

## Non-negotiables that keep quality high

* Event schema is stable and versioned.
* Runs are replayable from contract + inputs.
* Approvals are first-class and audited.
* Outputs always land in deterministic vault paths.
* Traces always exist and are easy to calibrate.
* Tool policies are visible and enforced (not “prompted”).

([GitHub][1])

[1]: https://github.com/hwells4/Sapling "GitHub - hwells4/Sapling: A context engineering system for Claude Code + Obsidian that evolves to your preferences over time."
[2]: https://github.com/hwells4/agent-sdk-boilerplate "GitHub - hwells4/agent-sdk-boilerplate: Launch enterprise-grade agents on the Claude Agent SDK with a few lines of code."
