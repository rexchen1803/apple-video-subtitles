const assetId = "6793326577";
const stableRenditionId = "mi4-zh-hans-added-v1";
const marker = "mi4zhadd=1";

function quotedAttribute(line, name) {
  return line.match(new RegExp(`${name}="([^"]+)"`))?.[1] || null;
}

function setAttribute(line, name, value, quoted = false) {
  const pattern = new RegExp(`${name}=(?:"[^"]*"|[^,]*)`);
  const rendered = `${name}=${quoted ? `"${value}"` : value}`;
  return pattern.test(line) ? line.replace(pattern, rendered) : `${line},${rendered}`;
}

function inject(body) {
  if (
    typeof body !== "string" ||
    !body.includes("#EXT-X-STREAM-INF:") ||
    !body.includes(`DATA-ID="com.apple.hls.feature.adam-id",VALUE="${assetId}"`)
  ) return null;
  if (body.includes(`STABLE-RENDITION-ID="${stableRenditionId}"`)) return body;

  const lines = body.replace(/\r/g, "").split("\n");
  const source = lines.filter((line) =>
    line.startsWith("#EXT-X-MEDIA:") &&
    line.includes("TYPE=SUBTITLES") &&
    quotedAttribute(line, "LANGUAGE") === "es-419" &&
    line.includes("FORCED=NO")
  );
  if (source.length !== 3) return null;

  const added = source.map((line) => {
    let output = setAttribute(line, "LANGUAGE", "zh-Hans", true);
    output = setAttribute(output, "NAME", "简体中文", true);
    output = setAttribute(output, "DEFAULT", "YES");
    output = setAttribute(output, "AUTOSELECT", "YES");
    output = setAttribute(output, "ASSOC-LANGUAGE", "zh", true);
    output = setAttribute(output, "STABLE-RENDITION-ID", stableRenditionId, true);
    const uri = quotedAttribute(output, "URI");
    return uri && !uri.includes(marker)
      ? setAttribute(output, "URI", `${uri}&${marker}`, true)
      : output;
  });

  const insertion = lines.findIndex((line) => line.startsWith("#EXT-X-STREAM-INF:"));
  if (insertion < 0) return null;
  lines.splice(insertion, 0, ...added);
  return lines.join("\n");
}

try {
  const body = inject($response.body);
  $done(body ? { body } : {});
} catch (_) {
  $done({});
}
