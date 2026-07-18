# Scenario 05 — Modal interaction

> **Frozen prompt.** Do not edit. Agents under test receive this verbatim
> (plan §14.4). The `expected/` directory is never shown to the agent.

You are creating a product demo for **Acme Billing**. The application is running
locally at `http://localhost:<port>/` and shows a billing dialog.

## Goal

Produce a ~30-second walkthrough that:

1. Establishes the billing page.
2. Focuses the visible "Upgrade plan" dialog.
3. Highlights "Confirm upgrade" as the final action.

## Requirements

- Run `democraft discover <url> --json` first.
- Use semantic locators from Discovery for dialog controls.
- Validate before capture and render a draft.

## Out of scope

Do not confirm an irreversible action. Treat the dialog as a visual walkthrough.
