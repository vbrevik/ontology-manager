import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { createClass, fetchCurrentVersion, fetchClasses } from '@/features/ontology/lib/api'
import { useOntologyBrowser } from '../OntologyBrowserContext'

interface CreateClassDialogProps {
  trigger?: React.ReactNode
}

export function CreateClassDialog({ trigger }: CreateClassDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [parentClassId, setParentClassId] = useState('')
  const [isAbstract, setIsAbstract] = useState(false)
  const [validationError, setValidationError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const queryClient = useQueryClient()
  const { setSelectedClassId } = useOntologyBrowser()

  const classesQuery = useQuery({
    queryKey: ['classes', 'list'],
    queryFn: fetchClasses,
    enabled: open,
  })

  const mutation = useMutation({
    mutationFn: async () => {
      const version = await fetchCurrentVersion()
      return createClass({
        name: name.trim(),
        description: description.trim() || undefined,
        parent_class_id: parentClassId || undefined,
        is_abstract: isAbstract,
        version_id: version.id,
      })
    },
    onSuccess: (newClass) => {
      queryClient.invalidateQueries({ queryKey: ['classes', 'list'] })
      setSelectedClassId(newClass.id)
      resetForm()
      setOpen(false)
    },
    onError: (err: Error) => {
      setSubmitError(err.message)
    },
  })

  const resetForm = () => {
    setName('')
    setDescription('')
    setParentClassId('')
    setIsAbstract(false)
    setValidationError('')
    setSubmitError('')
  }

  const handleSubmit = () => {
    setValidationError('')
    setSubmitError('')
    if (!name.trim()) {
      setValidationError('Class name is required')
      return
    }
    mutation.mutate()
  }

  const handleOpen = () => {
    resetForm()
    setOpen(true)
  }

  const handleOpenChange = (value: boolean) => {
    setOpen(value)
    if (!value) resetForm()
  }

  return (
    <>
      {trigger ? (
        <span onClick={handleOpen}>{trigger}</span>
      ) : (
        <Button variant="outline" size="sm" aria-label="New class" onClick={handleOpen}>
          <Plus className="mr-1 h-3 w-3" />
          New Class
        </Button>
      )}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Class</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Input
                placeholder="Class name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={255}
              />
              {validationError && (
                <p className="mt-1 text-sm text-destructive">{validationError}</p>
              )}
            </div>
            <Textarea
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
            />
            <div>
              <select
                value={parentClassId}
                onChange={(e) => setParentClassId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                aria-label="Parent class"
              >
                <option value="">No parent (root class)</option>
                {classesQuery.data?.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isAbstract}
                onChange={(e) => setIsAbstract(e.target.checked)}
              />
              Abstract class
            </label>
            {submitError && (
              <p className="text-sm text-destructive">{submitError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={mutation.isPending} aria-label="Create">
              {mutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
