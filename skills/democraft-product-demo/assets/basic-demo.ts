/**
 * basic-demo.ts — minimal DemoCraft demo template.
 *
 * Copy this as a starting point. Replace the target locators with candidates
 * from `democraft discover <url> --json`, and adjust the scene steps to match
 * the narrative you planned.
 */
import { byRole, defineDemo, defineTargets } from "@democraft/core";

const targets = defineTargets({
  // Replace with Discovery output: top locatorCandidate per element.
  hero: byRole("heading", { name: "Ship product demos in minutes" }),
  primaryCta: byRole("button", { name: "Start free trial" }),
});

export default defineDemo({
  id: "product-walkthrough",
  title: "Product walkthrough",
  source: { baseUrl: "http://localhost:3000" },
  targets,
  async run({ demo }) {
    await demo.scene("intro", async (scene) => {
      await scene.goto("/");
      await scene.expectVisible("hero");
      await scene.establish("hero");
      await scene.caption("The fastest way to ship product demos.");
    });

    await demo.scene("call-to-action", async (scene) => {
      await scene.focus("primaryCta");
      await scene.caption("Start free in seconds.");
    });
  },
});
