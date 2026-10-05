/**
 * @file What a compiled form can hold, at any path, whatever its state.
 *
 * `describeState` projects the live state: the active branch, the values, the errors. That
 * is the tool for editing, but it cannot answer the question that comes before editing —
 * what this form is, which sections exist, and what the branches that are not active yet
 * would hold. This module renders a compact map of the compiled skeleton and layouts,
 * data-independent and stable, so an agent starts with the shape of the document instead
 * of discovering it one activation at a time.
 *
 * It is a reading aid, not a contract. It is generated from the same skeleton and layouts
 * the form renders, so it cannot describe something the form never shows, but nothing here
 * is validated: `describeState` remains the authority on values and legal writes. The raw
 * schema is deliberately not required — a build-time compiled layout does not carry one.
 */

import { isItemsLayout } from '@json-layout/vocabulary'

import { compToType } from './project.js'
import { resolveNode } from './resolve.js'

/** Levels of nested objects expanded as bullets before a node is rendered as an inline shape. */
export const OVERVIEW_MAX_DEPTH = 3

/** Approximate character budget of the whole overview. */
export const OVERVIEW_MAX_LENGTH = 7000

/** Values of a closed list stated in a part asked for by path. */
const MAX_VALUES_IN_DETAIL = 50

/** Values of a closed list stated before the rest is elided. */
const MAX_VALUES = 8

/**
 * Values of a closed list stated in an inline shape: beyond, the shape only says its type. A
 * portal menu entry's 14 page types are what tells its options apart.
 */
const MAX_SHAPE_VALUES = 16

/** Fields named in an inline `{ a*, b }` shape before the rest is elided. */
const MAX_SHAPE_FIELDS = 6

/**
 * Above this many variants, branch shapes are dropped and only the titles are listed: a
 * choice needs every option visible more than it needs each option's fields.
 */
const MAX_SHAPED_VARIANTS = 20

/** Longest inline shape of a part shown at the depth limit, beyond which only its field count is. */
const MAX_INLINE_SHAPE_LENGTH = 160

/** Longest label kept on a line. */
const MAX_LABEL_LENGTH = 60

/**
 * @typedef {object} FormSchemaOptions
 * @property {number} [maxDepth] - nested objects expanded as bullets, deeper ones become
 *   an inline shape (default {@link OVERVIEW_MAX_DEPTH})
 * @property {number} [maxLength] - approximate character budget (default
 *   {@link OVERVIEW_MAX_LENGTH})
 * @property {string} [pointer] - the skeleton node to start from (default: the form's root)
 * @property {string} [path] - the data path of that node (default: "/")
 * @property {number} [variant] - with a variant selector's pointer, describe only that variant,
 *   field by field
 */

/**
 * @param {import('../compile/index.js').SkeletonNode} node
 * @returns {boolean}
 */
function isStructuralKey (node) {
  return typeof node.key === 'string' && node.key.startsWith('$')
}

/**
 * Render the static structure of a compiled form as an indented markdown listing.
 * @param {import('../compile/index.js').CompiledLayout} compiledLayout
 * A form too large for the budget is shown shallower rather than cut in the middle: an agent
 * needs the whole map first, then the path of the part to see in full. Truncated in the middle,
 * the portal configuration lost its menu, the very part judged runs needed.
 * @param {FormSchemaOptions} [options]
 * @returns {string}
 */
export function describeFormSchema (compiledLayout, options = {}) {
  if (options.maxDepth !== undefined) return renderFormSchema(compiledLayout, options).text
  for (let depth = OVERVIEW_MAX_DEPTH; depth >= 0; depth--) {
    const { text, truncated } = renderFormSchema(compiledLayout, { ...options, maxDepth: depth })
    if (!truncated) {
      return depth === OVERVIEW_MAX_DEPTH
        ? text
        : `${text}\n(shown ${depth + 1} level(s) deep to fit — call describeState with the path of a part to see it in full)`
    }
    if (depth === 0) return text
  }
  return ''
}

/**
 * @param {import('../compile/index.js').CompiledLayout} compiledLayout
 * @param {FormSchemaOptions} options
 * @returns {{ text: string, truncated: boolean }}
 */
function renderFormSchema (compiledLayout, options) {
  const maxDepth = options.maxDepth ?? OVERVIEW_MAX_DEPTH
  const maxLength = options.maxLength ?? OVERVIEW_MAX_LENGTH
  const nodes = compiledLayout.skeletonNodes ?? {}
  const trees = compiledLayout.skeletonTrees ?? {}
  const layouts = compiledLayout.normalizedLayouts ?? {}
  const components = compiledLayout.components ?? {}

  /** @type {string[]} */
  const lines = []
  let length = 0
  let truncated = false
  /** pointer -> path where its structure was first expanded */
  const expanded = new Map()

  /**
   * @param {string} line
   */
  const push = (line) => {
    if (truncated) return
    if (length + line.length + 1 > maxLength) {
      truncated = true
      return
    }
    lines.push(line)
    length += line.length + 1
  }

  /**
   * The component object a node renders as. A switch resolves per data at runtime and the
   * data is not available here, so the first case is taken as representative, exactly as
   * projectDeclaredFields does.
   * @param {string | undefined} pointer
   * @returns {Record<string, any> | undefined}
   */
  const compOf = (pointer) => {
    const layout = pointer && layouts[pointer]
    if (!layout) return undefined
    if (Array.isArray(layout.switch)) return layout.switch[0]
    return /** @type {Record<string, any>} */(layout)
  }

  /**
   * @param {string | undefined} pointer
   * @returns {any[] | undefined}
   */
  const oneOfItemsOf = (pointer) => {
    const layout = /** @type {any} */(pointer && layouts[pointer])
    return layout && Array.isArray(layout.oneOfItems) ? layout.oneOfItems : undefined
  }

  /**
   * @param {Record<string, any> | undefined} comp
   * @returns {string}
   */
  const typeOf = (comp) => {
    if (!comp) return 'any'
    return compToType[comp.comp] ?? comp.comp ?? 'any'
  }

  /**
   * @param {Record<string, any> | undefined} comp
   * @param {import('../compile/index.js').SkeletonNode} node
   * @returns {string | undefined}
   */
  const labelOf = (comp, node) => {
    const label = comp?.label ?? comp?.title ?? node.title
    if (typeof label !== 'string') return undefined
    const flat = label.replace(/\s+/g, ' ').trim()
    if (!flat) return undefined
    return flat.length > MAX_LABEL_LENGTH ? `${flat.slice(0, MAX_LABEL_LENGTH)}…` : flat
  }

  /**
   * @param {string} path
   * @param {string} key
   * @returns {string}
   */
  const joinPath = (path, key) => (path === '/' ? `/${key}` : `${path}/${key}`)

  /**
   * Values of a list already resolved at compile time. A closed enum lands as an immutable
   * `getItems` expression whose body is the JSON list; a remote list is not immutable and
   * has no values to state.
   * @param {Record<string, any> | undefined} comp
   * @returns {Array<{ value: unknown, title: string | undefined }> | undefined}
   */
  const closedValues = (comp) => {
    /** @param {any} item */
    const entry = (item) => (item && typeof item === 'object' && 'value' in item)
      ? { value: item.value, title: typeof item.title === 'string' ? item.title : undefined }
      : { value: item, title: undefined }
    if (Array.isArray(comp?.items)) return comp.items.map(entry)
    const getItems = comp?.getItems
    if (getItems?.immutable && typeof getItems.expr === 'string') {
      try {
        const parsed = JSON.parse(getItems.expr)
        if (Array.isArray(parsed)) return parsed.map(entry)
      } catch { /* an expression that is not a JSON list is simply not a closed list */ }
    }
    return undefined
  }

  /**
   * The values of a closed list, with the label a person sees next to the value written when
   * they differ.
   * @param {Array<{ value: unknown, title: string | undefined }>} values
   * @returns {string}
   */
  const valuesList = (values) => {
    const titled = values.some(v => v.title !== undefined && v.title !== String(v.value))
    return titled
      ? `[${values.map(v => `${JSON.stringify(v.value)}${v.title !== undefined && v.title !== String(v.value) ? ` (${v.title})` : ''}`).join(', ')}]`
      : JSON.stringify(values.map(v => v.value))
  }

  // A part asked for by path is shown with every value of its choices: the one asked for hid
  // in a « +6 more » (« Catalogue d'événements » of a portal menu's « Type de page »).
  const maxValues = options.pointer ? MAX_VALUES_IN_DETAIL : MAX_VALUES

  /**
   * @param {Record<string, any>} comp
   * @returns {string[]}
   */
  const valueMeta = (comp) => {
    const values = closedValues(comp)
    if (values) {
      const shown = values.slice(0, maxValues)
      const rest = values.length > maxValues ? ` (+${values.length - maxValues} more)` : ''
      return [`values=${valuesList(shown)}${rest}`]
    }
    if (comp.getItems) return ['suggestions']
    return []
  }

  /**
   * A node is an object whose declared children are fields to fill. A select over objects
   * declares properties too, but its value is picked whole from getItems, so its children
   * are not separately writable nodes and listing them would promise the agent fields it
   * cannot set.
   * @param {import('../compile/index.js').SkeletonNode} node
   * @param {Record<string, any> | undefined} comp
   * @returns {boolean}
   */
  const isObjectish = (node, comp) => {
    if (!node.children?.length && !node.childrenTrees?.length) return false
    if (comp && isItemsLayout(/** @type {import('@json-layout/vocabulary').BaseCompObject} */(comp), components) && comp.comp !== 'list') return false
    return true
  }

  /**
   * Fields one level under an object, walking through the synthetic `$allOf`/`$then`/`$deps`
   * wrappers that hold no data of their own. Required fields are collected separately: on a
   * branch, what a choice has to satisfy is what an agent looks for first.
   * @param {string} pointer
   * @param {string[]} required
   * @param {string[]} optional
   * @param {Set<string>} seen
   */
  const collectShapeFields = (pointer, required, optional, seen) => {
    const node = nodes[pointer]
    if (!node) return
    for (const childPointer of node.children ?? []) {
      const child = nodes[childPointer]
      if (!child) continue
      const childComp = compOf(childPointer)
      if (childComp?.comp === 'none') continue
      if (isStructuralKey(child)) {
        // a `$allOf` section holds the fields, a `$oneOf` is a choice
        if (oneOfItemsOf(childPointer)) optional.push(`${child.key}: ${shapeOf(childPointer, seen)}`)
        else collectShapeFields(childPointer, required, optional, seen)
        continue
      }
      const mark = child.required ? '*' : ''
      ;(child.required ? required : optional).push(`${child.key}${mark}: ${shapeOf(childPointer, seen)}`)
    }
  }

  /**
   * Fields visible one level under a node, walking through the synthetic `$allOf`/`$then`
   * wrappers that hold no data of their own. Required fields come first: on a branch that
   * is what a choice has to satisfy.
   * @param {string} pointer
   * @param {Set<string>} [seen]
   * @returns {string}
   */
  const shapeOf = (pointer, seen = new Set()) => {
    if (seen.has(pointer)) return '…'
    // a copy per branch: a cycle is cut, but two siblings with the same shape each render it
    const branchSeen = new Set(seen).add(pointer)
    const node = nodes[pointer]
    if (!node) return 'any'
    const comp = compOf(pointer)
    if (oneOfItemsOf(pointer)) {
      const variants = /** @type {any[]} */(oneOfItemsOf(pointer)).filter((item) => !item.header)
      return `variant selector (${variants.length} variants)`
    }
    if (comp?.comp === 'list') {
      const itemTree = node.childrenTrees?.[0]
      const itemRoot = itemTree && trees[itemTree]?.root
      return itemRoot ? `array of ${shapeOf(itemRoot, branchSeen)}` : 'array'
    }
    if (!isObjectish(node, comp)) {
      // a short choice is told with its values: an option is chosen for what it lets pick
      const values = closedValues(comp)
      if (values?.length && values.length <= MAX_SHAPE_VALUES) return `${typeOf(comp)} ${valuesList(values)}`
      return typeOf(comp)
    }

    /** @type {string[]} */
    const required = []
    /** @type {string[]} */
    const optional = []
    collectShapeFields(pointer, required, optional, branchSeen)
    const fields = [...required, ...optional]
    if (!fields.length) return 'object'
    const shown = fields.slice(0, MAX_SHAPE_FIELDS)
    const rest = fields.length > MAX_SHAPE_FIELDS ? `, +${fields.length - MAX_SHAPE_FIELDS} more` : ''
    return `{ ${shown.join(', ')}${rest} }`
  }

  /**
   * The shape of a part shown at the depth limit, or only how many fields it has when its
   * shape would take more room than the rest of the map: the agent asks for it by path.
   * @param {string} pointer
   * @returns {string}
   */
  const compactShape = (pointer) => {
    const shape = shapeOf(pointer)
    if (shape.length <= MAX_INLINE_SHAPE_LENGTH) return shape
    const node = nodes[pointer]
    const count = (node?.children ?? []).filter(child => compOf(child)?.comp !== 'none').length
    return `${count} fields, describeState on this path to see them`
  }

  /**
   * @param {string} pointer
   * @param {string} path - the state path this node is instantiated at
   * @param {number} depth
   * @param {boolean} readOnly
   */
  const walk = (pointer, path, depth, readOnly = false) => {
    const node = nodes[pointer]
    if (!node) return
    const comp = compOf(pointer)
    if (!comp || comp.comp === 'none') return
    const indent = '  '.repeat(depth)
    const label = labelOf(comp, node)
    const labelSuffix = label ? ` label="${label}"` : ''
    const conditional = node.condition || comp.if
    const meta = [typeOf(comp)]
    if (node.required) meta.push('required')
    if (readOnly) meta.push('readOnly')
    if (conditional) meta.push('conditional')

    const oneOfItems = oneOfItemsOf(pointer)
    if (oneOfItems) {
      const variants = oneOfItems.filter((/** @type {any} */ item) => !item.header)
      const at = expanded.get(pointer)
      if (at !== undefined) {
        push(`${indent}- ${path} (variant-selector, the same ${variants.length} variants already listed for ${at})`)
        return
      }
      expanded.set(pointer, path)
      if (node.discriminator) meta.push(`on "${node.discriminator}"`)
      push(`${indent}- ${path} (${meta.join(', ')})${labelSuffix}`)
      const shapeless = variants.length > MAX_SHAPED_VARIANTS
      for (const item of variants) {
        const treePointer = node.childrenTrees?.[item.key]
        const branchRoot = treePointer ? nodes[trees[treePointer]?.root] : undefined
        const shape = branchRoot && !shapeless ? shapeOf(branchRoot.pointer) : ''
        push(`${indent}  - variant ${item.key}: ${item.title}${shape ? ` — ${shape}` : ''}`)
      }
      return
    }

    if (comp.comp === 'list' && node.childrenTrees?.length) {
      const itemTree = node.childrenTrees[0]
      const itemRootPointer = itemTree ? trees[itemTree]?.root : undefined
      const itemNode = itemRootPointer ? nodes[itemRootPointer] : undefined
      const itemComp = itemRootPointer ? compOf(itemRootPointer) : undefined
      const itemIsStructured = !!(itemNode && (isObjectish(itemNode, itemComp) || oneOfItemsOf(itemRootPointer)))
      if (!itemIsStructured) {
        meta.push(`of ${itemRootPointer ? typeOf(compOf(itemRootPointer)) : 'any'}`)
        const itemValues = itemComp && valueMeta(itemComp)
        if (itemValues?.length) meta.push(...itemValues)
        push(`${indent}- ${path} (${meta.join(', ')})${labelSuffix}`)
        return
      }
      push(`${indent}- ${path} (${meta.join(', ')})${labelSuffix}`)
      if (itemRootPointer) {
        if (depth < maxDepth) walk(itemRootPointer, `${path}/0`, depth + 1)
        else push(`${indent}  - ${path}/0 (${compactShape(itemRootPointer)})`)
      }
      return
    }

    if (comp.comp === 'list' && node.children?.length) {
      // tuple entries are fixed slots, each with its own shape
      push(`${indent}- ${path} (${meta.join(', ')})${labelSuffix}`)
      for (const child of node.children) walk(child, joinPath(path, String(nodes[child]?.key ?? '')), depth + 1)
      return
    }

    const objectish = isObjectish(node, comp)
    if (objectish) {
      const at = expanded.get(pointer)
      if (at !== undefined) {
        push(`${indent}- ${path} (${meta.join(', ')})${labelSuffix} — same structure as ${at}`)
        return
      }
      expanded.set(pointer, path)
      if (depth >= maxDepth) {
        push(`${indent}- ${path} (${meta.join(', ')})${labelSuffix} — ${compactShape(pointer)}`)
        return
      }
      push(`${indent}- ${path} (${meta.join(', ')})${labelSuffix}`)
      for (const childPointer of node.children ?? []) {
        const child = nodes[childPointer]
        if (!child) continue
        const ro = !!(node.roPropertyKeys?.includes(String(child.key)))
        walk(childPointer, joinPath(path, String(child.key)), depth + 1, ro)
      }
      return
    }

    meta.push(...valueMeta(comp))
    push(`${indent}- ${path} (${meta.join(', ')})${labelSuffix}`)
  }

  const startPointer = options.pointer ?? trees[compiledLayout.mainTree]?.root
  if (!startPointer) return { text: '', truncated: false }
  const startPath = options.path ?? '/'
  if (options.variant !== undefined) {
    // one option of a variant selector, field by field: its fields live at the selector's path
    const selector = nodes[startPointer]
    const treePointer = selector?.childrenTrees?.[options.variant]
    const branchRoot = treePointer ? trees[treePointer]?.root : undefined
    if (!branchRoot) return { text: '', truncated: false }
    const item = oneOfItemsOf(startPointer)?.find((/** @type {any} */ i) => i.key === options.variant)
    push(`variant ${options.variant}${item?.title ? `: ${item.title}` : ''} — its fields, at ${startPath}:`)
    walk(branchRoot, startPath, 0)
  } else {
    walk(startPointer, startPath, 0)
  }

  const overview = lines.join('\n')
  if (!truncated) return { text: overview, truncated }
  return { text: `${overview}\n… (truncated at ${maxLength} characters — call describeState with the path of a part to see it whole)`, truncated }
}

/**
 * The fields each option of a choice brings, keyed by option, as describeFormSchema shapes
 * them. For describeState when it is asked to say what options not chosen hold.
 * @param {import('../compile/index.js').CompiledLayout} compiledLayout
 * @param {string} pointer - the skeleton node of the variant selector
 * @returns {Record<string, string>}
 */
export function variantShapes (compiledLayout, pointer) {
  /** @type {Record<string, string>} */
  const shapes = {}
  const text = describeFormSchema(compiledLayout, { pointer, path: '/', maxDepth: OVERVIEW_MAX_DEPTH })
  for (const line of text.split('\n')) {
    const match = line.match(/^\s*- variant (\d+): .*? — (.+)$/)
    if (match) shapes[match[1]] = match[2]
  }
  return shapes
}

/**
 * @param {string} path
 * @returns {string[]}
 */
const segmentsOf = (path) => path.split('/').filter(Boolean)

/**
 * The skeleton node a path designates, and its data path. The live state answers as far as it
 * exists; the rest of the path is followed in the compiled skeleton: a list index leads to the
 * item's shape, "$oneOf" to the choice between options, a number after it to one option.
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @param {string} path
 * @returns {{ pointer: string, path: string, variant?: number }}
 */
export function resolveSchemaPath (statefulLayout, path) {
  const compiled = statefulLayout.compiledLayout
  const nodes = compiled.skeletonNodes
  const trees = compiled.skeletonTrees
  const segments = segmentsOf(path)
  // the longest prefix the live state knows
  let known = segments.length
  let stateNode
  for (; known > 0; known--) {
    stateNode = resolveNode(statefulLayout.stateTree.root, '/' + segments.slice(0, known).join('/'))
    if (stateNode) break
  }
  stateNode = stateNode ?? statefulLayout.stateTree.root
  let pointer = stateNode.skeleton.pointer
  let dataPath = stateNode.dataPath || '/'
  /** @type {number | undefined} */
  let variant
  const join = (/** @type {string} */ key) => (dataPath === '/' ? `/${key}` : `${dataPath}/${key}`)
  for (const segment of segments.slice(known)) {
    const node = nodes[pointer]
    const layout = /** @type {any} */(compiled.normalizedLayouts[pointer])
    const isSelector = !!(layout && (Array.isArray(layout.oneOfItems) || layout.comp === 'one-of-select'))
    if (variant !== undefined) {
      // inside one option: continue in its branch
      const branchRoot = trees[/** @type {string} */(node.childrenTrees?.[variant])]?.root
      if (!branchRoot) throw new Error(`no option ${variant} at this path`)
      pointer = branchRoot
      variant = undefined
    }
    if (isSelector && /^\d+$/.test(segment)) {
      if (!node.childrenTrees?.[Number(segment)]) throw new Error(`there is no option ${segment} at this path: describeState on the choice lists them`)
      variant = Number(segment)
      continue
    }
    const current = nodes[pointer]
    if (/^\d+$/.test(segment) && current.childrenTrees?.length && !isSelector) {
      // an item of a list, whether it exists or not: the shape of its items
      const itemRoot = trees[current.childrenTrees[0]]?.root
      if (!itemRoot) throw new Error(`no item shape at ${path}`)
      pointer = itemRoot
      dataPath = join(segment)
      continue
    }
    const child = (current.children ?? []).find((/** @type {string} */childPointer) => String(nodes[childPointer]?.key) === segment)
    if (!child) throw new Error(`"${segment}" is not a part of the form at this path`)
    pointer = child
    if (!segment.startsWith('$')) dataPath = join(segment)
  }
  return { pointer, path: dataPath, variant }
}
