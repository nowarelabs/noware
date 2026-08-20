export interface ArchitecturalPatternDefinition {
  name: string;
  description: string;
  constraints: string[];
  requiredElements: string[];
  allowedRelationships: string[];
}

export const ARCHITECTURAL_PATTERNS: ArchitecturalPatternDefinition[] = [
  {
    name: "mvc",
    description:
      "Model-View-Controller separates concerns into data, presentation, and input handling",
    constraints: [
      "Models must not reference Views or Controllers",
      "Views must not modify Models directly",
      "Controllers must not contain business logic",
      "Communication flows through observer or notification",
    ],
    requiredElements: ["Model", "View", "Controller"],
    allowedRelationships: ["Controller -> Model", "Controller -> View", "View -> Model"],
  },
  {
    name: "clean",
    description:
      "Clean Architecture places business logic at the center with dependency rule inwards",
    constraints: [
      "Inner layers must not know about outer layers",
      "Dependencies point inward only",
      "Business logic is framework-independent",
      "Data crossing boundaries uses simple structures",
    ],
    requiredElements: ["Entities", "UseCases", "InterfaceAdapters", "Frameworks"],
    allowedRelationships: [
      "Frameworks -> InterfaceAdapters",
      "InterfaceAdapters -> UseCases",
      "UseCases -> Entities",
    ],
  },
  {
    name: "ddd",
    description: "Domain-Driven Design organizes code around business domains and bounded contexts",
    constraints: [
      "Each bounded context has its own model",
      "Aggregates enforce consistency boundaries",
      "Domain events communicate between contexts",
      "Ubiquitous language drives naming",
    ],
    requiredElements: ["Aggregate", "Entity", "ValueObject", "DomainEvent", "Repository"],
    allowedRelationships: [
      "Aggregate contains Entity",
      "Aggregate contains ValueObject",
      "Repository accesses Aggregate",
      "DomainEvent references Aggregate",
    ],
  },
  {
    name: "event-driven",
    description: "Event-Driven Architecture uses events as the primary communication mechanism",
    constraints: [
      "Components communicate through events only",
      "Event producers do not know about consumers",
      "Events are immutable facts",
      "Event ordering must be guaranteed within a context",
    ],
    requiredElements: ["EventProducer", "EventConsumer", "EventBus", "Event"],
    allowedRelationships: [
      "EventProducer -> EventBus",
      "EventBus -> EventConsumer",
      "EventConsumer -> EventBus",
    ],
  },
  {
    name: "onion",
    description:
      "Onion Architecture layers services with domain at the center and infrastructure at the edges",
    constraints: [
      "Domain model has no dependencies",
      "Application services depend only on domain",
      "Infrastructure implements domain interfaces",
      "Each layer only knows the layer inside it",
    ],
    requiredElements: [
      "DomainModel",
      "ApplicationServices",
      "DomainServices",
      "Infrastructure",
      "UI",
    ],
    allowedRelationships: [
      "Infrastructure -> DomainServices",
      "DomainServices -> DomainModel",
      "ApplicationServices -> DomainServices",
      "UI -> ApplicationServices",
    ],
  },
];
