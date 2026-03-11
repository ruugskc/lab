#!/bin/bash
source $1

#remove docker containers on ctrl+c
trap ctrl_c INT
function ctrl_c() {
  echo "Removing Docker Container"
  sleep 1
  docker compose --env-file "$ENV_FILE" down
  exit 2
}

docker compose --env-file "$ENV_FILE" up -d
vid_timeout=135 # 원래 1100초였으나, 120초 언저리로 끝내고 싶어서 +15초한 값으로 설정(안정성)
# traces=($(ls netem/data/trace_files))
traces=("bicycle_0001.txt")

# 프록시 우회 자동화 코드 추가
echo "[+] Starting socat proxy on netem for WSL2 routing bypass..."
docker exec -d -u root netem socat TCP-LISTEN:3000,fork TCP:192.168.111.13:3000
echo "[+] Proxy is running. Client requests to 192.168.110.2 will be forwarded to 192.168.111.13"

# for video in 'ToS_default/playlist.mpd' 'ToS_pre/playlist.mpd' 'ToS_runtime/playlist.mpd'; do
for video in 'ToS_default/playlist.mpd'; do
  # for abr in 'abrDynamic' 'abrThroughput' 'abrBola' 'abrL2A' 'abrCustom'; do
  for abr in 'abrDynamic' 'abrCustom'; do
    for trace in "${traces[@]}"; do
      run_var=${trace:0:-4}"_"${video:0:-13}

      docker exec "$NETEM" /trace_kill.sh
      sleep 1

      echo "start network trace"
      docker exec "$NETEM" timeout $vid_timeout bash /trace_start.sh /netem/trace_files/$trace &
      sleep 1

      echo "start run"
      docker exec -e HOME=/tmp "$CLIENT" timeout $vid_timeout npm start '/browserTmpDir' "$run_var" $video "192.168.110.2" "$abr" >>logs/log_${video:0:-13}.txt 2>>logs/log_${video:0:-13}.txt
      sleep 5
    done
  done
done
