import { promises as fs } from 'fs';
import path from 'path';
import type { OutputTarget } from '../types/contracts.js';
import { coerceMimeType, detectMimeType } from '../utils/mime.js';
import { ensureUniquePath, resolveOutputPath, sanitizeFilename } from '../utils/path.js';

export interface FilePublishResult {
  finalPath: string;
  mimeType: string;
}

export async function publishOutput(
  bytes: Buffer,
  output: OutputTarget,
  defaultExtension: string
): Promise<FilePublishResult> {
  const directory = resolveOutputPath(output.directory);
  const createDirectory = output.create_directory ?? true;
  const overwrite = output.overwrite ?? false;
  const prefix = sanitizeFilename(output.filename_prefix ?? 'vision-output');

  if (createDirectory) {
    await fs.mkdir(directory, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseName = `${prefix}_${timestamp}`;
  let target = path.join(directory, `${baseName}${defaultExtension}`);

  if (!overwrite) {
    target = await ensureUniquePath(target, fs.access);
  }

  await fs.writeFile(target, bytes);
  return {
    finalPath: target,
    mimeType: detectMimeType(bytes, coerceMimeType(target)),
  };
}
