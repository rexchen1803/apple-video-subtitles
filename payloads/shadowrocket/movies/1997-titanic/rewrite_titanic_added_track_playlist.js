const marker = "titaniczh=1";
const featurePatterns = [
  /\/itunes-assets\/HLSAppleVideo211\/v4\/(?:[^\/]+\/)+P1474878312_A6793332306_es-419_subtitles_V2-\.webvtt/,
  /\/itunes-assets\/HLSAppleVideo221\/v4\/59\/aa\/9d\/59aa9ddd-f65a-085f-7a2c-c4b927941f8b\/empty-11688089\.webvtt/,
];

try {
  const requestURL = $request.url || "";
  const body = $response.body;
  const hasFeature = (value) => featurePatterns.some((pattern) => pattern.test(value));
  if (!requestURL.includes(marker) || typeof body !== "string" || !hasFeature(body)) {
    $done({});
  } else {
    let replaced = 0;
    const output = body.replace(/\r/g, "").split("\n").map((line) => {
      if (!line.startsWith("#") && hasFeature(line)) {
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
