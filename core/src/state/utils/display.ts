// inspired by https://vuetifyjs.com/en/features/display-and-platform/#interface

import { type Cols, type ColsObj } from '@json-layout/vocabulary'

// TODO: make this configurable
const thresholds = {
  xs: 0,
  sm: 600,
  md: 960,
  lg: 1280,
  xl: 1920,
  xxl: 2560
}

export class Display {
  readonly width: number

  public constructor (width: number) {
    this.width = width
  }

  get xs (): boolean {
    return this.width < thresholds.sm
  }

  get sm (): boolean {
    return this.width >= thresholds.sm && this.width < thresholds.md
  }

  get smAndDown (): boolean {
    return this.width < thresholds.md
  }

  get smAndUp (): boolean {
    return this.width >= thresholds.sm
  }

  get md (): boolean {
    return this.width >= thresholds.md && this.width < thresholds.lg
  }

  get mdAndDown (): boolean {
    return this.width < thresholds.lg
  }

  get mobile (): boolean {
    return this.mdAndDown
  }

  get mdAndUp (): boolean {
    return this.width >= thresholds.md
  }

  get lg (): boolean {
    return this.width >= thresholds.lg && this.width < thresholds.xl
  }

  get lgAndDown (): boolean {
    return this.width < thresholds.xl
  }

  get lgAndUp (): boolean {
    return this.width >= thresholds.lg
  }

  get xl (): boolean {
    return this.width >= thresholds.xl && this.width < thresholds.xxl
  }

  get xlAndDown (): boolean {
    return this.width < thresholds.xxl
  }

  get xlAndUp (): boolean {
    return this.width >= thresholds.xl
  }

  get xxl (): boolean {
    return this.width >= thresholds.xxl
  }
}

export function getChildDisplay (parentDisplay: Display, colsObj: ColsObj | undefined): [Display, Cols] {
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
