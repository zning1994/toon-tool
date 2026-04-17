#!/usr/bin/env node
import { Command } from "commander";
import * as fs from "fs";
import { toon2json } from "./toon2json.js";
import { json2toon } from "./json2toon.js";
import { validateToon } from "./validator.js";
import { diff } from "./diff.js";

function readInput(file?: string): string {
  if (file) return fs.readFileSync(file, "utf8");
  // Read from stdin via fd 0 — works on Windows, macOS, Linux
  if (!process.stdin.isTTY) {
    return fs.readFileSync(0, "utf8");
  }
  throw new Error("No input provided. Pass a file or pipe data via stdin.");
}

const program = new Command();

program
  .name("toon")
  .description("TOON format CLI — convert, validate, diff")
  .version("0.1.0");

// toon → json
program
  .command("tojson [file]")
  .description("Convert TOON to JSON (stdin if no file)")
  .option("-o, --out <file>", "output file")
  .action((file, opts) => {
    try {
      const src = readInput(file);
      const result = toon2json(src);
      if (opts.out) {
        fs.writeFileSync(opts.out, result, "utf8");
      } else {
        console.log(result);
      }
    } catch (e: unknown) {
      console.error("Error:", e instanceof Error ? e.message : String(e));
      process.exit(1);
    }
  });

// json → toon
program
  .command("json [file]")
  .description("Convert JSON to TOON (stdin if no file)")
  .option("-o, --out <file>", "output file")
  .action((file, opts) => {
    try {
      const src = readInput(file);
      const result = json2toon(src);
      if (opts.out) {
        fs.writeFileSync(opts.out, result, "utf8");
      } else {
        console.log(result);
      }
    } catch (e: unknown) {
      console.error("Error:", e instanceof Error ? e.message : String(e));
      process.exit(1);
    }
  });

// validate
program
  .command("validate [file]")
  .description("Validate TOON syntax")
  .option("-j, --json", "validate JSON instead")
  .action((file, opts) => {
    try {
      const src = readInput(file);
      if (opts.json) {
        JSON.parse(src);
        console.log("✓ Valid JSON");
      } else {
        const { valid, errors } = validateToon(src);
        if (valid) {
          console.log("✓ Valid TOON");
        } else {
          errors.forEach((err) => console.error("✗", err));
          process.exit(1);
        }
      }
    } catch (e: unknown) {
      console.error("Error:", e instanceof Error ? e.message : String(e));
      process.exit(1);
    }
  });

// diff
program
  .command("diff <file1> <file2>")
  .description("Diff two TOON or JSON files (auto-detect by extension)")
  .option("-t, --type <type>", "force type: toon|json", "auto")
  .action((file1, file2, opts) => {
    try {
      const result = diff(file1, file2, opts.type as "toon" | "json" | "auto");
      console.log(result);
    } catch (e: unknown) {
      console.error("Error:", e instanceof Error ? e.message : String(e));
      process.exit(1);
    }
  });

program.parse();
