import {
  generateMaze,
  getInitialPlayerState,
  getRandomGoalExit,
  getRandomStartPosition,
  Maze,
} from './mazeUtils';

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
  it('should return initial player state at provided start position facing open direction', () => {
    const maze: Maze = [
      [
        { x: 0, y: 0, walls: { N: true, E: true, S: true, W: true } },
        { x: 1, y: 0, walls: { N: true, E: true, S: true, W: true } },
        { x: 2, y: 0, walls: { N: true, E: true, S: true, W: true } },
        { x: 3, y: 0, walls: { N: true, E: true, S: true, W: true } },
      ],
      [
        { x: 0, y: 1, walls: { N: true, E: true, S: true, W: true } },
        { x: 1, y: 1, walls: { N: true, E: true, S: true, W: true } },
        { x: 2, y: 1, walls: { N: true, E: true, S: true, W: true } },
        { x: 3, y: 1, walls: { N: true, E: true, S: false, W: true } },
      ],
      [
        { x: 0, y: 2, walls: { N: true, E: true, S: true, W: true } },
        { x: 1, y: 2, walls: { N: true, E: true, S: true, W: true } },
        { x: 2, y: 2, walls: { N: true, E: true, S: true, W: true } },
        { x: 3, y: 2, walls: { N: true, E: true, S: false, W: true } },
      ],
    ];
    const player = getInitialPlayerState(maze, { x: 3, y: 2 });
    expect(player.x).toBe(3);
    expect(player.y).toBe(2);
    expect(player.dir).toBe('S');
  });

  // 開通方向が複数ある場合は優先順（N→E→S→W）で初期向きを選ぶことを確認
  it('should prioritize open direction order N, E, S, W for initial facing', () => {
    const maze: Maze = [
      [
        { x: 0, y: 0, walls: { N: false, E: false, S: true, W: true } },
      ],
    ];
    const player = getInitialPlayerState(maze, { x: 0, y: 0 });
    expect(player.dir).toBe('N');
  });

  // 行き止まり候補がある場合は開始位置に優先採用されることを確認
  it('should prioritize dead-end cells for random start position', () => {
    const maze: Maze = [
      [
        { x: 0, y: 0, walls: { N: true, E: false, S: true, W: true } },
        { x: 1, y: 0, walls: { N: true, E: true, S: false, W: false } },
      ],
      [
        { x: 0, y: 1, walls: { N: true, E: false, S: true, W: true } },
        { x: 1, y: 1, walls: { N: false, E: true, S: true, W: false } },
      ],
    ];
    const start = getRandomStartPosition(maze, [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]);
    expect(start).toEqual({ x: 0, y: 1 });
  });

  // ゴール出口は外周セルから選ばれ、外向き壁が開くことを確認
  it('should pick edge goal and open outward wall', () => {
    const maze: Maze = [
      [
        { x: 0, y: 0, walls: { N: true, E: true, S: false, W: true } },
        { x: 1, y: 0, walls: { N: true, E: true, S: true, W: true } },
        { x: 2, y: 0, walls: { N: true, E: true, S: true, W: true } },
      ],
      [
        { x: 0, y: 1, walls: { N: false, E: true, S: true, W: true } },
        { x: 1, y: 1, walls: { N: true, E: true, S: true, W: true } },
        { x: 2, y: 1, walls: { N: true, E: true, S: true, W: true } },
      ],
      [
        { x: 0, y: 2, walls: { N: true, E: true, S: true, W: true } },
        { x: 1, y: 2, walls: { N: true, E: true, S: true, W: true } },
        { x: 2, y: 2, walls: { N: true, E: true, S: true, W: true } },
      ],
    ];
    const goalExit = getRandomGoalExit(maze, [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 0, y: 2 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
    ]);
    expect(goalExit).toEqual({ x: 1, y: 0, dir: 'N' });
    expect(maze[0][1].walls.N).toBe(false);
  });

  // 行き止まりでなくても外周候補としてゴールに選ばれることを確認
  it('should allow non-dead-end edge cell as goal', () => {
    const maze: Maze = [
      [
        { x: 0, y: 0, walls: { N: true, E: true, S: true, W: true } },
        { x: 1, y: 0, walls: { N: true, E: true, S: false, W: true } },
      ],
      [
        { x: 0, y: 1, walls: { N: true, E: true, S: true, W: true } },
        { x: 1, y: 1, walls: { N: false, E: true, S: true, W: true } },
      ],
    ];
    const goalExit = getRandomGoalExit(maze, [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ]);
    expect(goalExit.x).toBe(1);
    expect(goalExit.y).toBe(0);
    expect(['N', 'E']).toContain(goalExit.dir);
    expect(maze[0][1].walls[goalExit.dir]).toBe(false);
  });

  // 行き止まりが存在しない場合は通常セルから開始位置を選ぶことを確認
  it('should fallback to non-dead-end cells when maze has no dead end candidates', () => {
    const maze: Maze = [
      [
        { x: 0, y: 0, walls: { N: true, E: false, S: false, W: true } },
        { x: 1, y: 0, walls: { N: true, E: true, S: false, W: false } },
      ],
      [
        { x: 0, y: 1, walls: { N: false, E: false, S: true, W: true } },
        { x: 1, y: 1, walls: { N: false, E: true, S: true, W: false } },
      ],
    ];
    const start = getRandomStartPosition(maze, [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ]);
    expect(start).toEqual({ x: 1, y: 1 });
  });
});
