// Ember Vault — shared tuning constants.
// One place for every number the rest of the game reads: tile size, speeds,
// sight ranges and the detection rates. Nothing here is loaded from the
// network; the whole game is plain canvas + WebAudio drawn from these values.

export const TILE = 32;
export const COLS = 30;
export const ROWS = 20;
export const VIEW_W = COLS * TILE; // 960
export const VIEW_H = ROWS * TILE; // 640

// Movement, in tiles per second.
export const PLAYER_WALK_SPEED = 3.4;
export const PLAYER_SNEAK_SPEED = 1.8;
export const GUARD_PATROL_SPEED = 1.5;
export const GUARD_CHASE_SPEED = 2.9;
export const GUARD_SEARCH_SPEED = 1.9;

// Sight: how far a guard sees, and how wide the cone opens (half-angle).
export const GUARD_SIGHT_RANGE = 5.2;
export const GUARD_CONE_HALF_ANGLE = 0.61; // ~35 degrees
export const GUARD_CLOSE_RANGE = 1.4; // inside this, darkness hides nobody

// Detection meter, 0..100. Rates are per second while the player is seen.
export const DETECT_BASE_RATE = 55;
export const DETECT_LIT_MULTIPLIER = 1.6; // standing in lamplight
export const DETECT_SNEAK_MULTIPLIER = 0.55;
export const DETECT_CLOSE_MULTIPLIER = 2.2; // very near a guard
export const DETECT_DECAY_RATE = 26; // per second while unseen
export const ALARM_AT = 100;

// Hearing: noise radii in tiles. Walking is quiet, a thrown pebble is loud.
export const NOISE_WALK_RADIUS = 1.1;
export const NOISE_SNEAK_RADIUS = 0.45;
export const NOISE_PEBBLE_RADIUS = 4.2;

// Guard behaviour timers, in seconds.
export const SUSPICIOUS_HOLD = 1.6; // stare at a glimpse before acting
export const SEARCH_TIME = 4.0; // hunt the last seen spot, then give up
export const CHASE_GIVE_UP = 5.0; // lose the trail this long, drop the chase

// Scoring.
export const CRYSTAL_POINTS = 250;
export const GHOST_BONUS = 500; // finish a level never spotted
export const TIME_BONUS_PER_SECOND = 10; // of the level's par time left
export const PEBBLE_START_COUNT = 3;
export const PEBBLE_MAX_COUNT = 5;

// Game screens.
export const SCREEN_TITLE = 'title';
export const SCREEN_BRIEFING = 'briefing';
export const SCREEN_PLAY = 'play';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_WIN = 'win';

// Colours.
export const COLORS = {
  floorA: '#1c1a24',
  floorB: '#211e2b',
  floorTrim: '#2b2738',
  wall: '#453f58',
  wallTop: '#5d5478',
  crate: '#6b4f2a',
  crateTop: '#8a6a38',
  shelf: '#4a2f4d',
  shelfTop: '#6b4470',
  shadow: '#0d0b14',
  lampGlow: '#ffb347',
  exit: '#39d98a',
  crystal: '#ff7a3c',
  player: '#e8e4f5',
  playerCloak: '#3b2d5c',
  guard: '#e5484d',
  guardBody: '#7a2e35',
  coneCalm: 'rgba(255, 196, 66, 0.20)',
  coneAlert: 'rgba(229, 72, 77, 0.30)',
  coneEdge: 'rgba(255, 196, 66, 0.55)',
  hud: '#e8e4f5',
  hudDim: '#9a94b0',
};
