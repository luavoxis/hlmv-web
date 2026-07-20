import { PerspectiveCamera, Vector3, Euler } from 'three'

export type ViewModeType = 'orbit' | 'firstperson' | 'freelook'

export class ViewModeController {
  mode: ViewModeType = 'orbit'

  // Orbit
  orbitTheta  = 0
  orbitPhi    = Math.PI / 4
  orbitRadius = 80
  orbitTarget = new Vector3(0, 0, 0)

  // FirstPerson (viewmodel POV)
  fpCamPos  = new Vector3(0, 0, 100)
  fpLookAt  = new Vector3(0, 0, 0)
  fpYaw     = 0
  fpPitch   = 0
  private _fpTarget = new Vector3()

  // FreeLook
  flPos   = new Vector3(0, 20, 80)
  flEuler = new Euler(0, 0, 0, 'YXZ')

  setMode(m: ViewModeType): void { this.mode = m }

  applyToCamera(cam: PerspectiveCamera): void {
    switch (this.mode) {
      case 'orbit':       this.applyOrbit(cam);       break
      case 'firstperson': this.applyFP(cam);          break
      case 'freelook':    this.applyFreeLook(cam);    break
    }
  }

  private applyOrbit(cam: PerspectiveCamera): void {
    const r = this.orbitRadius
    const x = r * Math.sin(this.orbitPhi) * Math.sin(this.orbitTheta)
    const y = r * Math.cos(this.orbitPhi)
    const z = r * Math.sin(this.orbitPhi) * Math.cos(this.orbitTheta)
    cam.position.set(x + this.orbitTarget.x, y + this.orbitTarget.y, z + this.orbitTarget.z)
    cam.lookAt(this.orbitTarget)
    cam.fov = 45
    cam.updateProjectionMatrix()
  }

  private applyFP(cam: PerspectiveCamera): void {
    cam.position.copy(this.fpCamPos)
    cam.lookAt(this.fpLookAt)
    cam.fov = 90
    cam.updateProjectionMatrix()
  }

  private applyFreeLook(cam: PerspectiveCamera): void {
    cam.position.copy(this.flPos)
    cam.rotation.copy(this.flEuler)
    cam.fov = 45
    cam.updateProjectionMatrix()
  }

  onMouseDrag(dx: number, dy: number): void {
    if (this.mode === 'orbit') {
      this.orbitTheta -= dx * 0.01
      this.orbitPhi    = Math.max(0.05, Math.min(Math.PI - 0.05, this.orbitPhi - dy * 0.01))
    } else if (this.mode === 'freelook') {
      this.flEuler.y -= dx * 0.005
      this.flEuler.x  = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.flEuler.x + dy * 0.005))
    }
  }

  onWheel(delta: number): void {
    if (this.mode === 'orbit') {
      this.orbitRadius = Math.max(5, Math.min(1000, this.orbitRadius + delta * 0.3))
    }
  }

  onKeyMove(dir: [number, number, number]): void {
    if (this.mode !== 'freelook') return
    const spd = 3, yaw = this.flEuler.y
    this.flPos.x += (dir[0] * Math.cos(yaw) + dir[2] * Math.sin(yaw)) * spd
    this.flPos.z += (-dir[0] * Math.sin(yaw) + dir[2] * Math.cos(yaw)) * spd
    this.flPos.y += dir[1] * spd
  }
}
