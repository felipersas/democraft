// @vitest-environment jsdom
import * as React from "react";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthenticationStatus,
  LoginDialog,
  ProfileActionDialog,
  type AuthenticationPanelProfile,
} from "./AuthenticationPanel";

const profile: AuthenticationPanelProfile = {
  id: "auth_01arz3ndektsv4rrffq69g5fav",
  name: "Production admin",
  origin: "https://app.example",
  status: "authenticated",
  validation: { url: "https://app.example/dashboard" },
  lastValidatedAt: "2026-01-01T00:00:00Z",
  usage: [],
};

let previouslyFocused: HTMLElement | null;
const escapeHandlers = new WeakMap<
  HTMLDialogElement,
  (event: KeyboardEvent) => void
>();

beforeEach(() => {
  previouslyFocused = null;
  HTMLDialogElement.prototype.showModal = function () {
    previouslyFocused = document.activeElement as HTMLElement;
    this.setAttribute("open", "");
    this.setAttribute("aria-modal", "true");
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") this.close();
    };
    escapeHandlers.set(this, escape);
    document.addEventListener("keydown", escape);
    queueMicrotask(() =>
      this.querySelector<HTMLElement>("[autofocus], button, input")?.focus(),
    );
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
    const escape = escapeHandlers.get(this);
    if (escape) document.removeEventListener("keydown", escape);
    this.dispatchEvent(new Event("close"));
    previouslyFocused?.focus();
  };
});

afterEach(() => cleanup());

describe("Authentication Studio rendered accessibility", () => {
  it("opens rename from the keyboard, validates, reports a durable error, submits, and restores focus", async () => {
    const user = userEvent.setup();
    const rename = vi
      .fn<
        (profile: AuthenticationPanelProfile, name: string) => Promise<void>
      >()
      .mockRejectedValueOnce(new Error("Name could not be saved."))
      .mockResolvedValueOnce(undefined);
    render(
      <ActionHarness action={{ kind: "rename", profile }} onRename={rename} />,
    );

    const trigger = screen.getByRole("button", { name: "Rename profile" });
    trigger.focus();
    await user.keyboard("{Enter}");
    const dialog = screen.getByRole("dialog", {
      name: "Rename Production admin",
    });
    expect(dialog.hasAttribute("open")).toBe(true);
    const input = within(dialog).getByRole("textbox", { name: "Profile name" });
    await user.clear(input);
    await user.click(within(dialog).getByRole("button", { name: "Save name" }));
    expect(within(dialog).getByRole("alert").textContent).toContain(
      "Enter a profile name",
    );
    expect(input.getAttribute("aria-invalid")).toBe("true");

    await user.type(input, "Renamed admin");
    await user.click(within(dialog).getByRole("button", { name: "Save name" }));
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Name could not be saved.",
    );
    expect(dialog.hasAttribute("open")).toBe(true);
    await user.click(within(dialog).getByRole("button", { name: "Save name" }));
    expect(rename).toHaveBeenLastCalledWith(profile, "Renamed admin");
    expect(dialog.hasAttribute("open")).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it("names usage and requires the profile name in the second force-remove step", async () => {
    const user = userEvent.setup();
    const used = {
      ...profile,
      usage: [
        { demoId: "billing", selected: true },
        { demoId: "reporting", selected: true },
      ],
    };
    const remove = vi.fn(async () => undefined);
    render(
      <ActionHarness
        action={{ kind: "remove", profile: used }}
        onRemove={remove}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Remove profile" }));
    const dialog = screen.getByRole("dialog", {
      name: "Remove Production admin?",
    });
    expect(dialog.textContent).toContain("used by 2 demos: billing, reporting");
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    const confirmation = within(dialog).getByRole("textbox", {
      name: "Type the profile name to confirm",
    });
    await user.clear(confirmation);
    await user.type(confirmation, "wrong");
    expect(
      (
        within(dialog).getByRole("button", {
          name: "Remove profile",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    await user.clear(confirmation);
    await user.type(confirmation, profile.name);
    await user.click(
      within(dialog).getByRole("button", { name: "Remove profile" }),
    );
    expect(remove).toHaveBeenCalledWith(used);
  });

  it("restores trigger focus on Escape/cancel and supports tab navigation", async () => {
    const user = userEvent.setup();
    render(<ActionHarness action={{ kind: "rename", profile }} />);
    const trigger = screen.getByRole("button", { name: "Rename profile" });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog");
    const input = within(dialog).getByRole("textbox", { name: "Profile name" });
    input.focus();
    await user.tab();
    expect(
      document.activeElement?.getAttribute("aria-label") ??
        document.activeElement?.textContent,
    ).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(document.activeElement).toBe(trigger);
    await user.click(trigger);
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(document.activeElement).toBe(trigger);
  });

  it.each(["Complete authentication", "Cancel"])(
    "keeps the login dialog active when %s fails",
    async (actionName) => {
      const user = userEvent.setup();
      render(
        <LoginHarness
          failingAction={actionName === "Cancel" ? "cancel" : "complete"}
        />,
      );
      await user.click(screen.getByRole("button", { name: "Open login" }));
      const dialog = screen.getByRole("dialog", {
        name: "Sign in to Production admin",
      });
      await user.click(
        within(dialog).getByRole("button", { name: actionName }),
      );
      const alert = await within(dialog).findByRole("alert");
      expect(alert.textContent).toContain(`${actionName} failed`);
      expect(dialog.hasAttribute("open")).toBe(true);
    },
  );

  it("encodes status with literal text and an icon, not color alone", () => {
    const { container } = render(<AuthenticationStatus status="expired" />);
    expect(screen.getByText("Session expired")).toBeTruthy();
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("retains real responsive sheets, touch targets, and reduced-motion rules", async () => {
    const css = await readFile(
      path.join(process.cwd(), "app/globals.css"),
      "utf8",
    );
    expect(css).toMatch(
      /@media \(max-width: 959px\)[\s\S]*\.studio-inspector\.is-open/,
    );
    expect(css).toMatch(
      /@media \(max-width: 719px\)[\s\S]*\.auth-dialog button[\s\S]*min-height: 40px/,
    );
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*transition-duration: 0?\.01ms/,
    );
  });
});

function ActionHarness({
  action,
  onRename = async () => undefined,
  onRemove = async () => undefined,
}: {
  action: { kind: "rename" | "remove"; profile: AuthenticationPanelProfile };
  onRename?: (
    profile: AuthenticationPanelProfile,
    name: string,
  ) => Promise<void>;
  onRemove?: (profile: AuthenticationPanelProfile) => Promise<void>;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" onClick={() => ref.current?.showModal()}>
        {action.kind === "rename" ? "Rename profile" : "Remove profile"}
      </button>
      <ProfileActionDialog
        dialogRef={ref}
        action={action}
        onDismiss={() => undefined}
        onRename={onRename}
        onRemove={onRemove}
      />
    </>
  );
}

function LoginHarness({
  failingAction,
}: {
  failingAction: "complete" | "cancel";
}) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const [error, setError] = React.useState<string>();
  const fail = (name: string) =>
    Promise.reject(new Error(`${name} failed`)).catch((cause) =>
      setError((cause as Error).message),
    );
  return (
    <>
      <button type="button" onClick={() => ref.current?.showModal()}>
        Open login
      </button>
      <LoginDialog
        dialogRef={ref}
        login={{ profile, phase: "waiting-for-login", error }}
        onComplete={() => {
          if (failingAction === "complete")
            void fail("Complete authentication");
        }}
        onCancel={() => {
          if (failingAction === "cancel") void fail("Cancel");
        }}
        onDismiss={() => undefined}
      />
    </>
  );
}
