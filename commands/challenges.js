const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { challengeDict } = require("../data.json")
const { msToTime } = require("../tools.js")


module.exports = {

	data: new SlashCommandBuilder()
		.setName('challenges')
		.setDescription('View your challenges'),
    config:{
        getPlayerData:true
    },
	async execute(interaction,componentConfig,callback) {
        let playerData = componentConfig.playerData

        let now = new Date();
        
        const embed = new MessageEmbed;
        embed.setColor("#7289da")
        
        if(playerData.challenges && playerData.challenges.length > 0){
            embed.setTitle(playerData.name + "'s Challenges (" + playerData.challenges.length + "/5)")
            for(c of playerData.challenges){
                embed.addField(
                    challengeDict[c.type].name + " - Rank " + c.rank + " (" + c.rank * 50 + " gold / " + c.rank * 10 + " Ability Points)",
                    challengeDict[c.type].description.replace("X",c.progress + "/" + c.goal),
                )
            }
            if(playerData.challenges.length < 5){   
                embed.addField("Time till new challenge added: ",msToTime(playerData.challengeTimer - now.getTime()))
            }
            embed.addField("Tip","Entirely completing multiple challenges in one combat instance will increase the rewards")
        } else {
            embed.setTitle(playerData.name + "'s Challenges")
            embed.addField("No New Challenges","You will receive a new challenge in " + msToTime(playerData.challengeTimer - now.getTime()))
        }
        

        if(componentConfig.forceUpdateInteraction){
            interaction.update({
                content: " ",
                embeds: [embed],
                ephemeral: false,
            })
        } else {
            interaction.reply({
                content: " ",
                embeds: [embed],
                ephemeral: false,
            })
        }
        
        
        callback({})
        
	},
};