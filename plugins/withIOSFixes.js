/**
 * Config plugin: ajustes do Podfile para o stack RN Firebase + static frameworks.
 *
 * - use_modular_headers! global: necessário para os módulos @react-native-firebase
 *   (RNFBApp etc) conseguirem `@import React` — sem isso o React-Core não vira
 *   módulo e o build quebra com "RCTBridgeModule must be imported from module".
 *
 * - useFrameworks=static (vem de expo-build-properties em app.json): exigido pelo
 *   FirebaseCrashlytics e pelo FirebasePerformance para inicializar corretamente
 *   em runtime.
 *
 * O combo static + modular_headers só dava conflito quando RNFBStorage estava
 * presente (FIRApp undefined em RNFBStorageModule.m). Sem RNFBStorage ele compila
 * limpo — esse era o setup que rodava no build 173.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const FIX_MARKER = 'CNB_IOS_FIXES_APPLIED';

const MODULAR_HEADERS_BLOCK = `# [CNB_IOS_FIXES_APPLIED] use_modular_headers! para Firebase Swift pods + RN modular import
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
        /^(target 'CNBMobile' do)/m,
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
