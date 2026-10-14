// Emoji avatars shown next to pseudos. Closed list: the server only accepts these.
export const AVATARS = ["🦊", "🐙", "🤖", "🦉", "🐼", "🦄", "🐸", "🐧", "🦁", "🐝", "🐢", "🦖", "🐳", "🦜", "🐨", "👾"];

export const isAvatar = (value) => AVATARS.includes(value);

export function randomAvatar(rand = Math.random) {
  return AVATARS[Math.floor(rand() * AVATARS.length)];
}

export function nextAvatar(current) {
  return AVATARS[(AVATARS.indexOf(current) + 1) % AVATARS.length];
}
