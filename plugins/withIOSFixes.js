/**
 * Config plugin: ajustes do Podfile.
 *
 * - use_modular_headers! global: FirebaseCoreInternal (Swift) precisa importar
 *   GoogleUtilities (ObjC) modularly via Cocoapods. Sem isso o pod install
 *   aborta com "Swift pods cannot yet be integrated as static libraries".
 *
 * - Warnings flags em post_install para silenciar implicit-int / non-modular-
 *   include vindos de Firebase/RN ObjC.
 *
 * Sem use_frameworks!:static — esse só era necessário pro RNFBStorage/Crash/
 * Perf. Com modular_headers em static libs (linkagem padrão), os imports
 * `#import <React/RCTBridgeModule.h>` continuam válidos (não viram modulares
 * forçados como aconteceria com frameworks).
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const FIX_MARKER = 'CNB_IOS_FIXES_APPLIED';

const MODULAR_HEADERS_BLOCK = `# [CNB_IOS_FIXES_APPLIED] use_modular_headers! para FirebaseCoreInternal Swift
use_modular_headers!

`;

const POST_INSTALL_BLOCK = `    # [CNB_IOS_FIXES_APPLIED] Warning flags para Firebase/RN ObjC compile
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |cfg|
        extra_flags = %w[
          -Wno-implicit-int
          -Wno-implicit-function-declaration
          -Wno-deprecated-declarations
          -Wno-non-modular-include-in-framework-module
        ]
        existing = cfg.build_settings['OTHER_CFLAGS']
        if existing.is_a?(Array)
          cfg.build_settings['OTHER_CFLAGS'] = (existing + extra_flags).uniq
        else
          base = existing || '$(inherited)'
          cfg.build_settings['OTHER_CFLAGS'] = "#{base} #{extra_flags.join(' ')}"
        end
      end
    end
`;

module.exports = function withIOSFixes(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      if (!fs.existsSync(podfilePath)) return config;

      let podfile = fs.readFileSync(podfilePath, 'utf8');

      if (podfile.includes(FIX_MARKER)) return config;

      podfile = podfile.replace(
        /^(target '[^']+' do)/m,
        `${MODULAR_HEADERS_BLOCK}$1`,
      );

      podfile = podfile.replace(
        /(\s+\)\s*\n)(  end\nend\s*)$/,
        `$1${POST_INSTALL_BLOCK}$2`,
      );

      fs.writeFileSync(podfilePath, podfile);
      return config;
    },
  ]);
};
