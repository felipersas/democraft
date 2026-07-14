# Single API and Code vs JSON

## Recommendation

Use a **single TypeScript API as the authored source of truth**.

Compile it into a **generated JSON intermediate representation**.

Do not ask users or LLMs to maintain both.

## Why not JSON as the primary authoring format?

JSON has useful properties:

- serializable;
- language-neutral;
- easy to validate;
- easy to store;
- suitable for visual editors;
- suitable for tool calls;
- predictable for LLM structured output.

However, JSON is weak as the main developer experience for complex demos.

Problems include:

- verbose repetition;
- limited reuse;
- no imports;
- no helper functions;
- no conditional composition;
- no type inference in normal editing;
- awkward fixtures and data generation;
- poor ergonomics for advanced Playwright operations;
- duplicated IDs and boilerplate;
- difficult refactoring across large projects.

A long demo quickly becomes unpleasant:

```json
{
  "id": "fill-project-name",
  "kind": "browser.fill",
  "target": "project-name-input",
  "value": "Oddworks"
}
```

This is acceptable as compiled IR, but not ideal as the only source format.

## Why TypeScript is better as source

TypeScript provides:

- autocomplete;
- static types;
- reusable helpers;
- comments;
- imports;
- composition;
- enums and literal unions;
- refactoring support;
- direct integration with Playwright and Remotion;
- familiar code review;
- testability;
- easier adoption by existing React teams.

Example:

```ts
await scene.fill("project-name-input", "Oddworks");
```

The compiler can still convert it to:

```json
{
  "id": "configure-project.fill-project-name-input",
  "kind": "browser.fill",
  "target": "project-name-input",
  "value": "Oddworks"
}
```

## Why TypeScript also works well for LLMs

Modern coding agents are strongest when modifying typed codebases.

A well-designed API gives the model:

- constrained method names;
- constrained arguments;
- local examples;
- compiler feedback;
- lint feedback;
- schema validation;
- predictable file structure;
- small edit surfaces.

The key is to avoid overly dynamic APIs.

Prefer:

```ts
await scene.click("create-button");
```

Avoid:

```ts
await scene.execute("do whatever is necessary to create the item");
```

Prefer literal unions and typed objects:

```ts
await scene.transition({
  type: "crossfade",
  duration: "500ms",
});
```

Avoid arbitrary configuration bags:

```ts
await scene.transition({
  effect: "something cinematic",
});
```

## Recommended model

```text
TypeScript source
      ↓
Compiler
      ↓
Normalized JSON IR
      ↓
Execution and render artifacts
```

## What the JSON IR is for

The generated IR should support:

- `inspect`;
- `validate`;
- `diff`;
- incremental builds;
- deterministic rendering;
- visual editors;
- scene previews;
- agent tooling;
- remote execution;
- caching;
- migration between schema versions.

## Should JSON authoring be supported at all?

Potentially, but only as a secondary interface.

Possible future use cases:

- external systems generating demos;
- no-code editors;
- remote APIs;
- MCP tools;
- database-stored demos;
- template marketplaces.

Even then, both TypeScript and JSON must compile into the same normalized IR.

## Final decision

### Public source API

TypeScript.

### Internal portable format

JSON IR.

### Agent interaction

Agents primarily edit TypeScript. They may consume JSON diagnostics and IR for inspection.

### Visual editor interaction

The editor manipulates the IR and generates or patches TypeScript source when possible.

### Rule

Never require a developer to manually keep TypeScript and JSON synchronized.
