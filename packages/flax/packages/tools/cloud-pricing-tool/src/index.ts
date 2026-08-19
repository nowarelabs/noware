import { WorkerEntrypoint } from "cloudflare:workers";

interface Env {
  // Tool-specific secrets and credentials are injected here as bindings.
  [key: string]: unknown;
}

interface InstanceType {
  provider: string;
  family: string;
  name: string;
  vcpus: number;
  memoryGb: number;
  gpu?: number;
  ratePerHour: number;
}

const INSTANCE_TYPES: InstanceType[] = [
  { provider: "aws", family: "general", name: "t4g.micro", vcpus: 2, memoryGb: 1, ratePerHour: 0.0084 },
  { provider: "aws", family: "general", name: "t3.micro", vcpus: 2, memoryGb: 1, ratePerHour: 0.0104 },
  { provider: "aws", family: "general", name: "t3.small", vcpus: 2, memoryGb: 2, ratePerHour: 0.0208 },
  { provider: "aws", family: "general", name: "t3.medium", vcpus: 2, memoryGb: 4, ratePerHour: 0.0416 },
  { provider: "aws", family: "general", name: "m5.large", vcpus: 2, memoryGb: 8, ratePerHour: 0.096 },
  { provider: "aws", family: "general", name: "m5.xlarge", vcpus: 4, memoryGb: 16, ratePerHour: 0.192 },
  { provider: "aws", family: "general", name: "m6i.large", vcpus: 2, memoryGb: 8, ratePerHour: 0.096 },
  { provider: "aws", family: "compute", name: "c5.large", vcpus: 2, memoryGb: 4, ratePerHour: 0.085 },
  { provider: "aws", family: "compute", name: "c5.xlarge", vcpus: 4, memoryGb: 8, ratePerHour: 0.17 },
  { provider: "aws", family: "compute", name: "c6i.large", vcpus: 2, memoryGb: 4, ratePerHour: 0.085 },
  { provider: "aws", family: "memory", name: "r5.large", vcpus: 2, memoryGb: 16, ratePerHour: 0.126 },
  { provider: "aws", family: "memory", name: "r5.xlarge", vcpus: 4, memoryGb: 32, ratePerHour: 0.252 },
  { provider: "aws", family: "gpu", name: "g4dn.xlarge", vcpus: 4, memoryGb: 16, gpu: 1, ratePerHour: 0.526 },
  { provider: "aws", family: "gpu", name: "g5.xlarge", vcpus: 4, memoryGb: 16, gpu: 1, ratePerHour: 1.006 },
  { provider: "azure", family: "general", name: "Standard_B2s", vcpus: 2, memoryGb: 4, ratePerHour: 0.0416 },
  { provider: "azure", family: "general", name: "Standard_D2s_v5", vcpus: 2, memoryGb: 8, ratePerHour: 0.096 },
  { provider: "azure", family: "general", name: "Standard_D4s_v5", vcpus: 4, memoryGb: 16, ratePerHour: 0.192 },
  { provider: "azure", family: "compute", name: "Standard_F2s_v2", vcpus: 2, memoryGb: 4, ratePerHour: 0.084 },
  { provider: "gcp", family: "general", name: "e2-micro", vcpus: 2, memoryGb: 1, ratePerHour: 0.0081 },
  { provider: "gcp", family: "general", name: "e2-small", vcpus: 2, memoryGb: 2, ratePerHour: 0.0167 },
  { provider: "gcp", family: "general", name: "e2-medium", vcpus: 2, memoryGb: 4, ratePerHour: 0.0335 },
  { provider: "gcp", family: "general", name: "n2-standard-2", vcpus: 2, memoryGb: 8, ratePerHour: 0.097 },
  { provider: "gcp", family: "compute", name: "n2-standard-4", vcpus: 4, memoryGb: 16, ratePerHour: 0.194 },
  { provider: "gcp", family: "gpu", name: "n1-standard-4", vcpus: 4, memoryGb: 15, gpu: 1, ratePerHour: 0.35 },
];

const REGION_MULTIPLIER: Record<string, number> = {
  "us-east-1": 1.0,
  "us-west-2": 1.0,
  "us-east-2": 1.0,
  "eu-west-1": 1.12,
  "eu-central-1": 1.13,
  "ap-southeast-1": 1.15,
  "ap-northeast-1": 1.15,
};

const HOURS_PER_MONTH = 730;

function findInstance(provider: string | undefined, name: string): InstanceType {
  const match = INSTANCE_TYPES.find((t) => t.name.toLowerCase() === name.toLowerCase());
  if (match) return match;
  if (provider) {
    const scoped = INSTANCE_TYPES.filter((t) => t.provider === provider);
    if (scoped.length) return scoped[0];
  }
  throw new Error(`unknown instance type "${name}"`);
}

function cheapestFor(provider: string | undefined, vcpus: number, memoryGb: number, gpu?: number): InstanceType {
  const candidates = INSTANCE_TYPES.filter(
    (t) => (!provider || t.provider === provider) && t.vcpus >= vcpus && t.memoryGb >= memoryGb && (!gpu || (t.gpu ?? 0) >= gpu),
  );
  if (candidates.length === 0) {
    throw new Error(`no instance type satisfies ${vcpus} vCPU / ${memoryGb} GB${gpu ? ` / ${gpu} GPU` : ""}`);
  }
  return candidates.sort((a, b) => a.ratePerHour - b.ratePerHour)[0];
}

interface WorkloadShape {
  instanceType?: string;
  vcpus?: number;
  memoryGb?: number;
  gpu?: number;
  count?: number;
  hours?: number;
}

export class CloudPricingTool extends WorkerEntrypoint<Env> {
  async estimateCost(input: { workload: unknown; provider?: string; region?: string }): Promise<{ estimatedMonthlyCost: number }> {
    const workload = (input.workload ?? {}) as WorkloadShape;
    const regionMultiplier = REGION_MULTIPLIER[input.region ?? "us-east-1"] ?? 1.0;

    const instance = workload.instanceType
      ? findInstance(input.provider, workload.instanceType)
      : cheapestFor(input.provider, workload.vcpus ?? 2, workload.memoryGb ?? 4, workload.gpu);

    const count = workload.count ?? 1;
    const hours = workload.hours ?? HOURS_PER_MONTH;
    const monthly = instance.ratePerHour * regionMultiplier * count * hours;

    return {
      estimatedMonthlyCost: Math.round(monthly * 100) / 100,
      ...(monthly > 0 ? { instance: instance.name, ratePerHour: instance.ratePerHour, region: input.region ?? "us-east-1", count, hours } : {}),
    } as any;
  }

  async compareInstanceTypes(input: { workload: unknown; instanceTypes: string[] }): Promise<unknown> {
    const workload = (input.workload ?? {}) as WorkloadShape;
    const count = workload.count ?? 1;
    const hours = workload.hours ?? HOURS_PER_MONTH;
    const regionMultiplier = REGION_MULTIPLIER["us-east-1"];

    const rows = input.instanceTypes.map((name) => {
      const instance = findInstance(undefined, name);
      return {
        name: instance.name,
        provider: instance.provider,
        vcpus: instance.vcpus,
        memoryGb: instance.memoryGb,
        gpu: instance.gpu ?? 0,
        ratePerHour: instance.ratePerHour,
        estimatedMonthlyCost: Math.round(instance.ratePerHour * regionMultiplier * count * hours * 100) / 100,
      };
    });

    return {
      sortedByCostAsc: rows.sort((a, b) => a.estimatedMonthlyCost - b.estimatedMonthlyCost),
      count,
      hours,
    };
  }
}

export default {
  async fetch(): Promise<Response> {
    return new Response(
      "This worker is only callable via RPC service binding.",
      { status: 400 },
    );
  },
};
