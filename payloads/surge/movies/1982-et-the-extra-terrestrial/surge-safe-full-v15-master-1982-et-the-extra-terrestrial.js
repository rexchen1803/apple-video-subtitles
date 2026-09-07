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
  $done({ response: {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    body: message,
  } });
}

const movieAssetId = "6793021118";
const movieSlug = "1982-et-the-extra-terrestrial";
const markerKey = "etzh";
const playlistBridgeBase = "https://hls-amt.itunes.apple.com/__apple_movie_zh/" + movieSlug + "/index.m3u8?src=";

function injectOriginal(masterBody, sourceUrl) {
  let captured = null;
  const __originalRequest = { url: sourceUrl };
  const __originalResponse = { body: masterBody };
  function __captureDone(value) { captured = value; }
  const assetId = "6793021118";
  const marker = "et-zh-hans-v1";
  const url = __originalRequest.url || "";
  const body = __originalResponse.body || "";
  const target = new RegExp("(?:[?&]mainAssetAdamId=" + assetId + "(?:[&#]|$)|[?&]a=[^&#]*" + assetId + "(?:[&#]|$)|_A" + assetId + "_)").test(url);
  if (!target || !body.startsWith("#EXTM3U")) {
    __captureDone({});
  } else if (body.includes(`STABLE-RENDITION-ID="${marker}"`)) {
    __captureDone({ body });
  } else {
    const lineEnding = body.includes("\r\n") ? "\r\n" : "\n";
    const lines = body.split(/\r?\n/);
    const media = lines.map((line, index) => ({ line, index })).filter(({ line }) => line.startsWith("#EXT-X-MEDIA:") && /TYPE=SUBTITLES/.test(line));
    const ordinary = media.filter(({ line }) => !/FORCED=YES/.test(line) && /URI=/.test(line) && !/LANGUAGE="zh-Hans"/.test(line));
    const english = ordinary.filter(({ line }) => /LANGUAGE="en(?:-[^"]+)?"/.test(line));
    const pathways = english.map(({ line }) => line.match(/PATHWAY-ID="([^"]+)"/)?.[1]).filter(Boolean);
    if (!english.length || (pathways.length > 0 && new Set(pathways).size !== pathways.length)) {
      __captureDone({});
    } else {
      const added = english.map(({ line }) => {
        const pathway = line.match(/PATHWAY-ID="([^"]+)"/)?.[1];
        const group = line.match(/GROUP-ID="([^"]+)"/)?.[1];
        const uri = line.match(/URI="([^"]+)"/)?.[1];
        if (!group || !uri) return null;
        const separator = uri.includes("?") ? "&" : "?";
        const pathwayAttribute = pathway ? `,PATHWAY-ID="${pathway}"` : "";
        return `#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="${group}",LANGUAGE="zh-Hans",NAME="简体中文",AUTOSELECT=YES,DEFAULT=NO,FORCED=NO${pathwayAttribute},STABLE-RENDITION-ID="${marker}",URI="${uri}${separator}etzh=1"`;
      });
      if (added.some((value) => !value)) {
        __captureDone({});
      } else {
        const insertAt = media.length ? media[0].index : lines.length;
        lines.splice(insertAt, 0, ...added);
        __captureDone({ body: lines.join(lineEnding) });
      }
    }
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
    $done({ response: {
      status: 200,
      headers: { "Content-Type": "application/vnd.apple.mpegurl", "Cache-Control": "no-store" },
      body,
    } });
  });
}
