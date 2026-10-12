const assetId = "6803646767";
const markerKey = "m1514zhp1";
const url = $request.url || "";
const body = $response.body || "";
const marked = new RegExp("[?&]" + markerKey + "=1(?:&|$)").test(url);
const target = new RegExp("(?:[?&](?:mainAssetAdamId|a)=[^&#]*" + assetId + "(?:[&#]|$)|_A" + assetId + "_)").test(url);
if (!marked || !target || !body.startsWith("#EXTM3U")) {
  $done({});
} else {
  const lines = body.split(/\r?\n/);
  function isAllowedNativeDonorUrl(value) {
  try {
    const raw = String(value || "");
    const match = raw.match(/^https:\/\/([^/?#]+)(\/[^?#]*)(?:\?[^#]*)?$/i);
    if (!match || ["vod-ap-aoc.tv.apple.com", "vod-fa-aoc.tv.apple.com", "vod-ak-aoc.tv.apple.com"].indexOf(match[1].toLowerCase()) < 0) return false;
    const filename = decodeURIComponent(match[2].slice(match[2].lastIndexOf("/") + 1));
    return ["P1478609383_A6803646767_es-419_subtitles_V2-.webvtt"].indexOf(filename) >= 0;
  } catch (_) { return false; }
}

  const leaves = lines.filter((line) => isAllowedNativeDonorUrl(line.trim()));
  if (leaves.length !== 1) {
    $done({});
  } else {
    const featureIndex = lines.indexOf(leaves[0]);
    const rangeIndex = featureIndex - 1;
    const range = lines[rangeIndex] || "";
    if (range.startsWith("#EXT-X-BYTERANGE:") && range !== "#EXT-X-BYTERANGE:240367@0") { $done({}); } else {
    const rewritten = lines.map((line) => {
      if (line !== leaves[0] || new RegExp("[?&]" + markerKey + "=1(?:&|$)").test(line)) return line;
      return line + (line.includes("?") ? "&" : "?") + markerKey + "=1";
    }).filter((line, index) => !(range.startsWith("#EXT-X-BYTERANGE:") && index === rangeIndex)).join(body.includes("\r\n") ? "\r\n" : "\n");
    $done({ body: rewritten });
    }
  }
}
