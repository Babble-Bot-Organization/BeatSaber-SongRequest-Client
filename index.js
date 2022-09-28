const fetch = require('node-fetch');
const fs = require(`fs`);
const fsextra = require('fs.extra');
const sanitize = require(`sanitize-filename`);
const http = require('https');

var WebSocket = require('faye-websocket');

var wss = new WebSocket.Client('wss://apps.chisdealhd.co.uk/appws/');

const {
    exec
} = require("child_process");
const extract = require('extract-zip');
const {
    resolve
} = require("path");
const config = require('./config.json');

const adb = `${config.adb_folder}\\adb.exe`;
var questConnected = false;
var questIpAddress = ``;

if (config.enable_automatic_upload_to_quest) {
    getIpAddress();
}

function getIpAddress() {
    console.log(`- Getting Quest IP Address...(make sure the Quest is connected via cable)`);
    exec(`${adb} shell ip addr show wlan0`, (error, stdout, stderr) => {
        if (error) {
            console.log(`- [IP]error: ${error.message}`);
            return;
        }
        if (stderr) {
            console.log(`- [IP]stderr: ${stderr}`);
            return;
        }
        const r = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/;
        const ipAddress = stdout.match(r);
        console.log(`- Quest IP Address: ${ipAddress}`);
        adbConnect(ipAddress);
    });
}

function adbConnect(ipAddress) {
    console.log(`- Connecting to Quest wirelessly...`)
    exec(`${adb} tcpip 5555 && ${adb} connect ${questIpAddress}:5555`, (error, stdout, stderr) => {
        if (error) {
            console.log(`- [CO]error: ${error.message}`);
            return;
        }
        if (stderr) {
            console.log(`- [CO]stderr: ${stderr}`);
            return;
        }
        console.log(`- [CO]output: ${stdout}`);
        if (stdout.includes('connected to')) {
            questConnected = true;
            questIpAddress = ipAddress;
            console.log(`- Quest connected wirelessly, now you can unplug the cable if you want`)
        }
    });
}

wss.on('open', function(message) {
    console.log('Connection established!');

    setInterval(function(){pingpong(wss);},29 * 1000);

    function pingpong(ws) {
        ws.send(`{"req": "ping"}`)
        console.log("Sending Ping Request?");
    }

});
  
wss.on('message', function(message) {
    

    var msg = JSON.parse(message.data);
    //console.log(msg)

    if (msg.req == "ping") return;

    if (msg.game == "beatsaber") {
        if (msg.userid == config.userid) {
            if (config.questdata.toggle == true) {
                fetchMapInfoQUEST(msg.bsr, msg.chatter, msg.userid, msg.platform);
            } else {
                fetchMapInfoPC(msg.bsr, msg.chatter, msg.userid, msg.platform);
            }
        }
    }
});
  
wss.on('close', function(message) {
    console.log('Connection closed!', message.code, message.reason);
    
    client = null;
});

if (config.questdata.toggle == true) {


    function fetchMapInfoQUEST(mapId, username, userid, platform) {
        const url = `https://api.beatsaver.com/maps/id/${mapId}`;

        console.log(`* Getting map info...`);
        fetch(url, {
                method: "GET",
                headers: {
                    'User-Agent': config.user_agent
                }
            })
            .then(res => res.json())
            .then(info => {
                const versions = info.versions[0]
                const downloadUrl = versions.downloadURL;
                const fileName = sanitize(`${info.id} ${username} ${info.metadata.levelAuthorName} (${info.name}).zip`);
                const message = `@${username} requested ${info.metadata.songAuthorName} - ${info.name} by ${info.metadata.levelAuthorName} (${info.id}). Successfully added to the queue.`;
                downloadQUEST(downloadUrl, fileName, versions.hash, message, userid, platform);
            })
            .catch(err => console.log(err));
    }

    async function downloadQUEST(url, fileName, hash, message, userid, platform) {
        await new Promise((resolve, reject) => {
            console.log(`* Downloading map...`);
            const mapsFolder = `maps`;
            if (!fs.existsSync(mapsFolder)) {
                fs.mkdirSync(mapsFolder);
            }
            const filePath = `${mapsFolder}/${fileName}`;
            const fileStream = fs.createWriteStream(filePath);
            http.get(`${url}`, function(response) {
                response.pipe(fileStream);
            });
            fileStream.on("finish", function() {
                console.log(`* Downloaded "${fileName}"`);
                wss.send(`{"game": "beatsaber", "userid": "${userid}", "message": "${message}", "platform": "${platform}"}`);
                if (questConnected) {
                    extractZipQUEST(hash, filePath);
                }
                resolve();
            });
        });
    }

    async function extractZipQUEST(hash, source) {
        try {
            await extract(source, {
                dir: resolve(`tmp/${hash}`)
            });
            pushMapToQuest(hash);
        } catch (err) {
            console.log("* Oops: extractZip failed", err);
        }
    }

    function pushMapToQuest(hash) {
        console.log(`- Uploading to Quest...`)
        exec(`${adb} -s ${questIpAddress}:5555 push tmp\\${hash} /sdcard/ModData/com.beatgames.beatsaber/Mods/SongLoader/CustomLevels/${hash}`, (error, stdout, stderr) => {
            if (error) {
                console.log(`- [PU]error: ${error.message}`);
                return;
            }
            if (stderr) {
                console.log(`- [PU]stderr: ${stderr}`);
                return;
            }
            // console.log(`- [PU]output: ${stdout}`);
            console.log(`- Map uploaded to Quest`);
            fs.rmdir(`tmp/${hash}`, {
                recursive: true
            }, (err) => {
                if (err) {
                    console.log(`- [EX]error: ${err.message}`);
                }
            });
        });
    }
} else {


    function fetchMapInfoPC(mapId, username, userid, platform) {
        const url = `https://api.beatsaver.com/maps/id/${mapId}`;

        console.log(`* Getting map info...`);
        fetch(url, {
                method: "GET",
                headers: {
                    'User-Agent': config.user_agent
                }
            })
            .then(res => res.json())
            .then(info => {
                const versions = info.versions[0]
                const downloadUrl = versions.downloadURL;
                const fileName = sanitize(`${info.id} ${username} ${info.metadata.levelAuthorName} (${info.name}).zip`);
                const message = `@${username} requested ${info.metadata.songAuthorName} - ${info.name} by ${info.metadata.levelAuthorName} (${info.id}). Successfully added to the queue.`;
                downloadPC(downloadUrl, fileName, versions.hash, message, userid, platform);
            })
            .catch(err => console.log(err));
    }

    async function downloadPC(url, fileName, hash, message, userid, platform) {
        await new Promise((resolve, reject) => {
            console.log(`* Downloading map...`);
            const mapsFolder = `maps`;
            if (!fs.existsSync(mapsFolder)) {
                fs.mkdirSync(mapsFolder);
            }
            const filePath = `${mapsFolder}/${fileName}`;
            const fileStream = fs.createWriteStream(filePath);
            http.get(`${url}`, function(response) {
                response.pipe(fileStream);
            });
            fileStream.on("finish", function() {
                console.log(`* Downloaded "${fileName}"`);
                wss.send(`{"game": "beatsaber", "userid": "${userid}", "message": "${message}", "platform": "${platform}"}`);
                extractZipPC(hash, filePath);
                resolve();
            });
        });
    }

    async function extractZipPC(hash, source) {
        try {
            console.log(`- Uploading to STEAM...`)
            await extract(source, {
                dir: resolve(`${config.pc_beatsaberpath}/Beat Saber_Data/CustomLevels/${hash}`)
            });
            console.log(`- Map uploaded to STEAM`);
        } catch (err) {
            console.log("* Oops: extractZip failed", err);
        }
    }

}
