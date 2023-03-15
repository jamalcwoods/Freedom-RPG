// const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { getTownDBData } = require("../firebaseTools.js")
const { parseReward, applyTownReputation } = require("../tools.js")

module.exports = {
    config:{
        getSession:true
    },
    data:{
        name:"closeInventory"
    },
    async execute(interaction,componentConfig,callback){
        getTownDBData(interaction.guild.id,function(town){
            let session = componentConfig.session

            session.session_data.player.inventory = session.session_data.inventory
            
            let rewardsText = ""
            if(session.session_data.sellReward.rep > 0){
                rewardsText += session.session_data.player.name + " earned " + session.session_data.sellReward.rep + " reputation for the town of " + town.name + "\n"
                applyTownReputation(town,session.session_data.player.id,session.session_data.sellReward.rep) 
            }
            
            if(session.session_data.sellReward.gold > 0){
                let result = parseReward({
                    type:"resource",
                    resource:"gold",
                    resourceName:"gold",
                    amount: session.session_data.sellReward.gold
                }, session.session_data.player)
                session.session_data.player = result[0]
                for(msg of result[1]){
                    rewardsText += msg + "\n"
                }
            }

            let updates = [
                {
                    id:session.user_ids[0],
                    path:"",
                    value:session.session_data.player
                }
            ]

            let townUpdates = [{
                id:town.id,
                path:"reputations",
                value:town.reputations
            }]
    
            const embed = new MessageEmbed()
			.setColor('#00ff00')
			.setTitle("Inventory Changes Saved")

            if(rewardsText != ""){
                embed.addField(
                    "Rewards",
                    rewardsText
                )
            }

            interaction.update({
                content: " ",
                components: [],
                embeds: [embed]
            })
            
            callback({
                removeSession:session,
                updatePlayer:updates,
                updateTown:townUpdates
            })
        })
    }
}