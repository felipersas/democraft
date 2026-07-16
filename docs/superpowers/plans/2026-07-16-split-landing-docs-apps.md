# Split Landing and Docs Apps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate the public Democraft landing page and Fumadocs documentation into independent Next.js apps inside the existing pnpm monorepo.

**Architecture:** `apps/landing-page` owns the marketing route, design tokens, brand assets, and demo video. `apps/docs` owns only Fumadocs routes and redirects its root to the English introduction. The apps share no runtime UI dependency; links between them use `NEXT_PUBLIC_DOCS_URL` with `https://docs.democraft.dev` as the production default.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS 4, Fumadocs 14, pnpm workspaces, Turborepo.

---

### Task 1: Create the standalone landing app

**Files:**
- Create: `apps/landing-page/package.json`
- Create: `apps/landing-page/app/layout.tsx`
- Create: `apps/landing-page/app/page.tsx`
- Create: `apps/landing-page/app/global.css`
- Move: `apps/docs/components/landing/**` to `apps/landing-page/components/landing/**`
- Move: `apps/docs/public/brand/**` and `apps/docs/public/demos/**` to `apps/landing-page/public/**`

- [ ] Copy the existing landing implementation without changing its visual behavior.
- [ ] Replace the Fumadocs code block dependency with semantic `pre` and `code` markup.
- [ ] Add standalone Next.js, TypeScript, and PostCSS configuration.
- [ ] Make documentation links resolve through `NEXT_PUBLIC_DOCS_URL`.
- [ ] Run `pnpm --filter @democraft/landing-page typecheck`.

### Task 2: Reduce the docs app to Fumadocs

**Files:**
- Modify: `apps/docs/app/page.tsx`
- Modify: `apps/docs/app/layout.tsx`
- Modify: `apps/docs/app/global.css`
- Modify: `apps/docs/package.json`
- Delete: `apps/docs/components/landing.tsx`

- [ ] Redirect `/` to `/en/docs/introduction`.
- [ ] Remove landing-only tokens, components, assets, and dependencies.
- [ ] Add a scoped desktop positioning override for `#nd-sidebar` while retaining the layered Fumadocs import.
- [ ] Change canonical metadata, sitemap, and robots URLs to `docs.democraft.dev`.
- [ ] Run `pnpm --filter @democraft/docs typecheck`.

### Task 3: Verify monorepo integration

**Files:**
- Modify: `pnpm-lock.yaml`

- [ ] Run `pnpm install` to register the new workspace package.
- [ ] Run both application builds independently.
- [ ] Verify the landing route at 1280px and 390px.
- [ ] Verify docs content begins after the 268px desktop sidebar.
- [ ] Run `git diff --check` and Prettier on touched source files.
