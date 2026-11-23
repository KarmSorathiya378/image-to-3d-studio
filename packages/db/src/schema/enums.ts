import { pgEnum } from "drizzle-orm/pg-core";

export const credentialStatusEnum = pgEnum("credential_status", [
  "untested",
  "verified",
  "invalid",
  "temporarily_unavailable",
]);

export const modelStageEnum = pgEnum("model_stage", [
  "VISION",
  "PLANNER",
  "SPECIALIST",
]);

export const generationModeEnum = pgEnum("generation_mode", [
  "PROCEDURAL",
  "SPECIALIST",
]);

export const generationStatusEnum = pgEnum("generation_status", [
  "CREATED",
  "QUEUED",
  "IMAGE_ANALYSIS",
  "SCENE_PLANNING",
  "BUILDING_GEOMETRY",
  "VALIDATING_ASSET",
  "SUCCEEDED",
  "FAILED",
  "CANCELED",
]);

export const attemptStatusEnum = pgEnum("attempt_status", [
  "PENDING",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
]);

export const assetFormatEnum = pgEnum("asset_format", [
  "GLB",
  "BLEND",
  "PNG_THUMBNAIL",
  "OBJ",
  "STL",
]);

export const validationStateEnum = pgEnum("validation_state", [
  "PENDING",
  "VALID",
  "INVALID",
]);
