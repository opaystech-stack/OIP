# Opays Intelligence Platform — Contrat des Capabilities

> Version: 1.0.0  
> Statut: Validé — socle architectural  
> Date: Juillet 2026

Ce document définit le contrat public unique et obligatoire de toute capability dans OIP. Tout plugin, tout produit Opays, tout module métier doit respecter ce contrat sans exception.

---

## 1. Définition d'une Capability

Une **Capability** est l'unité d'action métier déclarée par un plugin. Elle représente une opération que l'utilisateur peut demander en langage naturel, et que le moteur OIP peut planifier, valider et exécuter.

**Exemples :**
- `commerce.inventory.add`
- `commerce.sales.create`
- `hr.employee.create`
- `legal.case.create`
- `real-estate.property.register`

---

## 2. Contrat public d'une Capability

### 2.1 Structure obligatoire

```ts
interface Capability {
  // Identité
  readonly id: string;                          // identifiant unique (plugin.domain.action)
  readonly pluginId: string;                    // plugin propriétaire
  readonly workspaceId?: string;                // si capability dédiée à un workspace
  readonly version: string;                      // semver

  // Description
  readonly description: string;                 // description lisible par LLM et humain
  readonly examples: string[];                  // exemples d'expressions naturelles

  // Paramètres
  readonly parameters: CapabilityParameter[];  // paramètres d'entrée

  // Gouvernance
  readonly requiredRoles: string[];             // rôles minimums
  readonly requiredPermissions: string[];       // permissions fines (optionnel)
  readonly policies: string[];                   // ids des policies à évaluer
  readonly confirmationLevel: ConfirmationLevel; // niveau de confirmation requis

  // Exécution
  readonly sideEffects: string[];               // effets secondaires attendus
  readonly emits: string[];                      // types d'événements produits
  readonly idempotencyKey?: string;              // clé d'idempotence (optionnel)

  // Résultat
  readonly resultSchema: JsonSchema;            // schéma du résultat
  readonly errorCodes: CapabilityErrorCode[];    // codes d'erreur possibles
}

interface CapabilityParameter {
  readonly name: string;
  readonly type: CapabilityParameterType;
  readonly required: boolean;
  readonly description: string;
  readonly defaultValue?: JsonValue;
  readonly constraints?: ParameterConstraint[];
  readonly examples?: JsonValue[];
}

type CapabilityParameterType =
  | "string"
  | "number"
  | "boolean"
  | "integer"
  | "object"
  | "array"
  | "date"
  | "datetime"
  | "currency"
  | "file"
  | "reference";       // référence à une entité métier existante

type ConfirmationLevel =
  | "none"
  | "low"       // confirmation implicite dans le contexte
  | "medium"    // confirmation explicite recommandée
  | "high"      // confirmation explicite obligatoire
  | "critical"; // confirmation multi-niveaux ou validation humaine

interface CapabilityErrorCode {
  readonly code: string;
  readonly message: string;
  readonly severity: "warning" | "error" | "critical";
  readonly recoverable: boolean;
}
```

---

## 3. Conventions de nommage

### 3.1 Identifiant unique

Format : `<pluginId>.<domain>.<action>`

- `commerce.inventory.add`
- `commerce.sales.create`
- `hr.employee.create`
- `legal.contract.sign`

### 3.2 Règles

- En minuscules.
- Mots séparés par des points.
- Pas de tirets, pas d'espaces.
- Le pluginId est le namespace.
- Le domaine regroupe les capabilities par fonction métier.
- L'action est un verbe au singulier.

### 3.3 Verbes d'action recommandés

| Verbe | Usage |
|-------|-------|
| `create` | Créer une entité |
| `update` | Modifier une entité existante |
| `delete` | Supprimer une entité |
| `add` | Ajouter à une collection ou un stock |
| `remove` | Retirer d'une collection |
| `adjust` | Modifier une valeur (ajustement) |
| `cancel` | Annuler une action ou transaction |
| `validate` | Valider sans modifier d'état |
| `search` | Rechercher sans modification |
| `generate` | Produire un rapport, document, sortie |
| `record` | Enregistrer un événement métier |
| `confirm` | Confirmer une action en attente |

---

## 4. ToolHandler

Chaque capability doit être associée à un et un seul `ToolHandler` dans son plugin.

```ts
interface ToolHandler {
  execute(args: JsonObject, context: ExecutionContext): Promise<ActionResult>;
}

interface ActionResult {
  readonly capabilityId: string;
  readonly status: "completed" | "rejected" | "pending" | "awaiting_confirmation";
  readonly data?: JsonObject;
  readonly events: DomainEvent[];
  readonly errors?: ActionError[];
}

interface ActionError {
  readonly code: string;
  readonly message: string;
  readonly field?: string;
  readonly recoverable: boolean;
}
```

### 4.1 Règles du ToolHandler

- Il implémente exactement une capability.
- Il reçoit les arguments validés par Action Runtime.
- Il exécute la logique métier.
- Il ne gouverne pas (la gouvernance est avant).
- Il ne décide pas (la décision est avant).
- Il produit des événements métier.
- Il ne doit pas appeler directement un autre plugin.

---

## 5. Lifecycle d'une Capability

### 5.1 Déclaration

Le plugin déclare la capability dans son manifeste ou via le SDK.

```ts
const capability: Capability = {
  id: "commerce.inventory.add",
  pluginId: "commerce",
  version: "1.0.0",
  description: "Add quantity to an inventory item.",
  examples: [
    "Ajoute 20 sacs de ciment au stock",
    "Reçu de 50 cartons de savon",
  ],
  parameters: [
    {
      name: "itemName",
      type: "string",
      required: true,
      description: "Inventory item name.",
    },
    {
      name: "quantity",
      type: "number",
      required: true,
      description: "Quantity to add.",
      constraints: [{ type: "min", value: 1 }],
    },
  ],
  requiredRoles: ["inventory.manager"],
  requiredPermissions: ["inventory:write"],
  policies: ["inventory.audit_threshold"],
  confirmationLevel: "low",
  sideEffects: ["inventory_quantity_increases"],
  emits: ["InventoryUpdated"],
  resultSchema: {
    type: "object",
    properties: {
      itemName: { type: "string" },
      quantityAdded: { type: "number" },
      currentQuantity: { type: "number" },
    },
  },
  errorCodes: [
    { code: "item_not_found", message: "Item does not exist.", severity: "error", recoverable: true },
    { code: "insufficient_permission", message: "User lacks permission.", severity: "error", recoverable: false },
  ],
};
```

### 5.2 Enregistrement

Le plugin enregistre la capability et son ToolHandler dans OIP lors de l'activation du workspace.

### 5.3 Discovery

Le Decision Runtime découvre les capabilities actives pour un workspace et un contexte donné.

### 5.4 Planification

Le Decision Runtime sélectionne une capability et produit un `PlannedAction`.

```ts
interface PlannedAction {
  readonly capabilityId: string;
  readonly arguments: JsonObject;
  readonly confidence: number;
  readonly reason: string;
}
```

### 5.5 Validation

Action Runtime + Policy Runtime valident le `PlannedAction` avant exécution.

### 5.6 Exécution

Action Runtime appelle le ToolHandler.

### 5.7 Publication

Les événements produits sont publiés sur Event Runtime.

### 5.8 Audit

L'exécution est journalisée.

---

## 6. Règles immuables

1. **Une capability appartient à un seul plugin.**
2. **Une capability ne peut pas appeler directement une autre capability.**
3. **Une capability ne connaît pas le canal d'origine.**
4. **Une capability ne connaît pas le LLM utilisé.**
5. **Une capability ne modifie jamais le core OIP.**
6. **Une capability expose un contrat stable versionné.**
7. **Une capability produit toujours des événements métier en cas de succès.**
8. **Une capability rejette proprement avec des codes d'erreur documentés.**
9. **Une capability ne décide pas de sa propre autorisation.**
10. **Une capability n'accède pas directement aux données d'un autre plugin.**

---

## 7. Exemples de Capabilities par domaine

### Commerce

- `commerce.inventory.add`
- `commerce.inventory.adjust`
- `commerce.customer.create`
- `commerce.sales.create`
- `commerce.invoice.create`
- `commerce.payment.record`
- `commerce.report.salesSummary`

### RH

- `hr.employee.create`
- `hr.employee.update`
- `hr.payroll.generate`
- `hr.leave.request`
- `hr.contract.sign`

### Immobilier / Cadastre

- `real-estate.property.register`
- `real-estate.property.search`
- `cadastre.plot.survey`
- `cadastre.ownership.transfer`

### Juridique

- `legal.case.create`
- `legal.contract.generate`
- `legal.contract.sign`

### Logistique

- `logistics.shipment.track`
- `logistics.delivery.confirm`
- `logistics.vehicle.assign`

### ONG

- `ngo.beneficiary.register`
- `ngo.distribution.record`
- `ngo.report.impact`

### Santé

- `health.patient.register`
- `health.appointment.schedule`
- `health.prescription.record`

### Éducation

- `education.student.register`
- `education.grade.record`
- `education.certificate.generate`

---

## 8. Notes d'implémentation

- Le contrat TypeScript de Capability doit être défini dans `packages/core/src/capability.ts`.
- Le SDK plugin doit fournir une fonction `defineCapability(capability, handler)`.
- Les tests doivent vérifier qu'une capability déclarée sans ToolHandler est rejetée.
- Les tests doivent vérifier qu'une capability mal nommée est rejetée.

---

> Document consolidé. Aucune abstraction supplémentaire n'a été introduite.
