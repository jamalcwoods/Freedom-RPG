const { populateLobbyWindow, populateLobbyEdit } = require("../sessionTools.js")

module.exports = {
    config:{
        getSession:true,
        getClient:true
    },
    data:{
        name:"playerLobbyBan"
    },
    execute(interaction,componentConfig,callback){
        let session = componentConfig.session
        let client = componentConfig.client

        if(interaction.values[0] != interaction.users.id){
            session.user_ids.splice(session.user_ids.indexOf(interaction.values[0]),1)

            for(i in session.session_data.players){
                let player = session.session_data.players[i]    
                if(player.id == interaction.values[0]){
                    session.session_data.players.splice(i,1)
                }
            }

            session.session_data.bans.push(interaction.values[0])

            client.channels.fetch(session.session_data.c_id).then(channel => {
                channel.messages.fetch(session.session_data.m_id).then(message => {
                    message.edit(populateLobbyWindow(session))

                    interaction.update({
                        components: populateLobbyEdit(session)
                    })

                    callback({
                        updateSession:session
                    })
                })
            })
        } else {
            interaction.reply({ content: "You can not ban yourself from a lobby", ephemeral: true });
            callback({
                updateSession:session
            })
        }
    }
}