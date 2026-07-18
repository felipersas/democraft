# Scenario 02 — Dashboard navigation

> **Frozen prompt.** Do not edit. Agents under test receive this verbatim
> (plan §14.4). The `expected/` directory is never shown to the agent.

You are creating a product demo for **Acme Ops**. The application is a
dashboard running locally at `http://localhost:<port>/` (the harness prints the
actual port).

## Goal

Produce a ~30-second walkthrough that:

1. Establishes the dashboard overview.
2. Highlights navigation to "Projects" and "Reports".
3. Shows the "New project" action as the primary next step.

## Requirements

- Use `democraft discover <url> --json` before authoring.
- Prefer role, label, and test-id locators from Discovery.
- Do not invent CSS selectors when Discovery provides a stable candidate.
- Author `demo.ts`, validate it, capture it, and render a draft.

## Out of scope

Do not submit forms or navigate outside the local application.
