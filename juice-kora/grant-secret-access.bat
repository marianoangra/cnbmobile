@echo off
gcloud secrets add-iam-policy-binding kora-keypair --member=serviceAccount:144617374104-compute@developer.gserviceaccount.com --role=roles/secretmanager.secretAccessor
