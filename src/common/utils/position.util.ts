export function moveIdToPosition(ids: string[], id: string, position: number): string[] {
  if (!Number.isInteger(position) || position < 1 || position > ids.length) {
    throw new Error(`目标位置必须在 1-${ids.length} 之间`);
  }
  const currentIndex = ids.indexOf(id);
  if (currentIndex < 0) throw new Error("排序对象不存在");

  const ordered = [...ids];
  ordered.splice(currentIndex, 1);
  ordered.splice(position - 1, 0, id);
  return ordered;
}
