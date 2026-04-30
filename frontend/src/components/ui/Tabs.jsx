import { createContext, useContext } from 'react';
import clsx from 'clsx';

/**
 * Tabs simples controladas por value/onValueChange.
 * Uso:
 *   <Tabs value={tab} onValueChange={setTab}>
 *     <TabsList>
 *       <TabsTrigger value="a">Aba A</TabsTrigger>
 *       <TabsTrigger value="b">Aba B</TabsTrigger>
 *     </TabsList>
 *     <TabsContent value="a">Conteudo A</TabsContent>
 *     <TabsContent value="b">Conteudo B</TabsContent>
 *   </Tabs>
 */
const TabsContext = createContext({ value: null, onValueChange: () => {} });

export default function Tabs({ value, onValueChange, children, className }) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className, variant = 'underline' }) {
  const variants = {
    underline: 'border-b border-[var(--border-main)]',
    pills: 'inline-flex gap-1 p-1 bg-[var(--bg-subtle)] rounded-xl',
  };
  return (
    <div className={clsx(variants[variant], className)}>
      <div className={clsx(variant === 'underline' ? 'flex gap-1' : 'flex gap-1')}>
        {children}
      </div>
    </div>
  );
}

export function TabsTrigger({ value, children, icon: Icon, variant = 'underline' }) {
  const { value: active, onValueChange } = useContext(TabsContext);
  const isActive = active === value;

  if (variant === 'pills') {
    return (
      <button
        type="button"
        onClick={() => onValueChange(value)}
        className={clsx(
          'inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all',
          isActive
            ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-[var(--shadow-xs)]'
            : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
        )}
      >
        {Icon && <Icon size={14} strokeWidth={2} />}
        {children}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onValueChange(value)}
      className={clsx(
        'relative inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold tracking-tight transition-all',
        isActive
          ? 'text-[var(--text-main)]'
          : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
      )}
    >
      {Icon && <Icon size={14} strokeWidth={2} />}
      {children}
      {isActive && (
        <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-[var(--accent)] rounded-full" />
      )}
    </button>
  );
}

export function TabsContent({ value, children, className }) {
  const { value: active } = useContext(TabsContext);
  if (active !== value) return null;
  return <div className={clsx('animate-in fade-in duration-200', className)}>{children}</div>;
}
