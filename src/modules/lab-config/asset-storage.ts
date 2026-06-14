import type { SupabaseClient } from '@supabase/supabase-js';

/** Private bucket for lab branding assets (logo, signature). */
export const ASSETS_BUCKET = 'assets';

export const ALLOWED_IMAGE_MIME = ['image/png', 'image/jpeg', 'image/webp'] as const;

export function extFromMime(mime: string): string {
  switch (mime) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    default:
      return 'bin';
  }
}

function mimeFromBuffer(buf: Buffer): string {
  // PNG: magic bytes 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  // JPEG: magic bytes FF D8
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  // Fallback: guess from extension
  const ext = buf.toString('ascii', 0, 4);
  if (ext.startsWith('\x89PNG')) return 'image/png';
  return 'image/jpeg';
}

/**
 * Strict magic-byte sniffer for UPLOAD validation. Returns the real MIME type
 * ONLY for the allowed image formats (PNG/JPEG/WEBP), or `null` if the buffer
 * is not a recognized allowed image. Unlike {@link mimeFromBuffer} (which has a
 * lenient JPEG fallback for rendering), this never guesses — so a spoofed
 * Content-Type header cannot smuggle an unsupported/dangerous payload through.
 */
export function sniffImageMime(buf: Buffer): (typeof ALLOWED_IMAGE_MIME)[number] | null {
  if (buf.length < 12) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'image/png';
  }
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  // WEBP: "RIFF" .... "WEBP"
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

export async function uploadAssetToBucket(
  storage: SupabaseClient,
  path: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const { error } = await storage.storage
    .from(ASSETS_BUCKET)
    .upload(path, buffer, { contentType, upsert: true });
  if (error) throw new Error(`No se pudo subir el asset: ${error.message}`);
  return path;
}

/**
 * Resolves a lab_config image field to a value usable by @react-pdf <Image src>.
 * - null/empty -> null
 * - data: / http(s) URL -> returned as-is (back-compat with old configs)
 * - otherwise: treated as a path inside the private `assets` bucket, downloaded
 *   and embedded as a base64 data URI (mirrors how the logo fallback works).
 */
export async function resolveAssetDataUri(
  storage: SupabaseClient,
  value: string | null | undefined,
): Promise<string | null> {
  if (!value) return null;
  if (value.startsWith('data:') || value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  const { data, error } = await storage.storage.from(ASSETS_BUCKET).download(value);
  if (error || !data) return null;
  const buf = Buffer.from(await data.arrayBuffer());
  return `data:${mimeFromBuffer(buf)};base64,${buf.toString('base64')}`;
}
