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

const assetId = "6796433608";
const slug = "2001-a-beautiful-mind";
const revision = "v260925a";
const renditionId = "a-beautiful-mind-zh-hans-v260925a";
const host = "hls-amt.itunes.apple.com";
const playlistBase = "https://" + host + "/__apple_movie_zh/2001-a-beautiful-mind/index.m3u8" + "?rev=" + revision;
const quote = String.fromCharCode(34);
function respond(status, body, type) {
  $done({ response: { status, headers: { "Content-Type": type, "Cache-Control": "no-store, max-age=0" }, body } });
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
