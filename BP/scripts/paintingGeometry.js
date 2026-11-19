// The roller stays in the clicked face's plane; it never wraps around an edge.
export const PAINT_FACE_NORMALS = Object.freeze({
  North: {x: 0, y: 0, z: -1}, South: {x: 0, y: 0, z: 1},
  East: {x: 1, y: 0, z: 0}, West: {x: -1, y: 0, z: 0},
  Up: {x: 0, y: 1, z: 0}, Down: {x: 0, y: -1, z: 0},
});

export function paintingPositions(location, face, roller = false) {
  const normal = PAINT_FACE_NORMALS[face];
  if (!normal) return [];
  const result = [{x: location.x, y: location.y, z: location.z}];
  if (!roller) return result;
  const axes = normal.y ? ['x', 'z'] : normal.x ? ['y', 'z'] : ['x', 'y'];
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    if (a === 0 && b === 0) continue;
    const position = {x: location.x, y: location.y, z: location.z};
    position[axes[0]] += a;
    position[axes[1]] += b;
    result.push(position);
  }
  return result;
}
