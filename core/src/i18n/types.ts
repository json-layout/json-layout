import { type NormalizeMessages } from '@json-layout/vocabulary'

export interface CompileOptionsMessages {
  errorOneOf: string
  errorRequired: string
}

export interface StateOptionsMessages {
  addItem: string
  delete: string
  confirm: string
  edit: string
  close: string
  duplicate: string
  sort: string
  up: string
  down: string
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
  keyboardDate: string
  keyboardDateTime: string
}

export type LocaleMessages = NormalizeMessages & CompileOptionsMessages & StateOptionsMessages
