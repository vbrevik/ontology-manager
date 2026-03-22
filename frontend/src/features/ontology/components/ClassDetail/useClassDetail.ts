import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
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
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['classes', 'list'] })
      queryClient.invalidateQueries({
        queryKey: ['classes', 'detail', classId],
      })
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
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ['classes', classId, 'properties'],
      })
    },
  })

  const updatePropertyMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePropertyInput }) =>
      apiUpdateProperty(id, input),
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ['classes', classId, 'properties'],
      })
    },
  })

  const deletePropertyMutation = useMutation({
    mutationFn: (id: string) => apiDeleteProperty(id),
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ['classes', classId, 'properties'],
      })
    },
  })

  const isLoading =
    classQuery.isLoading || propertiesQuery.isLoading || versionQuery.isLoading
  const isPlaceholderData =
    classQuery.isPlaceholderData || propertiesQuery.isPlaceholderData
  // TanStack Query types error as Error | null but the generic is unknown —
  // cast is safe because our queryFn throws Error instances
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
