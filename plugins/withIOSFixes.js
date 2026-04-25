/**
 * Config plugin para corrigir incompatibilidades de build iOS com New Architecture.
 *
 * Problemas corrigidos:
 *   1. @react-native-firebase: non-modular header + "declaration must be imported from module"
 *   2. Código C legado: implicit int (C99 strict mode)
 *   3. Deprecated declarations promovidas a erro
 *
 * Estratégia: um único withDangerousMod que injeta código no post_install do Podfile.
 * O bloco modifica TRÊS camadas:
 *   (a) Todos os pod targets  (installer.pods_project.targets)
 *   (b) O Pods project em si  (installer.pods_project.build_configurations)
 *   (c) O main app project    (installer.aggregate_targets[].user_project)
 *
 * A camada (c) resolve o erro "declaration of RCTBridgeModule must be imported from
 * module RNFBApp" que ocorre no target principal (cnbmobile), não nos pod targets.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const FIX_MARKER = 'CNB_IOS_FIXES_APPLIED';

// Bloco Ruby inserido dentro do post_install existente, APÓS react_native_post_install(...)
const PODFILE_FIX = `
    # [CNB_IOS_FIXES_APPLIED] Fixes de compatibilidade com New Architecture

    # (a) Pod targets — implicit-int, C standard, non-modular includes
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |cfg|
        cfg.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        cfg.build_settings['GCC_C_LANGUAGE_STANDARD'] = 'gnu99'
        existing = cfg.build_settings['OTHER_CFLAGS']
        extra = %w[-Wno-implicit-int -Wno-deprecated-declarations]
        if existing.is_a?(Array)
          cfg.build_settings['OTHER_CFLAGS'] = (existing + extra).uniq
        else
          base = (existing.nil? || existing.to_s.strip.empty?) ? '$(inherited)' : existing.to_s
          cfg.build_settings['OTHER_CFLAGS'] = "#{base} #{extra.join(' ')}"
        end
      end
    end

    # (b) Pods project — non-modular includes no nível de projeto
    installer.pods_project.build_configurations.each do |cfg|
      cfg.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
    end

    # (c) Main app project — corrige o erro de módulo no target cnbmobile
    installer.aggregate_targets.each do |aggregate_target|
      aggregate_target.user_project.targets.each do |target|
        target.build_configurations.each do |cfg|
          cfg.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        end
      end
      aggregate_target.user_project.save
    end`;

module.exports = function withIOSFixes(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      if (!fs.existsSync(podfilePath)) return config;

      let podfile = fs.readFileSync(podfilePath, 'utf8');

      if (podfile.includes(FIX_MARKER)) return config;

      // Estratégia A: insere logo após o fechamento de react_native_post_install(...)
      // Usa [\s\S]*? para cruzar linhas; para na primeira ) que fecha a chamada
      const withFixA = podfile.replace(
        /(react_native_post_install\([\s\S]*?\))/,
        `$1${PODFILE_FIX}`,
      );

      if (withFixA !== podfile) {
        podfile = withFixA;
      } else {
        // Estratégia B (fallback): insere antes do último "  end\nend"
        // que fecha o bloco post_install e o target block
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
};
