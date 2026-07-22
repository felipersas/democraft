import { byRole, byTestId, defineDemo, defineTargets } from "@democraft/core";

const baseUrl = process.env.EVAL_BASE_URL ?? "http://localhost:4173";
const profileId =
  process.env.EVAL_AUTH_PROFILE_ID ?? "auth_01arz3ndektsv4rrffq69g5fav";

const targets = defineTargets({
  privateDashboardHeading: byRole("heading", { name: "Private dashboard" }),
  userMenu: byTestId("user-menu"),
  revenueIntelligence: byRole("heading", { name: "Revenue intelligence" }),
  exportReport: byRole("button", { name: "Export report" }),
  inviteTeammate: byRole("button", { name: "Invite teammate" }),
});

export default defineDemo({
  id: "authenticated-dashboard-baseline",
  title: "Authenticated dashboard baseline",
  source: {
    baseUrl,
    initialPath: "/private/dashboard",
  },
  authentication: { profileId },
  targets,
  async run({ demo }) {
    await demo.scene("open-private-dashboard", async (scene) => {
      await scene.goto("/private/dashboard");
      await scene.expectVisible("privateDashboardHeading");
      await scene.establish("userMenu");
      await scene.caption("The private dashboard is ready.");
      await scene.hold("750ms");
    });

    await demo.scene("review-private-metrics", async (scene) => {
      await scene.focus("revenueIntelligence", { padding: 96 });
      await scene.callout("exportReport", {
        title: "Export report",
        description: "Authenticated controls resolve without exposing state.",
      });
      await scene.expectVisible("inviteTeammate");
      await scene.caption("Protected dashboard actions are available.");
      await scene.hold("750ms");
    });
  },
});
