import { useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  count?: number;
  disabled?: boolean;
}

interface TabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  compact?: boolean;
  ariaLabel?: string;
}

export function Tabs({ items, activeId, onChange, compact = false, ariaLabel = 'Seções' }: TabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  function activateByIndex(index: number) {
    const item = items[index];
    if (!item || item.disabled) return;
    onChange(item.id);
    containerRef.current
      ?.querySelector<HTMLButtonElement>(`[data-tab-id="${CSS.escape(item.id)}"]`)
      ?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();

    const enabledIndexes = items
      .map((item, index) => (!item.disabled ? index : -1))
      .filter((index) => index >= 0);
    if (enabledIndexes.length === 0) return;

    if (event.key === 'Home') {
      activateByIndex(enabledIndexes[0]);
      return;
    }
    if (event.key === 'End') {
      activateByIndex(enabledIndexes[enabledIndexes.length - 1]);
      return;
    }

    const position = enabledIndexes.indexOf(currentIndex);
    const offset = event.key === 'ArrowRight' ? 1 : -1;
    const nextPosition = (position + offset + enabledIndexes.length) % enabledIndexes.length;
    activateByIndex(enabledIndexes[nextPosition]);
  }

  return (
    <div
      ref={containerRef}
      className={`ui-tabs ${compact ? 'ui-tabs--compact' : ''}`.trim()}
      role="tablist"
      aria-label={ariaLabel}
    >
      {items.map((item, index) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            disabled={item.disabled}
            data-tab-id={item.id}
            className={`ui-tab ${active ? 'ui-tab--active' : ''}`.trim()}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {item.icon && <span className="ui-tab__icon" aria-hidden="true">{item.icon}</span>}
            <span className="ui-tab__label">{item.label}</span>
            {typeof item.count === 'number' && <span className="ui-tab__count">{item.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
