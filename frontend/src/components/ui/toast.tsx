import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastVariant = 'default' | 'success' | 'destructive' | 'warning' | 'info'

export interface Toast {
  id: string
  title: string
  description?: string
  variant: ToastVariant
  duration?: number
}

interface ToastContextType {
  toasts: Toast[]
  toast: (props: Omit<Toast, 'id'>) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function useToastContext() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToastContext must be used within ToastProvider')
  }
  return context
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((props: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9)
    const newToast: Toast = { ...props, id }
    setToasts((prev) => [...prev, newToast])
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[]
  onDismiss: (id: string) => void
}) {
  return (
    <div className="fixed top-16 right-4 z-[100] flex flex-col gap-2 w-full max-w-[400px] pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast
  onDismiss: (id: string) => void
}) {
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true)
      setTimeout(() => onDismiss(toast.id), 300)
    }, toast.duration ?? 5000)
    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, onDismiss])

  const icons = {
    default: <Info className="h-4 w-4" />,
    success: <CheckCircle2 className="h-4 w-4" />,
    destructive: <AlertCircle className="h-4 w-4" />,
    warning: <AlertTriangle className="h-4 w-4" />,
    info: <Info className="h-4 w-4" />,
  }

  const colors = {
    default: 'bg-background border-border text-foreground',
    success: 'bg-green-950/90 border-green-500/30 text-green-100',
    destructive: 'bg-red-950/90 border-red-500/30 text-red-100',
    warning: 'bg-amber-950/90 border-amber-500/30 text-amber-100',
    info: 'bg-blue-950/90 border-blue-500/30 text-blue-100',
  }

  const iconColors = {
    default: 'text-primary',
    success: 'text-green-400',
    destructive: 'text-red-400',
    warning: 'text-amber-400',
    info: 'text-blue-400',
  }

  return (
    <div
      className={cn(
        'relative flex items-start gap-3 p-4 rounded-lg border shadow-lg backdrop-blur-sm',
        'animate-in slide-in-from-right duration-300',
        isExiting && 'animate-out slide-out-to-right duration-300',
        colors[toast.variant],
        'pointer-events-auto'
      )}
    >
      <div className={cn('shrink-0 mt-0.5', iconColors[toast.variant])}>
        {icons[toast.variant]}
      </div>
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className="font-semibold text-sm tracking-tight">{toast.title}</p>
        )}
        {toast.description && (
          <p className="text-sm text-foreground/80 mt-1 leading-relaxed">
            {toast.description}
          </p>
        )}
      </div>
      <button
        onClick={() => {
          setIsExiting(true)
          setTimeout(() => onDismiss(toast.id), 300)
        }}
        className="shrink-0 p-1 rounded-md hover:bg-white/10 transition-colors text-foreground/60 hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}