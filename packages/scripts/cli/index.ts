#!/usr/bin/env node
import { Command } from "commander";
import { workflowCommand } from "./workflow";
import { doCommand } from "./do";

const program = new Command();

program
  .name("nbb")
  .description("Rails-like generators for nomo applications")
  .version("1.0.0");

program.addCommand(workflowCommand);
program.addCommand(doCommand);

program.parse();
