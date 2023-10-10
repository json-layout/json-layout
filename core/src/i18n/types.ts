export interface CompileOptionsMessages {
  errorOneOf: string
  errorRequired: string
}

export interface StateOptionsMessages {
  addItem: string
}

export type LocaleMessages = CompileOptionsMessages & StateOptionsMessages
