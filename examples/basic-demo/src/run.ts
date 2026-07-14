import { compileDemo, inspectIR } from "@democraft/compiler";
import demo from "./demo";

const result = await compileDemo(demo);

console.log("IR");
console.log(JSON.stringify(result.ir, null, 2));
console.log("\nDIAGNOSTICS");
console.log(JSON.stringify(result.diagnostics, null, 2));
console.log("\nINSPECTION");
console.log(inspectIR(result.ir));
