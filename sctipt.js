import http from 'k6/http'
import  { check, sleep } from 'k6'

export const options = {
        vus: 100,
        duration: '3m'
};

const BASE_URL = 'http://192.168.0.61/dash';
const VIDEO_REP_ID = '0';
const AUDIO_REP_ID = '2';
const SEGMENTS_PER_MPD = 5; // 한 번의 MPD 요청으로 가져올 세그먼트 개수 설정

// 5자리 숫자로 만들기(0으로 빈공간 패딩)
function pad(num, size) {
    let s = num + "";
    while(s.length < size) s = "0" + s;
    return s;
}

// 특정 Representation ID의 라이브 엣지 번호 반환
function getLatestNum(mpdBody, repId) {
    // 1. 해당 ID 블록 추출
    const blockRegex = new RegExp(`id="${repId}"[\\s\\S]*?<SegmentTemplate[\\s\\S]*?>([\\s\\S]*?)<\\/SegmentTemplate>`);
    const blockMatch = mpdBody.match(blockRegex);
    if (!blockMatch) return null;

    const block = blockMatch[0];
    const timeline = blockMatch[1];

    // 2. startNumber 추출
    const startMatch = block.match(/startNumber="(\d+)"/);
    const startNum = startMatch ? parseInt(startMatch[1]) : 0;

    // 3. SegmentTimeline 내 모든 r값의 합 계산 (또는 마지막 r값 기준)
    // 오디오처럼 <S>가 여러 개인 경우 모든 r+1을 더해야 정확하지만, 
    // 단순 부하 테스트용이라면 마지막 r값만 참조해도 라이브 엣지 근처에 도달합니다.
    const rMatches = timeline.match(/r="(\d+)"/g);
    let totalR = 0;
    if (rMatches) {
        // 모든 r="n" 에서 숫자만 뽑아 더함
        rMatches.forEach(m => {
            totalR += (parseInt(m.match(/\d+/)[0]) + 1);
        });
    }

    return startNum + totalR - 1; // 마지막 세그먼트 번호
}

export default function () {
    // .mpd 파일 요청(주기적으로 호출해야 함)
    http.get(`${BASE_URL}/samsoon.mpd`);
    
    // 비디오와 오디오의 라이브 엣지(가장 최신 지점)
    const vNum = getLatestNum(mpdRes, VIDEO_REP_ID);
    const aNum = getLatestNum(mpdRes, AUDIO_REP_ID);

    if (vNum && aNum) {
        // 비디오와 오디오 동시에 요청
        for(let i = 0; i < SEGMENTS_PER_MPD; i++) {
            // 각각 계산된 번호로 URL 생성
            const vUrl = `${BASE_URL}/rep_${VIDEO_ID}/chunk_${pad(vNum + i)}.m4s`;
            const aUrl = `${BASE_URL}/rep_${AUDIO_ID}/chunk_${pad(aNum + i)}.m4s`;
            const responses = http.batch([
                ['GET', vUrl, { tags: { name: 'video' } }],
                ['GET', aUrl, { tags: { name: 'audio' } }]
            ]);

            check(responses[0], { '비디오 OK': (r) => r.status === 200 });
            check(responses[1], { '오디오 OK': (r) => r.status === 200 });

            sleep(2); // 세그먼트 길이(2초)만큼 대기하며 다음 조각 요청
        }
    }
}

