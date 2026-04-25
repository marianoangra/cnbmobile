/**
 * Config plugin para corrigir incompatibilidades de build iOS com New Architecture:
 * 1. @react-native-firebase: non-modular header inside framework module
 * 2. Código C legado com implicit int (C99 strict mode)
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const FIX_MARKER = 'CNB_IOS_FIXES_APPLIED';

const FIX_BLOCK = `    # [CNB_IOS_FIXES_APPLIED] Fixes de compatibilidade com New Architecture
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |cfg|
        # Fix 1: @react-native-firebase — non-modular header inside framework module
        cfg.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        # Fix 2: código C legado — implicit int proibido em C99+
        cfg.build_settings['GCC_C_LANGUAGE_STANDARD'] = 'gnu99'
        existing_flags = cfg.build_settings['OTHER_CFLAGS']
        if existing_flags.is_a?(Array)
          cfg.build_settings['OTHER_CFLAGS'] = existing_flags + ['-Wno-implicit-int'] unless existing_flags.include?('-Wno-implicit-int')
        else
          base = existing_flags || '$(inherited)'
          cfg.build_settings['OTHER_CFLAGS'] = "#{base} -Wno-implicit-int" unless base.include?('-Wno-implicit-int')
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

      // Insere dentro do post_install, logo após react_native_post_install(...)
      podfile = podfile.replace(
        /(\s+\)\s*\n)(  end\nend\s*)$/,
        `$1${FIX_BLOCK}$2`
      );

      fs.writeFileSync(podfilePath, podfile);
      return config;
    },
  ]);
};
