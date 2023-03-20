type Display = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export function getDisplay (containerWidth: number): Display {
  if (containerWidth < 600) return 'xs'
  else if (containerWidth < 960) return 'sm'
  else if (containerWidth < 1264) return 'md'
  else if (containerWidth < 1904) return 'lg'
  else return 'xl'
}
