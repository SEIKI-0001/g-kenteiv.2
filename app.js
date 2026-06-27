const state = {
  activeView: "home",
  completedQuests: new Set(["q0", "q2"]),
  activeDungeon: "weak",
  answered: false,
};

const quests = [
  {
    id: "q0",
    icon: "✓",
    title: "法律・倫理のデイリー探索",
    detail: "AI事業者ガイドライン、個人情報、著作権を15分で確認",
    xp: 180,
    coins: 60,
  },
  {
    id: "q1",
    icon: "⚔",
    title: "評価指標のコンボ演習",
    detail: "適合率、再現率、F値の選び分けを10問",
    xp: 260,
    coins: 90,
  },
  {
    id: "q2",
    icon: "◇",
    title: "Transformerカードを強化",
    detail: "Attention、事前学習、ファインチューニングをカード復習",
    xp: 140,
    coins: 40,
  },
  {
    id: "q3",
    icon: "◆",
    title: "ミニボス模試 25問",
    detail: "20分以内に正答率72%以上を狙う",
    xp: 420,
    coins: 160,
  },
];

const dungeons = {
  weak: [
    ["法律・倫理", 42, "ケース判断の取り違え"],
    ["機械学習", 56, "評価指標と過学習"],
    ["深層学習", 63, "モデル構造の整理"],
  ],
  streak: [
    ["用語スピード", 74, "朝7分で回収"],
    ["年表記憶", 68, "AIブームの変遷"],
    ["生成AI更新", 51, "LLMとRAGの整理"],
  ],
  boss: [
    ["横断50問", 69, "時間配分"],
    ["本番100問", 61, "長時間集中"],
    ["直前リカバリー", 77, "誤答だけ再戦"],
  ],
};

const achievements = [
  ["炎", "14日連続学習", "明日も達成でレアバッジへ進化"],
  ["盾", "法律・倫理を3日連続復習", "ケース問題の正答率 +8pt"],
  ["鍵", "弱点ダンジョンを2階層突破", "ボス模試の制限時間を解放"],
];

const cards = [
  ["SSR", "Attention", "文脈の重要部分へ重みを置く仕組み"],
  ["SR", "F値", "適合率と再現率の調和平均"],
  ["R", "MLOps", "モデル運用を継続的に改善する枠組み"],
  ["SR", "XAI", "AIの判断根拠を説明しやすくする考え方"],
  ["R", "過学習", "未知データへの汎化性能が下がる状態"],
  ["SSR", "AIガバナンス", "透明性、公平性、安全性を保つ管理体制"],
];

const challenges = [
  {
    question: "見逃しを最小化したい検査モデルで最も重視されやすい指標はどれですか。",
    options: ["再現率", "適合率", "訓練データの正解率", "クラスタ数"],
    answer: 0,
    loot: "正解で +180XP。再現率は実際の陽性をどれだけ拾えたかを示すため、見逃しの損失が大きい場面で重視されます。",
  },
  {
    question: "G検定の直前期に法律・倫理を毎日少しずつ回す狙いはどれですか。",
    options: ["数式暗記を増やす", "ケース判断と直近論点の失点を減らす", "実装問題に備える", "画像処理だけを固める"],
    answer: 1,
    loot: "正解で +160XP。法律・倫理は暗記だけでなく、状況を読んで判断する問題の落とし穴が出やすい領域です。",
  },
];

const app = document.querySelector("#app");
const pageTitle = document.querySelector("#page-title");
const dialog = document.querySelector("#challenge-dialog");
const challengeContent = document.querySelector("#challenge-content");

function completionRate() {
  return Math.round((state.completedQuests.size / quests.length) * 100);
}

function totalXp() {
  return [...state.completedQuests].reduce((sum, id) => {
    const quest = quests.find((item) => item.id === id);
    return sum + (quest?.xp ?? 0);
  }, 8420);
}

function render() {
  document.querySelectorAll(".nav-link").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === state.activeView);
  });

  const titles = {
    home: "今日の合格クエスト",
    quests: "デイリークエスト",
    dungeon: "弱点ダンジョン",
    boss: "ボス模試",
    cards: "カード図鑑",
    guild: "ギルド",
  };
  pageTitle.textContent = titles[state.activeView];

  const views = {
    home: renderHome,
    quests: renderQuests,
    dungeon: renderDungeon,
    boss: renderBoss,
    cards: renderCards,
    guild: renderGuild,
  };

  app.innerHTML = views[state.activeView]();
  bindEvents();
}

function renderHome() {
  const rate = completionRate();
  return `
    <section class="stack">
      <article class="panel hero">
        <div>
          <span class="label">Main Campaign</span>
          <h2>合格までの道のりを、毎日のクエストにする。</h2>
          <p>
            G検定の広いシラバスを、XP、バッジ、ダンジョン、ボス模試で進める学習体験に変換。
            今日は弱点を倒して、週末のボス模試へ進みます。
          </p>
          <div class="inline-actions">
            <button class="primary-button" data-open-challenge>チャレンジ開始</button>
            <button class="secondary-button" data-jump="dungeon">弱点ダンジョンへ</button>
          </div>
        </div>
        <figure class="hero-map" aria-label="合格クエストマップ">
          <img src="./assets/quest-map.svg" alt="G検定合格までのクエストマップ" />
        </figure>
      </article>

      <section class="metric-grid" aria-label="プレイヤーステータス">
        <article class="panel metric">
          <span>今日のクエスト</span>
          <strong>${state.completedQuests.size}/${quests.length}</strong>
          <em>${rate}% clear</em>
        </article>
        <article class="panel metric">
          <span>総XP</span>
          <strong>${totalXp().toLocaleString()}</strong>
          <em>Lv.18</em>
        </article>
        <article class="panel metric">
          <span>合格予測</span>
          <strong>72%</strong>
          <em>+5pt</em>
        </article>
        <article class="panel metric">
          <span>次のボス</span>
          <strong>6/29</strong>
          <em>50問</em>
        </article>
      </section>

      <section class="panel panel-pad">
        <div class="section-title">
          <div>
            <h2>デイリークエスト</h2>
            <p>完了するとXPとコインを獲得</p>
          </div>
          <span class="reward-pill">${rate}% CLEAR</span>
        </div>
        <div class="quest-list">
          ${quests.map(renderQuest).join("")}
        </div>
      </section>

      <section class="panel panel-pad">
        <div class="section-title">
          <div>
            <h2>合格ロード</h2>
            <p>ステージを突破して出題範囲を横断</p>
          </div>
        </div>
        <div class="level-path">
          ${["AI基礎", "機械学習", "深層学習", "法律倫理", "ボス模試"]
            .map((stage, index) => `<div class="level-node ${index < 2 ? "is-clear" : index === 2 ? "is-current" : ""}">${stage}</div>`)
            .join("")}
        </div>
      </section>
    </section>

    <aside class="stack">
      <section class="panel panel-pad">
        <div class="section-title">
          <div>
            <h2>弱点ダンジョン</h2>
            <p>低スコア領域を優先攻略</p>
          </div>
        </div>
        <div class="dungeon-list">
          ${dungeons.weak.map(renderDungeonRow).join("")}
        </div>
      </section>

      <section class="panel panel-pad">
        <div class="section-title">
          <div>
            <h2>実績バッジ</h2>
            <p>学習継続で解放</p>
          </div>
        </div>
        <div class="achievement-list">
          ${achievements.map(renderAchievement).join("")}
        </div>
      </section>
    </aside>
  `;
}

function renderQuest(quest) {
  const complete = state.completedQuests.has(quest.id);
  return `
    <article class="quest-card ${complete ? "is-complete" : ""}">
      <div class="quest-icon" aria-hidden="true">${complete ? "✓" : quest.icon}</div>
      <div>
        <h3>${quest.title}</h3>
        <p>${quest.detail}</p>
        <div class="reward-row">
          <span class="reward-pill">+${quest.xp} XP</span>
          <span class="reward-pill">+${quest.coins} coin</span>
        </div>
      </div>
      <button class="quest-action" data-quest="${quest.id}">${complete ? "戻す" : "達成"}</button>
    </article>
  `;
}

function renderDungeonRow(item) {
  const color = item[1] < 50 ? "var(--coral)" : item[1] < 65 ? "var(--orange)" : "var(--teal)";
  return `
    <div class="dungeon-row">
      <strong>${item[0]}</strong>
      <div class="progress-track" aria-label="${item[0]} ${item[1]}%">
        <span style="width:${item[1]}%; background:${color}"></span>
      </div>
      <span>${item[1]}</span>
    </div>
  `;
}

function renderAchievement(item) {
  return `
    <article class="achievement-item">
      <div class="badge-icon" aria-hidden="true">${item[0]}</div>
      <div>
        <h3>${item[1]}</h3>
        <p>${item[2]}</p>
      </div>
    </article>
  `;
}

function renderQuests() {
  return `
    <section class="panel panel-pad view-wide">
      ${viewHeader("デイリークエスト", "短時間の学習を、毎日達成できるミッション単位に分解します。")}
      <div class="quest-list">
        ${quests.map(renderQuest).join("")}
      </div>
    </section>
  `;
}

function renderDungeon() {
  return `
    <section class="panel panel-pad view-wide">
      ${viewHeader("弱点ダンジョン", "苦手単元を階層化し、低スコア領域から順番に攻略します。")}
      <div class="tab-list" aria-label="ダンジョン切り替え">
        <button class="tab-button ${state.activeDungeon === "weak" ? "is-active" : ""}" data-dungeon="weak">弱点</button>
        <button class="tab-button ${state.activeDungeon === "streak" ? "is-active" : ""}" data-dungeon="streak">継続</button>
        <button class="tab-button ${state.activeDungeon === "boss" ? "is-active" : ""}" data-dungeon="boss">模試</button>
      </div>
      <div class="dungeon-list" style="margin-top: 14px">
        ${dungeons[state.activeDungeon]
          .map(
            (item) => `
              <article class="dungeon-card">
                <div class="card-top">
                  <h3>${item[0]}</h3>
                  <span class="reward-pill">${item[1]}%</span>
                </div>
                <p>${item[2]}</p>
                ${renderDungeonRow(item)}
                <button class="primary-button" data-open-challenge>挑戦する</button>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderBoss() {
  const bosses = [
    ["ミニボス", "25問 / 20分", 68, "評価指標で被弾"],
    ["中ボス", "50問 / 45分", 72, "法律・倫理を再戦"],
    ["ラスボス", "100問 / 120分", 61, "集中ゲージ不足"],
  ];
  return `
    <section class="panel panel-pad view-wide">
      ${viewHeader("ボス模試", "本番形式の模試をボス戦として扱い、敗因を次のクエストへ戻します。")}
      <div class="boss-grid">
        ${bosses
          .map(
            (boss) => `
              <article class="boss-card">
                <span class="label">${boss[1]}</span>
                <h3>${boss[0]}</h3>
                <div class="boss-score"><strong>${boss[2]}</strong><span>%</span></div>
                <p>${boss[3]}</p>
                <button class="secondary-button" data-open-challenge>再戦準備</button>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderCards() {
  return `
    <section class="panel panel-pad view-wide">
      ${viewHeader("カード図鑑", "頻出用語をカード化し、正答や復習で強化します。")}
      <div class="card-grid">
        ${cards
          .map(
            (card) => `
              <article class="card-item">
                <div class="card-icon" aria-hidden="true">${card[0]}</div>
                <h3>${card[1]}</h3>
                <p>${card[2]}</p>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderGuild() {
  const members = [
    ["あなた", "Lv.18", "今週 +1,240XP"],
    ["AI基礎班", "Rank A", "平均正答率 78%"],
    ["法律倫理班", "Rank C", "今日の重点領域"],
  ];
  return `
    <section class="panel panel-pad view-wide">
      ${viewHeader("ギルド", "学習チームや比較表示のモック。個人学習でも進捗の手応えを出します。")}
      <div class="guild-list">
        ${members
          .map(
            (member) => `
              <article class="guild-item">
                <div class="card-top">
                  <h3>${member[0]}</h3>
                  <span class="reward-pill">${member[1]}</span>
                </div>
                <p>${member[2]}</p>
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
        <span class="label">Gamified Learning</span>
        <h2>${title}</h2>
        <p>${copy}</p>
      </div>
      <button class="secondary-button" data-jump="home">ホーム</button>
    </div>
  `;
}

function bindEvents() {
  document.querySelectorAll("[data-quest]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.quest;
      if (state.completedQuests.has(id)) {
        state.completedQuests.delete(id);
      } else {
        state.completedQuests.add(id);
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

  document.querySelectorAll("[data-dungeon]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeDungeon = button.dataset.dungeon;
      render();
    });
  });

  document.querySelectorAll("[data-open-challenge]").forEach((button, index) => {
    button.addEventListener("click", () => openChallenge(index % challenges.length));
  });
}

function openChallenge(index) {
  state.answered = false;
  const challenge = challenges[index];
  challengeContent.innerHTML = `
    <span class="label">Battle Question</span>
    <h2 style="margin: 6px 44px 0 0; line-height: 1.45">${challenge.question}</h2>
    <div class="challenge-options">
      ${challenge.options
        .map(
          (option, optionIndex) => `
            <button class="challenge-option" type="button" data-answer="${optionIndex}">
              <span class="answer-key">${String.fromCharCode(65 + optionIndex)}</span>
              <span>${option}</span>
            </button>
          `,
        )
        .join("")}
    </div>
    <div id="loot-slot"></div>
  `;

  challengeContent.querySelectorAll("[data-answer]").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.answered) return;
      state.answered = true;
      const answer = Number(button.dataset.answer);
      challengeContent.querySelectorAll("[data-answer]").forEach((option) => {
        const optionAnswer = Number(option.dataset.answer);
        option.classList.toggle("is-correct", optionAnswer === challenge.answer);
        option.classList.toggle("is-wrong", optionAnswer === answer && answer !== challenge.answer);
      });
      document.querySelector("#loot-slot").innerHTML = `<div class="loot-box">${challenge.loot}</div>`;
    });
  });

  dialog.showModal();
}

document.querySelectorAll(".nav-link").forEach((button) => {
  button.addEventListener("click", () => {
    state.activeView = button.dataset.view;
    render();
  });
});

render();
