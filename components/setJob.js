// const { SlashCommandBuilder } = require('@discordjs/builders');
// const { MessageActionRow, MessageSelectMenu, MessageButton } = require('discord.js');

const { populateTownVisitControls, populateTownVisitWindow } = require("../sessionTools.js")

module.exports = {
    config:{
        getSession:true
    },
    data:{
        name:"setJob"
    },
    execute(interaction,componentConfig,callback){
        let session = componentConfig.session
        session.session_data.player.job = interaction.values[0];
        if(session.type == "townVisit"){
            interaction.update({
                content: " ",
                embeds: populateTownVisitWindow(session),
                components: populateTownVisitControls(session),
                ephemeral:true
            })

            callback({
                updateSession:session
            })
        }
    }
}