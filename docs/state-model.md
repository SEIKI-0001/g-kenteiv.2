# 学習状態モデル

ローカルモックでは、ユーザの学習状態を `localStorage` に保存します。
本番実装では、この構造を認証ユーザ単位のDBまたはAPIに移します。

## 保存キー

`g-kentei-support-state-v1`

## 保存する状態

- `activeMode`: 今日の学習画面で選んでいる種別
- `focusDomain`: 今週優先する単元
- `activeSession`: いま進めている学習タスクID
- `completedMissionIds`: 完了済み学習タスクID
- `practiceCursor`: 単元別の出題位置
- `reviewResults`: 復習カードごとの結果
- `savedAt`: 保存日時

## 復習結果

`reviewResults` は復習カードIDをキーにします。

- `remembered`: 覚えていた。次回は7日後
- `vague`: 曖昧。次回は明日
- `forgot`: 忘れた。今日もう一度

## 本番実装で追加したい状態

- 問題ごとの回答履歴
- 単元別の正答率
- 日別の学習時間
- 試験日
- 連続学習日数
- 復習カードの次回表示日
- 学習タスクの実行ログ
