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
