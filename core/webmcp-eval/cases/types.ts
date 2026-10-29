export type ComplexityBand = 'small' | 'medium' | 'large'

/** A check on a run's final data; see webmcp-eval/checks.js for the semantics. */
export type EvalCheck =
  | { path: string, equals: unknown, label?: string }
  | { path: string, values: string[], separator?: string, label?: string }
  | { path: string, contains: Record<string, unknown>, label?: string }
  | { unchangedExcept: string[], label?: string }

/** The targeted lookup tools of the plain API's catalogue (webmcp-eval/lookups.js). */
export type LookupName = 'list_account_datasets' | 'describe_dataset' | 'get_field_values' | 'list_portal_pages'

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
  /**
   * Serves the case's remote lists (getItems URLs) offline: receives the URL resolved
   * against FIXTURE_BASE_URL (remote.js) and returns the parsed JSON body, or undefined for a 404.
   */
  remote?: (url: URL) => unknown
  /** Band getComplexity must report. Asserted in CI, never read at runtime. */
  expectedComplexity: ComplexityBand
  /**
   * Whether getSchema returns the whole schema. Independent of the band — a case can be
   * large by node count while its schema still fits under SCHEMA_MAX_LENGTH.
   */
  expectedSchemaFits: boolean
  /**
   * The plain API's input tolerance, applied to a write before validation, where the real
   * API has one (data-fair's line API accepts a joined string for a multi-valued column).
   */
  apiAccepts?: (doc: unknown) => unknown
  /**
   * The targeted lookups the plain API offers for this case's remote lists, as a real MCP
   * server would (webmcp-eval/lookups.js): the plain arm has no generic HTTP client. A remote
   * list with no plausible targeted tool gets none.
   */
  lookups?: LookupName[]
  /**
   * When the edited document persists: on an explicit save call (default) or by itself
   * after each change. Only the server form session arm distinguishes them.
   */
  saveMode?: 'explicit' | 'auto'
  /** Checks run on the final data of each arm, whatever path the agent took. */
  checks?: EvalCheck[]
}
