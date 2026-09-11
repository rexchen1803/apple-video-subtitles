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

const targets = {"6793021118":"1982-et-the-extra-terrestrial","6793332306":"1997-titanic","6793615720":"1999-the-sixth-sense","6793717567":"2000-charlies-angels","6793692948":"2001-zoolander","6800163537":"2002-the-bourne-identity","6793717467":"2002-the-rookie","6793304264":"2004-i-robot","6793733076":"2004-the-aviator","6793692535":"2007-zodiac","6793695228":"2008-forgetting-sarah-marshall","6793346155":"2009-the-proposal","6793326577":"2011-mission-impossible-ghost-protocol","6792903247":"2012-21-jump-street","6793683930":"2012-looper","6792938265":"2014-gone-girl","6799243858":"2015-the-martian","6793693246":"2016-arrival","6804782509":"2013-the-wolf-of-wall-street","6804788858":"2013-her","6804781135":"2010-the-social-network","6804923769":"2003-master-and-commander","6802779390":"2012-zero-dark-thirty","6804557496":"2003-school-of-rock","6804925972":"1986-ferris-buellers-day-off","6802449163":"2007-superbad","6803646799":"1992-a-league-of-their-own","6804791114":"2004-troy","6794488214":"2005-war-of-the-worlds","6806102086":"2008-mamma-mia","6803647112":"2010-easy-a","6803646767":"2008-definitely-maybe","6804789316":"2009-the-informant"};
const bridgeBase = "https://hls-amt.itunes.apple.com/__apple_movie_master/";
const f1Replays = [{"slug":"australia","programId":"1337486392","assetId":"1881724926","revision":"f1aur22m1"},{"slug":"china","programId":"1337522687","assetId":"1881777941","revision":"f1cnr21m2"},{"slug":"japan","programId":"1326620577","assetId":"1881763666","revision":"f1jpr20m1"},{"slug":"miami","programId":"1364568578","assetId":"1881733891","revision":"f1mir20m1"},{"slug":"canada","programId":"1392837560","assetId":"1881753363","revision":"f1car20m1"},{"slug":"monaco","programId":"1411825097","assetId":"1881742204","revision":"f1mcr25m1"},{"slug":"barcelona-catalunya","programId":"1413846083","assetId":"1881690171","revision":"f1bar17m1"},{"slug":"austria","programId":"1429344944","assetId":"1882150267","revision":"f1atr22m1"},{"slug":"great-britain","programId":"1436852938","assetId":"1881739464","revision":"f1gbr26m1"},{"slug":"belgium","programId":"1457248952","assetId":"1881786635","revision":"f1ber12m1"},{"slug":"hungary","programId":"1461869625","assetId":"1881700068","revision":"f1hur32m1"},{"slug":"netherlands","programId":"1478680801","assetId":"1882152939","revision":"f1ntr23m1"}];
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
  for (const assetId of Object.keys(targets)) {
    if (!value.includes(assetId)) continue;
    const source = nativePlaybackUrl(value);
    return bridgeBase + targets[assetId] + "/index.m3u8?rev=v260904a&src=" + encodeURIComponent(source);
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
