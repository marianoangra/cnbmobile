@echo off
REM Apaga o Cloud Run service que não vamos usar (a função paymaster vive como Cloud Function agora).
REM A imagem e o secret kora-keypair continuam — o secret é compartilhado com a Cloud Function.
gcloud run services delete juice-kora --region=us-central1 --quiet
