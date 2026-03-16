# Product Hub

Application SaaS de catalogue de produits pour consulter et télécharger les fiches techniques (PDF) individuellement ou en bulk.

## Stack

- React 19 + Vite + TypeScript
- Tailwind CSS
- Zustand (panier)
- Lucide React (icônes)
- JSZip + file-saver (téléchargement bulk)

## Installation

```bash
npm install
```

## Conversion des données CSV

Le fichier `products.json` est généré à partir du CSV Oxatis :

```bash
npm run convert-csv
```

Passer le chemin du CSV en argument si nécessaire :

```bash
node scripts/convert-csv-to-json.js "chemin/vers/fichier.csv"
```

## Configuration

Créer un fichier `.env` à partir de `.env.example` :

- **VITE_PRODUCT_BASE_URL** : URL de votre site pour les liens "Voir le produit" (ex: `https://www.monsite.com`). Si vide, utilise xeilom.fr.
- **VITE_API_BASE_URL** : Laisser vide en production (même origine).

## Développement

```bash
npm run dev
```

Pour tester le téléchargement bulk (ZIP) en local, utiliser `vercel dev` à la place — les API routes (proxy PDF) ne fonctionnent qu’avec Vercel.

## Build

```bash
npm run build
```

## Déploiement Vercel

1. Pousser le projet sur GitHub
2. Connecter le dépôt à Vercel
3. Le build et le déploiement sont automatiques (voir `vercel.json`)

## Fonctionnalités

- Grille de produits avec recherche et filtre par catégorie
- Sélection multiple pour téléchargement bulk (ZIP)
- Téléchargement individuel des fiches
- Mode clair/sombre
