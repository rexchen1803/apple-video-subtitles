const assetPattern = /(?:P1468742269|P1477111467)_A6799243858_en_subtitles_V\d+-\.webvtt/;

try {
  const requestUrl = $request.url;
  const body = $response.body;
  if (
    typeof body !== "string" ||
    !/[?&]martianzh=1(?:&|$)/.test(requestUrl) ||
    !/[?&]mainAssetAdamId=6799243858(?:&|$)/.test(requestUrl) ||
    !body.includes("#EXTM3U")
  ) {
    $done({});
  } else {
    let replaced = 0;
    const output = body.replace(/\r/g, "").split("\n").map((line) => {
      if (line.startsWith("#") || !assetPattern.test(line)) return line;
      replaced += 1;
      return /[?&]martianzh=1(?:&|$)/.test(line)
        ? line
        : `${line}${line.includes("?") ? "&" : "?"}martianzh=1`;
    });
    $done(replaced === 1 ? { body: output.join("\n") } : {});
  }
} catch (_) {
  $done({});
}
