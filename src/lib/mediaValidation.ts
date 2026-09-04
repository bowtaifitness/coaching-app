export interface MediaValidationResult {
  ok: boolean;
  error?: string;
}

const CONTROL_CHARS = /[\x00-\x1f\x7f]/;
const PATH_SEPARATORS = /[\\/]|^\.+$|\.\.\//;

const SAFE_EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
};

const SAFE_AVATAR_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']);
const SAFE_VIDEO_MIME = new Set(['video/mp4', 'video/quicktime', 'video/webm']);
const SAFE_ATTACHMENT_MIME = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf', 'text/plain',
]);

const MIN_FILE_BYTES = 32;
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
export const MAX_TOTAL_ATTACHMENT_BYTES = 50 * 1024 * 1024;

function commonChecks(file: File, maxBytes: number): MediaValidationResult {
  if (!file || !(file instanceof File)) return { ok: false, error: 'No file selected.' };
  if (file.size <= 0) return { ok: false, error: 'File is empty.' };
  if (file.size < MIN_FILE_BYTES) return { ok: false, error: 'File is too small to be valid.' };
  if (file.size > maxBytes) {
    return { ok: false, error: `File exceeds ${(maxBytes / 1024 / 1024).toFixed(0)}MB limit.` };
  }
  const name = file.name ?? '';
  if (CONTROL_CHARS.test(name) || PATH_SEPARATORS.test(name) || name.length > 255) {
    return { ok: false, error: 'File name contains invalid characters.' };
  }
  return { ok: true };
}

export function validateAvatarFile(file: File): MediaValidationResult {
  const base = commonChecks(file, MAX_AVATAR_BYTES);
  if (!base.ok) return base;
  if (!SAFE_AVATAR_MIME.has(file.type)) {
    return { ok: false, error: 'Avatar must be JPEG, PNG, WebP, or GIF.' };
  }
  return { ok: true };
}

export function validateSwingVideoFile(file: File): MediaValidationResult {
  const base = commonChecks(file, MAX_VIDEO_BYTES);
  if (!base.ok) return base;
  if (!SAFE_VIDEO_MIME.has(file.type)) {
    return { ok: false, error: 'Please upload an MP4, MOV, or WebM video file.' };
  }
  return { ok: true };
}

export function validateAttachmentFile(file: File): MediaValidationResult {
  const base = commonChecks(file, MAX_ATTACHMENT_BYTES);
  if (!base.ok) return base;
  if (!SAFE_ATTACHMENT_MIME.has(file.type)) {
    return { ok: false, error: `${file.name}: file type not allowed.` };
  }
  return { ok: true };
}

export function safeExtensionFor(mime: string): string {
  return SAFE_EXT_BY_MIME[mime] ?? 'bin';
}

export function safeRandomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '');
  }
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function sanitizeDisplayName(name: string, maxLen = 120): string {
  return (name ?? '')
    .replace(CONTROL_CHARS, '')
    .replace(/[\\/]/g, '_')
    .replace(/^\.+/, '_')
    .slice(0, maxLen)
    .trim() || 'file';
}

export async function magicBytesMatch(file: File, kind: 'video' | 'image'): Promise<boolean> {
  try {
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    if (head.byteLength < 4) return false;
    if (kind === 'image') {
      // JPEG FFD8FF
      if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return true;
      // PNG 89504E47
      if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return true;
      // GIF87a / GIF89a
      if (head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46) return true;
      // WebP "RIFF....WEBP"
      if (head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46) return true;
      return false;
    }
    // video
    // MP4/MOV: bytes 4..7 == 'ftyp'
    if (head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70) return true;
    // WebM/Matroska EBML header 1A45DFA3
    if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return true;
    return false;
  } catch {
    return false;
  }
}
