// Areas and walls: which creatures a spell's area really reaches.
//
// Core Rulebook, Magic, Aiming a Spell:
//   - Burst: "A burst spell affects whatever it catches in its area ... A burst spell can't affect creatures with
//     total cover from its point of origin (in other words, its effects don't extend around corners)."
//   - Emanation: "functions like a burst spell, except that the effect continues to radiate from the point of
//     origin for the duration of the spell."
//   - Spread: "A spread spell extends out like a burst but can turn corners. You select the point of origin, and
//     the spell spreads out a given distance in all directions. Figure the area the spell effect fills by taking
//     into account any turns the spell effect takes."
//   - Line of effect: "a straight, unblocked path ... A solid barrier cancels a line of effect."
// Cones and lines are aimed from their point of origin like a burst.
//
// Foundry's template is the most the area can reach; the walls then decide. A burst, emanation, cone or line
// reaches a creature when a straight line from the point of origin to one of its squares crosses no wall that
// blocks movement (a window still stops a fireball). A spread reaches a square when the distance walked to it
// from the point of origin, around those walls, is within the radius (squares counted as for movement: the
// second diagonal costs 10 feet). Doors are walls while closed. Limits: the map is flat (no height), a square
// counts by its center, and gridless scenes use the straight-line rule for spreads too.

import { MODULE_ID } from "./const.mjs";

export const KIND_FLAG = "areaKind"; // template flag: "spread" | "burst" (also emanation, cone, line) | null

/** The kind of area from a spell's Area or Effect text: "spread", "burst" (line of effect from the origin), or null. */
export function areaKind(text) {
  const t = String(text ?? "").toLowerCase();
  if (/\bspreads?\b/.test(t)) return "spread";
  if (/\b(burst|emanation|emanating|cone|line|cylinder|sphere|radius)\b/.test(t)) return "burst";
  return null;
}

// Record the kind when PF1 places a spell's template (its origin is the action that placed it)
Hooks.on("preCreateMeasuredTemplate", (template) => {
  if (template.flags?.[MODULE_ID]?.[KIND_FLAG] !== undefined) return;
  const origin = template.flags?.pf1?.origin?.uuid;
  if (!origin) return;
  const [itemUuid, actionId] = origin.split(".Action.");
  const item = fromUuidSync(itemUuid);
  const action = item?.actions?.get?.(actionId) ?? item?.defaultAction;
  const kind = action ? areaKind(`${action.area ?? ""} ${action.effect ?? ""}`) : null;
  if (kind) template.updateSource({ [`flags.${MODULE_ID}.${KIND_FLAG}`]: kind });
});

const blocked = (a, b) => !!CONFIG.Canvas.polygonBackends.move.testCollision(a, b, { type: "move", mode: "any" });

// Spread results are cached by the template's place and size, and dropped when a wall changes
const spreadCache = new Map();
for (const hook of ["createWall", "updateWall", "deleteWall"]) Hooks.on(hook, () => spreadCache.clear());
Hooks.on("canvasReady", () => spreadCache.clear());

/** The squares ("i,j") a spread from the template's origin reaches, walking around walls. */
function spreadSquares(template) {
  const scene = template.parent;
  const key = `${template.uuid}|${template.x}|${template.y}|${template.distance}`;
  if (spreadCache.has(key)) return spreadCache.get(key);
  // One entry per template: a moved cloud or sphere replaces its old position
  for (const k of spreadCache.keys()) if (k.startsWith(`${template.uuid}|`)) spreadCache.delete(k);
  const grid = scene.grid;
  const step = grid.distance;
  const radius = template.distance;
  const center = (i, j) => grid.getCenterPoint({ i, j });
  const origin = { x: template.x, y: template.y };
  // The squares touching the point of origin start the walk (5 feet away)
  const quarter = grid.size / 4;
  const starts = new Map();
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const o = grid.getOffset({ x: origin.x + dx * quarter, y: origin.y + dy * quarter });
    const c = center(o.i, o.j);
    if (!blocked(origin, c)) starts.set(`${o.i},${o.j}`, o);
  }
  // Dijkstra over (square, diagonal parity); the cost includes the square itself. Costs are whole squares (one
  // or two steps), so a bucket per cost replaces sorting the queue
  const best = new Map(); // "i,j,p" -> lowest cost queued
  const buckets = [];
  const push = (n) => {
    const k = `${n.i},${n.j},${n.p}`;
    if (best.has(k) && best.get(k) <= n.cost) return false;
    best.set(k, n.cost);
    (buckets[Math.round(n.cost / step)] ??= []).push(n);
    return true;
  };
  // A point of origin on a grid intersection (the rules' placement): its four squares are 5 feet away. A template
  // placed on a square's center (PF1 can snap circles there): that square is the origin, and its neighbours 5 feet
  const startCost = starts.size === 1 ? 0 : step;
  for (const o of starts.values()) push({ i: o.i, j: o.j, p: 0, cost: startCost });
  const reached = new Set();
  for (let b = 0; b < buckets.length; b++) {
    for (const cur of buckets[b] ?? []) {
      if (best.get(`${cur.i},${cur.j},${cur.p}`) < cur.cost) continue; // reached more cheaply since
      reached.add(`${cur.i},${cur.j}`);
      const from = center(cur.i, cur.j);
      for (let di = -1; di <= 1; di++) {
        for (let dj = -1; dj <= 1; dj++) {
          if (!di && !dj) continue;
          const diagonal = di && dj;
          const cost = cur.cost + (diagonal ? (cur.p ? 2 * step : step) : step);
          if (cost > radius) continue;
          const ni = cur.i + di;
          const nj = cur.j + dj;
          const p = diagonal ? 1 - cur.p : cur.p;
          const k = `${ni},${nj},${p}`;
          if (best.has(k) && best.get(k) <= cost) continue; // no better: skip the wall test
          if (blocked(from, center(ni, nj))) continue;
          push({ i: ni, j: nj, p, cost });
        }
      }
    }
  }
  spreadCache.set(key, reached);
  return reached;
}

/** The squares a token occupies, as grid offsets. */
function squaresOf(token) {
  const grid = token.parent.grid;
  return token.getOccupiedGridSpaceOffsets?.() ?? [grid.getOffset({ x: token.x + grid.size / 2, y: token.y + grid.size / 2 })];
}

/**
 * Does the template's area reach the token, given the walls? True when the template has no recorded kind, when
 * its scene isn't on the canvas (the walls aren't loaded), or when nothing blocks the way.
 */
export function reaches(template, token) {
  const kind = template.flags?.[MODULE_ID]?.[KIND_FLAG];
  const scene = template.parent;
  if (!kind || !canvas.ready || canvas.scene !== scene || !token) return true;
  const grid = scene.grid;
  const squares = squaresOf(token);
  const origin = { x: template.x, y: template.y };
  // Within the template with a clear line from the point of origin: reached, whatever the kind of area
  if (squares.some((o) => !blocked(origin, grid.getCenterPoint(o)))) return true;
  // A spread also turns corners, as far as its radius walked around the walls
  if (kind === "spread" && grid.type === CONST.GRID_TYPES.SQUARE) {
    const reached = spreadSquares(template);
    return squares.some((o) => reached.has(`${o.i},${o.j}`));
  }
  return false;
}

export const _test = { areaKind, spreadSquares, spreadCache };
