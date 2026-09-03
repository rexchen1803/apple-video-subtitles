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
  $done({ response: { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }, body: message } });
}

const movieAssetId = "6804791114";
const movieSlug = "2004-troy";
const vttBridgeBase = "https://hls-amt.itunes.apple.com/__apple_movie_zh/" + movieSlug + "/full.webvtt?rev=v260903a&src=";
const sourceUrl = nativePlaybackUrl(queryValue($request.url, "src"));
if (!/^https:\/\/play(?:-edge)?\.itunes\.apple\.com\//i.test(sourceUrl) || !sourceUrl.includes(movieAssetId)) {
  fail(400, "Invalid subtitle playlist source");
} else {
  $httpClient.get({ url: sourceUrl, headers: upstreamHeaders(), timeout: 10000 }, (error, response, data) => {
    if (error || !response || Number(response.status) !== 200 || typeof data !== "string" || !data.startsWith("#EXTM3U")) {
      fail(response ? Number(response.status) || 502 : 502, error || "Subtitle playlist fetch failed");
      return;
    }
    const sourceLines = data.replace(/\r/g, "").split("\n");
    const candidates = sourceLines
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => absoluteUrl(line, sourceUrl))
      .filter((line) => line.includes("_A" + movieAssetId + "_") && /\.webvtt(?:[?#]|$)/i.test(line) && !/(?:pre|post|empty)/i.test(line));
    if (candidates.length !== 1) {
      fail(502, "Unexpected subtitle playlist shape");
      return;
    }
    const featureUrl = candidates[0];
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
    $done({ response: {
      status: 200,
      headers: { "Content-Type": "application/vnd.apple.mpegurl", "Cache-Control": "no-store, max-age=0", "Pragma": "no-cache", "Expires": "0" },
      body: output.join("\n"),
    } });
  });
}
