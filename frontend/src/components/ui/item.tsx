import React from 'react'

export function Item({ children, asChild, className = '', variant }: { children: React.ReactNode; asChild?: boolean; className?: string; variant?: 'default'|'outline' }) {
  const base = 'group flex items-center gap-3 p-2 rounded-md'
  const variantClass = variant === 'outline' ? 'border border-muted' : ''
  if (asChild) {
    // Expect the child to be an anchor or Link; merge className
    const child = React.Children.only(children) as any
    const existing = (child.props && (child.props as any).className) || ''
    return React.cloneElement(child, { className: `${existing} ${base} ${variantClass} ${className}`.trim() } as any)
  }
  return <div className={`${base} ${variantClass} ${className}`.trim()}>{children}</div>
}

export function ItemContent({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <div className={`flex-1 ${className}`.trim()}>{children}</div>
}

export function ItemTitle({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <div className={`font-medium ${className}`.trim()}>{children}</div>
}

export function ItemDescription({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <div className={`text-sm text-muted-foreground ${className}`.trim()}>{children}</div>
}

export function ItemMedia({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <div className={`flex-none ${className}`.trim()}>{children}</div>
}


