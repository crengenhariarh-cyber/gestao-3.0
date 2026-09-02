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

function elements(group: string, tenantId: string): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(selector(group, tenantId)));
}

function orderedIds(group: string, tenantId: string): string[] {
  return elements(group, tenantId)
    .map((element) => element.dataset.sortId)
    .filter((value): value is string => Boolean(value));
}

function moveRelative(ids: readonly string[], sourceId: string, targetId: string, after: boolean): string[] {
  if (sourceId === targetId) return [...ids];
  const next = ids.filter((id) => id !== sourceId);
  const targetIndex = next.indexOf(targetId);
  if (targetIndex < 0) return [...ids];
  next.splice(targetIndex + (after ? 1 : 0), 0, sourceId);
  return next;
}

function isHorizontal(target: HTMLElement): boolean {
  const parent = target.parentElement;
  if (!parent) return false;
  const style = getComputedStyle(parent);
  if (style.display.includes('flex')) return style.flexDirection.startsWith('row');
  if (parent.scrollWidth > parent.clientWidth + 8) return true;
  const siblings = Array.from(parent.querySelectorAll<HTMLElement>(':scope > [data-sort-id]'));
  if (siblings.length > 1) {
    const a = siblings[0]?.getBoundingClientRect();
    const b = siblings[1]?.getBoundingClientRect();
    if (a && b) return Math.abs(b.left - a.left) > Math.abs(b.top - a.top);
  }
  return false;
}

function autoScroll(clientX: number, clientY: number, target: HTMLElement | null) {
  const edge = 76;
  const step = 24;
  if (clientY < edge) window.scrollBy({ top: -step, behavior: 'auto' });
  else if (clientY > window.innerHeight - edge) window.scrollBy({ top: step, behavior: 'auto' });

  const container = target?.parentElement;
  if (!container || container.scrollWidth <= container.clientWidth + 8) return;
  const rect = container.getBoundingClientRect();
  if (clientX < rect.left + edge) container.scrollBy({ left: -step, behavior: 'auto' });
  else if (clientX > rect.right - edge) container.scrollBy({ left: step, behavior: 'auto' });
}

export function SortableHandle({ itemId, tenantId, group, label = 'Segure e arraste para reorganizar', onReorder }: SortableHandleProps) {
  const pointerId = useRef<number | null>(null);
  const targetId = useRef<string | null>(null);
  const insertAfter = useRef(false);
  const startPoint = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);

  function clearTarget() {
    document.querySelectorAll<HTMLElement>(`${selector(group, tenantId)}.is-sort-target`).forEach((element) => element.classList.remove('is-sort-target'));
    document.querySelectorAll<HTMLElement>(`${selector(group, tenantId)}.is-sorting`).forEach((element) => element.classList.remove('is-sorting'));
    targetId.current = null;
    insertAfter.current = false;
    pointerId.current = null;
    startPoint.current = null;
    document.body.classList.remove('ui-sort-active');
  }

  function targetAt(clientX: number, clientY: number): { id: string | null; after: boolean; element: HTMLElement | null } {
    const target = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>(selector(group, tenantId)) ?? null;
    const nextTargetId = target?.dataset.sortId ?? null;
    document.querySelectorAll<HTMLElement>(`${selector(group, tenantId)}.is-sort-target`).forEach((element) => element.classList.remove('is-sort-target'));
    let after = false;
    if (target && nextTargetId !== itemId) {
      const rect = target.getBoundingClientRect();
      after = isHorizontal(target) ? clientX >= rect.left + rect.width / 2 : clientY >= rect.top + rect.height / 2;
      target.classList.add('is-sort-target');
      target.classList.toggle('is-sort-target--after', after);
    }
    targetId.current = nextTargetId;
    insertAfter.current = after;
    return { id: nextTargetId, after, element: target };
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
    const current = targetAt(event.clientX, event.clientY);
    autoScroll(event.clientX, event.clientY, current.element);
  }

  function finishPointer(event: PointerEvent<HTMLSpanElement>) {
    if (pointerId.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const ids = orderedIds(group, tenantId);
    const current = targetAt(event.clientX, event.clientY);
    const target = current.id ?? targetId.current;
    const after = current.id ? current.after : insertAfter.current;
    const wasDragged = dragged.current;
    clearTarget();
    if (!wasDragged || !target || target === itemId) return;
    void onReorder(moveRelative(ids, itemId, target, after));
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
