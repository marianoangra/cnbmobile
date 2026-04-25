/**
 * Config plugin para corrigir incompatibilidades de build iOS com New Architecture.
 *
 * Firebase Storage 11+ é 100% Swift. As classes FIRStorage, FIRStorageReference, etc.
 * são expostas para ObjC somente via FirebaseStorage-Swift.h, que o compilador Swift
 * gera APENAS quando use_frameworks! :linkage => :static está ativo.
 *
 * Sem use_frameworks!, o arquivo não é gerado e RNFBStorageModule.m falha ao compilar.
 *
 * NÃO usar use_modular_headers! junto com use_frameworks! — a combinação cria
 * definições de módulo duplicadas para FirebaseCore, causando FIRApp* undefined.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const FIX_MARKER = 'CNB_IOS_FIXES_APPLIED';

// Inserido ANTES do target 'CNBMobile' do
const FRAMEWORKS_BLOCK = `# [CNB_IOS_FIXES_APPLIED] Firebase Storage 11+ é Swift: use_frameworks! gera o bridge header
use_frameworks! :linkage => :static

`;

const POST_INSTALL_BLOCK = `    # [CNB_IOS_FIXES_APPLIED] Suprime warnings de C legado que quebram compilação
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

      // Pula se já aplicado
      if (podfile.includes(FIX_MARKER)) return config;

      // 1. Inserir use_frameworks! antes do target 'CNBMobile' do
      podfile = podfile.replace(
        /^(target 'CNBMobile' do)/m,
        `${FRAMEWORKS_BLOCK}$1`,
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
