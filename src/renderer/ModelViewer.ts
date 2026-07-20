/**
 * ModelViewer — owns the Three.js WebGL scene, camera, lights, and render loop.
 */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Color,
  AmbientLight, DirectionalLight, HemisphereLight,
  Box3, Sphere, Object3D, Vector3,
} from 'three'
import { ViewModeController } from './ViewMode'

export class ModelViewer {
  readonly renderer:  WebGLRenderer
  readonly scene:     Scene
  readonly camera:    PerspectiveCamera
  readonly viewMode:  ViewModeController

  private rafId = 0
  private ro: ResizeObserver | null = null
  private isDragging = false
  private lastX = 0
  private lastY = 0
  private keys  = new Set<string>()

  constructor(container: HTMLElement) {
    this.renderer = new WebGLRenderer({ antialias: true, alpha: false })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setClearColor(new Color(0x111111))
    this.renderer.toneMapping = 4          // ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.2
    container.appendChild(this.renderer.domElement)

    this.scene  = new Scene()
    this.camera = new PerspectiveCamera(45, 1, 0.1, 5000)

    this.scene.add(new HemisphereLight(0x3b6cc9, 0x332211, 0.6))
    this.scene.add(new AmbientLight(0x202030, 0.4))

    const key = new DirectionalLight(0xffffff, 2.0)
    key.position.set(80, 120, 60)
    this.scene.add(key)

    const fill = new DirectionalLight(0x8899ff, 0.5)
    fill.position.set(-60, 40, -80)
    this.scene.add(fill)

    const rim = new DirectionalLight(0x4477cc, 0.6)
    rim.position.set(0, -60, -100)
    this.scene.add(rim)

    this.viewMode = new ViewModeController()

    this.setupInput(container)
    this.setupResize(container)
    this.resize(container)
    this.startRenderLoop()
  }

  // ── Fit camera parameters to a loaded model ───────────────────────────────
  // The model group NEVER moves — camera is always adjusted around it.

  fitCamera(object: Object3D): void {
    // Make sure matrix is up to date before measuring
    object.updateMatrixWorld(true)

    const box = new Box3().setFromObject(object)

    if (box.isEmpty()) {
      this.viewMode.orbitTarget.set(0, 0, 0)
      this.viewMode.orbitRadius = 100
      this.viewMode.fpCamPos.set(0, 20, 50)
      this.viewMode.fpLookAt.set(0, 0, 0)
      this.viewMode.flPos.set(0, 30, 100)
      return
    }

    const sphere = new Sphere()
    box.getBoundingSphere(sphere)
    const c = sphere.center   // world-space centre after rotation
    const r = sphere.radius

    console.log(`[fitCamera] bbox centre=(${c.x.toFixed(1)}, ${c.y.toFixed(1)}, ${c.z.toFixed(1)}) r=${r.toFixed(1)}`)
    console.log(`[fitCamera] bbox min=(${box.min.x.toFixed(1)}, ${box.min.y.toFixed(1)}, ${box.min.z.toFixed(1)}) max=(${box.max.x.toFixed(1)}, ${box.max.y.toFixed(1)}, ${box.max.z.toFixed(1)})`)
    console.log(`[fitCamera] fpCamPos=(${this.viewMode.fpCamPos.x.toFixed(1)}, ${this.viewMode.fpCamPos.y.toFixed(1)}, ${this.viewMode.fpCamPos.z.toFixed(1)}) fpLookAt=(${this.viewMode.fpLookAt.x.toFixed(1)}, ${this.viewMode.fpLookAt.y.toFixed(1)}, ${this.viewMode.fpLookAt.z.toFixed(1)})`)

    // ── Orbit ─────────────────────────────────────────────────────────────
    // Camera orbits around the bounding sphere centre.
    // phi=PI/2 → equator level (straight ahead, no tilt)
    // theta=PI → look at model from the front (+Z face, because GoldSrc
    //            models face -Y which becomes +Z after -90° X rotation)
    this.viewMode.orbitTarget.copy(c)
    this.viewMode.orbitRadius = Math.max(r * 2.5, 10)
    this.viewMode.orbitTheta  = Math.PI   // front view
    this.viewMode.orbitPhi    = Math.PI / 2   // eye level

    // ── FPS / ViewModel POV ───────────────────────────────────────────────
    // Barrel = +X. Camera sits behind (-X), above (+Y), and right (+Z) of
    // the weapon, looking straight along +X. This places the weapon in the
    // lower-left of the viewport with the barrel extending upper-right —
    // matching the classic CS 1.6 first-person viewmodel.
    this.viewMode.fpCamPos.set(c.x - r * 0.6, c.y + r * 0.45, c.z + r * 0.35)
    this.viewMode.fpLookAt.set(c.x + r * 10, c.y + r * 0.1, c.z)
    this.viewMode.fpYaw   = 0
    this.viewMode.fpPitch = 0

    // ── FreeLook ──────────────────────────────────────────────────────────
    this.viewMode.flPos.set(c.x, c.y + r * 0.3, c.z + r * 2.5)
  }

  /** Switch view mode — model group stays at origin, only camera changes. */
  setViewMode(mode: import('./ViewMode').ViewModeType): void {
    this.viewMode.setMode(mode)
  }

  // ── Input ─────────────────────────────────────────────────────────────────

  private setupInput(el: HTMLElement): void {
    el.addEventListener('mousedown', e => {
      this.isDragging = true
      this.lastX = e.clientX; this.lastY = e.clientY
      el.style.cursor = 'grabbing'
    })
    window.addEventListener('mousemove', e => {
      if (!this.isDragging) return
      this.viewMode.onMouseDrag(e.clientX - this.lastX, e.clientY - this.lastY)
      this.lastX = e.clientX; this.lastY = e.clientY
    })
    window.addEventListener('mouseup', () => {
      this.isDragging = false; el.style.cursor = 'default'
    })
    el.addEventListener('wheel', e => {
      e.preventDefault(); this.viewMode.onWheel(e.deltaY)
    }, { passive: false })

    let lastDist = 0
    el.addEventListener('touchstart', e => {
      if (e.touches.length === 1) {
        this.isDragging = true
        this.lastX = e.touches[0].clientX; this.lastY = e.touches[0].clientY
      } else if (e.touches.length === 2) {
        lastDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY)
      }
    }, { passive: true })
    el.addEventListener('touchmove', e => {
      e.preventDefault()
      if (e.touches.length === 1 && this.isDragging) {
        this.viewMode.onMouseDrag(e.touches[0].clientX - this.lastX, e.touches[0].clientY - this.lastY)
        this.lastX = e.touches[0].clientX; this.lastY = e.touches[0].clientY
      } else if (e.touches.length === 2) {
        const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY)
        this.viewMode.onWheel((lastDist - d) * 2); lastDist = d
      }
    }, { passive: false })
    el.addEventListener('touchend', () => { this.isDragging = false })

    window.addEventListener('keydown', e => this.keys.add(e.key.toLowerCase()))
    window.addEventListener('keyup',   e => this.keys.delete(e.key.toLowerCase()))
  }

  private setupResize(el: HTMLElement): void {
    if ('ResizeObserver' in window) {
      this.ro = new ResizeObserver(() => this.resize(el))
      this.ro.observe(el)
    }
    window.addEventListener('resize', () => this.resize(el))
  }

  private resize(el: HTMLElement): void {
    const w = el.clientWidth || 1, h = el.clientHeight || 1
    this.renderer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  private startRenderLoop(): void {
    const tick = () => {
      this.rafId = requestAnimationFrame(tick)
      let dx = 0, dy = 0, dz = 0
      if (this.keys.has('w')) dz =  1
      if (this.keys.has('s')) dz = -1
      if (this.keys.has('a')) dx = -1
      if (this.keys.has('d')) dx =  1
      if (this.keys.has('q')) dy =  1
      if (this.keys.has('e')) dy = -1
      if (dx || dy || dz) this.viewMode.onKeyMove([dx, dy, dz])

      this.viewMode.applyToCamera(this.camera)
      this.renderer.render(this.scene, this.camera)
    }
    tick()
  }

  dispose(): void {
    cancelAnimationFrame(this.rafId)
    this.ro?.disconnect()
    this.renderer.dispose()
  }
}
