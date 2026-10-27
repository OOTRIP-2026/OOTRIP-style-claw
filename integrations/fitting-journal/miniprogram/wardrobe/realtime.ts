// Handoff-only portable type boundary. Keep the target project's original Item import when integrating.
type Item = { id: string; name: string; category: string; image: string; source: string; purchased?: boolean };

export function realtimeWardrobe(items: readonly Item[]) {
  return items
    .filter(
      (item) =>
        !item.id.startsWith('sample-') &&
        item.source !== '衣物已移除' &&
        realtimeCategory(item.category) !== '' &&
        Boolean(item.image),
    )
    .map((item) => ({
      id: item.id,
      name: item.name,
      category: realtimeCategory(item.category),
      image: item.image,
      purchased: item.purchased !== false,
    }));
}

export function realtimePhaseLabel(phase: string): string {
  const labels: Record<string, string> = {
    starting: '正在准备实时试穿…',
    connecting: '正在连接试穿服务…',
    connected: '连接成功，正在准备画面…',
    'remote-track': '正在接收试穿画面…',
    generating: '实时试穿中，试着轻轻转身',
    'first-frame-limit': '本次试穿已结束',
    'total-limit': '本次体验时间已到',
    'input-timeout': '摄像头画面传输中断，请检查网络',
    'worker-ended': '试穿服务已结束',
    'worker-exited': '试穿服务已断开',
    'worker-error': '试穿服务暂时不可用',
    'input-error': '画面发送失败',
    'worker-output-invalid': '试穿画面读取失败',
    stopped: '本次试穿已结束',
  };
  return labels[phase] ?? '正在准备试穿画面…';
}

export const REALTIME_CATEGORIES = ['套装', '上衣', '裤子', '外套', '内搭', '鞋子', '配饰'];
export type RealtimeGarment = ReturnType<typeof realtimeWardrobe>[number];
export function realtimeCategory(category: string): string {
  const aliases: Record<string, string> = {
    连衣裙: '套装',
    下装: '裤子',
    鞋: '鞋子',
    饰品: '配饰',
    包: '配饰',
  };
  const normalized = aliases[category] ?? category;
  return REALTIME_CATEGORIES.includes(normalized) ? normalized : '';
}
export function selectRealtimeGarment(
  selected: readonly RealtimeGarment[],
  next: RealtimeGarment,
): RealtimeGarment[] {
  if (!REALTIME_CATEGORIES.includes(next.category)) return [...selected];
  const separates = ['上衣', '裤子', '内搭'];
  return [
    ...selected.filter(
      (item) =>
        item.id !== next.id &&
        item.category !== next.category &&
        !(next.category === '套装' && separates.includes(item.category)) &&
        !(separates.includes(next.category) && item.category === '套装'),
    ),
    next,
  ];
}
