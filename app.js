const STORAGE_KEY = "g-kentei-support-state-v1";
const state = loadUserState();

const content = window.gKenteiContent;

if (!content) {
  throw new Error("G検定 合格ナビのコンテンツが読み込まれていません。");
}

const {
  missions,
  domains,
  reviewQueue,
  reviewOutcomes,
  mistakes,
  badges,
  weekPlan,
  challenges,
} = content;

validateContent(content);
normalizeUserState();
saveUserState();

const app = document.querySelector("#app");
const pageTitle = document.querySelector("#page-title");
const dialog = document.querySelector("#practice-dialog");
const practiceContent = document.querySelector("#practice-content");

function createInitialState() {
  return {
    activeView: "dashboard",
    activeMode: "all",
    completedMissions: new Set(["m1"]),
    focusDomain: "法律・倫理",
    activeSession: null,
    practiceCursor: {},
    reviewResults: {},
    answered: false,
  };
}

function loadUserState() {
  const initialState = createInitialState();

  try {
    const rawState = localStorage.getItem(STORAGE_KEY);
    if (!rawState) return initialState;

    const savedState = JSON.parse(rawState);
    return {
      ...initialState,
      activeMode: savedState.activeMode || initialState.activeMode,
      focusDomain: savedState.focusDomain || initialState.focusDomain,
      activeSession: savedState.activeSession || null,
      completedMissions: new Set(savedState.completedMissionIds || [...initialState.completedMissions]),
      practiceCursor: savedState.practiceCursor || {},
      reviewResults: savedState.reviewResults || {},
    };
  } catch {
    return initialState;
  }
}

function saveUserState() {
  try {
    const savedState = {
      activeMode: state.activeMode,
      focusDomain: state.focusDomain,
      activeSession: state.activeSession,
      completedMissionIds: [...state.completedMissions],
      practiceCursor: state.practiceCursor,
      reviewResults: state.reviewResults,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedState));
  } catch {
    // 保存できない環境でも、画面操作自体は続けられるようにする。
  }
}

function resetUserState() {
  const initialState = createInitialState();
  state.activeView = initialState.activeView;
  state.activeMode = initialState.activeMode;
  state.completedMissions = initialState.completedMissions;
  state.focusDomain = initialState.focusDomain;
  state.activeSession = initialState.activeSession;
  state.practiceCursor = initialState.practiceCursor;
  state.reviewResults = initialState.reviewResults;
  state.answered = initialState.answered;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 保存先が使えない場合も、画面上の状態は初期化する。
  }

  render();
}

function validateContent(source) {
  const requiredCollections = ["missions", "domains", "reviewQueue", "mistakes", "badges", "weekPlan", "challenges"];
  const missingCollections = requiredCollections.filter((key) => !Array.isArray(source[key]) || source[key].length === 0);

  if (missingCollections.length) {
    throw new Error(`必要なコンテンツが不足しています: ${missingCollections.join(", ")}`);
  }

  const missionIds = new Set();
  const duplicatedMission = source.missions.find((mission) => {
    if (missionIds.has(mission.id)) return true;
    missionIds.add(mission.id);
    return false;
  });

  if (duplicatedMission) {
    throw new Error(`学習タスクIDが重複しています: ${duplicatedMission.id}`);
  }

  const domainNames = new Set(source.domains.map((domain) => domain.name));
  const unknownMissionDomain = source.missions.find((mission) => !domainNames.has(mission.domain));
  const unknownReviewDomain = source.reviewQueue.find((review) => !domainNames.has(review.domain));

  if (unknownMissionDomain || unknownReviewDomain) {
    throw new Error("学習タスクまたは復習カードに、未定義の単元が指定されています。");
  }
}

function normalizeUserState() {
  const missionIds = new Set(missions.map((mission) => mission.id));
  const reviewIds = new Set(reviewQueue.map((review) => review.id));
  const domainNames = new Set(domains.map((domain) => domain.name));
  const allowedModes = new Set(["all", "recall", "practice", "explain", "review"]);

  state.completedMissions = new Set([...state.completedMissions].filter((id) => missionIds.has(id)));
  state.reviewResults = Object.fromEntries(Object.entries(state.reviewResults).filter(([id]) => reviewIds.has(id)));

  if (state.activeSession && !missionIds.has(state.activeSession)) {
    state.activeSession = null;
  }

  if (!domainNames.has(state.focusDomain)) {
    state.focusDomain = domains[0].name;
  }

  if (!allowedModes.has(state.activeMode)) {
    state.activeMode = "all";
  }
}

function getMission(id) {
  return missions.find((mission) => mission.id === id);
}

function nextMission() {
  return missions.find((mission) => !state.completedMissions.has(mission.id)) || missions[0];
}

function completedRate() {
  return Math.round((state.completedMissions.size / missions.length) * 100);
}

function todayMinutes() {
  return [...state.completedMissions].reduce((total, id) => total + (getMission(id)?.minutes ?? 0), 0);
}

function getFocusDomain() {
  return domains.find((domain) => domain.name === state.focusDomain) || domains.find((domain) => domain.score < 55) || domains[0];
}

function readinessScore() {
  return Math.round(domains.reduce((total, domain) => total + domain.score, 0) / domains.length);
}

function dueTodayCount() {
  return reviewQueue.filter((review) => review.due === "今日").length;
}

function getChallenge(domain, fallbackIndex = 0) {
  const pool = challenges.filter((challenge) => challenge.domain === domain);
  const key = pool.length ? domain : "all";
  const source = pool.length ? pool : challenges;
  const cursor = state.practiceCursor[key] ?? fallbackIndex;
  state.practiceCursor[key] = cursor + 1;
  saveUserState();
  return source[cursor % source.length];
}

function render() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === state.activeView);
  });

  const titles = {
    dashboard: "ホーム",
    missions: "今日の学習",
    review: "復習",
    mastery: "弱点チェック",
    rewards: "バッジ",
    coach: "学習計画",
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
  const mission = state.activeSession ? getMission(state.activeSession) : nextMission();
  const rate = completedRate();
  const focus = getFocusDomain();
  const readiness = readinessScore();
  const todayDue = dueTodayCount();
  return `
    <section class="stack">
      <article class="panel hero-panel">
        <div class="hero-copy">
          <span class="eyebrow">今日のおすすめ</span>
          <h2>次の28分で、${focus.name}の失点を減らす。</h2>
          <p>
            今日の中心は、何も見ずに思い出す練習と短い復習です。長く勉強するより、思い出す、答える、戻す流れを切らさないことを優先します。
          </p>
          <div class="focus-strip">
            <div>
              <span>次の行動</span>
              <strong>${mission.title}</strong>
            </div>
            <div>
              <span>目安</span>
              <strong>${mission.minutes}分</strong>
            </div>
            <div>
              <span>終わった後</span>
              <strong>${mission.reward}</strong>
            </div>
          </div>
          <div class="inline-actions">
            <button class="primary-button" data-start-mission="${mission.id}">この学習を始める</button>
            <button class="secondary-button" data-open-practice="${focus.name}">1問だけ確認</button>
          </div>
        </div>
        <figure class="loop-visual" aria-label="今日の学習の流れ">
          <img src="./assets/learning-loop.svg" alt="今日の学習は、目標確認、問題演習、振り返り、復習の順に進みます" />
        </figure>
      </article>

      <section class="progress-grid" aria-label="今日の進捗">
        <article class="panel stat">
          <span>今日の完了</span>
          <strong>${state.completedMissions.size}/${missions.length}</strong>
          <em>${rate}% 完了</em>
        </article>
        <article class="panel stat">
          <span>集中時間</span>
          <strong>${todayMinutes()}分</strong>
          <em>上限 28分</em>
        </article>
        <article class="panel stat">
          <span>合格準備度</span>
          <strong>${readiness}%</strong>
          <em>前回比 +4pt</em>
        </article>
        <article class="panel stat">
          <span>次の復習</span>
          <strong>${todayDue}枚</strong>
          <em>今日中</em>
        </article>
      </section>

      <section class="panel panel-pad session-panel">
        <div class="section-title">
          <div>
            <h2>${state.activeSession ? "いま進めている学習" : "次にやること"}</h2>
            <p>${mission.reason}</p>
          </div>
          <span class="tag is-warm">${mission.label}</span>
        </div>
        ${renderSession(mission)}
      </section>

      <section class="panel panel-pad">
        <div class="section-title">
          <div>
            <h2>今日のプラン</h2>
            <p>短い単位で終えられる順番に並べています</p>
          </div>
          <button class="secondary-button" data-jump="missions">すべて見る</button>
        </div>
        <div class="mission-list">
          ${missions.slice(0, 6).map(renderMissionCompact).join("")}
        </div>
      </section>
    </section>

    <aside class="stack">
      <section class="panel panel-pad">
        <div class="section-title">
          <div>
            <h2>なぜここが弱い？</h2>
            <p>スコアではなく次の行動を見る</p>
          </div>
        </div>
        <div class="risk-card">
          <div class="risk-score">${focus.score}</div>
          <div>
            <h3>${focus.name}</h3>
            <p>${focus.reason}。${focus.next}。</p>
          </div>
        </div>
        <div class="confidence">
          ${domains.slice(0, 6).map(renderConfidence).join("")}
        </div>
      </section>

      <section class="panel panel-pad">
        <div class="section-title">
          <div>
            <h2>今日戻すカード</h2>
            <p>忘れる前に短く戻す</p>
          </div>
        </div>
        <div class="review-list">
          ${reviewQueue.slice(0, 5).map(renderReviewCard).join("")}
        </div>
      </section>

      <section class="panel panel-pad">
        <div class="section-title">
          <div>
            <h2>最近のつまずき</h2>
            <p>次にもう一度出す理由</p>
          </div>
        </div>
        <div class="mistake-list">
          ${mistakes.map(renderMistake).join("")}
        </div>
      </section>
    </aside>
  `;
}

function renderSession(mission) {
  return `
    <div class="session-layout">
      <div class="session-main">
        <h3>${mission.title}</h3>
        <p>${mission.detail}</p>
        <div class="step-list">
          ${mission.steps.map((step, index) => `<div class="step-item"><span>${index + 1}</span>${step}</div>`).join("")}
        </div>
      </div>
      <aside class="session-side">
        <div class="session-timer">${mission.minutes}:00</div>
        <span class="small-text">完了後: ${mission.outcome}</span>
        <button class="primary-button" data-open-practice="${mission.domain}">練習問題へ</button>
        <button class="secondary-button" data-mission="${mission.id}">${state.completedMissions.has(mission.id) ? "完了を戻す" : "完了にする"}</button>
      </aside>
    </div>
  `;
}

function renderMissionCompact(mission) {
  const done = state.completedMissions.has(mission.id);
  return `
    <article class="mission-card ${done ? "is-done" : ""}">
      <div class="mission-icon" aria-hidden="true">${done ? "✓" : mission.icon}</div>
      <div>
        <div class="card-top">
          <h3>${mission.title}</h3>
          <span class="tag">${mission.minutes}分</span>
        </div>
        <p>${mission.detail}</p>
        <div class="reward-row">
          <span class="tag is-warm">${mission.reward}</span>
          <span class="tag">${mission.label}</span>
          <span class="tag">${mission.domain}</span>
        </div>
      </div>
      <button class="mission-action" data-start-mission="${mission.id}">${done ? "再開" : "開始"}</button>
    </article>
  `;
}

function renderMissionDetailed(mission) {
  const done = state.completedMissions.has(mission.id);
  return `
    <article class="mission-detail ${done ? "is-done" : ""}">
      <div class="mission-detail-head">
        <div class="mission-icon" aria-hidden="true">${done ? "✓" : mission.icon}</div>
        <div>
          <span class="eyebrow">${mission.label}</span>
          <h3>${mission.title}</h3>
          <p>${mission.detail}</p>
        </div>
      </div>
      <div class="step-list">
        ${mission.steps.map((step, index) => `<div class="step-item"><span>${index + 1}</span>${step}</div>`).join("")}
      </div>
      <div class="mission-footer">
        <span class="tag">${mission.minutes}分</span>
        <span class="tag is-warm">${mission.reward}</span>
        <span class="tag">${mission.domain}</span>
        <button class="secondary-button" data-start-mission="${mission.id}">セッションを開く</button>
        <button class="mission-action" data-mission="${mission.id}">${done ? "戻す" : "完了"}</button>
      </div>
    </article>
  `;
}

function renderConfidence(domain) {
  const color = domain.color || domain[3];
  const name = domain.name || domain[0];
  const score = domain.score || domain[1];
  return `
    <div class="confidence-row">
      <strong>${name}</strong>
      <div class="progress-track" aria-label="${name} ${score}%">
        <span style="width:${score}%; background:${color}"></span>
      </div>
      <span>${score}</span>
    </div>
  `;
}

function renderReviewCard(review) {
  const result = state.reviewResults[review.id];
  return `
    <article class="review-card">
      <div>
        <div class="card-top">
          <h3>${review.term}</h3>
          <span class="tag ${result?.confidence === "低" || review.confidence === "低" ? "is-alert" : ""}">
            ${result ? result.label : `自信 ${review.confidence}`}
          </span>
        </div>
        <p>${review.prompt}</p>
        <span class="small-text">${review.domain} / ${result ? `次回: ${result.nextDue}` : review.next}</span>
      </div>
      <div class="review-time">${review.due}</div>
    </article>
  `;
}

function renderMistake(item) {
  return `
    <article class="mistake-item">
      <span class="tag is-alert">${item[0]}</span>
      <div>
        <strong>${item[1]}</strong>
        <p>${item[2]}</p>
      </div>
    </article>
  `;
}

function renderMissions() {
  const visible = missions.filter((mission) => state.activeMode === "all" || mission.type === state.activeMode);
  return `
    <section class="panel panel-pad view-wide">
      ${viewHeader("今日の学習", "残り時間と弱点に合わせて、今日やる分だけを並べています。")}
      <div class="segment" aria-label="学習の種類">
        ${[
          ["all", "すべて"],
          ["recall", "思い出し練習"],
          ["practice", "演習"],
          ["explain", "説明"],
          ["review", "復習"],
        ]
          .map(
            ([mode, label]) => `
              <button class="segment-button ${state.activeMode === mode ? "is-active" : ""}" data-mode="${mode}">${label}</button>
            `,
          )
          .join("")}
      </div>
      <div class="mission-detail-grid" style="margin-top: 14px">
        ${visible.map(renderMissionDetailed).join("")}
      </div>
    </section>
  `;
}

function renderReview() {
  return `
    <section class="panel panel-pad view-wide">
      ${viewHeader("復習", "覚えているかどうかを選ぶだけで、次に出す日が変わります。")}
      <div class="review-board">
        ${reviewQueue.map(renderReviewDetailed).join("")}
      </div>
    </section>
  `;
}

function renderReviewDetailed(review, index) {
  const result = state.reviewResults[review.id];
  return `
    <article class="review-detail">
      <div class="review-time">${review.due}</div>
      <div>
        <span class="eyebrow">${review.domain}</span>
        <h3>${review.term}</h3>
        <p>${review.prompt}</p>
        <span class="small-text">次の出し方: ${result ? `次回は${result.nextDue}` : review.next}</span>
        ${result ? `<div class="review-result"><strong>${result.label}</strong><span>${result.message}</span></div>` : ""}
        <div class="confidence-buttons">
          <button class="secondary-button" data-review-id="${review.id}" data-review-outcome="remembered">覚えていた</button>
          <button class="secondary-button" data-review-id="${review.id}" data-review-outcome="vague">曖昧</button>
          <button class="secondary-button" data-review-id="${review.id}" data-review-outcome="forgot">忘れた</button>
          <button class="secondary-button" data-open-practice="${review.domain}">1問確認</button>
        </div>
      </div>
      <span class="tag ${result?.confidence === "低" || review.confidence === "低" ? "is-alert" : "is-warm"}">
        ${result ? `次回 ${result.nextDue}` : `自信 ${review.confidence}`}
      </span>
    </article>
  `;
}

function renderMastery() {
  return `
    <section class="panel panel-pad view-wide">
      ${viewHeader("弱点チェック", "G検定の試験範囲に沿って、どこで点を落としそうかを確認します。")}
      <div class="mastery-grid">
        ${domains.map(renderDomainCard).join("")}
      </div>
    </section>
  `;
}

function renderDomainCard(domain) {
  return `
    <article class="mastery-card">
      <div class="card-top">
        <h3>${domain.name}</h3>
        <span class="tag ${domain.score < 55 ? "is-alert" : ""}">${domain.score}</span>
      </div>
      <p>${domain.signal}</p>
      <div class="progress-track">
        <span style="width:${domain.score}%; background:${domain.color}"></span>
      </div>
      <div class="reason-box">
        <strong>弱点理由</strong>
        <p>${domain.reason}</p>
      </div>
      <div class="reason-box">
        <strong>次の行動</strong>
        <p>${domain.next}</p>
      </div>
      <div class="topic-list" aria-label="${domain.name}の確認トピック">
        ${domain.topics.map((topic) => `<span>${topic}</span>`).join("")}
      </div>
      <button class="secondary-button" data-focus="${domain.name}">今週ここを優先</button>
    </article>
  `;
}

function renderRewards() {
  return `
    <section class="panel panel-pad view-wide">
      ${viewHeader("バッジ", "できるようになったことを残します。集めることより、次の自信につなげるための記録です。")}
      <div class="reward-grid">
        ${badges.map(renderBadge).join("")}
      </div>
    </section>
  `;
}

function renderBadge(badge, index) {
  return `
    <article class="reward-card">
      <div class="card-top">
        <div class="reward-icon" aria-hidden="true">${index + 1}</div>
        <span class="tag ${badge.progress === 100 ? "is-warm" : ""}">${badge.status}</span>
      </div>
      <h3>${badge.title}</h3>
      <p>${badge.detail}</p>
      <div class="progress-track">
        <span style="width:${badge.progress}%"></span>
      </div>
    </article>
  `;
}

function renderCoach() {
  const focus = domains.find((domain) => domain.name === state.focusDomain) || domains[3];
  return `
    <section class="panel panel-pad view-wide">
      ${viewHeader("学習計画", `今週は「${focus.name}」を優先。今日は増やすより、戻れるリズムを守ります。`)}
      <div class="coach-layout">
        <div class="coach-list">
          ${[
            ["今日の上限", "28分で止める。完了体験を残して明日に接続。"],
            ["最初の行動", focus.next],
            ["復習の扱い", "誤答は今日中に理解しきろうとせず、明日と3日後に再提示。"],
            ["休息日の扱い", "休んだ翌日に8分戻れたら、連続記録と同じ重みで評価。"],
          ]
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
        <aside class="week-panel">
          <h3>今週のリズム</h3>
          <div class="week-grid">
            ${weekPlan.map(renderWeekDay).join("")}
          </div>
        </aside>
      </div>
    </section>
  `;
}

function renderWeekDay(day) {
  return `
    <div class="week-day ${day[2] === 0 ? "is-empty" : ""}">
      <strong>${day[0]}</strong>
      <span>${day[1]}</span>
      <em>${day[2] ? `${day[2]}分` : "未実施"}</em>
    </div>
  `;
}

function viewHeader(title, copy) {
  return `
    <div class="view-header">
      <div>
        <span class="eyebrow">G検定 合格ナビ</span>
        <h2>${title}</h2>
        <p>${copy}</p>
      </div>
      <button class="secondary-button" data-jump="dashboard">ホームへ</button>
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
      saveUserState();
      render();
    });
  });

  document.querySelectorAll("[data-start-mission]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeSession = button.dataset.startMission;
      state.activeView = "dashboard";
      saveUserState();
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
      saveUserState();
      render();
    });
  });

  document.querySelectorAll("[data-focus]").forEach((button) => {
    button.addEventListener("click", () => {
      state.focusDomain = button.dataset.focus;
      state.activeView = "coach";
      saveUserState();
      render();
    });
  });

  document.querySelectorAll("[data-review-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.reviewId;
      const outcome = button.dataset.reviewOutcome;
      state.reviewResults[id] = reviewOutcomes[outcome];
      saveUserState();
      render();
    });
  });

  document.querySelectorAll("[data-open-practice]").forEach((button, index) => {
    button.addEventListener("click", () => openPractice(button.dataset.openPractice, index));
  });
}

function openPractice(domain, fallbackIndex = 0) {
  state.answered = false;
  const challenge = getChallenge(domain, fallbackIndex);
  practiceContent.innerHTML = `
    <span class="eyebrow">すぐ確認 / ${challenge.domain}</span>
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

document.querySelector("#open-challenge").addEventListener("click", () => openPractice(getFocusDomain().name));
document.querySelector("#reset-progress").addEventListener("click", () => {
  if (window.confirm("保存した学習進捗をリセットしますか。")) {
    resetUserState();
  }
});

render();
