import { hasSave, importSave, loadSave, writeSave, type SaveData } from './save.ts'
import { mergeSaves } from './saveMerge.ts'
import { applyCloud, toCloud } from './cloud.ts'
import { nickname, setNickname } from './leaderboard.ts'

/**
 * Progress carried over from the game's old address.
 *
 * Blockhold used to live at aj8uppal.github.io/blockhold. A browser keeps
 * storage per address, so a player who comes back at blockhold.app finds a
 * brand-new game while their campaign sits at the old address, where nothing
 * but a page on that same address can read it.
 *
 * So the old address now serves one small page (web/legacy/) that reads the
 * save where it lives and forwards the player here with it in the fragment:
 * blockhold.app/?hold=...#carry=<save code>. A fragment never reaches a
 * server. This side accepts it only when the browser says the visit came from
 * the old address, so a link made anywhere else cannot write into a player's
 * save, and merges it the way two devices merge: nothing earned on either
 * copy is lost, and the newer copy keeps its choices.
 */
export const OLD_ORIGIN = 'https://aj8uppal.github.io'

export interface Carried {
  save: SaveData
  nickname: string
}

/** the carried save in this address's fragment, if it is one and it came from the old address */
export function readCarry(hash: string, referrer: string): Carried | null {
  if (!hash.startsWith('#carry=')) return null
  let from: string
  try { from = new URL(referrer).origin } catch { return null }
  if (from !== OLD_ORIGIN) return null
  const params = new URLSearchParams(hash.slice(1))
  // the same gate as a pasted save code: anything malformed is not a save
  const save = importSave(params.get('carry') ?? '')
  if (!save) return null
  return { save, nickname: (params.get('nick') ?? '').replace(/[^A-Za-z0-9 _-]/g, '').slice(0, 16) }
}

/**
 * Fold a carried save into this address's own.
 *
 * With nothing stored here yet, the carried save simply is the player's save
 * on this device. Otherwise the player has started again here since the move,
 * and the two copies merge exactly as a phone and a laptop would. Both copies
 * come from the same device, so the device-side progress - the tutorial
 * having been played, the enemies already introduced - comes along as well.
 */
export function mergeCarried(local: SaveData, localExists: boolean, carried: SaveData): SaveData {
  if (!localExists) return { ...carried }
  const merged = applyCloud(local, mergeSaves(toCloud(local), toCloud(carried)))
  merged.taughtBasics = local.taughtBasics || carried.taughtBasics
  merged.seenEnemies = [...new Set([...local.seenEnemies, ...carried.seenEnemies])].slice(0, 64)
  merged.changedAt = Math.max(local.changedAt ?? 0, carried.changedAt ?? 0) || undefined
  return merged
}

/** whether a merge actually gave the player anything */
export function progressChanged(before: SaveData, after: SaveData): boolean {
  const shape = (s: SaveData) => JSON.stringify([toCloud(s, 0), s.taughtBasics, [...s.seenEnemies].sort()])
  return shape(before) !== shape(after)
}

/**
 * Take a carried save from the address, before the game reads its own.
 * Returns true when the player's progress here grew as a result.
 */
export function takeCarry(): boolean {
  const hash = location.hash
  if (!hash.startsWith('#carry=')) return false
  // the fragment holds a whole save: it should not sit in the address bar, in
  // history, or in a bookmark made a minute from now
  history.replaceState(history.state, '', location.pathname + location.search)
  const carried = readCarry(hash, document.referrer)
  if (!carried) return false
  if (carried.nickname && !nickname()) setNickname(carried.nickname)
  const exists = hasSave()
  const local = loadSave()
  const merged = mergeCarried(local, exists, carried.save)
  if (!progressChanged(local, merged)) return false
  return writeSave(merged, false)
}
