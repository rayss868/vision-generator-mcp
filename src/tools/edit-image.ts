import type { VisionService } from '../core/vision-service.js';
import { EditImageSchema } from '../validation/image.js';

export async function runEditImageTool(visionService: VisionService, rawArgs: unknown) {
  const args = EditImageSchema.parse(rawArgs);
  const result = await visionService.editImage(args);

  const imageOutput = result.outputs.find((o) => o.type === 'image');
  const content: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }> = [];

  if (imageOutput?.base64_data) {
    content.push({
      type: 'image',
      data: imageOutput.base64_data,
      mimeType: imageOutput.mime_type,
    });
  }

  const summary = { ...result };
  for (const o of summary.outputs) {
    delete o.base64_data;
  }
  content.push({ type: 'text', text: JSON.stringify(summary, null, 2) });

  return { content };
}
