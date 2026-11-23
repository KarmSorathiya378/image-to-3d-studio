import { relations } from "drizzle-orm";
import { users } from "./users";
import { sessions } from "./sessions";
import { projects } from "./projects";
import { uploadedAssets } from "./uploaded_assets";
import { aiProviders } from "./ai_providers";
import { userCredentials } from "./user_credentials";
import { modelConfigurations } from "./model_configurations";
import { generationJobs } from "./generation_jobs";
import { generationAttempts } from "./generation_attempts";
import { sceneSpecifications } from "./scene_specifications";
import { generatedAssets } from "./generated_assets";
import { modelVersions } from "./model_versions";
import { exportRecords } from "./export_records";
import { auditEvents } from "./audit_events";

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  projects: many(projects),
  uploadedAssets: many(uploadedAssets),
  userCredentials: many(userCredentials),
  modelConfigurations: many(modelConfigurations),
  generationJobs: many(generationJobs),
  sceneSpecifications: many(sceneSpecifications),
  generatedAssets: many(generatedAssets),
  modelVersions: many(modelVersions),
  exportRecords: many(exportRecords),
  auditEvents: many(auditEvents),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  uploadedAssets: many(uploadedAssets),
  generationJobs: many(generationJobs),
  generatedAssets: many(generatedAssets),
  modelVersions: many(modelVersions),
}));

export const uploadedAssetsRelations = relations(uploadedAssets, ({ one, many }) => ({
  user: one(users, {
    fields: [uploadedAssets.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [uploadedAssets.projectId],
    references: [projects.id],
  }),
  generationJobs: many(generationJobs),
}));

export const aiProvidersRelations = relations(aiProviders, ({ many }) => ({
  userCredentials: many(userCredentials),
  modelConfigurations: many(modelConfigurations),
}));

export const userCredentialsRelations = relations(userCredentials, ({ one, many }) => ({
  user: one(users, {
    fields: [userCredentials.userId],
    references: [users.id],
  }),
  provider: one(aiProviders, {
    fields: [userCredentials.providerId],
    references: [aiProviders.id],
  }),
  modelConfigurations: many(modelConfigurations),
}));

export const modelConfigurationsRelations = relations(modelConfigurations, ({ one }) => ({
  user: one(users, {
    fields: [modelConfigurations.userId],
    references: [users.id],
  }),
  provider: one(aiProviders, {
    fields: [modelConfigurations.providerId],
    references: [aiProviders.id],
  }),
  credential: one(userCredentials, {
    fields: [modelConfigurations.credentialId],
    references: [userCredentials.id],
  }),
}));

export const generationJobsRelations = relations(generationJobs, ({ one, many }) => ({
  user: one(users, {
    fields: [generationJobs.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [generationJobs.projectId],
    references: [projects.id],
  }),
  sourceAsset: one(uploadedAssets, {
    fields: [generationJobs.sourceAssetId],
    references: [uploadedAssets.id],
  }),
  attempts: many(generationAttempts),
  sceneSpecifications: many(sceneSpecifications),
  generatedAssets: many(generatedAssets),
  modelVersions: many(modelVersions),
}));

export const generationAttemptsRelations = relations(generationAttempts, ({ one }) => ({
  job: one(generationJobs, {
    fields: [generationAttempts.jobId],
    references: [generationJobs.id],
  }),
}));

export const sceneSpecificationsRelations = relations(sceneSpecifications, ({ one, many }) => ({
  job: one(generationJobs, {
    fields: [sceneSpecifications.jobId],
    references: [generationJobs.id],
  }),
  user: one(users, {
    fields: [sceneSpecifications.userId],
    references: [users.id],
  }),
  modelVersions: many(modelVersions),
}));

export const generatedAssetsRelations = relations(generatedAssets, ({ one, many }) => ({
  job: one(generationJobs, {
    fields: [generatedAssets.jobId],
    references: [generationJobs.id],
  }),
  user: one(users, {
    fields: [generatedAssets.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [generatedAssets.projectId],
    references: [projects.id],
  }),
  exportRecords: many(exportRecords),
  primaryModelVersions: many(modelVersions, { relationName: "primaryAsset" }),
  thumbnailModelVersions: many(modelVersions, { relationName: "thumbnailAsset" }),
}));

export const modelVersionsRelations = relations(modelVersions, ({ one }) => ({
  project: one(projects, {
    fields: [modelVersions.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [modelVersions.userId],
    references: [users.id],
  }),
  generationJob: one(generationJobs, {
    fields: [modelVersions.generationJobId],
    references: [generationJobs.id],
  }),
  sceneSpecification: one(sceneSpecifications, {
    fields: [modelVersions.sceneSpecificationId],
    references: [sceneSpecifications.id],
  }),
  primaryAsset: one(generatedAssets, {
    fields: [modelVersions.primaryAssetId],
    references: [generatedAssets.id],
    relationName: "primaryAsset",
  }),
  thumbnailAsset: one(generatedAssets, {
    fields: [modelVersions.thumbnailAssetId],
    references: [generatedAssets.id],
    relationName: "thumbnailAsset",
  }),
}));

export const exportRecordsRelations = relations(exportRecords, ({ one }) => ({
  user: one(users, {
    fields: [exportRecords.userId],
    references: [users.id],
  }),
  asset: one(generatedAssets, {
    fields: [exportRecords.assetId],
    references: [generatedAssets.id],
  }),
}));

export const auditEventsRelations = relations(auditEvents, ({ one }) => ({
  user: one(users, {
    fields: [auditEvents.userId],
    references: [users.id],
  }),
}));
