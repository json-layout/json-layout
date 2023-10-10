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
}

export type LocaleMessages = CompileOptionsMessages & StateOptionsMessages
