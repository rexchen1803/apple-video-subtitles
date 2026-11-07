const replayConfigs = [{"station":"19-mexico","referenceId":"umc.cmr.f1live.sp.44pxqond8524r9rdavtv5frb0","revision":"f1pv261104a-mx","aliases":["mx20261104a","mx20261104b","mx20261104c"],"masterPath":"/__f1_mx_live_preview/master.m3u8"}];
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
const shelfRevisions = {"6822052354":"nov1103-af0ce1150f0c","6820735971":"nov1103-e0c60e7390f7","6822050128":"nov1103-6fc55b7e640e","6822053507":"nov1103-8fd5be969c2b","6822048451":"nov1103-f8230d9bb2f5","6822054779":"nov1103-88e1f9dbab3b","6822072736":"nov1103-69640299476e","6820730686":"nov1103-6ef1d79f94db","6822050541":"nov1103-6daa17ad6475","6822054364":"nov1103-cedd5982069e","6822101531":"nov1103-74a882e2b88d","6822048777":"nov1103-247c33b4a2e1","6822054977":"nov1103-2bcdd526499b","6822050093":"nov1103-4727ffd19d96","6820740030":"nov1103-7376a389d1f6","6820731539":"nov1103-0b7da4b5ad97","6824697268":"nov1103-a1bc6bcda5e8","6822040006":"nov1103-0a760bc619f6","6820740767":"nov1103-2e1ab7dbca31"};
const targets = {"6793693246":"2016-arrival","6804923769":"2003-master-and-commander","6822052354":"1995-12-monkeys","6820735971":"1993-dave","6822050128":"2014-interstellar","6822053507":"1994-pulp-fiction","6822048451":"1994-forrest-gump","6822054779":"2016-the-nice-guys","6822072736":"2002-minority-report","6820730686":"1995-bad-boys","6822050541":"2013-prisoners","6822054364":"2008-rachel-getting-married","6822101531":"1989-dead-poets-society","6822048777":"2008-get-smart","6822054977":"2006-talladega-nights","6822050093":"2009-julie-and-julia","6820740030":"1988-big","6820731539":"1995-clueless","6824697268":"2004-anchorman","6822040006":"2010-eat-pray-love","6820740767":"2008-body-of-lies"};
const seriesTargets = {"1880499459":"dts-s08e01","1880598345":"dts-s08e02","1880600976":"dts-s08e03","1880613354":"dts-s08e04","1880628537":"dts-s08e05","1880639133":"dts-s08e06","1880673513":"dts-s08e07","1880677128":"dts-s08e08"};
const seriesBridgeBase = "https://hls-amt.itunes.apple.com/__apple_series_master/";
const bridgeBase = "https://hls-amt.itunes.apple.com/__apple_movie_master/";
const f1Replays = [{"slug":"australia","programId":"1337486392","assetId":"1881724926","revision":"f1aur22m1"},{"slug":"china","programId":"1337522687","assetId":"1881777941","revision":"f1cnr21m2"},{"slug":"japan","programId":"1326620577","assetId":"1881763666","revision":"f1jpr20m1"},{"slug":"miami","programId":"1364568578","assetId":"1881733891","revision":"f1mir20m1"},{"slug":"canada","programId":"1392837560","assetId":"1881753363","revision":"f1car20m1"},{"slug":"monaco","programId":"1411825097","assetId":"1881742204","revision":"f1mcr25m1"},{"slug":"barcelona-catalunya","programId":"1413846083","assetId":"1881690171","revision":"f1bar17m1"},{"slug":"austria","programId":"1429344944","assetId":"1882150267","revision":"f1atr22m1"},{"slug":"great-britain","programId":"1436852938","assetId":"1881739464","revision":"f1gbr26m1"},{"slug":"belgium","programId":"1457248952","assetId":"1881786635","revision":"f1ber12m1"},{"slug":"hungary","programId":"1461869625","assetId":"1881700068","revision":"f1hur32m1"},{"slug":"netherlands","programId":"1478680801","assetId":"1882152939","revision":"f1ntr23m1"},{"slug":"spain","programId":"1497835498","assetId":"1881721455","revision":"f1spr22m1"},{"slug":"italy","programId":"1498372256","assetId":"1881758693","revision":"f1itr1m1"},{"slug":"azerbaijan","programId":"1509835184","assetId":"1882094604","revision":"azr1-76f792623176"},{"slug":"bahrain-malaysia","programId":"1526866852","assetId":"6819360836","revision":"bhm1-57ce7a36cff3"},{"slug":"bahrain-malaysia","programId":"1529375473","assetId":"6819360836","revision":"bhm1-57ce7a36cff3"},{"slug":"singapore","programId":"1525529454","assetId":"1881782888","revision":"20261024r7"},{"slug":"united-states","programId":"1536601273","assetId":"1881678292","revision":"20261107r6"}];
function nativePlaybackUrl(value) {
  return String(value || "").replace(/^https:\/\/play-edge-cdn\.itunes\.apple\.com/i, "https://play-edge.itunes.apple.com").replace(/^https:\/\/play-cdn\.itunes\.apple\.com/i, "https://play.itunes.apple.com");
}
function bridgeHlsUrl(value) {
  if (typeof value !== "string" || !/^https:\/\/play(?:-edge)?(?:-cdn)?\.itunes\.apple\.com\//i.test(value)) return value;
  for (const assetId of Object.keys(seriesTargets)) {
    if (!value.includes(assetId)) continue;
    const source = nativePlaybackUrl(value);
    return seriesBridgeBase + seriesTargets[assetId] + "/index.m3u8?rev=dts8-20260920d&src=" + encodeURIComponent(source);
  }
  try {
    const url = new URL(nativePlaybackUrl(value));
    const replay = f1Replays.find((item) =>
      /^play(?:-edge)?.itunes.apple.com$/i.test(url.hostname) &&
      url.pathname === "/WebObjects/MZPlayLocal.woa/hls/subscription/playlist.m3u8" &&
      url.searchParams.get("id") === item.programId &&
      url.searchParams.get("a") === item.assetId
    );
    if (replay) return "https://hls-amt.itunes.apple.com/__f1_replay_master/" + replay.slug + "/index.m3u8?rev=" + replay.revision + "&src=" + encodeURIComponent(url.toString());
  } catch (_) {}
  for (const assetId of Object.keys(targets)) {
    if (!value.includes(assetId)) continue;
    const source = nativePlaybackUrl(value);
    return bridgeBase + targets[assetId] + "/index.m3u8?rev=" + (shelfRevisions[assetId] || (assetId === "6796433608" ? "v260925a" : "v260904a")) + "&src=" + encodeURIComponent(source);
  }
  return value;
}
function rewrite(value) {
  if (Array.isArray(value)) return value.map(rewrite);
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const key of Object.keys(value)) output[key] = key === "hlsUrl" ? bridgeHlsUrl(value[key]) : rewrite(value[key]);
  return output;
}
try {
  const body = typeof $response.body === "string" ? JSON.parse($response.body) : null;
  if (!body) pvFinishWithPreview({});
  else pvFinishWithPreview({ body: JSON.stringify(rewrite(body)) });
} catch (_) { pvFinishWithPreview({}); }
