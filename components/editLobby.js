const { populateLobbyEdit } = require("../sessionTools.js")

module.exports = {
    config:{
        getSession:true
    },
    data:{
        name:"editLobby"
    },
    execute(interaction,componentConfig,callback){
        let session = componentConfig.session
        if(interaction.user.id == session.session_data.owner){
            interaction.reply({
                content: " ",
                components: populateLobbyEdit(session),
                ephemeral: true
            })
        } else {
            interaction.reply({ content: "Only the owner of a lobby (👑) may edit it", ephemeral: true });
        }
        
        callback({
            updateSession:session
        })
    }
}