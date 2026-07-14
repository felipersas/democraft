export type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Locator =
  | { kind: "role"; role: string; name?: string }
  | { kind: "label"; text: string }
  | { kind: "testId"; id: string }
  | { kind: "text"; text: string };

export type TargetDefinition = {
  id: string;
  locators: Locator[];
  description?: string;
  framing?: {
    preferredPadding?: number;
    safeArea?: "center" | "top" | "bottom" | "left" | "right";
  };
};
