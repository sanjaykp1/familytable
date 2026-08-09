import type { ReactNode } from 'react';

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  persistent = false,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
  persistent?: boolean;
}) {
  return (
    <header className={`page-header ${persistent ? 'page-header--persistent' : ''}`}>
      <div>
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}
