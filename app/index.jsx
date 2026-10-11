var React = require('react');
var ReactDOM = require('react-dom');

var buttonUpgradeFullList = require('./upgrades.json');

var autoclickUpdateRate = 20;
var META_SAVE_KEY = 'clickerExeMetaV1';
var GAME_SAVE_KEY = 'clickerExeGameV1';
var SETTINGS_SAVE_KEY = 'clickerExeSettingsV1';
// Change this to your own public Clicker.exe repository before publishing.
var SOURCE_CODE_URL = 'https://github.com/az75852-cell/ClickerJs';
var REBIRTH_LOADS_BASE = 20;
var REBIRTH_POPUP_TEXT = 'You earned a rebirth! Try it to reset your ordinary progress in exchange for permanent power. Your glitches will become more dangerous, so prepare before you proceed.';

// This project uses synthesized Web Audio tones, so no external audio files
// are required. Audio begins after the player's first deliberate interaction.
var audioContext = null;
var musicTimer = null;
var musicStep = 0;

function getEmptyMeta(upgradeCount) {
  return {
    lifetimePlayerClicks: 0,
    lifetimeLoads: 0,
    bestCPS: 0,
    bestManualClicksPer10Seconds: 0,
    lifetimeTimePlayedSeconds: 0,
    lifetimeUpgradePurchases: Array.apply(null, Array(upgradeCount)).map(Number.prototype.valueOf, 0),
    achievements: {},
    achievementPointsAwarded: {},
    powerUpPoints: 0,
    powerUps: { hacker: 0, ai: 0, system_patch: 0 },
    powerUpTaskClaims: {},
    rebirths: 0,
    rebirthStartLifetimeLoads: 0,
    closeCalls: 0
  };
}

function loadMeta(upgradeCount) {
  var emptyMeta = getEmptyMeta(upgradeCount);
  try {
    var saved = localStorage.getItem(META_SAVE_KEY);
    if (!saved) return emptyMeta;
    var parsed = JSON.parse(saved);
    if (!parsed || typeof parsed !== 'object') return emptyMeta;

    var meta = emptyMeta;
    meta.lifetimePlayerClicks = Math.max(0, Number(parsed.lifetimePlayerClicks) || 0);
    meta.lifetimeLoads = Math.max(0, Number(parsed.lifetimeLoads) || 0);
    meta.bestCPS = Math.max(0, Number(parsed.bestCPS) || 0);
    meta.bestManualClicksPer10Seconds = Math.max(0, Number(parsed.bestManualClicksPer10Seconds) || 0);
    meta.lifetimeTimePlayedSeconds = Math.max(0, Number(parsed.lifetimeTimePlayedSeconds) || 0);
    meta.rebirths = Math.max(0, Math.floor(Number(parsed.rebirths) || 0));
    meta.rebirthStartLifetimeLoads = Math.max(0, Number(parsed.rebirthStartLifetimeLoads) || 0);
    meta.closeCalls = Math.max(0, Number(parsed.closeCalls) || 0);

    if (Array.isArray(parsed.lifetimeUpgradePurchases)) {
      meta.lifetimeUpgradePurchases = parsed.lifetimeUpgradePurchases.slice(0, upgradeCount).map(function(n) { return Math.max(0, Number(n) || 0); });
      while (meta.lifetimeUpgradePurchases.length < upgradeCount) meta.lifetimeUpgradePurchases.push(0);
    }
    if (parsed.achievements && typeof parsed.achievements === 'object') meta.achievements = parsed.achievements;
    if (parsed.achievementPointsAwarded && typeof parsed.achievementPointsAwarded === 'object') {
      meta.achievementPointsAwarded = parsed.achievementPointsAwarded;
    }
    meta.powerUpPoints = Math.max(0, Number(parsed.powerUpPoints) || 0);
    if (parsed.powerUps && typeof parsed.powerUps === 'object') {
      meta.powerUps.hacker = Math.max(0, Number(parsed.powerUps.hacker) || 0);
      meta.powerUps.ai = Math.max(0, Number(parsed.powerUps.ai) || 0);
      meta.powerUps.system_patch = Math.max(0, Number(parsed.powerUps.system_patch) || 0);
    }
    if (parsed.powerUpTaskClaims && typeof parsed.powerUpTaskClaims === 'object') meta.powerUpTaskClaims = parsed.powerUpTaskClaims;

    // One-time migration: record legacy achievement rewards in the new ledger.
    // Older versions already included these points in powerUpPoints.
    if (!parsed.achievementPointsAwarded || typeof parsed.achievementPointsAwarded !== 'object') {
      Object.keys(meta.achievements).forEach(function(id) {
        if (meta.achievements[id]) {
          // Older versions already credited this achievement in powerUpPoints.
          // Mark it as paid without adding another point during migration.
          meta.achievementPointsAwarded[id] = true;
        }
      });
    }
    return meta;
  } catch (error) {
    return emptyMeta;
  }
}

function saveMeta(meta) {
  try { localStorage.setItem(META_SAVE_KEY, JSON.stringify(meta)); } catch (error) { /* Keep the session playable if storage is unavailable. */ }
}

function loadGame(upgradeCount) {
  var fresh = {
    clicks: 0,
    upgrades: Array.apply(null, Array(upgradeCount)).map(Number.prototype.valueOf, 0),
    loadingProgress: 0,
    loadGoal: 100,
    completedLoads: 0,
    glitchActive: false,
    glitchWarning: false,
    glitchClicksRemaining: 0,
    glitchRecoveryClicks: 0,
    glitchTimeRemainingMs: 0,
    nextGlitchLoad: Math.floor(Math.random() * 5) + 3,
    activePowerUp: null,
    repairCharge: false,
    boughtSlowClickerSinceRebirth: false,
    rebirthPromptSeen: false
  };
  try {
    var raw = localStorage.getItem(GAME_SAVE_KEY);
    if (!raw) return fresh;
    var parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return fresh;
    fresh.clicks = Math.max(0, Number(parsed.clicks) || 0);
    if (Array.isArray(parsed.upgrades)) {
      fresh.upgrades = parsed.upgrades.slice(0, upgradeCount).map(function(n) { return Math.max(0, Math.floor(Number(n) || 0)); });
      while (fresh.upgrades.length < upgradeCount) fresh.upgrades.push(0);
    }
    fresh.loadingProgress = Math.max(0, Number(parsed.loadingProgress) || 0);
    fresh.loadGoal = Math.max(100, Number(parsed.loadGoal) || 100);
    fresh.completedLoads = Math.max(0, Math.floor(Number(parsed.completedLoads) || 0));
    fresh.glitchActive = !!parsed.glitchActive;
    fresh.glitchWarning = !!parsed.glitchWarning;
    fresh.glitchClicksRemaining = Math.max(0, Number(parsed.glitchClicksRemaining) || 0);
    fresh.glitchRecoveryClicks = Math.max(0, Number(parsed.glitchRecoveryClicks) || 0);
    fresh.glitchTimeRemainingMs = Math.max(0, Number(parsed.glitchTimeRemainingMs) || 0);
    fresh.nextGlitchLoad = Math.max(fresh.completedLoads + 1, Number(parsed.nextGlitchLoad) || fresh.nextGlitchLoad);
    fresh.activePowerUp = parsed.activePowerUp && typeof parsed.activePowerUp === 'object' ? parsed.activePowerUp : null;
    fresh.repairCharge = !!parsed.repairCharge;
    fresh.boughtSlowClickerSinceRebirth = !!parsed.boughtSlowClickerSinceRebirth;
    fresh.rebirthPromptSeen = !!parsed.rebirthPromptSeen;
    // An old save with an active glitch receives a safe timer if it had no timer yet.
    if (fresh.glitchActive && fresh.glitchTimeRemainingMs <= 0) fresh.glitchTimeRemainingMs = 12000;
    return fresh;
  } catch (error) {
    return fresh;
  }
}

function saveGame(game) {
  try { localStorage.setItem(GAME_SAVE_KEY, JSON.stringify(game)); } catch (error) { /* Ignore storage quota/private-mode errors without crashing. */ }
}

function getDefaultSiteSettings() {
  return {
    sfxEnabled: true,
    musicEnabled: true,
    sfxVolume: 0.55,
    musicVolume: 0.22,
    reducedFlashing: false,
    particlesEnabled: true,
    photosensitivityAcknowledged: false
  };
}

function loadSiteSettings() {
  var defaults = getDefaultSiteSettings();
  try {
    var raw = localStorage.getItem(SETTINGS_SAVE_KEY);
    if (!raw) return defaults;
    var saved = JSON.parse(raw);
    if (!saved || typeof saved !== 'object') return defaults;
    Object.keys(defaults).forEach(function(key) {
      if (typeof defaults[key] === 'boolean' && typeof saved[key] === 'boolean') defaults[key] = saved[key];
      if (typeof defaults[key] === 'number' && isFinite(Number(saved[key]))) defaults[key] = Math.max(0, Math.min(1, Number(saved[key])));
    });
    return defaults;
  } catch (error) { return defaults; }
}

function saveSiteSettings(settings) {
  try { localStorage.setItem(SETTINGS_SAVE_KEY, JSON.stringify(settings)); } catch (error) { /* Settings remain active in memory. */ }
}

function ensureAudioContext() {
  if (audioContext) return audioContext;
  try {
    var AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audioContext = new AudioContextClass();
  } catch (error) { audioContext = null; }
  return audioContext;
}

function playTone(settings, kind, combo) {
  if (!settings || !settings.sfxEnabled || settings.sfxVolume <= 0) return;
  var ctx = ensureAudioContext();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
    var tones = { click: 460, purchase: 760, load: 610, achievement: 880, warning: 180, crash: 95, recovery: 990, rebirth: 530, patch: 420 };
    var base = tones[kind] || 440;
    var oscillator = ctx.createOscillator();
    var gain = ctx.createGain();
    oscillator.type = kind === 'crash' || kind === 'warning' ? 'sawtooth' : 'square';
    oscillator.frequency.setValueAtTime(Math.min(1600, base + Math.min(12, combo || 0) * 24), ctx.currentTime);
    if (kind === 'recovery' || kind === 'achievement' || kind === 'rebirth') oscillator.frequency.exponentialRampToValueAtTime(Math.min(1800, base * 1.45), ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, settings.sfxVolume * (kind === 'crash' ? 0.10 : 0.065)), ctx.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (kind === 'load' || kind === 'achievement' || kind === 'recovery' ? 0.24 : 0.075));
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + (kind === 'load' || kind === 'achievement' || kind === 'recovery' ? 0.25 : 0.08));
    if (kind === 'click' && combo >= 3) {
      var harmonic = ctx.createOscillator();
      var harmonicGain = ctx.createGain();
      harmonic.type = 'sine';
      harmonic.frequency.setValueAtTime(Math.min(1700, base * 1.55 + Math.min(combo, 12) * 18), ctx.currentTime);
      harmonicGain.gain.setValueAtTime(0.0001, ctx.currentTime);
      harmonicGain.gain.exponentialRampToValueAtTime(Math.max(0.0002, settings.sfxVolume * 0.018), ctx.currentTime + 0.018);
      harmonicGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.07);
      harmonic.connect(harmonicGain);
      harmonicGain.connect(ctx.destination);
      harmonic.start();
      harmonic.stop(ctx.currentTime + 0.075);
    }
  } catch (error) { /* Audio is optional and must never break gameplay. */ }
}

function stopBackgroundMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
}

function startBackgroundMusic(settings) {
  if (!settings || !settings.musicEnabled || settings.musicVolume <= 0 || musicTimer) return;
  var ctx = ensureAudioContext();
  if (!ctx) return;
  var notes = [196, 247, 294, 247, 220, 262, 330, 262, 174, 220, 262, 220];
  musicTimer = setInterval(function() {
    if (!audioContext || !settings.musicEnabled || settings.musicVolume <= 0) return;
    try {
      if (audioContext.state === 'suspended' && audioContext.resume) audioContext.resume();
      var osc = audioContext.createOscillator();
      var gain = audioContext.createGain();
      osc.type = 'triangle';
      osc.frequency.value = notes[musicStep % notes.length];
      gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, settings.musicVolume * 0.035), audioContext.currentTime + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.32);
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.start();
      osc.stop(audioContext.currentTime + 0.34);
      musicStep++;
    } catch (error) { /* Music is decorative. */ }
  }, 360);
}

// ============================================================
// Achievements: one-time rewards, lifetime milestones, and secrets.
// ============================================================
var achievementList = [
  { id: 'first_click', title: 'FIRST CLICK', description: 'Make your first manual click.', check: function(s) { return s.lifetimePlayerClicks >= 1; } },
  { id: 'click_apprentice', title: '100 CLICKS', description: 'Reach 100 lifetime manual clicks.', check: function(s) { return s.lifetimePlayerClicks >= 100; } },
  { id: 'click_machine', title: '1,000 CLICKS', description: 'Reach 1,000 lifetime manual clicks.', check: function(s) { return s.lifetimePlayerClicks >= 1000; } },
  { id: 'click_legend', title: '10,000 CLICKS', description: 'Reach 10,000 lifetime manual clicks.', check: function(s) { return s.lifetimePlayerClicks >= 10000; } },
  { id: 'first_load', title: 'FIRST LOAD', description: 'Complete your first system load.', check: function(s) { return s.lifetimeLoads >= 1; } },
  { id: 'ten_loads', title: '10 LOADS', description: 'Complete 10 lifetime system loads.', check: function(s) { return s.lifetimeLoads >= 10; } },
  { id: 'fifty_loads', title: '50 LOADS', description: 'Complete 50 lifetime system loads.', check: function(s) { return s.lifetimeLoads >= 50; } },
  { id: 'hundred_loads', title: '100 LOADS', description: 'Complete 100 lifetime system loads.', check: function(s) { return s.lifetimeLoads >= 100; } },
  { id: 'twenty_slow_clickers', title: '20 SLOW CLICKERS', description: 'Purchase 20 Slow Clickers over your career.', check: function(s) { return (s.lifetimeUpgradePurchases[0] || 0) >= 20; } },
  { id: 'platoon', title: 'PLATOON', description: 'Purchase 200 Slow Clickers over your career.', check: function(s) { return (s.lifetimeUpgradePurchases[0] || 0) >= 200; } },
  { id: 'click_national_guard', title: 'CLICK NATIONAL GUARD', description: 'Purchase 200 Okay Clickers over your career.', check: function(s) { return (s.lifetimeUpgradePurchases[1] || 0) >= 200; } },
  { id: 'pro_coder', title: 'PRO CODER', description: 'Purchase 200 Ultra Clickers over your career.', check: function(s) { return (s.lifetimeUpgradePurchases[2] || 0) >= 200; } },
  { id: 'lag_drag', title: 'LAG DRAG', description: 'Purchase The One Clicker To Rule Them All.', check: function(s) { return (s.lifetimeUpgradePurchases[8] || 0) >= 1; } },
  { id: 'fifty_cps', title: '50 CPS', description: 'Reach 50 CPS.', check: function(s) { return s.bestCPS >= 50; } },
  { id: 'hundred_cps', title: '100 CPS', description: 'Reach 100 CPS.', check: function(s) { return s.bestCPS >= 100; } },
  { id: 'five_hundred_cps', title: '500 CPS', description: 'Reach 500 CPS.', check: function(s) { return s.bestCPS >= 500; } },
  { id: 'zip_bomb_proof', title: 'ZIP-BOMB-PROOF', description: 'Reach 1,000 CPS.', check: function(s) { return s.bestCPS >= 1000; } },
  { id: 'small_clicker_army', title: 'SMALL CLICKER ARMY', description: 'Reach 5,000 CPS.', check: function(s) { return s.bestCPS >= 5000; } },
  { id: 'clickertopia', title: 'CLICKERTOPIA', description: 'Reach 10,000 CPS.', check: function(s) { return s.bestCPS >= 10000; } },
  { id: 'click_tera', title: 'CLICK TERA', description: 'Reach 100,000 CPS.', check: function(s) { return s.bestCPS >= 100000; } },
  { id: 'sore_fingers', title: 'SORE FINGERS', description: 'Reach 50,000 lifetime manual clicks.', check: function(s) { return s.lifetimePlayerClicks >= 50000; } },
  { id: 'raw_fingers', title: 'RAW FINGERS', description: 'Reach 100,000 lifetime manual clicks.', check: function(s) { return s.lifetimePlayerClicks >= 100000; } },
  { id: 'call_help', title: 'CALL HELP', description: 'Reach 500,000 lifetime manual clicks.', check: function(s) { return s.lifetimePlayerClicks >= 500000; } },
  { id: 'windows_update', title: 'WINDOWS UPDATE', description: 'Complete 1,000 lifetime system loads.', check: function(s) { return s.lifetimeLoads >= 1000; } },
  { id: 'cod_download', title: 'COD DOWNLOAD', description: 'Complete 10,000 lifetime system loads.', check: function(s) { return s.lifetimeLoads >= 10000; } },
  { id: 'no_longer_welcome', title: 'NO LONGER WELCOME AT MICRO CENTER', description: 'Purchase 200 Giga Clickers over your career.', check: function(s) { return (s.lifetimeUpgradePurchases[5] || 0) >= 200; } },
  { id: 'the_web', title: 'THE WEB', description: 'Complete 1,000,000 lifetime system loads.', check: function(s) { return s.lifetimeLoads >= 1000000; } },
  { id: 'robotastic', title: 'ROBOTASTIC', description: 'Purchase 2,000 Ultra Clickers over your career.', check: function(s) { return (s.lifetimeUpgradePurchases[2] || 0) >= 2000; } },
  { id: 'conception', title: 'CONCEPTION', description: 'Perform your first rebirth.', hidden: true, check: function(s) { return s.rebirths >= 1; } },
  { id: 'learned_a_lesson', title: 'LEARNED A LESSON', description: 'Reach the next rebirth milestone without buying a Slow Clicker after rebirth.', hidden: true, check: function(s) { return s.rebirths >= 1 && s.lifetimeLoads - (s.rebirthStartLifetimeLoads || 0) >= s.rebirths * REBIRTH_LOADS_BASE && !s.boughtSlowClickerSinceRebirth; } },
  { id: 'kindergeld', title: 'KINDERGELD', description: 'Perform 10 rebirths.', hidden: true, check: function(s) { return s.rebirths >= 10; } },
  { id: 'touch_grass', title: 'TOUCH GRASS', description: 'Accumulate 10 hours of active gameplay.', check: function(s) { return s.lifetimeTimePlayedSeconds >= 10 * 60 * 60; } },
  { id: 'close_call', title: 'CLOSE CALL', description: 'Recover the system with less than one second remaining on the crash timer.', check: function(s) { return s.closeCalls >= 1; } },
  { id: 'fast_clicker', title: 'HOW FAST CAN YOU CLICK IT?', description: 'Make at least 70 manual clicks in a rolling 10-second window.', check: function(s) { return s.bestManualClicksPer10Seconds >= 70; } }
];

// Repeatable point tasks remain available, with CPS tasks measured against best CPS.
var powerUpTaskList = [
  { id: 'player_clicks_100', title: '100 PLAYER CLICKS', description: 'Reach another 100 lifetime manual clicks.', stat: 'lifetimePlayerClicks', target: 100, points: 1, maxCPS: 25 },
  { id: 'player_clicks_500', title: '500 PLAYER CLICKS', description: 'Reach another 500 lifetime manual clicks.', stat: 'lifetimePlayerClicks', target: 500, points: 1, maxCPS: 75 },
  { id: 'loads_10', title: '10 SYSTEM LOADS', description: 'Complete another 10 system loads.', stat: 'lifetimeLoads', target: 10, points: 1, maxCPS: 50 },
  { id: 'loads_20', title: '20 SYSTEM LOADS', description: 'Complete another 20 system loads.', stat: 'lifetimeLoads', target: 20, points: 1, maxCPS: 150 },
  { id: 'slow_clickers_20', title: '20 SLOW CLICKERS', description: 'Purchase another 20 Slow Clickers.', stat: 'slowClickersPurchased', target: 20, points: 1, maxCPS: 250 },
  { id: 'cps_50', title: '50 CPS', description: 'Reach each new 50-CPS milestone on your best CPS record.', stat: 'bestCPS', target: 50, points: 1 },
  { id: 'cps_100', title: '100 CPS', description: 'Reach each new 100-CPS milestone on your best CPS record.', stat: 'bestCPS', target: 100, points: 1 },
  { id: 'cps_500', title: '500 CPS', description: 'Reach each new 500-CPS milestone on your best CPS record.', stat: 'bestCPS', target: 500, points: 2 }
];

var powerUpList = [
  { id: 'hacker', title: 'HACKER', description: '+25% all clicker speed for 5 minutes.', multiplier: 1.25, duration: 5 * 60 * 1000, cost: 1 },
  { id: 'ai', title: 'AI', description: '+75% all clicker speed for 10 minutes.', multiplier: 1.75, duration: 10 * 60 * 1000, cost: 3 },
  { id: 'system_patch', title: 'EMERGENCY PATCH', description: 'Halves the next glitch recovery clicks and adds 4 seconds to its countdown.', special: 'repair', cost: 2 }
];

function getPowerUpDefinition(powerUpId) {
  return powerUpList.find(function(powerUp) { return powerUp.id === powerUpId; });
}

// ============================================================
// Achievements Panel
// ============================================================

var AchievementsPanel = React.createClass({
  render: function() {
    var state = this.props.state;
    var visibleAchievements = achievementList.filter(function(a) {
      return !a.hidden || !!state.achievements[a.id];
    });
    var unlockedCount = achievementList.filter(function(a) { return !!state.achievements[a.id]; }).length;
    var cards = visibleAchievements.map(function(achievement) {
      var unlocked = !!state.achievements[achievement.id];
      return (
        <div key={achievement.id} className={'achievementCard ' + (unlocked ? 'achievementUnlocked' : 'achievementLocked')}>
          <div className="achievementStatus">{unlocked ? 'UNLOCKED · +1 POINT' : 'LOCKED'}</div>
          <div className="achievementTitle">{achievement.title}</div>
          <div className="achievementDescription">{achievement.description}</div>
        </div>
      );
    });
    return (
      <div className="settingsPanel">
        <div className="settingsPanelHeader"><span>ACHIEVEMENTS</span><span>{unlockedCount} / {visibleAchievements.length}</span></div>
        <div className="settingsPanelNote">Achievement unlocks are permanent and award one Power-Up Point once. Hidden achievements appear only after discovery.</div>
        <div className="achievementList">{cards}</div>
      </div>
    );
  }
});

var PowerUpsPanel = React.createClass({
  render: function() {
    var state = this.props.state;
    var currentCPS = this.props.currentCPS;
    var powerUpTaskCards = powerUpTaskList.map(function(task) {
      var statValue = 0;
      if (task.stat === 'lifetimePlayerClicks') statValue = state.lifetimePlayerClicks;
      if (task.stat === 'lifetimeLoads') statValue = state.lifetimeLoads;
      if (task.stat === 'bestCPS') statValue = state.bestCPS;
      if (task.stat === 'slowClickersPurchased') statValue = state.lifetimeUpgradePurchases[0] || 0;
      var claimed = Number(state.powerUpTaskClaims[task.id]) || 0;
      var availableCycles = Math.floor(statValue / task.target);
      var claimable = availableCycles > claimed;
      var lockedByCPS = task.maxCPS !== undefined && currentCPS >= task.maxCPS;
      var currentCycleProgress = claimable ? task.target : statValue % task.target;
      var buttonText = lockedByCPS ? 'LOCKED' : (!claimable ? 'NOT READY' : 'CLAIM');
      return (
        <div key={task.id} className="powerUpTaskCard">
          <div className="powerUpTaskTop">
            <div><div className="powerUpTaskTitle">{task.title}</div><div className="powerUpTaskDescription">{task.description}</div></div>
            <div className="powerUpTaskReward">+{task.points} POINT{task.points === 1 ? '' : 'S'}</div>
          </div>
          <div className="powerUpTaskProgress">{Math.floor(currentCycleProgress).toLocaleString()} / {task.target.toLocaleString()}</div>
          <div className="powerUpTaskMeta"><span>CLAIMED: {claimed.toLocaleString()}</span>{task.maxCPS !== undefined && <span>LOCKS AT {task.maxCPS.toLocaleString()} CPS</span>}</div>
          <button className="powerUpClaimButton" type="button" onClick={this.props.claimTask.bind(null, task.id)} disabled={!claimable || lockedByCPS}>{buttonText}</button>
        </div>
      );
    }.bind(this));

    var anyTimedPowerUpActive = !!(state.activePowerUp && state.activePowerUp.remainingMs > 0);
    var powerUpCards = powerUpList.map(function(powerUp) {
      var owned = state.powerUps[powerUp.id] || 0;
      var isPatch = powerUp.special === 'repair';
      var active = isPatch ? !!state.repairCharge : !!(state.activePowerUp && state.activePowerUp.id === powerUp.id && state.activePowerUp.remainingMs > 0);
      var buyDisabled = state.powerUpPoints < powerUp.cost;
      var activateDisabled = owned <= 0 || (isPatch ? !!state.repairCharge : anyTimedPowerUpActive);
      return (
        <div key={powerUp.id} className="powerUpCard">
          <div className="powerUpTitle">{powerUp.title}</div>
          <div className="powerUpDescription">{powerUp.description}</div>
          <div className="powerUpOwned">OWNED: {owned}</div>
          <button className="powerUpBuyButton" type="button" onClick={this.props.buyPowerUp.bind(null, powerUp.id)} disabled={buyDisabled}>BUY · {powerUp.cost} POINT{powerUp.cost === 1 ? '' : 'S'}</button>
          <button className="powerUpActivateButton" type="button" onClick={this.props.activatePowerUp.bind(null, powerUp.id)} disabled={activateDisabled}>{active ? (isPatch ? 'PATCH ARMED' : 'ACTIVE') : (isPatch ? 'ARM PATCH' : (anyTimedPowerUpActive ? 'ANOTHER POWER-UP ACTIVE' : 'ACTIVATE'))}</button>
        </div>
      );
    }.bind(this));

    var activeText = 'NONE';
    if (state.repairCharge) activeText = 'EMERGENCY PATCH ARMED';
    else if (anyTimedPowerUpActive) {
      var activeDefinition = getPowerUpDefinition(state.activePowerUp.id);
      var remainingSeconds = Math.ceil(state.activePowerUp.remainingMs / 1000);
      if (activeDefinition) activeText = activeDefinition.title + ' — ' + Math.floor(remainingSeconds / 60) + ':' + String(remainingSeconds % 60).padStart(2, '0');
    }

    return (
      <div className="settingsPanel">
        <div className="powerUpPointsBox"><div className="powerUpPointsLabel">POWER-UP POINTS</div><div className="powerUpPointsValue">{state.powerUpPoints.toLocaleString()}</div><div className="powerUpActiveText">ACTIVE: {activeText}</div></div>
        <div className="settingsPanelHeader"><span>REPEATABLE TASKS</span></div>
        <div className="settingsPanelNote">Tasks repeat forever. Claim each completed reward to receive Power-Up Points. CPS tasks are measured against your best CPS record.</div>
        <div className="powerUpTaskList">{powerUpTaskCards}</div>
        <div className="settingsPanelHeader"><span>POWER-UPS</span></div>
        <div className="settingsPanelNote">Buy consumable boosts with Power-Up Points. Emergency Patch arms your next glitch recovery; Hacker and AI temporarily increase clicker speed.</div>
        <div className="powerUpList">{powerUpCards}</div>
      </div>
    );
  }
});

// ------------------------------------------------------------
// Statistics
// ------------------------------------------------------------

var ClickCounter = React.createClass({

  render: function() {

    return (
      <div className="stats">

        <div className="clickCount">
          {Math.floor(
            this.props.clicks
          ).toLocaleString()}
        </div>

        <div className="clickLabel">
          CLICKS
        </div>

        <div className="cps">
          {this.props.clickDelta.toFixed(1)}
          {' '}
          CPS
        </div>

      </div>
    );
  }

});


// ------------------------------------------------------------
// Loading bar
// ------------------------------------------------------------

var LoadingBar = React.createClass({

  render: function() {

    var percentage =
      Math.min(
        100,
        (
          this.props.progress /
          this.props.goal
        ) * 100
      );

    return (
      <div className="loadingSection">

        <div className="loadingHeader">

          <span>
            SYSTEM LOAD
          </span>

          <span>
            {Math.floor(percentage)}%
          </span>

        </div>

        <div className="loadingBar">

          <div
            className="loadingFill"
            style={{
              width: percentage + '%'
            }}
          />

        </div>

        <div className="loadingText">

          {Math.floor(
            this.props.progress
          ).toLocaleString()}

          {' / '}

          {Math.floor(
            this.props.goal
          ).toLocaleString()}

        </div>

      </div>
    );
  }

});


// ------------------------------------------------------------
// Main click button
// ------------------------------------------------------------

var ClickButton = React.createClass({

  handleClick: function() {

    this.props.submitClick();

    var button =
      document.getElementById(
        'mainClickButton'
      );

    if (button) {

      button.classList.remove(
        'clicked'
      );

      void button.offsetWidth;

      button.classList.add(
        'clicked'
      );

    }
  },


  render: function() {

    return (

      <button
        id="mainClickButton"
        className="mainClickButton"
        type="button"
        onClick={this.handleClick}
      >
      </button>

    );
  }

});


// ------------------------------------------------------------
// Upgrade button
// ------------------------------------------------------------

var UpgradeButton = React.createClass({

  render: function() {

    var upgrade =
      this.props.data;

    var id =
      upgrade.id;

    var state =
      this.props.state;

    var numUpgraded =
      state.upgrades[id];

    var cost =
      Math.floor(
        upgrade.minclicks *
        Math.pow(
          1.15,
          numUpgraded
        )
      );

    var isPlaceholder =
      upgrade.placeholder === true;

    var isDisabled =
      isPlaceholder ||
      state.clicks < cost;

    return (

      <div className="upgradeCard">

        <button
          className="upgradeButton"
          type="button"
          onClick={
            this.props.submitUpgrade
          }
          disabled={isDisabled}
        >

          <div className="upgradeTitle">
            {upgrade.label}
          </div>

          <div className="upgradeInfo">
            {isPlaceholder
              ? 'COMING SOON'
              : (
                <span>
                  +{upgrade.ratepersecond}
                  {' '}
                  CPS
                </span>
              )
            }
          </div>

          {!isPlaceholder && (

            <div className="upgradeOwned">
              OWNED:
              {' '}
              {numUpgraded}
            </div>

          )}

          <div className="upgradeCost">
            {isPlaceholder
              ? 'UNDER DEVELOPMENT'
              : (
                <span>
                  COST:
                  {' '}
                  {cost.toLocaleString()}
                </span>
              )
            }
          </div>

        </button>

      </div>

    );
  }

});


// ------------------------------------------------------------
// Upgrade shop
// ------------------------------------------------------------

var ClickButtonUpgrades = React.createClass({

  render: function() {

    var submitUpgradeHandler =
      this.props.submitUpgrade;

    var state =
      this.props.state;

    var upgradeButtons =
      this.props.upgradeFullList.map(
        function(upgrade) {

          var isVisible =
            upgrade.placeholder === true ||
            state.upgrades[upgrade.id] > 0 ||
            state.clicks >= upgrade.minclicks;

          if (!isVisible) {

            return null;

          }

          return (

            <UpgradeButton
              key={upgrade.id}
              submitUpgrade={
                submitUpgradeHandler.bind(
                  null,
                  upgrade.id
                )
              }
              data={upgrade}
              state={state}
            />

          );

        }
      );


    return (

      <div className="shop">

        <h2>
          CLICKER SHOP
        </h2>

        <div className="shopList">
          {upgradeButtons}
        </div>

      </div>

    );
  }

});


// ------------------------------------------------------------
// Main game
// ------------------------------------------------------------

var ClickerWindow = React.createClass({
  getInitialState: function() {
    var upgradeCount = this.props.upgradeFullList.length;
    var meta = loadMeta(upgradeCount);
    var game = loadGame(upgradeCount);
    var settings = loadSiteSettings();
    var state = {};
    Object.keys(meta).forEach(function(key) { state[key] = meta[key]; });
    Object.keys(game).forEach(function(key) { state[key] = game[key]; });
    state.view = 'landing';
    state.settingsOpen = false;
    state.settingsTab = 'general';
    state.siteSettings = settings;
    state.manualClickTimestamps = [];
    state.particles = [];
    state.achievementToast = null;
    state.crashNotice = false;
    state.lastSaveAt = 0;
    state.legalOpen = false;
    state.photosensitivityWarningOpen = false;
    state.legalTab = 'legal';
    state.totalPlayTimeSinceTick = 0;
    state.sessionStartedAt = Date.now();
    return state;
  },

  componentDidMount: function() {
    this.lastRuntimeTick = Date.now();
    this.gameTimer = setInterval(this.updateClicks, this.props.updateInterval);
    this.runtimeTimer = setInterval(this.updateRuntime, 100);
    this.autosaveTimer = setInterval(this.updateAutosaveStatus, 3000);
    window.addEventListener('beforeunload', this.handleBeforeUnload);
    this.checkAndUnlockAchievements();
  },

  componentWillUnmount: function() {
    clearInterval(this.gameTimer);
    clearInterval(this.runtimeTimer);
    clearInterval(this.autosaveTimer);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    if (this.crashTimer) clearTimeout(this.crashTimer);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    this.saveCurrentMeta();
    stopBackgroundMusic();
  },

  handleBeforeUnload: function() {
    this.saveCurrentMeta();
  },

  getMetaForSave: function() {
    return {
      lifetimePlayerClicks: this.state.lifetimePlayerClicks,
      lifetimeLoads: this.state.lifetimeLoads,
      bestCPS: this.state.bestCPS,
      bestManualClicksPer10Seconds: this.state.bestManualClicksPer10Seconds,
      lifetimeTimePlayedSeconds: this.state.lifetimeTimePlayedSeconds,
      lifetimeUpgradePurchases: this.state.lifetimeUpgradePurchases,
      achievements: this.state.achievements,
      achievementPointsAwarded: this.state.achievementPointsAwarded,
      powerUpPoints: this.state.powerUpPoints,
      powerUps: this.state.powerUps,
      powerUpTaskClaims: this.state.powerUpTaskClaims,
      rebirths: this.state.rebirths,
      rebirthStartLifetimeLoads: this.state.rebirthStartLifetimeLoads,
      closeCalls: this.state.closeCalls
    };
  },

  getGameForSave: function() {
    return {
      clicks: this.state.clicks,
      upgrades: this.state.upgrades,
      loadingProgress: this.state.loadingProgress,
      loadGoal: this.state.loadGoal,
      completedLoads: this.state.completedLoads,
      glitchActive: this.state.glitchActive,
      glitchWarning: this.state.glitchWarning,
      glitchClicksRemaining: this.state.glitchClicksRemaining,
      glitchRecoveryClicks: this.state.glitchRecoveryClicks,
      glitchTimeRemainingMs: this.state.glitchTimeRemainingMs,
      nextGlitchLoad: this.state.nextGlitchLoad,
      activePowerUp: this.state.activePowerUp,
      repairCharge: this.state.repairCharge,
      boughtSlowClickerSinceRebirth: this.state.boughtSlowClickerSinceRebirth,
      rebirthPromptSeen: this.state.rebirthPromptSeen
    };
  },

  saveCurrentMeta: function() {
    if (!this.state || !this.state.upgrades) return;
    saveMeta(this.getMetaForSave());
    saveGame(this.getGameForSave());
    this.lastSavedAt = Date.now();
  },

  updateAutosaveStatus: function() {
    this.saveCurrentMeta();
    this.setState({ lastSaveAt: this.lastSavedAt });
  },

  // Shared Settings are used by the landing page and the game.
  openSettings: function() {
    this.setState({ settingsOpen: true });
  },

  closeSettings: function() {
    this.lastRuntimeTick = Date.now();
    this.setState({ settingsOpen: false }, this.saveCurrentMeta);
  },

  setSettingsTab: function(tabName) {
    this.setState({ settingsTab: tabName });
  },

  updateSiteSetting: function(key, value) {
    var settings = {};
    Object.keys(this.state.siteSettings).forEach(function(k) { settings[k] = this.state.siteSettings[k]; }.bind(this));
    settings[key] = value;
    this.setState({ siteSettings: settings }, function() {
      saveSiteSettings(settings);
      if (key === 'musicEnabled' || key === 'musicVolume') {
        stopBackgroundMusic();
        if (settings.musicEnabled && settings.musicVolume > 0) startBackgroundMusic(settings);
      }
    });
  },

  launchGame: function() {
    if (!this.state.siteSettings.photosensitivityAcknowledged) {
      this.setState({ photosensitivityWarningOpen: true });
      return;
    }
    var settings = this.state.siteSettings;
    if (settings.musicEnabled) startBackgroundMusic(settings);
    this.setState({ view: 'game', legalOpen: false }, this.saveCurrentMeta);
  },

  continuePastPhotosensitivityWarning: function() {
    var settings = {};
    Object.keys(this.state.siteSettings).forEach(function(key) { settings[key] = this.state.siteSettings[key]; }.bind(this));
    settings.photosensitivityAcknowledged = true;
    saveSiteSettings(settings);
    if (settings.musicEnabled) startBackgroundMusic(settings);
    this.setState({ siteSettings: settings, photosensitivityWarningOpen: false, view: 'game' }, this.saveCurrentMeta);
  },

  goHome: function() {
    this.saveCurrentMeta();
    this.setState({ view: 'landing', legalOpen: false });
  },

  openLegal: function() {
    this.setState({ legalOpen: true, legalTab: 'legal' });
  },

  closeLegal: function() {
    this.setState({ legalOpen: false });
  },

  setLegalTab: function(tab) {
    this.setState({ legalTab: tab });
  },

  // Glitches are scheduled farther apart late in a run, but recovery becomes
  // harder and the countdown shorter with each rebirth.
  getNextGlitchLoad: function(currentLoads, rebirthCount, careerLoads) {
    var rebirths = typeof rebirthCount === 'number' ? rebirthCount : this.state.rebirths;
    var lifetimeLoads = typeof careerLoads === 'number' ? careerLoads : this.state.lifetimeLoads;
    var lateGameSpacing = Math.min(7, Math.floor(Math.log(lifetimeLoads + 10) / Math.LN10));
    var rebirthSpacing = Math.floor(rebirths / 3);
    var baseDistance = 4 + lateGameSpacing + rebirthSpacing;
    return currentLoads + baseDistance + Math.floor(Math.random() * 4);
  },

  getGlitchConfig: function(usePatch) {
    var lateSeverity = Math.min(10, Math.floor(Math.log(this.state.lifetimeLoads + 1) / Math.LN10));
    var clicks = 25 + Math.floor(this.state.lifetimePlayerClicks / 1000) * 5 + this.state.rebirths * 15 + lateSeverity * 3;
    var timerMs = Math.max(4000, 12000 - this.state.rebirths * 800 - lateSeverity * 400);
    if (usePatch) {
      clicks = Math.max(8, Math.ceil(clicks / 2));
      timerMs += 4000;
    }
    return { clicks: clicks, timerMs: timerMs };
  },

  beginGlitch: function(currentProgress) {
    var usePatch = !!this.state.repairCharge;
    var config = this.getGlitchConfig(usePatch);
    if (usePatch) playTone(this.state.siteSettings, 'patch', 0);
    playTone(this.state.siteSettings, 'warning', 0);
    return {
      glitchActive: true,
      glitchWarning: false,
      glitchClicksRemaining: config.clicks,
      glitchRecoveryClicks: config.clicks,
      glitchTimeRemainingMs: config.timerMs,
      repairCharge: usePatch ? false : this.state.repairCharge
    };
  },

  getClicksPerSecond: function() {
    var upgradeState = this.state.upgrades;
    var baseCPS = this.props.upgradeFullList.map(function(upgrade, i) {
      return upgrade.ratepersecond * (upgradeState[i] || 0);
    }).reduce(function(a, b) { return a + b; }, 0);
    return baseCPS * (1 + this.state.rebirths) * this.getPowerUpMultiplier();
  },

  getPowerUpMultiplier: function() {
    var active = this.state.activePowerUp;
    if (!active || active.remainingMs <= 0) return 1;
    var definition = getPowerUpDefinition(active.id);
    return definition && definition.multiplier ? definition.multiplier : 1;
  },

  updateRuntime: function() {
    var now = Date.now();
    var elapsed = Math.max(0, Math.min(500, now - (this.lastRuntimeTick || now)));
    this.lastRuntimeTick = now;

    // Settings and the landing page pause gameplay clocks, loading, and boosts.
    if (this.state.settingsOpen || this.state.view !== 'game') return;

    var update = {};
    var shouldSaveMeta = false;
    var active = this.state.activePowerUp;

    this.totalPlayTimeSinceTick = (this.totalPlayTimeSinceTick || 0) + elapsed;
    if (this.totalPlayTimeSinceTick >= 1000) {
      var seconds = Math.floor(this.totalPlayTimeSinceTick / 1000);
      this.totalPlayTimeSinceTick -= seconds * 1000;
      update.lifetimeTimePlayedSeconds = this.state.lifetimeTimePlayedSeconds + seconds;
      shouldSaveMeta = true;
    }

    if (this.state.glitchActive) {
      var remaining = Math.max(0, this.state.glitchTimeRemainingMs - elapsed);
      if (remaining <= 0) {
        this.handleSimulatedCrash();
        return;
      }
      update.glitchTimeRemainingMs = remaining;
    }

    if (active && active.remainingMs > 0) {
      var boost = {};
      Object.keys(active).forEach(function(key) { boost[key] = active[key]; });
      boost.remainingMs = Math.max(0, active.remainingMs - elapsed);
      update.activePowerUp = boost.remainingMs > 0 ? boost : null;
    }

    if (Object.keys(update).length) {
      this.setState(update, function() {
        if (shouldSaveMeta) {
          this.checkAndUnlockAchievements();
          this.saveCurrentMeta();
        }
      }.bind(this));
    }
  },

  handleSimulatedCrash: function() {
    playTone(this.state.siteSettings, 'crash', 0);
    this.setState({
      glitchActive: false,
      glitchWarning: false,
      glitchClicksRemaining: 0,
      glitchRecoveryClicks: 0,
      glitchTimeRemainingMs: 0,
      loadingProgress: 0,
      nextGlitchLoad: this.getNextGlitchLoad(this.state.completedLoads),
      crashNotice: true,
      toastMessage: 'SIMULATED CRASH — CURRENT LOAD PROGRESS LOST'
    }, function() {
      this.saveCurrentMeta();
      if (this.crashTimer) clearTimeout(this.crashTimer);
      this.crashTimer = setTimeout(function() {
        this.setState({ crashNotice: false, toastMessage: null });
      }.bind(this), 4200);
    }.bind(this));
  },

  updateClicks: function() {
    if (this.state.settingsOpen || this.state.view !== 'game' || this.state.glitchActive) return;

    var clicks = this.state.clicks;
    var loadingProgress = this.state.loadingProgress;
    var loadGoal = this.state.loadGoal;
    var completedLoads = this.state.completedLoads;
    var upgrades = this.state.upgrades.slice();
    var lifetimeLoads = this.state.lifetimeLoads;
    var cps = this.getClicksPerSecond();
    var bestCPS = Math.max(this.state.bestCPS, cps);
    var newGlitch = false;
    var glitchData = {};
    var rate = this.props.updateInterval / 1000;

    clicks += cps * rate;
    loadingProgress += cps * rate;

    var guard = 0;
    while (loadingProgress >= loadGoal && guard < 20) {
      guard++;
      loadingProgress -= loadGoal;
      completedLoads++;
      lifetimeLoads++;
      loadGoal = Math.floor(loadGoal * 1.25);
      upgrades[0] = (upgrades[0] || 0) + 1;
      playTone(this.state.siteSettings, 'load', 0);
      if (completedLoads >= this.state.nextGlitchLoad) {
        newGlitch = true;
        glitchData = this.beginGlitch();
        break;
      }
    }

    var glitchWarning = !newGlitch && !this.state.glitchActive && completedLoads >= this.state.nextGlitchLoad - 1;
    if (glitchWarning && !this.state.glitchWarning) playTone(this.state.siteSettings, 'warning', 0);
    var nextState = {
      clicks: clicks,
      loadingProgress: loadingProgress,
      loadGoal: loadGoal,
      completedLoads: completedLoads,
      upgrades: upgrades,
      lifetimeLoads: lifetimeLoads,
      bestCPS: bestCPS,
      glitchActive: newGlitch,
      glitchWarning: glitchWarning,
      glitchClicksRemaining: 0,
      glitchRecoveryClicks: 0,
      glitchTimeRemainingMs: 0
    };
    if (newGlitch) {
      Object.keys(glitchData).forEach(function(key) { nextState[key] = glitchData[key]; });
    }
    var nextRebirthRequirement = this.state.rebirthStartLifetimeLoads + (this.state.rebirths + 1) * REBIRTH_LOADS_BASE;
    if (this.state.rebirthPromptSeen && this.state.lifetimeLoads < nextRebirthRequirement && lifetimeLoads >= nextRebirthRequirement) {
      nextState.rebirthPromptSeen = false;
    }
    this.setState(nextState, function() {
      if (completedLoads !== this._lastAchievementLoadCheck || bestCPS > this._lastAchievementBestCPS) {
        this._lastAchievementLoadCheck = completedLoads;
        this._lastAchievementBestCPS = bestCPS;
        this.checkAndUnlockAchievements();
      }
    }.bind(this));
  },

  handleClick: function() {
    if (this.state.settingsOpen || this.state.view !== 'game') return;
    if (this.state.siteSettings.musicEnabled) startBackgroundMusic(this.state.siteSettings);
    playTone(this.state.siteSettings, 'click', (this.state.manualClickTimestamps || []).length);

    var now = Date.now();
    var lifetimePlayerClicks = this.state.lifetimePlayerClicks + 1;
    var clicks10s = (this.state.manualClickTimestamps || []).filter(function(t) { return now - t < 10000; });
    clicks10s.push(now);
    var bestManualClicksPer10Seconds = Math.max(this.state.bestManualClicksPer10Seconds, clicks10s.length);
    var particles = this.state.particles.slice();
    if (this.state.siteSettings.particlesEnabled && !this.state.siteSettings.reducedFlashing) {
      for (var i = 0; i < 7; i++) {
        particles.push({ id: now + '-' + i + '-' + Math.random(), expiresAt: now + 850, direction: Math.floor(Math.random() * 8), left: 43 + Math.random() * 14, top: 26 + Math.random() * 24 });
      }
      if (particles.length > 56) particles = particles.slice(particles.length - 56);
    }

    if (this.state.glitchActive) {
      var clicksRemaining = Math.max(0, this.state.glitchClicksRemaining - 1);
      var recovered = clicksRemaining <= 0;
      var closeCalls = this.state.closeCalls;
      var updateRecovery = {
        lifetimePlayerClicks: lifetimePlayerClicks,
        bestManualClicksPer10Seconds: bestManualClicksPer10Seconds,
        manualClickTimestamps: clicks10s,
        particles: particles,
        glitchClicksRemaining: clicksRemaining
      };
      if (recovered) {
        var closeCall = this.state.glitchTimeRemainingMs > 0 && this.state.glitchTimeRemainingMs < 1000;
        if (closeCall) closeCalls++;
        updateRecovery.glitchActive = false;
        updateRecovery.glitchWarning = false;
        updateRecovery.glitchClicksRemaining = 0;
        updateRecovery.glitchRecoveryClicks = 0;
        updateRecovery.glitchTimeRemainingMs = 0;
        updateRecovery.nextGlitchLoad = this.getNextGlitchLoad(this.state.completedLoads);
        updateRecovery.closeCalls = closeCalls;
        updateRecovery.toastMessage = 'SYSTEM RESTORED — NICE WORK!';
        playTone(this.state.siteSettings, 'recovery', 0);
      }
      this.setState(updateRecovery, function() {
        this.checkAndUnlockAchievements();
        this.saveCurrentMeta();
        if (recovered) {
          if (this.toastTimer) clearTimeout(this.toastTimer);
          this.toastTimer = setTimeout(function() { this.setState({ toastMessage: null }); }.bind(this), 3500);
        }
      }.bind(this));
      return;
    }

    var clicks = this.state.clicks + 1;
    var loadingProgress = this.state.loadingProgress + 1;
    var loadGoal = this.state.loadGoal;
    var completedLoads = this.state.completedLoads;
    var lifetimeLoads = this.state.lifetimeLoads;
    var upgrades = this.state.upgrades.slice();
    var glitchActive = false;
    var glitchWarning = this.state.glitchWarning;
    var glitchData = {};

    if (loadingProgress >= loadGoal) {
      loadingProgress -= loadGoal;
      completedLoads++;
      lifetimeLoads++;
      loadGoal = Math.floor(loadGoal * 1.25);
      upgrades[0] = (upgrades[0] || 0) + 1;
      playTone(this.state.siteSettings, 'load', 0);
      if (completedLoads >= this.state.nextGlitchLoad) {
        glitchActive = true;
        glitchData = this.beginGlitch();
        glitchWarning = false;
      } else {
        glitchWarning = completedLoads >= this.state.nextGlitchLoad - 1;
        if (glitchWarning && !this.state.glitchWarning) playTone(this.state.siteSettings, 'warning', 0);
      }
    }

    var nextState = {
      clicks: clicks,
      loadingProgress: loadingProgress,
      loadGoal: loadGoal,
      completedLoads: completedLoads,
      lifetimePlayerClicks: lifetimePlayerClicks,
      lifetimeLoads: lifetimeLoads,
      upgrades: upgrades,
      bestManualClicksPer10Seconds: bestManualClicksPer10Seconds,
      manualClickTimestamps: clicks10s,
      particles: particles,
      glitchActive: glitchActive,
      glitchWarning: glitchWarning
    };
    if (glitchActive) Object.keys(glitchData).forEach(function(key) { nextState[key] = glitchData[key]; });
    var nextRebirthRequirement = this.state.rebirthStartLifetimeLoads + (this.state.rebirths + 1) * REBIRTH_LOADS_BASE;
    if (this.state.rebirthPromptSeen && this.state.lifetimeLoads < nextRebirthRequirement && lifetimeLoads >= nextRebirthRequirement) {
      nextState.rebirthPromptSeen = false;
    }

    this.setState(nextState, function() {
      this.checkAndUnlockAchievements();
      this.saveCurrentMeta();
    }.bind(this));

    setTimeout(function() {
      if (!this.isMounted || !this.isMounted()) return;
      var nowForParticles = Date.now();
      this.setState({ particles: this.state.particles.filter(function(p) { return p.expiresAt > nowForParticles; }) });
    }.bind(this), 900);
  },

  handleUpgrades: function(buttonId) {
    if (this.state.settingsOpen || this.state.view !== 'game' || this.state.glitchActive) return;
    var upgrade = this.props.upgradeFullList[buttonId];
    var currentCount = this.state.upgrades[buttonId] || 0;
    var cost = Math.floor(upgrade.minclicks * Math.pow(1.15, currentCount));
    if (!upgrade || upgrade.placeholder || this.state.clicks < cost) return;

    var newUpgrades = this.state.upgrades.slice();
    newUpgrades[buttonId] = newUpgrades[buttonId] + 1;
    var lifetimeUpgradePurchases = this.state.lifetimeUpgradePurchases.slice();
    lifetimeUpgradePurchases[buttonId] = (lifetimeUpgradePurchases[buttonId] || 0) + 1;
    var update = { clicks: this.state.clicks - cost, upgrades: newUpgrades, lifetimeUpgradePurchases: lifetimeUpgradePurchases };
    if (buttonId === 0 && this.state.rebirths > 0) update.boughtSlowClickerSinceRebirth = true;
    playTone(this.state.siteSettings, 'purchase', 0);
    this.setState(update, function() { this.checkAndUnlockAchievements(); this.saveCurrentMeta(); }.bind(this));
  },

  getPowerUpTaskStat: function(task) {
    if (task.stat === 'lifetimePlayerClicks') return this.state.lifetimePlayerClicks;
    if (task.stat === 'lifetimeLoads') return this.state.lifetimeLoads;
    if (task.stat === 'bestCPS') return this.state.bestCPS;
    if (task.stat === 'slowClickersPurchased') return this.state.lifetimeUpgradePurchases[0] || 0;
    return 0;
  },

  claimPowerUpTask: function(taskId) {
    var task = powerUpTaskList.find(function(item) { return item.id === taskId; });
    if (!task) return;
    var currentCPS = this.getClicksPerSecond();
    if (task.maxCPS !== undefined && currentCPS >= task.maxCPS) return;
    var statValue = this.getPowerUpTaskStat(task);
    var claimed = Number(this.state.powerUpTaskClaims[task.id]) || 0;
    if (Math.floor(statValue / task.target) <= claimed) return;
    var claims = {};
    Object.keys(this.state.powerUpTaskClaims).forEach(function(id) { claims[id] = this.state.powerUpTaskClaims[id]; }.bind(this));
    claims[task.id] = claimed + 1;
    this.setState({ powerUpPoints: this.state.powerUpPoints + task.points, powerUpTaskClaims: claims }, this.saveCurrentMeta);
  },

  buyPowerUp: function(powerUpId) {
    var definition = getPowerUpDefinition(powerUpId);
    if (!definition || this.state.powerUpPoints < definition.cost) return;
    var powerUps = {};
    Object.keys(this.state.powerUps).forEach(function(id) { powerUps[id] = this.state.powerUps[id] || 0; }.bind(this));
    powerUps[powerUpId] = (powerUps[powerUpId] || 0) + 1;
    playTone(this.state.siteSettings, 'purchase', 0);
    this.setState({ powerUpPoints: this.state.powerUpPoints - definition.cost, powerUps: powerUps }, this.saveCurrentMeta);
  },

  activatePowerUp: function(powerUpId) {
    var definition = getPowerUpDefinition(powerUpId);
    if (!definition) return;
    var owned = this.state.powerUps[powerUpId] || 0;
    if (owned <= 0) return;
    if (definition.special === 'repair') {
      if (this.state.repairCharge) return;
      var patchedPowerUps = {};
      Object.keys(this.state.powerUps).forEach(function(id) { patchedPowerUps[id] = this.state.powerUps[id] || 0; }.bind(this));
      patchedPowerUps[powerUpId] = owned - 1;
      playTone(this.state.siteSettings, 'patch', 0);
      this.setState({ powerUps: patchedPowerUps, repairCharge: true }, this.saveCurrentMeta);
      return;
    }
    if (this.state.activePowerUp && this.state.activePowerUp.remainingMs > 0) return;
    var newPowerUps = {};
    Object.keys(this.state.powerUps).forEach(function(id) { newPowerUps[id] = this.state.powerUps[id] || 0; }.bind(this));
    newPowerUps[powerUpId] = owned - 1;
    this.setState({ powerUps: newPowerUps, activePowerUp: { id: powerUpId, remainingMs: definition.duration } }, this.saveCurrentMeta);
  },

  checkAndUnlockAchievements: function() {
    var currentAchievements = this.state.achievements || {};
    var updatedAchievements = {};
    Object.keys(currentAchievements).forEach(function(id) { updatedAchievements[id] = currentAchievements[id]; });
    var awarded = {};
    Object.keys(this.state.achievementPointsAwarded || {}).forEach(function(id) { awarded[id] = this.state.achievementPointsAwarded[id]; }.bind(this));
    var points = this.state.powerUpPoints;
    var unlockedTitles = [];
    var rareUnlocked = false;
    var changed = false;

    achievementList.forEach(function(achievement) {
      if (!updatedAchievements[achievement.id] && achievement.check(this.state)) {
        updatedAchievements[achievement.id] = true;
        changed = true;
        unlockedTitles.push(achievement.title);
        if (achievement.hidden || achievement.id === 'the_web' || achievement.id === 'click_tera') rareUnlocked = true;
        if (!awarded[achievement.id]) {
          awarded[achievement.id] = true;
          points += 1;
        }
      }
    }.bind(this));

    if (changed) {
      var lastTitle = unlockedTitles[unlockedTitles.length - 1];
      this.setState({ achievements: updatedAchievements, achievementPointsAwarded: awarded, powerUpPoints: points, achievementToast: lastTitle + ' · ACHIEVEMENT UNLOCKED · +1 POINT', achievementToastRare: rareUnlocked }, function() {
        playTone(this.state.siteSettings, rareUnlocked ? 'rebirth' : 'achievement', 0);
        this.saveCurrentMeta();
        if (this.toastTimer) clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(function() { this.setState({ achievementToast: null }); }.bind(this), 4000);
      }.bind(this));
    }
  },

  performRebirth: function() {
    var requirement = this.state.rebirthStartLifetimeLoads + (this.state.rebirths + 1) * REBIRTH_LOADS_BASE;
    if (this.state.lifetimeLoads < requirement) return;
    if (arguments[0] !== true) {
      var approved = window.confirm('REBIRTH WILL RESET YOUR CURRENT CLICKS, CLICKER PURCHASES, LOAD PROGRESS, AND TEMPORARY BOOSTS. Your achievements, points, lifetime records, and rebirth history will remain. Each rebirth adds +100% base CPS, but glitches become harder. Continue?');
      if (!approved) return;
    }
    var rebirths = this.state.rebirths + 1;
    var resetUpgrades = Array.apply(null, Array(this.props.upgradeFullList.length)).map(Number.prototype.valueOf, 0);
    this.setState({
      rebirths: rebirths,
      rebirthStartLifetimeLoads: this.state.lifetimeLoads,
      clicks: 0,
      upgrades: resetUpgrades,
      loadingProgress: 0,
      loadGoal: 100,
      completedLoads: 0,
      glitchActive: false,
      glitchWarning: false,
      glitchClicksRemaining: 0,
      glitchRecoveryClicks: 0,
      glitchTimeRemainingMs: 0,
      nextGlitchLoad: this.getNextGlitchLoad(0, rebirths, this.state.lifetimeLoads),
      activePowerUp: null,
      repairCharge: false,
      boughtSlowClickerSinceRebirth: false,
      rebirthPromptSeen: false,
      toastMessage: 'REBIRTH COMPLETE — PERMANENT CPS ×' + (1 + rebirths)
    }, function() {
      playTone(this.state.siteSettings, 'rebirth', 0);
      this.checkAndUnlockAchievements();
      this.saveCurrentMeta();
      if (this.toastTimer) clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(function() { this.setState({ toastMessage: null }); }.bind(this), 4500);
    }.bind(this));
  },

  dismissRebirthPrompt: function() {
    this.setState({ rebirthPromptSeen: true }, this.saveCurrentMeta);
  },

  gameplayOnlyReset: function() {
    var ok = window.confirm('GAMEPLAY-ONLY RESET: This resets your current clicks, clicker purchases, loading progress, and temporary boosts. It preserves achievements, achievement points, lifetime records, rebirths, and your current post-rebirth Slow Clicker challenge status. Continue?');
    if (!ok) return;
    var resetUpgrades = Array.apply(null, Array(this.props.upgradeFullList.length)).map(Number.prototype.valueOf, 0);
    this.setState({
      clicks: 0, upgrades: resetUpgrades, loadingProgress: 0, loadGoal: 100, completedLoads: 0,
      glitchActive: false, glitchWarning: false, glitchClicksRemaining: 0, glitchRecoveryClicks: 0, glitchTimeRemainingMs: 0,
      nextGlitchLoad: this.getNextGlitchLoad(0), activePowerUp: null, repairCharge: false,
      view: 'landing', settingsOpen: false, rebirthPromptSeen: false, toastMessage: 'GAMEPLAY RESET COMPLETE'
    }, function() { this.saveCurrentMeta(); }.bind(this));
  },

  fullReset: function() {
    var ok = window.confirm('FULL RESET: This permanently erases gameplay progress, achievements, achievement points, lifetime records, purchased power-ups, and rebirths. Your website settings (audio and accessibility) will remain. This cannot be undone. Continue?');
    if (!ok) return;
    try { localStorage.removeItem(META_SAVE_KEY); localStorage.removeItem(GAME_SAVE_KEY); } catch (error) { /* Reset the session even if storage is unavailable. */ }
    window.location.reload();
  },

  renderSettings: function(delta) {
    var settings = this.state.siteSettings;
    var tabs = [
      { id: 'general', title: 'GENERAL' },
      { id: 'audio', title: 'AUDIO' },
      { id: 'data', title: 'DATA' },
      { id: 'achievements', title: 'ACHIEVEMENTS' },
      { id: 'powerups', title: 'POWER-UPS' },
      { id: 'credits', title: 'CREDITS & LEGAL' }
    ];
    return (
      <div className="settingsOverlay" role="dialog" aria-modal="true" aria-label="Master settings">
        <div className="settingsWindow">
          <button className="settingsClose" type="button" onClick={this.closeSettings} aria-label="Close settings">×</button>
          <h2>MASTER SETTINGS</h2>
          <div className="settingsTabs settingsTabsWrap">
            {tabs.map(function(tab) {
              return <button key={tab.id} className={'settingsTabButton ' + (this.state.settingsTab === tab.id ? 'settingsTabActive' : '')} type="button" onClick={this.setSettingsTab.bind(this, tab.id)}>{tab.title}</button>;
            }.bind(this))}
          </div>

          {this.state.settingsTab === 'general' && <div className="settingsPanel">
            <div className="settingsPanelHeader"><span>GENERAL</span><span>SHARED SETTINGS</span></div>
            <div className="settingsPanelNote">These preferences apply to the landing page and game. The single gameplay save is autosaved automatically.</div>
            <div className="settingRow"><div><strong>Reduced flashing</strong><div className="settingHelp">Calms CRT flicker and glitch distortion across the website.</div></div><label className="toggleLabel"><input type="checkbox" checked={settings.reducedFlashing} onChange={function(e) { this.updateSiteSetting('reducedFlashing', e.target.checked); }.bind(this)} /> {settings.reducedFlashing ? 'ON' : 'OFF'}</label></div>
            <div className="settingRow"><div><strong>Green phosphor particles</strong><div className="settingHelp">Show lightweight particles when manually clicking.</div></div><label className="toggleLabel"><input type="checkbox" checked={settings.particlesEnabled} onChange={function(e) { this.updateSiteSetting('particlesEnabled', e.target.checked); }.bind(this)} /> {settings.particlesEnabled ? 'ON' : 'OFF'}</label></div>
            <div className="settingRow"><div><strong>Autosave</strong><div className="settingHelp">Gameplay and permanent progress are saved locally in this browser.</div></div><span className="settingValue">{this.state.lastSaveAt ? 'SAVED ' + new Date(this.state.lastSaveAt).toLocaleTimeString() : 'AUTOMATIC'}</span></div>
            <div className="settingStats">Career loads: {this.state.lifetimeLoads.toLocaleString()} · Rebirths: {this.state.rebirths} · Achievement points: {this.state.powerUpPoints.toLocaleString()}</div>
          </div>}

          {this.state.settingsTab === 'audio' && <div className="settingsPanel">
            <div className="settingsPanelHeader"><span>AUDIO</span><span>PROCEDURAL RETRO SOUND</span></div>
            <div className="settingRow"><div><strong>Sound effects</strong><div className="settingHelp">Clicks, purchases, loads, achievements, glitches, recovery, and rebirth.</div></div><label className="toggleLabel"><input type="checkbox" checked={settings.sfxEnabled} onChange={function(e) { this.updateSiteSetting('sfxEnabled', e.target.checked); }.bind(this)} /> {settings.sfxEnabled ? 'ON' : 'OFF'}</label></div>
            <div className="rangeSetting"><label htmlFor="sfxVolume">SFX volume: {Math.round(settings.sfxVolume * 100)}%</label><input id="sfxVolume" type="range" min="0" max="1" step="0.05" value={settings.sfxVolume} onChange={function(e) { this.updateSiteSetting('sfxVolume', Number(e.target.value)); }.bind(this)} /></div>
            <div className="settingRow"><div><strong>Background music</strong><div className="settingHelp">Optional generated retro loop. Browsers start audio after your first interaction.</div></div><label className="toggleLabel"><input type="checkbox" checked={settings.musicEnabled} onChange={function(e) { this.updateSiteSetting('musicEnabled', e.target.checked); if (e.target.checked) startBackgroundMusic(this.state.siteSettings); }.bind(this)} /> {settings.musicEnabled ? 'ON' : 'OFF'}</label></div>
            <div className="rangeSetting"><label htmlFor="musicVolume">Music volume: {Math.round(settings.musicVolume * 100)}%</label><input id="musicVolume" type="range" min="0" max="1" step="0.05" value={settings.musicVolume} onChange={function(e) { this.updateSiteSetting('musicVolume', Number(e.target.value)); }.bind(this)} /></div>
            <p className="settingsPanelNote">All sounds are synthesized by the game at runtime; no external audio files are currently used.</p>
          </div>}

          {this.state.settingsTab === 'data' && <div className="settingsPanel">
            <div className="settingsPanelHeader"><span>DATA MANAGEMENT</span><span>ONE SAVE</span></div>
            <div className="settingsPanelNote">Both the landing page and game use the same save. These actions require an explicit confirmation.</div>
            <div className="dataAction"><div><strong>Gameplay-only reset</strong><p>Resets current clicks, purchases, load progress, and temporary boosts. Keeps permanent achievements, points, career records, and rebirth history.</p></div><button className="dataActionButton" type="button" onClick={this.gameplayOnlyReset}>RESET GAMEPLAY</button></div>
            <div className="dataAction dataActionDanger"><div><strong>Full reset</strong><p>Erases gameplay progress, achievements, achievement points, career records, purchased boosts, and rebirths. Audio and accessibility preferences stay intact.</p></div><button className="dataActionButton dangerButton" type="button" onClick={this.fullReset}>FULL RESET</button></div>
          </div>}

          {this.state.settingsTab === 'achievements' && <AchievementsPanel state={this.state} />}
          {this.state.settingsTab === 'powerups' && <PowerUpsPanel state={this.state} currentCPS={delta} claimTask={this.claimPowerUpTask} buyPowerUp={this.buyPowerUp} activatePowerUp={this.activatePowerUp} />}
          {this.state.settingsTab === 'credits' && <div className="settingsPanel"><div className="settingsPanelHeader"><span>CREDITS & LEGAL</span></div><div className="settingsPanelNote">Clicker.exe is based on the ClickerJs project. Review the included LICENSE and the linked repository before redistributing source or assets. Each new asset must have a documented license and required attribution.</div><p><strong>Original project:</strong> Elucidation / ClickerJs.</p><p><strong>Audio:</strong> procedural Web Audio tones and a generated music loop; no external audio files used by this update.</p><p><strong>Data:</strong> saves and settings are stored in this browser's local storage. Clearing site data deletes them.</p><p><strong>Disclaimer:</strong> legal text is informational and is not legal advice. Verify the terms and licenses for the version you publish.</p><p><a href={SOURCE_CODE_URL} target="_blank" rel="noopener noreferrer">Open source repository ↗</a></p></div>}
        </div>
      </div>
    );
  },

  renderLegalOverlay: function() {
    if (!this.state.legalOpen) return null;
    return <div className="settingsOverlay legalOverlay" role="dialog" aria-modal="true"><div className="settingsWindow legalWindow"><button className="settingsClose" type="button" onClick={this.closeLegal} aria-label="Close legal page">×</button><h2>LEGAL & CREDITS</h2><div className="settingsTabs"><button className={'settingsTabButton ' + (this.state.legalTab === 'legal' ? 'settingsTabActive' : '')} onClick={this.setLegalTab.bind(this, 'legal')}>LEGAL</button><button className={'settingsTabButton ' + (this.state.legalTab === 'credits' ? 'settingsTabActive' : '')} onClick={this.setLegalTab.bind(this, 'credits')}>CREDITS</button></div>{this.state.legalTab === 'legal' ? <div><h3>Privacy & saved data</h3><p>Clicker.exe stores gameplay progress and preferences locally in your browser. This version does not send save data to a game server. Clearing site data will erase local saves.</p><h3>Use and availability</h3><p>The game is provided as-is. Progress is stored on this device and may be lost if browser data is cleared or the browser prevents local storage. Back up your project files before editing.</p><h3>Photosensitivity and epilepsy warning</h3><p>The game contains CRT flicker, flashing colors, glitch distortion, and simulated system-failure effects. These visuals may trigger seizures in some people with photosensitive epilepsy, including people without a previous diagnosis. Reduced Flashing can lower these effects but cannot guarantee that every trigger is removed. Stop playing if you feel unwell.</p><h3>Third-party assets</h3><p>Redistribution rights depend on the licenses included with the source and any assets you add. Verify all requirements before releasing or selling the game.</p><p>This information is a starting point, not legal advice.</p></div> : <div><h3>Project attribution</h3><p>Based on the ClickerJs project by Elucidation. See the included LICENSE and source repository for details.</p><p>The current version generates sound effects and background music in the browser; it does not ship external audio recordings.</p><p><a href={SOURCE_CODE_URL} target="_blank" rel="noopener noreferrer">Source code repository ↗</a></p></div>}<div className="legalFooter"><button className="landingSecondaryButton" type="button" onClick={this.closeLegal}>BACK</button></div></div></div>;
  },

  renderLanding: function() {
    var reduced = this.state.siteSettings.reducedFlashing ? ' reducedFlashing' : '';
    return (
      <div className={'landingShell' + reduced}>
        <div className="landingTopBar"><div className="landingBrandMark">▣</div><div><div className="landingBrand">CLICKER.EXE</div><div className="landingSubBrand">PERSONAL COMPUTER SIMULATION</div></div><div className="landingTopActions"><button type="button" className="landingSettingsButton" onClick={this.openSettings}>⚙ MASTER SETTINGS</button></div></div>
        <main className="landingMain">
          <div className="landingEyebrow">SYSTEM STARTUP / BUILD 1.6.0</div>
          <div className="landingScreen">
            <div className="landingScreenHeader"><span>CLICKER.EXE BIOS</span><span>MEMORY CHECK: OK</span></div>
            <h1>CLICKER.EXE</h1>
            <p className="landingTagline">A perfectly normal computer. Probably.</p>
            <div className="bootLog"><div>[ OK ] CRT DISPLAY INITIALIZED</div><div>[ OK ] PHOSPHOR DRIVER LOADED</div><div>[ OK ] CLICKING SUBSYSTEM ONLINE</div><div>[ OK ] SAVE DATA {this.state.lifetimeLoads > 0 || this.state.lifetimePlayerClicks > 0 ? 'RESTORED' : 'READY'}</div><div className="bootLastLine">SYSTEM READY. WAITING FOR USER INPUT_</div></div>
            <div className="landingProgressLabel"><span>BOOT SEQUENCE</span><span>100%</span></div><div className="landingProgress"><div className="landingProgressFill" /></div>
            <button type="button" className="launchGameButton" onClick={this.launchGame}>▶ &nbsp; LAUNCH GAME</button>
            <p className="landingNote">Your save and settings stay in this browser.</p>
          </div>
          <div className="landingFeatureRow"><div><strong>ONE SAVE</strong><span>Your progress follows you into the game.</span></div><div><strong>UNSTABLE SYSTEM</strong><span>Click through lag. Survive escalating glitches.</span></div><div><strong>MAKE IT YOURS</strong><span>Shared audio and accessibility settings.</span></div></div>
        </main>
        <footer className="landingFooter"><span>© CLICKER.EXE · RETRO SYSTEMS DIVISION</span><div><button type="button" onClick={this.openLegal}>LEGAL & CREDITS</button><a href={SOURCE_CODE_URL} target="_blank" rel="noopener noreferrer">SOURCE CODE ↗</a><button type="button" onClick={this.openSettings}>MASTER SETTINGS</button></div></footer>
        <div className="landingBuildInfo">CAREER LOADS: {this.state.lifetimeLoads.toLocaleString()} · REBIRTHS: {this.state.rebirths} · ACHIEVEMENTS: {Object.keys(this.state.achievements).filter(function(k) { return this.state.achievements[k]; }.bind(this)).length}</div>
      </div>
    );
  },

  renderGame: function() {
    var delta = this.getClicksPerSecond();
    var systemStatus = this.state.glitchActive
      ? 'STATUS: OVERLOAD! RECOVERY CLICKS: ' + this.state.glitchClicksRemaining + ' · CRASH IN ' + (this.state.glitchTimeRemainingMs / 1000).toFixed(1) + 's'
      : (this.state.glitchWarning ? 'WARNING: SYSTEM INSTABILITY DETECTED — GLITCH IMMINENT' : (this.state.crashNotice ? 'STATUS: SIMULATED CRASH — SYSTEM RECOVERED' : 'STATUS: STRUGGLING...'));
    var effectiveStage = 0;
    if (this.state.glitchActive) {
      var progress = this.state.glitchRecoveryClicks > 0 ? 1 - this.state.glitchClicksRemaining / this.state.glitchRecoveryClicks : 1;
      var rawStage = Math.min(3, 2 + Math.floor(this.state.rebirths / 2) + Math.floor(this.state.lifetimeLoads / 100));
      effectiveStage = progress >= 0.67 ? Math.max(1, rawStage - 2) : (progress >= 0.33 ? Math.max(1, rawStage - 1) : rawStage);
    }
    var rootClass = 'clickerWindow' + (this.state.siteSettings.reducedFlashing ? ' reducedFlashing' : '') + (this.state.glitchWarning ? ' glitchWarning' : '') + (this.state.glitchActive ? ' glitchStage' + effectiveStage : '');
    var rebirthRequirement = this.state.rebirthStartLifetimeLoads + (this.state.rebirths + 1) * REBIRTH_LOADS_BASE;
    var canRebirth = this.state.lifetimeLoads >= rebirthRequirement;
    var particles = this.state.particles.map(function(p) {
      return <span key={p.id} className={'greenParticle particleDirection' + p.direction} style={{ left: p.left + '%', top: p.top + '%' }} />;
    });
    return (
      <div className={rootClass}>
        <button className="settingsButton" type="button" onClick={this.openSettings} aria-label="Open master settings">⚙</button>
        <button className="homeButton" type="button" onClick={this.goHome}>⌂ HOME</button>
        <h1>CLICKER.EXE</h1>
        <div className={this.state.glitchActive ? 'systemStatus glitchStatus' : 'systemStatus'}>{systemStatus}</div>
        {this.state.glitchActive && <div className="glitchCountdown"><span>CRASH TIMER</span><strong>{(this.state.glitchTimeRemainingMs / 1000).toFixed(1)}s</strong><span>RECOVERY {Math.max(0, Math.round((1 - this.state.glitchClicksRemaining / Math.max(1, this.state.glitchRecoveryClicks)) * 100))}%</span></div>}
        <ClickCounter clicks={this.state.clicks} clickDelta={delta} />
        <LoadingBar progress={this.state.loadingProgress} goal={this.state.loadGoal} />
        <div className="loadCount">LOADS COMPLETED: {this.state.completedLoads}<span className="lifetimeLoadNote">CAREER: {this.state.lifetimeLoads.toLocaleString()}</span></div>
        <div className="rebirthBar"><span>REBIRTHS: {this.state.rebirths} · PERMANENT CPS ×{1 + this.state.rebirths}</span>{canRebirth && <button className="rebirthButton" type="button" onClick={this.performRebirth}>REBIRTH AVAILABLE</button>}</div>
        {this.state.repairCharge && <div className="patchArmedNotice">EMERGENCY PATCH ARMED — NEXT GLITCH WILL BE EASIER</div>}
        <div className="clickArea"><div className="particleLayer" aria-hidden="true">{particles}</div><ClickButton submitClick={this.handleClick} /><p className="clickHint">CLICK TO FIGHT THE LAG</p></div>
        <ClickButtonUpgrades upgradeFullList={this.props.upgradeFullList} state={this.state} submitUpgrade={this.handleUpgrades} />
        <div className="gameFooter"><button type="button" onClick={this.openLegal}>LEGAL & CREDITS</button><span>GAMEPLAY AUTOSAVES LOCALLY</span></div>
        {canRebirth && !this.state.rebirthPromptSeen && !this.state.settingsOpen && <div className="rebirthOverlay"><div className="rebirthDialog"><div className="rebirthKicker">UNEXPECTED SYSTEM FEATURE</div><h2>REBIRTH AVAILABLE</h2><p>{REBIRTH_POPUP_TEXT}</p><p className="rebirthRequirement">Career loads: {this.state.lifetimeLoads} / next requirement: {rebirthRequirement}</p><div className="rebirthDialogActions"><button className="rebirthConfirmButton" onClick={this.performRebirth.bind(null, true)}>REBIRTH</button><button className="rebirthLaterButton" onClick={this.dismissRebirthPrompt}>NOT NOW</button></div></div></div>}
        {(this.state.achievementToast || this.state.toastMessage) && <div className={'achievementToast' + (this.state.achievementToast && this.state.achievementToastRare ? ' rareAchievementToast' : '')} role="status">{this.state.achievementToast || this.state.toastMessage}</div>}
      </div>
    );
  },

  renderPhotosensitivityWarning: function() {
    if (!this.state.photosensitivityWarningOpen) return null;
    return <div className="settingsOverlay" role="dialog" aria-modal="true"><div className="settingsWindow warningWindow"><h2>PHOTOSENSITIVITY / EPILEPSY WARNING</h2><p>Clicker.exe contains CRT flicker, flashing colors, glitch distortion, and simulated system-failure effects. These visuals may trigger seizures in some people with photosensitive epilepsy, including people without a previous diagnosis.</p><p>Use Master Settings to enable Reduced Flashing before playing. This reduces animation and flicker but cannot guarantee that every possible trigger is removed. Stop playing if you feel unwell.</p><div className="rebirthDialogActions"><button className="rebirthConfirmButton" type="button" onClick={this.continuePastPhotosensitivityWarning}>CONTINUE TO GAME</button><button className="rebirthLaterButton" type="button" onClick={function() { this.setState({ photosensitivityWarningOpen: false, settingsOpen: true, settingsTab: 'general' }); }.bind(this)}>ACCESSIBILITY SETTINGS</button><button className="rebirthLaterButton" type="button" onClick={function() { this.setState({ photosensitivityWarningOpen: false }); }.bind(this)}>BACK</button></div></div></div>;
  },

  render: function() {
    var delta = this.getClicksPerSecond();
    var root = this.state.view === 'game' ? this.renderGame() : this.renderLanding();
    return <div className="clickerAppRoot">{root}{this.state.settingsOpen && this.renderSettings(delta)}{this.renderLegalOverlay()}{this.renderPhotosensitivityWarning()}</div>;
  }
});

ReactDOM.render(
  <ClickerWindow upgradeFullList={buttonUpgradeFullList} updateInterval={autoclickUpdateRate} />,
  document.getElementById('content')
);

