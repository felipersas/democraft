# Scenario 01 — Static landing page

> **Frozen prompt.** Do not edit. Agents under test receive this verbatim
> (plan §14.4). The `expected/` directory is never shown to the agent.

You are creating a product demo for **Acme**, a SaaS product. The application
is a static landing page running locally at `http://localhost:<port>/` (the
harness prints the actual port).

## Goal

Produce a ~25-second product walkthrough demo that:

1. Establishes the hero headline ("Ship product demos in minutes").
2. Highlights the primary call to action ("Start free trial").
3. Ends on a clear, stable final state.

## Requirements

- Use `democraft discover <url> --json` to map the page before authoring.
- Prefer semantic locators (role, label, test id) — never guess CSS selectors
  when Discovery offers a stable candidate.
- Author a `demo.ts` and run `democraft validate` until there are zero error
  diagnostics.
- Capture and render a draft; report the artifact paths.

## Out of scope

Do not click "Sign in" or navigate away from the landing page. The page is
read-only for this scenario.
