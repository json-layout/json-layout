/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'A simple file input',
  id: 'simple',
  description: 'Use the component `file-input` on an object node to support simple file uploading.',
  schema: {
    type: 'object',
    properties: {
      file1: {
        title: 'A simple file input',
        type: 'object',
        layout: 'file-input'
      }
    }
  }
}

export default example
