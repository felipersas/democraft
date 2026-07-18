# Locator strategy

Locators identify the element a step acts on. Resilient locators survive small
markup changes; fragile ones break on every refactor. Always prefer the most
resilient option Discovery offers.

## Preference order

1. **role + accessible name** — `byRole("button", { name: "Save" })`. Most
   resilient: tied to semantics, not markup. Use when `confidence >= 0.9` and
   `unique: true`.
2. **label** — `byLabel("Email")`. Strong for form fields with an associated
   `<label>`.
3. **testId** — `byTestId("submit")`. Stable but author-controlled; can be
   renamed. Use when role/label are ambiguous.
4. **text** — `byText("Save")`. Most fragile — text changes often. Last resort.

## Reading Discovery confidence

- `stability: "high"` + `unique: true` + `confidence >= 0.9` → use directly.
- `stability: "medium"` (testId) → acceptable, note it may need updating.
- `stability: "low"` (text or ambiguous) → avoid; look for an alternative or
  scope to a region.

## Scoping to a region

When a locator matches multiple elements, scope it. Discovery gives each
element a `regionId` (the landmark it lives in). Prefer a role locator that is
unique within the page; if none exists, the element may be genuinely
ambiguous — reconsider whether it's the right target.

## Anti-patterns

- **Never** invent a CSS selector (`page.locator(".btn-primary")`) when
  Discovery offers a semantic candidate. CSS selectors are opaque to change.
- **Never** use ordinal position ("the third button") — it breaks on any
  reorder.
- **Never** copy a DOM path from devtools — it's the most fragile of all.
