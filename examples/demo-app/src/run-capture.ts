import { compileDemo, inspectIR } from "@democraft/compiler";
import { runDemo } from "@democraft/playwright";
import demo from "./demo";
import { startDemoServer } from "./server";

const server = await startDemoServer(4173);

try {
  const result = await compileDemo(demo);

  if (
    result.diagnostics.some((diagnostic) => diagnostic.severity === "error")
  ) {
    console.error(JSON.stringify(result.diagnostics, null, 2));
    process.exitCode = 1;
  } else {
    console.log(inspectIR(result.ir));
    const manifest = await runDemo(result.ir, {
      outputDir: ".democraft/runs/create-project-live",
      environment: {
        viewport: { width: 1440, height: 900 },
        locale: "en-US",
        timezone: "UTC",
      },
    });
    console.log(JSON.stringify(manifest, null, 2));
  }
} finally {
  server.close();
}
