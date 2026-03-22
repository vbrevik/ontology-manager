import { useState } from 'react'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import type { Property } from '@/features/ontology/lib/api'

interface ClassPropertiesProps {
  properties: Property[]
  versionId?: string
  onAddProperty?: (input: {
    name: string
    data_type: string
    is_required: boolean
    is_unique: boolean
    description?: string
  }) => void
  onEditProperty?: (id: string) => void
  onDeleteProperty?: (id: string) => void
}

const DATA_TYPES = ['string', 'integer', 'float', 'boolean', 'reference', 'json']

export function ClassProperties({
  properties,
  versionId: _versionId,
  onAddProperty,
  onEditProperty,
  onDeleteProperty,
}: ClassPropertiesProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('string')
  const [newRequired, setNewRequired] = useState(false)
  const [newUnique, setNewUnique] = useState(false)

  const handleSubmitAdd = () => {
    if (!newName.trim()) return
    onAddProperty?.({
      name: newName.trim(),
      data_type: newType,
      is_required: newRequired,
      is_unique: newUnique,
    })
    setNewName('')
    setNewType('string')
    setNewRequired(false)
    setNewUnique(false)
    setShowAddForm(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Properties</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          <Plus className="mr-1 h-3 w-3" />
          Add Property
        </Button>
      </div>

      {properties.length === 0 && !showAddForm && (
        <p className="text-sm text-muted-foreground">No properties defined</p>
      )}

      <div className="space-y-1">
        {properties.map((prop) => (
          <div
            key={prop.id}
            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted"
          >
            <span className="min-w-0 truncate font-medium">{prop.name}</span>
            <Badge variant="secondary" className="shrink-0 text-xs">
              {prop.data_type}
            </Badge>
            {prop.is_required && (
              <Badge variant="outline" className="shrink-0 text-xs">
                Required
              </Badge>
            )}
            {prop.is_unique && (
              <Badge variant="outline" className="shrink-0 text-xs">
                Unique
              </Badge>
            )}
            <div className="ml-auto flex shrink-0 gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onEditProperty?.(prop.id)}
                aria-label={`Edit ${prop.name}`}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    aria-label={`Delete ${prop.name}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete property</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete &quot;{prop.name}&quot;? This
                      action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onDeleteProperty?.(prop.id)}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
      </div>

      {showAddForm && (
        <div className="space-y-2 rounded-md border p-3" data-testid="add-property-form">
          <Input
            placeholder="Property name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            aria-label="Data type"
          >
            {DATA_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={newRequired}
                onChange={(e) => setNewRequired(e.target.checked)}
              />
              Required
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={newUnique}
                onChange={(e) => setNewUnique(e.target.checked)}
              />
              Unique
            </label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSubmitAdd}>
              Add
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddForm(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
