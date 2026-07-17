// @vitest-environment jsdom
import * as React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { studioMutationRequest } from "../lib/studio-api";
import { RecaptureButton } from "./RecaptureButton";

vi.mock("../lib/studio-api", () => ({
  studioMutationRequest: vi.fn(),
}));

class EventSourceStub {
  addEventListener() {}
  removeEventListener() {}
  close() {}
}

beforeEach(() => {
  vi.stubGlobal("EventSource", EventSourceStub);
  vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.mocked(studioMutationRequest).mockResolvedValue(new Response(null));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("RecaptureButton", () => {
  it("leaves the working state when the completed request succeeds without an SSE terminal event", async () => {
    const user = userEvent.setup();
    render(<RecaptureButton />);

    await user.click(screen.getByRole("button", { name: "Re-capture" }));

    await waitFor(() =>
      expect(
        screen.getByRole<HTMLButtonElement>("button", { name: "Done" })
          .disabled,
      ).toBe(false),
    );
  });
});
