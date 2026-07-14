import { chromium } from "playwright";
import type { PlaywrightBindings } from "./types";

export const defaultBindings: PlaywrightBindings = {
  chromium,
};
