import simple from './simple.js'

/** @type {import('../types.js').JSONLayoutExamplesCategory} */
const category = {
  title: 'Files',
  id: 'files',
  description: 'It is possible to manage file uploads. The resulting data is a File object (see [MDN](https://developer.mozilla.org/en-US/docs/Web/API/File)) with a controllable serialization to JSON.',
  examples: [simple]
}

export default category
