import { generateMaze, getInitialPlayerState, PlayerState, Maze } from './mazeUtils';

describe('mazeUtils', () => {
  // 迷路サイズ指定が結果に正しく反映されることを確認
  it('should generate a maze with correct dimensions', () => {
    const width = 8;
    const height = 6;
    const maze = generateMaze(width, height);
    expect(maze.length).toBe(height);
    expect(maze[0].length).toBe(width);
  });

  // すべてのセルに 4 方向の壁情報があることを確認
  it('should have all cells with walls property', () => {
    const maze = generateMaze(5, 5);
    for (const row of maze) {
      for (const cell of row) {
        expect(cell).toHaveProperty('walls');
        expect(typeof cell.walls.N).toBe('boolean');
        expect(typeof cell.walls.E).toBe('boolean');
        expect(typeof cell.walls.S).toBe('boolean');
        expect(typeof cell.walls.W).toBe('boolean');
      }
    }
  });

  // 初期プレイヤー位置と向きの仕様を確認
  it('should return initial player state at (0,0) facing East', () => {
    const player = getInitialPlayerState();
    expect(player.x).toBe(0);
    expect(player.y).toBe(0);
    expect(player.dir).toBe('E');
  });
});
