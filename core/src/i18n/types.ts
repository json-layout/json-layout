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
  /** the menu of a list item's actions (edit, duplicate, delete…) */
  actions: string
  duplicate: string
  insertAfter: string
  copy: string
  paste: string
  sort: string
  up: string
  down: string
  showHelp: string
  keyboardDate: string
  keyboardDateTime: string
}

export type LocaleMessages = NormalizeMessages & CompileOptionsMessages & StateOptionsMessages
