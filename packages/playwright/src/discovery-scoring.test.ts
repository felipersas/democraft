import { describe, expect, it } from "vitest";
import {
  isInteractiveKind,
  scoreLocatorCandidates,
  shouldRetainElement,
  suggestTargetId,
  type ScoringInput,
} from "./discovery-scoring";

const uniqueVisibleButton: ScoringInput = {
  role: "button",
  name: "New project",
  text: "New project",
  testId: undefined,
  label: undefined,
  visible: true,
  enabled: true,
  roleMatchCount: 1,
  labelMatchCount: 0,
  testIdMatchCount: 0,
  textMatchCount: 1,
};

describe("discovery locator scoring", () => {
  it("scores a unique role+name candidate highest and marks it stable", () => {
    const candidates = scoreLocatorCandidates(uniqueVisibleButton);
    expect(candidates[0]).toMatchObject({
      locator: { kind: "role", role: "button", name: "New project" },
      stability: "high",
      unique: true,
      matchCount: 1,
    });
    expect(candidates[0]!.confidence).toBe(0.99);
    expect(candidates[0]!.reasons).toContain("Unique accessible role and name");
  });

  it("orders candidates role > label > testId > text", () => {
    const candidates = scoreLocatorCandidates({
      role: "textbox",
      name: "Email",
      text: "Email",
      testId: "email-input",
      label: "Email",
      visible: true,
      enabled: true,
      roleMatchCount: 1,
      labelMatchCount: 1,
      testIdMatchCount: 1,
      textMatchCount: 1,
    });
    expect(candidates.map((c) => c.locator.kind)).toEqual([
      "role",
      "label",
      "testId",
      "text",
    ]);
  });

  it("is deterministic: identical input yields identical output", () => {
    const a = scoreLocatorCandidates(uniqueVisibleButton);
    const b = scoreLocatorCandidates(uniqueVisibleButton);
    expect(a).toEqual(b);
  });

  it("penalizes ambiguous matches and flags them low-stability", () => {
    const candidates = scoreLocatorCandidates({
      ...uniqueVisibleButton,
      roleMatchCount: 12,
    });
    const roleCandidate = candidates.find((c) => c.locator.kind === "role")!;
    expect(roleCandidate.unique).toBe(false);
    expect(roleCandidate.stability).toBe("low");
    expect(roleCandidate.confidence).toBeLessThan(0.99);
    expect(roleCandidate.risks?.[0]).toMatch(/ambiguous/i);
    // The unique-text candidate legitimately outscores the ambiguous role one.
    expect(candidates[0]!.locator.kind).toBe("text");
  });

  it("penalizes hidden and disabled elements in confidence", () => {
    const visible = scoreLocatorCandidates(uniqueVisibleButton)[0]!.confidence;
    const hidden = scoreLocatorCandidates({ ...uniqueVisibleButton, visible: false })[0]!
      .confidence;
    const disabled = scoreLocatorCandidates({ ...uniqueVisibleButton, enabled: false })[0]!
      .confidence;
    expect(hidden).toBeLessThan(visible);
    expect(disabled).toBeLessThan(visible);
  });

  it("keeps confidence within [0, 1]", () => {
    const candidates = scoreLocatorCandidates({
      ...uniqueVisibleButton,
      roleMatchCount: 1000,
      visible: false,
      enabled: false,
    });
    for (const candidate of candidates) {
      expect(candidate.confidence).toBeGreaterThanOrEqual(0);
      expect(candidate.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("suggests camelCased target ids from accessible names", () => {
    expect(suggestTargetId("button", "button", "New project", "element_01")).toBe(
      "newProject",
    );
    expect(suggestTargetId("link", "link", "Projects", "element_02")).toBe(
      "projects",
    );
    // Falls back to role when no name.
    expect(suggestTargetId("button", "button", undefined, "element_03")).toBe(
      "button",
    );
  });

  it("classifies interactivity by element kind", () => {
    expect(isInteractiveKind("button")).toBe(true);
    expect(isInteractiveKind("link")).toBe(true);
    expect(isInteractiveKind("textbox")).toBe(true);
    expect(isInteractiveKind("heading")).toBe(false);
    expect(isInteractiveKind("card")).toBe(false);
    expect(isInteractiveKind("listitem")).toBe(false);
  });

  it("drops tiny non-interactive elements but keeps interactive ones", () => {
    expect(
      shouldRetainElement({
        visible: true,
        interactive: false,
        boundingBox: { x: 0, y: 0, width: 8, height: 8 },
      }),
    ).toBe(false);
    expect(
      shouldRetainElement({
        visible: true,
        interactive: true,
        boundingBox: { x: 0, y: 0, width: 8, height: 8 },
      }),
    ).toBe(true);
    expect(
      shouldRetainElement({
        visible: false,
        interactive: true,
        boundingBox: { x: 0, y: 0, width: 40, height: 40 },
      }),
    ).toBe(false);
  });
});
