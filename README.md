# Democraft

Product demos as code. Playwright performs. Remotion directs. Agents orchestrate.

This repository currently implements the first semantic milestone:

- a single TypeScript authoring API;
- target and scene capture;
- normalized JSON-compatible IR;
- static validation diagnostics;
- human-readable inspection output.
- a first Playwright runtime package that executes compiled IR and writes run manifests.
- a minimal CLI for inspect, static validate, capture, timeline, preview, and render workflows.
- a first Remotion renderer with Remocn-compatible component registration.
- agent-oriented reference material in `llms.txt`.

## Development

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm test
```

Run the basic example:

```bash
pnpm --filter @democraft/example-basic-demo start
```

Run the CLI against the example during development:

```bash
pnpm --filter @democraft/cli exec tsx src/index.ts inspect ../../examples/basic-demo/src/demo.ts
pnpm --filter @democraft/cli exec tsx src/index.ts validate ../../examples/basic-demo/src/demo.ts --static
```

Run the local capture fixture:

```bash
pnpm --filter @democraft/example-demo-app start
pnpm --filter @democraft/example-demo-app inspect
pnpm --filter @democraft/cli exec tsx src/index.ts targets ../../examples/demo-app/src/demo.ts --json
pnpm --filter @democraft/example-demo-app validate
pnpm --filter @democraft/example-demo-app capture
pnpm --filter @democraft/example-demo-app timeline
pnpm --filter @democraft/example-demo-app preview
pnpm --filter @democraft/example-demo-app render
```
