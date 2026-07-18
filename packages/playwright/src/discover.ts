/**
 * `discoverPage` — public entry point for Page Discovery.
 *
 * Mirrors the shape of `runDemo` (`./runner.ts`): validate input → create an
 * artifact run → start it → launch the browser → settle the page → collect →
 * persist → complete. On any failure the run is marked failed (or cancelled on
 * abort) so the on-disk metadata always reaches a terminal state (plan §5.10).
 *
 * Unlike capture, discovery is read-only: it never clicks, fills, or navigates
 * beyond the single `goto`. Authenticated discovery is supported by reusing
 * the same `authentication.prepare` contract as capture.
 */
import { resolve } from "node:path";
import {
  parsePageDiscovery,
  type DiscoveryEnvironment,
  type PageDiscovery,
} from "@democraft/schema";
import { defaultBindings } from "./bindings";
import {
  assertDiscoveryAllowed,
  normalizeDiscoveryOrigin,
} from "./discovery-origin";
import { collectPageDiscovery, type DiscoveryPage } from "./discovery-snapshot";
import {
  cancelDiscoveryArtifact,
  completeDiscoveryArtifact,
  createDiscoveryArtifact,
  discoveryContentHash,
  discoveryEnvironmentHash,
  DiscoveryAbortError,
  failDiscoveryArtifact,
  isDiscoveryAbort,
  startDiscoveryArtifact,
  writeDiscoveryArtifactAtomic,
  type DiscoveryArtifact,
} from "./discovery-artifacts";
import type {
  BrowserContextLike,
  BrowserLike,
  PlaywrightBindings,
} from "./types";

export type DiscoverPageOptions = {
  /** Page URL to discover. Must be http(s), in the allowlist (or its own origin). */
  url: string;
  /** Explicitly allowed origins beyond the page's own (CLI `--allow-origin`). */
  allowOrigins?: string[];
  /** Root for managed discovery runs; default `.democraft/discovery`. */
  discoveryRootDir?: string;
  /** Override the auto-allocated run directory (mirrors capture's outputDir). */
  outputDir?: string;
  headless?: boolean;
  viewport?: { width: number; height: number };
  deviceScaleFactor?: number;
  locale?: string;
  timezone?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Authenticated discovery — same contract as capture. */
  authentication?: {
    prepare(profileId: string): Promise<{
      state: Uint8Array;
      stateSha256: string;
    }>;
  };
  /** Optional profile id to resolve an authenticated session. */
  authenticationProfileId?: string;
  /** Called once the run directory + initial metadata exist. */
  onArtifactCreated?: (artifact: {
    discoveryRunId: string;
    outputDir: string;
    metadataPath: string;
    applicationMapPath: string;
  }) => void | Promise<void>;
};

export async function discoverPage(options: DiscoverPageOptions): Promise<{
  pageDiscovery: PageDiscovery;
  artifact: DiscoveryArtifact;
  screenshotPath?: string;
}> {
  return discoverPageWithBindings(options, defaultBindings);
}

export async function discoverPageWithBindings(
  options: DiscoverPageOptions,
  bindings: PlaywrightBindings,
): Promise<{
  pageDiscovery: PageDiscovery;
  artifact: DiscoveryArtifact;
  screenshotPath?: string;
}> {
  // Validate the URL and allowlist up front so origin errors surface before
  // any browser launch or directory allocation.
  assertDiscoveryAllowed(options.url, options.allowOrigins);
  const origin = normalizeDiscoveryOrigin(options.url);

  const environment: DiscoveryEnvironment = {
    headless: options.headless ?? true,
    viewport: options.viewport ?? { width: 1920, height: 1080 },
    deviceScaleFactor: options.deviceScaleFactor ?? 2,
    locale: options.locale ?? "en-US",
    timezone: options.timezone ?? "UTC",
    timeoutMs: options.timeoutMs ?? 8000,
  };

  let artifact: DiscoveryArtifact | undefined;
  let browser: BrowserLike | undefined;
  let context: BrowserContextLike | undefined;
  try {
    artifact = await createDiscoveryArtifact({
      rootDirectory:
        options.discoveryRootDir ?? resolve(".democraft", "discovery"),
      outputDirectory: options.outputDir,
      origin,
      environment,
      hashes: {
        environmentHash: discoveryEnvironmentHash(environment),
      },
    });
    await startDiscoveryArtifact(artifact);
    await options.onArtifactCreated?.({
      discoveryRunId: artifact.discoveryRunId,
      outputDir: artifact.directory,
      metadataPath: artifact.metadataPath,
      applicationMapPath: artifact.applicationMapPath,
    });
    throwIfAborted(options.signal);

    browser = await bindings.chromium.launch({
      headless: environment.headless,
    });
    throwIfAborted(options.signal);
    const storageState = await resolveAuthStorageState(options);
    context = await browser.newContext({
      viewport: environment.viewport,
      deviceScaleFactor: environment.deviceScaleFactor,
      locale: environment.locale,
      timezoneId: environment.timezone,
      storageState,
    });
    throwIfAborted(options.signal);
    const page = (await context.newPage()) as unknown as DiscoveryPage & {
      goto(url: string, options?: { timeout?: number }): Promise<unknown>;
    };

    await page.goto(options.url, { timeout: environment.timeoutMs });
    throwIfAborted(options.signal);

    const pageDiscovery = await collectPageDiscovery(page);
    throwIfAborted(options.signal);

    // Persist a full-page screenshot so agents (and vision models) can
    // sanity-check the discovered map without re-running a browser. The
    // screenshot is best-effort: if the page can't be captured, discovery
    // still succeeds without it.
    let screenshotPath: string | undefined;
    if (page.screenshot) {
      try {
        const { writeFile } = await import("node:fs/promises");
        screenshotPath = `${artifact.directory}/page.png`;
        const image = await page.screenshot({ fullPage: true });
        await writeFile(screenshotPath, image);
      } catch {
        screenshotPath = undefined;
      }
    }

    const json = `${JSON.stringify(pageDiscovery, null, 2)}\n`;
    const parsed = parsePageDiscovery(JSON.parse(json));
    await writeDiscoveryArtifactAtomic(artifact, json);
    await completeDiscoveryArtifact(artifact, {
      contentHash: discoveryContentHash(json),
    });
    return { pageDiscovery: parsed, artifact, screenshotPath };
  } catch (error) {
    try {
      if (artifact && isDiscoveryAbort(error, options.signal)) {
        await cancelDiscoveryArtifact(artifact);
      } else if (artifact) {
        await failDiscoveryArtifact(artifact, error);
      }
    } catch {
      // Preserve the operational error; terminal persistence is best-effort.
    }
    throw error;
  } finally {
    await context?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
  }
}

async function resolveAuthStorageState(
  options: DiscoverPageOptions,
): Promise<{ cookies: unknown[]; origins: unknown[] } | undefined> {
  if (!options.authentication || !options.authenticationProfileId) {
    return undefined;
  }
  const prepared = await options.authentication.prepare(
    options.authenticationProfileId,
  );
  const envelope = JSON.parse(Buffer.from(prepared.state).toString("utf8")) as {
    schemaVersion?: unknown;
    data?: { cookies?: unknown[]; origins?: unknown[] };
  };
  if (
    envelope.schemaVersion === 1 &&
    Array.isArray(envelope.data?.cookies) &&
    Array.isArray(envelope.data.origins)
  ) {
    return {
      cookies: envelope.data!.cookies!,
      origins: envelope.data!.origins!,
    };
  }
  throw new Error(
    "Authentication state is corrupt; the profile must be renewed.",
  );
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DiscoveryAbortError();
}
