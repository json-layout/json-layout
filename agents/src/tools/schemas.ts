import { z } from 'zod'

const projectedNodeSchema: z.ZodType = z.object({
  key: z.union([z.string(), z.number()]),
  path: z.string(),
  comp: z.string(),
  data: z.unknown().optional(),
  title: z.string().optional(),
  label: z.string().optional(),
  help: z.string().optional(),
  error: z.string().optional(),
  childError: z.boolean().optional(),
  required: z.boolean().optional(),
  readOnly: z.boolean().optional(),
  constraints: z.record(z.unknown()).optional(),
  oneOfItems: z.array(z.object({ key: z.number(), title: z.string() })).optional(),
  children: z.lazy(() => z.array(projectedNodeSchema)).optional()
})

export const stateTreeSchema = z.object({
  root: projectedNodeSchema,
  valid: z.boolean()
})

export const errorsSchema = z.array(z.object({
  path: z.string(),
  message: z.string()
}))

export const validationErrorsSchema = z.array(z.object({
  pointer: z.string(),
  messages: z.array(z.string())
}))

export const suggestionItemSchema = z.object({
  value: z.unknown(),
  title: z.string(),
  key: z.string().optional()
})
