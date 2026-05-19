import { lookup as lookupMimeType } from 'mime-types';

export function detectMimeType(bytes: Buffer, fallback: string): string {
  if (bytes.length >= 4) {
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif';
  }

  return fallback;
}

export function coerceMimeType(filePath: string): string {
  return lookupMimeType(filePath) || 'application/octet-stream';
}
