# Publishing Democraft to npm

This is the maintainer checklist for the first public npm release. Do not publish until every item in **Current blockers** is resolved.

## Current blockers

1. `@democraft/studio` is private. The CLI starts it with a workspace-only `pnpm --filter @democraft/studio dev`, so `democraft studio` cannot work from an npm installation yet. Publish/bundle a production Studio or temporarily document that command as unavailable.
2. The `@democraft` npm organization must exist and the publishing account must have write access.

The public packages are prepared as `0.1.0-beta.0`, include only `dist/`, build during `prepack`, declare MIT/repository/runtime metadata, and publish explicitly to the public npm registry.

## 1. Prepare the packages

Choose one release version and apply it to all public packages. They currently use `0.1.0-beta.0`. Internal `workspace:*` dependencies are converted to the package version when pnpm packs them, so the entire dependency graph must exist in the registry.

For each public package:

- include only built runtime files (normally `dist/`, plus README/license where appropriate);
- build from `prepack` or build before packing;
- set `publishConfig.access` to `public` and `publishConfig.registry` to `https://registry.npmjs.org/`;
- add `license`, `repository`, `homepage`, `bugs`, `engines`, and a non-placeholder version;
- ensure every path in `main`, `types`, `exports`, and `bin` exists in the tarball.

Keep the monorepo root, examples, docs app, and Studio private unless their release design explicitly changes.

## 2. Authenticate and verify the scope

Create or confirm the `@democraft` organization on npm, enable 2FA on the maintainer account, then authenticate:

```bash
npm login
npm whoami
npm org ls democraft
```

Interactive publishing requires 2FA. For CI, prefer npm trusted publishing with OIDC instead of storing a long-lived npm token.

## 3. Run the release checks

From the repository root:

```bash
make check
```

Inspect every tarball before uploading it. Start with:

```bash
make pack
make publish-dry-run
```

Repeat `pack` and `pnpm publish --dry-run --access public` from inside every public package directory. Use pnpm for workspace publishing because it replaces `workspace:*` with registry-compatible versions. Check that there are no source maps with sensitive paths, fixtures, traces, recordings, environment files, caches, or unrelated source files.

## 4. Publish in dependency order

Use a prerelease tag for the first external test, for example version `0.1.0-beta.0` with `--tag beta`. Publish the packages in this order:

1. `@democraft/schema`
2. `@democraft/core`, `@democraft/playwright`, `@democraft/preview`, `@democraft/remotion`, and `@democraft/timeline`
3. `@democraft/compiler`
4. `@democraft/testing`
5. `@democraft/cli`

The guarded Make target publishes in that order:

```bash
make publish CONFIRM=publish TAG=beta
```

Never reuse a published version: npm package name/version pairs are immutable. If a step fails after some packages were published, fix the problem, increment the version, and continue with a consistent set.

## 5. Test exactly what users install

Create a clean directory outside the monorepo:

```bash
mkdir /tmp/democraft-smoke
cd /tmp/democraft-smoke
pnpm init
pnpm add -D @democraft/cli@beta @democraft/core@beta
pnpm exec playwright install chromium
pnpm exec democraft help
```

Add one `demo.ts`, run a local target app, and verify at least:

```bash
pnpm exec democraft validate demo.ts
pnpm exec democraft render demo.ts -o demo.mp4
pnpm exec democraft studio demo.ts
```

The Studio command is a release gate: it must run from this clean installation, not only from the monorepo.

## 6. Promote the tested release

After the beta tarballs pass the clean-install smoke test, publish a stable version with the default `latest` tag, or promote an already tested version deliberately:

```bash
npm dist-tag add @democraft/cli@<version> latest
npm view @democraft/cli dist-tags
npm view @democraft/cli@latest
```

Tag the matching Git commit and create the GitHub release only after the registry contents and clean install are verified.

## Recommended automation

After the first manual beta succeeds, configure npm trusted publishing for a GitHub Actions workflow. The workflow needs `id-token: write`, the package `repository.url` must match this GitHub repository, and npm must be configured with the exact workflow filename. Trusted publishing avoids a stored publish token and automatically emits provenance for public packages from a public repository.
