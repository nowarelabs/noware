import type { ContextLike } from "./shared.ts";

export interface RpcContext extends ContextLike {}
export interface IntegrationEventContext extends ContextLike {}
export interface UseCaseContext extends ContextLike {}
export interface PortContext extends ContextLike {}
export interface AggregateContext extends ContextLike {}
export interface EventContext extends ContextLike {}
export interface QueryContext extends ContextLike {}
export interface GatewayContext extends ContextLike {}
export interface PersistenceContext extends ContextLike {}
export interface SqlContext extends ContextLike {}
export interface MigrationContext extends ContextLike {}
export interface LoggerContext extends ContextLike {}
export interface JobContext extends ContextLike {}
export interface AssetContext extends ContextLike {}
export interface DurableObjectContext extends ContextLike {}
export interface CfourContext extends ContextLike {}
export interface DtoContext extends ContextLike {}
export interface NormalizerContext extends ContextLike {}
export interface ValidatorContext extends ContextLike {}
export interface FormatterContext extends ContextLike {}
export interface SerializerContext extends ContextLike {}
export interface MaintenanceContext extends ContextLike {}
export interface PluginContext extends ContextLike {}
export interface ScriptContext extends ContextLike {}
export interface DomainContext extends ContextLike {}
