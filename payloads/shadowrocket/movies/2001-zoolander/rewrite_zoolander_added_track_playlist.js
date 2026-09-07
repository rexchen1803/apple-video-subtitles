const resource = "P1467242439_A6793692948";
const url = $request.url || "";
const body = $response.body || "";
const marked = /[?&]zoolanderzh=1(?:&|$)/.test(url);
const target = new RegExp("(?:[?&](?:mainAssetAdamId|a)=6793692948(?:[&#]|$)|_A6793692948_)").test(url);
if (!marked || !target || !body.startsWith("#EXTM3U")) { $done({}); }
else {
  const lines = body.split(/\r?\n/);
  const leaves = lines.filter((line) => line.includes(resource) && /_es-419_subtitles_V2-[^\s?]*\.webvtt/.test(line));
  if (leaves.length !== 1 || lines.some((line) => /(?:pre|post|empty)/i.test(line) && line.includes(resource))) $done({});
  else {
    const rewritten = lines.map((line) => {
      if (!line.includes(resource) || !/_es-419_subtitles_V2-[^\s?]*\.webvtt/.test(line) || /[?&]zoolanderzh=1(?:&|$)/.test(line)) return line;
      return `${line}${line.includes("?") ? "&" : "?"}zoolanderzh=1`;
    }).join(body.includes("\r\n") ? "\r\n" : "\n");
    $done({ body: rewritten });
  }
}
