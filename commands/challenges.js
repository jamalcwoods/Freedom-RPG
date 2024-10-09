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
        if(playerData.tutorial != "completed"){
            interaction.reply({ content: "You must complete the tutorial before accessing this command. For help seeing what's next to do, perform the `/tutorial` command", ephemeral: true });    
            callback({})
            return;
        }

        let now = new Date();
        
        const embed = new MessageEmbed;
        embed.setColor("#7289da")
        
        if(playerData.dailyChallenge != undefined){
            if(playerData.dailyChallenge == true){
                embed.addField(
                    "Daily Task",
                    "COMPLETE",
                )
            } else {
                let challengeText = ""
                switch(playerData.dailyChallenge){
                    case 0:
                        challengeText = "Select a dungeon by visiting an adventure hall and clear a level " + Math.ceil(playerData.level/10) + " dungeon run"
                        break;

                    case 1:
                        challengeText = "Support the town by visiting a militia hall and earning a total of 20 town points by completing missions"
                        break;

                    case 2:
                        challengeText = "View your current challenges and complete one to earn a gold reward"
                        break;
                }
                if(playerData.dailyChallenge == 1){
                    challengeText += "\nProgress: " + playerData.dailyChallengeProgress + "/20"
                }
                embed.addField(
                    "Daily Task",
                    challengeText,
                )
            }
        }

        if(playerData.challenges && playerData.challenges.length > 0){
            embed.setTitle(playerData.name + "'s Challenges (" + playerData.challenges.length + "/5)")
            for(c of playerData.challenges){
                embed.addField(
                    challengeDict[c.type].name + " - Rank " + c.rank + " (" + c.rank * 300 + " gold)",
                    challengeDict[c.type].description.replace("X",c.progress + "/" + c.goal),
                )
            }
            if(playerData.challenges.length < 5){   
                embed.addField("Time till new challenge added: ",msToTime(playerData.challengeTimer - now.getTime()))
            }
            embed.addField("Note","Entirely completing multiple challenges in one combat instance will increase the rewards")
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