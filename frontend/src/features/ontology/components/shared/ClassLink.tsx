interface ClassLinkProps {
  classId: string
  className?: string
  children: React.ReactNode
}

export function ClassLink({ classId, children }: ClassLinkProps) {
  return (
    <button
      className="text-sm text-primary underline-offset-4 hover:underline"
      data-testid="class-link"
      data-class-id={classId}
    >
      {children}
    </button>
  )
}
