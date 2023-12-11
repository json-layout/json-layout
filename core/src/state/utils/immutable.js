/**
 * @template ItemType
 * @param {ItemType[]} a1
 * @param {ItemType[]} a2
 * @returns {ItemType[]}
 */
export function shallowProduceArray (a1 = [], a2 = []) {
  if (!a1 || !a2 || a1.length !== a2.length) return a2
  for (let i = 0; i < a1.length; i++) { if (a1[i] !== a2[i]) return a2 }
  return a1
}

/**
 * @template ItemType
 * @param {any[]} a1
 * @param {any[]} a2
 * @returns {boolean}
 */
export function shallowEqualArray (a1 = [], a2 = []) {
  if (a1.length !== a2.length) return false
  for (let i = 0; i < a1.length; i++) { if (a1[i] !== a2[i]) return false }
  return true
}
