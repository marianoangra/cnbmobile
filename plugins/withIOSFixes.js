/**
 * Config plugin para corrigir incompatibilidades de build iOS com New Architecture:
 * 1. @react-native-firebase: non-modular header + module declaration error
 * 2. Código C legado com implicit int (C99 strict mode)
 * 3. Deprecated declarations promoted to errors
 *
 * Aplica fixes em dois lugares:
 *   a) xcodeproj principal (target cnbmobile)  — via withXcodeProject
 *   b) Pods project (todos os pod targets)     — via withDangerousMod / Podfile
 */
const { withDangerousMod, withXcodeProject } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const FIX_MARKER = 'CNB_IOS_FIXES_APPLIED';

/* ─── 1. Fix no xcodeproj principal (main app target) ──────────────────── */
function applyXcodeProjectFixes(config) {
  return withXcodeProject(config, async (config) => {
    const project = config.modResults;
    const configs = project.pbxXCBuildConfigurationSection();

    for (const [, bc] of Object.entries(configs)) {
      if (typeof bc !== 'object' || !bc.buildSettings) continue;
      bc.buildSettings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES';
    }

    return config;
  });
}

/* ─── 2. Fix no Podfile (pod targets + pods project) ───────────────────── */

// Bloco Ruby inserido DENTRO do post_install existente, após react_native_post_install(...)
const PODFILE_FIX = `
    # [CNB_IOS_FIXES_APPLIED] Fixes de compatibilidade com New Architecture
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |cfg|
        cfg.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        cfg.build_settings['GCC_C_LANGUAGE_STANDARD'] = 'gnu99'
        existing = cfg.build_settings['OTHER_CFLAGS']
        if existing.is_a?(Array)
          cfg.build_settings['OTHER_CFLAGS'] = (existing + %w[-Wno-implicit-int -Wno-deprecated-declarations]).uniq
        else
          base = (existing.nil? || existing.to_s.strip.empty?) ? '$(inherited)' : existing.to_s
          cfg.build_settings['OTHER_CFLAGS'] = "#{base} -Wno-implicit-int -Wno-deprecated-declarations"
        end
      end
    end
    installer.pods_project.build_configurations.each do |cfg|
      cfg.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
    end`;

function applyPodfileFixes(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      if (!fs.existsSync(podfilePath)) return config;

      let podfile = fs.readFileSync(podfilePath, 'utf8');
      if (podfile.includes(FIX_MARKER)) return config;

      // Injeta $RNFirebaseAsStaticFramework = true antes de use_native_modules!
      if (!podfile.includes('$RNFirebaseAsStaticFramework')) {
        podfile = podfile.replace(
          'config = use_native_modules!',
          '$RNFirebaseAsStaticFramework = true\n  config = use_native_modules!',
        );
      }

      // Estratégia A: insere logo após react_native_post_install(...)
      const withFix = podfile.replace(
        /(react_native_post_install\([\s\S]*?\))/,
        `$1${PODFILE_FIX}`,
      );

      if (withFix !== podfile) {
        podfile = withFix;
      } else {
        // Estratégia B (fallback): insere antes do último "  end\nend"
        const closeMarker = '\n  end\nend';
        const lastIdx = podfile.lastIndexOf(closeMarker);
        if (lastIdx !== -1) {
          podfile =
            podfile.slice(0, lastIdx) + '\n' + PODFILE_FIX + podfile.slice(lastIdx);
        }
      }

      fs.writeFileSync(podfilePath, podfile);
      return config;
    },
  ]);
}

/* ─── Exporta plugin composto ───────────────────────────────────────────── */
module.exports = function withIOSFixes(config) {
  config = applyXcodeProjectFixes(config);
  config = applyPodfileFixes(config);
  return config;
};
