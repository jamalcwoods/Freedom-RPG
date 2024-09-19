// const { SlashCommandBuilder } = require('@discordjs/builders');
// const { MessageActionRow, MessageSelectMenu, MessageButton } = require('discord.js');

const { populateAbilityCreatorWindow, populateAbilityCreatorButtons } = require("../sessionTools.js")

module.exports = {
    config:{
        getSession:true
    },
    data:{
        name:"selectAttribute"
    },
    execute(interaction,componentConfig,callback){
        let session = componentConfig.session
        if(session.type == "makeAbility"){
            session.session_data.editingAttribute = interaction.values[0];
            let msg = " "
            if(session.session_data.tutorialMsg){
                msg = session.session_data.tutorialMsg
            }
            interaction.update({
                content: msg,
                components: populateAbilityCreatorButtons(session),
                embeds: populateAbilityCreatorWindow(session)
            })
            
            callback({
                updateSession:session
            })
        }
    }
}