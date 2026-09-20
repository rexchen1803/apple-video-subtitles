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
  return String(value || "").replace(/^https:\/\/play-edge-cdn\.itunes\.apple\.com/i, "https://play-edge.itunes.apple.com").replace(/^https:\/\/play-cdn\.itunes\.apple\.com/i, "https://play.itunes.apple.com");
}
function absoluteUrl(value, baseUrl) {
  value = nativePlaybackUrl(value); baseUrl = nativePlaybackUrl(baseUrl);
  if (/^https?:\/\//i.test(value)) return value;
  const originMatch = baseUrl.match(/^(https?:\/\/[^/]+)/i); if (!originMatch) return value;
  if (value.startsWith("/")) return originMatch[1] + value;
  const sourcePath = baseUrl.replace(/^https?:\/\/[^/]+/i, "").split("?")[0];
  const parts = (sourcePath.slice(0, sourcePath.lastIndexOf("/") + 1) + value).split("/");
  const normalized = []; for (const part of parts) { if (!part || part === ".") continue; if (part === "..") normalized.pop(); else normalized.push(part); }
  return originMatch[1] + "/" + normalized.join("/");
}
function upstreamHeaders() {
  const output = {}; const headers = $request.headers || {};
  for (const key of Object.keys(headers)) if (!/^(?:host|content-length|accept-encoding|range)$/i.test(key)) output[key] = headers[key];
  return output;
}
function fail(status, message) { $done({ response: { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }, body: message } }); }

const assetId = "1880673513"; const slug = "dts-s08e07";
const sourceUrl = nativePlaybackUrl(queryValue($request.url, "src"));
if (!/^https:\/\/play(?:-edge)?\.itunes\.apple\.com\//i.test(sourceUrl) || !sourceUrl.includes(assetId)) fail(400, "Invalid series playlist source");
else $httpClient.get({ url: sourceUrl, headers: upstreamHeaders(), timeout: 10000 }, (error, response, data) => {
  if (error || !response || Number(response.status) !== 200 || typeof data !== "string" || !data.startsWith("#EXTM3U")) return fail(502, error || "Series playlist fetch failed");
  let replaced = 0;
  const body = data.replace(/\r/g, "").split("\n").map((line) => {
    if (!line || line.startsWith("#")) return line;
    const absolute = absoluteUrl(line, sourceUrl); const match = absolute.match(new RegExp("_A" + assetId + "_[^/?#]*-(\\d+)\\.webvtt(?:[?#]|$)", "i"));
    if (!match) return absolute;
    replaced += 1; return "https://hls-amt.itunes.apple.com/__apple_series_zh/" + slug + "/seg-" + match[1] + ".webvtt?rev=dts8-20260920d&src=" + encodeURIComponent(absolute);
  }).join("\n");
  if (!replaced) return fail(502, "Series feature segments missing");
  $done({ response: { status: 200, headers: { "Content-Type": "application/vnd.apple.mpegurl", "Cache-Control": "no-store, max-age=0" }, body } });
});
