import { describe, it, expect } from "vitest";
import { parseField, pluralize } from "../scaffold";

describe("Scaffold Generator Helpers", () => {
  describe("parseField", () => {
    it("parses simple string field", () => {
      const field = parseField("name:string");
      expect(field).toEqual({
        name: "name",
        type: "string",
        options: {},
      });
    });

    it("parses field with modifiers", () => {
      const field = parseField("title:string:notNull:unique:index");
      expect(field).toEqual({
        name: "title",
        type: "string",
        options: {
          notNull: true,
          unique: true,
          index: true,
        },
      });
    });

    it("parses field with default and numeric modifiers", () => {
      const field = parseField("price:decimal:precision=10:scale=2:default=0");
      expect(field).toEqual({
        name: "price",
        type: "decimal",
        options: {
          precision: 10,
          scale: 2,
          default: "0",
        },
      });
    });

    it("parses references with onDelete", () => {
      const field = parseField("owner_id:text:references=users:onDelete=cascade");
      expect(field).toEqual({
        name: "owner_id",
        type: "text",
        options: {
          references: "users",
          onDelete: "cascade",
        },
      });
    });

    it("parses relationship-only tokens", () => {
      expect(parseField(":hasMunknown=comments")).toEqual({
        name: "",
        type: "hasMunknown=comments",
        options: {},
        relationship: { type: "hasMunknown", target: "comments" },
      });
      expect(parseField(":belongsTo=user")).toEqual({
        name: "",
        type: "belongsTo=user",
        options: {},
        relationship: { type: "belongsTo", target: "user" },
      });
    });
  });

  describe("pluralize", () => {
    it("pluralizes common nouns", () => {
      expect(pluralize("Post")).toBe("Posts");
      expect(pluralize("User")).toBe("Users");
    });

    it("handles -y suffix", () => {
      expect(pluralize("Category")).toBe("Categories");
      expect(pluralize("Company")).toBe("Companies");
    });

    it("handles -s suffix", () => {
      expect(pluralize("Address")).toBe("Addresses");
      expect(pluralize("Process")).toBe("Processes");
    });
  });
});
