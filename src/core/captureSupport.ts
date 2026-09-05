/**
 * Can this browser record the canvas at all? Asked at render time to decide
 * whether to show the Siege Tape button, so it lives apart from the recorder,
 * which is a lazy chunk: nobody should download an encoder to see a menu.
 */
export function canRecordTape(): boolean {
  return typeof MediaRecorder !== 'undefined'
    && typeof HTMLCanvasElement !== 'undefined'
    && typeof HTMLCanvasElement.prototype.captureStream === 'function'
}
