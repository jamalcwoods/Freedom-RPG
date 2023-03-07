// const { SlashCommandBuilder } = require('@discordjs/builders');
// const { MessageActionRow, MessageSelectMenu, MessageButton } = require('discord.js');

const { statIncreaseRatios }= require("../data.json");
const { populateStatEditWindow, populateStatEditButtons } = require("../sessionTools.js")

module.exports = {
    config:{
        getSession:true
    },
    data:{
        name:"increaseStat"
    },
    execute(interaction,componentConfig,callback){
        let session = componentConfig.session
        if(session.type == "stats" && session.session_data.editingStat != "none"){
            let editingStat = session.session_data.editingStat
            let statpointsNeeded;
            if(session.session_data.faction != -1){
                if(statIncreaseRatios[session.session_data.faction][editingStat] > 0){
                    statpointsNeeded = 1
                } else {
                    statpointsNeeded = 1/statIncreaseRatios[session.session_data.faction][editingStat]
                }
            } else {
                statpointsNeeded = 1
            }
            if(session.session_data.statpoints >= statpointsNeeded){
                if(session.session_data.faction != -1){
                    session.session_data.stats[editingStat] += statIncreaseRatios[session.session_data.faction][editingStat]
                } else {
                    session.session_data.stats[editingStat] += 1
                }
                session.session_data.statpoints -= statpointsNeeded
                interaction.update({
                    content: " ",
                    components: populateStatEditButtons(session),
                    embeds: populateStatEditWindow(session)
                })
                callback({
                    updateSession:session
                })
            }
        }
    }
}