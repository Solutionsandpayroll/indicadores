'use client'

interface ModalActionsProps {
  onClose: () => void
  onSave: () => void
  isPending: boolean
  disabled?: boolean
  label?: string
  colSpan?: boolean
}

export default function ModalActions({
  onClose, onSave, isPending, disabled, label = 'Guardar', colSpan,
}: ModalActionsProps) {
  return (
    <div className={`flex justify-end gap-2 pt-2 ${colSpan ? 'col-span-2' : ''}`}>
      <button
        onClick={onClose}
        className="h-9 px-4 rounded-lg text-sm transition-colors duration-150 cursor-pointer"
        style={{ color: 'var(--color-ink-muted)' }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-border)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        Cancelar
      </button>
      <button
        onClick={onSave}
        disabled={isPending || disabled}
        className="h-9 px-4 rounded-lg text-white text-sm font-medium transition-[transform,background-color] duration-150 ease-out active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer"
        style={{ backgroundColor: 'var(--color-primary)' }}
        onMouseEnter={(e) => !isPending && !disabled && (e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-primary)')}
      >
        {isPending ? 'Guardando…' : label}
      </button>
    </div>
  )
}
