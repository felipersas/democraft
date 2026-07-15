import { describe, expect, it } from "vitest";
import { fitPlayerSize } from "./player-size";

describe("fitPlayerSize", () => {
  it("fits a 16:9 player to the available height", () => {
    expect(fitPlayerSize(912, 360, 1920, 1080)).toEqual({
      width: 640,
      height: 360,
    });
  });

  it("fits a 16:9 player to a narrow available width", () => {
    expect(fitPlayerSize(400, 600, 1920, 1080)).toEqual({
      width: 400,
      height: 225,
    });
  });

  it("caps the preview at 960 pixels wide", () => {
    expect(fitPlayerSize(1200, 800, 1920, 1080)).toEqual({
      width: 960,
      height: 540,
    });
  });
});
