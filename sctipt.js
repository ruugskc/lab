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
    // 해당 ID 블록에서 <S> 태그가 포함된 문자열 추출
    const blockRegex = new RegExp(
        `<Representation id="${repId}"[\\s\\S]*?<SegmentTemplate[\\s\\S]*?.m4s ([\\s\\S]*?)<\\/SegmentTimeline>`);
    
    /* 위의 정규식 blockRegex는 .mpd의 해당 부분을 추출한다는 뜻

        <Representation id=...> <SegmentTemplate... 이후의
            
            startNumber="숫자">
                <SetmentTimeline>
                    이 안에 있는 1개 이상의 <S> 태그들..
                </SetmentTimeline> 
            까지.
        match() 결과의 [1]번 원소, 즉
        아래 timeline에는 해당 부분이 문자열로 저장됨
    */

    const blockMatch = mpdBody.match(blockRegex);
    if (!blockMatch) return null;

    const mpdRes = blockMatch[1];

    // 모든 <S> 태그를 배열로 가져옴(g 플래그의 의미)
    const sTags = mpdRes.match(/<S [\s\S]*?\/>/g);
    let totalSegments = 0;

    if(sTags) {
        // 각 <S>태그 안에 "r=숫자" 있는지 확인 후 덧셈
        sTags.forEach(tag => {
            const rMatch = tag.match(/r="(\d+)"/);
            if(rMatch) {
                totalSegments += (parseInt(rMatch[1]) + 1);
            } else {
                totalSegments += 1;
            }
        });
    }

    // startNumber 추출
    const startMatch = mpdRes.match(/startNumber="(\d+)"/);
    const startNum = startMatch ? parseInt(startMatch[1]) : 0;

    return startNum + totalSegments - 1; // 마지막 세그먼트 번호
}

export default function () {
    // .mpd 파일 요청(주기적으로 호출해야 함)
    mpdRes = http.get(`${BASE_URL}/samsoon.mpd`);
    
    // 비디오와 오디오의 라이브 엣지(가장 최신 지점)
    const vNum = getLatestNum(mpdRes.body, VIDEO_REP_ID);
    const aNum = getLatestNum(mpdRes.body, AUDIO_REP_ID);

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

