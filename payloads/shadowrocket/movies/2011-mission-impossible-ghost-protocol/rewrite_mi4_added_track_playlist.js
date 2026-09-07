const marker = "mi4zhadd=1";
const assetPattern = /P1467262841_A6793326577_es-419_subtitles_V\d+-\.webvtt/;

try {
  const requestURL = $request.url || "";
  const body = $response.body;
  if (!requestURL.includes(marker) || typeof body !== "string" || !assetPattern.test(body)) {
    $done({});
  } else {
    let replaced = 0;
    const output = body.replace(/\r/g, "").split("\n").map((line) => {
      if (!line.startsWith("#") && assetPattern.test(line)) {
        replaced += 1;
        return line.includes(marker) ? line : `${line}${line.includes("?") ? "&" : "?"}${marker}`;
      }
      return line;
    });
    $done(replaced === 1 ? { body: output.join("\n") } : {});
  }
} catch (_) {
  $done({});
}
