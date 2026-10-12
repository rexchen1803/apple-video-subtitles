const assetId = "6793615720";
const resource = "P1473679078_A6793615720";
const url = $request.url || "";
const body = $response.body || "";
const marked = /[?&]sixthsensezh=1(?:&|$)/.test(url);
const target = new RegExp("(?:[?&](?:mainAssetAdamId|a)=" + assetId + "(?:[&#]|$)|_A" + assetId + "_)").test(url);
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
    return ["P1473679078_A6793615720_en_subtitles_V2-.webvtt"].indexOf(filename) >= 0;
  } catch (_) { return false; }
}

  const leaves = lines.filter((line) => isAllowedNativeDonorUrl(line.trim()));
  if (leaves.length !== 1 || lines.some((line) => /(?:pre|post|empty)/i.test(line) && line.includes(resource))) {
    $done({});
  } else {
    const featureIndex = lines.indexOf(leaves[0]);
    const rangeIndex = featureIndex - 1;
    const range = lines[rangeIndex] || "";
    if (range.startsWith("#EXT-X-BYTERANGE:") && range !== "#EXT-X-BYTERANGE:122334@0") { $done({}); } else {
    const rewritten = lines.map((line) => {
      if (!line.includes(resource) || !/_en_subtitles_V2-[^\s?]*\.webvtt/.test(line) || /[?&]sixthsensezh=1(?:&|$)/.test(line)) return line;
      return `${line}${line.includes("?") ? "&" : "?"}sixthsensezh=1`;
    }).filter((line, index) => !(range.startsWith("#EXT-X-BYTERANGE:") && index === rangeIndex)).join(body.includes("\r\n") ? "\r\n" : "\n");
    $done({ body: rewritten });
    }
  }
}
