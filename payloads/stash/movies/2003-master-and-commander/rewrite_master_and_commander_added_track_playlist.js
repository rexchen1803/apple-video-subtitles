const assetId = "6804923769";
const markerKey = "m1504zhp1";
const url = $request.url || "";
const body = $response.body || "";
function isMasterFeatureUrl(value) {
  const raw = String(value || "").trim();
  if (raw.slice(0, 8).toLowerCase() !== "https://") return false;
  const rest = raw.slice(8);
  const slash = rest.indexOf("/");
  if (slash < 0) return false;
  const host = rest.slice(0, slash).toLowerCase();
  const pathAndQuery = rest.slice(slash);
  if (pathAndQuery.includes("#")) return false;
  const path = pathAndQuery.split("?")[0];
  const filename = path.slice(path.lastIndexOf("/") + 1);
  return ["vod-ap-aoc.tv.apple.com", "vod-fa-aoc.tv.apple.com", "vod-ak-aoc.tv.apple.com"].includes(host) &&
    ["P1478615099_A6804923769_en_subtitles_V2-.webvtt", "P1485810495_A6804923769_en_subtitles_V2-.webvtt"].includes(filename);
}
const marked = new RegExp("[?&]" + markerKey + "=1(?:&|$)").test(url);
const target = new RegExp("(?:[?&](?:mainAssetAdamId|a)=[^&#]*" + assetId + "(?:[&#]|$)|_A" + assetId + "_)").test(url);
if (!marked || !target || !body.startsWith("#EXTM3U")) {
  $done({});
} else {
  const carriageReturn = String.fromCharCode(13);
  const lineFeed = String.fromCharCode(10);
  const lineEnding = body.includes(carriageReturn + lineFeed) ? carriageReturn + lineFeed : lineFeed;
  const lines = body.split(lineFeed).map((line) => line.endsWith(carriageReturn) ? line.slice(0, -1) : line);
  const leaves = lines.filter((line) => isMasterFeatureUrl(line.trim()));
  if (leaves.length !== 1) {
    $done({});
  } else {
    const featureIndex = lines.findIndex((line) => line.trim() === leaves[0].trim());
    const rangeIndex = featureIndex - 1;
    const precedingRange = rangeIndex >= 0 && lines[rangeIndex].startsWith("#EXT-X-BYTERANGE:") ? lines[rangeIndex] : "";
    if (precedingRange && precedingRange !== "#EXT-X-BYTERANGE:162284@0") {
      $done({});
    } else {
      const rewritten = lines.map((line, index) => {
        if (index !== featureIndex || line.trim() !== leaves[0].trim()) return line;
        const featureUrl = line.trim();
        return featureUrl + (featureUrl.includes("?") ? "&" : "?") + markerKey + "=1";
      }).filter((line, index) => !(precedingRange && index === rangeIndex)).join(lineEnding);
      $done({ body: rewritten });
    }
  }
}
