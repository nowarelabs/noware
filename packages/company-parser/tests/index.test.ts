import { describe, expect, test } from "vite-plus/test";
import { CompanyParser } from "../src/parser";
import { CfourModelGenerator } from "../src/cfour-generator";

describe("CompanyParser", () => {
  test("parses company description", () => {
    const parser = new CompanyParser();
    const result = parser.parse(
      "Build a payment processing company\nDepartment: Engineering\nTeam: Backend\nRole: Payment Gateway\ncapability: process payments\nRole: API Gateway\ncapability: route requests",
    );
    expect(result.name).toBe("payment processing");
    expect(result.departments.length).toBe(1);
    expect(result.departments[0].name).toBe("Engineering");
    expect(result.departments[0].teams.length).toBe(1);
    expect(result.departments[0].teams[0].roles.length).toBe(2);
  });

  test("provides defaults for missing sections", () => {
    const parser = new CompanyParser();
    const result = parser.parse("Build a simple app");
    expect(result.departments.length).toBe(1);
    expect(result.departments[0].name).toBe("Engineering");
  });

  test("extracts capabilities", () => {
    const parser = new CompanyParser();
    const result = parser.parse(
      "Build a company\nDepartment: Sales\nTeam: Outreach\ncapability: cold calling\ncapability: email campaigns",
    );
    const role = result.departments[0].teams[0].roles[0];
    expect(role.capabilities).toEqual(["cold calling", "email campaigns"]);
  });
});

describe("CfourModelGenerator", () => {
  test("generates model from description", () => {
    const parser = new CompanyParser();
    const gen = new CfourModelGenerator();
    const desc = parser.parse(
      "Build a payment company\nDepartment: Engineering\nTeam: Backend\nRole: Gateway",
    );
    const model = gen.generate(desc);
    expect(model.softwareSystems.length).toBe(1);
    expect(model.containers.length).toBe(1);
    expect(model.components.length).toBe(1);
    expect(model.relationships.length).toBe(2);
  });

  test("generates multiple departments", () => {
    const parser = new CompanyParser();
    const gen = new CfourModelGenerator();
    const desc = parser.parse(
      "Build a company\nDepartment: Engineering\nTeam: Backend\nRole: API\nDepartment: Sales\nTeam: Outreach\nRole: Rep",
    );
    const model = gen.generate(desc);
    expect(model.softwareSystems.length).toBe(2);
    expect(model.containers.length).toBe(2);
  });
});
