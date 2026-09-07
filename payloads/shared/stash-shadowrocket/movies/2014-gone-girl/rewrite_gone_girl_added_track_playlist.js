const assetPattern = /P1467262512_A6792938265_en_subtitles_V\d+-\.webvtt/;

try {
  const requestUrl = $request.url;
  const body = $response.body;
  if (
    typeof body !== "string" ||
    !/[?&]gonegirlzh=1(?:&|$)/.test(requestUrl) ||
    !/[?&]mainAssetAdamId=6792938265(?:&|$)/.test(requestUrl) ||
    !body.includes("#EXTM3U")
  ) {
    $done({});
  } else {
    let replaced = 0;
    const output = body.replace(/\r/g, "").split("\n").map((line) => {
      if (line.startsWith("#") || !assetPattern.test(line)) return line;
      replaced += 1;
      return /[?&]gonegirlzh=1(?:&|$)/.test(line)
        ? line
        : `${line}${line.includes("?") ? "&" : "?"}gonegirlzh=1`;
    });
    $done(replaced === 1 ? { body: output.join("\n") } : {});
  }
} catch (_) {
  $done({});
}
