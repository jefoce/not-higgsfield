'use client'

import { Modal } from '@/ui/Modal'
import { PickerBody } from './PickerBody'
import { closeMediaPicker, useMediaPickerStore } from './store'

/** Dialog shell; the body remounts per request so its state resets. */
export function MediaPickerModal() {
  const request = useMediaPickerStore((state) => state.request)

  return (
    <Modal
      open={Boolean(request)}
      onOpenChange={(open) => {
        if (!open) closeMediaPicker()
      }}
      label="Choose media"
      className="flex h-[min(720px,85vh)] max-h-none w-[min(900px,90vw)] flex-col bg-page-2 p-3 max-[900px]:w-[calc(100vw-16px)]"
    >
      {request !== null && <PickerBody key={request.id} request={request} />}
    </Modal>
  )
}
