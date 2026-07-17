import { createInterface } from "node:readline/promises";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { compileDemo } from "@democraft/compiler";
import {
  AuthenticationError,
  AuthenticationExecutionService,
  AuthenticationProfileRemovalService,
  AuthenticationPaths,
  AuthenticationValidationService,
  InteractiveAuthenticationService,
  LocalAuthenticationRepository,
  redact,
  toProfileDto,
  type PublicAuthenticationError,
} from "@democraft/authentication";
import {
  createAuthenticationValidationBrowser,
  createInteractiveAuthenticationBrowser,
  defaultBindings,
  type PlaywrightBindings,
} from "@democraft/playwright";
import type { CliResult, ParsedArgs } from "./types";
import { workspaceRoot } from "./paths";
import { loadDemo } from "./loaders";

const authExitCodes: Record<PublicAuthenticationError["code"], number> = {
  AUTH_PROFILE_NOT_FOUND: 4,
  AUTH_NOT_CONFIGURED: 4,
  AUTH_LOGIN_REQUIRED: 5,
  AUTH_SESSION_EXPIRED: 5,
  AUTH_STATE_CORRUPT: 6,
  AUTH_UNSUPPORTED_VERSION: 6,
  AUTH_VALIDATION_FAILED: 7,
  AUTH_PROFILE_BUSY: 8,
  AUTH_PROFILE_IN_USE: 9,
  AUTH_UNAVAILABLE_IN_CI: 10,
  AUTH_OPERATION_FAILED: 1,
};

export async function authenticationExecution() {
  const { repository, validationBrowser } = await composition();
  return new AuthenticationExecutionService(
    repository,
    repository,
    validationBrowser,
  );
}

export async function runAuthCommand(
  args: ParsedArgs,
  dependencies: {
    bindings?: PlaywrightBindings;
    interactiveCompletion?: Promise<"complete" | "cancel">;
  } = {},
): Promise<CliResult> {
  try {
    const { repository, validation, interactive } = await composition(
      dependencies.bindings,
    );
    let result: unknown;
    let human: string;
    switch (args.authCommand) {
      case "create": {
        if (!args.name || !args.origin)
          return usageFailure(
            "auth create requires --name and --origin.",
            args.json,
          );
        const profile = await repository.create({
          name: args.name,
          origin: args.origin,
          validation: {
            ...(args.validationUrl ? { url: args.validationUrl } : {}),
            ...(args.selector
              ? {
                  expect: {
                    selector: args.selector,
                    state: "visible" as const,
                  },
                }
              : {}),
          },
        });
        result = {
          profile: toProfileDto(profile),
          actionRequired: "interactive-login",
        };
        human = `Created ${profile.name} (${profile.id}).\nNext action: run \`democraft auth login ${profile.id}\`.\n`;
        break;
      }
      case "list": {
        const entries = await repository.listEntries();
        result = {
          profiles: entries.map((entry) =>
            entry.available
              ? toProfileDto(entry.profile)
              : { id: entry.profileId, status: "invalid", code: entry.code },
          ),
          actionRequired: "none",
        };
        human = entries.length
          ? `${entries
              .map((entry) =>
                entry.available
                  ? `${entry.profile.id}  ${entry.profile.status}  ${entry.profile.name}  ${entry.profile.origin}`
                  : `${entry.profileId}  invalid  Unavailable (${entry.code})`,
              )
              .join("\n")}\n`
          : "No authentication profiles.\n";
        break;
      }
      case "login": {
        const profileId = requireProfileId(args);
        process.stderr.write(
          "A headed browser will open. Complete login, return here, and press Enter.\n",
        );
        let complete: ((outcome: "complete" | "cancel") => void) | undefined;
        const completion =
          dependencies.interactiveCompletion ??
          new Promise<"complete" | "cancel">((resolve) => {
            complete = resolve;
          });
        let prompted = false;
        const login = await interactive.login(profileId, {
          completion,
          onPhase: (phase) => {
            process.stderr.write(`[authentication] ${phase}\n`);
            if (
              dependencies.interactiveCompletion ||
              phase !== "waiting-for-login" ||
              prompted
            )
              return;
            prompted = true;
            const readline = createInterface({
              input: process.stdin,
              output: process.stderr,
            });
            void readline
              .question(
                "Press Enter to complete authentication (Ctrl+C to cancel): ",
              )
              .then(
                () => complete?.("complete"),
                () => complete?.("cancel"),
              )
              .finally(() => readline.close());
          },
        });
        result = {
          profile: toProfileDto(login.profile),
          reliability: login.reliability,
          finalUrl: login.finalUrl,
          actionRequired: "none",
        };
        human = `Authentication profile ${profileId} is valid.\n`;
        break;
      }
      case "validate": {
        const profileId = requireProfileId(args);
        const validated = await validation.validate(profileId);
        result = {
          profile: toProfileDto(validated.profile),
          reliability: validated.reliability,
          finalUrl: validated.finalUrl,
          actionRequired: "none",
        };
        human = `Authentication profile ${profileId} is valid.\n`;
        break;
      }
      case "rename": {
        const profileId = requireProfileId(args);
        if (!args.name)
          return usageFailure("auth rename requires --name.", args.json);
        const profile = await repository.rename(profileId, args.name);
        result = { profile: toProfileDto(profile), actionRequired: "none" };
        human = `Renamed authentication profile ${profileId} to ${profile.name}.\n`;
        break;
      }
      case "remove": {
        const profileId = requireProfileId(args);
        await new AuthenticationProfileRemovalService(repository, {
          usageFor: (id) => discoverAuthenticationUsage(workspaceRoot(), id),
        }).remove(profileId, args.force);
        result = { profileId, removed: true, actionRequired: "none" };
        human = `Removed authentication profile ${profileId}.\n`;
        break;
      }
      default:
        return usageFailure(
          "Missing or unknown auth command. Run `democraft auth --help` for usage.",
          args.json,
        );
    }
    return {
      exitCode: 0,
      stdout: args.json
        ? `${JSON.stringify({ ok: true, ...asObject(result) }, null, 2)}\n`
        : human,
      stderr: "",
    };
  } catch (error) {
    return authFailure(error, args.json);
  }
}

export async function discoverAuthenticationUsage(
  root: string,
  profileId: string,
) {
  const candidates: string[] = [];
  await collectProjectSources(path.resolve(root), candidates);
  const usages = await Promise.all(
    candidates.map(async (candidate) => {
      const source = await readFile(candidate, "utf8").catch(() => undefined);
      if (!source) return undefined;
      const discovered = discoverDefineDemo(source, candidate, profileId);
      if (!discovered.candidate) return undefined;
      try {
        const compilation = await compileDemo(await loadDemo(candidate));
        return compilation.ir.authentication?.profileId === profileId
          ? { demoId: compilation.ir.id, selected: true as const }
          : undefined;
      } catch {
        return discovered.referencesProfile
          ? {
              demoId: `unresolved:${path.relative(root, candidate)}`,
              selected: true as const,
            }
          : undefined;
      }
    }),
  );
  return usages.filter((usage): usage is NonNullable<typeof usage> =>
    Boolean(usage),
  );
}

async function collectProjectSources(directory: string, output: string[]) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (
        [
          ".git",
          ".democraft",
          ".next",
          ".turbo",
          "build",
          "cache",
          "coverage",
          "dist",
          "node_modules",
        ].includes(entry.name)
      )
        continue;
      await collectProjectSources(target, output);
    } else if (
      /\.(?:[cm]?[jt]sx?)$/.test(entry.name) &&
      !/\.d\.ts$/.test(entry.name)
    ) {
      output.push(target);
    }
  }
}

function discoverDefineDemo(
  source: string,
  filename: string,
  profileId: string,
) {
  const file = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
    filename.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const aliases = new Set<string>();
  for (const statement of file.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== "@democraft/core"
    )
      continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const item of bindings.elements) {
      if ((item.propertyName ?? item.name).text === "defineDemo")
        aliases.add(item.name.text);
    }
  }
  const exported = file.statements.find(ts.isExportAssignment);
  if (!exported) return { candidate: false, referencesProfile: false };
  const expression = unwrapExpression(exported.expression);
  if (
    !ts.isCallExpression(expression) ||
    !ts.isIdentifier(expression.expression) ||
    !aliases.has(expression.expression.text)
  )
    return { candidate: false, referencesProfile: false };
  const argument = expression.arguments[0]
    ? unwrapExpression(expression.arguments[0])
    : undefined;
  return {
    candidate: true,
    referencesProfile:
      Boolean(argument && ts.isObjectLiteralExpression(argument)) &&
      objectProfileId(argument as ts.ObjectLiteralExpression) === profileId,
  };
}

function objectProfileId(
  object: ts.ObjectLiteralExpression,
): string | undefined {
  const authentication = object.properties.find(
    (property): property is ts.PropertyAssignment =>
      ts.isPropertyAssignment(property) &&
      propertyName(property.name) === "authentication",
  );
  if (!authentication) return undefined;
  const value = unwrapExpression(authentication.initializer);
  if (!ts.isObjectLiteralExpression(value)) return undefined;
  const profile = value.properties.find(
    (property): property is ts.PropertyAssignment =>
      ts.isPropertyAssignment(property) &&
      propertyName(property.name) === "profileId",
  );
  if (!profile) return undefined;
  const initializer = unwrapExpression(profile.initializer);
  return ts.isStringLiteralLike(initializer) ? initializer.text : undefined;
}

function propertyName(name: ts.PropertyName): string | undefined {
  return ts.isIdentifier(name) || ts.isStringLiteralLike(name)
    ? name.text
    : undefined;
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
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

async function composition(bindings = defaultBindings) {
  const paths = await AuthenticationPaths.fromWorkspace(workspaceRoot());
  const repository = new LocalAuthenticationRepository(paths);
  const validationBrowser = createAuthenticationValidationBrowser(bindings);
  return {
    repository,
    validationBrowser,
    validation: new AuthenticationValidationService(
      repository,
      repository,
      validationBrowser,
    ),
    interactive: new InteractiveAuthenticationService(
      repository,
      repository,
      createInteractiveAuthenticationBrowser(bindings),
      validationBrowser,
    ),
  };
}

function requireProfileId(args: ParsedArgs): string {
  if (args.profileId) return args.profileId;
  throw new AuthenticationError(
    "AUTH_PROFILE_NOT_FOUND",
    `auth ${args.authCommand ?? "command"} requires a profile ID.`,
    { stage: "cli" },
  );
}

export function authFailure(error: unknown, json: boolean): CliResult {
  const publicError: PublicAuthenticationError =
    error instanceof AuthenticationError
      ? error.public
      : hasPublicAuthenticationError(error)
        ? error.public
        : {
            code: "AUTH_OPERATION_FAILED",
            actionRequired: "retry",
            message: redact(
              error instanceof Error
                ? error.message
                : "Authentication operation failed.",
            ),
            stage: "cli",
          };
  return {
    exitCode: authExitCodes[publicError.code],
    stdout: json
      ? `${JSON.stringify({ ok: false, ...publicError }, null, 2)}\n`
      : "",
    stderr: json
      ? ""
      : `${publicError.message}\nAction required: ${publicError.actionRequired}.\n`,
  };
}

function hasPublicAuthenticationError(
  error: unknown,
): error is { public: PublicAuthenticationError } {
  return Boolean(
    error &&
    typeof error === "object" &&
    "public" in error &&
    (error as { public?: unknown }).public &&
    typeof (error as { public: { code?: unknown } }).public.code === "string",
  );
}

function usageFailure(message: string, json: boolean): CliResult {
  return authFailure(
    new AuthenticationError("AUTH_OPERATION_FAILED", message, {
      stage: "cli-arguments",
    }),
    json,
  );
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}
