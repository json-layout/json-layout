import type { SelectItemHeader } from '@json-layout/vocabulary'
import type { Store, GetFieldSuggestionsInput, GetFieldSuggestionsResult, SuggestionItem } from '../types.ts'
import { resolveNode } from '../node-resolution.ts'

function isHeader (item: unknown): item is SelectItemHeader {
  return typeof item === 'object' && item !== null && 'header' in item && (item as SelectItemHeader).header === true
}

export async function getFieldSuggestions (input: GetFieldSuggestionsInput, store: Store): Promise<GetFieldSuggestionsResult> {
  const statefulLayout = store.getState(input.stateId)
  if (!statefulLayout) {
    throw new Error(`stateful layout not found: ${input.stateId}`)
  }

  const node = resolveNode(statefulLayout.stateTree.root, input.path)
  if (!node) {
    throw new Error(`node not found at path: ${input.path}`)
  }

  // one-of-select nodes carry their options in layout.oneOfItems, not via getItems
  if (node.layout.comp === 'one-of-select') {
    const layout = node.layout as Record<string, unknown>
    const oneOfItems = layout.oneOfItems as Array<{ header?: boolean, key: number, title: string }> | undefined
    const items: SuggestionItem[] = (oneOfItems ?? [])
      .filter(item => !item.header)
      .map(item => ({ value: item.key, title: item.title }))
    return { items }
  }

  const rawItems = await statefulLayout.getItems(node, input.query)

  const items: SuggestionItem[] = rawItems
    .filter(item => !isHeader(item))
    .map(item => {
      if (isHeader(item)) throw new Error('unreachable')
      return {
        value: item.value,
        title: item.title,
        ...(item.key !== item.title ? { key: item.key } : {})
      }
    })

  return { items }
}
