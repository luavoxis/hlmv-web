import { ParsedMDL, StudioSeqDesc } from '../types/mdl'

export class InfoPanel {
  private readonly root: HTMLElement

  constructor(container: HTMLElement) {
    this.root = container
  }

  showModel(mdl: ParsedMDL): void {
    const h = mdl.header
    const name = h.name.trim() || 'unnamed'

    this.root.innerHTML = `
      <div class="info-name">${this.esc(name)}</div>
      <div class="info-grid">
        ${this.row('File size',    (h.length / 1024).toFixed(1) + ' KB')}
        ${this.row('Bones',        h.numBones)}
        ${this.row('Sequences',    h.numSeq)}
        ${this.row('Textures',     h.numTextures)}
        ${this.row('Body parts',   h.numBodyParts)}
        ${this.row('Skin families',h.numSkinFamilies)}
        ${this.row('Hitboxes',     h.numHitboxes)}
        ${this.row('Attachments',  h.numAttachments)}
      </div>`
  }

  showSeq(seq: StudioSeqDesc | null): void {
    // Remove old seq block if present
    const old = this.root.querySelector('.info-seq')
    if (old) old.remove()
    if (!seq) return

    const div = document.createElement('div')
    div.className = 'info-seq'
    div.innerHTML = `
      <div class="info-seq-name">▶ ${this.esc(seq.label.trim() || 'unnamed')}</div>
      <div class="info-grid">
        ${this.row('Frames', seq.numFrames)}
        ${this.row('FPS',    seq.fps.toFixed(1))}
        ${this.row('Blends', seq.numBlends)}
      </div>`
    this.root.appendChild(div)
  }

  private row(label: string, value: string | number): string {
    return `<span class="info-label">${label}</span><span class="info-val">${value}</span>`
  }

  private esc(s: string): string {
    const d = document.createElement('span')
    d.textContent = s
    return d.innerHTML
  }
}
