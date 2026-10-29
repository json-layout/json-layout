/**
 * @file One-off builder of the starting documents of the nested-document cases.
 *
 * Run by hand, never by tests, and only to change a starting document:
 *
 *   node core/webmcp-eval/build-start.js
 *
 * A starting document written straight to a file is a guess about what the form accepts.
 * These are written THROUGH the form instead: an EvalSession on the case's schema is fed
 * the content with the tools an agent has (setData, editArray, setFieldValue), and the data
 * the form ends with is kept only when the form reports it valid and reloads it unchanged,
 * so every arm starts from the document the form itself would hold.
 *
 * Writes cases/data/portal-page-rich.json (a free page of eleven top-level blocks, two of
 * them two-column sections, a grid of cards and an accordion) and
 * cases/data/portal-config-rich.json (the seeded portal draft of portal-config-edit.json,
 * filled in with a menu, contact details, social accounts and footer links). The content is
 * a fictional inter-communal authority; the uuids are fixed so that a rebuild is stable. The
 * pages the documents link to are cases/data/portal-pages.json, the cases' context.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { EvalSession } from './session.js'

const here = dirname(fileURLToPath(import.meta.url))

/** @param {string} file */
const readJSON = (file) => JSON.parse(readFileSync(join(here, 'cases', file), 'utf8'))

const compileOptions = { locale: 'fr', xI18n: true, ajvOptions: { discriminator: true } }

/** The pages of the portal, as the portals manager gives them to its editors; shared with the cases. */
const portalPages = readJSON('data/portal-pages.json')

/**
 * A session the builder drives, failing on any call the form refuses.
 * @param {Record<string, unknown>} schema
 * @param {Record<string, unknown>} data
 * @param {Record<string, unknown>} context
 */
function builder (schema, data, context) {
  const session = new EvalSession({
    name: 'build-start',
    title: 'document',
    goal: 'build a starting document',
    schema,
    data,
    compileOptions,
    context,
    expectedComplexity: 'large',
    expectedSchemaFits: false
  })
  /**
   * @param {string} tool
   * @param {Record<string, unknown>} args
   */
  const call = async (tool, args) => {
    const result = await session.call(tool, args)
    if (result.isError) throw new Error(`${tool} ${JSON.stringify(args)} refused: ${session.calls.at(-1)?.response}`)
    return result
  }
  return { session, call }
}

/**
 * The data the form ends with, when it is valid and reloads unchanged.
 * @param {EvalSession} session
 * @param {Record<string, unknown>} schema
 * @param {Record<string, unknown>} context
 * @param {string} file
 */
function keep (session, schema, context, file) {
  if (!session.valid) throw new Error(`${file}: the form reports the document invalid`)
  const data = structuredClone(session.data)
  const reloaded = builder(schema, /** @type {Record<string, unknown>} */ (data), context).session
  if (!reloaded.valid) throw new Error(`${file}: the document is invalid once reloaded`)
  if (JSON.stringify(reloaded.start) !== JSON.stringify(data)) throw new Error(`${file}: the form changes the document when it reloads it`)
  const text = JSON.stringify(data, null, 2) + '\n'
  writeFileSync(join(here, 'cases', 'data', file), text)
  console.log(`${file}: ${Buffer.byteLength(text)} bytes`)
}

/**
 * @param {string} uuid
 * @param {string} content
 */
const text = (uuid, content) => ({ uuid, type: 'text', content })

/**
 * @param {string} uuid
 * @param {string} content
 * @param {string} titleSize
 */
const title = (uuid, content, titleSize) => ({ uuid, type: 'title', content, titleSize })

/**
 * @param {string} uuid
 * @param {string} cardTitle
 * @param {string} uuidText
 * @param {string} content
 */
const card = (uuid, cardTitle, uuidText, content) => ({ uuid, type: 'card', title: cardTitle, children: [text(uuidText, content)], actions: [] })

/**
 * @param {string} uuid
 * @param {string} panelTitle
 * @param {string} content
 */
const panel = (uuid, panelTitle, content) => ({ title: panelTitle, children: [text(uuid, content)] })

/** The free page of the three page cases. */
async function buildPage () {
  const schema = readJSON('schemas/portal-page.json')
  const context = { pages: portalPages }
  const { session, call } = builder(schema, {}, context)

  // the page and its first blocks in one write, as an editor pastes a draft
  await call('setData', {
    merge: false,
    data: {
      title: 'Découvrir nos données',
      description: 'Le portail open data du Val de Loue : jeux de données, visualisations et réutilisations de l\'agglomération, librement réutilisables.',
      showBreadcrumbs: true,
      fluid: false,
      elements: [
        { ...title('3f2a9c01', 'Les données ouvertes du Val de Loue', 'h1'), centered: true },
        text('3f2a9c02', 'Depuis 2019, la Communauté d\'agglomération du Val de Loue publie ses données en open data. Transports, environnement, budget, équipements publics : **plus de 180 jeux de données** sont librement réutilisables sous Licence Ouverte 2.0.\n\nCe portail vous permet de les explorer, de les visualiser sous forme de cartes et de graphiques, et de les télécharger dans les formats les plus courants.'),
        { uuid: '3f2a9c03', type: 'alert', alertType: 'info', title: 'Nouveau', content: 'Les mesures de qualité de l\'air de nos six stations sont désormais publiées chaque jour avant 9 h, avec l\'historique complet depuis 2015.' },
        {
          uuid: '3f2a9c04',
          type: 'two-columns',
          disposition: 'left',
          gutter: 'default',
          children: [
            title('3f2a9c05', 'Nos engagements', 'h3'),
            text('3f2a9c06', '- **Ouvrir par défaut** : toute donnée publique non personnelle a vocation à être publiée.\n- **Mettre à jour** : chaque jeu de données indique sa fréquence de mise à jour et la respecte.\n- **Documenter** : chaque colonne est décrite, chaque source est citée.\n- **Écouter** : vos demandes de publication reçoivent une réponse sous quinze jours.'),
            { uuid: '3f2a9c07', type: 'button', link: { type: 'standard', subtype: 'datasets', title: 'Voir tout le catalogue' } }
          ],
          children2: [
            {
              uuid: '3f2a9c08',
              type: 'card',
              title: 'Un jeu de données vous manque ?',
              children: [text('3f2a9c09', 'Dites-nous quelles données vous seraient utiles et pour quel usage : nous étudions chaque demande avec les services concernés.')],
              actions: [{ type: 'standard', subtype: 'contact', title: 'Nous écrire' }]
            },
            text('3f2a9c0a', 'Besoin d\'aide ? Notre équipe open data répond à vos questions du lundi au vendredi, de 9 h à 17 h, par courriel à opendata@valdeloue.fr.')
          ]
        },
        { uuid: '3f2a9c0b', type: 'divider' },
        title('3f2a9c0c', 'Thématiques à la une', 'h2'),
        {
          uuid: '3f2a9c0d',
          type: 'responsive-grid',
          columns: 3,
          children: [
            card('3f2a9c0e', 'Mobilité', '3f2a9c0f', 'Horaires et arrêts du réseau de bus Loue\'Bus, stations de vélos en libre-service, comptages routiers et places de stationnement.'),
            card('3f2a9c10', 'Environnement', '3f2a9c11', 'Qualité de l\'air, points d\'apport volontaire, collecte des déchets, espaces verts et arbres d\'alignement.')
          ]
        }
      ]
    }
  })

  // the rest of the grid, card by card
  await call('editArray', { path: '/elements/6/children', action: 'add', value: card('3f2a9c12', 'Budget et finances', '3f2a9c13', 'Budget primitif et compte administratif depuis 2016, subventions versées aux associations, marchés publics attribués.') })
  await call('editArray', { path: '/elements/6/children', action: 'add', value: card('3f2a9c14', 'Culture et patrimoine', '3f2a9c15', 'Équipements culturels, fréquentation des médiathèques, monuments protégés et programmation des saisons culturelles.') })
  await call('editArray', { path: '/elements/6/children', action: 'add', value: card('3f2a9c16', 'Équipements sportifs', '3f2a9c17', 'Gymnases, piscines, stades et terrains de proximité, avec leurs horaires d\'ouverture et leurs équipements.') })

  // the lower half of the page, block by block
  await call('editArray', { path: '/elements', action: 'add', value: title('3f2a9c18', 'Questions fréquentes', 'h2') })
  await call('editArray', {
    path: '/elements',
    action: 'add',
    value: {
      uuid: '3f2a9c19',
      type: 'expansion-panels',
      panels: [
        panel('3f2a9c1a', 'Sous quelle licence les données sont-elles publiées ?', 'Toutes les données de ce portail sont publiées sous Licence Ouverte 2.0 (Etalab) : vous pouvez les réutiliser librement, y compris à des fins commerciales, en citant la source.'),
        panel('3f2a9c1b', 'À quelle fréquence sont-elles mises à jour ?', 'Chaque jeu de données indique sa fréquence de mise à jour : quotidienne pour la qualité de l\'air et les vélos, mensuelle pour les comptages routiers, annuelle pour le budget.'),
        panel('3f2a9c1c', 'Comment utiliser l\'API ?', 'Chaque jeu de données dispose d\'une API documentée, accessible sans clé pour les données publiques. La documentation interactive est disponible depuis la page de chaque jeu de données.'),
        panel('3f2a9c1d', 'Comment signaler une erreur ?', 'Utilisez le bouton « Signaler un problème » de la page du jeu de données, ou écrivez-nous : chaque signalement est transmis au service producteur de la donnée.')
      ]
    }
  })
  await call('editArray', {
    path: '/elements',
    action: 'add',
    value: {
      uuid: '3f2a9c1e',
      type: 'two-columns',
      disposition: 'equal',
      gutter: 'default',
      children: [
        title('3f2a9c1f', 'Jeunesse', 'h3'),
        text('3f2a9c20', 'Accueils de loisirs, conseil des jeunes, aides au permis de conduire et au BAFA : découvrez les actions de l\'agglomération pour les 11-25 ans.'),
        { uuid: '3f2a9c21', type: 'button', link: { type: 'generic', pageRef: { slug: 'jeunesse', title: 'Nos actions pour la jeunesse' }, title: 'Voir les actions jeunesse' } }
      ],
      children2: [
        title('3f2a9c22', 'Presse', 'h3'),
        text('3f2a9c23', 'Journalistes : retrouvez nos communiqués, nos visuels et les contacts du service communication.'),
        { uuid: '3f2a9c24', type: 'button', link: { type: 'generic', pageRef: { slug: 'contact-presse', title: 'Contact presse' }, title: 'Contacter le service presse' } }
      ]
    }
  })
  await call('editArray', { path: '/elements', action: 'add', value: text('3f2a9c25', 'Les données de ce portail sont mises à disposition par la Communauté d\'agglomération du Val de Loue, 2 place de la Mairie, 25290 Ornans. Pour toute question : opendata@valdeloue.fr.') })

  // two settings an editor adjusts once the blocks are in place
  await call('setFieldValue', { path: '/elements/6/gutter', value: 'dense' })
  await call('setFieldValue', { path: '/elements/8/multiple', value: true })

  keep(session, schema, context, 'portal-page-rich.json')
}

/** The portal configuration of portal-config-multi. */
async function buildConfig () {
  const schema = readJSON('schemas/portal-config.json')
  const context = { owner: { type: 'organization', id: 'test_org1' }, pages: portalPages }
  // the seeded portal's draft, as portal-config-edit starts from it
  const { session, call } = builder(schema, readJSON('data/portal-config-edit.json'), context)

  await call('setData', {
    merge: true,
    data: {
      title: 'Données ouvertes du Val de Loue',
      description: 'Le portail open data de la Communauté d\'agglomération du Val de Loue : transports, environnement, budget et équipements publics.',
      contactInformations: {
        email: 'opendata@valdeloue.fr',
        phone: '03 81 57 20 00',
        phoneLabel: 'Accueil de l\'agglomération',
        website: 'https://www.valdeloue.fr',
        websiteLabel: 'valdeloue.fr',
        infos: 'Communauté d\'agglomération du Val de Loue\n2 place de la Mairie, 25290 Ornans\n\nDu lundi au vendredi, de 9 h à 17 h.'
      },
      socialLinks: { facebook: 'https://www.facebook.com/valdeloue', bluesky: 'valdeloue.bsky.social' }
    }
  })
  await call('editArray', { path: '/menu/children', action: 'add', value: { type: 'standard', subtype: 'applications', title: 'Visualisations' } })
  await call('editArray', { path: '/menu/children', action: 'add', value: { type: 'generic', pageRef: { slug: 'reutilisations', title: 'Ils réutilisent nos données' }, title: 'Réutilisations' } })
  await call('editArray', { path: '/menu/children', action: 'add', value: { type: 'standard', subtype: 'contact', title: 'Contact' } })
  await call('editArray', { path: '/footer/links', action: 'add', value: { type: 'standard', subtype: 'legal-notice', title: 'Mentions légales' } })
  await call('editArray', { path: '/footer/links', action: 'add', value: { type: 'standard', subtype: 'accessibility', title: 'Accessibilité : partiellement conforme' } })
  await call('editArray', { path: '/footer/links', action: 'add', value: { type: 'external', href: 'https://www.valdeloue.fr', title: 'Site de l\'agglomération' } })

  keep(session, schema, context, 'portal-config-rich.json')
}

await buildPage()
await buildConfig()
