import { StudioSeqDesc } from '../types/mdl'
import { AnimationController } from '../animation/AnimationController'

export class AnimationBar {
  private sel:         HTMLSelectElement
  private playBtn:     HTMLButtonElement
  private restartBtn:  HTMLButtonElement
  private frameSlider: HTMLInputElement
  private frameLabel:  HTMLSpanElement
  private timeLabel:   HTMLSpanElement
  private speedSlider: HTMLInputElement
  private speedLabel:  HTMLSpanElement
  private speedPresets: HTMLButtonElement[] = []
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

    this.restartBtn = document.createElement('button')
    this.restartBtn.className = 'anim-restart'
    this.restartBtn.title = 'Restart sequence'
    this.restartBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>`
    this.restartBtn.addEventListener('click', () => { this.anim.playSequence(this.anim.getCurrentSeqIndex()) })
    row1.appendChild(this.restartBtn)

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
        this.updateSliderFill(this.frameSlider)
      }
    })
    container.appendChild(this.frameSlider)

    // ── Speed row ────────────────────────────────────────────────────────
    const row2 = document.createElement('div')
    row2.className = 'anim-row'

    const speedLbl = document.createElement('span')
    speedLbl.className = 'anim-label'
    speedLbl.textContent = 'Speed'
    row2.appendChild(speedLbl)

    const presetValues = [0.5, 1, 2]
    for (const v of presetValues) {
      const btn = document.createElement('button')
      btn.className = 'anim-speed-preset'
      btn.textContent = v + 'x'
      if (v === 1) btn.classList.add('active')
      btn.addEventListener('click', () => {
        this.anim.setSpeed(v)
        this.speedSlider.value = String(v)
        this.speedLabel.textContent = v.toFixed(1) + 'x'
        this.updateSliderFill(this.speedSlider)
        this.syncSpeedPresets(v)
      })
      this.speedPresets.push(btn)
      row2.appendChild(btn)
    }

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
      this.updateSliderFill(this.speedSlider)
      this.syncSpeedPresets(v)
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
      this.updateSliderFill(this.frameSlider)

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

  private updateSliderFill(el: HTMLInputElement): void {
    const min = parseFloat(el.min)
    const max = parseFloat(el.max)
    const val = parseFloat(el.value)
    const pct = max > min ? ((val - min) / (max - min)) * 100 : 0
    el.style.setProperty('--pct', String(pct))
  }

  private syncSpeedPresets(v: number): void {
    this.speedPresets.forEach(btn => {
      btn.classList.toggle('active', Math.abs(parseFloat(btn.textContent || '0') - v) < 0.01)
    })
  }

  showSeq(seq: StudioSeqDesc | null): void {
    this.syncBtn()
    if (!seq) return
    this.guard = true
    const fps = seq.fps > 0 ? seq.fps : 30
    this.frameLabel.textContent = `1 / ${seq.numFrames}`
    this.frameSlider.max   = String(Math.max(0, seq.numFrames - 1))
    this.frameSlider.value = '0'
    this.updateSliderFill(this.frameSlider)
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
      ? `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21"/></svg>`
  }
}
