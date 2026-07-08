# Contrats publics entre Discovery, Generator et Runtime

Ce document précise les contrats publics qui assurent le découplage total entre les trois piliers d'OIP.

---

## 1. Principe

Les trois piliers ne communiquent **jamais directement** entre eux. Ils échangent uniquement via des contrats publics :

- **Manifest** : contrat central.
- **Interfaces TypeScript** : contrats de programmation.
- **Messages d'erreur standardisés** : contrats opérationnels.

---

## 2. Contrat central : le Manifest

### Propriétaire

L'application propriétaire du Manifest.

### Format

YAML par défaut, JSON alternative.

### Schéma

`docs/opays.manifest.schema.json`.

### Versionnement

`manifestVersion` en SemVer.

---

## 3. Interfaces publiques TypeScript

### 3.1 Discovery

```typescript
export interface Discovery {
  analyse(source: ApplicationSource): Promise<DiscoveryResult>;
}

export interface ApplicationSource {
  path: string;
  language?: string;
  exclude?: string[];
}

export interface DiscoveryResult {
  proposedManifest: Manifest;
  report: AnalysisReport;
  diff?: ManifestDiff;
}

export interface AnalysisReport {
  summary: string;
  modules: ModuleAnalysis[];
  services: ServiceAnalysis[];
  aiEntrypoints: AiEntrypointAnalysis[];
  legacyComponents: LegacyComponentAnalysis[];
  capabilities: CapabilityCandidate[];
  adapters: AdapterCandidate[];
  risks: RiskItem[];
  techDebt: DebtItem[];
}

export interface ManifestDiff {
  added: DiffItem[];
  removed: DiffItem[];
  updated: DiffItem[];
  protectedSections: string[];
  confidence: "high" | "medium" | "low";
}
```

### 3.2 Generator

```typescript
export interface Generator {
  generate(manifest: Manifest, options: GenerateOptions): Promise<GeneratedProject>;
}

export interface GenerateOptions {
  targetLanguage: "typescript" | "python";
  includeFrontend: boolean;
  includeDocker: boolean;
  outputPath: string;
}

export interface GeneratedProject {
  path: string;
  files: GeneratedFile[];
  manifest: Manifest;
}

export interface GeneratedFile {
  path: string;
  content: string;
  template: string;
}
```

### 3.3 Runtime

```typescript
export interface Runtime {
  loadManifest(manifest: Manifest): Promise<RuntimeConfig>;
  validateManifest(manifest: Manifest): ValidationResult;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  code: string;
  message: string;
  context?: string;
  suggestion?: string;
}
```

---

## 4. Messages d'erreur standardisés

Format obligatoire :

```text
[OIP-{PILLAR}-{CODE}] {message}
  context: {chemin ou valeur}
  suggestion: {action corrective}
```

Exemples :

```text
[OIP-MANIFEST-SCHEMA_REQUIRED_FIELD_MISSING] manifestVersion is required
  context: root
  suggestion: Add a SemVer version at the root of the Manifest.

[OIP-DISCOVERY-READ_ERROR] Unable to read repository
  context: /path/to/app
  suggestion: Verify the path and permissions.

[OIP-GENERATOR-TEMPLATE_NOT_FOUND] No template for targetLanguage "python"
  context: targetLanguage
  suggestion: Use a supported target language or add a custom template.
```

---

## 5. Règles de découplage

| Pilier | Peut utiliser | Ne peut jamais utiliser |
|---|---|---|
| Discovery | manifest package, analyseurs | runtime, generator |
| Generator | manifest package, templates | runtime, discovery |
| Runtime | manifest package, core | discovery, generator |

---

## 6. Évolution des contrats

- Les interfaces publiques évoluent par versions majeures.
- Le schéma du Manifest est versionné indépendamment.
- Toute rupture de compatibilité nécessite un ADR et un RFC.

---

## 7. Références

- `docs/rfc/rfc-001-discovery-generator-runtime-contracts.md`
- `docs/oip-integration-manifest-spec.md`
- `docs/opays.manifest.schema.json`
- `docs/oip-target-package-structure.md`
