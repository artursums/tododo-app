const { withDangerousMod } = require('expo/config-plugins')
const fs = require('fs')
const path = require('path')

/**
 * Adds `:modular_headers => true` for the Google pods that AppCheckCore (a Swift
 * pod pulled in transitively by @react-native-google-signin) imports. Without
 * this, a static-libraries `pod install` fails on EAS with:
 *
 *   The Swift pod `AppCheckCore` depends upon `GoogleUtilities` and
 *   `RecaptchaInterop`, which do not define modules.
 *
 * NOTE: only add this plugin to app.json AFTER @react-native-google-signin is
 * wired up (its google-signin plugin + iosUrlScheme). Injecting these pods when
 * google-signin is absent would reference pods that CocoaPods can't resolve.
 */

const MARKER = "pod 'GoogleUtilities', :modular_headers => true"
const INJECTION = [
  "  pod 'GoogleUtilities', :modular_headers => true",
  "  pod 'RecaptchaInterop', :modular_headers => true",
].join('\n')

module.exports = function withGoogleModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile')
      let contents = fs.readFileSync(podfilePath, 'utf8')

      if (!contents.includes(MARKER)) {
        // Declare the pods right after `use_expo_modules!`, inside the app target,
        // so the modular-headers flag is set before CocoaPods integrates them.
        contents = contents.replace(/^(\s*use_expo_modules!.*)$/m, `$1\n${INJECTION}`)
        fs.writeFileSync(podfilePath, contents)
      }

      return cfg
    },
  ])
}
