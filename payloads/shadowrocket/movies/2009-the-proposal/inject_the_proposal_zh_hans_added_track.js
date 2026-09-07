const assetId = "6793346155";
const marker = "proposal-zh-hans-v1";
const url = $request.url || "";
const body = $response.body || "";
const target = new RegExp("(?:[?&]mainAssetAdamId=" + assetId + "(?:[&#]|$)|[?&]a=[^&#]*" + assetId + "(?:[&#]|$)|_A" + assetId + "_)").test(url);
if (!target || !body.startsWith("#EXTM3U")) {
  $done({});
} else if (body.includes(`STABLE-RENDITION-ID="${marker}"`)) {
  $done({ body });
} else {
  const lineEnding = body.includes("\r\n") ? "\r\n" : "\n";
  const lines = body.split(/\r?\n/);
  const media = lines.map((line, index) => ({ line, index })).filter(({ line }) => line.startsWith("#EXT-X-MEDIA:") && /TYPE=SUBTITLES/.test(line));
  const ordinary = media.filter(({ line }) => !/FORCED=YES/.test(line) && /URI=/.test(line));
  const english = ordinary.filter(({ line }) => /LANGUAGE="en(?:-[^"]+)?"/.test(line));
  if (!english.length) {
    $done({});
  } else {
    const added = english.map(({ line }) => {
      const pathway = line.match(/PATHWAY-ID="([^"]+)"/)?.[1];
      const group = line.match(/GROUP-ID="([^"]+)"/)?.[1];
      const uri = line.match(/URI="([^"]+)"/)?.[1];
      if (!group || !uri) return null;
      const separator = uri.includes("?") ? "&" : "?";
      const pathwayAttribute = pathway ? `,PATHWAY-ID="${pathway}"` : "";
      return `#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="${group}",LANGUAGE="zh-Hans",NAME="简体中文",AUTOSELECT=YES,DEFAULT=NO,FORCED=NO${pathwayAttribute},STABLE-RENDITION-ID="${marker}",URI="${uri}${separator}proposalzh=1"`;
    });
    if (added.some((value) => !value)) {
      $done({});
    } else {
      const insertAt = media.length ? media[0].index : lines.length;
      lines.splice(insertAt, 0, ...added);
      $done({ body: lines.join(lineEnding) });
    }
  }
}
