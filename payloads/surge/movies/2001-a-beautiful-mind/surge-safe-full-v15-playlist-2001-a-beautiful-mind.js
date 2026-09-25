const prefix = "https://hls-amt.itunes.apple.com/__apple_movie_zh/2001-a-beautiful-mind/";
function respond(status, body, type) {
  $done({ response: { status, headers: {
    "Content-Type": type,
    "Cache-Control": "no-store, max-age=0",
  }, body } });
}
const fallback = [
  "#EXTM3U", "#EXT-X-VERSION:7", "#EXT-X-TARGETDURATION:8113", "#EXT-X-PLAYLIST-TYPE:VOD", "#EXT-X-MEDIA-SEQUENCE:0",
  "#EXTINF:8.126,", "seg-0.webvtt", "#EXT-X-DISCONTINUITY",
  "#EXTINF:7.198,", "seg-1.webvtt", "#EXT-X-DISCONTINUITY",
  "#EXTINF:31.208,", "seg-2.webvtt", "#EXT-X-DISCONTINUITY",
  "#EXTINF:4.18,", "seg-3.webvtt", "#EXT-X-DISCONTINUITY",
  "#EXTINF:8112.82,", "seg-4.webvtt", "#EXT-X-ENDLIST", "",
].map((line) => line.startsWith("seg-") ? `${prefix}${line}?rev=v260925a` : line).join("\n");
let source;
try {
  const routeUrl = new URL($request.url);
  if (routeUrl.protocol !== "https:" || routeUrl.hostname !== "hls-amt.itunes.apple.com" || routeUrl.pathname !== "/__apple_movie_zh/2001-a-beautiful-mind/index.m3u8" || routeUrl.searchParams.get("rev") !== "v260925a") throw new Error("invalid route");
  source = routeUrl.searchParams.get("src");
  if (!source) throw new Error("no donor");
  const url = new URL(source);
  if (url.protocol !== "https:" || !/^play(?:-edge)?\.itunes\.apple\.com$/i.test(url.hostname) ||
      url.pathname !== "/WebObjects/MZPlayLocal.woa/hls/subscription/stream/playlist.m3u8" ||
      url.searchParams.get("mainAssetAdamId") !== "6796433608") throw new Error("invalid donor");
} catch (_) {
  respond(200, fallback, "application/vnd.apple.mpegurl");
  source = null;
}
if (source) {
  const headers = {};
  for (const [key, value] of Object.entries($request.headers || {})) {
    if (!/^(?:host|content-length|accept-encoding)$/i.test(key)) headers[key] = value;
  }
  $httpClient.get({ url: source, headers, timeout: 10000 }, (error, response, data) => {
    if (error || !response || Number(response.status) !== 200 || typeof data !== "string") {
      respond(502, "Subtitle source fetch failed", "text/plain; charset=utf-8");
      return;
    }
    const lines = data.replace(/\r/g, "").split("\n");
    const segments = lines.filter((line) => line && !line.startsWith("#"));
    if (lines[0] !== "#EXTM3U" || segments.length !== 5 ||
        lines.filter((line) => line === "#EXT-X-DISCONTINUITY").length !== 4 ||
        lines.filter((line) => line.startsWith("#EXTINF:")).length !== 5 ||
        !lines.includes("#EXT-X-ENDLIST")) {
      respond(502, "Unexpected subtitle segmentation", "text/plain; charset=utf-8");
      return;
    }
    let index = 0;
    const body = lines.map((line) => line && !line.startsWith("#") ?
      `${prefix}seg-${index++}.webvtt?rev=v260925a` : line).join("\n");
    respond(200, body, "application/vnd.apple.mpegurl");
  });
}
