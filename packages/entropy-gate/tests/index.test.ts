import { describe, expect, test, beforeEach } from "vite-plus/test";
import {
  validateAgentName,
  validateBranchName,
  validateRepoName,
  validateConversationId,
  validateStageName,
  schemaGate,
  validateTaskDescription,
  validateAttributes,
  validateConversationBody,
  semanticGate,
  validateStageOrder,
  orderingGate,
  ProvenanceTracker,
  provenanceGate,
  ConsistencyChecker,
  consistencyGate,
  EntropyGate,
  createEntropyGate,
  defaultConfig,
} from "../src/index.ts";

// ─── Schema Gate ───

describe("schemaGate", () => {
  describe("validateAgentName", () => {
    test("passes for valid agent names", () => {
      expect(validateAgentName("coding").pass).toBe(true);
      expect(validateAgentName("orchestrator").pass).toBe(true);
      expect(validateAgentName("qa-test").pass).toBe(true);
    });

    test("fails for invalid agent names", () => {
      const result = validateAgentName("nonexistent-agent");
      expect(result.pass).toBe(false);
      expect(result.reason).toContain("Invalid agent name");
    });
  });

  describe("validateBranchName", () => {
    test("passes for valid branch names", () => {
      expect(validateBranchName("main").pass).toBe(true);
      expect(validateBranchName("feature/add-auth").pass).toBe(true);
      expect(validateBranchName("fix-123").pass).toBe(true);
    });

    test("fails for invalid branch names", () => {
      expect(validateBranchName("").pass).toBe(false);
      expect(validateBranchName("-starts-with-dash").pass).toBe(false);
      expect(validateBranchName("UPPERCASE").pass).toBe(false);
    });

    test("fails when too long", () => {
      const longName = "a".repeat(65);
      const result = validateBranchName(longName);
      expect(result.pass).toBe(false);
      expect(result.reason).toContain("exceeds max length");
    });
  });

  describe("validateRepoName", () => {
    test("passes for valid repo names", () => {
      expect(validateRepoName("org/repo").pass).toBe(true);
      expect(validateRepoName("my-org/my_repo").pass).toBe(true);
      expect(validateRepoName("org123/repo-name").pass).toBe(true);
    });

    test("fails for invalid repo names", () => {
      expect(validateRepoName("no-slash").pass).toBe(false);
      expect(validateRepoName("/missing-org").pass).toBe(false);
      expect(validateRepoName("missing-repo/").pass).toBe(false);
    });
  });

  describe("validateConversationId", () => {
    test("passes for valid UUIDs", () => {
      expect(validateConversationId("550e8400-e29b-41d4-a716-446655440000").pass).toBe(true);
    });

    test("fails for non-UUID strings", () => {
      expect(validateConversationId("not-a-uuid").pass).toBe(false);
      expect(validateConversationId("123").pass).toBe(false);
    });
  });

  describe("validateStageName", () => {
    test("passes for valid stage names", () => {
      expect(validateStageName("coding", defaultConfig.stageOrder!).pass).toBe(true);
      expect(validateStageName("review", defaultConfig.stageOrder!).pass).toBe(true);
    });

    test("fails for invalid stage names", () => {
      const result = validateStageName("invalid-stage", defaultConfig.stageOrder!);
      expect(result.pass).toBe(false);
      expect(result.reason).toContain("Invalid stage name");
    });
  });

  describe("schemaGate composite", () => {
    test("passes for valid input object", () => {
      const input = {
        agent: "coding",
        branch: "feature/add-auth",
        conversationId: "550e8400-e29b-41d4-a716-446655440000",
      };
      const result = schemaGate(input, { stageOrder: defaultConfig.stageOrder });
      expect(result.pass).toBe(true);
    });

    test("fails for non-object input", () => {
      const result = schemaGate(null, {});
      expect(result.pass).toBe(false);
    });

    test("fails for invalid agent in input", () => {
      const result = schemaGate({ agent: "invalid" }, {});
      expect(result.pass).toBe(false);
    });
  });
});

// ─── Semantic Gate ───

describe("semanticGate", () => {
  describe("validateTaskDescription", () => {
    test("passes for valid task descriptions", () => {
      expect(validateTaskDescription("Implement user authentication flow").pass).toBe(true);
      expect(validateTaskDescription("Fix the broken database connection pooling").pass).toBe(true);
    });

    test("fails for too short", () => {
      expect(validateTaskDescription("short").pass).toBe(false);
    });

    test("fails for too long", () => {
      const longTask = "a".repeat(501);
      expect(validateTaskDescription(longTask).pass).toBe(false);
    });

    test("fails without action verb", () => {
      const result = validateTaskDescription("The weather is nice today");
      expect(result.pass).toBe(false);
      expect(result.reason).toContain("action verb");
    });
  });

  describe("validateAttributes", () => {
    test("passes for non-empty attributes", () => {
      expect(validateAttributes({ key: "value" }).pass).toBe(true);
    });

    test("fails for empty attributes", () => {
      expect(validateAttributes({}).pass).toBe(false);
    });

    test("fails for attributes exceeding max length", () => {
      const result = validateAttributes({ key: "a".repeat(201) });
      expect(result.pass).toBe(false);
    });
  });

  describe("validateConversationBody", () => {
    test("passes for non-empty body", () => {
      expect(validateConversationBody("Hello").pass).toBe(true);
    });

    test("fails for empty body", () => {
      expect(validateConversationBody("").pass).toBe(false);
      expect(validateConversationBody("   ").pass).toBe(false);
    });
  });

  describe("semanticGate composite", () => {
    test("passes for valid input", () => {
      const input = {
        task: "Implement the new authentication module",
        attributes: { priority: "high" },
      };
      expect(semanticGate(input, {}).pass).toBe(true);
    });

    test("fails for invalid task", () => {
      const input = { task: "short" };
      expect(semanticGate(input, {}).pass).toBe(false);
    });
  });
});

// ─── Ordering Gate ───

describe("orderingGate", () => {
  describe("validateStageOrder", () => {
    test("passes for forward transitions", () => {
      expect(
        validateStageOrder("requirements", "architecture", defaultConfig.stageOrder!).pass,
      ).toBe(true);
      expect(validateStageOrder("coding", "review", defaultConfig.stageOrder!).pass).toBe(true);
    });

    test("fails for backward transitions", () => {
      const result = validateStageOrder("review", "coding", defaultConfig.stageOrder!);
      expect(result.pass).toBe(false);
      expect(result.reason).toContain("Cannot move backward");
    });

    test("fails for same stage", () => {
      expect(validateStageOrder("coding", "coding", defaultConfig.stageOrder!).pass).toBe(false);
    });

    test("fails for unknown stages", () => {
      expect(validateStageOrder("unknown", "coding", defaultConfig.stageOrder!).pass).toBe(false);
      expect(validateStageOrder("coding", "unknown", defaultConfig.stageOrder!).pass).toBe(false);
    });
  });

  describe("orderingGate composite", () => {
    test("passes for forward transition", () => {
      const result = orderingGate(
        { stage: "architecture" },
        { currentStage: "requirements" },
        defaultConfig,
      );
      expect(result.pass).toBe(true);
    });

    test("fails for backward transition", () => {
      const result = orderingGate({ stage: "coding" }, { currentStage: "review" }, defaultConfig);
      expect(result.pass).toBe(false);
    });

    test("passes when stages are missing", () => {
      const result = orderingGate({ stage: "coding" }, {}, defaultConfig);
      expect(result.pass).toBe(true);
    });
  });
});

// ─── Provenance Gate ───

describe("provenanceGate", () => {
  let tracker: ProvenanceTracker;

  beforeEach(() => {
    tracker = new ProvenanceTracker();
  });

  test("passes for new data", async () => {
    const result = await provenanceGate({ message: "hello" }, { sourceAgent: "coding" }, tracker);
    expect(result.pass).toBe(true);
  });

  test("tracks audit trail", async () => {
    await provenanceGate({ message: "hello" }, { sourceAgent: "coding" }, tracker);
    await provenanceGate({ message: "world" }, { sourceAgent: "coding" }, tracker);

    const trail = tracker.getAuditTrail("coding");
    expect(trail).toHaveLength(2);
  });

  test("detects echo when same agent processes same data", async () => {
    await provenanceGate({ message: "hello" }, { sourceAgent: "coding" }, tracker);
    const result = await provenanceGate({ message: "hello" }, { sourceAgent: "coding" }, tracker);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("echo detected");
  });

  test("allows same data from different agents", async () => {
    await provenanceGate({ message: "hello" }, { sourceAgent: "coding" }, tracker);
    const result = await provenanceGate({ message: "hello" }, { sourceAgent: "review" }, tracker);
    expect(result.pass).toBe(true);
  });
});

// ─── Consistency Gate ───

describe("consistencyGate", () => {
  let checker: ConsistencyChecker;

  beforeEach(() => {
    checker = new ConsistencyChecker();
  });

  test("passes for non-claim input", () => {
    const result = consistencyGate({ task: "do something" }, { sourceAgent: "coding" }, checker);
    expect(result.pass).toBe(true);
  });

  test("passes for consistent claims", () => {
    consistencyGate(
      { claim: "auth is implemented", truthValue: true },
      { sourceAgent: "coding" },
      checker,
    );
    const result = consistencyGate(
      { claim: "auth is implemented", truthValue: true },
      { sourceAgent: "review" },
      checker,
    );
    expect(result.pass).toBe(true);
  });

  test("detects contradictions", () => {
    consistencyGate(
      { claim: "auth is implemented", truthValue: true },
      { sourceAgent: "coding" },
      checker,
    );
    const result = consistencyGate(
      { claim: "auth is implemented", truthValue: false },
      { sourceAgent: "review" },
      checker,
    );
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("Contradiction detected");
  });

  test("getAgentAgreement returns 1 for no claims", () => {
    expect(checker.getAgentAgreement("coding")).toBe(1);
  });

  test("getAgentAgreement computes correctly", () => {
    checker.recordClaim("coding", "claim1", true);
    checker.recordClaim("coding", "claim2", false);
    expect(checker.getAgentAgreement("coding")).toBe(0.5);
  });
});

// ─── Integration: EntropyGate ───

describe("EntropyGate", () => {
  test("passes all gates for valid input", async () => {
    const gate = new EntropyGate(defaultConfig);
    const result = await gate.evaluate(
      {
        agent: "coding",
        task: "Implement the new authentication module",
        attributes: { priority: "high" },
        stage: "coding",
        branch: "feature/add-auth",
        repo: "org/repo",
        conversationId: "550e8400-e29b-41d4-a716-446655440000",
      },
      { sourceAgent: "orchestrator" },
    );
    expect(result.allowed).toBe(true);
    expect(result.gates.length).toBeGreaterThan(0);
  });

  test("short-circuits on schema failure", async () => {
    const gate = new EntropyGate(defaultConfig);
    const result = await gate.evaluate(
      { agent: "invalid-agent", task: "Implement something meaningful here" },
      { sourceAgent: "orchestrator" },
    );
    expect(result.allowed).toBe(false);
    expect(result.gates[0]!.gate).toBe("schema");
  });

  test("short-circuits on semantic failure", async () => {
    const gate = new EntropyGate({ ...defaultConfig, schema: false });
    const result = await gate.evaluate({ task: "short" }, { sourceAgent: "orchestrator" });
    expect(result.allowed).toBe(false);
    expect(result.gates[0]!.gate).toBe("semantic");
  });

  test("respects disabled gates", async () => {
    const gate = new EntropyGate({
      schema: true,
      semantic: false,
      ordering: false,
      provenance: false,
      consistency: false,
    });
    const result = await gate.evaluate({ agent: "coding" }, { sourceAgent: "orchestrator" });
    expect(result.allowed).toBe(true);
    expect(result.gates.length).toBe(1);
    expect(result.gates[0]!.gate).toBe("schema");
  });

  test("circuit breaker trips after threshold", async () => {
    const gate = new EntropyGate({
      schema: true,
      semantic: false,
      ordering: false,
      provenance: false,
      consistency: false,
      circuitBreaker: { threshold: 3, cooldownMs: 60000 },
    });

    for (let i = 0; i < 3; i++) {
      await gate.evaluate({ agent: "invalid" }, {});
    }

    const result = await gate.evaluate({ agent: "coding" }, {});
    expect(result.allowed).toBe(false);
    expect(result.gates[0]!.gate).toBe("circuit-breaker");
  });

  test("createEntropyGate factory works", () => {
    const gate = createEntropyGate(defaultConfig);
    expect(gate).toBeInstanceOf(EntropyGate);
  });
});
