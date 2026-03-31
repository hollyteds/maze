import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Checkpoint, toCheckpointKey } from '../game/checkpointUtils';
import {
  CAMERA_BACK_OFFSET,
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
  GOAL,
  GOAL_LOCKED_WARNING_BLINK_DURATION_SEC,
  GOAL_LOCKED_WARNING_DURATION_MS,
  GOAL_PROMPT_BLINK_DURATION_SEC,
  GOAL_PROMPT_TEXT_COLOR,
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH,
} from '../game/constants';
import { Maze, PlayerState } from '../mazeUtils';
import { buildMazeWorld } from './maze3d/mazeWorldBuilder';
import { toWorldX, toWorldZ } from './maze3d/worldCoordinates';

// MazeView3Dコンポーネントの入力プロパティ。
type MazeView3DProps = {
  // 投影元となる迷路データ。
  maze: Maze;
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
};

// カメラ補間で扱う姿勢値（平面位置+方位）。
type CameraPose = {
  x: number;
  z: number;
  yaw: number;
};

// 平面方向ベクトル（XZ）。
type XZVector = {
  x: number;
  z: number;
};

/**
 * プレイヤー方角をThree.jsのY回転角へ変換する。
 * @param dir 方角コード（N/E/S/W）
 * @returns カメラのyaw角（ラジアン）
 */
const toCameraYaw = (dir: PlayerState['dir']): number => {
  if (dir === 'N') return 0;
  if (dir === 'E') return -Math.PI / 2;
  if (dir === 'S') return Math.PI;
  return Math.PI / 2;
};

/**
 * プレイヤー向きの前方ベクトルを返す。
 * @param dir 方角コード（N/E/S/W）
 * @returns XZ平面の前方単位ベクトル
 */
const toForwardVector = (dir: PlayerState['dir']): XZVector => {
  if (dir === 'N') return { x: 0, z: -1 };
  if (dir === 'E') return { x: 1, z: 0 };
  if (dir === 'S') return { x: 0, z: 1 };
  return { x: -1, z: 0 };
};

/**
 * 方角つきプレイヤー状態をカメラ姿勢へ変換する。
 * @param player プレイヤー座標と向き
 * @returns カメラ配置に使う姿勢値
 */
const toCameraPose = (player: PlayerState): CameraPose => ({
  x: toWorldX(player.x) - toForwardVector(player.dir).x * CAMERA_BACK_OFFSET,
  z: toWorldZ(player.y) - toForwardVector(player.dir).z * CAMERA_BACK_OFFSET,
  yaw: toCameraYaw(player.dir),
});

/**
 * 角度を -PI..PI の範囲へ正規化する。
 * @param angle 正規化前の角度（ラジアン）
 * @returns 正規化後角度
 */
const normalizeAngle = (angle: number): number => {
  let normalized = angle;
  while (normalized <= -Math.PI) normalized += Math.PI * 2;
  while (normalized > Math.PI) normalized -= Math.PI * 2;
  return normalized;
};

/**
 * fromからtoへ最短回転で到達する角度差を返す。
 * @param from 開始角度（ラジアン）
 * @param to 目標角度（ラジアン）
 * @returns 最短角度差（ラジアン）
 */
const getShortestAngleDelta = (from: number, to: number): number =>
  normalizeAngle(to - from);

/**
 * イージング付き補間係数を返す。
 * @param t 0..1 の時間進捗
 * @returns 0..1 のイージング済み係数
 */
const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

/**
 * オブジェクト配下のジオメトリ/マテリアルを破棄する。
 * @param root 破棄対象ルート
 */
const disposeObject3D = (root: THREE.Object3D) => {
  root.traverse((child) => {
    const meshLike = child as THREE.Mesh;
    if (meshLike.geometry) {
      meshLike.geometry.dispose();
    }
    if (Array.isArray(meshLike.material)) {
      meshLike.material.forEach((material) => material.dispose());
    } else if (meshLike.material) {
      meshLike.material.dispose();
    }
  });
};

/**
 * グループ内オブジェクトを全削除してGPU資源を解放する。
 * @param group クリア対象のグループ
 */
const clearGroup = (group: THREE.Group) => {
  const targets = [...group.children];
  targets.forEach((child) => {
    group.remove(child);
    disposeObject3D(child);
  });
};

/**
 * 1人称の3D迷路ビューをThree.jsで描画する。
 * @param maze 迷路データ
 * @param player プレイヤー位置と向き
 * @param checkpoints 全チェックポイント座標
 * @param passedCheckpointKeys 通過済みチェックポイント座標キー集合
 * @param goalActive ゴール有効化状態
 * @param finished クリア済み状態
 * @returns Three.js 3Dビューと通知UI
 */
export function MazeView3D({
  maze,
  player,
  checkpoints,
  passedCheckpointKeys,
  goalActive,
  finished,
}: MazeView3DProps) {
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
  // 前フレーム位置。ゴールへの進入を検知する。
  const previousPlayerPosRef = useRef({ x: player.x, y: player.y });
  // カメラ補間判定用の前回プレイヤー状態。
  const previousCameraPlayerRef = useRef({ x: player.x, y: player.y, dir: player.dir });
  // 同一内容のデバッグログ連続出力を抑制するための前回スナップショット。
  const lastDebugSnapshotRef = useRef('');

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
      return;
    }
    // チェックポイント達成でゴールが解放された瞬間のみ表示する。
    if (!wasGoalActive && goalActive && checkpoints.length > 0) {
      setShowGoalPrompt(true);
    }
  }, [goalActive, checkpoints.length]);

  useEffect(() => {
    const previousPos = previousPlayerPosRef.current;
    previousPlayerPosRef.current = { x: player.x, y: player.y };
    // 「未解放ゴールへの進入」時だけ警告を表示する。
    const enteredLockedGoal =
      !goalActive &&
      player.x === GOAL.x &&
      player.y === GOAL.y &&
      (previousPos.x !== GOAL.x || previousPos.y !== GOAL.y);
    if (!enteredLockedGoal) return;

    setShowGoalLockedWarning(true);
    if (goalLockedWarningTimerRef.current !== null) {
      window.clearTimeout(goalLockedWarningTimerRef.current);
    }
    goalLockedWarningTimerRef.current = window.setTimeout(() => {
      setShowGoalLockedWarning(false);
      goalLockedWarningTimerRef.current = null;
    }, GOAL_LOCKED_WARNING_DURATION_MS);
  }, [goalActive, player.x, player.y]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(VIEWPORT_WIDTH, VIEWPORT_HEIGHT, true);
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
    const worldGroup = worldGroupRef.current;
    if (!worldGroup) return;
    clearGroup(worldGroup);
    buildMazeWorld({
      root: worldGroup,
      maze,
      checkpoints,
      passedCheckpointKeys,
      goalActive,
    });
    renderScene();
  }, [maze, checkpoints, passedCheckpointKeys, goalActive]);

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
      passedCheckpointCount: passedCheckpointKeys.size,
      objectCount: worldGroup.children.length,
      kindCounts,
    };

    const snapshot = JSON.stringify(debugPayload);
    // 同一状態ならログ出力を抑制してノイズを減らす。
    if (lastDebugSnapshotRef.current === snapshot) return;
    lastDebugSnapshotRef.current = snapshot;
    console.log('[MazeView3D] three-world-debug', debugPayload);
  }, [checkpoints, passedCheckpointKeys, player]);

  return (
    <div
      style={{
        position: 'relative',
        width: VIEWPORT_WIDTH,
        height: VIEWPORT_HEIGHT,
        background: '#020503',
        borderRadius: 4,
        overflow: 'hidden',
      }}
    >
      <style>
        {`@keyframes maze-view-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }`}
      </style>
      <canvas
        ref={canvasRef}
        width={VIEWPORT_WIDTH}
        height={VIEWPORT_HEIGHT}
        style={{
          position: 'absolute',
          inset: 0,
          width: `${VIEWPORT_WIDTH}px`,
          height: `${VIEWPORT_HEIGHT}px`,
          display: 'block',
        }}
      />
      {(showGoalPrompt || showGoalLockedWarning || finished) && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 30,
            transform: 'translateX(-50%)',
            fontSize: 15,
            fontFamily: '"Courier New", "Lucida Console", monospace',
            color: GOAL_PROMPT_TEXT_COLOR,
            animationName: 'maze-view-blink',
            animationDuration: `${
              showGoalLockedWarning
                ? GOAL_LOCKED_WARNING_BLINK_DURATION_SEC
                : GOAL_PROMPT_BLINK_DURATION_SEC
            }s`,
            animationIterationCount: 'infinite',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            textShadow: '0 0 8px rgba(203, 255, 217, 0.45)',
          }}
        >
          {showGoalLockedWarning ? 'チェックポイントを回収せよ！' : finished ? 'GOAL！' : 'ゴールに向かえ！'}
        </div>
      )}
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
