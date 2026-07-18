# Scenario 03 — Form flow

> **Frozen prompt.** Do not edit. Agents under test receive this verbatim
> (plan §14.4). The `expected/` directory is never shown to the agent.

You are creating an onboarding demo for **Acme Forms**. The application is a
simple request form running locally at `http://localhost:<port>/`.

## Goal

Produce a ~35-second demo that:

1. Establishes the request form.
2. Shows the labelled fields an operator fills in.
3. Ends by highlighting the "Submit request" action.

## Requirements

- Run `democraft discover <url> --json` first.
- Use label or role locators for form controls.
- Validate the demo before capture.
- Capture and render a draft.

## Out of scope

Do not submit the form unless the eval runner explicitly authorizes mutation.
