#!/usr/bin/env bash

if [[ ! "$(curl -s http://localhost:3000/graphql)" =~ .*Only.*POST.*requests.* ]]; then
  echo Need to start the project "(cd ../../; yarn start)" to run artillery tests
  exit 1
fi

exec artillery run user_update.config
