import type { JsonObject } from "./common.js";

export type SkillType = "core" | "product" | "enterprise" | "user" | "ui";

export interface SkillParameter {
  readonly name: string;
  readonly type: string;
  readonly required: boolean;
  readonly description: string;
}

export interface SkillDefinition {
  readonly id: string;
  readonly type: SkillType;
  readonly description: string;
  readonly parameters: readonly SkillParameter[];
}

export interface SkillInput {
  readonly skillId: string;
  readonly parameters: JsonObject;
}

export interface SkillResult {
  readonly skillId: string;
  readonly status: "completed" | "rejected";
  readonly data?: JsonObject;
  readonly response?: string;
}
