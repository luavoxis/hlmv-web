import { StudioSeqDesc } from '../types/mdl'
import { AnimationController } from '../animation/AnimationController'

export class AnimationBar {
  private sel:         HTMLSelectElement
  private playBtn:     HTMLButtonElement
  private frameSlider: HTMLInputElement
  private frameLabel:  HTMLSpanElement
  private timeLabel:   HTMLSpanElement
  private speedSlider: HTMLInputElement
  private speedLabel:  HTMLSpanElement
  private guard = false

  constructor(container: HTMLElement, private anim: AnimationController) {
    container.innerHTML = ''

    // ── Sequence selector ────────────────────────────────────────────────
    this.sel = document.createElement('select')
    this.sel.className = 'anim-select'
    this.sel.addEventListener('change', () => {
      if (!this.guard) this.anim.playSequence(this.sel.selectedIndex)
    })
    container.appendChild(this.sel)

    // ── Play controls row ────────────────────────────────────────────────
    const row1 = document.createElement('div')
    row1.className = 'anim-row'

    this.playBtn = document.createElement('button')
    this.playBtn.className = 'anim-play'
    this.playBtn.title = 'Play / Pause'
    this.playBtn.addEventListener('click', () => { this.anim.toggle(); this.syncBtn() })
    row1.appendChild(this.playBtn)

    this.frameLabel = document.createElement('span')
    this.frameLabel.className = 'anim-framelabel'
    row1.appendChild(this.frameLabel)

    this.timeLabel = document.createElement('span')
    this.timeLabel.className = 'anim-time'
    row1.appendChild(this.timeLabel)

    container.appendChild(row1)

    // ── Frame scrub slider ───────────────────────────────────────────────
    this.frameSlider = document.createElement('input')
    this.frameSlider.type = 'range'
    this.frameSlider.min  = '0'
    this.frameSlider.max  = '0'
    this.frameSlider.value = '0'
    this.frameSlider.className = 'anim-slider'
    this.frameSlider.addEventListener('input', () => {
      if (!this.guard) {
        this.anim.setFrame(parseInt(this.frameSlider.value))
      }
    })
    container.appendChild(this.frameSlider)

    // ── Speed row ────────────────────────────────────────────────────────
    const row2 = document.createElement('div')
    row2.className = 'anim-row'

    this.speedSlider = document.createElement('input')
    this.speedSlider.type  = 'range'
    this.speedSlider.min   = '0.1'
    this.speedSlider.max   = '3'
    this.speedSlider.step  = '0.05'
    this.speedSlider.value = '1'
    this.speedSlider.className = 'anim-slider'
    this.speedSlider.addEventListener('input', () => {
      const v = parseFloat(this.speedSlider.value)
      this.anim.setSpeed(v)
      this.speedLabel.textContent = v.toFixed(1) + 'x'
    })
    row2.appendChild(this.speedSlider)

    this.speedLabel = document.createElement('span')
    this.speedLabel.className = 'anim-speedlabel'
    this.speedLabel.textContent = '1.0x'
    row2.appendChild(this.speedLabel)
    container.appendChild(row2)

    // ── Callbacks from controller ────────────────────────────────────────
    anim.setOnFrameChange((frame, total) => {
      this.guard = true
      const seq = anim.getCurrentSequence()
      const fps = seq && seq.fps > 0 ? seq.fps : 30
      this.frameLabel.textContent = `${frame + 1} / ${total}`
      this.frameSlider.max   = String(Math.max(0, total - 1))
      this.frameSlider.value = String(frame)

      const cur = frame / fps
      const tot = total / fps
      this.timeLabel.textContent = `${this.fmtTime(cur)} / ${this.fmtTime(tot)}`
      this.guard = false
    })

    this.syncBtn()
  }

  private fmtTime(sec: number): string {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  showSeq(seq: StudioSeqDesc | null): void {
    this.syncBtn()
    if (!seq) return
    this.guard = true
    const fps = seq.fps > 0 ? seq.fps : 30
    this.frameLabel.textContent = `1 / ${seq.numFrames}`
    this.frameSlider.max   = String(Math.max(0, seq.numFrames - 1))
    this.frameSlider.value = '0'
    this.timeLabel.textContent = `0:00 / ${this.fmtTime(seq.numFrames / fps)}`
    this.guard = false
  }

  populate(seqs: StudioSeqDesc[]): void {
    this.guard = true
    this.sel.innerHTML = ''
    seqs.forEach((s, i) => {
      const o = document.createElement('option')
      o.value = String(i)
      o.textContent = s.label.trim() || `seq_${i}`
      this.sel.appendChild(o)
    })
    this.guard = false
  }

  selectSeq(index: number): void {
    this.guard = true
    this.sel.selectedIndex = index
    this.guard = false
  }

  private syncBtn(): void {
    this.playBtn.innerHTML = this.anim.isPlaying()
      ? `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="4.5" y="3" width="2.5" height="10"/><rect x="9" y="3" width="2.5" height="10"/></svg>`
      : `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><polygon points="4 2.5 13 8 4 13.5"/></svg>`
  }
}
