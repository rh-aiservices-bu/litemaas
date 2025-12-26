#!/bin/bash
set -a  # automatically export all variables
source user-values.env
set +a

# Conditionally set NODE_TLS_ENV_BLOCK if NODE_TLS_REJECT_UNAUTHORIZED is "0"
if [ "${NODE_TLS_REJECT_UNAUTHORIZED}" = "0" ]; then
    export NODE_TLS_ENV_BLOCK="- name: NODE_TLS_REJECT_UNAUTHORIZED
              value: '0'"
else
    export NODE_TLS_ENV_BLOCK=""
fi

# Process all template files
for template in *.yaml.template; do
    envsubst < "$template" > "${template%.template}.local"
done

# Rename processed kustomize
mv kustomization.yaml.local kustomization.yaml
