#!/bin/bash

NAME=${1:-unknown}
LOG_FILE="/tmp/dash/ffmpeg_debug.log"

# 아래 이후 모든 표준 출력과 에러를 로그파일로 보냄
exec >> "$LOG_FILE" 2>&1

cd /tmp/dash

echo "인자로 전달받은 스트림 키: $NAME" >> $LOG_FILE
echo "=== 방송 시작 시도: $(date) ===" >> $LOG_FILE

# 스트림 가용성 체크 
echo "RTMP 스트림 확인 중..."
MAX_RETRIES=10
SUCCESS=false

for i in $(seq 1 $MAX_RETRIES)
do
      echo "[$i/$MAX_RETRIES] 접속 시도..."
      
      # ffprobe로 1초만 체크(타임아웃 1초)
      if /usr/bin/ffprobe -v error -rw_timeout 1000000 -i "rtmp://127.0.0.1/app/$NAME" ; then
            echo "=> 스트림 확인 완료!"
            SUCCESS=true
            break
      fi

      # 1초 체크했더니 실패한 경우 2초 대기
      sleep 2
done

# 체크 성공하면 실시간 스트림 트랜스코딩+세그멘테이션
/usr/bin/ffmpeg -loglevel info -i rtmp://127.0.0.1/app/$NAME \
    -filter_complex "[0:v]split=2[v1][v2tmp]; [v2tmp]scale=640:-2[v2]" \
    -map "[v1]" -c:v:0 libx264 -preset ultrafast -tune zerolatency -b:v:0 2500k -g 60 \
    -map "[v2]" -c:v:1 libx264 -preset ultrafast -tune zerolatency -b:v:1 800k -g 60 \
    -map 0:a -c:a aac -b:a 128k \
    -f dash \
      -seg_duration 2 -window_size 5 -extra_window_size 2 \
      -use_timeline 1 -use_template 1 \
      -init_seg_name 'rep_$RepresentationID$/init.m4s' \
      -media_seg_name 'rep_$RepresentationID$/chunk_$Number%05d$.m4s' \
      -adaptation_sets "id=0,streams=v id=1,streams=a" \
      -threads 4 \
    "$BASE_DIR/$NAME.mpd"