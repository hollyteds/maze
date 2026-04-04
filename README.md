# 3D Maze Game

React + TypeScript + Three.js で実装した、一人称視点の 3D 迷路ゲームです。  
迷路を探索してチェックポイント（CP）を回収し、外周に開いた出口から脱出するとクリアです。

## 動作環境

- Node.js 22 LTS 以上（推奨）
- npm 9 以上（推奨）

補足:
- Node.js 23 系は一部依存パッケージで `EBADENGINE` 警告が出る場合があります。
- 警告を避ける場合は Node.js 22 系または 24 系を利用してください。

## セットアップ

```bash
npm install
```

## 開発

```bash
npm run dev
```

- Vite 開発サーバーを `http://localhost:8080` で起動します。

## ビルド

```bash
npm run build
```

- 本番用ファイルが `dist/` に出力されます。

## プレビュー

```bash
npm run preview
```

## 操作

### 非タッチデバイス（キーボード）

- `↑`: 前進
- `←`: 左回転
- `→`: 右回転
- `H`: ヘルプマップ表示切替
- `D`: ヘルプマップ表示中のみデバッグ開示切替（未訪問領域の表示）

### タッチデバイス

- キャンバスタップ: 前進
- キャンバス左右スワイプ: 回転
  - 左スワイプ: 右回転
  - 右スワイプ: 左回転
- 左下 `HELP`: 操作説明ポップアップ表示/非表示
- 右下 `MAP`: ヘルプマップ表示/非表示
- タッチデバイスではデバッグ開示操作（`D`）は無効

## タッチ表示モード

- タッチデバイスでは横向き時に常時全画面UIで表示
- 縦向き時は「横向きにしてプレイしてください」を表示し、ゲーム画面は非表示
- 全画面UIでは `TIME / GOAL / CHECKPOINT / CP STATUS` を画面最下部にオーバーレイ表示

## 現行仕様（要点）

- 迷路生成は DFS（深さ優先探索）。
- スタート位置はランダム（袋小路優先）。
- 初期向きは開始セルで壁がない方向（優先順 `N -> E -> S -> W`）。
- ゴールは右下固定ではなく、外周セルからランダム選択した「出口（`goalExit`）」。
- ゴールは行き止まり必須ではない。
- CP 未回収時は出口を試しても外へ出られず、警告テキストのみ表示。
- CP 全回収後は出口から迷路外へ移動し、クリア判定。
- 出口外側床は常時赤色。
- 出口両端の柱は常時赤色。
- 未解放時は出口に格子ゲートを表示して封鎖。
- 円柱マーカーは CP のみ表示（スタート/ゴールには表示しない）。

## ヘルプマップ表示仕様

- 通常は訪問済みセルのみ表示。
- スタートマーカーは表示しない。
- CP/ゴールの表示条件は `src/game/constants.ts` のモード定数で切替可能。
- 既定値は以下。
1. `HELP_MAP_CHECKPOINT_VISIBILITY_MODE = passed_only`（通過済み CP のみ表示）
2. `HELP_MAP_GOAL_VISIBILITY_MODE = passed_only`（出口セル通過後にゴール表示）

## 画面表示

- `TIME`: 経過時間
- `GOAL`: `ACTIVE`（解放）/ `LOCKED`（未解放）
- `CHECKPOINT`: 通過数 / 総数
- `CLEAR`: クリア時に表示
- `CP STATUS`: チェックポイントごとの到達状態（番号 + `✓`）
- `COMPASS`: 針（三角形）は固定で、方位リング側がイージング付きで回転

## 設定変更

主要な仕様値は `src/game/constants.ts` に集約しています。  
迷路サイズ、カメラ、色、ゲート、メッセージ、ヘルプ可視化モードをここで調整できます。

現行では一部の値を他定数から導出しており、関連値の同期ズレを防ぎます。

- `VIEWPORT_HEIGHT = VIEWPORT_WIDTH / 2`
- `TOUCH_*_Z_INDEX` は `TOUCH_STATUS_OVERLAY_Z_INDEX` 基準の段階式
- `WALL_PILLAR_TEXTURE_HEIGHT = WALL_PILLAR_TEXTURE_WIDTH * 16`
- `MARKER_HEIGHT = WORLD_WALL_HEIGHT * 0.3`
- コンパス三角形底辺位置は `COMPASS_POINTER_TRIANGLE_BASE_OFFSET_RATIO` で調整

## 実装メモ（可読性改善）

- ステータス表示（`TIME / GOAL / CHECKPOINT / CP STATUS`）は `src/components/GameStatusPanel.tsx` に集約。
- ビューポート追従処理は `src/hooks/useViewportSize.ts` に分離し、`MazeGame.tsx` の責務を整理。
- タッチ判定ロジックは `src/components/maze3d/touchGestureInterpreter.ts`（クラス）でカプセル化。
- `MazeGame.tsx` は表示モード分岐とレイアウト合成を主責務にし、重複したUI記述を削減。

## ドキュメント

- 詳細設計: `docs/maze-architecture.md`

## テスト

`package.json` に `test` スクリプトは未定義です。必要時は直接実行してください。

```bash
npx jest
```
