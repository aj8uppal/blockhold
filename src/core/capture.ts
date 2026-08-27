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
