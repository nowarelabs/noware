import type { SystemTemplate } from "@nowarelabs/shared";

export const SYSTEM_TEMPLATES: Record<string, SystemTemplate> = {
  "payment-gateway": {
    name: "Payment Gateway API",
    description: "Handles mobile money transfers with KYC verification",
    database: {
      name: "payments",
      tables: [
        {
          name: "transactions",
          columns: [
            { name: "id", type: "INTEGER", primaryKey: true },
            { name: "sender_id", type: "TEXT", nullable: false },
            { name: "receiver_id", type: "TEXT", nullable: false },
            { name: "amount", type: "REAL", nullable: false },
            { name: "currency", type: "TEXT", nullable: false, defaultValue: "'KES'" },
            { name: "status", type: "TEXT", nullable: false, defaultValue: "'pending'" },
            { name: "provider", type: "TEXT", nullable: false },
            { name: "reference", type: "TEXT" },
            { name: "created_at", type: "INTEGER", nullable: false },
            { name: "updated_at", type: "INTEGER", nullable: false },
          ],
          indexes: [
            { name: "idx_sender", columns: ["sender_id"] },
            { name: "idx_receiver", columns: ["receiver_id"] },
            { name: "idx_status", columns: ["status"] },
            { name: "idx_reference", columns: ["reference"], unique: true },
          ],
        },
        {
          name: "accounts",
          columns: [
            { name: "id", type: "TEXT", primaryKey: true },
            { name: "name", type: "TEXT", nullable: false },
            { name: "email", type: "TEXT", nullable: false },
            { name: "phone", type: "TEXT" },
            { name: "balance", type: "REAL", defaultValue: "0" },
            { name: "currency", type: "TEXT", defaultValue: "'KES'" },
            { name: "status", type: "TEXT", defaultValue: "'active'" },
            { name: "created_at", type: "INTEGER", nullable: false },
          ],
          indexes: [{ name: "idx_email", columns: ["email"], unique: true }],
        },
      ],
      migrations: [],
    },
    bindings: [{ name: "DB", type: "D1", resource: "payments-db" }],
    integrations: [
      { type: "api", endpoint: "https://api.mpesa.com/v1/process", method: "POST" },
      { type: "webhook", endpoint: "https://api.stripe.com/v1/charges" },
    ],
    auth: { type: "api-key", config: { header: "X-API-Key", rateLimit: 100 } },
    monitoring: [
      {
        systemId: "payment-gateway",
        endpoint: "/health",
        intervalMs: 30000,
        timeoutMs: 5000,
        expectedStatus: 200,
      },
    ],
    codeTemplate: `export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") return new Response("ok");
    if (url.pathname === "/api/payments" && request.method === "POST") {
      const body = await request.json();
      const result = await env.DB.prepare("INSERT INTO transactions (sender_id, receiver_id, amount, currency, provider, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)").bind(body.senderId, body.receiverId, body.amount, body.currency, body.provider, Date.now(), Date.now()).run();
      return Response.json({ id: result.meta.last_row_id, status: "pending" });
    }
    return new Response("Not Found", { status: 404 });
  },
};`,
  },

  "kyc-service": {
    name: "KYC Verification Service",
    description: "Document verification and AML checks",
    database: {
      name: "kyc",
      tables: [
        {
          name: "verifications",
          columns: [
            { name: "id", type: "INTEGER", primaryKey: true },
            { name: "user_id", type: "TEXT", nullable: false },
            { name: "document_type", type: "TEXT", nullable: false },
            { name: "document_url", type: "TEXT", nullable: false },
            { name: "status", type: "TEXT", defaultValue: "'pending'" },
            { name: "result", type: "TEXT" },
            { name: "checked_at", type: "INTEGER" },
            { name: "created_at", type: "INTEGER", nullable: false },
          ],
          indexes: [{ name: "idx_user", columns: ["user_id"] }],
        },
      ],
      migrations: [],
    },
    bindings: [{ name: "DB", type: "D1", resource: "kyc-db" }],
    integrations: [
      { type: "api", endpoint: "https://api.safaricom.co.ke/kyc/verify", method: "POST" },
    ],
    auth: { type: "api-key", config: {} },
    monitoring: [
      {
        systemId: "kyc-service",
        endpoint: "/health",
        intervalMs: 60000,
        timeoutMs: 5000,
        expectedStatus: 200,
      },
    ],
    codeTemplate: `export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname === "/health") return new Response("ok");
    return new Response("KYC Service");
  },
};`,
  },

  "notification-service": {
    name: "Notification Service",
    description: "SMS, email, and push notifications",
    database: {
      name: "notifications",
      tables: [
        {
          name: "messages",
          columns: [
            { name: "id", type: "INTEGER", primaryKey: true },
            { name: "recipient", type: "TEXT", nullable: false },
            { name: "channel", type: "TEXT", nullable: false },
            { name: "subject", type: "TEXT" },
            { name: "body", type: "TEXT", nullable: false },
            { name: "status", type: "TEXT", defaultValue: "'queued'" },
            { name: "sent_at", type: "INTEGER" },
            { name: "created_at", type: "INTEGER", nullable: false },
          ],
          indexes: [{ name: "idx_recipient", columns: ["recipient"] }],
        },
      ],
      migrations: [],
    },
    bindings: [{ name: "DB", type: "D1", resource: "notifications-db" }],
    integrations: [{ type: "api", endpoint: "https://api.sms.africa/v1/send", method: "POST" }],
    auth: { type: "api-key", config: {} },
    monitoring: [
      {
        systemId: "notification-service",
        endpoint: "/health",
        intervalMs: 30000,
        timeoutMs: 5000,
        expectedStatus: 200,
      },
    ],
    codeTemplate: `export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname === "/health") return new Response("ok");
    return new Response("Notification Service");
  },
};`,
  },

  "fraud-detection": {
    name: "Fraud Detection Engine",
    description: "Rule-based fraud scoring and detection",
    database: {
      name: "fraud",
      tables: [
        {
          name: "scores",
          columns: [
            { name: "id", type: "INTEGER", primaryKey: true },
            { name: "transaction_id", type: "TEXT", nullable: false },
            { name: "score", type: "REAL", nullable: false },
            { name: "risk_level", type: "TEXT", nullable: false },
            { name: "rules_triggered", type: "TEXT" },
            { name: "created_at", type: "INTEGER", nullable: false },
          ],
          indexes: [{ name: "idx_transaction", columns: ["transaction_id"] }],
        },
      ],
      migrations: [],
    },
    bindings: [{ name: "DB", type: "D1", resource: "fraud-db" }],
    integrations: [],
    auth: { type: "api-key", config: {} },
    monitoring: [
      {
        systemId: "fraud-detection",
        endpoint: "/health",
        intervalMs: 30000,
        timeoutMs: 5000,
        expectedStatus: 200,
      },
    ],
    codeTemplate: `export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname === "/health") return new Response("ok");
    return new Response("Fraud Detection Engine");
  },
};`,
  },

  "admin-dashboard": {
    name: "Admin Dashboard",
    description: "Monitoring and management portal",
    database: {
      name: "admin",
      tables: [
        {
          name: "audit_log",
          columns: [
            { name: "id", type: "INTEGER", primaryKey: true },
            { name: "action", type: "TEXT", nullable: false },
            { name: "actor", type: "TEXT", nullable: false },
            { name: "details", type: "TEXT" },
            { name: "created_at", type: "INTEGER", nullable: false },
          ],
          indexes: [{ name: "idx_actor", columns: ["actor"] }],
        },
      ],
      migrations: [],
    },
    bindings: [
      { name: "DB", type: "D1", resource: "admin-db" },
      { name: "CACHE", type: "KV", resource: "admin-cache" },
    ],
    integrations: [],
    auth: { type: "jwt", config: { issuer: "admin-dashboard" } },
    monitoring: [
      {
        systemId: "admin-dashboard",
        endpoint: "/health",
        intervalMs: 30000,
        timeoutMs: 5000,
        expectedStatus: 200,
      },
    ],
    codeTemplate: `export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname === "/health") return new Response("ok");
    return new Response("Admin Dashboard");
  },
};`,
  },

  "generic-api": {
    name: "Generic API",
    description: "A generic REST API endpoint",
    database: {
      name: "app",
      tables: [
        {
          name: "records",
          columns: [
            { name: "id", type: "INTEGER", primaryKey: true },
            { name: "data", type: "TEXT", nullable: false },
            { name: "created_at", type: "INTEGER", nullable: false },
            { name: "updated_at", type: "INTEGER", nullable: false },
          ],
          indexes: [],
        },
      ],
      migrations: [],
    },
    bindings: [{ name: "DB", type: "D1", resource: "app-db" }],
    integrations: [],
    auth: { type: "api-key", config: {} },
    monitoring: [
      {
        systemId: "generic-api",
        endpoint: "/health",
        intervalMs: 60000,
        timeoutMs: 5000,
        expectedStatus: 200,
      },
    ],
    codeTemplate: `export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname === "/health") return new Response("ok");
    return new Response("API");
  },
};`,
  },
};

export function selectTemplate(roleDescription: string): SystemTemplate {
  const desc = roleDescription.toLowerCase();
  if (desc.includes("payment") || desc.includes("transaction") || desc.includes("money")) {
    return SYSTEM_TEMPLATES["payment-gateway"];
  }
  if (desc.includes("kyc") || desc.includes("verification") || desc.includes("identity")) {
    return SYSTEM_TEMPLATES["kyc-service"];
  }
  if (
    desc.includes("notification") ||
    desc.includes("sms") ||
    desc.includes("email") ||
    desc.includes("push")
  ) {
    return SYSTEM_TEMPLATES["notification-service"];
  }
  if (desc.includes("fraud") || desc.includes("risk") || desc.includes("scoring")) {
    return SYSTEM_TEMPLATES["fraud-detection"];
  }
  if (desc.includes("admin") || desc.includes("dashboard") || desc.includes("monitor")) {
    return SYSTEM_TEMPLATES["admin-dashboard"];
  }
  return SYSTEM_TEMPLATES["generic-api"];
}
