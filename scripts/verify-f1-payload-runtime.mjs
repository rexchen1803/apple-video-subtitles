#!/usr/bin/env node

import fs from "node:fs";
import vm from "node:vm";

const errors = [];
let checks = 0;

function check(condition, message) {
  checks += 1;
  if (!condition) errors.push(message);
}

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function run(source, url) {
  let result;
  vm.runInNewContext(source, { $request: { url }, $done(value) { result = value; } });
  return result;
}

function extractCombined(source) {
  const context = { $request: { url: "https://invalid.example/none.webvtt" }, $done() {} };
  vm.runInNewContext(`${source}\nglobalThis.__races = races;`, context);
  return context.__races;
}

function extractSingle(source) {
  try {
    const context = { $request: { url: "https://invalid.example/none.webvtt" }, $done() {} };
    vm.runInNewContext(`${source}\nglobalThis.__races = races;`, context);
    const ids = Object.keys(context.__races ?? {});
    if (ids.length === 1) return { asset: ids[0], segments: context.__races[ids[0]], offset: 0 };
  } catch {}
  const context = { $request: { url: "https://invalid.example/none.webvtt" }, $done() {} };
  vm.runInNewContext(`${source}\nglobalThis.__asset = ASSET; globalThis.__segments = SEGMENTS;`, context);
  return { asset: context.__asset, segments: context.__segments, offset: 1 };
}

const combinedSource = read("payloads/2026-f1-race-commentary-zh.js");
const combined = extractCombined(combinedSource);
const surge = read("surge/apple-video-subtitles.sgmodule");
const lines = surge.split(/\r?\n/).filter((line) => line.startsWith("F1.Replay.") && line.includes("_en_subtitles"));

for (const line of lines) {
  const asset = line.match(/P\d+_A\d+/)?.[0];
  const url = line.match(/script-path=(https:\/\/raw\.githubusercontent\.com\/[^,\s]+)/)?.[1];
  const path = url?.match(/\/apple-video-subtitles\/[^/]+\/(payloads\/[^?]+)/)?.[1];
  check(Boolean(asset && path && fs.existsSync(path)), `Surge F1 rule resolves to a local payload: ${asset ?? "unknown"}`);
  if (!asset || !path || !fs.existsSync(path)) continue;

  const source = read(path);
  const single = extractSingle(source);
  check(single.asset === asset, `${asset}: dedicated payload asset matches module rule`);
  const normalized = {};
  for (const [key, value] of Object.entries(single.segments)) {
    const sourceIndex = Number(key) - single.offset;
    normalized[String(sourceIndex).padStart(3, "0")] = value;
    check(typeof value === "string" && value.startsWith("WEBVTT\n"), `${asset}: ${key} is a WebVTT response`);
  }
  const combinedSegments = combined[asset] ?? {};
  const normalizedKeys = Object.keys(normalized).sort();
  const combinedKeys = Object.keys(combinedSegments).sort();
  check(
    JSON.stringify(normalizedKeys) === JSON.stringify(combinedKeys)
      && normalizedKeys.every((key) => normalized[key] === combinedSegments[key]),
    `${asset}: dedicated and combined payloads are byte-equivalent`,
  );

  const indexes = Object.keys(normalized).map(Number).sort((a, b) => a - b);
  for (const index of [indexes[0], indexes.at(-1)]) {
    const request = `https://hls-amt.itunes.apple.com/itunes-assets/HLSSportsVodVideo1/v4/a/${asset}_en_subtitles_V2-${index}.webvtt`;
    check(run(source, request)?.body === normalized[String(index).padStart(3, "0")], `${asset}: runtime serves segment ${index}`);
  }
  const wrong = `https://hls-amt.itunes.apple.com/x/P0000000000_A0000000000_en_subtitles_V2-0.webvtt`;
  check(!run(source, wrong)?.body, `${asset}: wrong asset is rejected`);
}

check(Object.keys(combined).length === lines.length, "combined payload race count matches Surge rules");
check(!run(combinedSource, "https://hls-amt.itunes.apple.com/x/P0000000000_A0000000000_en_subtitles_V2-0.webvtt")?.body, "combined payload rejects a wrong asset");

console.log(JSON.stringify({
  pass: errors.length === 0,
  races: lines.length,
  checks,
  passed: checks - errors.length,
  errors,
}, null, 2));

if (errors.length) process.exit(1);
