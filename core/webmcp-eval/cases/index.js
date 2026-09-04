/**
 * @file Eval cases: forms an agent is asked to fill through the WebMCP tools.
 *
 * Each case is a realistic schema plus a goal written the way a user would phrase it,
 * and the data a correct run must end up with. The budgets are the point of the whole
 * harness: unit tests prove a tool returns the right shape, but nothing proved a form
 * was *fillable* — that an agent can get from the goal to valid data without burning
 * an unreasonable number of calls or drowning in output. A case that still passes its
 * assertions while blowing its budget is a protocol regression, not a bug in the agent.
 */

/** @typedef {import('./types.js').EvalCase} EvalCase */

/**
 * Small flat form. The skill tells agents to read the schema and try a single
 * setData here, so the call budget is deliberately tight: anything much above this
 * means the one-shot path stopped working and the agent fell back to field-by-field.
 * @type {EvalCase}
 */
const contact = {
  name: 'contact',
  title: 'contact form',
  goal: 'Fill in the contact form for Ada Lovelace, born in 1815, email ada@analytical.org, who prefers to be contacted by email.',
  schema: {
    type: 'object',
    title: 'Contact',
    required: ['name', 'email'],
    properties: {
      name: { type: 'string', title: 'Full name' },
      birthYear: { type: 'integer', title: 'Year of birth', minimum: 1800, maximum: 2100 },
      email: { type: 'string', title: 'Email', format: 'email' },
      contactMethod: { type: 'string', title: 'Preferred contact method', enum: ['email', 'phone', 'post'] }
    }
  },
  data: {},
  expected: {
    name: 'Ada Lovelace',
    birthYear: 1815,
    email: 'ada@analytical.org',
    contactMethod: 'email'
  },
  budget: { toolCalls: 8, outputBytes: 12_000 }
}

/**
 * Array editing. `editArray` add + N `setFieldValue` per item is the most call-hungry
 * shape in the protocol, and the one that made a 10-step agent loop truncate mid-form:
 * two items alone need roughly a dozen calls before anything is valid.
 * @type {EvalCase}
 */
const team = {
  name: 'team',
  title: 'team roster',
  goal: 'Register the team "Analytical Engine" with two members: Ada Lovelace (role engineer) and Charles Babbage (role architect).',
  schema: {
    type: 'object',
    title: 'Team',
    required: ['teamName', 'members'],
    properties: {
      teamName: { type: 'string', title: 'Team name' },
      members: {
        type: 'array',
        title: 'Members',
        items: {
          type: 'object',
          required: ['name', 'role'],
          properties: {
            name: { type: 'string', title: 'Name' },
            role: { type: 'string', title: 'Role', enum: ['engineer', 'architect', 'analyst'] }
          }
        }
      }
    }
  },
  data: {},
  expected: {
    teamName: 'Analytical Engine',
    members: [
      { name: 'Ada Lovelace', role: 'engineer' },
      { name: 'Charles Babbage', role: 'architect' }
    ]
  },
  budget: { toolCalls: 20, outputBytes: 30_000 }
}

/**
 * A form whose schema is big enough that getSchema refuses to return it whole, so the
 * agent has to navigate by path. This is the case the "large" branch of the skill is
 * written for, and the one where an unbounded describeState would blow the context
 * window — hence the byte budget matters more here than the call budget.
 * @type {EvalCase}
 */
const dataset = {
  name: 'dataset',
  title: 'dataset metadata',
  goal: 'Describe the dataset: title "Air quality 2024", license "odc-odbl", topic "environment", and mark it as published with French as its language.',
  schema: {
    type: 'object',
    title: 'Dataset',
    required: ['title'],
    properties: {
      title: { type: 'string', title: 'Title' },
      description: { type: 'string', title: 'Description', layout: 'textarea' },
      license: { type: 'string', title: 'License', enum: ['odc-odbl', 'cc-by', 'cc-zero', 'proprietary'] },
      topic: { type: 'string', title: 'Topic', enum: ['environment', 'transport', 'health', 'education', 'economy'] },
      language: { type: 'string', title: 'Language', enum: ['fr', 'en', 'de', 'nl'] },
      published: { type: 'boolean', title: 'Published' },
      // Filler sections: not part of the goal, they exist to push the schema past the
      // getSchema size limit so the agent must resolve sub-schemas by path.
      contact: {
        type: 'object',
        title: 'Contact point',
        properties: {
          name: { type: 'string', title: 'Contact name' },
          email: { type: 'string', title: 'Contact email', format: 'email' },
          organization: { type: 'string', title: 'Organization' },
          phone: { type: 'string', title: 'Phone' }
        }
      },
      spatial: {
        type: 'object',
        title: 'Spatial coverage',
        properties: {
          country: { type: 'string', title: 'Country' },
          region: { type: 'string', title: 'Region' },
          city: { type: 'string', title: 'City' },
          bbox: { type: 'string', title: 'Bounding box' }
        }
      },
      temporal: {
        type: 'object',
        title: 'Temporal coverage',
        properties: {
          start: { type: 'string', title: 'Start date', format: 'date' },
          end: { type: 'string', title: 'End date', format: 'date' },
          frequency: { type: 'string', title: 'Update frequency', enum: ['daily', 'weekly', 'monthly', 'yearly'] }
        }
      },
      provenance: {
        type: 'object',
        title: 'Provenance',
        properties: {
          source: { type: 'string', title: 'Source' },
          method: { type: 'string', title: 'Collection method' },
          processing: { type: 'string', title: 'Processing steps' },
          quality: { type: 'string', title: 'Quality notes' }
        }
      }
    }
  },
  data: {},
  expected: {
    title: 'Air quality 2024',
    license: 'odc-odbl',
    topic: 'environment',
    language: 'fr',
    published: true
  },
  // Only the goal fields are checked; the filler sections may stay empty.
  expectedIsPartial: true,
  budget: { toolCalls: 16, outputBytes: 40_000 }
}

/** @type {EvalCase[]} */
export const cases = [contact, team, dataset]

/**
 * @param {string} name
 * @returns {EvalCase}
 */
export function getCase (name) {
  const found = cases.find((c) => c.name === name)
  if (!found) throw new Error(`unknown eval case "${name}", available: ${cases.map((c) => c.name).join(', ')}`)
  return found
}
