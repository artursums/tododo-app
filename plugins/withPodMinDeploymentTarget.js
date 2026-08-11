const { withDangerousMod } = require('expo/config-plugins')
const fs = require('fs')
const path = require('path')

/**
 * Pins every CocoaPods target to the project's minimum iOS deployment target.
 *
 * Some pods ship a very low IPHONEOS_DEPLOYMENT_TARGET (9.0). Below iOS 11,
 * libc++'s aligned `operator new` is unavailable, so under Xcode 26 / Clang 17
 * folly/lang/New.h fails to compile ("no matching function ... op_new_"),
 * breaking the whole iOS build. Bumping each pod target to the project floor
 * makes aligned allocation available again.
 *
 * `ios/` is gitignored (Continuous Native Generation), so this lives as a config
 * plugin instead of a hand-edit to ios/Podfile, which prebuild would overwrite.
 */

const MARKER = 'Pin every pod target to the project minimum'
const MIN_IOS = '15.1'

const INJECTION = `
    # ${MARKER} (aligned operator new needs iOS 11+ under Xcode 26 / Clang 17).
    min_ios = (podfile_properties['ios.deploymentTarget'] || '${MIN_IOS}')
    installer.pods_project.targets.each do |t|
      t.build_configurations.each do |cfg|
        current = cfg.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current.nil? || current.to_f < min_ios.to_f
          cfg.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = min_ios
        end
      end
    end`

module.exports = function withPodMinDeploymentTarget(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile')
      let contents = fs.readFileSync(podfilePath, 'utf8')

      if (!contents.includes(MARKER)) {
        // Insert right after the `react_native_post_install(...)` call so our
        // bump runs last and nothing lowers the targets afterwards.
        const replaced = contents.replace(
          /(react_native_post_install\([\s\S]*?\n\s*\))/,
          `$1\n${INJECTION}`,
        )
        if (replaced !== contents) {
          fs.writeFileSync(podfilePath, replaced)
        } else {
          console.warn(
            '[withPodMinDeploymentTarget] could not find react_native_post_install; Podfile left unchanged',
          )
        }
      }

      return cfg
    },
  ])
}
