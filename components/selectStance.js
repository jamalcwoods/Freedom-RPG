// const { SlashCommandBuilder } = require('@discordjs/builders');
// const { MessageActionRow, MessageSelectMenu, MessageButton } = require('discord.js');

const { update } = require("firebase/database")
const { processCombatSession, processEndOfTurn, populateStanceManagerControls, populateStanceManagerWindow} = require("../sessionTools.js")
module.exports = {
    config:{
        getSession:true,
        getClient:true
    },
    data:{
        name:"selectStance"
    },
    execute(interaction,componentConfig,callback){
        let error = ""
        let session = componentConfig.session
        if(session.type == "combat"){
            for(var i = 0;i < session.session_data.fighters.length;i++){
                let fighter = session.session_data.fighters[i]
                if(fighter.staticData.id == interaction.user.id){
                    fighter.stanceSwitch = interaction.values[0]
                    session = processCombatSession(session)
                    break;
                }
            }

            componentConfig.client.channels.fetch(session.session_data.c_id).then(channel => {
                channel.messages.fetch(session.session_data.m_id).then(message => {
                    processEndOfTurn(error,session,interaction,callback,message)
                })
            })
        } else if(session.type == "stances"){
            session.session_data.viewingStance = interaction.values[0]

            interaction.update({
                content: " ",
                components: populateStanceManagerControls(session),
                embeds: populateStanceManagerWindow(session)
            })
    
            callback({
                updateSession:session
            })
        }
    }
}