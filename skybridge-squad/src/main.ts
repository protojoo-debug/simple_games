import "./style.css";
import { Game } from "./game/Game";
import { UIManager } from "./ui/UIManager";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("App root was not found.");

app.innerHTML = `
  <main id="game-shell" class="game-shell">
    <div id="game-stage" class="game-stage">
      <div id="hud" class="hud" aria-live="polite">
        <div class="stat-cluster">
          <div class="stat-chip army-chip"><span>병력</span><strong id="army-value">15</strong></div>
          <div class="stat-chip"><span>실드</span><strong id="health-value">100</strong></div>
        </div>
        <button id="pause-button" class="icon-button" type="button" aria-label="게임 일시정지">Ⅱ</button>
        <div class="progress-row">
          <span>WAVE <b id="wave-value">1/5</b></span>
          <div class="progress-track" aria-label="스테이지 진행률"><i id="progress-fill"></i></div>
        </div>
        <div id="boss-health" class="boss-health">
          <span>STORMBREAKER</span>
          <div><i id="boss-fill"></i></div>
        </div>
      </div>

      <div id="toast" class="toast" role="status"></div>

      <button id="special-button" class="special-button" type="button" aria-label="특수 공격 사용">
        <span>⚡</span><small>펄스</small>
      </button>

      <section id="menu-screen" class="overlay menu-screen visible" aria-labelledby="game-title">
        <div class="menu-topline"><span>SKY UNIT // 07</span><span>ONE RUN · ONE BRIDGE</span></div>
        <div class="menu-copy">
          <p class="eyebrow">3D FORMATION RUNNER</p>
          <h1 id="game-title"><span>스카이브리지</span><strong>스쿼드</strong></h1>
          <p>안개 협곡의 마지막 교량을 돌파하세요. 숫자를 읽고, 병력을 키우고, 스톰브레이커를 무너뜨리세요.</p>
        </div>
        <div class="menu-actions">
          <button id="play-button" class="primary-button" type="button" aria-label="게임 시작">
            <span>작전 시작</span><b>→</b>
          </button>
          <div class="secondary-actions">
            <button id="help-button" type="button" aria-label="조작법 보기">조작법</button>
            <button id="sound-button" type="button" aria-label="사운드 켜기 또는 끄기">사운드 켜짐</button>
          </div>
        </div>
        <div id="help-panel" class="help-panel">
          <p><b>PC</b> A/D·방향키 또는 마우스 드래그로 이동 · Space/클릭으로 펄스</p>
          <p><b>모바일</b> 좌우 드래그로 이동 · 탭으로 펄스 · 기본 사격은 자동</p>
        </div>
        <p class="menu-footnote">+ · − · × · ÷ 기호를 확인하고 더 유리한 경로를 선택하세요.</p>
      </section>

      <section id="pause-screen" class="overlay dialog-screen" aria-labelledby="pause-title">
        <div class="dialog-card">
          <p class="eyebrow">MISSION HOLD</p>
          <h2 id="pause-title">작전 일시정지</h2>
          <button id="resume-button" class="primary-button compact" type="button">계속하기</button>
          <button id="pause-restart" type="button">처음부터 다시</button>
          <button id="pause-home" type="button">메인 화면</button>
          <button id="pause-sound" type="button">사운드 끄기</button>
          <button id="low-power-button" type="button">저사양 모드 꺼짐</button>
          <button id="shake-button" type="button">화면 흔들림 켜짐</button>
        </div>
      </section>

      <section id="result-screen" class="overlay dialog-screen" aria-labelledby="result-title">
        <div class="dialog-card result-card">
          <p id="result-kicker" class="eyebrow">MISSION COMPLETE</p>
          <h2 id="result-title">교량 확보 완료</h2>
          <div class="score-block"><span>FINAL SCORE</span><strong id="result-score">0</strong><small>BEST <b id="best-score">0</b></small></div>
          <dl>
            <div><dt>남은 병력</dt><dd id="result-army">0</dd></div>
            <div><dt>처치</dt><dd id="result-kills">0</dd></div>
            <div><dt>작전 시간</dt><dd id="result-time">0초</dd></div>
          </dl>
          <button id="restart-button" class="primary-button compact" type="button">다시 도전</button>
          <button id="home-button" type="button">메인 화면</button>
        </div>
      </section>
    </div>
  </main>
`;

const stage = document.querySelector<HTMLElement>("#game-stage");
if (!stage) throw new Error("Game stage was not found.");

let game: Game;
const ui = new UIManager({
  play: () => void game.play(),
  pause: () => game.pause(),
  resume: () => game.resume(),
  restart: () => game.restart(),
  home: () => game.home(),
  toggleSound: () => game.toggleSound(),
  toggleLowPower: () => game.toggleLowPower(),
  toggleShake: () => game.toggleShake(),
});
game = new Game(stage, ui);
