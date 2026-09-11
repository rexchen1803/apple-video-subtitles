const hostMap = {
  "play.itunes.apple.com": "play-cdn.itunes.apple.com",
  "play-edge.itunes.apple.com": "play-edge-cdn.itunes.apple.com",
};
const f1Replays = [{"slug":"australia","programId":"1337486392","assetId":"1881724926","revision":"f1aur22m1"},{"slug":"china","programId":"1337522687","assetId":"1881777941","revision":"f1cnr21m2"},{"slug":"japan","programId":"1326620577","assetId":"1881763666","revision":"f1jpr20m1"},{"slug":"miami","programId":"1364568578","assetId":"1881733891","revision":"f1mir20m1"},{"slug":"canada","programId":"1392837560","assetId":"1881753363","revision":"f1car20m1"},{"slug":"monaco","programId":"1411825097","assetId":"1881742204","revision":"f1mcr25m1"},{"slug":"barcelona-catalunya","programId":"1413846083","assetId":"1881690171","revision":"f1bar17m1"},{"slug":"austria","programId":"1429344944","assetId":"1882150267","revision":"f1atr22m1"},{"slug":"great-britain","programId":"1436852938","assetId":"1881739464","revision":"f1gbr26m1"},{"slug":"belgium","programId":"1457248952","assetId":"1881786635","revision":"f1ber12m1"},{"slug":"hungary","programId":"1461869625","assetId":"1881700068","revision":"f1hur32m1"},{"slug":"netherlands","programId":"1478680801","assetId":"1882152939","revision":"f1ntr23m1"}];

function queryValue(value, name) {
  const query = String(value || "").split("?")[1]?.split("#")[0] || "";
  for (const part of query.split("&")) {
    const index = part.indexOf("=");
    const key = decodeURIComponent(index < 0 ? part : part.slice(0, index));
    if (key === name) return decodeURIComponent(index < 0 ? "" : part.slice(index + 1));
  }
  return "";
}

function nativePlaybackUrl(value) {
  return String(value || "")
    .replace(/^https:\/\/play-edge-cdn\.itunes\.apple\.com/i, "https://play-edge.itunes.apple.com")
    .replace(/^https:\/\/play-cdn\.itunes\.apple\.com/i, "https://play.itunes.apple.com");
}

function f1BridgeUrl(value) {
  const source = nativePlaybackUrl(value);
  const match = source.match(/^https:\/\/(play(?:-edge)?\.itunes\.apple\.com)(\/WebObjects\/MZPlayLocal\.woa\/hls\/subscription\/playlist\.m3u8)(?:\?[^#]*)?$/i);
  if (!match) return null;
  const replay = f1Replays.find((item) => queryValue(source, "id") === item.programId && queryValue(source, "a") === item.assetId);
  return replay ? "https://hls-amt.itunes.apple.com/__f1_replay_master/" + replay.slug + "/index.m3u8?rev=" + replay.revision + "&src=" + encodeURIComponent(source) : null;
}

function rewriteHlsUrl(value) {
  if (typeof value !== "string") return value;
  const f1 = f1BridgeUrl(value);
  if (f1) return f1;
  const match = value.match(/^(https?:\/\/)([^\/?#]+)([\s\S]*)$/i);
  if (!match) return value;
  const replacement = hostMap[match[2].toLowerCase()];
  return replacement ? match[1] + replacement + match[3] : value;
}

function rewrite(value) {
  if (Array.isArray(value)) return value.map(rewrite);
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const key of Object.keys(value)) output[key] = key === "hlsUrl" ? rewriteHlsUrl(value[key]) : rewrite(value[key]);
  return output;
}

try {
  const body = typeof $response.body === "string" ? JSON.parse($response.body) : null;
  if (!body) $done({});
  else $done({ body: JSON.stringify(rewrite(body)) });
} catch (_) { $done({}); }
