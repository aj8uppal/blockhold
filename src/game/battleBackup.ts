import { exportSave, importSave, type SaveData } from '../core/save.ts'
import { parseSession, type BattleSession } from './session.ts'

/** Account progress and the untouched battle journal; no account credentials. */
export function exportBattleBackup(save: SaveData): string {
  let battle: unknown = null
  try { battle = JSON.parse(localStorage.getItem('blockhold.session.v1') ?? 'null') } catch { /* keep the account backup usable */ }
  return JSON.stringify({ format: 'blockhold-battle', version: 1, progress: exportSave(save), battle })
}

export function parseBattleBackup(text: string): { progress: SaveData, battle: BattleSession | null } | null {
  try {
    const value = JSON.parse(text)
    if (value?.format !== 'blockhold-battle' || value.version !== 1 || typeof value.progress !== 'string') return null
    const progress = importSave(value.progress)
    const battle = value.battle === null ? null : parseSession(value.battle)
    if (!progress || value.battle !== null && !battle) return null
    return { progress, battle }
  } catch { return null }
}

export function downloadBattleBackup(save: SaveData): void {
  const url = URL.createObjectURL(new Blob([exportBattleBackup(save)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url; link.download = 'blockhold-battle.json'; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
