#!/bin/bash
set -e

echo "→ Parando daemons Gradle..."
pkill -f GradleDaemon 2>/dev/null || true

echo "→ Limpando cache de build..."
rm -rf /Users/rafaelmariano/Desktop/CNBMobile/android/app/.cxx
rm -rf /Users/rafaelmariano/Desktop/CNBMobile/android/app/build
rm -rf /Users/rafaelmariano/Desktop/CNBMobile/android/.gradle

echo "→ Recriando local.properties..."
echo "sdk.dir=/Users/rafaelmariano/Library/Android/sdk" > /Users/rafaelmariano/Desktop/CNBMobile/android/local.properties

echo "→ Copiando keystore de upload..."
cp /Users/rafaelmariano/Documents/cnbmobile-upload.keystore /Users/rafaelmariano/Desktop/CNBMobile/android/app/cnbmobile-upload.keystore

echo "→ Garantindo configuração de assinatura release..."
python3 /Users/rafaelmariano/Desktop/CNBMobile/patch_signing.py

echo "→ Iniciando build (pode levar 15-20 min)..."
export JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home
cd /Users/rafaelmariano/Desktop/CNBMobile/android
./gradlew bundleRelease --no-daemon

echo ""
echo "✅ AAB gerado em:"
echo "   android/app/build/outputs/bundle/release/app-release.aab"
