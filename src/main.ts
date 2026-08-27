import { requestDurableStorage, writeSave } from './core/save.ts'
import { cloud } from './core/cloud.ts'
import { readCheckpoint } from './game/checkpoint.ts'
import { telemetry } from './core/telemetry.ts'
import { acquisitionSource, isEmbedded } from './core/platform.ts'
import { dailySeed, dailyNumber, newRunSeed } from './game/ruleset.ts'
import { dailyLevel } from './game/levels.ts'
import { readChallengeSeed } from './game/share.ts'
import { canRecordTape, downloadTape, tapeFileExtension } from './core/capture.ts'
import { Game } from './game/game.ts'
import { HUD } from './ui/hud.ts'
import { Screens, isIPadOS, needsInstallGuide } from './ui/screens.ts'
import { levelById } from './game/levels.ts'
import { audio } from './core/audio.ts'
import './style.css'

const canvas = document.getElementById('game') as HTMLCanvasElement
const game = new Game(canvas)
const hud = new HUD(game)
const screens = new Screens(() => game.save)

// ---- fullscreen (Android/desktop have the API; iOS Safari relies on Add to Home Screen) ----

const fullscreenSupported = (): boolean => {
  const d = document as Document & { webkitFullscreenEnabled?: boolean }
  return !!(d.fullscreenEnabled || d.webkitFullscreenEnabled)
}

function enterFullscreen(): void {
  if (document.fullscreenElement) return
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }
  const req = el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen?.bind(el)
  req?.()?.then(() => {
    // landscape lock only works while fullscreen; best-effort
    const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
    orientation?.lock?.('landscape').catch(() => { /* not supported everywhere */ })
  }).catch(() => { /* platform or user declined */ })
}

function toggleFullscreen(): void {
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => { /* already out */ })
  else enterFullscreen()
}

hud.onFullscreen = toggleFullscreen

const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches

screens.onPlayLevel = (id, difficulty, hero, mode) => {
  hud.reset()
  hud.setChrome(true)
  screens.show('none')
  // still inside the user's tap gesture: phones go fullscreen as battle starts.
  // iPadOS is skipped on purpose — its Safari fullscreen bans keyboard focus
  // ("typing isn't allowed") and exits on a swipe; the installed app doesn't.
  if (isTouchDevice()) {
    if (fullscreenSupported() && !isIPadOS()) {
      enterFullscreen()
    } else if (needsInstallGuide() && !localStorage.getItem('blockhold.a2hs-hint')) {
      localStorage.setItem('blockhold.a2hs-hint', '1')
      setTimeout(() => hud.showToast('Tip: "Play fullscreen" on the main menu shows how to install Blockhold as a real fullscreen app', 8), 1500)
    }
  }
  // end-screen replays reuse the difficulty/hero/mode of the run that just ended
  game.startLevel(
    levelById(id),
    difficulty ?? game.difficulty,
    hero ?? (game.save.lastHero as never) ?? 'aldric',
    mode ?? (game.isEndless ? 'endless' : 'campaign'),
  )
}
// a challenge link drops the visitor straight onto the sender's exact board
const challengeSeed = readChallengeSeed()

screens.onPlayDaily = () => {
  const seed = challengeSeed ?? dailySeed()
  hud.reset()
  hud.setChrome(true)
  screens.show('none')
  screens.dailySeedForShare = seed
  game.startLevel(dailyLevel(seed), 'normal', (game.save.lastHero as never) ?? 'aldric', 'campaign',
    { seed, daily: dailyNumber() })
}
screens.onShared = (kind) => telemetry.track({ type: 'share_copied', kind })
screens.onRestore = (restored) => {
  Object.assign(game.save, restored)
  writeSave(game.save)
  game.showMenuBackdrop()
  screens.show('menu')
  hud.showToast('Progress restored', 3)
}

screens.canRecordTape = () => canRecordTape()
screens.onRecordTape = async () => {
  const blob = await game.recordSiegeTape()
  if (!blob) return false
  const stamp = game.level?.id ?? 'blockhold'
  downloadTape(blob, `blockhold-${stamp}.${tapeFileExtension(blob.type)}`)
  telemetry.track({ type: 'share_copied', kind: 'siege_tape' })
  return true
}
screens.onPlayBellfoundry = () => {
  const seed = newRunSeed()
  hud.reset()
  hud.setChrome(true)
  screens.show('none')
  game.startLevel(dailyLevel(seed), 'normal', (game.save.lastHero as never) ?? 'aldric', 'campaign',
    { seed, bellfoundry: true })
}
screens.onPlayWatches = () => {
  const seed = newRunSeed()
  game.resetWatches()
  hud.reset()
  hud.setChrome(true)
  screens.show('none')
  screens.watchesRemaining = 2
  game.startLevel(dailyLevel(seed), 'normal', (game.save.lastHero as never) ?? 'aldric', 'campaign',
    { seed, watches: true })
  watchSeed = seed
}
let watchSeed = 0
screens.onNextWatch = () => {
  if (!game.advanceWatch()) return
  hud.reset()
  hud.setChrome(true)
  screens.show('none')
  screens.watchesRemaining = 2 - game.watchIndex
  game.startLevel(dailyLevel(watchSeed), 'normal', (game.save.lastHero as never) ?? 'aldric', 'campaign',
    { seed: watchSeed, watches: true })
}
screens.onResume = () => {
  const cp = readCheckpoint()
  if (!cp) return
  hud.reset()
  hud.setChrome(true)
  screens.show('none')
  game.startLevel(levelById(cp.levelId), cp.difficulty, cp.heroId, cp.endless ? 'endless' : 'campaign', { resume: cp })
}
screens.onMenu = () => {
  screens.watchesRemaining = 0
  game.resetWatches()
  game.showMenuBackdrop()
  hud.reset()
  hud.setChrome(false)
}
hud.onHome = () => {
  if (game.phase === 'playing') {
    telemetry.track({ type: 'quit_to_menu', level: game.level?.id ?? '', wave: (game.waves?.waveIndex ?? 0) + 1 })
  }
  game.showMenuBackdrop()
  hud.reset()
  hud.setChrome(false)
  screens.show('levels')
}
game.onPhaseChange = (phase, stars) => {
  // a finished run is exactly when progress is worth getting off this device
  if (phase === 'victory' || phase === 'defeat') syncNow()
  if (phase === 'victory') screens.show('victory', { stars, levelId: game.level!.id, stats: game.battleStats() })
  else if (phase === 'defeat') screens.show('defeat', { levelId: game.level!.id, stats: game.battleStats() })
}

if (challengeSeed !== null) {
  // arriving from someone else's link: play their board, skip the menu
  screens.onPlayDaily()
} else {
  screens.show('menu')
  game.showMenuBackdrop()
  hud.setChrome(false)
}

// dev/testing handle
;(window as unknown as Record<string, unknown>).vg = { game, hud, screens }

// PWA: offline shell + installability (production only, so dev stays live-reloadable)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline play is a bonus, not a requirement */ })
  })
}

// ---------------- input ----------------

const pointers = new Map<number, { x: number, y: number }>()
let dragButton = -1
let dragOrbit = false   // latched at pointerdown so Shift changes mid-drag don't flip modes
let dragStart = { x: 0, y: 0 }
let dragged = false
let pinchDist = 0
let pinchAngle: number | null = null
let lastCentroid: { x: number, y: number } | null = null
const keys = new Set<string>()

const pinchDistance = () => {
  const pts = [...pointers.values()]
  return pts.length >= 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0
}
const twistAngle = () => {
  const pts = [...pointers.values()]
  return pts.length >= 2 ? Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x) : 0
}

canvas.addEventListener('pointerdown', (e) => {
  if (e.button === 1) e.preventDefault()  // middle-drag orbits; block autoscroll
  // touch: suppress the browser's compatibility mouse events (mousedown/up/click) —
  // otherwise a tap's synthetic click lands on UI that opened underneath the finger
  if (e.pointerType === 'touch') e.preventDefault()
  audio.init(); audio.resume()
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (pointers.size === 1) {
    dragButton = e.button
    dragOrbit = e.button === 2 || e.button === 1 || e.shiftKey
    dragStart = { x: e.clientX, y: e.clientY }
    dragged = false
    if (!dragOrbit) game.engine.panGrab(e.clientX, e.clientY)
  } else {
    // entering multi-touch cancels any pending click; reset gesture baselines
    dragged = true
    game.engine.panRelease()
    pinchDist = pinchDistance()
    pinchAngle = twistAngle()
    lastCentroid = null
  }
  try { canvas.setPointerCapture(e.pointerId) } catch { /* synthetic or stale pointer */ }
})

canvas.addEventListener('pointermove', (e) => {
  const prev = pointers.get(e.pointerId)
  if (!prev) {
    canvas.style.cursor = game.handleHover(e.clientX, e.clientY)
    return
  }
  const dx = e.clientX - prev.x
  const dy = e.clientY - prev.y
  prev.x = e.clientX
  prev.y = e.clientY
  if (pointers.size >= 2) {
    // exactly two contacts drive gestures; extra fingers are ignored
    if (pointers.size > 2) return
    // pinch = zoom · twist = orbit · centroid vertical = tilt · centroid horizontal = pan
    const d = pinchDistance()
    if (pinchDist > 0 && d > 0) game.engine.zoom((pinchDist - d) * 2.6)
    pinchDist = d
    const ang = twistAngle()
    if (pinchAngle !== null) {
      let delta = ang - pinchAngle
      if (delta > Math.PI) delta -= Math.PI * 2
      if (delta < -Math.PI) delta += Math.PI * 2
      if (Math.abs(delta) < 0.4) game.engine.orbitByAngle(delta)
    }
    pinchAngle = ang
    const pts = [...pointers.values()]
    const cx = (pts[0].x + pts[1].x) / 2, cy = (pts[0].y + pts[1].y) / 2
    if (lastCentroid) {
      game.engine.tilt((cy - lastCentroid.y) * 0.9)
      game.engine.pan(-(cx - lastCentroid.x), 0)
    }
    lastCentroid = { x: cx, y: cy }
    return
  }
  if (Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y) > 6) dragged = true
  if (dragged) {
    // orbit/tilt: right-drag, middle-drag, or shift+drag (latched); otherwise pan.
    // Panning pins the grabbed ground point under the pointer; if the pointer
    // has no ground under it (near the horizon), fall back to delta panning.
    if (dragOrbit) game.engine.orbit(dx, dy)
    else if (!game.engine.panTo(e.clientX, e.clientY)) game.engine.pan(-dx, -dy)
  }
})

const endPointer = (e: PointerEvent, isClick: boolean) => {
  try { canvas.releasePointerCapture(e.pointerId) } catch { /* not captured */ }
  const had = pointers.delete(e.pointerId)
  if (!had) return
  game.engine.panRelease()
  if (pointers.size > 0) {
    pinchDist = pinchDistance()
    pinchAngle = pointers.size >= 2 ? twistAngle() : null
    lastCentroid = null
    // two fingers down to one: the survivor continues as a pinned pan
    if (pointers.size === 1 && !dragOrbit) {
      const rest = [...pointers.values()][0]
      game.engine.panGrab(rest.x, rest.y)
    }
    return
  }
  const wasDrag = dragged
  const btn = dragButton
  dragButton = -1
  dragged = false
  pinchDist = 0
  pinchAngle = null
  lastCentroid = null
  if (!isClick || wasDrag) return
  if (btn === 0) game.handleClick(e.clientX, e.clientY)
  else if (btn === 2 && game.targetMode) game.setTargetMode(null)
}

canvas.addEventListener('pointerup', (e) => endPointer(e, true))
canvas.addEventListener('pointercancel', (e) => endPointer(e, false))

canvas.addEventListener('wheel', (e) => {
  e.preventDefault()
  game.engine.zoom(e.deltaY)
}, { passive: false })

canvas.addEventListener('contextmenu', (e) => e.preventDefault())

// Backgrounding a tab should not cost the player a run: a phone call, a tab
// switch or a lock screen now pauses the battle instead of letting it run on.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.phase === 'playing' && !game.paused) game.togglePause()
})

// best-effort storage really is evicted; ask to keep the campaign
void requestDurableStorage()

telemetry.track({ type: 'session_start', firstRun: !localStorage.getItem('blockhold.save.v1'), source: acquisitionSource(), embedded: isEmbedded() })

// Cloud saves are best-effort and never block play: if the service is off,
// unreachable or disabled at build time, this is a no-op and the game runs
// exactly as it did before.
function syncNow(): void {
  void cloud.sync(game.save).then(merged => {
    if (!merged) return
    Object.assign(game.save, merged)
    writeSave(game.save)
  })
}
if (cloud.signedIn) syncNow()
window.addEventListener('error', (e) => telemetry.track({ type: 'error', message: String(e.message).slice(0, 200) }))
window.addEventListener('pagehide', () => telemetry.flush())

window.addEventListener('keydown', (e) => {
  if (e.repeat) return
  keys.add(e.code)
  if (game.phase !== 'playing') return
  if (game.paused) {
    // paused: only resume is allowed
    if (e.code === 'KeyP' || e.code === 'Escape') game.togglePause()
    return
  }
  switch (e.code) {
    case 'Space': e.preventDefault(); game.callWave(); break
    case 'KeyF': game.toggleSpeed(); break
    case 'KeyP': game.togglePause(); break
    case 'KeyH': game.selectHero(true); break
    case 'Digit1': game.setTargetMode(game.targetMode === 'meteor' ? null : 'meteor'); break
    case 'Digit2': game.setTargetMode(game.targetMode === 'reinforce' ? null : 'reinforce'); break
    case 'Digit3': game.castHeroSignature(); break
    case 'KeyC': game.engine.resetView(game.level?.width, game.level?.height); break
    case 'Escape':
      if (game.targetMode) game.setTargetMode(null)
      else if (game.selectedTower || game.selectedPlot || game.heroSelected) game.clearSelection()
      else game.togglePause()
      break
  }
})
window.addEventListener('keyup', (e) => keys.delete(e.code))
window.addEventListener('blur', () => keys.clear())

// ---------------- main loop ----------------

let lastT = performance.now()
function frame(now: number): void {
  const dt = Math.min(0.1, (now - lastT) / 1000)
  lastT = now
  // keyboard pan (disabled while paused: pause is a hard input boundary)
  if (game.phase === 'playing' && !game.paused) {
    const px = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0)
    const pz = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0)
    if (px || pz) game.engine.pan(px * 620 * dt, pz * 620 * dt)
    const orbit = (keys.has('KeyE') ? 1 : 0) - (keys.has('KeyQ') ? 1 : 0)
    if (orbit) game.engine.orbit(orbit * 260 * dt, 0)
    const tilt = (keys.has('KeyG') ? 1 : 0) - (keys.has('KeyT') ? 1 : 0)
    if (tilt) game.engine.tilt(tilt * 220 * dt)
  }
  game.update(dt)
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
