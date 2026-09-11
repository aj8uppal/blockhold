import { bindDialog } from './dialog.ts'
import { downloadBattleBackup, parseBattleBackup } from '../game/battleBackup.ts'
import { readSession, writeSession } from '../game/session.ts'
import { cloud, applyCloud, toCloud } from '../core/cloud.ts'
import { importSave, type SaveData } from '../core/save.ts'
import { mergeSaves } from '../core/saveMerge.ts'

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: HTMLElement, text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = cls
  node.textContent = text
  parent.appendChild(node)
  return node
}

/** One account action; old code recovery remains available without competing with sign-in. */
export function renderAccountPanel(root: HTMLElement, save: () => SaveData, onRestore: (save: SaveData) => void, onClose: () => void): void {
  const overlay = el('div', 'help-overlay', root)
  const card = el('div', 'help-card account-card', overlay)
  card.setAttribute('role', 'dialog')
  card.setAttribute('aria-modal', 'true')
  card.setAttribute('aria-label', 'Your progress')
  const previousFocus = document.activeElement as HTMLElement | null
  const close = () => { overlay.remove(); previousFocus?.focus(); onClose() }
  let available: boolean | null = null
  let unavailable = ''
  const draw = () => {
    if (!overlay.isConnected) return
    card.replaceChildren()
    const status = cloud.status()
    el('h2', '', card, 'Your progress')
    el('p', 'account-body', card, status.provider === 'google' && status.signedIn
      ? 'Connected with Google. Your campaign syncs across devices when you play online.'
      : status.signedIn
        ? 'Your existing cloud save is connected. Link Google to bring this same campaign to your other devices.'
        : 'Your campaign saves automatically on this device. Sign in with Google to keep it across devices.')
    if (!(status.signedIn && status.provider === 'google')) {
      const google = el('button', 'btn primary', card, available === null ? 'Checking sign-in…' : 'Sign in with Google')
      google.disabled = available !== true
      google.onclick = async () => {
        google.disabled = true
        warn.textContent = ''
        try { await cloud.signInGoogle() } catch (e) {
          warn.textContent = e instanceof Error ? e.message : 'Sign-in unavailable. Please try again.'
          google.disabled = false
        }
      }
      if (available === false) el('p', 'account-body', card, unavailable || 'Google sign-in is not available yet. Your progress continues to save on this device.')
    }
    if (status.signedIn) {
      const sync = el('button', 'btn ghost', card, 'Sync now')
      sync.onclick = async () => {
        sync.disabled = true
        const merged = await cloud.sync(save())
        if (merged) onRestore(merged)
        draw()
      }
      const out = el('button', 'btn ghost', card, 'Sign out on this device')
      out.onclick = async () => { out.disabled = true; await cloud.signOut(); draw() }
    }
    const warn = el('p', 'account-warn', card, status.lastError ?? '')
    warn.setAttribute('role', 'status')
    if (status.lastSyncedAt) el('p', 'account-body', card, `Last synced ${new Date(status.lastSyncedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`)
    const advanced = el('details', 'account-backup', card)
    el('summary', 'account-backup-head', advanced, 'Backups & older saves')
    el('p', 'account-body', advanced, 'Download a backup file, or recover a save made before Google sign-in. Recovery keeps the progress already earned here.')
    const download = el('button', 'btn ghost small', advanced, 'Download backup')
    download.onclick = () => downloadBattleBackup(save())
    const file = el('input', 'account-input', advanced)
    file.type = 'file'
    file.accept = '.txt,.json,text/plain,application/json'
    file.setAttribute('aria-label', 'Import a Blockhold backup file')
    const recover = (text: string): boolean => {
      const bundle = parseBattleBackup(text.trim())
      const restored = bundle?.progress ?? importSave(text.trim())
      if (!restored) return false
      onRestore(applyCloud(save(), mergeSaves(toCloud(save()), toCloud(restored))))
      if (bundle?.battle) {
        const current = readSession()
        if (current && current.savedAt > bundle.battle.savedAt) warn.textContent = 'Account restored. Your newer saved battle was kept.'
        else if (!writeSession(bundle.battle)) warn.textContent = 'Account restored, but the browser could not store the battle.'
        else warn.textContent = 'Account and battle restored. Choose Continue from the menu.'
      } else warn.textContent = 'Account progress recovered. This older backup does not contain a battle.'
      return true
    }
    file.onchange = async () => {
      const selected = file.files?.[0]
      if (!selected) return
      if (selected.size > 8 * 1024 * 1024) { warn.textContent = 'This backup file is too large.'; return }
      try { if (!recover(await selected.text())) warn.textContent = 'That file is not a Blockhold backup.' }
      catch { warn.textContent = 'Could not read the backup file.' }
    }
    const legacy = el('details', '', advanced)
    el('summary', 'account-backup-head', legacy, 'Recover an old code')
    const input = el('textarea', 'account-input', legacy)
    input.placeholder = 'Paste your old save or recovery code'
    input.setAttribute('aria-label', 'Old save or recovery code')
    input.spellcheck = false
    const restore = el('button', 'btn ghost small', legacy, 'Recover progress')
    restore.onclick = async () => {
      if (recover(input.value)) return
      restore.disabled = true
      const result = await cloud.linkDevice(input.value.trim(), save())
      restore.disabled = false
      if (!result.ok || !result.save) { warn.textContent = result.error ?? 'Could not recover this save.'; return }
      onRestore(applyCloud(save(), result.save))
      await cloud.refreshIdentity()
      draw()
    }
    el('button', 'btn ghost', card, 'Back').onclick = close
  }
  draw()
  void Promise.all([cloud.googleAvailable(), cloud.refreshIdentity()]).then(([enabled]) => {
    available = enabled; draw()
  }).catch(() => {
    available = false
    unavailable = 'Could not reach sign-in. Your progress stays on this device; try again when connected.'
    draw()
  })
  bindDialog(overlay, card, close)
}
