// const { SlashCommandBuilder } = require('@discordjs/builders');
// const { MessageActionRow, MessageSelectMenu, MessageButton } = require('discord.js');

const { populateInventoryControls, populateInventoryWindow } = require("../sessionTools.js")

module.exports = {
    config:{
        getSession:true
    },
    data:{
        name:"sellAll"
    },
    execute(interaction,componentConfig,callback){
        let session = componentConfig.session
        if(session.type == "inventory"){
            for(var i = 0; i < session.session_data.inventory.length; i++){
                if(!session.session_data.inventory[i].favorite){
                    if(parseInt(session.session_data.player.weapon) > i){
                        session.session_data.player.weapon = parseInt(session.session_data.player.weapon) - 1
                    } else if(parseInt(session.session_data.player.weapon) == i){
                        delete session.session_data.player.weapon
                    }
        
                    if(parseInt(session.session_data.player.gear) > i){
                        session.session_data.player.gear = parseInt(session.session_data.player.gear) - 1
                    } else if(parseInt(session.session_data.player.gear) == i){
                        delete session.session_data.player.gear
                    }
        
                    session.session_data.inventory.splice(i,1)
                    i--
                    session.session_data.sellReward.gold += 50
                    session.session_data.sellReward.rep += 10
                }
            }
            
            session.session_data.selected = null

            while(Math.ceil(session.session_data.inventory.length/5) < session.session_data.page){
                session.session_data.page--
            }

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