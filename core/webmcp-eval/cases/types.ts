export type ComplexityBand = 'small' | 'medium' | 'large'

export type EvalCase = {
  name: string
  /** Passed to WebMCP as dataTitle, so it appears in the tool descriptions. */
  title: string
  /**
   * The task, phrased as a user would. The ONLY text the runner sees: it must name no
   * tools and describe an outcome, not a procedure.
   */
  goal: string
  schema: Record<string, unknown>
  /** Initial form data, usually empty. */
  data: Record<string, unknown>
  /** Band getComplexity must report. Asserted in CI, never read at runtime. */
  expectedComplexity: ComplexityBand
  /**
   * Whether getSchema returns the whole schema. Independent of the band — a case can be
   * large by node count while its schema still fits under SCHEMA_MAX_LENGTH.
   */
  expectedSchemaFits: boolean
}
