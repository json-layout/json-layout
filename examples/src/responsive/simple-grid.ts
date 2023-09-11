import type { JSONLayoutExample } from '..'

const category: JSONLayoutExample = {
  title: 'Simple grid',
  id: 'simple-grid',
  description: `All composite components like sections and tabs will render their children inside a 12 columns grid.
  
The \`layout.cols\` property of each child is used to define the size of an element in this grid, this property can be expressed as a simple integer from 1 to 12 or as an object with keys \`xs/sm/md/lg/xl/xxl\`.
If \`cols\` is expressed as an object you can specify only the thresholds where you want the value to change, for example \`layout: {cols: {md: 6}}\` signifies that \`xs\` and \`sm\` will use the default value of 12 while all larger sizes will use 6.`,
  schema: {
    type: 'object',
    title: 'A section containing a grid',
    properties: {
      str1: {
        type: 'string',
        title: '12 cols default'
      },
      str2: {
        type: 'string',
        title: '12 or 6 cols',
        layout: { cols: { md: 6 } }
      },
      str3: {
        type: 'string',
        title: '12 or 6 cols',
        layout: { cols: { md: 6 } }
      },
      str4: {
        type: 'string',
        title: '4 cols',
        layout: { cols: 4 }
      },
      str5: {
        type: 'string',
        title: '8 cols',
        layout: { cols: 8 }
      }
    }
  }
}

export default category
