import * as THREE from 'three';

/**
 * オブジェクト配下のジオメトリ/マテリアルを破棄する。
 * @param root 破棄対象ルート
 */
export const disposeObject3D = (root: THREE.Object3D): void => {
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
export const clearGroup = (group: THREE.Group): void => {
  const targets = [...group.children];
  targets.forEach((child) => {
    group.remove(child);
    disposeObject3D(child);
  });
};
