/** Render pacing only: the server remains the authority for simulation ticks. */
export class CoopClock {
  private primed = false
  private fraction = 0

  reset(): void { this.primed = false; this.fraction = 0 }

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
    const rate = turns > 5 ? 2 : turns > 3 ? 1.25 : 1
    this.fraction += Math.min(dt, 0.1) * 60 * speed * rate
    const whole = Math.floor(this.fraction + 1e-9)
    const ticks = Math.min(available, 12, whole)
    // Keep sub-tick precision, never a backlog of expensive frames.
    this.fraction = Math.max(0, this.fraction - whole)
    return ticks
  }
}
