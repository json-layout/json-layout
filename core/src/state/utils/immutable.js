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
 * @param {Record<string, any>} previousObj
 * @param {Record<string, any>} newObj
 * @returns {Record<string, any>}
 */
export function shallowProduceObject (previousObj = {}, newObj = {}) {
  if (!previousObj || !newObj) return newObj
  const previousKeys = Object.keys(previousObj)
  const newKeys = Object.keys(newObj)
  if (previousKeys.length !== newKeys.length) return newObj
  for (const key of previousKeys) {
    if (previousObj[key] !== newObj[key]) return newObj
  }
  return previousObj
}

/**
 * @template ItemType
 * @param {any[] | null | undefined} a1
 * @param {any[] | null | undefined} a2
 * @returns {boolean}
 */
export function shallowEqualArray (a1 = [], a2 = []) {
  if (!a1 || !a2) return a1 === a2
  if (a1.length !== a2.length) return false
  for (let i = 0; i < a1.length; i++) { if (a1[i] !== a2[i]) return false }
  return true
}
