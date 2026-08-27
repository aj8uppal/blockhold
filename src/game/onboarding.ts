import type { Game } from './game.ts'

/**
 * The first five minutes.
 *
 * Dropping a newcomer straight into a battle removed the paperwork, but it
 * did not replace it with teaching: the game says nothing, and a stranger has
 * to guess that grey squares are buildable, that the button at the top starts
 * the fight, that towers upgrade, and that the portrait in the corner is a
 * unit they command.
 *
 * So the first battle - once, ever - watches for what the player has not done
 * yet and asks for exactly one thing at a time. Each step clears itself the
 * moment the player does it, so nobody is ever told something they already
 * know, and nothing blocks play: every prompt can be ignored and the battle
 * carries on regardless.
 */

export interface OnboardingStep {
  id: string
  /** what to ask for, in the player's language */
  prompt: string
  /** the step is finished when this is true */
  done: (g: Game) => boolean
  /** only ask once this is true */
  ready?: (g: Game) => boolean
  /** highlight the buildable plots while this step is live */
  pulsePlots?: boolean
}

export const ONBOARDING: OnboardingStep[] = [
  {
    id: 'build',
    prompt: 'Tap one of the glowing pads to build your first tower.',
    done: g => g.towers.length > 0,
    pulsePlots: true,
  },
  {
    id: 'call',
    prompt: 'Ready? Call the wave in early — the sooner you call, the more gold you keep.',
    done: g => (g.waves?.waveIndex ?? -1) >= 0,
  },
  {
    id: 'upgrade',
    prompt: 'Tap a tower you have built to upgrade it. Stronger beats more.',
    // only worth asking once they can actually afford one
    ready: g => g.towers.length > 0 && g.gold >= 110,
    done: g => g.towers.some(t => t.level > 1),
  },
  {
    id: 'hero',
    prompt: 'That portrait is your hero. Tap it, then tap the road to send them there.',
    ready: g => (g.waves?.waveIndex ?? -1) >= 1,
    done: g => g.heroHasMoved,
  },
]

export class OnboardingDirector {
  private index = 0
  private shownFor: string | null = null
  private settle = 0

  get finished(): boolean { return this.index >= ONBOARDING.length }
  get current(): OnboardingStep | null { return ONBOARDING[this.index] ?? null }

  /** returns the prompt to show, or null */
  update(g: Game, dt: number): string | null {
    const step = this.current
    if (!step) return null
    if (step.done(g)) {
      this.index++
      this.shownFor = null
      this.settle = 0.6      // a breath before the next ask
      return null
    }
    if (this.settle > 0) { this.settle -= dt; return null }
    if (step.ready && !step.ready(g)) return null
    if (this.shownFor === step.id) return step.prompt
    this.shownFor = step.id
    return step.prompt
  }

  skip(): void { this.index = ONBOARDING.length }
}
