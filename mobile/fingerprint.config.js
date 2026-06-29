// Fingerprint config for expo-updates / EAS (runtimeVersion policy: "fingerprint").
//
// package.json `scripts` (test, start, android, …) are dev/CLI conveniences that don't
// affect the native runtime, but @expo/fingerprint hashes them by default. Adding a
// `test`/`test:watch` script once flipped the fingerprint and broke OTA matching to an
// already-installed build (the JS was fully compatible — only the script list differed).
// Skipping the scripts source keeps the fingerprint moving only on real native changes,
// so dev-tooling tweaks no longer force a rebuild. (Safe here: none of our scripts are
// build hooks like postinstall/prebuild.)
const { SourceSkips } = require('@expo/fingerprint');

module.exports = {
  sourceSkips: SourceSkips.PackageJsonScriptsAll,
};
