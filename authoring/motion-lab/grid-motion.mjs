// One held command, no retained taps. Grid cells occupy [n,n+1], so centers are n+0.5.
const EPSILON = 1e-8;
const vectors = {up:[0,-1],right:[1,0],down:[0,1],left:[-1,0]};
const centered = value => Math.abs(value-(Math.round(value-.5)+.5)) < EPSILON;
export const isGridCenter = state => centered(state.x) && centered(state.y);

export function routeForPolicy(route, policy = "immediate") {
  return policy === "grid-center" ? route.map(point => ({x:Math.floor(point.x)+.5,y:Math.floor(point.y)+.5})) : route;
}

export function nextGridCenter(state, board) {
  const [dx,dy] = vectors[state.direction];
  const coordinate = dx ? state.x : state.y, sign = dx || dy;
  let target = sign > 0 ? Math.floor(coordinate-.5+EPSILON)+1.5 : Math.ceil(coordinate-.5-EPSILON)-.5;
  const high = (dx ? board.columns : board.rows)-.5;
  target = Math.max(.5,Math.min(high,target));
  return {x:dx ? target : state.x,y:dy ? target : state.y};
}

export function moveOnGrid(previous, requested, distance, board) {
  const state = {...previous,queuedDirection:null};
  if (!requested) return {...state,speed:0};
  if (!vectors[requested]) throw new Error("Unknown cardinal command");
  if (isGridCenter(state)) state.direction = requested;
  else if (requested !== state.direction) state.queuedDirection = requested;
  let remaining = Math.max(0,distance);
  while (remaining > EPSILON) {
    // A command is consumed at the center, before spending any remaining travel distance.
    if (isGridCenter(state)) {
      state.x = Math.round(state.x-.5)+.5; state.y = Math.round(state.y-.5)+.5;
      state.direction = requested; state.queuedDirection = null;
    }
    const target = nextGridCenter(state,board);
    const toCenter = Math.abs(target.x-state.x)+Math.abs(target.y-state.y);
    if (toCenter < EPSILON) {state.speed=0; state.queuedDirection=null; break;}
    const [dx,dy] = vectors[state.direction], travel = Math.min(remaining,toCenter);
    state.x += dx*travel; state.y += dy*travel; remaining -= travel;
    state.travelDistance=(state.travelDistance||0)+travel;
    if (travel >= toCenter-EPSILON) {
      state.x=target.x; state.y=target.y;
      state.direction=requested; state.queuedDirection=null;
    }
  }
  return state;
}
