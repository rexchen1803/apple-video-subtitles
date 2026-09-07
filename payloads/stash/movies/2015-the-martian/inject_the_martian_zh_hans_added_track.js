const assetId = "6799243858";
const stableRenditionId = "martian-zh-hans-v1";

function quotedAttribute(line, name) {
  return line.match(new RegExp(`${name}="([^"]+)"`))?.[1] || null;
}

function setAttribute(line, name, value, quoted = false) {
  const pattern = new RegExp(`${name}=(?:"[^"]*"|[^,]*)`);
  const rendered = `${name}=${quoted ? `"${value}"` : value}`;
  return pattern.test(line) ? line.replace(pattern, rendered) : `${line},${rendered}`;
}

function injectTrack(body) {
  if (
    typeof body !== "string" ||
    !body.includes("#EXT-X-STREAM-INF:") ||
    !body.includes(`DATA-ID="com.apple.hls.feature.adam-id",VALUE="${assetId}"`)
  ) {
    return null;
  }
  if (body.includes(`STABLE-RENDITION-ID="${stableRenditionId}"`)) return body;

  const lines = body.replace(/\r/g, "").split("\n");
  const englishRows = lines.filter(
    (line) =>
      line.startsWith("#EXT-X-MEDIA:") &&
      line.includes("TYPE=SUBTITLES") &&
      quotedAttribute(line, "LANGUAGE") === "en" &&
      line.includes("FORCED=NO") &&
      ["ap", "fa", "ak"].includes(quotedAttribute(line, "PATHWAY-ID")),
  );
  if (englishRows.length !== 3) return null;

  const chineseRows = englishRows.map((line) => {
    const uri = quotedAttribute(line, "URI");
    if (!uri) throw new Error("English subtitle row has no URI");
    let output = setAttribute(line, "LANGUAGE", "zh-Hans", true);
    output = setAttribute(output, "NAME", "简体中文", true);
    output = setAttribute(output, "DEFAULT", "YES");
    output = setAttribute(output, "AUTOSELECT", "YES");
    output = setAttribute(output, "ASSOC-LANGUAGE", "zh", true);
    output = setAttribute(output, "STABLE-RENDITION-ID", stableRenditionId, true);
    output = setAttribute(output, "URI", `${uri}&martianzh=1`, true);
    return output;
  });

  const insertionIndex = lines.indexOf(englishRows.at(-1)) + 1;
  lines.splice(insertionIndex, 0, ...chineseRows);
  return lines.join("\n");
}

try {
  const body = injectTrack($response.body);
  $done(body ? { body } : {});
} catch (_) {
  $done({});
}
