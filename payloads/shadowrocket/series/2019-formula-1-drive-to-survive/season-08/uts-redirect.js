const replayConfigs = [{"station":"19-mexico","referenceId":"umc.cmr.f1live.sp.44pxqond8524r9rdavtv5frb0","revision":"f1pv261104a-mx","aliases":["mx20261104a","mx20261104b","mx20261104c"],"masterPath":"/__f1_mx_live_preview/master.m3u8"},{"station":"20-sao-paulo","referenceId":"umc.cmr.f1live.sp.4u929zfqzsx24g94h48fc52os","revision":"sp20261109b","aliases":[],"masterPath":"/__f1_sp_live_preview/master.m3u8"}];
const f1pvLibrary = (function previewLibrary() {
  function parseUrl(raw) {
    if (typeof raw !== 'string' || /[\s\u0000-\u001f#]/.test(raw)) return null;
    const m = /^https:\/\/([A-Za-z0-9.-]+)(\/[^?]*)?(?:\?(.*))?$/.exec(raw);
    if (!m || !m[1] || m[1].indexOf('..') >= 0) return null;
    const params = Object.create(null), keys = [];
    try {
      if (m[3]) for (const part of m[3].split('&')) {
        if (!part) return null;
        const at = part.indexOf('='), decode = value => decodeURIComponent(value.replace(/\+/g, ' '));
        const key = decode(at < 0 ? part : part.slice(0, at));
        const value = decode(at < 0 ? '' : part.slice(at + 1));
        if (!key || /[\u0000-\u001f\u007f]/.test(key + value) || Object.prototype.hasOwnProperty.call(params, key)) return null;
        params[key] = value; keys.push(key);
      }
    } catch (_) { return null; }
    return {raw: raw, host: m[1].toLowerCase(), pathname: m[2] || '/', params: params, keys: keys};
  }
  function exactKeys(url, keys) {
    return !!url && url.keys.length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(url.params, key));
  }
  function sourceUrl(raw, config) {
    const url = parseUrl(raw);
    return url && url.host === 'linear.tv.apple.com' && url.pathname === '/v1/hls/playlist.m3u8'
      && url.params.referenceId === config.referenceId ? url : null;
  }
  function absolute(value, base) {
    if (!value || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)) return value;
    const b = parseUrl(base); if (!b) return null;
    if (value.indexOf('//') === 0) return 'https:' + value;
    let resource = value.charAt(0) === '/' ? value : b.pathname.slice(0, b.pathname.lastIndexOf('/') + 1) + value;
    const queryAt = resource.indexOf('?'), query = queryAt < 0 ? '' : resource.slice(queryAt);
    resource = queryAt < 0 ? resource : resource.slice(0, queryAt);
    const parts = [];
    for (const part of resource.split('/')) {
      if (part === '..') { if (!parts.length) return null; parts.pop(); }
      else if (part && part !== '.') parts.push(part);
    }
    return 'https://' + b.host + '/' + parts.join('/') + query;
  }
  function hostPath(value, base) {
    const u = parseUrl(absolute(value, base));
    return u ? u.host + u.pathname : null;
  }
  function attrs(line) {
    const text = line.slice(line.indexOf(':') + 1), pieces = [];
    let quoted = false, start = 0;
    for (let i = 0; i <= text.length; i++) {
      const char = text.charAt(i);
      if (char === '"') quoted = !quoted;
      if ((char === ',' && !quoted) || i === text.length) { pieces.push(text.slice(start, i)); start = i + 1; }
    }
    if (quoted) return null;
    const out = {};
    for (const part of pieces) {
      const at = part.indexOf('='); if (at < 1) return null;
      const key = part.slice(0, at).trim();
      if (Object.prototype.hasOwnProperty.call(out, key) || key === '__proto__') return null;
      let value = part.slice(at + 1).trim();
      if (value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') value = value.slice(1, -1);
      out[key] = value;
    }
    return out;
  }
  function sorted(rows) { return rows.map(row => JSON.stringify(row)).sort(); }
  function identity(body, base) {
    if (typeof body !== 'string' || !/^#EXTM3U\r?\n/.test(body)) return null;
    const lines = body.replace(/\r\n?/g, '\n').split('\n'), variants = [], audio = [], iframe = [], cc = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.indexOf('#EXT-X-STREAM-INF:') === 0) {
        const a = attrs(line); if (!a || !a['PATHWAY-ID'] || a.SUBTITLES != null) return null;
        let value = null;
        for (let j = i + 1; j < lines.length; j++) {
          if (!lines[j]) continue; if (lines[j].charAt(0) === '#') break; value = lines[j]; break;
        }
        const uri = hostPath(value, base); if (!uri) return null;
        variants.push({attrs: a, uri: uri});
      } else if (line.indexOf('#EXT-X-MEDIA:') === 0) {
        const a = attrs(line); if (!a || a.TYPE === 'SUBTITLES') return null;
        if (a.TYPE === 'AUDIO') { const uri = hostPath(a.URI, base); if (!uri) return null; delete a.URI; audio.push({attrs: a, uri: uri}); }
        else if (a.TYPE === 'CLOSED-CAPTIONS') cc.push(a);
      } else if (line.indexOf('#EXT-X-I-FRAME-STREAM-INF:') === 0) {
        const a = attrs(line); if (!a) return null;
        const uri = hostPath(a.URI, base); if (!uri) return null; delete a.URI; iframe.push({attrs: a, uri: uri});
      }
    }
    const pathways = Array.from(new Set(variants.map(row => row.attrs['PATHWAY-ID']))).sort();
    const otherTags = lines.filter(line => line.charAt(0) === '#'
      && !/^#EXT-X-(?:STREAM-INF|I-FRAME-STREAM-INF|MEDIA|CONTENT-STEERING|SESSION-DATA):/.test(line));
    return {variantCount: variants.length, audioCount: audio.length, closedCaptionCount: cc.length,
      variants: sorted(variants), audio: sorted(audio), iframe: sorted(iframe), closedCaptions: sorted(cc), pathways: pathways,
      otherTags: otherTags.sort()};
  }
  function canonicalIdentity(value, config) {
    if (!value) return null;
    if (!config.normalizePathwayRanks) return value;
    const copy = JSON.parse(JSON.stringify(value)), ranks = {};
    for (const raw of copy.variants) {
      const a = JSON.parse(raw).attrs;
      if (!a || !/^\d+$/.test(a['AVERAGE-BANDWIDTH'] || '') || a['AVERAGE-BANDWIDTH'] !== a['_AVG-BANDWIDTH']) return null;
      const number = Number(a['AVERAGE-BANDWIDTH']), rank = number % 10, pathway = a['PATHWAY-ID'];
      if (!Number.isSafeInteger(number) || rank > 2 || (ranks[pathway] !== undefined && ranks[pathway] !== rank)) return null;
      ranks[pathway] = rank;
    }
    if (Object.keys(ranks).sort().join(',') !== config.pathways.slice().sort().join(',') || Object.values(ranks).sort().join(',') !== '0,1,2') return null;
    for (const key of ['variants', 'iframe']) {
      const result = [];
      for (const raw of copy[key]) {
        const row = JSON.parse(raw), a = row.attrs, pathway = a && a['PATHWAY-ID'];
        if (!a || !/^\d+$/.test(a['AVERAGE-BANDWIDTH'] || '') || a['AVERAGE-BANDWIDTH'] !== a['_AVG-BANDWIDTH'] || ranks[pathway] === undefined) return null;
        const number = Number(a['AVERAGE-BANDWIDTH']);
        if (!Number.isSafeInteger(number) || number - ranks[pathway] <= 0) return null;
        a['AVERAGE-BANDWIDTH'] = a['_AVG-BANDWIDTH'] = String(number - ranks[pathway]); result.push(JSON.stringify(row));
      }
      copy[key] = result.sort();
    }
    return copy;
  }
  function sameIdentity(body, source, config) {
    const actual = canonicalIdentity(identity(body, source), config), expected = canonicalIdentity(config.expectedIdentity, config);
    return !!actual && !!expected && JSON.stringify(actual) === JSON.stringify(expected);
  }
  function subtitleUrl(config, file, pathway) {
    return 'https://hls-amt.itunes.apple.com' + config.sidePath + '/' + file + '?rev=' + encodeURIComponent(config.revision)
      + '&ref=' + encodeURIComponent(config.referenceId) + '&pathway=' + encodeURIComponent(pathway);
  }
  function inject(body, source, config) {
    if (!sameIdentity(body, source, config)) return null;
    const lines = body.replace(/\r\n?/g, '\n').split('\n');
    const out = lines.map(line => {
      if (!line) return line;
      if (line.charAt(0) !== '#') return absolute(line, source);
      return line.replace(/([A-Z0-9-]*URI)="([^"]+)"/g, (_, key, value) => key + '=' + JSON.stringify(absolute(value, source)));
    });
    const first = out.findIndex(line => line.indexOf('#EXT-X-STREAM-INF:') === 0); if (first < 0) return null;
    const group = pathway => 'f1-preview-' + config.station + '-' + pathway;
    const tracks = config.pathways.map(pathway => '#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID=' + JSON.stringify(group(pathway))
      + ',NAME="简体中文（预览）",DEFAULT=NO,AUTOSELECT=YES,FORCED=NO,LANGUAGE="zh-Hans",PATHWAY-ID=' + JSON.stringify(pathway)
      + ',URI=' + JSON.stringify(subtitleUrl(config, 'index.m3u8', pathway)));
    out.splice(first, 0, ...tracks);
    for (let i = 0; i < out.length; i++) {
      if (out[i].indexOf('#EXT-X-STREAM-INF:') !== 0) continue;
      const a = attrs(out[i]); if (!a || config.pathways.indexOf(a['PATHWAY-ID']) < 0 || !a.CODECS) return null;
      const codecs = a.CODECS.split(','); if (codecs.indexOf('wvtt') < 0) codecs.push('wvtt');
      out[i] = out[i].replace(/CODECS="[^"]*"/, 'CODECS=' + JSON.stringify(codecs.join(','))) + ',SUBTITLES=' + JSON.stringify(group(a['PATHWAY-ID']));
    }
    return out.join('\n');
  }
  function playlist(config, pathway) {
    let body = '#EXTM3U\n#EXT-X-VERSION:6\n#EXT-X-TARGETDURATION:60\n#EXT-X-MEDIA-SEQUENCE:0\n#EXT-X-PLAYLIST-TYPE:VOD\n';
    for (let i = 0; i < config.segmentCount; i++) {
      const duration = Math.min(60000, config.durationMs - i * 60000);
      if (duration <= 0) return null;
      body += '#EXTINF:' + (duration / 1000).toFixed(3) + ',\n' + subtitleUrl(config, 'seg-' + String(i).padStart(3, '0') + '.vtt', pathway) + '\n';
    }
    return body + '#EXT-X-ENDLIST\n';
  }
  return {parseUrl, exactKeys, sourceUrl, absolute, attrs, identity, canonicalIdentity, sameIdentity, inject, playlist, subtitleUrl};
})();
function pvFinishWithPreview(value) {
  if (value && typeof value.body === 'string') {
    try {
      const obj = JSON.parse(value.body); let changed = false;
      function visit(node) {
        if (!node || typeof node !== 'object') return;
        for (const key of Object.keys(node)) {
          if (key === 'hlsUrl' && typeof node[key] === 'string') {
            const original = node[key];
            const config = replayConfigs.find(c => f1pvLibrary.sourceUrl(original, c));
            if (config) { node[key] = 'https://hls-amt.itunes.apple.com' + config.masterPath + '?rev=' + encodeURIComponent(config.revision) + '&src=' + encodeURIComponent(original); changed = true; }
          } else visit(node[key]);
        }
      }
      visit(obj); if (changed) value = Object.assign({}, value, {body: JSON.stringify(obj)});
    } catch (_) {}
  }
  $done(value);
}
const hostMap = {
  "play.itunes.apple.com": "play-cdn.itunes.apple.com",
  "play-edge.itunes.apple.com": "play-edge-cdn.itunes.apple.com",
};
const f1Replays = [{"slug":"australia","programId":"1337486392","assetId":"1881724926","revision":"f1aur22m1"},{"slug":"china","programId":"1337522687","assetId":"1881777941","revision":"f1cnr21m2"},{"slug":"japan","programId":"1326620577","assetId":"1881763666","revision":"f1jpr20m1"},{"slug":"miami","programId":"1364568578","assetId":"1881733891","revision":"f1mir20m1"},{"slug":"canada","programId":"1392837560","assetId":"1881753363","revision":"f1car20m1"},{"slug":"monaco","programId":"1411825097","assetId":"1881742204","revision":"f1mcr25m1"},{"slug":"barcelona-catalunya","programId":"1413846083","assetId":"1881690171","revision":"f1bar17m1"},{"slug":"austria","programId":"1429344944","assetId":"1882150267","revision":"f1atr22m1"},{"slug":"great-britain","programId":"1436852938","assetId":"1881739464","revision":"f1gbr26m1"},{"slug":"belgium","programId":"1457248952","assetId":"1881786635","revision":"f1ber12m1"},{"slug":"hungary","programId":"1461869625","assetId":"1881700068","revision":"f1hur32m1"},{"slug":"netherlands","programId":"1478680801","assetId":"1882152939","revision":"f1ntr23m1"},{"slug":"spain","programId":"1497835498","assetId":"1881721455","revision":"f1spr22m1"},{"slug":"azerbaijan","programId":"1509835184","assetId":"1882094604","revision":"azr1-76f792623176"},{"slug":"bahrain-malaysia","programId":"1526866852","assetId":"6819360836","revision":"bhm1-57ce7a36cff3"},{"slug":"bahrain-malaysia","programId":"1529375473","assetId":"6819360836","revision":"bhm1-57ce7a36cff3"},{"slug":"singapore","programId":"1525529454","assetId":"1881782888","revision":"20261024r7"},{"slug":"united-states","programId":"1536601273","assetId":"1881678292","revision":"20261107r6"}];
const seriesTargets = {"1880499459":{"slug":"dts-s08e01","programId":"1288232144"},"1880598345":{"slug":"dts-s08e02","programId":"1288232871"},"1880600976":{"slug":"dts-s08e03","programId":"1287879890"},"1880613354":{"slug":"dts-s08e04","programId":"1287887004"},"1880628537":{"slug":"dts-s08e05","programId":"1312757141"},"1880639133":{"slug":"dts-s08e06","programId":"1287881790"},"1880673513":{"slug":"dts-s08e07","programId":"1288233124"},"1880677128":{"slug":"dts-s08e08","programId":"1287884341"}};
const seriesRevision = "dts8-20260920d";

function queryValue(value, name) {
  const query = String(value || "").split("?")[1]?.split("#")[0] || "";
  for (const part of query.split("&")) {
    const index = part.indexOf("=");
    const key = decodeURIComponent(index < 0 ? part : part.slice(0, index));
    if (key === name) return decodeURIComponent(index < 0 ? "" : part.slice(index + 1));
  }
  return "";
}

function nativePlaybackUrl(value) {
  return String(value || "")
    .replace(/^https:\/\/play-edge-cdn\.itunes\.apple\.com/i, "https://play-edge.itunes.apple.com")
    .replace(/^https:\/\/play-cdn\.itunes\.apple\.com/i, "https://play.itunes.apple.com");
}

function f1BridgeUrl(value) {
  const source = nativePlaybackUrl(value);
  const match = source.match(/^https:\/\/(play(?:-edge)?\.itunes\.apple\.com)(\/WebObjects\/MZPlayLocal\.woa\/hls\/subscription\/playlist\.m3u8)(?:\?[^#]*)?$/i);
  if (!match) return null;
  const replay = f1Replays.find((item) => queryValue(source, "id") === item.programId && queryValue(source, "a") === item.assetId);
  return replay ? "https://hls-amt.itunes.apple.com/__f1_replay_master/" + replay.slug + "/index.m3u8?rev=" + replay.revision + "&src=" + encodeURIComponent(source) : null;
}

function seriesBridgeUrl(value) {
  const source = nativePlaybackUrl(value);
  const match = source.match(/^https:\/\/(play(?:-edge)?\.itunes\.apple\.com)(\/WebObjects\/MZPlayLocal\.woa\/hls\/subscription\/playlist\.m3u8)(?:\?[^#]*)?$/i);
  if (!match) return null;
  for (const assetId of Object.keys(seriesTargets)) {
    const target = seriesTargets[assetId];
    if (queryValue(source, "a") !== assetId || queryValue(source, "id") !== target.programId) continue;
    return "https://hls-amt.itunes.apple.com/__apple_series_master/" + target.slug + "/index.m3u8?rev=" + seriesRevision + "&src=" + encodeURIComponent(source);
  }
  return null;
}

const shelfTargets = {};
const shelfRevisions = {};
function shelfBridgeUrl(value) {
  const source = nativePlaybackUrl(value);
  if (!/^https:\/\/play(?:-edge)?\.itunes\.apple\.com\/WebObjects\/MZPlayLocal\.woa\/hls\/subscription\/playlist\.m3u8(?:\?[^#]*)?$/i.test(source)) return null;
  const asset = queryValue(source, "a") || queryValue(source, "mainAssetAdamId");
  return shelfTargets[asset] ? "https://hls-amt.itunes.apple.com/__apple_movie_master/" + shelfTargets[asset] + "/index.m3u8?rev=" + shelfRevisions[asset] + "&src=" + encodeURIComponent(source) : null;
}



function rewriteHlsUrl(value) {
  if (typeof value !== "string") return value;
  const shelf = shelfBridgeUrl(value);
  if (shelf) return shelf;
  
  
  const series = seriesBridgeUrl(value);
  if (series) return series;
  const f1 = f1BridgeUrl(value);
  if (f1) return f1;
  const match = value.match(/^(https?:\/\/)([^\/?#]+)([\s\S]*)$/i);
  if (!match) return value;
  const replacement = hostMap[match[2].toLowerCase()];
  return replacement ? match[1] + replacement + match[3] : value;
}

function rewrite(value) {
  if (Array.isArray(value)) return value.map(rewrite);
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const key of Object.keys(value)) output[key] = key === "hlsUrl" ? rewriteHlsUrl(value[key]) : rewrite(value[key]);
  return output;
}

try {
  const body = typeof $response.body === "string" ? JSON.parse($response.body) : null;
  if (!body) pvFinishWithPreview({});
  else pvFinishWithPreview({ body: JSON.stringify(rewrite(body)) });
} catch (_) { pvFinishWithPreview({}); }
