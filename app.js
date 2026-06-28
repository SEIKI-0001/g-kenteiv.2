const STORAGE_KEY = "g-kentei-support-state-v1";
const appConfig = window.__APP_CONFIG__ || {};
const supabaseClient = createSupabaseClient(appConfig);
const syncState = {
  user: null,
  hydrating: false,
  syncing: false,
  pending: false,
  timer: null,
  message: supabaseClient ? "ログインで同期" : "ローカル保存",
  lastSyncedAt: null,
};
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
const authPanel = document.querySelector("#auth-panel");
const authForm = document.querySelector("#auth-form");
const authEmail = document.querySelector("#auth-email");
const authPassword = document.querySelector("#auth-password");
const authLabel = document.querySelector("#auth-label");
const syncStatus = document.querySelector("#sync-status");
const authSignOut = document.querySelector("#auth-signout");

const CONFIDENCE_TO_DB = {
  低: "low",
  中: "medium",
  高: "high",
};

const REVIEW_OUTCOME_BY_LABEL = {
  覚えていた: "remembered",
  曖昧: "vague",
  忘れた: "forgot",
};

function createSupabaseClient(config) {
  const url = config.supabaseUrl || config.SUPABASE_URL;
  const anonKey = config.supabaseAnonKey || config.SUPABASE_ANON_KEY;

  if (!url || !anonKey || !window.supabase?.createClient) {
    return null;
  }

  return window.supabase.createClient(url, anonKey);
}

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
      activeView: savedState.activeView || initialState.activeView,
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

function saveUserState(options = {}) {
  const { sync = true } = options;

  try {
    const savedState = {
      activeView: state.activeView,
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

  if (sync) {
    queueCloudSync();
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

  resetCloudProgress();
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
  const allowedViews = new Set(["dashboard", "missions", "review", "mastery", "rewards", "coach"]);

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

  if (!allowedViews.has(state.activeView)) {
    state.activeView = "dashboard";
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

function updateAuthUI(message = syncState.message) {
  if (!authPanel) return;

  const isConfigured = Boolean(supabaseClient);
  syncState.message = message;
  authPanel.classList.toggle("is-disabled", !isConfigured);
  authForm.hidden = !isConfigured || Boolean(syncState.user);
  authSignOut.hidden = !isConfigured || !syncState.user;

  if (!isConfigured) {
    syncStatus.textContent = "ローカル保存";
    authLabel.textContent = "Supabase未設定";
    return;
  }

  if (syncState.user) {
    syncStatus.textContent = message;
    authLabel.textContent = syncState.user.email || "ログイン中";
    return;
  }

  syncStatus.textContent = message;
  authLabel.textContent = "進捗を同期";
}

async function initSupabaseSync() {
  updateAuthUI();

  if (!supabaseClient) return;

  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;

    syncState.user = data.session?.user || null;
    updateAuthUI(syncState.user ? "同期中" : "ログインで同期");

    if (syncState.user) {
      await loadCloudProgress();
    }

    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
      const nextUser = session?.user || null;
      const changedUser = nextUser?.id !== syncState.user?.id;
      syncState.user = nextUser;

      if (!nextUser) {
        updateAuthUI("ローカル保存");
        return;
      }

      updateAuthUI(changedUser ? "同期中" : "同期済み");
      if (changedUser) {
        await loadCloudProgress();
      }
    });
  } catch (error) {
    console.error("Supabase session error", error);
    updateAuthUI("同期を確認できません");
  }
}

async function handleAuthSubmit(event) {
  event.preventDefault();

  if (!supabaseClient) return;

  const email = authEmail.value.trim();
  const password = authPassword.value;

  if (!email || password.length < 6) {
    updateAuthUI("メールと6文字以上のパスワードを入力");
    return;
  }

  updateAuthUI("ログイン中");

  try {
    const signIn = await supabaseClient.auth.signInWithPassword({ email, password });

    if (signIn.error) {
      const signUp = await supabaseClient.auth.signUp({ email, password });
      if (signUp.error) throw signUp.error;

      syncState.user = signUp.data.session?.user || null;
      authPassword.value = "";

      if (syncState.user) {
        await loadCloudProgress();
      } else {
        updateAuthUI("確認メールを開いてください");
      }
      return;
    }

    syncState.user = signIn.data.user;
    authPassword.value = "";
    await loadCloudProgress();
  } catch (error) {
    console.error("Supabase auth error", error);
    updateAuthUI("ログインできませんでした");
  }
}

async function signOut() {
  if (!supabaseClient) return;

  await supabaseClient.auth.signOut();
  syncState.user = null;
  updateAuthUI("ローカル保存");
}

async function loadCloudProgress() {
  if (!supabaseClient || !syncState.user) return;

  syncState.hydrating = true;
  updateAuthUI("同期中");

  try {
    const userId = syncState.user.id;
    await ensureUserRows(userId);

    const [stateResponse, missionResponse, reviewResponse] = await Promise.all([
      supabaseClient.from("user_learning_state").select("*").eq("user_id", userId).maybeSingle(),
      supabaseClient.from("mission_progress").select("*").eq("user_id", userId),
      supabaseClient.from("review_card_progress").select("*").eq("user_id", userId),
    ]);

    const error = stateResponse.error || missionResponse.error || reviewResponse.error;
    if (error) throw error;

    const cloudState = stateResponse.data;
    const missionRows = missionResponse.data || [];
    const reviewRows = reviewResponse.data || [];

    if (hasMeaningfulCloudProgress(cloudState, missionRows, reviewRows)) {
      applyCloudProgress(cloudState, missionRows, reviewRows);
      saveUserState({ sync: false });
      render();
    }

    await syncUserStateToCloud({ silent: true });
    updateAuthUI("同期済み");
  } catch (error) {
    console.error("Supabase load error", error);
    updateAuthUI("同期に失敗しました");
  } finally {
    syncState.hydrating = false;
  }
}

async function ensureUserRows(userId) {
  const profileResponse = await supabaseClient.from("profiles").upsert({ id: userId }, { onConflict: "id" });
  if (profileResponse.error) throw profileResponse.error;

  const stateResponse = await supabaseClient
    .from("user_learning_state")
    .upsert({ user_id: userId }, { onConflict: "user_id" });
  if (stateResponse.error) throw stateResponse.error;
}

function hasMeaningfulCloudProgress(cloudState, missionRows, reviewRows) {
  const hasState =
    cloudState &&
    (cloudState.active_mode !== "all" ||
      cloudState.focus_domain !== "法律・倫理" ||
      cloudState.active_mission_id ||
      Object.keys(cloudState.practice_cursor || {}).length > 0);
  const hasMissionProgress = missionRows.some((row) => row.status === "completed" || row.status === "in_progress");
  const hasReviewProgress = reviewRows.some((row) => row.outcome);

  return Boolean(hasState || hasMissionProgress || hasReviewProgress);
}

function applyCloudProgress(cloudState, missionRows, reviewRows) {
  if (cloudState) {
    state.activeView = cloudState.active_view || state.activeView;
    state.activeMode = cloudState.active_mode || state.activeMode;
    state.focusDomain = cloudState.focus_domain || state.focusDomain;
    state.activeSession = cloudState.active_mission_id || null;
    state.practiceCursor = cloudState.practice_cursor || {};
  }

  if (missionRows.length) {
    state.completedMissions = new Set(
      missionRows.filter((row) => row.status === "completed").map((row) => row.mission_id),
    );
  }

  if (reviewRows.length) {
    state.reviewResults = reviewRows.reduce((results, row) => {
      const outcome = row.outcome;
      if (reviewOutcomes[outcome]) {
        results[row.review_card_id] = { ...reviewOutcomes[outcome], outcome };
      }
      return results;
    }, {});
  }

  normalizeUserState();
}

function queueCloudSync() {
  if (!supabaseClient || !syncState.user || syncState.hydrating) return;

  syncState.pending = true;
  updateAuthUI("同期待ち");
  window.clearTimeout(syncState.timer);
  syncState.timer = window.setTimeout(() => {
    syncUserStateToCloud();
  }, 650);
}

async function syncUserStateToCloud(options = {}) {
  const { silent = false } = options;

  if (!supabaseClient || !syncState.user) return;

  if (syncState.syncing) {
    syncState.pending = true;
    return;
  }

  syncState.syncing = true;
  syncState.pending = false;

  if (!silent) {
    updateAuthUI("同期中");
  }

  try {
    const userId = syncState.user.id;
    const now = new Date().toISOString();
    const missionRows = missions.map((mission) => {
      const done = state.completedMissions.has(mission.id);
      return {
        user_id: userId,
        mission_id: mission.id,
        domain: mission.domain,
        mission_type: mission.type,
        status: done ? "completed" : "not_started",
        started_at: done ? now : null,
        completed_at: done ? now : null,
        total_minutes: done ? mission.minutes : 0,
      };
    });
    const reviewRows = Object.entries(state.reviewResults)
      .map(([reviewId, result]) => {
        const review = reviewQueue.find((item) => item.id === reviewId);
        const outcome = getReviewOutcome(result);
        if (!review || !outcome) return null;

        return {
          user_id: userId,
          review_card_id: reviewId,
          domain: review.domain,
          outcome,
          confidence: CONFIDENCE_TO_DB[result.confidence] || null,
          next_due_on: nextDueDate(result.nextDue),
          answered_at: now,
          prompt_snapshot: review.prompt,
        };
      })
      .filter(Boolean);

    const stateResponse = await supabaseClient.from("user_learning_state").upsert(
      {
        user_id: userId,
        active_view: state.activeView,
        active_mode: state.activeMode,
        focus_domain: state.focusDomain,
        active_mission_id: state.activeSession,
        practice_cursor: state.practiceCursor,
        last_opened_at: now,
      },
      { onConflict: "user_id" },
    );
    if (stateResponse.error) throw stateResponse.error;

    const missionResponse = await supabaseClient
      .from("mission_progress")
      .upsert(missionRows, { onConflict: "user_id,mission_id" });
    if (missionResponse.error) throw missionResponse.error;

    if (reviewRows.length) {
      const reviewResponse = await supabaseClient
        .from("review_card_progress")
        .upsert(reviewRows, { onConflict: "user_id,review_card_id" });
      if (reviewResponse.error) throw reviewResponse.error;
    }

    syncState.lastSyncedAt = new Date();
    updateAuthUI("同期済み");
  } catch (error) {
    console.error("Supabase sync error", error);
    updateAuthUI("同期に失敗しました");
  } finally {
    const needsAnotherSync = syncState.pending;
    syncState.syncing = false;

    if (needsAnotherSync) {
      queueCloudSync();
    }
  }
}

async function resetCloudProgress() {
  if (!supabaseClient || !syncState.user) return;

  updateAuthUI("リセット中");

  try {
    const userId = syncState.user.id;
    const responses = await Promise.all([
      supabaseClient.from("mission_progress").delete().eq("user_id", userId),
      supabaseClient.from("review_card_progress").delete().eq("user_id", userId),
      supabaseClient.from("challenge_attempts").delete().eq("user_id", userId),
      supabaseClient.from("domain_progress").delete().eq("user_id", userId),
      supabaseClient.from("study_sessions").delete().eq("user_id", userId),
      supabaseClient.from("daily_study_stats").delete().eq("user_id", userId),
      supabaseClient.from("user_learning_state").upsert(
        {
          user_id: userId,
          active_view: "dashboard",
          active_mode: "all",
          focus_domain: "法律・倫理",
          active_mission_id: null,
          practice_cursor: {},
          last_opened_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      ),
    ]);
    const error = responses.find((response) => response.error)?.error;
    if (error) throw error;

    updateAuthUI("リセット済み");
  } catch (error) {
    console.error("Supabase reset error", error);
    updateAuthUI("リセットに失敗しました");
  }
}

function getReviewOutcome(result) {
  return result?.outcome || REVIEW_OUTCOME_BY_LABEL[result?.label] || null;
}

function nextDueDate(label) {
  const offsets = {
    今日: 0,
    "今日もう一度": 0,
    明日: 1,
    "3日後": 3,
    "7日後": 7,
  };
  const days = offsets[label] ?? 1;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function getChallengeId(challenge) {
  const index = challenges.indexOf(challenge);
  return challenge.id || `challenge-${index + 1}`;
}

async function recordChallengeAttempt(challenge, selectedAnswer) {
  if (!supabaseClient || !syncState.user) return;

  try {
    const response = await supabaseClient.from("challenge_attempts").insert({
      user_id: syncState.user.id,
      challenge_id: getChallengeId(challenge),
      domain: challenge.domain,
      question_snapshot: challenge.question,
      selected_answer_index: selectedAnswer,
      correct_answer_index: challenge.answer,
      feedback_snapshot: challenge.feedback,
    });

    if (response.error) throw response.error;
  } catch (error) {
    console.error("Supabase challenge attempt error", error);
    updateAuthUI("回答保存に失敗しました");
  }
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
  updateAuthUI();
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
      state.reviewResults[id] = { ...reviewOutcomes[outcome], outcome };
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
      recordChallengeAttempt(challenge, answer);
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
authForm.addEventListener("submit", handleAuthSubmit);
authSignOut.addEventListener("click", signOut);

render();
initSupabaseSync();
