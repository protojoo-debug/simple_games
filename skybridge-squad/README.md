# 스카이브리지 스쿼드

안개 낀 공중 교량 위에서 자동 전진·자동 사격하며, 숫자로 표시된 적과 게이트 중 유리한 경로를 고르는 모바일 우선 3D 러너 슈팅 게임입니다. 외부 모델이나 음원 없이 Three.js 기본 도형과 Web Audio API만으로 완전히 작동합니다.

## 스크린샷

배포 후 아래 위치에 실제 플레이 화면을 추가할 수 있습니다.

```md
![스카이브리지 스쿼드 플레이 화면](./docs/screenshot.png)
```

## 기술 스택

- Vite
- TypeScript strict mode
- Three.js
- HTML5 / CSS
- Web Audio API
- 브라우저 `localStorage`

React, 게임 서버, 데이터베이스, 외부 3D 에셋을 사용하지 않습니다.

## 로컬 실행

Node.js 20 이상이 필요합니다.

```bash
cd skybridge-squad
npm install
npm run dev
```

개발 서버가 안내하는 주소를 브라우저에서 엽니다.

## 프로덕션 빌드

```bash
cd skybridge-squad
npm run build
```

정적 결과물은 `skybridge-squad/web/`에 생성됩니다. Vite `base`를 `./`로 설정해 GitHub Pages 하위 경로에서도 에셋이 정상 로드됩니다.

## GitHub Pages 배포

저장소의 `.github/workflows/deploy.yml`은 `main` 브랜치에 push될 때 게임을 빌드하고 저장소 전체를 GitHub Pages에 배포합니다.

1. GitHub 저장소의 **Settings → Pages**로 이동합니다.
2. **Build and deployment → Source**를 **GitHub Actions**로 선택합니다.
3. `main` 브랜치에 push합니다.
4. Actions의 `Deploy GitHub Pages` 작업이 끝나면 허브의 `skybridge-squad/web/` 경로에서 플레이할 수 있습니다.

## 조작 방법

- PC: `A` / `D`, 좌우 방향키 또는 마우스 커서 위치로 이동
- PC 특수 공격: `Space` 또는 짧은 클릭
- 모바일: 좌우 드래그로 이동, 짧은 탭으로 펄스 폭격
- 기본 사격: 가장 가까운 전방 목표를 향해 자동 발사
- 메뉴와 버튼: 키보드 `Tab`과 `Enter`로 조작 가능

## 게임 규칙

- 초기 병력은 15명, 실드는 100입니다.
- 적 위 숫자는 적 체력입니다. 공격할 때마다 줄고 0이 되면 제거됩니다.
- `+`, `−`, `×`, `÷` 및 강화 게이트 중 한쪽 경로를 선택합니다.
- 병력이 늘면 화면의 아군 대형도 최대 30명까지 커집니다.
- 장애물, 적, 보스 공격에 맞으면 실드와 병력이 감소합니다.
- 마지막 보스 스톰브레이커를 처치하면 스테이지가 끝납니다.
- 최종 점수와 최고 점수는 기기에 저장됩니다.

## 주요 디렉터리

- `src/game`: 게임 상태, 루프, 입력, 사운드, 충돌과 상수
- `src/entities`: 플레이어 부대, 적, 투사체, 게이트, 장애물, 보스
- `src/systems`: 스테이지, 스폰, 전투, 난이도와 오브젝트 풀
- `src/stages`: 거리 기반 스테이지 이벤트 데이터
- `src/ui`: DOM HUD와 메뉴/결과 화면
- `src/utils`: 수학, 텍스트 스프라이트, Three.js 정리 도구
- `web`: GitHub Pages에 제공되는 프로덕션 빌드

## 성능 및 접근성

- 픽셀 비율 제한, 그림자/파티클 축소 저사양 모드
- 투사체 오브젝트 풀과 화면 밖 객체 정리
- 탭 비활성화 시 자동 일시정지
- 명확한 버튼 텍스트와 ARIA 레이블
- 게이트에 색상과 기호를 함께 표시
- 사운드 없이도 토스트, 체력 바, 피격 색상으로 상태 전달
- 화면 흔들림 끄기 및 `prefers-reduced-motion` 지원

## 향후 개선

- 추가 스테이지와 보스 패턴
- 아군 대형을 위한 `InstancedMesh` 전환
- 게임패드와 진동 피드백
- 난이도 프리셋과 튜토리얼
- 오프라인 PWA 캐시
