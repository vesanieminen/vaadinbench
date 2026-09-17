# VaadinBench automated research plan

Status: proposed

## Purpose

Build a reproducible automated research layer around VaadinBench that measures
how Vaadin skills, the Vaadin documentation MCP server, and Vaadin agent tools
affect coding-agent performance.

The system produces evidence and optimization proposals. Automatically changing
or promoting skills, MCP code, agent tools, benchmark tasks, or verifiers is out
of scope. A human reviews every proposed capability change.

The design adapts the autoresearch loop:

1. freeze the inputs;
2. run a controlled experiment;
3. collect deterministic measurements;
4. explain the observed result;
5. record evidence-backed hypotheses for a later experiment.

Unlike a single-metric training loop, VaadinBench has multiple tasks,
capabilities, agents, failure modes, and expensive stochastic trials. The raw
measurements must therefore remain multidimensional even when a primary metric
is used to compare campaigns.

## Non-negotiable constraints

### Deterministic grading

VaadinBench's existing verifiers remain the sole source of rewards. An analysis
agent may classify and explain a failure, but it must never assign, alter, or
override a reward.

### No automatic optimization

The research system may create reports, hypotheses, proposed changes, and
follow-up experiment definitions. It must not edit or commit to the Vaadin
skills, agent-tools, or MCP repositories.

### Resource limits

- At most two Codex sessions may run in parallel.
- At most two Claude Code sessions may run in parallel.
- At most two benchmark sessions may run on the VM in total.
- Codex and Claude batches run sequentially, so their per-agent limits cannot
  combine into four simultaneous sessions.
- Every Harbor invocation explicitly uses `-n 2` or a smaller value. The
  campaign runner must never rely on Harbor's default concurrency.
- A passthrough argument that raises concurrency above two is rejected.
- Visual and migration campaigns may use `-n 1` if resource measurements show
  pressure at two sessions.
- Stop launching trials if available host memory falls below a configurable
  safety floor. Let already-running trials finish.

Initial resource policy:

```toml
[resources]
max_parallel_total = 2
max_parallel_codex = 2
max_parallel_claude = 2
minimum_available_memory_mb = 2048
```

The VM has 12 GB of memory. Two task containers can have nominal 4 GB limits,
leaving capacity for the host, Docker, Harbor, and reporting processes without
allowing a four-container provider overlap.

### Subscription-only authentication

Research campaigns must fail closed instead of falling back to API billing.
Credentials and token values are never written to campaign manifests or logs.

Codex runs require:

```bash
env -u OPENAI_API_KEY \
  CODEX_FORCE_AUTH_JSON=1 \
  uv run vaadin-bench.py ... -n 2
```

Policy:

- require `CODEX_FORCE_AUTH_JSON=1`;
- remove `OPENAI_API_KEY` from the benchmark subprocess environment;
- verify the required Codex authentication file is available before starting;
- record the authentication mode as `chatgpt_subscription`;
- never fall back to an API key or paid credits.

Claude Code runs require:

```bash
env -u ANTHROPIC_API_KEY \
  with-claude-oauth \
  uv run vaadin-bench.py ... -n 2
```

Policy:

- always launch Claude through `with-claude-oauth`;
- require the wrapper to set `CLAUDE_FORCE_OAUTH=1`;
- remove `ANTHROPIC_API_KEY` from the benchmark subprocess environment;
- record the authentication mode as `claude_subscription`;
- refuse a direct Claude launch from the research runner.

Provider-specific jobs must be separate because only Claude is launched through
`with-claude-oauth`.

### Quota and credit safety

- API keys and paid-credit fallback are forbidden for subscription campaigns.
- Run small provider-specific batches rather than enqueueing a whole campaign.
- Pause between batches for a quota check.
- Stop before the reported quota reaches 100%; use 90% as the initial safety
  threshold to allow for delayed accounting and sessions already in flight.
- A quota error stops that provider's campaign. It is infrastructure status, not
  a task failure.
- Never change credentials or continue through paid credits after quota
  exhaustion.

Initial quota policy:

```toml
[quota]
allow_api_keys = false
allow_paid_credits = false
batch_size_per_provider = 4
require_usage_check_between_batches = true
stop_at_reported_usage_percent = 90
```

Until a trustworthy machine-readable quota source is identified, the usage
checkpoint is manual. The runner records the observation and can operate
unattended only until the next checkpoint.

Example `quota-ledger.jsonl` entry:

```json
{
  "provider": "codex",
  "checked_at": "2026-09-17T18:00:00+03:00",
  "reported_usage_percent": 74,
  "source": "manual",
  "running_sessions": 0,
  "decision": "continue"
}
```

## System architecture

```text
Local capability repositories
  agent-skills ----+
  agent-tools  ----+--> immutable capability snapshot + manifest
  Vaadin MCP   ----+                    |
                                        v
                           generated research conditions
                                        |
                                        v
                             VaadinBench / Harbor
                                        |
                 deterministic reward + logs + patch + trajectory
                                        |
                                        v
                          deterministic result collector
                                        |
                      normalized metrics + failure taxonomy
                                        |
                                        v
                           read-only analysis agent
                                        |
                 reports + hypotheses + experiment backlog
                                        |
                            human review / future optimizer
```

The research layer is an observer and orchestrator around VaadinBench. It does
not replace Harbor, the agent adapters, task definitions, or verifiers.

## Research questions

Each campaign should state the questions it answers. The initial inventory is:

- Do Vaadin skills improve task success relative to vanilla?
- Does the MCP server improve success independently of skills?
- Is skills plus MCP better than either capability alone?
- Do agent tools add value beyond skills plus MCP?
- Which skills and tools are actually invoked?
- When invoked, do they change behavior usefully?
- Which capability causes latency, confusion, repeated work, or timeouts?
- Which task categories benefit: setup, views, data binding, migration, or
  visual implementation?
- Are failures caused by Vaadin knowledge, general coding, capability
  reliability, task ambiguity, or infrastructure?
- Does an apparent improvement generalize across tasks and models?

## Local capability sources

Keep development clones beside VaadinBench instead of nesting repositories
inside it:

```text
code/
├── vaadinbench/
└── vaadin-research-sources/
    ├── agent-skills/
    ├── agent-tools/
    └── vaadin-mcp/
```

Use full clones so that history, branches, diffs, and worktrees are available.
Never pass a mutable working tree directly into a trial. Campaign preparation
creates an immutable, content-addressed snapshot first.

The default behavior rejects dirty capability repositories. An explicit
`--allow-dirty` mode may snapshot the current content and save its diff, but the
manifest marks the campaign noncanonical.

Each campaign manifest records:

- VaadinBench commit, dirty status, and tree digest;
- capability repository URL, commit, dirty status, and tree digest;
- generated condition digest;
- agent-tools image digest, when used;
- MCP image, configuration, and documentation corpus digests, when used;
- agent, model, agent CLI version, and analysis-agent version;
- task checksums;
- timeouts, concurrency, and resource limits;
- exact generated Harbor commands;
- authentication mode, without credentials;
- host OS, Docker, Harbor, and relevant image versions;
- campaign start and end timestamps.

## Capability integration

### Skills

Published benchmark conditions continue to use full commit pins. Research mode
adds a local-source declaration such as:

```toml
[capabilities.skills]
repository = "../vaadin-research-sources/agent-skills"
revision = "HEAD"
subdirectory = "skills"
```

Campaign preparation resolves the revision, verifies cleanliness, copies the
skills directory into a content-addressed cache, and passes only the frozen
snapshot to Harbor.

### Agent tools

Agent tools contain native binaries and currently travel in the Claude agents
image. Research mode therefore:

1. snapshots the local agent-tools checkout;
2. builds a derived agents image from that snapshot;
3. tags it using the content digest rather than `latest`;
4. records both the source and OCI image digests;
5. uses it only for conditions that include agent tools.

Example tag:

```text
vaadinbench-agents:research-agent-tools-<12-character-tree-digest>
```

### Vaadin MCP

The MCP repository is not required for the first implementation milestone. It
should be retrieved after the local-skills path and deterministic reporting work
end to end. At that point, inspect its actual build and transport contract.

Preferred integration order:

1. use STDIO if the server supports it and can be packaged reproducibly;
2. otherwise build an immutable MCP Docker image and attach it to the networks
   used by Harbor agent containers;
3. do not point an agent container at an ambiguous `localhost` service;
4. make MCP initialization failure fatal for MCP conditions;
5. preflight initialization, tool discovery, one representative query, and
   corpus identity.

Record server source, image digest, tool schemas, server instructions, corpus or
index revision, query latency, tool errors, response truncation, and returned
document identifiers. Do not use the live MCP endpoint for controlled local
campaigns because its contents may change during or between runs.

## Experimental conditions

The minimum capability matrix is:

| Condition | Skills | MCP | Tools | Purpose |
| --- | --- | --- | --- | --- |
| `vanilla` | no | no | no | control |
| `skills` | yes | no | no | skills contribution |
| `mcp` | no | yes | no | MCP contribution |
| `skills-mcp` | yes | yes | no | interaction effect |
| `skills-mcp-tools` | yes | yes | yes | incremental tool value |

If agent tools can operate independently, later add the valid remaining
factorial conditions. If they depend structurally on skills or MCP, document the
dependency instead of representing the matrix as a full factorial experiment.

Compare conditions only within the same agent and model. Claude Code and Codex
results are separate experimental strata because their CLIs and harnesses
differ.

## Campaign stages

### 1. Preflight

- The oracle scores 1.
- The unchanged starter scores 0.
- Source repositories are clean or explicitly snapshotted as dirty.
- Skills are discoverable in the trial.
- Agent tools start and report the expected version, when selected.
- MCP initializes and answers a known query, when selected.
- Subscription authentication checks pass.
- No prohibited API key is present in the child environment.
- Source, configuration, and image digests are recorded.
- Available memory is above the safety floor.

### 2. Minimal smoke campaign

Run one provider at a time with:

- tasks: `flow-new-view` and `flow-grid-filtering`;
- conditions: `vanilla` and local `skills`;
- one attempt per cell;
- at most two concurrent sessions.

This creates four sessions per provider and a natural quota checkpoint.

### 3. Screening campaign

After the smoke campaign is reliable:

- add one visual task;
- add MCP conditions after the local MCP integration exists;
- retain one attempt per cell;
- use screening only to detect broken or clearly unpromising configurations.

### 4. Standard campaign

- Run selected tasks with five attempts per cell.
- Keep concurrency and timeout settings fixed.
- Interleave control and experimental cells.
- Randomize execution order within safe provider batches.
- Check quota between batches.

Do not run all attempts for one condition before its control. Quota exhaustion
must not leave an incomparable, one-sided campaign.

### 5. Confirmation campaign

- Use ten or more attempts for promising or suspicious comparisons.
- Include at least one task outside the hypothesis's original target.
- Re-run the baseline in the same campaign window.
- Treat confirmation as a new campaign with its own frozen manifest.

## Measurements

### Primary result

Use macro-average task pass rate as the primary comparison metric:

```text
mean(pass rate for each selected task)
```

Equal task weighting prevents a task or category with more attempts from
dominating the result.

### Secondary results

Retain at least:

- pass rate by task, category, condition, agent, and model;
- valid-run, timeout, cancellation, and infrastructure-error rates;
- median and p90 agent and verifier duration;
- pass-at-k;
- compile and test cycle counts;
- repeated failing command counts;
- MCP calls, failures, latency, and documents retrieved;
- skill availability and observed activation;
- agent-tool calls and outcomes;
- patch size and files changed;
- token and cost data when the harness supplies them;
- host and container resource observations.

A timeout counts as an unsuccessful trial in the primary result but remains
distinguishable from a completed incorrect solution.

For comparisons, report absolute differences, attempt counts, per-task results,
and bootstrap confidence intervals stratified by task. A one-attempt screening
run cannot establish a winner.

## Capability-use event stream

Normalize relevant trajectory data into JSONL, for example:

```json
{
  "timestamp": "2026-09-17T18:12:03+03:00",
  "trial_id": "trial-17",
  "kind": "mcp_call",
  "capability": "vaadin.search_docs",
  "input_summary": "Grid lazy data provider filtering",
  "duration_ms": 812,
  "outcome": "success",
  "artifact_refs": ["agent/trajectory.jsonl#event-42"]
}
```

Capture:

- skills presented to the agent;
- observable skill read or activation events;
- MCP initialization and calls;
- agent-tool invocations;
- shell commands and exit codes;
- build and test cycles;
- file changes;
- agent final response;
- timeout, cancellation, and quota events.

Research mode preserves session material until event extraction is complete.
Afterward it may run the existing binary pruning behavior. Implement extraction
and pruning through one composite Harbor plugin because Harbor limits how
plugins with keyword arguments can be combined.

## Failure classification

Classify deterministically first:

1. environment or setup;
2. authentication or provider;
3. quota stop;
4. MCP startup or protocol;
5. agent-tools startup or runtime;
6. agent timeout;
7. cancellation;
8. no meaningful patch;
9. compilation or build;
10. application startup;
11. functional verifier;
12. responsive or visual verifier;
13. migration or frontend build;
14. successful.

An analysis agent may add a likely cause, confidence, implicated capability, and
follow-up experiment. It cannot overwrite the deterministic class.

## Analysis-agent boundary

The report-generating agent runs read-only and receives only:

- public task instructions and metadata;
- the frozen campaign manifest;
- normalized events;
- application logs;
- agent patches and diff statistics;
- verifier results and failure output;
- the prior research ledger.

It does not receive:

- task reference solutions;
- protected verifier source;
- credentials or complete environment dumps;
- write access to VaadinBench or capability repositories.

The analysis output must conform to a JSON Schema. Every recommendation cites
specific artifact references. The analyst model and CLI version are recorded so
that changing the analyst cannot masquerade as a benchmark change.

## Reports and retained artifacts

Each campaign produces:

```text
research/runs/<campaign-id>/
├── manifest.json
├── quota-ledger.jsonl
├── trials.jsonl
├── events.jsonl
├── metrics.json
├── analysis.json
├── report.md
├── capability-scorecards/
│   ├── agent-skills.md
│   ├── agent-tools.md
│   └── vaadin-mcp.md
├── task-diagnostics/
│   └── <task>.md
└── optimization-backlog.json
```

The campaign report contains exact versions, matrix coverage, results,
confidence intervals, timeouts and errors, quota stops, capability usage,
regressions, limitations, and proposed follow-up experiments.

A capability scorecard records where a capability was available, whether it was
observed, successful and unsuccessful uses, associated outcomes, reliability,
latency, recurring misuse, and evidence-backed hypotheses.

An optimization-backlog entry contains:

```json
{
  "target": "agent-skills",
  "component": "flow/component-selection",
  "hypothesis": "The skill does not trigger for visual reproduction prompts.",
  "evidence": [
    "campaign/example/trial-17:event-9",
    "campaign/example/trial-23:event-11"
  ],
  "proposed_change": "Broaden the trigger and add a visual-task example.",
  "expected_effect": "Higher activation on visual implementation tasks.",
  "risks": ["Unwanted activation on generic frontend tasks"],
  "validation": {
    "tasks": ["flow-orders-lenient", "flow-new-view"],
    "conditions": ["skills-current", "skills-candidate"],
    "attempts": 10
  },
  "confidence": "medium"
}
```

Unsupported generic suggestions are rejected during report validation.

## Proposed implementation layout

```text
research/
├── PLAN.md
├── README.md
├── program.md
├── campaign.toml
├── sources.example.toml
├── schemas/
│   ├── manifest.schema.json
│   ├── trial.schema.json
│   ├── analysis.schema.json
│   └── backlog.schema.json
├── prompts/
│   └── analyze-campaign.md
└── fixtures/
    ├── passing-trial/
    ├── verifier-failure/
    └── infrastructure-failure/

scripts/
├── research.py
├── snapshot-capabilities.py
├── collect-research-results.py
└── render-research-report.py
```

Proposed command surface:

```bash
uv run scripts/research.py prepare --campaign research/campaign.toml
uv run scripts/research.py preflight <campaign-id>
uv run scripts/research.py run <campaign-id>
uv run scripts/research.py collect <campaign-id>
uv run scripts/research.py analyze <campaign-id>
uv run scripts/research.py report <campaign-id>
```

Convenience command:

```bash
uv run scripts/research.py campaign --config research/campaign.toml
```

Campaign execution must be resumable. A completed cell is not rerun without an
explicit request.

## Implementation phases

### Phase 1: orchestration, provenance, and deterministic reports

- Add campaign configuration and schemas.
- Enforce subscription-only launchers and environments.
- Enforce provider and global concurrency limits.
- Add memory preflight and runtime checks.
- Add quota batch boundaries, ledger, stop, and resume behavior.
- Snapshot local skill sources.
- Generate a complete campaign manifest.
- Normalize existing Harbor results.
- Generate deterministic JSON and Markdown reports without an LLM.
- Test passing, verifier-failing, timed-out, cancelled, quota-stopped, and
  infrastructure-failing fixture trials.

Acceptance criteria:

- no API key is available to subscription trials;
- Codex requires forced auth JSON;
- Claude is always invoked through `with-claude-oauth`;
- no more than two sessions can run simultaneously;
- exact capability and benchmark revisions are recorded;
- the same job inputs produce byte-identical normalized metrics;
- interrupted campaigns resume without rerunning completed cells.

### Phase 2: local skills campaign

- Generate research conditions from immutable local skill snapshots.
- Validate skill discovery and capture activation evidence.
- Run the four-session smoke campaign separately for each provider.
- Stop for a quota check after each provider batch.

### Phase 3: local MCP

- Retrieve and inspect the MCP repository.
- Select STDIO or containerized HTTP using the actual server contract.
- Freeze the server code and documentation corpus.
- Add health checks and tool instrumentation.
- Add MCP-only and skills-plus-MCP screening conditions.

### Phase 4: local agent tools

- Build derived agents images from immutable local snapshots.
- Record source and image digests.
- Extract tool events before pruning.
- Add the incremental tools comparison for supported agents.

### Phase 5: structured analysis

- Add read-only schema-constrained analysis.
- Require artifact citations for every hypothesis.
- Produce capability scorecards and the optimization backlog.
- Verify that analysis cannot modify rewards or source repositories.

### Phase 6: unattended operation

- Add campaign budgets, disk limits, and failure thresholds.
- Stop when controls fail or infrastructure errors exceed a threshold.
- Add scheduling only after quota accounting and resume behavior are proven.

## First execution milestone

The first real campaign should use:

```text
Providers:   Codex, then Claude Code
Models:      one stable subscription model per provider
Tasks:       flow-new-view, flow-grid-filtering
Conditions:  vanilla, local skills
Attempts:    one per cell
Concurrency: two maximum across the VM
Batch size:  four sessions, then a quota checkpoint
MCP:         excluded until its local repository is integrated
Tools:       excluded until the derived-image path is integrated
```

The milestone succeeds when its manifest proves that authentication, quota,
resource, and provenance rules were followed and its results can be collected,
reported, and resumed reproducibly.
