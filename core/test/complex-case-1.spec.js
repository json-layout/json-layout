import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '../src/index.js'

describe('A complex case from a data-fair processing', () => {
  const defaultOptions = { debounceInputMs: 0 }

  it('should manage errors properly', async () => {
    const compiledLayout = await compile(
      {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'scheduling', 'config'],
        properties: {
          title: { type: 'string', title: 'Titre' },
          active: { title: 'Actif', type: 'boolean', default: false, layout: 'switch' },
          config: {
            type: 'object',
            required: [],
            allOf: [
              {
                title: 'Jeu de données',
                oneOf: [{ title: 'Créer un jeu de données', required: ['dataset'], properties: { datasetMode: { type: 'string', const: 'create', title: 'Action' }, dataset: { type: 'object', required: ['title'], properties: { title: { type: 'string', title: 'Titre' } } } } }, { title: 'Mettre à jour un jeu de données (fichier)', required: ['dataset'], properties: { datasetMode: { type: 'string', const: 'update' }, dataset: { type: 'object', title: 'Jeu de données existant', description: 'Sélectionnez un jeu de données GTFS métadonnées uniquement', properties: { id: { type: 'string', title: 'Identifiant' }, title: { type: 'string', title: 'Titre' } }, layout: { getItems: { url: '${context.dataFairUrl}/api/v1/datasets?q={q}&select=id,title&${context.ownerFilter}', itemKey: 'data["id"]', itemTitle: 'data["title"]', itemsResults: 'data["results"]' } } } } }],
                oneOfLayout: { label: 'Action' }
              }, {
                title: 'Paramètres',
                required: ['url'],
                properties: {
                  url: { type: 'string', title: "l'Url d'accès aux données sources (source zip)", description: 'les protocoles supportés sont HTTP, HTTPS et SFTP' },
                  username: { title: 'Utilisateur', type: 'string' },
                  password: { title: 'Mot de passe', type: 'string', layout: { props: { type: 'password' } } },
                  downloadZip: { type: 'boolean', title: 'Télécharger le fichier zip', description: "Télécharger le fichier zip ou l'ensemble des fichiers contenus dans le zip" },
                  clearFiles: { type: 'boolean', title: 'Supprimer les fichiers existants' }
                }
              }
            ],
            title: 'Plugin gtfs (0.3.8)',
            'x-options': { deleteReadOnly: false },
            layout: 'tabs'
          },
          scheduling: { title: 'Planification du traitement', type: 'object', oneOf: [{ title: 'Déclenchement manuel', properties: { type: { const: 'trigger' } } }, { title: 'Mensuel', properties: { type: { const: 'monthly' }, dayOfWeek: { type: 'string', const: '*' }, dayOfMonth: { title: 'Jour du mois', type: 'integer', minimum: 1, maximum: 28, default: 1, 'x-cols': 6, 'x-class': 'pr-1' }, hour: { title: 'Heure de la journée', description: 'de 0 à 23', type: 'integer', minimum: 0, maximum: 23, default: 0, 'x-cols': 6 }, minute: { title: 'Minute', description: 'de 0 à 59', type: 'integer', minimum: 0, maximum: 59, default: 0, 'x-cols': 6, 'x-class': 'pr-1' }, month: { type: 'string', const: '*' }, timeZone: { type: 'string', 'x-cols': 6, layout: { slots: { component: 'custom-time-zone' } } } } }, { title: 'Hebdomadaire', properties: { type: { const: 'weekly' }, dayOfWeek: { title: 'Jour de la semaine', type: 'string', oneOf: [{ const: '1', title: 'lundi' }, { const: '2', title: 'mardi' }, { const: '3', title: 'mercredi' }, { const: '4', title: 'jeudi' }, { const: '5', title: 'vendredi' }, { const: '6', title: 'samedi' }, { const: '0', title: 'dimanche' }], default: '1', 'x-cols': 6, 'x-class': 'pr-1' }, hour: { title: 'Heure de la journée', description: 'de 0 à 23', type: 'integer', minimum: 0, maximum: 23, default: 0, 'x-cols': 6, 'x-class': 'pl-1' }, minute: { title: 'Minute', description: 'de 0 à 59', type: 'integer', minimum: 0, maximum: 59, default: 0, 'x-cols': 6, 'x-class': 'pr-1' }, dayOfMonth: { type: 'string', const: '*' }, month: { type: 'string', const: '*' }, timeZone: { type: 'string', 'x-cols': 6, layout: { slots: { component: 'custom-time-zone' } } } } }, { title: 'Journalier', properties: { type: { const: 'daily' }, dayOfWeek: { type: 'string', const: '*' }, hour: { title: 'Heure de la journée', description: 'de 0 à 23', type: 'integer', minimum: 0, maximum: 23, default: 0, 'x-cols': 6, 'x-class': 'pr-1' }, timeZone: { type: 'string', 'x-cols': 6, layout: { slots: { component: 'custom-time-zone' } } }, minute: { title: 'Minute', description: 'de 0 à 59', type: 'integer', minimum: 0, maximum: 59, default: 0, 'x-cols': 6, 'x-class': 'pr-1' }, dayOfMonth: { type: 'string', const: '*' }, month: { type: 'string', const: '*' } } }, { title: 'Toutes les # heures', properties: { type: { const: 'hours' }, dayOfWeek: { type: 'string', const: '*' }, hour: { type: 'string', const: '*' }, hourStep: { title: "Nombre d'heures de l'interval", type: 'integer', minimum: 1, maximum: 12, default: 1, 'x-cols': 6, 'x-class': 'pl-1' }, minute: { title: 'Minute', description: 'de 0 à 59', type: 'integer', minimum: 0, maximum: 59, default: 0, 'x-cols': 6, 'x-class': 'pl-1' }, dayOfMonth: { type: 'string', const: '*' }, month: { type: 'string', const: '*' } } }] },
          permissions: { type: 'array', title: 'Permissions', layout: { options: { messages: { addItem: 'Ajouter une permission' } } }, items: { type: 'object', required: ['profile', 'target'], properties: { profile: { type: 'string', title: 'Profil', default: 'read', oneOf: [{ const: 'read', title: "lecture - permet d'accéder aux informations essentielles du traitement dont les logs, mais pas aux informations sensibles" }, { const: 'exec', title: "exécution - permet d'accéder aux informations essentielles du traitement et de déclencher le traitement" }] }, target: { type: 'object', oneOf: [{ title: 'utilisateur désigné par son email', required: ['email'], properties: { type: { const: 'userEmail', title: 'Type de cible', 'x-options': { hideInArrayItem: true } }, email: { type: 'string', title: 'Email' } } }, { title: 'organisation partenaire', required: ['organization', 'roles'], properties: { type: { const: 'partner' }, organization: { type: 'object', title: 'Organisation', properties: { id: { type: 'string' }, name: { type: 'string' } }, layout: { getItems: { url: '${context.directoryUrl}/api/organizations/${context.owner.id}', itemKey: 'data["id"]', itemTitle: 'data["name"]', itemsResults: 'data["partners"]' } } }, roles: { type: 'array', title: 'Rôles', default: ['admin'], items: { type: 'string', enum: ['admin', 'contrib', 'user'] } } } }], oneOfLayout: { label: 'Type de cible' } } } } }
        },
        $id: '_jl'
      })
    const statefulLayout = new StatefulLayout(
      compiledLayout, compiledLayout.skeletonTree,
      defaultOptions,
      { title: 'test2', scheduling: { type: 'trigger' }, active: true, config: { datasetMode: 'create', dataset: { title: 'test' } } }
    )
    assert.ok(!statefulLayout.stateTree.valid)
    assert.ok(!statefulLayout.stateTree.root.error)
    assert.ok(statefulLayout.stateTree.root.childError)

    const configNode = statefulLayout.stateTree.root.children?.find(node => node.key === 'config')
    assert.ok(configNode)
    assert.ok(!configNode.error)
    assert.ok(configNode.childError)
    assert.equal(configNode.children?.length, 2)

    const parametersNode = configNode.children[1]
    assert.ok(!parametersNode.error)
    assert.ok(parametersNode.childError)
    assert.equal(parametersNode.children?.length, 5)

    const urlNode = parametersNode.children[0]
    assert.equal(urlNode.error, 'required information')
  })
})
