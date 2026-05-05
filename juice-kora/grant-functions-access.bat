@echo off
REM Concede acesso ao secret kora-keypair para as duas SAs do Firebase Functions.

REM 1. Default compute SA (usada por Functions v2)
gcloud secrets add-iam-policy-binding kora-keypair --member=serviceAccount:144617374104-compute@developer.gserviceaccount.com --role=roles/secretmanager.secretAccessor

REM 2. App Engine default SA (usada por Functions v1, mantém por compat)
gcloud secrets add-iam-policy-binding kora-keypair --member=serviceAccount:cnbmobile-2053c@appspot.gserviceaccount.com --role=roles/secretmanager.secretAccessor
