@echo off
REM Define a env var EXPO_PUBLIC_KORA_PUBKEY para builds EAS de produção.
REM Tenta o comando novo (env:create), depois cai no antigo (secret:create) se falhar.

eas env:create --scope project --environment production --name EXPO_PUBLIC_KORA_PUBKEY --value AdeLsGdARjffZ67AbjsoidtEEgxsXQUs4bJAUiRbpnQf --type string --visibility plaintext --non-interactive
