# @json-layout/agents

Server-side form sessions: an agent loads a schematized JSON document, edits it through the
json-layout form tools, and saves it. The consumer supplies the I/O (`load`, `save`, `schema`);
the session supplies the form. The tools themselves are described in
[`core/src/webmcp/README.md`](../core/src/webmcp/README.md).

```js
import { createFormSession } from '@json-layout/agents'

const session = createFormSession({ title: 'portal page', load, save, schema })
```

## Tools

The six form tools of core, plus `saveForm` and `reloadForm` (`reloadForm` drops local changes
and loads again, to resolve a save conflict).

## Saving

`saveMode` is one of `SAVE_MODES`:

- `explicit` (default): the document is saved by `saveForm`, or by a write that passes
  `save: true` (`setData`, `setFieldValue`, `editArray`). A save is refused while the form is
  invalid, and `save: true` is held while a list field holds a value that was not picked from
  its suggestions; `saveForm` saves anyway and warns.
- `auto`: every write that leaves the form valid saves the whole document. A write that
  leaves it invalid stays in the session until a later one makes it valid. There is no
  `saveForm`. Saves never overlap: writes landing during a save share one save of the last
  valid document. For a document bound to a server-side draft, so it needs a `save` function
  and a loaded document.

A session without `save` is read-only.

## Creating records

A session with no `load`, or whose `load` returns no document, creates records. After each
successful save its form is empty again for the next record, `session.data` is empty, and the
answer says so. An edit made while the save was in flight is dropped with the old form, and
the answer says that too. `auto` is refused on such a session: it would save a half-written
record, so it saves explicitly.
