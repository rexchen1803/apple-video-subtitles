const assetId = "6793346155";
const resource = "P1473603759_A6793346155";
const url = $request.url || "";
const body = $response.body || "";
const marked = /[?&]proposalzh=1(?:&|$)/.test(url);
const target = new RegExp("(?:[?&](?:mainAssetAdamId|a)=" + assetId + "(?:[&#]|$)|_A" + assetId + "_)").test(url);
if (!marked || !target || !body.startsWith("#EXTM3U")) {
  $done({});
} else {
  const lines = body.split(/\r?\n/);
  const leaves = lines.filter((line) => line.includes(resource) && /_en_subtitles_V2-[^\s?]*\.webvtt/.test(line));
  if (leaves.length !== 1 || lines.some((line) => /(?:pre|post|empty)/i.test(line) && line.includes(resource))) {
    $done({});
  } else {
    const rewritten = lines.map((line) => {
      if (!line.includes(resource) || !/_en_subtitles_V2-[^\s?]*\.webvtt/.test(line) || /[?&]proposalzh=1(?:&|$)/.test(line)) return line;
      return `${line}${line.includes("?") ? "&" : "?"}proposalzh=1`;
    }).join(body.includes("\r\n") ? "\r\n" : "\n");
    $done({ body: rewritten });
  }
}
