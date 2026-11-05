const assetId = "6822050093";
const markerKey = "movie2009julieandjuliazh";
function isPreparedFeature(value) {
  try {
    const match = String(value || "").trim().match(/^https:\/\/([^/?#]+)(\/[^?#]*)(?:\?[^#]*)?$/i);
    return !!match && ["vod-ak-aoc.tv.apple.com","vod-ap-aoc.tv.apple.com","vod-fa-aoc.tv.apple.com"].includes(match[1].toLowerCase()) && ["P1523431483_A6822050093_en_subtitles_V1-.webvtt","P1523431483_A6822050093_en_subtitles_V2-.webvtt"].includes(decodeURIComponent(match[2].slice(match[2].lastIndexOf("/") + 1)));
  } catch (_) { return false; }
}
const url = $request.url || "";
const body = $response.body || "";
const marked = new RegExp("[?&]" + markerKey + "=1(?:&|$)").test(url);
const target = new RegExp("[?&](?:mainAssetAdamId|a)=" + assetId + "(?:[&#]|$)").test(url);
if (!marked || !target || !body.startsWith("#EXTM3U")) $done({});
else {
  const lines = body.replace(/\r/g, "").split("\n");
  const leaves = lines.map((s,i)=>({s,i})).filter(({s})=>isPreparedFeature(s));
  if (leaves.length !== 1 || !lines.includes("#EXT-X-ENDLIST") || lines.some(s=>s.startsWith("#EXT-X-MAP:"))) $done({});
  else {
    const {s:feature,i} = leaves[0];
    const filename = decodeURIComponent(feature.split("?")[0].split("/").pop());
    const sizes = {"P1523431483_A6822050093_en_subtitles_V1-.webvtt":202258,"P1523431483_A6822050093_en_subtitles_V2-.webvtt":203923};
    const range = lines[i-1]?.startsWith("#EXT-X-BYTERANGE:") ? lines[i-1] : "";
    if (range && range !== "#EXT-X-BYTERANGE:" + sizes[filename] + "@0") $done({});
    else $done({body:lines.map((line,j)=>j===i ? line + (line.includes("?")?"&":"?") + markerKey + "=1" : line).filter((_,j)=>!(range && j===i-1)).join(body.includes("\r\n")?"\r\n":"\n")});
  }
}
