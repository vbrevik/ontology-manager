import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ClassProperties } from './ClassProperties'
import type { Property } from '@/features/ontology/lib/api'

function makeProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: 'prop-1',
    name: 'color',
    class_id: 'cls-1',
    data_type: 'string',
    is_required: false,
    is_unique: false,
    version_id: 'v1',
    validation_rules: null,
    ...overrides,
  }
}

describe('ClassProperties', () => {
  it('renders property list with name, type, constraints', () => {
    const props = [
      makeProperty({ id: 'p1', name: 'color', data_type: 'string', is_required: true }),
      makeProperty({ id: 'p2', name: 'weight', data_type: 'float', is_unique: true }),
    ]
    render(<ClassProperties properties={props} />)

    expect(screen.getByText('color')).toBeInTheDocument()
    expect(screen.getByText('string')).toBeInTheDocument()
    expect(screen.getByText('Required')).toBeInTheDocument()
    expect(screen.getByText('weight')).toBeInTheDocument()
    expect(screen.getByText('float')).toBeInTheDocument()
    expect(screen.getByText('Unique')).toBeInTheDocument()
  })

  it('renders "Add Property" button', () => {
    render(<ClassProperties properties={[]} />)
    expect(screen.getByText('Add Property')).toBeInTheDocument()
  })

  it('clicking Add opens inline form', () => {
    render(<ClassProperties properties={[]} />)
    fireEvent.click(screen.getByText('Add Property'))
    expect(screen.getByTestId('add-property-form')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Property name')).toBeInTheDocument()
  })

  it('submitting add form calls onAddProperty', () => {
    const onAdd = vi.fn()
    render(<ClassProperties properties={[]} onAddProperty={onAdd} />)

    fireEvent.click(screen.getByText('Add Property'))
    fireEvent.change(screen.getByPlaceholderText('Property name'), {
      target: { value: 'speed' },
    })
    fireEvent.click(screen.getByText('Add'))

    expect(onAdd).toHaveBeenCalledWith({
      name: 'speed',
      data_type: 'string',
      is_required: false,
      is_unique: false,
    })
  })

  it('clicking edit on property calls onEditProperty', () => {
    const onEdit = vi.fn()
    const props = [makeProperty({ id: 'p1', name: 'color' })]
    render(<ClassProperties properties={props} onEditProperty={onEdit} />)

    fireEvent.click(screen.getByLabelText('Edit color'))
    expect(onEdit).toHaveBeenCalledWith('p1')
  })

  it('clicking delete shows confirmation dialog', () => {
    const props = [makeProperty({ id: 'p1', name: 'color' })]
    render(<ClassProperties properties={props} />)

    fireEvent.click(screen.getByLabelText('Delete color'))
    expect(screen.getByText('Delete property')).toBeInTheDocument()
    expect(screen.getByText(/Are you sure/)).toBeInTheDocument()
  })

  it('confirming delete calls onDeleteProperty', () => {
    const onDelete = vi.fn()
    const props = [makeProperty({ id: 'p1', name: 'color' })]
    render(<ClassProperties properties={props} onDeleteProperty={onDelete} />)

    fireEvent.click(screen.getByLabelText('Delete color'))
    fireEvent.click(screen.getByText('Delete'))
    expect(onDelete).toHaveBeenCalledWith('p1')
  })
})
