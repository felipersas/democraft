export const MAX_PLAYER_WIDTH = 960;

export function fitPlayerSize(
  availableWidth: number,
  availableHeight: number,
  compositionWidth: number,
  compositionHeight: number,
): { width: number; height: number } {
  const scale = Math.min(
    availableWidth / compositionWidth,
    availableHeight / compositionHeight,
    MAX_PLAYER_WIDTH / compositionWidth,
  );
  return {
    width: compositionWidth * scale,
    height: compositionHeight * scale,
  };
}
