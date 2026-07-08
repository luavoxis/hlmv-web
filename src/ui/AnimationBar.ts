import { StudioSeqDesc } from '../types/mdl'
import { AnimationController } from '../animation/AnimationController'

export class AnimationBar {
  private sel:        HTMLSelectElement
  private playBtn:    HTMLButtonElement
  private frameSlider: HTMLInputElement
  private frameLabel:  HTMLSpanElement
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
    this.playBtn.addEventListener('click', () => { this.anim.toggle(); this.syncBtn() })
    row1.appendChild(this.playBtn)

    this.frameLabel = document.createElement('span')
    this.frameLabel.className = 'anim-framelabel'
    this.frameLabel.textContent = '0 / 0'
    row1.appendChild(this.frameLabel)
    container.appendChild(row1)

    // ── Frame scrub slider ───────────────────────────────────────────────
    this.frameSlider = document.createElement('input')
    this.frameSlider.type = 'range'
    this.frameSlider.min  = '0'
    this.frameSlider.max  = '0'
    this.frameSlider.value = '0'
    this.frameSlider.className = 'anim-slider'
    this.frameSlider.addEventListener('input', () => {
      if (!this.guard) this.anim.setFrame(parseInt(this.frameSlider.value))
    })
    container.appendChild(this.frameSlider)

    // ── Speed row ────────────────────────────────────────────────────────
    const row2 = document.createElement('div')
    row2.className = 'anim-row'

    const speedLbl = document.createElement('span')
    speedLbl.className = 'anim-label'
    speedLbl.textContent = 'Speed'
    row2.appendChild(speedLbl)

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
      this.speedLabel.textContent = v.toFixed(2) + 'x'
    })
    row2.appendChild(this.speedSlider)

    this.speedLabel = document.createElement('span')
    this.speedLabel.className = 'anim-speedlabel'
    this.speedLabel.textContent = '1.00x'
    row2.appendChild(this.speedLabel)
    container.appendChild(row2)

    // ── Callbacks from controller ────────────────────────────────────────
    anim.setOnFrameChange((frame, total) => {
      this.guard = true
      this.frameLabel.textContent = `${frame + 1} / ${total}`
      this.frameSlider.max   = String(Math.max(0, total - 1))
      this.frameSlider.value = String(frame)
      this.guard = false
    })

    anim.setOnSeqChange(seq => {
      this.syncBtn()
      if (!seq) return
      this.guard = true
      this.frameLabel.textContent = `1 / ${seq.numFrames}`
      this.frameSlider.max   = String(Math.max(0, seq.numFrames - 1))
      this.frameSlider.value = '0'
      this.guard = false
    })

    this.syncBtn()
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
