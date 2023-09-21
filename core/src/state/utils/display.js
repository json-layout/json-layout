// inspired by https://vuetifyjs.com/en/features/display-and-platform/#interface

/** @typedef {'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'} BreakPointName */

/** @type {BreakPointName[]} */
const names = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl']

// TODO: make this configurable
/** @type {Record<BreakPointName, number>} */
const thresholds = {
  xs: 0,
  sm: 600,
  md: 960,
  lg: 1280,
  xl: 1920,
  xxl: 2560
}

export class Display {
  /**
   * @readonly
   * @type {number}
   */
  width

  /**
   * @param {number} width
   */
  constructor (width) {
    this.width = width
  }

  /** @returns {BreakPointName} */
  get name () {
    for (let i = 0; i < names.length; i++) {
      if (names[i + 1] && this.width < thresholds[names[i + 1]]) return names[i]
    }
    return 'xxl'
  }

  /** @returns {boolean} */
  get xs () {
    return this.width < thresholds.sm
  }

  /** @returns {boolean} */
  get sm () {
    return this.width >= thresholds.sm && this.width < thresholds.md
  }

  /** @returns {boolean} */
  get smAndDown () {
    return this.width < thresholds.md
  }

  /** @returns {boolean} */
  get smAndUp () {
    return this.width >= thresholds.sm
  }

  /** @returns {boolean} */
  get md () {
    return this.width >= thresholds.md && this.width < thresholds.lg
  }

  /** @returns {boolean} */
  get mdAndDown () {
    return this.width < thresholds.lg
  }

  /** @returns {boolean} */
  get mobile () {
    return this.mdAndDown
  }

  /** @returns {boolean} */
  get mdAndUp () {
    return this.width >= thresholds.md
  }

  /** @returns {boolean} */
  get lg () {
    return this.width >= thresholds.lg && this.width < thresholds.xl
  }

  /** @returns {boolean} */
  get lgAndDown () {
    return this.width < thresholds.xl
  }

  /** @returns {boolean} */
  get lgAndUp () {
    return this.width >= thresholds.lg
  }

  /** @returns {boolean} */
  get xl () {
    return this.width >= thresholds.xl && this.width < thresholds.xxl
  }

  /** @returns {boolean} */
  get xlAndDown () {
    return this.width < thresholds.xxl
  }

  /** @returns {boolean} */
  get xlAndUp () {
    return this.width >= thresholds.xl
  }

  /** @returns {boolean} */
  get xxl () {
    return this.width >= thresholds.xxl
  }
}

/**
 * @param {Display} parentDisplay
 * @param {import("@json-layout/vocabulary").ColsObj | undefined} colsObj
 * @returns {[Display, import("@json-layout/vocabulary").Cols]}
 */
export function getChildDisplay (parentDisplay, colsObj) {
  if (!colsObj) return [parentDisplay, 12]
  let cols = colsObj.xs
  if (parentDisplay.smAndUp && colsObj.sm !== undefined) cols = colsObj.sm
  if (parentDisplay.mdAndUp && colsObj.md !== undefined) cols = colsObj.md
  if (parentDisplay.lgAndUp && colsObj.lg !== undefined) cols = colsObj.lg
  if (parentDisplay.xlAndUp && colsObj.xl !== undefined) cols = colsObj.xl
  if (parentDisplay.xxl && colsObj.xxl !== undefined) cols = colsObj.xxl
  const display = cols === 12 ? parentDisplay : new Display(Math.round(parentDisplay.width * (cols / 12)))
  return [display, cols]
}
