---
name: agent-chatroom
description: Multi-agent coordination hub for swarm tasks. Creates task-scoped chatrooms where agents communicate, share discoveries, and adapt to each other's findings. Enables both live coordination and retrospective review of agent behavior.
---

<objective>
Enable agents to coordinate in real-time during multi-agent tasks. Agents post actionable discoveries that change how other agents should behave. The chatroom persists for human review to improve skills, agents, and workflows over time.
</objective>

<spawn_threshold>
Invoke chatroom when ANY of:
- Task requires reading 3+ files
- Task requires gathering from 3+ sources
- Task has 2+ independent workstreams
</spawn_threshold>

<quick_start>
When a task spawns multiple agents:

1. Create chatroom file at `brain/traces/agents/{date}-{task-slug}.md`
2. Initialize with frontmatter and task context
3. Instruct sub-agents to read chatroom at start, post actionable discoveries
4. Orchestrator monitors chatroom for coordination signals
5. On completion, chatroom becomes reviewable artifact
</quick_start>

<when_to_create>
Create a chatroom when:

- Task will spawn 2+ sub-agents
- Agents may discover information affecting other agents' work
- Coordination between agents would improve outcomes
- You want observability into agent decision-making

Do NOT create a chatroom for:
- Single-agent tasks
- Simple sequential operations
- Tasks where agents are truly independent
</when_to_create>

<chatroom_format>
```markdown
---
schema_version: 1.0.0
date: {YYYY-MM-DD}
task: {task description}
agents: [{agent-1}, {agent-2}, ...]
status: active | completed
linked_trace: brain/traces/{date}-{slug}.md
---

# Agent Chatroom: {task}

## Coordination Log

[Entries appear here as agents post]
```
</chatroom_format>

<coordination_signals>
**Explicit signals for agent state.** These are grep-able and unambiguous:

| Signal | Meaning | When to Use |
|--------|---------|-------------|
| `→ READY` | Work complete, no blockers | When you've finished your task |
| `→ WAITING @agent` | Blocked on specific agent | When you need input from another agent |
| `→ BLOCKED: reason` | External blocker | API failure, missing data, etc. |
| `→ CLOSE` | Coordination complete | **Orchestrator only** - signals agents may stop |

**Why explicit signals matter:**
- SubagentStop hooks can detect these programmatically
- Prevents agents from stopping before coordination is complete
- Creates clear handoff points between agents

**Examples:**
```markdown
## [14:35] research-agent
Research complete. 3 competitor analyses in brain/research/
→ READY

## [14:36] draft-agent
Need competitor context before drafting.
→ WAITING @research-agent

## [14:37] email-loader
Gmail API rate limited, retrying in 30s.
→ BLOCKED: API rate limit

## [14:45] orchestrator
All agents reported READY. Proceeding to synthesis.
→ CLOSE
```
</coordination_signals>

<posting_protocol>
**Philosophy:** This is a shared space for agents to coordinate. Use it naturally.

**Post format:**
```markdown
## [{HH:MM}] {agent-name}
{What you're doing, found, or need}
→ @{target-agent} {optional: context for them}
→ {SIGNAL} (when applicable)
```

**Examples:**
```markdown
## [14:30] orchestrator
Starting context gather for Acme. Let's see what we find.

## [14:31] linear-status
No Linear project found for Acme Corp.
→ @email-history might need to dig deeper for activity context
→ READY

## [14:31] client-loader
Found the client file. Sarah is primary contact, $8k retainer, month 2.
→ READY

## [14:32] email-history
Expanding search to 30 days. Found heated thread from last week re: delayed deliverable.
→ @orchestrator heads up: client may be frustrated
→ READY

## [14:32] attio-loader
Deal status is "At Risk" - marked 3 days ago. Confirms what email-history found.
→ READY

## [14:33] voice-context
Noted the frustration signals. Adjusting tone recommendation accordingly.
→ READY

## [14:34] orchestrator
All agents complete. Key signal: client frustration confirmed by 2 sources.
→ CLOSE
```

**Guidelines (not rules):**
- Post what feels relevant
- Mention other agents when it's for them specifically
- **Always post a signal** (READY/WAITING/BLOCKED) when finishing or stuck
- More signal is better than silence when coordinating
</posting_protocol>

<reading_protocol>
**When to read:**
- At start of your work (see what's happened)
- Before major decisions (context may have changed)
- When mentioned (@your-agent-name)

**How to react:**
- If discovery affects your approach → adapt and post what you're doing differently
- If you can confirm another agent's finding → post confirmation
- If you disagree with direction → post concern with reasoning

**Example reaction:**
```markdown
## [14:34] voice-context
@email-history noted frustration signal.
Adjusting tone recommendation: lead with empathy, acknowledge delay.
→ @orchestrator tone guidance updated
```
</reading_protocol>

<orchestrator_role>
The orchestrator (main agent) has special responsibilities beyond just spawning agents.
It must actively coordinate, respond to requests, handle failures, and close the chatroom.

## Core Responsibilities

1. **Create chatroom** at task start
2. **Track task IDs** when spawning agents
3. **Poll for coordination signals** (WAITING @orchestrator)
4. **Handle agent crashes** (post BLOCKED on their behalf)
5. **Enforce timeout** if coordination stalls
6. **Post → CLOSE** when complete
7. **Synthesize from TaskOutput** (not chatroom)

## Task ID Tracking

When spawning background agents, track their task_ids:

```python
# Conceptual - orchestrator maintains this state
spawned_agents = {
    "client-loader": {"task_id": "abc123", "status": "running"},
    "email-history": {"task_id": "def456", "status": "running"},
    "linear-status": {"task_id": "ghi789", "status": "running"},
}
```

This allows polling each agent's status and collecting results.

## Polling Loop Pattern

After spawning agents, orchestrator enters a polling loop:

```
┌─────────────────────────────────────────────────────┐
│  ORCHESTRATOR POLLING LOOP                          │
│                                                     │
│  1. grep chatroom for "→ WAITING @orchestrator"    │
│     - If found: respond, post to chatroom           │
│                                                     │
│  2. For each spawned agent:                         │
│     TaskOutput(task_id, block=false)                │
│     - If error: post "→ BLOCKED: {agent} crashed"  │
│     - If complete: mark done, collect result        │
│                                                     │
│  3. Check timeout (default: 5 minutes)              │
│     - If exceeded: post warning, consider CLOSE     │
│                                                     │
│  4. All agents done? → Exit loop                    │
│     Else: wait 15-30 seconds, repeat               │
└─────────────────────────────────────────────────────┘
```

## Crash Handling

If TaskOutput shows an agent errored/crashed:

```markdown
## [14:35] orchestrator
@linear-status agent crashed with error: API timeout
→ BLOCKED: linear-status unavailable
→ @email-history proceed without Linear context
```

This prevents other agents from waiting forever on a dead agent.

## Timeout Handling

Set a maximum coordination time (e.g., 5 minutes). If exceeded:

```markdown
## [14:40] orchestrator
Timeout reached (5 min). Current status:
- client-loader: READY
- email-history: READY
- linear-status: BLOCKED (crashed)
- voice-context: still running

Proceeding with available results.
→ CLOSE
```

## Responding to WAITING Signals

When an agent posts `→ WAITING @orchestrator`:

```markdown
## [14:32] email-history
Found 50+ emails. Should I include archived threads?
→ WAITING @orchestrator

## [14:33] orchestrator
@email-history Yes, include archived. Client relationship is long-term.
```

The orchestrator's response unblocks the agent.

## Synthesis Pattern

**Do NOT read full chatroom for synthesis.** Use TaskOutput results:

```python
# Collect results from each agent
results = {}
for agent_name, info in spawned_agents.items():
    output = TaskOutput(info["task_id"], block=True)
    results[agent_name] = output

# Synthesize from structured results
# Chatroom was for coordination, not results delivery
```

The chatroom is for:
- Live coordination (WAITING, BLOCKED signals)
- Human observability (review later)

NOT for:
- Passing final results (use TaskOutput)
</orchestrator_role>

<agent_instruction_template>
When spawning a sub-agent that should participate in a chatroom, include this in the prompt:

```
CHATROOM PROTOCOL:
- File: {chatroom_path}
- Read at start to see what others have posted
- Post findings, questions, confirmations, adaptations

FORMAT:
## [{time}] {your-agent-name}
{your message}
→ @{agent} {optional context for them}
→ {SIGNAL}

SIGNALS (required when finishing or blocked):
- → READY = You completed your work
- → WAITING @agent = You need input from another agent
- → BLOCKED: reason = External issue (API, data, etc.)

IMPORTANT: A SubagentStop hook will prevent you from stopping until:
1. You post → READY (or WAITING/BLOCKED)
2. Orchestrator posts → CLOSE

If blocked from stopping, read the chatroom for updates and address any
pending items. If just waiting on other agents, wait 15-60 seconds and
check again.
```
</agent_instruction_template>

<integration_with_task>
When `/task` spawns sub-agents:

1. Check if task will use multiple agents
2. If yes, create chatroom alongside decision trace:
   - Trace: `brain/traces/{date}-{slug}.md`
   - Chatroom: `brain/traces/agents/{date}-{slug}.md`
3. Link chatroom in trace frontmatter
4. Include chatroom protocol in sub-agent prompts
5. **Wait for all agents to post READY** before synthesis
6. **Post → CLOSE** when coordination is complete
7. On completion, update chatroom status to `completed`
</integration_with_task>

<state_sync_architecture>
## Why Post-Write Hooks Are Critical

In multi-agent swarms, the chatroom file becomes a bottleneck:

```
WITHOUT STATE SYNC:
  Agent A writes → File (2-5KB)
  Agent B writes → File
  Agent C writes → File

  Orchestrator polls → Read file → Parse markdown → Regex signals
                       (expensive)  (error-prone)   (repeated)

  Every reader re-parses. Each may interpret differently.
  Polling takes 15-30s because parsing is expensive.
```

```
WITH STATE SYNC (post-write hook):
  Agent A writes → Hook fires → State.json updated
  Agent B writes → Hook fires → State.json updated
  Agent C writes → Hook fires → State.json updated

  Orchestrator polls → Read state.json (50 bytes) → Check fields
                       (instant)                    (no parsing)

  Single source of truth. O(1) lookup. Can poll every 5s.
```

## The Hook

`chatroom-state-sync.py` fires after every write to `brain/traces/agents/*.md`:

1. **Parses** the chatroom content (once, at write time)
2. **Computes** authoritative state:
   - `agents_ready: ["email-loader", "calls-loader"]`
   - `agents_waiting: {"draft-agent": "research-agent"}`
   - `has_close: false`
   - `coordination_complete: false`
3. **Writes** to `~/.claude/hook-state/chatroom-{slug}.json`
4. **Optionally** returns feedback to the writing agent

## Benefits

| Without Hook | With Hook |
|-------------|-----------|
| O(n) per read | O(1) per read |
| Parse every poll | Parse once per write |
| 15-30s polling | 5s polling |
| Inconsistent parsing | Single source of truth |
| No write validation | Protocol enforcement |

## State File Location

```
~/.claude/hook-state/chatroom-{date}-{slug}.json
```

Example:
```json
{
  "file": "brain/traces/agents/2025-12-29-dustin-commitments.md",
  "updated_at": "2025-12-29T10:02:15",
  "update_count": 4,
  "has_close": false,
  "agents_ready": ["email-loader", "calls-loader"],
  "agents_waiting": {},
  "agents_blocked": {},
  "expected_agents": ["email-loader", "calls-loader"],
  "ready_count": 2,
  "expected_count": 2,
  "coordination_complete": true
}
```

Orchestrator can read this tiny file instead of parsing the full chatroom.
</state_sync_architecture>

<stop_hook_integration>
Three hooks enforce coordination:

| Hook | Target | Purpose |
|------|--------|---------|
| `PostToolUse` | All agents | Sync chatroom state on every write |
| `SubagentStop` | Subagents | Prevent stopping before posting signal + CLOSE |
| `Stop` | Orchestrator | Prevent stopping while tasks running |

## SubagentStop Hook (for subagents)

Prevents subagents from stopping until:
1. They post a signal (READY/WAITING/BLOCKED)
2. Orchestrator posts → CLOSE

```
Agent tries to stop
       ↓
SubagentStop hook fires
       ↓
Hook reads chatroom + LLM evaluates
       ↓
CLOSE signal? → Allow stop
       ↓ No
Agent posted READY? → Check if anyone WAITING on them
       ↓ No
Block stop, tell agent to:
  - Read chatroom
  - Post status signal
  - Wait if needed
       ↓
Exponential backoff (15s, 30s, 60s, 120s)
       ↓
Max 5 attempts → Allow stop (escape hatch)
```

## Stop Hook (for orchestrator)

Prevents orchestrator from stopping while:
1. Background tasks still running
2. Active chatroom without CLOSE signal
3. Unresolved WAITING @orchestrator signals

```
Orchestrator tries to stop
       ↓
Stop hook fires
       ↓
Check: tracked tasks still running?
Check: active chatroom without CLOSE?
Check: unaddressed WAITING @orchestrator?
       ↓ Any true
Block stop, tell orchestrator to:
  - Poll TaskOutput for running tasks
  - Read chatroom for WAITING signals
  - Post CLOSE when done
       ↓
Max 3 attempts → Allow stop
```

## Wait/Sleep Behavior

Agents waiting on others should:
1. Post `→ WAITING @agent-name`
2. Wait 15-60 seconds
3. Read chatroom for updates
4. Retry or update status

## Escape Hatches

Both hooks have escape conditions to prevent infinite loops:

| Hook | Max Attempts | Backoff |
|------|--------------|---------|
| SubagentStop | 5 | 15s, 30s, 60s, 120s, 120s |
| Stop | 3 | None (orchestrator should know better) |

## Configuration

```
.claude/hooks/
├── chatroom-consensus-gate.py   # SubagentStop hook
└── orchestrator-stop-gate.py    # Stop hook
```
</stop_hook_integration>

<file_structure>
```
brain/traces/
├── 2025-12-26-client-update.md    # Decision traces (flat)
└── agents/                        # Agent coordination logs
    └── 2025-12-26-client-update.md

~/.claude/hook-state/
└── chatroom-2025-12-26-client-update.json  # Pre-computed state
```

**Naming convention:** Match the decision trace slug for easy correlation.

**State files:** Auto-generated by `chatroom-state-sync.py` hook. Orchestrator reads these instead of parsing chatroom.
</file_structure>

<review_workflow>
After task completion, chatrooms become reviewable artifacts:

**Weekly review questions:**
- Which agents frequently hit blockers?
- What discoveries most often change behavior?
- Are agents posting too much noise?
- What patterns suggest skill improvements?

**Improvement signals:**
- Same blocker appearing across tasks → fix the root cause
- Agents not adapting to each other → improve prompts
- Missing coordination → add chatroom protocol
- Too much chatter → tighten posting criteria
</review_workflow>

<example_full_flow>
This example shows the full orchestrator polling pattern with crash handling and WAITING responses.

```markdown
---
schema_version: 1.0.0
date: 2025-12-26
task: Gather context for Acme Corp update email
agents: [client-loader, linear-status, email-history, voice-context, attio-loader]
status: completed
linked_trace: brain/traces/2025-12-26-acme-update-email.md
---

# Agent Chatroom: Acme Corp update email

## Coordination Log

## [14:30] orchestrator
Starting context gather for Acme Corp email to Sarah.
Spawning 5 agents in background:
- client-loader (task_id: abc123)
- linear-status (task_id: def456)
- email-history (task_id: ghi789)
- voice-context (task_id: jkl012)
- attio-loader (task_id: mno345)

Entering polling loop. Timeout: 5 minutes.

## [14:31] client-loader
Found the client file. Sarah is primary contact, $8k retainer, month 2.
→ READY

## [14:31] linear-status
No Linear project found for Acme Corp.
→ @email-history expand search, we need more activity context
→ READY

## [14:32] email-history
Found 47 emails in last 30 days. Include archived threads from 2024?
→ WAITING @orchestrator

## [14:32] orchestrator
[Polling: detected WAITING @orchestrator]
@email-history Yes, include 2024 archived. Long-term client relationship.

## [14:33] email-history
Including archived. Found heated thread from Dec 20 re: missed deadline.
→ @orchestrator client may be frustrated - flagging
→ READY

## [14:33] attio-loader
Deal status is "At Risk" - marked Dec 23.
→ confirms email-history frustration signal
→ READY

## [14:33] orchestrator
[Polling: voice-context task errored]
@voice-context agent crashed: MCP connection timeout
→ BLOCKED: voice-context unavailable

Proceeding without voice guidance. 4/5 agents complete.

## [14:34] orchestrator
All available agents complete.
- client-loader: READY
- linear-status: READY
- email-history: READY
- attio-loader: READY
- voice-context: BLOCKED (crashed)

Key signal: client frustration confirmed by 2 sources.
Collecting TaskOutput from completed agents for synthesis.
→ CLOSE
```

**What the orchestrator did:**
1. Spawned 5 agents with tracked task_ids
2. Entered polling loop
3. Responded to email-history's WAITING signal
4. Detected voice-context crash via TaskOutput
5. Posted BLOCKED on behalf of crashed agent
6. Posted CLOSE with status summary
7. Collected results via TaskOutput (not shown in chatroom)
</example_full_flow>

<success_criteria>
Chatroom is effective when:
- [ ] Agents use it to coordinate naturally
- [ ] Agents read and adapt to each other's findings
- [ ] Orchestrator incorporates signals into synthesis
- [ ] Chatroom captures the story of what happened
- [ ] Reviewable later for system improvement
- [ ] Task-scoped (not mixed with unrelated work)
</success_criteria>
