#!/usr/bin/env node

import fs from "node:fs";
import vm from "node:vm";

const network = process.argv.includes("--network");
const errors = [];
const checks = [];

function check(condition, message) {
  checks.push({ pass: Boolean(condition), message });
  if (!condition) errors.push(message);
}

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function occurrences(text, token) {
  return text.split(token).length - 1;
}

function title(text) {
  return text.match(/^#!name=(.+)$/m)?.[1] ?? text.match(/^name:\s*(.+)$/m)?.[1] ?? "";
}

function description(text) {
  return text.match(/^#!desc=(.+)$/m)?.[1] ?? text.match(/^desc:\s*(.+)$/m)?.[1] ?? "";
}

function rawUrls(text) {
  return [...text.matchAll(/https:\/\/raw\.githubusercontent\.com\/[^\s,'"]+/g)].map((match) => match[0]);
}

function assetIds(text) {
  return [...new Set([...text.matchAll(/P\d+_A\d+/g)].map((match) => match[0]))].sort();
}

const paths = {
  stash: "stash/apple-video-subtitles.stoverride",
  shadowrocket: "shadowrocket/apple-video-subtitles.module",
  surge: "surge/apple-video-subtitles.sgmodule",
};
const modules = Object.fromEntries(Object.entries(paths).map(([name, path]) => [name, read(path)]));
const titles = Object.values(modules).map(title);
const descriptions = Object.values(modules).map(description);
const versions = descriptions.map((value) => value.match(/^(v\d{6}[a-z])；/)?.[1] ?? "");

check(titles.every((value) => value && value === titles[0]), "three module titles are identical");
check(descriptions.every((value) => value && value === descriptions[0]), "three module descriptions are identical");
check(versions.every((value) => value && value === versions[0]), "three module versions are identical lowercase vYYMMDDx");

const movieCount = Number(descriptions[0]?.match(/Apple TV\s+(\d+)\s+部(?:会员)?电影/)?.[1]);
const raceCount = Number(descriptions[0]?.match(/前(\d+)站/)?.[1]);
check(Number.isInteger(movieCount) && movieCount > 0, "description declares a valid movie count");
check(Number.isInteger(raceCount) && raceCount > 0, "description declares a valid F1 race count");

const forbidden = [
  [/\/Users\//, "Mac absolute path"],
  [/\blocalhost\b/i, "localhost"],
  [/\b(?:10|127|169\.254|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}\b/, "private IP"],
  [/:18772\b/, "retired test port"],
  [/(?:diagnostic|probe|Local-only)/i, "test label"],
];
for (const [name, text] of Object.entries(modules)) {
  for (const [pattern, label] of forbidden) check(!pattern.test(text), `${name}: no ${label}`);
}

check(modules.stash.includes("http:\n"), "stash native http section exists");
check(modules.stash.includes("script-providers:"), "stash native script-providers exist");
check(modules.stash.includes("play-cdn\\.itunes\\.apple\\.com"), "stash play-cdn bridge exists");
check(modules.stash.includes("play-edge-cdn\\.itunes\\.apple\\.com"), "stash play-edge-cdn bridge exists");
check(occurrences(modules.stash, "play(?:-edge)?(?:-cdn)?") === movieCount * 2, "stash movie host family count matches description");

check(modules.shadowrocket.includes("[URL Rewrite]"), "shadowrocket URL Rewrite section exists");
check(modules.shadowrocket.includes("[Script]"), "shadowrocket Script section exists");
check(modules.shadowrocket.includes("[MITM]"), "shadowrocket MITM section exists");
const shadowResponses = modules.shadowrocket.split(/\r?\n/).filter((line) => line.includes("type=http-response"));
check(shadowResponses.length > 0 && shadowResponses.every((line) => line.includes("engine=webview")), "shadowrocket responses declare engine=webview");
check(occurrences(modules.shadowrocket, "play(?:-edge)?(?:-cdn)?") === movieCount * 2, "shadowrocket movie host family count matches description");

check(!modules.surge.includes("[URL Rewrite]"), "surge URL Rewrite is absent");
const surgeHosts = modules.surge.match(/^hostname = %APPEND% (.+)$/m)?.[1]?.split(",").map((value) => value.trim()) ?? [];
check(JSON.stringify(surgeHosts) === JSON.stringify([
  "hls-amt.itunes.apple.com",
  "uts-api.itunes.apple.com",
  "vod-ap-amt.tv.apple.com",
  "vod-fa-amt.tv.apple.com",
  "vod-ak-amt.tv.apple.com",
]), "surge MITM matches the safe boundary exactly");
check(!/play(?:-edge)?(?:-cdn)?\.itunes\.apple\.com/.test(modules.surge), "surge does not intercept play hosts");
check(!/vod-(?:ap|fa|ak)-aoc\.tv\.apple\.com/.test(modules.surge), "surge does not intercept vod aoc hosts");
check(occurrences(modules.surge, ".SafeBridgeFull.Master.request = type=http-request") === movieCount, "surge movie Master count matches description");
check(occurrences(modules.surge, ".SafeBridgeFull.Playlist.request = type=http-request") === movieCount, "surge movie Playlist count matches description");
check(occurrences(modules.surge, ".SafeBridgeFull.VTT.request = type=http-request") === movieCount, "surge movie VTT count matches description");

const surgeF1Lines = modules.surge.split(/\r?\n/).filter((line) => line.startsWith("F1.Replay.") && line.includes("_en_subtitles"));
check(surgeF1Lines.length === raceCount, "surge precise F1 rule count matches description");
const surgeAssets = assetIds(surgeF1Lines.join("\n"));
const stashStandardLine = modules.stash.split(/\r?\n/).find((line, index, lines) => lines[index + 1]?.includes("name: f1-race-commentary-zh")) ?? "";
const shadowStandardLine = modules.shadowrocket.split(/\r?\n/).find((line) => line.startsWith("F1.Replay.Combined.Chinese.response")) ?? "";
check(JSON.stringify(assetIds(stashStandardLine)) === JSON.stringify(surgeAssets), "stash standard F1 assets match Surge");
check(JSON.stringify(assetIds(shadowStandardLine)) === JSON.stringify(surgeAssets), "shadowrocket standard F1 assets match Surge");

const combined = read("payloads/2026-f1-race-commentary-zh.js");
let races;
try {
  const context = { $request: { url: "https://invalid.example/none.webvtt" }, $done() {} };
  vm.runInNewContext(`${combined}\nglobalThis.__races = races;`, context);
  races = context.__races;
} catch {
  races = undefined;
}
check(races && JSON.stringify(Object.keys(races).sort()) === JSON.stringify(surgeAssets), "combined standard payload assets match all three modules");

const urls = [...new Set(Object.values(modules).flatMap(rawUrls))];
check(urls.length > 0, "public raw URLs were extracted");
const rawUrlPattern = /^https:\/\/raw\.githubusercontent\.com\/rexchen1803\/apple-video-subtitles\/([0-9a-f]{40})\/(payloads\/[A-Za-z0-9._/-]+)$/i;
const pinnedUrls = new Map();
for (const url of urls) {
  const match = url.match(rawUrlPattern);
  check(Boolean(match), `public script URL uses the expected repository, a full 40-character commit SHA, and a payloads path: ${url}`);
  if (!match) continue;
  const payloadPath = match[2];
  check(!payloadPath.includes("..") && fs.existsSync(payloadPath), `pinned payload exists in current tree: ${payloadPath}`);
  pinnedUrls.set(url, payloadPath);
}

const moviePayloadGroups = new Map();
for (const payloadPath of pinnedUrls.values()) {
  if (!/^payloads\/movies(?:-[^/]+)?\/.+\/(?:inject|rewrite|serve)_.+\.js$/.test(payloadPath)) continue;
  const directory = payloadPath.slice(0, payloadPath.lastIndexOf("/"));
  const paths = moviePayloadGroups.get(directory) ?? [];
  paths.push(payloadPath);
  moviePayloadGroups.set(directory, paths);
}
for (const [directory, payloadPaths] of moviePayloadGroups) {
  const markerKeys = payloadPaths.flatMap((payloadPath) =>
    [...read(payloadPath).matchAll(/const markerKey = "([A-Za-z0-9_-]+)"/g)].map((match) => match[1]),
  );
  if (!markerKeys.length) continue;
  const uniqueMarkerKeys = [...new Set(markerKeys)];
  check(payloadPaths.length === 3, `${directory}: movie payload closure has Manifest, Playlist, and VTT scripts`);
  check(uniqueMarkerKeys.length === 1 && markerKeys.length === 3, `${directory}: three payload scripts use one markerKey`);
  if (uniqueMarkerKeys.length !== 1) continue;
  const marker = `${uniqueMarkerKeys[0]}=1`;
  check(occurrences(modules.stash, marker) === 2, `${directory}: stash Playlist and VTT rules match payload marker ${marker}`);
  check(occurrences(modules.shadowrocket, marker) === 2, `${directory}: shadowrocket Playlist and VTT rules match payload marker ${marker}`);
}

if (network) {
  let cursor = 0;
  async function worker() {
    while (cursor < urls.length) {
      const url = urls[cursor++];
      const payloadPath = pinnedUrls.get(url);
      if (!payloadPath || !fs.existsSync(payloadPath)) continue;
      try {
        const response = await fetch(url, { redirect: "follow" });
        check(response.ok, `network ${response.status}: ${url}`);
        if (response.ok) {
          check(await response.text() === read(payloadPath), `pinned payload matches current tree: ${payloadPath}`);
        }
      } catch {
        check(false, `network request failed: ${url}`);
      }
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
}

console.log(JSON.stringify({
  pass: errors.length === 0,
  title: titles[0],
  description: descriptions[0],
  version: versions[0],
  raceCount,
  movieCount,
  publicScriptUrls: urls.length,
  checks: checks.length,
  passed: checks.filter((item) => item.pass).length,
  errors,
}, null, 2));

if (errors.length) process.exit(1);
