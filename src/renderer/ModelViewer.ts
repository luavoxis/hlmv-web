/**
 * ModelViewer — owns the Three.js WebGL scene, camera, lights, and render loop.
 */
import {
  WebGLRenderer, Scene, PerspectiveCamera,
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
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.outputColorSpace = 'srgb' as any
    this.renderer.domElement.style.display = 'none'
    container.appendChild(this.renderer.domElement)

    this.scene  = new Scene()
    this.camera = new PerspectiveCamera(70, 1, 0.1, 5000)

    this.scene.add(new AmbientLight(0xffffff, 1.02))
    this.scene.add(new HemisphereLight(0xffffff, 0x475569, 0.72))

    const key = new DirectionalLight(0xffffff, 1.48)
    key.position.set(-120, 220, 160)
    this.scene.add(key)

    const fill = new DirectionalLight(0xd8e8ff, 0.56)
    fill.position.set(120, -80, -140)
    this.scene.add(fill)

    this.viewMode = new ViewModeController()

    this.setupInput(container)
    this.setupResize(container)
    this.resize(container)
    this.startRenderLoop()
  }

  // ── Fit camera parameters to a loaded model ───────────────────────────────
  // The model group NEVER moves — camera is always adjusted around it.

  fitCamera(object: Object3D, eyePosition?: Vector3): void {
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
    const c = sphere.center
    const r = sphere.radius

    // ── Orbit ─────────────────────────────────────────────────────────────
    this.viewMode.orbitTarget.copy(c)
    this.viewMode.orbitRadius = Math.max(r * 2.5, 10)
    this.viewMode.orbitTheta  = Math.PI
    this.viewMode.orbitPhi    = Math.PI / 2

    // ── FPS / Weapon-Origin POV ──────────────────────────────────────────
    // Camera position = MDL eyePosition (already rotated by container).
    // Forward = (1,0,0) rotated by container (-90° X, -90° Z) = (0,0,1) = +Z.
    // Up = (0,0,1) rotated = (0,1,0) = +Y.
    const fpPos = eyePosition ?? new Vector3(c.x, c.y + r * 0.4, c.z + r * 0.8)
    const fpFwd = new Vector3(0, 0, 1)  // forward after (-90,0,-90) rotation
    this.viewMode.fpCamPos.copy(fpPos)
    this.viewMode.fpLookAt.copy(fpPos).addScaledVector(fpFwd, 100)
    this.viewMode.fpYaw   = 0
    this.viewMode.fpPitch = 0

    // Auto-zoom: project all 8 bounding box corners through camera
    // to ensure the model fits in view (FOV=54).
    this.camera.fov = 16
    this.camera.near = 0.01
    this.camera.position.copy(fpPos)
    this.camera.lookAt(this.viewMode.fpLookAt)
    this.camera.up.set(0, 1, 0)
    this.camera.zoom = 1
    this.camera.updateProjectionMatrix()

    let maxExtent = 0
    const corners = [
      new Vector3(box.min.x, box.min.y, box.min.z),
      new Vector3(box.min.x, box.min.y, box.max.z),
      new Vector3(box.min.x, box.max.y, box.min.z),
      new Vector3(box.min.x, box.max.y, box.max.z),
      new Vector3(box.max.x, box.min.y, box.min.z),
      new Vector3(box.max.x, box.min.y, box.max.z),
      new Vector3(box.max.x, box.max.y, box.min.z),
      new Vector3(box.max.x, box.max.y, box.max.z),
    ]
    this.camera.updateMatrixWorld(true)
    const inv = this.camera.matrixWorldInverse
    for (const corner of corners) {
      const projected = corner.clone().applyMatrix4(inv)
      if (projected.z >= -this.camera.near) continue
      projected.project(this.camera)
      if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y)) continue
      maxExtent = Math.max(maxExtent, Math.abs(projected.x), Math.abs(projected.y))
    }
    if (maxExtent > 0) {
      this.camera.zoom = Math.min(Math.max(0.56 / maxExtent, 0.18), 1)
      this.camera.updateProjectionMatrix()
    }

    // ── FreeLook ──────────────────────────────────────────────────────────
    this.viewMode.flPos.set(c.x, c.y + r * 0.3, c.z + r * 2.5)
  }

  /** Switch view mode — model group stays at origin, only camera changes. */
  setViewMode(mode: import('./ViewMode').ViewModeType): void {
    this.viewMode.setMode(mode)
  }

  show(): void {
    this.renderer.domElement.style.display = 'block'
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
