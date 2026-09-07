const assetId = "6793332306";
const stableRenditionId = "titanic-zh-hans-added-v1";
const marker = "titaniczh=1";

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
  const spanish = lines.filter((line) =>
    line.startsWith("#EXT-X-MEDIA:") &&
    line.includes("TYPE=SUBTITLES") &&
    quotedAttribute(line, "LANGUAGE") === "es-419" &&
    line.includes("FORCED=NO")
  );
  const germanForced = lines.filter((line) =>
    line.startsWith("#EXT-X-MEDIA:") &&
    line.includes("TYPE=SUBTITLES") &&
    quotedAttribute(line, "LANGUAGE") === "de" &&
    quotedAttribute(line, "NAME") === "Deutsch (forced)" &&
    line.includes("FORCED=YES")
  );
  const source = spanish.length ? spanish : germanForced;
  if (source.length < 1 || source.length > 3) return null;

  const replacement = source.map((line) => {
    let output = setAttribute(line, "LANGUAGE", "zh-Hans", true);
    output = setAttribute(output, "NAME", "简体中文", true);
    output = setAttribute(output, "DEFAULT", "YES");
    output = setAttribute(output, "AUTOSELECT", "YES");
    output = setAttribute(output, "ASSOC-LANGUAGE", "zh", true);
    output = setAttribute(output, "FORCED", "NO");
    output = setAttribute(output, "STABLE-RENDITION-ID", stableRenditionId, true);
    const uri = quotedAttribute(output, "URI");
    return uri && !uri.includes(marker)
      ? setAttribute(output, "URI", `${uri}${uri.includes("?") ? "&" : "?"}${marker}`, true)
      : output;
  });

  const insertionIndex = lines.indexOf(source.at(-1)) + 1;
  lines.splice(insertionIndex, 0, ...replacement);
  return lines.join("\n");
}

try {
  const body = inject($response.body);
  $done(body ? { body } : {});
} catch (_) {
  $done({});
}
