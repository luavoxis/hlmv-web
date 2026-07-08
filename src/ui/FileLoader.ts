/**
 * FileLoader — handles file input (<input type=file>) and drag-drop.
 */
export class FileLoader {
  private readonly cb: (buf: ArrayBuffer, name: string) => void
  private overlay: HTMLElement | null = null

  constructor(onLoad: (buf: ArrayBuffer, name: string) => void) {
    this.cb = onLoad
  }

  createInput(): HTMLInputElement {
    const inp = document.createElement('input')
    inp.type    = 'file'
    inp.accept  = '.mdl'
    inp.style.display = 'none'
    inp.addEventListener('change', () => this.handleFiles(inp.files))
    return inp
  }

  setupDropZone(zone: HTMLElement): void {
    // Dim overlay shown while dragging
    this.overlay = document.createElement('div')
    this.overlay.className = 'drop-overlay'
    this.overlay.innerHTML = `
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
           stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
      <span>Drop .mdl here</span>`
    zone.appendChild(this.overlay)

    let depth = 0
    zone.addEventListener('dragenter', e => { e.preventDefault(); depth++; this.overlay!.classList.add('active') })
    zone.addEventListener('dragover',  e => e.preventDefault())
    zone.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; this.overlay!.classList.remove('active') } })
    zone.addEventListener('drop', e => {
      e.preventDefault(); depth = 0; this.overlay!.classList.remove('active')
      if (e.dataTransfer?.files) this.handleFiles(e.dataTransfer.files)
    })
  }

  private handleFiles(files: FileList | null): void {
    if (!files || files.length === 0) return
    const f  = files[0]
    const fr = new FileReader()
    fr.onload = () => { if (fr.result instanceof ArrayBuffer) this.cb(fr.result, f.name) }
    fr.readAsArrayBuffer(f)
  }
}
