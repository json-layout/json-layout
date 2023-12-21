/**
 * @template ItemType
 * @param {ItemType[]} previousArray
 * @param {ItemType[]} newArray
 * @returns {ItemType[]}
 */
export function shallowProduceArray (previousArray = [], newArray = []) {
  if (!previousArray || !newArray || previousArray.length !== newArray.length) return newArray
  for (let i = 0; i < previousArray.length; i++) { if (previousArray[i] !== newArray[i]) return newArray }
  return previousArray
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
