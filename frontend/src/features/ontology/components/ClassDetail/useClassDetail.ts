import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useToast } from '@/components/ui/use-toast'
import {
  getClass,
  fetchProperties,
  fetchCurrentVersion,
  updateClass,
  createProperty as apiCreateProperty,
  updateProperty as apiUpdateProperty,
  deleteProperty as apiDeleteProperty,
} from '@/features/ontology/lib/api'
import type {
  Class,
  Property,
  OntologyVersion,
  CreatePropertyInput,
  UpdatePropertyInput,
} from '@/features/ontology/lib/api'

export interface UseClassDetailReturn {
  classData: Class | undefined
  properties: Property[] | undefined
  currentVersion: OntologyVersion | undefined
  isLoading: boolean
  isPlaceholderData: boolean
  isDescriptionSaving: boolean
  error: Error | null
  updateDescription: (description: string) => Promise<void>
  createProperty: (
    input: Omit<CreatePropertyInput, 'class_id' | 'version_id'>,
  ) => Promise<void>
  updateProperty: (id: string, input: UpdatePropertyInput) => Promise<void>
  deleteProperty: (id: string) => Promise<void>
}

export function useClassDetail(classId: string | null): UseClassDetailReturn {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const classQuery = useQuery({
    queryKey: ['classes', 'detail', classId],
    queryFn: () => getClass(classId!),
    enabled: !!classId,
    placeholderData: keepPreviousData,
  })

  const propertiesQuery = useQuery({
    queryKey: ['classes', classId, 'properties'],
    queryFn: () => fetchProperties(classId!),
    enabled: !!classId,
    placeholderData: keepPreviousData,
  })

  const versionQuery = useQuery({
    queryKey: ['ontology-versions', 'current'],
    queryFn: fetchCurrentVersion,
    enabled: !!classId,
    staleTime: Infinity,
  })

  const descriptionMutation = useMutation({
    mutationFn: (description: string) =>
      updateClass(classId!, { description }),
    onMutate: async (description) => {
      await queryClient.cancelQueries({ queryKey: ['classes', 'detail', classId] })
      const previous = queryClient.getQueryData<Class>(['classes', 'detail', classId])
      queryClient.setQueryData<Class>(['classes', 'detail', classId], (old) =>
        old ? { ...old, description } : old,
      )
      return { previous }
    },
    onError: (err: Error, _desc, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['classes', 'detail', classId], context.previous)
      }
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['classes', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['classes', 'detail', classId] })
    },
  })

  const createPropertyMutation = useMutation({
    mutationFn: (input: Omit<CreatePropertyInput, 'class_id' | 'version_id'>) => {
      if (!versionQuery.data?.id) {
        return Promise.reject(new Error('Current version not loaded yet'))
      }
      return apiCreateProperty({
        ...input,
        class_id: classId!,
        version_id: versionQuery.data.id,
      })
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['classes', classId, 'properties'] })
      const previous = queryClient.getQueryData<Property[]>(['classes', classId, 'properties'])
      const tempProperty: Property = {
        id: `temp-${Date.now()}`,
        name: input.name,
        description: input.description,
        class_id: classId!,
        data_type: input.data_type,
        is_required: input.is_required ?? false,
        is_unique: input.is_unique ?? false,
        version_id: versionQuery.data?.id ?? '',
        validation_rules: input.validation_rules ?? null,
      }
      queryClient.setQueryData<Property[]>(['classes', classId, 'properties'], (old) =>
        old ? [...old, tempProperty] : [tempProperty],
      )
      return { previous }
    },
    onError: (err: Error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['classes', classId, 'properties'], context.previous)
      }
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['classes', classId, 'properties'] })
    },
  })

  const updatePropertyMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePropertyInput }) =>
      apiUpdateProperty(id, input),
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: ['classes', classId, 'properties'] })
      const previous = queryClient.getQueryData<Property[]>(['classes', classId, 'properties'])
      queryClient.setQueryData<Property[]>(['classes', classId, 'properties'], (old) =>
        old?.map((p) => (p.id === id ? { ...p, ...input } : p)),
      )
      return { previous }
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['classes', classId, 'properties'], context.previous)
      }
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['classes', classId, 'properties'] })
    },
  })

  const deletePropertyMutation = useMutation({
    mutationFn: (id: string) => apiDeleteProperty(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['classes', classId, 'properties'] })
      const previous = queryClient.getQueryData<Property[]>(['classes', classId, 'properties'])
      queryClient.setQueryData<Property[]>(['classes', classId, 'properties'], (old) =>
        old?.filter((p) => p.id !== id),
      )
      return { previous }
    },
    onError: (err: Error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['classes', classId, 'properties'], context.previous)
      }
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['classes', classId, 'properties'] })
    },
  })

  const isLoading =
    classQuery.isLoading || propertiesQuery.isLoading || versionQuery.isLoading
  const isPlaceholderData =
    classQuery.isPlaceholderData || propertiesQuery.isPlaceholderData
  const error =
    (classQuery.error as Error | null) ??
    (propertiesQuery.error as Error | null) ??
    (versionQuery.error as Error | null)

  return {
    classData: classQuery.data,
    properties: propertiesQuery.data,
    currentVersion: versionQuery.data,
    isLoading,
    isPlaceholderData,
    isDescriptionSaving: descriptionMutation.isPending,
    error,
    updateDescription: async (description: string) => {
      await descriptionMutation.mutateAsync(description)
    },
    createProperty: async (
      input: Omit<CreatePropertyInput, 'class_id' | 'version_id'>,
    ) => {
      await createPropertyMutation.mutateAsync(input)
    },
    updateProperty: async (id: string, input: UpdatePropertyInput) => {
      await updatePropertyMutation.mutateAsync({ id, input })
    },
    deleteProperty: async (id: string) => {
      await deletePropertyMutation.mutateAsync(id)
    },
  }
}
