# 3D迷路ゲーム アーキテクチャ（現行実装）

この文書は、React + TypeScript + Three.js で構成された現行迷路ゲーム実装の構成と処理フローを整理したものです。

最終更新: 2026-04-04

## 対象ファイル

- `src/MazeGame.tsx`
- `src/components/GameStatusPanel.tsx`
- `src/hooks/useMazeGameController.ts`
- `src/hooks/useIsTouchDevice.ts`
- `src/hooks/useViewportSize.ts`
- `src/components/MazeView3D.tsx`
- `src/components/maze3d/touchGestureInterpreter.ts`
- `src/components/maze3d/GoalMessageOverlay.tsx`
- `src/components/maze3d/cameraPose.ts`
- `src/components/maze3d/mazeWorldBuilder.ts`
- `src/components/maze3d/mazeCellColorResolvers.ts`
- `src/components/maze3d/goalExitGeometry.ts`
- `src/components/maze3d/sceneObjectDisposer.ts`
- `src/components/maze3d/wallPillarTexture.ts`
- `src/components/maze3d/worldCoordinates.ts`
- `src/components/HelpMap.tsx`
- `src/components/CompassOverlay.tsx`
- `src/mazeUtils.ts`
- `src/game/checkpointUtils.ts`
- `src/game/helpMapVisibilityPolicy.ts`
- `src/game/mazeFieldFactory.ts`
- `src/game/playerActions.ts`
- `src/game/playerInputResolver.ts`
- `src/game/visitedSetUtils.ts`
- `src/game/constants.ts`

## 構成概要

| レイヤ | 主ファイル | 役割 |
|---|---|---|
| 画面構成 | `src/MazeGame.tsx` | 通常UIとタッチ全画面UIの分岐、HUD/ポップアップ/ボタン配置 |
| HUD表示部品 | `src/components/GameStatusPanel.tsx` | TIME/GOAL/CHECKPOINT/CP STATUS の共通描画 |
| 進行制御 | `src/hooks/useMazeGameController.ts` | 迷路初期化、移動入力処理、CP通過管理、ゴール判定、タイマー |
| デバイス判定 | `src/hooks/useIsTouchDevice.ts` | タッチ主体端末かどうかの判定 |
| ビューポート購読 | `src/hooks/useViewportSize.ts` | 画面サイズ・向き判定用の幅/高さ監視 |
| 3D描画 | `src/components/MazeView3D.tsx` | Three.jsのライフサイクル制御、表示サイズ追従、タッチ入力変換 |
| タッチ入力解釈 | `src/components/maze3d/touchGestureInterpreter.ts` | タップ/スワイプを前進・回転へ変換する判定ロジック |
| 3D演出UI | `src/components/maze3d/GoalMessageOverlay.tsx` | ゴール誘導/警告/クリアメッセージ表示 |
| カメラ計算 | `src/components/maze3d/cameraPose.ts` | カメラ姿勢変換・角度補間計算 |
| シーン破棄 | `src/components/maze3d/sceneObjectDisposer.ts` | Group配下メッシュの破棄とGPU資源解放 |
| 3Dワールド生成 | `src/components/maze3d/mazeWorldBuilder.ts` | ワールド組み立て順序のオーケストレーション |
| 3D補助（色/出口/柱） | `src/components/maze3d/*.ts` | 色決定、出口座標、柱テクスチャなどの分離ロジック |
| 補助座標変換 | `src/components/maze3d/worldCoordinates.ts` | セル座標→ワールド座標変換 |
| 2D補助表示 | `src/components/HelpMap.tsx` | 訪問済みベースの俯瞰マップ描画 |
| 表示ポリシー | `src/game/helpMapVisibilityPolicy.ts` | ヘルプマップのCP/ゴール表示可否ルールを集約 |
| 方位表示 | `src/components/CompassOverlay.tsx` | プレイヤー向きのコンパス表示 |
| 迷路生成/配置 | `src/mazeUtils.ts` | DFS迷路生成、開始位置・出口決定、初期向き決定 |
| 初期フィールド生成 | `src/game/mazeFieldFactory.ts` | 新規ゲーム開始時の迷路・CP・開始位置・出口の生成 |
| CP配置 | `src/game/checkpointUtils.ts` | CP個数算出、袋小路優先ランダム配置 |
| 移動補助 | `src/game/playerActions.ts` | 前進座標計算、左右回転 |
| 入力解決 | `src/game/playerInputResolver.ts` | 前進/回転入力から次状態とゴール試行結果を算出 |
| 集合更新補助 | `src/game/visitedSetUtils.ts` | 訪問済み/通過済みSetの差分更新 |
| 設定値 | `src/game/constants.ts` | 迷路サイズ、カメラ、色、ゲート寸法など |

## 現行ゲーム仕様（実装準拠）

- 迷路は DFS で生成する（完全迷路）。
- スタート位置はランダム（袋小路優先）で決定する。
- スタート地点の床・壁は通常セルと同一見た目（専用色なし）。
- 初期向きは開始セルで壁がない方向を向く（優先順 `N -> E -> S -> W`）。
- ゴールは「外周セルの外向き壁を開けた出口」（`goalExit`）として毎回ランダム生成。
- ゴールは行き止まりを必須条件にしない。
- CP未回収時に出口へ出ようとすると、外へは出られず警告表示のみ出る。
- CP全回収後は出口から迷路外へ進め、クリア判定になる。
- 出口外側の床は常時赤色で表示する。
- 出口の両端柱は常時赤色で表示する（未解放時も維持）。
- 未解放時は出口に格子ゲート（牢屋風）を配置して封鎖する。
- 円柱マーカーはチェックポイントのみ表示（スタート/ゴールには表示しない）。
- タッチ端末では横向き時に常時全画面UIを使用する。
- タッチ端末の縦向き時は横向き案内テキストのみ表示し、ゲーム画面は表示しない。
- タッチ端末では `D` によるデバッグ開示操作を受け付けない。
- タッチ全画面UIでは `HELP`（左下）で操作説明ポップアップ、`MAP`（右下）でヘルプマップを切り替える。
- タッチ全画面UIの `TIME/GOAL/CHECKPOINT/CP STATUS` は画面最下部オーバーレイで表示する。
- コンパスは針（三角形）を固定し、方位リング側を回転させる。
- コンパス方位リングの回転はイージング付きで補間し、急激な見た目変化を抑える。

## 全体フロー

```mermaid
flowchart TD
  A[アプリ起動] --> B[MazeGame]
  B --> C[useMazeGameController 初期化]
  C --> D[generateMaze]
  C --> E[getRandomGoalExit 外周出口決定+外周壁開放]
  C --> F[getRandomStartPosition 袋小路優先]
  C --> G[getInitialPlayerState 開口方向へ初期向き設定]
  C --> H[generateCheckpoints]

  B --> I[MazeView3D]
  I --> J[buildMazeWorld]
  J --> J1[床/壁/柱/CPマーカー生成]
  J --> J2[出口外床(赤)生成]
  J --> J3[未解放時ゲート生成]
  I --> J4[表示サイズ追従リサイズ]
  I --> J5[TouchGestureInterpreterで入力変換]

  C --> K[keydown監視]
  K --> L{キーボード入力}
  L -->|↑| M[resolveForwardResult]
  L -->|←/→| N[rotate]
  L -->|H| O[ヘルプ表示切替]
  L -->|D| P[デバッグ開示切替※非タッチ時のみ]

  I --> T1{タッチ入力}
  T1 -->|タップ| T2[前進入力へ変換]
  T1 -->|左右スワイプ| T3[回転入力へ変換]
  T2 --> M
  T3 --> N

  M --> Q{迷路内移動か}
  Q -->|Yes| R[player更新]
  Q -->|No| S{goalExit試行か}
  S -->|No| T[無視]
  S -->|Yes| U{goalActiveか}
  U -->|No| V[警告カウントのみ]
  U -->|Yes| W[迷路外へ移動 + finished=true]

  R --> X[visitedCellKeys更新]
  R --> Y[passedCheckpointKeys更新]
  Y --> Z[goalActive再計算]
```

## 状態設計（`useMazeGameController`）

| state | 型 | 役割 |
|---|---|---|
| `maze` | `Maze` | 現在迷路 |
| `goalExit` | `GoalExit` | 出口セルと外向き方向 |
| `player` | `PlayerState` | プレイヤー座標と向き |
| `checkpoints` | `Checkpoint[]` | CP配置 |
| `passedCheckpointKeys` | `Set<string>` | 通過済みCP |
| `passedCheckpointCount` | `number` | 通過済みCP数 |
| `goalActive` | `boolean` | ゴール解放状態 |
| `visitedCellKeys` | `Set<string>` | 訪問済みセル（ヘルプ表示用） |
| `revealHiddenMapForDebug` | `boolean` | ヘルプの未訪問領域開示フラグ |
| `lockedGoalAttemptCount` | `number` | 未解放出口試行回数（警告トリガー） |
| `startTime` | `number \| null` | タイマー開始時刻 |
| `elapsed` | `number` | 経過ミリ秒 |
| `finished` | `boolean` | クリア状態 |
| `showHelpMap` | `boolean` | ヘルプ表示状態 |

補足:
- `goalActive = checkpoints.length === 0 || passedCheckpointCount === checkpoints.length`
- カメラ補間中は `inputLockUntilRef` で矢印入力をロックする。
- `useMazeGameController({ enableMapDebugToggle })` により `D` キー受付を切り替える。
- `handleToggleHelpMap` でキーボード以外（タッチUIボタン）からもヘルプ表示を切り替える。

## 3Dワールド構築（`mazeWorldBuilder.ts`）

### 生成順

1. `buildCells()`
2. `buildGoalOutsideFloor()`
3. `buildPillars()`
4. `buildLockedGoalGate()`（未解放時のみ）

### 主な描画ルール

- 壁重複回避:
  - `N/W` は常に描画
  - `E/S` は外周セルのみ描画
- 壁面強調:
  - チェックポイントセルに面する側のみ色変更
- 柱:
  - 全交点に角柱を配置
  - 出口両端のみ赤柱
- マーカー:
  - CPセルのみ円柱マーカー
- 出口ゲート:
  - 開口方向に合わせて縦棒+横棒の格子を生成

## ヘルプマップ仕様（`HelpMap.tsx`）

- 表示対象は基本「訪問済みセル」のみ。
- `D` トグル時のみ未訪問領域を開示（非タッチ時）。
- スタートマーカーは表示しない。
- ゴールは `goalExit` 方向へオフセットした `G` で表示。
- CPは番号付きで表示（通過済み/未通過で色分け）。
- CP/ゴールの表示可否は `HelpMapVisibilityPolicy` が一元判定する。
- 通常表示時の可視化モードは `constants.ts` のモード定数で切り替える。
- `passed_only` 設定時は、CPは通過済みのみ表示し、ゴールは出口セル（外周の面したマス）通過後に表示する。

## カメラ・演出仕様（`MazeView3D.tsx`）

- カメラは `toCameraPose(player)` から算出。
- 位置/向き変更は `animateCameraTo` で `CAMERA_MOVE_DURATION_MS` 補間。
- `goalActive` が `false -> true` に遷移した瞬間にゴール誘導表示。
- `lockedGoalAttemptCount` 増加時に「チェックポイントを回収せよ！」を一定時間表示。
- `ResizeObserver` と `window.resize` で表示領域に追従してレンダラーサイズ/投影行列を更新する。
- タッチ入力は `onTouchStart/onTouchEnd` で判定し、タップを前進、左右スワイプを回転へ変換する。
- `fullScreen` プロップ時は親領域いっぱいにキャンバスを表示する。
- コンパス表示（`CompassOverlay.tsx`）は `requestAnimationFrame` + `easeInOutCubic` で方位リング角を補間する。
- コンパス三角形は上端を方位リング外周に合わせ、底辺位置は `COMPASS_POINTER_TRIANGLE_BASE_OFFSET_RATIO` で制御する。

## 主要関数一覧

### `src/mazeUtils.ts`

- `generateMaze(width, height)`: DFSで完全迷路を生成する。
- `getRandomStartPosition(maze, excluded)`: 除外を除き、行き止まり優先で開始位置を選ぶ。
- `getRandomGoalExit(maze, excluded)`: 外周セルから出口を決め、外向き壁を開ける。
- `getInitialPlayerState(maze, start)`: 開始セルで壁がない方向を初期向きにする。

### `src/game/checkpointUtils.ts`

- `getCheckpointCount(width, height)`: 迷路サイズからCP数を算出する。
- `generateCheckpoints(maze, excluded)`: 袋小路優先でCPを配置する。
- `toCheckpointKey(x, y)`: 座標をSet管理用キーへ変換する。

### `src/game/helpMapVisibilityPolicy.ts`

- `HelpMapVisibilityPolicy.shouldShowCheckpoint(passed)`: CP表示可否をモードとデバッグ状態で判定する。
- `HelpMapVisibilityPolicy.shouldShowGoal(state)`: ゴール表示可否を進行状態とモードで判定する。

### `src/game/mazeFieldFactory.ts`

- `createGameField()`: 迷路・出口・開始位置・CPを初期セットとして生成する。
- `createInitialVisitedCellKeys(startPosition)`: 開始セルのみを含む訪問済みSetを作る。

### `src/game/playerActions.ts`

- `getForwardPosition(x, y, dir)`: 向きに応じた前方1マス座標を返す。
- `rotate(dir, turn)`: 左右回転後の向きを返す。

### `src/game/playerInputResolver.ts`

- `isMoveControlKey(key)`: 移動・回転キーかを判定する。
- `resolveNextPlayerState(...)`: キー入力から次プレイヤー状態とゴール試行結果を返す。

### `src/game/visitedSetUtils.ts`

- `appendVisitedCellKey(previous, cellKey)`: 訪問済みセルSetへ差分追加する。
- `appendPassedCheckpointKey(previous, cellKey, checkpointKeySet)`: 通過済みCP Setへ差分追加する。

### `src/hooks/useMazeGameController.ts`

- `useMazeGameController(options)`: ゲーム全体状態と入力イベントを統合管理する。
- `handleToggleHelpMap()`: ヘルプマップ表示状態をトグルする。

### `src/hooks/useIsTouchDevice.ts`

- `useIsTouchDevice()`: ポインタ特性とタッチポイント数からタッチ主体端末かを判定する。

### `src/hooks/useViewportSize.ts`

- `useViewportSize()`: 画面サイズ・端末向き判定用にビューポート幅/高さを購読する。

### `src/components/GameStatusPanel.tsx`

- `GameStatusPanel(...)`: TIME/GOAL/CHECKPOINT/CP STATUS の共通描画を行う。

### `src/components/maze3d/touchGestureInterpreter.ts`

- `TouchGestureInterpreter.begin(point)`: ジェスチャー開始点を記録する。
- `TouchGestureInterpreter.resolve(endPoint)`: タップ/スワイプを前進・左右回転・無効へ判定する。
- `TouchGestureInterpreter.cancel()`: 記録済みの開始点を破棄する。

### `src/components/maze3d/mazeWorldBuilder.ts`

- `buildMazeWorld(params)`: 3D迷路ワールドを再構築する入口関数。
- `MazeWorldBuilder.build()`: 各パーツの組み立て順に従って生成する。

### `src/components/maze3d/cameraPose.ts`

- `toCameraPose(player)`: プレイヤー状態をカメラ姿勢へ変換する。
- `getShortestAngleDelta(from, to)`: 回転補間に使う最短角度差を返す。
- `easeInOutCubic(t)`: カメラ補間用のイージング値を返す。

### `src/components/maze3d/sceneObjectDisposer.ts`

- `clearGroup(group)`: Group配下を削除してジオメトリ/マテリアルを破棄する。

### `src/components/maze3d/GoalMessageOverlay.tsx`

- `GoalMessageOverlay(...)`: ゴール関連メッセージの表示位置・サイズ・文言を描画する。

## 主要定数（抜粋）

### 迷路・進行

- `MAZE_WIDTH`, `MAZE_HEIGHT`: 迷路サイズ（横・縦マス数）を決める基準値。
- `TIMER_INTERVAL_MS`: 経過時間更新の周期を制御する。
- `MAP_DEBUG_REVEAL_KEY`: ヘルプマップの未訪問領域開示トグルキーを定義する。
- `HELP_MAP_CHECKPOINT_VISIBILITY_MODES`, `HELP_MAP_CHECKPOINT_VISIBILITY_MODE`: 通常ヘルプでのCP表示モード一覧と現在値を定義する。
- `HELP_MAP_GOAL_VISIBILITY_MODES`, `HELP_MAP_GOAL_VISIBILITY_MODE`: 通常ヘルプでのゴール表示モード一覧と現在値を定義する。

### カメラ・ビュー

- `VIEWPORT_WIDTH`, `VIEWPORT_HEIGHT`: 3Dビューの描画領域サイズを決める（`VIEWPORT_HEIGHT = VIEWPORT_WIDTH / 2`）。
- `CAMERA_MOVE_DURATION_MS`: 移動・回転時カメラ補間の所要時間を決める。
- `TOUCH_SWIPE_TURN_THRESHOLD_PX`, `TOUCH_TAP_MOVE_TOLERANCE_PX`, `TOUCH_TAP_MAX_DURATION_MS`: タッチ入力を操作へ変換する判定しきい値を定義する。
- `TOUCH_ACTION_BUTTON_SIZE_PX`, `TOUCH_OVERLAY_BOTTOM_PADDING_PX`, `TOUCH_LANDSCAPE_PROMPT_TEXT`: タッチ全画面UIの操作ボタン寸法・余白・縦向き案内文言を定義する。
- `TOUCH_*_Z_INDEX` 群: タッチ全画面UIのステータス/ポップアップ/ボタンの前後関係を段階式で定義する。
- `COMPASS_ROTATION_DURATION_MS`, `COMPASS_DIRECTION_SCALE`, `COMPASS_LABEL_FONT_SIZE_PX`: コンパス回転時間・方位表示縮尺・文字サイズを定義する。
- `COMPASS_POINTER_TRIANGLE_HALF_WIDTH`, `COMPASS_POINTER_TRIANGLE_BASE_OFFSET_RATIO`: 固定三角形ポインターの形状を定義する。
- `CAMERA_EYE_HEIGHT`, `CAMERA_PITCH_RAD`: 視点の高さと上下角（俯仰）を定義する。
- `CAMERA_BACK_OFFSET`, `CAMERA_FOV_DEG`, `CAMERA_NEAR`, `CAMERA_FAR`: 視点後退量と投影パラメータ（画角・クリップ）を定義する。
- `CAMERA_FOG_NEAR`, `CAMERA_FOG_FAR`: フォグの開始・終了距離を定義する。

### ワールド描画

- `WORLD_CELL_SIZE`, `WORLD_WALL_HEIGHT`, `WORLD_WALL_THICKNESS`: 迷路セル縮尺と壁形状（高さ・厚み）を決める。
- `WORLD_FLOOR_Y`, `WORLD_FLOOR_ELEVATION`: 床面の基準高さとZ-fighting回避の微小オフセットを定義する。
- `WALL_FILL_COLOR`, `WALL_EDGE_COLOR`: 壁本体と輪郭線の基準色を定義する。
- `WALL_PILLAR_SIZE`, `WALL_PILLAR_TEXTURE_WIDTH`, `WALL_PILLAR_TEXTURE_HEIGHT`: 柱サイズと柱テクスチャ解像度を定義する（`HEIGHT = WIDTH * 16`）。
- `FLOOR_BASE_COLOR`, `FLOOR_BASE_OPACITY`: 通常床の色と不透明度を定義する。
- `CHECKPOINT_PENDING_COLOR`, `CHECKPOINT_CLEARED_COLOR`: CPマーカー/床の未通過・通過済み色を定義する。
- `CHECKPOINT_PENDING_WALL_COLOR`, `CHECKPOINT_CLEARED_WALL_COLOR`: CPセルに面する壁強調色を定義する。
- `MARKER_RADIUS`, `MARKER_HEIGHT`: CP円柱マーカーの寸法を定義する（`MARKER_HEIGHT = WORLD_WALL_HEIGHT * 0.3`）。

### ゴール演出

- `GOAL_ACTIVE_COLOR`, `GOAL_INACTIVE_COLOR`: ゴール解放/未解放状態の強調色を定義する。
- `GOAL_OUTSIDE_FLOOR_COLOR`: 出口外側床の常時表示色を定義する。
- `GOAL_OPEN_PILLAR_COLOR`: 出口両端柱の色を定義する。
- `GOAL_GATE_BAR_COUNT`, `GOAL_GATE_BAR_THICKNESS`, `GOAL_GATE_BAR_COLOR`: 未解放ゲート格子の本数・太さ・色を定義する。
- `GOAL_PROMPT_TEXT`, `GOAL_LOCKED_WARNING_TEXT`, `GOAL_CLEAR_TEXT`: 誘導・警告・クリア表示の文言を定義する。
- `GOAL_PROMPT_TEXT_COLOR`: 上部メッセージの文字色を定義する。
- `GOAL_PROMPT_BLINK_DURATION_SEC`: ゴール誘導メッセージの点滅周期を定義する。
- `GOAL_PROMPT_FONT_SIZE_PX`, `GOAL_CLEAR_FONT_SIZE_PX`: 通常メッセージとクリア表示の文字サイズを定義する。
- `GOAL_LOCKED_WARNING_BLINK_DURATION_SEC`: 未解放警告メッセージの点滅周期を定義する。
- `GOAL_LOCKED_WARNING_DURATION_MS`: 未解放警告メッセージの表示時間を定義する。
- `GOAL_EXIT_MARKER_OFFSET_RATIO`: ヘルプマップ上でゴール記号を出口方向へずらす比率を定義する。

## 補足

- 旧来の疑似投影ベース (`WireframeProjection`) は現行アーキテクチャの主要経路ではない。
- 現行の3D描画責務は `MazeView3D` + `maze3d/mazeWorldBuilder` に集約されている。
- 仕様変更時は本書の「現行ゲーム仕様」と「主要定数」を優先更新対象とする。
