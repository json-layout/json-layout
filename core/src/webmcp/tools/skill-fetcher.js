/**
 * @file skillFetcher tool
 */

import { generateSkill } from '../skill.js'

export const inputSchema = {
  type: 'object',
  properties: {
    topic: {
      type: 'string',
      description: 'Topic for the skill (currently supports "json-layout-form-filling")'
    }
  }
}

/**
 * @param {{ dataTitle: string }} context
 * @param {{ topic?: string }} args
 * @returns {{ content: string }}
 */
export function execute (context, args) {
  if (args.topic && args.topic !== 'json-layout-form-filling') {
    return { content: `No skill available for topic: ${args.topic}` }
  }

  return { content: generateSkill(context.dataTitle) }
}
