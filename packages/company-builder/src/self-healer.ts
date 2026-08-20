import type { HealthCheck } from "@nowarelabs/shared";
import { HealthChecker, AlertManager } from "@nowarelabs/system-builder";

export type RecoveryLevel = "restart" | "rollback" | "rebuild" | "alert";

export interface RecoveryAction {
  systemId: string;
  level: RecoveryLevel;
  timestamp: number;
  success: boolean;
  details: string;
}

export interface FailurePattern {
  systemId: string;
  failureType: string;
  count: number;
  lastOccurred: number;
  recoveryActions: RecoveryAction[];
}

export class SelfHealer {
  private healthChecker: HealthChecker;
  private alertManager: AlertManager;
  private failurePatterns: Map<string, FailurePattern> = new Map();
  private recoveryHistory: RecoveryAction[] = [];

  constructor() {
    this.healthChecker = new HealthChecker();
    this.alertManager = new AlertManager();
  }

  async monitor(healthChecks: HealthCheck[]): Promise<{ systemId: string; healthy: boolean }[]> {
    const results: { systemId: string; healthy: boolean }[] = [];
    for (const check of healthChecks) {
      const result = await this.healthChecker.check(check);
      results.push({ systemId: check.systemId, healthy: result.healthy });
      if (!result.healthy) {
        await this.heal(check.systemId);
      }
    }
    return results;
  }

  async heal(systemId: string): Promise<RecoveryAction> {
    const pattern = this.failurePatterns.get(systemId);
    const attemptCount = pattern?.count ?? 0;

    let level: RecoveryLevel;
    if (attemptCount === 0) level = "restart";
    else if (attemptCount === 1) level = "rollback";
    else if (attemptCount === 2) level = "rebuild";
    else level = "alert";

    const action: RecoveryAction = {
      systemId,
      level,
      timestamp: Date.now(),
      success: level !== "alert",
      details: `Recovery attempt ${attemptCount + 1}: ${level}`,
    };

    this.recoveryHistory.push(action);

    if (!pattern) {
      this.failurePatterns.set(systemId, {
        systemId,
        failureType: "health-check",
        count: 1,
        lastOccurred: Date.now(),
        recoveryActions: [action],
      });
    } else {
      pattern.count += 1;
      pattern.lastOccurred = Date.now();
      pattern.recoveryActions.push(action);
    }

    return action;
  }

  async scale(_systemId: string, _replicas: number): Promise<void> {
    // Placeholder for auto-scaling logic
  }

  async rollback(_systemId: string): Promise<void> {
    // Placeholder for rollback logic
  }

  getFailurePatterns(): FailurePattern[] {
    return [...this.failurePatterns.values()];
  }

  getRecoveryHistory(systemId?: string): RecoveryAction[] {
    if (systemId) return this.recoveryHistory.filter((a) => a.systemId === systemId);
    return [...this.recoveryHistory];
  }

  get healthChecker_() {
    return this.healthChecker;
  }
  get alertManager_() {
    return this.alertManager;
  }
}
