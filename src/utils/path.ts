import path from 'path';

export function sanitizeFilename(input: string): string {
  return input.replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'vision-output';
}

export function resolveOutputPath(directory: string): string {
  return path.resolve(directory);
}

export async function ensureUniquePath(
  initialPath: string,
  access: (target: string) => Promise<void>
): Promise<string> {
  const parsed = path.parse(initialPath);
  let candidate = initialPath;
  let index = 1;

  while (true) {
    try {
      await access(candidate);
      candidate = path.join(parsed.dir, `${parsed.name}_${index}${parsed.ext}`);
      index += 1;
    } catch {
      return candidate;
    }
  }
}
