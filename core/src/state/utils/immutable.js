/**
 * @template ItemType
 * @param {ItemType[]} a1
 * @param {ItemType[]} a2
 * @returns {ItemType[]}
 */
export function shallowCompareArrays (a1 = [], a2 = []) {
  if (!a1 || !a2 || a1.length !== a2.length) return a2
  for (let i = 0; i < a1.length; i++) { if (a1[i] !== a2[i]) return a2 }
  return a1
}
