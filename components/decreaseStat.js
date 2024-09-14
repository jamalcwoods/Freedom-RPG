// const { SlashCommandBuilder } = require('@discordjs/builders');
// const { MessageActionRow, MessageSelectMenu, MessageButton } = require('discord.js');

const { statIncreaseRatios }= require("../data.json");
const { populateStatEditWindow, populateStatEditButtons } = require("../sessionTools.js")

module.exports = {
    config:{
        getSession:true
    },
    data:{
        name:"decreaseStat"
    },
    execute(interaction,componentConfig,callback){
        let session = componentConfig.session
        if(session.type == "stats" && session.session_data.editingStat != "none"){
            let editingStat = session.session_data.editingStat
            let statpointsNeeded;
            statpointsNeeded = session.session_data.editAmount
            if(session.session_data.stats[editingStat] > session.session_data.prevStats[editingStat]){
                session.session_data.stats[editingStat] -= session.session_data.editAmount
                session.session_data.statpoints += statpointsNeeded
                interaction.update({
                    content: " ",
                    components: populateStatEditButtons(session),
                    embeds: populateStatEditWindow(session)
                })
                callback({
                    updateSession:session
                })
            } else {
                interaction.update({
                    content: " ",
                    components: populateStatEditButtons(session),
                    embeds: populateStatEditWindow(session)
                })
            }
        }
    }
}