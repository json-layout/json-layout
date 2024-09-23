/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'A file input',
  id: 'file-input',
  description: 'Use the component `file-input` on an object node to support simple file uploading.',
  schema: {
    type: 'object',
    properties: {
      file1: {
        title: 'A simple file input',
        type: 'object',
        layout: 'file-input'
      }
      /* fileArray1: {
        title: 'A file input with multiple uploads',
        type: 'array',
        layout: 'file-input',
        items: { type: 'object' }
      } */
    }
  }
}

export default example
