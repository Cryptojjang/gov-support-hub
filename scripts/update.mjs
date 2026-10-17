#!/usr/bin/env node
// 정부지원사업 공고 자동 수집기 (외부 라이브러리 없음, Node 18+)
// 출처: 기업마당(bizinfo.go.kr), K-Startup(k-startup.go.kr) 공개 공고 페이지
// 사용법: node scripts/update.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.HUB_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(ROOT, 'data');
const CACHE_FILE = join(DATA_DIR, 'cache', 'details.json');
const OUT_FILE = join(DATA_DIR, 'programs.json');

const BIZ = 'https://www.bizinfo.go.kr';
const KS = 'https://www.k-startup.go.kr';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const CONCURRENCY = Number(process.env.CONCURRENCY || 5);
const MAX_DETAIL = Number(process.env.MAX_DETAIL || 5000); // 1회 실행당 상세 수집 최대 건수

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// 한국 시간 기준 오늘 날짜
function todayKST() {
  return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
}

async function getText(url, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      let timer;
      const timeout = new Promise((_, rej) => { timer = setTimeout(() => { ctl?.abort(); rej(new Error('timeout')); }, 30000); });
      try {
        return await Promise.race([
          (async () => {
            const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9' }, signal: ctl?.signal });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return await res.text();
          })(),
          timeout,
        ]);
      } finally { clearTimeout(timer); }
    } catch (e) {
      if (i === tries) throw new Error(`${url} -> ${e.message}`);
      await sleep(1000 * i);
    }
  }
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let idx = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (idx < items.length) {
        const i = idx++;
        try { out[i] = await fn(items[i], i); } catch (e) { out[i] = undefined; log('WARN', e.message); }
        await sleep(120);
      }
    })
  );
  return out;
}

// ---------- HTML 유틸 ----------
const ENT = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", middot: '·', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—', bull: '•', times: '×', rarr: '→', larr: '←' };
function decode(s = '') {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => (n.toLowerCase() in ENT ? ENT[n.toLowerCase()] : m));
}
function toText(html = '') {
  const t = decode(
    html
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|li|div|tr|h\d)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  );
  const lines = t.split('\n').map((l) => l.replace(/[ \t\u00a0]+/g, ' ').trim());
  const out = [];
  for (const l of lines) { if (l || (out.length && out[out.length - 1])) out.push(l); }
  return out.join('\n').trim();
}
const oneLine = (s) => toText(s).replace(/\s+/g, ' ').trim();
const clip = (s, n = 2500) => (s && s.length > n ? s.slice(0, n) + ' …(이하 생략, 원문 첨부 참고)' : s || '');
function normDate(s = '') {
  const m = s.match(/(20\d{2})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : '';
}

// ---------- 지역/태그 ----------
const REGIONS = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];
const REGION_FULL = { 서울특별시: '서울', 부산광역시: '부산', 대구광역시: '대구', 인천광역시: '인천', 광주광역시: '광주', 대전광역시: '대전', 울산광역시: '울산', 세종특별자치시: '세종', 경기도: '경기', 강원특별자치도: '강원', 강원도: '강원', 충청북도: '충북', 충청남도: '충남', 전북특별자치도: '전북', 전라북도: '전북', 전라남도: '전남', 경상북도: '경북', 경상남도: '경남', 제주특별자치도: '제주' };
function regionsFrom(text = '') {
  const found = new Set();
  const br = text.match(/^\s*\[([^\]]+)\]/);
  if (br) {
    const b = br[1];
    if (b.includes('전남광주')) { found.add('전남'); found.add('광주'); }
    for (const r of REGIONS) if (b.includes(r)) found.add(r);
  }
  return [...found];
}
const TAG_RULES = [
  ['소상공인', /소상공인|자영업|점포|상권|전통시장|골목|착한가격|상인|가게|폐업|재기|노란우산|희망리턴/],
  ['예비창업', /예비\s*창업|예비창업자|창업\s*희망|창업을\s*희망/],
  ['창업', /창업|스타트업|start-?up|벤처|TIPS|팁스|액셀러레이|엑셀러레이|데모데이|IR\b/i],
  ['자금·융자', /융자|정책자금|육성자금|보증|대출|이차보전|이자|자금\s*지원|운전자금|시설자금|투자/],
  ['인력·고용', /채용|고용|인턴|일자리|인건비|일경험|근로|인재|인력/],
  ['수출·해외', /수출|해외|글로벌|바이어|무역|박람회|전시회|통상|K-?스타트업.*(일본|미국|중국)/],
  ['기술·R&D', /R&D|연구개발|기술개발|기술사업화|특허|실증|테스트베드|시제품|AI|인공지능|디지털전환|스마트공장/i],
  ['교육·컨설팅', /교육|아카데미|멘토링|컨설팅|특강|세미나|워크숍|코칭|진단|학교/],
  ['공간·입주', /입주|공간|오피스|보육|센터\s*입주|사무실|팝업\s*스토어/],
  ['판로·마케팅', /판로|마케팅|홍보|온라인|라이브커머스|입점|쇼핑몰|광고|브랜드|디자인/],
  ['청년', /청년|대학생|만\s*39세|39세\s*이하/],
  ['여성', /여성/],
  ['농수산', /농업|농가|영농|축산|어업|수산|임업|농촌|어촌|농산물|작물|양봉|과수|원예|화훼|축산물/],
  ['행사·공모', /공모전|데모데이|행사|네트워킹|포럼|밋업|meet-?up|경진대회|챌린지|컨퍼런스/i],
];
const CAT_TAG = { 금융: '자금·융자', 인력: '인력·고용', 수출: '수출·해외', 기술: '기술·R&D', 창업: '창업', 내수: '판로·마케팅', 경영: null };
function makeTags(it) {
  const tags = new Set();
  if (CAT_TAG[it.cat]) tags.add(CAT_TAG[it.cat]);
  if (it.src === 'kstartup') tags.add('창업');
  const head = `${it.title} ${it.cat || ''}`;
  const body = `${it.target || ''} ${it.career || ''}`;
  for (const [t, re] of TAG_RULES) {
    if (re.test(head)) tags.add(t);
    else if (['소상공인', '예비창업', '청년', '여성'].includes(t) && re.test(body.slice(0, 300))) tags.add(t);
  }
  if (/예비창업자/.test(it.career || '')) tags.add('예비창업');
  return [...tags];
}

// ---------- 기업마당 ----------
async function bizinfoList() {
  const url = (p) => `${BIZ}/sii/siia/selectSIIA200View.do?rows=15&cpage=${p}&schEndAt=N`;
  const first = await getText(url(1));
  const total = Number((first.match(/분야\((\d+)\)/) || [])[1] || 0);
  const pages = Math.max(1, Math.ceil(total / 15));
  log(`기업마당: 진행중 ${total}건 / ${pages}페이지`);
  const htmls = [first, ...(await pool(Array.from({ length: pages - 1 }, (_, i) => i + 2), CONCURRENCY, (p) => getText(url(p))))];
  const items = new Map();
  for (const h of htmls) {
    if (!h) continue;
    const tbody = (h.match(/<tbody>([\s\S]*?)<\/tbody>/) || [])[1] || '';
    for (const tr of tbody.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
      const tds = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
      const pid = (tr[1].match(/pblancId=(PBLN_\d+)/) || [])[1];
      if (!pid || tds.length < 7) continue;
      const period = oneLine(tds[3]);
      const [s, e] = period.split('~').map((x) => x && x.trim());
      items.set(pid, {
        id: 'B' + pid.replace('PBLN_', '').replace(/^0+/, ''),
        pid,
        src: 'bizinfo',
        cat: oneLine(tds[1]),
        title: oneLine(tds[2]),
        periodText: period,
        start: normDate(s || ''),
        end: normDate(e || ''),
        org: oneLine(tds[4]),
        agency: oneLine(tds[5]),
        reg: normDate(oneLine(tds[6])),
        views: Number(oneLine(tds[7] || '0').replace(/,/g, '')) || 0,
        url: `${BIZ}/sii/siia/selectSIIA200Detail.do?pblancId=${pid}`,
      });
    }
  }
  return [...items.values()];
}

async function bizinfoDetail(it) {
  const h = await getText(it.url);
  const d = {};
  for (const m of h.matchAll(/<span class="s_title">([\s\S]*?)<\/span>\s*<div class="txt"\s*>([\s\S]*?)<\/div>\s*<\/li>/g)) {
    d[oneLine(m[1])] = toText(m[2]);
  }
  const files = [];
  for (const m of h.matchAll(/<div class="file_name">([\s\S]*?)<\/div>[\s\S]*?href="(\/cmm\/fms\/fileDown\.do\?[^"]+)"/g)) {
    files.push({ n: oneLine(m[1]), u: BIZ + decode(m[2]) });
  }
  const sourceUrl = decode((h.match(/href="([^"]+)"[^>]*id="barogagi"/) || h.match(/id="barogagi"[^>]*href="([^"]+)"/) || [])[1] || '');
  const hashtags = [...new Set([...h.matchAll(/tag_li_list\d+'><span>#([^<]{1,30})<\/span>/g)].map((m) => decode(m[1]).trim()))].slice(0, 15);
  // 기업마당 사업개요는 보통 "소개문 ☞ 지원대상 ☞ 지원내용" 형식
  const raw = d['사업개요'] || '';
  const parts = raw.split('☞').map((s) => s.trim());
  let intro = raw, target = '', support = '';
  if (parts.length >= 3) { intro = parts[0]; target = parts[1]; support = parts.slice(2).join('\n'); }
  else if (parts.length === 2) { intro = parts[0]; support = parts[1]; }
  return {
    summary: clip(intro, 1500),
    target: clip(target, 1200),
    support: clip(support, 1500),
    howto: clip(d['사업신청 방법'] || d['사업신청방법'] || '', 1200),
    contact: clip(d['문의처'] || '', 500),
    applyUrl: '',
    sourceUrl: /^https?:/.test(sourceUrl) ? sourceUrl : '',
    files: files.slice(0, 12),
    hashtags,
  };
}

// ---------- K-Startup ----------
async function kstartupList() {
  const items = new Map();
  for (const cls of ['PBC010', 'PBC020']) {
    for (let p = 1; p <= 200; p++) {
      const h = await getText(`${KS}/web/contents/bizpbanc-ongoing.do?page=${p}&pbancClssCd=${cls}`);
      const blocks = [...h.matchAll(/<li class="notice">([\s\S]*?)<\/li>/g)].map((m) => m[1]);
      let added = 0;
      for (const b of blocks) {
        const sn = (b.match(/go_view\((\d+)\)/) || [])[1];
        if (!sn) continue;
        const spans = [...b.matchAll(/<span class="list">([\s\S]*?)<\/span>/g)].map((m) => oneLine(m[1]));
        const pick = (k) => (spans.find((s) => s.startsWith(k)) || '').replace(k, '').trim();
        const plain = spans.filter((s) => !/^(등록일자|시작일자|마감일자|조회)/.test(s));
        const flags = [...b.matchAll(/<span class="flag ([^"]*)">([\s\S]*?)<\/span>/g)].map((m) => ({ c: m[1], t: oneLine(m[2]) }));
        items.set(sn, {
          id: 'K' + sn,
          sn,
          src: 'kstartup',
          kind: (flags.find((f) => f.c.includes('agency')) || {}).t || (cls === 'PBC020' ? '민간' : '공공'),
          cat: (flags.find((f) => /type/.test(f.c)) || {}).t || '',
          title: oneLine((b.match(/<p class="tit">([\s\S]*?)<\/p>/) || [])[1] || ''),
          org: plain[plain.length - 1] || '',
          agency: plain[plain.length - 1] || '',
          reg: normDate(pick('등록일자')),
          start: normDate(pick('시작일자')),
          end: normDate(pick('마감일자')),
          views: Number(pick('조회').replace(/,/g, '')) || 0,
          url: `${KS}/web/contents/bizpbanc-ongoing.do?schM=view&pbancSn=${sn}`,
        });
        added++;
      }
      if (!added) break;
    }
  }
  log(`K-Startup: 모집중 ${items.size}건`);
  return [...items.values()];
}

const KS_NOISE = /신청 시 요청하는 정보|제출하신 서류는 사업운영기관|상기 일정은 사업운영기관|자세한 내용은 첨부파일 참조/;
async function kstartupDetail(it) {
  const h = await getText(it.url);
  const area = h.slice(h.indexOf('information_box-wrap'), h.indexOf('guide_wrap') > 0 ? h.indexOf('guide_wrap') : undefined);
  const kv = {};
  for (const m of area.matchAll(/<p class="tit">([\s\S]*?)<\/p>\s*<(?:p|div) class="txt"[^>]*>([\s\S]*?)<\/(?:p|div)>\s*<\/div>/g)) {
    const k = oneLine(m[1]);
    if (k && !(k in kv)) kv[k] = toText(m[2]);
  }
  const intro = toText((area.match(/<div class="box_inner">([\s\S]*?)<\/div>\s*<\/div>/) || [])[1] || '');
  const sections = [];
  for (const m of area.matchAll(/<p class="title">([\s\S]*?)<\/p>([\s\S]*?)(?=<div class="information_list">|$)/g)) {
    const t = oneLine(m[1]);
    const lines = toText(m[2]).split('\n').filter((l) => !KS_NOISE.test(l));
    while (lines.length && (!lines[0].trim() || lines[0].trim() === t)) lines.shift();
    sections.push({ t, c: clip(lines.join('\n').trim(), 2000) });
  }
  const sec = (re) => (sections.find((s) => re.test(s.t)) || {}).c || '';
  const files = [];
  for (const m of h.matchAll(/<a class="file_bg"[^>]*title="\[첨부파일\]\s*([^"]+)"[\s\S]*?href="(\/afile\/fileDownload\/[^"]+)"/g)) {
    files.push({ n: decode(m[1]).trim(), u: KS + m[2] });
  }
  const apply = (h.match(/fn_open_window\('([^']+)'\)/) || [])[1] || '';
  return {
    summary: clip(intro.split('\n').filter((l) => l.trim() !== (it.title || '').trim() && !/^20\d\d년\s*\d+월\s*\d+일$/.test(l.trim()) && !/공고\s*제\s*20\d\d/.test(l)).join('\n').replace(/\n{3,}/g, '\n\n').trim(), 2000),
    target: clip(kv['신청대상'] || kv['대상'] || '', 1200),
    exclude: clip(kv['제외대상'] || '', 1000),
    age: kv['대상연령'] || '',
    career: kv['창업업력'] || '',
    regionText: (kv['지역'] || '').replace(/\s+/g, ' '),
    contact: [kv['담당부서'], kv['연락처']].filter(Boolean).join(' / ') || sec(/문의/),
    howto: clip([kv['신청기간'] ? '신청기간: ' + kv['신청기간'].replace(/\s+/g, ' ') : '', kv['신청방법'] ? '신청방법: ' + kv['신청방법'].replace(/\s+/g, ' ') : ''].filter(Boolean).join('\n'), 800),
    docs: sec(/제출서류/),
    support: sec(/지원내용/),
    sections: sections.filter((s) => !/신청방법 및 대상|제출서류|지원내용|문의처/.test(s.t)).slice(0, 4),
    applyUrl: /^https?:/.test(apply) ? apply : '',
    files: files.slice(0, 12),
  };
}

// ---------- 메인 ----------
async function readJSON(f, def) {
  try { return JSON.parse(await readFile(f, 'utf8')); } catch { return def; }
}

async function main() {
  const t0 = Date.now();
  await mkdir(join(DATA_DIR, 'cache'), { recursive: true });
  const cache = await readJSON(CACHE_FILE, {});
  const prev = await readJSON(OUT_FILE, null);
  const today = todayKST();

  const results = await Promise.allSettled([bizinfoList(), kstartupList()]);
  const [biz, ks] = results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    log(`ERROR ${i ? 'K-Startup' : '기업마당'} 목록 수집 실패:`, r.reason?.message);
    return null;
  });
  // 한쪽 수집이 실패하면 이전 데이터 유지
  const keepPrev = (src) => (prev?.items || []).filter((x) => x.src === src && (!x.end || x.end >= today));
  const list = [...(biz || keepPrev('bizinfo')), ...(ks || keepPrev('kstartup'))];
  if (!list.length) throw new Error('수집된 공고가 없습니다. 네트워크/사이트 구조 변경을 확인하세요.');

  // 상세 수집 (캐시에 없는 것만)
  const need = list.filter((it) => !cache[it.id]).slice(0, MAX_DETAIL);
  log(`상세 수집 대상 ${need.length}건 (캐시 ${Object.keys(cache).length}건)`);
  let done = 0;
  await pool(need, CONCURRENCY, async (it) => {
    const d = it.src === 'bizinfo' ? await bizinfoDetail(it) : await kstartupDetail(it);
    cache[it.id] = d;
    if (++done % 100 === 0) {
      log(`  상세 ${done}/${need.length}`);
      await writeFile(CACHE_FILE, JSON.stringify(cache));
    }
  });

  // 병합 + 정리
  const seen = new Set();
  const items = [];
  for (const it of list) {
    const d = cache[it.id] || {};
    const x = { ...it, ...d };
    if (x.end && x.end < today) continue; // 마감 지난 공고 제외
    const key = x.title.replace(/[\s\[\]()<>「」『』·.,\-_'"]/g, '').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    let regions = regionsFrom(x.title);
    if (!regions.length && REGION_FULL[x.org]) regions = [REGION_FULL[x.org]];
    if (!regions.length && x.regionText && x.regionText !== '전국') regions = REGIONS.filter((r) => x.regionText.includes(r));
    x.regions = regions.length ? regions : ['전국'];
    x.tags = makeTags(x);
    x.isNew = !!x.reg && (Date.parse(today) - Date.parse(x.reg)) / 864e5 <= 3;
    delete x.regionText;
    items.push(x);
  }
  // 마감임박 순 기본 정렬(상시/예산소진시는 뒤로)
  items.sort((a, b) => (a.end || '9999').localeCompare(b.end || '9999') || (b.reg || '').localeCompare(a.reg || ''));

  // 사용하지 않는 캐시 정리
  const live = new Set(list.map((x) => x.id));
  for (const k of Object.keys(cache)) if (!live.has(k)) delete cache[k];
  await writeFile(CACHE_FILE, JSON.stringify(cache));

  const out = {
    updatedAt: new Date().toISOString(),
    updatedAtKST: new Date(Date.now() + 9 * 3600e3).toISOString().replace('T', ' ').slice(0, 16),
    sources: { bizinfo: items.filter((x) => x.src === 'bizinfo').length, kstartup: items.filter((x) => x.src === 'kstartup').length },
    total: items.length,
    items,
  };
  await writeFile(OUT_FILE, JSON.stringify(out));
  log(`완료: ${items.length}건 저장 (기업마당 ${out.sources.bizinfo}, K-Startup ${out.sources.kstartup}) / ${((Date.now() - t0) / 1000).toFixed(0)}초`);
}

main().catch((e) => { console.error(e); process.exit(1); });
