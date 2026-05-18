import type { ComposerAttachment } from './desktop-data-contracts'

const externalReferencePattern = /^https?:\/\//i

function isExternalReference(path: string) {
  return externalReferencePattern.test(path)
}

export function buildComposerAttachmentPrompt(attachments: ComposerAttachment[]): string {
  const normalizedAttachments = attachments
    .map((attachment) => ({ ...attachment, path: attachment.path.trim() }))
    .filter((attachment) => attachment.path.length > 0)

  if (normalizedAttachments.length === 0) {
    return ''
  }

  const localFiles = normalizedAttachments.filter(
    (attachment) => !isExternalReference(attachment.path) && attachment.kind !== 'directory',
  )
  const localDirectories = normalizedAttachments.filter(
    (attachment) => !isExternalReference(attachment.path) && attachment.kind === 'directory',
  )
  const externalReferences = normalizedAttachments.filter((attachment) =>
    isExternalReference(attachment.path),
  )
  const sections: string[] = []

  if (localFiles.length > 0) {
    sections.push(
      `<attached_files>\n${localFiles.map((attachment) => `- ${attachment.path}`).join('\n')}\n</attached_files>`,
    )
  }

  if (localDirectories.length > 0) {
    sections.push(
      `<attached_directories>\n${localDirectories.map((attachment) => `- ${attachment.path}`).join('\n')}\n</attached_directories>`,
    )
  }

  if (externalReferences.length > 0) {
    sections.push(
      `<external_references>\n${externalReferences.map((attachment) => `- ${attachment.path}`).join('\n')}\n</external_references>`,
    )
  }

  return sections.join('\n\n')
}
