import { CSSProperties, useEffect, useMemo, useState } from 'react';
import { CompassOverlay } from './components/CompassOverlay';
import { GameStatusPanel } from './components/GameStatusPanel';
import { HelpMap } from './components/HelpMap';
import { MazeView3D } from './components/MazeView3D';
import {
  TOUCH_ACTION_BUTTON_BASE_Z_INDEX,
  TOUCH_ACTION_BUTTON_SIZE_PX,
  TOUCH_HELP_BUTTON_ACTIVE_Z_INDEX,
  TOUCH_HELP_OVERLAY_Z_INDEX,
  TOUCH_LANDSCAPE_PROMPT_TEXT,
  TOUCH_MAP_BUTTON_ACTIVE_Z_INDEX,
  TOUCH_MAP_OVERLAY_Z_INDEX,
  TOUCH_OVERLAY_BOTTOM_PADDING_PX,
  TOUCH_RETRY_BUTTON_Z_INDEX,
  TOUCH_STATUS_OVERLAY_Z_INDEX,
  VIEWPORT_WIDTH,
} from './game/constants';
import { Checkpoint } from './game/checkpointUtils';
import { useIsTouchDevice } from './hooks/useIsTouchDevice';
import { useMazeGameController } from './hooks/useMazeGameController';
import { useViewportSize } from './hooks/useViewportSize';
import { GoalExit, Maze, PlayerState } from './mazeUtils';

// タッチ全画面UIでアクションボタンを左右へ寄せるマージン（px）。
const TOUCH_ACTION_BUTTON_SIDE_MARGIN_PX = 12;

// 共有フォント定義。全画面/通常UIで統一する。
const BASE_FONT_FAMILY = '"Courier New", "Lucida Console", monospace';

// HelpMap重ね表示コンポーネントの入力。
type HelpMapOverlayProps = {
  maze: Maze;
  goalExit: GoalExit;
  player: PlayerState;
  checkpoints: Checkpoint[];
  passedCheckpointKeys: Set<string>;
  visitedCellKeys: Set<string>;
  revealHiddenMapForDebug: boolean;
  goalActive: boolean;
  finished: boolean;
  background: string;
  zIndex: number;
  footerText?: string;
};

/**
 * 3Dビュー上にヘルプマップをオーバーレイ表示する。
 * @param maze 迷路データ
 * @param goalExit ゴール出口情報
 * @param player プレイヤー状態
 * @param checkpoints チェックポイント一覧
 * @param passedCheckpointKeys 通過済みチェックポイント座標キー集合
 * @param visitedCellKeys 訪問済みセル座標キー集合
 * @param revealHiddenMapForDebug 未訪問領域のデバッグ開示フラグ
 * @param goalActive ゴール解放状態
 * @param finished クリア状態
 * @param background オーバーレイ背景色
 * @param zIndex 表示レイヤー順
 * @param footerText マップ下部補助テキスト
 * @returns ヘルプマップオーバーレイ
 */
function HelpMapOverlay({
  maze,
  goalExit,
  player,
  checkpoints,
  passedCheckpointKeys,
  visitedCellKeys,
  revealHiddenMapForDebug,
  goalActive,
  finished,
  background,
  zIndex,
  footerText,
}: HelpMapOverlayProps) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex,
      }}
    >
      <div>
        <HelpMap
          maze={maze}
          goalExit={goalExit}
          player={player}
          checkpoints={checkpoints}
          passedCheckpointKeys={passedCheckpointKeys}
          visitedCellKeys={visitedCellKeys}
          revealHiddenMapForDebug={revealHiddenMapForDebug}
          goalActive={goalActive}
          finished={finished}
        />
        {footerText ? (
          <p style={{ marginTop: 10, marginBottom: 0, fontSize: 13, color: '#cbffd9' }}>{footerText}</p>
        ) : null}
      </div>
    </div>
  );
}

// タッチ全画面UIのレイヤー制御オブジェクト。
class TouchOverlayLayerState {
  private readonly showHelpMap: boolean;

  private readonly showTouchHelpDialog: boolean;

  /**
   * @param showHelpMap マップ表示状態
   * @param showTouchHelpDialog 操作ヘルプ表示状態
   */
  constructor(showHelpMap: boolean, showTouchHelpDialog: boolean) {
    this.showHelpMap = showHelpMap;
    this.showTouchHelpDialog = showTouchHelpDialog;
  }

  /**
   * HELPボタンの表示レイヤーを返す。
   * @returns HELPボタン用z-index
   */
  getHelpButtonZIndex(): number {
    return this.showTouchHelpDialog ? TOUCH_HELP_BUTTON_ACTIVE_Z_INDEX : TOUCH_ACTION_BUTTON_BASE_Z_INDEX;
  }

  /**
   * MAPボタンの表示レイヤーを返す。
   * @returns MAPボタン用z-index
   */
  getMapButtonZIndex(): number {
    return this.showHelpMap ? TOUCH_MAP_BUTTON_ACTIVE_Z_INDEX : TOUCH_ACTION_BUTTON_BASE_Z_INDEX;
  }
}

/**
 * タッチ全画面UIの丸ボタンスタイルを生成する。
 * @param side 左右どちらに配置するか
 * @param zIndex ボタン表示レイヤー
 * @returns ボタンスタイル
 */
const createTouchActionButtonStyle = (
  side: 'left' | 'right',
  zIndex: number
): CSSProperties => ({
  position: 'absolute',
  [side]: TOUCH_ACTION_BUTTON_SIDE_MARGIN_PX,
  bottom: TOUCH_OVERLAY_BOTTOM_PADDING_PX,
  width: TOUCH_ACTION_BUTTON_SIZE_PX,
  height: TOUCH_ACTION_BUTTON_SIZE_PX,
  borderRadius: 999,
  color: '#9df7b5',
  background: 'rgba(7, 22, 14, 0.95)',
  border: '1px solid #58d47f',
  fontFamily: BASE_FONT_FAMILY,
  fontSize: 12,
  cursor: 'pointer',
  zIndex,
});

/**
 * 迷路ゲームの画面レイアウトを構成する。
 * @returns 3Dビュー、ヘルプ、タイマーを含むゲームUI
 */
export default function MazeGame() {
  // 操作ガイド切替用のタッチ端末判定。
  const isTouchDevice = useIsTouchDevice();
  // 画面幅・向き判定に使う現在のビューポートサイズ。
  const viewportSize = useViewportSize();
  // タッチ用操作ヘルプポップアップの表示状態。
  const [showTouchHelpDialog, setShowTouchHelpDialog] = useState(false);

  // ゲーム進行に必要な状態とハンドラをフックから取得する。
  const {
    maze,
    goalExit,
    player,
    elapsed,
    finished,
    showHelpMap,
    visitedCellKeys,
    revealHiddenMapForDebug,
    checkpoints,
    passedCheckpointKeys,
    passedCheckpointCount,
    goalActive,
    lockedGoalAttemptCount,
    handleForward,
    handleTurnLeft,
    handleTurnRight,
    handleToggleHelpMap,
    handleRetry,
  } = useMazeGameController({ enableMapDebugToggle: !isTouchDevice });

  // タッチ端末では常時全画面UIを使う（縦向き時は案内表示へ切り替える）。
  const isTouchFullscreenMode = isTouchDevice;
  // 全画面UIでは縦向き時にプレイ画面を隠して横向きを促す。
  const shouldShowLandscapePrompt = isTouchDevice && viewportSize.height > viewportSize.width;
  // ポップアップ表示状態に応じたボタンレイヤー制御。
  const touchOverlayLayerState = useMemo(
    () => new TouchOverlayLayerState(showHelpMap, showTouchHelpDialog),
    [showHelpMap, showTouchHelpDialog]
  );

  useEffect(() => {
    // 全画面モード解除時はタッチ専用ヘルプダイアログを閉じる。
    if (!isTouchFullscreenMode) setShowTouchHelpDialog(false);
  }, [isTouchFullscreenMode]);

  if (shouldShowLandscapePrompt) {
    return (
      <div
        style={{
          color: '#9df7b5',
          background: '#020503',
          height: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: 20,
          fontFamily: BASE_FONT_FAMILY,
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: 20, letterSpacing: 1.2 }}>{TOUCH_LANDSCAPE_PROMPT_TEXT}</p>
          <p style={{ margin: '14px 0 0', opacity: 0.82, fontSize: 14 }}>
            端末を横向きにするとゲーム画面を表示します
          </p>
        </div>
      </div>
    );
  }

  if (isTouchFullscreenMode) {
    return (
      <div
        style={{
          color: '#9df7b5',
          background: '#020503',
          width: '100vw',
          height: '100dvh',
          overflow: 'hidden',
          fontFamily: BASE_FONT_FAMILY,
        }}
      >
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          <MazeView3D
            maze={maze}
            goalExit={goalExit}
            lockedGoalAttemptCount={lockedGoalAttemptCount}
            player={player}
            checkpoints={checkpoints}
            passedCheckpointKeys={passedCheckpointKeys}
            goalActive={goalActive}
            finished={finished}
            fullScreen
            onForward={handleForward}
            onTurnLeft={handleTurnLeft}
            onTurnRight={handleTurnRight}
          />
          <CompassOverlay dir={player.dir} />
          {showHelpMap ? (
            <HelpMapOverlay
              maze={maze}
              goalExit={goalExit}
              player={player}
              checkpoints={checkpoints}
              passedCheckpointKeys={passedCheckpointKeys}
              visitedCellKeys={visitedCellKeys}
              revealHiddenMapForDebug={false}
              goalActive={goalActive}
              finished={finished}
              background="rgba(2, 5, 3, 0.9)"
              zIndex={TOUCH_MAP_OVERLAY_Z_INDEX}
            />
          ) : null}
          {showTouchHelpDialog ? (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(2, 5, 3, 0.9)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: TOUCH_HELP_OVERLAY_Z_INDEX,
                padding: 18,
              }}
            >
              <div
                style={{
                  width: 'min(92vw, 460px)',
                  border: '1px solid #58d47f',
                  background: 'rgba(4, 13, 9, 0.94)',
                  padding: 16,
                  textAlign: 'left',
                }}
              >
                <h2 style={{ margin: 0, fontSize: 18, color: '#cbffd9' }}>操作ヘルプ</h2>
                <p style={{ margin: '12px 0 0', fontSize: 14 }}>キャンバスタップ: 前進</p>
                <p style={{ margin: '8px 0 0', fontSize: 14 }}>キャンバス左右スワイプ: 視点回転</p>
                <p style={{ margin: '8px 0 0', fontSize: 14 }}>右下 MAP: ヘルプマップ表示切替</p>
                <p style={{ margin: '8px 0 0', fontSize: 14 }}>
                  ゴール: チェックポイントを全回収後に出口から脱出
                </p>
              </div>
            </div>
          ) : null}
          <GameStatusPanel
            elapsed={elapsed}
            goalActive={goalActive}
            passedCheckpointCount={passedCheckpointCount}
            checkpoints={checkpoints}
            passedCheckpointKeys={passedCheckpointKeys}
            finished={finished}
            containerStyle={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              bottom: 2,
              zIndex: TOUCH_STATUS_OVERLAY_Z_INDEX,
              background: 'rgba(2, 5, 3, 0.58)',
              border: '1px solid rgba(88, 212, 127, 0.5)',
              padding: '5px 8px',
              fontSize: 11,
              textAlign: 'center',
              width: 'fit-content',
              maxWidth: `calc(100% - ${(TOUCH_ACTION_BUTTON_SIZE_PX + TOUCH_OVERLAY_BOTTOM_PADDING_PX) * 2 + 26}px)`,
              borderRadius: 4,
            }}
            checkpointStyle={{ marginTop: 5 }}
            keyPrefix="touch-overlay"
          />
          <button
            onClick={() => setShowTouchHelpDialog((visible) => !visible)}
            style={createTouchActionButtonStyle(
              'left',
              touchOverlayLayerState.getHelpButtonZIndex()
            )}
          >
            {showTouchHelpDialog ? 'CLOSE' : 'HELP'}
          </button>
          <button
            onClick={handleToggleHelpMap}
            style={createTouchActionButtonStyle(
              'right',
              touchOverlayLayerState.getMapButtonZIndex()
            )}
          >
            {showHelpMap ? 'CLOSE' : 'MAP'}
          </button>
          <button
            onClick={handleRetry}
            style={{
              position: 'absolute',
              top: 10,
              left: 10,
              color: '#9df7b5',
              background: 'rgba(7, 22, 14, 0.9)',
              border: '1px solid #58d47f',
              padding: '6px 10px',
              fontFamily: BASE_FONT_FAMILY,
              fontSize: 12,
              cursor: 'pointer',
              zIndex: TOUCH_RETRY_BUTTON_Z_INDEX,
            }}
          >
            RETRY
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        color: '#9df7b5',
        background: '#020503',
        minHeight: '100vh',
        textAlign: 'center',
        padding: 20,
        fontFamily: BASE_FONT_FAMILY,
      }}
    >
      <h1 style={{ letterSpacing: 2, marginBottom: 14 }}>3D MAZE</h1>
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: `${VIEWPORT_WIDTH}px`,
          margin: '0 auto',
        }}
      >
        <MazeView3D
          maze={maze}
          goalExit={goalExit}
          lockedGoalAttemptCount={lockedGoalAttemptCount}
          player={player}
          checkpoints={checkpoints}
          passedCheckpointKeys={passedCheckpointKeys}
          goalActive={goalActive}
          finished={finished}
          onForward={handleForward}
          onTurnLeft={handleTurnLeft}
          onTurnRight={handleTurnRight}
        />
        <CompassOverlay dir={player.dir} />
        {showHelpMap ? (
          <HelpMapOverlay
            maze={maze}
            goalExit={goalExit}
            player={player}
            checkpoints={checkpoints}
            passedCheckpointKeys={passedCheckpointKeys}
            visitedCellKeys={visitedCellKeys}
            revealHiddenMapForDebug={revealHiddenMapForDebug}
            goalActive={goalActive}
            finished={finished}
            background="rgba(2, 5, 3, 0.88)"
            zIndex={20}
            footerText={isTouchDevice ? 'H: CLOSE HELP MAP' : 'H: CLOSE HELP MAP / D: TOGGLE DEBUG REVEAL'}
          />
        ) : null}
      </div>
      <GameStatusPanel
        elapsed={elapsed}
        goalActive={goalActive}
        passedCheckpointCount={passedCheckpointCount}
        checkpoints={checkpoints}
        passedCheckpointKeys={passedCheckpointKeys}
        finished={finished}
        summaryStyle={{ margin: '18px 0' }}
        checkpointStyle={{ marginBottom: 12, fontSize: 13 }}
        keyPrefix="desktop"
      />
      <button
        onClick={handleRetry}
        style={{
          color: '#9df7b5',
          background: '#07160e',
          border: '1px solid #58d47f',
          padding: '8px 18px',
          fontFamily: BASE_FONT_FAMILY,
          cursor: 'pointer',
        }}
      >
        RETRY
      </button>
      <div style={{ marginTop: 20 }}>
        {isTouchDevice ? (
          <>
            <p>操作: キャンバスタップ 前進 / キャンバス左右スワイプ 回転</p>
            <p>H: ヘルプマップ表示切替</p>
          </>
        ) : (
          <>
            <p>操作: ↑ 前進 / ← 左回転 / → 右回転</p>
            <p>H: ヘルプマップ表示切替</p>
          </>
        )}
        <p>ゴール: 外周の出口から脱出</p>
      </div>
    </div>
  );
}
