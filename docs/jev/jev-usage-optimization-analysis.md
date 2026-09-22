# Jev usage and token optimization analysis

## Summary

The main optimization opportunity is not Jev's own token usage. The Luna xhigh
pilot made five Jev calls with 12,550 total Jev input tokens, 1,079 output
tokens, and a total Jev cost of $0.0005271. The primary Luna agent used
21,079,616 input tokens, of which 20,778,752 were cache reads, and 68,056 output
tokens.

The higher-value goal is therefore to reduce primary-agent turns and prevent
large diagnostic output from accumulating in Luna's conversation. Jev's request
payload can also be made smaller and more precise, but that is primarily a
decision-quality improvement rather than a meaningful direct cost saving.

The current integration already has two useful properties:

- Luna invoked Jev after all five failed checker reports in the successful run.
- Passing focused checks did not invoke Jev.

The remaining work is to make each decision more actionable and cheaper for the
primary agent to consume.

## Observed request characteristics

The five Jev requests ranged from 1,227 to 5,114 input tokens. The largest
request contained 11,768 serialized JSON characters, seven check records,
fourteen failed design measurements, and eight regional SSIM records.

That request repeated visual evidence in several places:

1. The check's long textual failure contained measurements and SSIM failures.
2. `failedDesignMeasurements` contained the same measurements structurally.
3. `regionalSsim` contained the same SSIM results structurally.
4. `visualEvaluation.failures` repeated the failures as strings.

It also included passed checks and passed SSIM regions even though the decision
was about which failure to investigate next.

The five visual-inspection probabilities were tightly clustered from 0.74 to
0.78, including for a report with explicit browser 404 errors. That output did
not discriminate between failures where pixels were necessary and failures
already explained by textual diagnostics.

## Recommended improvements

### 1. Combine `ui-check` and Jev execution

Add a condition-specific `ui-check-jev` command that runs `ui-check` and, when
it fails, immediately runs `jev-triage` against the new report. It should print
one combined concise result.

This removes the separate Luna turn whose only purpose is to invoke Jev. The
Luna pilot had five failed reports, so this could have removed five
checker-to-Jev round trips. It also guarantees one call per failed report
without modifying the deterministic checker or making Jev a source of truth.

Keep the existing `jev-triage` condition unchanged and add this behavior as a
new experimental condition so its effect can be measured independently.

### 2. Print a compact result to the primary agent

Keep the complete probability distributions in the retained Jev JSON artifact,
but show Luna only the selected target, leading family, recommended action,
confidence, one runner-up when useful, and the visual-inspection decision.

For example:

```text
target: realVaadinComponentsAndAccessibleShell
family: interaction (0.83)
action: inspect_components (0.93)
runner-up: inspect_application_state (0.04)
visual inspection: no
```

The current command prints all nine family probabilities and all eight action
probabilities. That output remains in the primary-agent transcript and is read
again on subsequent turns even though it is mainly useful for offline analysis.

### 3. Deduplicate and compact the Jev request

When structured visual evaluation data is available:

- omit the long visual failure string from the check record;
- omit `visualEvaluation.failures`;
- send failed checks rather than every check;
- send failed regional SSIM values plus whole-page SSIM rather than every
  passing region; and
- group repeated measurements, such as the same subtitle weight mismatch on
  nine report cards.

This should substantially reduce the largest Jev requests. The direct monetary
saving will be small, but less duplicated evidence may also make classifications
more stable.

### 4. Ask Jev to choose a concrete target

The initial full report contained unrelated visual, responsive, component, and
filtering failures. Choosing only a broad failure family produced a relatively
weak first answer: `component_structure` at 0.53 followed by `inspect_css` at
0.37.

Ask Jev to select a specific failed check, component, or visual region before
selecting an action. A useful result should resemble:

```text
target_check: responsiveLiveResizePreservesState
target: menu-toggle/sidebar overlay
action: inspect the responsive trace and pointer-event bounds
```

This makes the recommendation directly usable for a focused diagnostic and
focused checker rerun.

### 5. Couple the target and action decisions

The current failure-family and next-action questions are independent, so they
can produce weak combinations such as component structure followed by CSS
inspection.

Either use one joint route choice or generate action candidates that are tied to
the failed checks in the current report. The selected action should explicitly
refer to the selected target.

### 6. Include compact report deltas

`--last-action` tells Jev what Luna attempted, but Jev does not receive the
previous report and cannot determine whether the action helped.

Add an automatically generated delta against the preceding comparable report:

```json
{
  "resolvedChecks": ["filterBoundariesAndReset"],
  "newFailures": [],
  "ssimDelta": {
    "filters": 0.054,
    "whole": 0.011
  }
}
```

Jev can then decide whether to continue, adjust, or abandon the preceding
strategy. A compact delta adds some Jev input but should improve routing more
than sending another standalone snapshot.

### 7. Calibrate or replace the visual-inspection question

The current visual-inspection result was high for every failure and should not
yet be treated as a useful routing signal.

The question should explicitly return no when the diagnostics already identify:

- a build, runtime, resource, or network error;
- an exact expected-versus-actual measurement;
- an interaction trace naming the blocked element; or
- a component-count or application-state mismatch.

Visual inspection should be reserved for SSIM-only failures, ambiguous pixel
differences, or a plateau after measured CSS corrections. A deterministic gate
may be more reliable than asking Jev for this decision.

### 8. Require minimal evidence inspection

The condition currently tells the agent to read the underlying report
measurements. In the pilot, that sometimes led to printing large report files
and running broad exploratory scripts, all of which expanded the Luna context.

Change the instruction to require the smallest evidence needed for the selected
target:

- inspect one trace, region, component, or measurement group;
- do not print the complete report or `design-evaluation.json`;
- make one bounded fix;
- run the corresponding focused check; and
- return to the full check after all previously failing focused checks pass.

## Scope of the next experimental condition

The previously recommended `jev-triage-auto` condition includes these points:

| Point | Included? | Planned behavior |
| ---: | :---: | --- |
| 1 | Yes | Combine failed `ui-check` handling and Jev into one command. |
| 2 | Yes | Return a compact result to Luna while retaining the full JSON artifact. |
| 3 | No | Payload deduplication should be measured separately after preserving a comparable decision schema. |
| 4 | Yes | Select a concrete failed check, component, or region. |
| 5 | Yes | Tie the recommended action to the selected target. |
| 6 | Yes | Include an automatically generated compact delta from the previous comparable report. |
| 7 | No | Visual-inspection calibration needs its own negative-control evaluation. |
| 8 | No | Instruction tightening changes primary-agent behavior independently and should be a later condition. |

Thus, the initial condition includes **1, 2, 4, 5, and 6**. It deliberately
leaves **3, 7, and 8** for separately measurable follow-ups.

This condition is now implemented under `conditions/jev-triage-auto/`. Its
agent-side `ui-check-jev` executable is installed from
`base/jev-triage/ui-check-jev`, and the original `jev-triage` condition remains
available as the manual-delivery control.

This separation makes the next result easier to interpret. The new condition
tests whether automatic delivery, concise output, target-specific advice, and
report deltas improve the agent loop. It does not simultaneously change payload
encoding, visual-routing calibration, and the agent's general evidence-gathering
instructions.

## Evaluation plan

Compare the existing `jev-triage` condition with `jev-triage-auto` using matched
Luna-xhigh pairs. Keep the task revision, image, timeout, and concurrency fixed.
Measure:

- benchmark pass and timeout rates;
- primary-agent turns between a failed check and the next source edit;
- Luna cached and uncached input tokens and output tokens;
- time from a failed report to the next focused check;
- Jev request size, latency, and cost;
- whether the selected target and action were followed; and
- whether the next focused report improved or resolved the selected failure.

Only after that comparison should request compaction, visual-inspection gating,
and stricter evidence instructions be layered in.
