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