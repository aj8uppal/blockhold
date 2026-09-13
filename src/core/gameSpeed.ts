export type GameSpeed = 1 | 2 | 3 | 4
export function gameSpeed(value: unknown): GameSpeed {
  return value === 2 || value === 3 || value === 4 ? value : 1
}
export function nextGameSpeed(value: GameSpeed): GameSpeed { return value === 4 ? 1 : gameSpeed(value + 1) }
