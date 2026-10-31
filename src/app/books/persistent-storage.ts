/**
 * Asks the browser not to evict the library when the phone runs low on space.
 * By default site data is "best effort" and may be cleared; Chrome grants persistence without a prompt to installed
 * apps and frequently used sites. Unsupported or denied: nothing changes, data is just less protected.
 */
export async function requestPersistentStorage(): Promise<void> {
  if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
    await navigator.storage.persist();
  }
}
