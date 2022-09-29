// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process. 

var fs = require('fs');

var path = require('path');

var { exec } = require('child_process');

var remoteApp = require('electron').remote.app;

var { shell } = require('electron');

var ipcRenderer = require('electron').ipcRenderer;

var settings = require('electron-settings');

var axios = require('axios');

var toastr = require('toastr');

var moment = require('moment');

var numeral = require('numeral');
var DecompressZip = require('decompress-zip');

var $ = require('jquery');

var popper = require('popper.js');

const fetch = require('node-fetch');
const fsextra = require('fs.extra');
const sanitize = require(`sanitize-filename`);
const http = require('https');

var WebSocket = require('faye-websocket');

const adb = `%appdata%\\SideQuest\\platform-tools\\adb.exe`;

require('bootstrap');

toastr.options = {
    'closeButton': false,
    'debug': false,
    'newestOnTop': false,
    'progressBar': true,
    'positionClass': 'toast-bottom-full-width',
    'preventDuplicates': false,
    'onclick': null,
    'showDuration': '300',
    'hideDuration': '1000',
    'timeOut': '3000',
    'extendedTimeOut': '1000',
    'showEasing': 'swing',
    'hideEasing': 'linear',
    'showMethod': 'fadeIn',
    'hideMethod': 'fadeOut'
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED='0'

// prevent ENTER to submit our forms
window.addEventListener('keydown', function(e) {
    if (e.keyCode === 13) {
        e.preventDefault();
    }
});


var app = new Vue({


    el: '#app',

    data: {
        url: 'https://api.chisdealhd.co.uk',
        activeTab: 'bsr',
        log: [],
        running: null,
        formSettings: {
            userId: settings.get('user_id', null),
            questtoggle: settings.get('questtoggle', false),
            questConnected: false,
            questIpAddress: ``,
            enable_automatic_upload_to_quest: settings.get('enable_automatic_upload_to_quest', false),
            pc_beatsaberpath: settings.get('pc_beatsaberpath', null),
            user_agent: `BeatSaber-Client-Quest-PC/${remoteApp.getVersion()} (+https://github.com/ChisdealHDYT/BeatSaber-BOT-Quest-PC)`
        },
        version: remoteApp.getVersion(),
        update: null,
    },

    mounted: function() {

        this.logMessage('Log started.');

        this.checkForUpdates();

    },

    methods: {

        saveSettings: function() {
            settings.set('user_id', this.formSettings.userId);
            settings.set('enable_automatic_upload_to_quest', this.formSettings.enable_automatic_upload_to_quest)
            settings.set('questtoggle', this.formSettings.questtoggle),
            settings.set('pc_beatsaberpath', this.formSettings.pc_beatsaberpath),
            toastr.remove();
            toastr.success('Successfully saved settings.');
        },

        adbConnect: function(ipAddress) {
            var self = this;
            self.logMessage(`- Connecting to Quest wirelessly...`)
            exec(`${adb} tcpip 5555 && ${adb} connect ${questIpAddress}:5555`, (error, stdout, stderr) => {
                if (error) {
                    self.logMessage(`- [CO]error: ${error.message}`);
                    return;
                }
                if (stderr) {
                    self.logMessage(`- [CO]stderr: ${stderr}`);
                    return;
                }
                self.logMessage(`- [CO]output: ${stdout}`);
                if (stdout.includes('connected to')) {
                    self.formSettings.questConnected = true;
                    self.formSettings.questIpAddress = ipAddress;
                    self.logMessage(`- Quest connected wirelessly, now you can unplug the cable if you want`)
                }
            });
        },

        getIpAddress: function() {
            var self = this
            self.logMessage(`- Getting Quest IP Address...(make sure the Quest is connected via cable)`);
            exec(`${adb} shell ip addr show wlan0`, (error, stdout, stderr) => {
                if (error) {
                    self.logMessage(`- [IP]error: ${error.message}`);
                    return;
                }
                if (stderr) {
                    self.logMessage(`- [IP]stderr: ${stderr}`);
                    return;
                }
                const r = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/;
                const ipAddress = stdout.match(r);
                self.logMessage(`- Quest IP Address: ${ipAddress}`);
                this.adbConnect(ipAddress);
            });
        },

        fetchMapInfoQUEST: function(mapId, username, userid, platform, wss) {
            var self = this
            const url = `https://api.beatsaver.com/maps/id/${mapId}`;

            self.logMessage(`* Getting map info...`);
            fetch(url, {
                method: "GET",
                headers: {
                    'User-Agent': this.formSettings.user_agent
                }
            })
            .then(res => res.json())
            .then(info => {
                const versions = info.versions[0]
                const downloadUrl = versions.downloadURL;
                const fileName = sanitize(`${info.id} ${username} ${info.metadata.levelAuthorName} (${info.name}).zip`);
                const message = `@${username} requested ${info.metadata.songAuthorName} - ${info.name} by ${info.metadata.levelAuthorName} (${info.id}). Successfully added to the queue.`;
                this.downloadQUEST(downloadUrl, fileName, versions.hash, message, userid, platform, wss);
            })
            .catch(err => self.logMessage(err));
        },

        downloadQUEST: async function(url, fileName, hash, message, userid, platform, wss) {
            var self = this
            await new Promise((resolve, reject) => {
                self.logMessage(`* Downloading map...`);
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
                    self.logMessage(`* Downloaded "${fileName}"`);
                    wss.send(`{"game": "beatsaber", "userid": "${userid}", "message": "${message}", "platform": "${platform}"}`);
                    if (questConnected) {
                        self.extractZipQUEST(hash, filePath);
                    }
                    resolve();
                });
            });
        },

        extractZipQUEST: async function(hash, source) {
            var self = this
            var unzipper = new DecompressZip(source);
            try {
                // Add the error event listener
                unzipper.on('error', function (err) {
                    self.logMessage('Caught an error', err);
                });

                // Notify when everything is extracted
                unzipper.on('extract', function (log) {
                    self.logMessage('Finished extracting', log);
                });

                // Notify "progress" of the decompressed files
                unzipper.on('progress', function (fileIndex, fileCount) {
                    self.logMessage('Extracted file ' + (fileIndex + 1) + ' of ' + fileCount);
                });

                // Start extraction of the content
                unzipper.extract({
                    path: path.resolve(`tmp/${hash}`)
                    // You can filter the files that you want to unpack using the filter option
                    //filter: function (file) {
                        //self.logMessage(file);
                        //return file.type !== "SymbolicLink";
                    //}
                });
                this.pushMapToQuest(hash);
            } catch (err) {
                self.logMessage("* Oops: extractZip failed", err);
            }
        },

        pushMapToQuest: function(hash) {
            var self = this
            self.logMessage(`- Uploading to Quest...`)
            exec(`${adb} -s ${this.formSettings.questIpAddress}:5555 push tmp\\${hash} /sdcard/ModData/com.beatgames.beatsaber/Mods/SongLoader/CustomLevels/${hash}`, (error, stdout, stderr) => {
                if (error) {
                    self.logMessage(`- [PU]error: ${error.message}`);
                    return;
                }
                if (stderr) {
                    self.logMessage(`- [PU]stderr: ${stderr}`);
                    return;
                }
                // self.logMessage(`- [PU]output: ${stdout}`);
                self.logMessage(`- Map uploaded to Quest`);
                fs.rmdir(`tmp/${hash}`, {
                    recursive: true
                }, (err) => {
                    if (err) {
                        self.logMessage(`- [EX]error: ${err.message}`);
                    }
                });
            });
        },

        fetchMapInfoPC: function(mapId, username, userid, platform, wss) {
            var self = this
            const url = `https://api.beatsaver.com/maps/id/${mapId}`;

            self.logMessage(`* Getting map info...`);
            fetch(url, {
                method: "GET",
                headers: {
                    'User-Agent': this.formSettings.user_agent
                }
            })
            .then(res => res.json())
            .then(info => {
                const versions = info.versions[0]
                const downloadUrl = versions.downloadURL;
                const fileName = sanitize(`${info.id} ${username} ${info.metadata.levelAuthorName} (${info.name}).zip`);
                const message = `@${username} requested ${info.metadata.songAuthorName} - ${info.name} by ${info.metadata.levelAuthorName} (${info.id}). Successfully added to the queue.`;
                this.downloadPC(downloadUrl, fileName, versions.hash, message, userid, platform, wss);
            })
            .catch(err => self.logMessage(err));
        },

        downloadPC: async function(url, fileName, hash, message, userid, platform, wss) {
            var self = this
            await new Promise((resolve, reject) => {
                self.logMessage(`* Downloading map...`);
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
                    self.logMessage(`* Downloaded "${fileName}"`);
                    wss.send(`{"game": "beatsaber", "userid": "${userid}", "message": "${message}", "platform": "${platform}"}`);
                    self.extractZipPC(hash, filePath);
                    resolve();
                });
            });
        },

        extractZipPC: async function(hash, source) {
            var self = this
            var unzipper = new DecompressZip(source);
            try {
                self.logMessage(`- Uploading to STEAM...`)
                unzipper.on('error', function (err) {
                    self.logMessage('Caught an error', err);
                });

                // Notify when everything is extracted
                unzipper.on('extract', function (log) {
                    self.logMessage('Finished extracting', log);
                });

                // Notify "progress" of the decompressed files
                unzipper.on('progress', function (fileIndex, fileCount) {
                    self.logMessage('Extracted file ' + (fileIndex + 1) + ' of ' + fileCount);
                });

                // Start extraction of the content
                unzipper.extract({
                    path: path.resolve(`${self.formSettings.pc_beatsaberpath}/Beat Saber_Data/CustomLevels/${hash}`)
                    // You can filter the files that you want to unpack using the filter option
                    //filter: function (file) {
                        //self.logMessage(file);
                        //return file.type !== "SymbolicLink";
                    //}
                });
                self.logMessage(`- Map uploaded to STEAM`);
            } catch (err) {
                self.logMessage("* Oops: extractZip failed", err);
            }
        },
        start: function() {

            this.logMessage('BeatSaber Client started.');

            this.running = true;

            var userId = this.formSettings.userId;

            var questtoggle = this.formSettings.questtoggle;

            var self = this

            if (this.formSettings.enable_automatic_upload_to_quest) {
                this.getIpAddress();
            }

            var wss = new WebSocket.Client('wss://apps.chisdealhd.co.uk/appws/');

            wss.on('open', function(message) {
                self.logMessage('Connection established!');
            
                setInterval(function(){pingpong(wss);},29 * 1000);
            
                function pingpong(ws) {
                    if (self.running == false) {
                        ws.close();
                        self.running = null;
                    } else {
                        ws.send(`{"req": "ping"}`)
                        console.log("Sending Ping Request?");
                    }
                }
            
            });
              
            wss.on('message', function(message) {

                var msg = JSON.parse(message.data);
                //self.logMessage(msg)
            
                if (msg.req == "ping") return;
            
                if (msg.game == "beatsaber") {
                    if (msg.userid == userId) {
                        if (questtoggle == true) {
                            self.fetchMapInfoQUEST(msg.bsr, msg.chatter, msg.userid, msg.platform, wss);
                        } else {
                            self.fetchMapInfoPC(msg.bsr, msg.chatter, msg.userid, msg.platform, wss);
                        }
                    }
                }
            });
              
            wss.on('close', function(message) {
                self.logMessage('Connection closed!', message.code, message.reason);
            });
        },

        stop: function() {
            this.logMessage('BeatSaber Client stopped.');
            this.running = false;
        },

        scrollToLogBottom: function() {
            setTimeout(function() {
                var box = this.$el.querySelector("#logs-box");
                //box.scrollTop = box.scrollHeight;
            }.bind(this), 100);
        },

        changeActiveTab: function(name) {
            this.activeTab = name;
        },

        logMessage: function(message) {
            // sometimes the miner logs 2 messages at once,
            // we need to split them by the date prefix each message has
            var regex = /\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\] : /;
            var messages = message.toString().split(regex);
            messages.forEach(function(msg) {
                if (msg !== '') {
                    var obj = {
                        date: '[' + moment().format('YYYY-MM-DD HH:mm:ss') + ']',
                        message: msg,
                    };
                    this.log.push(obj);
                    console.log(`${obj.date} ${obj.message}`);
                    if (this.log.length > 1000) {
                        this.log.shift();
                    }
                }
            }.bind(this));
        },

        openExternal: function(url) {
            shell.openExternal(url);
        },

        checkForUpdates: function() {
            var self = this;
            axios({
                    method: 'GET',
                    url: this.urls.api.CheckForUpdates+self.version,
                })
                .then(function(response) {
                    self.update = response.data.result;
                })
                .catch(function(error) {
                    console.log(error);
                });
        },

        formatInteger: function(value) {
            return numeral(value).format('0,0');
        },

        formatFloat: function(value) {
            return numeral(value).format('0,0.00');
        },

        isRunning: function() {
            return this.running !== null;
        },

        toggle: function() {
            if (!this.isRunning()) {
                this.start();

            } else {
                this.stop();
            }
        },

    },

    computed: {

        toggleText: function() {
            if (!this.isRunning()) {
                return 'Start';
            } else {
                return 'Stop';
            }
        },

        toggleClass: function() {
            return {
                'btn-primary': !this.isRunning(),
                'btn-danger': this.isRunning(),
            };
        },

        urls: function() {
			var self = this;
            return {
                api: {
                    CheckForUpdates: `${this.url}/v2/beatsaberclient/CheckForUpdates/`,
                },
                web: {
                    EarnMining: `https://github.com/Babble-Bot-Organization/BeatSaber-SongRequest-Client/releases/`+self.version,
                    PanelAccountDetails: `${this.url}/panel/account/details`,
                },
            };
        },

    },

    watch: {

        log: function(newVal, oldVal) {
            this.scrollToLogBottom();
        },

        activeTab: function(newVal, oldVal) {
            if (newVal === 'logs') {
                this.scrollToLogBottom();
            }
        },

        update: function(newVal, oldVal) {
            if (newVal.update_available && newVal.backward_compatible) {
                setTimeout(function() {
                    $('#updateModal').modal();
                }, 1000);
            }
        },

    }

});

//rpc.login(ClientId).catch(console.error);
