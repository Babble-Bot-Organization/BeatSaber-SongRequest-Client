# BeatSaber-SongRequest-Client
Client Based of BeatSaber to Receive `!bsr` and Download Music and Store it (Supports PC/Quest)

NEED CONTACT DEVMARVEL FOR GAMETOKEN SINCE NOT SETUP ON DASHBOARD

Need Nodejs Installed and Download this files

Edit config.json file and add your `userid` as `GAMETOKEN`

# If using STEAM

Make sure Set your Beat Saber Path in `pc_beatsaberpath` in `config.json`

# If using Quest 1/2

You need Install [SIDEQUEST](https://sidequestvr.com) and have `enable_automatic_upload_to_quest` on `true` and `toggle` on `true` in `config.json`

Command do it is `!bsr 1b898` You find that data from 1b898 in `https://bsaber.com/songs/1b898/`

Make sure SideQuest not Started / Loaded because using `platform-tools` in that file Path

If you are using PC version of Beat Saber, it's recommended to use "Song Request Manager" mod that can be installed via [ModAssistant](https://github.com/Assistant/ModAssistant), it's better and easier to set up.

and ModAssistant can Reload Songs in UI Options called `"Reload Playlists"`

For Quest `"Beat Saber -> Settings -> Mod Settings -> SongLoader -> Reload New Song"`

After that do `node index.js` then leave it running and use `BABBLEBOT` on Twitch/Trovo/Vimm/Theta