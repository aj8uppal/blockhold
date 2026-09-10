/** Render pacing only: the server remains the authority for simulation ticks. */
export class CoopClock {
  private primed = false
  private fraction = 0
  private rate = 1

  reset(): void { this.primed = false; this.fraction = 0; this.rate = 1 }

  take(dt: number, speed: number, available: number, ticksPerTurn: number, drain = false): number {
    // One turn in reserve absorbs startup work and small variations in delivery.
    if (!this.primed) {
      if (available < ticksPerTurn * speed * 2 && !(drain && available > 0)) return 0
      this.primed = true
    }
    if (available <= 0) {
      // Waiting for the network is not simulation debt to repay in one frame.
      this.reset()
      return 0
    }
    const turns = available / (ticksPerTurn * speed)
    // Ease out a delivery backlog instead of suddenly doubling the world speed.
    // A healthy reserve stays at exactly the requested speed; only excess
    // authorized ticks produce catch-up, capped at 50% above that speed.
    const elapsed = Math.min(dt, 0.1)
    const target = 1 + Math.min(0.5, Math.max(0, turns - 3) * 0.1)
    this.rate += (target - this.rate) * (1 - Math.exp(-elapsed / 0.25))
    this.fraction += elapsed * 60 * speed * this.rate
    const whole = Math.floor(this.fraction + 1e-9)
    const ticks = Math.min(available, 12, whole)
    // Keep sub-tick precision, never a backlog of expensive frames.
    this.fraction = Math.max(0, this.fraction - whole)
    return ticks
  }
}
