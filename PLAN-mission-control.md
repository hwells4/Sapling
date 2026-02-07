# Sapling Mission Control — Implementation Plan (v2)

## What Exists Today

| Layer | Status | Notes |
|-------|--------|-------|
| **Types** | Complete | Run, Contract, Event, Artifact, Template — all modeled with Zod |
| **Services** | Complete (in-memory) | 13 services with factory pattern, swappable backends |
| **API Routes** | Complete | `/api/runs/*`, `/api/approvals/*` — CRUD + actions |
| **React Hooks** | Complete | `useEventStream` (SSE), `useRun` (data + derived state) |
| **UI Components** | Complete | Sidebar, Wizard, Inspector, Approval, Results |
| **Frontend** | Styled, wired | Dark/cream/white surfaces, black buttons + green ping, wizard modal |
| **Persistence** | None | All in-memory, resets on server restart |
| **Agent Runtime** | None | E2B dependency installed but no OpenClaw integration |
| **Auth** | None | No login, no tenant isolation |
| **Search** | None | No QMD integration yet |
| **Convex** | Schema drafted | `convex/schema.ts` + function stubs written by research agent |

## Key Architecture Change: Convex Replaces SQLite + SSE

The original plan used SQLite for persistence and SSE for real-time updates. **Convex replaces both** in a single move:

- **Persistence**: Convex's managed database (no SQLite, no migrations, no WAL tuning)
- **Real-time**: Convex's WebSocket subscriptions via `useQuery` (no SSE, no `EventSource`, no reconnection logic)
- **Transactions**: Convex mutations are atomic (no manual transaction management)
- **Auth**: Convex Auth or Clerk integration (no Cloudflare Access JWT validation)
- **Scheduling**: Convex cron jobs for approval timeouts (no in-process `setInterval`)

**What Convex does NOT replace:**
- Agent runtime (still tmux/OpenClaw on the VPS)
- Agent directories (still filesystem-based CLAUDE.md)
- QMD vault search (still local SQLite index)
- The VPS itself (agents need a machine to run on)

## Architecture Target

```
Browser ──WebSocket──▸ Convex Cloud
                         │
                    ┌────┴────┐
                    │         │
              Convex DB    Convex Actions
            (runs, events,  (HTTP calls to
             approvals,      VPS agent API)
             sessions)
                              │
                              ▼
                      VPS (agent-api)
                         │
           ┌─────────────┼─────────────┐
           │             │             │
       OpenClaw       QMD Index    Agent Dirs
     (spawn/stop     (vault search, (CLAUDE.md
      tmux sessions)  MCP for       + skills
           │          agents)       + hooks)
           │
     ┌─────┼─────┐
     │     │     │
  Claude  Codex  E2B
  Code   (tmux)  Sandbox
  (tmux)
```

**Data flow:**
1. User clicks "Start Task" → Convex mutation creates run + calls VPS agent-api action
2. VPS spawns tmux session → agent starts working
3. Agent hooks POST events to VPS agent-api → VPS calls Convex mutation to store events
4. Convex DB updates → all `useQuery` subscriptions auto-refresh → UI updates live
5. User approves/rejects → Convex mutation → VPS signals agent

---

## Phase 1: Convex Setup + Schema (1-2 days)

**Goal:** Convex deployed, schema live, basic CRUD working, React hooks wired.

### 1.1 Install and configure Convex

```bash
cd ~/Projects/Sapling
npm install convex
npx convex dev   # Creates convex/ dir, links to Convex Cloud project
```

**Environment:**
- `.env.local` → `NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud`

### 1.2 Convex schema

Already drafted at `convex/schema.ts`. Four tables:

| Table | Purpose | Key Indexes |
|-------|---------|-------------|
| `runs` | Agent work units | `by_workspace`, `by_workspace_state`, `by_state` |
| `events` | Append-only event log | `by_run_seq`, `by_run_type`, `by_timestamp` |
| `approvals` | Human-in-the-loop checkpoints | `by_run`, `by_status`, `by_checkpoint`, `by_expiry` |
| `agentSessions` | Tracks tmux processes | `by_run`, `by_state`, `by_agent` |

The schema maps 1:1 to existing Zod types (`RunSchema`, `EventSchema`, etc.) with Convex-native validators replacing Zod on the server side.

### 1.3 Convex functions (mutations + queries)

Already drafted at `convex/runs.ts`, `convex/events.ts`, `convex/approvals.ts`:

**Mutations:**
- `runs.create` — Create a run from a contract
- `runs.transitionState` — Validated state machine transitions
- `runs.updateCost` — Increment cost tracking
- `runs.addArtifact` — Attach artifact references
- `events.append` — Single event with seq validation
- `events.appendBatch` — Atomic batch insert
- `approvals.requestApproval` — Create checkpoint, transition run to awaiting
- `approvals.approve` / `approvals.reject` — Resolve and resume/cancel
- `approvals.processTimeouts` — Cron-driven expiry

**Queries (all real-time via WebSocket):**
- `runs.kanbanBoard` — Groups runs by state for the Kanban columns
- `runs.get` — Single run by ID
- `runs.listByWorkspace` — Paginated run list
- `runs.listByState` — Worker polling for pending runs
- `events.listByRun` — Events with `afterSeq` cursor
- `events.latestForRun` — Last N events (Kanban card preview)
- `approvals.listPending` — Global approval queue
- `approvals.countPending` — Badge count

### 1.4 ConvexProvider in Next.js

**File:** `src/components/convex-provider.tsx`

```typescript
'use client'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import { ReactNode } from 'react'

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>
}
```

Wrap in `src/app/layout.tsx`.

### 1.5 Replace hooks: `useEventStream` → `useQuery`

The entire `useEventStream` hook (350 lines of SSE + reconnection logic) is replaced by:

```typescript
const events = useQuery(api.events.listByRun, { runId })
```

Convex handles: WebSocket connection, reconnection, deduplication, ordering.

**`useRun` simplification:** Replace REST fetch + SSE merge with pure Convex queries:

```typescript
function useRun(runId: Id<"runs"> | null) {
  const run = useQuery(api.runs.get, runId ? { runId } : "skip")
  const events = useQuery(api.events.listByRun, runId ? { runId } : "skip")
  const pendingApprovals = useQuery(api.approvals.listByRun, runId ? { runId } : "skip")
  // Derived state computed from reactive queries — auto-updates
}
```

### 1.6 Cron job for approval timeouts

**File:** `convex/crons.ts`

```typescript
import { cronJobs } from "convex/server"
import { internal } from "./_generated/api"

const crons = cronJobs()
crons.interval("process approval timeouts", { seconds: 30 }, internal.approvals.processTimeouts)
export default crons
```

### 1.7 Seed data

**File:** `convex/seed.ts` — Internal action that creates demo runs for UI dev.

---

## Phase 2: Agent Directory System (1-2 days)

**Goal:** Define agents as CLAUDE.md project directories. UI can browse and create them.

*Unchanged from v1* — agent directories are filesystem-based on the VPS. The Convex layer stores `templateId` / `agentSlug` references but the CLAUDE.md files live on disk.

### 2.1 Agent directory structure

```
agents/
├── _base/
│   └── .claude/
│       └── hooks/
│           └── event-bridge.sh   # Posts events to VPS agent-api
│
├── email-assistant/
│   ├── CLAUDE.md
│   ├── .claude/
│   │   ├── settings.json
│   │   └── skills/
│   └── context/
│
├── github-triage/
│   ├── CLAUDE.md
│   ├── .claude/
│   │   ├── settings.json
│   │   └── skills/
│   └── context/
│
└── research-analyst/
    ├── CLAUDE.md
    ├── .claude/
    │   ├── settings.json
    │   └── skills/
    └── context/
```

### 2.2 VPS agent-api (lightweight HTTP server)

A small HTTP server on the VPS that handles agent operations. This is NOT the Next.js app — it's a separate process that runs alongside the agents.

**File:** `agent-api/server.ts` (Express or Hono, runs on VPS port 3001)

**Endpoints:**
- `GET /agents` — List agent directories
- `GET /agents/:slug` — Read CLAUDE.md + settings.json + skills
- `POST /agents` — Create new agent directory from template
- `POST /sessions/spawn` — Spawn tmux agent session
- `POST /sessions/:id/stop` — Kill tmux session
- `GET /sessions` — List running tmux sessions
- `POST /events` — Accept events from agent hooks, forward to Convex

**Why separate from Next.js?** The Next.js app runs anywhere (Vercel, VPS, etc.) and talks to Convex Cloud. The agent-api runs on the VPS where tmux and Claude Code are installed. Decoupling these means:
- The UI can be deployed to Vercel for fast global delivery
- The agent runtime stays on VPS hardware
- Multiple UIs can share one VPS agent pool

### 2.3 Map wizard to agent creation

Update the New Task wizard so that:
- Step 2 (Template) calls Convex action that fetches from VPS `GET /agents`
- Submitting calls `runs.create` mutation + Convex action that calls VPS `POST /sessions/spawn`
- Agent CLAUDE.md gets the user's goal injected

---

## Phase 3: OpenClaw Agent Runtime (2-3 days)

**Goal:** Clicking "Start Task" actually spawns a Claude Code agent that does work.

### 3.1 Agent session adapter (on VPS)

Manages agent lifecycle via tmux. Part of the `agent-api` server.

```typescript
interface AgentSessionAdapter {
  spawn(runId: string, agentSlug: string, goal: string): Promise<AgentSession>
  stop(sessionId: string): Promise<void>
  list(): Promise<AgentSession[]>
  getOutput(sessionId: string, lines?: number): Promise<string>
  isAlive(sessionId: string): Promise<boolean>
}
```

**Implementation:** Same tmux pattern as OpenClaw:
- `spawn`: `tmux new-session -d -s sapling-{runId} "cd agents/{slug} && claude --dangerously-skip-permissions -p '{goal}'"`
- `stop`: `tmux kill-session -t sapling-{runId}`
- `list`: `tmux list-sessions` filtered by `sapling-` prefix
- `getOutput`: `tmux capture-pane -t sapling-{runId} -p`

### 3.2 Event bridge hook

Agent hooks POST events to the VPS agent-api, which forwards them to Convex.

**File:** `agents/_base/.claude/hooks/event-bridge.sh`

```bash
#!/bin/bash
# PostToolUse hook — posts event to VPS agent-api
RUN_ID="${SAPLING_RUN_ID}"
TOOL_NAME="${CLAUDE_TOOL_NAME:-unknown}"

curl -s -X POST "http://localhost:3001/events" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SAPLING_RUN_TOKEN}" \
  -d "{\"runId\":\"${RUN_ID}\",\"type\":\"tool.called\",\"payload\":{\"tool_name\":\"${TOOL_NAME}\"}}"
```

The VPS agent-api receives this and calls `events.append` mutation on Convex. This is more secure than the agent calling Convex directly (VPS agent-api can validate the run token).

### 3.3 Convex actions for VPS communication

**File:** `convex/agentActions.ts`

Convex actions (not mutations — they can make HTTP calls) that talk to the VPS:

```typescript
export const spawnAgent = action({
  args: { runId: v.id("runs"), agentSlug: v.string(), goal: v.string() },
  handler: async (ctx, args) => {
    // Call VPS agent-api to spawn tmux session
    const res = await fetch(`${VPS_AGENT_API_URL}/sessions/spawn`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${VPS_API_KEY}` },
      body: JSON.stringify(args),
    })
    const session = await res.json()

    // Store session in Convex
    await ctx.runMutation(internal.agentSessions.create, {
      runId: args.runId,
      agentSlug: args.agentSlug,
      tmuxSession: session.tmuxSession,
      pid: session.pid,
    })
  },
})
```

### 3.4 Full run lifecycle

Creating a run:
1. Wizard submits → `runs.create` mutation (Convex)
2. Convex action calls VPS `POST /sessions/spawn`
3. VPS spawns tmux session with `SAPLING_RUN_ID` env var
4. Agent starts working, hooks fire `POST /events` on each tool call
5. VPS agent-api calls `events.append` mutation on Convex
6. All `useQuery(api.events.listByRun)` subscriptions auto-refresh
7. Kanban cards, Inspector, and all UI update instantly

### 3.5 Heartbeat + crash recovery

VPS agent-api runs a heartbeat loop:
- Every 30s, checks `tmux list-sessions` for `sapling-*` sessions
- Updates `agentSessions.heartbeat` mutation in Convex
- If a session disappears unexpectedly, calls `runs.transitionState` → `failed`

Convex cron job checks for stale heartbeats and marks sessions as `crashed`.

---

## Phase 4: Kanban Mission Control View (2-3 days)

**Goal:** Replace the empty state with a real-time Kanban board of running agents.

### 4.1 Kanban board component

**File:** `src/components/kanban/kanban-board.tsx`

```typescript
function KanbanBoard({ workspaceId }: { workspaceId: string }) {
  const board = useQuery(api.runs.kanbanBoard, { workspaceId })
  // board = { queue, running, needsHuman, done, failed }
  // Auto-updates when ANY run changes state
}
```

Five columns:
| Column | States | Card indicator |
|--------|--------|----------------|
| Queue | `pending` | Neutral |
| Running | `initializing`, `planning`, `executing`, `verifying`, `packaging` | Green ping dot |
| Needs Human | `awaiting_approval`, `paused` | Yellow indicator |
| Done | `completed` | Green check |
| Failed | `failed`, `cancelled`, `timeout` | Red indicator |

**Key Convex advantage:** One `useQuery` call returns the entire board. When an agent transitions from `executing` to `awaiting_approval`, the card moves columns *instantly for all connected users* with zero custom code.

### 4.2 Run card with live events

Each card uses a separate query for its last 3 events:

```typescript
function RunCard({ run }: { run: Run }) {
  const latestEvents = useQuery(api.events.latestForRun, {
    runId: run._id,
    limit: 3,
  })
  // Card shows: agent name, goal, phase, elapsed, cost, last 3 tool calls
}
```

**Performance note (from T3 Chat postmortem):** Skip event subscriptions for hidden tabs using `document.hidden` + `"skip"` arg pattern. This prevents thundering herd on background tab invalidations.

### 4.3 Run detail panel

Clicking a card opens the Inspector panel (already built) with live data from Convex queries:

```typescript
const run = useQuery(api.runs.get, { runId })
const events = useQuery(api.events.listByRun, { runId })
const approvals = useQuery(api.approvals.listByRun, { runId })
```

### 4.4 Approval inbox

Pending approval count for the sidebar badge:

```typescript
const pendingCount = useQuery(api.approvals.countPending)
```

List all pending approvals in a dedicated view:

```typescript
const pending = useQuery(api.approvals.listPending)
```

### 4.5 Update page.tsx

Replace the current empty state with the Kanban board. Keep the wizard modal as-is.

**Files:**
- `src/components/kanban/kanban-board.tsx` — Board layout
- `src/components/kanban/run-card.tsx` — Individual card
- `src/components/kanban/column.tsx` — Column wrapper
- `src/app/page.tsx` — Swap empty state for Kanban

---

## Phase 5: QMD Integration (1-2 days)

**Goal:** Agents can search the vault. Users can search from the UI.

*Unchanged from v1* — QMD runs locally on the VPS.

### 5.1 Install and configure QMD

```bash
bun install -g github:tobi/qmd
qmd collection add vault ./brain "Sapling vault"
qmd collection add agents ./agents "Agent definitions"
qmd embed
```

### 5.2 QMD MCP for agents

Add QMD as an MCP server in the base agent config:

```json
{
  "mcpServers": {
    "qmd": { "command": "qmd", "args": ["mcp"] }
  }
}
```

### 5.3 Search via VPS agent-api

`GET /search?q=...` on the VPS agent-api, proxied through a Convex action for the UI.

### 5.4 Auto-reindex

File watcher or cron that runs `qmd embed --incremental` when vault files change.

---

## Phase 6: Auth + Production (2-3 days)

**Goal:** Secure, deployable, multi-user.

### 6.1 Convex Auth (replaces Cloudflare Access)

Convex has built-in auth support. Options:
- **Convex Auth** (built-in): Email/password, magic links, OAuth (GitHub, Google)
- **Clerk integration**: `ConvexProviderWithClerk` — richer UI, more providers
- **Auth0 integration**: `ConvexProviderWithAuth0`

Recommended: **Clerk** for the fastest path to production auth with a polished UI.

```typescript
// layout.tsx
<ClerkProvider>
  <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
    {children}
  </ConvexProviderWithClerk>
</ClerkProvider>
```

### 6.2 Tenant isolation in Convex

Every query/mutation receives `ctx.auth.getUserIdentity()`. Enforce `workspaceId` scoping:

```typescript
export const listByWorkspace = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Unauthenticated")
    const workspaceId = identity.tokenIdentifier
    return ctx.db.query("runs")
      .withIndex("by_workspace", q => q.eq("workspaceId", workspaceId))
      .collect()
  },
})
```

### 6.3 VPS agent-api auth

VPS agent-api uses a shared secret (`VPS_API_KEY`) for Convex action → VPS calls. Per-run tokens for agent hook → VPS calls.

### 6.4 Deploy Next.js to Vercel (optional)

Since persistence is in Convex Cloud and agents run on VPS, the Next.js app can deploy to Vercel for:
- Global CDN
- Automatic deployments from git
- Zero-config SSL

Or keep it on the VPS behind Cloudflare Tunnel if you prefer.

### 6.5 Systemd for VPS agent-api

```ini
# /etc/systemd/system/sapling-agent-api.service
[Unit]
Description=Sapling Agent API
After=network.target

[Service]
Type=simple
User=sapling
WorkingDirectory=/opt/sapling
ExecStart=/usr/bin/node agent-api/server.js
Environment=CONVEX_URL=https://your-project.convex.cloud
Environment=VPS_API_KEY=your-secret-key
Restart=always

[Install]
WantedBy=multi-user.target
```

---

## Dependency Graph

```
Phase 1 (Convex + Schema)
    │
    ├── Phase 2 (Agent Directories + VPS API)
    │       │
    │       └── Phase 3 (Agent Runtime) ──── Phase 5 (QMD)
    │               │
    │               └── Phase 4 (Kanban UI)
    │
    └── Phase 6 (Auth) — can start in parallel after Phase 1
```

## Timeline Estimate

| Phase | Effort | Can Parallelize? |
|-------|--------|-----------------|
| 1. Convex + Schema | 1-2 days | — |
| 2. Agent Directories + VPS API | 1-2 days | After Phase 1 |
| 3. Agent Runtime | 2-3 days | After Phase 2 |
| 4. Kanban UI | 1-2 days | After Phase 1 (Convex queries) |
| 5. QMD Integration | 1 day | After Phase 2 |
| 6. Auth + Production | 1-2 days | After Phase 1 |

**Critical path:** 1 → 2 → 3 = ~5-7 days to functional agents
**Kanban can start in parallel** with Phase 2 (just needs Convex queries + seed data)
**Total with parallelism:** ~7-10 days to fully operational

**MVP in ~3-4 days:** Phase 1 + seed data + Kanban UI gives a live dashboard that updates in real-time (with mock data). Phase 2+3 adds real agents.

---

## What Changes from v1

| Aspect | v1 (SQLite + SSE) | v2 (Convex) |
|--------|-------------------|-------------|
| **Persistence** | `better-sqlite3`, WAL mode, migrations | Convex Cloud DB, schema-driven |
| **Real-time** | SSE (`EventSource`) + custom reconnection | WebSocket via `useQuery` (automatic) |
| **Event streaming** | `useEventStream` hook (350 lines) | `useQuery(api.events.listByRun)` (1 line) |
| **Transactions** | Manual SQLite transactions | Convex mutations (automatic ACID) |
| **Scheduling** | `setInterval` in-process | Convex cron jobs |
| **Auth** | Cloudflare Access JWT | Convex Auth / Clerk |
| **Deployment** | VPS-only (Next.js + SQLite) | Vercel (UI) + VPS (agents) |
| **API routes** | Next.js API routes (CRUD) | Convex functions (queries + mutations) |
| **Hooks** | `useEventStream` + `useRun` | `useQuery` + `useMutation` |

## What Does NOT Change

- Component visual design (dark/cream/white, black buttons, green ping)
- Wizard flow (goal → template → scope → confirm)
- Agent directory structure (CLAUDE.md + skills + hooks)
- Agent runtime (tmux/OpenClaw)
- QMD vault search
- Inspector, Approval, Results component structure

## New Dependencies

| Package | Purpose |
|---------|---------|
| `convex` | Database, real-time, functions |
| `@clerk/nextjs` (optional) | Auth provider |
| `convex/react-clerk` (optional) | Clerk + Convex integration |
| `qmd` (global) | Vault search + MCP |

**Removed dependencies:**
- `better-sqlite3` / `@types/better-sqlite3` (no longer needed)

## Files Created (Estimated)

| Phase | New Files | Modified Files |
|-------|-----------|---------------|
| 1 | `convex/schema.ts`, `convex/runs.ts`, `convex/events.ts`, `convex/approvals.ts`, `convex/agentSessions.ts`, `convex/crons.ts`, `convex/seed.ts`, `src/components/convex-provider.tsx` | `src/app/layout.tsx`, `src/hooks/useRun.ts` |
| 2 | `agent-api/server.ts`, `convex/agentActions.ts` | `src/components/wizard/new-task-wizard.tsx` |
| 3 | `agents/_base/.claude/hooks/event-bridge.sh` | `agent-api/server.ts`, `convex/agentActions.ts` |
| 4 | `src/components/kanban/kanban-board.tsx`, `run-card.tsx`, `column.tsx` | `src/app/page.tsx` |
| 5 | — | `agents/_base/.claude/settings.json`, `agent-api/server.ts` |
| 6 | Auth config files | `src/app/layout.tsx`, `convex/` functions |
| **Total** | **~15 new** | **~8 modified** |

## Performance Considerations (from T3 Chat postmortem)

1. **Skip subscriptions for hidden tabs** — Use `document.hidden` + `"skip"` to pause queries when tab is not visible. Prevents thundering herd on reconnection.
2. **Paginate large event lists** — Use `usePaginatedQuery` for runs with 500+ events. Convex re-sends entire query results on change, not diffs.
3. **Batch event writes** — Insert 10 events in one mutation call rather than 10 separate calls.
4. **Watch 32K doc scan limit** — A single query cannot scan more than 32,000 documents.
5. **Index everything** — Always use `.withIndex()` for Convex queries, never `.filter()` alone.

## Security Notes (from Codex review)

1. **Per-run tokens for event bridge** — Agent hooks must authenticate with a per-run token, not just `RUN_ID`.
2. **VPS API key** — Convex actions authenticate to VPS with a shared secret.
3. **Slug validation** — VPS agent-api must validate agent slugs to prevent path traversal.
4. **QMD scoping** — Add allow/deny filters to prevent indexing secrets and PII.
5. **Tool policy enforcement** — The `--dangerously-skip-permissions` flag is required for autonomous operation but should be replaced with proper settings.json `allowedTools` config where possible.
