# 3Dワイヤーフレーム迷路ゲーム アーキテクチャ

この文書は、現行実装（責務分割後）を対象に、構成と処理フローを整理したものです。

対象ファイル:
- `src/MazeGame.tsx`
- `src/hooks/useMazeGameController.ts`
- `src/components/MazeView3D.tsx`
- `src/components/HelpMap.tsx`
- `src/components/CompassOverlay.tsx`
- `src/game/WireframeProjection.ts`
- `src/game/checkpointUtils.ts`
- `src/game/playerActions.ts`
- `src/game/constants.ts`
- `src/mazeUtils.ts`

## 構成概要（責務分割）

| レイヤ | 主ファイル | 役割 |
|---|---|---|
| 画面構成 | `src/MazeGame.tsx` | コンポーネント配置、表示制御 |
| 状態/入力 | `src/hooks/useMazeGameController.ts` | キー入力、タイマー、チェックポイント通過管理、ゴール判定、リトライ |
| 3D投影ロジック | `src/game/WireframeProjection.ts` | 疑似透視の線・面・マーカー生成 |
| チェックポイント生成 | `src/game/checkpointUtils.ts` | チェックポイント数算出とランダム配置 |
| 描画コンポーネント | `src/components/MazeView3D.tsx` ほか | 受け取ったデータをSVGとして描画 |
| プレイヤー移動ロジック | `src/game/playerActions.ts` | 回転・前進判定 |
| 共通定数 | `src/game/constants.ts` | 迷路サイズ、S/G座標、方角ラベル、ゴール配色、デバッグ設定 |
| 迷路生成 | `src/mazeUtils.ts` | DFSベースの迷路生成、初期プレイヤー状態 |

## 全体フロー

```mermaid
flowchart TD
  A[アプリ起動] --> B[MazeGame描画]
  B --> C[useMazeGameController初期化]
  C --> D[generateMazeで迷路生成]
  C --> D2[generateCheckpointsでチェックポイント生成]
  C --> E[getInitialPlayerStateで初期位置設定]
  B --> F[MazeView3D描画]
  B --> G[CompassOverlay描画]
  B --> H[HelpMap表示判定]

  C --> I[keydown監視]
  I --> J{キー種別}
  J -->|ArrowUp| K[moveForward]
  J -->|ArrowLeft/ArrowRight| L[rotate]
  J -->|H| M[ヘルプ表示切替]
  K --> N[player更新]
  L --> N
  N --> O[チェックポイント通過判定]
  O --> P[passedCheckpointKeys更新]
  P --> Q{goalActiveか}
  Q -->|No| I
  Q -->|Yes| R[GOAL到達判定]
  R -->|Yes| S[finished=true]
  R -->|No| I
  C --> U[50ms間隔でelapsed更新]
  S --> T[タイマー停止]
```

## 3D描画フロー（`WireframeProjectionBuilder`）

```mermaid
flowchart TD
  A[depth=0..2を走査] --> B[getRelativeCellで正面セル取得]
  B --> C{範囲外か}
  C -->|Yes| D[drawFrontWallして終了]
  C -->|No| E[S/G/Cマーカー判定]
  E --> F[front/left/right壁状態を判定]
  F --> G[左右側面と側面先正面壁を必要分描画]
  G --> H{frontClosedか}
  H -->|Yes| I[必要なら奥側の側面先正面壁を探索描画]
  I --> J[drawFrontWallして終了]
  H -->|No| K[次depthへ]
```

## 定数一覧

## `src/game/constants.ts`

| 定数 | 値 | 意味 |
|---|---:|---|
| `MAZE_WIDTH` | `15` | 迷路の横マス数 |
| `MAZE_HEIGHT` | `15` | 迷路の縦マス数 |
| `START` | `{x: 0, y: 0}` | スタート座標 |
| `GOAL` | `{x: MAZE_WIDTH - 1, y: MAZE_HEIGHT - 1}` | ゴール座標 |
| `DIRECTION_LABEL` | `N/E/S/W -> 北/東/南/西` | UI表示用の方角ラベル |
| `GOAL_ACTIVE_COLOR` | `#ff5c5c` | ゴール有効時の強調色 |
| `GOAL_INACTIVE_COLOR` | `#9a9a9a` | ゴール無効時の無彩色 |
| `GOAL_ACTIVE_FLOOR_COLOR` | `rgba(255, 92, 92, 0.24)` | ゴール有効時の床ハイライト色 |
| `GOAL_INACTIVE_FLOOR_COLOR` | `rgba(154, 154, 154, 0.24)` | ゴール無効時の床ハイライト色 |
| `GOAL_PROMPT_TEXT_COLOR` | `#cbffd9` | 上部ガイドテキスト色 |
| `ENABLE_WALL_DEBUG_LOG` | `false` | 壁判定デバッグログの有効フラグ |

## `src/game/checkpointUtils.ts`

| 定数 | 値 | 意味 |
|---|---:|---|
| `CELLS_PER_CHECKPOINT` | `30` | 30マスにつき1つ配置する比率 |

## `src/game/playerActions.ts`

| 定数 | 意味 |
|---|---|
| `LEFT_OF` | 現在向きに対する左方向 |
| `RIGHT_OF` | 現在向きに対する右方向 |
| `DIRECTION_ORDER` | 回転計算用の方角順序 |

## `src/game/WireframeProjection.ts`

| 定数 | 値 | 意味 |
|---|---:|---|
| `VIEWPORT_WIDTH` | `520` | 3DビューSVG幅 |
| `VIEWPORT_HEIGHT` | `380` | 3DビューSVG高さ |
| `LINE_COLOR` | `#9df7b5` | ワイヤー線色 |
| `GLOW_COLOR` | `#58d47f` | 枠線グロー色 |
| `viewDepth` | `3` | 可視深度（前方3マス） |
| `frameByDepthKey` | 4段階矩形 | 疑似透視の近景〜遠景フレーム |

## `src/mazeUtils.ts`

| 定数 | 意味 |
|---|---|
| `dx` / `dy` | 方角ごとの座標変化 |
| `dir` | インデックスと方角の対応 |
| `visited` | DFS訪問済み管理配列 |

## 主要関数・メソッド一覧

## `src/mazeUtils.ts`

- `generateMaze(width, height)`
  - 深さ優先探索で完全迷路を生成する。
- `getInitialPlayerState()`
  - 初期プレイヤー状態（`x=0, y=0, dir='E'`）を返す。

## `src/game/playerActions.ts`

- `rotate(dir, turn)`
  - 左右90度回転後の向きを返す。
- `moveForward(player, maze)`
  - 前方に壁がなければ1マス進む。

## `src/game/checkpointUtils.ts`

- `getCheckpointCount(width, height)`
  - 30マスにつき1つの比率でチェックポイント数を算出する（最低1）。
- `generateCheckpoints(maze, excluded)`
  - 除外セル（START/GOAL）を除き、袋小路セルを優先してランダム配置し、`1..N` の番号を付与する。
- `toCheckpointKey(x, y)`
  - 座標をキー文字列へ変換する。

## `src/game/WireframeProjection.ts`

- `createWireframeProjection(maze, player, checkpoints, passedCheckpointKeys, goalActive)`
  - 3Dビュー描画に必要な `lines` / `faces` / `markers` / `wallJudgements` を生成する。

### `WireframeProjectionBuilder` 内部メソッド

- `build()`
  - 深度ごとの可視判定と描画要素生成を行う主処理。
- `getCell(x, y)`
  - 範囲内セルを返す（範囲外は `null`）。
- `getRelativeCell(sideOffset, forwardOffset)`
  - プレイヤー向きを基準に相対セルを取得する。
- `drawFrontWall(perspective, depth)`
  - 正面壁の面と輪郭線を追加する。
- `drawSideWall(side, nearPerspective, farPerspective, depth)`
  - 側面壁（台形）を追加する。
- `drawSideFrontWall(side, farPerspective, depth)`
  - 側面先の正面壁を追加し、マーカー中心点を返す。
- `drawDeeperSideFrontWall(side, startDepth, actions)`
  - 側方通路の奥にある正面壁を可視範囲内で探索して描画する。
- `drawSideElementsAtDepth(side, shouldDrawSideWall, shouldDrawSideFront, sideCell, markerSize, nearPerspective, farPerspective, depth, actions)`
  - 片側ぶんの側面壁/側面先正面壁を共通処理で描画する。
- `pushMarkerForCell(cell, x, y, size, depth)`
  - 対象セルがスタート/ゴール/チェックポイントならマーカー追加。
- `toCellWallDebug(cell)`
  - デバッグ出力用に壁情報を整形。

## `src/hooks/useMazeGameController.ts`

- `useMazeGameController()`
  - ゲーム全体の状態遷移と入力処理を管理し、UI向け値とハンドラを返す。

内部処理:
- `handleKeyDown`
  - `H`でHelp表示切替、矢印キーで前進/回転。
- `handleRetry`
  - 迷路・プレイヤー・タイマー・表示状態を初期化。

## `src/components/MazeView3D.tsx`

- `MazeView3D({ maze, player, checkpoints, passedCheckpointKeys, goalActive, finished })`
  - 投影データをSVGとして描画し、ゴールLOCKED/ACTIVE・チェックポイント番号/通過状態・上部ガイド（ゴール誘導/警告/GOAL表示）を反映する。

## `src/components/HelpMap.tsx`

- `HelpMap({ maze, player, checkpoints, passedCheckpointKeys, goalActive })`
  - 2D俯瞰マップ（壁線、S/G/チェックポイント番号、プレイヤー向き、ゴールLOCKED表示）を描画する。

## `src/components/CompassOverlay.tsx`

- `CompassOverlay({ dir })`
  - 現在向きを示すコンパスを右上に重ね描画する。

## 状態（state）一覧

`useMazeGameController` が管理する状態:

| state | 型 | 役割 |
|---|---|---|
| `maze` | `Maze` | 現在の迷路データ |
| `player` | `PlayerState` | プレイヤー座標と向き |
| `checkpoints` | `Checkpoint[]` | 現在ゲームに配置されたチェックポイント |
| `passedCheckpointKeys` | `Set<string>` | 通過済みチェックポイント座標キー |
| `passedCheckpointCount` | `number` | 通過済みチェックポイント数 |
| `goalActive` | `boolean` | すべて通過済みでゴール可能か |
| `startTime` | `number \| null` | タイマー開始時刻 |
| `elapsed` | `number` | 経過ミリ秒 |
| `finished` | `boolean` | ゴール済みか |
| `showHelpMap` | `boolean` | Helpマップ表示中か |

## 運用ルール（コメント規約）

`AGENTS.md` に定義した運用ルールに従い、以下を必須とする:
- 関数/メソッド: 役割と引数の意味を日本語コメントで明示する。
- 定数: 値の意図とゲーム上の意味を日本語で補足する。
- 複雑な分岐: 判定理由を1行で補足する。

## 補足

- 3D描画は厳密な行列投影ではなく、`frameByDepthKey` を用いた疑似透視方式。
- 移動可否の正規判定元は `maze[y][x].walls[dir]`。
- 開発時の可視判定検証は `MazeView3D` の `wall-debug` ログを利用する（`ENABLE_WALL_DEBUG_LOG` が `true` の場合のみ）。
