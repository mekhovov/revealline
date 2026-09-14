import {bladeAngles, componentPose, rotorAnchors} from "./animation.mjs";

const TAU = Math.PI * 2;
const polygon = (ctx, points) => {ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill();};

// Source anchors use the actual contained image rectangle, including any transparent source padding.
export function fittedBodySize(body, image, scale = 1) {
  const width = body.widthCells * scale, height = body.heightCells * scale;
  if (!image) return {width, height};
  const factor = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  return {width: image.naturalWidth * factor, height: image.naturalHeight * factor};
}

function drawEffect(ctx, component, animation, width, height, speedRatio, reduced, pixel) {
  const pose = componentPose(component, animation, speedRatio, reduced);
  for (const [x, y, side = 1] of component.anchors || []) {
    ctx.save(); ctx.translate(x * width, y * height);
    if (component.type === "wings") {
      ctx.scale(side, 1); ctx.rotate(pose.angle * side);
      const span = pose.span * width, chord = component.chord * height;
      ctx.fillStyle = component.color;
      polygon(ctx, [[0,-chord*.3],[span*.32,-chord*.5],[span*.78,-chord*.25],[span,0],[span*.87,chord*.22],[span*.64,chord*.28],[span*.6,chord*.48],[span*.33,chord*.4],[0,chord*.25]]);
      ctx.fillStyle = component.tipColor;
      polygon(ctx, [[span*.66,-chord*.25],[span,0],[span*.87,chord*.22],[span*.64,chord*.28],[span*.6,chord*.48],[span*.5,chord*.32]]);
    } else if (component.type === "thruster") {
      const w = component.width * width, length = pose.length * height;
      ctx.fillStyle = component.color;
      polygon(ctx, [[-w/2,0],[w/2,0],[w/2,length*.35],[w*.25,length*.35],[w*.25,length*.72],[0,length],[-w*.25,length*.72],[-w*.25,length*.35],[-w/2,length*.35]]);
      ctx.fillStyle = component.innerColor; ctx.fillRect(-w*.22,0,w*.44,length*.48);
    } else if (component.type === "pulse") {
      ctx.globalAlpha = pose.opacity; ctx.strokeStyle = component.color; ctx.lineWidth = Math.max(pixel, width * .013);
      ctx.beginPath(); ctx.ellipse(0,0,pose.radius*width,pose.radius*height*.7,0,0,TAU); ctx.stroke();
    } else if (component.type === "blink") {
      ctx.globalAlpha = pose.opacity; ctx.fillStyle = component.color;
      const size = component.size * width; ctx.fillRect(-size/2,-size/2,size,size);
    }
    ctx.restore();
  }
}

function drawRotors(ctx, body, component, animation, width, height, reduced, pixel, slowInspection) {
  const rate = animation.rates[component.id];
  for (const anchor of rotorAnchors(body)) {
    const radius = component.radius * anchor.radiusScale * width;
    const phase = reduced ? 0 : animation.phases[component.id] || 0;
    const offset = (anchor.phaseDegrees + component.phaseDegrees) * Math.PI / 180;
    ctx.save(); ctx.translate(anchor.x * width, anchor.y * height);
    if (!reduced && !slowInspection && rate?.rawRps > 5) {
      ctx.globalAlpha = component.blurOpacity * Math.min(rate.rawRps / 17, 1);
      ctx.fillStyle = component.fillColor; ctx.beginPath(); ctx.arc(0,0,radius,0,TAU); ctx.fill(); ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = component.fillColor; ctx.globalAlpha = .24; ctx.lineWidth = Math.max(pixel*.7, width*.006);
    ctx.beginPath(); ctx.arc(0,0,radius,0,TAU); ctx.stroke(); ctx.globalAlpha = 1;
    const thickness = radius * component.bladeWidth;
    for (const angle of bladeAngles(anchor.bladeCount ?? component.bladeCount, phase * component.direction * anchor.direction + offset)) {
      ctx.save(); ctx.rotate(angle); ctx.fillStyle = component.fillColor;
      const points = component.bladeShape === "paddle"
        ? [[0,-thickness*.25],[radius*.38,-thickness*.25],[radius*.42,-thickness*.7],[radius,-thickness*.7],[radius,thickness*.55],[radius*.42,thickness*.55],[radius*.35,thickness*.2],[0,thickness*.2]]
        : component.bladeShape === "tapered"
        ? [[0,-thickness*.3],[radius*.75,-thickness*.6],[radius,0],[radius*.6,thickness*.45],[0,thickness*.3]]
        : [[0,-thickness*.2],[radius*.55,-thickness*.38],[radius,-thickness*.12],[radius*.9,thickness*.56],[radius*.5,thickness*.7],[0,thickness*.23]];
      polygon(ctx, points);
      ctx.fillStyle = component.tipColor; ctx.fillRect(radius*.78,-thickness*.08,radius*.16,thickness*.35);
      ctx.restore();
    }
    ctx.fillStyle = component.hubColor; const hub = Math.max(width*.027, pixel*.7); ctx.fillRect(-hub/2,-hub/2,hub,hub);
    ctx.restore();
  }
}

export function paintCharacter(ctx, {body, image, recipe, animation, colors, scale = 1, x = 0, y = 0, heading = 0, bank = 0, speedRatio = 0, reducedMotion = false, showRotors = true, pixel = .05, inspectionSlow = false}) {
  const {width, height} = fittedBodySize(body, image, scale);
  ctx.save(); ctx.translate(x,y); ctx.rotate(heading + body.headingOffsetDegrees*Math.PI/180);
  const tilt = reducedMotion ? 0 : bank;
  ctx.transform(1,0,tilt,1-Math.abs(tilt)*.35,0,0);
  ctx.fillStyle = "rgba(0,0,0,.4)"; ctx.beginPath(); ctx.ellipse(.04,.08,width*.23,height*.25,0,0,TAU); ctx.fill();
  // Attachments are omitted when their body image is unavailable: the neutral marker stays honest.
  if (image) for (const component of recipe.components.filter(c => ["wings","thruster","pulse"].includes(c.type))) drawEffect(ctx, component, animation, width, height, speedRatio, reducedMotion, pixel);
  if (image) {
    ctx.imageSmoothingEnabled = body.sampling === "linear";
    ctx.shadowColor = colors.body; ctx.shadowBlur = 1.2;
    ctx.drawImage(image,-width/2,-height/2,width,height); ctx.shadowBlur = 0;
    if (body.centerMark) {
      const w = body.centerMark.widthCells*scale, h = body.centerMark.heightCells*scale;
      ctx.fillStyle = body.centerMark.topColor; ctx.fillRect(-w/2,-h/2,w,h/2);
      ctx.fillStyle = body.centerMark.bottomColor; ctx.fillRect(-w/2,0,w,h/2);
    }
  } else {
    ctx.fillStyle = colors.body; polygon(ctx, [[0,-height*.38],[width*.27,height*.28],[0,height*.13],[-width*.27,height*.28]]);
    ctx.fillStyle = colors.accent; ctx.fillRect(-width*.04,-height*.22,width*.08,height*.2);
  }
  if (image) for (const component of recipe.components) {
    if (component.type === "rotors" && showRotors) drawRotors(ctx, body, component, animation, width, height, reducedMotion, pixel, inspectionSlow);
    if (component.type === "blink") drawEffect(ctx, component, animation, width, height, speedRatio, reducedMotion, pixel);
  }
  ctx.restore();
}
