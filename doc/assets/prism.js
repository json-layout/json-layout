// Redirection import for Prism so the languages are bundled with Prism itself
// (no code splitting between Prism and its language components), same approach
// as the vjsf documentation.
import 'prism-themes/themes/prism-xonokai.css'
import Prism from 'prismjs'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-yaml'

export default Prism
