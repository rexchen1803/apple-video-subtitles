const hostMap = {
  "play.itunes.apple.com": "play-cdn.itunes.apple.com",
  "play-edge.itunes.apple.com": "play-edge-cdn.itunes.apple.com",
};
const f1Replays = [{"slug":"australia","programId":"1337486392","assetId":"1881724926","revision":"f1aur22m1"},{"slug":"china","programId":"1337522687","assetId":"1881777941","revision":"f1cnr21m2"},{"slug":"japan","programId":"1326620577","assetId":"1881763666","revision":"f1jpr20m1"},{"slug":"miami","programId":"1364568578","assetId":"1881733891","revision":"f1mir20m1"},{"slug":"canada","programId":"1392837560","assetId":"1881753363","revision":"f1car20m1"},{"slug":"monaco","programId":"1411825097","assetId":"1881742204","revision":"f1mcr25m1"},{"slug":"barcelona-catalunya","programId":"1413846083","assetId":"1881690171","revision":"f1bar17m1"},{"slug":"austria","programId":"1429344944","assetId":"1882150267","revision":"f1atr22m1"},{"slug":"great-britain","programId":"1436852938","assetId":"1881739464","revision":"f1gbr26m1"},{"slug":"belgium","programId":"1457248952","assetId":"1881786635","revision":"f1ber12m1"},{"slug":"hungary","programId":"1461869625","assetId":"1881700068","revision":"f1hur32m1"},{"slug":"netherlands","programId":"1478680801","assetId":"1882152939","revision":"f1ntr23m1"},{"slug":"spain","programId":"1497835498","assetId":"1881721455","revision":"f1spr22m1"}];
const seriesTargets = {"1880499459":{"slug":"dts-s08e01","programId":"1288232144"},"1880598345":{"slug":"dts-s08e02","programId":"1288232871"},"1880600976":{"slug":"dts-s08e03","programId":"1287879890"},"1880613354":{"slug":"dts-s08e04","programId":"1287887004"},"1880628537":{"slug":"dts-s08e05","programId":"1312757141"},"1880639133":{"slug":"dts-s08e06","programId":"1287881790"},"1880673513":{"slug":"dts-s08e07","programId":"1288233124"},"1880677128":{"slug":"dts-s08e08","programId":"1287884341"}};
const seriesRevision = "dts8-20260920d";

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

function seriesBridgeUrl(value) {
  const source = nativePlaybackUrl(value);
  const match = source.match(/^https:\/\/(play(?:-edge)?\.itunes\.apple\.com)(\/WebObjects\/MZPlayLocal\.woa\/hls\/subscription\/playlist\.m3u8)(?:\?[^#]*)?$/i);
  if (!match) return null;
  for (const assetId of Object.keys(seriesTargets)) {
    const target = seriesTargets[assetId];
    if (queryValue(source, "a") !== assetId || queryValue(source, "id") !== target.programId) continue;
    return "https://hls-amt.itunes.apple.com/__apple_series_master/" + target.slug + "/index.m3u8?rev=" + seriesRevision + "&src=" + encodeURIComponent(source);
  }
  return null;
}

const shelfTargets = {"6809945696":"2003-28-days-later","6813800850":"2007-american-gangster","6809968299":"2001-black-hawk-down","6809916755":"2006-blood-diamond","6809968224":"1998-fallen","6809968703":"2014-fury","6809968396":"2010-going-the-distance","6809968982":"1997-good-will-hunting","6809969812":"2002-insomnia","6812093448":"2015-jurassic-world","6809973625":"1976-taxi-driver","6809916863":"2011-the-girl-with-the-dragon-tattoo","6809975421":"2008-tropic-thunder"};
const shelfRevisions = {"6809945696":"shelf1002-d4548655248c-credit-v2","6813800850":"shelf1002-21ba574ddeb3-credit-v2","6809968299":"shelf1002-dcb4b0cab8cb-credit-v2","6809916755":"shelf1002-9648950795c1-credit-v2","6809968224":"shelf1002-342fb0c70442-credit-v2","6809968703":"shelf1002-d179d8ebf9f6-credit-v2","6809968396":"shelf1002-53613ec3a8fb-credit-v2","6809968982":"shelf1002-a1fdcb98a5d7-credit-v2","6809969812":"shelf1002-68f174a204e7-credit-v2","6812093448":"shelf1002-61f160f59338-credit-v2","6809973625":"shelf1002-a35439e85a3a-credit-v2","6809916863":"shelf1002-511ca230dc1a-credit-v2","6809975421":"shelf1002-fbb44dd760b6-credit-v2"};
function shelfBridgeUrl(value) {
  const source = nativePlaybackUrl(value);
  if (!/^https:\/\/play(?:-edge)?\.itunes\.apple\.com\/WebObjects\/MZPlayLocal\.woa\/hls\/subscription\/playlist\.m3u8(?:\?[^#]*)?$/i.test(source)) return null;
  const asset = queryValue(source, "a") || queryValue(source, "mainAssetAdamId");
  return shelfTargets[asset] ? "https://hls-amt.itunes.apple.com/__apple_movie_master/" + shelfTargets[asset] + "/index.m3u8?rev=" + shelfRevisions[asset] + "&src=" + encodeURIComponent(source) : null;
}

function beautifulMindBridgeUrl(value) {
  const source = nativePlaybackUrl(value);
  const match = source.match(/^https:\/\/(play(?:-edge)?\.itunes\.apple\.com)(\/WebObjects\/MZPlayLocal\.woa\/hls\/subscription\/playlist\.m3u8)(?:\?[^#]*)?$/i);
  if (!match || queryValue(source, "a") !== "6796433608") return null;
  return "https://hls-amt.itunes.apple.com/__apple_movie_master/2001-a-beautiful-mind/index.m3u8?rev=v260925a&src=" + encodeURIComponent(source);
}

function rewriteHlsUrl(value) {
  if (typeof value !== "string") return value;
  const shelf = shelfBridgeUrl(value);
  if (shelf) return shelf;
  const beautifulMind = beautifulMindBridgeUrl(value);
  if (beautifulMind) return beautifulMind;
  const series = seriesBridgeUrl(value);
  if (series) return series;
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
