# Journal des versions

## 1.5.0 — 21 novembre 2026

### Accès protégé

- Écran de connexion au démarrage : l'interface et les données restent masquées tant que l'identifiant et le mot de passe ne sont pas reconnus.
- Session conservée jusqu'à la fermeture de l'onglet ; bouton **Verrouiller** dans la barre supérieure pour fermer l'accès immédiatement.
- Mot de passe stocké sous forme d'empreinte dans `assets/auth.js`, jamais en clair ni transmis sur le réseau.
- L'écran s'adapte aux quatre thèmes et reste absent à l'impression.

### Tests

- Un contrôle supplémentaire (38 au total) sur le refus des identifiants erronés et la normalisation de l'identifiant.

## 1.4.8 — 21 novembre 2026

### Valeur indiciaire

- La valeur indiciaire est utilisée strictement telle que saisie, sans arrondi : **1 272,7** reste 1 272,7 et n'est jamais remplacée par 1 273 dans le calcul du salaire.
- Les textes d'aide affichent la valeur exacte avec sa décimale (« 1 272,7 ») au lieu de l'arrondi « 1 273 ».
- Le champ **Valeur indiciaire** des Paramètres accepte la virgule et affiche la valeur exacte (ex. `1 272,7`) ; la valeur est conservée à l'import et à l'export.

### Tests

- Un contrôle supplémentaire (37 au total) : calcul avec 1 272,7 (indice 100 → salaire 10 606), comparaison avec 1 273, conservation de la décimale à l'import et affichage exact.

## 1.4.7 — 21 novembre 2026

### Saisie des montants

- Séparateurs de milliers automatiques dans le suivi mensuel (dû global, encaissé), les échéanciers (montant prévu, montant payé) et le seuil de solde des notifications.
- Les espaces sont insérés pendant la frappe sans déplacer le curseur ; les données restent enregistrées sans séparateur.
- Le collage d'un montant déjà formaté est repris ; la partie décimale éventuelle est ignorée (montants entiers en FCFA).

### Tests

- Un contrôle supplémentaire (36 au total) sur le formatage et la relecture des montants formatés.

## 1.4.6 — 21 novembre 2026

### Tests

- Cinq contrôles supplémentaires (35 au total) sur les règles peu couvertes : statuts suggérés, situation mensuelle, échéanciers (reste dû, retard, jours de retard), normalisation des raisons sociales, empreinte d'intégrité et échappement de l'export CSV.
- Aucun changement de comportement de l'application.

## 1.4.5 — 21 novembre 2026

### Contacts des employeurs

- Le champ **Contact** est analysé automatiquement : téléphones, adresses e-mail et nom de l'interlocuteur sont séparés, y compris lorsqu'ils sont collés (`70651653sseqcu.togo@gmail.com`) ou saisis avec plusieurs numéros (`90327777/96193939 MUSTAPHA`).
- Dans la fiche employeur, chaque numéro devient un lien **Appeler** (`tel:`) et chaque adresse un lien **Écrire** (`mailto:`) ; les boutons **Appeler** et **E-mail** apparaissent en bas de la fiche lorsqu'ils sont disponibles.
- Un numéro togolais à 8 chiffres reçoit l'indicatif **+228** ; les numéros internationaux (`+`, `00`) sont conservés.
- Le contrôle **Qualité des données → contacts sans e-mail** utilise la même reconnaissance.
- À l'impression, les contacts restent en texte simple.

### Tests

- Un contrôle supplémentaire (30 au total) sur l'extraction des téléphones et e-mails, les liens `tel:` / `mailto:` et les formats réels du registre.

## 1.4.4 — 21 novembre 2026

### Mode sombre

- Quatrième thème **Sombre** : fond bleu nuit, texte clair, accents bleus. Il s'ajoute à Bleu et blanc, Gris et jaune et Rouge et gris.
- Le choix reste mémorisé dans le navigateur et s'applique immédiatement à l'ensemble de l'interface, graphiques compris.
- À l'impression, le thème sombre repasse automatiquement en noir sur blanc pour rester lisible et économe en encre.

### Rapport pour le comité

- Nouveau bouton **Rapport 1 page** en haut du tableau de bord : il produit une synthèse A4 portrait prête à imprimer ou à enregistrer en PDF.
- Le rapport reprend les indicateurs de l'année (employeurs suivis, dû, encaissé, solde restant, taux de recouvrement), les cinq soldes impayés les plus élevés, les dossiers critiques et les points de vigilance (échéances, actions en retard, actions à venir).
- La date d'arrêté et la date d'édition figurent en tête du document ; les chiffres restent ceux de l'année affichée.

### Tests

- Un contrôle supplémentaire (29 au total) sur les totaux, le classement des soldes et les dossiers critiques du rapport, et sur l'acceptation du thème sombre.

## 1.4.3 — 21 novembre 2026

### Navigation clavier du suivi mensuel

- **Entrée** ou **↓** passe à la ligne suivante dans la même colonne ; **↑** ou **Maj+Entrée** à la ligne précédente.
- **←→** passent à la colonne précédente ou suivante, avec retour à la ligne au bord ; **Tab** reste la navigation horizontale native.
- Les cellules désactivées (dû remplacé par le détail des assurés) sont sautées.
- Si une valeur est en cours de correction, **←→** déplacent le curseur du nombre au lieu de changer de cellule ; **Entrée**, **↑↓** et **Échap** quittent la cellule.
- Un rappel des raccourcis est affiché au-dessus du tableau du suivi mensuel.

### Tests

- Un contrôle supplémentaire (28 au total) sur les déplacements, les bords de grille et les cellules désactivées.

## 1.4.2 — 21 novembre 2026

### Filtres rapides du registre

- Quatre filtres cumulables dans **Employeurs** : **Débiteurs uniquement**, **Score critique**, **Sans action depuis 30 j** et **En retard d'échéancier**, avec le nombre d'employeurs concernés sur chaque bouton.
- Les filtres se combinent avec la recherche et le filtre de statut ; **Tout effacer** les retire d'un clic.
- Les boutons se mettent à jour pendant la recherche ; l'export CSV et l'impression reprennent la liste filtrée.

### Tests

- Un contrôle supplémentaire (27 au total) sur les quatre filtres rapides.

## 1.4.1 — 21 novembre 2026

### Fiabilité

- **Contrôle d'intégrité au démarrage** : relecture des données locales, vérification de la version et d'une empreinte enregistrée à chaque sauvegarde. Les données illisibles ou incohérentes ne sont plus remplacées en silence : une copie est conservée et téléchargeable, et l'application propose les sauvegardes locales ou l'import d'un fichier JSON.
- Les données enregistrées par une version plus récente de l'application ne sont pas chargées ni écrasées.
- **Rétention des sauvegardes externes en jours** : les copies du dossier plus anciennes que la durée choisie (7 jours par défaut) sont supprimées après chaque sauvegarde ; `0` désactive la suppression. L'historique est nettoyé en conséquence.
- **Mois invalides** : `normalizeMonth` ne renvoie plus silencieusement « 2026-01 ». Un mois vide ou hors plage est refusé, et les clés de mois invalides d'une sauvegarde sont ignorées au lieu d'être déplacées vers janvier.

### Excel

- **Import direct des classeurs Excel** (`.xlsx`, `.xls`) dans le suivi mensuel, avec SheetJS intégré localement (aucune connexion). Le tableau est recherché dans toutes les feuilles, même si les en-têtes ne sont pas sur la première ligne ; les cellules de date sont reconnues.
- **Export du classeur Excel** : feuilles Employeurs, Suivi mensuel, Assurés, Journal, Échéanciers et Paramètres, avec la mise en forme d'origine pour les colonnes connues.
- La feuille Suivi mensuel exportée reprend les colonnes attendues par l'import, ce qui permet un aller-retour Excel.

### Report antérieur

- En janvier, un rappel indique que le solde de l'année précédente est déjà reporté automatiquement.
- Si le dû saisi pour janvier est égal au solde antérieur, une alerte signale un risque de double comptage, avec la liste des employeurs concernés.

### Tests

- Six contrôles supplémentaires (26 au total) : mois invalides, report pluriannuel avec paiement partiel, rétention en jours, colonnes Excel, en-tête décalé et aller-retour d'un classeur.

## 1.4.0 — 19 novembre 2026

### Fiabilité

- **Sauvegarde externe automatique** : copie JSON complète dans un dossier choisi (Chrome / Edge), à heure fixe (quotidienne ou hebdomadaire) ou après chaque modification.
- Le dossier est mémorisé ; le navigateur peut demander de confirmer à nouveau l'accès à chaque session, avec un bouton **Autoriser ce dossier**.
- Solution de repli par téléchargement pour les navigateurs sans accès aux dossiers, et bouton **Sauvegarder maintenant** toujours disponible.
- Historique des sauvegardes externes (date, fichier, taille, déclencheur), conservé selon la limite choisie.
- **Notifications du navigateur** : échéances proches, actions du journal arrivées à terme, dépassement d'un seuil de solde ou d'ancienneté. Catégories activables séparément, choix du délai d'alerte et heures de silence.
- Le nombre d'échéances proches apparaît dans le titre de l'onglet.
- Limite expliquée dans l'application : Chrome et Edge peuvent refuser les notifications quand la page est ouverte depuis un fichier local.
- Deux contrôles automatiques supplémentaires (20 tests au total).

## 1.3.1 — 19 novembre 2026

### Barre latérale repliable

- Le bouton menu de la barre supérieure est désormais visible sur ordinateur : il réduit la barre latérale à ses icônes pour élargir la zone de travail, et la déploie à nouveau.
- Le choix est mémorisé dans le navigateur et appliqué dès l'ouverture.
- Sur petit écran, le bouton ouvre et ferme toujours le menu coulissant.
- Les liens du menu réduit conservent un libellé vocal et une info-bulle.

## 1.3.0 — 19 novembre 2026

### Score de risque

- Score sur 100 calculé pour chaque dossier débiteur : ancienneté (25 %), régularité des paiements (25 %), respect des échéanciers (20 %), tendance du solde (15 %) et taux de recouvrement (15 %).
- Quatre niveaux : Faible, Modéré, Élevé, Critique. Les dossiers soldés sont exclus du risque.
- Bloc **Vigilance** sur le tableau de bord avec répartition et cinq dossiers prioritaires.
- Colonne **Risque** dans le registre et tri **Risque décroissant**.
- Panneau détaillé dans la fiche employeur, avec le score de chaque facteur.

### Graphiques de tendance

- **Solde cumulé** à la fin de chaque mois, report antérieur inclus.
- **Taux de recouvrement mensuel** avec repère à 80 %.
- **Principaux soldes impayés** (huit premiers).
- Graphiques SVG autonomes, sans connexion ni bibliothèque externe, adaptés au thème et imprimables.

### Courriers groupés

- Cases de sélection dans le registre, désactivées pour les dossiers soldés.
- Sélection rapide des débiteurs, des dossiers critiques ou remise à zéro.
- Aperçu de plusieurs courriers avant impression, un par page, avec choix du type.
- Nouveau modèle **Rappel simple**, en plus de la relance amiable et de la mise en demeure.

### Tests

- Trois contrôles supplémentaires sur les niveaux, le calcul pondéré et la répartition du risque (18 tests au total).

## 1.2.0 — 9 novembre 2026

### Effectifs mensuels

- Colonne **Effectif** modifiable pour chaque employeur et chaque mois, avec retour automatique à l'effectif de référence de la fiche lorsque la cellule est effacée.
- Effectif **0** accepté pour signaler une absence de salarié sur un mois.
- Synthèse 12 mois : colonne **Effectif moyen** par employeur, ligne **Effectif total** mois par mois et effectif total moyen de l'année.
- Totaux d'effectif dans la saisie mensuelle et dans les exports CSV.
- Import CSV : colonne **Effectif** optionnelle, sans écraser les autres valeurs du mois.
- Conservation des effectifs mensuels dans les sauvegardes JSON et lors des imports.

### Apparence

- Bouton **Thème** dans la barre supérieure avec trois présentations : **Bleu et blanc**, **Gris et jaune**, **Rouge et gris**.
- Choix mémorisé sur le poste, appliqué dès l'ouverture de l'application.

### Tests

- Nouveaux contrôles automatiques sur les effectifs mensuels, l'effectif moyen et les thèmes.

## 1.1.0 — 9 novembre 2026

### Fiabilité et données

- Validation du schéma des fichiers JSON importés (employeurs, suivi mensuel, paramètres) avec messages explicites.
- Version de données (`dataVersion`) et migration automatique des anciennes sauvegardes.
- Sauvegardes automatiques locales : les 5 dernières copies créées avant un import, une réinitialisation ou une restauration sont conservées et peuvent être restaurées depuis les Paramètres.
- Téléchargement automatique de l'état précédent si une sauvegarde locale ne peut pas être enregistrée.
- Réinitialisation protégée par la saisie de « EFFACER », avec export JSON proposé.
- Détection du quota de stockage : alerte à 80 % et bannière persistante si l'enregistrement échoue.

### Ergonomie

- Colonne **Effectif** ajoutée dans le tableau de saisie du suivi mensuel.
- Recherche différée (250 ms) et rafraîchissement limité aux lignes concernées.
- Affichage progressif du détail des assurés par tranches de 500 lignes, avec totaux calculés sur toutes les lignes filtrées.
- Fil d'Ariane dans la fiche employeur et libellés vocaux enrichis sur les champs de recherche et les montants mensuels.
- Raccourcis clavier : Ctrl+K (recherche), Ctrl+S (export JSON), G puis D / G puis E (navigation).
- Impression isolée de la fiche et des courriers, paysage pour les tableaux mensuels.

### Qualité et transparence

- Notice sur le stockage en clair et les précautions à prendre.
- Version visible dans la barre latérale et dans les Paramètres.
- Page `tests.html` de contrôles autonomes.
- Message explicite si un fichier de l'application est manquant au démarrage.

## 1.0.0 — version initiale

- Reprise du classeur des 71 employeurs.
- Suivi mensuel, situation, assurés, journal, échéanciers.
- Suivi pluriannuel avec report automatique du solde antérieur.
- Import / export CSV et JSON, impression et courriers de recouvrement.
