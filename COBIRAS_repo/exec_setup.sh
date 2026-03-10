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
vid_timeout=1100
traces=($(ls netem/data/trace_files))

for video in 'ToS_default/playlist.mpd' 'ToS_pre/playlist.mpd' 'ToS_runtime/playlist.mpd'; do
  for abr in 'abrDynamic' 'abrThroughput' 'abrBola' 'abrL2A' 'abrCustom'; do
    for trace in "${traces[@]}"; do
      run_var=${trace:0:-4}"_"${video:0:-13}

      docker exec "$NETEM" /trace_kill.sh
      sleep 1

      echo "start network trace"
      docker exec "$NETEM" timeout $vid_timeout bash /trace_start.sh /netem/trace_files/$trace &
      sleep 1

      echo "start run"
      docker exec -e HOME=/tmp "$CLIENT" timeout $vid_timeout npm start '/browserTmpDir' "$run_var" $video "$SERVER_IP" "$abr" >>logs/log_${video:0:-13}.txt 2>>logs/log_${video:0:-13}.txt
      sleep 5
    done
  done
done
