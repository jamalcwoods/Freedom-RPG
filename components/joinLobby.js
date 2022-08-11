const { populateLobbyWindow, populateLobbyControls } = require("../sessionTools.js")

module.exports = {
    config:{
        addToSession:true
    },
    data:{
        name:"joinLobby"
    },
    execute(interaction,componentConfig,callback){
        let session = componentConfig.session
        let playerData = componentConfig.playerData

        if(!session.session_data.bans.includes(interaction.user.id)){
            session.user_ids.push(playerData.id)
            session.session_data.players.push({
                name:playerData.name,
                id:playerData.id
            })

            interaction.update({
                content: populateLobbyWindow(session),
                components: populateLobbyControls(session)
            })

        } else {
            interaction.reply({ content: "You have been banned from entering this lobby", ephemeral: true });
        }
        callback({
            updateSession:session
        })
    }
}