# Expected — 04-repeated-cards

This directory holds the **known-good reference** for the scenario. It is
never shown to an agent under test (plan §14.4). It exists for:

- regression comparison (diff a new agent's output against the known-good
  baseline), and
- documenting what a correct result looks like for human reviewers.

A baseline `discovery.snapshot.json` and `demo.ts` can be committed here once
the harness produces a stable, reviewed output. Until then the harness scores
against `rubric.json` only.
