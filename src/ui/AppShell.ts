/**
 * AppShell — builds the full application layout:
 *
 *   ┌──────────────────────────────────────────────┐
 *   │  topbar (glass, floats over viewport)        │
 *   │  ┌─────────────────────┐  ┌──────────────┐  │
 *   │  │  viewport (Three.js)│  │ sidebar      │  │
 *   │  │                     │  │ (floating)   │  │
 *   │  └─────────────────────┘  └──────────────┘  │
 *   └──────────────────────────────────────────────┘
 */
export class AppShell {
  readonly viewport:  HTMLElement
  readonly sidebar:   HTMLElement
  readonly header:    HTMLElement

  private toolbar:      HTMLElement
  private toolbarRight: HTMLElement
  private drawerOpen  = false
  private isMobile    = false
  private toggleBtn:  HTMLElement | null = null
  private fabBtn:     HTMLElement | null = null

  constructor(root: HTMLElement) {
    this.isMobile = window.innerWidth < 768

    const shell = this.el('div', 'shell')
    root.appendChild(shell)

    // ── Topbar ──────────────────────────────────────────────────────
    this.header = this.el('header', 'topbar')

    this.toolbar = this.el('div', 'toolbar')
    this.header.appendChild(this.toolbar)

    this.toolbarRight = this.el('div', 'toolbar-right')
    this.header.appendChild(this.toolbarRight)

    shell.appendChild(this.header)

    // ── Body ────────────────────────────────────────────────────────
    const body = this.el('div', 'body')
    shell.appendChild(body)

    this.viewport = this.el('div', 'viewport')
    body.appendChild(this.viewport)

    // ── Sidebar (floating panel) ────────────────────────────────────
    this.sidebar = this.el('div', 'sidebar')
    body.appendChild(this.sidebar)

    // Sidebar header with title + close button
    const sidebarHeader = this.el('div', 'sidebar-header')
    const sidebarTitle = this.el('span', 'sidebar-header-title')
    sidebarTitle.textContent = 'Properties'
    sidebarHeader.appendChild(sidebarTitle)
    const closeBtn = this.el('button', 'sb-close') as HTMLButtonElement
    closeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
    closeBtn.addEventListener('click', () => this.toggleSidebar())
    sidebarHeader.appendChild(closeBtn)
    this.sidebar.appendChild(sidebarHeader)

    // Drawer handle (mobile)
    const handle = this.el('div', 'drawer-handle')
    handle.addEventListener('click', () => this.toggleSidebar())
    this.sidebar.insertBefore(handle, this.sidebar.firstChild)

    // ── Sidebar toggle button (desktop) ─────────────────────────────
    const toggle = this.el('button', 'sidebar-toggle') as HTMLButtonElement
    toggle.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`
    toggle.addEventListener('click', () => this.toggleSidebar())
    toggle.style.display = 'none'
    body.appendChild(toggle)
    this.toggleBtn = toggle

    // ── Mobile FAB ──────────────────────────────────────────────────
    const fab = this.el('button', 'fab') as HTMLButtonElement
    fab.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`
    fab.addEventListener('click', () => this.toggleSidebar())
    fab.style.display = 'none'
    this.viewport.appendChild(fab)
    this.fabBtn = fab

    window.addEventListener('resize', () => {
      const m = window.innerWidth < 768
      if (m !== this.isMobile) { this.isMobile = m; this.drawerOpen = true; this.syncSidebar() }
    })
  }

  addToolbarButton(label: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button')
    b.className = 'tbtn'
    b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg><span>${label}</span>`
    b.addEventListener('click', onClick)
    this.toolbar.appendChild(b)
    return b
  }

  addToolbarElement(el: HTMLElement): void {
    this.toolbarRight.appendChild(el)
  }

  addSidebarSection(title: string): { wrapper: HTMLElement; content: HTMLElement } {
    const sec = this.el('div', 'sb-section')
    const hdr = this.el('div', 'sb-title')
    hdr.textContent = title
    sec.appendChild(hdr)
    const content = this.el('div', 'sb-content')
    sec.appendChild(content)
    this.sidebar.appendChild(sec)
    return { wrapper: sec, content }
  }

  showEmptyState(): HTMLElement {
    const el = this.el('div', 'empty')
    el.innerHTML = `
      <div class="empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="12" y1="18" x2="12" y2="12"/>
          <polyline points="9 15 12 12 15 15"/>
        </svg>
      </div>
      <p class="empty-title">Drop a .mdl file</p>
      <p class="empty-sub">or click <strong>Open</strong> in the toolbar</p>`
    this.viewport.appendChild(el)
    return el
  }

  openSidebar(): void {
    this.drawerOpen = true
    this.syncSidebar()
  }

  private toggleSidebar(): void {
    this.drawerOpen = !this.drawerOpen
    this.syncSidebar()
  }

  private syncSidebar(): void {
    this.sidebar.classList.toggle('open', this.drawerOpen)
    // Toggle button: visible only when sidebar is closed
    if (this.toggleBtn) {
      this.toggleBtn.style.display = this.drawerOpen ? 'none' : ''
    }
    // Mobile fab: visible only when sidebar is closed
    if (this.fabBtn && this.isMobile) {
      this.fabBtn.style.display = this.drawerOpen ? 'none' : ''
    }
  }

  private el(tag: string, cls?: string): HTMLElement {
    const e = document.createElement(tag)
    if (cls) e.className = cls
    return e
  }
}
