const { populateCombatData, populateCombatWindow, populateCombatControls } = require("../sessionTools.js")
const { getPlayerDBData } = require("../firebaseTools")

function loadPlayerData(players,loadedData,callback){
    if(players[0]){
        getPlayerDBData(players[0],function(player){
            loadedData.push(player)
            players.splice(0,1)
            loadPlayerData(players,loadedData,callback)
        })
    } else {
        callback(loadedData)
    }
}

module.exports = {
    config:{
        getSession:true
    },
    data:{
        name:"startLobby"
    },
    execute(interaction,componentConfig,callback){
        let session = componentConfig.session
        if(interaction.user.id == session.session_data.owner){
            switch(session.session_data.lobbyType){
                case "FFA":
                    loadPlayerData(session.session_data.players,[],function(fighters){
                        let newSession = {
                            type:"combat",
                            session_id: Math.floor(Math.random() * 100000),
                            user_ids:session.user_ids,
                            session_data:populateCombatData(fighters,{
                                fightType:"pvp",
                                lobby:session.session_id
                            })
                        }
                        interaction.update({
                            content:" ",
                            components:populateCombatControls(newSession),
                            embeds:populateCombatWindow(newSession)
                        })
                        callback({
                            updateSession:session,
                            addSession:newSession
                        })
                    })
                    break;
            }
        } else {
            interaction.reply({ content: "Only the lobby owner may start a lobby", ephemeral: true });
        }
        
    }
}