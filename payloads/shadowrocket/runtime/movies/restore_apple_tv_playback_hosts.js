const hostMap = {
  "play.itunes.apple.com": "play-cdn.itunes.apple.com",
  "play-edge.itunes.apple.com": "play-edge-cdn.itunes.apple.com",
};

function rewriteHlsUrl(value) {
  if (typeof value !== "string") return value;
  const match = value.match(/^(https?:\/\/)([^\/?#]+)([\s\S]*)$/i);
  if (!match) return value;
  const replacement = hostMap[match[2].toLowerCase()];
  return replacement ? `${match[1]}${replacement}${match[3]}` : value;
}

function rewrite(value) {
  if (Array.isArray(value)) return value.map(rewrite);
  if (!value || typeof value !== "object") return value;

  const output = {};
  for (const [key, child] of Object.entries(value)) {
    output[key] = key === "hlsUrl" ? rewriteHlsUrl(child) : rewrite(child);
  }
  return output;
}

try {
  const body = typeof $response.body === "string" ? JSON.parse($response.body) : null;
  if (!body) {
    $done({});
  } else {
    const rewritten = rewrite(body);
    $done({ body: JSON.stringify(rewritten) });
  }
} catch (_) {
  $done({});
}
