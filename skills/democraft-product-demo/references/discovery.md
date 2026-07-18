# Reading `discover --json` output

`democraft discover <url> --json` returns an envelope:

```json
{
  "ok": true,
  "discovery": { /* PageDiscovery */ },
  "runId": "<run-id>",
  "directory": "<run-dir>"
}
```

## PageDiscovery shape

```json
{
  "schemaVersion": 1,
  "generatedAt": "<iso>",
  "page": { "url", "pathname", "title?", "viewport": {width, height, deviceScaleFactor} },
  "regions": [ { "id", "kind", "label?" } ],
  "elements": [ { /* see below */ } ],
  "collections": [ { "id", "kind": "repeated-collection", "label?", "count", "itemRole?", "sampleElementIds" } ],
  "warnings": [ { "code", "severity", "message", "elementId?", "regionId?" } ]
}
```

## Element shape

```json
{
  "id": "element_01",
  "kind": "button",
  "role": "button",
  "name": "New project",
  "text": "New project",
  "visible": true,
  "enabled": true,
  "interactive": true,
  "regionId": "main",
  "boundingBox": { "x", "y", "width", "height" },
  "locatorCandidates": [ /* ordered best-first */ ],
  "suggestedTargetId": "newProject",
  "risk": "reversible"
}
```

## LocatorCandidate shape

```json
{
  "locator": { "kind": "role", "role": "button", "name": "New project" },
  "confidence": 0.99,
  "stability": "high",
  "unique": true,
  "matchCount": 1,
  "reasons": [ "Unique accessible role and name", "Element is visible" ],
  "risks": [ /* optional, e.g. "Ambiguous: resolve by region or text" */ ]
}
```

`locator.kind` is one of `role` | `label` | `testId` | `text` — exactly the
vocabulary `byRole`/`byLabel`/`byTestId`/`byText` accept. So a candidate
converts directly to an authoring locator.

## How to use it

1. Filter to elements you'll interact with or narrate (look at `kind`,
   `interactive`, `regionId`).
2. For each, take the **top** `locatorCandidate` (highest confidence). Prefer
   `unique: true`, `stability: "high"`.
3. Use `suggestedTargetId` as the key in `defineTargets({ ... })`, and the
   candidate's `locator` fields as the `byRole(...)`/`byLabel(...)` builder.
4. For a `collection`, reference the collection's `sampleElementIds` rather
   than enumerating every item.

## Warnings

- `DC406` — the top locator for an element matched multiple elements. Either
  scope to a region, or pick a different candidate.
- `DC407` — no interactive elements found. The page may need login, or may be
  a loading state.
- `DC408` — some elements are inside a **closed overlay** (a `<dialog>` that
  isn't open, a `[hidden]` block, or a collapsed `<details>`). See below.

## Closed overlays (dialogs, menus, collapsed sections)

Discovery is a read-only snapshot of the page's current state. Elements that
live inside a closed `<dialog>`, a `[hidden]` container, or a `<details>`
without `[open]` are **invisible at snapshot time** (the browser gives them
`display: none`). Discovery still surfaces them — marked with
`insideClosedOverlay: true` and `visible: false` — and emits a `DC408` warning
naming the count and the overlay's trigger.

These elements ARE real interactive surface once the overlay opens, so you can
author them ahead of time (their role/label/testId locators are stable). But
**capture will fail** until the overlay is actually open during the demo run —
so your `demo.ts` must include the step that opens it (e.g.
`scene.click("newProjectButton")` before `scene.expectVisible("dialog")`).

If discovery seems to be missing elements you know exist:

1. Check for a `DC408` warning — it tells you how many elements are hidden and
   names the trigger.
2. Author the open-overlay click as a step, then the hidden elements' steps.
3. Re-run discovery against the same URL only if you need to verify locators
   after the overlay opens (the marked elements are already authorable).

The run directory also includes a full-page **screenshot** (`page.png`,
surfaced as `screenshotPath` in the JSON envelope) — use it (or a vision
model) to sanity-check the map against what's actually on the page.

