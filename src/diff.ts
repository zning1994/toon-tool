import { readFileSync } from "fs";
import { toon2json } from "./toon2json.js";

type FileType = "toon" | "json" | "auto";

function detectType(file: string, hint: FileType): FileType {
  if (hint !== "auto") return hint;
  if (file.endsWith(".toon")) return "toon";
  if (file.endsWith(".json")) return "json";
  return "toon";
}

function loadFile(file: string): string {
  return readFileSync(file, "utf8");
}

function normalize(val: string, type: FileType): string {
  if (type === "toon") {
    try {
      return JSON.stringify(JSON.parse(toon2json(val)), null, 2);
    } catch {
      return val;
    }
  }
  try {
    return JSON.stringify(JSON.parse(val), null, 2);
  } catch {
    return val;
  }
}

export function diff(file1: string, file2: string, hint: FileType = "auto"): string {
  const type1 = detectType(file1, hint);
  const type2 = detectType(file2, hint);

  const src1 = loadFile(file1);
  const src2 = loadFile(file2);

  const norm1 = normalize(src1, type1);
  const norm2 = normalize(src2, type2);

  if (norm1 === norm2) {
    return `✓ Files are semantically identical (both as ${type1})`;
  }

  const lines1 = norm1.split("\n");
  const lines2 = norm2.split("\n");
  const maxLines = Math.max(lines1.length, lines2.length);

  const output: string[] = [];
  let hasDiff = false;

  for (let i = 0; i < maxLines; i++) {
    const l1 = lines1[i] ?? "";
    const l2 = lines2[i] ?? "";
    if (l1 !== l2) {
      hasDiff = true;
      if (l1) output.push(`- ${l1}`);
      if (l2) output.push(`+ ${l2}`);
    } else {
      output.push(`  ${l1}`);
    }
  }

  return output.join("\n") + (hasDiff ? "\n\n(Diff above: - = file1, + = file2)" : "");
}
