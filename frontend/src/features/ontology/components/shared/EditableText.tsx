import { useState, useRef, useEffect, useCallback } from 'react'
import { Pencil, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface EditableTextProps {
  value: string
  onSave: (newValue: string) => void | Promise<void>
  multiline?: boolean
  loading?: boolean
  placeholder?: string
  maxLength?: number
  className?: string
}

export function EditableText({
  value,
  onSave,
  multiline = false,
  loading = false,
  placeholder = 'Click to edit...',
  maxLength,
  className,
}: EditableTextProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const [isHovered, setIsHovered] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const activeRef = multiline ? textareaRef : inputRef

  useEffect(() => {
    if (isEditing && activeRef.current) {
      activeRef.current.focus()
    }
  }, [isEditing, activeRef])

  const handleStartEdit = () => {
    if (loading || isSaving) return
    setEditValue(value)
    setIsEditing(true)
  }

  const handleSave = useCallback(async () => {
    setIsEditing(false)
    if (editValue !== value) {
      try {
        setIsSaving(true)
        await onSave(editValue)
      } finally {
        setIsSaving(false)
      }
    }
  }, [editValue, value, onSave])

  const handleCancel = () => {
    setIsEditing(false)
    setEditValue(value)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel()
    }
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault()
      handleSave()
    }
  }

  const isLoadingState = loading || isSaving

  if (isLoadingState && !isEditing) {
    return (
      <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
        <span>{value || placeholder}</span>
        <Loader2 className="h-3 w-3 animate-spin" data-testid="editable-text-spinner" />
      </div>
    )
  }

  if (isEditing) {
    if (multiline) {
      return (
        <Textarea
          ref={textareaRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          maxLength={maxLength}
          className={cn('text-sm', className)}
        />
      )
    }
    return (
      <Input
        ref={inputRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        maxLength={maxLength}
        className={cn('text-sm', className)}
      />
    )
  }

  return (
    <div
      className={cn(
        'group flex cursor-pointer items-center gap-1 rounded px-1 -mx-1 text-sm hover:bg-muted/50',
        className,
      )}
      onClick={handleStartEdit}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span className={cn(!value && 'text-muted-foreground')}>
        {value || placeholder}
      </span>
      {isHovered && (
        <Pencil className="h-3 w-3 text-muted-foreground" data-testid="editable-text-icon" />
      )}
    </div>
  )
}
