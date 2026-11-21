# Suivi du recouvrement des cotisations impayées

Application web locale qui reprend le classeur `suivi_cotisations_impayees opti.xlsx`.
Aucune installation, aucun serveur : le fichier `index.html` s'ouvre dans le navigateur et
les données sont enregistrées automatiquement sur ce poste.

## Ouvrir l'application

- Double-cliquez sur `index.html`, ou sur `Ouvrir l'application.bat`.
- Utilisez de préférence Chrome, Edge ou Firefox, y compris hors connexion.
- Le registre initial contient les **71 employeurs** du classeur. Les montants sont à saisir.

## Accès protégé

- À l'ouverture, l'application demande un **identifiant** et un **mot de passe** avant d'afficher les données.
- La session reste ouverte tant que l'onglet est ouvert. Le bouton **Verrouiller** de la barre supérieure
  ferme l'accès immédiatement et redemande les identifiants ; fermer l'onglet ou le navigateur verrouille aussi.
- Le mot de passe est comparé à une empreinte enregistrée dans `assets/auth.js` ; il n'est pas stocké en clair
  et n'est jamais envoyé sur Internet.
- Ce verrouillage bloque l'interface, mais ne chiffre pas les données enregistrées dans le navigateur.
  Pour une protection complète, verrouillez aussi la session Windows et le dossier de l'application.

## Modules

| Module | Rôle |
| --- | --- |
| Tableau de bord | Indicateurs, taux de recouvrement, alertes, score de risque, graphiques de tendance, 5 dossiers les plus anciens, rapport d'une page pour le comité |
| Employeurs | Registre, recherche, filtres rapides, score de risque, fiche détaillée imprimable, courriers de recouvrement, courriers groupés, ajout / modification / suppression |
| Suivi mensuel | Dû global, encaissements et effectif modifiable mois par mois, synthèse annuelle avec effectif moyen et cumulée, import CSV ou Excel, export du classeur Excel. Entrée ou ↓ passent à la ligne suivante, ↑ ou Maj+Entrée à la précédente, ←→ changent de colonne |
| Situation mensuelle | Qui a déclaré, payé en partie, pas payé ou non déclaré, mois par mois |
| Détail assurés | Traçabilité facultative par assuré, avec calcul automatique des cotisations |
| Journal | Appels, courriers, visites, engagements et prochaine action |
| Échéanciers | Échéances négociées, paiements, retards |
| Paramètres | Règles de calcul, année de suivi, date de référence, qualité des données, sauvegarde / restauration |

## Filtres rapides du registre

Dans **Employeurs**, quatre boutons filtrent la liste sans modifier les données :

- **Débiteurs uniquement** : solde total positif.
- **Score critique** : score de risque de 81 à 100.
- **Sans action depuis 30 j** : dossier débiteur sans contact au journal depuis 30 jours, ou jamais relancé.
- **En retard d'échéancier** : au moins une échéance impayée dont la date est dépassée.

- Les filtres se combinent entre eux et avec la recherche et le filtre de statut.
- Le nombre affiché sur chaque bouton indique les employeurs concernés par la recherche et le statut en cours.
- **Tout effacer** retire les filtres rapides ; le compteur à droite indique le nombre d'employeurs affichés.
- L'export CSV et l'impression de la liste reprennent la sélection filtrée.

## Contacts des employeurs

Le champ **Contact** de la fiche employeur reste libre : téléphones, e-mail et nom de l'interlocuteur
peuvent y être saisis ensemble, par exemple `90327777/96193939 MUSTAPHA` ou
`70597606 M SOGOYOU/samtou.sogoyou@sos-togo.org`.

- L'application reconnaît automatiquement les **téléphones** et les **adresses e-mail**, même collés
  l'un à l'autre (`70651653sseqcu.togo@gmail.com`).
- Dans la fiche employeur, chaque numéro devient un lien **Appeler** et chaque adresse un lien
  **Écrire** ; les boutons correspondants sont ajoutés en bas de la fiche lorsque le contact existe.
- Un numéro togolais à 8 chiffres est appelé avec l'indicatif **+228**. Les numéros saisis avec
  `+` ou `00` sont conservés tels quels.
- Le nom ou la note du contact (`M TAGBA`, `La RH`, `Institution dissoute…`) est affiché à part.
- À l'impression, les liens reprennent en texte simple, sans adresse technique.
- Le contrôle **Paramètres → Qualité des données** utilise la même reconnaissance pour repérer les
  contacts sans e-mail.

## Suivi pluriannuel

- Le suivi est organisé par **année civile** (janvier → décembre). Choisissez l'année dans la
  barre supérieure ou dans Paramètres → Suivi annuel.
- Les années précédentes sont conservées : revenir à une année affiche ses données sans les modifier.
- Le **solde impayé au 31 décembre** est automatiquement reporté au 1<sup>er</sup> janvier suivant
  comme **solde antérieur**. Il s'ajoute au solde de l'année affichée pour donner le **solde cumulé**.
- Ne saisissez donc pas ce report dans le dû de janvier : il serait compté deux fois. Un encaissement
  reçu pour un impayé antérieur peut être saisi dans l'année en cours (il réduit alors le solde cumulé)
  ou dans l'année d'origine.
- « Préparer N+1 » (Paramètres) bascule simplement l'affichage sur l'année suivante ; aucune donnée
  n'est effacée.

## Effectifs

- La fiche employeur contient un **effectif de référence**.
- Dans **Suivi mensuel → Saisie par mois**, la colonne **Effectif** est modifiable pour chaque organisme et chaque mois. Une valeur saisie remplace l'effectif de référence pour ce mois uniquement ; effacez la cellule pour revenir à la référence (la valeur grisée indique que la référence est utilisée).
- La valeur `0` est acceptée : elle signifie qu'aucun salarié n'est déclaré pour ce mois.
- L'onglet **Synthèse 12 mois** affiche l'**effectif moyen** de chaque employeur, la ligne **Effectif total** mois par mois, et l'effectif total moyen de l'année.
- L'effectif suit donc les variations saisonnières sans modifier la fiche employeur.

## Saisie des montants

- Les champs de montants affichent automatiquement les **séparateurs de milliers** : dû global et
  encaissé du suivi mensuel, montant prévu et montant payé des échéanciers, seuil de solde des
  notifications.
- Les espaces sont insérés pendant la frappe ; le curseur reste à sa place et la valeur est
  enregistrée sans séparateur.
- Un montant collé déjà formaté (`1 234 567`) est repris correctement. Les montants sont entiers :
  une partie décimale éventuelle est ignorée.
- L'effectif, l'indice et les taux restent des nombres simples.

## Règles de calcul

- **Dû retenu** d'un mois = total du détail des assurés s'il existe pour ce mois, sinon dû global saisi.
- **Solde annuel** = dû retenu de l'année − encaissé de l'année.
- **Solde antérieur** = cumul des soldes de tous les mois antérieurs au 1<sup>er</sup> janvier.
- **Solde cumulé** = solde antérieur + solde annuel.
- **Taux de recouvrement** = encaissé cumulé (année + antérieur) ÷ dû cumulé, pour rester cohérent
  lorsqu'un paiement de l'année apure une dette antérieure.
- **Situation** : déclaré et payé, partiellement payé, non payé, ou non déclaré.
- **Ancienneté** : nombre de jours depuis le premier mois dont le solde est positif, toutes années confondues. Aucune ancienneté n'est affichée lorsque le solde cumulé est nul ou négatif (dossier soldé ou en crédit).
- **Détail assuré** : salaire mensuel = indice × valeur indiciaire ÷ 12 ;
  part employé 7 %, part employeur 20 % (total 27 %). Ces valeurs sont modifiables dans Paramètres.
  La valeur indiciaire est utilisée **telle que saisie, sans arrondi** : la valeur par défaut est **1 272,7**
  (et non 1 273), affichée avec sa décimale. Le champ Paramètres accepte la virgule.
  Les deux parts sont arrondies séparément au franc : le total peut différer de 1 FCFA du calcul direct de 27 %.
- Les **alertes** couvrent les échéances et actions à venir (30 jours par défaut) et les retards.

## Impression et PDF

- Le bouton **Imprimer** de la barre supérieure imprime la vue affichée (tableau de bord, registre, suivi mensuel…).
- Le bouton **Rapport 1 page** du tableau de bord produit une synthèse A4 portrait pour le comité : indicateurs de l'année, cinq soldes impayés les plus élevés, dossiers critiques et points de vigilance. Choisissez « Enregistrer au format PDF » dans la fenêtre d'impression pour obtenir le fichier.
- Depuis une **fiche employeur**, le bouton **Imprimer / PDF** n'imprime que la fiche, sans les menus ni les boutons.
- Dans la fenêtre d'impression du navigateur, choisissez « Enregistrer au format PDF » pour obtenir un fichier PDF.
- Les tableaux mensuels et la situation mensuelle s'impriment en **paysage** sur les navigateurs compatibles.
- Les courriers disposent de leur propre bouton d'impression et s'impriment seuls, sans l'interface.

## Import du suivi mensuel (CSV et Excel)

Dans **Suivi mensuel → Importer**, chargez un fichier CSV ou un classeur Excel (`.xlsx`, `.xls`) pour renseigner plusieurs employeurs et plusieurs mois en une fois.

- Colonnes reconnues : **N° immatriculation**, **Mois**, **Dû global**, **Encaissé**. La colonne **Effectif** est optionnelle et remplace l'effectif du mois concerné. En CSV, le séparateur peut être `;`, `,` ou une tabulation.
- Dans un classeur Excel, l'application parcourt les feuilles et repère le tableau même si les en-têtes ne sont pas sur la première ligne. Si plusieurs feuilles conviennent, elle demande laquelle importer.
- Le mois accepte `2026-01`, `01/2026`, `202601`, `31/12/2025`, `janvier 2026` et les cellules de date Excel.
- Les montants acceptent les espaces, la virgule décimale et le suffixe FCFA (`1 000 000,50`).
- Une cellule de montant vide laisse la valeur existante inchangée. Saisissez `0` pour remettre un montant à zéro.
- Avant l'import, un aperçu liste les lignes valides, les créations, les mises à jour, les doublons et les erreurs. Les lignes en erreur sont ignorées ; rien n'est écrit avant la confirmation.
- Le bouton **Modèle** télécharge un CSV vide avec les bonnes colonnes.
- Si un mois possède un **détail des assurés**, le dû global importé n'est pas retenu pour ce mois (le détail reste prioritaire) ; l'encaissement est bien enregistré. L'aperçu le signale.
- Un mois invalide est refusé explicitement : il n'est plus remplacé silencieusement par janvier.

## Export Excel

- Le bouton **Excel** du suivi mensuel, ou **Paramètres → Exporter le classeur Excel (.xlsx)**, produit un classeur avec les feuilles **Employeurs**, **Suivi mensuel**, **Assurés**, **Journal**, **Échéanciers** et **Paramètres**.
- La feuille **Suivi mensuel** reprend les colonnes attendues par l'import : le classeur peut être corrigé puis réimporté.
- La lecture et l'écriture du format `.xlsx` se font localement, sans connexion, grâce à SheetJS intégré (licence Apache 2.0).

## Score de risque

Chaque employeur ayant un solde impayé reçoit un **score de 0 à 100** qui aide à prioriser les relances. Un dossier soldé ou en crédit n'a pas de risque.

- **Composition** : ancienneté de la dette (25 %), régularité des paiements (25 %), respect des échéanciers (20 %), tendance du solde (15 %) et taux de recouvrement (15 %).
- **Niveaux** : Faible (0 à 30), Modéré (31 à 60), Élevé (61 à 80), Critique (81 à 100).
- Le score est affiché dans le bloc **Vigilance** du tableau de bord, dans la colonne **Risque** du registre et dans la fiche employeur, avec le détail des cinq facteurs.
- Le registre peut être trié par **Risque décroissant**.
- Il s'agit d'un indicateur d'aide : vérifiez toujours la situation réelle du dossier avant une décision.

## Graphiques de tendance

Le tableau de bord présente trois graphiques calculés à partir des montants saisis :

- **Solde cumulé sur l'année** : évolution du solde impayé à la fin de chaque mois, report antérieur inclus.
- **Taux de recouvrement mensuel** : encaissé ÷ dû retenu pour chaque mois, avec un repère à 80 %.
- **Principaux soldes impayés** : les huit montants restant les plus élevés.

Les graphiques sont dessinés localement, sans connexion ni bibliothèque externe, et suivent le thème choisi. Ils sont inclus dans l'impression de la vue.

## Courriers de recouvrement

- Fiche employeur → **Courrier** génère un **rappel simple**, une **relance amiable** ou une **mise en demeure** préremplie avec l'employeur, la période impayée et le solde cumulé.
- Le texte est librement modifiable dans la fenêtre, puis peut être copié ou imprimé / enregistré en PDF.
- Le courrier n'est proposé que si le solde cumulé est positif. Vérifiez les délais et les mentions légales avant envoi.

### Courriers groupés

- Dans **Employeurs**, cochez une ou plusieurs lignes ; les dossiers soldés sont désactivés.
- **Sélection rapide** : « Tous les débiteurs », « Critiques » ou « Aucun ».
- Choisissez le type de courrier, puis **Aperçu** : tous les courriers sont affichés avant impression, un par page.
- **Imprimer tout** imprime la série ou l'enregistre en PDF. Le texte groupé n'est pas modifiable courrier par courrier ; pour personnaliser un texte, ouvrez la fiche de l'employeur → **Courrier**.

## Qualité des données

**Paramètres → Qualité des données** recense les dossiers à compléter : contacts absents, contacts sans e-mail, raisons sociales en majuscules et statuts à vérifier.

- **Statut suggéré** : « Échéancier en cours » si une échéance n'est pas payée, « Soldé » si le solde cumulé est nul ou négatif, sinon « À relancer ». Le bouton « Appliquer » remplace le statut manuel.
- **Normalisation des noms** : les raisons sociales en majuscules peuvent être converties en casse normale. Un aperçu est affiché avant application ; les sigles de 4 lettres ou moins, les références avec chiffres et les noms à un seul mot sont conservés.
- Les contacts et les e-mails ne sont jamais inventés : ils restent à compléter manuellement.

## Apparence

- Le bouton **Thème** de la barre supérieure propose quatre présentations : **Bleu et blanc** (par défaut), **Gris et jaune**, **Rouge et gris** et **Sombre**.
- Le choix s'applique immédiatement à toute l'interface et reste mémorisé sur cet ordinateur, dans le navigateur utilisé.
- Le thème ne modifie que les couleurs : aucune donnée, aucun calcul et aucun export ne changent. À l'impression, le thème sombre repasse en noir sur blanc.

## Barre latérale

- Sur ordinateur, le bouton menu de la barre supérieure **réduit la barre latérale aux icônes** pour élargir la zone de travail ; cliquez à nouveau pour la déployer.
- Le choix est mémorisé dans le navigateur et repris à la prochaine ouverture.
- Sur un écran étroit, le même bouton ouvre et ferme le menu coulissant.

## Accessibilité

- Les liens de dossier et les actions se manipulent au clavier : **Entrée** ou **Espace** ouvre la fiche, **Échap** ferme la fenêtre.
- **Grille du suivi mensuel** : **Entrée** ou **↓** passe à la ligne suivante dans la même colonne, **↑** ou **Maj+Entrée** à la ligne précédente, **←→** aux colonnes voisines (avec passage à la ligne au bord), **Tab** avance dans la ligne et **Échap** quitte la cellule. Les cellules désactivées (dû remplacé par le détail) sont ignorées.
- Si vous corrigez une valeur, **←→** déplacent d'abord le curseur dans le nombre ; **Entrée** ou **↑↓** quittent la cellule et reprennent la navigation.
- Les boutons icônes disposent d'un libellé vocal, et les animations sont réduites si le système demande moins de mouvement.
- Raccourcis : **Ctrl+K** (ou Cmd+K) ouvre la recherche d'employeurs, **Ctrl+S** exporte une sauvegarde JSON, **G puis D** va au tableau de bord, **G puis E** va aux employeurs.

## Sauvegarde des données

- Enregistrement automatique dans le navigateur (`localStorage`) : rien n'est écrit dans un fichier
  tant que vous n'exportez pas.
- Les données sont liées au navigateur et au profil utilisateur. Une fenêtre de navigation privée
  perd les données à la fermeture.
- **Exportez régulièrement une sauvegarde JSON** avec le bouton « Exporter » ou depuis Paramètres.
- Pour restaurer : Paramètres → « Importer une sauvegarde ».
- Chaque module propose aussi un export **CSV** (séparateur `;`, UTF-8) lisible dans Excel.
- Le stockage du navigateur est limité (environ 5 Mo). À partir de 80 % d'utilisation, une bannière
  vous invite à exporter. Si l'enregistrement échoue faute de place, elle reste affichée et précise
  que les dernières modifications ne sont pas sauvegardées.
- Un import JSON vide, sans employeur valide ou illisible est refusé ; les entrées incomplètes sont
  ignorées au lieu de bloquer l'application.
- Chaque sauvegarde porte une **version de données** ; les anciennes sauvegardes sont migrées
  automatiquement à l'ouverture.
- **Sauvegardes automatiques** : l'application conserve les **5 dernières** copies locales, créées
  avant chaque import ou réinitialisation. Elles sont listées dans Paramètres → Sauvegarde et données,
  avec les boutons **Restaurer** et **Supprimer**. Si l'espace manque, le JSON de l'état précédent est
  téléchargé avant l'import.
- **Sauvegarde externe automatique** (Paramètres → Fiabilité) : copie JSON complète de toutes les
  données dans un dossier de votre choix, sans attendre un export manuel. Dans Chrome ou Edge,
  choisissez un dossier une fois ; il est mémorisé et le navigateur peut demander de confirmer l'accès
  à chaque nouvelle session (bouton **Autoriser ce dossier**). La sauvegarde peut être quotidienne,
  hebdomadaire ou déclenchée après chaque modification, avec un historique consultable.
  Le bouton **Sauvegarder maintenant** reste disponible même si la sauvegarde automatique est
  désactivée. Sans dossier choisi, l'option **Télécharger si aucun dossier** télécharge le fichier.
  Les copies du dossier plus anciennes que la **rétention choisie (7 jours par défaut)** sont
  supprimées après chaque sauvegarde ; mettez `0` pour ne jamais supprimer.
- **Contrôle au démarrage** : l'application relit les données locales, vérifie leur format, leur
  version et une empreinte d'intégrité. Si elles sont illisibles ou incohérentes, elle démarre sans
  les écraser, conserve une copie téléchargeable et propose les sauvegardes locales ou l'import d'un
  fichier JSON. Une donnée créée par une version plus récente n'est jamais écrasée silencieusement.
- **Notifications du navigateur** (Paramètres → Fiabilité) : rappel des échéances proches, des actions
  du journal arrivées à terme et des dépassements de seuil de solde ou d'ancienneté. Les catégories,
  le délai d'alerte et les heures de silence se règlent séparément. Le nombre d'échéances proches est
  aussi affiché entre parenthèses dans le titre de l'onglet.
- **Données en clair** : le registre est stocké sans chiffrement dans le navigateur. Toute personne
  utilisant la session Windows peut le consulter. Verrouillez la session et protégez le disque
  (mot de passe, chiffrement BitLocker). Pour un transfert, exportez un JSON et rangez-le dans un
  dossier protégé.
- La réinitialisation demande de saisir **EFFACER** et propose de télécharger une sauvegarde JSON
  avant d'effacer les données.
- Si un fichier du dossier `assets` est manquant, un message explicite s'affiche au lieu d'une page vide.
- « Réinitialiser » efface toutes les saisies et remet le registre initial des 71 employeurs.

## Version et tests

- Version affichée en bas de la barre latérale et dans Paramètres → Contenu de la base locale.
- L'historique des versions se trouve dans `CHANGELOG.md`.
- La page `tests.html` vérifie sans installation les données initiales, les dates, les calculs,
  les effectifs mensuels, le report pluriannuel, les thèmes (dont le mode sombre), le score de risque,
  le rapport d'une page du comité, la validation des imports, la migration, la lecture et l'écriture
  Excel, la planification et la rétention des sauvegardes, les filtres rapides du registre, la
  navigation clavier du suivi mensuel, les contacts, les statuts suggérés, la situation mensuelle,
  les échéanciers, la normalisation des noms, l'empreinte d'intégrité, l'export CSV et les séparateurs
  de milliers, ainsi que les heures de silence des notifications (38 contrôles).
  Ouvrez-la dans le navigateur : chaque test s'affiche en vert ou en rouge. Elle ne lit ni ne modifie
  vos données enregistrées.

## Limites

- Le suivi affiche une année civile à la fois ; les autres années restent enregistrées et accessibles.
- L'import du suivi mensuel accepte le **CSV** et les classeurs **Excel** (`.xlsx`, `.xls`) ; il ne reprend que les colonnes de suivi mensuel, pas un classeur comptable d'un autre format.
- Le report est calculé automatiquement, sans écriture comptable : l'application ne ventile pas un
  paiement entre plusieurs années. Saisissez le paiement dans l'année à laquelle il se rattache.
- Capacité confortable : une centaine d'employeurs et plusieurs milliers de lignes d'assurés.
- Les données restent sur le poste. Pour les partager ou changer d'ordinateur, utilisez
  l'export / import JSON.
- Application mono-utilisateur : pas de synchronisation entre plusieurs postes.
- La sauvegarde automatique et les notifications ne fonctionnent que lorsque l'application est
  ouverte dans le navigateur. Les navigateurs basés sur Chrome (Chrome, Edge) peuvent refuser les
  notifications lorsque la page est ouverte depuis un fichier local ; le titre de l'onglet continue
  alors d'indiquer le nombre d'échéances proches.
- Le choix d'un dossier de sauvegarde nécessite Chrome ou Edge. Les autres navigateurs peuvent
  utiliser le téléchargement automatique.

## Fichiers

- `index.html` : point d'entrée de l'application.
- `assets/styles.css` : mise en forme et adaptation mobile.
- `assets/data.js` : registre initial des 71 employeurs.
- `assets/core.js` : état, stockage local, contrôle d'intégrité, calculs, export / import.
- `assets/excel.js` : repérage des tableaux de suivi dans un classeur Excel.
- `assets/vendor/xlsx.full.min.js` : bibliothèque SheetJS 0.20.3 (lecture / écriture `.xlsx`).
- `assets/vendor/xlsx.LICENSE` : licence Apache 2.0 de SheetJS.
- `assets/riskScoring.js` : calcul du score de risque et de ses cinq facteurs.
- `assets/charts.js` : graphiques de tendance en SVG, sans dépendance externe.
- `assets/bulkMail.js` : sélection des employeurs et aperçu des courriers groupés.
- `assets/backup.js` : sauvegarde automatique dans un dossier et historique des copies.
- `assets/notifications.js` : rappels d'échéances, d'actions et de seuils.
- `assets/views.js` : rendu des différents modules.
- `assets/app.js` : navigation, formulaires et interactions.
- `tests.html` et `assets/tests.js` : contrôles automatiques à ouvrir dans le navigateur.
- `CHANGELOG.md` : historique des versions.
- `Ouvrir l'application.bat` : raccourci d'ouverture sous Windows.
