const { populateLobbyWindow, populateLobbyEdit } = require("../sessionTools.js")

module.exports = {
    config:{
        getSession:true,
        getClient:true
    },
    data:{
        name:"selectLobbyMode"
    },
    execute(interaction,componentConfig,callback){
        let session = componentConfig.session
        let client = componentConfig.client

        switch(interaction.values[0]){
            case '0':
                session.session_data.lobbyType = "FFA"
                break;

            case '1':
                session.session_data.lobbyType = "WILD"
                break;
        }

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
    }
}