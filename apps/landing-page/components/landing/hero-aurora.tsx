"use client";

import { useSyncExternalStore } from "react";
import Aurora from "@/components/Aurora";

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribeToMotionPreference(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia(reducedMotionQuery);
  mediaQuery.addEventListener("change", onStoreChange);

  return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function motionIsAllowed() {
  return true;
}

export function HeroAurora() {
  const shouldAnimate = useSyncExternalStore(
    subscribeToMotionPreference,
    motionIsAllowed,
    () => false,
  );

  return (
    <div className="absolute inset-x-0 top-0 h-full min-h-[1080px] w-full max-[720px]:min-h-[860px]">
      {shouldAnimate ? (
        <div className="relative size-full">
          <Aurora
            colorStops={["#5227FF", "#7cff67", "#F43F5E", "#A855F7"]}
            amplitude={0.6}
            blend={2}
          />
        </div>
      ) : (
        <div className="size-full bg-[radial-gradient(ellipse_at_center,rgba(82,39,255,0.2),rgba(124,255,103,0.06)_42%,transparent_68%)]" />
      )}
    </div>
  );
}
