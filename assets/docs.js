/* 서류 작성 도우미: 템플릿 정의 (브라우저 전용, 서버 전송 없음) */
(function () {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nl = (s) => esc(s).replace(/\n/g, '<br>');
  const v = (s, ph) => (s && String(s).trim() ? nl(s) : `<span style="color:#9aa3b2">${esc(ph || '(작성 필요)')}</span>`);
  const today = () => { const d = new Date(); return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`; };

  const S = {
    page: 'font-family:"Malgun Gothic","맑은 고딕",sans-serif;font-size:10.5pt;line-height:1.6;color:#000',
    h1: 'text-align:center;font-size:18pt;font-weight:bold;margin:0 0 6px;letter-spacing:2px',
    sub: 'text-align:center;font-size:10pt;color:#333;margin:0 0 18px',
    h2: 'font-size:12.5pt;font-weight:bold;margin:20px 0 8px;padding-bottom:3px;border-bottom:2px solid #1f3a73',
    h3: 'font-size:11pt;font-weight:bold;margin:14px 0 6px',
    table: 'width:100%;border-collapse:collapse;margin:6px 0 10px;table-layout:fixed',
    th: 'border:1px solid #555;background:#e8edf5;padding:6px 7px;font-weight:bold;text-align:center;vertical-align:middle',
    td: 'border:1px solid #555;padding:6px 8px;vertical-align:top',
    box: 'border:1px solid #555;padding:10px 12px;margin:6px 0 10px;min-height:60px',
    note: 'font-size:9pt;color:#555',
  };
  const th = (t, w) => `<th style="${S.th}${w ? ';width:' + w : ''}">${t}</th>`;
  const td = (t, span) => `<td style="${S.td}"${span ? ` colspan="${span}"` : ''}>${t}</td>`;
  const table = (rows) => `<table style="${S.table}">${rows.join('')}</table>`;
  const tr = (...cells) => `<tr>${cells.join('')}</tr>`;
  const box = (t) => `<div style="${S.box}">${t}</div>`;

  // "항목: 금액" 줄을 표로 변환
  function parseLines(text, n) {
    return String(text || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      const p = l.split(/\s*[:|\/]\s*|\t/);
      while (p.length < n) p.push('');
      return p.slice(0, n - 1).concat(p.slice(n - 1).join(' '));
    });
  }
  function money(s) {
    const n = Number(String(s || '').replace(/[^\d.]/g, ''));
    return isFinite(n) ? n : 0;
  }
  function budgetTable(b) {
    const rows = parseLines(b.budget, 3);
    if (!rows.length) rows.push(['(예) 시제품 제작비', '외주 개발 및 금형', '10,000,000'], ['(예) 마케팅비', '온라인 광고', '5,000,000']);
    let sum = 0;
    const body = rows.map((r) => { sum += money(r[2]); return tr(td(esc(r[0])), td(esc(r[1])), td(`<div style="text-align:right">${esc(r[2])}</div>`)); });
    return table([tr(th('비목', '28%'), th('산출 근거(내용)'), th('금액(원)', '24%')), ...body, tr(`<td style="${S.td};text-align:center;font-weight:bold" colspan="2">합 계</td>`, td(`<div style="text-align:right;font-weight:bold">${sum ? sum.toLocaleString('ko-KR') : ''}</div>`))]);
  }
  function teamTable(b) {
    const rows = parseLines(b.team, 3);
    if (!rows.length) rows.push([b.ceo || '대표자', '대표 / 총괄', '(주요 경력, 학력, 보유 역량)']);
    return table([tr(th('성명', '18%'), th('직위·담당', '24%'), th('주요 경력 및 역량')), ...rows.map((r) => tr(td(esc(r[0])), td(esc(r[1])), td(esc(r[2]))))]);
  }
  function scheduleTable(b) {
    const rows = parseLines(b.schedule, 3);
    if (!rows.length) rows.push(['(예) 시제품 고도화', '2026.11 ~ 2027.01', '기능 개선 및 사용자 테스트'], ['(예) 정식 출시', '2027.02', '온라인 판매 개시']);
    return table([tr(th('추진 내용', '32%'), th('추진 기간', '24%'), th('세부 내용')), ...rows.map((r) => tr(td(esc(r[0])), td(esc(r[1])), td(esc(r[2]))))]);
  }
  function generalTable(b, p) {
    return table([
      tr(th('사업(공고)명', '18%'), td(p ? esc(p.title) : v('', '(신청할 공고를 선택하세요)'), 3)),
      tr(th('기업(상호)명'), td(v(b.company)), th('대표자', '16%'), td(v(b.ceo))),
      tr(th('사업자등록번호'), td(v(b.bizno, '(예비창업자는 공란)')), th('개업(설립)일'), td(v(b.opened, '(예비창업자는 공란)'))),
      tr(th('기업 형태'), td(v(b.bizType)), th('업종/업태'), td(v(b.industry))),
      tr(th('사업장 주소'), td(v(b.address), 3)),
      tr(th('연락처'), td(v(b.phone)), th('이메일'), td(v(b.email))),
      tr(th('상시 근로자 수'), td(v(b.employees, '(명)')), th('전년도 매출'), td(v(b.revenue, '(원)'))),
    ]);
  }
  const head = (title, p) => `<p style="${S.h1}">${title}</p>${p ? `<p style="${S.sub}">${esc(p.title)}<br>(${esc(p.agency && p.agency !== '기초자치단체' ? p.agency : p.org || '')})</p>` : '<p style="' + S.sub + '">&nbsp;</p>'}`;
  const sign = (b, who = '신청인') => `<p style="text-align:center;margin-top:28px">${today()}</p><p style="text-align:right;margin-top:10px">${who} &nbsp; ${esc(b.company || '')} &nbsp; 대표 &nbsp;<b>${esc(b.ceo || '　　　　')}</b> &nbsp; (서명 또는 인)</p>`;

  const T = [
    {
      id: 'psst', name: '창업 사업계획서 (PSST)', desc: '예비·초기창업패키지 등 창업지원사업 표준 목차',
      render: (b, p) => `<div style="${S.page}">
        ${head('사 업 계 획 서', p)}
        <p style="${S.h2}">□ 일반 현황</p>${generalTable(b, p)}
        <p style="${S.h2}">□ 창업 아이템 개요(요약)</p>
        ${table([
          tr(th('아이템명', '18%'), td(v(b.item))),
          tr(th('아이템 개요'), td(v(b.oneLine, '제품·서비스를 한두 문장으로 요약'))),
          tr(th('문제 인식'), td(v(firstSentences(b.problem), '해결하려는 문제 요약'))),
          tr(th('실현 가능성'), td(v(firstSentences(b.solution), '해결 방법·개발 현황 요약'))),
          tr(th('성장 전략'), td(v(firstSentences(b.market), '목표 시장·사업화 전략 요약'))),
          tr(th('팀 구성'), td(v(firstSentences(b.teamSummary || b.team), '대표자 및 팀 역량 요약'))),
        ])}
        <p style="${S.h2}">1. 문제 인식 (Problem)</p>
        <p style="${S.h3}">1-1. 창업 아이템의 개발 배경 및 필요성</p>${box(v(b.problem, '외부적(시장·사회) 배경과 내부적(창업자 경험) 동기, 고객이 겪는 불편함을 구체적 근거(통계·인터뷰)와 함께 작성'))}
        <p style="${S.h3}">1-2. 목표 시장(고객) 현황 분석</p>${box(v(b.customer, '목표 고객 정의, 시장 규모(TAM/SAM/SOM), 고객 니즈'))}
        <p style="${S.h2}">2. 실현 가능성 (Solution)</p>
        <p style="${S.h3}">2-1. 창업 아이템의 개발·사업화 방안</p>${box(v(b.solution, '제품·서비스의 핵심 기능, 개발 방법, 현재 준비 정도(시제품, 특허 등)'))}
        <p style="${S.h3}">2-2. 차별성 및 경쟁력 확보 전략</p>${box(v(b.diff, '경쟁 제품·서비스 대비 차별점, 진입장벽, 지식재산권'))}
        <p style="${S.h3}">2-3. 사업 추진 일정</p>${scheduleTable(b)}
        <p style="${S.h2}">3. 성장 전략 (Scale-up)</p>
        <p style="${S.h3}">3-1. 사업화 추진 전략 (비즈니스 모델·판로)</p>${box(v((b.market || '') + (b.marketing ? '\n\n' + b.marketing : ''), '수익 구조, 가격 정책, 판로 확보·마케팅 계획, 매출 목표'))}
        <p style="${S.h3}">3-2. 자금 소요 및 조달 계획</p>${budgetTable(b)}
        ${b.funding ? box(nl(b.funding)) : ''}
        <p style="${S.h3}">3-3. 기대 효과 (매출·고용 등)</p>${box(v(b.effect, '향후 매출 목표, 신규 고용 계획, 사회적·지역적 파급 효과'))}
        <p style="${S.h2}">4. 팀 구성 (Team)</p>
        <p style="${S.h3}">4-1. 대표자 및 팀원 역량</p>${teamTable(b)}
        ${b.teamSummary ? box(nl(b.teamSummary)) : ''}
        <p style="${S.h3}">4-2. 협력 기관(파트너) 현황 및 활용 계획</p>${box(v(b.partners, '협력 기업·기관, 활용 계획 (없으면 향후 계획 작성)'))}
        <p style="${S.note}">※ 공고별 지정 양식이 있는 경우 해당 양식(첨부 HWP)에 본 내용을 옮겨 작성하세요.</p>
      </div>`,
    },
    {
      id: 'sbiz', name: '소상공인 지원 신청서·사업계획서', desc: '경영개선·점포환경·판로·컨설팅 등 소상공인 공통형',
      render: (b, p) => `<div style="${S.page}">
        ${head('지원사업 참가 신청서 및 사업계획서', p)}
        <p style="${S.h2}">1. 신청인(사업장) 현황</p>${generalTable(b, p)}
        ${table([tr(th('업력', '18%'), td(v(b.opened ? yearsFrom(b.opened) : '', '(년)')), th('소상공인 여부', '18%'), td(v(b.sbizYn || '해당 (소상공인확인서 제출)')))])}
        <p style="${S.h2}">2. 사업장 운영 현황</p>${box(v(b.oneLine ? b.oneLine + '\n' + (b.solution || '') : b.solution, '주요 판매 상품·서비스, 운영 기간, 주 고객층, 월평균 매출, 강점'))}
        <p style="${S.h2}">3. 신청 사유 (현재 애로사항)</p>${box(v(b.reason || b.problem, '지원이 필요한 이유, 현재 겪는 어려움(매출 감소, 노후 시설, 홍보 부족 등)을 구체적으로'))}
        <p style="${S.h2}">4. 지원금 활용 계획</p>${box(v(b.plan || b.marketing, '지원받으면 무엇을, 언제, 어떻게 할지 (예: 간판·인테리어 개선, 온라인 판로 개설, 키오스크 도입 등)'))}
        ${scheduleTable(b)}
        <p style="${S.h2}">5. 소요 예산</p>${budgetTable(b)}
        <p style="${S.h2}">6. 기대 효과</p>${box(v(b.effect, '매출 증대 목표, 고객 증가, 고용 유지·창출 등 정량 목표 포함'))}
        <p style="margin-top:16px">위와 같이 「${esc(p ? p.title : '해당 지원사업')}」에 참가를 신청하며, 기재 내용이 사실과 다를 경우 선정 취소 등 불이익을 감수하겠습니다.</p>
        ${sign(b)}
        <p style="text-align:left;margin-top:16px"><b>${esc(p && p.agency && p.agency !== '기초자치단체' ? p.agency : p ? p.org : '○○기관')} 귀하</b></p>
      </div>`,
    },
    {
      id: 'loan', name: '정책자금 융자 사업계획서', desc: '육성자금·정책자금·보증 신청 시 자금사용계획',
      render: (b, p) => `<div style="${S.page}">
        ${head('사업계획서 및 자금 사용 계획서', p)}
        <p style="${S.h2}">1. 기업 현황</p>${generalTable(b, p)}
        <p style="${S.h2}">2. 신청 내용</p>
        ${table([tr(th('신청 금액', '18%'), td(v(b.amount, '(원)')), th('자금 구분', '18%'), td(v(b.loanType, '운전자금 / 시설자금')))
        , tr(th('상환 계획'), td(v(b.repay, '거치 기간·상환 기간 및 상환 재원(매출 등)'), 3))])}
        <p style="${S.h2}">3. 사업 내용 및 경쟁력</p>${box(v((b.oneLine ? b.oneLine + '\n' : '') + (b.solution || ''), '주력 제품·서비스, 주요 거래처, 기술력·경쟁력'))}
        <p style="${S.h2}">4. 자금 필요 사유</p>${box(v(b.reason || b.problem, '자금이 필요한 구체적 이유 (원자재 구입, 설비 도입, 인건비 등)'))}
        <p style="${S.h2}">5. 자금 사용 계획</p>${budgetTable(b)}
        <p style="${S.h2}">6. 매출 및 경영 계획</p>${box(v(b.effect || b.market, '최근 매출 추이와 향후 1~3년 매출 목표, 수익성 개선 계획'))}
        <p style="${S.note}">※ 정책자금은 별도 신청 시스템(온라인)과 지정 양식이 있는 경우가 많습니다. 본 문서는 내용 정리용 초안으로 활용하세요.</p>
        ${sign(b)}
      </div>`,
    },
    {
      id: 'apply', name: '참가(지원) 신청서 – 공통', desc: '교육·컨설팅·행사·입주 등 간단 신청서',
      render: (b, p) => `<div style="${S.page}">
        ${head('참 가 신 청 서', p)}
        ${generalTable(b, p)}
        ${table([
          tr(th('주요 아이템', '18%'), td(v(b.item || b.oneLine))),
          tr(th('신청 동기'), td(v(b.reason || b.problem, '참가하려는 이유와 기대하는 점'))),
          tr(th('참여 희망 내용'), td(v(b.plan, '희망 프로그램·분야, 요청사항'))),
        ])}
        <p style="margin-top:14px">본인은 위 사업에 참가를 신청하며, 공고문의 모든 사항을 준수하겠습니다.</p>
        ${sign(b)}
      </div>`,
    },
    {
      id: 'privacy', name: '개인정보 수집·이용 동의서', desc: '대부분의 공고에서 요구하는 동의서',
      render: (b, p) => `<div style="${S.page}">
        ${head('개인정보 수집·이용 및 제3자 제공 동의서', p)}
        <p>${esc(p && p.agency && p.agency !== '기초자치단체' ? p.agency : p ? p.org : '사업 수행기관')}은(는) 「개인정보 보호법」에 따라 지원사업 신청·선정·관리를 위해 아래와 같이 개인정보를 수집·이용하고자 합니다.</p>
        ${table([
          tr(th('수집·이용 목적', '24%'), td('지원사업 신청 접수, 자격 확인, 선정 평가, 사업 운영 및 사후 관리, 성과 조사')),
          tr(th('수집 항목'), td('성명, 생년월일, 연락처, 이메일, 주소, 사업자 정보(상호, 사업자등록번호, 업종, 매출, 고용 현황)')),
          tr(th('보유·이용 기간'), td('사업 종료 후 5년 (관계 법령에 따른 보존 기간이 있는 경우 해당 기간)')),
          tr(th('제3자 제공'), td('제공받는 자: 주관·전담기관 및 평가위원 / 목적: 평가·사업 관리 / 항목: 위 수집 항목')),
          tr(th('동의 거부 권리'), td('동의를 거부할 수 있으나, 거부 시 지원사업 신청이 제한될 수 있습니다.')),
        ])}
        ${table([tr(th('개인정보 수집·이용', '40%'), td('□ 동의함 &nbsp;&nbsp; □ 동의하지 않음')), tr(th('개인정보 제3자 제공'), td('□ 동의함 &nbsp;&nbsp; □ 동의하지 않음')), tr(th('고유식별정보(사업자번호 등) 처리'), td('□ 동의함 &nbsp;&nbsp; □ 동의하지 않음'))])}
        ${sign(b, '동의자')}
        <p style="${S.note}">※ 공고에서 별도 동의서 양식을 제공하면 반드시 해당 양식을 사용하세요.</p>
      </div>`,
    },
    {
      id: 'pledge', name: '서약서(확약서)', desc: '중복지원·체납 없음·허위 시 환수 동의',
      render: (b, p) => `<div style="${S.page}">
        ${head('서 약 서', p)}
        <p>본인은 「${esc(p ? p.title : '해당 지원사업')}」에 신청함에 있어 다음 사항을 확인하고 서약합니다.</p>
        <ol style="line-height:2">
          <li>신청서 및 제출 서류의 모든 내용은 사실이며, 허위가 있을 경우 선정 취소 및 지원금 환수에 이의를 제기하지 않겠습니다.</li>
          <li>국세 및 지방세를 체납하고 있지 않으며, 금융기관 연체 등 참여 제한 사유에 해당하지 않습니다.</li>
          <li>휴·폐업 상태가 아니며, 동일·유사 내용으로 다른 정부 지원사업에 중복 지원받지 않았습니다.</li>
          <li>지원금은 승인된 사업계획에 따라 목적에 맞게 사용하고, 정산 및 사후 관리에 성실히 협조하겠습니다.</li>
          <li>사업 수행 중 주관기관의 요청이 있을 경우 성과 조사 등에 적극 참여하겠습니다.</li>
        </ol>
        ${sign(b, '서약자')}
        <p style="text-align:left;margin-top:16px"><b>${esc(p && p.agency && p.agency !== '기초자치단체' ? p.agency : p ? p.org : '○○기관')} 귀하</b></p>
      </div>`,
    },
    {
      id: 'checklist', name: '제출서류 체크리스트', desc: '선택한 공고 기반 준비물 + 발급처',
      render: (b, p) => {
        const fromNotice = p ? extractDocs(p) : [];
        const forms = p ? (p.files || []).filter((f) => /신청|서식|양식|계획서|동의서|서약|확약|붙임/.test(f.n)) : [];
        const common = [
          ['사업자등록증명원', '홈택스 또는 정부24 (무료, 온라인 발급)'],
          ['국세 납세증명서(완납증명)', '홈택스 > 민원증명'],
          ['지방세 납세증명서', '정부24 또는 위택스'],
          ['부가가치세 과세표준증명원 / 매출 증빙', '홈택스 > 민원증명'],
          ['4대 사회보험 사업장 가입자명부', '4대사회보험 정보연계센터'],
          ['소상공인확인서 (소상공인 대상 사업)', '소상공인시장진흥공단 확인서 발급 시스템'],
          ['중소기업확인서 (중소기업 대상 사업)', '중소기업현황정보시스템'],
          ['대표자 신분증 사본 / 주민등록초본', '정부24'],
          ['재무제표 증명원 (법인·복식부기)', '홈택스'],
        ];
        return `<div style="${S.page}">
        ${head('제출서류 체크리스트', p)}
        ${p ? `<p style="${S.h2}">1. 공고에 명시된 제출서류</p>${fromNotice.length ? table([tr(th('확인', '10%'), th('서류')), ...fromNotice.map((d) => tr(td('<div style="text-align:center">□</div>'), td(esc(d))))]) : box('공고 본문에 서류 목록이 따로 정리되어 있지 않습니다. 첨부된 공고문(HWP/PDF)의 "제출서류" 항목을 확인하세요.')}
        <p style="${S.h2}">2. 공고에 첨부된 신청 양식</p>${forms.length ? table([tr(th('확인', '10%'), th('양식 파일')), ...forms.map((f) => tr(td('<div style="text-align:center">□</div>'), td(`<a href="${esc(f.u)}">${esc(f.n)}</a>`)))]) : box('별도 양식 파일이 없습니다.')}` : `<p style="${S.note}">공고를 선택하면 해당 공고의 제출서류와 양식이 자동으로 추가됩니다.</p>`}
        <p style="${S.h2}">${p ? '3' : '1'}. 자주 요구되는 공통 서류와 발급처</p>
        ${table([tr(th('확인', '10%'), th('서류', '45%'), th('발급처')), ...common.map((c) => tr(td('<div style="text-align:center">□</div>'), td(esc(c[0])), td(esc(c[1]))))])}
        <p style="${S.note}">※ 증명서는 대부분 "공고일 이후 발급분"을 요구합니다. 발급일 기준을 꼭 확인하세요.</p>
      </div>`;
      },
    },
  ];

  function firstSentences(s, n = 140) {
    s = String(s || '').replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n) + '…' : s;
  }
  function yearsFrom(d) {
    const t = Date.parse(String(d).replace(/[.\/]/g, '-'));
    if (!t) return '';
    const y = (Date.now() - t) / (365.25 * 864e5);
    return y < 1 ? `${Math.max(1, Math.round(y * 12))}개월` : `${y.toFixed(1)}년`;
  }
  function extractDocs(p) {
    const src = [p.docs, p.howto, p.summary, p.support].filter(Boolean).join('\n');
    const out = new Set();
    for (let line of src.split('\n')) {
      line = line.replace(/^[\s▪•·\-*ㅇ○◦□■①-⑳\d.)]+/, '').trim();
      if (line.length < 3 || line.length > 90) continue;
      if (/(신청서|계획서|동의서|서약서|확약서|증명|확인서|등록증|사본|명부|재무제표|추천서|이력서|포트폴리오|견적서|통장|등본|초본|증빙)/.test(line)) out.add(line);
    }
    return [...out].slice(0, 25);
  }

  function toWordDoc(html, title) {
    const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${esc(title)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>@page{size:21cm 29.7cm;margin:2cm 2cm 2cm 2cm}body{font-family:"Malgun Gothic";font-size:10.5pt}</style></head><body>${html}</body></html>`;
    return new Blob(['\ufeff', doc], { type: 'application/msword' });
  }

  window.DocKit = { templates: T, toWordDoc, extractDocs, esc };
})();
