# Product

## Register

brand

## Users

Two audiences share one surface, and both are technical:

- **Platform engineers and developer-advocates** who currently maintain product
  demos as screen recordings. Their pain is that every product change — a
  caption tweak, a pacing edit, a redesigned flow — means re-recording and
  re-editing. They want demos that survive product churn and can be reviewed in
  a pull request like any other code.
- **AI agents and the developers who orchestrate them.** Democraft's API is
  typed TypeScript designed to be generated, validated, read, and reviewed by
  both humans and agents. An agent should be able to author a demo that a
  developer would accept in review.

Context of use: alone at a workstation, evaluating whether Democraft is worth
adopting. The job to be done is *believe, in under two minutes, that a demo can
be source-controlled code rather than a recorded take* — then reach the docs or
CLI to try it. The landing page's job is to earn that click on credibility, not
hype.

## Product Purpose

Democraft turns real product workflows into polished, reproducible videos.

A developer writes one TypeScript file (`defineDemo`) describing targets and
scenes. Playwright performs the workflow against the real application and
captures screenshots, a recording, a trace, and metadata. A timeline resolver
turns that capture into frame-accurate camera, cursor, and overlay direction.
Remotion renders the resolved timeline into a repeatable MP4.

Why it exists: the demo itself becomes the source of truth. Capture and
rendering are separate stages, so presentation-only edits (captions, pacing,
camera, overlays) reuse a compatible capture instead of forcing a re-record. One
typed API serves developers and AI agents alike.

Success for the landing page: a technical visitor reaches the documentation or
installs the CLI having understood *what makes Democraft different from a screen
recorder* and *why code-as-demo is the right abstraction*.

## Brand Personality

**Precise. Credible. Quietly confident.**

Democraft is a serious engineering tool, and the brand should read that way
before a visitor reads a word of copy. Voice is understated and exact — the tool
speaks; the page does not shout. Claims are specific and demonstrable (a real
rendered walkthrough plays in the hero), never superlative. Emotional goal:
*engineering credibility* — the calm authority of a tool you'd trust in your CI.

The existing surface expresses this: a near-black canvas, a single indigo
accent, Schibsted Grotesk, generous space, and tight typographic hierarchy doing
the work that gradients and ornament would do on a louder site.

## Anti-references

What Democraft must explicitly NOT look like:

- **Generic "AI SaaS" landing templates** — cream / sand / paper backgrounds,
  the saturated 2026 warm-neutral body, gradient `background-clip: text`
  headlines, and hero-metric stat blocks (big number, small label). These are
  the loudest tells and read as AI-generated regardless of product.
- **Side-stripe accent borders** on cards, list items, or callouts. Full borders
  or background tints only.
- **Identical icon-heading-text card grids** repeated as the default section
  rhythm. Democraft favors list, table, and editorial layouts over card stacks.
- **Over-rounded surfaces** (24–40px radii on cards/sections) and the
  ghost-card pattern (1px border + wide soft drop shadow together).
- **Density-as-design developer-docs aesthetics** that feel static and lifeless
  — Democraft makes video, so motion and the real rendered output carry weight.

## Design Principles

1. **Show, don't tell.** The product's proof is a real rendered video. Lead with
   it; let the output argue for the tool. Never substitute a mock interface for
   the actual artifact.

2. **Code is the subject, so code is the design.** The TypeScript demo file is
   both the product's input and the page's hero content. Treat real code blocks
   as first-class design objects — readable, accurate, shippable.

3. **Engineering credibility over hype.** Specific, verifiable claims. Precise
   language. Restrained color and motion. The page should feel like it was built
   by the same people who built the tool.

4. **Practice what it preaches.** Democraft argues that definitions should stay
   understandable long after the product changes. The landing page should embody
   that clarity: semantic structure, diffable components, no decorative cruft
   that ages badly.

5. **Capture once, present many.** Reflect the product's own capture/render
   separation in the design system: stable, reusable tokens and components that
   survive iteration without rework.

## Accessibility & Inclusion

Target: **WCAG 2.1 AA**, with an explicit **colorblind-safe** emphasis.

- Body text ≥ 4.5:1 contrast; large or bold text ≥ 3:1. The muted-gray-on-tinted
  failure is watched closely.
- State is **never encoded by color alone.** The indigo accent always pairs with
  an icon, position, or text label (e.g. the comparison table's check icon, not
  just a green cell).
- Tested for deuteranopia and protanopia — the accent and any status colors must
  remain distinguishable when desaturated.
- `prefers-reduced-motion` gets full alternatives, not just shortened durations.
  The hero aurora already swaps to a static radial gradient; this is the bar for
  every future animation.
- Keyboard-navigable, semantic HTML throughout; visible focus rings
  (`:focus-visible` with the accent outline) on every interactive element.
