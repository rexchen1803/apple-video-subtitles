const shelfRevisions = {"6822052354":"nov1103-af0ce1150f0c","6820735971":"nov1103-e0c60e7390f7","6822050128":"nov1103-6fc55b7e640e","6822053507":"nov1103-8fd5be969c2b","6822048451":"nov1103-f8230d9bb2f5","6822054779":"nov1103-88e1f9dbab3b","6822072736":"nov1103-69640299476e","6820730686":"nov1103-6ef1d79f94db","6822050541":"nov1103-6daa17ad6475","6822054364":"nov1103-cedd5982069e","6822101531":"nov1103-74a882e2b88d","6822048777":"nov1103-247c33b4a2e1","6822054977":"nov1103-2bcdd526499b","6822050093":"nov1103-4727ffd19d96","6820740030":"nov1103-7376a389d1f6","6820731539":"nov1103-0b7da4b5ad97","6824697268":"nov1103-a1bc6bcda5e8","6822040006":"nov1103-0a760bc619f6","6820740767":"nov1103-2e1ab7dbca31"};
const URL = class {
  constructor(value, base) {
    let resolved = String(value || "");
    if (base && !/^https?:\/\//i.test(resolved)) {
      const baseMatch = String(base).match(/^(https?):\/\/([^/?#]+)([^?#]*)(?:\?[^#]*)?$/i);
      if (!baseMatch) throw new Error("Invalid base URL");
      if (resolved.startsWith("/")) resolved = baseMatch[1] + "://" + baseMatch[2] + resolved;
      else {
        const directory = (baseMatch[3] || "/").replace(/[^/]*$/, "");
        const parts = (directory + resolved).split("/");
        const normalized = [];
        for (const part of parts) {
          if (!part || part === ".") continue;
          if (part === "..") normalized.pop();
          else normalized.push(part);
        }
        resolved = baseMatch[1] + "://" + baseMatch[2] + "/" + normalized.join("/");
      }
    }
    const match = resolved.match(/^(https?):\/\/([^/?#]+)([^?#]*)(?:\?([^#]*))?(?:#.*)?$/i);
    if (!match) throw new Error("Invalid URL");
    this.protocol = match[1].toLowerCase() + ":";
    this.hostname = match[2].replace(/:\d+$/, "");
    this.pathname = match[3] || "/";
    const query = match[4] || "";
    this.searchParams = { get(name) {
      for (const part of query.split("&")) {
        if (!part) continue;
        const index = part.indexOf("=");
        const key = decodeURIComponent(index < 0 ? part : part.slice(0, index));
        if (key === name) return decodeURIComponent(index < 0 ? "" : part.slice(index + 1));
      }
      return null;
    } };
    this.href = match[1].toLowerCase() + "://" + match[2] + this.pathname + (query ? "?" + query : "");
  }
  toString() { return this.href; }
};

const targets = {"6793693246":"2016-arrival","6804923769":"2003-master-and-commander","6822052354":"1995-12-monkeys","6820735971":"1993-dave","6822050128":"2014-interstellar","6822053507":"1994-pulp-fiction","6822048451":"1994-forrest-gump","6822054779":"2016-the-nice-guys","6822072736":"2002-minority-report","6820730686":"1995-bad-boys","6822050541":"2013-prisoners","6822054364":"2008-rachel-getting-married","6822101531":"1989-dead-poets-society","6822048777":"2008-get-smart","6822054977":"2006-talladega-nights","6822050093":"2009-julie-and-julia","6820740030":"1988-big","6820731539":"1995-clueless","6824697268":"2004-anchorman","6822040006":"2010-eat-pray-love","6820740767":"2008-body-of-lies"};
const bridgeBase = "https://hls-amt.itunes.apple.com/__apple_movie_master/";
const f1Replays = [{"slug":"australia","programId":"1337486392","assetId":"1881724926","revision":"f1aur22m1"},{"slug":"china","programId":"1337522687","assetId":"1881777941","revision":"f1cnr21m2"},{"slug":"japan","programId":"1326620577","assetId":"1881763666","revision":"f1jpr20m1"},{"slug":"miami","programId":"1364568578","assetId":"1881733891","revision":"f1mir20m1"},{"slug":"canada","programId":"1392837560","assetId":"1881753363","revision":"f1car20m1"},{"slug":"monaco","programId":"1411825097","assetId":"1881742204","revision":"f1mcr25m1"},{"slug":"barcelona-catalunya","programId":"1413846083","assetId":"1881690171","revision":"f1bar17m1"},{"slug":"austria","programId":"1429344944","assetId":"1882150267","revision":"f1atr22m1"},{"slug":"great-britain","programId":"1436852938","assetId":"1881739464","revision":"f1gbr26m1"},{"slug":"belgium","programId":"1457248952","assetId":"1881786635","revision":"f1ber12m1"},{"slug":"hungary","programId":"1461869625","assetId":"1881700068","revision":"f1hur32m1"},{"slug":"netherlands","programId":"1478680801","assetId":"1882152939","revision":"f1ntr23m1"},{"slug":"spain","programId":"1497835498","assetId":"1881721455","revision":"f1spr22m1"},{"slug":"azerbaijan","programId":"1509835184","assetId":"1882094604","revision":"azr1-76f792623176"},{"slug":"bahrain-malaysia","programId":"1526866852","assetId":"6819360836","revision":"bhm1-57ce7a36cff3"},{"slug":"bahrain-malaysia","programId":"1529375473","assetId":"6819360836","revision":"bhm1-57ce7a36cff3"},{"slug":"singapore","programId":"1525529454","assetId":"1881782888","revision":"20261024r7"}];
const seriesTargets = {"1880499459":{"slug":"dts-s08e01","programId":"1288232144"},"1880598345":{"slug":"dts-s08e02","programId":"1288232871"},"1880600976":{"slug":"dts-s08e03","programId":"1287879890"},"1880613354":{"slug":"dts-s08e04","programId":"1287887004"},"1880628537":{"slug":"dts-s08e05","programId":"1312757141"},"1880639133":{"slug":"dts-s08e06","programId":"1287881790"},"1880673513":{"slug":"dts-s08e07","programId":"1288233124"},"1880677128":{"slug":"dts-s08e08","programId":"1287884341"}};
const seriesRevision = "dts8-20260920d";
function nativePlaybackUrl(value) {
  return String(value || "").replace(/^https:\/\/play-edge-cdn\.itunes\.apple\.com/i, "https://play-edge.itunes.apple.com").replace(/^https:\/\/play-cdn\.itunes\.apple\.com/i, "https://play.itunes.apple.com");
}
function bridgeHlsUrl(value) {
  if (typeof value !== "string" || !/^https:\/\/play(?:-edge)?(?:-cdn)?\.itunes\.apple\.com\//i.test(value)) return value;
  try {
    const url = new URL(nativePlaybackUrl(value));
    const replay = f1Replays.find((item) =>
      /^play(?:-edge)?.itunes.apple.com$/i.test(url.hostname) &&
      url.pathname === "/WebObjects/MZPlayLocal.woa/hls/subscription/playlist.m3u8" &&
      url.searchParams.get("id") === item.programId &&
      url.searchParams.get("a") === item.assetId
    );
    if (replay) return "https://hls-amt.itunes.apple.com/__f1_replay_master/" + replay.slug + "/index.m3u8?rev=" + replay.revision + "&src=" + encodeURIComponent(url.toString());
  } catch (_) {}
  for (const assetId of Object.keys(seriesTargets)) {
    const target = seriesTargets[assetId];
    try {
      const url = new URL(nativePlaybackUrl(value));
      if (
        /^play(?:-edge)?\.itunes\.apple\.com$/i.test(url.hostname) &&
        url.pathname === "/WebObjects/MZPlayLocal.woa/hls/subscription/playlist.m3u8" &&
        url.searchParams.get("a") === assetId &&
        url.searchParams.get("id") === target.programId
      ) return "https://hls-amt.itunes.apple.com/__apple_series_master/" + target.slug + "/index.m3u8?rev=" + seriesRevision + "&src=" + encodeURIComponent(url.toString());
    } catch (_) {}
  }
  for (const assetId of Object.keys(targets)) {
    if (!value.includes(assetId)) continue;
    const source = nativePlaybackUrl(value);
    return bridgeBase + targets[assetId] + "/index.m3u8?rev=" + (shelfRevisions[assetId] || (assetId === "6796433608" ? "v260925a" : "v260904a")) + "&src=" + encodeURIComponent(source);
  }
  return value;
}
function rewrite(value) {
  if (Array.isArray(value)) return value.map(rewrite);
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const key of Object.keys(value)) output[key] = key === "hlsUrl" ? bridgeHlsUrl(value[key]) : rewrite(value[key]);
  return output;
}
try {
  const body = typeof $response.body === "string" ? JSON.parse($response.body) : null;
  if (!body) $done({});
  else $done({ body: JSON.stringify(rewrite(body)) });
} catch (_) { $done({}); }
