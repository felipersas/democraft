# Scenario 04 — Repeated cards

> **Frozen prompt.** Do not edit. Agents under test receive this verbatim
> (plan §14.4). The `expected/` directory is never shown to the agent.

You are creating a product demo for **Acme**. The application shows a projects
list running locally at `http://localhost:<port>/` (the harness prints the
actual port). The list contains 48 project cards.

## Goal

Produce a ~30-second product walkthrough demo that:

1. Establishes the projects list at a glance.
2. Highlights the "New project" action.
3. Ends on a clear, stable final state.

## Requirements

- Use `democraft discover <url> --json` to map the page before authoring.
- The page has many repeated cards — Discovery should aggregate them into a
  collection. Do NOT enumerate every card as a separate target; reference the
  collection and a small representative sample.
- Prefer semantic locators (role, label, test id) — never guess CSS selectors
  when Discovery offers a stable candidate.
- Author a `demo.ts` and run `democraft validate` until there are zero error
  diagnostics.
- Capture and render a draft; report the artifact paths.

## Out of scope

Do not click into individual projects. The page is read-only for this
scenario.
