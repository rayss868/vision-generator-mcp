#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { loadProviderConfig } from './config/providers.js';
import { formatErrorForTool, formatTextError } from './core/errors.js';
import { createVisionService } from './core/vision-service.js';
import { runAnimateImageTool } from './tools/animate-image.js';
import { runEditImageTool } from './tools/edit-image.js';
import { runGenerateImageTool } from './tools/generate-image.js';
import { runGenerateVideoTool } from './tools/generate-video.js';
import { runGetJobStatusTool } from './tools/get-job-status.js';
import { runGetModelCapabilitiesTool } from './tools/get-model-capabilities.js';
import { runListModelsTool } from './tools/list-models.js';

const providerConfig = loadProviderConfig();
const visionService = createVisionService(providerConfig);

const server = new McpServer({
  name: 'vision-generator-mcp',
  version: '0.1.0',
});

server.tool('list_models', {}, async () => {
  try {
    return await runListModelsTool(visionService);
  } catch (error) {
    return formatTextError(error);
  }
});

server.tool(
  'get_model_capabilities',
  {
    model: z
      .string()
      .min(1)
      .describe('Discovered model id from list_models. Use this tool to learn which prompt/image/video capabilities, resolutions, aspect ratios, and safety options a given model supports before calling a generation tool with that model.'),
  },
  async (rawArgs) => {
    try {
      return await runGetModelCapabilitiesTool(visionService, rawArgs);
    } catch (error) {
      return formatErrorForTool(error);
    }
  }
);

server.tool(
  'generate_image',
  {
    model: z
      .string()
      .min(1)
      .describe('Image-capable model id from list_models.'),
    prompt: z
      .string()
      .min(1)
      .max(5000)
      .describe(
        'Text prompt for image generation. Describe the full scene in natural, detailed prose: the main subject, its appearance and attributes, the setting/background, lighting, color palette, art style, mood, camera angle, and any other visual details that matter. The richer and more concrete the prompt, the closer the output will match intent. Use objective, visual language (e.g. "a weathered brass pocket watch on a dark oak desk, soft window light, shallow depth of field") instead of abstract praise.'
      ),
    negative_prompt: z
      .string()
      .max(5000)
      .optional()
      .describe(
        'Optional negative prompt: things you explicitly do NOT want in the image, e.g. "blurry, low quality, extra fingers, watermark, text". Used to steer the provider away from common artifacts or unwanted elements.'
      ),
    reference_text: z
      .string()
      .min(1)
      .max(10000)
      .optional()
      .describe(
        'Optional reference text / chat-memory context. Use this to carry over relevant information from earlier in the conversation so the generated image stays aligned with what the user already said or approved. INCLUDE ONLY what is actually relevant to THIS generation: (1) a short summary of the established style, mood, color palette, art direction, or visual preferences the user expressed; (2) any fixed details about the subject that MUST remain consistent (character appearance, clothing, setting, props, lighting, camera angle); (3) corrections or feedback the user gave on previous generations that should be applied now (e.g. "user said the previous version was too dark, prefers brighter daylight"); (4) any explicit constraints or things to avoid. Write it as concise but complete prose, not bullet fragments. Do NOT dump the entire raw chat history — synthesize only the decision-relevant facts. If there is nothing meaningful to carry over, omit this field entirely rather than sending filler text.'
      ),
    reference_images: z
      .array(z.string().min(1))
      .min(1)
      .max(10)
      .optional()
      .describe(
        'Optional list of LOCAL image file paths used as visual references so the output matches an existing look. Accepts absolute or workspace-relative paths only — URLs are NOT supported. USE CASES: (1) style reference(s) — pass 1-3 images whose art style / color grading / aesthetic should be imitated; (2) subject reference(s) — pass images showing the character, object, or environment whose appearance must be preserved; (3) composition/layout reference — an image whose framing or structure should be reused. BEST PRACTICE: keep the list small and purposeful (1-4 images is usually enough; the provider typically weights the first image highest); make sure every path exists and points to a readable image file (png/jpg/webp); do not mix unrelated images that contradict each other (e.g. two different character designs) unless you explicitly want the provider to blend them. For edit_image/animate_image, the primary input image is already provided via image_path — reference_images here is for ADDITIONAL references beyond that one.'
      ),
    aspect_ratio: z.enum(['1:1', '4:5', '16:9', '9:16']).optional().describe('Optional aspect ratio of the output image: 1:1 (square), 4:5 (portrait), 16:9 (landscape/widescreen), 9:16 (vertical/tall). Omit to use the provider default.'),
    resolution: z.string().optional().describe('Optional output resolution as "WxH", e.g. "1024x1024" or "1536x1024". Omit to use the provider default. Required/valid values depend on the model; check get_model_capabilities.'),
    seed: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe('Optional deterministic seed (non-negative integer). Reusing the same seed, prompt, and other params generally reproduces the same or similar image. Omit for a random output.'),
    style: z
      .string()
      .optional()
      .describe('Optional style hint passed to the provider, e.g. "watercolor", "3D render", "photorealistic", "anime". Use for a terse stylistic directive that supplements the prompt.'),
    safety_level: z
      .enum(['low', 'medium', 'high'])
      .optional()
      .describe('Optional safety filter level: low (least filtering) to high (most filtering). Depends on provider/model support; omit to use the provider default.'),
    output: z.object({
      directory: z
        .string()
        .min(1)
        .describe('Required destination folder on the user device (absolute path). Recommended: a folder inside the currently opened workspace so the result is easy to find. The server will place the generated file(s) here.'),
      filename_prefix: z.string().min(1).optional().describe('Optional prefix for the generated filename. The server appends a timestamp and, for multi-image results, an index. If omitted, a default prefix is used.'),
      overwrite: z.boolean().optional().describe('If true, overwrite an existing file with the same name instead of erroring or skipping. Default false.'),
      create_directory: z.boolean().optional().describe('If true, create the destination directory if it does not exist. Default false.'),
    }),
  },
  async (rawArgs) => {
    try {
      return await runGenerateImageTool(visionService, rawArgs);
    } catch (error) {
      return formatErrorForTool(error);
    }
  }
);

server.tool(
  'edit_image',
  {
    model: z
      .string()
      .min(1)
      .describe('Image editing-capable model id from list_models (one whose operations include image_editing).'),
    prompt: z
      .string()
      .min(1)
      .max(5000)
      .describe('Edit instruction prompt: what to change in image_path. State the edit as a clear, concrete instruction, e.g. "Replace the background with a neon cyberpunk street", "Add sunglasses and a leather jacket", "Make it a rainy night scene". Keep unchanged parts of the image implicit — reference memory/images if those must stay fixed.'),
    image_path: z
      .string()
      .min(1)
      .describe('Required local path (absolute or workspace-relative) of the source image to edit. Must point to an existing, readable image file (png/jpg/webp). Do NOT use a URL.'),
    mask_path: z
      .string()
      .min(1)
      .optional()
      .describe('Optional local path to a mask image (absolute or workspace-relative). The mask defines which region of image_path is editable (commonly white = editable area, black = preserved). Use it for targeted/regional edits instead of whole-image changes. Must be an existing, readable image file; omit to edit the whole image.'),
    negative_prompt: z
      .string()
      .max(5000)
      .optional()
      .describe('Optional negative prompt: things you explicitly do NOT want in the edited result, e.g. "blurry, low quality, extra fingers, watermark, text".'),

    reference_text: z
      .string()
      .min(1)
      .max(10000)
      .optional()
      .describe(
        'Optional reference text / chat-memory context. Use this to carry over relevant information from earlier in the conversation so the edit stays aligned with what the user already said or approved. INCLUDE ONLY what is actually relevant to THIS edit: (1) a short summary of the established style, mood, color palette, art direction, or visual preferences the user expressed; (2) any fixed details about the subject that MUST remain consistent (character appearance, clothing, setting, props, lighting, camera angle); (3) corrections or feedback the user gave on previous generations that should be applied now; (4) any explicit constraints or things to avoid. Write it as concise but complete prose, not bullet fragments. Do NOT dump the entire raw chat history — synthesize only the decision-relevant facts. If there is nothing meaningful to carry over, omit this field entirely rather than sending filler text.'
      ),
    reference_images: z
      .array(z.string().min(1))
      .min(1)
      .max(10)
      .optional()
      .describe(
        'Optional list of LOCAL image file paths used as ADDITIONAL visual references beyond image_path (which is the primary image being edited). Accepts absolute or workspace-relative paths only — URLs are NOT supported. USE CASES: (1) style reference(s) — pass 1-3 images whose art style / color grading / aesthetic should be imitated in the edit; (2) subject reference(s) — pass images showing the character, object, or environment whose appearance must be preserved while editing the primary image; (3) source material to copy elements from. BEST PRACTICE: keep the list small and purposeful (1-4 images is usually enough); make sure every path exists and points to a readable image file (png/jpg/webp); avoid mixing images that contradict each other unless blending is explicitly intended. If you only need to edit the single image in image_path, omit this field.'
      ),
    aspect_ratio: z.enum(['1:1', '4:5', '16:9', '9:16']).optional().describe('Optional aspect ratio of the output image: 1:1 (square), 4:5 (portrait), 16:9 (landscape/widescreen), 9:16 (vertical/tall). Omit to use the provider default.'),
    resolution: z.string().optional().describe('Optional output resolution as "WxH", e.g. "1024x1024" or "1536x1024". Omit to use the provider default. Required/valid values depend on the model; check get_model_capabilities.'),
    seed: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe('Optional deterministic seed (non-negative integer). Reusing the same seed, prompt, and other params generally reproduces the same or similar image. Omit for a random output.'),
    style: z
      .string()
      .optional()
      .describe('Optional style hint passed to the provider, e.g. "watercolor", "3D render", "photorealistic", "anime". Use for a terse stylistic directive that supplements the prompt.'),
    safety_level: z
      .enum(['low', 'medium', 'high'])
      .optional()
      .describe('Optional safety filter level: low (least filtering) to high (most filtering). Depends on provider/model support; omit to use the provider default.'),
    output: z.object({
      directory: z
        .string()
        .min(1)
        .describe('Required destination folder on the user device (absolute path). Recommended: a folder inside the currently opened workspace so the result is easy to find. The server will place the generated file(s) here.'),
      filename_prefix: z.string().min(1).optional().describe('Optional prefix for the generated filename. The server appends a timestamp and, for multi-image results, an index. If omitted, a default prefix is used.'),
      overwrite: z.boolean().optional().describe('If true, overwrite an existing file with the same name instead of erroring or skipping. Default false.'),
      create_directory: z.boolean().optional().describe('If true, create the destination directory if it does not exist. Default false.'),
    }),
  },
  async (rawArgs) => {
    try {
      return await runEditImageTool(visionService, rawArgs);
    } catch (error) {
      return formatErrorForTool(error);
    }
  }
);

server.tool(
  'generate_video',
  {
    model: z
      .string()
      .min(1)
      .describe('Video-capable model id from list_models (one whose operations include text_to_video).'),
    prompt: z
      .string()
      .min(1)
      .max(5000)
      .describe('Text prompt for video generation. Describe the scene, action/motion, subject, setting, lighting, color palette, art style, mood, and camera movement (e.g. tracking, fly-over, zoom, handheld). Because this is motion, state what moves and how, not just a static scene — e.g. "a cinematic aerial shot flying over a futuristic city at dusk, neon reflections, slow forward dolly".'),
    negative_prompt: z
      .string()
      .max(5000)
      .optional()
      .describe('Optional negative prompt: things you explicitly do NOT want in the video, e.g. "blurry, flicker, distortion, watermark, text".'),
    duration_seconds: z
      .number()
      .min(1)
      .max(60)
      .optional()
      .describe('Optional target video duration in seconds (1-60). Omit to use the provider default. Supported range depends on the model.'),
    fps: z
      .number()
      .int()
      .min(1)
      .max(60)
      .optional()
      .describe('Optional frames per second (integer, 1-60). Higher fps = smoother motion but larger file and longer render. Omit to use the provider default.'),

    reference_text: z
      .string()
      .min(1)
      .max(10000)
      .optional()
      .describe(
        'Optional reference text / chat-memory context. Use this to carry over relevant information from earlier in the conversation so the generated video stays aligned with what the user already said or approved. INCLUDE ONLY what is actually relevant to THIS video: (1) a short summary of the established style, mood, color palette, art direction, or visual preferences the user expressed; (2) any fixed details about the subject that MUST remain consistent (character appearance, clothing, setting, props, lighting, camera movement); (3) corrections or feedback the user gave on previous generations that should be applied now (e.g. "user said the previous version was too fast, prefers slower camera pans"); (4) any explicit constraints or things to avoid. Write it as concise but complete prose, not bullet fragments. Do NOT dump the entire raw chat history — synthesize only the decision-relevant facts. If there is nothing meaningful to carry over, omit this field entirely rather than sending filler text.'
      ),
    reference_images: z
      .array(z.string().min(1))
      .min(1)
      .max(10)
      .optional()
      .describe(
        'Optional list of LOCAL image file paths used as visual references so the video output matches an existing look. Accepts absolute or workspace-relative paths only — URLs are NOT supported. USE CASES: (1) style reference(s) — pass 1-3 images whose art style / color grading / aesthetic should be imitated in the video; (2) subject reference(s) — pass images showing the character, object, or environment whose appearance must be preserved across the animation; (3) keyframe/first-frame reference — an image defining the starting shot or composition. BEST PRACTICE: keep the list small and purposeful (1-4 images is usually enough; the provider typically weights the first image highest); make sure every path exists and points to a readable image file (png/jpg/webp); do not mix unrelated images that contradict each other unless you explicitly want the provider to blend them. If no visual reference is needed, omit this field.'
      ),
    aspect_ratio: z.enum(['1:1', '4:5', '16:9', '9:16']).optional().describe('Optional aspect ratio of the output video: 1:1 (square), 4:5 (portrait), 16:9 (landscape/widescreen), 9:16 (vertical/tall). Omit to use the provider default.'),
    resolution: z.string().optional().describe('Optional output resolution as "WxH", e.g. "1280x720". Omit to use the provider default. Required/valid values depend on the model; check get_model_capabilities.'),
    seed: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe('Optional deterministic seed (non-negative integer). Reusing the same seed, prompt, and other params generally reproduces the same or similar output. Omit for a random output.'),
    style: z
      .string()
      .optional()
      .describe('Optional style hint passed to the provider, e.g. "cinematic", "anime", "documentary". Use for a terse stylistic directive that supplements the prompt.'),
    safety_level: z
      .enum(['low', 'medium', 'high'])
      .optional()
      .describe('Optional safety filter level: low (least filtering) to high (most filtering). Depends on provider/model support; omit to use the provider default.'),
    output: z.object({
      directory: z
        .string()
        .min(1)
        .describe('Required destination folder on the user device (absolute path). Recommended: a folder inside the currently opened workspace so the result is easy to find. The server will place the generated file(s) here.'),
      filename_prefix: z.string().min(1).optional().describe('Optional prefix for the generated filename. The server appends a timestamp. If omitted, a default prefix is used.'),
      overwrite: z.boolean().optional().describe('If true, overwrite an existing file with the same name instead of erroring or skipping. Default false.'),
      create_directory: z.boolean().optional().describe('If true, create the destination directory if it does not exist. Default false.'),
    }),
  },
  async (rawArgs) => {
    try {
      return await runGenerateVideoTool(visionService, rawArgs);
    } catch (error) {
      return formatErrorForTool(error);
    }
  }
);

server.tool(
  'animate_image',
  {
    model: z
      .string()
      .min(1)
      .describe('Image-to-video capable model id from list_models (one whose operations include image_to_video).'),
    prompt: z
      .string()
      .min(1)
      .max(5000)
      .describe('Animation prompt describing the motion to apply to image_path. The image supplies the look/subject; the prompt should focus on what animates and how — e.g. "the clouds drift slowly across the sky, leaves sway in the breeze, camera lingers then slowly zooms in". Avoid describing a completely new scene, since the source image is fixed.'),
    image_path: z
      .string()
      .min(1)
      .describe('Required local path (absolute or workspace-relative) of the source still image to animate. Must be an existing, readable image file (png/jpg/webp). Do NOT use a URL.'),
    negative_prompt: z
      .string()
      .max(5000)
      .optional()
      .describe('Optional negative prompt: things you explicitly do NOT want in the animated result, e.g. "flicker, morphing artifacts, distortion, watermark, text".'),
    duration_seconds: z
      .number()
      .min(1)
      .max(60)
      .optional()
      .describe('Optional target video duration in seconds (1-60). Omit to use the provider default. Supported range depends on the model.'),
    fps: z
      .number()
      .int()
      .min(1)
      .max(60)
      .optional()
      .describe('Optional frames per second (integer, 1-60). Higher fps = smoother motion but larger file and longer render. Omit to use the provider default.'),

    reference_text: z
      .string()
      .min(1)
      .max(10000)
      .optional()
      .describe(
        'Optional reference text / chat-memory context. Use this to carry over relevant information from earlier in the conversation so the animation stays aligned with what the user already said or approved. INCLUDE ONLY what is actually relevant to THIS animation: (1) a short summary of the established style, mood, color palette, art direction, or visual preferences the user expressed; (2) any fixed details about the subject that MUST remain consistent (character appearance, clothing, setting, props, lighting, camera movement); (3) corrections or feedback the user gave on previous generations that should be applied now; (4) any explicit constraints or things to avoid. Write it as concise but complete prose, not bullet fragments. Do NOT dump the entire raw chat history — synthesize only the decision-relevant facts. If there is nothing meaningful to carry over, omit this field entirely rather than sending filler text.'
      ),
    reference_images: z
      .array(z.string().min(1))
      .min(1)
      .max(10)
      .optional()
      .describe(
        'Optional list of LOCAL image file paths used as ADDITIONAL visual references beyond image_path (which is the primary image being animated). Accepts absolute or workspace-relative paths only — URLs are NOT supported. USE CASES: (1) style reference(s) — pass 1-3 images whose art style / color grading / aesthetic should be imitated in the animation; (2) subject reference(s) — pass images showing the character, object, or environment whose appearance must be preserved; (3) setting/background references for the scene the animation should take place in. BEST PRACTICE: keep the list small and purposeful (1-4 images is usually enough); make sure every path exists and points to a readable image file (png/jpg/webp); avoid mixing images that contradict each other unless blending is explicitly intended. If you only need to animate the single image in image_path, omit this field.'
      ),
    aspect_ratio: z.enum(['1:1', '4:5', '16:9', '9:16']).optional().describe('Optional aspect ratio of the output video: 1:1 (square), 4:5 (portrait), 16:9 (landscape/widescreen), 9:16 (vertical/tall). Omit to use the provider default.'),
    resolution: z.string().optional().describe('Optional output resolution as "WxH", e.g. "1280x720". Omit to use the provider default. Required/valid values depend on the model; check get_model_capabilities.'),
    seed: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe('Optional deterministic seed (non-negative integer). Reusing the same seed, prompt, and other params generally reproduces the same or similar output. Omit for a random output.'),
    style: z
      .string()
      .optional()
      .describe('Optional style hint passed to the provider, e.g. "cinematic", "anime", "documentary". Use for a terse stylistic directive that supplements the prompt.'),
    safety_level: z
      .enum(['low', 'medium', 'high'])
      .optional()
      .describe('Optional safety filter level: low (least filtering) to high (most filtering). Depends on provider/model support; omit to use the provider default.'),
    output: z.object({
      directory: z
        .string()
        .min(1)
        .describe('Required destination folder on the user device (absolute path). Recommended: a folder inside the currently opened workspace so the result is easy to find. The server will place the generated file(s) here.'),
      filename_prefix: z.string().min(1).optional().describe('Optional prefix for the generated filename. The server appends a timestamp. If omitted, a default prefix is used.'),
      overwrite: z.boolean().optional().describe('If true, overwrite an existing file with the same name instead of erroring or skipping. Default false.'),
      create_directory: z.boolean().optional().describe('If true, create the destination directory if it does not exist. Default false.'),
    }),
  },
  async (rawArgs) => {
    try {
      return await runAnimateImageTool(visionService, rawArgs);
    } catch (error) {
      return formatErrorForTool(error);
    }
  }
);

server.tool(
  'get_job_status',
  {
    job_id: z
      .string()
      .min(1)
      .describe(
        'Required local MCP job id returned by generate_video or animate_image when the provider runs asynchronously. Use this tool to poll the job until it completes, then read the resulting output file path. The exact job id string from the earlier submission response.'
      ),
  },
  async (rawArgs) => {
    try {
      return await runGetJobStatusTool(visionService, rawArgs);
    } catch (error) {
      return formatErrorForTool(error);
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('vision-generator-mcp running on stdio');