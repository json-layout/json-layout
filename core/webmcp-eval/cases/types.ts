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
  /**
   * Expression context the schema's URLs and conditions read (`context.xxx`). For the
   * data-fair app cases this carries the owner filter a deployed app always has.
   */
  context?: Record<string, unknown>
  /**
   * Options the schema must be compiled with, when its defaults are not what the page
   * uses. The portals schema carries x-i18n-* keywords and a 39-branch discriminated
   * union, and compiling it without xI18n leaves the state tree unable to settle.
   */
  compileOptions?: Record<string, unknown>
  /**
   * Whether the page hands WebMCP the source schema, which is what decides if a
   * getSchema tool exists at all. Defaults to true. The portals page does not: its
   * compiled layout ships without the schema, so its agent has no getSchema.
   */
  withSchema?: boolean
  /** Band getComplexity must report. Asserted in CI, never read at runtime. */
  expectedComplexity: ComplexityBand
  /**
   * Whether getSchema returns the whole schema. Independent of the band — a case can be
   * large by node count while its schema still fits under SCHEMA_MAX_LENGTH.
   */
  expectedSchemaFits: boolean
}
