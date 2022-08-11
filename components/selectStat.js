// const { SlashCommandBuilder } = require('@discordjs/builders');
// const { MessageActionRow, MessageSelectMenu, MessageButton } = require('discord.js');

const { populateStatEditWindow, populateStatEditButtons } = require("../sessionTools.js")

module.exports = {
    config:{
        getSession:true
    },
    data:{
        name:"selectStat"
    },
    execute(interaction,componentConfig,callback){
        let session = componentConfig.session
        if(session.type == "stats"){
            session.session_data.editingStat = interaction.values[0];
            interaction.update({
                content: populateStatEditWindow(session),
                components: populateStatEditButtons(session)
            })
            callback({
                updateSession:session
            })
        }
    }
}