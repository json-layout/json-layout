import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '../src/index.js'

describe('Special cases of oneOfs', () => {
  const defaultOptions = { debounceInputMs: 0 }

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
      compiledLayout, compiledLayout.skeletonTree,
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
    assert.equal(statefulLayout.stateTree.root.children[0].children[0].children?.length, 1)
    assert.ok(!statefulLayout.stateTree.root.children[0].children[0].children[0].error)
    assert.ok(statefulLayout.stateTree.root.children[0].children[0].children[0].childError)
    assert.equal(statefulLayout.stateTree.root.children[0].children[0].children[0].children?.length, 2)
    assert.ok(!statefulLayout.stateTree.root.children[0].children[0].children[0].children[0].error)
    assert.equal(statefulLayout.stateTree.root.children[0].children[0].children[0].children[1].children?.length, 1)
    assert.equal(statefulLayout.stateTree.root.children[0].children[0].children[0].children[1].children[0].error, 'required information')
  })
})
