#!/bin/bash
set -a  # automatically export all variables
source user-values.env
set +a

# Process all template files
for template in *.yaml.template; do
    envsubst < "$template" > "${template%.template}.local"
done

# Rename processed kustomize
mv kustomization.yaml.local kustomization.yaml
