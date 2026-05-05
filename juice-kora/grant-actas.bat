@echo off
gcloud iam service-accounts add-iam-policy-binding 144617374104-compute@developer.gserviceaccount.com --member=serviceAccount:144617374104-compute@developer.gserviceaccount.com --role=roles/iam.serviceAccountUser
