/**
 * How a victory is graded, in one place.
 *
 * Kingdom Rush makes three stars a pursuit rather than a grade because the
 * line is visible and forgiving: keep 18 of 20 and you have it, and every
 * screen agrees where the line is. Until now the grade was computed only at
 * the end, from fractions nobody saw. The HUD, the grading and the debrief all
 * read these numbers now.
 *
 * Three stars keep 88% of the lives (22 of 25, 18 of 20, 14 of 15); two keep
 * half (13, 10, 8). One star is any win.
 */
export function starThresholds(maxLives: number): { three: number, two: number } {
  return { three: Math.ceil(maxLives * 0.88), two: Math.ceil(maxLives * 0.5) }
}

export function starsFor(lives: number, maxLives: number): 1 | 2 | 3 {
  const t = starThresholds(maxLives)
  return lives >= t.three ? 3 : lives >= t.two ? 2 : 1
}
