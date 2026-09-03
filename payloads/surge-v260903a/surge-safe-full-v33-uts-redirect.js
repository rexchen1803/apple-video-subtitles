const targets = {"6793021118":"1982-et-the-extra-terrestrial","6793332306":"1997-titanic","6793615720":"1999-the-sixth-sense","6793717567":"2000-charlies-angels","6793692948":"2001-zoolander","6800163537":"2002-the-bourne-identity","6793717467":"2002-the-rookie","6793304264":"2004-i-robot","6793733076":"2004-the-aviator","6793692535":"2007-zodiac","6793695228":"2008-forgetting-sarah-marshall","6793346155":"2009-the-proposal","6793326577":"2011-mission-impossible-ghost-protocol","6792903247":"2012-21-jump-street","6793683930":"2012-looper","6792938265":"2014-gone-girl","6799243858":"2015-the-martian","6793693246":"2016-arrival","6804782509":"2013-the-wolf-of-wall-street","6804788858":"2013-her","6804781135":"2010-the-social-network","6804923769":"2003-master-and-commander","6802779390":"2012-zero-dark-thirty","6804557496":"2003-school-of-rock","6804925972":"1986-ferris-buellers-day-off","6802449163":"2007-superbad","6803646799":"1992-a-league-of-their-own","6804791114":"2004-troy","6794488214":"2005-war-of-the-worlds","6806102086":"2008-mamma-mia","6803647112":"2010-easy-a","6803646767":"2008-definitely-maybe","6804789316":"2009-the-informant"};
const bridgeBase = "https://hls-amt.itunes.apple.com/__apple_movie_master/";
function nativePlaybackUrl(value) {
  return String(value || "").replace(/^https:\/\/play-edge-cdn\.itunes\.apple\.com/i, "https://play-edge.itunes.apple.com").replace(/^https:\/\/play-cdn\.itunes\.apple\.com/i, "https://play.itunes.apple.com");
}
function bridgeHlsUrl(value) {
  if (typeof value !== "string" || !/^https:\/\/play(?:-edge)?(?:-cdn)?\.itunes\.apple\.com\//i.test(value)) return value;
  for (const assetId of Object.keys(targets)) {
    if (!value.includes(assetId)) continue;
    const source = nativePlaybackUrl(value);
    return bridgeBase + targets[assetId] + "/index.m3u8?rev=v260903a&src=" + encodeURIComponent(source);
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
