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

// Surge request script for exact Chinese sidecar playlists. Synthetic VTT
// segments are mapped by playlist ordinal to each SHA-bound candidate.
const replayConfigs = {
  australia: { eventId: "P1337486392_A1881724926", programId: "1337486392", assetId: "1881724926", expectedSegments: 210 },
  china: { eventId: "P1337522687_A1881777941", programId: "1337522687", assetId: "1881777941", expectedSegments: 226 },
  japan: { eventId: "P1326620577_A1881763666", programId: "1326620577", assetId: "1881763666", expectedSegments: 229 },
  miami: { eventId: "P1364568578_A1881733891", programId: "1364568578", assetId: "1881733891", expectedSegments: 224 },
  canada: { eventId: "P1392837560_A1881753363", programId: "1392837560", assetId: "1881753363", expectedSegments: 223 },
  monaco: { eventId: "P1411825097_A1881742204", programId: "1411825097", assetId: "1881742204", expectedSegments: 268 },
  "barcelona-catalunya": { eventId: "P1413846083_A1881690171", programId: "1413846083", assetId: "1881690171", expectedSegments: 219 },
  austria: { eventId: "P1429344944_A1882150267", programId: "1429344944", assetId: "1882150267", expectedSegments: 213 },
  "great-britain": { eventId: "P1436852938_A1881739464", programId: "1436852938", assetId: "1881739464", expectedSegments: 220 },
  belgium: { eventId: "P1457248952_A1881786635", programId: "1457248952", assetId: "1881786635", expectedSegments: 207 },
  hungary: { eventId: "P1461869625_A1881700068", programId: "1461869625", assetId: "1881700068", expectedSegments: 228 },
  netherlands: { eventId: "P1478680801_A1882152939", programId: "1478680801", assetId: "1882152939", expectedSegments: 254 },
};

const replaySlugPattern = Object.keys(replayConfigs).join("|");

function requestConfig(value) {
  try {
    const match = new URL(value).pathname.match(new RegExp(`^/__f1_replay_zh/(${replaySlugPattern})/index\\.m3u8$`));
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
    const exactSubscriptionStream =
      /^play(?:-edge)?\.itunes\.apple\.com$/i.test(url.hostname) &&
      url.pathname === "/WebObjects/MZPlayLocal.woa/hls/subscription/stream/playlist.m3u8";
    const exactBinding =
      url.searchParams.get("a") === config.assetId &&
      url.searchParams.get("mainAssetAdamId") === config.assetId &&
      url.searchParams.get("p") === config.programId &&
      /^(?:vod-ap-aoc|vod-fa-aoc|vod-ak-aoc)\.tv\.apple\.com$/i.test(url.searchParams.get("cdn") || "");
    return url.protocol === "https:" && exactSubscriptionStream && exactBinding ? url.toString() : null;
  } catch (_) { return null; }
}

function absoluteUrl(value, baseUrl) {
  try { return new URL(value, baseUrl).toString(); } catch (_) { return value; }
}

function eventSegmentIndex(value, config) {
  try {
    const pathname = new URL(value).pathname;
    const match = pathname.match(new RegExp(`/${config.eventId}_en_subtitles_V\\d+-(\\d+)\\.webvtt$`));
    return match ? Number(match[1]) : null;
  } catch (_) { return null; }
}

function absoluteizeTagUris(line, baseUrl) {
  return line.replace(/([A-Z0-9-]*URI)="([^"]+)"/g, (_, name, value) =>
    `${name}="${absoluteUrl(value, baseUrl)}"`,
  );
}

function injectPlaylist(body, baseUrl, config) {
  if (typeof body !== "string" || !body.startsWith("#EXTM3U")) return null;
  const lines = body.replace(/\r/g, "").split("\n");
  const targetRows = lines.flatMap((line) => {
    if (!line || line.startsWith("#")) return [];
    const absolute = absoluteUrl(line, baseUrl);
    const segmentIndex = eventSegmentIndex(absolute, config);
    return segmentIndex === null ? [] : [{ absolute, segmentIndex }];
  });
  if (
    targetRows.length !== config.expectedSegments ||
    targetRows.some((row, position) => row.segmentIndex !== position)
  ) return null;
  let ordinal = 0;
  const output = [];
  for (const line of lines) {
    if (!line) { output.push(line); continue; }
    if (line.startsWith("#")) { output.push(absoluteizeTagUris(line, baseUrl)); continue; }
    const absolute = absoluteUrl(line, baseUrl);
    if (eventSegmentIndex(absolute, config) === null) { output.push(absolute); continue; }
    ordinal += 1;
    if (output.at(-1)?.startsWith("#EXT-X-BYTERANGE:")) output.pop();
    output.push(`https://hls-amt.itunes.apple.com/__f1_replay_zh/${config.slug}/seg-${String(ordinal).padStart(3, "0")}.webvtt`);
  }
  return ordinal === config.expectedSegments ? output.join("\n") : null;
}

function upstreamHeaders() {
  const output = {};
  for (const [key, value] of Object.entries($request.headers || {})) {
    if (!/^(?:host|content-length|accept-encoding|range)$/i.test(key)) output[key] = value;
  }
  return output;
}

function fail(status, body) {
  $done({ response: { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }, body } });
}

const config = requestConfig($request.url);
const upstream = config && sourceUrl(queryValue($request.url, "src"), config);
if (!config || !upstream) {
  fail(400, "Invalid F1 replay subtitle source");
} else {
  $httpClient.get({ url: upstream, headers: upstreamHeaders(), timeout: 10000 }, (error, response, data) => {
    if (error || !response || Number(response.status) !== 200 || typeof data !== "string") {
      fail(response ? Number(response.status) || 502 : 502, error || "F1 replay subtitle playlist fetch failed");
      return;
    }
    const body = injectPlaylist(data, upstream, config);
    if (!body) { fail(502, "Unexpected F1 replay subtitle playlist shape"); return; }
    $done({ response: { status: 200, headers: { "Content-Type": "application/vnd.apple.mpegurl", "Cache-Control": "no-store, max-age=0", "Pragma": "no-cache", "Expires": "0" }, body } });
  });
}
