/** Zod mirrors of the schema-file types. One definition drives runtime validation. */

import { z } from 'zod';
import { DOT_KINDS } from './kinds';

export const SCHEMA_VERSION = 1;

export const contentPartSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('static'), value: z.string() }),
  z.object({ kind: z.literal('dynamic'), expr: z.string() }),
]);

export const dotNodeSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(DOT_KINDS),
    element: z.string().min(1),
    className: z.string(),
    dynamicClassName: z.boolean(),
    required: z.boolean(),
    description: z.string().optional(),
    repeated: z.literal(true).optional(),
    content: z.array(contentPartSchema),
  })
  .strict();

export const panelNodeSchema = z
  .object({
    id: z.string().min(1),
    kind: z.literal('panel'),
    element: z.string().min(1),
    className: z.string(),
    dynamicClassName: z.boolean(),
    description: z.string().optional(),
    repeated: z.literal(true).optional(),
    children: z.array(z.string()),
  })
  .strict();

export const paletteSchema = z
  .object({
    seededFromAuthor: z.array(z.string()),
    families: z.array(z.string()),
  })
  .strict();

export const schemaFileSchema = z
  .object({
    version: z.number().int().positive(),
    panels: z.record(z.string(), panelNodeSchema),
    dots: z.record(z.string(), dotNodeSchema),
    palette: paletteSchema,
  })
  .strict();
