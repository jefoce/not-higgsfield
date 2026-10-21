'use client'

import { GeneratorPanel } from '@/features/generator/GeneratorPanel'
import { HistorySection } from '@/features/history/HistorySection'
import { MediaPickerModal } from '@/features/media-picker/MediaPickerModal'
import { MediaPreviewModal } from '@/features/preview/MediaPreviewModal'
import { SettingsModal } from '@/features/settings/SettingsModal'
import { usePointerBlur } from '@/lib/use-pointer-blur'

/** Two-column studio shell: generate panel left, history right. */
export function Studio() {
  usePointerBlur()

  return (
    <>
      <main className="mx-auto flex h-dvh w-full max-w-[1920px] gap-2 overflow-hidden px-4 pb-2 pt-2 max-[900px]:h-auto max-[900px]:flex-col">
        <aside className="flex max-h-full w-80 shrink-0 self-start flex-col overflow-hidden rounded-panel border border-line bg-page-2 max-[900px]:max-h-[min(720px,90vh)] max-[900px]:w-full">
          <GeneratorPanel />
        </aside>
        <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-panel border border-line-strong bg-page">
          <HistorySection />
        </section>
      </main>
      <MediaPickerModal />
      <MediaPreviewModal />
      <SettingsModal />
    </>
  )
}
