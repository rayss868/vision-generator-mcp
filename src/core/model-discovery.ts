import type { VisionModelCapability } from '../types/contracts.js';
import type { ProviderModelInfo } from '../providers/base-provider.js';

export function inferVisionCapability(model: ProviderModelInfo): VisionModelCapability | null {
  const id = model.id;
  const haystack = [
    id,
    model.object,
    model.owned_by,
    model.type,
    JSON.stringify(model.modalities ?? []),
    JSON.stringify(model.input_modalities ?? []),
    JSON.stringify(model.output_modalities ?? []),
    JSON.stringify(model.capabilities ?? {}),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const imageGeneration = /(image|vision|img)/.test(haystack);
  const imageEditing = /(edit|inpaint|mask)/.test(haystack) || imageGeneration;
  const imageVariation = /(variation|variations)/.test(haystack);
  const textToVideo = /(video|movie|motion|animation)/.test(haystack);
  const imageToVideo = textToVideo && /(image|vision|img)/.test(haystack);

  if (!imageGeneration && !imageEditing && !imageVariation && !textToVideo && !imageToVideo) {
    return null;
  }

  return {
    id,
    operations: {
      image_generation: imageGeneration,
      image_editing: imageEditing,
      image_variation: imageVariation,
      text_to_video: textToVideo,
      image_to_video: imageToVideo,
    },
  };
}

export function buildVisionModelRegistry(providerModels: ProviderModelInfo[]): VisionModelCapability[] {
  return providerModels
    .map((model) => inferVisionCapability(model))
    .filter((model): model is VisionModelCapability => model !== null)
    .sort((a, b) => a.id.localeCompare(b.id));
}
