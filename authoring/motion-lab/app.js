import {DIRECTIONS, clamp, createMotionState, advanceMotion, validatePresets} from "./motion.mjs";
import {nextGridCenter} from "./grid-motion.mjs";
import {createAnimationState, advanceAnimation, validateAnimationRecipes} from "./animation.mjs";
import {paintCharacter} from "./render-character.mjs";
import {validateCollection, createProfile, restoreProfile, serializeProfile, evaluateCollection, equipCharacter, resolveCharacter, applyFixture} from "./collection.mjs";
import {validateAbilityPresets,createAbilityState,switchAbilityLoadout,requestAbility,advanceAbility,abilityReadout} from "./ability.mjs";
import {paintAbilityStage} from "./render-ability.mjs";

const $ = id => document.getElementById(id);
const canvas = $("arena");
const ctx = canvas.getContext("2d", {alpha: false});
const inspectionCanvas = $("inspection"), inspectionCtx = inspectionCanvas.getContext("2d", {alpha: false});
const presetURL = new URL("./presets.json", import.meta.url);
const keyDirections = new Map([["ArrowUp", "up"], ["KeyW", "up"], ["ArrowRight", "right"], ["KeyD", "right"], ["ArrowDown", "down"], ["KeyS", "down"], ["ArrowLeft", "left"], ["KeyA", "left"]]);
const held = new Map();
const images = new Map();
const mediaPreference = matchMedia("(prefers-reduced-motion: reduce)");
let presets, selection, motion, state;
let collection, profile, contextId, inspectedCharacter;
let abilityConfig,abilityState,abilityEnabled=true,abilityEventId=0;
let liveAnimation = createAnimationState(), inspectionAnimation = createAnimationState();
const recipeOverrides = new Map(), rotorOverrides = new Map();
const storageKey = "xonix.motion-lab.collection.v1";
const profileOptions = {mode: "lab", profileId: "local-design"};
let recoveryRaw = null, storageWarning = "";
let background = null, backgroundToken = 0, backgroundOpacity = .28, backgroundFit = "contain";
let paused = false;
let autoplay = true;
let reducedMotion = mediaPreference.matches;
let keyBoost = false, keySlow = false, pointerBoost = false, pointerSlow = false;
let showGrid = true, showRotors = true, showParticles = true;
let lastTime = null, lastReadout = 0, lastEventMode = "";
let cellPixels = 20, cssWidth = 960, cssHeight = 720;
let particles = [], particleClock = 0, particleSequence = 0;

function rgba(hex, alpha) {
  return `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${alpha})`;
}

function eventNote(text) { $("motion-event").textContent = text; }

function setOptions(id, entries, selected) {
  const select = $(id);
  select.replaceChildren();
  for (const [value, data] of Object.entries(entries)) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = data.label;
    select.append(option);
  }
  select.value = selected;
}

function assetRecord(src) {
  if (!src) return {state: "absent"};
  if (images.has(src)) return images.get(src);
  const record = {state: "loading", image: null};
  images.set(src, record);
  let url;
  try {
    url = new URL(src, presetURL);
    if (url.origin !== location.origin || !["http:", "https:"].includes(url.protocol)) throw new Error("Assets must use same-origin local HTTP paths");
  } catch (error) {
    record.state = "failed";
    record.error = error.message;
    return record;
  }
  const image = new Image();
  image.onload = () => {record.state = "loaded"; record.image = image; updateAssetStatus(); if (state) {render(); readouts();}};
  image.onerror = () => {record.state = "failed"; updateAssetStatus(); if (state) {render(); readouts();}};
  image.src = url.href;
  return record;
}

function updateAssetStatus() {
  if (!presets || !selection) return;
  const character = presets.characters[selection.character];
  const body = assetRecord(character.src);
  const bodyText = body.state === "loaded" ? `Body image ${body.image.naturalWidth} × ${body.image.naturalHeight}; ${character.sourceStatus || "review status not supplied"}` : body.state === "loading" ? "Body image loading; neutral marker shown" : body.state === "failed" ? "Body image unavailable; neutral marker shown" : "Neutral marker shown; selected body has no image";
  const roles = Object.values(presets.terrainLayers[selection.terrainLayer].roles);
  const declared = roles.flatMap(role => [role.microSrc, role.propSrc]).filter(Boolean);
  const loaded = declared.filter(src => assetRecord(src).state === "loaded").length;
  const terrainText = declared.length ? `Terrain: ${loaded}/${declared.length} image layers loaded; missing layers use diagrams` : "Terrain: vector material diagrams";
  $("asset-status").textContent = `${bodyText}. ${terrainText}. Rotor anchors are an approximate study rig.`;
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  cssWidth = rect.width;
  cssHeight = rect.height;
  cellPixels = cssWidth / 48;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(cssWidth * dpr));
  canvas.height = Math.max(1, Math.round(cssHeight * dpr));
  // Presentation transform only. Position, speed, route and terrain never change on resize.
  ctx.setTransform(canvas.width / 48, 0, 0, canvas.height / 36, 0, 0);
}

function applyPalette() {
  const theme = presets.themes[selection.theme];
  for (const key of ["accent", "arena", "wall", "slow", "danger"]) document.documentElement.style.setProperty(`--${key}`, theme.colors[key]);
  $("palette-name").textContent = theme.label;
  if(abilityConfig&&abilityState)refreshAbilityControls();
}

function abilityPlayer(){return {x:state.x,y:state.y,direction:state.direction,distance:state.travelDistance};}
function resetAbilityState(){
  if(!abilityConfig)return;
  abilityState=abilityState?switchAbilityLoadout(abilityState,abilityConfig,abilityState.classId,abilityState.equipmentId,abilityPlayer()):createAbilityState(abilityConfig,undefined,undefined,abilityPlayer());
}
function refreshAbilityControls(){
  const vocab=abilityConfig.vocabulary[selection.theme];
  setOptions("ability-class",Object.fromEntries(abilityConfig.classes.map(item=>[item.id,{label:vocab.classLabels[item.id]}])),abilityState.classId);
  const item=abilityConfig.classes.find(item=>item.id===abilityState.classId);
  setOptions("ability-equipment",Object.fromEntries(abilityConfig.equipment.filter(link=>item.compatibleEquipment.includes(link.id)).map(link=>[link.id,{label:vocab.equipmentLabels[link.id]}])),abilityState.equipmentId);
  $("ability-description").textContent=item.description;
  $("ability-recommended-link").textContent=`Use ${vocab.equipmentLabels[item.recommendedEquipment]}`;
}
function abilityReadouts(){
  if(!abilityState)return;
  const info=abilityReadout(abilityState,abilityConfig,abilityPlayer()),vocab=abilityConfig.vocabulary[selection.theme];
  const notes=abilityState.targets.filter(target=>target.kind==="note"&&target.revealedUntil>abilityState.time).length;
  const charges=info.capacity?`${info.ammo}/${info.capacity} charges`:"No charge limit";
  $("ability-readout").textContent=abilityEnabled?`${vocab.classLabels[abilityState.classId]} · ${paused?"Paused":info.ready?"Ready":info.cooldown>.01?`${info.cooldown.toFixed(1)}s cooldown`:info.budget===0?"Link empty":"Pick up charges"} · ${charges} · ${info.completed} markers updated · ${notes} notes visible`:"Toy study hidden and paused. Movement and artwork remain available.";
  $("ability-link-status").textContent=`${vocab.equipmentLabels[abilityState.equipmentId]} · display signal ${Math.round(info.signal*100)}%${info.inHaze?info.equipment.ignoreHaze?" · synthetic haze ignored":" · synthetic haze display only":""}${info.budget!==null?` · ${vocab.budgetLabel} ${info.budget.toFixed(1)}/${info.budgetCapacity}`:""}. ${info.pad?"At a supply pad: R refills charges and link budget.":"Return to a marked pad for refill."}`;
  $("ability-action").disabled=!abilityEnabled;$("ability-pickup").disabled=!abilityEnabled;
}
function abilityCommand(type){
  if(!abilityEnabled)return;
  const result=requestAbility(abilityState,{id:++abilityEventId,type},{player:abilityPlayer(),stageStart:createMotionState(presets.route,motion),turnPolicy:motion.turnPolicy||"immediate",paused},abilityConfig);
  abilityState=result.state;
  if(result.relocation){
    autoplay=false;clearHeld();
    state=result.relocation.reset?createMotionState(presets.route,motion):{...state,x:result.relocation.x,y:result.relocation.y,speed:0,queuedDirection:null};
    lastTime=null;
  }
  const messages={paused:"Paused. Press Play before using an ability.","near-pad-required":"Move inside a marked supply pad, then press R.",cooldown:"Cooling down; wait for Ready.","link-empty":"Link budget is empty. Movement still works; return to a pad and press R.","charges-empty":"No charges. Pick up at a marked supply pad with R.",refilled:"Charges and available link budget refilled.","tagged-returned":"Toy tagged. Returned to the stage start; charge consumed. Refill or reset to try again.","marker-updated":"Nearby toy marker updated.","action-used":"Ability used. Effects are confined to this toy study.","duplicate-event":"Repeated action ignored.","no-reachable-center":"No forward landing point within this dash range. Move away from the edge or use a longer configured range; no charge spent.","effect-limit":"This study has enough active effects. Wait for one to finish; no charge spent."};
  $("ability-message").textContent=messages[result.reason]||`Ability result: ${result.reason}.`;
  readouts();render();
}
function setupAbilities(){
  resetAbilityState();refreshAbilityControls();
  const changeLoadout=(classId,equipmentId)=>{
    abilityState=switchAbilityLoadout(abilityState,abilityConfig,classId,equipmentId,abilityPlayer());
    refreshAbilityControls();$("ability-message").textContent="Toy test reset for the selected class and link. Character appearance and movement settings kept.";readouts();render();
  };
  $("ability-class").addEventListener("change",event=>{
    const item=abilityConfig.classes.find(item=>item.id===event.target.value);
    changeLoadout(item.id,item.compatibleEquipment.includes(abilityState.equipmentId)?abilityState.equipmentId:item.recommendedEquipment);
  });
  $("ability-equipment").addEventListener("change",event=>changeLoadout(abilityState.classId,event.target.value));
  $("ability-recommended-link").addEventListener("click",()=>changeLoadout(abilityState.classId,abilityConfig.classes.find(item=>item.id===abilityState.classId).recommendedEquipment));
  $("ability-enabled").addEventListener("change",event=>{abilityEnabled=event.target.checked;abilityState.lastPlayer={x:state.x,y:state.y};abilityState.lastTravelDistance=state.travelDistance;readouts();render();});
  for(const [id,type] of [["ability-action","act"],["ability-pickup","pickup"]]){
    $(id).addEventListener("click",()=>abilityCommand(type));
    $(id).addEventListener("keydown",event=>{if(["Enter","Space"].includes(event.code)){event.preventDefault();if(!event.repeat)abilityCommand(type);}});
  }
  $("ability-reset").addEventListener("click",()=>{autoplay=false;reset();pause("Ability test reset at its route start. Press Play or move to begin.");$("ability-message").textContent="Toy targets, charges, link budget and effects reset. Selected class, link and appearance kept.";});
  $("apply-class-appearance").addEventListener("click",()=>{
    const item=abilityConfig.classes.find(item=>item.id===abilityState.classId),bodyId=item.preferredBodies[currentContext().themeId];
    const result=equipCharacter(collection,profile,bodyId,currentContext(),currentContext());
    if(result.accepted){profile=result.profile;inspectedCharacter=bodyId;refreshCollection();$("ability-message").textContent=`Class appearance applied. ${saveProfile()} Ability statistics are unchanged.`;}
    else $("ability-message").textContent=`Preferred appearance is unavailable in this collection context (${result.reason}). Ability class is unchanged.`;
    readouts();render();
  });
}

function currentContext() {return collection.contexts.find(item => item.id === contextId).scope;}

function recipeFor(characterId) {
  const id = recipeOverrides.get(characterId) || presets.characters[characterId].animationRecipe;
  const recipe = presets.animationRecipes[id];
  const overrides = rotorOverrides.get(characterId) || {};
  return {...recipe, components: recipe.components.map(component => component.type === "rotors" ? {...component, ...overrides} : component)};
}

function saveProfile() {
  try {
    // A corrupt/incompatible save is retained before the first explicit user mutation writes fresh data.
    if (recoveryRaw !== null) {
      localStorage.setItem(`${storageKey}.recovery.${Date.now()}`, recoveryRaw);
      recoveryRaw = null;
    }
    localStorage.setItem(storageKey, serializeProfile(profile)); storageWarning = "";
    return "Saved in this browser’s separate test collection.";
  } catch {
    storageWarning = "Browser storage unavailable; changes remain in this session only. Any prior save is retained.";
    return storageWarning;
  }
}

function selectBoardCharacter() {
  const resolved = resolveCharacter(collection, profile, currentContext());
  if (selection.character !== resolved.characterId) liveAnimation = createAnimationState();
  selection.character = resolved.characterId;
  $("equipped-readout").textContent = `On board: ${presets.characters[selection.character].label} · ${resolved.source}. Cosmetics never change travel or terrain.`;
  updateAssetStatus();
}

function updateAnimationControls() {
  const body = presets.characters[inspectedCharacter];
  $("animation-recipe").value = recipeOverrides.get(inspectedCharacter) || body.animationRecipe;
  const recipe = recipeFor(inspectedCharacter), rotor = recipe.components.find(component => component.type === "rotors");
  $("rotor-controls").hidden = !rotor;
  if (rotor) {
    $("blade-count").value = rotor.bladeCount; $("blade-shape").value = rotor.bladeShape;
    $("rotor-radius").value = rotor.radius; $("rotor-radius-output").textContent = `${Math.round(rotor.radius*100)}% of body`;
  }
  $("inspection-blade-label").textContent = rotor ? `${rotor.bladeCount} blades / rotor` : recipe.components.length ? recipe.components.map(component => component.type).join(" + ") : "Static marker";
  const unavailableRig = rotor && !body.rotors.length;
  $("animation-status").textContent = unavailableRig ? "This body has no rotor anchors. Recipe selected, but rotors cannot attach until a rig is authored." : rotor ? "Blade motion is sampled for readable direction; blur indicates higher requested spin. Inspection can slow detail. These are visual rates, not physical RPM." : "Independent cosmetic recipe. The enlarged view uses the same body and attachment parameters.";
}

function refreshCollection({followEquipped = false} = {}) {
  selectBoardCharacter();
  if (followEquipped) inspectedCharacter = selection.character;
  const rows = evaluateCollection(collection, profile, currentContext());
  setOptions("character", Object.fromEntries(rows.map(row => [row.id, {label: `${row.label} · ${row.status}`} ])), inspectedCharacter);
  const row = rows.find(item => item.id === inspectedCharacter);
  $("character-status").textContent = `${row.label}: ${row.status}. ${row.description || ""}${row.available ? "" : ` ${row.availabilityReason}`}`;
  $("equip-character").disabled = !row.available || !row.unlocked;
  const list = $("unlock-conditions"); list.replaceChildren();
  for (const condition of row.conditions) {
    const item = document.createElement("li"); item.textContent = `${condition.met ? "✓" : "○"} ${condition.label}: ${condition.current} / ${condition.target}`; list.append(item);
  }
  if (row.unmet.length) {
    const item = document.createElement("li"); item.textContent = `Unlock: ${row.unmet.join(" OR ")}`; list.append(item);
  }
  list.hidden = !list.children.length;
  updateAnimationControls();
}

function setupCollection() {
  setOptions("collection-context", Object.fromEntries(collection.contexts.map(item => [item.id,item])), contextId);
  setOptions("animation-recipe", presets.animationRecipes, presets.characters[inspectedCharacter].animationRecipe);
  setOptions("reward-fixture", Object.fromEntries(collection.fixtures.map(item => [item.id,item])), collection.fixtures[0].id);
  $("collection-context").addEventListener("change", event => {contextId = event.target.value; refreshCollection({followEquipped:true}); inspectionAnimation = createAnimationState(); render(); readouts();});
  $("character").addEventListener("change", event => {inspectedCharacter = event.target.value; inspectionAnimation = createAnimationState(); refreshCollection(); render();});
  $("equip-character").addEventListener("click", () => {
    const context = currentContext();
    const scope = $("equip-scope").value === "context" ? {...context} : $("equip-scope").value === "theme" ? {gameId:context.gameId,themeId:context.themeId} : {};
    const result = equipCharacter(collection, profile, inspectedCharacter, scope, context);
    if (result.accepted) profile = result.profile;
    if (result.accepted) {
      const resolved = resolveCharacter(collection,profile,context);
      const resultText = resolved.characterId === inspectedCharacter ? "Equipped." : `Preference saved, but this context still uses ${presets.characters[resolved.characterId].label} because a more-specific choice applies. Choose “This context” to replace it.`;
      $("collection-message").textContent = `${resultText} ${saveProfile()}`;
    } else $("collection-message").textContent = `Could not equip: ${result.reason}.`;
    refreshCollection(); render(); readouts();
  });
  $("apply-fixture").addEventListener("click", () => {
    const result = applyFixture(collection, profile, $("reward-fixture").value);
    if (result.accepted) profile = result.profile;
    $("collection-message").textContent = result.accepted ? `Simulated test result applied. ${saveProfile()} This is not a real game win.` : `Test result not applied: ${result.reason}. A fixture cannot be counted twice.`;
    refreshCollection(); render(); readouts();
  });
  $("reset-collection").addEventListener("click", () => {
    profile = createProfile(profileOptions);
    $("collection-message").textContent = `Test collection reset to starters. ${saveProfile()}`;
    refreshCollection({followEquipped:true}); render(); readouts();
  });
  $("animation-recipe").addEventListener("change", event => {
    recipeOverrides.set(inspectedCharacter,event.target.value); rotorOverrides.delete(inspectedCharacter);
    inspectionAnimation = createAnimationState(); if (inspectedCharacter === selection.character) liveAnimation = createAnimationState();
    updateAnimationControls(); render(); readouts();
  });
  for (const [id,key,numeric] of [["blade-count","bladeCount",true],["blade-shape","bladeShape",false],["rotor-radius","radius",true]]) {
    $(id).addEventListener(id === "rotor-radius" ? "input" : "change", event => {
      rotorOverrides.set(inspectedCharacter,{...rotorOverrides.get(inspectedCharacter),[key]:numeric ? Number(event.target.value) : event.target.value});
      updateAnimationControls(); render(); readouts();
    });
  }
  $("inspection-slow").addEventListener("change", () => {inspectionAnimation = createAnimationState(); render();});
  $("apply-family-look").addEventListener("click", () => {
    selection.terrainLayer = presets.familyLooks[selection.theme].terrainLayer;
    $("terrain-layer").value = selection.terrainLayer;
    const context = collection.contexts.find(item => item.scope.themeId === selection.theme);
    if (context) {contextId = context.id; $("collection-context").value = contextId;}
    refreshCollection({followEquipped:true}); inspectionAnimation = createAnimationState(); render(); readouts();
    eventNote("Family palette, terrain and context applied. Saved equipment preferences remain in place.");
  });
  refreshCollection();
  if (storageWarning) $("collection-message").textContent = storageWarning;
}

function setupBackground() {
  const clear = () => {
    backgroundToken++; if (background) URL.revokeObjectURL(background.url); background = null;
    $("background-file").value = ""; $("clear-background").disabled = true;
    $("background-status").textContent = "Local preview cleared. The original file is unchanged."; render();
  };
  $("clear-background").addEventListener("click", clear);
  $("background-file").addEventListener("change", async event => {
    const file = event.target.files[0]; if (!file) return;
    if (!["image/png","image/jpeg","image/webp","image/gif"].includes(file.type) || file.size > 25*1024*1024) {$("background-status").textContent = "Choose a PNG, JPEG, WebP or GIF up to 25 MiB. The current preview is retained."; return;}
    const token = ++backgroundToken, url = URL.createObjectURL(file), image = new Image();
    $("background-status").textContent = "Decoding local image…";
    image.onload = () => {
      if (token !== backgroundToken) {URL.revokeObjectURL(url); return;}
      if (background) URL.revokeObjectURL(background.url);
      background = {image,url}; $("clear-background").disabled = false;
      $("background-status").textContent = `${file.name} · ${image.naturalWidth} × ${image.naturalHeight}. Local display only; source unchanged, no upload or AI call.`; render();
    };
    image.onerror = () => {URL.revokeObjectURL(url); if (token === backgroundToken) $("background-status").textContent = "This image could not be decoded. The current preview and original file are retained.";};
    image.src = url;
  });
  $("background-fit").addEventListener("change", event => {backgroundFit = event.target.value; render();});
  $("background-opacity").addEventListener("input", event => {backgroundOpacity = Number(event.target.value); $("background-opacity-output").textContent = `${Math.round(backgroundOpacity*100)}%`; render();});
  window.addEventListener("pagehide", () => {if (background) URL.revokeObjectURL(background.url);});
}

function drawGrid(colors) {
  if (!showGrid) return;
  ctx.lineWidth = 0.65 / cellPixels;
  for (let x = 0; x <= 48; x++) {
    ctx.strokeStyle = rgba(colors.grid, x % 4 === 0 ? 0.65 : 0.24);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 36); ctx.stroke();
  }
  for (let y = 0; y <= 36; y++) {
    ctx.strokeStyle = rgba(colors.grid, y % 4 === 0 ? 0.65 : 0.24);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(48, y); ctx.stroke();
  }
  ctx.strokeStyle = rgba(colors.dim, 0.45);
  ctx.lineWidth = 1 / cellPixels;
  ctx.strokeRect(1, 1, 46, 34);
  const corners = [[2, 2, 1, 1], [46, 2, -1, 1], [2, 34, 1, -1], [46, 34, -1, -1]];
  ctx.strokeStyle = rgba(colors.dim, 0.8);
  for (const [x, y, dx, dy] of corners) {ctx.beginPath(); ctx.moveTo(x, y + dy); ctx.lineTo(x, y); ctx.lineTo(x + dx, y); ctx.stroke();}
}

function drawImageFit(image, x, y, width, height, smoothing = false) {
  const factor = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const w = image.naturalWidth * factor, h = image.naturalHeight * factor;
  ctx.imageSmoothingEnabled = smoothing;
  ctx.drawImage(image, x + (width - w) / 2, y + (height - h) / 2, w, h);
}

// Deliberately modest vector/pixel diagrams until a corresponding image layer is supplied.
function drawMicro(role, kind, x, y, color, dim) {
  ctx.save(); ctx.translate(x, y); ctx.scale(1 / 8, 1 / 8);
  ctx.fillStyle = rgba(color, 0.78);
  if (role === "wall") {
    if (kind === "circuit") {
      ctx.fillRect(2, 2, 4, 4); ctx.fillRect(0, 3, 8, 1); ctx.fillRect(3, 0, 1, 8); ctx.fillStyle = dim; ctx.fillRect(3, 3, 2, 2);
    } else if (kind === "archive") {
      ctx.fillRect(1, 1, 6, 6); ctx.fillStyle = dim; ctx.fillRect(2, 3, 4, 1); ctx.fillRect(3, 5, 2, 1);
    } else if (kind === "stone") {
      ctx.fillRect(2, 1, 4, 1); ctx.fillRect(1, 2, 6, 4); ctx.fillRect(2, 6, 4, 1); ctx.fillStyle = dim; ctx.fillRect(3, 4, 3, 1);
    } else {
      ctx.fillRect(1, 2, 6, 4); ctx.fillStyle = dim; ctx.fillRect(2, 3, 1, 2); ctx.fillRect(5, 3, 1, 2);
    }
  } else if (role === "slow") {
    if (kind === "queue") {
      ctx.fillRect(2, 1, 3, 4); ctx.fillStyle = rgba(color, 0.4); ctx.fillRect(4, 3, 3, 4);
    } else if (kind === "reeds") {
      ctx.fillRect(2, 2, 1, 5); ctx.fillRect(5, 1, 1, 6); ctx.fillRect(3, 5, 3, 1);
    } else if (kind === "static") {
      ctx.fillRect(1, 2, 2, 1); ctx.fillRect(4, 3, 3, 1); ctx.fillRect(2, 5, 2, 1); ctx.fillRect(6, 6, 1, 1);
    } else {
      ctx.fillRect(1, 4, 3, 2); ctx.fillRect(4, 2, 3, 2); ctx.fillStyle = rgba(color, 0.3); ctx.fillRect(2, 2, 1, 1); ctx.fillRect(5, 6, 2, 1);
    }
  } else {
    if (kind === "alert") {
      ctx.fillRect(2, 1, 4, 6); ctx.fillStyle = dim; ctx.fillRect(3, 2, 2, 2); ctx.fillRect(3, 5, 2, 1);
    } else if (kind === "plasma") {
      ctx.fillRect(3, 1, 2, 2); ctx.fillRect(2, 3, 4, 2); ctx.fillRect(3, 5, 2, 2); ctx.fillStyle = dim; ctx.fillRect(3, 3, 2, 2);
    } else if (kind === "thorns") {
      ctx.fillRect(1, 4, 6, 1); ctx.fillRect(2, 2, 1, 2); ctx.fillRect(5, 4, 1, 3); ctx.fillRect(6, 2, 1, 2);
    } else {
      ctx.fillRect(1, 2, 1, 4); ctx.fillRect(6, 2, 1, 4); ctx.fillRect(2, 3, 2, 1); ctx.fillRect(4, 4, 2, 1); ctx.fillRect(3, 2, 1, 1); ctx.fillRect(4, 5, 1, 1);
    }
  }
  ctx.restore();
}

function drawProp(role, kind, x, y, size, color, background) {
  ctx.save(); ctx.translate(x, y); ctx.scale(size / 16, size / 16);
  ctx.fillStyle = "rgba(0,0,0,.32)";
  ctx.fillRect(2, 4, 13, 10);
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(color, 0.8);
  if (role === "wall") {
    if (kind === "archive") {
      ctx.fillStyle = rgba(color, 0.66); ctx.fillRect(3, 2, 10, 12); ctx.fillStyle = background; ctx.fillRect(4, 3, 8, 4); ctx.fillRect(4, 9, 8, 4); ctx.fillStyle = color; ctx.fillRect(7, 4, 2, 1); ctx.fillRect(7, 10, 2, 1);
    } else if (kind === "circuit") {
      ctx.fillStyle = rgba(color, 0.32); ctx.fillRect(2, 2, 12, 12); ctx.strokeRect(4, 4, 8, 8); ctx.fillStyle = color; ctx.fillRect(6, 6, 4, 4); for (let i = 3; i < 14; i += 3) {ctx.fillRect(i, 0, 1, 3); ctx.fillRect(i, 13, 1, 3);}
    } else if (kind === "stone") {
      ctx.fillStyle = rgba(color, 0.65); ctx.beginPath(); ctx.moveTo(4, 2); ctx.lineTo(12, 3); ctx.lineTo(14, 7); ctx.lineTo(12, 13); ctx.lineTo(4, 14); ctx.lineTo(2, 9); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(4, 6); ctx.lineTo(9, 7); ctx.lineTo(10, 11); ctx.stroke();
    } else {
      ctx.fillStyle = rgba(color, 0.7); ctx.beginPath(); ctx.moveTo(3, 5); ctx.lineTo(13, 5); ctx.lineTo(15, 12); ctx.lineTo(1, 12); ctx.closePath(); ctx.fill(); ctx.fillStyle = rgba(color, 0.9); ctx.fillRect(3, 3, 10, 3); ctx.fillStyle = background; ctx.fillRect(5, 6, 1, 3); ctx.fillRect(10, 6, 1, 3); ctx.strokeRect(3, 3, 10, 3);
    }
  } else if (role === "slow") {
    ctx.fillStyle = rgba(color, 0.2); ctx.beginPath(); ctx.ellipse(8, 9, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
    if (kind === "queue") {
      ctx.fillStyle = rgba(color, 0.65); ctx.fillRect(2, 3, 7, 9); ctx.fillStyle = color; ctx.fillRect(7, 5, 7, 9); ctx.fillStyle = background; ctx.fillRect(8, 7, 4, 1); ctx.fillRect(8, 10, 3, 1);
    } else if (kind === "reeds") {
      for (const [a, b] of [[4, 3], [7, 1], [10, 4], [12, 2]]) {ctx.strokeStyle = color; ctx.beginPath(); ctx.moveTo(a, 13); ctx.lineTo(a - 1, b); ctx.stroke(); ctx.fillStyle = rgba(color, 0.7); ctx.fillRect(a - 2, b, 3, 3);}
    } else if (kind === "static") {
      for (let i = 0; i < 5; i++) {ctx.fillStyle = rgba(color, 0.3 + i * 0.12); ctx.fillRect(2 + (i % 2) * 3, 2 + i * 2, 8 - i, 1);}
    } else {
      ctx.strokeStyle = rgba(color, 0.7); for (const [a, b, width] of [[3, 6, 6], [6, 10, 7], [3, 12, 3]]) {ctx.beginPath(); ctx.ellipse(a + width / 2, b, width / 2, 1.1, 0, 0, Math.PI * 2); ctx.stroke();}
    }
  } else {
    if (kind === "alert") {
      ctx.fillStyle = rgba(color, 0.65); ctx.fillRect(3, 2, 10, 12); ctx.fillStyle = background; ctx.fillRect(7, 4, 2, 5); ctx.fillRect(7, 11, 2, 1); ctx.fillStyle = color; ctx.fillRect(12, 2, 2, 3);
    } else if (kind === "plasma") {
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(8, 8, 5, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = rgba(color, 0.55); ctx.fillRect(6, 5, 4, 6); ctx.fillStyle = color; ctx.fillRect(7, 7, 2, 2);
    } else if (kind === "thorns") {
      ctx.beginPath(); ctx.moveTo(2, 12); ctx.lineTo(5, 6); ctx.lineTo(11, 10); ctx.lineTo(14, 3); ctx.stroke(); ctx.fillStyle = color; for (const [a, b] of [[4, 5], [6, 9], [10, 8], [12, 4]]) {ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(a + 3, b - 2); ctx.lineTo(a + 1, b + 2); ctx.closePath(); ctx.fill();}
    } else {
      ctx.fillStyle = rgba(color, 0.8); ctx.fillRect(2, 2, 2, 12); ctx.fillRect(12, 2, 2, 12); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(3, 5); ctx.bezierCurveTo(6, 1, 10, 13, 13, 9); ctx.moveTo(3, 10); ctx.bezierCurveTo(6, 14, 10, 2, 13, 5); ctx.stroke(); ctx.fillRect(7, 6, 2, 2);
    }
  }
  ctx.restore();
}

function drawTerrain(colors) {
  const style = presets.terrainStyles[selection.terrainStyle];
  const layer = presets.terrainLayers[selection.terrainLayer];
  for (const area of presets.terrain) {
    const material = layer.roles[area.role];
    const color = colors[area.role];
    ctx.save();
    ctx.beginPath(); ctx.rect(area.x, area.y, area.width, area.height); ctx.clip();
    ctx.fillStyle = rgba(color, 0.07); ctx.fillRect(area.x, area.y, area.width, area.height);
    if (style.microOpacity > 0) {
      const image = assetRecord(material.microSrc);
      ctx.globalAlpha = style.microOpacity;
      for (let x = area.x; x < area.x + area.width; x++) for (let y = area.y; y < area.y + area.height; y++) {
        if (image.state === "loaded") drawImageFit(image.image, x + 0.08, y + 0.08, 0.84, 0.84);
        else drawMicro(area.role, material.kind, x, y, color, colors.arena);
      }
    }
    if (style.propOpacity > 0) {
      const image = assetRecord(material.propSrc);
      ctx.globalAlpha = style.propOpacity;
      for (let x = area.x; x < area.x + area.width; x += style.propPitch) for (let y = area.y; y < area.y + area.height; y += style.propPitch) {
        const width = Math.min(2, area.x + area.width - x), height = Math.min(2, area.y + area.height - y);
        const size = Math.min(width, height) * 0.95;
        if (image.state === "loaded") drawImageFit(image.image, x, y, width, height);
        else drawProp(area.role, material.kind, x + (width - size) / 2, y + (height - size) / 2, size, color, colors.arena);
      }
    }
    ctx.restore();
    ctx.lineWidth = 0.7 / cellPixels; ctx.strokeStyle = rgba(color, 0.26); ctx.strokeRect(area.x, area.y, area.width, area.height);
  }
}

function updateParticles(dt) {
  if (paused || reducedMotion || !showParticles) {particles = []; particleClock = 0; return;}
  particles = particles.map(particle => ({...particle, life: particle.life - dt, x: particle.x + particle.vx * dt, y: particle.y + particle.vy * dt})).filter(particle => particle.life > 0);
  if (state.speed < 0.1) return;
  particleClock += dt * (state.mode === "boost" ? 22 : 8);
  const forward = DIRECTIONS[state.direction];
  while (particleClock >= 1) {
    particleClock -= 1;
    const jitter = Math.sin(++particleSequence * 2.399) * 0.16;
    particles.push({x: state.x - forward.x * 0.52 + forward.y * jitter, y: state.y - forward.y * 0.52 - forward.x * jitter, vx: -forward.x * 0.65, vy: -forward.y * 0.65, life: 0.42, size: state.mode === "boost" ? 0.09 : 0.065});
  }
  if (particles.length > 40) particles.splice(0, particles.length - 40);
}

function drawCharacter(colors) {
  for (const particle of particles) {ctx.fillStyle = rgba(colors.accent, particle.life / 0.42 * 0.55); ctx.fillRect(particle.x, particle.y, particle.size, particle.size);}
  const body = presets.characters[selection.character], image = assetRecord(body.src);
  paintCharacter(ctx, {body, image:image.image, recipe:recipeFor(selection.character), animation:liveAnimation,
    colors, scale:selection.characterScale, x:state.x, y:state.y, heading:state.heading, bank:state.bank,
    speedRatio:state.visualSpeed/motion.cruiseSpeed, reducedMotion, showRotors, pixel:1/cellPixels});
}

function drawTurnCue(colors) {
  if (motion.turnPolicy !== "grid-center" || !state.queuedDirection || paused) return;
  const target = nextGridCenter(state,presets.board), direction = DIRECTIONS[state.queuedDirection];
  ctx.save(); ctx.strokeStyle=colors.accent; ctx.fillStyle=colors.accent; ctx.lineWidth=1.5/cellPixels;
  ctx.setLineDash([.12,.12]); ctx.beginPath(); ctx.moveTo(state.x,state.y); ctx.lineTo(target.x,target.y); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeRect(target.x-.18,target.y-.18,.36,.36);
  ctx.beginPath(); ctx.moveTo(target.x,target.y); ctx.lineTo(target.x+direction.x*.6,target.y+direction.y*.6); ctx.stroke();
  ctx.translate(target.x+direction.x*.6,target.y+direction.y*.6); ctx.rotate(direction.heading);
  ctx.beginPath(); ctx.moveTo(0,-.12); ctx.lineTo(.09,.07); ctx.lineTo(-.09,.07); ctx.closePath(); ctx.fill(); ctx.restore();
}

function drawInspection(colors) {
  inspectionCtx.setTransform(1,0,0,1,0,0);
  inspectionCtx.fillStyle = colors.arena; inspectionCtx.fillRect(0,0,400,320);
  inspectionCtx.strokeStyle = rgba(colors.grid,.65); inspectionCtx.lineWidth = 1;
  for (let x=20;x<400;x+=20) {inspectionCtx.beginPath(); inspectionCtx.moveTo(x,0); inspectionCtx.lineTo(x,320); inspectionCtx.stroke();}
  for (let y=20;y<320;y+=20) {inspectionCtx.beginPath(); inspectionCtx.moveTo(0,y); inspectionCtx.lineTo(400,y); inspectionCtx.stroke();}
  inspectionCtx.setTransform(155,0,0,155,200,160);
  const body = presets.characters[inspectedCharacter], image = assetRecord(body.src);
  paintCharacter(inspectionCtx, {body,image:image.image,recipe:recipeFor(inspectedCharacter),animation:inspectionAnimation,
    colors,speedRatio:state.visualSpeed/motion.cruiseSpeed,reducedMotion,showRotors,pixel:1/155,inspectionSlow:$("inspection-slow").checked});
  inspectionCtx.setTransform(1,0,0,1,0,0);
  if (image.state !== "loaded") {
    inspectionCtx.fillStyle = colors.body; inspectionCtx.font = "15px monospace"; inspectionCtx.textAlign = "center";
    inspectionCtx.fillText(body.src ? "Body unavailable · neutral marker" : "Neutral fallback marker",200,300);
  }
}

function render() {
  const colors = presets.themes[selection.theme].colors;
  ctx.globalAlpha = 1;
  ctx.fillStyle = colors.arena; ctx.fillRect(0,0,48,36);
  if (background) {
    const image=background.image, factor=(backgroundFit === "cover" ? Math.max : Math.min)(48/image.naturalWidth,36/image.naturalHeight);
    const width=image.naturalWidth*factor,height=image.naturalHeight*factor;
    ctx.save(); ctx.globalAlpha=backgroundOpacity; ctx.imageSmoothingEnabled=true;
    ctx.drawImage(image,(48-width)/2,(36-height)/2,width,height); ctx.restore();
  }
  drawGrid(colors); drawTerrain(colors);
  if(abilityEnabled&&abilityState)paintAbilityStage(ctx,abilityState,abilityConfig,abilityPlayer(),{colors,pixels:cellPixels,family:selection.theme,reducedMotion});
  drawTurnCue(colors); drawCharacter(colors); drawInspection(colors);
}

function readouts() {
  const heading = ((state.heading * 180 / Math.PI) % 360 + 360) % 360;
  const cardinal = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(heading / 45) % 8];
  $("speed-value").textContent = state.speed.toFixed(1);
  $("speed-fill").style.width = `${clamp(state.speed / (16 * motion.boostMultiplier), 0, 1) * 100}%`;
  $("heading-value").textContent = `${cardinal} · ${Math.round(heading).toString().padStart(3, "0")}°`;
  $("heading-arrow").style.transform = `rotate(${heading}deg)`;
  const body = presets.characters[selection.character];
  const width = body.widthCells * selection.characterScale;
  $("body-size").textContent = `${(width * cellPixels).toFixed(0)} px / ${width.toFixed(2)}c`;
  const recipe = recipeFor(selection.character), rotor = recipe.components.find(component => component.type === "rotors");
  $("rotor-state").textContent = rotor && body.rotors.length ? !showRotors ? "Rotor layer hidden" : reducedMotion ? `${rotor.bladeCount}-blade detail frozen` : paused ? `${rotor.bladeCount}-blade rotors paused` : `${rotor.bladeCount}-blade · ${state.mode === "boost" ? "boost" : state.speed > .1 ? "travel" : "idle"}` : recipe.components.length ? recipe.components.map(component => component.type).join(" + ") : "Static body";
  $("state-label").textContent = paused ? "Paused" : state.mode === "turning" ? "Body turning · cardinal travel" : state.mode === "boost" ? "Boost" : state.mode === "slow" ? "Slow input" : state.speed > 0.1 ? "In motion" : "Ready";
  $("mode-label").textContent = autoplay ? "Autoplay route" : "Manual input";
  $("turn-queue").textContent = motion.turnPolicy !== "grid-center" ? "Immediate · no queued turn" : autoplay ? "Grid center · autoplay route, human buffer empty" : state.queuedDirection ? `Queued ${state.queuedDirection.toUpperCase()} → next center (${nextGridCenter(state,presets.board).x.toFixed(1)}, ${nextGridCenter(state,presets.board).y.toFixed(1)}) · keep held to turn` : `Grid center · buffer empty · position ${state.x.toFixed(2)}, ${state.y.toFixed(2)}`;
  $("play-pause").textContent = paused ? "Play" : "Pause";
  $("autoplay").checked = autoplay;
  for (const [id, active] of [["boost", keyBoost || pointerBoost], ["slow", keySlow || pointerSlow]]) {
    $(id).classList.toggle("is-held", active); $(id).setAttribute("aria-pressed", String(active));
  }
  for (const button of document.querySelectorAll("[data-direction]")) button.classList.toggle("is-held", [...held.values()].includes(button.dataset.direction));
  abilityReadouts();
}

function clearHeld() {
  held.clear(); keyBoost = keySlow = pointerBoost = pointerSlow = false;
  if (state) state.queuedDirection = null;
}

function pause(reason = "Paused. Press Play or make a movement input to resume.") {
  if (!state) return;
  paused = true; state.speed = 0; state.turning = false; clearHeld(); particles = []; lastTime = null;
  eventNote(reason); readouts(); render();
}

function resume() {paused = false; lastTime = null; eventNote(autoplay ? "Autoplay follows the same orthogonal route." : "Manual movement ready. Shift boosts; Space slows."); readouts();}

function manualStart(key, direction) {
  autoplay = false;
  if (!held.has(key)) held.set(key, direction);
  if (paused) resume();
  readouts();
}

function reset() {
  state = createMotionState(presets.route,motion); liveAnimation = createAnimationState(); inspectionAnimation = createAnimationState(); particles = []; particleClock = 0; clearHeld(); lastTime = null;
  resetAbilityState();
  eventNote("Reset to the route start. Artwork and response settings kept."); readouts(); render();
}

function setReduced(value) {
  reducedMotion = value; $("reduced-motion").checked = value; particles = [];
  if (value) pause("Reduced motion: particles removed, rotor detail frozen. Press Play when ready.");
  else eventNote("Rotor and particle effects available. Motion resumes only on your input.");
  render();
}

function setHeldPointer(button, onDown, onUp) {
  const release = event => {onUp(event.pointerId); if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId); readouts();};
  button.addEventListener("pointerdown", event => {if (event.button !== 0) return; event.preventDefault(); button.setPointerCapture(event.pointerId); onDown(event.pointerId); readouts();});
  button.addEventListener("pointerup", release); button.addEventListener("pointercancel", release); button.addEventListener("lostpointercapture", event => {onUp(event.pointerId); readouts();});
}

function setupControls() {
  $("turn-policy").value = motion.turnPolicy || "immediate";
  $("turn-policy").addEventListener("change", event => {
    motion.turnPolicy=event.target.value; autoplay=false; reset();
    pause(`${motion.turnPolicy === "grid-center" ? "Grid-center buffered" : "Immediate"} policy selected. Explicit reset to (${state.x.toFixed(1)}, ${state.y.toFixed(1)}); held commands cleared. Move or press Play to begin.`);
  });
  setOptions("theme", presets.themes, selection.theme);
  setOptions("terrain-layer", presets.terrainLayers, selection.terrainLayer);
  setupCollection(); setupBackground(); setupAbilities();
  for (const [id, key, handler] of [["theme", "theme", applyPalette], ["terrain-layer", "terrainLayer", updateAssetStatus]]) {
    $(id).addEventListener("change", event => {selection[key] = event.target.value; handler(); render(); readouts();});
  }
  for (const radio of document.querySelectorAll('[name="terrain-style"]')) {
    radio.checked = radio.value === selection.terrainStyle;
    radio.addEventListener("change", event => {if (event.target.checked) {selection.terrainStyle = event.target.value; render(); eventNote("Terrain treatment changed. Every footprint and movement parameter is unchanged.");}});
  }
  const ranges = [["character-scale", "scale-output", selection.characterScale, value => {selection.characterScale = value;}, value => `${value.toFixed(2)}×`], ["cruise-speed", "speed-output", motion.cruiseSpeed, value => {motion.cruiseSpeed = value;}, value => `${value} cells/s`], ["turn-rate", "turn-output", motion.turnRateDegrees, value => {motion.turnRateDegrees = value;}, value => `${value}°/s`]];
  // Keep slider labels local and readable; no values are baked into source artwork.
  for (const [id, output, initial, setter, label] of ranges) {
    $(id).value = initial; $(output).textContent = label(initial);
    $(id).addEventListener("input", event => {const value = Number(event.target.value); setter(value); $(output).textContent = label(value); readouts(); render();});
  }
  $("show-grid").addEventListener("change", event => {showGrid = event.target.checked; render();});
  $("show-rotors").addEventListener("change", event => {showRotors = event.target.checked; render(); readouts();});
  $("show-particles").addEventListener("change", event => {showParticles = event.target.checked; if (!showParticles) particles = []; render();});
  $("reduced-motion").checked = reducedMotion;
  $("reduced-motion").addEventListener("change", event => setReduced(event.target.checked));
  $("play-pause").addEventListener("click", () => paused ? resume() : pause());
  $("reset").addEventListener("click", reset);
  $("autoplay").addEventListener("change", event => {autoplay = event.target.checked; clearHeld(); if (autoplay) reset(); resume();});
  for (const button of document.querySelectorAll("[data-direction]")) {
    setHeldPointer(button, id => manualStart(`pointer-${id}`, button.dataset.direction), id => held.delete(`pointer-${id}`));
    button.addEventListener("keydown", event => {if (["Space", "Enter"].includes(event.code) && !event.repeat) {event.preventDefault(); manualStart(`button-${button.dataset.direction}`, button.dataset.direction);}});
    button.addEventListener("keyup", event => {if (["Space", "Enter"].includes(event.code)) {event.preventDefault(); held.delete(`button-${button.dataset.direction}`);}});
    button.addEventListener("blur", () => {held.delete(`button-${button.dataset.direction}`); readouts();});
  }
  setHeldPointer($("boost"), () => {pointerBoost = true; if (paused) resume(); eventNote("Boost held: higher travel speed and rotor rate.");}, () => {pointerBoost = false;});
  setHeldPointer($("slow"), () => {pointerSlow = true; if (paused) resume(); eventNote("Slow held: deliberate movement, same direction controls.");}, () => {pointerSlow = false;});
  for (const [id, setter] of [["boost", value => {pointerBoost = value;}], ["slow", value => {pointerSlow = value;}]]) {
    $(id).addEventListener("keydown", event => {if (["Space", "Enter"].includes(event.code)) {event.preventDefault(); if (!event.repeat) {setter(true); if (paused) resume();}}});
    $(id).addEventListener("keyup", event => {if (["Space", "Enter"].includes(event.code)) {event.preventDefault(); setter(false);}});
    $(id).addEventListener("blur", () => {setter(false); readouts();});
  }
  window.addEventListener("keydown", event => {
    if (event.code === "Escape") {pause(); return;}
    if (event.target.closest("input,select,textarea,button,[contenteditable=true]")) return;
    if(["KeyE","KeyR"].includes(event.code)&&!event.ctrlKey&&!event.metaKey&&!event.altKey){event.preventDefault();if(!event.repeat)abilityCommand(event.code==="KeyE"?"act":"pickup");return;}
    // Key repeat after Pause/focus loss cannot resurrect a cleared command; require a fresh press.
    if (event.repeat && (paused || keyDirections.has(event.code) && !held.has(event.code) || event.code === "Space" && !keySlow)) return;
    if (keyDirections.has(event.code)) {event.preventDefault(); manualStart(event.code, keyDirections.get(event.code));}
    else if (["ShiftLeft", "ShiftRight"].includes(event.code)) {keyBoost = true; if (paused) resume();}
    else if (event.code === "Space") {event.preventDefault(); keySlow = true; if (paused) resume();}
  });
  window.addEventListener("keyup", event => {
    held.delete(event.code);
    if (["ShiftLeft", "ShiftRight"].includes(event.code)) keyBoost = false;
    if (event.code === "Space") keySlow = false;
  });
  window.addEventListener("blur", () => pause("Paused when the window lost focus. Press Play or move to resume."));
  document.addEventListener("visibilitychange", () => {if (document.hidden) pause("Paused while this tab is hidden. Resume when ready.");});
  mediaPreference.addEventListener("change", event => {if (event.matches) setReduced(true);});
}

function frame(time) {
  if (!presets) return;
  const dt = lastTime === null ? 0 : Math.min((time - lastTime) / 1000, 0.25);
  lastTime = time;
  const directions = [...held.values()];
  state = advanceMotion(state, {direction: directions.at(-1) || null, boost: keyBoost || pointerBoost, slow: keySlow || pointerSlow, autoplay, paused, reducedMotion}, motion, presets.board, presets.route, dt);
  abilityState=advanceAbility(abilityState,{player:abilityPlayer(),paused:paused||!abilityEnabled},dt,abilityConfig);
  updateParticles(dt);
  const travel = {visualSpeed:state.visualSpeed,cruiseSpeed:motion.cruiseSpeed};
  liveAnimation = advanceAnimation(liveAnimation,recipeFor(selection.character),travel,dt,{paused,reducedMotion});
  inspectionAnimation = advanceAnimation(inspectionAnimation,recipeFor(inspectedCharacter),travel,dt,{paused,reducedMotion,inspectionSlow:$("inspection-slow").checked});
  if (!paused) render();
  if (time - lastReadout > 80) {
    readouts(); lastReadout = time;
    if (!paused && state.mode !== lastEventMode) {
      const messages = {boost: "Boost: immediate speed response; turn policy remains unchanged.", slow: "Slow input: finer movement at the selected multiplier.", turning: motion.turnPolicy === "grid-center" ? "Travel turned at a cell center; the body's facing follows visually." : "Cardinal travel changes immediately; only the body's facing is smoothed.", cruise: "Cruise: compact body, stable direction, restrained particles.", idle: "Stopped. Rotors idle while the study is running."};
      eventNote(messages[state.mode]); lastEventMode = state.mode;
    }
  }
  requestAnimationFrame(frame);
}

async function start() {
  try {
    const responses = await Promise.all([fetch(presetURL),fetch(new URL("./collection-presets.json",import.meta.url)),fetch(new URL("./ability-presets.json",import.meta.url))]);
    if (responses.some(response => !response.ok)) throw new Error("A presentation or collection JSON file could not be loaded");
    const [visuals, definitions, abilityDefinitions] = await Promise.all(responses.map(response => response.json()));
    presets = validateAnimationRecipes(validatePresets(visuals));
    validateCollection(definitions,Object.keys(presets.characters)); collection = definitions;
    abilityConfig=validateAbilityPresets(abilityDefinitions);
    try {
      const raw = localStorage.getItem(storageKey), restored = restoreProfile(raw,profileOptions);
      profile = restored.profile; storageWarning = restored.warning || "";
      if (restored.warning && raw !== null) recoveryRaw = raw;
    } catch {profile = createProfile(profileOptions); storageWarning = "Browser storage unavailable; this test collection is session-only.";}
    contextId = collection.contexts[0].id;
    inspectedCharacter = resolveCharacter(collection,profile,currentContext()).characterId;
    selection = {...presets.defaults}; motion = {...presets.motion}; state = createMotionState(presets.route,motion);
    autoplay = presets.defaults.autoplay; paused = reducedMotion;
    setupControls(); applyPalette(); resize(); updateAssetStatus(); readouts(); render();
    new ResizeObserver(() => {resize(); render(); readouts();}).observe(canvas);
    if (reducedMotion) eventNote("Reduced motion is on. Press Play for intentional movement.");
    requestAnimationFrame(frame);
  } catch (error) {
    $("load-error").hidden = false;
    $("load-error").textContent = `The study could not load: ${error.message}. Serve this folder over local HTTP; from the repository root run python3 -m http.server 8080, then open /authoring/motion-lab/.`;
    $("state-label").textContent = "Study unavailable";
    for (const control of document.querySelectorAll("button,input,select")) control.disabled = true;
  }
}

start();
