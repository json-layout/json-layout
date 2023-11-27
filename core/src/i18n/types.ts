export interface CompileOptionsMessages {
  errorOneOf: string
  errorRequired: string
}

export interface StateOptionsMessages {
  addItem: string
  delete: string
  edit: string
  duplicate: string
  sort: string
  showHelp: string
  mdeLink1: string
  mdeLink2: string
  mdeImg1: string
  mdeImg2: string
  mdeTable1: string
  mdeTable2: string
  bold: string
  italic: string
  heading: string
  quote: string
  unorderedList: string
  orderedList: string
  createLink: string
  insertImage: string
  createTable: string
  preview: string
  mdeGuide: string
  undo: string
  redo: string
}

export type LocaleMessages = CompileOptionsMessages & StateOptionsMessages
