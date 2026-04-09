#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
import { initCommand } from "./init";
import { generateCommand } from "./generate";
import { compileCommand } from "./compile";
import { reflectCommand } from "./reflect";
import { bundleCommand } from "./bundle";
import { scaffoldCommand } from "./scaffold";
import { migrateCommand } from "./migrate";
import { rollbackCommand } from "./rollback";
import { syncCommand } from "./sync";
import { statusCommand } from "./status";
import { resetCommand } from "./reset";

const main = defineCommand({
  meta: {
    name: "nomo-migrate",
    version: "1.0.0",
    description: "Migrations DSL for nomo applications",
  },
  subCommands: {
    init: initCommand,
    generate: generateCommand,
    compile: compileCommand,
    reflect: reflectCommand,
    bundle: bundleCommand,
    scaffold: scaffoldCommand,
    migrate: migrateCommand,
    rollback: rollbackCommand,
    sync: syncCommand,
    status: statusCommand,
    reset: resetCommand,
  },
});

runMain(main);
