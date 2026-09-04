#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const headRef = process.env.GITHUB_HEAD_REF || process.env.RELEASE_HEAD_REF || "";
const baseRef = process.env.GITHUB_BASE_REF || process.env.RELEASE_BASE_REF || "main";
const compare = process.env.RELEASE_COMPARE || (headRef ? `origin/${baseRef}...HEAD` : "HEAD^...HEAD");
const [baseTreeish, headTreeish = "HEAD"] = compare.split("...");

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function gitShow(ref, path) {
  try {
    return git(["show", `${ref}:${path}`]);
  } catch {
    return null;
  }
}

function rawPayloadRefs(text) {
  return [...text.matchAll(/https:\/\/raw\.githubusercontent\.com\/rexchen1803\/apple-video-subtitles\/([0-9a-f]{40})\/(payloads\/[A-Za-z0-9._/-]+)/gi)]
    .map((match) => ({ commit: match[1], path: match[2] }));
}

function withoutWebVttBody(text) {
  const replaceLiteral = (full, prefix, literal) => {
    try {
      return JSON.parse(literal).startsWith("WEBVTT") ? `${prefix}"<WEBVTT_BODY>"` : full;
    } catch {
      return full;
    }
  };
  return text
    .replace(/(\bconst body\s*=\s*)("(?:\\.|[^"\\])*")/gs, replaceLiteral)
    .replace(/(\$done\(\{\s*body:\s*)("(?:\\.|[^"\\])*")/gs, replaceLiteral);
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

const modulePaths = [
  "stash/apple-video-subtitles.stoverride",
  "shadowrocket/apple-video-subtitles.module",
  "surge/apple-video-subtitles.sgmodule",
];
const moduleFiles = files.filter((file) => modulePaths.includes(file));
const moviePayloadFiles = files.filter((file) =>
  /^payloads\/movies(?:-[^/]+)?\/[^/]+\/(?:inject|rewrite|serve)_.+\.js$/.test(file),
);
if (moviePayloadFiles.length && moduleFiles.length === 0) {
  const baseModuleRefs = modulePaths.slice(0, 2).flatMap((path) => rawPayloadRefs(gitShow(baseTreeish, path) || ""));
  for (const file of moviePayloadFiles) {
    const match = file.match(/^payloads\/movies(?:-[^/]+)?\/([^/]+)\/(inject|rewrite|serve)_.+\.js$/);
    if (!match) continue;
    const [, slug, role] = match;
    const previous = baseModuleRefs.find((entry) =>
      entry.path.includes(`/${slug}/`) && entry.path.split("/").at(-1)?.startsWith(`${role}_`),
    );
    if (!previous) continue; // A genuinely new movie has no prior control-plane contract.
    const before = gitShow(previous.commit, previous.path);
    const after = gitShow(headTreeish, file);
    if (before === null || after === null) {
      errors.push(`${file}: unable to read the previous or candidate movie payload for control-plane comparison`);
      continue;
    }
    const normalize = role === "serve" ? withoutWebVttBody : (value) => value;
    if (normalize(before) !== normalize(after)) {
      errors.push(`${file}: content-only movie update changed ${role} control-plane code; asset, resource, marker, markerKey, language selection, and routing logic must remain byte-stable`);
    }
  }
}

if (/^release\//.test(headRef)) {
  const modules = new Set(modulePaths);
  const allowed = files.every((file) => file === "README.md" || file.startsWith("payloads/") || modules.has(file));
  if (!allowed) errors.push("release branch changes files outside README, payloads, and the three formal modules");

  const payloadFiles = files.filter((file) => file.startsWith("payloads/"));
  const releaseModuleFiles = files.filter((file) => modules.has(file));
  const presentationFiles = files.filter((file) => file === "README.md");

  if (payloadFiles.length && (releaseModuleFiles.length || presentationFiles.length)) {
    errors.push("squash release contract violated: payload PR must not also change modules or README");
  }
  if (releaseModuleFiles.length && releaseModuleFiles.length !== modules.size) {
    errors.push("all-platform module PR must update all three formal modules together");
  }
  if (!payloadFiles.length && !releaseModuleFiles.length) {
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
