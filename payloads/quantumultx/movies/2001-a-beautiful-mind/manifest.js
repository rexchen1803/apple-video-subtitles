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


const assetId = "6796433608";
const slug = "2001-a-beautiful-mind";
const revision = "v260925a";
const renditionId = "a-beautiful-mind-zh-hans-v260925a";
const host = "hls-amt.itunes.apple.com";
const playlistBase = "https://" + host + "/__apple_movie_zh/2001-a-beautiful-mind/index.m3u8" + "?rev=" + revision;
const quote = String.fromCharCode(34);
function respond(status, body, type) {
  __qxDone({ response: { status, headers: { "Content-Type": type, "Cache-Control": "no-store, max-age=0" }, body } });
}
function queryValue(url, name) {
  try { return new URL(url).searchParams.get(name) || ""; } catch (_) { return ""; }
}
function route(value, path) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === host && url.pathname === path && url.searchParams.get("rev") === revision ? url : null;
  } catch (_) { return null; }
}
function nativeSource(value) {
  try {
    const url = new URL(value);
    const boundAsset = url.searchParams.get("a") || url.searchParams.get("mainAssetAdamId");
    if (url.protocol !== "https:" || !/^play(?:-edge)?\.itunes\.apple\.com$/i.test(url.hostname) ||
        url.pathname !== "/WebObjects/MZPlayLocal.woa/hls/subscription/playlist.m3u8" || boundAsset !== assetId) return null;
    return url.toString();
  } catch (_) { return null; }
}
function sourcePlaylist(value) {
  try {
    const url = new URL(value);
    const boundAsset = url.searchParams.get("mainAssetAdamId") || url.searchParams.get("a");
    if (url.protocol !== "https:" || !/^play(?:-edge)?\.itunes\.apple\.com$/i.test(url.hostname) ||
        url.pathname !== "/WebObjects/MZPlayLocal.woa/hls/subscription/stream/playlist.m3u8" || boundAsset !== assetId) return null;
    return url.toString();
  } catch (_) { return null; }
}
function absoluteUrl(value, base) {
  try { return new URL(value, base).toString(); } catch (_) { return value; }
}
function attribute(line, name) {
  const match = line.match(new RegExp("(?:^|,)" + name + "=[^,]*"));
  if (!match) return null;
  return match[0].slice(match[0].indexOf("=") + 1).replace(/^"/, "").replace(/"$/, "");
}
function absolutizeMaster(body, source) {
  if (!body.startsWith("#EXTM3U") || !body.includes("#EXT-X-STREAM-INF:")) return null;
  return body.replace(/\r/g, "").split("\n").map((line) => {
    if (line && !line.startsWith("#")) return absoluteUrl(line, source);
    return line.replace(/([A-Z0-9-]*URI)="([^"]+)"/g, (_, key, uri) => key + "=" + quote + absoluteUrl(uri, source) + quote);
  }).join("\n");
}
function routeMaster(body, source) {
  if (!body.startsWith("#EXTM3U") || !body.includes("#EXT-X-STREAM-INF:") ||
      !body.includes("DATA-ID=" + quote + "com.apple.hls.feature.adam-id" + quote + ",VALUE=" + quote + assetId + quote)) return null;
  if (body.includes("STABLE-RENDITION-ID=" + quote + renditionId + quote)) return absolutizeMaster(body, source);
  const lines = body.replace(/\r/g, "").split("\n");
  const streams = lines.filter((line) => line.startsWith("#EXT-X-STREAM-INF:"));
  const pathways = [...new Set(streams.map((line) => attribute(line, "PATHWAY-ID") || "ap"))];
  const rows = pathways.map((pathway) => {
    const stream = streams.find((line) => (attribute(line, "PATHWAY-ID") || "ap") === pathway);
    const group = attribute(stream, "SUBTITLES") || "subtitles_vod-" + pathway + "-aoc.tv.apple.com";
    const donor = lines.find((line) => line.startsWith("#EXT-X-MEDIA:") && line.includes("TYPE=SUBTITLES") &&
      attribute(line, "GROUP-ID") === group && (attribute(line, "PATHWAY-ID") || "ap") === pathway);
    const donorUri = donor ? absoluteUrl(attribute(donor, "URI"), source) : null;
    const sidecar = playlistBase + (donorUri ? "&src=" + encodeURIComponent(donorUri) : "");
    return "#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID=" + quote + group + quote + ",LANGUAGE=" + quote + "zh-Hans" + quote + ",NAME=" + quote + "简体中文" + quote + ",AUTOSELECT=YES,DEFAULT=NO,FORCED=NO,ASSOC-LANGUAGE=" + quote + "zh" + quote + ",PATHWAY-ID=" + quote + pathway + quote + ",STABLE-RENDITION-ID=" + quote + renditionId + quote + ",URI=" + quote + sidecar + quote;
  });
  if (!rows.length) return null;
  const firstMedia = lines.findIndex((line) => line.startsWith("#EXT-X-MEDIA:"));
  const firstStream = lines.findIndex((line) => line.startsWith("#EXT-X-STREAM-INF:"));
  lines.splice(firstMedia >= 0 ? firstMedia : firstStream, 0, ...rows);
  const injected = lines.map((line) => {
    if (line.startsWith("#EXT-X-STREAM-INF:")) {
      const pathway = attribute(line, "PATHWAY-ID") || "ap";
      return attribute(line, "SUBTITLES") ? line : line + ",SUBTITLES=" + quote + "subtitles_vod-" + pathway + "-aoc.tv.apple.com" + quote;
    }
    return line;
  }).join("\n");
  return absolutizeMaster(injected, source);
}
function upstreamHeaders() {
  const output = {};
  for (const [key, value] of Object.entries($request.headers || {})) {
    if (!/^(?:host|content-length|accept-encoding|range)$/i.test(key)) output[key] = value;
  }
  return output;
}
const routeUrl = route($request.url, "/__apple_movie_master/2001-a-beautiful-mind/index.m3u8");
const source = routeUrl && routeUrl.searchParams.get("src") ? nativeSource(routeUrl.searchParams.get("src")) : null;
if (!routeUrl || !source) {
  respond(400, "Invalid A Beautiful Mind master source", "text/plain; charset=utf-8");
} else {
  $httpClient.get({ url: source, headers: upstreamHeaders(), timeout: 10000 }, (error, response, data) => {
    if (error || !response || Number(response.status) !== 200 || typeof data !== "string") {
      respond(502, "A Beautiful Mind master fetch failed", "text/plain; charset=utf-8");
      return;
    }
    const body = routeMaster(data, source);
    if (!body) { respond(502, "Unexpected A Beautiful Mind master", "text/plain; charset=utf-8"); return; }
    respond(200, body, "application/vnd.apple.mpegurl");
  });
}
