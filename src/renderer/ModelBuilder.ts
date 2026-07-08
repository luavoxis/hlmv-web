/**
 * ModelBuilder — builds Three.js meshes from a ParsedMDL.
 *
 * Bone math is ported 1:1 from HLSDK cl_dll/studio_util.cpp:
 *   AngleQuaternion, QuaternionMatrix, ConcatTransforms, VectorTransform
 *
 * Animation frame data is pre-baked for every sequence × frame so the
 * AnimationController can simply swap Float32Array buffers at runtime.
 */
import {
  BufferGeometry, Float32BufferAttribute, Mesh,
  MeshPhongMaterial, MeshBasicMaterial, AdditiveBlending,
  Group, DoubleSide, Material,
} from 'three'
import { ParsedMDL, StudioBone, StudioBoneController, StudioSeqDesc, StudioAnim, STUDIO_NF_ADDITIVE, STUDIO_NF_FULLBRIGHT } from '../types/mdl'
import { MDLParser } from '../io/MDLParser'
import { TextureBuilder } from './TextureBuilder'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Flat 3×4 row-major bone transform matrix (12 floats). */
type Mat34 = Float32Array

export interface MeshBuildResult {
  mesh:              Mesh
  /** [seqIndex][frameIndex] — pre-baked world-space vertex positions */
  posFrames:         Float32Array[][]
  /** [seqIndex][frameIndex] — pre-baked world-space vertex normals */
  normFrames:        Float32Array[][]
}

// ─────────────────────────────────────────────────────────────────────────────
// HLSDK math (ported from studio_util.cpp)
// ─────────────────────────────────────────────────────────────────────────────

/** AngleQuaternion — angles[0]=pitch, [1]=yaw, [2]=roll (radians) */
function angleQuaternion(angles: number[]): [number, number, number, number] {
  const a0 = angles[0] * 0.5, a1 = angles[1] * 0.5, a2 = angles[2] * 0.5
  const sy = Math.sin(a2), cy = Math.cos(a2)
  const sp = Math.sin(a1), cp = Math.cos(a1)
  const sr = Math.sin(a0), cr = Math.cos(a0)
  return [
    sr * cp * cy - cr * sp * sy,  // x
    cr * sp * cy + sr * cp * sy,  // y
    cr * cp * sy - sr * sp * cy,  // z
    cr * cp * cy + sr * sp * sy,  // w
  ]
}

/** QuaternionSlerp — exactly as HLSDK */
function quaternionSlerp(
  p: [number,number,number,number],
  q: [number,number,number,number],
  t: number,
): [number,number,number,number] {
  // Decide if one quaternion should be negated
  let a = 0, b = 0
  for (let i = 0; i < 4; i++) {
    a += (p[i] - q[i]) ** 2
    b += (p[i] + q[i]) ** 2
  }
  const qq: [number,number,number,number] = a > b ? [-q[0],-q[1],-q[2],-q[3]] : [...q]

  const cosom = p[0]*qq[0] + p[1]*qq[1] + p[2]*qq[2] + p[3]*qq[3]
  let sclp: number, sclq: number

  if (1 + cosom > 1e-6) {
    if (1 - cosom > 1e-6) {
      const omega = Math.acos(cosom)
      const sinom = Math.sin(omega)
      sclp = Math.sin((1 - t) * omega) / sinom
      sclq = Math.sin(t * omega) / sinom
    } else {
      sclp = 1 - t; sclq = t
    }
    return [
      sclp*p[0]+sclq*qq[0], sclp*p[1]+sclq*qq[1],
      sclp*p[2]+sclq*qq[2], sclp*p[3]+sclq*qq[3],
    ]
  }
  // Degenerate: perpendicular quaternion
  const qt: [number,number,number,number] = [-qq[1], qq[0], -qq[3], qq[2]]
  sclp = Math.sin((1-t) * Math.PI * 0.5)
  sclq = Math.sin(t    * Math.PI * 0.5)
  return [
    sclp*p[0]+sclq*qt[0], sclp*p[1]+sclq*qt[1],
    sclp*p[2]+sclq*qt[2], p[3],
  ]
}

/**
 * QuaternionMatrix — builds a 3×4 rotation matrix from a quaternion.
 *
 * HLSDK studio_util.cpp QuaternionMatrix stores the result as matrix[col][row]
 * (column-major 3×4).  We flatten to row-major Float32Array so that
 * VectorTransform / ConcatTransforms below use the same index convention as
 * the HLSDK C code (which accesses e.g. matrix[0][0..2] for the first row).
 *
 * Row-major layout: m[row*4 + col]
 *   row 0: m[0] m[1] m[2] m[3]
 *   row 1: m[4] m[5] m[6] m[7]
 *   row 2: m[8] m[9] m[10] m[11]
 *
 * The HLSDK formula written out per element:
 *   matrix[0][0] = 1 - 2*q1² - 2*q2²   → m[0]
 *   matrix[1][0] = 2*(q0*q1 + q3*q2)   → m[4]   (column 1, row 0)
 *   ... etc.
 * In our row-major flat array that maps to:
 *   m[row*4+col] where row is the second HLSDK index and col is the first.
 */
function quaternionMatrix(q: [number,number,number,number]): Mat34 {
  const [qx, qy, qz, qw] = q
  const m = new Float32Array(12)

  // Row 0
  m[0]  = 1 - 2*qy*qy - 2*qz*qz
  m[1]  = 2*(qx*qy - qw*qz)
  m[2]  = 2*(qx*qz + qw*qy)
  m[3]  = 0

  // Row 1
  m[4]  = 2*(qx*qy + qw*qz)
  m[5]  = 1 - 2*qx*qx - 2*qz*qz
  m[6]  = 2*(qy*qz - qw*qx)
  m[7]  = 0

  // Row 2
  m[8]  = 2*(qx*qz - qw*qy)
  m[9]  = 2*(qy*qz + qw*qx)
  m[10] = 1 - 2*qx*qx - 2*qy*qy
  m[11] = 0

  return m
}

/** ConcatTransforms — out = in1 * in2 (3×4 matrices, row-major). */
function concatTransforms(a: Mat34, b: Mat34, out: Mat34): void {
  out[0]  = a[0]*b[0]  + a[1]*b[4]  + a[2]*b[8]
  out[1]  = a[0]*b[1]  + a[1]*b[5]  + a[2]*b[9]
  out[2]  = a[0]*b[2]  + a[1]*b[6]  + a[2]*b[10]
  out[3]  = a[0]*b[3]  + a[1]*b[7]  + a[2]*b[11] + a[3]

  out[4]  = a[4]*b[0]  + a[5]*b[4]  + a[6]*b[8]
  out[5]  = a[4]*b[1]  + a[5]*b[5]  + a[6]*b[9]
  out[6]  = a[4]*b[2]  + a[5]*b[6]  + a[6]*b[10]
  out[7]  = a[4]*b[3]  + a[5]*b[7]  + a[6]*b[11] + a[7]

  out[8]  = a[8]*b[0]  + a[9]*b[4]  + a[10]*b[8]
  out[9]  = a[8]*b[1]  + a[9]*b[5]  + a[10]*b[9]
  out[10] = a[8]*b[2]  + a[9]*b[6]  + a[10]*b[10]
  out[11] = a[8]*b[3]  + a[9]*b[7]  + a[10]*b[11] + a[11]
}

/** VectorTransform — out = in1 transformed by 3×4 matrix m. */
function vectorTransform(v: [number,number,number], m: Mat34): [number,number,number] {
  return [
    v[0]*m[0] + v[1]*m[1] + v[2]*m[2]  + m[3],
    v[0]*m[4] + v[1]*m[5] + v[2]*m[6]  + m[7],
    v[0]*m[8] + v[1]*m[9] + v[2]*m[10] + m[11],
  ]
}

/** Transform a normal (direction only — no translation). */
function normalTransform(v: [number,number,number], m: Mat34): [number,number,number] {
  return [
    v[0]*m[0] + v[1]*m[1] + v[2]*m[2],
    v[0]*m[4] + v[1]*m[5] + v[2]*m[6],
    v[0]*m[8] + v[1]*m[9] + v[2]*m[10],
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// ModelBuilder class
// ─────────────────────────────────────────────────────────────────────────────

export class ModelBuilder {
  private readonly texBuilder = new TextureBuilder()

  // ── Public entry point ────────────────────────────────────────────────────

  build(mdl: ParsedMDL, parser: MDLParser): { group: Group; results: MeshBuildResult[] } {
    const group   = new Group()
    const results: MeshBuildResult[] = []

    // R_StudioRenderFinal iterates over ALL body parts.
    // For each body part R_StudioSetupModel selects exactly ONE submodel:
    //   index = (entity.body / bodypart.base) % bodypart.numModels
    // body=0 always picks submodel 0 of each body part.
    const bodyValue = 0

    console.log(`[ModelBuilder] ${mdl.bodyParts.length} body part(s)`)
    for (const bp of mdl.bodyParts) {
      const submodelIndex = bp.base > 0
        ? Math.floor(bodyValue / bp.base) % bp.numModels
        : 0
      const model = bp.models[submodelIndex]
      console.log(`  bodypart "${bp.name}" numModels=${bp.numModels} base=${bp.base} → submodel[${submodelIndex}] "${model?.name ?? 'MISSING'}" numMesh=${model?.numMesh}`)
      if (!model) continue

      const r = this.buildModel(mdl, model, parser)
      if (r) { results.push(r); group.add(r.mesh) }
    }

    // GoldSrc uses Z-up right-handed; Three.js uses Y-up right-handed.
    // A single -90° rotation around the X axis maps  Z→Y, Y→-Z.
    group.rotation.x = -Math.PI / 2

    return { group, results }
  }

  // ── Build one mstudiomodel_t ───────────────────────────────────────────────

  private buildModel(
    mdl: ParsedMDL,
    model: import('../types/mdl').StudioModel,
    parser: MDLParser,
  ): MeshBuildResult | null {
    const meshes        = parser.readMeshes(model)
    const rawVerts      = parser.readVertices(model)
    const rawNormals    = parser.readNormals(model)
    const vertBoneIdx   = parser.readVertBoneIndices(model)
    const normBoneIdx   = parser.readNormBoneIndices(model)

    if (rawVerts.length === 0 || meshes.length === 0) return null

    // ── Gather triangulated vertex data per mesh ──────────────────────────
    type TexGroup = { start: number; count: number; texIdx: number }
    const allPos:  number[] = []
    const allUVs:  number[] = []
    const allVI:   number[] = []   // original vertex index per output vertex
    const allNI:   number[] = []   // original normal index per output vertex
    const texGroups: TexGroup[] = []

    for (const mesh of meshes) {
      // Resolve texture index via skin table
      const texIdx = this.resolveSkinRef(mdl, mesh.skinRef, 0)
      const tex    = mdl.textures[texIdx]
      const tw     = tex ? tex.width  : 1
      const th     = tex ? tex.height : 1

      const triData = parser.triangulateMesh(mesh, rawVerts, tw, th)
      if (!triData || triData.positions.length === 0) continue

      const groupStart = allPos.length / 3

      const vc = triData.positions.length / 3
      for (let i = 0; i < vc; i++) {
        allPos.push(triData.positions[i*3], triData.positions[i*3+1], triData.positions[i*3+2])
        allUVs.push(triData.uvs[i*2], triData.uvs[i*2+1])
        allVI.push(triData.vertexIndices[i])
        allNI.push(triData.normalIndices[i])
      }
      texGroups.push({ start: groupStart, count: vc, texIdx })
    }

    if (allPos.length === 0) return null

    const vc        = allPos.length / 3
    const numBones  = mdl.bones.length

    // ── Build bone controller defaults ────────────────────────────────────
    const ctrlDefaults = this.buildControllerDefaults(mdl.bones, mdl.boneControllers)

    // ── Compute rest-pose world matrices (bind pose) ──────────────────────
    const restMats = this.computeWorldMatrices(mdl.bones, null, ctrlDefaults, null, 0, 0)

    // ── Transform vertices to rest-pose model space ───────────────────────
    const restPositions = new Float32Array(vc * 3)
    const restNormals   = new Float32Array(vc * 3)

    for (let i = 0; i < vc; i++) {
      const vi = allVI[i]
      const ni = allNI[i]

      const boneV = (vertBoneIdx.length > vi) ? vertBoneIdx[vi] : 0
      const boneN = (normBoneIdx.length > ni) ? normBoneIdx[ni] : boneV

      const pRaw: [number,number,number] = [allPos[i*3], allPos[i*3+1], allPos[i*3+2]]
      const p = boneV < restMats.length ? vectorTransform(pRaw, restMats[boneV]) : pRaw
      restPositions[i*3]   = p[0]
      restPositions[i*3+1] = p[1]
      restPositions[i*3+2] = p[2]

      // Raw model-space normal from the normal array
      const nRaw: [number,number,number] = ni * 3 + 2 < rawNormals.length
        ? [rawNormals[ni*3], rawNormals[ni*3+1], rawNormals[ni*3+2]]
        : [0, 0, 1]
      const n = boneN < restMats.length ? normalTransform(nRaw, restMats[boneN]) : nRaw
      restNormals[i*3]   = n[0]
      restNormals[i*3+1] = n[1]
      restNormals[i*3+2] = n[2]
    }

    // ── Pre-bake animation frames ─────────────────────────────────────────
    const posFrames:  Float32Array[][] = []
    const normFrames: Float32Array[][] = []

    for (let si = 0; si < mdl.sequences.length; si++) {
      const seq   = mdl.sequences[si]
      const anims = parser.readAnims(seq, numBones)
      const seqPos:  Float32Array[] = []
      const seqNorm: Float32Array[] = []

      for (let fi = 0; fi < Math.max(1, seq.numFrames); fi++) {
        const worldMats = this.computeWorldMatrices(mdl.bones, anims, ctrlDefaults, parser, fi, 0)
        const outPos  = new Float32Array(vc * 3)
        const outNorm = new Float32Array(vc * 3)

        for (let i = 0; i < vc; i++) {
          const vi = allVI[i]
          const ni = allNI[i]
          const boneV = (vertBoneIdx.length > vi) ? vertBoneIdx[vi] : 0
          const boneN = (normBoneIdx.length > ni) ? normBoneIdx[ni] : boneV

          const pRaw: [number,number,number] = [allPos[i*3], allPos[i*3+1], allPos[i*3+2]]
          const p = boneV < worldMats.length ? vectorTransform(pRaw, worldMats[boneV]) : pRaw
          outPos[i*3] = p[0]; outPos[i*3+1] = p[1]; outPos[i*3+2] = p[2]

          const nRaw: [number,number,number] = ni * 3 + 2 < rawNormals.length
            ? [rawNormals[ni*3], rawNormals[ni*3+1], rawNormals[ni*3+2]]
            : [0, 0, 1]
          const n = boneN < worldMats.length ? normalTransform(nRaw, worldMats[boneN]) : nRaw
          outNorm[i*3] = n[0]; outNorm[i*3+1] = n[1]; outNorm[i*3+2] = n[2]
        }
        seqPos.push(outPos)
        seqNorm.push(outNorm)
      }
      posFrames.push(seqPos)
      normFrames.push(seqNorm)
    }

    // ── Build Three.js geometry ───────────────────────────────────────────
    const geo = new BufferGeometry()
    geo.setAttribute('position', new Float32BufferAttribute(restPositions, 3))
    geo.setAttribute('normal',   new Float32BufferAttribute(restNormals,   3))
    geo.setAttribute('uv',       new Float32BufferAttribute(new Float32Array(allUVs), 2))

    const materials: Material[] = []
    for (const g of texGroups) {
      geo.addGroup(g.start, g.count, materials.length)
      const tex     = g.texIdx >= 0 && g.texIdx < mdl.textures.length ? mdl.textures[g.texIdx] : null
      const dtex    = tex ? this.texBuilder.build(tex) : null
      const isAdd   = tex ? (tex.flags & STUDIO_NF_ADDITIVE) !== 0 : false
      const isFull  = tex ? (tex.flags & STUDIO_NF_FULLBRIGHT) !== 0 : false
      const isMasked = tex ? (tex.flags & 0x0040) !== 0 : false

      if (isFull || isAdd) {
        materials.push(new MeshBasicMaterial({
          map: dtex ?? undefined,
          side: DoubleSide,
          transparent: isAdd || isMasked,
          blending: isAdd ? AdditiveBlending : undefined,
          alphaTest: isMasked ? 0.5 : 0,
          depthWrite: !isAdd,
        }))
      } else {
        materials.push(new MeshPhongMaterial({
          map: dtex ?? undefined,
          side: DoubleSide,
          transparent: isMasked,
          alphaTest: isMasked ? 0.5 : 0,
          shininess: 20,
        }))
      }
    }

    const mesh = new Mesh(geo, materials)
    mesh.frustumCulled = false

    return { mesh, posFrames, normFrames }
  }

  // ── Bone controller default values ────────────────────────────────────────

  private buildControllerDefaults(bones: StudioBone[], controllers: StudioBoneController[]): Float32Array {
    // 6 channels per bone: [tx, ty, tz, rx, ry, rz]
    const defs = new Float32Array(bones.length * 6)
    for (const bc of controllers) {
      if (bc.bone < 0 || bc.bone >= bones.length) continue
      const type = bc.type & 0x7FFF  // strip STUDIO_RLOOP
      const channel = this.typeToChannel(type)
      if (channel < 0) continue
      // 'rest' is stored as a byte 0-255 mapped to start..end
      const t = bc.rest / 255.0
      defs[bc.bone * 6 + channel] = bc.start * (1 - t) + bc.end * t
    }
    return defs
  }

  private typeToChannel(type: number): number {
    // STUDIO_X=1, Y=2, Z=4, XR=8, YR=16, ZR=32
    if (type === 1)  return 0
    if (type === 2)  return 1
    if (type === 4)  return 2
    if (type === 8)  return 3
    if (type === 16) return 4
    if (type === 32) return 5
    return -1
  }

  // ── World matrix computation (StudioSetupBones equivalent) ────────────────
  /**
   * Computes world-space bone matrices for one frame.
   *
   * If anims is null, uses bone rest values (bind pose).
   * Implements StudioCalcBonePosition + StudioCalcBoneQuaterion logic.
   */
  private computeWorldMatrices(
    bones:       StudioBone[],
    anims:       StudioAnim[] | null,
    ctrlDefs:    Float32Array,
    parser:      MDLParser | null,
    frame:       number,
    frac:        number,
  ): Mat34[] {
    const world: Mat34[] = []

    for (let i = 0; i < bones.length; i++) {
      const bone  = bones[i]
      const anim  = anims ? anims[i] : null

      // ── Position channels (tx, ty, tz) ──
      const pos: [number, number, number] = [0, 0, 0]
      for (let k = 0; k < 3; k++) {
        let raw = 0
        if (anim && anim.offset[k] !== 0 && parser) {
          raw = parser.decodeAnimValue(anim.fileOffset, anim.offset[k], frame, frac)
        }
        pos[k] = bone.value[k] + raw * bone.scale[k]
        // Add bone controller contribution
        const ctrl = bone.boneController[k]
        if (ctrl !== -1) pos[k] += ctrlDefs[i * 6 + k]
      }

      // ── Rotation channels (rx, ry, rz) ──
      const angles: [number, number, number] = [0, 0, 0]
      for (let k = 0; k < 3; k++) {
        const ch = k + 3
        let raw = 0
        if (anim && anim.offset[ch] !== 0 && parser) {
          raw = parser.decodeAnimValue(anim.fileOffset, anim.offset[ch], frame, frac)
        }
        angles[k] = bone.value[ch] + raw * bone.scale[ch]
        const ctrl = bone.boneController[ch]
        if (ctrl !== -1) angles[k] += ctrlDefs[i * 6 + ch]
      }

      // ── Build local 3×4 bone matrix ──
      const q = angleQuaternion(angles)
      const local = quaternionMatrix(q)
      local[3]  = pos[0]
      local[7]  = pos[1]
      local[11] = pos[2]

      // ── Concatenate with parent ──
      const out = new Float32Array(12)
      if (bone.parent >= 0 && bone.parent < world.length) {
        concatTransforms(world[bone.parent], local, out)
      } else {
        out.set(local)
      }
      world.push(out)
    }
    return world
  }

  // ── Skin ref resolution ───────────────────────────────────────────────────

  private resolveSkinRef(mdl: ParsedMDL, skinRef: number, skinFamily: number): number {
    const { numSkinRef, numSkinFamilies } = mdl.header
    const { skinTable, textures } = mdl
    if (skinTable.length > 0 && skinFamily < numSkinFamilies && skinRef < numSkinRef) {
      const mapped = skinTable[skinFamily * numSkinRef + skinRef]
      if (mapped >= 0 && mapped < textures.length) return mapped
    }
    if (skinRef >= 0 && skinRef < textures.length) return skinRef
    return 0
  }
}
