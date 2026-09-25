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
  if (/^https?:\/\//i.test(value)) return value;
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

function hasQueryFlag(value, key) {
  const query = String(value || "").split("?")[1]?.split("#")[0] || "";
  return query.split("&").some((part) => part === key + "=1");
}

function addQueryFlag(value, key) {
  if (hasQueryFlag(value, key)) return value;
  const parts = String(value || "").split("#");
  return parts[0] + (parts[0].includes("?") ? "&" : "?") + key + "=1" + (parts.length > 1 ? "#" + parts.slice(1).join("#") : "");
}

function removeQueryFlag(value, key) {
  const parts = String(value || "").split("#");
  const queryParts = parts[0].split("?");
  if (queryParts.length < 2) return value;
  const kept = queryParts.slice(1).join("?").split("&").filter((part) => part !== key + "=1");
  return queryParts[0] + (kept.length ? "?" + kept.join("&") : "") + (parts.length > 1 ? "#" + parts.slice(1).join("#") : "");
}

function upstreamHeaders() {
  const output = {};
  const headers = $request.headers || {};
  for (const key of Object.keys(headers)) {
    if (/^(?:host|content-length|accept-encoding)$/i.test(key)) continue;
    output[key] = headers[key];
  }
  return output;
}

function fail(status, message) {
  __qxDone({ response: {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    body: message,
  } });
}


const revision = "v260925a";
const playlistPath = "/__apple_movie_zh/2001-a-beautiful-mind/index.m3u8";
const segmentPrefix = "/__apple_movie_zh/2001-a-beautiful-mind/seg-";
const fallback = "#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-TARGETDURATION:8113\n#EXT-X-PLAYLIST-TYPE:VOD\n#EXT-X-MEDIA-SEQUENCE:0\n#EXTINF:8.126,\nhttps://hls-amt.itunes.apple.com/__apple_movie_zh/2001-a-beautiful-mind/seg-0.webvtt?rev=v260925a\n#EXT-X-DISCONTINUITY\n#EXTINF:7.198,\nhttps://hls-amt.itunes.apple.com/__apple_movie_zh/2001-a-beautiful-mind/seg-1.webvtt?rev=v260925a\n#EXT-X-DISCONTINUITY\n#EXTINF:31.208,\nhttps://hls-amt.itunes.apple.com/__apple_movie_zh/2001-a-beautiful-mind/seg-2.webvtt?rev=v260925a\n#EXT-X-DISCONTINUITY\n#EXTINF:4.18,\nhttps://hls-amt.itunes.apple.com/__apple_movie_zh/2001-a-beautiful-mind/seg-3.webvtt?rev=v260925a\n#EXT-X-DISCONTINUITY\n#EXTINF:8112.82,\nhttps://hls-amt.itunes.apple.com/__apple_movie_zh/2001-a-beautiful-mind/seg-4.webvtt?rev=v260925a\n#EXT-X-ENDLIST\n";
function respond(status, body, type) {
  __qxDone({ response: { status, headers: { "Content-Type": type, "Cache-Control": "no-store, max-age=0", "Pragma": "no-cache", "Expires": "0" }, body } });
}
function requestUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "hls-amt.itunes.apple.com" && url.pathname === playlistPath && url.searchParams.get("rev") === revision ? url : null;
  } catch (_) { return null; }
}
function sourcePlaylist(value) {
  try {
    const url = new URL(value);
    const boundAsset = url.searchParams.get("mainAssetAdamId") || url.searchParams.get("a");
    if (url.protocol !== "https:" || !/^play(?:-edge)?\.itunes\.apple\.com$/i.test(url.hostname) ||
        url.pathname !== "/WebObjects/MZPlayLocal.woa/hls/subscription/stream/playlist.m3u8" || boundAsset !== "6796433608") return null;
    return url.toString();
  } catch (_) { return null; }
}
function upstreamHeaders() {
  const output = {};
  for (const [key, value] of Object.entries($request.headers || {})) {
    if (!/^(?:host|content-length|accept-encoding|range)$/i.test(key)) output[key] = value;
  }
  return output;
}
function rewritePlaylist(data, source) {
  if (typeof data !== "string") return null;
  const lines = data.replace(/\r/g, "").split("\n");
  const segments = lines.filter((line) => line && !line.startsWith("#"));
  if (lines[0] !== "#EXTM3U" || segments.length !== 5 ||
      lines.filter((line) => line === "#EXT-X-DISCONTINUITY").length !== 4 ||
      lines.filter((line) => line.startsWith("#EXTINF:")).length !== 5 ||
      !lines.includes("#EXT-X-ENDLIST")) return null;
  let index = 0;
  return lines.map((line) => line && !line.startsWith("#") ?
    "https://hls-amt.itunes.apple.com" + segmentPrefix + index++ + ".webvtt?rev=" + revision : line).join("\n");
}
const request = requestUrl($request.url);
if (!request) {
  respond(404, "Not found", "text/plain; charset=utf-8");
} else {
  const source = request.searchParams.get("src") || "";
  const upstream = sourcePlaylist(source);
  if (!upstream) respond(200, fallback, "application/vnd.apple.mpegurl");
  else $httpClient.get({ url: upstream, headers: upstreamHeaders(), timeout: 10000 }, (error, response, data) => {
    if (error || !response || Number(response.status) !== 200 || typeof data !== "string") {
      respond(response ? Number(response.status) || 502 : 502, error || "Subtitle source fetch failed", "text/plain; charset=utf-8");
      return;
    }
    const body = rewritePlaylist(data, upstream);
    if (!body) { respond(502, "Unexpected subtitle segmentation", "text/plain; charset=utf-8"); return; }
    respond(200, body, "application/vnd.apple.mpegurl");
  });
}
