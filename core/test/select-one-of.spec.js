import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '../src/index.js'
import { getNodeBuilder } from './utils/state-tree.js'

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

  it('should manage error of a shared information across oneOf elements', async () => {
    const compiledLayout = await compile(
      {
        type: 'object',
        properties: {
          rules: {
            type: 'array',
            items: {
              type: 'object',
              oneOf: [
                {
                  title: 'Mensuel',
                  properties: {
                    type: {
                      const: 'monthly'
                    },
                    dayOfWeek: {
                      type: 'string',
                      const: '*'
                    },
                    dayOfMonth: {
                      title: 'Jour du mois (de 1 à 28)',
                      type: 'integer',
                      minimum: 1,
                      maximum: 28,
                      default: 1,
                      'x-cols': 6,
                      'x-class': 'pr-1'
                    }
                  }
                },
                {
                  title: 'Hebdomadaire',
                  properties: {
                    type: {
                      const: 'weekly'
                    },
                    dayOfWeek: {
                      title: 'Jour de la semaine',
                      type: 'string',
                      oneOf: [{
                        const: '1',
                        title: 'lundi'
                      }, {
                        const: '2',
                        title: 'mardi'
                      }, {
                        const: '3',
                        title: 'mercredi'
                      }, {
                        const: '4',
                        title: 'jeudi'
                      }, {
                        const: '5',
                        title: 'vendredi'
                      }, {
                        const: '6',
                        title: 'samedi'
                      }, {
                        const: '0',
                        title: 'dimanche'
                      }],
                      default: '1',
                      'x-cols': 6,
                      'x-class': 'pr-1'
                    },
                    hour: {
                      title: 'Heure de la journée (de 0 à 23)',
                      type: 'integer',
                      minimum: 0,
                      maximum: 23,
                      default: 0,
                      'x-cols': 6,
                      'x-class': 'pl-1'
                    }
                  }
                },
                {
                  title: 'Journalier',
                  properties: {
                    type: {
                      const: 'daily'
                    },
                    dayOfWeek: {
                      type: 'string',
                      const: '*'
                    },
                    hour: {
                      title: 'Heure de la journée (de 0 à 23)',
                      type: 'integer',
                      minimum: 0,
                      maximum: 23,
                      default: 0,
                      'x-cols': 6,
                      'x-class': 'pr-1'
                    },
                    timeZone: {
                      type: 'string',
                      title: 'Fuseau horaire',
                      default: 'Europe/Paris',
                      layout: {
                        comp: 'autocomplete',
                        cols: 6,
                        getItems: 'context.utcs'
                      }
                    },
                    minute: {
                      title: 'Minute (de 0 à 59)',
                      type: 'integer',
                      minimum: 0,
                      maximum: 59,
                      default: 0,
                      'x-cols': 6,
                      'x-class': 'pr-1'
                    },
                    dayOfMonth: {
                      type: 'string',
                      const: '*'
                    },
                    month: {
                      type: 'string',
                      const: '*'
                    }
                  }
                }
              ]
            }
          }
        }

      }
    )
    const statefulLayout = new StatefulLayout(
      compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      { rules: [{}, {}] }
    )

    assert.equal(statefulLayout.stateTree.root.children?.length, 1)
    assert.equal(statefulLayout.stateTree.root.children[0].key, 'rules')
    assert.equal(statefulLayout.stateTree.root.children[0].children?.length, 2)
    const item0 = statefulLayout.stateTree.root.children[0].children[0]
    assert.equal(item0.key, 0)
    assert.equal(item0.children?.length, 1)
    assert.deepEqual(item0.data, { type: 'monthly', dayOfWeek: '*', dayOfMonth: 1 })

    let item1 = statefulLayout.stateTree.root.children[0].children[1]
    assert.equal(item1.key, 1)
    assert.equal(item1.children?.length, 1)
    assert.deepEqual(item1.data, { type: 'monthly', dayOfWeek: '*', dayOfMonth: 1 })
    statefulLayout.activateItem(item1.children[0], 1)
    item1 = statefulLayout.stateTree.root.children[0].children[1]
    assert.deepEqual(item1.data, { type: 'weekly', dayOfWeek: '*', hour: 0 })
    assert.equal(statefulLayout.valid, false)
    assert.equal(item1.children?.[0]?.children?.[0].children?.[1]?.key, 'dayOfWeek')
    assert.equal(item1.children?.[0]?.children?.[0].children?.[1]?.error, 'chose one')
  })

  it('should manage active element in a oneOf', async () => {
    const compiledLayout = await compile({
      type: 'object',
      oneOf: [{ $ref: '#/$defs/subtype1' }, {
        title: 'Subtype 2',
        unevaluatedProperties: false,
        properties: {
          key: { type: 'string', const: 'key2' },
          str2: { type: 'string' },
          str3: { type: 'string', const: 'string 3' }
        }
      }, {
        title: 'Subtype 3',
        required: ['str4'],
        unevaluatedProperties: false,
        properties: {
          key: { type: 'string', const: 'key3' },
          str3: { type: 'string' },
          str4: { type: 'string' }
        }
      }],
      $defs: {
        subtype1: {
          title: 'Subtype 1',
          unevaluatedProperties: false,
          properties: {
            key: { type: 'string', const: 'key1' },
            str1: { type: 'string' }
          }
        }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, { key: 'key1' })
    const getNode = getNodeBuilder(statefulLayout)

    assert.equal(statefulLayout.activatedItems['/$oneOf'], 0)
    assert.equal(statefulLayout.stateTree.root.layout.comp, 'section')
    assert.deepEqual(statefulLayout.stateTree.root.data, { key: 'key1' })
    assert.equal(statefulLayout.stateTree.root.children?.length, 1)

    statefulLayout.activateItem(statefulLayout.stateTree.root.children?.[0], 1)
    assert.equal(statefulLayout.activatedItems['/$oneOf'], 1)
    assert.equal(statefulLayout.stateTree.root.layout.comp, 'section')
    assert.equal(statefulLayout.stateTree.root.children?.length, 1)
    assert.equal(statefulLayout.stateTree.root.children?.[0].layout.comp, 'one-of-select')
    assert.equal(statefulLayout.stateTree.root.children?.[0].key, '$oneOf')
    assert.equal(statefulLayout.stateTree.root.children?.[0].children?.length, 1)
    assert.equal(statefulLayout.stateTree.root.children?.[0].children?.[0].key, 1)
    assert.deepEqual(statefulLayout.stateTree.root.data, { key: 'key2', str3: 'string 3' })
    assert.deepEqual(statefulLayout.stateTree.root.children?.[0].data, { key: 'key2', str3: 'string 3' })
    assert.deepEqual(statefulLayout.stateTree.root.children?.[0].children?.[0].data, { key: 'key2', str3: 'string 3' })

    assert.equal(statefulLayout.stateTree.root.children?.[0].skeleton.childrenTrees?.[0], '_jl#/oneOf/0')
    assert.equal(statefulLayout.compiledLayout.skeletonTrees[statefulLayout.stateTree.root.children?.[0].skeleton.childrenTrees?.[0]]?.title, 'Subtype 1')
    assert.equal(statefulLayout.stateTree.root.children?.[0].skeleton.childrenTrees?.[1], '_jl#/oneOf/1')
    assert.equal(statefulLayout.compiledLayout.skeletonTrees[statefulLayout.stateTree.root.children?.[0].skeleton.childrenTrees?.[1]]?.title, 'Subtype 2')

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
    assert.ok(!statefulLayout.valid)

    statefulLayout.input(getNode('$oneOf.2.str4'), 'String 4')
    assert.deepEqual(statefulLayout.data, { key: 'key3', str3: 'string 3', str4: 'String 4' })
    assert.ok(statefulLayout.valid)
  })

  it('should clear content of oneOf based on layout.emptyData parameter', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        str: { type: 'string' }
      },
      oneOfLayout: {
        emptyData: true
      },
      oneOf: [{
        properties: {
          key: { type: 'string', const: 'key1' },
          str1: { type: 'string' }
        }
      }, {
        properties: {
          key: { type: 'string', const: 'key2' },
          str1: { type: 'string' },
          str2: { type: 'string', const: 'string 3' }
        }
      }]
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], { ...defaultOptions, removeAdditional: false }, { str: 'Str', key: 'key1' })
    assert.deepEqual(statefulLayout.data, { str: 'Str', key: 'key1' })

    assert.equal(statefulLayout.stateTree.root.children?.length, 2)
    const selectNode = statefulLayout.stateTree.root.children?.[1]
    assert.equal(selectNode.layout.comp, 'one-of-select')
    assert.equal(selectNode.key, '$oneOf')
    assert.equal(selectNode.children?.length, 1)
    assert.equal(selectNode.children?.[0].key, 0)
    assert.ok(selectNode.children?.[0].children?.[0])
    assert.equal(selectNode.children?.[0].children?.[1].key, 'str1')
    statefulLayout.input(selectNode.children?.[0].children?.[1], 'string 1')
    assert.deepEqual(statefulLayout.data, { str: 'Str', str1: 'string 1', key: 'key1' })

    statefulLayout.activateItem(statefulLayout.stateTree.root.children?.[1], 1)

    assert.deepEqual(statefulLayout.data, { str: 'Str', key: 'key2', str2: 'string 3' })
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

  it('should manage a oneOf with $ref', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        prop1: { $ref: 'http://test.com/one-of' }
      }
    }, {
      ajvOptions: {
        schemas: {
          'http://test.com/one-of': {
            oneOf: [{ $ref: '#/$defs/sub1' }, { $ref: '#/$defs/sub2' }],
            $defs: {
              sub1: {
                properties: {
                  key: { type: 'string', const: 'key1' },
                  str1: { type: 'string' }
                }
              },
              sub2: {
                properties: {
                  key: { type: 'string', const: 'key2' },
                  str2: { type: 'string' }
                }
              }
            }
          }
        }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, { key: 'key1' })
    assert.equal(statefulLayout.stateTree.root.layout.comp, 'section')
    assert.equal(statefulLayout.stateTree.root.children?.length, 1)
    assert.equal(statefulLayout.stateTree.root.children?.[0].layout.comp, 'section')
    assert.equal(statefulLayout.stateTree.root.children?.[0].children?.[0].layout.comp, 'one-of-select')
    assert.equal(statefulLayout.stateTree.root.children?.[0].children?.[0].key, '$oneOf')
  })

  it('should use the discriminator keyword', async () => {
    const compiledLayout = await compile({
      discriminator: { propertyName: 'key' },
      oneOf: [{
        required: ['str1'],
        additionalProperties: false,
        properties: {
          key: { type: 'string', const: 'key1' },
          str1: { type: 'string' }
        }
      }, {
        required: ['str2'],
        additionalProperties: false,
        properties: {
          key: { type: 'string', const: 'key2' },
          str2: { type: 'string' }
        }
      }]
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, { key: 'key1' })
    const getNode = getNodeBuilder(statefulLayout)
    const oneOf = getNode('$oneOf')
    assert.ok(oneOf)
    assert.equal(oneOf.skeleton.discriminator, 'key')
    const oneOfChild = getNode('$oneOf.0')
    assert.ok(oneOfChild)
    assert.ok(!statefulLayout.valid)
    assert.deepEqual(statefulLayout.data, { key: 'key1' })
  })

  it('should use the discriminator keyword with $refs', async () => {
    const compiledLayout = await compile({
      discriminator: { propertyName: 'key' },
      oneOf: [{ $ref: '#/$defs/oneOf1' }, { $ref: '#/$defs/oneOf2' }],
      $defs: {
        oneOf1: {
          required: ['str1'],
          additionalProperties: false,
          properties: {
            key: { type: 'string', const: 'key1' },
            str1: { type: 'string' }
          }
        },
        oneOf2: {
          required: ['str2'],
          additionalProperties: false,
          properties: {
            key: { type: 'string', const: 'key2' },
            str2: { type: 'string' }
          }
        }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, { key: 'key1' })
    const getNode = getNodeBuilder(statefulLayout)
    const oneOf = getNode('$oneOf')
    assert.ok(oneOf)
    assert.equal(oneOf.skeleton.discriminator, 'key')
    const oneOfChild = getNode('$oneOf.0')
    assert.ok(oneOfChild)
    assert.ok(!statefulLayout.valid)
    assert.deepEqual(statefulLayout.data, { key: 'key1' })
  })

  it('should manage validation and default values of active element in a oneOf', async () => {
    const compiledLayout = await compile({
      type: 'object',
      unevaluatedProperties: false,
      oneOf: [{
        title: 'Title',
        required: ['type', 'content', 'titleSize'],
        properties: {
          type: { type: 'string', const: 'title' },
          content: { type: 'string' },
          titleSize: {
            type: 'string',
            enum: ['h1', 'h2', 'h3'],
            default: 'h3'
          }
        }
      }, {
        title: 'Text',
        required: ['type', 'content'],
        properties: {
          type: { type: 'string', const: 'text' },
          content: { type: 'string' }
        }
      }, {
        title: 'Divider',
        required: ['type'],
        properties: {
          type: { type: 'string', const: 'divider' },
        }
      }]
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, {})
    const getNode = getNodeBuilder(statefulLayout)

    assert.equal(statefulLayout.activatedItems['/$oneOf'], undefined)
    assert.deepEqual(statefulLayout.stateTree.root.data, {})

    statefulLayout.activateItem(getNode('$oneOf'), 0)
    assert.equal(statefulLayout.activatedItems['/$oneOf'], 0)
    assert.deepEqual(statefulLayout.stateTree.root.data, { type: 'title', titleSize: 'h3' })
    assert.equal(statefulLayout.valid, false)
    assert.equal(getNode('$oneOf.0').error, undefined)
    assert.equal(getNode('$oneOf.0').childError, true)
    assert.equal(getNode('$oneOf.0.content').error, 'required information')
    assert.equal(getNode('$oneOf.0.titleSize').data, 'h3')
    statefulLayout.input(getNode('$oneOf.0.content'), 'Content')
    assert.deepEqual(statefulLayout.stateTree.root.data, { type: 'title', titleSize: 'h3', content: 'Content' })
    assert.equal(statefulLayout.valid, true)
  })

  it('should manage all the same cases as previous example but with $refs', async () => {
    const compiledLayout = await compile({
      type: 'object',
      oneOf: [{ $ref: '#/$defs/title' }, { $ref: '#/$defs/text' }, { $ref: '#/$defs/divider' }],
      $defs: {
        title: {
          title: 'Title',
          required: ['type', 'content', 'titleSize'],
          properties: {
            type: { type: 'string', const: 'title' },
            content: { type: 'string' },
            titleSize: {
              type: 'string',
              enum: ['h1', 'h2', 'h3'],
              default: 'h3'
            }
          }
        },
        text: {
          title: 'Text',
          required: ['type', 'content'],
          properties: {
            type: { type: 'string', const: 'text' },
            content: { type: 'string' }
          }
        },
        divider: {
          title: 'Divider',
          required: ['type'],
          properties: {
            type: { type: 'string', const: 'divider' },
          }
        }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, {})
    const getNode = getNodeBuilder(statefulLayout)

    assert.equal(statefulLayout.activatedItems['/$oneOf'], undefined)
    assert.deepEqual(statefulLayout.stateTree.root.data, {})

    statefulLayout.activateItem(getNode('$oneOf'), 0)
    assert.equal(statefulLayout.activatedItems['/$oneOf'], 0)
    assert.deepEqual(statefulLayout.stateTree.root.data, { type: 'title', titleSize: 'h3' })
    assert.equal(statefulLayout.valid, false)
    assert.equal(getNode('$oneOf.0').error, undefined)
    assert.equal(getNode('$oneOf.0').childError, true)
    assert.equal(getNode('$oneOf.0.content').error, 'required information')
    assert.equal(getNode('$oneOf.0.titleSize').data, 'h3')
    statefulLayout.input(getNode('$oneOf.0.content'), 'Content')
    assert.deepEqual(statefulLayout.stateTree.root.data, { type: 'title', titleSize: 'h3', content: 'Content' })
    assert.equal(statefulLayout.valid, true)
  })

  it('should manage all the same cases as previous example but in an array with $refs', async () => {
    const compiledLayout = await compile({
      type: 'array',
      items: { $ref: '#/$defs/element' },
      $defs: {
        element: {
          type: 'object',
          unevaluatedProperties: false,
          oneOf: [{ $ref: '#/$defs/title' }, { $ref: '#/$defs/text' }, { $ref: '#/$defs/divider' }],
        },
        title: {
          title: 'Title',
          required: ['type', 'content', 'titleSize'],
          properties: {
            type: { type: 'string', const: 'title' },
            content: { type: 'string' },
            titleSize: {
              type: 'string',
              enum: ['h1', 'h2', 'h3'],
              default: 'h3'
            }
          }
        },
        text: {
          title: 'Text',
          required: ['type', 'content'],
          properties: {
            type: { type: 'string', const: 'text' },
            content: { type: 'string' }
          }
        },
        divider: {
          title: 'Divider',
          required: ['type'],
          properties: {
            type: { type: 'string', const: 'divider' },
          }
        }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, [])
    const getNode = getNodeBuilder(statefulLayout)

    statefulLayout.input(statefulLayout.stateTree.root, [undefined])
    assert.deepEqual(statefulLayout.stateTree.root.data, [{}])
    assert.equal(statefulLayout.activatedItems['/0/$oneOf'], undefined)
    assert.equal(getNode('0.$oneOf').error, 'chose one')

    statefulLayout.activateItem(getNode('0.$oneOf'), 0)
    assert.equal(statefulLayout.activatedItems['/0/$oneOf'], 0)

    assert.deepEqual(statefulLayout.stateTree.root.data, [{ type: 'title', titleSize: 'h3' }])
    assert.equal(statefulLayout.valid, false)
    assert.equal(getNode('0.$oneOf').error, undefined)
    assert.equal(getNode('0.$oneOf').childError, true)
    assert.equal(getNode('0.$oneOf.0').error, undefined)
    assert.equal(getNode('0.$oneOf.0').childError, true)
    assert.equal(getNode('0.$oneOf.0.content').error, 'required information')
    assert.equal(getNode('0.$oneOf.0.titleSize').data, 'h3')
    statefulLayout.input(getNode('0.$oneOf.0.content'), 'Content')
    assert.equal(getNode('0.$oneOf').childError, false)
    assert.deepEqual(statefulLayout.stateTree.root.data, [{ type: 'title', titleSize: 'h3', content: 'Content' }])
    assert.equal(statefulLayout.valid, true)

    statefulLayout.input(statefulLayout.stateTree.root, [{ type: 'title', titleSize: 'h3', content: 'Content' }, undefined])
    assert.deepEqual(statefulLayout.stateTree.root.data, [{ type: 'title', titleSize: 'h3', content: 'Content' }, {}])
    assert.equal(statefulLayout.valid, false)
    assert.equal(getNode('0.$oneOf').error, undefined)
    assert.equal(getNode('0.$oneOf').childError, false)
    assert.equal(getNode('1.$oneOf').error, 'chose one')
    statefulLayout.activateItem(getNode('1.$oneOf'), 0)
    assert.equal(statefulLayout.valid, false)
    assert.equal(getNode('0.$oneOf').error, undefined)
    assert.equal(getNode('0.$oneOf').childError, false)
    assert.equal(getNode('1.$oneOf').error, undefined)
    assert.equal(getNode('1.$oneOf').childError, true)
    statefulLayout.input(getNode('1.$oneOf.0.content'), 'Content 2')
    assert.deepEqual(statefulLayout.stateTree.root.data, [{ type: 'title', titleSize: 'h3', content: 'Content' }, { type: 'title', titleSize: 'h3', content: 'Content 2' }])
    assert.equal(statefulLayout.valid, true)

    statefulLayout.activateItem(getNode('1.$oneOf'), 1)
    assert.deepEqual(statefulLayout.stateTree.root.data, [{ type: 'title', titleSize: 'h3', content: 'Content' }, { type: 'text', content: 'Content 2' }])
    assert.equal(statefulLayout.valid, true)

    // change order
    assert.deepEqual(statefulLayout.activatedItems, { '/0/$oneOf': 0, '/1/$oneOf': 1 })
    statefulLayout.input(statefulLayout.stateTree.root, [{ type: 'text', content: 'Content 2' }, { type: 'title', titleSize: 'h3', content: 'Content' }])
    assert.deepEqual(statefulLayout.stateTree.root.data, [{ type: 'text', content: 'Content 2' }, { type: 'title', titleSize: 'h3', content: 'Content' }])
    assert.equal(statefulLayout.valid, true)
    assert.deepEqual(statefulLayout.activatedItems, { '/0/$oneOf': 1, '/1/$oneOf': 0 })
  })
})
