/**
 * Config plugin para corrigir incompatibilidades de build iOS com New Architecture.
 *
 * Sem use_frameworks! :linkage => :static, os pods Swift do Firebase (FirebaseStorage,
 * FirebaseCoreInternal) não conseguem importar pods ObjC sem module maps.
 * A solução é use_modular_headers! globalmente — gera module maps para todos os pods
 * sem criar framework module context (que causava FIRApp* undefined).
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const FIX_MARKER = 'CNB_IOS_FIXES_APPLIED';

// Inserido ANTES do target 'CNBMobile' do
const MODULAR_HEADERS_BLOCK = `# [CNB_IOS_FIXES_APPLIED] use_modular_headers! para Firebase Swift pods
use_modular_headers!

`;

const POST_INSTALL_BLOCK = `    # [CNB_IOS_FIXES_APPLIED] Fixes de compatibilidade com New Architecture
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |cfg|
        extra_flags = %w[-Wno-implicit-int -Wno-implicit-function-declaration -Wno-deprecated-declarations]
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

      // 1. Inserir use_modular_headers! antes do target 'CNBMobile' do
      podfile = podfile.replace(
        /^(target 'CNBMobile' do)/m,
        `${MODULAR_HEADERS_BLOCK}$1`,
      );

      // 2. Inserir post_install fixes antes do "  end\nend" final
      podfile = podfile.replace(
        /(\s+\)\s*\n)(  end\nend\s*)$/,
        `$1${POST_INSTALL_BLOCK}$2`,
      );

      fs.writeFileSync(podfilePath, podfile);
      return config;
    },
  ]);
};
