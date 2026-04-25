/**
 * Config plugin para corrigir incompatibilidades de build iOS com New Architecture.
 *
 * Usa EXATAMENTE o mesmo regex dos builds 2/3 (que passaram o pod install).
 * Adiciona:
 *   - installer.pods_project.build_configurations (project-level fix)
 *   - installer.aggregate_targets (main app xcodeproj fix, com rescue)
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const FIX_MARKER = 'CNB_IOS_FIXES_APPLIED';

const FIX_BLOCK = `    # [CNB_IOS_FIXES_APPLIED] Fixes de compatibilidade com New Architecture
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |cfg|
        cfg.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        cfg.build_settings['GCC_C_LANGUAGE_STANDARD'] = 'gnu99'
        existing = cfg.build_settings['OTHER_CFLAGS']
        if existing.is_a?(Array)
          cfg.build_settings['OTHER_CFLAGS'] = (existing + ['-Wno-implicit-int', '-Wno-deprecated-declarations']).uniq
        else
          base = existing || '$(inherited)'
          cfg.build_settings['OTHER_CFLAGS'] = "#{base} -Wno-implicit-int -Wno-deprecated-declarations"
        end
      end
    end
    installer.pods_project.build_configurations.each do |cfg|
      cfg.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
    end
    begin
      installer.aggregate_targets.each do |agg|
        next unless agg.user_project
        agg.user_project.targets.each do |t|
          t.build_configurations.each do |cfg|
            cfg.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
          end
        end
        agg.user_project.save
      end
    rescue => e
      puts "CNB: user_project fix skipped - #{e.message}"
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

      // Regex idêntico ao dos builds 2/3 (comprovadamente funciona no pod install)
      podfile = podfile.replace(
        /(\s+\)\s*\n)(  end\nend\s*)$/,
        `$1${FIX_BLOCK}$2`,
      );

      fs.writeFileSync(podfilePath, podfile);
      return config;
    },
  ]);
};
