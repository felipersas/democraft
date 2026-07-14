# LLM-First Developer Experience

## Main principle

The LLM and the developer use the same TypeScript source API.

The framework should not create a separate DSL exclusively for agents.

Instead, it should make the TypeScript API unusually easy for agents to generate and repair.

## What makes an API LLM-friendly

- small method vocabulary;
- literal unions;
- stable file structure;
- stable IDs;
- no hidden global state;
- predictable return types;
- strong diagnostics;
- generated examples;
- inspectable schemas;
- minimal nesting;
- explicit target contracts;
- small source files;
- deterministic commands.

## Recommended file structure

```text
demos/
  create-project/
    demo.ts
    targets.ts
    config.ts
```

Avoid giant files containing every demo.

## Agent workflow

```text
Inspect project
    ↓
Read targets
    ↓
Create or edit demo.ts
    ↓
Run static validation
    ↓
Run journey validation
    ↓
Capture
    ↓
Render scene preview
    ↓
Inspect diagnostics
    ↓
Patch source
```

## Important CLI outputs

All commands should support structured JSON output:

```bash
democraft inspect create-project --json
democraft validate create-project --json
democraft targets list --json
democraft preview create-project --scene result --json
```

## Diagnostics for agents

Bad:

```text
Element not found
```

Good:

```json
{
  "code": "TARGET_NOT_FOUND",
  "sceneId": "create-project",
  "stepId": "open-dialog",
  "targetId": "new-project-button",
  "attemptedLocators": [
    {
      "by": "role",
      "role": "button",
      "name": "New project"
    }
  ],
  "candidates": [
    {
      "role": "button",
      "name": "Create project",
      "confidence": 0.93
    }
  ],
  "suggestedSourceEdit": {
    "file": "demos/create-project/targets.ts",
    "targetId": "new-project-button",
    "replacement": {
      "by": "role",
      "role": "button",
      "name": "Create project"
    }
  }
}
```

## Source edits over abstract patches

Because TypeScript is the source of truth, coding agents should usually edit the source directly.

A patch protocol may exist for:

- visual editors;
- remote APIs;
- agent tools;
- non-code integrations.

However, the normal Codex workflow should be:

1. inspect;
2. edit TypeScript;
3. validate;
4. preview.

## Generated reference material

The package should generate or include:

- `llms.txt`;
- API examples;
- method reference;
- schema reference;
- common recipes;
- error catalog;
- recommended target strategies;
- AGENTS.md template.

## Guardrails

The API should reject:

- unknown target IDs;
- unknown renderer IDs;
- invalid transition names;
- unsupported durations;
- duplicate scene IDs;
- direct filesystem paths where asset references are expected.

## Agent-friendly tests

Each example should include golden tests for:

- compiled IR;
- generated execution plan;
- validation diagnostics;
- camera resolution;
- output adaptation.

## Important rule

LLM friendliness should emerge from clarity, typing, schemas, and diagnostics—not from adding vague natural-language methods to the core API.
