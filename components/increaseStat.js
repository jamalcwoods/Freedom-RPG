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
                    statpointsNeeded = session.session_data.editAmount
                } else {
                    statpointsNeeded = session.session_data.editAmount/statIncreaseRatios[session.session_data.faction][editingStat]
                }
            } else {
                statpointsNeeded = session.session_data.editAmount
            }
            if(session.session_data.statpoints >= statpointsNeeded){
                if(session.session_data.faction != -1){
                    session.session_data.stats[editingStat] += statIncreaseRatios[session.session_data.faction][editingStat] * session.session_data.editAmount
                } else {
                    session.session_data.stats[editingStat] += session.session_data.editAmount
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