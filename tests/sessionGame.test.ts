import historicalBattle from './fixtures/seraph-v9-battle.json'
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
import { OVERCHARGE_SHARD_COST } from '../src/game/types.ts'
import type { CoopEvent, CoopSession, CoopSetup } from '../src/core/coop.ts'
import { xpForLevel } from '../src/game/progress.ts'
import { RULESET_VERSION } from '../src/game/ruleset.ts'

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
  sessionStateHash(ruleset?: number): number
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

function room(events: CoopEvent[] = [], paused = false) {
  const listeners = new Set<(event: CoopEvent) => void>()
  const fake = {
    code: 'TEST2', seat: 1, seats: 2, connected: [0, 1], speed: 1, paused, ticksPerTurn: 12,
    replayEvents: events,
    on: (listener: (event: CoopEvent) => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    connect: vi.fn(), close: vi.fn(() => listeners.clear()), forget: vi.fn(), send: vi.fn(async () => true),
  }
  return { session: fake as unknown as CoopSession, fake, emit: (event: CoopEvent) => { for (const listener of listeners) listener(event) } }
}
function setupFor(battle: BattleSession): CoopSetup {
  return { levelId: battle.levelId, difficulty: battle.difficulty, hero: battle.heroId, mode: battle.mode,
    seed: battle.seed, battle, loadout: { xp: battle.initialSave.xp, armory: battle.initialSave.armory,
      honors: battle.initialSave.honors, heroPaths: battle.initialSave.heroPaths } }
}

describe('actual Game session recovery', () => {
  it('verifies a ruleset-eight battle against its original hash and upgrades the next saved journal', async () => {
    const game = makeGame()
    game.startLevel(levels[0], 'normal', 'aldric', 'campaign', { seed: 871 })
    game.buildTower('arrow', game.terrain!.plots[0]); game.callWave(); ticks(game, 480)
    const original = game.exportBattleSession()!
    const old: BattleSession = { ...original, ruleset: 8, stateHash: (game as unknown as Internals).sessionStateHash(8) }
    expect(old.stateHash).not.toBe(original.stateHash)
    const before = snapshot(game), account = JSON.stringify(game.save)
    expect(await game.resumeSession(old)).toBe(true)
    expect({ ...snapshot(game), hash: before.hash }).toEqual(before)
    expect((game as unknown as Internals).sessionStateHash(8)).toBe(old.stateHash)
    expect(JSON.stringify(game.save)).toBe(account)
    expect(game.saveSession()).toBe(true)
    expect(readSession()?.ruleset).toBe(RULESET_VERSION)
    expect(readSession()?.combatRuleset).toBe(8)
    expect(readSession()?.stateHash).toBe(snapshot(game).hash)
    game.disposeLevel()
  })

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

  it('adopts a solo journal, replays shared hero/build orders, and continues solo with the same future and frozen host loadout', async () => {
    const host = makeGame()
    host.startLevel(levels[0], 'normal', 'aldric', 'campaign', { seed: 4455 })
    host.buildTower('arrow', host.terrain!.plots[0]); host.callWave(); ticks(host, 600)
    const adopted = host.exportBattleSession()!
    const post = host.lanes[0].sample(host.lanes[0].length * 0.4)
    const move: CoopCommand = { kind: 'heroMove', x: post.x, z: post.z }
    const charge: CoopCommand = { kind: 'overchargeAll' }
    issue(host, move); ticks(host, 12)
    issue(host, charge); ticks(host, 12)
    const shared = snapshot(host)
    ticks(host, 120)
    const future = snapshot(host)
    host.disposeLevel()

    const guest = makeGame()
    guest.save.xp = 0; guest.save.armory = {}; guest.save.honors = []; guest.save.heroPaths = {}
    const account = JSON.stringify(guest.save)
    const connected = room([
      { type: 'cmd', seat: 0, turn: 1, cmd: move }, { type: 'turn', n: 1, ticks: 12 },
      { type: 'cmd', seat: 1, turn: 2, cmd: charge }, { type: 'turn', n: 2, ticks: 12 },
    ])
    const setup = setupFor(adopted)
    // A menu/cloud change after the adopted battle began cannot rewrite it.
    setup.loadout = { xp: 99999, armory: { coffers: 4 }, honors: [], heroPaths: { aldric: 'vanguard' } }
    expect(await guest.joinCoopBattle(connected.session, setup)).toBe(true)
    expect(snapshot(guest)).toEqual(shared)
    expect(guest.hero!.specialization).toBe('bulwark')
    expect(guest.roster.armory).toEqual(adopted.initialSave.armory)
    expect(JSON.stringify(guest.save)).toBe(account)
    expect(guest.canSaveSession).toBe(false)
    expect(guest.continueSolo()).toBe(true)
    expect(connected.fake.forget).toHaveBeenCalledTimes(1)
    expect(connected.fake.close).toHaveBeenCalledTimes(1)
    expect(guest.coop).toBeNull()
    expect(guest.canSaveSession).toBe(true)
    expect(snapshot(guest)).toEqual(shared)
    expect(guest.save.xp).toBe(guest.liveXpEarned)
    expect(guest.save.armory).toEqual(JSON.parse(account).armory)
    expect(guest.save.honors).toEqual(JSON.parse(account).honors)
    const soloJournal = readSession()!
    expect(soloJournal.commands.filter(e => e.cmd.kind === 'heroMove')).toHaveLength(1)
    expect(soloJournal.commands.filter(e => e.cmd.kind === 'overchargeAll')).toHaveLength(1)
    guest.paused = false; ticks(guest, 120)
    expect(snapshot(guest)).toEqual(future)
    expect(await guest.resumeSession(soloJournal)).toBe(true)
    expect(snapshot(guest)).toEqual(shared)
    guest.paused = false; ticks(guest, 120)
    expect(snapshot(guest)).toEqual(future)
    expect(guest.save.xp).toBe(guest.liveXpEarned)
    expect(guest.save.armory).toEqual(JSON.parse(account).armory)
    expect(guest.save.honors).toEqual(JSON.parse(account).honors)
    guest.disposeLevel()
  })

  it('does not turn a command ignored during a paused co-op turn into a live command on solo recovery', async () => {
    const game = makeGame()
    game.startLevel(levels[0], 'normal', 'aldric', 'campaign', { seed: 4455 })
    game.buildTower('arrow', game.terrain!.plots[0])
    const adopted = game.exportBattleSession()!
    const connected = room([
      { type: 'cmd', seat: 0, turn: 1, cmd: { kind: 'overchargeAll' } },
      { type: 'pause', seat: 0, on: true }, { type: 'turn', n: 1, ticks: 0 },
    ], true)
    expect(await game.joinCoopBattle(connected.session, setupFor(adopted))).toBe(true)
    expect(game.shards).toBe(8)
    expect(game.towers[0].isOvercharged(game)).toBe(false)
    const before = snapshot(game)
    expect(game.continueSolo()).toBe(true)
    expect(await game.resumeSession(readSession()!)).toBe(true)
    expect(snapshot(game)).toEqual(before)
    game.disposeLevel()
  })

  it('replays a fresh room from the host loadout and then consumes live room turns exactly once', async () => {
    const reference = makeGame()
    const loadout = JSON.parse(JSON.stringify(reference.save))
    reference.startLevel(levels[0], 'normal', 'aldric', 'campaign', { seed: 2233 })
    const plot = reference.terrain!.plots[0].index
    reference.buildTower('arrow', reference.terrain!.plots[0]); reference.callWave(); ticks(reference, 12)
    const post = reference.lanes[0].sample(reference.lanes[0].length * 0.45)
    const move: CoopCommand = { kind: 'heroMove', x: post.x, z: post.z }
    issue(reference, move); ticks(reference, 12)
    const caughtUp = snapshot(reference)
    reference.cycleTargetPolicy(reference.towers[0]); ticks(reference, 24)
    const live = snapshot(reference)
    reference.disposeLevel()

    const guest = makeGame()
    guest.save.xp = 0; guest.save.armory = {}; guest.save.heroPaths = {}; guest.save.honors = []
    const connected = room([
      { type: 'cmd', seat: 0, turn: 1, cmd: { kind: 'build', plot, tower: 'arrow' } },
      { type: 'cmd', seat: 1, turn: 1, cmd: { kind: 'wave' } }, { type: 'turn', n: 1, ticks: 12 },
      { type: 'cmd', seat: 0, turn: 2, cmd: move }, { type: 'turn', n: 2, ticks: 12 },
    ])
    expect(await guest.joinCoopBattle(connected.session, { levelId: levels[0].id, difficulty: 'normal', hero: 'aldric', seed: 2233, loadout })).toBe(true)
    expect(snapshot(guest)).toEqual(caughtUp)
    expect(guest.save.xp).toBe(0)
    expect(guest.save.honors).toEqual([])
    expect(guest.exportBattleSession()?.initialSave.armory).toEqual(loadout.armory)
    connected.emit({ type: 'cmd', seat: 0, turn: 3, cmd: { kind: 'policy', plot } })
    connected.emit({ type: 'turn', n: 3, ticks: 12 })
    connected.emit({ type: 'turn', n: 4, ticks: 12 })
    const clock = guest as unknown as { coopAdvance(dt: number, h: number): void }
    for (let frame = 0; frame < 24; frame++) clock.coopAdvance(1 / 60, 1 / 60)
    expect(snapshot(guest)).toEqual(live)
    expect(guest.exportBattleSession()?.commands.filter(e => e.cmd.kind === 'policy')).toHaveLength(1)
    expect(guest.continueSolo()).toBe(true)
    expect(await guest.resumeSession(readSession()!)).toBe(true)
    expect(snapshot(guest)).toEqual(live)
    guest.disposeLevel()
  })

  it('drains an authorized turn after pause before allowing a portable solo snapshot', async () => {
    const game = makeGame()
    game.startLevel(levels[0], 'normal', 'aldric', 'campaign', { seed: 2233 })
    const base = game.exportBattleSession()!
    game.buildTower('arrow', game.terrain!.plots[0]); ticks(game, 12)
    const expected = snapshot(game)
    const connected = room()
    expect(await game.joinCoopBattle(connected.session, setupFor(base))).toBe(true)
    connected.emit({ type: 'cmd', seat: 0, turn: 1, cmd: { kind: 'build', plot: 0, tower: 'arrow' } })
    connected.emit({ type: 'turn', n: 1, ticks: 12 })
    connected.emit({ type: 'pause', seat: 0, on: true })
    expect(game.canSwitchCoop).toBe(false)
    const clock = game as unknown as { coopAdvance(dt: number, h: number): void }
    for (let frame = 0; frame < 12; frame++) clock.coopAdvance(1 / 60, 1 / 60)
    expect(game.paused).toBe(true)
    expect(game.canSwitchCoop).toBe(true)
    expect(snapshot(game)).toEqual(expected)
    expect(game.continueSolo()).toBe(true)
    expect(await game.resumeSession(readSession()!)).toBe(true)
    expect(snapshot(game)).toEqual(expected)
    game.disposeLevel()
  })

  it('opens local pause settings when a room pause request fails, while successful requests wait for the room', async () => {
    const game = makeGame()
    game.startLevel(levels[0], 'normal', 'aldric', 'campaign', { seed: 551 })
    const connected = room()
    expect(await game.joinCoopBattle(connected.session, setupFor(game.exportBattleSession()!))).toBe(true)
    const setPaused = vi.fn(), showToast = vi.fn()
    game.hud = new Proxy(game.hud, { get: (target, key) => key === 'setPaused' ? setPaused
      : key === 'showToast' ? showToast : Reflect.get(target, key) })
    game.togglePause()
    await Promise.resolve()
    expect(connected.fake.send).toHaveBeenLastCalledWith('pause', true)
    expect(game.paused).toBe(false)
    expect(setPaused).not.toHaveBeenCalled()
    connected.fake.send.mockResolvedValueOnce(false)
    game.togglePause()
    await Promise.resolve()
    expect(game.paused).toBe(true)
    expect(setPaused).toHaveBeenLastCalledWith(true)
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Room unreachable'), 5)
    expect(game.coop).toBe(connected.session)
    expect(game.canSwitchCoop).toBe(true)
    game.disposeLevel()
  })

  it('ignores an old failed pause request after leaving that room', async () => {
    const game = makeGame()
    game.startLevel(levels[0], 'normal', 'aldric', 'campaign', { seed: 551 })
    const connected = room()
    expect(await game.joinCoopBattle(connected.session, setupFor(game.exportBattleSession()!))).toBe(true)
    let complete!: (sent: boolean) => void
    connected.fake.send.mockImplementationOnce(() => new Promise<boolean>(resolve => { complete = resolve }))
    game.togglePause()
    game.leaveCoop()
    game.paused = false
    complete(false)
    await Promise.resolve()
    expect(game.paused).toBe(false)
    expect(game.coop).toBeNull()
    game.disposeLevel()
  })

  it('restores authoritative pause and speed from a reconnect hello after a local network-failure pause', async () => {
    const game = makeGame()
    game.startLevel(levels[0], 'normal', 'aldric', 'campaign', { seed: 551 })
    const connected = room()
    const setup = setupFor(game.exportBattleSession()!)
    expect(await game.joinCoopBattle(connected.session, setup)).toBe(true)
    const setPaused = vi.fn(), setSpeed = vi.fn()
    game.hud = new Proxy(game.hud, { get: (target, key) => key === 'setPaused' ? setPaused
      : key === 'setSpeed' ? setSpeed : Reflect.get(target, key) })
    connected.fake.send.mockResolvedValueOnce(false)
    game.togglePause(); await Promise.resolve()
    expect(game.paused).toBe(true)
    const hello: CoopEvent = { type: 'hello', seat: 1, setup, started: true, turn: 5,
      speed: 2, paused: false, seats: 2, connected: [0, 1] }
    connected.emit(hello)
    expect(game.paused).toBe(false)
    expect(game.speed).toBe(2)
    expect(setPaused).toHaveBeenLastCalledWith(false)
    expect(setSpeed).toHaveBeenLastCalledWith(2)
    connected.emit({ ...hello, paused: true, speed: 1 })
    expect(game.paused).toBe(true)
    expect(game.speed).toBe(1)
    expect(setPaused).toHaveBeenLastCalledWith(true)
    expect(setSpeed).toHaveBeenLastCalledWith(1)
    game.disposeLevel()
  })

  it('applies identical ordered commands on fast and backlogged peers despite newer pause and hello events', async () => {
    const run = async (backlogged: boolean, reconnectHello: boolean) => {
      const game = makeGame()
      game.startLevel(levels[0], 'normal', 'aldric', 'campaign', { seed: 718 })
      const setup = setupFor(game.exportBattleSession()!)
      const connected = room()
      expect(await game.joinCoopBattle(connected.session, setup)).toBe(true)
      const clock = game as unknown as { coopAdvance(dt: number, h: number): void }
      const advance = (frames: number) => { for (let frame = 0; frame < frames; frame++) clock.coopAdvance(1 / 60, 1 / 60) }
      const events: CoopEvent[] = [
        { type: 'cmd', seat: 0, turn: 1, cmd: { kind: 'build', tower: 'arrow', plot: 0 } },
        { type: 'cmd', seat: 1, turn: 1, cmd: { kind: 'wave' } },
        { type: 'turn', n: 1, ticks: 12 },
        { type: 'cmd', seat: 0, turn: 2, cmd: { kind: 'policy', plot: 0 } },
        { type: 'turn', n: 2, ticks: 12 },
      ]
      if (reconnectHello) connected.emit({ type: 'hello', seat: 1, setup, started: true, turn: 5,
        paused: true, speed: 1, seats: 2, connected: [0, 1] })
      for (const event of events) connected.emit(event)
      advance(backlogged ? 5 : 24) // the slow peer still owes seven ticks of turn one
      connected.emit({ type: 'pause', seat: 0, on: true })
      connected.emit({ type: 'cmd', seat: 1, turn: 3, cmd: { kind: 'upgrade', plot: 0, opt: 0 } })
      connected.emit({ type: 'turn', n: 3, ticks: 0 })
      if (!backlogged) advance(1)
      connected.emit({ type: 'pause', seat: 0, on: false })
      connected.emit({ type: 'cmd', seat: 1, turn: 4, cmd: { kind: 'overchargeAll' } })
      connected.emit({ type: 'turn', n: 4, ticks: 12 })
      connected.emit({ type: 'pause', seat: 0, on: true })
      connected.emit({ type: 'turn', n: 5, ticks: 0 })
      advance(backlogged ? 31 : 12)
      expect(game.towers[0].level).toBe(1)
      expect(game.towers[0].targetPolicy).toBe('last')
      expect(game.towers[0].isOvercharged(game)).toBe(true)
      expect(game.paused).toBe(true)
      expect(game.canSwitchCoop).toBe(true)
      const result = { state: snapshot(game), commands: game.exportBattleSession()!.commands }
      expect(result.commands.some(e => e.cmd.kind === 'upgrade')).toBe(false)
      game.disposeLevel()
      return result
    }
    const fast = await run(false, false)
    expect(await run(true, false)).toEqual(fast)
    expect(await run(true, true)).toEqual(fast)
  })

  it('preserves room-authorized ticks when a queued Hold the Line command leaves the victory screen', async () => {
    const run = async (backlogged: boolean) => {
      const game = makeGame()
      game.startLevel(levels[0], 'normal', 'aldric', 'campaign', { seed: 551 })
      const connected = room()
      expect(await game.joinCoopBattle(connected.session, setupFor(game.exportBattleSession()!))).toBe(true)
      // Focus on the phase transition; the campaign-victory test above covers
      // reaching this state through actual combat and recovering its journal.
      game.phase = 'victory'
      const clock = game as unknown as { coopAdvance(dt: number, h: number): void }
      connected.emit({ type: 'cmd', seat: 0, turn: 1, cmd: { kind: 'hold' } })
      connected.emit({ type: 'turn', n: 1, ticks: 12 })
      if (!backlogged) clock.coopAdvance(1 / 60, 1 / 60)
      connected.emit({ type: 'turn', n: 2, ticks: 12 })
      connected.emit({ type: 'pause', seat: 0, on: true })
      for (let frame = 0; frame < 24; frame++) clock.coopAdvance(1 / 60, 1 / 60)
      expect(game.isFreeplay).toBe(true)
      expect(game.time).toBeCloseTo(24 / 60)
      const state = snapshot(game)
      game.disposeLevel()
      return state
    }
    expect(await run(true)).toEqual(await run(false))
  })

  it('applies simultaneous allied spells once and preserves that cooldown decision in the solo journal', async () => {
    const game = makeGame()
    game.startLevel(levels[0], 'normal', 'aldric', 'campaign', { seed: 551 })
    const base = game.exportBattleSession()!
    const at = game.lanes[0].sample(game.lanes[0].length / 2)
    const spells: CoopCommand[] = [{ kind: 'meteor', x: at.x, z: at.z }, { kind: 'reinforce', x: at.x, z: at.z }]
    for (const spell of spells) issue(game, spell)
    ticks(game, 12)
    const expected = snapshot(game)
    const connected = room([
      ...spells.flatMap(cmd => [{ type: 'cmd' as const, seat: 0, turn: 1, cmd }, { type: 'cmd' as const, seat: 1, turn: 1, cmd }]),
      { type: 'turn', n: 1, ticks: 12 },
    ])
    expect(await game.joinCoopBattle(connected.session, setupFor(base))).toBe(true)
    expect(snapshot(game)).toEqual(expected)
    const journal = game.exportBattleSession()!
    expect(journal.commands.filter(e => e.cmd.kind === 'meteor')).toHaveLength(1)
    expect(journal.commands.filter(e => e.cmd.kind === 'reinforce')).toHaveLength(1)
    expect(game.continueSolo()).toBe(true)
    expect(await game.resumeSession(readSession()!)).toBe(true)
    expect(snapshot(game)).toEqual(expected)
    game.disposeLevel()
  })

  it('counts resolved endless waves once and journals one spend on a real new foundation', () => {
    const game = makeGame()
    game.startLevel(levels[0], 'normal', 'aldric', 'endless', { seed: 991 })
    // Exercise actual wave accounting without a long balance simulation: each
    // fixture wave is fully spawned and has one remaining live enemy.
    for (let wave = 0; wave < 15; wave++) {
      game.spawnEnemyAt('husk', 0, 0, { waveTag: wave })
      const enemy = game.enemies.at(-1)!
      expect(game.completedEndlessWaves).toBe(wave)
      expect(game.expansionCredits).toBe(0)
      enemy.takeDamage(enemy.hp + 1, 'true', game)
      enemy.takeDamage(1, 'true', game)
      expect(game.completedEndlessWaves).toBe(wave + 1)
    }
    expect(game.expansionCredits).toBe(1)
    const terrain = game.terrain!
    const cells = Array.from({ length: levels[0].height }, (_, r) =>
      Array.from({ length: levels[0].width }, (_, c) => [c, r] as const)).flat()
    const cell = cells.find(([c, r]) => terrain.canAddExpansionPlot(c, r))!
    const before = terrain.plots.length
    game.expandPlot(-1, -1)
    expect(game.expansionCredits).toBe(1)
    game.expandPlot(...cell)
    expect(terrain.plots).toHaveLength(before + 1)
    expect(terrain.plots.at(-1)).toMatchObject({ index: before, expanded: true, cell: [...cell] })
    expect(game.expansionCredits).toBe(0)
    game.expandPlot(...cell)
    expect(terrain.plots).toHaveLength(before + 1)
    expect(game.exportBattleSession()?.commands.filter(e => e.cmd.kind === 'expand' && e.cmd.c === cell[0] && e.cmd.r === cell[1])).toHaveLength(1)
    game.buildTower('arrow', terrain.plots.at(-1)!)
    expect(game.towers.at(-1)?.plot.index).toBe(before)
    game.disposeLevel()
  })

  it('never funds expansion from campaign or hunt clears, including campaign waves resolved during freeplay', () => {
    const game = makeGame()
    for (const hunt of [false, true]) {
      game.startLevel(hunt ? huntLevel('ossuary') : levels[0], 'normal', 'aldric', 'campaign', { seed: 991, hunt: hunt ? 'ossuary' : undefined })
      game.spawnEnemyAt('husk', 0, 0, { waveTag: 0 })
      game.enemies.at(-1)!.takeDamage(100000, 'true', game)
      expect(game.completedEndlessWaves).toBe(0)
      // A late-resolving authored wave is still not an endless clear.
      game.isFreeplay = true
      game.spawnEnemyAt('husk', 0, 0, { waveTag: 1 })
      game.enemies.at(-1)!.takeDamage(100000, 'true', game)
      expect(game.completedEndlessWaves).toBe(0)
      expect(game.expansionCredits).toBe(0)
      game.completedEndlessWaves = 15
      game.isFreeplay = false
      expect(game.expansionCredits).toBe(0)
      game.disposeLevel()
    }
  })

  it('charges the whole eligible battery atomically and skips support, cooldown and already-charged towers', () => {
    const game = makeGame()
    game.startLevel(huntLevel('ossuary'), 'normal', 'aldric', 'campaign', { seed: 1, hunt: 'ossuary' })
    for (const kind of ['arrow', 'mage', 'cannon', 'ballista', 'barracks', 'beacon'] as const) game.buildTower(kind, game.terrain!.plots[game.towers.length])
    const [charged, cooling, freshA, freshB, barracks, beacon] = game.towers
    // Crownfire can leave an active overcharge with no paid cooldown.
    charged.kindle(game)
    game.overchargeTower(cooling)
    ticks(game, 13 * 60)
    charged.kindle(game)
    expect(cooling.isOvercharged(game)).toBe(false)
    expect(cooling.canOvercharge(game)).toBe(false)
    expect(game.overchargeAllCost).toBe(OVERCHARGE_SHARD_COST * 2)
    game.shards = game.overchargeAllCost - 1
    const poor = game.shards
    game.overchargeAll()
    expect(game.shards).toBe(poor)
    expect(freshA.isOvercharged(game)).toBe(false)
    expect(freshB.isOvercharged(game)).toBe(false)
    game.shards = game.overchargeAllCost
    game.overchargeAll()
    expect(game.shards).toBe(0)
    expect(freshA.isOvercharged(game)).toBe(true)
    expect(freshB.isOvercharged(game)).toBe(true)
    expect(barracks.isOvercharged(game)).toBe(false)
    expect(beacon.isOvercharged(game)).toBe(false)
    expect(cooling.isOvercharged(game)).toBe(false)
    expect(game.overchargeAllCost).toBe(0)
    game.disposeLevel()
  })
})


describe('sandbox and live arsenal progression', () => {
  it('replays free Mythics and queued sandbox spawns without paying account rewards', async () => {
    const game = makeGame()
    game.save.xp = 0
    const account = JSON.stringify(game.save)
    game.startLevel(levels[0], 'normal', 'aldric', 'sandbox', { seed: 731 })
    game.buildTower('seraph', game.terrain!.plots[0])
    for (let i = 0; i < 5; i++) game.upgradeTower(game.towers[0], 0)
    game.buildTower('ballista', game.terrain!.plots[1])
    for (let i = 0; i < 5; i++) game.upgradeTower(game.towers[1], i === 2 ? 1 : 0)
    expect(game.towers.map(t => t.level)).toEqual([6, 6])
    game.sandboxOrder({ kind: 'sandboxSpawn', enemy: 'brute', count: 25, lane: 0, hp: 100 })
    ticks(game, 30)
    expect(game.enemies.length).toBeGreaterThan(0)
    const before = snapshot(game)
    expect(game.saveSession()).toBe(true)
    const session = readSession()!
    expect(session.mode).toBe('sandbox')
    ticks(game, 120)
    const future = snapshot(game)
    expect(await game.resumeSession(session)).toBe(true)
    expect(snapshot(game)).toEqual(before)
    ticks(game, 120)
    expect(snapshot(game)).toEqual(future)
    game.paused = false
    game.sandboxOrder({ kind: 'sandboxClear' })
    ticks(game, 240)
    expect(game.enemies).toHaveLength(0)
    expect(game.lives).toBe(20)
    expect(game.liveXpEarned).toBe(0)
    expect(JSON.stringify(game.save)).toBe(account)
    game.disposeLevel()
  })

  it('ignores sandbox commands in campaign and bounds queued enemies in sandbox', () => {
    const game = makeGame()
    const send = () => game.sandboxOrder({ kind: 'sandboxSpawn', enemy: 'husk', count: 25, lane: 0, hp: 1 })
    game.startLevel(levels[0], 'normal', 'aldric', 'campaign', { seed: 732 })
    send()
    ticks(game, 30)
    expect(game.enemies).toHaveLength(0)
    game.startLevel(levels[0], 'normal', 'aldric', 'sandbox', { seed: 733 })
    for (let i = 0; i < 9; i++) send()
    expect((game as unknown as { sandboxQueue: { count: number }[] }).sandboxQueue.reduce((n, g) => n + g.count, 0)).toBe(200)
    game.sandboxOrder({ kind: 'sandboxClear' })
    ticks(game, 60)
    expect(game.enemies).toHaveLength(0)
    expect(game.phase).toBe('playing')
    game.disposeLevel()
  })

  it('unlocks Ballista on the kill that crosses level 15 and preserves the purchase after reload', async () => {
    const game = makeGame()
    game.save.xp = xpForLevel(15) - 1
    game.startLevel(levels[0], 'normal', 'aldric', 'campaign', { seed: 734 })
    expect(game.towerUnlocked('ballista')).toBe(false)
    game.buildTower('arrow', game.terrain!.plots[0])
    game.callWave()
    for (let i = 0; i < 3600 && !game.towerUnlocked('ballista'); i++) ticks(game, 1)
    expect(game.towerUnlocked('ballista')).toBe(true)
    expect(game.save.xp).toBe(xpForLevel(15) - 1)
    game.buildTower('ballista', game.terrain!.plots[1])
    expect(game.towers.map(t => t.kind)).toContain('ballista')
    const before = snapshot(game)
    game.saveSession()
    expect(await game.resumeSession(readSession()!)).toBe(true)
    expect(snapshot(game)).toEqual(before)
    expect(game.towerUnlocked('ballista')).toBe(true)
    game.disposeLevel()
  })
})


it('shares a late guest’s earned Mythics through paused room orders and retains them in solo recovery', async () => {
  const host = makeGame(), guest = makeGame()
  host.save.xp = 5000; guest.save.xp = 20000
  host.save.honors = []
  guest.save.honors = ['mastery:seraph:ossuary', 'mastery:seraph:empress']
  const setup: CoopSetup = { levelId: 'greenhollow', difficulty: 'normal', hero: 'aldric', seed: 881,
    mode: 'campaign', loadout: { xp: host.save.xp, armory: {}, honors: [], heroPaths: {} } }
  const a = room([], true), b = room([], true)
  await host.joinCoopBattle(a.session, setup)
  await guest.joinCoopBattle(b.session, setup)
  expect(host.xpPreview()).toBe(5000)
  expect(guest.xpPreview()).toBe(20000)
  expect(host.towerXp).toBe(guest.towerXp)
  expect(b.fake.send).toHaveBeenCalledWith('cmd', { kind: 'shareMastery', families: ['seraph'] })
  expect(a.fake.send).not.toHaveBeenCalledWith('cmd', expect.objectContaining({ kind: 'shareMastery' }))
  const account = JSON.stringify(host.save)
  const tower = { level: 5, kind: 'seraph' } as import('../src/game/towers.ts').Tower
  expect(host.mythicLock(tower)).not.toBeNull()
  for (const game of [host, guest]) {
    ;(game as unknown as Internals).applyCoopCommand({ kind: 'shareMastery', families: ['seraph'] }, 1)
    expect(game.mythicLock(tower)).toBeNull()
    expect(game.hasSharedMythic('barracks')).toBe(false)
  }
  expect(host.exportBattleSession()!.stateHash).toBe(guest.exportBattleSession()!.stateHash)
  expect(host.continueSolo()).toBe(true)
  const session = readSession()!
  expect(await host.resumeSession(session)).toBe(true)
  expect(host.mythicLock(tower)).toBeNull()
  expect(JSON.stringify(host.save)).toBe(account)
  host.startLevel(levels[0], 'normal', 'aldric', 'campaign', { seed: 882 })
  expect(host.mythicLock(tower)).not.toBeNull() // sharing does not grant permanent account honors
  host.disposeLevel(); guest.disposeLevel()
})


it('restores an actual ruleset-nine Seraph hunt and preserves its old combat on repeated saves', async () => {
  const game = makeGame()
  const old = historicalBattle as BattleSession
  expect(await game.resumeSession(old)).toBe(true)
  expect(game.legacyCombat).toBe(true)
  expect((game as unknown as Internals).sessionStateHash(9)).toBe(old.stateHash)
  expect(game.towers[0].level).toBe(5)
  expect(game.towers[0].def.damage).toEqual([60, 90])
  expect(game.towers[0].def.beamTargets).toBe(7)
  ticks(game, 90)
  expect(game.saveSession()).toBe(true)
  const migrated = readSession()!
  expect(migrated.ruleset).toBe(RULESET_VERSION)
  expect(migrated.combatRuleset).toBe(9)
  const before = snapshot(game)
  expect(await game.resumeSession(migrated)).toBe(true)
  expect(snapshot(game)).toEqual(before)
  game.disposeLevel()
})

it('banks in-progress XP once and restores the same account level after repeated reloads', async () => {
  const game = makeGame()
  game.save.xp = xpForLevel(18) - 2
  const initial = game.save.xp
  game.startLevel(levels[0], 'normal', 'aldric', 'campaign', { seed: 911 })
  game.buildTower('arrow', game.terrain!.plots[0]); game.callWave()
  for (let i = 0; i < 3600 && game.liveXpEarned < 3; i++) ticks(game, 1)
  expect(game.liveXpEarned).toBeGreaterThanOrEqual(3)
  const preview = game.xpPreview()
  expect(game.saveSession()).toBe(true)
  expect(game.save.xp).toBe(preview)
  expect(game.save.xp).toBeGreaterThan(initial)
  const saved = readSession()!
  expect(await game.resumeSession(saved)).toBe(true)
  expect(game.xpPreview()).toBe(preview)
  expect(game.saveSession()).toBe(true)
  expect(game.save.xp).toBe(preview)
  expect(await game.resumeSession(readSession()!)).toBe(true)
  expect(game.xpPreview()).toBe(preview)
  game.disposeLevel()
})
