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

const revision = "v260925a";
const playlistPath = "/__apple_movie_zh/2001-a-beautiful-mind/index.m3u8";
const segmentPrefix = "/__apple_movie_zh/2001-a-beautiful-mind/seg-";
const fallback = "#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-TARGETDURATION:8113\n#EXT-X-PLAYLIST-TYPE:VOD\n#EXT-X-MEDIA-SEQUENCE:0\n#EXTINF:8.126,\nhttps://hls-amt.itunes.apple.com/__apple_movie_zh/2001-a-beautiful-mind/seg-0.webvtt?rev=v260925a\n#EXT-X-DISCONTINUITY\n#EXTINF:7.198,\nhttps://hls-amt.itunes.apple.com/__apple_movie_zh/2001-a-beautiful-mind/seg-1.webvtt?rev=v260925a\n#EXT-X-DISCONTINUITY\n#EXTINF:31.208,\nhttps://hls-amt.itunes.apple.com/__apple_movie_zh/2001-a-beautiful-mind/seg-2.webvtt?rev=v260925a\n#EXT-X-DISCONTINUITY\n#EXTINF:4.18,\nhttps://hls-amt.itunes.apple.com/__apple_movie_zh/2001-a-beautiful-mind/seg-3.webvtt?rev=v260925a\n#EXT-X-DISCONTINUITY\n#EXTINF:8112.82,\nhttps://hls-amt.itunes.apple.com/__apple_movie_zh/2001-a-beautiful-mind/seg-4.webvtt?rev=v260925a\n#EXT-X-ENDLIST\n";
function respond(status, body, type) {
  $done({ response: { status, headers: { "Content-Type": type, "Cache-Control": "no-store, max-age=0", "Pragma": "no-cache", "Expires": "0" }, body } });
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
