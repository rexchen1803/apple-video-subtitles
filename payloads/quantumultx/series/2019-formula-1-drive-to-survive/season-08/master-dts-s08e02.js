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
function fail(status, message) { __qxDone({ response: { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }, body: message } }); }

function quoted(line, name) { return line.match(new RegExp(name + '="([^"]+)"'))?.[1] || null; }
function setAttr(line, name, value, quotedValue) {
  const pattern = new RegExp(name + '=(?:"[^"]*"|[^,]*)'); const rendered = name + "=" + (quotedValue ? '"' + value + '"' : value);
  return pattern.test(line) ? line.replace(pattern, rendered) : line + "," + rendered;
}
function removeAttr(line, name) { return line.replace(new RegExp(',' + name + '=(?:"[^"]*"|[^,]*)'), ""); }
const assetId = "1880598345";
const slug = "dts-s08e02";
const stableId = slug + "-zh-hans-dts8-20260920d";
const sourceUrl = nativePlaybackUrl(queryValue($request.url, "src"));
if (!/^https:\/\/play(?:-edge)?\.itunes\.apple\.com\//i.test(sourceUrl) || !sourceUrl.includes(assetId)) fail(400, "Invalid series master source");
else $httpClient.get({ url: sourceUrl, headers: upstreamHeaders(), timeout: 10000 }, (error, response, data) => {
  if (error || !response || Number(response.status) !== 200 || typeof data !== "string") return fail(502, error || "Series master fetch failed");
  if (!data.includes('DATA-ID="com.apple.hls.feature.adam-id",VALUE="' + assetId + '"')) return fail(502, "Series asset identity mismatch");
  const lines = data.replace(/\r/g, "").split("\n");
  const rows = lines.filter((line) => line.startsWith("#EXT-X-MEDIA:") && line.includes("TYPE=SUBTITLES") && line.includes('LANGUAGE="en"') && line.includes("FORCED=NO"));
  const baseRows = ["ap", "fa", "ak"].map((pathway) => rows.find((line) => quoted(line, "PATHWAY-ID") === pathway)).filter(Boolean);
  if (baseRows.length !== 3) return fail(502, "English subtitle pathway set missing");
  const bridge = "https://hls-amt.itunes.apple.com/__apple_series_zh/" + slug + "/index.m3u8?rev=dts8-20260920d&src=";
  const chinese = baseRows.map((line) => {
    let output = setAttr(line, "LANGUAGE", "zh-Hans", true); output = setAttr(output, "NAME", "简体中文", true);
    output = setAttr(output, "DEFAULT", "NO", false); output = setAttr(output, "AUTOSELECT", "YES", false);
    output = setAttr(output, "ASSOC-LANGUAGE", "zh", true); output = setAttr(output, "STABLE-RENDITION-ID", stableId, true);
    output = removeAttr(output, "CHARACTERISTICS");
    return setAttr(output, "URI", bridge + encodeURIComponent(absoluteUrl(quoted(line, "URI"), sourceUrl)), true);
  });
  const firstSubtitle = lines.findIndex((line) => line.startsWith("#EXT-X-MEDIA:") && line.includes("TYPE=SUBTITLES"));
  if (firstSubtitle < 0) return fail(502, "Subtitle rows missing");
  lines.splice(firstSubtitle, 0, ...chinese);
  const body = lines.map((line) => {
    if (!line || (line.startsWith("#EXT-X-MEDIA:") && line.includes('STABLE-RENDITION-ID="' + stableId + '"'))) return line;
    if (!line.startsWith("#")) return absoluteUrl(line, sourceUrl);
    return line.replace(/([A-Z0-9-]*URI)="([^"]+)"/g, (_, name, value) => name + '="' + absoluteUrl(value, sourceUrl) + '"');
  }).join("\n");
  __qxDone({ response: { status: 200, headers: { "Content-Type": "application/vnd.apple.mpegurl", "Cache-Control": "no-store" }, body } });
});
