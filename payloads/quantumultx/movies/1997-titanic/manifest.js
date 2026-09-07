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

const movieAssetId = "6793332306";
const movieSlug = "1997-titanic";
const markerKey = "titaniczh";
const playlistBridgeBase = "https://hls-amt.itunes.apple.com/__apple_movie_zh/" + movieSlug + "/index.m3u8?src=";

function injectOriginal(masterBody, sourceUrl) {
  let captured = null;
  const __originalRequest = { url: sourceUrl };
  const __originalResponse = { body: masterBody };
  function __captureDone(value) { captured = value; }
  const assetId = "6793332306";
  const stableRenditionId = "titanic-zh-hans-added-v1";
  const marker = "titaniczh=1";
  
  function quotedAttribute(line, name) {
    return line.match(new RegExp(`${name}="([^"]+)"`))?.[1] || null;
  }
  
  function setAttribute(line, name, value, quoted = false) {
    const pattern = new RegExp(`${name}=(?:"[^"]*"|[^,]*)`);
    const rendered = `${name}=${quoted ? `"${value}"` : value}`;
    return pattern.test(line) ? line.replace(pattern, rendered) : `${line},${rendered}`;
  }
  
  function inject(body) {
    if (
      typeof body !== "string" ||
      !body.includes("#EXT-X-STREAM-INF:") ||
      !body.includes(`DATA-ID="com.apple.hls.feature.adam-id",VALUE="${assetId}"`)
    ) return null;
    if (body.includes(`STABLE-RENDITION-ID="${stableRenditionId}"`)) return body;
  
    const lines = body.replace(/\r/g, "").split("\n");
    const spanish = lines.filter((line) =>
      line.startsWith("#EXT-X-MEDIA:") &&
      line.includes("TYPE=SUBTITLES") &&
      quotedAttribute(line, "LANGUAGE") === "es-419" &&
      line.includes("FORCED=NO")
    );
    const germanForced = lines.filter((line) =>
      line.startsWith("#EXT-X-MEDIA:") &&
      line.includes("TYPE=SUBTITLES") &&
      quotedAttribute(line, "LANGUAGE") === "de" &&
      quotedAttribute(line, "NAME") === "Deutsch (forced)" &&
      line.includes("FORCED=YES")
    );
    const source = spanish.length ? spanish : germanForced;
    if (source.length < 1 || source.length > 3) return null;
  
    const replacement = source.map((line) => {
      let output = setAttribute(line, "LANGUAGE", "zh-Hans", true);
      output = setAttribute(output, "NAME", "简体中文", true);
      output = setAttribute(output, "DEFAULT", "YES");
      output = setAttribute(output, "AUTOSELECT", "YES");
      output = setAttribute(output, "ASSOC-LANGUAGE", "zh", true);
      output = setAttribute(output, "FORCED", "NO");
      output = setAttribute(output, "STABLE-RENDITION-ID", stableRenditionId, true);
      const uri = quotedAttribute(output, "URI");
      return uri && !uri.includes(marker)
        ? setAttribute(output, "URI", `${uri}${uri.includes("?") ? "&" : "?"}${marker}`, true)
        : output;
    });
  
    const insertionIndex = lines.indexOf(source.at(-1)) + 1;
    lines.splice(insertionIndex, 0, ...replacement);
    return lines.join("\n");
  }
  
  try {
    const body = inject(__originalResponse.body);
    __captureDone(body ? { body } : {});
  } catch (_) {
    __captureDone({});
  }
  
  return captured && typeof captured.body === "string" ? captured.body : null;
}

function routeMaster(body, sourceUrl) {
  const injected = injectOriginal(body, sourceUrl);
  if (!injected) return null;
  const separator = injected.includes("\r\n") ? "\r\n" : "\n";
  return injected.split(/\r?\n/).map((line) => {
    if (!line) return line;
    if (!line.startsWith("#")) return absoluteUrl(line, sourceUrl);
    if (line.startsWith("#EXT-X-MEDIA:") && /LANGUAGE="zh-Hans"/.test(line)) {
      const match = line.match(/URI="([^"]+)"/);
      if (match && hasQueryFlag(match[1], markerKey)) {
        const sourcePlaylist = removeQueryFlag(absoluteUrl(match[1], sourceUrl), markerKey);
        return line.replace(/URI="[^"]+"/, 'URI="' + playlistBridgeBase + encodeURIComponent(sourcePlaylist) + '"');
      }
    }
    return line.replace(/([A-Z0-9-]*URI)="([^"]+)"/g, (_, name, value) => name + '="' + absoluteUrl(value, sourceUrl) + '"');
  }).join(separator);
}

const sourceUrl = nativePlaybackUrl(queryValue($request.url, "src"));
if (!/^https:\/\/play(?:-edge)?\.itunes\.apple\.com\//i.test(sourceUrl) || !sourceUrl.includes(movieAssetId)) {
  fail(400, "Invalid movie master source");
} else {
  $httpClient.get({ url: sourceUrl, headers: upstreamHeaders(), timeout: 10000 }, (error, response, data) => {
    if (error || !response || Number(response.status) !== 200 || typeof data !== "string") {
      fail(response ? Number(response.status) || 502 : 502, error || "Movie master fetch failed");
      return;
    }
    const body = routeMaster(data, sourceUrl);
    if (!body) {
      fail(502, "Movie master injection failed");
      return;
    }
    __qxDone({ response: {
      status: 200,
      headers: { "Content-Type": "application/vnd.apple.mpegurl", "Cache-Control": "no-store" },
      body,
    } });
  });
}
