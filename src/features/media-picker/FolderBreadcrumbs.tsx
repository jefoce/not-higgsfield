'use client'

import { Fragment } from 'react'

export interface FolderBreadcrumbsProps {
  folderName: string
  sub: string
  onNavigate: (sub: string) => void
}

/** Folder name plus clickable sub-path segments. */
export function FolderBreadcrumbs(props: FolderBreadcrumbsProps) {
  const { folderName, sub, onNavigate } = props
  const segments = sub.split('/').filter(Boolean)

  return (
    <nav className="flex min-w-0 items-center gap-1 overflow-x-auto text-xs text-fg-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button
        type="button"
        onClick={() => onNavigate('')}
        className={segments.length === 0 ? 'shrink-0 text-fg' : 'shrink-0 transition hover:text-fg'}
      >
        {folderName}
      </button>
      {segments.map((segment, index) => {
        const target = segments.slice(0, index + 1).join('/')
        const current = index === segments.length - 1
        return (
          <Fragment key={target}>
            <span className="shrink-0 text-fg-3">/</span>
            <button
              type="button"
              onClick={() => onNavigate(target)}
              className={current ? 'shrink-0 text-fg' : 'shrink-0 transition hover:text-fg'}
            >
              {segment}
            </button>
          </Fragment>
        )
      })}
    </nav>
  )
}
