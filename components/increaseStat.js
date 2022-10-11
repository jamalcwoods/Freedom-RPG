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
            if(statIncreaseRatios[session.session_data.faction][editingStat] > 0){
                statpointsNeeded = 1
            } else {
                statpointsNeeded = 1/statIncreaseRatios[session.session_data.faction][editingStat]
            }
            if(session.session_data.statpoints >= statpointsNeeded){
                session.session_data.stats[editingStat] += statIncreaseRatios[session.session_data.faction][editingStat]
                session.session_data.statpoints -= statpointsNeeded
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
}