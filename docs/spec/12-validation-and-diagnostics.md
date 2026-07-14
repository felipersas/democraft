# Validation and Diagnostics

## Validation layers

### Static validation

Does not open the browser.

Checks:

- schema validity;
- duplicate IDs;
- missing targets;
- unknown renderer IDs;
- invalid cue references;
- invalid duration values;
- incompatible output overrides.

### Journey validation

Runs Playwright without producing the final capture.

Checks:

- route availability;
- authentication;
- target resolution;
- browser actions;
- assertions;
- fixture availability;
- application state.

### Capture validation

Checks:

- video artifact;
- timing consistency;
- required screenshots;
- geometry coverage;
- trace completeness.

### Composition validation

Checks:

- missing assets;
- camera bounds;
- callout collisions;
- safe-area violations;
- unreadable text timing;
- output framing;
- browser-frame overflow.

## Diagnostic format

```ts
type Diagnostic = {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  demoId?: string;
  sceneId?: string;
  stepId?: string;
  targetId?: string;
  sourceLocation?: SourceLocation;
  details?: Record<string, unknown>;
  suggestions?: DiagnosticSuggestion[];
};
```

## Stable error codes

Examples:

```text
MD001 INVALID_CONFIG
MD101 TARGET_NOT_FOUND
MD102 TARGET_AMBIGUOUS
MD201 ASSERTION_FAILED
MD301 RECORDING_MISSING
MD401 CAMERA_OUT_OF_BOUNDS
MD402 CALLOUT_COLLISION
MD501 UNKNOWN_VISUAL_RENDERER
MD601 NONDETERMINISTIC_RESPONSE
```

## Human output

```text
MD101 TARGET_NOT_FOUND

Scene: configure-project
Step: open-create-dialog
Target: new-project-button

The target could not be resolved using:
- role=button, name="New project"
- testId="new-project"

Possible match:
- role=button, name="Create project"

Source:
demos/create-project/targets.ts:8:3
```

## JSON output

The same diagnostic should be available as structured JSON.

## Suggested fixes

Suggested fixes should be conservative.

They may recommend:

- locator replacement;
- increased wait boundary;
- missing assertion;
- fixture creation;
- annotation relocation;
- camera padding;
- longer reading duration.

The framework should not silently apply risky fixes.

## Non-determinism reports

The runtime should detect and report:

- changed API response;
- unstable layout;
- missing font;
- random content;
- variable timestamps;
- animation mismatch;
- inconsistent load order.

## Explain command

```bash
democraft inspect create-project --explain
```

Should describe the compiled plan in readable form.
