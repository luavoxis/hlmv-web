/**
 * AppShell — builds the full application layout:
 *
 *   ┌──────────────────────────────────────────────┐
 *   │  #header  (logo + toolbar)                   │
 *   ├───────────────────────┬──────────────────────┤
 *   │  #viewport (Three.js) │  #sidebar            │
 *   │                       │   · model info       │
 *   │                       │   · animation ctrl   │
 *   └───────────────────────┴──────────────────────┘
 *
 * On mobile (<768 px) the sidebar collapses to a bottom drawer.
 */
export class AppShell {
  readonly viewport:  HTMLElement
  readonly sidebar:   HTMLElement
  readonly header:    HTMLElement

  private toolbar:      HTMLElement
  private toolbarRight: HTMLElement
  private drawerOpen  = true
  private isMobile    = false

  constructor(root: HTMLElement) {
    this.isMobile = window.innerWidth < 768

    // ── Shell wrapper ─────────────────────────────────────────────────────
    const shell = this.el('div', 'shell')
    root.appendChild(shell)

    // ── Header ────────────────────────────────────────────────────────────
    this.header = this.el('header', 'topbar')

    const logo = this.el('div', 'logo')
    logo.innerHTML = `<span class="logo-hl">hlmv</span><span class="logo-dot">·</span><span class="logo-sub">web</span>`
    this.header.appendChild(logo)

    this.toolbar = this.el('div', 'toolbar')
    this.header.appendChild(this.toolbar)

    this.toolbarRight = this.el('div', 'toolbar-right')
    this.header.appendChild(this.toolbarRight)

    shell.appendChild(this.header)

    // ── Body ──────────────────────────────────────────────────────────────
    const body = this.el('div', 'body')
    shell.appendChild(body)

    this.viewport = this.el('div', 'viewport')
    body.appendChild(this.viewport)

    this.sidebar = this.el('div', 'sidebar')
    this.sidebar.classList.add('open')
    body.appendChild(this.sidebar)

    // Mobile: toggle button (FAB)
    const fab = this.el('button', 'fab') as HTMLButtonElement
    fab.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`
    fab.addEventListener('click', () => this.toggleSidebar())
    this.viewport.appendChild(fab)

    // Drag handle on mobile drawer
    const handle = this.el('div', 'drawer-handle')
    handle.addEventListener('click', () => this.toggleSidebar())
    this.sidebar.insertBefore(handle, this.sidebar.firstChild)

    window.addEventListener('resize', () => {
      const m = window.innerWidth < 768
      if (m !== this.isMobile) { this.isMobile = m; this.drawerOpen = true; this.syncSidebar() }
    })
  }

  // ── Public helpers ────────────────────────────────────────────────────────

  /** Add a primary action button to the left toolbar. */
  addToolbarButton(label: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button')
    b.className = 'tbtn'
    b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg><span>${label}</span>`
    b.addEventListener('click', onClick)
    this.toolbar.appendChild(b)
    return b
  }

  /** Add any element to the right toolbar area. */
  addToolbarElement(el: HTMLElement): void {
    this.toolbarRight.appendChild(el)
  }

  /** Add a titled section to the sidebar and return its content div. */
  addSidebarSection(title: string): HTMLElement {
    const sec = this.el('div', 'sb-section')

    const hdr = this.el('div', 'sb-title')
    hdr.textContent = title
    sec.appendChild(hdr)

    const content = this.el('div', 'sb-content')
    sec.appendChild(content)
    this.sidebar.appendChild(sec)
    return content
  }

  /** Show the "drop a file" empty state over the viewport. */
  showEmptyState(): HTMLElement {
    const el = this.el('div', 'empty')
    el.innerHTML = `
      <div class="empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      </div>
      <p class="empty-title">Drop a .mdl file</p>
      <p class="empty-sub">or click <strong>Open</strong> in the toolbar</p>`
    this.viewport.appendChild(el)
    return el
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private toggleSidebar(): void {
    this.drawerOpen = !this.drawerOpen
    this.syncSidebar()
  }

  private syncSidebar(): void {
    this.sidebar.classList.toggle('open', this.drawerOpen)
  }

  private el(tag: string, cls?: string): HTMLElement {
    const e = document.createElement(tag)
    if (cls) e.className = cls
    return e
  }
}
