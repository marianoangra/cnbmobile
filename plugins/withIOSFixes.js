/**
 * Config plugin para corrigir incompatibilidades de build iOS com New Architecture.
 *
 * Firebase Storage 11+ é 100% Swift. Sem use_frameworks!, o compilador Swift não
 * gera FirebaseStorage-Swift.h automaticamente. Firebase.h inclui condicionalmente
 * esse arquivo quando FirebaseStorage-umbrella.h é encontrado (via sistema de módulos).
 *
 * Solução:
 *  1. use_modular_headers! global para que FirebaseCoreInternal (Swift) consiga
 *     importar GoogleUtilities (ObjC) durante pod install.
 *  2. Stub FirebaseStorage-Swift.h com declarações ObjC completas para os tipos
 *     Swift (@objc) de FirebaseStorage que RNFBStorage usa.
 *
 * NÃO usar use_frameworks! junto com use_modular_headers! — a combinação cria
 * definições de módulo duplicadas para FirebaseCore → FIRApp* undefined.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const FIX_MARKER = 'CNB_IOS_FIXES_APPLIED';

// Inserido ANTES do target 'CNBMobile' do
const MODULAR_HEADERS_BLOCK = `# [CNB_IOS_FIXES_APPLIED] use_modular_headers! para Firebase Swift pods
use_modular_headers!

`;

const POST_INSTALL_BLOCK = `    # [CNB_IOS_FIXES_APPLIED] Stub FirebaseStorage-Swift.h + warnings flags
    require 'fileutils'
    stub_dir = "#{installer.sandbox.root}/Headers/Public/FirebaseStorage"
    FileUtils.mkdir_p(stub_dir)
    stub_src = File.join(__dir__, '..', 'plugins', 'FirebaseStorage-Swift-stub.h')
    stub_dst = "#{stub_dir}/FirebaseStorage-Swift.h"
    if File.exist?(stub_src)
      FileUtils.cp(stub_src, stub_dst)
    else
      File.write(stub_dst, "// FirebaseStorage-Swift.h stub\\n") unless File.exist?(stub_dst)
    end
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

      // Pula se já aplicado
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
