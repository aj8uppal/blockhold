import type { Engine } from '../core/engine.ts'
import { writeSave, exportSave, type SaveData } from '../core/save.ts'
import { blankHold, HOLD_THEMES, HOLD_COLORS, HOLD_WIDTH, HOLD_HEIGHT, placementError, type HoldRecord, type HoldPlacement, type HoldSnapshot } from '../core/holdData.ts'
import { holdCatalog, holdSnapshot, ownedHold, effectivePieces, newHoldRewards, themeUnlocked, hasGilding, type HoldReward } from './catalog.ts'
import { HoldScene } from './scene.ts'
import { decodeVisit, visitUrl } from './visit.ts'
import { bindDialog } from '../ui/dialog.ts'
import { icon } from '../ui/icons.ts'
import { cloud } from '../core/cloud.ts'
import { coopEnabled } from '../core/coopLink.ts'
import './style.css'

export interface HoldScreenApi {
  root: HTMLElement, engine: Engine, save: () => SaveData, restoreBackdrop: () => void,
  go: (where: 'menu' | 'hold' | 'levels' | 'hunts' | 'coop' | 'daily', source?: string) => void,
  sync: () => void
}
export interface HoldControls { navigate?: (action: () => void) => void, click: (x: number, y: number) => void, key: (event: KeyboardEvent) => void, dispose: () => void }
function node<K extends keyof HTMLElementTagNameMap>(tag: K, parent: HTMLElement, cls = '', text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag); e.className = cls; if (text !== undefined) e.textContent = text; parent.append(e); return e
}
function button(parent: HTMLElement, text: string, action: () => void, primary = false): HTMLButtonElement {
  const b = node('button', parent, `btn${primary ? ' primary' : ''}`, text); b.type = 'button'; b.onclick = action; return b
}
const styleNames = { forest: 'Meadow', winter: 'Winter', ember: 'Ember', void: 'Eclipse' }
export function mountHold(api: HoldScreenApi, code?: string): HoldControls {
  const wrap = node('section', api.root, 'hold-screen'), header = node('header', wrap, 'hold-header')
  const visitor = code !== undefined, shared = visitor ? decodeVisit(code) : null
  let alive = true, editing = false, selected: string | null = null, pending: HoldPlacement | null = null, undo: HoldRecord | null = null, dialog: HTMLElement | null = null
  let draft = ownedHold(api.save()), baseline = JSON.stringify(draft)
  const initialNew = newHoldRewards(api.save())
  const snapshot = () => shared ?? holdSnapshot(api.save(), draft)
  const scene = new HoldScene(api.engine, snapshot(), api.restoreBackdrop)
  const dirty = () => editing && JSON.stringify(draft) !== baseline
  const home = button(header, '← Home', () => leave('menu'))
  const names = node('div', header, 'hold-heading')
  node('span', names, 'eyebrow', visitor ? 'Visiting a shared Hold' : 'Your kingdom, made yours')
  const title = node('h1', names, '', snapshot().name)
  button(header, visitor ? 'My Hold' : 'To battle →', () => visitor ? api.go('hold') : leave('levels'), true)
  const toolbar = node('nav', wrap, 'hold-toolbar'); toolbar.setAttribute('aria-label', 'Hold controls')
  button(toolbar, 'Collection', () => collection())
  const customize = !visitor ? button(toolbar, 'Customize', () => beginEdit()) : null
  const shareButton = button(toolbar, 'Share', () => share())
  const coopButton = !visitor && coopEnabled() ? button(toolbar, 'Co-op', () => leave('coop')) : null
  const saveButton = button(toolbar, 'Save', () => { commit() }, true)
  const cancelButton = button(toolbar, 'Cancel edits', () => dirty() ? confirmDiscard() : discard())
  const camera = node('div', wrap, 'hold-camera')
  button(camera, '↶', () => { api.engine.yawGoal -= Math.PI / 4 }).setAttribute('aria-label', 'Rotate view left')
  button(camera, '↷', () => { api.engine.yawGoal += Math.PI / 4 }).setAttribute('aria-label', 'Rotate view right')
  button(camera, '−', () => api.engine.zoom(100)).setAttribute('aria-label', 'Zoom out')
  button(camera, '+', () => api.engine.zoom(-100)).setAttribute('aria-label', 'Zoom in')
  button(camera, 'Fit', scene.frame)
  const panel = node('aside', wrap, 'hold-panel'); panel.setAttribute('aria-label', 'Hold inspector')
  const status = node('div', wrap, 'hold-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite')
  let notice = ''
  const message = (text: string) => { notice = text; status.textContent = text }
  const redraw = () => {
    if (!alive) return
    title.textContent = snapshot().name; scene.update(snapshot()); scene.editing(editing)
    const p = pending ?? snapshot().pieces.find(p => p.id === selected)
    scene.highlight(p, !pending || !placementError(pending, snapshot().pieces), !!pending)
    wrap.classList.toggle('placing', !!pending)
    saveButton.hidden = cancelButton.hidden = !editing; saveButton.disabled = !!pending
    shareButton.hidden = editing; if (coopButton) coopButton.hidden = editing
    if (customize) { customize.hidden = editing; customize.textContent = editing ? 'Customizing' : 'Customize'; customize.setAttribute('aria-pressed', String(editing)) }
    inspector()
  }
  function modal(label: string): { body: HTMLElement, close: () => void } {
    dialog?.remove()
    const overlay = node('div', wrap, 'hold-overlay'), card = node('section', overlay, 'hold-sheet')
    dialog = overlay
    const top = node('header', card, 'hold-sheet-head'); node('h2', top, '', label)
    const close = () => { overlay.remove(); if (dialog === overlay) dialog = null; home.focus({ preventScroll: true }) }
    button(top, '×', close).setAttribute('aria-label', 'Close')
    bindDialog(overlay, card, close)
    return { body: card, close }
  }
  function beginEdit(): void {
    if (visitor) return
    if (!editing) { draft = ownedHold(api.save()); baseline = JSON.stringify(draft); editing = true; undo = null }
    redraw()
  }
  function commit(): boolean {
    if (!editing) return true
    const before = ownedHold(api.save())
    if (before.updatedAt > JSON.parse(baseline).updatedAt) {
      message('A newer arrangement arrived from sync. Cancel to use it, or save your draft again to keep this arrangement.')
      baseline = JSON.stringify(before)
      return false
    }
    const next = ownedHold(api.save(), { ...draft, updatedAt: Date.now(), seen: [...new Set([...(api.save().hold?.seen ?? []), ...draft.seen])], dailyWon: !!(api.save().hold?.dailyWon || draft.dailyWon) })
    const candidate = { ...api.save(), hold: next }
    if (!writeSave(candidate)) { message('Storage is full or blocked. Your draft is still open. Retry Save or export a backup.'); inspector(); return false }
    Object.assign(api.save(), candidate); draft = structuredClone(next); baseline = JSON.stringify(draft); editing = false; pending = null; undo = null
    api.sync(); message(cloud.signedIn ? 'Saved on this device. Cloud sync requested.' : 'Saved on this device.'); redraw(); return true
  }
  function discard(): void { draft = ownedHold(api.save()); baseline = JSON.stringify(draft); editing = false; pending = null; undo = null; selected = null; message(''); redraw() }
  function leave(where: Parameters<HoldScreenApi['go']>[0], source?: string): void { navigate(() => api.go(where, source)) }
  function navigate(action: () => void): void {
    if (!dirty()) { action(); return }
    const { body, close } = modal('Save your arrangement?')
    node('p', body, '', 'Your courtyard has unsaved changes.')
    button(body, 'Save and leave', () => { if (commit()) { close(); action() } else close() }, true)
    button(body, 'Discard changes', () => { close(); discard(); action() })
    button(body, 'Keep editing', close)
  }
  function mutate(fn: () => void): void { undo = structuredClone(draft); fn(); redraw() }
  function move(id: string): void {
    beginEdit(); selected = id
    pending = { ...(snapshot().pieces.find(p => p.id === id) ?? { id, x: 0, z: 0, r: 0 }) }
    redraw()
  }
  function place(): void {
    if (!pending) return
    const problem = placementError(pending, snapshot().pieces)
    if (problem) { message(problem); return }
    const p = { ...pending }
    mutate(() => {
      // Freeze the current arrangement as explicit placements so moving one piece never shifts its neighbors.
      draft.placements = snapshot().pieces.filter(v => v.id !== p.id).concat(p)
      draft.stored = draft.stored.filter(id => id !== p.id); pending = null
    })
    message('Placed. Save when your arrangement is ready.')
  }
  function inspector(): void {
    panel.replaceChildren()
    if (visitor && !shared) { node('h2', panel, '', 'This visit link could not be opened'); node('p', panel, '', 'It may be incomplete or from a newer version. Your own progress and saved battle are safe.'); button(panel, 'Back to my game', () => api.go('menu'), true); return }
    if (pending) {
      node('h2', panel, '', 'Choose a place')
      const problem = placementError(pending, snapshot().pieces)
      node('p', panel, '', problem ?? `Cell ${pending.x + 1}, ${pending.z + 1} · ready to place`)
      const row = node('div', panel, 'hold-actions')
      const placeButton = button(row, 'Place', place, true); placeButton.disabled = !!problem
      button(row, 'Rotate', () => { pending!.r = (pending!.r + 1) % 4; redraw() })
      button(row, 'Cancel', () => { pending = null; redraw() })
      node('small', panel, 'hold-hint', 'Tap a cell · arrows to move · R to rotate · Enter to place')
      return
    }
    const reward = holdCatalog(api.save()).find(r => r.id === selected)
    if (reward) {
      const head = node('div', panel, 'hold-sheet-head'); node('h2', head, '', reward.name)
      button(head, '×', () => { selected = null; redraw() }).setAttribute('aria-label', 'Deselect piece')
      node('p', panel, '', reward.requirement)
      if (!visitor) node('small', panel, 'hold-hint', reward.progress)
      if (!visitor) {
        const row = node('div', panel, 'hold-actions')
        button(row, 'Move', () => move(reward.id), true)
        button(row, 'Rotate', () => { beginEdit(); mutate(() => { draft.placements = snapshot().pieces.map(p => p.id === reward.id ? { ...p, r: (p.r + 1) % 4 } : p) }) })
        button(row, 'Store', () => { beginEdit(); mutate(() => { draft.placements = snapshot().pieces.filter(p => p.id !== reward.id); draft.stored.push(reward.id); selected = null }) })
      }
    } else if (editing) {
      node('h2', panel, '', 'Make it yours')
      node('p', panel, '', 'Tap a piece to move it. Open Collection to place something from storage.')
      const label = node('label', panel, 'hold-label', 'Hold name'), input = node('input', label, 'hold-input')
      input.value = draft.name; input.maxLength = 24
      input.onfocus = () => { undo = structuredClone(draft) }
      input.oninput = () => { draft.name = input.value.trim() || 'Your Hold'; title.textContent = draft.name }
      const themes = node('div', panel, 'hold-options'); themes.setAttribute('aria-label', 'Landscape theme')
      for (const theme of HOLD_THEMES) {
        const b = button(themes, styleNames[theme], () => mutate(() => { draft.theme = theme }))
        b.disabled = !themeUnlocked(api.save(), theme); b.setAttribute('aria-pressed', String(draft.theme === theme))
        if (b.disabled) b.title = `Win ${theme === 'winter' ? 'Frostmere' : theme === 'ember' ? 'Emberwastes' : 'Shattered Crown'} to unlock`
      }
      node('small', panel, 'hold-hint', 'Win Frostmere for Winter, Emberwastes for Ember, Shattered Crown for Eclipse.')
      const colors = node('div', panel, 'hold-options')
      for (const color of HOLD_COLORS) { const b = button(colors, color[0].toUpperCase() + color.slice(1), () => mutate(() => { draft.color = color })); b.setAttribute('aria-pressed', String(draft.color === color)) }
      const gilded = button(panel, draft.keep === 'gilded' ? 'Gilded roof ✓' : 'Gilded roof', () => mutate(() => { draft.keep = draft.keep === 'gilded' ? 'stone' : 'gilded' }))
      gilded.disabled = !hasGilding(api.save()); gilded.title = 'Win a campaign battlefield on Veteran to unlock'
    } else {
      node('span', panel, 'eyebrow', visitor ? 'A moment worth sharing' : 'Built by your victories')
      node('h2', panel, '', visitor ? shared!.name : 'A place to call your own')
      node('p', panel, '', visitor ? 'Look around and tap a trophy to learn what it represents.' : 'Every victory brings something home. Your rewards appear here automatically; arrange them however you like.')
      node('div', panel, 'hold-count', `${snapshot().pieces.length} pieces on display`)
      if (visitor) node('small', panel, 'hold-hint', `Shared snapshot · ${new Date(shared!.date).toLocaleDateString()} · cosmetic display`)
      else {
        if (initialNew.length) { const b = button(panel, `${initialNew.length} new ${initialNew.length === 1 ? 'reward' : 'rewards'} in your Hold`, () => collection('New'), true); b.dataset.testid = 'hold-new' }
        const next = holdCatalog(api.save()).find(r => !r.owned)
        if (next) { node('span', panel, 'eyebrow', 'Next to earn'); node('h3', panel, '', next.name); node('p', panel, '', next.requirement); button(panel, 'Find a battle →', () => leave(next.action, next.source)) }
      }
    }
    if (editing) {
      const row = node('div', panel, 'hold-actions hold-edit-actions')
      button(row, 'Save', () => { commit() }, true)
      button(row, 'Cancel edits', () => dirty() ? confirmDiscard() : discard())
      const u = button(row, 'Undo', () => { if (undo) { draft = undo; undo = null; pending = null; redraw() } }); u.disabled = !undo
      button(panel, 'Restore automatic arrangement', () => { const { body, close } = modal('Restore arrangement?'); node('p', body, '', 'Return every owned piece to the automatic arrangement. Nothing leaves your collection.'); button(body, 'Restore', () => { mutate(() => { draft.placements = []; draft.stored = [] }); close() }, true) })
      if (notice.startsWith('Storage')) button(panel, 'Export draft backup', () => {
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([exportSave({ ...api.save(), hold: draft })], { type: 'text/plain' })); a.download = 'blockhold-hold-backup.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
      })
    }
  }
  function confirmDiscard(): void {
    const { body, close } = modal('Discard your edits?'); node('p', body, '', 'Your last saved arrangement will return.')
    button(body, 'Discard edits', () => { close(); discard() }); button(body, 'Keep editing', close, true)
  }
  function collection(filter = 'All'): void {
    const { body, close } = modal(visitor ? 'On display' : 'Your collection')
    const filters = node('div', body, 'hold-filters'), list = node('div', body, 'hold-collection')
    const catalog = holdCatalog(api.save()), placed = new Set(snapshot().pieces.map(p => p.id)), newIds = new Set(initialNew.map(r => r.id))
    const paint = (picked: string) => {
      filters.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.textContent === picked)))
      list.replaceChildren()
      for (const reward of catalog.filter(r => visitor ? placed.has(r.id) : picked === 'All' || picked === 'New' ? picked === 'All' || newIds.has(r.id) : r.category === picked)) {
        const card = node('article', list, 'hold-reward')
        const badge = node('div', card, 'hold-reward-icon'); badge.innerHTML = icon(reward.category === 'Buildings' ? 'castle' : reward.category === 'Banners' ? 'flag' : reward.category === 'Landscape' ? 'compass' : 'crown')
        node('h3', card, '', reward.name)
        node('small', card, '', placed.has(reward.id) ? 'On display' : reward.owned ? 'In storage' : 'Locked')
        node('p', card, '', reward.requirement)
        if (!visitor) {
          node('small', card, 'hold-hint', reward.progress)
          button(card, reward.owned ? placed.has(reward.id) ? 'Select' : 'Place' : 'View objective →', () => {
            close()
            if (!reward.owned) { leave(reward.action, reward.source); return }
            selected = reward.id
            if (!placed.has(reward.id)) move(reward.id); else redraw()
          }, reward.owned)
        }
      }
      if (!list.children.length) node('p', list, '', 'You are all caught up. Your next victory could bring something new.')
    }
    for (const label of visitor ? ['All'] : ['All', 'New', 'Buildings', 'Trophies', 'Banners', 'Landscape']) button(filters, label, () => paint(label))
    paint(filter)
    if (!visitor) {
      const record = { ...(api.save().hold ?? blankHold()), seen: catalog.filter(r => r.owned).map(r => r.id) }, candidate = { ...api.save(), hold: record }
      if (writeSave(candidate)) { Object.assign(api.save(), candidate); draft.seen = record.seen; const base = JSON.parse(baseline); base.seen = record.seen; baseline = JSON.stringify(base); api.sync() }
    }
  }
  function share(): void {
    const { body } = modal('Share your Hold')
    node('p', body, '', 'Send a picture or a read-only snapshot. Visitors can look around; your progress stays private.')
    const shareStatus = node('p', body, 'hold-hint'); shareStatus.setAttribute('role', 'status')
    button(body, 'Copy visit link', async () => {
      const url = visitUrl(snapshot())
      try { await navigator.clipboard.writeText(url); shareStatus.textContent = 'Visit link copied.' } catch { const input = node('textarea', body, 'hold-input'); input.setAttribute('aria-label', 'Visit link'); input.value = url; input.select(); shareStatus.textContent = 'Copy this link to share your Hold.' }
    }, true)
    const shot = button(body, 'Share image', async () => {
      shot.disabled = true
      try {
        const { capturePostcard, sharePostcard, downloadTape } = await import('../core/capture.ts')
        scene.highlight(); api.engine.updateCamera(0)
        const blob = await capturePostcard(scene.postcardSource(), { summary: `${snapshot().name} · ${snapshot().pieces.length} pieces`, footer: 'Blockhold · Hold the line, block by block.' })
        if (!blob) throw new Error('Could not capture the picture. Try again.')
        if (!await sharePostcard(blob, 'my-hold.png')) downloadTape(blob, 'my-hold.png')
        shareStatus.textContent = 'Your picture is ready.'
      } catch (error) { shareStatus.textContent = error instanceof Error ? error.message : 'Sharing is unavailable. Try the visit link.' }
      finally { shot.disabled = false; if (alive) redraw() }
    })
  }
  function click(x: number, y: number): void {
    if (dialog || visitor && !shared) return
    const hit = scene.pick(x, y)
    if (pending && hit) { pending.x = hit.x; pending.z = hit.z }
    else selected = hit?.id && hit.id !== selected ? hit.id : null
    redraw()
  }
  function key(event: KeyboardEvent): void {
    if (dialog || /INPUT|TEXTAREA|SELECT/.test((event.target as HTMLElement)?.tagName)) return
    if (event.key === 'Escape') { event.preventDefault(); if (pending) pending = null; else if (selected) selected = null; else if (editing) { confirmDiscard(); return } redraw() }
    if (!pending) return
    const delta: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
    if (delta[event.key]) { event.preventDefault(); const [x, z] = delta[event.key]; pending.x = Math.max(0, Math.min(HOLD_WIDTH - 1, pending.x + x)); pending.z = Math.max(0, Math.min(HOLD_HEIGHT - 1, pending.z + z)); redraw() }
    if (event.key.toLowerCase() === 'r') { event.preventDefault(); pending.r = (pending.r + 1) % 4; redraw() }
    if (event.key === 'Enter') { event.preventDefault(); place() }
  }
  const unload = (e: BeforeUnloadEvent) => { if (dirty()) { e.preventDefault(); e.returnValue = '' } }
  window.addEventListener('beforeunload', unload)
  if (visitor && !shared) scene.group.visible = false
  redraw()
  return { navigate, click, key, dispose: () => { alive = false; window.removeEventListener('beforeunload', unload); scene.dispose(); wrap.remove() } }
}
