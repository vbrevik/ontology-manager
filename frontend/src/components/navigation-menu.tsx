import * as NavigationMenuPrimitive from '@radix-ui/react-navigation-menu'
// PopoverPrimitive imported for future popover-based components; keep to mirror shadcn patterns
import React from 'react'

export const NavigationMenu = ({ children, className = '' }: { children?: React.ReactNode; className?: string }) => {
  return <NavigationMenuPrimitive.Root className={className}>{children}</NavigationMenuPrimitive.Root>
}

export const NavigationMenuList = ({ children, className = '' }: { children?: React.ReactNode; className?: string }) => {
  return <NavigationMenuPrimitive.List className={`flex items-center gap-2 ${className}`}>{children}</NavigationMenuPrimitive.List>
}

export const NavigationMenuItem = ({ children, className = '' }: { children?: React.ReactNode; className?: string }) => {
  return <NavigationMenuPrimitive.Item className={className}>{children}</NavigationMenuPrimitive.Item>
}

export const NavigationMenuTrigger = ({ children, className = '', onClick }: { children?: React.ReactNode; className?: string; onClick?: () => void }) => {
  return (
    <NavigationMenuPrimitive.Trigger asChild>
      <button onClick={onClick} className={className}>
        {children}
      </button>
    </NavigationMenuPrimitive.Trigger>
  )
}

export const NavigationMenuContent = ({ children, className = '' }: { children?: React.ReactNode; className?: string }) => {
  return <NavigationMenuPrimitive.Content className={className}>{children}</NavigationMenuPrimitive.Content>
}

export const NavigationMenuLink = ({ children, asChild, className = '' }: { children: React.ReactNode; asChild?: boolean; className?: string }) => {
  if (asChild) {
    const child = React.Children.only(children) as any
    const existing = (child.props && (child.props as any).className) || ''
    return React.cloneElement(child as any, { className: `${existing} ${className}`.trim() } as any)
  }
  return (
    <NavigationMenuPrimitive.Link className={className}>
      {children}
    </NavigationMenuPrimitive.Link>
  )
}

export function navigationMenuTriggerStyle() {
  return 'px-3 py-2 rounded-md hover:bg-muted'
}


