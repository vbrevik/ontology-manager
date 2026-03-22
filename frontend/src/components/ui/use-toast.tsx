import { useToastContext, type ToastVariant } from './toast'

export interface ToastProps {
    title?: string
    description?: string
    variant?: ToastVariant
    duration?: number
}

export function useToast() {
    const { toast } = useToastContext()

    const toastFn = ({ title, description, variant = 'default', duration }: ToastProps) => {
        toast({
            title: title ?? '',
            description,
            variant,
            duration,
        })
    }

    return { toast: toastFn }
}
