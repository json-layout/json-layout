/*
TODO:
  - use the result of compile.ts as input (serialized or not)
  - initialize a stateful-layout
*/

// TODO: define a type (maybe a recursve class with methods) that looks like this:

// {path: "/", layout: normalizedLayout, value, errors: [], validate(), input()}

export default class StatefulLayoutNode {
  parent?: StatefulLayoutNode
  children?: StatefulLayoutNode[]
}
