export type EvalBudget = {
  /** Maximum tool calls a competent run should need. */
  toolCalls: number
  /** Maximum total bytes of tool output a run should read. Guards the agent's context. */
  outputBytes: number
}

export type EvalCase = {
  name: string
  /** Passed to WebMCP as dataTitle, so it appears in the tool descriptions. */
  title: string
  /** The task, phrased as a user would. Handed to the agent verbatim. */
  goal: string
  schema: Record<string, unknown>
  /** Initial form data, usually empty. */
  data: Record<string, unknown>
  /** Data a correct run must produce. */
  expected: Record<string, unknown>
  /**
   * When true, `expected` is a subset check: the run must produce these values but may
   * also fill fields the goal never mentioned. When false/absent the data must match exactly.
   */
  expectedIsPartial?: boolean
  budget: EvalBudget
}
