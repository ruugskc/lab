import http from 'k6/http'
import  { check, sleep } from 'k6'

export const options = {
    scenarios: {
        my_heavy_test: {
            executor: 'constant-vus',
            vus: 30,
            duration: '1m'
        }
    },
};

export default function () {
    const BASE_URL = 'http://192.168.0.61/dash';
    const mpd = 'samsoon.mpd'
    
    // .mpd 파일 요청
    let mpdRes = http.get(`${BASE_URL}/${mpd}`);
    check(mpdRes, { 'mpd status 200' : (r) => r.status === 200 });

    // 세그먼트 시작번호 추출
    let startNumberMatch = mpdRes.body.match(/startNumber="(\d+)"/);
    if (!startNumberMatch) {
        console.error("Could not find startNumber in MPD");
        return;
    }
    let currentNum = parseInt(startNumberMatch[1]);
    
    for(let i = 0; i < 3; i++) {
        let formattedNum = (currentNum + i).toString().padStart(5, '0');
        let segRes = http.get(`${BASE_URL}/rep_0/chunk_${formattedNum}.m4s`);
        check(segRes, { 'segment of stream 0 success': (r) => r.status === 200 });

        sleep(2); // 세그먼트 길이(2초)만큼 대기하며 다음 조각 요청
    }
}