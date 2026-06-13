#!/usr/bin/env bun
/**
 * describe-frames.ts — Vision-describe images using Claude or Gemini.
 *
 * Usage:
 *   bun describe-frames.ts [options] [file1.png file2.jpg ...]
 *
 * If no files are passed, defaults to ./snapshots/contact-sheet.jpg,
 * then falls back to all *.png in ./snapshots/.
 *
 * Options:
 *   --provider    claude | gemini              (default: gemini)
 *   --model       model name                  (default: per provider)
 *   --prompt      custom question to ask      (default: built-in)
 *   --system      system prompt               (optional)
 *   --dir         snapshots directory          (default: ./snapshots)
 *   --output      output file path            (default: <dir>/descriptions.md)
 *   --base-url    API base URL override       (reads env if not set)
 *   --api-key     API key override            (reads env if not set)
 *   --max-tokens  max response tokens         (default: 300)
 *   --glob        file pattern                (default: contact-sheet.jpg)
 *
 * Env vars:
 *   GEMINI_API_KEY / GOOGLE_GEMINI_BASE_URL   — for Gemini
 *   ANTHROPIC_API_KEY / ANTHROPIC_BASE_URL    — for Claude
 *   VISION_API_KEY / VISION_BASE_URL          — generic fallback for either
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join, basename, resolve } from "path";
import { parseArgs } from "util";

// --- Parse args ---

const { values: args, positionals } = parseArgs({
  options: {
    provider: { type: "string", default: "gemini" },
    model: { type: "string" },
    prompt: { type: "string" },
    system: { type: "string" },
    dir: { type: "string", default: "./snapshots" },
    output: { type: "string" },
    "base-url": { type: "string" },
    "api-key": { type: "string" },
    "max-tokens": { type: "string", default: "300" },
    glob: { type: "string" },
    help: { type: "boolean", default: false },
  },
  allowPositionals: true,
});

if (args.help) {
  console.log(`Usage: bun describe-frames.ts [options] [file1.png file2.jpg ...]

Pass specific files as positional args, or let it auto-detect.
Default: uses contact-sheet.jpg if it exists, else all *.png.

Options:
  --provider    claude | gemini    (default: gemini)
  --model       model name
  --prompt      question to ask about each frame
  --system      system prompt
  --dir         snapshots directory (default: ./snapshots)
  --output      output markdown path
  --base-url    API base URL
  --api-key     API key
  --max-tokens  max tokens (default: 300)
  --glob        file pattern (overrides auto-detect)

Examples:
  bun describe-frames.ts
  bun describe-frames.ts snapshots/frame-03*.png
  bun describe-frames.ts --provider claude --model claude-opus-4-6 frame.png
  bun describe-frames.ts --prompt "Is the logo visible?" --glob "*.jpg"
`);
  process.exit(0);
}

// --- Config ---

const provider = (args.provider || "gemini") as "claude" | "gemini";
const maxTokens = parseInt(args["max-tokens"] || "300", 10);
const snapshotDir = args.dir || "./snapshots";
const outputPath = args.output || join(snapshotDir, "descriptions.md");

const defaultPrompt =
  "Describe this video composition frame in 1-2 sentences. Be specific and factual: what elements are visible, what text appears, is the frame blank/black/loading, what is the composition. Flag any obvious problems.";

const prompt = args.prompt || defaultPrompt;
const systemPrompt = args.system || undefined;

function getEnv(...keys: string[]): string | undefined {
  for (const k of keys) {
    if (process.env[k]) return process.env[k];
  }
  return undefined;
}

const apiKey =
  args["api-key"] ||
  (provider === "claude"
    ? getEnv("ANTHROPIC_API_KEY", "VISION_API_KEY")
    : getEnv("GEMINI_API_KEY", "GOOGLE_API_KEY", "VISION_API_KEY"));

const baseUrl =
  args["base-url"] ||
  (provider === "claude"
    ? getEnv("ANTHROPIC_BASE_URL", "VISION_BASE_URL") || "https://api.anthropic.com"
    : getEnv("GOOGLE_GEMINI_BASE_URL", "VISION_BASE_URL") || "https://generativelanguage.googleapis.com");

const model =
  args.model ||
  (provider === "claude" ? "claude-sonnet-4-6" : "gemini-3.1-flash-lite");

// --- Validate ---

if (!apiKey) {
  console.error(
    `Error: No API key found. Set ${provider === "claude" ? "ANTHROPIC_API_KEY" : "GEMINI_API_KEY"} or pass --api-key`
  );
  process.exit(1);
}

// --- Resolve files ---

function matchGlob(filename: string, pattern: string): boolean {
  const regex = new RegExp(
    "^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*").replace(/\?/g, ".") + "$"
  );
  return regex.test(filename);
}

interface FileEntry {
  path: string;
  name: string;
}

function resolveFiles(): FileEntry[] {
  // 1. Positional args — explicit file paths
  if (positionals.length > 0) {
    const entries: FileEntry[] = [];
    for (const p of positionals) {
      const resolved = resolve(p);
      if (!existsSync(resolved)) {
        console.error(`File not found: ${p}`);
        process.exit(1);
      }
      entries.push({ path: resolved, name: basename(resolved) });
    }
    return entries;
  }

  // 2. --glob was explicitly passed
  if (args.glob) {
    if (!existsSync(snapshotDir)) {
      console.error(`Directory not found: ${snapshotDir}`);
      process.exit(1);
    }
    return readdirSync(snapshotDir)
      .filter((f) => matchGlob(f, args.glob!))
      .sort()
      .map((f) => ({ path: join(snapshotDir, f), name: f }));
  }

  // 3. Default: contact-sheet.jpg if it exists
  const contactSheet = join(snapshotDir, "contact-sheet.jpg");
  if (existsSync(contactSheet)) {
    return [{ path: contactSheet, name: "contact-sheet.jpg" }];
  }

  // 4. Fallback: all *.png in dir
  if (!existsSync(snapshotDir)) {
    console.error(`Directory not found: ${snapshotDir}`);
    process.exit(1);
  }
  return readdirSync(snapshotDir)
    .filter((f) => f.endsWith(".png"))
    .sort()
    .map((f) => ({ path: join(snapshotDir, f), name: f }));
}

const files = resolveFiles();

if (files.length === 0) {
  console.error(`No files found. Pass files as args or check ${snapshotDir}/`);
  process.exit(1);
}

console.log(`Provider: ${provider} | Model: ${model}`);
console.log(`Files: ${files.length} (${files.map((f) => f.name).join(", ").slice(0, 60)})`);
console.log(`Prompt: ${prompt.slice(0, 60)}...`);
console.log("");

// --- API calls ---

async function describeWithGemini(imageBase64: string, mimeType: string): Promise<string> {
  const url = `${baseUrl}/v1beta/models/${model}:generateContent`;

  const body: any = {
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType, data: imageBase64 } },
          { text: prompt },
        ],
      },
    ],
    generationConfig: { maxOutputTokens: maxTokens },
  };

  if (systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey!,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!parts) return "no description";

  // Filter out thought parts
  const textParts = parts.filter(
    (p: any) => typeof p.text === "string" && !p.thought
  );
  return textParts.map((p: any) => p.text).join("").trim() || "no description";
}

async function describeWithClaude(imageBase64: string, mimeType: string): Promise<string> {
  const url = `${baseUrl}/v1/messages`;

  const body: any = {
    model,
    max_tokens: maxTokens,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType,
              data: imageBase64,
            },
          },
          { type: "text", text: prompt },
        ],
      },
    ],
  };

  if (systemPrompt) {
    body.system = systemPrompt;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data?.content
    ?.filter((c: any) => c.type === "text")
    .map((c: any) => c.text)
    .join("")
    .trim();

  return text || "no description";
}

function getMimeType(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/png";
}

async function describeFrame(filePath: string): Promise<string> {
  const raw = readFileSync(filePath);
  const mimeType = getMimeType(filePath);
  const base64 = raw.toString("base64");

  if (provider === "claude") {
    return describeWithClaude(base64, mimeType);
  } else {
    return describeWithGemini(base64, mimeType);
  }
}

// --- Main ---

async function main() {
  const lines: string[] = [
    "# Snapshot Frame Descriptions",
    "",
    `**Provider:** ${provider} | **Model:** ${model}`,
    `**Question:** ${prompt}`,
    "",
  ];

  let success = 0;
  let errors = 0;

  for (const file of files) {
    process.stdout.write(`  ${file.name} ... `);

    try {
      const desc = await describeFrame(file.path);
      lines.push(`## ${file.name}`, desc, "");
      console.log("OK");
      success++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lines.push(`## ${file.name}`, `(error) ${msg.slice(0, 150)}`, "");
      console.log(`ERROR: ${msg.slice(0, 80)}`);
      errors++;
    }
  }

  writeFileSync(outputPath, lines.join("\n"));
  console.log(`\nDone: ${success} described, ${errors} errors`);
  console.log(`Output: ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
