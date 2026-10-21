'use client'

import type { ReactNode } from 'react'
import { secretError } from '@/core/secret-names'
import { Field } from '@/ui/form/Field'
import { PasswordInput } from '@/ui/form/PasswordInput'
import type { SecretKeyStatus, SecretName } from './use-secrets'

export interface SecretChange {
  value?: string
  remove?: boolean
}

interface SecretFieldProps {
  name: SecretName
  label: string
  hint?: string
  status: SecretKeyStatus
  value: string
  remove: boolean
  onChange: (change: SecretChange) => void
}

export interface SecretFieldDef {
  name: SecretName
  label: string
  hint?: string
}

export const OPENROUTER_FIELDS = [
  { name: 'OPENROUTER_API_KEY', label: 'API key' },
  { name: 'OPENROUTER_MANAGEMENT_KEY', label: 'Management key', hint: 'optional, shows balance' },
] satisfies SecretFieldDef[]

export const R2_FIELDS = [
  { name: 'R2_ACCOUNT_ID', label: 'Account ID' },
  { name: 'R2_ACCESS_KEY_ID', label: 'Access key ID' },
  { name: 'R2_SECRET_ACCESS_KEY', label: 'Secret access key' },
  { name: 'R2_BUCKET', label: 'Bucket' },
] satisfies SecretFieldDef[]

interface SecretFieldsProps {
  fields: SecretFieldDef[]
  keys: Record<SecretName, SecretKeyStatus>
  values: Partial<Record<SecretName, string | null>>
  onChange: (name: SecretName, change: SecretChange) => void
}

/** One key input: masked, with reveal, remove and undo. */
function SecretField(props: SecretFieldProps) {
  const { name, label, hint, status, value, remove, onChange } = props
  const readOnly = status.source === 'env'
  const schemaError = value ? secretError(name, value) : null
  const softHint =
    name === 'OPENROUTER_API_KEY' && value && !value.startsWith('sk-or-')
      ? 'OpenRouter keys usually start with sk-or-'
      : null

  const placeholder = status.set && status.hint ? `•••• ${status.hint}` : 'Not set'

  let note: string | null = null
  if (readOnly) note = 'Set by environment'
  else if (value) note = 'Unsaved change'
  else if (status.set) note = 'Stored'
  const removedLabel = status.hint ? `•••• ${status.hint}` : 'stored key'
  let description: ReactNode = null
  if (remove && !readOnly) {
    description = (
      <p className="text-xxs text-fg-2">
        Will remove <span className="line-through">{removedLabel}</span>
      </p>
    )
  } else if (note) {
    description = <p className="text-xxs text-fg-2">{note}</p>
  }

  return (
    <>
      <Field
        id={name}
        label={label}
        hint={hint}
        error={schemaError}
        description={description}
        trailing={
          status.set &&
          !readOnly && (
            <button
              type="button"
              aria-pressed={remove}
              onClick={() => onChange({ remove: !remove })}
              className="h-9 shrink-0 rounded-lg border border-line px-2.5 text-xs text-fg-2 hover:bg-hover hover:text-fg aria-pressed:border-danger/40 aria-pressed:text-danger"
            >
              {remove ? 'Undo' : 'Remove'}
            </button>
          )
        }
      >
        <PasswordInput
          name={name}
          disabled={readOnly}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange({ value: event.target.value.trim() })}
        />
      </Field>
      {Boolean(softHint) && <p className="text-xxs text-fg-2">{softHint}</p>}
    </>
  )
}

/** Renders a list of secret fields bound to the modal draft. */
export function SecretFields(props: SecretFieldsProps) {
  const { fields, keys, values, onChange } = props
  return (
    <div className="space-y-3">
      {fields.map((field) => (
        <SecretField
          key={field.name}
          name={field.name}
          label={field.label}
          hint={field.hint}
          status={keys[field.name]}
          value={values[field.name] ?? ''}
          remove={values[field.name] === null}
          onChange={(change) => onChange(field.name, change)}
        />
      ))}
    </div>
  )
}
