# JSON Layout

*Vocabulary and tools for rendering and edition of schematized JSON documents.*

## Developers

Take a look at the [contribution guidelines](./CONTRIBUTING.md).

## @json-layout/vocabulary

The vocabulary describes the `layout` keyword that can be used to augment a JSON schema with information useful to render it as a form.

This module also contains a normalization function that processes an annotated schema, validates the layout keywords, fill them with default values and make them into their normalized form.

## @json-layout/core