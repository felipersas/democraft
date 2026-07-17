import { readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { compileDemoModuleIsolated } from "./compile-demo-isolated";
import { writeFileContainedAtomic } from "./safe-write";
import { trustedDemoPath, trustedWorkspaceRoot } from "./studio-path-authority";

const PROFILE_ID = /^auth_[0-9a-hjkmnp-tv-z]{26}$/;
let pendingWrite: Promise<unknown> = Promise.resolve();

export function setCurrentDemoAuthentication(profileId?: string) {
  const operation = pendingWrite.then(() =>
    setCurrentDemoAuthenticationLocked(profileId),
  );
  pendingWrite = operation.catch(() => undefined);
  return operation;
}

async function setCurrentDemoAuthenticationLocked(profileId?: string) {
  if (profileId !== undefined && !PROFILE_ID.test(profileId))
    throw new Error("Select a valid authentication profile.");
  const demoPath = await trustedDemoPath();
  const workspace = await trustedWorkspaceRoot();
  const source = await readFile(demoPath, "utf8");
  const next = editAuthenticationProperty(source, profileId, demoPath);
  if (next === source) {
    const { ir } = await compileDemoModuleIsolated(demoPath, {
      cwd: workspace,
    });
    return { demoId: ir.id, profileId: ir.authentication?.profileId };
  }
  await writeFileContainedAtomic(
    path.dirname(demoPath),
    demoPath,
    next,
    "Demo authentication association",
  );
  try {
    const { ir, diagnostics } = await compileDemoModuleIsolated(demoPath, {
      cwd: workspace,
    });
    const errors = diagnostics.filter((item) => item.severity === "error");
    if (errors.length)
      throw new Error(errors.map((item) => item.message).join("; "));
    if (ir.authentication?.profileId !== profileId)
      throw new Error(
        "Compiled demo did not preserve the requested authentication association.",
      );
    return { demoId: ir.id, profileId: ir.authentication?.profileId };
  } catch (error) {
    await writeFileContainedAtomic(
      path.dirname(demoPath),
      demoPath,
      source,
      "Demo authentication rollback",
    );
    throw error;
  }
}

export function editAuthenticationProperty(
  source: string,
  profileId?: string,
  filename = "demo.ts",
): string {
  const file = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const parseDiagnostics =
    (file as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] })
      .parseDiagnostics ?? [];
  if (parseDiagnostics.length > 0)
    throw new Error(
      "Demo source contains syntax errors; fix them before changing authentication.",
    );
  const aliases = new Set<string>();
  for (const statement of file.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      statement.moduleSpecifier.getText(file).replace(/["']/g, "") !==
        "@democraft/core"
    )
      continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const item of bindings.elements)
      if ((item.propertyName ?? item.name).text === "defineDemo")
        aliases.add(item.name.text);
  }
  const exported = file.statements.find(ts.isExportAssignment);
  if (!exported)
    throw new Error(
      "Studio can only associate authentication with an exported defineDemo call.",
    );
  const expression = unwrap(exported.expression);
  if (
    !ts.isCallExpression(expression) ||
    !ts.isIdentifier(expression.expression) ||
    !aliases.has(expression.expression.text)
  )
    throw new Error(
      "Studio can only associate authentication with an exported defineDemo call.",
    );
  const argument = expression.arguments[0]
    ? unwrap(expression.arguments[0])
    : undefined;
  if (!argument || !ts.isObjectLiteralExpression(argument))
    throw new Error(
      "Studio can only associate authentication with a defineDemo object literal.",
    );
  const property = argument.properties.find(
    (item): item is ts.PropertyAssignment =>
      ts.isPropertyAssignment(item) &&
      propertyName(item.name) === "authentication",
  );
  const replacement = profileId
    ? `authentication: { profileId: "${profileId}" }`
    : "";
  if (property) {
    if (profileId)
      return (
        source.slice(0, property.getStart(file)) +
        replacement +
        source.slice(property.end)
      );
    const properties = argument.properties;
    const index = properties.indexOf(property);
    const next = properties[index + 1];
    const previous = properties[index - 1];
    const start = property.getFullStart();
    const end = next ? next.getFullStart() : property.end;
    if (next) return source.slice(0, start) + source.slice(end);
    if (previous) {
      const between = source.slice(previous.end, property.getStart(file));
      const comma = between.lastIndexOf(",");
      return (
        source.slice(0, comma >= 0 ? previous.end + comma : start) +
        source.slice(property.end)
      );
    }
    return source.slice(0, start) + source.slice(property.end);
  }
  if (!profileId) return source;
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const baseIndent =
    source
      .slice(
        source.lastIndexOf("\n", argument.getStart(file)) + 1,
        argument.getStart(file),
      )
      .match(/^\s*/)?.[0] ?? "";
  return (
    source.slice(0, argument.getStart(file) + 1) +
    `${newline}${baseIndent}  ${replacement},` +
    source.slice(argument.getStart(file) + 1)
  );
}

function unwrap(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isTypeAssertionExpression(current)
  )
    current = current.expression;
  return current;
}

function propertyName(name: ts.PropertyName): string | undefined {
  return ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name)
    ? name.text
    : undefined;
}
