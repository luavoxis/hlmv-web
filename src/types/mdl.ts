/**
 * GoldSrc MDL v10 type definitions
 * Mirrors the structs in HLSDK common/studio.h 1:1
 */

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────

export const STUDIO_VERSION = 10
export const IDSTUDIOHDR   = 'IDST'
export const IDSEQGRPHDR   = 'IDSQ'

// studiohdr_t flags
export const STUDIO_HAS_NORMALS   = 0x0001
export const STUDIO_HAS_ORIGINS   = 0x0002
export const STUDIO_HAS_CHROME    = 0x0004 // lots of chrome on this model
export const STUDIO_FACE_FRONT    = 0x0008 // render all polys facing front

// sequence flags  (mstudioseqdesc_t.flags)
export const STUDIO_LOOPING = 0x0001

// motion flags
export const STUDIO_X   = 0x0001
export const STUDIO_Y   = 0x0002
export const STUDIO_Z   = 0x0004
export const STUDIO_XR  = 0x0008
export const STUDIO_YR  = 0x0010
export const STUDIO_ZR  = 0x0020
export const STUDIO_LX  = 0x0040
export const STUDIO_LY  = 0x0080
export const STUDIO_LZ  = 0x0100
export const STUDIO_AX  = 0x0200
export const STUDIO_AY  = 0x0400
export const STUDIO_AZ  = 0x0800
export const STUDIO_AXR = 0x1000
export const STUDIO_AYR = 0x2000
export const STUDIO_AZR = 0x4000
export const STUDIO_TYPES  = 0x7FFF
export const STUDIO_RLOOP  = 0x8000 // controller that wraps 360°

// bone controller indices
export const STUDIO_MOUTH = 4

// texture flags  (mstudiotexture_t.flags)
export const STUDIO_NF_FLATSHADE  = 0x0001
export const STUDIO_NF_CHROME     = 0x0002
export const STUDIO_NF_FULLBRIGHT = 0x0004
export const STUDIO_NF_NOMIPS     = 0x0008
export const STUDIO_NF_ALPHA      = 0x0010
export const STUDIO_NF_ADDITIVE   = 0x0020
export const STUDIO_NF_MASKED     = 0x0040

// ────────────────────────────────────────────────────────────────────────────
// studiohdr_t  (244 bytes)
// ────────────────────────────────────────────────────────────────────────────
export interface StudioHeader {
  id:        string   // "IDST"
  version:   number   // 10
  name:      string   // model name, up to 64 chars
  length:    number   // file size

  eyePosition:  Vec3
  hullMin:      Vec3
  hullMax:      Vec3
  bbMin:        Vec3
  bbMax:        Vec3

  flags: number

  numBones:           number; boneIndex:           number
  numBoneControllers: number; boneControllerIndex: number
  numHitboxes:        number; hitboxIndex:         number
  numSeq:             number; seqIndex:            number
  numSeqGroups:       number; seqGroupIndex:       number
  numTextures:        number; textureIndex:        number; textureDataIndex: number
  numSkinRef:         number; numSkinFamilies:     number; skinIndex: number
  numBodyParts:       number; bodyPartIndex:       number
  numAttachments:     number; attachmentIndex:     number

  soundTable:     number; soundIndex:      number
  soundGroupsNum: number; soundGroupIndex: number
  numTransitions: number; transitionIndex: number
}

// ────────────────────────────────────────────────────────────────────────────
// mstudiobone_t  (112 bytes)
// ────────────────────────────────────────────────────────────────────────────
export interface StudioBone {
  name:           string    // 32 chars
  parent:         number    // -1 = root
  flags:          number
  boneController: number[]  // [6]  index into bone controller array (-1 = none)
  value:          number[]  // [6]  default pos/rot  (x,y,z,xr,yr,zr)
  scale:          number[]  // [6]  animation value scale
}

// ────────────────────────────────────────────────────────────────────────────
// mstudiobonecontroller_t  (24 bytes)
// ────────────────────────────────────────────────────────────────────────────
export interface StudioBoneController {
  bone:  number   // bone index
  type:  number   // motion flags (STUDIO_X … STUDIO_ZR)
  start: number
  end:   number
  rest:  number   // encoded default value
  index: number   // 0-3 = user, 4 = mouth
}

// ────────────────────────────────────────────────────────────────────────────
// mstudiohitbox_t  (32 bytes)
// ────────────────────────────────────────────────────────────────────────────
export interface StudioHitbox {
  bone:  number
  group: number
  bbMin: Vec3
  bbMax: Vec3
}

// ────────────────────────────────────────────────────────────────────────────
// mstudioseqdesc_t  (176 bytes)
// ────────────────────────────────────────────────────────────────────────────
export interface StudioSeqDesc {
  label:     string   // 32 chars
  fps:       number
  flags:     number   // STUDIO_LOOPING etc.

  activity:  number
  actWeight: number

  numEvents:  number; eventIndex:  number
  numFrames:  number

  numPivots:  number; pivotIndex:  number
  motionType: number
  motionBone: number
  linearMovement: Vec3
  autoMovePosIndex:   number
  autoMoveAngleIndex: number

  bbMin: Vec3
  bbMax: Vec3

  numBlends:    number
  animIndex:    number   // offset to mstudioanim_t array

  blendType:  [number, number]
  blendStart: [number, number]
  blendEnd:   [number, number]
  blendParent: number

  seqGroup:    number
  entryNode:   number
  exitNode:    number
  nodeFlags:   number
  nextSeq:     number
}

// ────────────────────────────────────────────────────────────────────────────
// mstudioseqgroup_t  (104 bytes)
// ────────────────────────────────────────────────────────────────────────────
export interface StudioSeqGroup {
  label: string   // 32 chars
  name:  string   // 64 chars
  cache: number
  data:  number
}

// ────────────────────────────────────────────────────────────────────────────
// mstudioanim_t  (12 bytes — 6 × uint16 offsets)
// Each offset is relative to the start of THIS mstudioanim_t struct.
// offset[k] == 0  →  channel k has no animation (use bone default value).
// ────────────────────────────────────────────────────────────────────────────
export interface StudioAnim {
  /** Byte offset of this struct inside the file buffer */
  fileOffset: number
  /** Relative byte offsets to mstudioanimvalue_t streams, one per channel [tx,ty,tz,rx,ry,rz] */
  offset: number[]  // [6]
}

// ────────────────────────────────────────────────────────────────────────────
// mstudioanimvalue_t  (2 bytes)
// Used as a union: either a run-length header {valid, total} or a raw value.
// ────────────────────────────────────────────────────────────────────────────
// (No interface needed — we read directly via DataView in the parser.)

// ────────────────────────────────────────────────────────────────────────────
// mstudiotexture_t  (80 bytes header, pixel data follows separately)
// ────────────────────────────────────────────────────────────────────────────
export interface StudioTexture {
  name:       string    // 64 chars
  flags:      number
  width:      number
  height:     number
  dataOffset: number    // absolute file offset to pixel data

  // Decoded pixel data
  pixels:  Uint8Array   // width * height palette indices
  palette: Uint8Array   // 256 * 3 RGB bytes
}

// ────────────────────────────────────────────────────────────────────────────
// mstudiobodyparts_t  (76 bytes)
// ────────────────────────────────────────────────────────────────────────────
export interface StudioBodyPart {
  name:       string
  numModels:  number
  base:       number    // runtime body selector divisor — NOT an offset
  modelIndex: number    // file offset of first mstudiomodel_t
  models:     StudioModel[]
}

// ────────────────────────────────────────────────────────────────────────────
// mstudiomodel_t  (112 bytes)
// ────────────────────────────────────────────────────────────────────────────
export interface StudioModel {
  name:          string
  type:          number
  boundingRadius: number

  numMesh:    number; meshIndex:    number
  numVerts:   number; vertInfoIndex: number; vertIndex: number
  numNormals: number; normInfoIndex: number; normIndex: number
  numGroups:  number; groupIndex:   number
}

// ────────────────────────────────────────────────────────────────────────────
// mstudiomesh_t  (20 bytes)
// ────────────────────────────────────────────────────────────────────────────
export interface StudioMesh {
  numTris:  number
  triIndex: number
  skinRef:  number
  numNorms: number
  normIndex: number
}

// ────────────────────────────────────────────────────────────────────────────
// mstudioattachment_t  (88 bytes)
// ────────────────────────────────────────────────────────────────────────────
export interface StudioAttachment {
  name:   string    // 32 chars
  type:   number
  bone:   number
  org:    Vec3
  vectors: [Vec3, Vec3, Vec3]
}

// ────────────────────────────────────────────────────────────────────────────
// Top-level parsed result
// ────────────────────────────────────────────────────────────────────────────
export interface ParsedMDL {
  header:          StudioHeader
  bones:           StudioBone[]
  boneControllers: StudioBoneController[]
  hitboxes:        StudioHitbox[]
  sequences:       StudioSeqDesc[]
  seqGroups:       StudioSeqGroup[]
  textures:        StudioTexture[]
  /** skin ref table: numSkinFamilies × numSkinRef matrix, row-major */
  skinTable:       Int16Array
  bodyParts:       StudioBodyPart[]
  attachments:     StudioAttachment[]
  rawBuffer:       ArrayBuffer
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────
export type Vec3 = [number, number, number]
export type Mat3x4 = [
  number, number, number, number,  // row 0
  number, number, number, number,  // row 1
  number, number, number, number,  // row 2
]

/** Column-major 3×4 transform matrix used by the HLSDK renderer.
 *  Stored as [row][col]: m[r][c] = flat[r*4 + c]
 */
export type BoneMatrix = Float32Array  // length 12
