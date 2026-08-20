export type PatternCategory = "creational" | "structural" | "behavioral";

export interface CodingPatternDefinition {
  name: string;
  category: PatternCategory;
  description: string;
  constraints: string[];
  requiredInterfaces: string[];
  requiredMethods: string[];
}

export const CODING_PATTERNS: CodingPatternDefinition[] = [
  // Creational
  {
    name: "factory",
    category: "creational",
    description:
      "Defines an interface for creating objects, letting subclasses decide which class to instantiate",
    constraints: ["Product interface must be defined", "Creator returns Product type"],
    requiredInterfaces: ["Product", "Creator"],
    requiredMethods: ["createProduct()"],
  },
  {
    name: "abstract-factory",
    category: "creational",
    description:
      "Provides an interface for creating families of related objects without specifying concrete classes",
    constraints: ["Factory interface defines creation methods", "Products are grouped by family"],
    requiredInterfaces: ["AbstractFactory", "AbstractProductA", "AbstractProductB"],
    requiredMethods: ["createProductA()", "createProductB()"],
  },
  {
    name: "builder",
    category: "creational",
    description:
      "Separates construction of complex objects from representation, allowing step-by-step creation",
    constraints: [
      "Builder provides step-by-step construction",
      "Director orchestrates build sequence",
    ],
    requiredInterfaces: ["Builder", "Director", "Product"],
    requiredMethods: ["setPartA()", "setPartB()", "build()"],
  },
  {
    name: "prototype",
    category: "creational",
    description:
      "Creates new objects by copying an existing instance rather than creating from scratch",
    constraints: ["Prototype implements clone method", "Clone produces independent copy"],
    requiredInterfaces: ["Prototype"],
    requiredMethods: ["clone()"],
  },
  {
    name: "singleton",
    category: "creational",
    description: "Ensures a class has only one instance and provides a global access point to it",
    constraints: [
      "Constructor must be private",
      "Single instance managed by class",
      "Global access via static method",
    ],
    requiredInterfaces: [],
    requiredMethods: ["getInstance()"],
  },
  // Structural
  {
    name: "adapter",
    category: "structural",
    description: "Converts the interface of a class into another interface clients expect",
    constraints: ["Adapter implements target interface", "Adapter wraps adaptee"],
    requiredInterfaces: ["Target", "Adaptee", "Adapter"],
    requiredMethods: ["request()"],
  },
  {
    name: "bridge",
    category: "structural",
    description: "Decouples abstraction from implementation so both can vary independently",
    constraints: [
      "Abstraction holds reference to implementor",
      "Abstraction and implementor can vary independently",
    ],
    requiredInterfaces: ["Abstraction", "Implementor"],
    requiredMethods: ["operation()"],
  },
  {
    name: "composite",
    category: "structural",
    description:
      "Composes objects into tree structures and treats individual and composed objects uniformly",
    constraints: [
      "Component interface for leaf and composite",
      "Composite contains children components",
    ],
    requiredInterfaces: ["Component", "Leaf", "Composite"],
    requiredMethods: ["operation()", "add()", "remove()", "getChild()"],
  },
  {
    name: "decorator",
    category: "structural",
    description:
      "Attaches additional responsibilities to an object dynamically, providing flexible alternative to subclassing",
    constraints: ["Decorator implements component interface", "Decorator wraps concrete component"],
    requiredInterfaces: ["Component", "ConcreteComponent", "Decorator"],
    requiredMethods: ["operation()"],
  },
  {
    name: "facade",
    category: "structural",
    description: "Provides a unified interface to a set of interfaces in a subsystem",
    constraints: ["Facade simplifies subsystem access", "Subsystem classes are not hidden"],
    requiredInterfaces: ["Facade"],
    requiredMethods: ["operation()"],
  },
  {
    name: "proxy",
    category: "structural",
    description: "Provides a surrogate or placeholder for another object to control access to it",
    constraints: [
      "Proxy implements same interface as subject",
      "Proxy controls access to real subject",
    ],
    requiredInterfaces: ["Subject", "Proxy", "RealSubject"],
    requiredMethods: ["request()"],
  },
  // Behavioral
  {
    name: "chain-of-responsibility",
    category: "behavioral",
    description: "Passes requests along a chain of handlers until one handles it",
    constraints: ["Each handler decides to process or pass", "Handlers form a chain"],
    requiredInterfaces: ["Handler"],
    requiredMethods: ["setNext()", "handle()"],
  },
  {
    name: "command",
    category: "behavioral",
    description: "Encapsulates a request as an object, allowing parameterization and queuing",
    constraints: ["Command encapsulates action", "Invoker triggers command execution"],
    requiredInterfaces: ["Command", "Invoker"],
    requiredMethods: ["execute()", "undo()"],
  },
  {
    name: "iterator",
    category: "behavioral",
    description:
      "Provides a way to access elements of a collection sequentially without exposing representation",
    constraints: ["Iterator provides traversal interface", "Collection returns iterator"],
    requiredInterfaces: ["Iterator", "Iterable"],
    requiredMethods: ["next()", "hasNext()"],
  },
  {
    name: "mediator",
    category: "behavioral",
    description:
      "Defines an object that封装 how a set of objects interact, promoting loose coupling",
    constraints: [
      "Mediator centralizes communication",
      "Colleagues communicate only through mediator",
    ],
    requiredInterfaces: ["Mediator", "Colleague"],
    requiredMethods: ["notify()"],
  },
  {
    name: "observer",
    category: "behavioral",
    description:
      "Defines a one-to-many dependency so when one object changes state, all dependents are notified",
    constraints: ["Subject maintains list of observers", "Observers receive state updates"],
    requiredInterfaces: ["Subject", "Observer"],
    requiredMethods: ["subscribe()", "unsubscribe()", "notify()"],
  },
  {
    name: "strategy",
    category: "behavioral",
    description:
      "Defines a family of algorithms, encapsulates each one, and makes them interchangeable",
    constraints: ["Strategy interface defines algorithm", "Context delegates to strategy"],
    requiredInterfaces: ["Strategy", "Context"],
    requiredMethods: ["execute()"],
  },
];
