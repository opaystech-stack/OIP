# Rôle précis du Generator

Le **Generator** est le pilier OIP chargé de **créer une nouvelle application** à partir d'un Manifest validé.

---

## 1. Mission

Transformer un `opays.manifest.yaml` en une codebase complète, immédiatement compatible avec OIP Runtime.

---

## 2. Entrées

- `opays.manifest.yaml` validé.
- Options de génération (langage cible, stack, répertoire de sortie).

## 3. Sorties

- Codebase de l'application générée.
- Manifest copié dans le projet généré.
- README, configuration, CI/CD, Docker.

---

## 4. Ce que le Generator génère

### 4.1 Structure du projet

```text
my-app/
├── opays.manifest.yaml
├── README.md
├── package.json
├── tsconfig.json
├── .github/
│   └── workflows/
│       └── ci.yml
├── src/
│   ├── index.ts
│   ├── modules/
│   ├── services/
│   ├── plugins/
│   │   └── oip/
│   │       ├── capabilities/
│   │       ├── tools/
│   │       └── index.ts
│   ├── adapters/
│   └── config/
├── tests/
└── docker/
```

### 4.2 Backend

- Serveur HTTP minimal (ex. Fastify/Express pour Node.js).
- Routes de healthcheck.
- Point d'entrée pour exposer les capabilities à OIP.

### 4.3 Frontend (si demandé)

- Application minimaliste avec un chat OIP préconnecté.

### 4.4 Plugin OIP

- Capabilities définies dans le Manifest.
- Tool handlers stubés mais typés.
- Adaptateurs vides avec contrats.

### 4.5 Tests

- Tests unitaires pour chaque capability.
- Tests d'intégration avec OIP Runtime.

### 4.6 Documentation

- README expliquant comment démarrer.
- Guide de mapping capabilities ↔ services.

### 4.7 CI/CD et Docker

- Workflow de CI type-check + tests.
- Dockerfile de développement.

---

## 5. Ce que le Generator NE fait pas

- Il n'implémente pas la logique métier réelle.
- Il ne choisit pas l'architecture au cas par cas.
- Il ne dépend pas du Runtime.
- Il ne connaît pas de domaine métier particulier.

---

## 6. Principe de génération

Le Generator est un moteur de templates.

```text
Manifest
  ↓
Sélection du template de projet
  ↓
Rendu des fichiers (capabilities, adapters, routes, config)
  ↓
Application de conventions OIP
  ↓
Codebase générée
```

---

## 7. Personnalisation

Toute personnalisation métier appartient aux plugins de l'application générée.
Le Generator produit uniquement la structure standard et les contrats.

---

## 8. Références

- `docs/adr/adr-007-generator.md`
- `docs/oip-generator-from-manifest.md`
- `docs/oip-integration-manifest-spec.md`
- `docs/opays.manifest.schema.json`
