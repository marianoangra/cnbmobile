/**
 * Config plugin para react-native-background-actions.
 *
 * O manifest interno do pacote declara o serviço SEM android:foregroundServiceType.
 * No Android 14+ (API 34), iniciar um foreground service sem esse atributo gera
 * ForegroundServiceStartNotAllowedException — crash nativo que não pode ser capturado em JS.
 *
 * Este plugin localiza a declaração do serviço no AndroidManifest gerado pelo prebuild
 * e injeta android:foregroundServiceType="dataSync".
 */
const { withAndroidManifest } = require('@expo/config-plugins');

const SERVICE_NAME = 'com.asterinet.react.bgactions.RNBackgroundActionsTask';

module.exports = function withBackgroundActions(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const application = manifest.manifest.application?.[0];
    if (!application) return config;

    if (!application.service) application.service = [];

    const existing = application.service.find(
      (s) => s.$?.['android:name'] === SERVICE_NAME || s.$?.['android:name'] === '.RNBackgroundActionsTask'
    );

    if (existing) {
      // Garante que o atributo está presente
      existing.$['android:foregroundServiceType'] = 'dataSync';
    } else {
      // Adiciona caso autolinking não tenha inserido ainda
      application.service.push({
        $: {
          'android:name': SERVICE_NAME,
          'android:enabled': 'true',
          'android:exported': 'false',
          'android:foregroundServiceType': 'dataSync',
        },
      });
    }

    return config;
  });
};
