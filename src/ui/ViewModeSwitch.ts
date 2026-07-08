import { ViewModeType } from '../renderer/ViewMode'

const MODES: { id: ViewModeType; label: string; title: string }[] = [
  { id: 'orbit',       label: 'Orbit',  title: 'Orbital camera (drag to rotate, scroll to zoom)' },
  { id: 'firstperson', label: 'FPS',    title: 'Fixed first-person view' },
  { id: 'freelook',    label: 'Free',   title: 'Free camera (WASD + drag)' },
]

export class ViewModeSwitch {
  private btns: HTMLButtonElement[] = []

  constructor(container: HTMLElement, onChange: (mode: ViewModeType) => void) {
    const wrap = document.createElement('div')
    wrap.className = 'vm-group'

    MODES.forEach((m, i) => {
      const b = document.createElement('button')
      b.className = 'vm-btn'
      b.textContent = m.label
      b.title = m.title
      b.addEventListener('click', () => { this.setActive(i); onChange(m.id) })
      this.btns.push(b)
      wrap.appendChild(b)
    })

    this.setActive(0)
    container.appendChild(wrap)
  }

  setActive(idx: number): void {
    this.btns.forEach((b, i) => b.classList.toggle('active', i === idx))
  }
}
