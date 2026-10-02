/**
 * @file Static overview of what a compiled form can hold.
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

/** Levels of nested objects expanded as bullets before a node is rendered as an inline shape. */
export const OVERVIEW_MAX_DEPTH = 3

/** Approximate character budget of the whole overview. */
export const OVERVIEW_MAX_LENGTH = 7000

/** Values of a closed list stated before the rest is elided. */
const MAX_VALUES = 8

/** Fields named in an inline `{ a*, b }` shape before the rest is elided. */
const MAX_SHAPE_FIELDS = 6

/**
 * Above this many variants, branch shapes are dropped and only the titles are listed: a
 * choice needs every option visible more than it needs each option's fields.
 */
const MAX_SHAPED_VARIANTS = 20

/** Longest label kept on a line. */
const MAX_LABEL_LENGTH = 60

/**
 * @typedef {object} FormOverviewOptions
 * @property {number} [maxDepth] - nested objects expanded as bullets, deeper ones become
 *   an inline shape (default {@link OVERVIEW_MAX_DEPTH})
 * @property {number} [maxLength] - approximate character budget (default
 *   {@link OVERVIEW_MAX_LENGTH})
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
 * @param {FormOverviewOptions} [options]
 * @returns {string}
 */
export function generateFormOverview (compiledLayout, options = {}) {
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
   * @returns {unknown[] | undefined}
   */
  const closedValues = (comp) => {
    if (Array.isArray(comp?.items)) {
      return comp.items.map((/** @type {any} */ item) => (item && typeof item === 'object' && 'value' in item) ? item.value : item)
    }
    const getItems = comp?.getItems
    if (getItems?.immutable && typeof getItems.expr === 'string') {
      try {
        const parsed = JSON.parse(getItems.expr)
        if (Array.isArray(parsed)) {
          return parsed.map((/** @type {any} */ item) => (item && typeof item === 'object' && 'value' in item) ? item.value : item)
        }
      } catch { /* an expression that is not a JSON list is simply not a closed list */ }
    }
    return undefined
  }

  /**
   * @param {Record<string, any>} comp
   * @returns {string[]}
   */
  const valueMeta = (comp) => {
    const values = closedValues(comp)
    if (values) {
      const shown = values.slice(0, MAX_VALUES)
      const rest = values.length > MAX_VALUES ? ` (+${values.length - MAX_VALUES} more)` : ''
      return [`values=${JSON.stringify(shown)}${rest}`]
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
    if (!isObjectish(node, comp)) return typeOf(comp)

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
        else push(`${indent}  - ${path}/0 (${shapeOf(itemRootPointer)})`)
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
        push(`${indent}- ${path} (${meta.join(', ')})${labelSuffix} — ${shapeOf(pointer)}`)
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

  const mainTree = trees[compiledLayout.mainTree]
  if (!mainTree) return ''
  walk(mainTree.root, '/', 0)

  const overview = lines.join('\n')
  if (!truncated) return overview
  return `${overview}\n… (overview truncated at ${maxLength} characters — call describeState to explore the rest)`
}
