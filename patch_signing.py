"""
Garante que o build.gradle tenha:
  1. O signing config de release correto
  2. O versionCode e versionName em sincronia com o app.json
Executado automaticamente pelo build.sh antes de cada build.
"""
import re
import json

GRADLE = '/Users/rafaelmariano/Desktop/CNBMobile/android/app/build.gradle'
APP_JSON = '/Users/rafaelmariano/Desktop/CNBMobile/app.json'

RELEASE_BLOCK = """        release {
            storeFile file('cnbmobile-upload.keystore')
            storePassword 'CNBMobile@2024'
            keyAlias 'cnbmobile'
            keyPassword 'CNBMobile@2024'
        }"""

with open(GRADLE, 'r') as f:
    content = f.read()

with open(APP_JSON, 'r') as f:
    app_config = json.load(f)

# ── 1. Sincronizar versionCode e versionName ──────────────────────────────────
version_code = app_config['expo']['android']['versionCode']
version_name = app_config['expo']['version']

content = re.sub(r'versionCode \d+', f'versionCode {version_code}', content)
content = re.sub(r'versionName "[^"]+"', f'versionName "{version_name}"', content)
print(f'✓ Versão: {version_name} (code {version_code})')

# ── 2. Garantir signing config de release ────────────────────────────────────
if 'cnbmobile-upload.keystore' not in content:
    content = re.sub(
        r'(signingConfigs \{.*?debug \{.*?\}\s*\})',
        lambda m: m.group(0)[:-1] + '\n' + RELEASE_BLOCK + '\n    }',
        content,
        flags=re.DOTALL
    )
    content = re.sub(
        r'(buildTypes\s*\{.*?release\s*\{.*?)signingConfig\s+signingConfigs\.debug',
        r'\1signingConfig signingConfigs.release',
        content,
        flags=re.DOTALL,
        count=1
    )
    print('✓ Signing config de release aplicado')
else:
    print('✓ Signing config de release já presente')

with open(GRADLE, 'w') as f:
    f.write(content)
