// const { SlashCommandBuilder } = require('@discordjs/builders');
// const { MessageActionRow, MessageSelectMenu, MessageButton } = require('discord.js');

const { populateInventoryControls, populateInventoryWindow } = require("../sessionTools.js")

module.exports = {
    config:{
        getSession:true
    },
    data:{
        name:"sellItem"
    },
    execute(interaction,componentConfig,callback){
        let session = componentConfig.session
        if(session.type == "inventory"){
            
            if(parseInt(session.session_data.player.weapon) > parseInt(session.session_data.selected)){
                session.session_data.player.weapon = parseInt(session.session_data.player.weapon) - 1
            } else if(parseInt(session.session_data.player.weapon) == parseInt(session.session_data.selected)){
                delete session.session_data.player.weapon
            }

            if(parseInt(session.session_data.player.gear) > parseInt(session.session_data.selected)){
                session.session_data.player.gear = parseInt(session.session_data.player.gear) - 1
            } else if(parseInt(session.session_data.player.gear) == parseInt(session.session_data.selected)){
                delete session.session_data.player.gear
            }

            session.session_data.inventory.splice(session.session_data.selected,1)

            session.session_data.sellReward.gold += 10
            session.session_data.sellReward.rep += 3
            session.session_data.selected = null

            interaction.update({
                content: " ",
                components: populateInventoryControls(session),
                embeds: populateInventoryWindow(session),
                ephemeral: true,
            })
            
            callback({
                updateSession:session
            })
        }
    }
}