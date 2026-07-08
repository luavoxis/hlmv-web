/**
 * MDLParser — parses GoldSrc MDL v10 files.
 *
 * Implements the same binary layout as HLSDK common/studio.h and the
 * animation decoding logic from cl_dll/StudioModelRenderer.cpp
 * (StudioCalcBonePosition / StudioCalcBoneQuaterion).
 */
import { BinaryReader } from './BinaryReader'
import {
  IDSTUDIOHDR, STUDIO_VERSION,
  ParsedMDL, StudioHeader, StudioBone, StudioBoneController, StudioHitbox,
  StudioSeqDesc, StudioSeqGroup, StudioAnim, StudioTexture,
  StudioBodyPart, StudioModel, StudioMesh, StudioAttachment,
  Vec3,
} from '../types/mdl'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function vec3(r: BinaryReader): Vec3 {
  return [r.readFloat32(), r.readFloat32(), r.readFloat32()]
}

export class MDLParser {
  private r!: BinaryReader
  private buf!: ArrayBuffer

  // ── Public entry point ────────────────────────────────────────────────────

  parse(buffer: ArrayBuffer): ParsedMDL {
    this.buf = buffer
    this.r   = new BinaryReader(buffer)

    const header = this.readHeader()

    if (header.id !== IDSTUDIOHDR) {
      throw new Error(`Not a valid MDL file (got "${header.id}", expected "IDST")`)
    }
    if (header.version !== STUDIO_VERSION) {
      throw new Error(`Unsupported MDL version ${header.version} (expected ${STUDIO_VERSION})`)
    }

    const bones           = this.readBones(header.numBones, header.boneIndex)
    const boneControllers = this.readBoneControllers(header.numBoneControllers, header.boneControllerIndex)
    const hitboxes        = this.readHitboxes(header.numHitboxes, header.hitboxIndex)
    const sequences       = this.readSequences(header.numSeq, header.seqIndex)
    const seqGroups       = this.readSeqGroups(header.numSeqGroups, header.seqGroupIndex)
    const textures        = this.readTextures(header.numTextures, header.textureIndex, header.textureDataIndex)
    const skinTable       = this.readSkinTable(header.numSkinRef, header.numSkinFamilies, header.skinIndex)
    const bodyParts       = this.readBodyParts(header.numBodyParts, header.bodyPartIndex)
    const attachments     = this.readAttachments(header.numAttachments, header.attachmentIndex)

    return {
      header, bones, boneControllers, hitboxes,
      sequences, seqGroups, textures, skinTable,
      bodyParts, attachments, rawBuffer: buffer,
    }
  }

  // ── Header (244 bytes) ────────────────────────────────────────────────────

  private readHeader(): StudioHeader {
    const r = this.r
    r.seek(0)

    const id      = r.readString(4)
    const version = r.readInt32()
    const name    = r.readString(64)
    const length  = r.readInt32()

    const eyePosition = vec3(r)
    const hullMin     = vec3(r)
    const hullMax     = vec3(r)
    const bbMin       = vec3(r)
    const bbMax       = vec3(r)
    const flags       = r.readUint32()

    const numBones           = r.readInt32(); const boneIndex           = r.readInt32()
    const numBoneControllers = r.readInt32(); const boneControllerIndex = r.readInt32()
    const numHitboxes        = r.readInt32(); const hitboxIndex         = r.readInt32()
    const numSeq             = r.readInt32(); const seqIndex            = r.readInt32()
    const numSeqGroups       = r.readInt32(); const seqGroupIndex       = r.readInt32()
    const numTextures        = r.readInt32(); const textureIndex        = r.readInt32()
    const textureDataIndex   = r.readInt32()
    const numSkinRef         = r.readInt32(); const numSkinFamilies     = r.readInt32()
    const skinIndex          = r.readInt32()
    const numBodyParts       = r.readInt32(); const bodyPartIndex       = r.readInt32()
    const numAttachments     = r.readInt32(); const attachmentIndex     = r.readInt32()
    const soundTable         = r.readInt32(); const soundIndex          = r.readInt32()
    const soundGroupsNum     = r.readInt32(); const soundGroupIndex     = r.readInt32()
    const numTransitions     = r.readInt32(); const transitionIndex     = r.readInt32()

    return {
      id, version, name, length,
      eyePosition, hullMin, hullMax, bbMin, bbMax, flags,
      numBones, boneIndex,
      numBoneControllers, boneControllerIndex,
      numHitboxes, hitboxIndex,
      numSeq, seqIndex,
      numSeqGroups, seqGroupIndex,
      numTextures, textureIndex, textureDataIndex,
      numSkinRef, numSkinFamilies, skinIndex,
      numBodyParts, bodyPartIndex,
      numAttachments, attachmentIndex,
      soundTable, soundIndex,
      soundGroupsNum, soundGroupIndex,
      numTransitions, transitionIndex,
    }
  }

  // ── Bones (mstudiobone_t, 112 bytes each) ─────────────────────────────────

  private readBones(count: number, offset: number): StudioBone[] {
    if (count === 0 || offset === 0) return []
    const r = this.r
    r.seek(offset)
    return r.readArray(count, () => ({
      name:           r.readString(32),
      parent:         r.readInt32(),
      flags:          r.readInt32(),
      boneController: r.readInt32Array(6),
      value:          r.readFloat32Array(6),
      scale:          r.readFloat32Array(6),
    }))
  }

  // ── Bone controllers (mstudiobonecontroller_t, 24 bytes each) ─────────────

  private readBoneControllers(count: number, offset: number): StudioBoneController[] {
    if (count === 0 || offset === 0) return []
    const r = this.r
    r.seek(offset)
    return r.readArray(count, () => ({
      bone:  r.readInt32(),
      type:  r.readInt32(),
      start: r.readFloat32(),
      end:   r.readFloat32(),
      rest:  r.readInt32(),
      index: r.readInt32(),
    }))
  }

  // ── Hitboxes (mstudiohitbox_t, 32 bytes each) ─────────────────────────────

  private readHitboxes(count: number, offset: number): StudioHitbox[] {
    if (count === 0 || offset === 0) return []
    const r = this.r
    r.seek(offset)
    return r.readArray(count, () => ({
      bone:  r.readInt32(),
      group: r.readInt32(),
      bbMin: vec3(r),
      bbMax: vec3(r),
    }))
  }

  // ── Sequences (mstudioseqdesc_t, 176 bytes each) ──────────────────────────

  private readSequences(count: number, offset: number): StudioSeqDesc[] {
    if (count === 0 || offset === 0) return []
    const r = this.r
    r.seek(offset)
    return r.readArray(count, () => {
      const label      = r.readString(32)
      const fps        = r.readFloat32()
      const flags      = r.readInt32()
      const activity   = r.readInt32()
      const actWeight  = r.readInt32()
      const numEvents  = r.readInt32(); const eventIndex  = r.readInt32()
      const numFrames  = r.readInt32()
      const numPivots  = r.readInt32(); const pivotIndex  = r.readInt32()
      const motionType = r.readInt32()
      const motionBone = r.readInt32()
      const linearMovement = vec3(r)
      const autoMovePosIndex   = r.readInt32()
      const autoMoveAngleIndex = r.readInt32()
      const bbMin = vec3(r)
      const bbMax = vec3(r)
      const numBlends = r.readInt32()
      const animIndex = r.readInt32()
      const blendType:  [number, number] = [r.readInt32(), r.readInt32()]
      const blendStart: [number, number] = [r.readFloat32(), r.readFloat32()]
      const blendEnd:   [number, number] = [r.readFloat32(), r.readFloat32()]
      const blendParent = r.readInt32()
      const seqGroup    = r.readInt32()
      const entryNode   = r.readInt32()
      const exitNode    = r.readInt32()
      const nodeFlags   = r.readInt32()
      const nextSeq     = r.readInt32()
      return {
        label, fps, flags, activity, actWeight,
        numEvents, eventIndex, numFrames, numPivots, pivotIndex,
        motionType, motionBone, linearMovement,
        autoMovePosIndex, autoMoveAngleIndex,
        bbMin, bbMax, numBlends, animIndex,
        blendType, blendStart, blendEnd, blendParent,
        seqGroup, entryNode, exitNode, nodeFlags, nextSeq,
      }
    })
  }

  // ── Sequence groups (mstudioseqgroup_t, 104 bytes each) ───────────────────

  private readSeqGroups(count: number, offset: number): StudioSeqGroup[] {
    if (count === 0 || offset === 0) return []
    const r = this.r
    r.seek(offset)
    return r.readArray(count, () => ({
      label: r.readString(32),
      name:  r.readString(64),
      cache: r.readInt32(),
      data:  r.readInt32(),
    }))
  }

  // ── Textures (mstudiotexture_t = 80 bytes each) ───────────────────────────
  //
  // Actual struct layout from engine/studio.h:
  //   char          name[64]     64 bytes
  //   unsigned short flags        2 bytes
  //   unsigned short unused       2 bytes   ← NOT part of flags!
  //   int           width         4 bytes
  //   int           height        4 bytes
  //   int           index         4 bytes   ← runtime GL handle, NOT pixel offset
  //                              ──────────
  //                         total 80 bytes
  //
  // Pixel data layout (immediately after ALL texture headers, at textureDataIndex):
  //   For each texture i:
  //     pixels[width*height]   1 byte per pixel (palette index)
  //     palette[256*3]         RGB palette
  //
  // The textureDataIndex field in the header points to the start of this block.

  private readTextures(count: number, offset: number, dataBaseOffset: number): StudioTexture[] {
    if (count === 0 || offset === 0) return []
    const r   = this.r
    const buf = this.buf

    // Read all texture headers first
    const headers: { name: string; flags: number; width: number; height: number }[] = []
    r.seek(offset)
    for (let i = 0; i < count; i++) {
      const name    = r.readString(64)
      const flags   = r.readUint16()   // ← uint16, NOT uint32
      r.skip(2)                        // skip unused uint16
      const width   = r.readInt32()
      const height  = r.readInt32()
      r.skip(4)                        // skip runtime index field
      headers.push({ name, flags, width, height })
    }

    // Now decode pixel data sequentially starting from textureDataIndex
    const textures: StudioTexture[] = []
    const paletteSize = 256 * 3
    let dataOff = dataBaseOffset > 0 ? dataBaseOffset : offset + count * 80

    for (let i = 0; i < count; i++) {
      const { name, flags, width, height } = headers[i]
      const pixelCount = width * height

      let pixels: Uint8Array
      let palette: Uint8Array

      if (pixelCount > 0 && dataOff + pixelCount + paletteSize <= buf.byteLength) {
        pixels  = new Uint8Array(buf.slice(dataOff, dataOff + pixelCount))
        palette = new Uint8Array(buf.slice(dataOff + pixelCount, dataOff + pixelCount + paletteSize))
        dataOff += pixelCount + paletteSize
      } else {
        console.warn(`[MDLParser] Texture "${name}" pixel data out of bounds at offset ${dataOff}`)
        pixels  = new Uint8Array(0)
        palette = new Uint8Array(paletteSize)
      }

      textures.push({ name, flags, width, height, dataOffset: dataOff, pixels, palette })
    }
    return textures
  }

  // ── Skin table (numSkinFamilies × numSkinRef int16 matrix) ────────────────

  private readSkinTable(numSkinRef: number, numFamilies: number, offset: number): Int16Array {
    if (numSkinRef === 0 || numFamilies === 0 || offset === 0) return new Int16Array(0)
    const count = numSkinRef * numFamilies
    // Bounds check: each int16 is 2 bytes
    if (offset + count * 2 > this.buf.byteLength) return new Int16Array(0)
    // Zero-copy view into the buffer
    return new Int16Array(this.buf, offset, count)
  }

  // ── Body parts (mstudiobodyparts_t, 76 bytes each) ────────────────────────
  //
  // mstudiobodyparts_t layout:
  //   char name[64]       64 bytes
  //   int  nummodels       4 bytes
  //   int  base            4 bytes
  //   int  modelindex      4 bytes  ← absolute file offset to first mstudiomodel_t
  //                       ─────────
  //                  total 76 bytes

  private readonly MODEL_SIZE     = 112  // sizeof(mstudiomodel_t)
  private readonly BODYPART_SIZE  = 76   // sizeof(mstudiobodyparts_t)

  private readBodyParts(count: number, offset: number): StudioBodyPart[] {
    if (count === 0 || offset === 0) return []
    const r   = this.r
    const buf = this.buf

    const parts: StudioBodyPart[] = []
    for (let i = 0; i < count; i++) {
      // Always seek to the exact body part header position
      // so that reading models for body part N doesn't corrupt body part N+1
      const headerOff = offset + i * this.BODYPART_SIZE
      r.seek(headerOff)

      const name       = r.readString(64)
      const numModels  = r.readUint32()
      const base       = r.readUint32()
      const modelIndex = r.readUint32()

      const models: StudioModel[] = []
      for (let j = 0; j < numModels; j++) {
        const modelOff = modelIndex + j * this.MODEL_SIZE
        if (modelOff + this.MODEL_SIZE > buf.byteLength) {
          console.warn(`[MDLParser] bodypart "${name}" model[${j}] offset 0x${modelOff.toString(16)} out of bounds`)
          break
        }
        r.seek(modelOff)
        models.push(this.readModel(r))
      }

      parts.push({ name, numModels, base, modelIndex, models })
    }
    return parts
  }

  private readModel(r: BinaryReader): StudioModel {
    return {
      name:           r.readString(64),
      type:           r.readInt32(),
      boundingRadius: r.readFloat32(),
      numMesh:        r.readUint32(), meshIndex:     r.readUint32(),
      numVerts:       r.readUint32(), vertInfoIndex: r.readUint32(), vertIndex:  r.readUint32(),
      numNormals:     r.readUint32(), normInfoIndex: r.readUint32(), normIndex:  r.readUint32(),
      numGroups:      r.readUint32(), groupIndex:    r.readUint32(),
    }
  }

  // ── Attachments (mstudioattachment_t, 88 bytes each) ─────────────────────

  private readAttachments(count: number, offset: number): StudioAttachment[] {
    if (count === 0 || offset === 0) return []
    const r = this.r
    r.seek(offset)
    return r.readArray(count, () => ({
      name:    r.readString(32),
      type:    r.readInt32(),
      bone:    r.readInt32(),
      org:     vec3(r),
      vectors: [vec3(r), vec3(r), vec3(r)] as [Vec3, Vec3, Vec3],
    }))
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Public accessors used by ModelBuilder
  // ══════════════════════════════════════════════════════════════════════════

  /** Read mstudiomesh_t array for a model (20 bytes each). */
  readMeshes(model: StudioModel): StudioMesh[] {
    if (model.numMesh === 0 || model.meshIndex === 0) return []
    const r = new BinaryReader(this.buf)
    r.seek(model.meshIndex)
    return r.readArray(model.numMesh, () => ({
      numTris:   r.readInt32(),
      triIndex:  r.readInt32(),
      skinRef:   r.readInt32(),
      numNorms:  r.readInt32(),
      normIndex: r.readInt32(),
    }))
  }

  /** Zero-copy view of vertex positions (3 floats each). */
  readVertices(model: StudioModel): Float32Array {
    if (model.numVerts === 0 || model.vertIndex === 0) return new Float32Array(0)
    return new BinaryReader(this.buf).viewFloat32(model.vertIndex, model.numVerts * 3)
  }

  /** Zero-copy view of normal vectors (3 floats each). */
  readNormals(model: StudioModel): Float32Array {
    if (model.numNormals === 0 || model.normIndex === 0) return new Float32Array(0)
    return new BinaryReader(this.buf).viewFloat32(model.normIndex, model.numNormals * 3)
  }

  /** Per-vertex bone index array (1 byte each). */
  readVertBoneIndices(model: StudioModel): Uint8Array {
    if (model.numVerts === 0 || model.vertInfoIndex === 0) return new Uint8Array(0)
    return new Uint8Array(this.buf, model.vertInfoIndex, model.numVerts)
  }

  /** Per-normal bone index array (1 byte each). */
  readNormBoneIndices(model: StudioModel): Uint8Array {
    if (model.numNormals === 0 || model.normInfoIndex === 0) return new Uint8Array(0)
    return new Uint8Array(this.buf, model.normInfoIndex, model.numNormals)
  }

  /**
   * Triangulate a mesh's triangle strip/fan data into a flat vertex list.
   *
   * mstudiotrivert_t layout (4 × int16):
   *   [0] vertIndex  — index into mstudiomodel_t vertex array
   *   [1] normIndex  — index into mstudiomodel_t normal array
   *   [2] s          — texture s coordinate (pixel space)
   *   [3] t          — texture t coordinate (pixel space)
   *
   * A sequence header word:
   *   > 0  → triangle strip (numVerts = header)
   *   < 0  → triangle fan   (numVerts = |header|)
   *   = 0  → end of mesh
   */
  triangulateMesh(
    mesh: StudioMesh,
    verts: Float32Array,
    texWidth: number,
    texHeight: number,
  ): {
    positions:     Float32Array
    uvs:           Float32Array
    vertexIndices: Uint16Array
    normalIndices: Uint16Array
  } | null {
    if (mesh.triIndex === 0 || mesh.numTris === 0) return null

    const buf    = this.buf
    const maxPos = Math.floor((buf.byteLength - mesh.triIndex) / 2)
    const tri    = new Int16Array(buf, mesh.triIndex, maxPos)

    // Pre-allocate worst-case: numTris triangles × 3 verts
    const maxVerts = mesh.numTris * 3
    const posArr  = new Float32Array(maxVerts * 3)
    const uvArr   = new Float32Array(maxVerts * 2)
    const viArr   = new Uint16Array(maxVerts)
    const niArr   = new Uint16Array(maxVerts)

    let out = 0   // output vertex count
    let pos = 0   // read position in tri[]

    while (pos < tri.length) {
      const header = tri[pos]
      if (header === 0) break
      pos++

      const numV  = Math.abs(header)
      const isFan = header < 0

      // Accumulate raw verts for this strip/fan
      const sv: { vi: number; ni: number; s: number; t: number }[] = []
      for (let j = 0; j < numV; j++) {
        if (pos + 3 >= tri.length) break
        sv.push({ vi: tri[pos], ni: tri[pos + 1], s: tri[pos + 2], t: tri[pos + 3] })
        pos += 4
      }
      if (sv.length < 3) continue

      // Triangulate strip/fan into individual triangles
      const tris: [typeof sv[0], typeof sv[0], typeof sv[0]][] = []
      if (isFan) {
        for (let j = 1; j < sv.length - 1; j++) tris.push([sv[0], sv[j], sv[j + 1]])
      } else {
        // Tri-strip winding alternates
        for (let j = 0; j < sv.length - 2; j++) {
          if (j % 2 === 0) tris.push([sv[j], sv[j + 1], sv[j + 2]])
          else             tris.push([sv[j + 1], sv[j], sv[j + 2]])
        }
      }

      const tw = texWidth  || 1
      const th = texHeight || 1

      for (const [a, b, c] of tris) {
        for (const v of [a, b, c]) {
          const vi = Math.max(0, v.vi)
          const ni = Math.max(0, v.ni)
          const base = vi * 3
          posArr[out * 3]     = base + 2 < verts.length ? verts[base]     : 0
          posArr[out * 3 + 1] = base + 2 < verts.length ? verts[base + 1] : 0
          posArr[out * 3 + 2] = base + 2 < verts.length ? verts[base + 2] : 0
          uvArr[out * 2]     = v.s / tw
          uvArr[out * 2 + 1] = v.t / th
          viArr[out] = vi
          niArr[out] = ni
          out++
        }
      }
    }

    if (out === 0) return null

    return {
      positions:     posArr.subarray(0, out * 3),
      uvs:           uvArr.subarray(0, out * 2),
      vertexIndices: viArr.subarray(0, out),
      normalIndices: niArr.subarray(0, out),
    }
  }

  /**
   * Read animation offset table for one sequence.
   * Returns an array of StudioAnim — one per bone.
   *
   * mstudioanim_t is exactly 12 bytes (6 × uint16 relative offsets).
   * offset[k] == 0  →  channel k is unanimated (use bone rest value).
   */
  readAnims(seqDesc: StudioSeqDesc, numBones: number): StudioAnim[] {
    const base = seqDesc.animIndex
    if (base === 0 || numBones === 0) {
      // Return all-zero anims
      return Array.from({ length: numBones }, (_, bi) => ({
        fileOffset: base + bi * 12,
        offset: [0, 0, 0, 0, 0, 0],
      }))
    }

    const buf = this.buf
    const anims: StudioAnim[] = []

    for (let b = 0; b < numBones; b++) {
      const fileOffset = base + b * 12
      if (fileOffset + 12 > buf.byteLength) {
        anims.push({ fileOffset, offset: [0, 0, 0, 0, 0, 0] })
        continue
      }
      const dv = new DataView(buf, fileOffset, 12)
      anims.push({
        fileOffset,
        offset: [
          dv.getUint16(0,  true),
          dv.getUint16(2,  true),
          dv.getUint16(4,  true),
          dv.getUint16(6,  true),
          dv.getUint16(8,  true),
          dv.getUint16(10, true),
        ],
      })
    }
    return anims
  }

  /**
   * Decode one channel value for a given frame from a mstudioanimvalue_t stream.
   *
   * Implements the exact same run-length decode logic as:
   *   StudioCalcBonePosition / StudioCalcBoneQuaterion  (HLSDK cl_dll/StudioModelRenderer.cpp)
   *
   * @param animFileOffset  Absolute file offset of the owning mstudioanim_t struct
   * @param channelOffset   Value from mstudioanim_t.offset[k]  (relative to animFileOffset)
   * @param frame           Integer frame index
   * @param frac            Fractional blend [0,1) for sub-frame interpolation
   * @returns               Decoded and blended float value (NOT yet scaled/biased)
   */
  decodeAnimValue(
    animFileOffset: number,
    channelOffset: number,
    frame: number,
    frac: number,
  ): number {
    if (channelOffset === 0) return 0  // channel unanimated

    const buf    = this.buf
    const dv     = new DataView(buf)
    const bufLen = buf.byteLength

    // Absolute byte address of the first mstudioanimvalue_t in this stream
    let streamBase = animFileOffset + channelOffset

    let k = frame

    // Walk the run-length encoded stream to find the run that contains frame k
    // mstudioanimvalue_t = 2 bytes:
    //   If used as header:  low byte = valid count, high byte = total count
    //   If used as value:   signed int16
    while (true) {
      if (streamBase + 1 >= bufLen) break
      const total = dv.getUint8(streamBase + 1)  // num.total
      const valid = dv.getUint8(streamBase)       // num.valid

      // DEBUG guard from HLSDK
      const safeK = (total < valid) ? 0 : k

      if (total > safeK) break   // frame is inside this run

      k -= total
      streamBase += (valid + 1) * 2  // skip header + valid values
    }

    // Now streamBase points to the header of the run containing frame k
    if (streamBase + 1 >= bufLen) return 0

    const valid = dv.getUint8(streamBase)
    const total = dv.getUint8(streamBase + 1)
    const safeK = (total < valid) ? 0 : k

    let v1: number
    let v2: number

    if (valid > safeK) {
      // We're inside the valid (literal) section
      v1 = dv.getInt16(streamBase + (safeK + 1) * 2, true)

      if (valid > safeK + 1) {
        v2 = dv.getInt16(streamBase + (safeK + 2) * 2, true)
      } else {
        // Next value: check if there's another run, otherwise repeat
        if (total > safeK + 1) {
          v2 = v1
        } else {
          // Peek at next run's first value
          const nextRunBase = streamBase + (valid + 1) * 2
          if (nextRunBase + 3 < bufLen) {
            v2 = dv.getInt16(nextRunBase + 2, true)
          } else {
            v2 = v1
          }
        }
      }
    } else {
      // We're in the repeated-value section (k >= valid)
      // The repeated value is the last literal in this run
      v1 = dv.getInt16(streamBase + valid * 2, true)

      if (total > safeK + 1) {
        v2 = v1
      } else {
        // Peek next run first value
        const nextRunBase = streamBase + (valid + 1) * 2
        if (nextRunBase + 3 < bufLen) {
          v2 = dv.getInt16(nextRunBase + 2, true)
        } else {
          v2 = v1
        }
      }
    }

    // Sub-frame linear interpolation
    return v1 * (1 - frac) + v2 * frac
  }
}
