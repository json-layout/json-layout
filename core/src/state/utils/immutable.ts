export function shallowCompareArrays <ItemType> (a1: ItemType[] | undefined, a2: ItemType[] | undefined): ItemType[] | undefined {
  if (!a1 || !a2 || a1.length !== a2.length) return a2
  for (let i = 0; i < a1.length; i++) { if (a1[i] !== a2[i]) return a2 }
  return a1
}
