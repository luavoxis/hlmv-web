/**
 * main.ts — application entry point.
 * Wires all subsystems together and owns the game loop.
 */
import { Group, Vector3 } from 'three'
import { MDLParser }           from './io/MDLParser'
import { ModelBuilder }        from './renderer/ModelBuilder'
import { ModelViewer }         from './renderer/ModelViewer'
import { AnimationController } from './animation/AnimationController'
import { AppShell }            from './ui/AppShell'
import { FileLoader }          from './ui/FileLoader'
import { InfoPanel }           from './ui/InfoPanel'
import { AnimationBar }        from './ui/AnimationBar'
import { ViewModeSwitch }      from './ui/ViewModeSwitch'
import { ParsedMDL }           from './types/mdl'

// ── Bootstrap ─────────────────────────────────────────────────────────────

const root = document.getElementById('app')
if (!root) throw new Error('#app element not found')

const shell    = new AppShell(root)
const viewer   = new ModelViewer(shell.viewport)
const parser   = new MDLParser()
const builder  = new ModelBuilder()
const animCtrl = new AnimationController()

let currentGroup: Group | null = null
let emptyState:   HTMLElement | null = null

// ── UI wiring ─────────────────────────────────────────────────────────────

// Sidebar sections (hidden until model loads)
const infoSection  = shell.addSidebarSection('Model')
const infoContent  = infoSection.content
const infoPanel    = new InfoPanel(infoContent)
const infoWrapper  = infoSection.wrapper

const animSection  = shell.addSidebarSection('Animation')
const animContent  = animSection.content
const animBar      = new AnimationBar(animContent, animCtrl)
const animWrapper  = animSection.wrapper

infoWrapper.style.display = 'none'
animWrapper.style.display = 'none'

// Toolbar — Open button
const fileInput = new FileLoader((buf, name) => {
  console.log(`[hlmv] Loading "${name}" (${(buf.byteLength / 1024).toFixed(1)} KB)`)
  try {
    const mdl = parser.parse(buf)
    loadModel(mdl)
  } catch (err) {
    console.error('[hlmv] Parse error:', err)
    alert(`Failed to load model:\n${err}`)
  }
}).createInput()
document.body.appendChild(fileInput)

shell.addToolbarButton('Open', () => fileInput.click())

// View-mode switcher
const vmContainer = document.createElement('div')
shell.addToolbarElement(vmContainer)
new ViewModeSwitch(vmContainer, mode => viewer.setViewMode(mode))

// Drop zone on viewport
const fl2 = new FileLoader((buf, name) => {
  console.log(`[hlmv] Drop "${name}"`)
  try {
    loadModel(parser.parse(buf))
  } catch (err) {
    console.error('[hlmv] Parse error:', err)
  }
})
fl2.setupDropZone(shell.viewport)

// Empty state
emptyState = shell.showEmptyState()

// ── Model loader ─────────────────────────────────────────────────────────

function loadModel(mdl: ParsedMDL): void {
  // Remove previous model
  if (currentGroup) {
    viewer.scene.remove(currentGroup)
    currentGroup = null
  }
  if (emptyState) { emptyState.remove(); emptyState = null }

  const { group, results, eyePosition } = builder.build(mdl, parser)
  currentGroup = group
  viewer.scene.add(group)
  viewer.show()

  // Fit camera to model bounding box
  viewer.fitCamera(group, eyePosition)

  // Setup animation
  animCtrl.setModel(results, mdl.sequences)
  animBar.populate(mdl.sequences)

  // Register callbacks BEFORE playing
  animCtrl.setOnSeqChange(seq => {
    infoPanel.showSeq(seq)
    animBar.showSeq(seq)
    if (seq) animBar.selectSeq(animCtrl.getCurrentSeqIndex())
  })

  if (mdl.sequences.length > 0) {
    animCtrl.playSequence(0)
    animBar.selectSeq(0)
    infoPanel.showSeq(mdl.sequences[0])
  } else {
    infoPanel.showSeq(null)
  }

  infoPanel.showModel(mdl)

  // Show sidebar sections
  infoWrapper.style.display = ''
  animWrapper.style.display = ''
}

// ── Main loop ─────────────────────────────────────────────────────────────

let lastTime = performance.now()

function tick(): void {
  const now   = performance.now()
  const delta = Math.min((now - lastTime) / 1000, 0.1)  // cap at 100 ms
  lastTime = now

  animCtrl.update(delta)
  requestAnimationFrame(tick)
}

tick()
