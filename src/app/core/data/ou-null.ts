/** Une source qui rejette est traitée comme indisponible : `null`. */
export async function ouNull<T>(source: Promise<T>): Promise<T | null> {
  try {
    return await source;
  } catch {
    return null;
  }
}
