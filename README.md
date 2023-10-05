# JSON Layout

*Vocabulary and tools for rendering and edition of schematized JSON documents.*

*JSON Layout* is a building block for implementing rich forms based on JSON schemas in any UI framework. The v3 of [vjsf](https://koumoul-dev.github.io/vuetify-jsonschema-form/latest/) is the reference implementation of *JSON Layout* for [vue](https://vuejs.org/) / [vuetify](https://vuetifyjs.com/en/).

## Developers

Take a look at the [contribution guidelines](./CONTRIBUTING.md).

## @json-layout/vocabulary

The vocabulary describes the `layout` keyword that can be used to augment a JSON schema with information useful to render it as a form.

This module also contains a normalization function that processes an annotated schema, validates the layout keywords, fill them with default values and transform them into their normalized form.

## @json-layout/core

The core contains all the tools necessary for implementing the vocabulary. The purpose is to make wrapping UI libraries as light as possible and to manage as much of the complexity as possible here.

The `compile` function makes a bunch of pre-processing : 
  - produce Ajv validation functions
  - compile markdown contents to html
  - compile expressions into JS functions
  - recurses on the schema to normalize the layout keywords and store a skeleton components tree

The result of the compile function can be serialized in a build step (less dependencies loaded in the browser, faster startup, tree-shaking of UI components) or evaluated at runtime.

The `StatefulLayout` class uses the result of the compile function to manage the state of an instance of form:
  - manages a full state tree with all rendered components
  - handles bi-directional data binding in the state tree
  - uses validation functions and apply validation errors to the proper components in the tree
  - stores the state as immutable objects thanks to [immer](https://www.npmjs.com/package/immer).

## @json-layout/examples

Provides a bunch of standard examples to help building documentation and test suites for any library implementing json-layout.