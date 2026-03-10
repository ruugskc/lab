const puppeteer = require('puppeteer-core');
const fs = require('fs');

// const user_data_dir = process.argv[2];
const run_var = process.argv[3];
const video = process.argv[4];
const consoleGivenHost = process.argv[5];
const abr = process.argv[6];
const url = 'http://' + consoleGivenHost + ':3000/?name=' + run_var + '&vid=' + video + '&abr=' + abr;
console.log("completeURI: " + url);
console.log("run var: " + run_var);
console.log("Played back video: " + video);
console.log("Streaming server: " + consoleGivenHost);
let progress = 0;
let time = -1;
let saved = false;


async function stop(browser) {
    process.stdout.write("exiting")
    await browser.close();
    process.exit();
}

async function start() {
    try {
        const browser = await puppeteer.launch({
            headless: 'new',
            executablePath: '/usr/bin/google-chrome',
            //userDataDir: user_data_dir,
            dumpio: true, // 크롬 뻗을 때 에러 메시지 확인할 때 필요하다캄
            // pipe: true, // 파이프 통신 꺼야한다는데? 제미나이피셜.
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                //'--single-process',
                '--disable-gpu',
                '--disable-software-rasterizer' // 혹시 모를 그래픽 렌더링 충돌 방지용 추가
            ]
        });
        const page = await browser.newPage();
        await page.setCacheEnabled(false);
        //await page.goto(url); // 수정 전
        // 수정할 코드: 타임아웃을 없애거나 무시하도록 설정
        try {
            // waitUntil 옵션을 'domcontentloaded'로 바꿔서, 
            // 스트리밍 다운로드가 다 안 끝나도 기본 HTML만 뜨면 성공으로 간주하게 만듭니다.
            // 타임아웃 시간도 0(무제한)으로 꺼버립니다.
            await page.goto(url, { 
                waitUntil: 'domcontentloaded',
                timeout: 0 
            });
        } catch (e) {
            console.log("Navigation timeout ignored:", e.message);
        }

        page.on('console', (msg) => console.log(msg.text()));

        function saveMetricLists(metrics) {
            let savedMetrics = 0;
            const logDir = __dirname + '/logs/' + abr + '/' + run_var;
            if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

            const qualityStream = fs.createWriteStream(logDir + '/' + 'quality.json', {flags: 'w'});
            const segmentStream = fs.createWriteStream(logDir + '/' + 'segment.json', {flags: 'w'});
            const playbackStream = fs.createWriteStream(logDir + '/' + 'playback.json', {flags: 'w'});
            const qualityChangeStream = fs.createWriteStream(logDir + '/' + 'qualityChange.json', {flags: 'w'});
            const bufferStatusStream = fs.createWriteStream(logDir + '/' + 'bufferStatus.json', {flags: 'w'});
            const abandonedStream = fs.createWriteStream(logDir + '/' + 'abandoned.json', {flags: 'w'});
            const playbackWaitingStream = fs.createWriteStream(logDir + '/' + 'playbackWaiting.json', {flags: 'w'});
            const eventsStream = fs.createWriteStream(logDir + '/' + 'events.json', {flags: 'w'});
            const playbackErrorStream = fs.createWriteStream(logDir + '/' + 'playbackError.json', {flags: 'w'});

            qualityStream.write(JSON.stringify(metrics.qualityLog));
            segmentStream.write(JSON.stringify(metrics.segmentLog));
            playbackStream.write(JSON.stringify(metrics.playbackLog));
            qualityChangeStream.write(JSON.stringify(metrics.qualityChangeLog));
            bufferStatusStream.write(JSON.stringify(metrics.bufferStatusLog));
            abandonedStream.write(JSON.stringify(metrics.abandonedLog));
            playbackWaitingStream.write(JSON.stringify(metrics.playbackWaitingLog));
            eventsStream.write(JSON.stringify(metrics.eventsLog));
            playbackErrorStream.write(JSON.stringify(metrics.playbackErrorLog));

            qualityStream.end(function () {
                if (savedMetrics >= 8) stop(browser);
                savedMetrics++;
            });
            segmentStream.end(function () {
                if (savedMetrics >= 8) stop(browser);
                savedMetrics++;
            });
            playbackStream.end(function () {
                if (savedMetrics >= 8) stop(browser);
                savedMetrics++;
            });
            qualityChangeStream.end(function () {
                if (savedMetrics >= 8) stop(browser);
                savedMetrics++;
            });
            bufferStatusStream.end(function () {
                if (savedMetrics >= 8) stop(browser);
                savedMetrics++;
            });
            abandonedStream.end(function () {
                if (savedMetrics >= 8) stop(browser);
                savedMetrics++;
            });
            playbackWaitingStream.end(function () {
                if (savedMetrics >= 8) stop(browser);
                savedMetrics++;
            });
            eventsStream.end(function () {
                if (savedMetrics >= 8) stop(browser);
                savedMetrics++;
            });
            playbackErrorStream.end(function () {
                if (savedMetrics >= 8) stop(browser);
                savedMetrics++;
            });
        }

        function getMetricLists() {
            try {
                let metricLogs = {
                    qualityLog: qualityLog,
                    segmentLog: segmentLog,
                    playbackLog: playbackLog,
                    qualityChangeLog: qualityChangeLog,
                    abandonedLog: abandonedLog,
                    bufferStatusLog: bufferStatusLog,
                    playbackWaitingLog: playbackWaitingLog,
                    eventsLog: eventsLog,
                    playbackErrorLog: playbackErrorLog
                };
                return Promise.resolve(JSON.stringify(metricLogs));
            } catch (error) {
                return Promise.reject(error);
            }
        }

        function getProgress() {
            try {
                let playbackTime = player.time();
                let videoLength = player.duration();
                let progress = Math.round((playbackTime / videoLength) * 100);
                return Promise.resolve(JSON.stringify(progress))
            } catch (e) {
                return Promise.reject(e);
            }
        }

        async function getMetricList() {
            page.evaluate(getMetricLists)
                .then((metric) => {
                    metric = JSON.parse(metric);
                    saveMetricLists(metric);
                })
                .catch((error) => {
                    process.stdout.write("ERROR - metrics could not be logged");
                    process.stdout.write(error);
                });
        }

        // Define a window.onPlaybackEnded function (it is executed here but available on the page)
        await page.exposeFunction('onPlaybackEnded', () => {
            console.log('Playback ended!');
            getMetricList();
        });
        // Listen for playbackEnded on the page
        await page.evaluate(() => {
            player.on('playbackEnded', window.onPlaybackEnded);
        });

        await page.exposeFunction('canPlay', () => {
            page.evaluate(() => {
                //player.play();
                //isPlaying = 1;
            });
            const videoProgress = setInterval(async () => {
                page.evaluate(getProgress)
                    .then((newProgress) => {
                        newProgress = JSON.parse(newProgress);
                        if (newProgress != progress) {
                            progress = newProgress;
                            // process.stdout.write(newProgress.toString() + "% ")
                        }
                        if (progress === 100 && time === -1) {
                            console.log('\nPlayback finished');
                            time = Date.now();
                        }
                        if (!saved && time > 0 && Date.now() - time > 20000) {
                            console.log('playbackEnded not thrown yet!');
                            saved = true;
                            getMetricList();
                        }
                    })
                    .catch((e) => {
                    })
            }, 100);
        });

        await page.evaluate(() => {
            player.on('canPlay', window.canPlay);
        });

    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

start();
