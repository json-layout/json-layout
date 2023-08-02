// inspired by https://vuetifyjs.com/en/features/display-and-platform/#interface

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
