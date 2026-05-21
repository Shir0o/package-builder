// URL + room-id helpers for the collab feature. Deliberately separate from
// collab.ts so that App.tsx can read/write the room hash and generate share
// URLs without pulling Yjs + y-webrtc into the main bundle.

const ROOM_KEY = "room";

export function getRoomFromHash(): string | null {
  if (typeof location === "undefined") return null;
  const hash = location.hash.replace(/^#/, "");
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const room = params.get(ROOM_KEY);
  return room && room.length > 0 ? room : null;
}

export function makeShareUrl(roomId: string): string {
  const base = location.origin + location.pathname + location.search;
  return `${base}#${ROOM_KEY}=${encodeURIComponent(roomId)}`;
}

// Small embedded word lists — chosen to be short, friendly, and easy to say
// aloud. ~50 entries each gives 50 * 50 * 10000 = 25M combinations, plenty
// for a room ID that doesn't need to be cryptographically unguessable
// (the URL itself is the access token).
const ADJECTIVES = [
  "amber", "brisk", "calm", "clever", "cosy", "crisp", "dapper", "eager",
  "fancy", "fluffy", "frosty", "gentle", "giddy", "happy", "jolly", "kind",
  "lively", "lucky", "merry", "mighty", "misty", "neat", "nimble", "noble",
  "plucky", "polite", "proud", "purple", "quiet", "rapid", "regal", "rosy",
  "rustic", "sandy", "sleepy", "snappy", "snowy", "spicy", "stout", "sunny",
  "swift", "tidy", "tiny", "vivid", "warm", "wise", "witty", "young",
  "zesty", "zippy",
];

const NOUNS = [
  "badger", "bear", "beaver", "bison", "cobra", "comet", "coral", "cougar",
  "crane", "dolphin", "eagle", "ember", "falcon", "ferret", "finch", "fox",
  "gecko", "goose", "harbor", "hawk", "heron", "ibex", "iris", "jaguar",
  "kestrel", "koala", "lemur", "lynx", "maple", "marlin", "meadow", "moose",
  "newt", "ocelot", "orca", "otter", "owl", "panda", "pebble", "puffin",
  "quail", "raven", "robin", "sable", "salmon", "sparrow", "stoat", "tiger",
  "wolf", "wren",
];

function pickIndex(modulo: number): number {
  // Rejection sampling to avoid bias when modulo doesn't divide 256.
  const bytes = new Uint8Array(1);
  const limit = Math.floor(256 / modulo) * modulo;
  for (;;) {
    crypto.getRandomValues(bytes);
    if (bytes[0] < limit) return bytes[0] % modulo;
  }
}

function pickNumber(): string {
  const bytes = new Uint16Array(1);
  const limit = Math.floor(65536 / 10000) * 10000;
  for (;;) {
    crypto.getRandomValues(bytes);
    if (bytes[0] < limit) return (bytes[0] % 10000).toString().padStart(4, "0");
  }
}

export function makeRoomId(): string {
  const a = ADJECTIVES[pickIndex(ADJECTIVES.length)];
  const n = NOUNS[pickIndex(NOUNS.length)];
  return `${a}-${n}-${pickNumber()}`;
}
