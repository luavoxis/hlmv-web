/**
 * BinaryReader — safe, bounds-checked sequential reader over an ArrayBuffer.
 * Always little-endian (GoldSrc MDL format).
 */
export class BinaryReader {
  private readonly view: DataView
  private pos: number = 0
  private readonly LE = true

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer)
  }

  get buffer(): ArrayBuffer { return this.view.buffer as ArrayBuffer }
  get byteLength(): number  { return this.view.byteLength }
  get offset(): number      { return this.pos }

  seek(to: number): void {
    if (to < 0 || to > this.view.byteLength) {
      throw new RangeError(`BinaryReader.seek(${to}) out of range [0, ${this.view.byteLength}]`)
    }
    this.pos = to
  }

  skip(n: number): void { this.seek(this.pos + n) }
  tell(): number        { return this.pos }
  eof(): boolean        { return this.pos >= this.view.byteLength }

  // ── Scalar reads ──────────────────────────────────────────────────────────

  readInt8(): number {
    const v = this.view.getInt8(this.pos); this.pos += 1; return v
  }
  readUint8(): number {
    const v = this.view.getUint8(this.pos); this.pos += 1; return v
  }
  readInt16(): number {
    const v = this.view.getInt16(this.pos, this.LE); this.pos += 2; return v
  }
  readUint16(): number {
    const v = this.view.getUint16(this.pos, this.LE); this.pos += 2; return v
  }
  readInt32(): number {
    const v = this.view.getInt32(this.pos, this.LE); this.pos += 4; return v
  }
  readUint32(): number {
    const v = this.view.getUint32(this.pos, this.LE); this.pos += 4; return v
  }
  readFloat32(): number {
    const v = this.view.getFloat32(this.pos, this.LE); this.pos += 4; return v
  }

  // ── Array reads ───────────────────────────────────────────────────────────

  readInt32Array(count: number): number[] {
    const a: number[] = new Array(count)
    for (let i = 0; i < count; i++) a[i] = this.readInt32()
    return a
  }
  readFloat32Array(count: number): number[] {
    const a: number[] = new Array(count)
    for (let i = 0; i < count; i++) a[i] = this.readFloat32()
    return a
  }

  /** Read a null-terminated ASCII string from a fixed-width field. */
  readString(maxLen: number): string {
    const bytes = new Uint8Array(this.view.buffer, this.pos, maxLen)
    this.pos += maxLen
    let end = 0
    while (end < maxLen && bytes[end] !== 0) end++
    return new TextDecoder('ascii').decode(bytes.subarray(0, end))
  }

  /** Return a Uint8Array view (zero-copy) without advancing position. */
  viewUint8(offset: number, length: number): Uint8Array {
    return new Uint8Array(this.view.buffer, offset, length)
  }

  /** Return a Float32Array view (zero-copy) without advancing position. */
  viewFloat32(offset: number, count: number): Float32Array {
    // Float32Array requires 4-byte alignment; if offset is unaligned, copy
    if (offset % 4 === 0) {
      return new Float32Array(this.view.buffer, offset, count)
    }
    const tmp = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      tmp[i] = this.view.getFloat32(offset + i * 4, this.LE)
    }
    return tmp
  }

  /** Read `count` items using a per-item reader callback. */
  readArray<T>(count: number, reader: () => T): T[] {
    const a: T[] = new Array(count)
    for (let i = 0; i < count; i++) a[i] = reader()
    return a
  }
}
