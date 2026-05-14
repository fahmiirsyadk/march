export type PiModule = typeof import('@earendil-works/pi-coding-agent')

let piModulePromise: Promise<PiModule> | undefined

export function getPiModule() {
  if (!piModulePromise) {
    piModulePromise = import(
      `${process.cwd()}/node_modules/@earendil-works/pi-coding-agent/dist/index.js`
    ) as Promise<PiModule>
  }
  return piModulePromise
}
