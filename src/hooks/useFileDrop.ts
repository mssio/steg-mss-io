import { useState, type DragEvent } from 'react'

/** Drag-and-drop of a single file onto an element, with a drag-over flag. */
export function useFileDrop(onFile: (file: File) => void) {
  const [dragging, setDragging] = useState(false)

  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes('Files')

  return {
    dragging,
    dropProps: {
      onDragEnter(e: DragEvent) {
        if (!hasFiles(e)) return
        e.preventDefault()
        setDragging(true)
      },
      onDragOver(e: DragEvent) {
        if (!hasFiles(e)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
      },
      onDragLeave(e: DragEvent) {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
        setDragging(false)
      },
      onDrop(e: DragEvent) {
        if (!hasFiles(e)) return
        e.preventDefault()
        setDragging(false)
        const file = e.dataTransfer.files[0]
        if (file) onFile(file)
      },
    },
  }
}
