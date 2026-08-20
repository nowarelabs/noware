import type {
  CompanyDescription,
  DepartmentDescription,
  TeamDescription,
  RoleDescription,
} from "@nowarelabs/shared";

export class CompanyParser {
  parse(description: string): CompanyDescription {
    const lines = description
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const firstLine = lines[0] ?? "";
    const nameMatch = firstLine.match(/^(?:build|create|start)\s+(?:a\s+)?(.+?)(?:\s+company)?$/i);
    const name = nameMatch ? nameMatch[1].trim() : "Unnamed Company";

    const industryMatch = description.match(/industry[:\s]+(.+?)(?:\n|$)/i);
    const industry = industryMatch ? industryMatch[1].trim() : "technology";

    const departments = this.extractDepartments(lines);

    return { name, industry, description, departments };
  }

  private extractDepartments(lines: string[]): DepartmentDescription[] {
    const departments: DepartmentDescription[] = [];
    let currentDept: DepartmentDescription | null = null;
    let currentTeam: TeamDescription | null = null;

    for (const line of lines) {
      const deptMatch = line.match(/^(?:department|division|area)[:\s]+(.+)/i);
      if (deptMatch) {
        currentDept = { name: deptMatch[1].trim(), description: "", teams: [] };
        departments.push(currentDept);
        currentTeam = null;
        continue;
      }

      const teamMatch = line.match(/^(?:team|group)[:\s]+(.+)/i);
      if (teamMatch && currentDept) {
        currentTeam = { name: teamMatch[1].trim(), description: "", roles: [] };
        currentDept.teams.push(currentTeam);
        continue;
      }

      const roleMatch = line.match(/^(?:role|position)[:\s]+(.+)/i);
      if (roleMatch && currentTeam) {
        const role: RoleDescription = {
          name: roleMatch[1].trim(),
          description: "",
          capabilities: [],
        };
        currentTeam.roles.push(role);
        continue;
      }

      const capMatch = line.match(/^(?:capability|skill)[:\s]+(.+)/i);
      if (capMatch && currentTeam) {
        if (currentTeam.roles.length === 0) {
          currentTeam.roles.push({ name: "General", description: "", capabilities: [] });
        }
        currentTeam.roles[currentTeam.roles.length - 1].capabilities.push(capMatch[1].trim());
      }
    }

    if (departments.length === 0) {
      departments.push({
        name: "Engineering",
        description: "Core engineering",
        teams: [
          {
            name: "Platform",
            description: "Platform team",
            roles: [
              {
                name: "Engineer",
                description: "Software engineer",
                capabilities: ["coding", "testing"],
              },
            ],
          },
        ],
      });
    }

    return departments;
  }
}
