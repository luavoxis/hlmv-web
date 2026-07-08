/**
 * TextureBuilder — converts GoldSrc 8-bit palettised textures to Three.js DataTexture.
 *
 * Supported texture flags (from HLSDK studio.h):
 *   STUDIO_NF_MASKED   (0x0040) — palette index 255 is transparent (alpha = 0)
 *   STUDIO_NF_ADDITIVE (0x0020) — additive blending (handled by material, not here)
 *   STUDIO_NF_CHROME   (0x0002) — chrome reflection (UV generated at runtime)
 *   STUDIO_NF_FULLBRIGHT (0x0004) — ignore lighting (handled by material)
 */
import {
  DataTexture, RGBAFormat, UnsignedByteType,
  LinearFilter, NearestFilter, ClampToEdgeWrapping,
} from 'three'
import { StudioTexture, STUDIO_NF_MASKED, STUDIO_NF_CHROME } from '../types/mdl'

export class TextureBuilder {
  private cache = new Map<StudioTexture, DataTexture>()

  build(tex: StudioTexture): DataTexture {
    const cached = this.cache.get(tex)
    if (cached) return cached

    const dt = this.decode(tex)
    this.cache.set(tex, dt)
    return dt
  }

  isChrome(tex: StudioTexture): boolean {
    return (tex.flags & STUDIO_NF_CHROME) !== 0
  }

  private decode(tex: StudioTexture): DataTexture {
    const { width, height, pixels, palette, flags } = tex
    const isMasked = (flags & STUDIO_NF_MASKED) !== 0

    // Fallback 1×1 grey texture when pixel data is missing
    if (pixels.length === 0 || width === 0 || height === 0) {
      const fb = new Uint8Array([128, 128, 128, 255])
      const dt = new DataTexture(fb, 1, 1, RGBAFormat, UnsignedByteType)
      dt.needsUpdate = true
      return dt
    }

    const rgba = new Uint8Array(width * height * 4)

    for (let i = 0; i < width * height; i++) {
      const idx = pixels[i]
      const p   = Math.min(idx, 255) * 3
      rgba[i * 4]     = palette[p]
      rgba[i * 4 + 1] = palette[p + 1]
      rgba[i * 4 + 2] = palette[p + 2]
      // In GoldSrc, palette entry 255 is the transparent colour for masked textures
      rgba[i * 4 + 3] = (isMasked && idx === 255) ? 0 : 255
    }

    const dt = new DataTexture(rgba, width, height, RGBAFormat, UnsignedByteType)
    dt.magFilter     = NearestFilter   // crisp pixel look matching original HLMV
    dt.minFilter     = LinearFilter
    dt.wrapS         = ClampToEdgeWrapping
    dt.wrapT         = ClampToEdgeWrapping
    dt.needsUpdate   = true
    return dt
  }

  dispose(): void {
    for (const dt of this.cache.values()) dt.dispose()
    this.cache.clear()
  }
}
