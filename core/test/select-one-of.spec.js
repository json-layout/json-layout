import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '../src/index.js'

describe('Special cases of oneOfs', () => {
  const defaultOptions = { debounceInputMs: 0, removeAdditional: true }

  it('should display proper validation errors for a specific oneOf', async () => {
    const compiledLayout = await compile(
      {
        type: 'object',
        required: [
          'datasetMode'
        ],
        allOf: [
          {
            title: 'Jeu de données',
            oneOf: [
              {
                title: 'Créer un jeu de données',
                required: [
                  'dataset'
                ],
                properties: {
                  datasetMode: {
                    type: 'string',
                    const: 'create',
                    title: 'Action'
                  },
                  dataset: {
                    type: 'object',
                    required: [
                      'title'
                    ],
                    properties: {
                      title: {
                        type: 'string',
                        title: 'Titre'
                      }
                    }
                  }
                }
              },
              {
                title: 'Mettre à jour un jeu de données (fichier)',
                required: [
                  'dataset'
                ],
                properties: {
                  datasetMode: {
                    type: 'string',
                    const: 'update'
                  },
                  dataset: {
                    type: 'object',
                    title: 'Jeu de données existant',
                    description: 'Sélectionnez un jeu de données GTFS métadonnées uniquement',
                    properties: {
                      id: {
                        type: 'string',
                        title: 'Identifiant'
                      },
                      title: {
                        type: 'string',
                        title: 'Titre'
                      }
                    }
                  }
                }
              }
            ]
          },
          {
            title: 'Paramètres',
            required: [
              'url'
            ],
            properties: {
              url: {
                type: 'string',
                title: "l'Url d'accès aux données sources (source zip)",
                description: 'les protocoles supportés sont HTTP, HTTPS et SFTP'
              },
              username: { title: 'Utilisateur', type: 'string' },
              password: { title: 'Mot de passe', type: 'string' },
              downloadZip: {
                type: 'boolean',
                title: 'Télécharger le fichier zip',
                description: "Télécharger le fichier zip ou l'ensemble des fichiers contenus dans le zip"
              },
              clearFiles: {
                type: 'boolean',
                title: 'Supprimer les fichiers existants'
              }
            }
          }
        ]
      })
    const statefulLayout = new StatefulLayout(
      compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      {}
    )
    assert.equal(statefulLayout.stateTree.root.children?.length, 2)
    assert.equal(statefulLayout.stateTree.root.children[0].children?.length, 1)
    assert.equal(statefulLayout.stateTree.root.children[0].children[0].error, 'chose one')
    statefulLayout.activateItem(statefulLayout.stateTree.root.children[0].children[0], 0)

    assert.ok(!statefulLayout.valid)
    assert.ok(!statefulLayout.stateTree.root.error)
    assert.ok(statefulLayout.stateTree.root.childError)

    assert.ok(!statefulLayout.stateTree.root.children[0].error)
    assert.ok(statefulLayout.stateTree.root.children[0].childError)
    assert.equal(statefulLayout.stateTree.root.children[0].children?.length, 1)
    assert.ok(!statefulLayout.stateTree.root.children[0].children[0].error)
    assert.equal(statefulLayout.stateTree.root.children[0].children[0].children?.length, 1)
    assert.ok(!statefulLayout.stateTree.root.children[0].children[0].children[0].error)
    assert.ok(statefulLayout.stateTree.root.children[0].children[0].children[0].childError)
    assert.equal(statefulLayout.stateTree.root.children[0].children[0].children[0].children?.length, 2)
    assert.ok(!statefulLayout.stateTree.root.children[0].children[0].children[0].children[0].error)
    assert.equal(statefulLayout.stateTree.root.children[0].children[0].children[0].children[1].children?.length, 1)
    assert.equal(statefulLayout.stateTree.root.children[0].children[0].children[0].children[1].children[0].error, 'required information')
  })

  it('should manage active element in a oneOf', async () => {
    const compiledLayout = await compile({
      type: 'object',
      unevaluatedProperties: false,
      oneOf: [{
        properties: {
          key: { type: 'string', const: 'key1' },
          str1: { type: 'string' }
        }
      }, {
        properties: {
          key: { type: 'string', const: 'key2' },
          str2: { type: 'string' },
          str3: { type: 'string', const: 'string 3' }
        }
      }, {
        properties: {
          key: { type: 'string', const: 'key3' },
          str3: { type: 'string' }
        }
      }]
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, { key: 'key2' })
    assert.equal(statefulLayout.stateTree.root.layout.comp, 'section')
    assert.equal(statefulLayout.stateTree.root.children?.length, 1)
    assert.equal(statefulLayout.stateTree.root.children?.[0].layout.comp, 'one-of-select')
    assert.equal(statefulLayout.stateTree.root.children?.[0].key, '$oneOf')
    assert.equal(statefulLayout.stateTree.root.children?.[0].children?.length, 1)
    assert.equal(statefulLayout.stateTree.root.children?.[0].children?.[0].key, 1)
    assert.deepEqual(statefulLayout.stateTree.root.data, { key: 'key2', str3: 'string 3' })
    assert.deepEqual(statefulLayout.stateTree.root.children?.[0].data, { key: 'key2', str3: 'string 3' })
    assert.deepEqual(statefulLayout.stateTree.root.children?.[0].children?.[0].data, { key: 'key2', str3: 'string 3' })

    assert.ok(statefulLayout.stateTree.root.children?.[0].children?.[0].children?.[1])
    statefulLayout.input(statefulLayout.stateTree.root.children?.[0].children?.[0].children?.[1], 'string 2')

    assert.deepEqual(statefulLayout.stateTree.root.data, { key: 'key2', str2: 'string 2', str3: 'string 3' })
    assert.deepEqual(statefulLayout.stateTree.root.children?.[0].data, { key: 'key2', str2: 'string 2', str3: 'string 3' })
    assert.deepEqual(statefulLayout.stateTree.root.children?.[0].children?.[0].data, { key: 'key2', str2: 'string 2', str3: 'string 3' })

    statefulLayout.activateItem(statefulLayout.stateTree.root.children?.[0], 2)

    assert.deepEqual(statefulLayout.data, { key: 'key3', str3: 'string 3' })
    assert.equal(statefulLayout.stateTree.root.data.key, 'key3')
    assert.equal(statefulLayout.stateTree.root.children?.[0].data.key, 'key3')
    assert.equal(statefulLayout.stateTree.root.children?.[0].children?.[0].data.key, 'key3')
  })

  it('should manage a oneOf with implicit typing', async () => {
    const compiledLayout = await compile({
      oneOf: [{
        properties: {
          key: { type: 'string', const: 'key1' },
          str1: { type: 'string' }
        }
      }, {
        properties: {
          key: { type: 'string', const: 'key2' },
          str2: { type: 'string' }
        }
      }]
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, { key: 'key1' })
    assert.equal(statefulLayout.stateTree.root.layout.comp, 'section')
    assert.equal(statefulLayout.stateTree.root.children?.length, 1)
    assert.equal(statefulLayout.stateTree.root.children?.[0].layout.comp, 'one-of-select')
    assert.equal(statefulLayout.stateTree.root.children?.[0].key, '$oneOf')
  })
})
