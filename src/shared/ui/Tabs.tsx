import type { ReactNode } from 'react';

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
  return (
    <div className={`ui-tabs ${compact ? 'ui-tabs--compact' : ''}`.trim()} role="tablist" aria-label={ariaLabel}>
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={item.disabled}
            className={`ui-tab ${active ? 'ui-tab--active' : ''}`.trim()}
            onClick={() => onChange(item.id)}
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
