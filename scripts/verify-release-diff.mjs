#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const headRef = process.env.GITHUB_HEAD_REF || process.env.RELEASE_HEAD_REF || "";
const baseRef = process.env.GITHUB_BASE_REF || process.env.RELEASE_BASE_REF || "main";
const compare = headRef ? `origin/${baseRef}...HEAD` : "HEAD^...HEAD";

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

const files = git(["diff", "--name-only", compare]).trim().split("\n").filter(Boolean);
const publishedFiles = files.filter((file) =>
  file === "README.md"
    || file.startsWith("payloads/")
    || file === "stash/apple-video-subtitles.stoverride"
    || file === "shadowrocket/apple-video-subtitles.module"
    || file === "surge/apple-video-subtitles.sgmodule"
);
const diff = publishedFiles.length
  ? git(["diff", "--unified=0", compare, "--", ...publishedFiles])
  : "";
const addedLines = diff.split("\n").filter((line) => line.startsWith("+") && !line.startsWith("+++"));
const errors = [];

for (const line of addedLines) {
  if (/\/Users\/|\blocalhost\b|\b(?:10|127|169\.254|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}\b/.test(line)) {
    errors.push(`release diff contains a local/private reference: ${line.slice(0, 180)}`);
  }
}

if (/^release\//.test(headRef)) {
  const modules = new Set([
    "stash/apple-video-subtitles.stoverride",
    "shadowrocket/apple-video-subtitles.module",
    "surge/apple-video-subtitles.sgmodule",
  ]);
  const allowed = files.every((file) => file === "README.md" || file.startsWith("payloads/") || modules.has(file));
  if (!allowed) errors.push("release branch changes files outside README, payloads, and the three formal modules");

  const payloadFiles = files.filter((file) => file.startsWith("payloads/"));
  const moduleFiles = files.filter((file) => modules.has(file));
  const presentationFiles = files.filter((file) => file === "README.md");

  if (payloadFiles.length && (moduleFiles.length || presentationFiles.length)) {
    errors.push("squash release contract violated: payload PR must not also change modules or README");
  }
  if (moduleFiles.length && moduleFiles.length !== modules.size) {
    errors.push("all-platform module PR must update all three formal modules together");
  }
  if (!payloadFiles.length && !moduleFiles.length) {
    errors.push("release branch contains neither a payload stage nor a module stage");
  }
}

console.log(JSON.stringify({
  pass: errors.length === 0,
  headRef: headRef || null,
  baseRef,
  compare,
  files,
  errors,
}, null, 2));

if (errors.length) process.exit(1);
