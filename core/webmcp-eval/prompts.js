/**
 * @file Runner prompts that are not tied to one tool surface's module.
 */

/**
 * The runner's system prompt when it edits a document through a JSON API. Same spirit
 * as the form runner's: an ordinary task, no mention of evaluation, no goal — the goal
 * arrives as the prompt. The API's own description is appended after it.
 */
export const PLAIN_RUNNER_PROMPT = `You are assisting a user with a JSON document they manage through an API.

Use the tools available to you to read the document and change it according to what the
user asks for. Work carefully: read the schema the document must follow before writing
to it, and check that your writes were accepted.

If you cannot determine a value from what the tools tell you, say so in your final
answer rather than guessing. When you are done, summarise what you changed and
anything you could not complete.`
