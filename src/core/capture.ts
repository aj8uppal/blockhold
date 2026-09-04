/**
 * Siege Tapes.
 *
 * A result card is a claim; a clip is evidence. This records the player's own
 * defense assembling itself - every tower reappearing in the order it went
 * up, over a slow orbit - and hands back a WebM file. No ranking service, no
 * backend, no account: the video is the artifact, and it is the thing that
 * actually travels.
 *
 * It records the game's own canvas rather than compositing a second one, so
 * what the player watched is what the tape shows.
 */

export interface TapeOptions {
  /** seconds of footage to produce */
  seconds: number
  /** called each frame with 0..1 progress so the caller can pose the scene */
  onFrame: (k: number) => void
  /** frames per second to request from the canvas */
  fps?: number
}

export function canRecordTape(): boolean {
  return typeof MediaRecorder !== 'undefined'
    && typeof HTMLCanvasElement !== 'undefined'
    && typeof HTMLCanvasElement.prototype.captureStream === 'function'
}

/** the best container this browser will actually give us */
function pickMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ]
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported?.(t)) return t
  }
  return null
}

export function tapeFileExtension(mime: string): string {
  return mime.startsWith('video/mp4') ? 'mp4' : 'webm'
}

/**
 * Drive `onFrame` across `seconds` while recording the canvas, then resolve
 * with the finished clip. Rejects rather than hanging if the browser will not
 * record - a blocked codec must surface as a message, not a dead button.
 */
export function recordTape(canvas: HTMLCanvasElement, opts: TapeOptions): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!canRecordTape()) { reject(new Error('This browser cannot record video.')); return }
    const mime = pickMimeType()
    if (!mime) { reject(new Error('No supported video format.')); return }

    const fps = opts.fps ?? 30
    let stream: MediaStream
    let recorder: MediaRecorder
    try {
      stream = canvas.captureStream(fps)
      recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 })
    } catch (e) {
      reject(e instanceof Error ? e : new Error('Recording failed to start.'))
      return
    }

    const chunks: BlobPart[] = []
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
    recorder.onerror = () => { cleanup(); reject(new Error('Recording failed.')) }
    recorder.onstop = () => {
      cleanup()
      resolve(new Blob(chunks, { type: mime }))
    }

    let raf = 0
    const started = performance.now()
    const cleanup = () => {
      cancelAnimationFrame(raf)
      for (const track of stream.getTracks()) track.stop()
    }

    const step = () => {
      const k = Math.min(1, (performance.now() - started) / (opts.seconds * 1000))
      try {
        opts.onFrame(k)
      } catch {
        // a broken poser must not strand the recorder
      }
      if (k >= 1) {
        // let the last frame land in the stream before closing it
        setTimeout(() => { if (recorder.state !== 'inactive') recorder.stop() }, 120)
        return
      }
      raf = requestAnimationFrame(step)
    }

    recorder.start()
    raf = requestAnimationFrame(step)
  })
}

/**
 * Hand the tape to the share sheet where there is one, and to the file system
 * otherwise.
 *
 * A download folder is where a clip goes to be forgotten. On a phone the share
 * sheet reaches the app the video was recorded for, in one tap, while the
 * player is still looking at the result that made them want to send it.
 * Returns false when the sheet is unavailable or declined, so the caller can
 * fall back to a download rather than leaving the player with nothing.
 */
export async function shareTape(blob: Blob, filename: string): Promise<boolean> {
  const nav = navigator as Navigator & {
    share?: (d: { files?: File[], title?: string, text?: string }) => Promise<void>
    canShare?: (d: { files?: File[] }) => boolean
  }
  if (!nav.share || !nav.canShare) return false
  try {
    const file = new File([blob], filename, { type: blob.type })
    if (!nav.canShare({ files: [file] })) return false
    await nav.share({ files: [file], title: 'Blockhold', text: 'My hold. Beat it: aj8uppal.github.io/blockhold' })
    return true
  } catch {
    // a cancelled sheet and an unsupported one look the same here, and the
    // right answer to both is to stop rather than to force a download
    return false
  }
}

/** hand the finished tape to the player */
export function downloadTape(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // revoke late: some browsers read the URL after the click returns
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/* ---------- the vertical cut ---------- */

export interface VerticalTapeOptions extends TapeOptions {
  /** the map, or whatever this run should be remembered as */
  title: string
  /** the number worth bragging about */
  headline: string
  /** where to go to play it; burned in, because captions get lost */
  footer: string
}

/** portrait, because that is the shape of the feeds these end up in */
const V_W = 1080
const V_H = 1920

/**
 * A Siege Tape shaped like the place it is going.
 *
 * The original tape recorded the game canvas directly, which meant a landscape
 * clip with no context: dropped into a vertical feed it became a letterboxed
 * strip a third of the screen high, and nothing in the frame said what game it
 * was or where to find it. A clip that travels has to carry its own caption,
 * because the caption is the first thing stripped when someone re-posts it.
 *
 * So this composites: the battlefield across the middle at full width, the map
 * and the result above it, and the address below. The game canvas is drawn from
 * whatever `onFrame` has just rendered, so the footage is still the real game
 * rather than a reconstruction.
 */
export function recordVerticalTape(source: HTMLCanvasElement, opts: VerticalTapeOptions): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!canRecordTape()) { reject(new Error('This browser cannot record video.')); return }
    const mime = pickMimeType()
    if (!mime) { reject(new Error('No supported video format.')); return }

    const stage = document.createElement('canvas')
    stage.width = V_W
    stage.height = V_H
    const ctx = stage.getContext('2d')
    if (!ctx) { reject(new Error('No 2D context for compositing.')); return }

    const fps = opts.fps ?? 30
    let stream: MediaStream
    let recorder: MediaRecorder
    try {
      stream = stage.captureStream(fps)
      recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 })
    } catch (e) {
      reject(e instanceof Error ? e : new Error('Recording failed to start.'))
      return
    }

    const chunks: BlobPart[] = []
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
    recorder.onerror = () => { cleanup(); reject(new Error('Recording failed.')) }
    recorder.onstop = () => { cleanup(); resolve(new Blob(chunks, { type: mime })) }

    let raf = 0
    const started = performance.now()
    const cleanup = () => {
      cancelAnimationFrame(raf)
      for (const track of stream.getTracks()) track.stop()
    }

    const compose = (): void => {
      ctx.fillStyle = '#0d1420'
      ctx.fillRect(0, 0, V_W, V_H)

      // the battlefield, full width, centred
      const scale = V_W / source.width
      const h = source.height * scale
      const y = (V_H - h) / 2
      ctx.drawImage(source, 0, y, V_W, h)

      // soften the cut between footage and ground rather than leaving a seam
      const fadeTop = ctx.createLinearGradient(0, y, 0, y + 120)
      fadeTop.addColorStop(0, 'rgba(13,20,32,1)')
      fadeTop.addColorStop(1, 'rgba(13,20,32,0)')
      ctx.fillStyle = fadeTop
      ctx.fillRect(0, y, V_W, 120)
      const fadeBot = ctx.createLinearGradient(0, y + h - 120, 0, y + h)
      fadeBot.addColorStop(0, 'rgba(13,20,32,0)')
      fadeBot.addColorStop(1, 'rgba(13,20,32,1)')
      ctx.fillStyle = fadeBot
      ctx.fillRect(0, y + h - 120, V_W, 120)

      ctx.textAlign = 'center'
      ctx.fillStyle = '#e0b24a'
      ctx.font = '800 44px Cinzel, Georgia, serif'
      ctx.fillText('BLOCKHOLD', V_W / 2, y - 210)

      ctx.fillStyle = '#cfe0f0'
      ctx.font = '700 58px Nunito, system-ui, sans-serif'
      ctx.fillText(opts.title, V_W / 2, y - 130)

      ctx.fillStyle = '#ffffff'
      ctx.font = '800 76px Nunito, system-ui, sans-serif'
      ctx.fillText(opts.headline, V_W / 2, y - 44)

      ctx.fillStyle = 'rgba(207,224,240,0.72)'
      ctx.font = '700 40px Nunito, system-ui, sans-serif'
      ctx.fillText(opts.footer, V_W / 2, y + h + 96)
    }

    const step = (): void => {
      const k = Math.min(1, (performance.now() - started) / (opts.seconds * 1000))
      try {
        opts.onFrame(k)
        compose()
      } catch {
        // a broken poser must not strand the recorder
      }
      if (k >= 1) {
        setTimeout(() => { if (recorder.state !== 'inactive') recorder.stop() }, 120)
        return
      }
      raf = requestAnimationFrame(step)
    }

    recorder.start()
    raf = requestAnimationFrame(step)
  })
}

/* ---------- the Hold postcard ---------- */

export interface PostcardOptions {
  /** the caption under the keep: what this save has actually done */
  summary: string
  /** where the reader can go to build their own */
  footer: string
  /** rendered before each capture, so the keep is posed rather than caught */
  onFrame?: () => void
}

/**
 * A picture of the player's own Hold.
 *
 * The Chronicle Hold is the one thing in Blockhold that is unmistakably *yours*
 * - a keep built out of what you have actually done, different in silhouette
 * from everyone else's. It was also completely trapped: rendered behind the
 * menu, seen only by the person who earned it, with no way to show anybody.
 *
 * A still image is the right artifact for it. It survives being re-posted,
 * needs no player to press play, and is the thing people actually put in a
 * message. So: the keep as it stands, its summary line, and the address.
 */
export async function capturePostcard(source: HTMLCanvasElement, opts: PostcardOptions): Promise<Blob | null> {
  const W = 1200
  const H = 900
  const stage = document.createElement('canvas')
  stage.width = W
  stage.height = H
  const ctx = stage.getContext('2d')
  if (!ctx) return null

  opts.onFrame?.()

  ctx.fillStyle = '#0d1420'
  ctx.fillRect(0, 0, W, H)

  // cover-fit the live canvas so the keep fills the card at any window size
  const scale = Math.max(W / source.width, (H - 150) / source.height)
  const dw = source.width * scale
  const dh = source.height * scale
  ctx.drawImage(source, (W - dw) / 2, (H - 150 - dh) / 2, dw, dh)

  const fade = ctx.createLinearGradient(0, H - 300, 0, H - 150)
  fade.addColorStop(0, 'rgba(13,20,32,0)')
  fade.addColorStop(1, 'rgba(13,20,32,1)')
  ctx.fillStyle = fade
  ctx.fillRect(0, H - 300, W, 150)
  ctx.fillStyle = '#0d1420'
  ctx.fillRect(0, H - 150, W, 150)

  ctx.textAlign = 'center'
  ctx.fillStyle = '#e0b24a'
  ctx.font = '800 34px Cinzel, Georgia, serif'
  ctx.fillText('MY BLOCKHOLD', W / 2, H - 92)

  ctx.fillStyle = 'rgba(207,224,240,0.88)'
  ctx.font = '600 24px Nunito, system-ui, sans-serif'
  // the summary can outgrow one line on a well-earned keep, so clip rather
  // than let it run off the card
  const text = opts.summary.length > 92 ? `${opts.summary.slice(0, 89)}...` : opts.summary
  ctx.fillText(text, W / 2, H - 54)

  ctx.fillStyle = 'rgba(207,224,240,0.45)'
  ctx.font = '700 20px Nunito, system-ui, sans-serif'
  ctx.fillText(opts.footer, W / 2, H - 20)

  return await new Promise<Blob | null>(resolve => stage.toBlob(b => resolve(b), 'image/png'))
}

/** hand an image to the share sheet, or fall back to saving it */
export async function sharePostcard(blob: Blob, filename: string): Promise<boolean> {
  const nav = navigator as Navigator & {
    share?: (d: { files?: File[], title?: string, text?: string }) => Promise<void>
    canShare?: (d: { files?: File[] }) => boolean
  }
  if (!nav.share || !nav.canShare) return false
  try {
    const file = new File([blob], filename, { type: 'image/png' })
    if (!nav.canShare({ files: [file] })) return false
    await nav.share({ files: [file], title: 'My Blockhold', text: 'aj8uppal.github.io/blockhold' })
    return true
  } catch {
    return false
  }
}
