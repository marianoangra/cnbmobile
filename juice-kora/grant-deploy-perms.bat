@echo off
set SA=144617374104-compute@developer.gserviceaccount.com
set PROJECT=cnbmobile-2053c

echo Granting run.admin...
gcloud projects add-iam-policy-binding %PROJECT% --member=serviceAccount:%SA% --role=roles/run.admin

echo Granting iam.serviceAccountUser...
gcloud projects add-iam-policy-binding %PROJECT% --member=serviceAccount:%SA% --role=roles/iam.serviceAccountUser

echo Done.
