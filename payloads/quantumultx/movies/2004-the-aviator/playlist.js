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

const movieAssetId = "6793733076";
const movieSlug = "2004-the-aviator";
const markerKey = "aviatorzh";
const vttUrl = "https://hls-amt.itunes.apple.com/__apple_movie_zh/" + movieSlug + "/full.webvtt?bridge=v15";

function rewriteOriginal(playlistBody, sourceUrl) {
  let captured = null;
  const __originalRequest = { url: addQueryFlag(sourceUrl, markerKey) };
  const __originalResponse = { body: playlistBody };
  function __captureDone(value) { captured = value; }
  const assetId = "6793733076";
  const resource = "P1473541551_A6793733076";
  const url = __originalRequest.url || "";
  const body = __originalResponse.body || "";
  const marked = /[?&]aviatorzh=1(?:&|$)/.test(url);
  const target = new RegExp("(?:[?&](?:mainAssetAdamId|a)=" + assetId + "(?:[&#]|$)|_A" + assetId + "_)").test(url);
  if (!marked || !target || !body.startsWith("#EXTM3U")) {
    __captureDone({});
  } else {
    const lines = body.split(/\r?\n/);
    const leaves = lines.filter((line) => line.includes(resource) && /_es-419_subtitles_V2-[^\s?]*\.webvtt/.test(line));
    if (leaves.length !== 1 || lines.some((line) => /(?:pre|post|empty)/i.test(line) && line.includes(resource))) {
      __captureDone({});
    } else {
      const rewritten = lines.map((line) => {
        if (!line.includes(resource) || !/_es-419_subtitles_V2-[^\s?]*\.webvtt/.test(line) || /[?&]aviatorzh=1(?:&|$)/.test(line)) return line;
        return `${line}${line.includes("?") ? "&" : "?"}aviatorzh=1`;
      }).join(body.includes("\r\n") ? "\r\n" : "\n");
      __captureDone({ body: rewritten });
    }
  }
  
  return captured && typeof captured.body === "string" ? captured.body : null;
}

function routePlaylist(data, sourceUrl) {
  const rewritten = rewriteOriginal(data, sourceUrl);
  if (!rewritten) return null;
  let replaced = 0;
  const separator = rewritten.includes("\r\n") ? "\r\n" : "\n";
  const output = [];
  for (const line of rewritten.split(/\r?\n/)) {
    if (!line) {
      output.push(line);
      continue;
    }
    if (!line.startsWith("#")) {
      const absolute = absoluteUrl(line, sourceUrl);
      if (hasQueryFlag(absolute, markerKey)) {
        replaced += 1;
        if (output.length && output[output.length - 1].startsWith("#EXT-X-BYTERANGE:")) output.pop();
        output.push(vttUrl);
      } else {
        output.push(absolute);
      }
      continue;
    }
    output.push(line.replace(/([A-Z0-9-]*URI)="([^"]+)"/g, (_, name, value) => name + '="' + absoluteUrl(value, sourceUrl) + '"'));
  }
  return replaced === 1 ? output.join(separator) : null;
}

const sourceUrl = nativePlaybackUrl(queryValue($request.url, "src"));
if (!/^https:\/\/play(?:-edge)?\.itunes\.apple\.com\//i.test(sourceUrl) || !sourceUrl.includes(movieAssetId)) {
  fail(400, "Invalid subtitle playlist source");
} else {
  $httpClient.get({ url: sourceUrl, headers: upstreamHeaders(), timeout: 10000 }, (error, response, data) => {
    if (error || !response || Number(response.status) !== 200 || typeof data !== "string" || !data.includes("#EXTM3U")) {
      fail(response ? Number(response.status) || 502 : 502, error || "Subtitle playlist fetch failed");
      return;
    }
    const body = routePlaylist(data, sourceUrl);
    if (!body) {
      fail(502, "Unexpected subtitle playlist shape");
      return;
    }
    __qxDone({ response: {
      status: 200,
      headers: { "Content-Type": "application/vnd.apple.mpegurl", "Cache-Control": "no-store" },
      body,
    } });
  });
}
