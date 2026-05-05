@echo off
REM Deploy só das duas funções do Kora (paymaster + monitor).
cd /d %~dp0..
firebase deploy --only functions:assinarTxKora,functions:monitorarKoraSaldo
