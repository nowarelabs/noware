import type { HealthCheck, AlertRule } from "@nowarelabs/shared";

export interface HealthCheckResult {
  systemId: string;
  endpoint: string;
  status: number;
  responseTime: number;
  timestamp: number;
  healthy: boolean;
}

export interface AlertEvent {
  ruleId: string;
  condition: string;
  action: string;
  systemId: string;
  timestamp: number;
  details: string;
}

export class HealthChecker {
  private results: Map<string, HealthCheckResult[]> = new Map();

  async check(healthCheck: HealthCheck): Promise<HealthCheckResult> {
    const startTime = Date.now();
    // Mock health check (in production this would be an actual HTTP request)
    const result: HealthCheckResult = {
      systemId: healthCheck.systemId,
      endpoint: healthCheck.endpoint,
      status: 200,
      responseTime: Date.now() - startTime,
      timestamp: Date.now(),
      healthy: true,
    };

    const results = this.results.get(healthCheck.systemId) ?? [];
    results.push(result);
    this.results.set(healthCheck.systemId, results);

    return result;
  }

  getResults(systemId: string): HealthCheckResult[] {
    return [...(this.results.get(systemId) ?? [])];
  }

  getLatestResult(systemId: string): HealthCheckResult | undefined {
    const results = this.results.get(systemId);
    return results?.[results.length - 1];
  }

  isHealthy(systemId: string): boolean {
    const latest = this.getLatestResult(systemId);
    return latest?.healthy ?? false;
  }

  getUnhealthySystems(): string[] {
    const unhealthy: string[] = [];
    for (const [systemId] of this.results) {
      if (!this.isHealthy(systemId)) unhealthy.push(systemId);
    }
    return unhealthy;
  }
}

export class AlertManager {
  private rules: Map<string, AlertRule> = new Map();
  private events: AlertEvent[] = [];
  private lastTriggered: Map<string, number> = new Map();

  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
  }

  evaluate(
    systemId: string,
    metrics: { errorRate?: number; latency?: number; availability?: number },
  ): AlertEvent[] {
    const triggered: AlertEvent[] = [];
    const now = Date.now();

    for (const [, rule] of this.rules) {
      const lastTrigger = this.lastTriggered.get(rule.id) ?? 0;
      if (now - lastTrigger < rule.cooldown) continue;

      const matches = this.evaluateCondition(rule.condition, metrics);
      if (matches) {
        const event: AlertEvent = {
          ruleId: rule.id,
          condition: rule.condition,
          action: rule.action,
          systemId,
          timestamp: now,
          details: `Condition "${rule.condition}" met for system ${systemId}`,
        };
        this.events.push(event);
        this.lastTriggered.set(rule.id, now);
        triggered.push(event);
      }
    }

    return triggered;
  }

  private evaluateCondition(
    condition: string,
    metrics: { errorRate?: number; latency?: number; availability?: number },
  ): boolean {
    const match = condition.match(/(\w+)\s*([><=!]+)\s*([\d.]+)/);
    if (!match) return false;
    const [, field, op, value] = match;
    const metricValue = metrics[field as keyof typeof metrics] ?? 0;
    const threshold = parseFloat(value);
    switch (op) {
      case ">":
        return metricValue > threshold;
      case "<":
        return metricValue < threshold;
      case ">=":
        return metricValue >= threshold;
      case "<=":
        return metricValue <= threshold;
      case "==":
        return metricValue === threshold;
      case "!=":
        return metricValue !== threshold;
      default:
        return false;
    }
  }

  getEvents(systemId?: string): AlertEvent[] {
    if (systemId) return this.events.filter((e) => e.systemId === systemId);
    return [...this.events];
  }

  getRules(): AlertRule[] {
    return [...this.rules.values()];
  }
}

export class MetricsCollector {
  private metrics: Map<string, Array<{ name: string; value: number; timestamp: number }>> =
    new Map();

  record(systemId: string, name: string, value: number): void {
    const systemMetrics = this.metrics.get(systemId) ?? [];
    systemMetrics.push({ name, value, timestamp: Date.now() });
    this.metrics.set(systemId, systemMetrics);
  }

  getMetrics(
    systemId: string,
    name?: string,
  ): Array<{ name: string; value: number; timestamp: number }> {
    const systemMetrics = this.metrics.get(systemId) ?? [];
    if (name) return systemMetrics.filter((m) => m.name === name);
    return [...systemMetrics];
  }

  getLatest(systemId: string, name: string): number | undefined {
    const metrics = this.getMetrics(systemId, name);
    return metrics[metrics.length - 1]?.value;
  }

  getAverage(systemId: string, name: string, windowMs: number = 60000): number {
    const now = Date.now();
    const metrics = this.getMetrics(systemId, name).filter((m) => now - m.timestamp < windowMs);
    if (metrics.length === 0) return 0;
    return metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length;
  }
}
