// Carga el juego REAL en Node con Three r128, sin render: el mismo código que build.js mete en index.html,
// leído directo de src/ en el mismo orden (build.js ORDER). BHZ_FILE=<html> carga un index.html en su lugar
// (sirve para comparar contra un tag viejo, p.ej. v1-final).
// Uso: const G = require('./harness.js');  -> expone estado y funciones del juego.
const fs = require('fs'), path = require('path'), vm = require('vm');
const THREE = require('three');

function ctx2d() {
  const g = { addColorStop() {} };
  return new Proxy({}, {
    get: (t, k) => {
      if (k === 'getImageData' || k === 'createImageData')
        return (x, y, w, h) => ({ data: new Uint8ClampedArray((w || x || 1) * (h || y || 1) * 4) });
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => g;
      if (k in t) return t[k];
      return () => {};
    },
    set: (t, k, v) => { t[k] = v; return true; }
  });
}
const el = () => ({
  style: { setProperty() {} }, classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  addEventListener() {}, appendChild() {}, insertBefore() {}, firstChild: null, remove() {}, requestPointerLock() {},
  setAttribute(k, v) { this.attrs = this.attrs || {}; this.attrs[k] = v; },
  textContent: '', innerHTML: '', offsetWidth: 0, value: ''
});
const store = {};
const document = {
  createElement: t => t === 'canvas' ? { width: 1, height: 1, getContext: () => ctx2d() } : el(),
  getElementById: () => el(), addEventListener() {}, exitPointerLock() {},
  body: el(), pointerLockElement: null
};
class FakeRenderer { constructor() { this.domElement = el(); this.shadowMap = { enabled: false, type: 0 }; this.pixelRatio = 1; }
  setPixelRatio(r) { this.pixelRatio = r; } setSize() {} clear() {} render() {} clearDepth() {} }
THREE.WebGLRenderer = FakeRenderer;

const ctx = {
  THREE, document, console, Math,
  window: { innerWidth: 1280, innerHeight: 720, addEventListener() {} },
  devicePixelRatio: 1, requestAnimationFrame() {}, setTimeout() {},
  performance: { now: () => ctx.__t * 1000 }, __t: 0,
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } }
};
ctx.globalThis = ctx;
vm.createContext(ctx);

let js;
if (process.env.BHZ_FILE) {
  const html = fs.readFileSync(process.env.BHZ_FILE, 'utf8');
  js = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()[1];
} else {
  js = require(path.join(__dirname, '..', '..', 'build.js')).bundle();
}
// BHZ_NOTHEME=1 -> carga el juego sin el tema visual (theme.js compara ambos: la lógica debe ser idéntica)
if (process.env.BHZ_NOTHEME) {
  if (!js.includes('true /*THEME_ENABLED*/')) throw new Error('marcador THEME_ENABLED no encontrado');
  js = js.replace('true /*THEME_ENABLED*/', 'false');
}
js += `\n;globalThis.G={scene,state,player,camera,clock,CONFIG,NAV,WORLD,FLOW,ZPOOL,SPAWN_POINTS,roundState,
 updateFlowField,updateZombies,updateRounds,spawnZombie,startRound,resetGame,gameOver,damagePlayer,
 debugOpenAllDoors,damageZombie,isNav,flowAt,roomAt,aliveCount,
 keys,feel,weaponsState,updatePlayer,updateCameraFeel,feelOnFire,feelOnZombieHit,feelOnHurt,dmgNums,spawnDamageNumber,
 placeRoot,updateWeapon,giveWeapon,curDef,meleeAttack,meleeState,updatePickups,updateEffects,PICKUPS,
 trySpawnPickup,applyPowerup,onZombieDeath,roundState,resetGame,addPoints,
 updateInteract,interactState,interact,buyWallWeapon,buyDoor,spendPoints,WALLBUYS,promptFor,fireWeapon,recoilReturnOf,
 BOX,useBox,updateBox,openRooms,placeBox,resetBox,rollBoxResult,boxDestinations,buildNavGrid,updateWeaponFx,
 THEMEFX,updateTheme,isVisibleToPlayer,
 AUDIO,SETTINGS,STATS,MENU,UI,initAudio,audioOn,sfxShot,sfxReload,sfxGrowl,sfxBell,sfxHurt,sfxPowerup,sfxBoxTick,
 sfxTeddy,sfxSwing,sfxDry,sfxHit,sfxBuy,sfxDeny,updateZombieAudio,updateFlameAudio,updateAmbience,setVolume,
 setSensitivity,lookInput,showMenu,favoriteWeapon,fmtTime,reloadWeapon,RELOAD_STEPS,
 PROPS,addPropCollider,ROOMS,segmentClear,moveCircle,COLHASH,
 POOL,groundY,DOOR_LINKS,openDoor,
 RELICS,GEN_KEYS,SOUL_KEYS,hitGenerator,soulFromKill,papReady,papMissing,checkPap,updateRelics,resetRelics,
 sfxGenerator,sfxSoul,sfxPapOn,addImpactDecal,decals,
 navIdx,rollGait,gaitMix,animateZombie,nearestNav,respawnZombie,
 GREN,startCook,releaseGrenade,spawnGrenade,stepGrenade,explodeAt,updateGrenades,addRoundGrenades,resetGrenades,
 sfxPin,sfxGrenadeBounce,sfxExplosion,
 PERKM,PERK_KEYS,hasPerk,maxHealth,perkRate,perkDmg,perkReload,sprintMul,staminaMul,turnOnPower,perkStatus,buyPerk,
 tryRevive,CRASH,DOWN,updateDown,startDown,endDown,fleeZombie,eyeDrop,updatePerks,resetPerks,stamina,sfxPowerOn,sfxJingle,sfxPerkDrink,sfxRevive,sfxBreath,
 PAPST,usePap,grabPap,papPrompt,papDef,slotDef,curSlot,sfxPapWork,sfxPapDone,
 SHIELDST,SHIELD_PARTS,rollShieldSpots,pickPart,benchPrompt,benchPress,toggleShield,unequipShield,shieldBlocks,
 shieldBash,updateShield,resetShield,selectWeapon,switchWeapon,sfxPartPickup,sfxShieldTake,sfxShieldHit,sfxShieldBreak,sfxShieldBash,
 ADS,adsSpread,updateAds,resetAds,meleeDef,tracePierce,buildMacheteModel,
 floorAt,standable,headroom,UP,upIdx,isUp,levelAt,playerLevel,lvFlow,startClimb,roofAt,fallDamage,
 DEBUG,debugKey,debugRound,toggleNoclip,resetDebug,
 DPOOL,DRIPS,NIGHT,wantDrowned,pickSpawnPoint,startCrawl,spawnDog,maxAliveFor,isDogRound,setNight,lightning,
 updateNight,updateDrips,resetEnemies,queueRound,sfxThunder,
 BOSS,spawnBoss,bossAlive,bossSpeed,bossTick,bossSummon,bossDamaged,knockHat,freePerk,isBossRound,updateBoss,
 resetBoss,bossSpawnPoint,canCharge,startAct,STATS,renderer,
 throwGuitar,fireCoco,bossGun,updateBossShots,canShootAt,projBlocked,
 QUEST,palmTop,hitPalm,cocoSpot,dropString,shootShell,shellReady,plantEat,plantAlien,placeShellOnTurtle,questPieces,pickQuestPiece,questCount,haveWave,workshopPrompt,
 workshopPress,takeWave,loseWave,fireWave,updateQuest,craftWave,resetQuest,bossDeath,traceShot,sfxCoconut,sfxShellRise,
 PLANTS,PIRANHAS,updatePiranhas,resetPiranhas,sfxPiranha,updateGarden,ACID,spitAcid,acidPuddle,updateAcid,wetSandMul,speedCap,spawnGardenDog,resetGarden,walkAt,flightH,inFlight,playerOnTop,powerMissing,sfxPlantWarn,sfxPlantBite,bossesFor,throwSquid,bossEyes,TRAPS,useTrap,updateTraps,trapPrompt,resetTraps,trapKill,setSky,weatherFogFar,RAIN,updateRain,NIGHT,SQPOOL,spawnSquid,squidTick,fuseSquids,fireInk,canInk,INK,updateSquids,mobKind,spawnMob,setSquidSize,squidsAlive,resetZombie,kaboom,KABOOM,updateKaboom,applyPowerup,debugUnlockAll,STARS,plantEatAnim,BUNK,openBunker,statueKill,setSquidHead,SQHEAD,squidRise,TEMPLEFX,CLAMS,rollClam,openClam,clamsRound,resetClams,updateClams,pieceAvailable,clamSnap,updateMusic,MUSIC,musicIntensity,surfaceAt,updateFootsteps,FOOT,sfxRoundDrum,setMusicVolume,setSfxVolume,spatialOut,zombieSteps,ambienceZone,sfxStep,GFX,applyQuality,setShadows,setPost,updateGfx,gfxFilter,paletteAt,BEACH,updateBeach,inThicket,THICKET,buildThicketWalls,DOOR_LINKS,OPEN_LINKS,GIBS,goreKill,loseArm,deathPose,updateGibs,resetGibs,pickW,isHuman,spawnGib,wakeStatue,updateStatues,useHatch,hatchTeleport,updateBunker,inBunker,setZombieEyes,maxWeapons,dropMuleWeapon,MONKEY,giveMonkeys,throwMonkey,updateMonkeys,monkeyLure,FLOW,ROCKETS,launchRocket,updateRockets,updateBow,releaseBow,rollBoxResult,explodeAt,GIANT,giantRise,giantLaunch,updateGiant,giantBusy,beachReachable,equipModel,JUNGLE,startBurn,updateBurns,roman,rainZone,refundBox,rainRoof,portalOn,PORTAL,usePortal,portalNear,BUNK,shootTomb,openPortals,resetPortals,portalCarry,isNav,setFog,SETTINGS,POLICE,policeWake,updatePolice,closeDoor,shellK,SHELLFX,RANCHO,LAMPS};`;
vm.runInContext(js, ctx);
// F4/F5: las rondas de perros (5-7) y de boss (12, 20...) no las esperan los tests que corren rondas.
// enemies.js y boss.js las prenden
ctx.G.CONFIG.DOGS.enabled = false;
ctx.G.CONFIG.BOSS.enabled = false;

ctx.G.store = store;
ctx.G.sandbox = ctx;              // para inyectar un AudioContext falso (window.AudioContext) en audio.js
// avanza el reloj del juego (lo usan flow field, i-frames y regen)
ctx.G.tick = dt => { ctx.__t += dt; ctx.G.clock.elapsedTime = ctx.__t; };
ctx.G.setCam = yaw => {
  const c = ctx.G.camera, P = ctx.G.player;
  P.yaw = yaw; P.pitch = 0;
  c.position.copy(P.pos); c.rotation.set(0, yaw, 0, 'YXZ'); c.updateMatrixWorld();
  ctx.G.updateCameraFeel(0);           // sincroniza feel.aimQuat/feel.eye (los usan fireWeapon/meleeAttack)
};
module.exports = ctx.G;
