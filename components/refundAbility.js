// const { SlashCommandBuilder } = require('@discordjs/builders');
// const { MessageActionRow, MessageSelectMenu, MessageButton } = require('discord.js');

const { populateManageAbilityControls, populateManegeAbilityWindow } = require("../sessionTools.js")
const { calculateAbilityCost } = require("../tools.js")

module.exports = {
    config:{
        getSession:true
    },
    data:{
        name:"refundAbility"
    },
    execute(interaction,componentConfig,callback){
        let session = componentConfig.session
        if(session.session_data.player.abilities.length > 1){
            let cost = calculateAbilityCost(session.session_data.player.abilities[session.session_data.temp.selected])
            let pointReturn = Math.ceil(Math.ceil(Math.pow(cost,2)/450)/10)
            session.session_data.temp.returnMessage = session.session_data.player.name + " received " + pointReturn + " ability points"
            session.session_data.player.abilitypoints += pointReturn
            session.session_data.player.abilities.splice(session.session_data.temp.selected,1)

            delete session.session_data.temp.selected

            interaction.update({
                content:" ",
                embeds:populateManegeAbilityWindow(session),
                components:populateManageAbilityControls(session) 
            })
            
            callback({
                updateSession:session
            })
        } else {
            interaction.reply({ content: 'You must have one ability at all times', ephemeral: true });
        }
    }
}