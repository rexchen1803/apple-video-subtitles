const assetId = "6804791114";
const markerKey = "m1510zhp1";
const url = $request.url || "";
const body = $response.body || "";
const marked = new RegExp("[?&]" + markerKey + "=1(?:&|$)").test(url);
const target = new RegExp("(?:[?&](?:mainAssetAdamId|a)=[^&#]*" + assetId + "(?:[&#]|$)|_A" + assetId + "_)").test(url);
if (!marked || !target || !body.startsWith("#EXTM3U")) {
  $done({});
} else {
  const lines = body.split(/\r?\n/);
  const leaves = lines.filter((line) => line.includes("_A" + assetId + "_") && /\.webvtt(?:[?#]|$)/i.test(line) && !/(?:pre|post|empty)/i.test(line));
  if (leaves.length !== 1) {
    $done({});
  } else {
    const rewritten = lines.map((line) => {
      if (line !== leaves[0] || new RegExp("[?&]" + markerKey + "=1(?:&|$)").test(line)) return line;
      return line + (line.includes("?") ? "&" : "?") + markerKey + "=1";
    }).join(body.includes("\r\n") ? "\r\n" : "\n");
    $done({ body: rewritten });
  }
}
