/* 지원사업 모아보기 - 정적 사이트 (데이터: data/programs.json, 매일 자동 갱신) */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const app = $('#app');
  const LS = {
    get: (k, d) => { try { return JSON.parse(localStorage.getItem('gsh_' + k)) ?? d; } catch { return d; } },
    set: (k, v) => localStorage.setItem('gsh_' + k, JSON.stringify(v)),
  };

  const TAGS = [
    ['소상공인', '🏪', '자영업·점포·상권'], ['예비창업', '🌱', '창업 준비 단계'], ['창업', '🚀', '초기·도약 창업기업'],
    ['자금·융자', '💰', '정책자금·보증·보조금'], ['인력·고용', '👥', '채용·인건비 지원'], ['판로·마케팅', '📣', '온라인·홍보·입점'],
    ['교육·컨설팅', '🎓', '멘토링·교육·진단'], ['공간·입주', '🏢', '사무실·보육공간'], ['수출·해외', '🌏', '해외진출·전시회'],
    ['기술·R&D', '🔬', '기술개발·AI·실증'], ['청년', '🙋', '만 39세 이하'], ['여성', '👩', '여성기업·여성창업'],
    ['행사·공모', '🎤', '공모전·데모데이'], ['농수산', '🌾', '농어업인 대상'],
  ];
  const REGIONS = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];

  let DATA = { items: [] };
  let BY = new Map();
  const saved = new Set(LS.get('saved', []));
  const F = { q: '', tags: [], region: '', src: '', sort: 'deadline', due: '', hideFarm: false, limit: 30 };

  // ---------- 날짜 ----------
  const TODAY = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
  function dleft(end) { if (!end) return null; return Math.round((new Date(end + 'T00:00:00') - TODAY) / 864e5); }
  function dBadge(it) {
    const n = dleft(it.end);
    if (n === null) return `<span class="badge d always">${/예산|소진/.test(it.periodText || '') ? '예산 소진시' : '상시·별도안내'}</span>`;
    const cls = n <= 3 ? 'soon' : n <= 10 ? 'mid' : 'far';
    return `<span class="badge d ${cls}">${n === 0 ? 'D-DAY' : 'D-' + n}</span>`;
  }
  const period = (it) => (it.start || it.end ? `${it.start || ''} ~ ${it.end || ''}` : it.periodText || '-');
  const srcBadge = (it) => (it.src === 'kstartup' ? '<span class="badge src-k">K-Startup</span>' : '<span class="badge src-b">기업마당</span>');
  const orgOf = (it) => (it.agency && it.agency !== it.org && it.agency !== '기초자치단체' ? `${it.org} · ${it.agency}` : it.org || it.agency || '');

  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 2200); }
  function updSaved() { LS.set('saved', [...saved]); $('#savedCount').textContent = saved.size || ''; }

  // ---------- 카드 ----------
  function card(it, extra = '') {
    const tags = (it.tags || []).filter((t) => t !== '창업' || !it.tags.includes('예비창업')).slice(0, 4);
    const sum = (it.support || it.summary || '').replace(/\s+/g, ' ').slice(0, 140);
    return `<div class="card" data-id="${it.id}" tabindex="0">
      <button class="star ${saved.has(it.id) ? 'on' : ''}" data-star="${it.id}" title="관심 공고 저장" aria-label="관심 공고 저장">★</button>
      <div class="top">${dBadge(it)}${it.isNew ? '<span class="badge new">NEW</span>' : ''}${srcBadge(it)}${it.cat ? `<span class="badge">${esc(it.cat)}</span>` : ''}</div>
      <h3>${esc(it.title)}</h3>
      <div class="meta"><span>🏛 ${esc(orgOf(it))}</span><span>📅 ${esc(period(it))}</span></div>
      ${sum ? `<p class="sum">${esc(sum)}</p>` : ''}
      ${extra}
      <div class="tags">${(it.regions || []).map((r) => `<span class="chip">${esc(r)}</span>`).join('')}${tags.map((t) => `<span class="chip k">${esc(t)}</span>`).join('')}</div>
    </div>`;
  }

  // ---------- 필터 ----------
  function hay(it) {
    if (!it._h) it._h = [it.title, it.org, it.agency, it.cat, it.summary, it.target, it.support, (it.hashtags || []).join(' '), (it.tags || []).join(' ')].join(' ').toLowerCase();
    return it._h;
  }
  function applyFilter(items, f) {
    const qs = f.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let out = items.filter((it) => {
      if (f.src && it.src !== f.src) return false;
      if (f.region && !(it.regions || []).some((r) => r === f.region || r === '전국')) return false;
      if (f.tags.length && !f.tags.every((t) => (it.tags || []).includes(t))) return false;
      if (f.hideFarm && (it.tags || []).includes('농수산')) return false;
      if (f.due) {
        const n = dleft(it.end);
        if (f.due === 'always' ? n !== null : n === null || n > Number(f.due)) return false;
      }
      if (qs.length && !qs.every((q) => hay(it).includes(q))) return false;
      return true;
    });
    return sortItems(out, f.sort);
  }
  function sortItems(arr, s) {
    const a = [...arr];
    if (s === 'new') a.sort((x, y) => (y.reg || '').localeCompare(x.reg || '') || y.views - x.views);
    else if (s === 'popular') a.sort((x, y) => (y.views || 0) - (x.views || 0));
    else a.sort((x, y) => (x.end || '9999').localeCompare(y.end || '9999') || (y.reg || '').localeCompare(x.reg || ''));
    return a;
  }

  // ---------- 뷰: 홈 ----------
  function viewHome() {
    const items = DATA.items;
    const soon = items.filter((x) => { const n = dleft(x.end); return n !== null && n <= 7; });
    const fresh = items.filter((x) => x.isNew);
    const cnt = (t) => items.filter((x) => (x.tags || []).includes(t)).length;
    const top = (arr, n = 6) => arr.slice(0, n).map((x) => card(x)).join('');
    app.innerHTML = `
      <section class="hero">
        <div class="upd"><i></i>${esc(DATA.updatedAtKST || '')} 기준 자동 업데이트 · 매일 아침 갱신</div>
        <h1>지금 신청할 수 있는 정부·지자체 지원사업<br>${items.length.toLocaleString()}건을 한 곳에서</h1>
        <p>소상공인·예비창업자·초기 창업기업을 위한 공고를 매일 모아 요약하고, 신청 서류 초안까지 만들어 드립니다.</p>
        <form class="search-big" id="heroSearch"><input name="q" placeholder="예: 소상공인 경영개선, 예비창업패키지, 서울 마케팅" autocomplete="off"><button>검색</button></form>
      </section>
      <div class="stats">
        <div class="stat" data-go="all"><div class="n">${items.length.toLocaleString()}</div><div class="l">모집 중인 공고</div></div>
        <div class="stat new" data-go="new"><div class="n">${fresh.length}</div><div class="l">최근 3일 신규</div></div>
        <div class="stat hot" data-go="soon"><div class="n">${soon.length}</div><div class="l">7일 이내 마감</div></div>
        <div class="stat" data-go="tag:소상공인"><div class="n">${cnt('소상공인')}</div><div class="l">소상공인 대상</div></div>
        <div class="stat" data-go="tag:창업"><div class="n">${cnt('창업')}</div><div class="l">창업 지원</div></div>
      </div>
      <section class="sec">
        <div class="sec-h"><h2>분야별로 찾기</h2><a href="#/match">내 조건으로 맞춤 찾기 →</a></div>
        <div class="tiles">${TAGS.map(([t, ic, d]) => `<button class="tile" data-go="tag:${t}"><span class="ic">${ic}</span><span><b>${t} <small class="muted">${cnt(t)}</small></b><span>${d}</span></span></button>`).join('')}</div>
      </section>
      <section class="sec"><div class="sec-h"><h2>⏰ 곧 마감되는 공고</h2><a href="#/list" data-go="soon">전체 보기 →</a></div><div class="grid">${top(sortItems(soon, 'popular').sort((a, b) => a.end.localeCompare(b.end)))}</div></section>
      <section class="sec"><div class="sec-h"><h2>🆕 새로 올라온 공고</h2><a href="#/list" data-go="new">전체 보기 →</a></div><div class="grid">${top(sortItems(fresh, 'popular'))}</div></section>
      <section class="sec"><div class="sec-h"><h2>🏪 소상공인 인기 공고</h2><a href="#/list" data-go="tag:소상공인">전체 보기 →</a></div><div class="grid">${top(sortItems(items.filter((x) => x.tags.includes('소상공인')), 'popular'))}</div></section>
      <section class="sec"><div class="sec-h"><h2>🚀 창업 인기 공고</h2><a href="#/list" data-go="tag:창업">전체 보기 →</a></div><div class="grid">${top(sortItems(items.filter((x) => x.tags.includes('창업')), 'popular'))}</div></section>`;
    $('#heroSearch').onsubmit = (e) => { e.preventDefault(); resetF(); F.q = e.target.q.value; F.sort = 'deadline'; go('#/list'); };
  }
  function resetF() { Object.assign(F, { q: '', tags: [], region: '', src: '', sort: 'deadline', due: '', limit: 30, _new: false }); }
  function handleGo(g) {
    resetF();
    if (g === 'new') { F.sort = 'new'; F._new = true; }
    if (g === 'soon') F.due = '7';
    if (g.startsWith('tag:')) F.tags = [g.slice(4)];
    go('#/list');
  }

  // ---------- 뷰: 목록 ----------
  function viewList() {
    const regionOpts = ['', ...REGIONS].map((r) => `<option value="${r}" ${F.region === r ? 'selected' : ''}>${r || '전체 지역'}</option>`).join('');
    app.innerHTML = `<div class="layout">
      <aside class="side" id="side">
        <h4>지역</h4><select class="field" id="fRegion">${regionOpts}</select>
        <p class="muted" style="font-size:12px;margin:6px 0 0">선택 지역 + 전국 공고가 함께 표시됩니다.</p>
        <h4>분야·대상 <small>(복수 선택)</small></h4><div class="opts" id="fTags">${TAGS.map(([t]) => `<button class="opt ${F.tags.includes(t) ? 'on' : ''}" data-t="${t}">${t}</button>`).join('')}</div>
        <h4>마감</h4><div class="opts" id="fDue">${[['', '전체'], ['3', '3일 이내'], ['7', '7일 이내'], ['30', '30일 이내'], ['always', '상시·예산소진']].map(([v, l]) => `<button class="opt ${F.due === v ? 'on' : ''}" data-v="${v}">${l}</button>`).join('')}</div>
        <h4>출처</h4><div class="opts" id="fSrc">${[['', '전체'], ['bizinfo', '기업마당'], ['kstartup', 'K-Startup']].map(([v, l]) => `<button class="opt ${F.src === v ? 'on' : ''}" data-v="${v}">${l}</button>`).join('')}</div>
        <h4>기타</h4><label style="font-size:14px"><input type="checkbox" id="fFarm" ${F.hideFarm ? 'checked' : ''}> 농어업인 대상 공고 숨기기</label>
        <div style="margin-top:14px"><button class="btn sm" id="fReset">필터 초기화</button></div>
      </aside>
      <section>
        <div class="listbar">
          <input class="field q" id="fQ" placeholder="공고명, 기관, 내용 검색 (띄어쓰기로 여러 단어)" value="${esc(F.q)}">
          <select class="field" id="fSort" style="width:auto">${[['deadline', '마감 임박순'], ['new', '최신 등록순'], ['popular', '조회 많은순']].map(([v, l]) => `<option value="${v}" ${F.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
        </div>
        <div class="listbar"><span class="cnt" id="cnt"></span></div>
        <div class="grid" id="grid"></div>
        <button class="more" id="more" hidden>더 보기</button>
      </section></div>`;
    const draw = () => {
      let res = applyFilter(DATA.items, F);
      if (F._new) res = res.filter((x) => x.isNew);
      $('#cnt').innerHTML = `조건에 맞는 공고 <b>${res.length.toLocaleString()}</b>건`;
      $('#grid').innerHTML = res.length ? res.slice(0, F.limit).map((x) => card(x)).join('') : '<div class="empty">조건에 맞는 공고가 없습니다. 필터를 줄여 보세요.</div>';
      $('#more').hidden = res.length <= F.limit;
      $('#more').textContent = `더 보기 (${Math.min(F.limit, res.length)}/${res.length})`;
    };
    const re = () => { F.limit = 30; draw(); };
    $('#fRegion').onchange = (e) => { F.region = e.target.value; re(); };
    $('#fTags').onclick = (e) => { const b = e.target.closest('.opt'); if (!b) return; const t = b.dataset.t; F.tags = F.tags.includes(t) ? F.tags.filter((x) => x !== t) : [...F.tags, t]; b.classList.toggle('on'); re(); };
    const single = (id, key) => ($(id).onclick = (e) => { const b = e.target.closest('.opt'); if (!b) return; F[key] = b.dataset.v; $$('.opt', $(id)).forEach((x) => x.classList.toggle('on', x === b)); re(); });
    single('#fDue', 'due'); single('#fSrc', 'src');
    $('#fFarm').onchange = (e) => { F.hideFarm = e.target.checked; re(); };
    $('#fReset').onclick = () => { resetF(); F._new = false; viewList(); };
    let tm; $('#fQ').oninput = (e) => { clearTimeout(tm); tm = setTimeout(() => { F.q = e.target.value; F._new = false; re(); }, 180); };
    $('#fSort').onchange = (e) => { F.sort = e.target.value; re(); };
    $('#more').onclick = () => { F.limit += 30; draw(); };
    draw();
  }

  // ---------- 뷰: 맞춤 찾기 ----------
  const STAGES = [['pre', '예비창업자 (사업자 없음)'], ['early', '창업 3년 이내'], ['grow', '창업 3~7년'], ['mature', '7년 이상']];
  const STAGE_TOK = { pre: ['예비창업자'], early: ['1년미만', '2년미만', '3년미만'], grow: ['5년미만', '7년미만'], mature: ['10년미만', '10년이상'] };
  function score(it, p) {
    const tags = it.tags || [];
    const why = [];
    let s = 0;
    const regs = it.regions || [];
    if (p.region) { if (regs.includes(p.region)) { s += 3; why.push(p.region + ' 지역'); } else if (!regs.includes('전국')) return null; }
    if (p.industry !== 'farm' && tags.includes('농수산')) return null;
    if (p.industry === 'farm' && tags.includes('농수산')) { s += 4; why.push('농수산'); }
    if (!p.female && /여성/.test(it.title)) return null;
    if (!p.young && /청년/.test(it.title)) s -= 4;
    if (it.career && p.stage) { const ok = STAGE_TOK[p.stage].some((t) => it.career.includes(t)); if (!ok) return null; s += 2; why.push('업력 조건 충족'); }
    if (p.stage === 'pre') { if (tags.includes('예비창업')) { s += 6; why.push('예비창업자 대상'); } else if (tags.includes('창업')) s += 2; }
    if (p.stage === 'early' && tags.includes('창업')) { s += 3; why.push('창업기업 대상'); }
    if (p.stage === 'grow' && /도약|스케일업|성장/.test(it.title)) { s += 3; why.push('성장 단계'); }
    if (p.type === 'sbiz' && tags.includes('소상공인')) { s += 6; why.push('소상공인 대상'); }
    if (p.type === 'sme' && /중소기업|기업/.test(it.title)) s += 1;
    if (p.young && tags.includes('청년')) { s += 3; why.push('청년'); }
    if (p.female && tags.includes('여성')) { s += 3; why.push('여성'); }
    for (const t of p.interests || []) if (tags.includes(t)) { s += 3; why.push(t); }
    if (p.industry === 'it' && tags.includes('기술·R&D')) s += 1;
    if (p.industry === 'make' && /제조|소공인|공장/.test(it.title)) { s += 3; why.push('제조업'); }
    if (p.industry === 'food' && /음식|외식|식당|카페|요식/.test(it.title)) { s += 3; why.push('외식업'); }
    const n = dleft(it.end); if (n !== null && n < 2) s -= 1;
    return s >= 4 ? { s, why: [...new Set(why)] } : null;
  }
  function viewMatch() {
    const p = LS.get('profile', { region: '', stage: 'pre', type: 'sbiz', industry: 'general', young: false, female: false, interests: [] });
    app.innerHTML = `<div class="sec-h"><h2>내 조건으로 맞춤 찾기</h2><span class="muted">조건은 이 브라우저에만 저장됩니다.</span></div>
      <div class="panel"><form id="pf" class="form-grid">
        <div><label class="lb">사업장(예정) 지역</label><select class="field" name="region"><option value="">전국 어디든</option>${REGIONS.map((r) => `<option ${p.region === r ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
        <div><label class="lb">사업 단계</label><select class="field" name="stage">${STAGES.map(([v, l]) => `<option value="${v}" ${p.stage === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div><label class="lb">기업 유형 <small>(소상공인: 상시근로자 5인 미만, 제조·건설·운수·광업 10인 미만)</small></label><select class="field" name="type">${[['sbiz', '소상공인·자영업자'], ['sme', '중소기업·스타트업'], ['none', '해당 없음/모름']].map(([v, l]) => `<option value="${v}" ${p.type === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div><label class="lb">업종</label><select class="field" name="industry">${[['general', '일반 서비스·기타'], ['food', '음식·외식업'], ['retail', '도소매·온라인 판매'], ['make', '제조업'], ['it', 'IT·기술 기반'], ['farm', '농·축·수산업']].map(([v, l]) => `<option value="${v}" ${p.industry === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="full"><label class="lb">해당되면 체크</label><label><input type="checkbox" name="young" ${p.young ? 'checked' : ''}> 대표자 만 39세 이하(청년)</label> &nbsp; <label><input type="checkbox" name="female" ${p.female ? 'checked' : ''}> 여성 대표자</label></div>
        <div class="full"><label class="lb">관심 있는 지원 <small>(복수 선택)</small></label><div class="opts" id="pInt">${['자금·융자', '판로·마케팅', '교육·컨설팅', '공간·입주', '인력·고용', '수출·해외', '기술·R&D', '행사·공모'].map((t) => `<button type="button" class="opt ${(p.interests || []).includes(t) ? 'on' : ''}" data-t="${t}">${t}</button>`).join('')}</div></div>
      </form></div>
      <div class="listbar" style="margin-top:18px"><span class="cnt" id="mCnt"></span></div><div class="grid" id="mGrid"></div><button class="more" id="mMore" hidden>더 보기</button>`;
    let lim = 30;
    const read = () => {
      const f = $('#pf');
      const np = { region: f.region.value, stage: f.stage.value, type: f.type.value, industry: f.industry.value, young: f.young.checked, female: f.female.checked, interests: $$('#pInt .opt.on').map((b) => b.dataset.t) };
      LS.set('profile', np);
      return np;
    };
    const draw = () => {
      const np = read();
      const res = DATA.items.map((it) => ({ it, r: score(it, np) })).filter((x) => x.r).sort((a, b) => b.r.s - a.r.s || (a.it.end || '9999').localeCompare(b.it.end || '9999'));
      $('#mCnt').innerHTML = `내 조건에 맞는 공고 <b>${res.length}</b>건 (적합도순)`;
      $('#mGrid').innerHTML = res.length ? res.slice(0, lim).map(({ it, r }) => card(it, r.why.length ? `<div class="why">✔ ${esc(r.why.slice(0, 4).join(' · '))}</div>` : '')).join('') : '<div class="empty">맞는 공고가 없습니다. 지역을 "전국"으로 바꾸거나 관심 분야를 늘려 보세요.</div>';
      $('#mMore').hidden = res.length <= lim;
    };
    $('#pf').onchange = () => { lim = 30; draw(); };
    $('#pInt').onclick = (e) => { const b = e.target.closest('.opt'); if (!b) return; b.classList.toggle('on'); lim = 30; draw(); };
    $('#mMore').onclick = () => { lim += 30; draw(); };
    draw();
  }

  // ---------- 뷰: 관심 공고 ----------
  function viewSaved() {
    const list = [...saved].map((id) => BY.get(id)).filter(Boolean);
    const gone = saved.size - list.length;
    app.innerHTML = `<div class="sec-h"><h2>관심 공고 ${list.length}건</h2>${list.length ? '<button class="btn sm" id="icsAll">마감일 전체 캘린더 저장(.ics)</button>' : ''}</div>
      ${gone ? `<p class="muted">마감되어 목록에서 사라진 공고 ${gone}건은 숨겨졌습니다.</p>` : ''}
      <div class="grid">${list.length ? sortItems(list, 'deadline').map((x) => card(x)).join('') : '<div class="empty">공고 카드의 ★를 눌러 관심 공고로 저장하세요.</div>'}</div>`;
    const b = $('#icsAll'); if (b) b.onclick = () => downloadICS(list);
  }

  // ---------- 뷰: 가이드 ----------
  function viewGuide() {
    app.innerHTML = `<div class="sec-h"><h2>이용 가이드</h2></div><div class="prose">
      <h3>이 사이트는 이렇게 동작해요</h3>
      <p>매일 아침 자동으로 <b>기업마당</b>(중소벤처기업부 운영, 중앙부처·지자체 지원사업 통합 게시)과 <b>K-Startup</b>(창업진흥원)의 "모집 중" 공고를 전부 수집해 요약합니다. 마감된 공고는 자동으로 빠지고, 새로 올라온 공고에는 NEW 표시가 붙습니다. 공고 상세에서 지원대상, 지원내용, 신청방법, 제출서류, 신청서 양식(첨부파일)을 바로 확인·다운로드할 수 있습니다.</p>
      <h3>지원 대상 기본 기준</h3>
      <table><tr><th style="width:24%">구분</th><th>기준 (일반적인 법령 기준, 공고마다 다를 수 있음)</th></tr>
        <tr><td>소상공인</td><td>소기업 중 상시근로자 수가 광업·제조업·건설업·운수업은 10명 미만, 그 밖의 업종은 5명 미만인 사업자</td></tr>
        <tr><td>예비창업자</td><td>공고일 기준 사업자등록(개인·법인)이 없는 사람</td></tr>
        <tr><td>창업기업</td><td>사업 개시일로부터 7년이 지나지 않은 기업 (초기: 3년 이내, 도약기: 3~7년)</td></tr>
        <tr><td>청년</td><td>대부분 만 39세 이하 (일부 지자체는 만 34세·45세 등 별도 기준)</td></tr></table>
      <h3>신청 순서 추천</h3>
      <ol><li><a href="#/match">맞춤 찾기</a>에서 내 지역·단계·업종을 입력해 해당 공고를 추립니다.</li>
        <li>공고 상세에서 <b>지원대상·제외대상</b>을 확인하고 ★로 저장합니다. (마감일은 캘린더로 저장 가능)</li>
        <li>"이 공고로 서류 작성"을 눌러 사업계획서·신청서·동의서·서약서 초안을 만들고 Word로 내려받습니다.</li>
        <li>공고에 지정 양식(HWP)이 첨부돼 있으면 초안 내용을 해당 양식에 옮겨 붙여 제출합니다.</li>
        <li>제출서류 체크리스트로 증명서(사업자등록증명, 납세증명 등)를 미리 발급해 둡니다.</li></ol>
      <h3>서류 작성 팁</h3>
      <ul><li>평가위원은 "왜 필요한가(문제) → 어떻게 해결하나(실현 가능성) → 어떻게 키우나(성장 전략) → 누가 하나(팀)" 흐름을 봅니다.</li>
        <li>숫자를 넣으세요: 시장 규모, 목표 매출, 고객 수, 고용 계획 등 정량 목표가 있으면 점수가 높아집니다.</li>
        <li>자금 계획은 비목별 산출 근거(단가×수량)를 적고, 공고의 지원 제외 비목(부동산, 차량 등)은 넣지 마세요.</li></ul>
      <h3>데이터 갱신 정보</h3>
      <p>마지막 업데이트: <b>${esc(DATA.updatedAtKST || '-')}</b> (한국시간) · 기업마당 ${DATA.sources?.bizinfo ?? 0}건 · K-Startup ${DATA.sources?.kstartup ?? 0}건</p>
      <p class="muted">공고 정보는 각 기관이 게시한 공공 정보를 요약한 것입니다. 공고는 수정·연장·조기마감될 수 있으니 제출 직전 첨부 공고문 원본을 한 번 더 확인하세요.</p>
    </div>`;
  }

  // ---------- 상세 모달 ----------
  const blk = (t, c) => (c && String(c).trim() && String(c).trim() !== '없음' ? `<div class="blk"><h4>${t}</h4><div class="txt">${esc(String(c).trim())}</div></div>` : '');
  function openDetail(id) {
    const it = BY.get(id);
    if (!it) { toast('마감되었거나 찾을 수 없는 공고입니다.'); return; }
    const forms = (it.files || []).map((f) => {
      const ext = (f.n.match(/\.(\w+)$/) || [])[1] || '';
      const isForm = /신청|서식|양식|계획서|동의서|서약|확약|붙임/.test(f.n);
      return `<li class="${isForm ? 'form' : ''}"><span class="ext">${esc(ext)}</span><span class="fn" title="${esc(f.n)}">${isForm ? '📝 ' : ''}${esc(f.n)}</span><a class="btn sm" href="${esc(f.u)}" target="_blank" rel="noopener">다운로드</a></li>`;
    }).join('');
    const go = it.applyUrl || it.sourceUrl || it.url;
    $('#modalBody').innerHTML = `<div class="d-head">
        <div class="top">${dBadge(it)}${it.isNew ? '<span class="badge new">NEW</span>' : ''}${srcBadge(it)}${it.cat ? `<span class="badge">${esc(it.cat)}</span>` : ''}${it.kind ? `<span class="badge">${esc(it.kind)}</span>` : ''}</div>
        <h2 id="mTitle">${esc(it.title)}</h2></div>
      <dl class="kv">
        <div><dt>신청기간</dt><dd>${esc(period(it))}${it.end ? '' : `<br><small class="muted">${esc(it.periodText || '')}</small>`}</dd></div>
        <div><dt>소관·주관</dt><dd>${esc(it.org || '-')}</dd></div>
        <div><dt>수행기관</dt><dd>${esc(it.agency || '-')}</dd></div>
        <div><dt>지역</dt><dd>${esc((it.regions || []).join(', '))}</dd></div>
        ${it.career ? `<div><dt>창업 업력</dt><dd>${esc(it.career)}</dd></div>` : `<div><dt>등록일</dt><dd>${esc(it.reg || '-')}</dd></div>`}
        ${it.age ? `<div><dt>대상 연령</dt><dd>${esc(it.age)}</dd></div>` : `<div><dt>조회수</dt><dd>${(it.views || 0).toLocaleString()}</dd></div>`}
      </dl>
      ${blk('사업 개요', it.summary)}
      ${blk('지원 대상', it.target)}
      ${blk('제외 대상', it.exclude)}
      ${blk('지원 내용', it.support)}
      ${blk('신청 방법', it.howto)}
      ${blk('제출 서류', it.docs)}
      ${(it.sections || []).map((s) => blk(esc(s.t), s.c)).join('')}
      ${blk('문의처', it.contact)}
      ${forms ? `<div class="blk"><h4>첨부파일 (공고문·신청 양식)</h4><ul class="files">${forms}</ul><p class="muted" style="font-size:12.5px;margin:6px 0 0">📝 표시는 신청서·양식으로 보이는 파일입니다.</p></div>` : ''}
      ${(it.hashtags || []).length ? `<p class="muted" style="font-size:13px">${it.hashtags.map((h) => '#' + esc(h)).join(' ')}</p>` : ''}
      <div class="actions">
        <a class="btn pri" href="${esc(go)}" target="_blank" rel="noopener">${it.applyUrl ? '온라인 접수하기' : '접수처·원문 공고'}</a>
        <a class="btn" href="#/docs?pid=${it.id}">📝 이 공고로 서류 작성</a>
        <button class="btn" data-star="${it.id}">${saved.has(it.id) ? '★ 저장됨' : '☆ 관심 저장'}</button>
        ${it.end ? `<button class="btn" id="dIcs">📅 마감일 캘린더</button>` : ''}
        <button class="btn" id="dShare">🔗 링크 복사</button>
        ${it.url !== go ? `<a class="btn ghost" href="${esc(it.url)}" target="_blank" rel="noopener">원문 보기</a>` : ''}
      </div>`;
    $('#modal').hidden = false;
    document.body.style.overflow = 'hidden';
    const ics = $('#dIcs'); if (ics) ics.onclick = () => downloadICS([it]);
    $('#dShare').onclick = () => { navigator.clipboard?.writeText(location.origin + location.pathname + '#/p/' + it.id); toast('링크를 복사했어요'); };
  }
  function closeDetail() {
    $('#modal').hidden = true; document.body.style.overflow = '';
    if (location.hash.startsWith('#/p/')) history.replaceState(null, '', '#/list');
  }

  function downloadICS(list) {
    const dt = (d) => d.replace(/-/g, '');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//gov-support-hub//KO', 'CALSCALE:GREGORIAN'];
    for (const it of list.filter((x) => x.end)) {
      const next = new Date(it.end + 'T00:00:00'); next.setDate(next.getDate() + 1);
      lines.push('BEGIN:VEVENT', `UID:${it.id}@gov-support-hub`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`, `DTSTART;VALUE=DATE:${dt(it.end)}`, `DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replace(/-/g, '')}`,
        `SUMMARY:[마감] ${it.title.replace(/[,;]/g, ' ')}`, `DESCRIPTION:${(it.url || '').replace(/[,;]/g, ' ')}`, 'BEGIN:VALARM', 'TRIGGER:-P2D', 'ACTION:DISPLAY', 'DESCRIPTION:지원사업 마감 2일 전', 'END:VALARM', 'END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    dl(new Blob([lines.join('\r\n')], { type: 'text/calendar' }), list.length === 1 ? '지원사업_마감일.ics' : '관심공고_마감일.ics');
  }
  function dl(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }

  // ---------- 뷰: 서류 작성 ----------
  const BIZ_FIELDS = [
    ['기본 정보', [
      ['company', '기업(상호)명', 'input', '예: 오늘의빵집 / (예비) 프로젝트명'], ['ceo', '대표자 성명', 'input'],
      ['bizType', '기업 형태', 'select', ['예비창업자', '개인사업자', '법인사업자']], ['bizno', '사업자등록번호', 'input', '000-00-00000'],
      ['opened', '개업(설립)일', 'input', '2024-03-01'], ['industry', '업종/업태', 'input', '예: 음식점업 / 제과점'],
      ['address', '사업장 주소', 'input'], ['phone', '연락처', 'input'], ['email', '이메일', 'input'],
      ['employees', '상시 근로자 수', 'input', '예: 2명'], ['revenue', '전년도 매출액', 'input', '예: 120,000,000원'],
    ]],
    ['아이템·사업 내용', [
      ['item', '아이템(제품·서비스)명', 'input'], ['oneLine', '한 줄 소개', 'textarea', '누구에게 무엇을 어떻게 제공하는지 한두 문장'],
      ['problem', '문제 인식 (배경·필요성)', 'textarea', '고객이 겪는 불편, 시장의 문제, 창업 동기'],
      ['customer', '목표 고객·시장', 'textarea', '주 고객층, 시장 규모, 고객 니즈'],
      ['solution', '해결 방안 (제품·서비스 내용, 준비 현황)', 'textarea'],
      ['diff', '경쟁사 대비 차별점', 'textarea'],
      ['market', '비즈니스 모델·사업화 전략', 'textarea', '수익 구조, 가격, 매출 목표'],
      ['marketing', '판로·마케팅 계획', 'textarea'],
      ['effect', '기대 효과 (매출·고용)', 'textarea'],
    ]],
    ['소상공인·자금 신청용', [
      ['reason', '신청 사유 / 애로사항', 'textarea'], ['plan', '지원금(지원) 활용 계획', 'textarea'],
      ['amount', '신청 금액', 'input', '예: 50,000,000원'], ['loanType', '자금 구분', 'select', ['운전자금', '시설자금', '운전+시설자금']],
      ['repay', '상환 계획', 'textarea'],
    ]],
    ['표 항목 (한 줄에 하나, | 로 구분)', [
      ['budget', '자금 소요 계획: 비목 | 내용 | 금액', 'textarea', '시제품 제작비 | 금형·외주개발 | 10,000,000\n마케팅비 | SNS 광고 | 5,000,000'],
      ['schedule', '추진 일정: 내용 | 기간 | 세부', 'textarea', '시제품 개발 | 2026.11~2027.01 | MVP 완성'],
      ['team', '팀 구성: 성명 | 직위 | 경력', 'textarea', '홍길동 | 대표 | 제과 경력 10년'],
      ['teamSummary', '팀 역량 요약', 'textarea'], ['partners', '협력 기관·파트너', 'textarea'], ['funding', '자금 조달 계획(자부담·투자 등)', 'textarea'],
    ]],
  ];
  function viewDocs(params) {
    const biz = LS.get('biz', {});
    let tplId = LS.get('tpl', 'psst');
    let pid = params.get('pid') || LS.get('docPid', '');
    let manual = false;
    const tpls = window.DocKit.templates;
    const fieldHTML = ([k, label, type, opt]) => {
      const val = esc(biz[k] || '');
      if (type === 'select') return `<div class="fg"><label class="lb">${label}</label><select class="field" name="${k}"><option value="">선택</option>${opt.map((o) => `<option ${biz[k] === o ? 'selected' : ''}>${o}</option>`).join('')}</select></div>`;
      if (type === 'textarea') return `<div class="fg"><label class="lb">${label}</label><textarea class="field" name="${k}" placeholder="${esc(opt || '')}">${val}</textarea></div>`;
      return `<div class="fg"><label class="lb">${label}</label><input class="field" name="${k}" value="${val}" placeholder="${esc(opt || '')}"></div>`;
    };
    app.innerHTML = `<div class="sec-h"><h2>서류 작성 도우미</h2><span class="muted">입력 내용은 이 브라우저에만 자동 저장됩니다.</span></div>
      <div class="tpl-list" id="tpls">${tpls.map((t) => `<button class="tpl ${t.id === tplId ? 'on' : ''}" data-id="${t.id}"><b>${t.name}</b><span>${t.desc}</span></button>`).join('')}</div>
      <div class="linked" id="linked"></div>
      <div class="doc-layout">
        <aside class="doc-form panel" style="padding:14px">
          <div class="ai-box"><b>✨ AI 초안 작성 (선택, 무료)</b>
            <p class="muted" style="font-size:12.5px;margin:4px 0 8px">Google AI Studio에서 무료 Gemini API 키를 발급받아 넣으면, 몇 가지 정보만으로 빈 항목 초안을 써 드립니다. 키는 이 브라우저에만 저장됩니다.</p>
            <input class="field" id="aiKey" type="password" placeholder="Gemini API 키 (AIza...)" value="${esc(LS.get('aiKey', ''))}">
            <div class="row" style="margin-top:6px"><input class="field" id="aiModel" style="flex:1" value="${esc(LS.get('aiModel', 'gemini-flash-latest'))}" title="모델명"><button class="btn sm pri" id="aiRun">빈 항목 AI 작성</button></div>
            <p class="muted" style="font-size:12px;margin:6px 0 0"><a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">무료 API 키 발급 →</a> · 기업명·아이템명·한 줄 소개만 써도 동작합니다.</p>
          </div>
          <form id="bizForm">${BIZ_FIELDS.map(([g, fs], i) => `<details ${i < 2 ? 'open' : ''}><summary>${g}</summary>${fs.map(fieldHTML).join('')}</details>`).join('')}</form>
          <button class="btn sm" id="bizClear" style="margin-top:6px">입력 내용 모두 지우기</button>
        </aside>
        <section>
          <div class="row" style="margin-bottom:10px">
            <button class="btn pri" id="dWord">⬇ Word(.doc) 다운로드</button>
            <button class="btn" id="dPrint">🖨 인쇄 / PDF 저장</button>
            <button class="btn" id="dCopy">📋 텍스트 복사</button>
            <button class="btn ghost" id="dRegen" hidden>↺ 입력값으로 다시 생성</button>
          </div>
          <p class="muted" style="font-size:12.5px;margin:0 0 8px">미리보기 문서를 클릭해 바로 고칠 수도 있습니다. .doc 파일은 MS Word와 한컴오피스 한글에서 열립니다.</p>
          <div class="paper-wrap"><div class="paper" id="paper" contenteditable="true" spellcheck="false"></div></div>
        </section>
      </div>`;
    const tplOf = () => tpls.find((t) => t.id === tplId) || tpls[0];
    const render = () => { if (manual) return; $('#paper').innerHTML = tplOf().render(biz, BY.get(pid)); };
    const linked = () => {
      const p = BY.get(pid);
      $('#linked').innerHTML = p
        ? `<span>📎 연결된 공고: <b>${esc(p.title)}</b> <span class="muted">(${esc(period(p))})</span></span><span class="row"><button class="btn sm" data-open="${p.id}">공고 보기</button><button class="btn sm" id="unlink">연결 해제</button></span>`
        : `<span style="flex:1;position:relative"><input class="field" id="pSearch" placeholder="신청할 공고를 검색해 연결하면 공고명·기관·제출서류가 자동으로 들어갑니다"><div id="pRes" style="position:absolute;left:0;right:0;top:100%;z-index:5;background:#fff;border:1px solid var(--line);border-radius:10px;margin-top:4px;max-height:300px;overflow:auto" hidden></div></span>`;
      const u = $('#unlink'); if (u) u.onclick = () => { pid = ''; LS.set('docPid', ''); linked(); render(); };
      const s = $('#pSearch');
      if (s) s.oninput = () => {
        const q = s.value.trim(); const box = $('#pRes');
        if (q.length < 2) { box.hidden = true; return; }
        const r = applyFilter(DATA.items, { ...F, q, tags: [], region: '', src: '', due: '', sort: 'popular' }).slice(0, 10);
        box.hidden = false;
        box.innerHTML = r.length ? r.map((x) => `<div data-pick="${x.id}" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid #f0f2f7;font-size:14px">${esc(x.title)} <span class="muted">· ${esc(x.end || '상시')}</span></div>`).join('') : '<div style="padding:10px" class="muted">결과 없음</div>';
        box.onclick = (e) => { const d = e.target.closest('[data-pick]'); if (!d) return; pid = d.dataset.pick; LS.set('docPid', pid); linked(); render(); };
      };
    };
    if (pid) LS.set('docPid', pid);
    linked(); render();
    $('#tpls').onclick = (e) => { const b = e.target.closest('.tpl'); if (!b) return; tplId = b.dataset.id; LS.set('tpl', tplId); $$('.tpl').forEach((x) => x.classList.toggle('on', x === b)); manual = false; $('#dRegen').hidden = true; render(); };
    $('#bizForm').oninput = (e) => { biz[e.target.name] = e.target.value; LS.set('biz', biz); render(); };
    $('#paper').oninput = () => { manual = true; $('#dRegen').hidden = false; };
    $('#dRegen').onclick = () => { manual = false; $('#dRegen').hidden = true; render(); };
    $('#bizClear').onclick = () => { if (!confirm('입력한 사업 정보를 모두 지울까요?')) return; LS.set('biz', {}); viewDocs(params); };
    const fname = () => `${tplOf().name.replace(/[^\w가-힣]+/g, '_')}_${biz.company || '초안'}.doc`;
    $('#dWord').onclick = () => { dl(window.DocKit.toWordDoc($('#paper').innerHTML, tplOf().name), fname()); toast('Word 파일을 내려받았어요'); };
    $('#dPrint').onclick = () => window.print();
    $('#dCopy').onclick = () => { navigator.clipboard?.writeText($('#paper').innerText); toast('문서 내용을 복사했어요'); };
    $('#aiKey').onchange = (e) => LS.set('aiKey', e.target.value.trim());
    $('#aiModel').onchange = (e) => LS.set('aiModel', e.target.value.trim());
    $('#aiRun').onclick = async () => {
      const key = $('#aiKey').value.trim(); LS.set('aiKey', key);
      if (!key) { toast('Gemini API 키를 먼저 입력하세요'); return; }
      const btn = $('#aiRun'); btn.disabled = true; btn.textContent = '작성 중…';
      try {
        const out = await aiDraft(key, $('#aiModel').value.trim() || 'gemini-flash-latest', biz, BY.get(pid), tplOf().name);
        let n = 0;
        for (const [k, val] of Object.entries(out)) { if (val && !String(biz[k] || '').trim() && typeof val === 'string') { biz[k] = val; n++; } }
        LS.set('biz', biz);
        manual = false; viewDocs(new URLSearchParams(pid ? 'pid=' + pid : ''));
        toast(n ? `빈 항목 ${n}개를 AI가 채웠어요. 꼭 검토·수정하세요` : '채울 빈 항목이 없었어요');
      } catch (err) { toast('AI 작성 실패: ' + err.message); btn.disabled = false; btn.textContent = '빈 항목 AI 작성'; }
    };
  }
  async function aiDraft(key, model, biz, p, tplName) {
    const keys = ['oneLine', 'problem', 'customer', 'solution', 'diff', 'market', 'marketing', 'effect', 'reason', 'plan', 'teamSummary', 'budget', 'schedule'];
    const prompt = `당신은 한국 정부지원사업(소상공인·창업) 신청서 작성 전문 컨설턴트입니다. 아래 사업 정보와 공고 정보를 바탕으로 "${tplName}"에 들어갈 항목 초안을 한국어 개조식(□, ○, - 기호 사용)으로 작성하세요.
규칙: 사실을 지어내지 말고, 모르는 수치는 "[확인 필요: 예) 월 매출 ○○만원]"처럼 표시. 각 항목 400자 이내. 평가위원이 보기 좋게 구체적으로.
budget은 "비목 | 산출근거 | 금액(숫자)" 형식 줄바꿈 목록, schedule은 "추진내용 | 기간 | 세부내용" 형식 줄바꿈 목록.
반드시 JSON 객체만 출력. 키: ${keys.join(', ')}
[사업 정보]
${JSON.stringify(biz, null, 1)}
[공고 정보]
${p ? JSON.stringify({ 공고명: p.title, 기관: p.org + ' ' + (p.agency || ''), 개요: (p.summary || '').slice(0, 800), 지원대상: (p.target || '').slice(0, 600), 지원내용: (p.support || '').slice(0, 800) }, null, 1) : '(연결된 공고 없음)'}`;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.6, responseMimeType: 'application/json' } }),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error?.message || res.status);
    const text = j.candidates?.[0]?.content?.parts?.map((x) => x.text).join('') || '{}';
    const obj = JSON.parse(text.replace(/^```json|```$/g, '').trim());
    for (const k of Object.keys(obj)) if (Array.isArray(obj[k])) obj[k] = obj[k].join('\n');
    return obj;
  }

  // ---------- 라우터 ----------
  function go(h) { if (location.hash === h) route(); else location.hash = h; }
  function route() {
    const h = location.hash || '#/';
    const [path, qs] = h.slice(1).split('?');
    const params = new URLSearchParams(qs || '');
    if (path.startsWith('/p/')) { if (!app.dataset.v) { app.dataset.v = 'list'; viewList(); } openDetail(path.slice(3)); return; }
    $('#modal').hidden = true; document.body.style.overflow = '';
    const v = path.replace('/', '') || 'home';
    if (v !== 'list') F._new = false;
    app.dataset.v = v;
    $$('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.v === v));
    ({ home: viewHome, list: viewList, match: viewMatch, docs: () => viewDocs(params), saved: viewSaved, guide: viewGuide }[v] || viewHome)();
    window.scrollTo(0, 0);
  }

  // ---------- 이벤트 위임 ----------
  document.addEventListener('click', (e) => {
    const star = e.target.closest('[data-star]');
    if (star) {
      e.stopPropagation(); e.preventDefault();
      const id = star.dataset.star;
      saved.has(id) ? saved.delete(id) : saved.add(id);
      updSaved();
      $$(`[data-star="${id}"]`).forEach((b) => { b.classList.toggle('on', saved.has(id)); if (b.classList.contains('btn')) b.textContent = saved.has(id) ? '★ 저장됨' : '☆ 관심 저장'; });
      toast(saved.has(id) ? '관심 공고에 저장했어요' : '관심 공고에서 뺐어요');
      return;
    }
    const g = e.target.closest('[data-go]');
    if (g) { e.preventDefault(); handleGo(g.dataset.go); return; }
    const op = e.target.closest('[data-open]');
    if (op) { openDetail(op.dataset.open); return; }
    const c = e.target.closest('.card');
    if (c && !e.target.closest('a')) { history.pushState(null, '', '#/p/' + c.dataset.id); openDetail(c.dataset.id); return; }
    if (e.target.closest('[data-close]')) closeDetail();
    if (e.target.closest('.modal-card a[href^="#/docs"]')) { $('#modal').hidden = true; document.body.style.overflow = ''; }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#modal').hidden) closeDetail();
    if (e.key === 'Enter' && e.target.classList?.contains('card')) e.target.click();
  });
  window.addEventListener('hashchange', route);

  // ---------- 시작 ----------
  fetch('data/programs.json?v=' + new Date().toISOString().slice(0, 13), { cache: 'no-cache' })
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((d) => {
      DATA = d;
      BY = new Map(d.items.map((x) => [x.id, x]));
      updSaved();
      route();
    })
    .catch((err) => { app.innerHTML = `<div class="empty">데이터를 불러오지 못했습니다 (${esc(err.message)}).<br>로컬에서 열었다면 간단한 웹서버로 실행하세요: <code>npx serve .</code></div>`; });
})();
