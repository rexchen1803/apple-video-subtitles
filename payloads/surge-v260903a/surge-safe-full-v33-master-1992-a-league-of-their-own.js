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

function quotedAttribute(line, name) {
  return line.match(new RegExp(name + '="([^"]+)"'))?.[1] || null;
}

function setAttribute(line, name, value, quoted = false) {
  const pattern = new RegExp(name + '=(?:"[^"]*"|[^,]*)');
  const rendered = name + "=" + (quoted ? '"' + value + '"' : value);
  return pattern.test(line) ? line.replace(pattern, rendered) : line + "," + rendered;
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
  $done({ response: { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }, body: message } });
}

const movieAssetId = "6803646799";
const movieSlug = "1992-a-league-of-their-own";
const preferredBaseLanguage = "en";
const stableRenditionId = movieSlug + "-zh-hans-v260903a";
const playlistBridgeBase = "https://hls-amt.itunes.apple.com/__apple_movie_zh/" + movieSlug + "/index.m3u8?rev=v260903a&src=";

function injectTrack(body, sourceUrl) {
  if (typeof body !== "string" || !body.includes("#EXT-X-STREAM-INF:") || !body.includes('DATA-ID="com.apple.hls.feature.adam-id",VALUE="' + movieAssetId + '"')) return null;
  if (body.includes('STABLE-RENDITION-ID="' + stableRenditionId + '"')) return body;
  const lines = body.replace(/\r/g, "").split("\n");
  const subtitleRows = lines.filter((line) => line.startsWith("#EXT-X-MEDIA:") && line.includes("TYPE=SUBTITLES") && line.includes("FORCED=NO"));
  const languages = preferredBaseLanguage === "en" ? ["en", "es-419", "es-ES"] : [preferredBaseLanguage, "es-419", "es-ES", "en"];
  let baseRows = [];
  for (const language of languages) {
    const rows = subtitleRows.filter((line) => quotedAttribute(line, "LANGUAGE") === language && ["ap", "fa", "ak"].includes(quotedAttribute(line, "PATHWAY-ID")));
    if (rows.length === 3) { baseRows = rows; break; }
  }
  if (baseRows.length !== 3) return null;
  const chineseRows = baseRows.map((line) => {
    const sourcePlaylist = absoluteUrl(quotedAttribute(line, "URI"), sourceUrl);
    if (!sourcePlaylist) return null;
    let output = setAttribute(line, "LANGUAGE", "zh-Hans", true);
    output = setAttribute(output, "NAME", "简体中文", true);
    output = setAttribute(output, "DEFAULT", "NO");
    output = setAttribute(output, "AUTOSELECT", "YES");
    output = setAttribute(output, "ASSOC-LANGUAGE", "zh", true);
    output = setAttribute(output, "STABLE-RENDITION-ID", stableRenditionId, true);
    output = setAttribute(output, "URI", playlistBridgeBase + encodeURIComponent(sourcePlaylist), true);
    return output;
  });
  lines.splice(lines.indexOf(baseRows.at(-1)) + 1, 0, ...chineseRows);
  return lines.map((line) => {
    if (!line) return line;
    if (!line.startsWith("#")) return absoluteUrl(line, sourceUrl);
    if (line.startsWith("#EXT-X-MEDIA:") && line.includes('STABLE-RENDITION-ID="' + stableRenditionId + '"')) return line;
    return line.replace(/([A-Z0-9-]*URI)="([^"]+)"/g, (_, name, value) => name + '="' + absoluteUrl(value, sourceUrl) + '"');
  }).join("\n");
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
    const body = injectTrack(data, sourceUrl);
    if (!body) { fail(502, "Movie master injection failed"); return; }
    $done({ response: { status: 200, headers: { "Content-Type": "application/vnd.apple.mpegurl", "Cache-Control": "no-store" }, body } });
  });
}
