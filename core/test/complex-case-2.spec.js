import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '../src/index.js'

describe('Complex cases from data-fair applications', () => {
  const defaultOptions = { debounceInputMs: 0 }

  it('should resolve refs in a specific case properly', async () => {
    const compiledLayout = await compile(
      {
        type: 'object',
        required: ['datasets'],
        allOf: [{
          title: 'Données',
          properties: {
            datasets: {
              type: 'array',
              items: [{
                title: 'Jeu de données',
                type: 'object',
                'x-fromUrl': 'api/v1/datasets?status=finalized&q={q}&select=id,title&owner={context.owner.type}:{context.owner.id}',
                'x-itemsProp': 'results',
                'x-itemTitle': 'title',
                'x-itemKey': 'href',
                properties: {
                  href: { type: 'string' },
                  title: { type: 'string' },
                  id: { type: 'string' }
                }
              }]
            },
            filters: {
              $ref: '#/definitions/filters'
            }
          }
        }, {
          title: 'Vignette',
          properties: {
            preview: {
              type: 'object',
              properties: {
                rowsNumber: {
                  title: 'Nombre de ligne',
                  type: 'integer',
                  default: 4
                },
                contentFields: {
                  title: 'Champs à utiliser',
                  description: "Vous pouvez modifier l'ordre d'affichage par glisser / deposer des vignettes.",
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      key: {
                        type: 'string',
                        title: 'Champ',
                        'x-fromUrl': '{datasets.0.href}/schema?calculated=false',
                        'x-itemTitle': 'label',
                        'x-itemKey': 'key'
                      },
                      inDescription: {
                        title: 'Dans la description',
                        description: 'Les champs dans la description sont affichés en premier, sans le libellé de la colonne.',
                        type: 'boolean'
                      }
                    }
                  }
                },
                image: {
                  title: "Affichage de l'image",
                  type: 'string',
                  oneOf: [{
                    const: 'banner',
                    title: 'Bannière'
                  }, {
                    const: 'logo',
                    title: 'Logo'
                  }, {
                    const: 'none',
                    title: 'Aucune image'
                  }],
                  default: 'banner'
                }
              }
            }
          }
        }, {
          title: 'Fiche détaillée',
          properties: {
            details: {
              type: 'object',
              properties: {
                active: {
                  title: 'Activer les fiches détaillées',
                  type: 'boolean',
                  default: false
                },
                print: {
                  title: "Activer l'impression des fiches'",
                  type: 'boolean',
                  default: false
                },
                content: {
                  title: 'Champs à utiliser',
                  type: 'object',
                  default: {
                    type: 'all'
                  },
                  oneOf: [
                    {
                      title: 'Tous les champs, formatage standard',
                      properties: {
                        type: {
                          const: 'all'
                        }
                      }
                    },
                    {
                      title: 'Réglage manuel',
                      properties: {
                        type: {
                          const: 'custom'
                        },
                        elements: {
                          title: 'Elements',
                          description: "Vous pouvez modifier l'ordre d'affichage par glisser / deposer des vignettes.",
                          type: 'array',
                          items: {
                            type: 'object',
                            default: {
                              type: 'key-value'
                            },
                            oneOf: [
                              {
                                title: 'Nom du champ et valeur',
                                properties: {
                                  type: {
                                    const: 'key-value'
                                  },
                                  field: {
                                    type: 'string',
                                    title: 'Champ',
                                    'x-fromUrl': '{datasets.0.href}/schema?calculated=false',
                                    'x-itemTitle': 'label',
                                    'x-itemKey': 'key'
                                  },
                                  format: {
                                    title: 'Formatage',
                                    type: 'string',
                                    oneOf: [{
                                      const: 'none',
                                      title: 'Aucun'
                                    }, {
                                      const: 'link',
                                      title: 'Lien hypertexte'
                                    }],
                                    default: 'none'
                                  },
                                  useDescriptionAsLabel: {
                                    title: 'Utiliser la description à la place du libellé',
                                    type: 'boolean',
                                    default: false
                                  },
                                  invertTextFormat: {
                                    title: 'Inverser le formattage du libellé et de la valeur',
                                    type: 'boolean',
                                    default: false
                                  }
                                }
                              },
                              {
                                title: 'Valeur du champ uniquement',
                                properties: {
                                  type: {
                                    const: 'value'
                                  },
                                  field: {
                                    type: 'string',
                                    title: 'Champ',
                                    'x-fromUrl': '{datasets.0.href}/schema?calculated=false',
                                    'x-itemTitle': 'label',
                                    'x-itemKey': 'key'
                                  },
                                  format: {
                                    title: 'Formatage',
                                    type: 'string',
                                    oneOf: [{
                                      const: 'none',
                                      title: 'Aucun'
                                    }, {
                                      const: 'title',
                                      title: 'Titre'
                                    }, {
                                      const: 'image',
                                      title: 'Image'
                                    }],
                                    default: 'none'
                                  }
                                }
                              },
                              {
                                title: 'Division horizontale',
                                properties: {
                                  type: {
                                    const: 'divider'
                                  }
                                }
                              }
                            ]
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }, {
          title: 'Filtres et tris',
          properties: {
            search: {
              type: 'object',
              properties: {
                textSearch: {
                  title: 'Recherche textuelle libre',
                  type: 'boolean',
                  default: true
                },
                sorts: {
                  title: 'Options de tri',
                  type: 'array',
                  'x-fromUrl': '{datasets.0.href}/schema?calculated=false',
                  'x-itemTitle': 'label',
                  'x-itemKey': 'key',
                  items: {
                    type: 'string'
                  }
                },
                dynamicFilters: {
                  type: 'array',
                  title: 'Filtres dynamiques',
                  items: {
                    type: 'object',
                    required: ['field'],
                    properties: {
                      field: {
                        type: 'object',
                        title: 'Champ',
                        'x-fromUrl': '{datasets.0.href}/schema?calculated=false',
                        'x-itemTitle': 'label',
                        'x-itemKey': 'key'
                      }
                    },
                    if: {
                      required: ['field'],
                      properties: {
                        field: {
                          type: 'object',
                          properties: {
                            'x-cardinality': {
                              maximum: 105
                            }
                          }
                        }
                      }
                    },
                    then: {
                      properties: {
                        facet: {
                          title: 'Facette (filtre avec décompte)',
                          type: 'boolean',
                          default: true
                        },
                        sort: {
                          title: 'Tri des valeurs',
                          type: 'string',
                          enum: ['Par décompte', 'Alphabétique'],
                          default: 'Par décompte',
                          'x-if': 'parent.value.facet'
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }],
        definitions: {
          filters: {
            title: 'Filtres prédéfinis',
            type: 'array',
            items: {
              type: 'object',
              default: {
                type: 'in'
              },
              required: [
                'type'
              ],
              oneOf: [{
                title: 'Restreindre à des valeurs',
                required: [
                  'field'
                ],
                properties: {
                  type: {
                    const: 'in'
                  },
                  field: {
                    $ref: '#/definitions/filterField'
                  },
                  values: {
                    type: 'array',
                    title: 'Valeurs',
                    items: {
                      type: 'string'
                    },
                    'x-fromUrl': '{datasets.0.href}/values/{parent.value.field.key}?q={q}&q_mode=complete&size=100&stringify=true'
                  }
                }
              },
              {
                title: 'Restreindre à un interval de valeurs',
                required: [
                  'field'
                ],
                properties: {
                  type: {
                    const: 'interval'
                  },
                  field: {
                    $ref: '#/definitions/filterField'
                  },
                  minValue: {
                    type: 'string',
                    title: 'Valeur min',
                    'x-fromUrl': '{datasets.0.href}/values/{parent.value.field.key}?q={q}&q_mode=complete&size=100&stringify=true'
                  },
                  maxValue: {
                    type: 'string',
                    title: 'Valeur max',
                    'x-fromUrl': '{datasets.0.href}/values/{parent.value.field.key}?q={q}&q_mode=complete&size=100&stringify=true'
                  }
                }
              },
              {
                title: 'Exclure des valeurs',
                required: [
                  'field'
                ],
                properties: {
                  type: {
                    const: 'out'
                  },
                  field: {
                    $ref: '#/definitions/filterField'
                  },
                  values: {
                    type: 'array',
                    title: 'Valeurs à exclure',
                    items: {
                      type: 'string'
                    },
                    'x-fromUrl': '{datasets.0.href}/values/{parent.value.field.key}?q={q}&q_mode=complete&size=100&stringify=true'
                  }
                }
              }
              ]
            }
          },
          filterField: {
            type: 'object',
            title: 'Colonne de filtre',
            'x-fromUrl': '{datasets.0.href}/schema?calculated=false',
            'x-itemTitle': 'label',
            'x-itemKey': 'key'
          }
        }
      })
    const statefulLayout = new StatefulLayout(
      compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      { }
    )
    assert.ok(statefulLayout.stateTree.valid)
  })

  it.only('should resolve refs in another specific case properly', async () => {
    const compiledLayout = await compile({
      type: 'object',
      allOf: [{
        title: 'Données',
        properties: {
          valueCalc: {
            $ref: '#/definitions/valueCalc'
          }
        }
      }],
      definitions: {
        valueCalc: {
          type: 'object',
          default: {
            type: 'count'
          },
          oneOf: [{
            title: 'Nombre de lignes',
            properties: {
              type: {
                const: 'count'
              }
            }
          }]
        }
      }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      { }
    )
    assert.ok(statefulLayout.stateTree.valid)
  })
})
