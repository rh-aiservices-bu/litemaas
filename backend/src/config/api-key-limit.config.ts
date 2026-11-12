export function getMaxKeysPerUser(): number {
  return Number(process.env.API_KEY_LIMIT_MAX_KEYS_PER_USER) || 10;
}
