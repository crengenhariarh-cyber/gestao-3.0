import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import './sortable.css';

interface SortableHandleProps {
  itemId: string;
  tenantId: string;
  group: string;
  label?: string;
  onReorder: (orderedIds: readonly string[]) => void | Promise<void>;
}

function selector(group: string, tenantId: string): string {
  return `[data-sort-group="${CSS.escape(group)}"][data-sort-tenant="${CSS.escape(tenantId)}"][data-sort-id]`;
}

function orderedIds(group: string, tenantId: string): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>(selector(group, tenantId)))
    .map((element) => element.dataset.sortId)
    .filter((value): value is string => Boolean(value));
}

function moveBefore(ids: readonly string[], sourceId: string, targetId: string): string[] {
  if (sourceId === targetId) return [...ids];
  const next = ids.filter((id) => id !== sourceId);
  const targetIndex = next.indexOf(targetId);
  if (targetIndex < 0) return [...ids];
  next.splice(targetIndex, 0, sourceId);
  return next;
}

export function SortableHandle({ itemId, tenantId, group, label = 'Segure e arraste para reorganizar', onReorder }: SortableHandleProps) {
  const pointerId = useRef<number | null>(null);
  const targetId = useRef<string | null>(null);
  const startPoint = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);

  function clearTarget() {
    document.querySelectorAll<HTMLElement>(`${selector(group, tenantId)}.is-sort-target`).forEach((element) => element.classList.remove('is-sort-target'));
    document.querySelectorAll<HTMLElement>(`${selector(group, tenantId)}.is-sorting`).forEach((element) => element.classList.remove('is-sorting'));
    targetId.current = null;
    pointerId.current = null;
    startPoint.current = null;
    document.body.classList.remove('ui-sort-active');
  }

  function targetAt(clientX: number, clientY: number): string | null {
    const target = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>(selector(group, tenantId)) ?? null;
    const nextTargetId = target?.dataset.sortId ?? null;
    document.querySelectorAll<HTMLElement>(`${selector(group, tenantId)}.is-sort-target`).forEach((element) => element.classList.remove('is-sort-target'));
    if (target && nextTargetId !== itemId) target.classList.add('is-sort-target');
    targetId.current = nextTargetId;
    return nextTargetId;
  }

  function handlePointerDown(event: PointerEvent<HTMLSpanElement>) {
    if (!event.isPrimary) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    dragged.current = false;
    pointerId.current = event.pointerId;
    startPoint.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    document.querySelector<HTMLElement>(`${selector(group, tenantId)}[data-sort-id="${CSS.escape(itemId)}"]`)?.classList.add('is-sorting');
    document.body.classList.add('ui-sort-active');
  }

  function handlePointerMove(event: PointerEvent<HTMLSpanElement>) {
    if (pointerId.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const start = startPoint.current;
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) >= 6) dragged.current = true;
    targetAt(event.clientX, event.clientY);
  }

  function finishPointer(event: PointerEvent<HTMLSpanElement>) {
    if (pointerId.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const ids = orderedIds(group, tenantId);
    const target = targetAt(event.clientX, event.clientY) ?? targetId.current;
    const wasDragged = dragged.current;
    clearTarget();
    if (!wasDragged || !target || target === itemId) return;
    void onReorder(moveBefore(ids, itemId, target));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLSpanElement>) {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown' && event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    event.stopPropagation();
    const ids = orderedIds(group, tenantId);
    const index = ids.indexOf(itemId);
    if (index < 0) return;
    const offset = event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1;
    const targetIndex = index + offset;
    if (targetIndex < 0 || targetIndex >= ids.length) return;
    const next = [...ids];
    [next[index], next[targetIndex]] = [next[targetIndex]!, next[index]!];
    void onReorder(next);
  }

  return <span
    className="ui-sort-handle"
    role="button"
    tabIndex={0}
    aria-label={label}
    title={label}
    onClick={(event) => { event.preventDefault(); event.stopPropagation(); }}
    onPointerDown={handlePointerDown}
    onPointerMove={handlePointerMove}
    onPointerUp={finishPointer}
    onPointerCancel={(event) => { if (pointerId.current === event.pointerId) clearTarget(); }}
    onKeyDown={handleKeyDown}
  ><span aria-hidden="true">⋮⋮</span></span>;
}
