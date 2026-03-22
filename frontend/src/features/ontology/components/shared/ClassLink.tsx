export interface ClassLinkProps {
  classId: string
  label: string
  onNavigate?: (classId: string) => void
}

export function ClassLink({ classId, label, onNavigate }: ClassLinkProps) {
  return (
    <button
      className="bg-transparent border-none p-0 font-inherit text-sm text-primary underline-offset-4 hover:underline cursor-pointer"
      data-testid="class-link"
      data-class-id={classId}
      onClick={onNavigate ? () => onNavigate(classId) : undefined}
    >
      {label}
    </button>
  )
}
