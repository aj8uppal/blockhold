import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { Game } from '../src/game/game.ts'
import { levels } from '../src/game/levels.ts'
import { huntLevel } from '../src/game/hunts.ts'
import { readSession, writeSession, type BattleSession } from '../src/game/session.ts'
import { parseSave } from '../src/core/save.ts'
import type { CoopCommand } from '../src/game/coopCommands.ts'
import type { HUD } from '../src/ui/hud.ts'
import { towerTrees } from '../src/game/towerDefs.ts'
import type { TowerKind } from '../src/game/types.ts'

vi.mock('../src/core/audio.ts', async importOriginal => ({
  ...await importOriginal<typeof import('../src/core/audio.ts')>(),
  audio: new Proxy({}, { get: () => vi.fn() }),
}))
vi.mock('../src/core/engine.ts', () => ({ Engine: class {
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera()
  camTarget = new THREE.Vector3()
  camTargetGoal = new THREE.Vector3()
  constructor() {
    return new Proxy(this, { get(target, key) { return Reflect.has(target, key) ? Reflect.get(target, key) : vi.fn() } })
  }
} }))

let storage: Record<string, string>
beforeEach(() => {
  storage = {}
  vi.stubGlobal('window', { innerWidth: 1000, innerHeight: 800 })
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage[key] ?? null,
    setItem: (key: string, value: string) => { storage[key] = value },
    removeItem: (key: string) => { delete storage[key] },
  })
})

type Internals = {
  simStep(dt: number): void
  route(cmd: CoopCommand): boolean
  applyCoopCommand(cmd: CoopCommand, seat: number): void
  sessionTick: number
  sessionStateHash(): number
  recovering: boolean
}
function makeGame(): Game {
  const game = new Game({} as HTMLCanvasElement)
  game.save = parseSave({ xp: 10000, taughtBasics: true, seenEnemies: [], armory: { prospector: 2 },
    honors: ['hero:aldric:ossuary'], heroPaths: { aldric: 'bulwark' } })!
  game.hud = new Proxy({}, { get: (_target, key) => key === 'showDossier'
    ? (_def: unknown, close: () => void) => close() : vi.fn() }) as HUD
  game.floater = vi.fn()
  game.shatterUnit = vi.fn()
  game.onPhaseChange = vi.fn()
  return game
}
function ticks(game: Game, count: number): void {
  const internal = game as unknown as Internals
  for (let i = 0; i < count && game.phase === 'playing'; i++) internal.simStep(1 / 60)
}
function issue(game: Game, cmd: CoopCommand): void {
  const internal = game as unknown as Internals
  if (!internal.route(cmd)) internal.applyCoopCommand(cmd, -1)
}
function snapshot(game: Game) {
  return {
    hash: (game as unknown as Internals).sessionStateHash(), time: game.time,
    gold: game.gold, lives: game.lives, shards: game.shards,
    towers: game.towers.map(t => ({ kind: t.kind, level: t.level, damage: t.damage, policy: t.targetPolicy })),
    enemies: game.enemies.map(e => ({ id: e.def.id, hp: e.hp, dist: e.dist, pos: e.pos.toArray() })),
    hero: { hp: game.hero!.hp, maxHp: game.hero!.maxHp, xp: game.hero!.xp, level: game.hero!.level,
      rank: game.hero!.signatureRank, cooldown: game.hero!.abilityCooldown, path: game.hero!.specialization,
      pos: game.hero!.group.position.toArray(), field: game.hero!.hasActiveField },
    cooldowns: [game.abilities.meteor.cooldown, game.abilities.reinforce.cooldown],
  }
}

describe('actual Game session recovery', () => {
  it('reconstructs enemy health, projectiles, hero investment and final-tick orders without changing account progress', async () => {
    const game = makeGame()
    game.startLevel(levels[0], 'normal', 'aldric', 'campaign', { seed: 4321 })
    game.buildTower('arrow', game.terrain!.plots[0])
    game.cycleTargetPolicy(game.towers[0])
    game.upgradeHeroSignature()
    game.callWave()
    ticks(game, 900)
    expect(game.enemies.length).toBeGreaterThan(0)
    const aim = game.lanes[0].sample(game.lanes[0].length * 0.45)
    issue(game, { kind: 'meteor', x: aim.x, z: aim.z })
    ticks(game, 7) // multiple meteor projectiles and scheduled casts remain live
    issue(game, { kind: 'heroMove', x: aim.x, z: aim.z })
    issue(game, { kind: 'reinforce', x: aim.x, z: aim.z })
    game.paused = true
    const before = snapshot(game)
    expect(game.saveSession()).toBe(true)
    const session = readSession()!
    ticks(game, 90)
    const future = snapshot(game)
    // Edits to the account after starting do not rewrite an ongoing run.
    game.save.armory = { coffers: 4 }
    game.save.heroPaths.aldric = 'vanguard'
    game.save.xp += 12345
    const account = JSON.stringify(game.save)
    const savedBytes = storage['blockhold.session.v1']
    vi.mocked(game.onPhaseChange).mockClear()
    expect(await game.resumeSession(session)).toBe(true)
    expect(snapshot(game)).toEqual(before)
    expect(JSON.stringify(game.save)).toBe(account)
    expect(storage['blockhold.session.v1']).toBe(savedBytes)
    expect(game.paused).toBe(true)
    expect(game.onPhaseChange).toHaveBeenCalledTimes(1)
    expect(game.roster.armory).toEqual({ prospector: 2 })
    expect(game.canSaveSession).toBe(true)
    ticks(game, 90)
    expect(snapshot(game)).toEqual(future)
    game.disposeLevel()
  })

  it('rebuilds hunt identity and a persistent hero field, then can continue saving', async () => {
    const game = makeGame()
    game.startLevel(huntLevel('ossuary'), 'normal', 'aldric', 'campaign', { seed: 1122, hunt: 'ossuary' })
    game.buildTower('arrow', game.terrain!.plots[0])
    const post = game.lanes[0].sample(game.lanes[0].length * 0.2)
    issue(game, { kind: 'heroMove', x: post.x, z: post.z })
    game.callWave()
    ticks(game, 1200)
    game.castHeroSignature()
    expect(game.hero!.hasActiveField).toBe(true)
    ticks(game, 30)
    const before = snapshot(game)
    expect(game.saveSession()).toBe(true)
    expect(await game.resumeSession(readSession()!)).toBe(true)
    expect(game.hunt?.id).toBe('ossuary')
    expect(snapshot(game)).toEqual(before)
    game.paused = false
    ticks(game, 30)
    expect(game.saveSession()).toBe(true)
    expect(readSession()?.tick).toBe(1260)
    game.disposeLevel()
  })

  it('does not apply live input or advance normal rendering while a recovery is active', () => {
    const game = makeGame()
    game.startLevel(levels[0], 'normal', 'aldric', 'campaign', { seed: 1 })
    const internal = game as unknown as Internals
    internal.recovering = true
    game.callWave()
    game.togglePause()
    game.update(1)
    expect(game.waves!.waveIndex).toBe(-1)
    expect(internal.sessionTick).toBe(0)
    expect(game.canSaveSession).toBe(false)
    expect(game.saveSession()).toBe(false)
    internal.recovering = false
    game.disposeLevel()
  })

  it('rejects a divergent journal and preserves its bytes and the real account', async () => {
    const game = makeGame()
    game.startLevel(levels[0], 'normal', 'aldric', 'campaign', { seed: 1 })
    game.callWave()
    ticks(game, 60)
    game.saveSession()
    const session = readSession()!
    session.stateHash = ((session.stateHash ?? 0) + 1) >>> 0
    expect(writeSession(session)).toBe(true)
    const bytes = storage['blockhold.session.v1'], account = JSON.stringify(game.save)
    expect(await game.resumeSession(session)).toBe(false)
    expect(storage['blockhold.session.v1']).toBe(bytes)
    expect(JSON.stringify(game.save)).toBe(account)
    expect(game.phase).toBe('idle')
    expect(game.canSaveSession).toBe(false)
  })

  it('excludes co-op and invalid mode journals', async () => {
    const game = makeGame()
    game.startLevel(levels[0], 'normal', 'aldric', 'campaign', { seed: 1 })
    const session = readSession()!
    game.coop = {} as Game['coop']
    expect(game.canSaveSession).toBe(false)
    expect(await game.resumeSession(session)).toBe(false)
    game.coop = null
    expect(await game.resumeSession({ ...session, hunt: 'ossuary', mode: 'endless' } as BattleSession)).toBe(false)
    game.disposeLevel()
  })

  it('replays a real campaign win and Hold the Line without awarding the campaign twice', async () => {
    const game = makeGame()
    game.startLevel(levels[0], 'casual', 'aldric', 'campaign', { seed: 71 })
    const roster: TowerKind[] = ['arrow', 'mage', 'cannon', 'barracks']
    const samples = game.lanes[0]
    const orders = [1, 2, 3, 4].flatMap(tier => roster.map((kind, i) => ({ tier, kind, i })))
    let next = 0
    for (let tick = 0; tick < 60000 && game.phase === 'playing'; tick++) {
      if (tick % 60 === 0) {
        const order = orders[next]
        if (order) {
          if (order.tier === 1) {
            const reach = towerTrees[order.kind].levels[0].range
            const plots = game.terrain!.plots.filter(p => !p.occupied)
            plots.sort((a, b) => {
              const score = (p: typeof a) => {
                let value = 0
                for (let d = 0; d < samples.length; d += 0.5) {
                  const point = samples.sample(d)
                  if (Math.hypot(p.pos.x - point.x, p.pos.z - point.z) <= reach) value++
                }
                return value
              }
              return score(b) - score(a)
            })
            if (plots[0] && game.gold >= towerTrees[order.kind].levels[0].cost) {
              game.buildTower(order.kind, plots[0]); next++
            }
          } else {
            const tower = game.towers[order.i]
            const upgrade = tower.upgradeOptions[0]
            if (upgrade && game.gold >= upgrade.cost) { game.upgradeTower(tower, 0); next++ }
          }
        }
        const foes = game.enemies.filter(e => e.targetable)
        if (!foes.length && game.waves!.phase === 'countdown') game.callWave()
        if (foes.length >= 4 && game.abilities.meteor.cooldown <= 0) issue(game, { kind: 'meteor', x: foes[0].pos.x, z: foes[0].pos.z })
        game.castHeroSignature()
      }
      ticks(game, 1)
    }
    expect(game.phase).toBe('victory')
    expect(storage['blockhold.session.v1']).toBeUndefined()
    const xp = game.save.xp, stars = { ...game.save.stars }
    game.holdTheLine()
    ticks(game, 420)
    expect(game.isFreeplay).toBe(true)
    expect(game.saveSession()).toBe(true)
    const before = snapshot(game)
    const session = readSession()!
    expect(session.commands.some(e => e.cmd.kind === 'hold')).toBe(true)
    expect(await game.resumeSession(session)).toBe(true)
    expect(snapshot(game)).toEqual(before)
    expect(game.save.xp).toBe(xp)
    expect(game.save.stars).toEqual(stars)
    expect(game.isFreeplay).toBe(true)
    game.disposeLevel()
  }, 20000)

  it('accounts for an Empress replacement as one wave enemy and preserves its full health multiplier', () => {
    const game = makeGame()
    game.startLevel(levels[0], 'veteran', 'aldric', 'campaign', { seed: 71 })
    game.spawnEnemyAt('veilempress', 0, 0, { waveTag: 0, hpMult: 2.5, surged: true })
    const flying = game.enemies[0]
    const multiplier = flying.maxHp / flying.def.hp
    const gold = game.gold
    flying.takeDamage(flying.hp + 1, 'true', game)
    const grounded = game.enemies.find(e => e.def.id === 'veilempressLanded')!
    expect(grounded.maxHp / grounded.def.hp).toBeCloseTo(multiplier)
    expect(game.gold).toBe(gold)
    grounded.takeDamage(grounded.hp + 1, 'true', game)
    expect(game.gold).toBeGreaterThan(gold)
    expect(game.perfectWaves).toBe(1)
    expect((game as unknown as { waveTracks: Map<number, unknown> }).waveTracks.size).toBe(0)
    game.disposeLevel()
  })

  it('restores an active Last Legion bought with actual hunt income, including its future cooldown', async () => {
    const game = makeGame()
    game.save.xp = 20000
    game.save.honors.push('mastery:barracks:ossuary', 'mastery:barracks:empress')
    game.startLevel(huntLevel('ossuary'), 'casual', 'aldric', 'campaign', { seed: 71, hunt: 'ossuary' })
    for (const kind of ['arrow', 'mage', 'cannon', 'barracks'] as const) {
      const range = towerTrees[kind].branches[0].range
      const plots = game.terrain!.plots.filter(p => !p.occupied)
      const coverage = (plot: typeof plots[number]) => {
        let length = 0
        for (let d = 0; d < game.lanes[0].length; d += 0.5) {
          const at = game.lanes[0].sample(d)
          if (Math.hypot(plot.pos.x - at.x, plot.pos.z - at.z) < range) length++
        }
        return length
      }
      plots.sort((a, b) => coverage(b) - coverage(a))
      game.buildTower(kind, plots[0])
      const tower = game.towers.at(-1)!
      for (let tier = 1; tier < (kind === 'cannon' ? 4 : 5); tier++) game.upgradeTower(tower, 0)
    }
    const legion = game.towers.find(t => t.kind === 'barracks')!
    expect(legion.level).toBe(5)
    for (let tick = 0; tick < 90000 && game.phase === 'playing' && legion.level < 6; tick++) {
      if (tick % 60 === 0) {
        const foes = game.enemies.filter(e => e.targetable)
        if (!foes.length && game.waves!.phase === 'countdown') game.callWave()
        if (foes.length >= 4 && game.abilities.meteor.cooldown <= 0) issue(game, { kind: 'meteor', x: foes[0].pos.x, z: foes[0].pos.z })
        if (foes.length && game.abilities.reinforce.cooldown <= 0) issue(game, { kind: 'reinforce', x: foes[0].pos.x, z: foes[0].pos.z })
        game.castHeroSignature()
        if (game.gold >= legion.upgradeOptions[0].cost) game.upgradeTower(legion, 0)
      }
      ticks(game, 1)
    }
    expect(game.phase).toBe('playing')
    expect(legion.level).toBe(6)
    game.activateMythic(legion)
    ticks(game, 45)
    const detail = () => {
      const tower = game.towers.find(t => t.kind === 'barracks')!
      return { combat: snapshot(game), signature: tower.signatureReadout(game.time),
        markers: game.dynamic.children.filter(o => o.renderOrder === 4).map(o => ({ pos: o.position.toArray() })) }
    }
    const before = detail()
    expect(before.signature?.text).toBe('Legion formation active')
    expect(before.markers).toHaveLength(1)
    expect(game.saveSession()).toBe(true)
    const session = readSession()!
    expect(session.commands.some(e => e.cmd.kind === 'mythic')).toBe(true)
    ticks(game, 420)
    const future = detail()
    expect(future.signature?.text).toContain('Legion Standard in')
    expect(future.markers).toHaveLength(0)
    expect(await game.resumeSession(session)).toBe(true)
    expect(detail()).toEqual(before)
    ticks(game, 420)
    expect(detail()).toEqual(future)
    game.disposeLevel()
  }, 20000)

  it('normalizes an unknown imported hero before selecting specialization and journaling', () => {
    const game = makeGame()
    game.save.lastHero = 'unknownhero'
    expect(() => game.startLevel(levels[0], 'normal', game.save.lastHero as 'aldric')).not.toThrow()
    expect(game.hero?.heroDef.id).toBe('aldric')
    expect(readSession()?.heroId).toBe('aldric')
    game.disposeLevel()
  })
})
