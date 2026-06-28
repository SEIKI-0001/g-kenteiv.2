# コンテンツモデル

`data/content.js` は、画面に表示する学習コンテンツをまとめたファイルです。
本番実装では、この構造をJSON、CMS、DB、APIレスポンスへ移す想定です。

## missions

今日の学習タスクです。

- `id`: 一意なID
- `type`: `recall`、`practice`、`explain`、`review`
- `label`: 画面に出す学習種別
- `domain`: 対象単元。`domains.name` と一致させる
- `title`: 学習カードの見出し
- `detail`: 学習内容
- `minutes`: 目安時間
- `outcome`: 完了後に得られる状態
- `reward`: 画面上の達成表示
- `reason`: なぜ今やるか
- `steps`: 学習の手順

## domains

G検定の弱点チェック単元です。

- `name`: 単元名
- `score`: 到達度
- `signal`: 画面に出す短い状態
- `reason`: 弱点理由
- `next`: 次の行動
- `color`: グラフ表示色
- `topics`: 確認トピック

## reviewQueue

復習カードです。

- `id`: 一意なID
- `due`: 表示タイミング
- `term`: 用語
- `domain`: 対象単元。`domains.name` と一致させる
- `prompt`: 復習時に答える問い
- `confidence`: 初期自信度
- `next`: 次に出す理由

## challenges

すぐ確認で出す選択問題です。

- `domain`: 対象単元または補助カテゴリ
- `question`: 問題文
- `options`: 選択肢
- `answer`: 正解選択肢の0始まりインデックス
- `feedback`: 回答後の説明

## 次に分離したいもの

- 試験日や1日の学習上限
- 単元スコアの算出ロジック
- 問題ごとの解説、難易度、出題頻度
- 模試セットと出題順
