import { loadAppSettings } from '../app-settings/readers.ts'
import {
  createArtifact,
  editArtifact,
  getArtifact,
  listArtifacts,
  updateArtifact,
} from '../artifact-state-db.ts'
import { getSessionNativeExtensions, setSessionNativeExtensions } from '../thread-state-db.ts'
import type {
  RuntimeHostMainRequestMap,
  RuntimeHostMainRequestName,
  RuntimeHostMainResponseMap,
} from './protocol.ts'

export async function invokeMainRequest<TName extends RuntimeHostMainRequestName>(
  name: TName,
  payload: RuntimeHostMainRequestMap[TName],
): Promise<RuntimeHostMainResponseMap[TName]> {
  switch (name) {
    case 'getSessionNativeExtensions': {
      const p = payload as RuntimeHostMainRequestMap['getSessionNativeExtensions']
      return (await getSessionNativeExtensions(p.sessionPath)) as RuntimeHostMainResponseMap[TName]
    }
    case 'setSessionNativeExtensions': {
      const p = payload as RuntimeHostMainRequestMap['setSessionNativeExtensions']
      setSessionNativeExtensions(p.sessionPath, p.enabled)
      return { ok: true } as RuntimeHostMainResponseMap[TName]
    }
    case 'snapshotDefaultNativeExtensions': {
      const appSettings = loadAppSettings()
      return (
        appSettings.howcodeNativeAskQuestions ? ['askQuestions'] : []
      ) as RuntimeHostMainResponseMap[TName]
    }
    case 'createArtifact': {
      const p = payload as RuntimeHostMainRequestMap['createArtifact']
      return createArtifact(p) as RuntimeHostMainResponseMap[TName]
    }
    case 'updateArtifact': {
      const p = payload as RuntimeHostMainRequestMap['updateArtifact']
      return updateArtifact(p) as RuntimeHostMainResponseMap[TName]
    }
    case 'editArtifact': {
      const p = payload as RuntimeHostMainRequestMap['editArtifact']
      return editArtifact(p) as RuntimeHostMainResponseMap[TName]
    }
    case 'getArtifact': {
      const p = payload as RuntimeHostMainRequestMap['getArtifact']
      return (await getArtifact(
        p.artifactSlug,
        p.conversationId,
      )) as RuntimeHostMainResponseMap[TName]
    }
    case 'listArtifacts': {
      const p = payload as RuntimeHostMainRequestMap['listArtifacts']
      return listArtifacts(p.conversationId) as RuntimeHostMainResponseMap[TName]
    }
    default:
      throw new Error(`Unknown main request: ${name}`)
  }
}
