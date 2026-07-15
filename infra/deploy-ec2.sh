#!/usr/bin/env bash

set -euo pipefail

readonly applicationContainer='blog-next'
readonly applicationNetwork='blog-network'
readonly healthEndpoint='http://127.0.0.1:3000/api/health'
readonly healthCheckAttempts=30
readonly healthCheckIntervalSeconds=2

if [[ $# -ne 2 ]]; then
  echo '사용법: deploy-ec2.sh <image-uri> <aws-region>' >&2
  exit 2
fi

readonly imageUri="$1"
readonly awsRegion="$2"
readonly ecrRegistry="${imageUri%%/*}"

containerExists() {
  docker container inspect "$applicationContainer" >/dev/null 2>&1
}

startApplicationContainer() {
  local targetImage="$1"

  docker run --detach \
    --name "$applicationContainer" \
    --restart unless-stopped \
    --network "$applicationNetwork" \
    --publish 127.0.0.1:3000:3000 \
    "$targetImage" >/dev/null
}

removeApplicationContainer() {
  if ! containerExists; then
    return
  fi

  docker stop "$applicationContainer" >/dev/null || true
  docker rm "$applicationContainer" >/dev/null || true
}

waitForHealthyApplication() {
  local attempt

  for attempt in $(seq 1 "$healthCheckAttempts"); do
    if curl --fail --silent --show-error "$healthEndpoint" >/dev/null; then
      return 0
    fi
    sleep "$healthCheckIntervalSeconds"
  done

  return 1
}

restorePreviousContainer() {
  local previousImage="$1"

  if [[ -z "$previousImage" ]]; then
    return 1
  fi

  removeApplicationContainer
  startApplicationContainer "$previousImage"
  waitForHealthyApplication
}

aws ecr get-login-password --region "$awsRegion" | docker login --username AWS --password-stdin "$ecrRegistry"
docker pull "$imageUri"
docker network inspect "$applicationNetwork" >/dev/null 2>&1 || docker network create "$applicationNetwork"

previousImage=''
if containerExists; then
  previousImage="$(docker inspect --format '{{.Config.Image}}' "$applicationContainer")"
fi

removeApplicationContainer
startApplicationContainer "$imageUri"

if waitForHealthyApplication; then
  docker image prune --force >/dev/null
  echo "배포 성공: $imageUri"
  exit 0
fi

docker logs "$applicationContainer" || true

# 단일 인스턴스에서도 실패한 새 이미지 대신 직전 정상 이미지를 다시 실행한다.
if restorePreviousContainer "$previousImage"; then
  echo "새 이미지 상태 검사 실패로 이전 이미지 복구: $previousImage" >&2
else
  removeApplicationContainer
  echo '새 이미지 상태 검사에 실패했고 복구할 이전 이미지가 없습니다.' >&2
fi

exit 1

