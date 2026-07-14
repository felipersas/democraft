/**
 * Returns true if the event target is a text-input element where keyboard
 * shortcuts should NOT fire (the user is typing). Consolidates the identical
 * guard that was triplicated in StudioShell, ShortcutsOverlay, and TimelineBody.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || el.isContentEditable;
}
