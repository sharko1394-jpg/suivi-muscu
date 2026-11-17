# Suivi Muscu

Appli personnelle de suivi de musculation. Elle s'installe sur le téléphone, fonctionne sans
réseau, et garde toutes les données sur le téléphone : aucun compte, aucun serveur.

**Adresse de l'appli : https://sharko1394-jpg.github.io/suivi-muscu/**

> Cette adresse ne doit jamais changer. Les données du téléphone sont attachées à elle : si le
> compte GitHub ou le projet était renommé, l'appli repartirait de zéro à la nouvelle adresse
> (il faudrait alors restaurer une sauvegarde).

## Installer l'appli sur le téléphone

### iPhone

1. Ouvre l'adresse ci-dessus dans **Safari** (pas dans une autre appli).
2. Touche le bouton **Partager** (le carré avec une flèche vers le haut).
3. Choisis **« Sur l'écran d'accueil »**, puis **« Ajouter »**.
4. Ferme Safari et lance l'appli par son icône **Muscu**.

À partir de là, passe toujours par l'icône. L'appli installée et Safari ne partagent pas leurs
données : ce que tu saisis dans l'une n'apparaît pas dans l'autre.

### Android

1. Ouvre l'adresse dans **Chrome**.
2. Ouvre le menu (les trois points), puis **« Installer l'application »** ou
   **« Ajouter à l'écran d'accueil »**.

### Une fois installée

- L'appli fonctionne **sans réseau**, y compris en mode avion.
- Chaque saisie est enregistrée tout de suite. Si l'appli se ferme en pleine séance, tu la
  retrouves au même endroit en la rouvrant.
- Dans **Réglages → Mes données**, la ligne « Protection contre l'effacement automatique » doit
  indiquer « Activée ». Si ce n'est pas le cas, touche « Redemander ».

## Personnaliser l'appli

Tout se règle dans **Réglages → Personnaliser l'appli**, et s'applique tout de suite :

- **Thèmes** : touche un thème pour l'essayer. « Défaut » remet l'apparence d'origine.
  « Enregistrer » garde ta création dans « Mes thèmes ».
- **Couleur principale**, **fond** (animé, uni, dégradé ou **ta propre photo**), **cartes**
  (opacité, flou, coins), **texte** (police, taille) et **animations**.
- **Onglets** : glisse les lignes par leur poignée pour changer l'ordre, masque ceux qui ne te
  servent pas, touche un nom pour le changer, et choisis l'onglet qui s'ouvre au lancement.
- **Accueil** : ajoute, retire, déplace des widgets et choisis leur taille (petit ou grand).
  Le bouton en haut à droite de l'écran « Aujourd'hui » y mène directement.
- **Partager** : « Exporter » crée un fichier avec toute ta personnalisation (et ta photo de fond),
  à garder ou à envoyer ; « Importer » l'applique sur un autre téléphone.

Les photos de fond restent sur le téléphone et partent dans tes sauvegardes.

## Mettre à jour l'appli

Les mises à jour ne touchent jamais aux données : elles ne remplacent que l'appli elle-même.

1. Ouvre l'appli avec du réseau.
2. Un bandeau **« Mise à jour disponible »** apparaît en bas de l'écran. Touche
   **« Mettre à jour »** : l'appli se recharge dans sa nouvelle version.
3. Si le bandeau ne vient pas, va dans **Réglages → À propos** et touche
   **« Rechercher une mise à jour »**. Tu peux aussi fermer complètement l'appli et la rouvrir.

Le numéro de version se lit dans **Réglages → À propos**.

Tu peux ignorer le bandeau en pleine séance et mettre à jour plus tard : rien ne presse.

## Sauvegarder ses données

Les données vivent uniquement sur le téléphone. La sauvegarde est donc la seule protection en
cas de perte, de casse ou de changement de téléphone.

1. Va dans **Réglages → Sauvegarde**.
2. Touche **« Sauvegarder mes données »**.
3. Choisis **« Enregistrer dans Fichiers »** (de préférence dans iCloud Drive), ou envoie-toi le
   fichier par e-mail.

Le fichier s'appelle `suivi-muscu-AAAA-MM-JJ-HHMM.json` et contient tout : programmes, séances,
exercices personnels, pesées et réglages. Range-le **ailleurs que sur le téléphone**.

L'appli te le rappelle discrètement quand ta dernière sauvegarde date de plus de 14 jours.

### Exporter l'historique en tableau

**Réglages → « Exporter l'historique (CSV) »** produit un tableau de toutes tes séries, à ouvrir
dans Excel ou Numbers. C'est pratique pour faire ses propres calculs, mais ce fichier **ne
remplace pas la sauvegarde** : il ne peut pas être réimporté.

## Restaurer ses données

À faire sur un nouveau téléphone, ou après avoir réinstallé l'appli.

1. Installe l'appli (voir plus haut).
2. Va dans **Réglages → Sauvegarde**, puis **« Restaurer une sauvegarde »**.
3. Choisis ton fichier de sauvegarde.
4. L'appli affiche ce que contient le fichier et ce qui est sur le téléphone. Vérifie, puis
   touche **« Remplacer mes données »**.

À savoir :

- La restauration **remplace tout** ce qui est sur le téléphone par le contenu du fichier. Elle
  ne fusionne pas.
- Un fichier abîmé ou qui ne vient pas de cette appli est refusé, et tes données en place ne
  sont pas modifiées.
- Une ancienne sauvegarde reste utilisable avec une version plus récente de l'appli : elle est
  convertie automatiquement.

## Ce qui efface les données

- **Supprimer l'icône de l'écran d'accueil** efface les données de l'appli. Fais une sauvegarde
  avant.
- **Effacer les données de sites** dans les réglages du navigateur fait de même.

Une mise à jour de l'appli, un redémarrage du téléphone ou une coupure de réseau n'effacent rien.

## Limites connues sur iPhone

- **Pas de vibration** à la fin du repos : Apple ne l'autorise pas aux applis web.
- **Le son de fin de repos** ne sort pas si le téléphone est en mode silencieux. Le minuteur
  passe alors en vert.
- **Le minuteur ne sonne que si l'appli est à l'écran.** Pendant une séance, l'appli garde
  l'écran allumé. Si tu verrouilles le téléphone ou changes d'appli, le décompte reste juste à
  ton retour, mais sans son.

## Pour modifier l'appli

Cette partie s'adresse à la personne (ou à l'assistant) qui modifie le code.

L'appli est écrite avec Vite, React, TypeScript, Tailwind CSS, Dexie (IndexedDB), Recharts et
vite-plugin-pwa. Il faut Node.js et Git.

| Commande | Effet |
|---|---|
| `npm install` | installe les outils du projet |
| `npm run dev` | lance l'appli en développement |
| `npm test` | lance les tests automatiques |
| `npm run build` | vérifie le code et fabrique l'appli dans `dist/` |

Mise en ligne : tout envoi sur la branche `main` lance les tests, puis publie le site sur GitHub
Pages. Si un test échoue, rien n'est publié et la version précédente reste en place.

Les règles à respecter pour ne jamais perdre de données sont dans `CLAUDE.md`, et le cahier des
charges d'origine dans `docs/cahier-des-charges.md`.
