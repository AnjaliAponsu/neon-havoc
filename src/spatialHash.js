// NEON HAVOC — Fast 2D Spatial Hash Grid for O(1) Collision Queries

export class SpatialHashGrid {
  constructor(cellSize = 140) {
    this.cellSize = cellSize;
    this.cells = new Map();
  }

  clear() {
    this.cells.clear();
  }

  _hash(cx, cy) {
    return (cx + 500) * 2000 + (cy + 500);
  }

  insert(entity) {
    if (!entity || isNaN(entity.x) || isNaN(entity.y)) return;
    const cx = Math.floor(entity.x / this.cellSize);
    const cy = Math.floor(entity.y / this.cellSize);
    if (isNaN(cx) || isNaN(cy)) return;
    const key = this._hash(cx, cy);

    let cell = this.cells.get(key);
    if (!cell) {
      cell = [];
      this.cells.set(key, cell);
    }
    cell.push(entity);
  }

  queryNearby(x, y, radius = 60, callback) {
    if (isNaN(x) || isNaN(y) || isNaN(radius)) return;
    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCy = Math.floor((y - radius) / this.cellSize);
    const maxCy = Math.floor((y + radius) / this.cellSize);
    if (isNaN(minCx) || isNaN(maxCx) || isNaN(minCy) || isNaN(maxCy)) return;

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const key = this._hash(cx, cy);
        const cell = this.cells.get(key);
        if (cell) {
          for (let i = 0; i < cell.length; i++) {
            if (callback(cell[i]) === false) return; // early exit
          }
        }
      }
    }
  }
}

export const spatialGrid = new SpatialHashGrid(140);

