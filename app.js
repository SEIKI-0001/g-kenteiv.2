const state = {
  activeView: "dashboard",
  activeMode: "recall",
  completedMissions: new Set(["m1"]),
  focusDomain: "法律・倫理",
  answered: false,
};

const missions = [
  {
    id: "m1",
    type: "recall",
    icon: "R",
    title: "法律・倫理を検索練習で確認",
    detail: "AI事業者ガイドライン、個人情報、著作権を何も見ずに3分説明",
    reward: "Confidence +8",
    minutes: 8,
  },
  {
    id: "m2",
    type: "practice",
    icon: "P",
    title: "評価指標の選択問題を10問",
    detail: "適合率、再現率、F値の使い分けを即時フィードバック付きで演習",
    reward: "Mastery +6",
    minutes: 12,
  },
  {
    id: "m3",
    type: "explain",
    icon: "E",
    title: "Transformerを30秒で説明",
    detail: "Attention、事前学習、ファインチューニングを自分の言葉で要約",
    reward: "Explain badge",
    minutes: 5,
  },
  {
    id: "m4",
    type: "review",
    icon: "S",
    title: "3日前の誤答だけを再提示",
    detail: "忘却曲線に合わせて、曖昧なカードを短く再テスト",
    reward: "Retention +7",
    minutes: 7,
  },
];

const domains = [
  ["AI基礎", 82, "安定", "#0b746b"],
  ["機械学習", 57, "評価指標を補強", "#e96f4c"],
  ["深層学習", 64, "構造説明を練習", "#efb044"],
  ["法律・倫理", 48, "最優先", "#376fb4"],
  ["社会実装", 72, "事例を追加", "#725da8"],
  ["データ活用", 66, "前処理を復習", "#74b843"],
];

const reviews = [
  ["今日", "AIガバナンス", "ケース判断を1問"],
  ["明日", "F値", "誤答した選択肢を比較"],
  ["3日後", "Transformer", "説明カードを再チェック"],
  ["7日後", "過学習", "実例で判断"],
];

const principles = [
  ["近接目標", "大きな合格目標を、今日終えられる学習契約へ分解。"],
  ["即時フィードバック", "正誤だけでなく、なぜ間違えたかをその場で返す。"],
  ["有意味報酬", "単なるポイントよりも、単元理解と再現力に結び付くバッジを付与。"],
  ["復習間隔", "忘れ始めるタイミングで再提示し、短時間で定着を守る。"],
];

const rewards = [
  ["説明者", "深層学習を自分の言葉で説明できた証跡"],
  ["再現率ガード", "評価指標の使い分けを3回連続で正答"],
  ["倫理ケース耐性", "法律・倫理のケース問題で失点を減らした証跡"],
  ["リカバリー", "休息後24時間以内に学習へ戻った証跡"],
];

const challenges = [
  {
    question: "学習サービスのゲーミフィケーションで、最も避けたい設計はどれですか。",
    options: [
      "学習行動と報酬の意味を結び付ける",
      "復習タイミングを短いキューにする",
      "ログインだけで大量の報酬を与え、理解とは無関係にする",
      "小さな達成を進捗として可視化する",
    ],
    answer: 2,
    feedback:
      "報酬が学習成果と切り離されると、行動は増えても理解が進みにくくなります。このモックでは、報酬を再現力、説明力、復習完了に結び付けています。",
  },
  {
    question: "G検定対策で検索練習が有効な理由はどれですか。",
    options: [
      "資料を眺める時間だけを増やせるから",
      "何も見ずに思い出すことで、試験時に使える記憶を鍛えられるから",
      "問題演習を完全に省略できるから",
      "直近トピックを無視できるから",
    ],
    answer: 1,
    feedback:
      "検索練習は思い出す負荷をかける学習です。G検定のように範囲が広い試験では、眺める復習だけでなく、短い再現テストを混ぜる設計が効きます。",
  },
];

const app = document.querySelector("#app");
const pageTitle = document.querySelector("#page-title");
const dialog = document.querySelector("#practice-dialog");
const practiceContent = document.querySelector("#practice-content");

function completedRate() {
  return Math.round((state.completedMissions.size / missions.length) * 100);
}

function todayMinutes() {
  return [...state.completedMissions].reduce((total, id) => {
    const mission = missions.find((item) => item.id === id);
    return total + (mission?.minutes ?? 0);
  }, 0);
}

function render() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === state.activeView);
  });

  const titles = {
    dashboard: "今日の学習ループ",
    missions: "ミッション設計",
    review: "復習キュー",
    mastery: "マスタリーマップ",
    rewards: "リワード設計",
    coach: "コーチング",
  };
  pageTitle.textContent = titles[state.activeView];

  const views = {
    dashboard: renderDashboard,
    missions: renderMissions,
    review: renderReview,
    mastery: renderMastery,
    rewards: renderRewards,
    coach: renderCoach,
  };
  app.innerHTML = views[state.activeView]();
  bindEvents();
}

function renderDashboard() {
  const done = state.completedMissions.size;
  const rate = completedRate();
  return `
    <section class="stack">
      <article class="panel loop-panel">
        <div>
          <span class="eyebrow">Behavior Loop</span>
          <h2>学習が続く仕組みを、報酬ではなく上達感から設計する。</h2>
          <p>
            参考軸は学習サービスのゲーミフィケーションだけに限定。G検定の学習を、近接目標、即時フィードバック、
            復習間隔、意味あるバッジで回します。
          </p>
          <div class="inline-actions">
            <button class="primary-button" data-open-practice>クイック診断</button>
            <button class="secondary-button" data-jump="missions">今日のミッションへ</button>
          </div>
        </div>
        <figure class="loop-visual" aria-label="学習ゲーミフィケーションのループ">
          <img src="./assets/learning-loop.svg" alt="目標、行動、フィードバック、復習の学習ループ" />
        </figure>
      </article>

      <section class="progress-grid" aria-label="今日の進捗">
        <article class="panel stat">
          <span>ミッション完了</span>
          <strong>${done}/${missions.length}</strong>
          <em>${rate}% complete</em>
        </article>
        <article class="panel stat">
          <span>集中時間</span>
          <strong>${todayMinutes()}分</strong>
          <em>目標 28分</em>
        </article>
        <article class="panel stat">
          <span>自信スコア</span>
          <strong>68</strong>
          <em>法律・倫理 +4</em>
        </article>
        <article class="panel stat">
          <span>次の復習</span>
          <strong>今日</strong>
          <em>3カード</em>
        </article>
      </section>

      <section class="panel panel-pad">
        <div class="section-title">
          <div>
            <h2>今日のミッション</h2>
            <p>報酬は学習成果にひも付ける</p>
          </div>
          <span class="tag is-warm">${rate}%</span>
        </div>
        <div class="mission-list">
          ${missions.map(renderMission).join("")}
        </div>
      </section>

      <section class="panel panel-pad">
        <div class="section-title">
          <div>
            <h2>設計レンズ</h2>
            <p>学習サービスのゲーミフィケーションに限定した参考軸</p>
          </div>
        </div>
        <div class="principle-grid">
          ${principles.map(renderPrinciple).join("")}
        </div>
      </section>
    </section>

    <aside class="stack">
      <section class="panel panel-pad">
        <div class="section-title">
          <div>
            <h2>マスタリー</h2>
            <p>弱点を次の行動に変換</p>
          </div>
        </div>
        <div class="confidence">
          ${domains.slice(0, 5).map(renderConfidence).join("")}
        </div>
      </section>

      <section class="panel panel-pad">
        <div class="section-title">
          <div>
            <h2>復習キュー</h2>
            <p>忘れる前に短く戻す</p>
          </div>
        </div>
        <div class="review-list">
          ${reviews.slice(0, 3).map(renderReviewCard).join("")}
        </div>
      </section>
    </aside>
  `;
}

function renderMission(mission) {
  const done = state.completedMissions.has(mission.id);
  return `
    <article class="mission-card ${done ? "is-done" : ""}">
      <div class="mission-icon" aria-hidden="true">${done ? "✓" : mission.icon}</div>
      <div>
        <h3>${mission.title}</h3>
        <p>${mission.detail}</p>
        <div class="reward-row">
          <span class="tag">${mission.minutes}分</span>
          <span class="tag is-warm">${mission.reward}</span>
        </div>
      </div>
      <button class="mission-action" data-mission="${mission.id}">${done ? "戻す" : "完了"}</button>
    </article>
  `;
}

function renderPrinciple(item, index) {
  return `
    <article class="principle-card">
      <div class="principle-icon" aria-hidden="true">${index + 1}</div>
      <div>
        <h3>${item[0]}</h3>
        <p>${item[1]}</p>
      </div>
    </article>
  `;
}

function renderConfidence(item) {
  const color = item[3];
  return `
    <div class="confidence-row">
      <strong>${item[0]}</strong>
      <div class="progress-track" aria-label="${item[0]} ${item[1]}%">
        <span style="width:${item[1]}%; background:${color}"></span>
      </div>
      <span>${item[1]}</span>
    </div>
  `;
}

function renderReviewCard(item) {
  return `
    <article class="review-card">
      <div>
        <h3>${item[1]}</h3>
        <p>${item[2]}</p>
      </div>
      <div class="review-time">${item[0]}</div>
    </article>
  `;
}

function renderMissions() {
  const visible = missions.filter((mission) => state.activeMode === "all" || mission.type === state.activeMode);
  return `
    <section class="panel panel-pad view-wide">
      ${viewHeader("ミッション設計", "選べる行動を残しながら、今日やる量は小さく固定します。")}
      <div class="segment" aria-label="ミッション種別">
        ${[
          ["recall", "検索練習"],
          ["practice", "演習"],
          ["explain", "説明"],
          ["review", "復習"],
          ["all", "すべて"],
        ]
          .map(
            ([mode, label]) => `
              <button class="segment-button ${state.activeMode === mode ? "is-active" : ""}" data-mode="${mode}">${label}</button>
            `,
          )
          .join("")}
      </div>
      <div class="mission-list" style="margin-top: 14px">
        ${visible.map(renderMission).join("")}
      </div>
    </section>
  `;
}

function renderReview() {
  return `
    <section class="panel panel-pad view-wide">
      ${viewHeader("復習キュー", "ポイントは量ではなく、忘れ始めるタイミングに短く戻すこと。")}
      <div class="review-list">
        ${reviews.map(renderReviewCard).join("")}
      </div>
    </section>
  `;
}

function renderMastery() {
  return `
    <section class="panel panel-pad view-wide">
      ${viewHeader("マスタリーマップ", "スコアは順位ではなく、次の学習行動を決めるための信号として扱います。")}
      <div class="mastery-grid">
        ${domains
          .map(
            (domain) => `
              <article class="mastery-card">
                <div class="card-top">
                  <h3>${domain[0]}</h3>
                  <span class="tag ${domain[1] < 55 ? "is-alert" : ""}">${domain[1]}</span>
                </div>
                <p>${domain[2]}</p>
                <div class="progress-track">
                  <span style="width:${domain[1]}%; background:${domain[3]}"></span>
                </div>
                <button class="secondary-button" data-focus="${domain[0]}">集中領域にする</button>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderRewards() {
  return `
    <section class="panel panel-pad view-wide">
      ${viewHeader("リワード設計", "報酬は飾りではなく、身についた行動や理解の証跡として扱います。")}
      <div class="reward-grid">
        ${rewards
          .map(
            (reward, index) => `
              <article class="reward-card">
                <div class="reward-icon" aria-hidden="true">${index + 1}</div>
                <h3>${reward[0]}</h3>
                <p>${reward[1]}</p>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderCoach() {
  const steps = [
    ["今日の上限を決める", "28分以上に増やさず、完了体験を守る。"],
    ["最初に検索練習", "資料を見る前に思い出すことで、理解の穴を見つける。"],
    ["誤答を復習日へ送る", "間違えた直後だけで終わらせず、1日後と3日後に戻す。"],
    ["休息後の復帰を評価", "連続記録だけでなく、戻ってきた行動もリワード化する。"],
  ];
  return `
    <section class="panel panel-pad view-wide">
      ${viewHeader("コーチング", `現在の集中領域は「${state.focusDomain}」。学習量より、戻れるリズムを優先します。`)}
      <div class="coach-list">
        ${steps
          .map(
            (step, index) => `
              <article class="coach-step">
                <div class="coach-index">${index + 1}</div>
                <div>
                  <h3>${step[0]}</h3>
                  <p>${step[1]}</p>
                </div>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function viewHeader(title, copy) {
  return `
    <div class="view-header">
      <div>
        <span class="eyebrow">Learning Service Gamification</span>
        <h2>${title}</h2>
        <p>${copy}</p>
      </div>
      <button class="secondary-button" data-jump="dashboard">戻る</button>
    </div>
  `;
}

function bindEvents() {
  document.querySelectorAll("[data-mission]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.mission;
      if (state.completedMissions.has(id)) {
        state.completedMissions.delete(id);
      } else {
        state.completedMissions.add(id);
      }
      render();
    });
  });

  document.querySelectorAll("[data-jump]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeView = button.dataset.jump;
      render();
    });
  });

  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeMode = button.dataset.mode;
      render();
    });
  });

  document.querySelectorAll("[data-focus]").forEach((button) => {
    button.addEventListener("click", () => {
      state.focusDomain = button.dataset.focus;
      state.activeView = "coach";
      render();
    });
  });

  document.querySelectorAll("[data-open-practice]").forEach((button, index) => {
    button.addEventListener("click", () => openPractice(index % challenges.length));
  });
}

function openPractice(index = 0) {
  state.answered = false;
  const challenge = challenges[index];
  practiceContent.innerHTML = `
    <span class="eyebrow">Quick Feedback</span>
    <h2 style="margin: 6px 44px 0 0; line-height: 1.45">${challenge.question}</h2>
    <div class="answer-list">
      ${challenge.options
        .map(
          (option, optionIndex) => `
            <button class="answer-button" type="button" data-answer="${optionIndex}">
              <span class="answer-key">${String.fromCharCode(65 + optionIndex)}</span>
              <span>${option}</span>
            </button>
          `,
        )
        .join("")}
    </div>
    <div id="feedback-slot"></div>
  `;

  practiceContent.querySelectorAll("[data-answer]").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.answered) return;
      state.answered = true;
      const answer = Number(button.dataset.answer);
      practiceContent.querySelectorAll("[data-answer]").forEach((option) => {
        const optionAnswer = Number(option.dataset.answer);
        option.classList.toggle("is-correct", optionAnswer === challenge.answer);
        option.classList.toggle("is-wrong", optionAnswer === answer && answer !== challenge.answer);
      });
      document.querySelector("#feedback-slot").innerHTML = `<div class="feedback">${challenge.feedback}</div>`;
    });
  });

  dialog.showModal();
}

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    state.activeView = button.dataset.view;
    render();
  });
});

document.querySelector("#open-challenge").addEventListener("click", () => openPractice(1));

render();
