#!/usr/bin/env bash

if [ "$1" = "supports" ]; then
    exit 0
fi

input=$(cat)

# Fallback: Wert aus book.toml [output.html] git-repository-url extrahieren
FALLBACK=$(echo "$input" | grep -o '"git-repository-url":"[^"]*"' | head -1 | sed 's/"git-repository-url":"//;s/"//')

GIT_REPOSITORY_URL="${GIT_REPOSITORY_URL:-${FALLBACK:-https://github.com/mapme-initiative/project_location_model}}"

# mdBook erwartet das komplette Array [context, book] zurück
echo "$input" | sed "s|{{git-repository-url}}|${GIT_REPOSITORY_URL}|g"
