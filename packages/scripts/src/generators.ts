export const WORKFLOW_TEMPLATE = (
  name: string,
) => `import { BaseWorkflow } from "nomo/entrypoints";
import { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { JobDispatcher } from "nomo/jobs";
import { JobRegistry } from "../jobs";

const dispatcher = new JobDispatcher(JobRegistry);

export class ${name} extends BaseWorkflow<Env, any> {
    async run(event: WorkflowEvent<any>, step: WorkflowStep) {
        await dispatcher.handleWorkflow(event, step);
    }
}
`;

export const DO_TEMPLATE = (
  name: string,
) => `import { DurableObject } from "cloudflare:workers";

export class ${name} extends DurableObject {
    constructor(state: DurableObjectState, env: Env) {
        super(state, env);
    }

    async fetch(request: Request): Promise<Response> {
        return new Response("Hello from ${name}");
    }
}
`;

/**
 * Converts a PascalCase name to CAPITAL_SNAKE_CASE,
 * treating common acronyms (like DO) as single words.
 */
export function toBindingName(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
    .toUpperCase();
}

/**
 * Ensures a name has the target suffix, and handles shorthands.
 * e.g. "User" -> "UserWorkflow"
 * e.g. "UserDO" -> "UserDurableObject"
 */
export function ensureSuffix(name: string, suffix: string): string {
  if (suffix === "DurableObject" && name.endsWith("DO")) {
    return name.slice(0, -2) + "DurableObject";
  }
  if (suffix === "Workflow" && name.endsWith("Wf")) {
    return name.slice(0, -2) + "Workflow";
  }
  if (name.endsWith(suffix)) return name;
  return name + suffix;
}

export function patchWranglerConfig(
  content: string,
  type: "workflow" | "do",
  name: string,
): string {
  const bindingName = toBindingName(name);

  if (type === "workflow") {
    const workflowBinding = {
      name: bindingName,
      binding: bindingName,
      class_name: name,
    };

    const workflowMatch = content.match(/"workflows":\s*\[/);
    if (workflowMatch) {
      const insertPos = workflowMatch.index! + workflowMatch[0].length;
      const jsonStr = `\n\t\t\t{\n\t\t\t\t"name": "${bindingName}",\n\t\t\t\t"binding": "${bindingName}",\n\t\t\t\t"class_name": "${name}"\n\t\t\t},`;
      return content.slice(0, insertPos) + jsonStr + content.slice(insertPos);
    }
  } else if (type === "do") {
    const doBinding = {
      class_name: name,
      name: bindingName,
    };

    const doMatch = content.match(/"durable_objects":\s*{\s*"bindings":\s*\[/);
    if (doMatch) {
      const insertPos = doMatch.index! + doMatch[0].length;
      const jsonStr = `\n\t\t\t\t{\n\t\t\t\t\t"class_name": "${name}",\n\t\t\t\t\t"name": "${bindingName}"\n\t\t\t\t},`;
      return content.slice(0, insertPos) + jsonStr + content.slice(insertPos);
    }
  }

  return content;
}
