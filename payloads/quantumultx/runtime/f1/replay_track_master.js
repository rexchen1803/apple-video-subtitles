const __qxNativeDone = $done;
function __qxReason(code) { return ({ 200: "OK", 400: "Bad Request", 404: "Not Found", 500: "Internal Server Error", 502: "Bad Gateway" })[code] || "OK"; }
function __qxDone(value) { if (value && typeof value === "object" && value.response) { const response = value.response; const code = Number(response.status) || 200; __qxNativeDone({ status: "HTTP/1.1 " + code + " " + __qxReason(code), headers: response.headers || {}, body: typeof response.body === "string" ? response.body : "" }); return; } __qxNativeDone(value); }

const $httpClient = { get(options, callback) { const request = typeof options === "string" ? { url: options } : { ...options }; const timeout = Math.max(1000, Number(request.timeout) || 10000); delete request.timeout; request.method = "GET"; let settled = false; const timer = setTimeout(() => { if (settled) return; settled = true; callback("Quantumult X upstream timeout", null, null); }, timeout); $task.fetch(request).then((response) => { if (settled) return; settled = true; clearTimeout(timer); callback(null, { status: response.statusCode ?? response.status, headers: response.headers || {} }, response.body); }, (error) => { if (settled) return; settled = true; clearTimeout(timer); callback(String(error), null, null); }); } };

const URL = class {
  constructor(value, base) {
    let resolved = String(value || "");
    if (base && !/^https?:\/\//i.test(resolved)) {
      const baseMatch = String(base).match(/^(https?):\/\/([^/?#]+)([^?#]*)(?:\?[^#]*)?$/i);
      if (!baseMatch) throw new Error("Invalid base URL");
      if (resolved.startsWith("/")) resolved = baseMatch[1] + "://" + baseMatch[2] + resolved;
      else {
        const directory = (baseMatch[3] || "/").replace(/[^/]*$/, "");
        const parts = (directory + resolved).split("/");
        const normalized = [];
        for (const part of parts) {
          if (!part || part === ".") continue;
          if (part === "..") normalized.pop();
          else normalized.push(part);
        }
        resolved = baseMatch[1] + "://" + baseMatch[2] + "/" + normalized.join("/");
      }
    }
    const match = resolved.match(/^(https?):\/\/([^/?#]+)([^?#]*)(?:\?([^#]*))?(?:#.*)?$/i);
    if (!match) throw new Error("Invalid URL");
    this.protocol = match[1].toLowerCase() + ":";
    this.hostname = match[2].replace(/:\d+$/, "");
    this.pathname = match[3] || "/";
    const query = match[4] || "";
    this.searchParams = { get(name) {
      for (const part of query.split("&")) {
        if (!part) continue;
        const index = part.indexOf("=");
        const key = decodeURIComponent(index < 0 ? part : part.slice(0, index));
        if (key === name) return decodeURIComponent(index < 0 ? "" : part.slice(index + 1));
      }
      return null;
    } };
    this.href = match[1].toLowerCase() + "://" + match[2] + this.pathname + (query ? "?" + query : "");
  }
  toString() { return this.href; }
};

// Surge request script for exact F1 replay synthetic masters. Native
// video/audio/subtitle resources remain on their original Apple hosts.
const replayConfigs = {
  australia: {
    programId: "1337486392",
    assetId: "1881724926",
    revision: "f1aur22m1",
    stableRenditionId: "australia-2026-r22-zh-hans-m1",
  },
  china: {
    programId: "1337522687",
    assetId: "1881777941",
    revision: "f1cnr21m2",
    stableRenditionId: "china-2026-r21-zh-hans-m2",
  },
  japan: { programId: "1326620577", assetId: "1881763666", revision: "f1jpr20m1", stableRenditionId: "japan-2026-r20-zh-hans-m1" },
  miami: { programId: "1364568578", assetId: "1881733891", revision: "f1mir20m1", stableRenditionId: "miami-2026-r20-zh-hans-m1" },
  canada: { programId: "1392837560", assetId: "1881753363", revision: "f1car20m1", stableRenditionId: "canada-2026-r20-zh-hans-m1" },
  monaco: { programId: "1411825097", assetId: "1881742204", revision: "f1mcr25m1", stableRenditionId: "monaco-2026-r25-zh-hans-m1" },
  "barcelona-catalunya": { programId: "1413846083", assetId: "1881690171", revision: "f1bar17m1", stableRenditionId: "barcelona-catalunya-2026-r17-zh-hans-m1" },
  austria: { programId: "1429344944", assetId: "1882150267", revision: "f1atr22m1", stableRenditionId: "austria-2026-r22-zh-hans-m1" },
  "great-britain": { programId: "1436852938", assetId: "1881739464", revision: "f1gbr26m1", stableRenditionId: "great-britain-2026-r26-zh-hans-m1" },
  belgium: { programId: "1457248952", assetId: "1881786635", revision: "f1ber12m1", stableRenditionId: "belgium-2026-r12-zh-hans-m1" },
  hungary: { programId: "1461869625", assetId: "1881700068", revision: "f1hur32m1", stableRenditionId: "hungary-2026-r32-zh-hans-m1" },
  netherlands: { programId: "1478680801", assetId: "1882152939", revision: "f1ntr23m1", stableRenditionId: "netherlands-2026-r23-zh-hans-m1" },
};

const replaySlugPattern = Object.keys(replayConfigs).join("|");

function requestConfig(value) {
  try {
    const match = new URL(value).pathname.match(new RegExp(`^/__f1_replay_master/(${replaySlugPattern})/index\\.m3u8$`));
    if (!match) return null;
    return { slug: match[1], ...replayConfigs[match[1]] };
  } catch (_) { return null; }
}

function queryValue(url, key) {
  try { return new URL(url).searchParams.get(key) || ""; } catch (_) { return ""; }
}

function sourceUrl(value, config) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !/^play(?:-edge)?\.itunes\.apple\.com$/i.test(url.hostname) ||
      url.pathname !== "/WebObjects/MZPlayLocal.woa/hls/subscription/playlist.m3u8" ||
      url.searchParams.get("id") !== config.programId ||
      url.searchParams.get("a") !== config.assetId
    ) return null;
    return url.toString();
  } catch (_) {
    return null;
  }
}

function absoluteUrl(value, baseUrl) {
  try { return new URL(value, baseUrl).toString(); } catch (_) { return value; }
}

function quotedAttribute(line, name) {
  return line.match(new RegExp(`${name}="([^"]+)"`))?.[1] || null;
}

function setAttribute(line, name, value, quoted = false) {
  const pattern = new RegExp(`${name}=(?:"[^"]*"|[^,]*)`);
  const rendered = `${name}=${quoted ? `"${value}"` : value}`;
  return pattern.test(line) ? line.replace(pattern, rendered) : `${line},${rendered}`;
}

function removeAttribute(line, name) {
  const pattern = new RegExp(`,${name}=(?:"[^"]*"|[^,]*)`);
  return line.replace(pattern, "");
}

function absoluteizeMaster(lines, baseUrl) {
  return lines.map((line) => {
    if (!line) return line;
    if (!line.startsWith("#")) return absoluteUrl(line, baseUrl);
    return line.replace(/([A-Z0-9-]*URI)="([^"]+)"/g, (_, name, value) =>
      `${name}="${absoluteUrl(value, baseUrl)}"`,
    );
  });
}

function chineseRowsForGroup(lines, group, baseUrl, config) {
  const rows = lines.filter((line) =>
    line.startsWith("#EXT-X-MEDIA:") &&
    line.includes("TYPE=SUBTITLES") &&
    quotedAttribute(line, "GROUP-ID") === group &&
    quotedAttribute(line, "FORCED") !== "YES" &&
    /^en(?:-|$)/i.test(quotedAttribute(line, "LANGUAGE") || ""),
  );
  const byPathway = new Map();
  for (const row of rows) {
    const pathway = quotedAttribute(row, "PATHWAY-ID") || "__default__";
    if (!byPathway.has(pathway)) byPathway.set(pathway, row);
  }
  if (!byPathway.size) return null;
  return [...byPathway.values()].map((row) => {
    const donor = absoluteUrl(quotedAttribute(row, "URI") || "", baseUrl);
    if (!/^https:\/\//i.test(donor)) return null;
    let output = setAttribute(row, "LANGUAGE", "zh-Hans", true);
    output = setAttribute(output, "NAME", "简体中文", true);
    output = removeAttribute(output, "CHARACTERISTICS");
    output = setAttribute(output, "DEFAULT", "NO");
    output = setAttribute(output, "AUTOSELECT", "YES");
    output = setAttribute(output, "FORCED", "NO");
    output = setAttribute(output, "ASSOC-LANGUAGE", "zh", true);
    output = setAttribute(output, "STABLE-RENDITION-ID", config.stableRenditionId, true);
    const playlist = `https://hls-amt.itunes.apple.com/__f1_replay_zh/${config.slug}/index.m3u8?rev=${config.revision}&src=${encodeURIComponent(donor)}`;
    return setAttribute(output, "URI", playlist, true);
  });
}

function injectTrack(body, baseUrl, config) {
  if (
    typeof body !== "string" ||
    !body.startsWith("#EXTM3U") ||
    !body.includes("#EXT-X-STREAM-INF:")
  ) return null;
  const lines = body.replace(/\r/g, "").split("\n");
  if (lines.some((line) => line.includes(`STABLE-RENDITION-ID="${config.stableRenditionId}"`))) {
    return absoluteizeMaster(lines, baseUrl).join("\n");
  }
  const groups = [...new Set(lines
    .filter((line) => line.startsWith("#EXT-X-STREAM-INF:"))
    .map((line) => quotedAttribute(line, "SUBTITLES"))
    .filter(Boolean))];
  if (!groups.length) return null;
  const chineseRows = groups.flatMap((group) => chineseRowsForGroup(lines, group, baseUrl, config) || []);
  if (!chineseRows.length) return null;
  const firstSubtitle = lines.findIndex((line) =>
    line.startsWith("#EXT-X-MEDIA:") && line.includes("TYPE=SUBTITLES"),
  );
  if (firstSubtitle < 0) return null;
  lines.splice(firstSubtitle, 0, ...chineseRows);
  return absoluteizeMaster(lines, baseUrl).join("\n");
}

function upstreamHeaders() {
  const output = {};
  for (const [key, value] of Object.entries($request.headers || {})) {
    if (!/^(?:host|content-length|accept-encoding|range)$/i.test(key)) output[key] = value;
  }
  return output;
}

function fail(status, body) {
  __qxDone({ response: { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }, body } });
}

const config = requestConfig($request.url);
const upstream = config && sourceUrl(queryValue($request.url, "src"), config);
if (!config || !upstream) {
  fail(400, "Invalid F1 replay master source");
} else {
  $httpClient.get({ url: upstream, headers: upstreamHeaders(), timeout: 10000 }, (error, response, data) => {
    if (error || !response || Number(response.status) !== 200 || typeof data !== "string") {
      fail(response ? Number(response.status) || 502 : 502, error || "F1 replay master fetch failed");
      return;
    }
    const body = injectTrack(data, upstream, config);
    if (!body) { fail(502, "F1 replay master injection failed"); return; }
    __qxDone({ response: { status: 200, headers: { "Content-Type": "application/vnd.apple.mpegurl", "Cache-Control": "no-store" }, body } });
  });
}
