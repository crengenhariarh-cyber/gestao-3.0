import type { ReactNode } from 'react';
import './PageHeader.css';

interface PageHeaderProps {
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: ReactNode;
  id?: string;
}

export function PageHeader({ title, eyebrow, description, actions, id }: PageHeaderProps) {
  return <header className="ui-page-header">
    <div className="ui-page-header__main">
      {eyebrow && <span className="ui-page-header__eyebrow">{eyebrow}</span>}
      <h1 id={id} className="ui-page-header__title">{title}</h1>
      {description && <p className="ui-page-header__description">{description}</p>}
    </div>
    {actions && <div className="ui-page-header__actions">{actions}</div>}
  </header>;
}
