const slug = "2001-a-beautiful-mind";
const assetId = "6796433608";
const renditionId = "a-beautiful-mind-zh-hans-v260925a";
const sidecar = `https://hls-amt.itunes.apple.com/__apple_movie_zh/${slug}/index.m3u8?rev=v260925a`;

function respond(status, body, contentType) {
  $done({ response: { status, headers: {
    "Content-Type": contentType,
    "Cache-Control": "no-store, max-age=0",
  }, body } });
}

function attribute(line, name) {
  return line.match(new RegExp(`(?:^|,)${name}="([^"]*)"`))?.[1] || null;
}

function absoluteUri(uri, base) {
  return new URL(uri, base).toString();
}

function absolutizeMaster(body, source) {
  if (!body.startsWith("#EXTM3U") || !body.includes("#EXT-X-STREAM-INF:")) return null;
  return body.replace(/\r/g, "").split("\n").map((line) => {
    if (line && !line.startsWith("#")) return absoluteUri(line, source);
    return line.replace(/([A-Z0-9-]*URI)="([^"]+)"/g,
      (_, key, uri) => `${key}="${absoluteUri(uri, source)}"`);
  }).join("\n");
}

function routeMaster(body, source) {
  if (!body.startsWith("#EXTM3U") || !body.includes("#EXT-X-STREAM-INF:") ||
      !body.includes(`DATA-ID="com.apple.hls.feature.adam-id",VALUE="${assetId}"`)) return null;
  if (body.includes(`STABLE-RENDITION-ID="${renditionId}"`)) return body;
  const lines = body.replace(/\r/g, "").split("\n");
  const streams = lines.filter((line) => line.startsWith("#EXT-X-STREAM-INF:"));
  const pathways = [...new Set(streams.map((line) => attribute(line, "PATHWAY-ID") || "ap"))];
  const rows = pathways.map((pathway) => {
    const stream = streams.find((line) => (attribute(line, "PATHWAY-ID") || "ap") === pathway);
    const group = attribute(stream, "SUBTITLES") || `subtitles_vod-${pathway}-aoc.tv.apple.com`;
    const donor = lines.find((line) => line.startsWith("#EXT-X-MEDIA:") && line.includes("TYPE=SUBTITLES") &&
      attribute(line, "GROUP-ID") === group && (attribute(line, "PATHWAY-ID") || "ap") === pathway);
    const donorUri = donor ? absoluteUri(attribute(donor, "URI"), source) : null;
    return `#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="${group}",LANGUAGE="zh-Hans",NAME="简体中文",AUTOSELECT=YES,DEFAULT=NO,FORCED=NO,ASSOC-LANGUAGE="zh",PATHWAY-ID="${pathway}",STABLE-RENDITION-ID="${renditionId}",URI="${sidecar}${donorUri ? "&src=" + encodeURIComponent(donorUri) : ""}"`;
  });
  if (rows.some((row) => !row)) return null;
  const firstMedia = lines.findIndex((line) => line.startsWith("#EXT-X-MEDIA:"));
  const firstStream = lines.findIndex((line) => line.startsWith("#EXT-X-STREAM-INF:"));
  lines.splice(firstMedia >= 0 ? firstMedia : firstStream, 0, ...rows);
  const injected = lines.map((line) => {
    if (line.startsWith("#EXT-X-STREAM-INF:")) {
      const pathway = attribute(line, "PATHWAY-ID") || "ap";
      return attribute(line, "SUBTITLES") ? line : `${line},SUBTITLES="subtitles_vod-${pathway}-aoc.tv.apple.com"`;
    }
    return line;
  }).join("\n");
  return absolutizeMaster(injected, source);
}

let source;
try {
  const routeUrl = new URL($request.url);
  if (routeUrl.protocol !== "https:" || routeUrl.hostname !== "hls-amt.itunes.apple.com" || routeUrl.pathname !== "/__apple_movie_master/2001-a-beautiful-mind/index.m3u8" || routeUrl.searchParams.get("rev") !== "v260925a") throw new Error("invalid route");
  source = routeUrl.searchParams.get("src");
  const parsed = new URL(source);
  if (parsed.protocol !== "https:" || !/^play(?:-edge)?\.itunes\.apple\.com$/i.test(parsed.hostname) || parsed.pathname !== "/WebObjects/MZPlayLocal.woa/hls/subscription/playlist.m3u8" || (parsed.searchParams.get("a") || parsed.searchParams.get("mainAssetAdamId")) !== assetId) throw new Error("invalid source");
} catch (_) {
  respond(400, "Invalid movie master source", "text/plain; charset=utf-8");
  source = null;
}
if (source) {
  const headers = {};
  for (const [key, value] of Object.entries($request.headers || {})) {
    if (!/^(?:host|content-length|accept-encoding)$/i.test(key)) headers[key] = value;
  }
  $httpClient.get({ url: source, headers, timeout: 10000 }, (error, response, data) => {
    if (error || !response || Number(response.status) !== 200 || typeof data !== "string") {
      respond(502, "Movie master fetch failed", "text/plain; charset=utf-8");
      return;
    }
    let output = null;
    try { output = routeMaster(data, source); } catch (_) {}
    if (!output) {
      try { output = absolutizeMaster(data, source); } catch (_) {}
    }
    if (!output) {
      respond(502, "Unexpected movie master", "text/plain; charset=utf-8");
      return;
    }
    respond(200, output, "application/vnd.apple.mpegurl");
  });
}
