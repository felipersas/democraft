import { byRole, defineDemo, defineTargets } from "@democraft/core";

const baseUrl = process.env.EVAL_BASE_URL ?? "http://localhost:3000";

const targets = defineTargets({
  heroHeading: byRole("heading", { name: "Launch a workspace in minutes" }),
  primaryCta: byRole("button", { name: "Start free trial" }),
});

export default defineDemo({
  id: "broken-target-repair",
  title: "Broken target repair",
  source: {
    baseUrl,
    initialPath: "/",
  },
  targets,
  async run({ demo }) {
    await demo.scene("hero", async (scene) => {
      await scene.goto("/");
      await scene.expectVisible("heroHeading");
      await scene.establish("heroHeading");
      await scene.expectVisible("primaryCta");
      await scene.click("primaryCta");
      await scene.caption("The launch CTA is ready.");
    });
  },
});
