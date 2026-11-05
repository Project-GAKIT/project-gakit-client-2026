import { ReactNode } from 'react';

interface FeaturePageShellProps {
  eyebrow?: string;
  title?: string;
  description?: string;
  actions?: ReactNode;
  toolbar?: ReactNode;
  summary?: ReactNode;
  children: ReactNode;
  /** Renders the header without the surrounding card (border/bg/padding). */
  bare?: boolean;
}

export function FeaturePageShell({
  eyebrow,
  title,
  description,
  actions,
  toolbar,
  summary,
  children,
  bare = false,
}: FeaturePageShellProps) {
  const hasHeader = eyebrow || title || description || actions || toolbar;

  const header = (
    <>
      {eyebrow && (
        <div className="text-xs font-semibold uppercase tracking-wide text-secondary">
          {eyebrow}
        </div>
      )}
      {(title || description || actions) && (
        <div
          className={`flex flex-col gap-4 lg:flex-row lg:items-end ${
            title || description ? 'lg:justify-between' : 'lg:justify-end'
          }`}
        >
          {(title || description) && (
            <div>
              {title && <h2 className="text-2xl font-bold text-primary">{title}</h2>}
              {description && <p className="text-sm text-secondary mt-1">{description}</p>}
            </div>
          )}
          {actions && (
            <div className="flex shrink-0 items-center gap-2">
              {actions}
            </div>
          )}
        </div>
      )}

      {toolbar && (
        <div
          className={
            bare
              ? 'mt-5'
              : title || description || actions
                ? 'mt-5 border-t border-default pt-5'
                : ''
          }
        >
          {toolbar}
        </div>
      )}
    </>
  );

  return (
    <div className="space-y-4">
      {hasHeader &&
        (bare ? (
          header
        ) : (
          <section className="rounded-2xl border border-default bg-panel p-5 shadow-sm">
            {header}
          </section>
        ))}

      {summary}

      {children}
    </div>
  );
}