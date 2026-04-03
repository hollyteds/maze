import { TouchEvent, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Checkpoint, toCheckpointKey } from '../game/checkpointUtils';
import {
  CAMERA_EYE_HEIGHT,
  CAMERA_FAR,
  CAMERA_FOG_FAR,
  CAMERA_FOG_NEAR,
  CAMERA_FOV_DEG,
  CAMERA_MOVE_DURATION_MS,
  CAMERA_NEAR,
  CAMERA_PITCH_RAD,
  ENABLE_WALL_DEBUG_LOG,
  GLOW_COLOR,
  GOAL_LOCKED_WARNING_DURATION_MS,
  TOUCH_SWIPE_TURN_THRESHOLD_PX,
  TOUCH_TAP_MAX_DURATION_MS,
  TOUCH_TAP_MOVE_TOLERANCE_PX,
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH,
} from '../game/constants';
import { GoalExit, Maze, PlayerState } from '../mazeUtils';
import { GoalMessageOverlay } from './maze3d/GoalMessageOverlay';
import { CameraPose, easeInOutCubic, getShortestAngleDelta, toCameraPose } from './maze3d/cameraPose';
import { buildMazeWorld } from './maze3d/mazeWorldBuilder';
import { clearGroup } from './maze3d/sceneObjectDisposer';
import {
  TouchGestureInterpreter,
  TOUCH_GESTURE_ACTIONS,
} from './maze3d/touchGestureInterpreter';

// MazeView3Dコンポーネントの入力プロパティ。
type MazeView3DProps = {
  // 投影元となる迷路データ。
  maze: Maze;
  // ゴール出口（セル座標と外向き方向）。
  goalExit: GoalExit;
  // 未解放ゴールへ出ようとした回数（警告表示トリガー）。
  lockedGoalAttemptCount: number;
  // 投影元となるプレイヤー位置と向き。
  player: PlayerState;
  // 全チェックポイント座標。
  checkpoints: Checkpoint[];
  // 通過済みチェックポイント座標キー集合。
  passedCheckpointKeys: Set<string>;
  // ゴール有効化状態。
  goalActive: boolean;
  // クリア済み状態。true のときは GOAL 表示に切り替える。
  finished: boolean;
  // タッチ用全画面表示モード。true の場合は表示領域いっぱいに描画する。
  fullScreen?: boolean;
  // タップ前進入力ハンドラ。
  onForward: () => void;
  // 左回転入力ハンドラ。
  onTurnLeft: () => void;
  // 右回転入力ハンドラ。
  onTurnRight: () => void;
};

/**
 * 1人称の3D迷路ビューをThree.jsで描画する。
 * @param maze 迷路データ
 * @param goalExit ゴール出口（セル座標と外向き方向）
 * @param lockedGoalAttemptCount 未解放ゴール試行回数
 * @param player プレイヤー位置と向き
 * @param checkpoints 全チェックポイント座標
 * @param passedCheckpointKeys 通過済みチェックポイント座標キー集合
 * @param goalActive ゴール有効化状態
 * @param finished クリア済み状態
 * @param fullScreen タッチ用全画面表示モード
 * @param onForward タップ前進入力ハンドラ
 * @param onTurnLeft 左回転入力ハンドラ
 * @param onTurnRight 右回転入力ハンドラ
 * @returns Three.js 3Dビューと通知UI
 */
export function MazeView3D({
  maze,
  goalExit,
  lockedGoalAttemptCount,
  player,
  checkpoints,
  passedCheckpointKeys,
  goalActive,
  finished,
  fullScreen = false,
  onForward,
  onTurnLeft,
  onTurnRight,
}: MazeView3DProps) {
  // 3Dビュー全体の表示領域参照。実サイズ追従リサイズに使う。
  const viewportRef = useRef<HTMLDivElement | null>(null);
  // WebGL描画先のcanvas要素参照。
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Three.jsレンダラー参照。
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  // Three.jsシーン参照。
  const sceneRef = useRef<THREE.Scene | null>(null);
  // Three.jsカメラ参照。
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  // 迷路メッシュ群を保持するルートグループ。
  const worldGroupRef = useRef<THREE.Group | null>(null);
  // カメラ姿勢の現在値。
  const cameraPoseRef = useRef<CameraPose>(toCameraPose(player));
  // カメラ補間アニメーションのrequestAnimationFrame ID。
  const cameraAnimationFrameRef = useRef<number | null>(null);

  // ゴール解放メッセージの表示状態。
  const [showGoalPrompt, setShowGoalPrompt] = useState(false);
  // ゴール未解放で通過した際の警告表示状態。
  const [showGoalLockedWarning, setShowGoalLockedWarning] = useState(false);
  // ゴール有効化状態の前回値。false→true遷移を検出する。
  const previousGoalActiveRef = useRef(goalActive);
  // ゴール未解放通過警告の消去タイマーID。
  const goalLockedWarningTimerRef = useRef<number | null>(null);
  // カメラ補間判定用の前回プレイヤー状態。
  const previousCameraPlayerRef = useRef({ x: player.x, y: player.y, dir: player.dir });
  // 同一内容のデバッグログ連続出力を抑制するための前回スナップショット。
  const lastDebugSnapshotRef = useRef('');
  // タッチジェスチャーをゲーム入力へ解釈するクラスインスタンス。
  const touchGestureInterpreterRef = useRef(
    new TouchGestureInterpreter({
      swipeTurnThresholdPx: TOUCH_SWIPE_TURN_THRESHOLD_PX,
      tapMoveTolerancePx: TOUCH_TAP_MOVE_TOLERANCE_PX,
      tapMaxDurationMs: TOUCH_TAP_MAX_DURATION_MS,
    })
  );

  /**
   * 現在シーンを1フレーム描画する。
   */
  const renderScene = () => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!renderer || !scene || !camera) return;
    renderer.render(scene, camera);
  };

  /**
   * カメラ姿勢をThree.jsカメラへ反映する。
   * @param pose 適用するカメラ姿勢
   */
  const applyCameraPose = (pose: CameraPose) => {
    const camera = cameraRef.current;
    if (!camera) return;
    camera.position.set(pose.x, CAMERA_EYE_HEIGHT, pose.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.x = CAMERA_PITCH_RAD;
    camera.rotation.y = pose.yaw;
    camera.rotation.z = 0;
    cameraPoseRef.current = pose;
  };

  /**
   * 実行中のカメラ補間アニメーションを停止する。
   */
  const stopCameraAnimation = () => {
    if (cameraAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(cameraAnimationFrameRef.current);
      cameraAnimationFrameRef.current = null;
    }
  };

  /**
   * カメラを現在姿勢から目標姿勢へdurationで補間する。
   * @param targetPose 目標カメラ姿勢
   * @param durationMs 補間時間（ミリ秒）
   */
  const animateCameraTo = (targetPose: CameraPose, durationMs: number) => {
    stopCameraAnimation();

    const startPose = cameraPoseRef.current;
    const yawDelta = getShortestAngleDelta(startPose.yaw, targetPose.yaw);
    const animationStart = performance.now();

    const tick = (now: number) => {
      const elapsed = now - animationStart;
      const t = Math.min(1, elapsed / durationMs);
      const eased = easeInOutCubic(t);

      const pose: CameraPose = {
        x: THREE.MathUtils.lerp(startPose.x, targetPose.x, eased),
        z: THREE.MathUtils.lerp(startPose.z, targetPose.z, eased),
        yaw: startPose.yaw + yawDelta * eased,
      };

      applyCameraPose(pose);
      renderScene();

      if (t >= 1) {
        cameraAnimationFrameRef.current = null;
        return;
      }
      cameraAnimationFrameRef.current = window.requestAnimationFrame(tick);
    };

    cameraAnimationFrameRef.current = window.requestAnimationFrame(tick);
  };

  useEffect(() => {
    const wasGoalActive = previousGoalActiveRef.current;
    previousGoalActiveRef.current = goalActive;
    // 新ゲーム開始などで未解放へ戻ったら表示をリセットする。
    if (!goalActive) {
      setShowGoalPrompt(false);
      setShowGoalLockedWarning(false);
      return;
    }
    // チェックポイント達成でゴールが解放された瞬間のみ表示する。
    if (!wasGoalActive && goalActive && checkpoints.length > 0) {
      setShowGoalPrompt(true);
    }
  }, [goalActive, checkpoints.length]);

  useEffect(() => {
    // 未解放状態で外へ出ようとしたタイミングだけ警告を表示する。
    if (lockedGoalAttemptCount <= 0) return;

    setShowGoalLockedWarning(true);
    if (goalLockedWarningTimerRef.current !== null) {
      window.clearTimeout(goalLockedWarningTimerRef.current);
    }
    goalLockedWarningTimerRef.current = window.setTimeout(() => {
      setShowGoalLockedWarning(false);
      goalLockedWarningTimerRef.current = null;
    }, GOAL_LOCKED_WARNING_DURATION_MS);
  }, [lockedGoalAttemptCount]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor('#020503', 1);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog('#020503', CAMERA_FOG_NEAR, CAMERA_FOG_FAR);

    const camera = new THREE.PerspectiveCamera(
      CAMERA_FOV_DEG,
      VIEWPORT_WIDTH / VIEWPORT_HEIGHT,
      CAMERA_NEAR,
      CAMERA_FAR
    );

    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    worldGroupRef.current = worldGroup;

    const viewportElement = viewportRef.current;
    if (viewportElement) {
      const width = Math.max(1, Math.floor(viewportElement.clientWidth));
      const height = Math.max(1, Math.floor(viewportElement.clientHeight));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }

    const initialPose = toCameraPose(player);
    applyCameraPose(initialPose);
    renderScene();

    return () => {
      stopCameraAnimation();
      if (goalLockedWarningTimerRef.current !== null) {
        window.clearTimeout(goalLockedWarningTimerRef.current);
      }
      clearGroup(worldGroup);
      renderer.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      worldGroupRef.current = null;
    };
  }, []);

  useEffect(() => {
    const viewportElement = viewportRef.current;
    if (!viewportElement) return;

    /**
     * 表示領域の実サイズに合わせてレンダラーと投影行列を更新する。
     */
    const resizeViewport = () => {
      const renderer = rendererRef.current;
      const camera = cameraRef.current;
      if (!renderer || !camera) return;
      const width = Math.max(1, Math.floor(viewportElement.clientWidth));
      const height = Math.max(1, Math.floor(viewportElement.clientHeight));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderScene();
    };

    resizeViewport();
    const observer = new ResizeObserver(() => {
      resizeViewport();
    });
    observer.observe(viewportElement);
    window.addEventListener('resize', resizeViewport);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resizeViewport);
    };
  }, []);

  useEffect(() => {
    const worldGroup = worldGroupRef.current;
    if (!worldGroup) return;
    clearGroup(worldGroup);
    buildMazeWorld({
      root: worldGroup,
      maze,
      goalExit,
      checkpoints,
      passedCheckpointKeys,
      goalActive,
    });
    renderScene();
  }, [maze, goalExit, checkpoints, passedCheckpointKeys, goalActive]);

  useEffect(() => {
    const previous = previousCameraPlayerRef.current;
    previousCameraPlayerRef.current = { x: player.x, y: player.y, dir: player.dir };

    const movedOrTurned =
      previous.x !== player.x || previous.y !== player.y || previous.dir !== player.dir;
    if (!movedOrTurned) return;

    animateCameraTo(toCameraPose(player), CAMERA_MOVE_DURATION_MS);
  }, [player.x, player.y, player.dir]);

  useEffect(() => {
    if (!import.meta.env.DEV || !ENABLE_WALL_DEBUG_LOG) return;

    const worldGroup = worldGroupRef.current;
    const camera = cameraRef.current;
    if (!worldGroup || !camera) return;

    const kindCounts = worldGroup.children.reduce<Record<string, number>>((acc, child) => {
      const kind = (child.userData.kind as string | undefined) ?? 'unknown';
      acc[kind] = (acc[kind] || 0) + 1;
      return acc;
    }, {});

    const debugPayload = {
      player,
      camera: {
        x: Number(camera.position.x.toFixed(3)),
        y: Number(camera.position.y.toFixed(3)),
        z: Number(camera.position.z.toFixed(3)),
        yaw: Number(camera.rotation.y.toFixed(3)),
      },
      checkpointKeys: checkpoints.map((checkpoint) => toCheckpointKey(checkpoint.x, checkpoint.y)),
      goalExit,
      passedCheckpointCount: passedCheckpointKeys.size,
      objectCount: worldGroup.children.length,
      kindCounts,
    };

    const snapshot = JSON.stringify(debugPayload);
    // 同一状態ならログ出力を抑制してノイズを減らす。
    if (lastDebugSnapshotRef.current === snapshot) return;
    lastDebugSnapshotRef.current = snapshot;
    console.log('[MazeView3D] three-world-debug', debugPayload);
  }, [checkpoints, goalExit, passedCheckpointKeys, player]);

  /**
   * タッチ開始位置を記録する。
   * @param event キャンバスのタッチ開始イベント
   */
  const handleTouchStart = (event: TouchEvent<HTMLCanvasElement>) => {
    const touchGestureInterpreter = touchGestureInterpreterRef.current;
    if (event.touches.length !== 1) {
      touchGestureInterpreter.cancel();
      return;
    }
    const touch = event.touches[0];
    touchGestureInterpreter.begin({ x: touch.clientX, y: touch.clientY, at: Date.now() });
  };

  /**
   * タッチ終了時にスワイプ/タップ判定を行い、入力へ変換する。
   * @param event キャンバスのタッチ終了イベント
   */
  const handleTouchEnd = (event: TouchEvent<HTMLCanvasElement>) => {
    if (event.changedTouches.length === 0) return;

    const touchGestureInterpreter = touchGestureInterpreterRef.current;
    const touch = event.changedTouches[0];
    const action = touchGestureInterpreter.resolve({
      x: touch.clientX,
      y: touch.clientY,
      at: Date.now(),
    });
    if (action !== TOUCH_GESTURE_ACTIONS.NONE) {
      event.preventDefault();
    }
    if (action === TOUCH_GESTURE_ACTIONS.FORWARD) onForward();
    if (action === TOUCH_GESTURE_ACTIONS.TURN_LEFT) onTurnLeft();
    if (action === TOUCH_GESTURE_ACTIONS.TURN_RIGHT) onTurnRight();
  };

  /**
   * タッチキャンセル時にジェスチャー開始情報を破棄する。
   */
  const handleTouchCancel = () => {
    touchGestureInterpreterRef.current.cancel();
  };

  return (
    <div
      ref={viewportRef}
      style={{
        position: 'relative',
        width: '100%',
        height: fullScreen ? '100%' : undefined,
        maxWidth: fullScreen ? 'none' : `${VIEWPORT_WIDTH}px`,
        aspectRatio: fullScreen ? undefined : `${VIEWPORT_WIDTH} / ${VIEWPORT_HEIGHT}`,
        background: '#020503',
        borderRadius: fullScreen ? 0 : 4,
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={canvasRef}
        width={VIEWPORT_WIDTH}
        height={VIEWPORT_HEIGHT}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          display: 'block',
          touchAction: 'none',
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
      />
      <GoalMessageOverlay
        showGoalPrompt={showGoalPrompt}
        showGoalLockedWarning={showGoalLockedWarning}
        finished={finished}
      />
      <div
        style={{
          position: 'absolute',
          inset: 2,
          border: `1px solid ${GLOW_COLOR}`,
          opacity: 0.55,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
