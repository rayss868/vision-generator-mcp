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
    model: z.string().min(1).describe('Discovered model id from list_models.'),
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
    model: z.string().min(1).describe('Image-capable model id from list_models.'),
    prompt: z.string().min(1).max(5000).describe('Text prompt for image generation.'),
    negative_prompt: z.string().max(5000).optional().describe('Optional negative prompt.'),
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
    aspect_ratio: z.enum(['1:1', '4:5', '16:9', '9:16']).optional().describe('Optional aspect ratio.'),
    resolution: z.string().optional().describe('Optional resolution such as 1024x1024.'),
    seed: z.number().int().nonnegative().optional().describe('Optional deterministic seed.'),
    style: z.string().optional().describe('Optional style hint.'),
    safety_level: z.enum(['low', 'medium', 'high']).optional().describe('Optional safety level.'),
    output: z.object({
      directory: z
        .string()
        .min(1)
        .describe('Required destination folder on the user device. Recommended: a folder inside the currently opened workspace.'),
      filename_prefix: z.string().min(1).optional().describe('Optional filename prefix.'),
      overwrite: z.boolean().optional().describe('Overwrite existing file if true.'),
      create_directory: z.boolean().optional().describe('Create the directory if it does not exist.'),
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
    model: z.string().min(1).describe('Image editing-capable model id from list_models.'),
    prompt: z.string().min(1).max(5000).describe('Edit instruction prompt.'),
    image_path: z.string().min(1).describe('Local input image path.'),
    mask_path: z.string().min(1).optional().describe('Optional local mask image path.'),
    negative_prompt: z.string().max(5000).optional().describe('Optional negative prompt.'),
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
    aspect_ratio: z.enum(['1:1', '4:5', '16:9', '9:16']).optional().describe('Optional aspect ratio.'),
    resolution: z.string().optional().describe('Optional resolution such as 1024x1024.'),
    seed: z.number().int().nonnegative().optional().describe('Optional deterministic seed.'),
    style: z.string().optional().describe('Optional style hint.'),
    safety_level: z.enum(['low', 'medium', 'high']).optional().describe('Optional safety level.'),
    output: z.object({
      directory: z
        .string()
        .min(1)
        .describe('Required destination folder on the user device. Recommended: a folder inside the currently opened workspace.'),
      filename_prefix: z.string().min(1).optional().describe('Optional filename prefix.'),
      overwrite: z.boolean().optional().describe('Overwrite existing file if true.'),
      create_directory: z.boolean().optional().describe('Create the directory if it does not exist.'),
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
    model: z.string().min(1).describe('Video-capable model id from list_models.'),
    prompt: z.string().min(1).max(5000).describe('Text prompt for video generation.'),
    negative_prompt: z.string().max(5000).optional().describe('Optional negative prompt.'),
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
    duration_seconds: z.number().min(1).max(60).optional().describe('Optional duration in seconds.'),
    fps: z.number().int().min(1).max(60).optional().describe('Optional fps.'),
    aspect_ratio: z.enum(['1:1', '4:5', '16:9', '9:16']).optional().describe('Optional aspect ratio.'),
    resolution: z.string().optional().describe('Optional resolution such as 1280x720.'),
    seed: z.number().int().nonnegative().optional().describe('Optional deterministic seed.'),
    style: z.string().optional().describe('Optional style hint.'),
    safety_level: z.enum(['low', 'medium', 'high']).optional().describe('Optional safety level.'),
    output: z.object({
      directory: z
        .string()
        .min(1)
        .describe('Required destination folder on the user device. Recommended: a folder inside the currently opened workspace.'),
      filename_prefix: z.string().min(1).optional().describe('Optional filename prefix.'),
      overwrite: z.boolean().optional().describe('Overwrite existing file if true.'),
      create_directory: z.boolean().optional().describe('Create the directory if it does not exist.'),
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
    model: z.string().min(1).describe('Image-to-video capable model id from list_models.'),
    prompt: z.string().min(1).max(5000).describe('Animation prompt.'),
    image_path: z.string().min(1).describe('Local input image path.'),
    negative_prompt: z.string().max(5000).optional().describe('Optional negative prompt.'),
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
    duration_seconds: z.number().min(1).max(60).optional().describe('Optional duration in seconds.'),
    fps: z.number().int().min(1).max(60).optional().describe('Optional fps.'),
    aspect_ratio: z.enum(['1:1', '4:5', '16:9', '9:16']).optional().describe('Optional aspect ratio.'),
    resolution: z.string().optional().describe('Optional resolution such as 1280x720.'),
    seed: z.number().int().nonnegative().optional().describe('Optional deterministic seed.'),
    style: z.string().optional().describe('Optional style hint.'),
    safety_level: z.enum(['low', 'medium', 'high']).optional().describe('Optional safety level.'),
    output: z.object({
      directory: z
        .string()
        .min(1)
        .describe('Required destination folder on the user device. Recommended: a folder inside the currently opened workspace.'),
      filename_prefix: z.string().min(1).optional().describe('Optional filename prefix.'),
      overwrite: z.boolean().optional().describe('Overwrite existing file if true.'),
      create_directory: z.boolean().optional().describe('Create the directory if it does not exist.'),
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
    job_id: z.string().min(1).describe('Local MCP job id returned by generate_video or animate_image.'),
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