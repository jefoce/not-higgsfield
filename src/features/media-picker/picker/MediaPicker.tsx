'use client'

import { isNil } from 'lodash-es'
import type { RefObject } from 'react'

import { DockedPanel } from '@/ui/DockedPanel'

import { PickerBody } from './PickerBody'
import { closeMediaPicker, useMediaPickerStore } from './store'

interface MediaPickerProps {
  anchorRef: RefObject<HTMLElement | null>
}

function handleOpenChange(isOpen: boolean): void {
  if (!isOpen) {
    closeMediaPicker()
  }
}

/** Picker shell, docked beside the generator on wide screens, a dialog otherwise. */
export function MediaPicker(props: MediaPickerProps) {
  const request = useMediaPickerStore((state) => {
    return state.request
  })

  return (
    <DockedPanel
      open={!isNil(request)}
      onOpenChange={handleOpenChange}
      anchorRef={props.anchorRef}
      fallback="modal"
      label="Choose media"
    >
      {!isNil(request) && <PickerBody key={request.id} request={request} />}
    </DockedPanel>
  )
}
