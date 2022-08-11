// const { SlashCommandBuilder } = require('@discordjs/builders');
// const { MessageActionRow, MessageSelectMenu, MessageButton } = require('discord.js');

const { populateTownVisitWindow, populateTownVisitControls, populateCloseInteractionMessage} = require("../sessionTools.js")

module.exports = {
    config:{
        getSession:true
    },
    data:{
        name:"townVisit"
    },
    execute(interaction,componentConfig,callback){
        let session = componentConfig.session
        session.session_data.location = interaction.values[0]
        if(session.type == "townVisit"){
            if(interaction.values[0] != "end"){
                interaction.update({
                    content: " ",
                    embeds: populateTownVisitWindow(session),
                    components: populateTownVisitControls(session),
                    ephemeral:true
                })

                callback({
                    updateSession:session
                })
            } else {

                let updates = [
                    {
                        id:session.user_ids[0],
                        path:"",
                        value:session.session_data.player
                    }
                ]

                interaction.update(populateCloseInteractionMessage("Town Visit Finished"))

                callback({
                    removeSession:session,
                    updatePlayer:updates
                })
            }
        }
    }
}