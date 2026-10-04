// Original land-side civil works. The lake remains outside the flight boundary.
export function addReservoirEngineering({ solid, detailBox }) {
  // The inspection gallery is a continuous concrete terrace, not a floating deck.
  solid('platform-intake-gallery', [-7, 0, -25], [4.5, 3.35, -21]);
  solid('building-intake-controls', [-6, 3.35, -25], [-2, 6.2, -23.3]);
  solid('rail-intake-front', [-7, 4.25, -21.08], [4.5, 4.4, -20.92]);
  solid('rail-intake-west', [-7.08, 3.35, -25], [-6.92, 4.4, -21]);
  solid('rail-intake-east', [4.42, 3.35, -25], [4.58, 4.4, -21]);
  solid('building-intake-service-cabinet', [-0.9, 3.35, -25], [0.9, 8.5, -24]);
  detailBox('blue-enamel', [3.7, 2.5, 0.035], [-4, 4.75, -23.278]);
  detailBox('closed-window', [2.4, 1.2, 0.04], [-4, 5, -23.25]);
  for (const x of [-4.82, -4, -3.18])
    detailBox('chalk-enamel', [0.06, 1.25, 0.05], [x, 5, -23.218]);
  detailBox('safety-yellow', [3.7, 0.12, 0.045], [-4, 3.56, -23.245]);
  detailBox('oxidized-roof', [1.78, 5.1, 0.03], [0, 5.92, -23.978]);
  for (let y = 4; y < 8.3; y += 0.55)
    detailBox('chalk-enamel', [1.5, 0.045, 0.04], [0, y, -23.952]);
  for (const x of [-6.5, -5, -3.5, -2, -0.5, 1, 2.5, 4])
    detailBox('safety-yellow', [0.55, 0.17, 0.025], [x, 4.32, -20.905]);
  // A clear inspection landing mark on the supported eastern gallery.
  for (const x of [1.7, 2.7])
    detailBox('chalk-enamel', [0.15, 0.016, 1.65], [x, 3.365, -22.65]);
  detailBox('chalk-enamel', [1.05, 0.016, 0.15], [2.2, 3.366, -22.65]);

  // Dry overflow/maintenance chute. Each sloping part is one solid rotated box,
  // drawn by the canonical renderer and exported with the identical quaternion.
  const angle = Math.atan2(9.5, 20),
    rotation = [Math.sin(angle / 2), 0, 0, Math.cos(angle / 2)],
    length = Math.hypot(9.5, 20),
    normal = [0, Math.cos(angle), Math.sin(angle)],
    topMiddle = [-11, 5.1, -15];
  const slope = (id, x, width, thickness, normalOffset) => {
    const centre = [x, topMiddle[1] + normal[1] * normalOffset, topMiddle[2] + normal[2] * normalOffset],
      half = [width / 2, thickness / 2, length / 2];
    solid(id, centre.map((v, i) => v - half[i]), centre.map((v, i) => v + half[i]), rotation);
  };
  slope('platform-dry-spillway', -11, 4, 0.3, -0.15);
  slope('rail-dry-spillway-west', -12.9, 0.3, 0.8, 0.4);
  slope('rail-dry-spillway-east', -9.1, 0.3, 0.8, 0.4);
  solid('platform-spillway-head', [-13, 9.2, -29.8], [-8, 9.85, -24.9]);
  solid('building-spillway-support-north', [-12.65, 0, -23.2], [-9.35, 8.35, -22.7]);
  solid('building-spillway-support-south', [-12.65, 0, -12.2], [-9.35, 3.1, -11.7]);
  solid('platform-spillway-apron', [-14, 0, -5.15], [-8, 0.35, 0.5]);
  // Flush seams explain metre scale without drawing a second collision shell.
  for (let z = -23; z < -5; z += 2.6) {
    const y = 9.85 - ((z + 25) / 20) * 9.5;
    detailBox('oxidized-roof', [3.45, 0.012, 0.045], [-11, y + 0.013, z], [angle, 0, 0]);
  }
  for (const x of [-12.25, -9.75])
    detailBox('safety-yellow', [0.12, 0.018, 3.4], [x, 0.37, -1.95]);
  for (const z of [-3.55, -0.35])
    detailBox('chalk-enamel', [2.6, 0.018, 0.12], [-11, 0.371, z]);
}
