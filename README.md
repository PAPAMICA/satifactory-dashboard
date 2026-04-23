# Satisfactory Dashboard

Tableau de bord web pour [Ficsit Remote Monitoring](https://github.com/porisius/FicsitRemoteMonitoring) : électricité, inventaire agrégé, favoris, disposition modulaire, paramètres FRM et gestion d’utilisateurs (HTTP Basic + SQLite).

## Prérequis côté jeu

1. Mod FRM installé, commande chat : `/frmweb start`
2. Jeton dans `Configs/FicsitRemoteMonitoring/WebServer.cfg` (`Authentication_Token`)

## Développement local

Nécessite **Node.js ≥ 22.5** (module expérimental `node:sqlite`). Les scripts API définissent déjà `NODE_OPTIONS=--experimental-sqlite`.

```bash
npm install
npm run dev
```

- API : [http://127.0.0.1:3001](http://127.0.0.1:3001)  
- Interface : [http://127.0.0.1:5173](http://127.0.0.1:5173) (proxy `/api` → 3001)

### Port 3001 déjà utilisé (`EADDRINUSE`)

Une ancienne instance de l’API peut encore tourner. Libérer le port :

```bash
lsof -iTCP:3001 -sTCP:LISTEN
kill <PID>
```

Ou en une ligne : `kill $(lsof -t -iTCP:3001 -sTCP:LISTEN)`.

Première visite : écran de **configuration initiale** (un seul compte admin) si la base est vide. Sinon : connexion Basic.

Variables optionnelles au **premier** démarrage API (base vide) :

- `INIT_ADMIN_USERNAME`
- `INIT_ADMIN_PASSWORD`

## Docker

```bash
docker compose up --build -d
```

Application : [http://localhost:3000](http://localhost:3000) (API + SPA). Données SQLite dans le volume `satifactory-data` (`DATA_DIR=/data`).

### Traefik

Déployez derrière Traefik (HTTPS, secrets). Indiquez l’URL publique dans les paramètres FRM seulement si le navigateur doit y accéder autrement ; en général l’API du jeu est joignable depuis le conteneur (réseau Docker ou IP LAN).

## API FRM

Le backend relaie les chemins documentés, ex. `GET /api/frm/getPower`, avec l’en-tête `X-FRM-Authorization`. L’URL de base et le jeton sont stockés en base (admin uniquement pour les modifier).

## Inventaire : noms et icônes locaux

Les libellés sont dans [`apps/web/src/traductions/`](apps/web/src/traductions/) (`en/items.json`, `fr/items.json`, clés = `ClassName` FRM). Les PNG sont dans [`apps/web/src/img/items/`](apps/web/src/img/items/) (`<ClassName>.png`).

## Documentation locale

Voir le dossier [`doc-api/`](doc-api/).

## Licence & tiers

Voir [`THIRD_PARTY.md`](THIRD_PARTY.md).
