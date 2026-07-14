# LLM Example: Safely Add a Scene

1. Read the existing demo and target files.
2. Reuse existing target IDs when possible.
3. Add missing targets in `targets.ts` with ordered locator fallbacks.
4. Add one focused `demo.scene()` block.
5. Run static compilation and inspect diagnostics.

```ts
await demo.scene("invite-team", async (scene) => {
  await scene.click("invite-team-button");
  await scene.expectVisible("invite-dialog");
  await scene.focus("invite-dialog");
  await scene.caption("Invite collaborators without leaving your workspace.");
  await scene.hold("1.5s");
});
```

Do not add arbitrary browser callbacks inside a scene step. Every scene method must compile into a serializable step.
