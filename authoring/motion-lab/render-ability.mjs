import {abilityReadout} from "./ability.mjs";
const TAU=Math.PI*2;
const circle=(ctx,x,y,r)=>{ctx.beginPath();ctx.arc(x,y,r,0,TAU);};
const label=(ctx,text,x,y,pixels,color)=>{
  ctx.font=`500 ${Math.max(.43,14/pixels)}px "Field Kit UI", "Field Kit Mono", sans-serif`;ctx.textAlign="center";ctx.fillStyle=color;
  const half=ctx.measureText(text).width/2;ctx.fillText(text,Math.max(half+.2,Math.min(48-half-.2,x)),y);
};

export function paintAbilityStage(ctx,state,config,player,{colors,pixels,family,reducedMotion=false}) {
  const vocab=config.vocabulary[family],readout=abilityReadout(state,config,player);
  ctx.save();ctx.lineWidth=Math.max(.035,1/pixels);
  for(const area of config.stage.haze){
    ctx.fillStyle=colors.slow;ctx.globalAlpha=.075;ctx.fillRect(area.x,area.y,area.width,area.height);ctx.globalAlpha=.45;ctx.strokeStyle=colors.slow;ctx.setLineDash([.3,.25]);ctx.strokeRect(area.x,area.y,area.width,area.height);ctx.setLineDash([]);ctx.globalAlpha=.75;
    label(ctx,vocab.hazeLabel,area.x+area.width/2,area.y+.8,pixels,colors.slow);
  }
  ctx.globalAlpha=1;
  for(const pad of config.stage.supplyPads){
    ctx.strokeStyle=colors.wall;ctx.globalAlpha=.5;ctx.setLineDash([.2,.2]);circle(ctx,pad.x,pad.y,pad.radius);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=.9;
    ctx.strokeRect(pad.x-.5,pad.y-.45,1,.9);ctx.fillStyle=colors.wall;ctx.fillRect(pad.x-.28,pad.y-.09,.56,.18);ctx.fillRect(pad.x-.09,pad.y-.28,.18,.56);
    label(ctx,`${vocab.supplyLabel} · R`,pad.x,pad.y+pad.radius+.65,pixels,colors.wall);
  }
  if(readout.equipment.budgetCapacity){
    ctx.globalAlpha=.45;ctx.strokeStyle=state.budget>0?colors.accent:colors.danger;ctx.setLineDash([.16,.14]);ctx.beginPath();ctx.moveTo(state.tetherAnchor.x,state.tetherAnchor.y);ctx.lineTo(player.x,player.y);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
  }
  if(!reducedMotion)for(const point of state.wake){ctx.globalAlpha=Math.max(0,(point.until-state.time)/point.duration)*.3;ctx.fillStyle=colors.accent;ctx.fillRect(point.x-.05,point.y-.05,.1,.1);}
  ctx.globalAlpha=1;
  for(const target of state.targets){
    const active=target.status==="ready",revealed=target.revealedUntil>state.time;
    ctx.globalAlpha=active?1:.36;ctx.strokeStyle=active?target.kind==="air"?colors.accent:colors.wall:colors.slow;ctx.fillStyle=colors.arena;
    if(target.kind==="delivery"){ctx.strokeRect(target.x-.65,target.y-.65,1.3,1.3);ctx.strokeRect(target.x-.32,target.y-.32,.64,.64);}
    else if(target.kind==="relay"){ctx.beginPath();ctx.moveTo(target.x,target.y-.65);ctx.lineTo(target.x+.5,target.y);ctx.lineTo(target.x,target.y+.65);ctx.lineTo(target.x-.5,target.y);ctx.closePath();ctx.stroke();}
    else{circle(ctx,target.x,target.y,target.kind==="note"?.36:.43);ctx.fill();ctx.stroke();}
    if(!active){ctx.beginPath();ctx.moveTo(target.x-.18,target.y);ctx.lineTo(target.x-.02,target.y+.14);ctx.lineTo(target.x+.22,target.y-.18);ctx.stroke();}
    if(target.netProgress>0&&active){ctx.strokeStyle=colors.slow;circle(ctx,target.x,target.y,.64);ctx.stroke();}
    const text=target.kind==="note"?(revealed?target.label:"?"):target.label.replace("Tile ","");
    label(ctx,text,target.x,target.y+(target.kind==="note"&&!revealed?.16:1.1),pixels,revealed?colors.accent:colors.body);
  }
  ctx.globalAlpha=1;
  for(const field of state.fields){
    ctx.save();circle(ctx,field.x,field.y,field.radius);ctx.clip();ctx.strokeStyle=colors.slow;ctx.globalAlpha=.35;
    for(let x=field.x-field.radius;x<=field.x+field.radius;x+=.4){ctx.beginPath();ctx.moveTo(x,field.y-field.radius);ctx.lineTo(x,field.y+field.radius);ctx.stroke();}
    for(let y=field.y-field.radius;y<=field.y+field.radius;y+=.4){ctx.beginPath();ctx.moveTo(field.x-field.radius,y);ctx.lineTo(field.x+field.radius,y);ctx.stroke();}ctx.restore();
    ctx.strokeStyle=colors.slow;circle(ctx,field.x,field.y,field.radius);ctx.stroke();
  }
  for(const effect of state.effects){
    ctx.globalAlpha=reducedMotion?.5:Math.min(.8,Math.max(.1,effect.until-state.time));ctx.strokeStyle=colors.accent;ctx.lineWidth=Math.max(.06,1.5/pixels);
    if(effect.type==="dash"){ctx.beginPath();ctx.moveTo(effect.x,effect.y);ctx.lineTo(effect.toX,effect.toY);ctx.stroke();}
    else{circle(ctx,effect.x,effect.y,effect.radius);ctx.stroke();if(effect.type==="drop"){ctx.strokeRect(effect.x-.22,effect.y-.22,.44,.44);}}
  }
  ctx.globalAlpha=1;ctx.fillStyle=colors.accent;
  for(const dot of state.projectiles){const size=Math.max(.2,2/pixels);ctx.fillRect(dot.x-size/2,dot.y-size/2,size,size);}
  ctx.restore();
}
