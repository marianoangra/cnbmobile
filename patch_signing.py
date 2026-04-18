"""
Garante, antes de cada build Android:
  1. versionCode e versionName em sincronia com app.json
  2. android/keystore.properties gerado a partir de credentials.json
     (credentials.json é gitignored — senhas nunca ficam no repo)

O build.gradle lê as senhas de android/keystore.properties.
Executado automaticamente pelo build.sh.
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
GRADLE = os.path.join(ROOT, 'android', 'app', 'build.gradle')
APP_JSON = os.path.join(ROOT, 'app.json')
CREDS_JSON = os.path.join(ROOT, 'credentials.json')
KEYSTORE_PROPS = os.path.join(ROOT, 'android', 'keystore.properties')


def sync_version():
    with open(APP_JSON, 'r') as f:
        app_config = json.load(f)
    version_code = app_config['expo']['android']['versionCode']
    version_name = app_config['expo']['version']

    with open(GRADLE, 'r') as f:
        content = f.read()

    content = re.sub(r'versionCode \d+', f'versionCode {version_code}', content)
    content = re.sub(r'versionName "[^"]+"', f'versionName "{version_name}"', content)

    with open(GRADLE, 'w') as f:
        f.write(content)

    print(f'✓ Versão: {version_name} (code {version_code})')


def gerar_keystore_properties():
    if not os.path.exists(CREDS_JSON):
        print('⚠ credentials.json não encontrado — release build vai falhar')
        print('  (restaure o arquivo com as credenciais da upload keystore)')
        return
    with open(CREDS_JSON, 'r') as f:
        creds = json.load(f)
    try:
        ks = creds['android']['keystore']
    except (KeyError, TypeError):
        print('⚠ credentials.json sem bloco android.keystore — release build vai falhar')
        return

    # Normaliza o caminho relativo ao android/app/ (onde build.gradle resolve file())
    store_path = ks.get('keystorePath', 'android/app/cnbmobile-upload.keystore')
    store_file = store_path.replace('android/app/', '', 1)

    props = (
        f"CNBMOBILE_UPLOAD_STORE_FILE={store_file}\n"
        f"CNBMOBILE_UPLOAD_STORE_PASSWORD={ks['keystorePassword']}\n"
        f"CNBMOBILE_UPLOAD_KEY_ALIAS={ks['keyAlias']}\n"
        f"CNBMOBILE_UPLOAD_KEY_PASSWORD={ks['keyPassword']}\n"
    )
    os.makedirs(os.path.dirname(KEYSTORE_PROPS), exist_ok=True)
    with open(KEYSTORE_PROPS, 'w') as f:
        f.write(props)
    print(f'✓ keystore.properties gerado a partir de credentials.json')


if __name__ == '__main__':
    sync_version()
    gerar_keystore_properties()
