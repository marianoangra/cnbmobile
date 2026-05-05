@echo off
gcloud run services add-iam-policy-binding juice-kora --region=us-central1 --member=allUsers --role=roles/run.invoker
