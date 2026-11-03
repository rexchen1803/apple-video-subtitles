const __qxNativeDone = $done;
function __qxReason(code) { return ({ 200: "OK", 400: "Bad Request", 404: "Not Found", 500: "Internal Server Error", 502: "Bad Gateway" })[code] || "OK"; }
function __qxDone(value) { if (value && typeof value === "object" && value.response) { const response = value.response; const code = Number(response.status) || 200; __qxNativeDone({ status: "HTTP/1.1 " + code + " " + __qxReason(code), headers: response.headers || {}, body: typeof response.body === "string" ? response.body : "" }); return; } __qxNativeDone(value); }

const $httpClient = { get(options, callback) { const request = typeof options === "string" ? { url: options } : { ...options }; const timeout = Math.max(1000, Number(request.timeout) || 10000); delete request.timeout; request.method = "GET"; let settled = false; const timer = setTimeout(() => { if (settled) return; settled = true; callback("Quantumult X upstream timeout", null, null); }, timeout); $task.fetch(request).then((response) => { if (settled) return; settled = true; clearTimeout(timer); callback(null, { status: response.statusCode ?? response.status, headers: response.headers || {} }, response.body); }, (error) => { if (settled) return; settled = true; clearTimeout(timer); callback(String(error), null, null); }); } };

function queryValue(url, key) {
  const query = String(url || "").split("?")[1] || "";
  for (const part of query.split("&")) {
    const index = part.indexOf("=");
    const name = index < 0 ? part : part.slice(0, index);
    if (name === key) return decodeURIComponent(index < 0 ? "" : part.slice(index + 1));
  }
  return "";
}

function nativePlaybackUrl(value) {
  return String(value || "")
    .replace(/^https:\/\/play-edge-cdn\.itunes\.apple\.com/i, "https://play-edge.itunes.apple.com")
    .replace(/^https:\/\/play-cdn\.itunes\.apple\.com/i, "https://play.itunes.apple.com");
}

function absoluteUrl(value, baseUrl) {
  value = nativePlaybackUrl(value);
  baseUrl = nativePlaybackUrl(baseUrl);
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return value;
  const originMatch = baseUrl.match(/^(https?:\/\/[^/]+)/i);
  if (!originMatch) return value;
  if (value.startsWith("/")) return originMatch[1] + value;
  const sourcePath = baseUrl.replace(/^https?:\/\/[^/]+/i, "").split("?")[0];
  const directory = sourcePath.slice(0, sourcePath.lastIndexOf("/") + 1);
  const parts = (directory + value).split("/");
  const normalized = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") normalized.pop();
    else normalized.push(part);
  }
  return originMatch[1] + "/" + normalized.join("/");
}

function isAllowedNativeDonorUrl(value) {
  try {
    const match = String(value || "").match(/^https:\/\/([^/?#]+)(\/[^?#]*)(?:\?[^#]*)?$/i);
    if (!match || ["vod-ak-aoc.tv.apple.com","vod-ap-aoc.tv.apple.com","vod-fa-aoc.tv.apple.com"].indexOf(match[1].toLowerCase()) < 0) return false;
    const filename = decodeURIComponent(match[2].slice(match[2].lastIndexOf("/") + 1));
    return ["P1523435101_A6822050541_es-419_subtitles_V1-.webvtt","P1523435101_A6822050541_es-419_subtitles_V2-.webvtt"].indexOf(filename) >= 0;
  } catch (_) { return false; }
}
function upstreamHeaders() {
  const output = {};
  const headers = $request.headers || {};
  for (const key of Object.keys(headers)) {
    if (/^(?:host|content-length|accept-encoding|range)$/i.test(key)) continue;
    output[key] = headers[key];
  }
  return output;
}

function fail(status, message) {
  __qxDone({ response: { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }, body: message } });
}

const movieAssetId = "6822050541";
const movieSlug = "2013-prisoners";
const vttBridgeBase = "https://hls-amt.itunes.apple.com/__apple_movie_zh/" + movieSlug + "/full.webvtt?rev=nov1103-6daa17ad6475&src=";
const sourceUrl = nativePlaybackUrl(queryValue($request.url, "src"));
if (queryValue($request.url, "rev") !== "nov1103-6daa17ad6475" || !/^https:\/\/play(?:-edge)?\.itunes\.apple\.com\//i.test(sourceUrl) || !sourceUrl.split('?')[0].endsWith("/WebObjects/MZPlayLocal.woa/hls/subscription/stream/playlist.m3u8") || (queryValue(sourceUrl, "mainAssetAdamId") || queryValue(sourceUrl, "a")) !== movieAssetId) {
  fail(400, "Invalid subtitle playlist source");
} else {
  $httpClient.get({ url: sourceUrl, headers: upstreamHeaders(), timeout: 10000 }, (error, response, data) => {
    if (error || !response || Number(response.status) !== 200 || typeof data !== "string" || !data.startsWith("#EXTM3U")) {
      fail(response ? Number(response.status) || 502 : 502, error || "Subtitle playlist fetch failed");
      return;
    }
    const sourceLines = data.replace(/\r/g, "").split("\n");
    if (!sourceLines.includes("#EXT-X-ENDLIST") || sourceLines.some(line => line.startsWith("#EXT-X-MAP:"))) { fail(502, "Unsupported subtitle transport"); return; }
    const candidates = sourceLines
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => absoluteUrl(line, sourceUrl))
      .filter((line) => isAllowedNativeDonorUrl(line));
    if (candidates.length !== 1) {
      fail(502, "Unexpected subtitle playlist shape");
      return;
    }
    const featureRangeBytesByFilename = {"P1523435101_A6822050541_es-419_subtitles_V1-.webvtt":152456,"P1523435101_A6822050541_es-419_subtitles_V2-.webvtt":155124};
    const featureUrl = candidates[0];
    const featureFilename = decodeURIComponent(featureUrl.split("?")[0].split("/").pop() || "");
    const expectedFeatureRangeBytes = featureRangeBytesByFilename[featureFilename];
    if (!Object.prototype.hasOwnProperty.call(featureRangeBytesByFilename, featureFilename)) { fail(502, "Unverified feature filename"); return; }
    const ranges = sourceLines.filter(line => line.startsWith("#EXT-X-BYTERANGE:"));
    const rangeMatch = ranges.length === 1 ? /^#EXT-X-BYTERANGE:(\d+)@0$/.exec(ranges[0]) : null;
    if (ranges.length && (ranges.length !== 1 || !rangeMatch || Number(rangeMatch[1]) !== expectedFeatureRangeBytes || absoluteUrl(sourceLines[sourceLines.indexOf(ranges[0]) + 1], sourceUrl) !== featureUrl)) { fail(502, "Unverified subtitle byte range"); return; }
    const output = [];
    let replaced = 0;
    for (const line of sourceLines) {
      if (!line) { output.push(line); continue; }
      if (!line.startsWith("#")) {
        const absolute = absoluteUrl(line, sourceUrl);
        if (absolute === featureUrl) {
          replaced += 1;
          if (output.length && output[output.length - 1].startsWith("#EXT-X-BYTERANGE:")) output.pop();
          output.push(vttBridgeBase + encodeURIComponent(featureUrl));
        } else {
          output.push(absolute);
        }
        continue;
      }
      output.push(line.replace(/([A-Z0-9-]*URI)="([^"]+)"/g, (_, name, value) => name + '="' + absoluteUrl(value, sourceUrl) + '"'));
    }
    if (replaced !== 1) { fail(502, "Feature subtitle replacement failed"); return; }
    __qxDone({ response: {
      status: 200,
      headers: { "Content-Type": "application/vnd.apple.mpegurl", "Cache-Control": "no-store, max-age=0", "Pragma": "no-cache", "Expires": "0" },
      body: output.join("\n"),
    } });
  });
}
