# RFC-001 : Contrats publics entre Discovery, Generator et Runtime

Statut : Proposed  
Date : 2026-07-08  
Auteur : OIP Architecture Team

---

## 1. Objectif

Définir les contrats publics qui permettent aux trois piliers d'OIP — Discovery, Generator et Runtime — de communiquer sans dépendance directe.

## 2. Contrat central : le Manifest

Le **Manifest** (`opays.manifest.yaml`) est le seul contrat partagé.

- Format : YAML par défaut, JSON accepté.
- Schéma : `docs/opays.manifest.schema.json`.
- Versionnement : SemVer via `manifestVersion`.
- Propriétaire : l'application, jamais OIP.

## 3. Interfaces publiques

### 3.1 Discovery

```text
interface Discovery {
  analyse(input: ApplicationSource): Promise<DiscoveryResult>
}

interface DiscoveryResult {
  proposedManifest: Manifest
  report: AnalysisReport
  diff?: ManifestDiff
}
```

### 3.2 Generator

```text
interface Generator {
  generate(input: Manifest): Promise<GeneratedProject>
}

interface GeneratedProject {
  path: string
  files: GeneratedFile[]
  manifest: Manifest
}
```

### 3.3 Runtime

```text
interface Runtime {
  loadManifest(manifest: Manifest): Promise<RuntimeConfig>
  validateManifest(manifest: Manifest): ValidationResult
}
```

## 4. Contrats de données

### 4.1 Manifest

Déjà spécifié dans `docs/oip-integration-manifest-spec.md` et schématisé dans `docs/opays.manifest.schema.json`.

### 4.2 DiscoveryReport

Rapport d'analyse produit par le Discovery. Contient :

- résumé architectural ;
- modules détectés ;
- services et routes identifiés ;
- points d'entrée IA ;
- composants legacy ;
- capabilities candidates ;
- adaptateurs nécessaires ;
- risques et dette technique ;
- écarts avec un Manifest existant.

### 4.3 ManifestDiff

Diff proposé quand un Manifest existe déjà.

```yaml
diff:
  added: []
  removed: []
  updated: []
  manualSectionsProtected: []
  confidence: high | medium | low
```

### 4.4 GeneratedProject

Structure d'un projet généré.

```yaml
generatedProject:
  path: ./generated/opays-hq
  files:
    - path: package.json
      template: nodejs-backend
    - path: src/plugins/customer/index.ts
      template: oip-plugin
  manifest:
    path: opays.manifest.yaml
```

## 5. Règles de stabilité

- Les interfaces publiques évoluent par versions majeures.
- Le schéma du Manifest est versionné indépendamment des piliers.
- Tout changement incompatible nécessite un ADR.

## 6. Sécurité

- Le Discovery n'écrit jamais dans l'application analysée.
- Le Generator écrit uniquement dans un répertoire de sortie dédié.
- Le Runtime ne lit le Manifest qu'en lecture seule.

## 7. Prochaines étapes

- Valider ce RFC.
- Transformer les interfaces en types TypeScript dans `@opaystech/oip/discovery` et `@opaystech/oip/generator`.
- Implémenter les premiers modules de Discovery et Generator.

---

## Références

- `docs/oip-three-pillars-architecture.md`
- `docs/oip-integration-manifest-spec.md`
- `docs/opays.manifest.schema.json`
- `docs/adr/adr-006-oip-three-pillars.md`
