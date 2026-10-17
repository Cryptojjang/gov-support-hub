# 지원사업 모아보기 (소상공인·창업 정부지원 공고 자동 수집 사이트)

지금 신청 가능한 정부·지자체 지원사업 공고를 **매일 자동으로 수집**해서 보여주고, **신청 서류 초안**까지 만들어 주는 무료 정적 웹사이트입니다.

- 데이터 출처: 기업마당(bizinfo.go.kr, 중앙부처·지자체 통합) + K-Startup(k-startup.go.kr, 창업진흥원) 모집 중 공고 전체
- 공고마다 사업개요 / 지원대상 / 제외대상 / 지원내용 / 신청방법 / 제출서류 / 문의처 / 첨부파일(공고문·신청양식) 수집
- 마감된 공고는 자동 제외, 최근 3일 신규 공고는 NEW 표시
- 운영비 0원: GitHub Pages(호스팅) + GitHub Actions(매일 자동 수집) 무료 사용

## 주요 기능

| 화면 | 기능 |
|---|---|
| 홈 | 전체·신규·마감임박·소상공인·창업 공고 수, 분야별 바로가기, 곧 마감/신규/인기 공고 |
| 전체 공고 | 지역(선택 지역+전국), 분야·대상 복수 선택, 마감 기간, 출처, 검색, 정렬 |
| 맞춤 찾기 | 지역·사업단계(예비/3년/7년)·기업유형·업종·청년·여성·관심분야로 적합도 순 추천 |
| 공고 상세 | 요약 정보 전부 + 첨부 양식 바로 다운로드, 관심 저장, 마감일 캘린더(.ics), 링크 공유 |
| 서류 작성 | 7종 템플릿(창업 사업계획서 PSST, 소상공인 신청서·계획서, 정책자금 계획서, 참가신청서, 개인정보 동의서, 서약서, 제출서류 체크리스트). 공고 연결 시 공고명·기관 자동 입력, Word(.doc) 다운로드 / PDF 인쇄 |
| AI 초안(선택) | 무료 Gemini API 키를 넣으면 빈 항목을 AI가 초안 작성 (키는 사용자 브라우저에만 저장) |

입력한 사업 정보, 관심 공고, 맞춤 조건은 모두 **사용자 브라우저(localStorage)에만** 저장됩니다. 서버가 없으므로 개인정보가 외부로 나가지 않습니다.

## 무료로 배포하기 (10분)

1. https://github.com 가입 후 오른쪽 위 **+ → New repository**
   - 이름 예: `gov-support-hub`, **Public** 선택 → Create
2. 저장소 화면에서 **Add file → Upload files** → 이 폴더 안의 파일을 전부 끌어다 놓고 Commit
   - `.github/workflows/update.yml` 파일이 꼭 올라가야 합니다. (숨김 폴더라 빠지는 경우 **Add file → Create new file**에서 파일 이름에 `.github/workflows/update.yml`을 입력하고 내용을 붙여넣으세요.)
3. **Settings → Pages → Build and deployment → Source: GitHub Actions** 선택
4. **Settings → Actions → General → Workflow permissions: Read and write permissions** 선택 후 Save
5. **Actions** 탭 → `매일 공고 업데이트 및 배포` → **Run workflow** (첫 실행 약 3~10분)
6. 완료 후 주소: `https://<내 GitHub 아이디>.github.io/gov-support-hub/`

이후로는 **매일 06:00, 13:00(한국시간)** 자동으로 새 공고를 수집하고 사이트를 다시 배포합니다. 시간 변경은 `.github/workflows/update.yml`의 `cron` 값을 바꾸면 됩니다(UTC 기준, 한국시간 -9시간).

### 참고
- 처음 올린 `data/programs.json`에 이미 실제 공고(2026-10-17 기준 1,651건)가 들어 있어 배포 즉시 내용이 보입니다.
- 상세 정보는 `data/cache/details.json`에 캐시되어 매일 새 공고만 추가로 수집합니다(보통 1분 내외).
- 한쪽 사이트 수집이 실패해도 이전 데이터를 유지합니다.
- 만약 GitHub 서버(해외 IP)에서 공공 사이트 접속이 막히면, 내 PC에서 `node scripts/update.mjs` 실행 후 `data` 폴더를 커밋하면 됩니다. (Windows 작업 스케줄러로 매일 실행 가능)
- Netlify, Cloudflare Pages에도 그대로 올릴 수 있습니다(빌드 명령 없음, 루트 폴더 배포). 이 경우 매일 갱신은 GitHub Actions로 데이터를 커밋하고 저장소 연동 자동배포를 쓰면 됩니다.

## 로컬에서 실행

```bash
node scripts/update.mjs     # 최신 공고 수집 (Node 18 이상, 추가 설치 없음)
npx serve .                 # http://localhost:3000 에서 확인
```

## 파일 구조

```
index.html               화면 뼈대
assets/style.css         디자인
assets/app.js            목록·필터·맞춤추천·상세·관심공고·서류작성 로직
assets/docs.js           서류 템플릿 7종 + Word 내보내기
data/programs.json       수집된 공고 데이터 (자동 생성)
data/cache/details.json  상세 정보 캐시 (자동 생성)
scripts/update.mjs       수집기 (기업마당 + K-Startup)
.github/workflows/update.yml  매일 자동 수집·배포
```

## 주의
공고 정보는 각 기관이 공개 게시한 공공 정보를 요약한 것입니다. 공고는 수정·연장·조기마감될 수 있으므로 최종 제출 전 첨부된 공고문 원본으로 세부 요건을 확인하세요. 서류 템플릿은 범용 초안이며, 공고에 지정 양식(HWP)이 있으면 해당 양식에 옮겨 제출해야 합니다.
