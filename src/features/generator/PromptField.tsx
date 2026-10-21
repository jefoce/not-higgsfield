'use client'

import { useCallback, useMemo } from 'react'
import type { EditorState } from 'lexical'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin'
import {
  BeautifulMentionsPlugin,
  createBeautifulMentionNode,
} from 'lexical-beautiful-mentions'
import type { ValidationIssue } from '@/core/validation'
import { AudioChip } from './AudioChip'
import { PromptEditorBridge } from './PromptEditorBridge'
import { PromptWarnings } from './PromptWarnings'
import { mentionItems, serializeEditor } from './prompt-convert'
import { ReferenceChip } from './ReferenceChip'
import { ReferencePickerMenu } from './ReferencePickerMenu'
import { ReferencePickerMenuItem } from './ReferencePickerMenuItem'
import { SeedChip } from './SeedChip'
import { promptFor, useGeneratorStore } from './store'

const PLACEHOLDER = 'Describe the video. Refer to inputs as Image 1, Video 1, or Audio 1'
const EDITOR_NODES = createBeautifulMentionNode(ReferenceChip)

interface PromptFieldProps {
  onSubmit: () => void
  warnings: ValidationIssue[]
}

/** Lexical prompt editor with per-mode drafts, live reference chips and warning chip. */
export function PromptField(props: PromptFieldProps) {
  const { onSubmit, warnings } = props
  const prompt = useGeneratorStore(promptFor)
  const setPrompt = useGeneratorStore((state) => state.setPrompt)
  const tab = useGeneratorStore((state) => state.tab)
  const references = useGeneratorStore((state) => state.references)
  const uploadsById = useGeneratorStore((state) => state.uploadsById)

  const focusSlot = useGeneratorStore((state) => state.focusSlot)
  const items = useMemo(() => mentionItems({ references, uploadsById }), [references, uploadsById])
  const onChange = useCallback((state: EditorState) => setPrompt(serializeEditor(state)), [setPrompt])
  const initialConfig = useMemo(
    () => ({
      namespace: 'prompt-editor',
      nodes: [...EDITOR_NODES],
      onError: (error: Error) => { throw error },
    }),
    [],
  )

  return (
    <div className="mt-4 min-h-[160px] rounded-xl border border-line bg-surface">
      <div className="max-h-[200px] overflow-y-auto">
        <div className="px-3 pt-3 text-sm font-medium leading-5 text-fg-2">Prompt</div>
        <LexicalComposer key={tab} initialConfig={initialConfig}>
          <div className="relative" data-prompt-editor>
            <PlainTextPlugin
              contentEditable={
                <ContentEditable
                  aria-label="Prompt"
                  className="block min-h-[132px] w-full whitespace-pre-wrap break-words px-3 py-3 text-sm leading-5 outline-none"
                />
              }
              placeholder={
                <p className="pointer-events-none absolute left-3 top-3 text-sm leading-5 text-fg-2">
                  {PLACEHOLDER}
                </p>
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
            <OnChangePlugin ignoreSelectionChange onChange={onChange} />
            <HistoryPlugin />
            <PromptEditorBridge prompt={prompt} onSubmit={onSubmit} />
            {tab === 'references' && (
              <BeautifulMentionsPlugin
                items={items}
                triggers={['@']}
                creatable={false}
                allowSpaces={false}
                menuComponent={ReferencePickerMenu}
                menuItemComponent={ReferencePickerMenuItem}
              />
            )}
          </div>
        </LexicalComposer>
      </div>
      <div className="flex items-center gap-1 rounded-b-xl bg-surface px-3 pb-3 pt-2">
        <AudioChip />
        <SeedChip />
        <PromptWarnings warnings={warnings} onFocus={focusSlot} />
      </div>
    </div>
  )
}
