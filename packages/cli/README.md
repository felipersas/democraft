# @democraft/cli

The Democraft command-line interface.

```bash
npm install --save-dev @democraft/cli@beta @democraft/core@beta
```

Common workflows are end-to-end commands:

```bash
npx democraft studio demo.ts
npx democraft validate demo.ts
npx democraft render demo.ts -o demo.mp4
```

The path can be omitted when exactly one `demo.ts`, `demo.tsx`, `src/demo.ts`, or `src/demo.tsx` exists:

```bash
npx democraft studio
npx democraft render -o demo.mp4
```

Explicit artifacts remain available for CI and debugging:

```bash
npx democraft capture demo.ts
npx democraft timeline demo.ts --manifest manifest.json --output timeline.json
npx democraft render demo.ts --manifest manifest.json --timeline timeline.json -o demo.mp4
```

`@democraft/studio` is installed automatically as a CLI dependency. The
`studio` command runs its packaged production build and does not require pnpm
or a Democraft source checkout.

Run `npx democraft help` or `npx democraft render --help` for usage. Equivalent
launchers are `pnpm exec democraft` and `bunx democraft`.
