# @democraft/cli

The Democraft command-line interface.

```bash
pnpm add -D @democraft/cli
```

Common workflows are end-to-end commands:

```bash
pnpm exec democraft studio demo.ts
pnpm exec democraft validate demo.ts
pnpm exec democraft render demo.ts -o demo.mp4
```

The path can be omitted when exactly one `demo.ts`, `demo.tsx`, `src/demo.ts`, or `src/demo.tsx` exists:

```bash
pnpm exec democraft studio
pnpm exec democraft render -o demo.mp4
```

Explicit artifacts remain available for CI and debugging:

```bash
pnpm exec democraft capture demo.ts
pnpm exec democraft timeline demo.ts --manifest manifest.json --output timeline.json
pnpm exec democraft render demo.ts --manifest manifest.json --timeline timeline.json -o demo.mp4
```

Run `pnpm exec democraft help` or `pnpm exec democraft render --help` for usage.
