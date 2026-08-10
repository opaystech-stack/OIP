import type {
  ManifestEntity,
  ManifestField,
  ManifestOperation,
  SemanticManifest,
} from "../../hq-connector/src/manifest.js";

/**
 * Function-Calling adapter (ADR-012).
 *
 * Translates a product's Semantic Manifest into LLM function-calling tool
 * definitions compatible with the OpenAI / DeepSeek `tools` specification.
 *
 * GOVERNANCE — Sobriété Sémantique:
 * - OIP holds NO hard-coded tools. Every schema below is *derived on demand*
 *   from the manifest the product publishes at /api/oip/manifest.
 * - This module is a pure, stateless transformer: manifest in, JSON-Schema out.
 *   It contains zero business knowledge (no "lead", no "task", no "geo" logic).
 * - Geospatial parameters (lat/lng/radius) are NOT special-cased here. They are
 *   ordinary fields the product declares as `required` in its manifest; the
 *   generic mapper emits them exactly like any other field.
 */

/** A JSON-Schema fragment as understood by OpenAI/DeepSeek function-calling. */
export interface JsonSchema {
  readonly type: string;
  readonly description?: string;
  readonly enum?: readonly unknown[];
  readonly minimum?: number;
  readonly maximum?: number;
  readonly items?: JsonSchema;
  readonly properties?: Readonly<Record<string, JsonSchema>>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean;
}

/** The `function` half of an OpenAI/DeepSeek tool definition. */
export interface FunctionDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: JsonSchema;
}

/** A single tool as sent to the LLM in the `tools` array. */
export interface FunctionTool {
  readonly type: "function";
  readonly function: FunctionDefinition;
}

/**
 * Separator between entity and operation inside a function name.
 * A function name is `<entity>__<operation>` so the dispatcher can route back to
 * [entity, operation] without any lookup table.
 */
export const FUNCTION_NAME_SEPARATOR = "__";

/** Build the LLM function name for an (entity, operation) pair. */
export function toFunctionName(entity: string, operation: string): string {
  return `${entity}${FUNCTION_NAME_SEPARATOR}${operation}`;
}

/**
 * Parse an LLM-emitted function name back into [entity, operation].
 * Returns undefined for malformed names so the caller can reject cleanly.
 */
export function parseFunctionName(
  name: string,
): { readonly entity: string; readonly operation: string } | undefined {
  const idx = name.indexOf(FUNCTION_NAME_SEPARATOR);
  if (idx <= 0) return undefined;
  const entity = name.slice(0, idx);
  const operation = name.slice(idx + FUNCTION_NAME_SEPARATOR.length);
  if (!entity || !operation) return undefined;
  return { entity, operation };
}

/**
 * Map a manifest field type to a JSON-Schema primitive type.
 * Unknown/product-specific types (currency, uuid, geopoint, …) degrade to the
 * closest primitive without OIP asserting any semantics.
 */
function mapType(type: string): string {
  switch (type) {
    case "number":
    case "integer":
    case "float":
    case "currency":
    case "decimal":
    case "lat":
    case "lng":
    case "latitude":
    case "longitude":
    case "radius":
      return "number";
    case "boolean":
    case "bool":
      return "boolean";
    case "object":
    case "json":
      return "object";
    case "array":
    case "list":
      return "array";
    default:
      return "string";
  }
}

function fieldToSchema(field: ManifestField): JsonSchema {
  const jsonType = mapType(field.type);
  const schema: {
    type: string;
    description?: string;
    enum?: readonly unknown[];
    minimum?: number;
    maximum?: number;
    items?: JsonSchema;
  } = { type: jsonType };

  if (field.description !== undefined) schema.description = field.description;
  if (field.values !== undefined) schema.enum = field.values;
  if (field.min !== undefined) schema.minimum = field.min;
  if (field.max !== undefined) schema.maximum = field.max;
  if (jsonType === "array" && field.items !== undefined) {
    schema.items = { type: mapType(field.items) };
  }

  return schema as JsonSchema;
}

/**
 * Build the JSON-Schema `parameters` object for one operation.
 *
 * A field is REQUIRED in the generated schema iff the product declared it
 * `required` and not `readonly`. This is how geospatial requirements are
 * enforced: a product that declares `lat/lng/radius` as required will produce a
 * function schema in which the LLM must supply them — with no geo logic in OIP.
 */
function buildParameters(
  entity: ManifestEntity,
  operation: string,
): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];

  for (const [name, field] of Object.entries(entity.fields)) {
    if (field.readonly) continue;
    properties[name] = fieldToSchema(field);
    if (field.required) required.push(name);
  }

  const params: {
    type: string;
    properties: Record<string, JsonSchema>;
    required?: readonly string[];
    additionalProperties: boolean;
  } = {
    type: "object",
    properties,
    additionalProperties: false,
  };
  if (required.length > 0) params.required = required;

  return params as JsonSchema;
}

function describeOperation(
  entityName: string,
  entity: ManifestEntity,
  operation: string,
  op: ManifestOperation,
): string {
  const base = entity.description
    ? `${operation} operation on ${entityName} (${entity.description})`
    : `${operation} operation on ${entityName}`;
  const roles = op.roles.length > 0 ? ` — requires role(s): ${op.roles.join(", ")}` : "";
  return `${base}${roles}`;
}

/**
 * Generate the full list of function-calling tools for a single manifest.
 * One tool per (entity, operation). Pure and deterministic.
 */
export function manifestToFunctionTools(
  manifest: SemanticManifest,
): readonly FunctionTool[] {
  const tools: FunctionTool[] = [];

  for (const [entityName, entity] of Object.entries(manifest.entities)) {
    for (const [operation, op] of Object.entries(entity.operations)) {
      tools.push({
        type: "function",
        function: {
          name: toFunctionName(entityName, operation),
          description: describeOperation(entityName, entity, operation, op),
          parameters: buildParameters(entity, operation),
        },
      });
    }
  }

  return tools;
}
