/**
 * AnimationController — drives playback of pre-baked GoldSrc animation frames.
 *
 * Implements the same frame-advance logic as HLSDK StudioEstimateFrame:
 *   frame += delta * fps * playbackRate
 * with STUDIO_LOOPING support.
 */
import { StudioSeqDesc, STUDIO_LOOPING } from '../types/mdl'
import { MeshBuildResult } from '../renderer/ModelBuilder'

export class AnimationController {
  private results:   MeshBuildResult[] = []
  private sequences: StudioSeqDesc[]   = []

  private seqIndex:  number = 0
  private frame:     number = 0   // float — fractional frame counter
  private playing:   boolean = false
  private speed:     number  = 1.0

  private onFrameChangeCb?:  (frame: number, total: number) => void
  private onSeqChangeCb?:    (seq: StudioSeqDesc | null) => void

  // ── Setup ────────────────────────────────────────────────────────────────

  setModel(results: MeshBuildResult[], sequences: StudioSeqDesc[]): void {
    this.results   = results
    this.sequences = sequences
    this.seqIndex  = 0
    this.frame     = 0
    this.playing   = false
  }

  // ── Playback control ─────────────────────────────────────────────────────

  playSequence(index: number): boolean {
    if (index < 0 || index >= this.sequences.length) return false
    const seq = this.sequences[index]
    if (!seq || seq.numFrames === 0) return false
    this.seqIndex = index
    this.frame    = 0
    this.playing  = true
    this.onSeqChangeCb?.(seq)
    this.applyFrame(0, 0)
    return true
  }

  stop():   void { this.playing = false; this.frame = 0 }
  pause():  void { this.playing = false }
  resume(): void { if (this.sequences[this.seqIndex]) this.playing = true }
  toggle(): void { this.playing ? this.pause() : this.resume() }

  setSpeed(s: number): void { this.speed = Math.max(0.01, s) }
  getSpeed(): number { return this.speed }

  getCurrentSequence(): StudioSeqDesc | null { return this.sequences[this.seqIndex] ?? null }
  getCurrentSeqIndex(): number { return this.seqIndex }
  getCurrentFrame(): number { return Math.floor(this.frame) }
  isPlaying(): boolean { return this.playing }
  getSequences(): StudioSeqDesc[] { return this.sequences }

  setFrame(f: number): void {
    const seq = this.sequences[this.seqIndex]
    if (!seq) return
    this.frame = Math.max(0, Math.min(f, seq.numFrames - 1))
    this.applyFrame(Math.floor(this.frame), this.frame - Math.floor(this.frame))
  }

  // ── Callbacks ────────────────────────────────────────────────────────────

  setOnFrameChange(cb: (frame: number, total: number) => void): void {
    this.onFrameChangeCb = cb
  }
  setOnSeqChange(cb: (seq: StudioSeqDesc | null) => void): void {
    this.onSeqChangeCb = cb
  }

  // ── Per-frame tick ───────────────────────────────────────────────────────

  update(delta: number): void {
    if (!this.playing) return
    const seq = this.sequences[this.seqIndex]
    if (!seq || seq.numFrames <= 1) return

    const fps = seq.fps > 0 ? seq.fps : 30
    this.frame += delta * fps * this.speed

    const numFrames = seq.numFrames
    const looping   = (seq.flags & STUDIO_LOOPING) !== 0

    if (looping) {
      // Wrap — same as HLSDK modulo logic
      this.frame = this.frame - Math.floor(this.frame / numFrames) * numFrames
      if (this.frame < 0) this.frame += numFrames
    } else {
      if (this.frame >= numFrames - 1) {
        this.frame   = numFrames - 1.001
        this.playing = false
      }
      if (this.frame < 0) this.frame = 0
    }

    const fi   = Math.floor(this.frame)
    const frac = this.frame - fi
    this.applyFrame(fi, frac)
    this.onFrameChangeCb?.(fi, numFrames)
  }

  // ── Frame application (morphs GPU buffers) ───────────────────────────────

  private applyFrame(frame: number, frac: number): void {
    for (const r of this.results) {
      const seqPos  = r.posFrames[this.seqIndex]
      const seqNorm = r.normFrames[this.seqIndex]
      if (!seqPos || seqPos.length === 0) continue

      const f0 = seqPos[Math.min(frame, seqPos.length - 1)]
      const f1 = seqPos[Math.min(frame + 1, seqPos.length - 1)]

      const posAttr = r.mesh.geometry.attributes['position']
      if (posAttr) {
        const arr = posAttr.array as Float32Array
        for (let i = 0; i < arr.length; i++) {
          arr[i] = f0[i] + (f1[i] - f0[i]) * frac
        }
        posAttr.needsUpdate = true
      }

      if (seqNorm && seqNorm.length > 0) {
        const n0 = seqNorm[Math.min(frame, seqNorm.length - 1)]
        const n1 = seqNorm[Math.min(frame + 1, seqNorm.length - 1)]
        const normAttr = r.mesh.geometry.attributes['normal']
        if (normAttr) {
          const narr = normAttr.array as Float32Array
          for (let i = 0; i < narr.length; i++) {
            narr[i] = n0[i] + (n1[i] - n0[i]) * frac
          }
          normAttr.needsUpdate = true
        }
      }
    }
  }
}
