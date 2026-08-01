'use client'

import type { InputHTMLAttributes, SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface BaseProps {
  label: string
  error?: string
  required?: boolean
}

type InputProps = BaseProps & InputHTMLAttributes<HTMLInputElement> & { as?: 'input' }
type SelectProps = BaseProps & SelectHTMLAttributes<HTMLSelectElement> & {
  as: 'select'
  children: React.ReactNode
}
type TextareaProps = BaseProps & React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  as: 'textarea'
}

type Props = InputProps | SelectProps | TextareaProps

const fieldStyle = {
  border: '1px solid var(--color-border)',
  backgroundColor: 'var(--color-surface)',
  color: 'var(--color-ink)',
}

export default function FormField(props: Props) {
  const { label, error, required } = props

  const baseClass = cn(
    'w-full h-9 px-3 rounded-lg text-sm outline-none',
    'transition-[border-color,box-shadow] duration-150',
  )

  function handleFocus(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    e.currentTarget.style.borderColor = 'var(--color-primary)'
    e.currentTarget.style.boxShadow = '0 0 0 3px oklch(28% 0.07 255 / 10%)'
  }
  function handleBlur(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    e.currentTarget.style.borderColor = 'var(--color-border)'
    e.currentTarget.style.boxShadow = 'none'
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium" style={{ color: 'var(--color-ink-muted)' }}>
        {label}
        {required && <span className="ml-0.5" style={{ color: 'var(--color-accent)' }}>*</span>}
      </label>
      {props.as === 'select' ? (
        <select
          className={cn(baseClass, 'cursor-pointer')}
          style={fieldStyle}
          value={props.value}
          onChange={props.onChange}
          disabled={props.disabled}
          onFocus={handleFocus as never}
          onBlur={handleBlur as never}
        >
          {props.children}
        </select>
      ) : props.as === 'textarea' ? (
        <textarea
          rows={3}
          className={cn(baseClass, 'h-auto py-2 resize-none')}
          style={fieldStyle}
          value={props.value}
          onChange={props.onChange}
          placeholder={props.placeholder}
          disabled={props.disabled}
          onFocus={handleFocus as never}
          onBlur={handleBlur as never}
        />
      ) : (
        <input
          className={baseClass}
          style={fieldStyle}
          type={props.type}
          value={props.value}
          onChange={props.onChange}
          placeholder={props.placeholder}
          disabled={props.disabled}
          min={props.min}
          max={props.max}
          step={props.step}
          onFocus={handleFocus as never}
          onBlur={handleBlur as never}
        />
      )}
      {error && <p className="text-xs" style={{ color: 'var(--color-accent)' }}>{error}</p>}
    </div>
  )
}
